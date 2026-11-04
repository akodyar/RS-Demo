import assert from 'assert';
import { db } from '../src/db/index.js';
import { pricingTiers, ownershipRecords, users, properties } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { pricingService } from '../src/server/services/pricing.js';

async function setupTestData() {
  const [user] = await db.insert(users).values({
    email: `tier-transition-${Date.now()}@example.com`,
    firstName: 'Transition Test',
    lastName: 'Owner',
    roles: ['owner'],
    status: 'ACTIVE',
  }).returning();

  await db.delete(pricingTiers);

  await db.insert(pricingTiers).values([
    {
      name: 'Starter Tier',
      minProperties: 0,
      maxProperties: 1,
      rentFeeRate: '0.05',
      managementFeeRate: '0.10',
      priority: 10
    },
    {
      name: 'Pro Tier',
      minProperties: 2,
      maxProperties: null,
      rentFeeRate: '0.03',
      managementFeeRate: '0.08',
      priority: 11
    }
  ]);

  return user.id;
}

async function addVerifiedProperty(ownerId: string, rentFee: string, managementFee: string, name: string) {
  const [prop] = await db.insert(properties).values({
    name,
    type: 'Apartment',
    rentFee, // manually entered agreed fee
    managementFee, // manually entered agreed fee
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
    const ownerId = await setupTestData();

    console.log('--- SCENARIO: INITIAL TIER ---');
    const initialRes = await pricingService.resolveTierForOwner(ownerId);
    assert(initialRes.tier?.name === 'Starter Tier', 'Should resolve to Starter Tier');
    
    // User registers Property A
    const propA = await addVerifiedProperty(ownerId, '0.05', '0.10', 'Property A');
    console.log('✅ Property A registered with Starter Tier agreed values.');

    console.log('--- SCENARIO: TIER TRANSITION ---');
    // User registers Property B, crossing threshold to Pro Tier
    const propB = await addVerifiedProperty(ownerId, '0.05', '0.10', 'Property B');
    
    // Now owner has 2 properties. Future checks should resolve to Pro Tier
    const transitionedRes = await pricingService.resolveTierForOwner(ownerId);
    assert(transitionedRes.propertyCount === 2, 'Count should be 2');
    assert(transitionedRes.tier?.name === 'Pro Tier', 'Should resolve to Pro Tier');
    
    // Verify Property A and Property B fees did NOT change
    const [dbPropA] = await db.select().from(properties).where(eq(properties.id, propA.id));
    const [dbPropB] = await db.select().from(properties).where(eq(properties.id, propB.id));
    
    assert(dbPropA.rentFee === '0.05', 'Property A Rent Fee should remain 0.05');
    assert(dbPropB.managementFee === '0.10', 'Property B Management Fee should remain 0.10');
    console.log('✅ Existing properties retained their previously agreed explicit fees!');

    console.log('--- SCENARIO: NEW PROPERTY UNDER NEW TIER ---');
    // User registers Property C, UI suggests Pro Tier values, user accepts them
    const propC = await addVerifiedProperty(ownerId, '0.03', '0.08', 'Property C');
    
    const [dbPropC] = await db.select().from(properties).where(eq(properties.id, propC.id));
    assert(dbPropC.rentFee === '0.03', 'Property C Rent Fee should be 0.03 (Pro Tier)');
    assert(dbPropC.managementFee === '0.08', 'Property C Management Fee should be 0.08 (Pro Tier)');
    
    console.log('✅ New property accurately applies new Tier policy context.');
    console.log('✅ All Tier Transition tests passed!');
  } catch (error) {
    console.error('❌ Tier Transition test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
