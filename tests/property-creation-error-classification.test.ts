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
  units,
  ownershipRecords,
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { UserRole } from '../src/types/index.js';
import { propertyRepository } from '../src/server/repositories/properties.js';

test('Property API Error Classification Regression Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `prop_err_${TIMESTAMP}`;

  // Setup Express Test App mounting real API Router
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(async () => {
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

  // Helper for unit creation POST /api/properties/:id/units
  async function postUnit(token: string, propertyId: string, body: any) {
    const res = await fetch(`${baseUrl}/properties/${propertyId}/units`, {
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

  // Provision Test Personas
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

  const tenantUser = {
    id: `${PREFIX}_tenant`,
    firstName: 'Tenant',
    lastName: 'User',
    email: `${PREFIX}_tenant@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const adminUser = {
    id: `${PREFIX}_admin`,
    firstName: 'Admin',
    lastName: 'User',
    email: `${PREFIX}_admin@homehub.iq`,
    roles: [UserRole.PLATFORM_ADMIN],
    isActive: true,
  };

  await db.insert(users).values([ownerA, ownerB, tenantUser, adminUser]).onConflictDoNothing();

  const tokenOwnerA = signAuthToken({ id: ownerA.id, email: ownerA.email, roles: ownerA.roles });
  const tokenOwnerB = signAuthToken({ id: ownerB.id, email: ownerB.email, roles: ownerB.roles });
  const tokenTenant = signAuthToken({ id: tenantUser.id, email: tenantUser.email, roles: tenantUser.roles });
  const tokenAdmin = signAuthToken({ id: adminUser.id, email: adminUser.email, roles: adminUser.roles });

  // Helper to create property and promote ownership to VERIFIED so EDIT_PROPERTY is granted
  async function createVerifiedProperty(token: string, name: string) {
    const res = await postGenericProperty(token, {
      name,
      type: 'APARTMENT',
      address: { city: 'Erbil' },
    });
    assert.strictEqual(res.status, 201, `Failed to setup test property: ${JSON.stringify(res.data)}`);
    const propId = res.data.id;
    await db.update(ownershipRecords).set({ status: 'VERIFIED' }).where(eq(ownershipRecords.propertyId, propId));
    return propId;
  }

  // --------------------------------------------------------------------------
  // 1. Invalid property input -> 400 VALIDATION_ERROR
  // --------------------------------------------------------------------------
  await t.test('1. Invalid property input -> HTTP 400 with VALIDATION_ERROR', async () => {
    // Missing name on generic route
    const res1 = await postGenericProperty(tokenOwnerA, {
      type: 'APARTMENT',
      address: { city: 'Erbil' },
    });
    assert.strictEqual(res1.status, 400, `Expected 400 on missing name, got ${res1.status}`);
    assert.strictEqual(res1.data.error, 'VALIDATION_ERROR');
    assert.ok(res1.data.message.includes('Property name is required'));

    // Invalid property type on owner route
    const res2 = await postOwnerProperty(tokenOwnerA, {
      name: 'Bad Type Villa',
      city: 'Sulaymaniyah',
      type: 'INVALID_UNKNOWN_TYPE',
    });
    assert.strictEqual(res2.status, 400, `Expected 400 on invalid type, got ${res2.status}`);
    assert.strictEqual(res2.data.error, 'VALIDATION_ERROR');

    // Missing city on generic route
    const res3 = await postGenericProperty(tokenOwnerA, {
      name: 'No City Prop',
      type: 'APARTMENT',
    });
    assert.strictEqual(res3.status, 400, `Expected 400 on missing city, got ${res3.status}`);
    assert.strictEqual(res3.data.error, 'VALIDATION_ERROR');

    // Invalid fee (> 1.0) on generic route
    const res4 = await postGenericProperty(tokenOwnerA, {
      name: 'Over Fee Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      rentFee: 1.5,
    });
    assert.strictEqual(res4.status, 400, `Expected 400 on invalid fee, got ${res4.status}`);
    assert.strictEqual(res4.data.error, 'VALIDATION_ERROR');

    // Invalid currency on generic route
    const res5 = await postGenericProperty(tokenOwnerA, {
      name: 'Unsupported Currency Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      currency: 'EUR',
    });
    assert.strictEqual(res5.status, 400, `Expected 400 on unsupported currency, got ${res5.status}`);
    assert.strictEqual(res5.data.error, 'VALIDATION_ERROR');

    // Invalid unit input on unit creation route (with verified owner permissions)
    const propId = await createVerifiedProperty(tokenOwnerA, 'Valid Prop for Unit Test');

    // Unit with missing unitNumber
    const resUnitBad = await postUnit(tokenOwnerA, propId, {
      unitNumber: '',
      marketRent: 500000,
    });
    assert.strictEqual(resUnitBad.status, 400, `Expected 400 on missing unit number, got ${resUnitBad.status}`);
    assert.strictEqual(resUnitBad.data.error, 'VALIDATION_ERROR');
    assert.ok(resUnitBad.data.message.includes('unitNumber is required'));
  });

  // --------------------------------------------------------------------------
  // 2. Unauthorized property assignment -> HTTP 403
  // --------------------------------------------------------------------------
  await t.test('2. Unauthorized property assignment -> HTTP 403 FORBIDDEN', async () => {
    // Owner A attempting to assign property to Owner B
    const resIdor = await postGenericProperty(tokenOwnerA, {
      name: 'IDOR Property Assignment',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      ownerId: ownerB.id,
    });
    assert.strictEqual(resIdor.status, 403, `Expected 403 on IDOR assignment, got ${resIdor.status}`);
    assert.strictEqual(resIdor.data.error, 'FORBIDDEN');
    assert.ok(resIdor.data.message.includes('FORBIDDEN'));

    // Tenant role attempting to create property on generic route
    const resTenant = await postGenericProperty(tokenTenant, {
      name: 'Tenant Illegal Prop',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
    });
    assert.strictEqual(resTenant.status, 403, `Expected 403 on tenant role, got ${resTenant.status}`);

    // Owner B attempting to create unit on Owner A's verified property
    const propAId = await createVerifiedProperty(tokenOwnerA, 'Owner A Private Property');

    const resUnitUnauthorized = await postUnit(tokenOwnerB, propAId, {
      unitNumber: 'U-999',
      marketRent: 500000,
    });
    assert.strictEqual(resUnitUnauthorized.status, 403, `Expected 403 on unauthorized unit creation, got ${resUnitUnauthorized.status}`);
  });

  // --------------------------------------------------------------------------
  // 3. Missing resource -> HTTP 404 NOT_FOUND
  // --------------------------------------------------------------------------
  await t.test('3. Missing resource -> HTTP 404 NOT_FOUND', async () => {
    const fakePropertyId = '00000000-0000-0000-0000-000000000099';
    // Admin has authority to bypass property ownership check, reaching repository addUnit
    const resUnitMissing = await postUnit(tokenAdmin, fakePropertyId, {
      unitNumber: 'U-404',
      marketRent: 500000,
    });
    assert.strictEqual(resUnitMissing.status, 404, `Expected 404 on missing property, got ${resUnitMissing.status}`);
    assert.strictEqual(resUnitMissing.data.error, 'NOT_FOUND');
    assert.ok(resUnitMissing.data.message.includes('Property not found'));
  });

  // --------------------------------------------------------------------------
  // 4. Genuine uniqueness conflict -> HTTP 409 CONFLICT
  // --------------------------------------------------------------------------
  await t.test('4. Genuine uniqueness conflict -> HTTP 409 CONFLICT', async () => {
    const propId = await createVerifiedProperty(tokenOwnerA, 'Conflict Test Building');

    // First unit creation -> 201
    const resUnit1 = await postUnit(tokenOwnerA, propId, {
      unitNumber: 'APT-101',
      marketRent: 750000,
      currency: 'IQD',
    });
    assert.strictEqual(resUnit1.status, 201, `Expected 201 on first unit creation, got ${resUnit1.status}`);

    // Duplicate unit number on same property -> 409 CONFLICT
    const resUnit2 = await postUnit(tokenOwnerA, propId, {
      unitNumber: 'APT-101',
      marketRent: 750000,
      currency: 'IQD',
    });
    assert.strictEqual(resUnit2.status, 409, `Expected 409 on duplicate unit number, got ${resUnit2.status}`);
    assert.strictEqual(resUnit2.data.error, 'CONFLICT');
    assert.ok(resUnit2.data.message.includes('already exists'));
  });

  // --------------------------------------------------------------------------
  // 5. Database unavailable / configuration failure -> HTTP 503
  // --------------------------------------------------------------------------
  await t.test('5. Database unavailable/configuration failure -> HTTP 503 DATABASE_NOT_CONFIGURED', async () => {
    // Test the requireDatabase middleware directly under simulated missing config
    const origHost = process.env.SQL_HOST;
    const origUrl = process.env.DATABASE_URL;

    try {
      delete process.env.SQL_HOST;
      delete process.env.DATABASE_URL;

      const res = await fetch(`${baseUrl}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwnerA}`,
        },
        body: JSON.stringify({ name: 'Test', type: 'APARTMENT', address: { city: 'Erbil' } }),
      });

      assert.strictEqual(res.status, 503, `Expected 503 when DB unconfigured, got ${res.status}`);
      const data = await res.json();
      assert.strictEqual(data.error, 'DATABASE_NOT_CONFIGURED');
    } finally {
      if (origHost) process.env.SQL_HOST = origHost;
      if (origUrl) process.env.DATABASE_URL = origUrl;
    }
  });

  // --------------------------------------------------------------------------
  // 6. Unexpected repository/programming error -> HTTP 500 (NOT HTTP 400!)
  // --------------------------------------------------------------------------
  await t.test('6. Unexpected repository/programming error -> HTTP 500 (Never misclassified as 400)', async () => {
    // Save original createProperty & addUnit
    const originalCreateProperty = propertyRepository.createProperty;
    const originalAddUnit = propertyRepository.addUnit;

    try {
      // 6a. Simulate unexpected database query failure in POST /api/properties
      propertyRepository.createProperty = async () => {
        throw new Error('connection terminated unexpectedly due to admin shutdown');
      };

      const resGeneric = await postGenericProperty(tokenOwnerA, {
        name: 'Generic 500 Prop',
        type: 'APARTMENT',
        address: { city: 'Erbil' },
      });

      assert.strictEqual(
        resGeneric.status,
        500,
        `Expected 500 on unexpected repository error in /api/properties, but got ${resGeneric.status} (CRITICAL: must not be 400!)`
      );
      assert.strictEqual(resGeneric.data.error, 'INTERNAL_SERVER_ERROR');
      assert.strictEqual(
        resGeneric.data.message,
        'An unexpected internal server error occurred while processing the property.'
      );

      // 6b. Simulate unexpected TypeError in POST /api/owner/properties
      propertyRepository.createProperty = async () => {
        throw new TypeError('Cannot read properties of null (reading "connectionPool")');
      };

      const resOwner = await postOwnerProperty(tokenOwnerA, {
        name: 'Owner 500 Prop',
        type: 'APARTMENT',
        city: 'Erbil',
      });

      assert.strictEqual(
        resOwner.status,
        500,
        `Expected 500 on unexpected TypeError in /api/owner/properties, but got ${resOwner.status}`
      );
      assert.strictEqual(resOwner.data.error, 'INTERNAL_SERVER_ERROR');
      assert.strictEqual(
        resOwner.data.message,
        'An unexpected internal server error occurred while processing the property.'
      );

      // 6c. Simulate unexpected error in POST /api/properties/:id/units
      // First restore createProperty to make a valid verified property
      propertyRepository.createProperty = originalCreateProperty;
      const propId = await createVerifiedProperty(tokenOwnerA, 'Unit 500 Test Prop');

      // Now mock addUnit to throw unexpected failure
      propertyRepository.addUnit = async () => {
        throw new Error('database disk full or read-only filesystem');
      };

      const resUnit500 = await postUnit(tokenOwnerA, propId, {
        unitNumber: 'U-500',
        marketRent: 500000,
      });

      assert.strictEqual(
        resUnit500.status,
        500,
        `Expected 500 on unexpected error in addUnit, but got ${resUnit500.status} (CRITICAL: must not be 400!)`
      );
      assert.strictEqual(resUnit500.data.error, 'INTERNAL_SERVER_ERROR');
      assert.strictEqual(
        resUnit500.data.message,
        'An unexpected internal server error occurred while creating the unit.'
      );
    } finally {
      // Restore repository functions
      propertyRepository.createProperty = originalCreateProperty;
      propertyRepository.addUnit = originalAddUnit;
    }
  });

  // --------------------------------------------------------------------------
  // 7. No sensitive internal details exposed in error responses
  // --------------------------------------------------------------------------
  await t.test('7. No sensitive internal details exposed in error responses', async () => {
    const originalCreateProperty = propertyRepository.createProperty;

    try {
      // Simulate raw PostgreSQL error containing internal table names, SQL query, and secret keys
      propertyRepository.createProperty = async () => {
        const sensitiveErr = new Error('syntax error at or near "SELECT password_hash FROM auth_credentials WHERE api_key = \'sk_live_secret_999\'"');
        sensitiveErr.stack = 'Error: syntax error\n    at Client._query (/app/node_modules/pg/lib/client.js:123:45)\n    at Object.createProperty (/app/src/server/repositories/properties.ts:333:10)';
        throw sensitiveErr;
      };

      const res = await postGenericProperty(tokenOwnerA, {
        name: 'Sensitive Leak Check Prop',
        type: 'APARTMENT',
        address: { city: 'Erbil' },
      });

      assert.strictEqual(res.status, 500);
      const resBodyStr = JSON.stringify(res.data);

      // Verify no sensitive tokens leaked
      assert.ok(!resBodyStr.includes('password_hash'), 'Must not leak database column names');
      assert.ok(!resBodyStr.includes('auth_credentials'), 'Must not leak table names');
      assert.ok(!resBodyStr.includes('sk_live_secret_999'), 'Must not leak secret keys or SQL parameters');
      assert.ok(!resBodyStr.includes('node_modules'), 'Must not leak file paths or stack traces');
      assert.ok(!resBodyStr.includes('client.js'), 'Must not leak internal stack traces');

      assert.deepStrictEqual(res.data, {
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal server error occurred while processing the property.',
      });
    } finally {
      propertyRepository.createProperty = originalCreateProperty;
    }
  });

  // --------------------------------------------------------------------------
  // 8. Existing successful property creation and rental-only behavior remain unchanged
  // --------------------------------------------------------------------------
  await t.test('8. Existing successful property creation and rental-only behavior remain unchanged', async () => {
    // 8a. Successful property creation on generic route
    const resGeneric = await postGenericProperty(tokenOwnerA, {
      name: 'Standard Rental Apartment',
      type: 'APARTMENT',
      address: { city: 'Erbil', street: 'Dream City 12' },
      currency: 'USD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: 0.05,
      managementFee: 0.03,
    });
    assert.strictEqual(resGeneric.status, 201);
    assert.strictEqual(resGeneric.data.name, 'Standard Rental Apartment');
    assert.strictEqual(resGeneric.data.currency, 'USD');

    // 8b. Successful property creation on owner route
    const resOwner = await postOwnerProperty(tokenOwnerA, {
      name: 'Standard Owner Villa',
      city: 'Sulaymaniyah',
      type: 'VILLA',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
    });
    assert.strictEqual(resOwner.status, 201);
    assert.strictEqual(resOwner.data.name, 'Standard Owner Villa');
    assert.strictEqual(resOwner.data.currency, 'IQD');

    // 8c. FOR_SALE listing requests are strictly rejected (rental-only release)
    const resSale = await postGenericProperty(tokenOwnerA, {
      name: 'Sale Attempt Villa',
      type: 'VILLA',
      address: { city: 'Erbil' },
      listingType: 'FOR_SALE',
    });
    assert.strictEqual(resSale.status, 400);
    assert.strictEqual(resSale.data.error, 'VALIDATION_ERROR');
    assert.ok(resSale.data.message.includes('rental-only release'));

    // 8d. Legacy contract in owner.ts: INVALID_AGENT returns 500
    const resInvalidAgentOwner = await postOwnerProperty(tokenOwnerA, {
      name: 'Invalid Agent Prop',
      city: 'Erbil',
      type: 'APARTMENT',
      managedByAgentId: '00000000-0000-0000-0000-000000000000',
    });
    assert.strictEqual(resInvalidAgentOwner.status, 500, `Expected 500 on INVALID_AGENT in owner route, got ${resInvalidAgentOwner.status}`);
    assert.ok(resInvalidAgentOwner.data.error.includes('INVALID_AGENT'));
  });
});
