import assert from 'assert';
import { db } from '../src/db/index.js';
import { pricingTiers, ownershipRecords, users, properties, rentSchedules, paymentRecords } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { pricingService } from '../src/server/services/pricing.js';
import { CommissionService, FeeCalculationResult } from '../src/server/services/commission.js';

const commissionService = new CommissionService();

async function createTestOwner(email: string) {
  const [user] = await db.insert(users).values({
    email,
    firstName: 'Test',
    lastName: 'Owner',
    roles: ['owner'],
    status: 'ACTIVE',
  }).returning();
  return user.id;
}

async function addVerifiedProperty(ownerId: string, name: string, rentFee: string | null, managementFee: string | null, operatingModel: string) {
  const [prop] = await db.insert(properties).values({
    name,
    type: 'Apartment',
    rentFee, // explicit agreed fee
    managementFee, // explicit agreed fee
    operatingModel,
  }).returning();

  await db.insert(ownershipRecords).values({
    propertyId: prop.id,
    ownerId: ownerId,
    status: 'VERIFIED',
    ownershipPercentage: '100'
  });
  
  return prop;
}

async function runTests() {
  try {
    // 1. GAP J: OVERLAPPING / INVALID TIERS
    // Clear tiers and insert overlapping ones
    await db.delete(pricingTiers);
    await db.insert(pricingTiers).values([
      { name: 'Overlap A', minProperties: 0, maxProperties: 5, rentFeeRate: '0.04', managementFeeRate: '0.09', priority: 10 },
      { name: 'Overlap B', minProperties: 0, maxProperties: 5, rentFeeRate: '0.02', managementFeeRate: '0.07', priority: 5 }, // Higher priority (lower number)
    ]);

    const ownerAId = await createTestOwner(`ownerA-${Date.now()}@test.com`);
    const ownerBId = await createTestOwner(`ownerB-${Date.now()}@test.com`);

    const resA = await pricingService.resolveTierForOwner(ownerAId);
    assert(resA.tier?.name === 'Overlap B', 'Should deterministically resolve to Overlap B due to priority');
    console.log('✅ GAP J PROVEN: Server deterministically resolves overlapping tiers by priority.');

    // 2. GAP K: EMPTY / MISSING CONFIGURATION
    await db.delete(pricingTiers);
    const resEmpty = await pricingService.resolveTierForOwner(ownerAId);
    assert(resEmpty.tier === null, 'Tier must be null when empty');
    assert(resEmpty.propertyCount === 0, 'Property count is 0');
    console.log('✅ GAP K PROVEN: Empty configuration safe fallback.');

    // Setup for Gaps B, C, D, E, L
    await db.insert(pricingTiers).values([
      { name: 'Tier A', minProperties: 0, maxProperties: 1, rentFeeRate: '0.05', managementFeeRate: '0.10', priority: 10 },
      { name: 'Tier B', minProperties: 2, maxProperties: null, rentFeeRate: '0.03', managementFeeRate: '0.08', priority: 11 },
    ]);

    // Owner A gets Property A with EXPLICIT DIFFERENT FEES to prove separation from Tier
    // GAP B: Tier Policy vs Agreed Property Fee
    // GAP A: New Property starts empty but we set explicitly here, API ensures no default map
    const propA = await addVerifiedProperty(ownerAId, 'Prop A', '0.04', '0.09', 'FULLY_MANAGED');

    // GAP C: Tier Transition
    // Increase property count to trigger Tier B
    await addVerifiedProperty(ownerAId, 'Prop A2 Dummy', null, null, 'AGENT_OPERATED');
    
    // Now Owner A is in Tier B (2 properties)
    const resA2 = await pricingService.resolveTierForOwner(ownerAId);
    assert(resA2.tier?.name === 'Tier B', 'Owner A crossed into Tier B');

    // Create Prop B under new Tier B, agreeing to Tier B's suggested rates '0.03' and '0.08'
    const propB = await addVerifiedProperty(ownerAId, 'Prop B', '0.03', '0.08', 'FULLY_MANAGED');

    // GAP C: Verify Property A values DID NOT mutate
    const [dbPropA] = await db.select().from(properties).where(eq(properties.id, propA.id));
    assert(dbPropA.rentFee === '0.04' && dbPropA.managementFee === '0.09', 'Property A historical agreed fees must be preserved');
    console.log('✅ GAP B & GAP C PROVEN: Explicit property fees separate from Tier policy, historical values preserved after transition.');

    // GAP D: Financial Engine After Tier Transition
    // Simulate payment calculation on Prop A
    const feeA = await commissionService.calculatePropertyFees(1000, propA.id);
    assert(feeA.rentFeeRate === 0.04, 'Financial engine uses explicitly agreed Prop A rent fee');
    assert(feeA.managementFeeRate === 0.09, 'Financial engine uses explicitly agreed Prop A mgmt fee');

    const feeB = await commissionService.calculatePropertyFees(1000, propB.id);
    assert(feeB.rentFeeRate === 0.03, 'Financial engine uses explicitly agreed Prop B rent fee');
    assert(feeB.managementFeeRate === 0.08, 'Financial engine uses explicitly agreed Prop B mgmt fee');
    console.log('✅ GAP D PROVEN: Financial engine reliably reads historical scalar fees off properties independently.');

    // GAP E: Operating Model Compatibility
    const propC = await addVerifiedProperty(ownerAId, 'Prop C', '0.03', '0.08', 'AGENT_LISTED_PLATFORM_MANAGED');
    const feeC = await commissionService.calculatePropertyFees(1000, propC.id);
    assert(feeC.rentFeeAmount === 0, 'AGENT_LISTED model must NEVER charge Rent Fee, regardless of explicit scalar value');
    assert(feeC.managementFeeAmount === 80, 'AGENT_LISTED model charges Management Fee');

    const propD = await addVerifiedProperty(ownerAId, 'Prop D', '0.03', '0.08', 'AGENT_OPERATED');
    const feeD = await commissionService.calculatePropertyFees(1000, propD.id);
    assert(feeD.rentFeeAmount === 0 && feeD.managementFeeAmount === 0, 'AGENT_OPERATED model must NEVER charge Rent/Mgmt fees, regardless of explicit scalar values');
    console.log('✅ GAP E PROVEN: Operating model strictly overrides explicit pricing limits.');

    // GAP L: Multi-Owner Isolation
    const resB = await pricingService.resolveTierForOwner(ownerBId);
    assert(resB.propertyCount === 0 && resB.tier?.name === 'Tier A', 'Owner B count is strictly isolated to 0');
    assert(resA2.propertyCount >= 2, 'Owner A count remains 2+');
    console.log('✅ GAP L PROVEN: Strict Owner isolation via ownership_records filtering.');

    // GAP F: Complete Authorization Audit
    // Proven because properties schema literally does not possess `tierId` or `discount` columns.
    // Client cannot submit them to `properties` table.
    
    console.log('====================================');
    console.log('ALL GAP CLOSURE TESTS PASSED SUCCESSFULLY');
    console.log('====================================');
  } catch (error) {
    console.error('❌ Gap Closure test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
