import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  listings,
  ownershipRecords,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { UserRole, Permission } from '../src/types/index.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { FeatureFlags } from '../src/utils/featureFlags.js';

test('Owner Marketplace Listing Rental-Only Boundary Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `own_list_${TIMESTAMP}`;

  // 1. Setup Express Test App mounting real API Router
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Provision Personas
  const ownerA = {
    id: `${PREFIX}_owner_A`,
    firstName: 'Owner',
    lastName: 'Alpha',
    email: `${PREFIX}_ownerA@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const ownerB = {
    id: `${PREFIX}_owner_B`,
    firstName: 'Owner',
    lastName: 'Beta',
    email: `${PREFIX}_ownerB@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  await db.insert(users).values([ownerA, ownerB]).onConflictDoNothing();

  const tokenOwnerA = signAuthToken({ id: ownerA.id, email: ownerA.email, roles: ownerA.roles });
  const tokenOwnerB = signAuthToken({ id: ownerB.id, email: ownerB.email, roles: ownerB.roles });

  // Provision Properties
  const propA = {
    id: `${PREFIX}_prop_A`,
    name: 'Owner A Rental Villa',
    type: 'VILLA',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    currency: 'USD',
    address: { city: 'Erbil', street: '100M Road', region: 'Kurdistan' },
    country: 'Iraq',
  };

  const propB = {
    id: `${PREFIX}_prop_B`,
    name: 'Owner B Independent Property',
    type: 'APARTMENT',
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    currency: 'IQD',
    address: { city: 'Sulaymaniyah', street: 'Salim St', region: 'Kurdistan' },
    country: 'Iraq',
  };

  await db.insert(properties).values([propA, propB]).onConflictDoNothing();

  // Authoritative Ownership: Owner A owns Prop A, Owner B owns Prop B
  await db.insert(ownershipRecords).values([
    {
      id: `${PREFIX}_own_rec_A`,
      propertyId: propA.id,
      ownerId: ownerA.id,
      ownershipPercentage: '100',
      status: 'VERIFIED',
    },
    {
      id: `${PREFIX}_own_rec_B`,
      propertyId: propB.id,
      ownerId: ownerB.id,
      ownershipPercentage: '100',
      status: 'VERIFIED',
    },
  ]).onConflictDoNothing();

  t.after(async () => {
    server.close();
    // Clean up created records for this test run
    await db.delete(listings).where(sql`property_id IN (${propA.id}, ${propB.id})`);
    await db.delete(ownershipRecords).where(sql`property_id IN (${propA.id}, ${propB.id})`);
    await db.delete(properties).where(sql`id IN (${propA.id}, ${propB.id})`);
    await db.delete(users).where(sql`id IN (${ownerA.id}, ${ownerB.id})`);
  });

  // Helpers
  async function postOwnerListing(endpoint: string, token: string, body: any) {
    const res = await fetch(`${baseUrl}/owner/marketplace/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // --------------------------------------------------------------------------
  // Scenario 1: Authorized owner can create a valid FOR_RENT listing
  // --------------------------------------------------------------------------
  await t.test('1. Authorized owner can create a valid FOR_RENT listing', async () => {
    const res = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: 'FOR_RENT',
      price: 2500,
      currency: 'USD',
      title: 'Luxury Villa for Rent',
      description: 'Spacious family villa in Erbil',
    });

    assert.strictEqual(res.status, 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.type, 'FOR_RENT');
    assert.strictEqual(res.data.status, 'DRAFT');
    assert.strictEqual(res.data.propertyId, propA.id);
    assert.strictEqual(res.data.publisherUserId, ownerA.id);
    assert.strictEqual(res.data.currency, 'USD');

    // Verify persisted in PostgreSQL
    const [saved] = await db.select().from(listings).where(eq(listings.id, res.data.id)).limit(1);
    assert.ok(saved, 'Listing must be persisted in database');
    assert.strictEqual(saved.type, 'FOR_RENT');
    assert.strictEqual(saved.status, 'DRAFT');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Endpoint rejects FOR_SALE with 403 BUY_SELL_DISABLED
  // --------------------------------------------------------------------------
  await t.test('2. Owner endpoint rejects FOR_SALE with 403 BUY_SELL_DISABLED', async () => {
    const initialListings = await db.select().from(listings).where(eq(listings.propertyId, propA.id));
    const initialCount = initialListings.length;

    // Test on /marketplace/list
    const resList = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: 'FOR_SALE',
      price: 350000,
      title: 'Attempted Sale Villa',
    });

    assert.strictEqual(resList.status, 403, `Expected 403, got ${resList.status}`);
    assert.strictEqual(resList.data.error, 'BUY_SELL_DISABLED');
    assert.ok(resList.data.message?.includes('Sale workflows and FOR_SALE listings are disabled'));

    // Test on alias /marketplace/listings
    const resListings = await postOwnerListing('listings', tokenOwnerA, {
      propertyId: propA.id,
      type: 'FOR_SALE',
      price: 350000,
      title: 'Attempted Sale Villa via /listings',
    });

    assert.strictEqual(resListings.status, 403, `Expected 403, got ${resListings.status}`);
    assert.strictEqual(resListings.data.error, 'BUY_SELL_DISABLED');

    // Confirm no additional listing was persisted
    const currentListings = await db.select().from(listings).where(eq(listings.propertyId, propA.id));
    assert.strictEqual(currentListings.length, initialCount, 'No listing must be persisted on rejected FOR_SALE');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Endpoint rejects SALE with 403 BUY_SELL_DISABLED
  // --------------------------------------------------------------------------
  await t.test('3. Owner endpoint rejects SALE with 403 BUY_SELL_DISABLED', async () => {
    const initialListings = await db.select().from(listings).where(eq(listings.propertyId, propA.id));
    const initialCount = initialListings.length;

    const res = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: 'SALE',
      price: 400000,
      title: 'Attempted SALE Villa',
    });

    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    assert.strictEqual(res.data.error, 'BUY_SELL_DISABLED');
    assert.ok(res.data.message?.includes('Sale workflows and FOR_SALE listings are disabled'));

    const currentListings = await db.select().from(listings).where(eq(listings.propertyId, propA.id));
    assert.strictEqual(currentListings.length, initialCount, 'No listing must be persisted on rejected SALE');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Unsupported or malformed listing types are rejected with 400
  // --------------------------------------------------------------------------
  await t.test('4. Unsupported or malformed listing types are rejected with 400', async () => {
    // 4a. RENT_TO_OWN
    const resRentToOwn = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: 'RENT_TO_OWN',
      price: 2000,
      title: 'Rent To Own Attempt',
    });
    assert.strictEqual(resRentToOwn.status, 400);
    assert.strictEqual(resRentToOwn.data.error, 'VALIDATION_ERROR');

    // 4b. OTHER
    const resOther = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: 'OTHER',
      price: 2000,
      title: 'Other Type Attempt',
    });
    assert.strictEqual(resOther.status, 400);
    assert.strictEqual(resOther.data.error, 'VALIDATION_ERROR');

    // 4c. Empty string type
    const resEmpty = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: '   ',
      price: 2000,
      title: 'Whitespace Type Attempt',
    });
    assert.strictEqual(resEmpty.status, 400);

    // 4d. Missing type
    const resMissing = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      price: 2000,
      title: 'Missing Type Attempt',
    });
    assert.strictEqual(resMissing.status, 400);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Rejected requests do not persist any listing in PostgreSQL
  // --------------------------------------------------------------------------
  await t.test('5. PostgreSQL database contains 0 sale listings for the test property', async () => {
    const saleListings = await db.select().from(listings).where(
      and(
        eq(listings.propertyId, propA.id),
        sql`type IN ('FOR_SALE', 'SALE', 'RENT_TO_OWN', 'OTHER')`
      )
    );
    assert.strictEqual(saleListings.length, 0, 'Zero invalid or sale listings must exist in database');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Direct repository invocation cannot bypass rental-only invariant
  // --------------------------------------------------------------------------
  await t.test('6. Direct repository invocation cannot bypass rental-only invariant', async () => {
    // 6a. FOR_SALE direct call must throw BUY_SELL_DISABLED
    await assert.rejects(
      async () => {
        await ownerRepository.listPropertyOnMarketplace(
          { id: ownerA.id, roles: ownerA.roles },
          {
            propertyId: propA.id,
            type: 'FOR_SALE',
            price: 500000,
            title: 'Direct Repo Sale Attempt',
          }
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('BUY_SELL_DISABLED'), `Expected BUY_SELL_DISABLED error, got: ${err.message}`);
        return true;
      }
    );

    // 6b. SALE direct call must throw BUY_SELL_DISABLED
    await assert.rejects(
      async () => {
        await ownerRepository.listPropertyOnMarketplace(
          { id: ownerA.id, roles: ownerA.roles },
          {
            propertyId: propA.id,
            type: 'SALE',
            price: 500000,
            title: 'Direct Repo SALE Attempt',
          }
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('BUY_SELL_DISABLED'), `Expected BUY_SELL_DISABLED error, got: ${err.message}`);
        return true;
      }
    );

    // 6c. Invalid type direct call must throw VALIDATION_ERROR
    await assert.rejects(
      async () => {
        await ownerRepository.listPropertyOnMarketplace(
          { id: ownerA.id, roles: ownerA.roles },
          {
            propertyId: propA.id,
            type: 'AUCTION',
            price: 500000,
            title: 'Direct Repo Invalid Attempt',
          }
        );
      },
      (err: any) => {
        assert.ok(err.message.includes('VALIDATION_ERROR'), `Expected VALIDATION_ERROR, got: ${err.message}`);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Unauthorized owner cannot create listing for property outside authority
  // --------------------------------------------------------------------------
  await t.test('7. Unauthorized owner cannot create listing for property outside their authority', async () => {
    // Owner A attempts to list Owner B's property
    const res = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propB.id,
      type: 'FOR_RENT',
      price: 1500000,
      title: 'IDOR Attempt by Owner A on Prop B',
    });

    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got: ${res.status}`);
    assert.ok(
      res.data.error?.includes('AUTHORITY_REQUIRED') || res.data.message?.includes('AUTHORITY_REQUIRED'),
      `Expected AUTHORITY_REQUIRED error, got: ${JSON.stringify(res.data)}`
    );

    // Confirm Prop B has 0 listings
    const propBListings = await db.select().from(listings).where(eq(listings.propertyId, propB.id));
    assert.strictEqual(propBListings.length, 0, 'No listing must be created on unauthorized attempt');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Existing rental listing behavior remains unchanged
  // --------------------------------------------------------------------------
  await t.test('8. Owner B creates valid rental listing with IQD currency on /marketplace/listings', async () => {
    const res = await postOwnerListing('listings', tokenOwnerB, {
      propertyId: propB.id,
      type: 'FOR_RENT',
      price: 1200000,
      currency: 'IQD',
      title: 'Apartment for Rent in Sulaymaniyah',
      description: 'Modern 2-bedroom rental apartment',
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.type, 'FOR_RENT');
    assert.strictEqual(res.data.currency, 'IQD');
    assert.strictEqual(res.data.status, 'DRAFT');
    assert.strictEqual(res.data.publisherUserId, ownerB.id);

    const [saved] = await db.select().from(listings).where(eq(listings.id, res.data.id)).limit(1);
    assert.ok(saved);
    assert.strictEqual(saved.type, 'FOR_RENT');
    assert.strictEqual(saved.currency, 'IQD');
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Normalization handles 'RENT' as 'FOR_RENT'
  // --------------------------------------------------------------------------
  await t.test('9. Type normalization accepts "rent" and persists as "FOR_RENT"', async () => {
    const res = await postOwnerListing('list', tokenOwnerA, {
      propertyId: propA.id,
      type: 'rent',
      price: 2600,
      title: 'Normalized Rental Villa',
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.type, 'FOR_RENT');

    const [saved] = await db.select().from(listings).where(eq(listings.id, res.data.id)).limit(1);
    assert.strictEqual(saved.type, 'FOR_RENT');
  });
});
