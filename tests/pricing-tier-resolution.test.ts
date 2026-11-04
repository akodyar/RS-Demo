import assert from 'assert';
import { db } from '../src/db/index.js';
import { pricingTiers, ownershipRecords, users, properties } from '../src/db/schema.js';
import { pricingService } from '../src/server/services/pricing.js';

async function setupTestData() {
  // Create user
  const [user] = await db.insert(users).values({
    email: 'tier-test@example.com',
    firstName: 'Tier Test',
    lastName: 'Owner',
    roles: ['owner'],
    status: 'ACTIVE',
  }).returning();

  // Create tiers
  await db.insert(pricingTiers).values([
    {
      name: 'Tier A',
      minProperties: 0,
      maxProperties: 2,
      rentFeeRate: '0.05',
      managementFeeRate: '0.10',
      priority: 1
    },
    {
      name: 'Tier B',
      minProperties: 3,
      maxProperties: null, // open-ended
      rentFeeRate: '0.03',
      managementFeeRate: '0.08',
      priority: 2
    }
  ]);

  return user.id;
}

async function addVerifiedProperty(ownerId: string, i: number) {
  const [prop] = await db.insert(properties).values({
    name: `Test Prop ${i}`,
    type: 'Apartment',
    rentFee: '0.05', // historical agreed fee
    managementFee: '0.10',
  }).returning();

  await db.insert(ownershipRecords).values({
    propertyId: prop.id,
    ownerId: ownerId,
    status: 'VERIFIED',
    ownershipPercentage: '100'
  });
}

async function runTests() {
  try {
    const ownerId = await setupTestData();

    // 1. Owner has 0 properties (should be Tier A)
    const result0 = await pricingService.resolveTierForOwner(ownerId);
    assert(result0.propertyCount === 0, 'Count should be 0');
    assert(result0.tier?.name === 'Tier A', 'Should resolve to Tier A');

    // 2. Owner has 1 property (should be Tier A)
    await addVerifiedProperty(ownerId, 1);
    const result1 = await pricingService.resolveTierForOwner(ownerId);
    assert(result1.propertyCount === 1, 'Count should be 1');
    assert(result1.tier?.name === 'Tier A', 'Should resolve to Tier A');

    // 3. Owner has 3 properties (should be Tier B)
    await addVerifiedProperty(ownerId, 2);
    await addVerifiedProperty(ownerId, 3);
    const result3 = await pricingService.resolveTierForOwner(ownerId);
    assert(result3.propertyCount === 3, 'Count should be 3');
    assert(result3.tier?.name === 'Tier B', 'Should resolve to Tier B');

    console.log('✅ All Pricing Tier tests passed!');
  } catch (error) {
    console.error('❌ Pricing Tier test failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runTests();
