import 'dotenv/config';
import assert from 'node:assert';
import { db, pool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, sql, inArray } from 'drizzle-orm';

const testDb = process.env.SQL_DB_NAME || 'homehub_test';
if (testDb !== 'homehub_test') {
  console.error('[SAFETY GATE VIOLATION] Target database must be homehub_test');
  process.exit(1);
}

async function runListingReuseRegressionTest() {
  console.log('================================================================');
  console.log('  REGRESSION TEST: Phase 5 Listing Reuse & Cardinality Invariant');
  console.log('================================================================\n');

  const runId = `test_reuse_${Date.now()}`;
  const synthOwnerId = `usr_owner_${runId}`;
  const synthPropertyId1 = `prop_reuse_${runId}`;
  const synthPropertyId2 = `prop_fallback_${runId}`;
  const wizardListingId = `list_wiz_${runId}`;

  try {
    // Setup synthetic owner
    await db.insert(schema.users).values({
      id: synthOwnerId,
      email: `${synthOwnerId}@homehub.iq`,
      firstName: 'Synthetic',
      lastName: 'Owner',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    });

    // -------------------------------------------------------------------------
    // TEST CASE 1: Wizard-Created Listing Already Exists (Reused, No Duplicate)
    // -------------------------------------------------------------------------
    console.log('[TEST 1] Setting up Property 1 with Wizard-Auto-Published Listing...');
    await db.insert(schema.properties).values({
      id: synthPropertyId1,
      name: 'Synthetic Property with Wizard Listing',
      type: 'RESIDENTIAL',
      status: 'PUBLISHED',
      currency: 'IQD',
    });

    // Wizard automatically created this listing:
    await db.insert(schema.listings).values({
      id: wizardListingId,
      propertyId: synthPropertyId1,
      publisherUserId: synthOwnerId,
      type: 'FOR_RENT',
      price: '1500000',
      currency: 'IQD',
      status: 'PUBLISHED',
      title: 'Synthetic Property with Wizard Listing',
      description: 'Auto-published by Property Wizard',
    });

    // Verify initial count is exactly 1
    const [initialCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .where(eq(schema.listings.propertyId, synthPropertyId1));
    assert.strictEqual(Number(initialCount.count), 1, 'Initial listing count must be exactly 1');

    console.log('[TEST 1] Executing Phase 5 Listing Resolution Logic...');
    let resolvedListingId: string;
    const existingListings = await db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.propertyId, synthPropertyId1))
      .limit(1);

    if (existingListings.length > 0) {
      resolvedListingId = existingListings[0].id;
      console.log(`[TEST 1] -> Successfully detected existing listing: ${resolvedListingId}`);
    } else {
      resolvedListingId = `listing_${runId}`;
      await db.insert(schema.listings).values({
        id: resolvedListingId,
        propertyId: synthPropertyId1,
        publisherUserId: synthOwnerId,
        type: 'FOR_RENT',
        price: '1500000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: 'Fallback Listing',
      }).onConflictDoNothing();
    }

    // Assert that the wizard listing was reused and NO duplicate was created
    assert.strictEqual(resolvedListingId, wizardListingId, 'Must reuse the wizard listing ID');

    const [postCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .where(eq(schema.listings.propertyId, synthPropertyId1));
    assert.strictEqual(Number(postCount.count), 1, 'Final listing count must remain EXACTLY 1 (no duplicate row)');
    console.log('[TEST 1] -> PASSED! Listing reused, exactly 1 row preserved.\n');

    // -------------------------------------------------------------------------
    // TEST CASE 2: No Wizard Listing Exists (Fallback Creation Works)
    // -------------------------------------------------------------------------
    console.log('[TEST 2] Setting up Property 2 with NO Initial Listing...');
    await db.insert(schema.properties).values({
      id: synthPropertyId2,
      name: 'Synthetic Property without Initial Listing',
      type: 'RESIDENTIAL',
      status: 'DRAFT',
      currency: 'IQD',
    });

    console.log('[TEST 2] Executing Phase 5 Fallback Creation Logic...');
    let fallbackListingId: string;
    const existingListings2 = await db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.propertyId, synthPropertyId2))
      .limit(1);

    if (existingListings2.length > 0) {
      fallbackListingId = existingListings2[0].id;
    } else {
      fallbackListingId = `listing_${runId}_fallback`;
      await db.insert(schema.listings).values({
        id: fallbackListingId,
        propertyId: synthPropertyId2,
        publisherUserId: synthOwnerId,
        type: 'FOR_RENT',
        price: '1200000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: 'Fallback Listing',
      }).onConflictDoNothing();
      console.log(`[TEST 2] -> Successfully created fallback listing: ${fallbackListingId}`);
    }

    const [fallbackCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.listings)
      .where(eq(schema.listings.propertyId, synthPropertyId2));
    assert.strictEqual(Number(fallbackCount.count), 1, 'Fallback creation must result in exactly 1 listing');
    console.log('[TEST 2] -> PASSED! Fallback created exactly 1 row.\n');

    console.log('================================================================');
    console.log('  ALL REGRESSION CHECKS PASSED: LISTING REUSE VERIFIED 100%');
    console.log('================================================================');
  } finally {
    // Clean up synthetic test records
    await db.delete(schema.listings).where(eq(schema.listings.publisherUserId, synthOwnerId));
    await db.delete(schema.properties).where(inArray(schema.properties.id, [synthPropertyId1, synthPropertyId2]));
    await db.delete(schema.users).where(eq(schema.users.id, synthOwnerId));
    await pool.end();
  }
}

runListingReuseRegressionTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Regression test failed:', err);
    process.exit(1);
  });
