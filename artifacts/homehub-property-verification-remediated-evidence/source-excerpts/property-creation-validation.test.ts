import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  listings,
  ownershipRecords,
  managementAgreements,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { UserRole } from '../src/types/index.js';

test('Server-Side Property Creation Validation Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `prop_val_${TIMESTAMP}`;

  // 1. Setup Express Test App mounting real API Router
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(() => {
    server.close();
  });

  // Helper for generic route POST /api/properties
  async function postGenericProperty(token: string, body: any) {
    const res = await fetch(`${baseUrl}/properties`, {
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

  // Helper for owner-specific route POST /api/owner/properties
  async function postOwnerProperty(token: string, body: any) {
    const res = await fetch(`${baseUrl}/owner/properties`, {
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

  // 2. Provision Test Personas
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

  const companyA = {
    id: `${PREFIX}_company_A`,
    name: 'Alpha Holding Group',
    type: 'COMPANY',
    status: 'ACTIVE',
  };

  const companyUser = {
    id: `${PREFIX}_company_user`,
    firstName: 'Comp',
    lastName: 'User',
    email: `${PREFIX}_compuser@homehub.iq`,
    roles: [UserRole.COMPANY],
    isActive: true,
  };

  const alienCompany = {
    id: `${PREFIX}_alien_company`,
    name: 'Alien Holding Corp',
    type: 'COMPANY',
    status: 'ACTIVE',
  };

  await db.insert(users).values([ownerA, ownerB, companyUser]).onConflictDoNothing();
  await db.insert(organizations).values([companyA, alienCompany]).onConflictDoNothing();
  await db.insert(organizationMembers).values([
    {
      id: `${PREFIX}_member_company_A`,
      organizationId: companyA.id,
      userId: companyUser.id,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  ]).onConflictDoNothing();

  const tokenOwnerA = signAuthToken({ id: ownerA.id, email: ownerA.email, roles: ownerA.roles });
  const tokenOwnerB = signAuthToken({ id: ownerB.id, email: ownerB.email, roles: ownerB.roles });
  const tokenCompUser = signAuthToken({ id: companyUser.id, email: companyUser.email, roles: companyUser.roles });

  // --------------------------------------------------------------------------
  // Scenario 1: Valid property creation through both generic and owner routes
  // --------------------------------------------------------------------------
  await t.test('1. Valid property creation through both generic and owner-specific routes', async () => {
    // 1a. Generic route POST /api/properties
    const resGeneric = await postGenericProperty(tokenOwnerA, {
      name: 'Generic Route Apartment',
      type: 'APARTMENT',
      address: { city: 'Erbil', street: 'Gulan St 10' },
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: 0.05,
      managementFee: 0.03,
    });
    assert.strictEqual(resGeneric.status, 201, `Expected 201 on generic property creation, got: ${resGeneric.status}`);
    assert.ok(resGeneric.data.id, 'Generic property must return persisted ID');
    assert.strictEqual(resGeneric.data.name, 'Generic Route Apartment');
    assert.strictEqual(resGeneric.data.currency, 'IQD');

    // 1b. Owner-specific route POST /api/owner/properties
    const resOwner = await postOwnerProperty(tokenOwnerA, {
      name: 'Owner Route Villa',
      city: 'Sulaymaniyah',
      type: 'VILLA',
      address: { city: 'Sulaymaniyah', street: 'Salim St' },
      currency: 'USD',
      operatingModel: 'FULLY_MANAGED',
    });
    assert.strictEqual(resOwner.status, 201, `Expected 201 on owner property creation, got: ${resOwner.status}`);
    assert.ok(resOwner.data.id, 'Owner property must return persisted ID');
    assert.strictEqual(resOwner.data.name, 'Owner Route Villa');
    assert.strictEqual(resOwner.data.currency, 'USD');

    // Verify ownership records created
    const ownershipA = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, resGeneric.data.id));
    assert.strictEqual(ownershipA.length, 1);
    assert.strictEqual(ownershipA[0].ownerId, ownerA.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Missing, null, empty, and whitespace-only property names rejected
  // --------------------------------------------------------------------------
  await t.test('2. Missing, null, empty, and whitespace-only property names are rejected (HTTP 400)', async () => {
    const invalidNames = [
      undefined,
      null,
      '',
      '   ',
      '\t\n  \t',
      12345,
      { title: 'Invalid Object Name' },
    ];

    for (const badName of invalidNames) {
      // Test on generic route
      const resGeneric = await postGenericProperty(tokenOwnerA, {
        name: badName,
        type: 'APARTMENT',
        address: { city: 'Erbil' },
      });
      assert.strictEqual(resGeneric.status, 400, `Expected 400 on bad name on generic route (${badName}), got: ${resGeneric.status}`);
      assert.ok(
        resGeneric.data.message?.includes('Property name is required') || resGeneric.data.error?.includes('VALIDATION_ERROR'),
        `Expected validation error message on generic route, got: ${JSON.stringify(resGeneric.data)}`
      );

      // Test on owner route
      const resOwner = await postOwnerProperty(tokenOwnerA, {
        name: badName,
        type: 'APARTMENT',
        city: 'Erbil',
      });
      assert.strictEqual(resOwner.status, 400, `Expected 400 on bad name on owner route (${badName}), got: ${resOwner.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Missing or malformed property type data rejected
  // --------------------------------------------------------------------------
  await t.test('3. Missing or malformed property type data is rejected (HTTP 400)', async () => {
    const invalidTypes = [
      undefined,
      null,
      '',
      '   ',
      'SPACESHIP_CARRIER',
      'NON_EXISTENT_TYPE_XYZ',
      1234,
      ['APARTMENT'],
    ];

    for (const badType of invalidTypes) {
      const res = await postGenericProperty(tokenOwnerA, {
        name: 'Type Validation Prop',
        type: badType,
        address: { city: 'Erbil' },
      });
      assert.strictEqual(res.status, 400, `Expected 400 on invalid type (${badType}), got: ${res.status}`);
      assert.ok(
        res.data.message?.includes('Property type') || res.data.error === 'VALIDATION_ERROR',
        `Expected validation error message, got: ${JSON.stringify(res.data)}`
      );
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Missing, null, empty, whitespace-only city or malformed address data
  // --------------------------------------------------------------------------
  await t.test('4. Missing or malformed city and address data is rejected (HTTP 400)', async () => {
    // 4a. Missing city completely
    const resNoCity = await postGenericProperty(tokenOwnerA, {
      name: 'No City Prop',
      type: 'APARTMENT',
    });
    assert.strictEqual(resNoCity.status, 400, `Expected 400 on missing city, got: ${resNoCity.status}`);
    assert.ok(resNoCity.data.message?.includes('Property city is required'));

    // 4b. Whitespace-only city
    const resWhitespaceCity = await postGenericProperty(tokenOwnerA, {
      name: 'Whitespace City Prop',
      type: 'APARTMENT',
      address: { city: '    \t ' },
    });
    assert.strictEqual(resWhitespaceCity.status, 400, `Expected 400 on whitespace city, got: ${resWhitespaceCity.status}`);

    // 4c. Non-object address
    const resMalformedAddress = await postGenericProperty(tokenOwnerA, {
      name: 'Malformed Address Prop',
      type: 'APARTMENT',
      address: 'NOT_AN_OBJECT_STRING',
      city: 'Erbil',
    });
    assert.strictEqual(resMalformedAddress.status, 400, `Expected 400 on primitive string address, got: ${resMalformedAddress.status}`);
    assert.ok(resMalformedAddress.data.message?.includes('Property address must be an object'));
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Invalid field types and malformed fee/currency/operating-model values
  // --------------------------------------------------------------------------
  await t.test('5. Malformed fee, currency, operating-model, and dimension values are rejected (HTTP 400)', async () => {
    // 5a. Unsupported currency
    const resBadCurrency = await postGenericProperty(tokenOwnerA, {
      name: 'Bad Currency Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      currency: 'EUR',
    });
    assert.strictEqual(resBadCurrency.status, 400, `Expected 400 on EUR currency, got: ${resBadCurrency.status}`);
    assert.ok(resBadCurrency.data.message?.includes('INVALID_CURRENCY'));

    // 5b. Negative fee
    const resNegFee = await postGenericProperty(tokenOwnerA, {
      name: 'Negative Fee Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      rentFee: -0.05,
    });
    assert.strictEqual(resNegFee.status, 400, `Expected 400 on negative fee, got: ${resNegFee.status}`);
    assert.ok(resNegFee.data.message?.includes('INVALID_FEE'));

    // 5c. Fee exceeding 100% (1.5)
    const resOverFee = await postGenericProperty(tokenOwnerA, {
      name: 'Over Fee Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      managementFee: 1.5,
    });
    assert.strictEqual(resOverFee.status, 400, `Expected 400 on fee > 1, got: ${resOverFee.status}`);
    assert.ok(resOverFee.data.message?.includes('INVALID_FEE'));

    // 5d. Non-numeric fee
    const resNanFee = await postGenericProperty(tokenOwnerA, {
      name: 'NaN Fee Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      rentFee: 'not_a_number',
    });
    assert.strictEqual(resNanFee.status, 400, `Expected 400 on NaN fee, got: ${resNanFee.status}`);

    // 5e. Invalid operating model
    const resBadModel = await postGenericProperty(tokenOwnerA, {
      name: 'Bad Operating Model Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      operatingModel: 'UNSUPPORTED_ARBITRARY_MODEL',
    });
    assert.strictEqual(resBadModel.status, 400, `Expected 400 on invalid operating model, got: ${resBadModel.status}`);
    assert.ok(resBadModel.data.message?.includes('Invalid operating model'));

    // 5f. Negative square feet
    const resNegSqft = await postGenericProperty(tokenOwnerA, {
      name: 'Negative Sqft Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      squareFeet: -200,
    });
    assert.strictEqual(resNegSqft.status, 400, `Expected 400 on negative squareFeet, got: ${resNegSqft.status}`);
    assert.ok(resNegSqft.data.message?.includes('Square feet must be a valid positive number'));
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Unauthorized ownership and company assignments rejected
  // --------------------------------------------------------------------------
  await t.test('6. Unauthorized ownership/company assignments are rejected (HTTP 403)', async () => {
    // 6a. Owner A trying to assign ownership to Owner B
    const resStealOwner = await postGenericProperty(tokenOwnerA, {
      name: 'Unauthorized Owner Assignment',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      ownerId: ownerB.id,
    });
    assert.strictEqual(resStealOwner.status, 403, `Expected 403 on assigning to another owner, got: ${resStealOwner.status}`);
    assert.ok(resStealOwner.data.message?.includes('FORBIDDEN'));

    // 6b. Company User trying to assign to Alien Company they do not belong to
    const resAlienComp = await postGenericProperty(tokenCompUser, {
      name: 'Alien Company Assignment',
      type: 'COMMERCIAL',
      address: { city: 'Erbil' },
      companyId: alienCompany.id,
    });
    assert.strictEqual(resAlienComp.status, 403, `Expected 403 on alien company assignment, got: ${resAlienComp.status}`);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Transaction atomicity and rollback on validation / agreement failure
  // --------------------------------------------------------------------------
  await t.test('7. Failed property creation causes complete transaction rollback', async () => {
    const uniquePropName = `Rollback Test Property ${TIMESTAMP}`;

    // Managed property requiring an owner user, but owner user is missing
    const res = await postGenericProperty(tokenCompUser, {
      name: uniquePropName,
      type: 'COMMERCIAL',
      address: { city: 'Duhok' },
      companyId: companyA.id,
      managedByAgentId: companyA.id,
      // deliberately omit ownerId so step 4 in transaction fails
    });

    assert.strictEqual(res.status, 400, `Expected 400 on failed management creation, got: ${res.status}`);
    assert.ok(res.data.message?.includes('Cannot create management agreement without a designated owner user'));

    // Verify database atomicity: zero property records persisted with that name
    const propCheck = await db.select().from(properties).where(eq(properties.name, uniquePropName));
    assert.strictEqual(propCheck.length, 0, 'Property record must not exist after rollback');

    const listingCheck = await db.select().from(listings).where(eq(listings.title, uniquePropName));
    assert.strictEqual(listingCheck.length, 0, 'Listing record must not exist after rollback');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Rental listing and private-portfolio creation remaining functional
  // --------------------------------------------------------------------------
  await t.test('8. Rental listing and private-portfolio creation remain functional', async () => {
    // 8a. Rental listing: FOR_RENT creates a published marketplace listing
    const resRentalListing = await postGenericProperty(tokenOwnerA, {
      name: 'Marketplace Listed Rental Unit',
      type: 'APARTMENT',
      address: { city: 'Erbil', street: 'Airport Road' },
      listingType: 'FOR_RENT',
      price: 1500,
      currency: 'USD',
    });
    assert.strictEqual(resRentalListing.status, 201);
    const listedPropId = resRentalListing.data.id;

    const dbListing = await db.select().from(listings).where(eq(listings.propertyId, listedPropId));
    assert.strictEqual(dbListing.length, 1, 'Marketplace listing must be created for FOR_RENT');
    assert.strictEqual(dbListing[0].type, 'FOR_RENT');
    assert.strictEqual(dbListing[0].status, 'PENDING_REVIEW', 'Marketplace listing must be staged as PENDING_REVIEW before admin verification');
    assert.strictEqual(dbListing[0].currency, 'USD');

    // 8b. Private portfolio: listingType NONE or omitted creates NO marketplace listing
    const resPrivate = await postGenericProperty(tokenOwnerA, {
      name: 'Private Off-Market Portfolio Unit',
      type: 'VILLA',
      address: { city: 'Erbil', street: 'Dream City' },
      listingType: 'NONE',
    });
    assert.strictEqual(resPrivate.status, 201);
    const privatePropId = resPrivate.data.id;

    const dbNoListing = await db.select().from(listings).where(eq(listings.propertyId, privatePropId));
    assert.strictEqual(dbNoListing.length, 0, 'No marketplace listing should exist for private portfolio property');
  });

  // --------------------------------------------------------------------------
  // Scenario 9: No sale listing being created through the active rental flow
  // --------------------------------------------------------------------------
  await t.test('9. FOR_SALE listing requests are strictly rejected in rental-only release (HTTP 400)', async () => {
    // 9a. Attempting listingType: 'FOR_SALE'
    const resSale = await postGenericProperty(tokenOwnerA, {
      name: 'Attempted Sale Property',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      listingType: 'FOR_SALE',
      price: 250000,
    });
    assert.strictEqual(resSale.status, 400, `Expected 400 on FOR_SALE listing attempt, got: ${resSale.status}`);
    assert.ok(
      resSale.data.message?.includes('Sale workflows and FOR_SALE listings are disabled in this rental-only release'),
      `Expected rental-only boundary error, got: ${JSON.stringify(resSale.data)}`
    );

    // 9b. Attempting listingType: 'SALE'
    const resSaleShort = await postGenericProperty(tokenOwnerA, {
      name: 'Attempted Sale Short Property',
      type: 'VILLA',
      address: { city: 'Sulaymaniyah' },
      listingType: 'SALE',
      price: 300000,
    });
    assert.strictEqual(resSaleShort.status, 400);

    // Verify 0 sale listings were persisted in PostgreSQL
    const saleListings = await db.select().from(listings).where(eq(listings.type, 'FOR_SALE'));
    assert.strictEqual(saleListings.length, 0, 'No FOR_SALE listings must exist in active database');
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Trimming of name, type, and address strings before persistence
  // --------------------------------------------------------------------------
  await t.test('10. Property strings are trimmed cleanly before database persistence', async () => {
    const rawName = '   Trimmed Palace Residence   ';
    const rawStreet = '   100M Ring Road Near Gulan   ';

    const res = await postGenericProperty(tokenOwnerA, {
      name: rawName,
      type: '   APARTMENT   ',
      address: {
        city: '   Erbil   ',
        street: rawStreet,
      },
    });

    assert.strictEqual(res.status, 201);
    const propId = res.data.id;

    const [persisted] = await db.select().from(properties).where(eq(properties.id, propId));
    assert.strictEqual(persisted.name, 'Trimmed Palace Residence', 'Name must be trimmed');
    assert.strictEqual(persisted.type, 'APARTMENT', 'Type must be trimmed');
    assert.strictEqual((persisted.address as any).city, 'Erbil', 'City must be trimmed');
    assert.strictEqual((persisted.address as any).street, '100M Ring Road Near Gulan', 'Street must be trimmed');
  });
});
