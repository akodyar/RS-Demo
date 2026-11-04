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
  managementAgreements,
  idempotencyRecords,
  verificationRecords,
} from '../src/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { UserRole } from '../src/types/index.js';

test('HomeHub Property Creation Request-Level Idempotency Regression Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `idemp_test_${TIMESTAMP}`;

  // 1. Setup Express Test App mounting real API Router
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Track created IDs for deterministic cleanup
  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdOrgIds: string[] = [];

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

  const tenantUser = {
    id: `${PREFIX}_tenant_user`,
    firstName: 'Tenant',
    lastName: 'User',
    email: `${PREFIX}_tenant@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  await db.insert(users).values([ownerA, ownerB, tenantUser]).onConflictDoNothing();
  createdUserIds.push(ownerA.id, ownerB.id, tenantUser.id);

  const tokenOwnerA = signAuthToken({ id: ownerA.id, email: ownerA.email, roles: ownerA.roles });
  const tokenOwnerB = signAuthToken({ id: ownerB.id, email: ownerB.email, roles: ownerB.roles });
  const tokenTenant = signAuthToken({ id: tenantUser.id, email: tenantUser.email, roles: tenantUser.roles });

  t.after(async () => {
    server.close();
    // Cleanup idempotency records
    if (createdUserIds.length > 0) {
      await db.delete(idempotencyRecords).where(inArray(idempotencyRecords.userId, createdUserIds));
    }
    // Cleanup properties and dependent records
    if (createdPropertyIds.length > 0) {
      await db.delete(listings).where(inArray(listings.propertyId, createdPropertyIds));
      await db.delete(managementAgreements).where(inArray(managementAgreements.propertyId, createdPropertyIds));
      await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, createdPropertyIds));
      await db.delete(verificationRecords).where(inArray(verificationRecords.propertyId, createdPropertyIds));
      await db.delete(properties).where(inArray(properties.id, createdPropertyIds));
    }
    // Also cleanup any ownership records referencing created users
    if (createdUserIds.length > 0) {
      await db.delete(ownershipRecords).where(inArray(ownershipRecords.ownerId, createdUserIds));
    }
    // Cleanup users
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  // --------------------------------------------------------------------------
  // Scenario 1: First request with a new key creates exactly one property
  // --------------------------------------------------------------------------
  await t.test('1. First request with new key creates exactly one property and related records', async () => {
    const key = `${PREFIX}_key_s1`;
    const payload = {
      name: `${PREFIX} Villa Alpha`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'USD',
      listingType: 'FOR_RENT',
      price: 2500,
    };

    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201, 'Should respond with 201 Created');
    const data = await res.json();
    assert.ok(data.id, 'Should return created property with id');
    createdPropertyIds.push(data.id);

    // Verify database row counts
    const dbProps = await db.select().from(properties).where(eq(properties.id, data.id));
    assert.strictEqual(dbProps.length, 1, 'Exactly 1 property row should exist in database');

    const dbOwns = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, data.id));
    assert.strictEqual(dbOwns.length, 1, 'Exactly 1 ownership record row should exist');
    assert.strictEqual(dbOwns[0].ownerId, ownerA.id, 'Ownership should belong to Owner A');

    const dbListings = await db.select().from(listings).where(eq(listings.propertyId, data.id));
    assert.strictEqual(dbListings.length, 1, 'Exactly 1 listing row should exist');

    const dbIdemp = await db.select().from(idempotencyRecords).where(
      and(
        eq(idempotencyRecords.userId, ownerA.id),
        eq(idempotencyRecords.key, key)
      )
    );
    assert.strictEqual(dbIdemp.length, 1, 'Exactly 1 idempotency record should be persisted');
    assert.strictEqual(dbIdemp[0].resourceId, data.id, 'Idempotency record should reference created property');
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Sequential retry with same key and same payload returns original result
  // --------------------------------------------------------------------------
  await t.test('2. Sequential retry with same key and same payload returns original result with 0 additional rows', async () => {
    const key = `${PREFIX}_key_s2`;
    const payload = {
      name: `${PREFIX} Villa Beta`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'IQD',
      listingType: 'NONE',
    };

    // First attempt
    const res1 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res1.status, 201);
    const data1 = await res1.json();
    createdPropertyIds.push(data1.id);

    // Sequential retry with identical payload and key
    const res2 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(res2.status, 201, 'Sequential retry should return 201');
    const data2 = await res2.json();

    // Replayed response contract: identical property returned
    assert.strictEqual(data2.id, data1.id, 'Replayed response must return the exact original property ID');
    assert.strictEqual(data2.name, data1.name);

    // Assert zero additional records in PostgreSQL
    const matchingProps = await db.select().from(properties).where(eq(properties.name, payload.name));
    assert.strictEqual(matchingProps.length, 1, 'Database must contain exactly 1 property, not 2');

    const matchingOwns = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, data1.id));
    assert.strictEqual(matchingOwns.length, 1, 'Database must contain exactly 1 ownership record');
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Concurrent requests with same key and payload create exactly 1 property
  // --------------------------------------------------------------------------
  await t.test('3. Concurrent requests with same key and payload create exactly one property and set of related records', async () => {
    const key = `${PREFIX}_key_concurrent`;
    const payload = {
      name: `${PREFIX} Concurrent Apartment`,
      type: 'APARTMENT',
      city: 'Sulaymaniyah',
      currency: 'IQD',
      listingType: 'FOR_RENT',
      price: 1500000,
    };

    // Fire 6 concurrent requests simultaneously
    const requests = Array.from({ length: 6 }).map(() =>
      fetch(`${baseUrl}/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwnerA}`,
          'Idempotency-Key': key,
        },
        body: JSON.stringify(payload),
      })
    );

    const responses = await Promise.all(requests);

    // All should return 201
    for (const res of responses) {
      assert.strictEqual(res.status, 201, 'All concurrent responses must return 201');
    }

    const jsonResults = await Promise.all(responses.map((r) => r.json()));
    const firstId = jsonResults[0].id;
    createdPropertyIds.push(firstId);

    // All must receive the exact same property ID
    for (const data of jsonResults) {
      assert.strictEqual(data.id, firstId, 'All concurrent callers must receive the exact same property ID');
    }

    // Query database directly: verify no duplicate persisted
    const dbProps = await db.select().from(properties).where(eq(properties.name, payload.name));
    assert.strictEqual(dbProps.length, 1, 'Database must contain exactly 1 property row despite 6 concurrent requests');

    const dbOwns = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, firstId));
    assert.strictEqual(dbOwns.length, 1, 'Database must contain exactly 1 ownership record row');

    const dbListings = await db.select().from(listings).where(eq(listings.propertyId, firstId));
    assert.strictEqual(dbListings.length, 1, 'Database must contain exactly 1 listing row');

    const dbIdemps = await db.select().from(idempotencyRecords).where(
      and(
        eq(idempotencyRecords.userId, ownerA.id),
        eq(idempotencyRecords.key, key)
      )
    );
    assert.strictEqual(dbIdemps.length, 1, 'Database must contain exactly 1 idempotency record row');
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Same key with a different payload returns HTTP 409 Conflict
  // --------------------------------------------------------------------------
  await t.test('4. Same key with different payload returns HTTP 409 Conflict and creates no extra records', async () => {
    const key = `${PREFIX}_key_s4_conflict`;
    const payloadOriginal = {
      name: `${PREFIX} Conflict Test Property`,
      type: 'COMMERCIAL',
      city: 'Erbil',
      currency: 'USD',
    };

    const res1 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payloadOriginal),
    });
    assert.strictEqual(res1.status, 201);
    const data1 = await res1.json();
    createdPropertyIds.push(data1.id);

    // Attempt reuse with materially different payload (different name and type)
    const payloadDifferent = {
      name: `${PREFIX} Materially Altered Name`,
      type: 'RESIDENTIAL',
      city: 'Duhok',
      currency: 'IQD',
    };

    const res2 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payloadDifferent),
    });

    assert.strictEqual(res2.status, 409, 'Reusing key with different payload must return HTTP 409 Conflict');
    const errBody = await res2.json();
    assert.strictEqual(errBody.error, 'CONFLICT');
    assert.ok(errBody.message.includes('Idempotency key payload mismatch'), 'Error message should explain payload mismatch');

    // Verify in database that altered property was never created
    const alteredProps = await db.select().from(properties).where(eq(properties.name, payloadDifferent.name));
    assert.strictEqual(alteredProps.length, 0, 'Altered property payload must NOT be persisted in the database');
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Different keys with identical property payloads remain separate requests
  // --------------------------------------------------------------------------
  await t.test('5. Different keys with identical property payloads remain separate logical requests', async () => {
    const key1 = `${PREFIX}_key_s5_1`;
    const key2 = `${PREFIX}_key_s5_2`;
    const identicalPayload = {
      name: `${PREFIX} Identical Twin Unit`,
      type: 'APARTMENT',
      city: 'Erbil',
      currency: 'IQD',
    };

    const res1 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key1,
      },
      body: JSON.stringify(identicalPayload),
    });
    assert.strictEqual(res1.status, 201);
    const data1 = await res1.json();
    createdPropertyIds.push(data1.id);

    const res2 = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key2,
      },
      body: JSON.stringify(identicalPayload),
    });
    assert.strictEqual(res2.status, 201);
    const data2 = await res2.json();
    createdPropertyIds.push(data2.id);

    assert.notStrictEqual(data1.id, data2.id, 'Different keys must create distinct property records');

    const matchingProps = await db.select().from(properties).where(eq(properties.name, identicalPayload.name));
    assert.strictEqual(matchingProps.length, 2, 'Database should contain both distinct property records');
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Different authenticated actors cannot collide or replay each other's results
  // --------------------------------------------------------------------------
  await t.test('6. Different authenticated actors cannot collide or replay each others results', async () => {
    const sharedKey = `${PREFIX}_shared_key_actors`;
    const payload = {
      name: `${PREFIX} Cross Actor Isolation`,
      type: 'HOUSE',
      city: 'Erbil',
      currency: 'IQD',
    };

    // Owner A uses sharedKey
    const resA = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': sharedKey,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    createdPropertyIds.push(dataA.id);

    // Owner B uses the SAME key string
    const resB = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerB}`,
        'Idempotency-Key': sharedKey,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resB.status, 201);
    const dataB = await resB.json();
    createdPropertyIds.push(dataB.id);

    // Strict user scoping: Owner B does NOT replay Owner A's property
    assert.notStrictEqual(dataA.id, dataB.id, 'Owner B must not receive Owner A property');

    // Check ownership isolation in database
    const ownA = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, dataA.id));
    assert.strictEqual(ownA[0].ownerId, ownerA.id);

    const ownB = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, dataB.id));
    assert.strictEqual(ownB[0].ownerId, ownerB.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 7: Caller lacking authorization cannot access result through replay
  // --------------------------------------------------------------------------
  await t.test('7. Caller lacking authorization cannot access result through replay', async () => {
    const key = `${PREFIX}_key_s7_auth`;
    const payload = {
      name: `${PREFIX} Auth Isolation Property`,
      type: 'APARTMENT',
      city: 'Erbil',
      currency: 'IQD',
    };

    // Owner A creates property with key
    const resA = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resA.status, 201);
    const dataA = await resA.json();
    createdPropertyIds.push(dataA.id);

    // 1. Unauthenticated request with key fails 401
    const resUnauth = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resUnauth.status, 401, 'Unauthenticated request must be rejected with 401');

    // 2. Unauthorized role (Tenant) with key fails 403
    const resTenant = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenTenant}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resTenant.status, 403, 'Unauthorized tenant role must be rejected with 403');
  });

  // --------------------------------------------------------------------------
  // Scenario 8: Failed validation leaves NO completed idempotency record that blocks retry
  // --------------------------------------------------------------------------
  await t.test('8. Failed validation leaves no idempotency record and permits safe valid retry', async () => {
    const key = `${PREFIX}_key_s8_fail_retry`;

    // 1. Invalid payload (missing property name)
    const invalidPayload = {
      name: '',
      type: 'VILLA',
      city: 'Erbil',
    };

    const resFail = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(invalidPayload),
    });
    assert.strictEqual(resFail.status, 400, 'Invalid payload must return 400 VALIDATION_ERROR');

    // Assert no idempotency record was created
    const idempRecords = await db.select().from(idempotencyRecords).where(
      and(
        eq(idempotencyRecords.userId, ownerA.id),
        eq(idempotencyRecords.key, key)
      )
    );
    assert.strictEqual(idempRecords.length, 0, 'Failed validation must NOT leave an idempotency record');

    // 2. Retry with valid payload using the SAME key
    const validPayload = {
      name: `${PREFIX} Validated After Retry`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'IQD',
    };

    const resSuccess = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(validPayload),
    });
    assert.strictEqual(resSuccess.status, 201, 'Subsequent valid request with same key must succeed');
    const dataSuccess = await resSuccess.json();
    createdPropertyIds.push(dataSuccess.id);

    const postDbProps = await db.select().from(properties).where(eq(properties.id, dataSuccess.id));
    assert.strictEqual(postDbProps.length, 1);
  });

  // --------------------------------------------------------------------------
  // Scenario 9: Failure partway through related records rolls back all side effects and permits retry
  // --------------------------------------------------------------------------
  await t.test('9. Failure partway through related records rolls back transaction and permits safe retry', async () => {
    const key = `${PREFIX}_key_s9_rollback`;

    // Non-existent agent causes validation/agent check failure
    const payloadWithInvalidAgent = {
      name: `${PREFIX} Rollback Candidate`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'IQD',
      managedByAgentId: 'org_non_existent_fake_agent',
    };

    const resFail = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payloadWithInvalidAgent),
    });
    assert.ok(resFail.status >= 400, 'Invalid agent organization must fail with client error');

    // Verify full rollback in database: 0 properties, 0 ownership, 0 idempotency records
    const rolledBackProps = await db.select().from(properties).where(eq(properties.name, payloadWithInvalidAgent.name));
    assert.strictEqual(rolledBackProps.length, 0, 'Property record must be completely rolled back');

    const rolledBackIdemp = await db.select().from(idempotencyRecords).where(
      and(
        eq(idempotencyRecords.userId, ownerA.id),
        eq(idempotencyRecords.key, key)
      )
    );
    assert.strictEqual(rolledBackIdemp.length, 0, 'Idempotency record must be completely rolled back');

    // Retry with corrected payload using same key
    const payloadCorrected = {
      name: `${PREFIX} Rollback Candidate Fixed`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'IQD',
    };

    const resSuccess = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payloadCorrected),
    });
    assert.strictEqual(resSuccess.status, 201, 'Retry after rollback must succeed');
    const dataSuccess = await resSuccess.json();
    createdPropertyIds.push(dataSuccess.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 10: Both property-creation routes follow the same documented idempotency contract
  // --------------------------------------------------------------------------
  await t.test('10. Both routes (/api/properties and /api/owner/properties) enforce identical idempotency contract', async () => {
    const ownerKey = `${PREFIX}_key_owner_route`;
    const ownerPayload = {
      name: `${PREFIX} Owner Route Property`,
      city: 'هەولێر',
      type: 'شوقە (Apartment)',
      monthlyRentIqd: '1200000',
    };

    // First attempt on /api/owner/properties
    const res1 = await fetch(`${baseUrl}/owner/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': ownerKey,
      },
      body: JSON.stringify(ownerPayload),
    });
    assert.strictEqual(res1.status, 201);
    const data1 = await res1.json();
    createdPropertyIds.push(data1.id);

    // Sequential retry on /api/owner/properties
    const res2 = await fetch(`${baseUrl}/owner/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': ownerKey,
      },
      body: JSON.stringify(ownerPayload),
    });
    assert.strictEqual(res2.status, 201);
    const data2 = await res2.json();
    assert.strictEqual(data2.id, data1.id, 'Owner route retry must return identical property ID');

    // Mismatched payload on /api/owner/properties
    const resConflict = await fetch(`${baseUrl}/owner/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': ownerKey,
      },
      body: JSON.stringify({ ...ownerPayload, name: 'Different Name Conflict' }),
    });
    assert.strictEqual(resConflict.status, 409, 'Owner route must return 409 Conflict on payload mismatch');

    // Concurrent requests on /api/owner/properties
    const concKey = `${PREFIX}_key_owner_conc`;
    const concPayload = {
      name: `${PREFIX} Owner Concurrent Prop`,
      city: 'هەولێر',
      type: 'شوقە (Apartment)',
    };

    const concRequests = Array.from({ length: 4 }).map(() =>
      fetch(`${baseUrl}/owner/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenOwnerA}`,
          'Idempotency-Key': concKey,
        },
        body: JSON.stringify(concPayload),
      })
    );
    const concResponses = await Promise.all(concRequests);
    for (const r of concResponses) {
      assert.strictEqual(r.status, 201);
    }
    const concData = await Promise.all(concResponses.map((r) => r.json()));
    const firstOwnerConcId = concData[0].id;
    createdPropertyIds.push(firstOwnerConcId);
    for (const d of concData) {
      assert.strictEqual(d.id, firstOwnerConcId);
    }

    const matchingOwnerProps = await db.select().from(properties).where(eq(properties.name, concPayload.name));
    assert.strictEqual(matchingOwnerProps.length, 1, 'Owner route concurrent requests must persist exactly 1 property');
  });

  // --------------------------------------------------------------------------
  // Scenario 11: Rental-only validation and property ownership/role checks still behave correctly
  // --------------------------------------------------------------------------
  await t.test('11. Rental-only validation and role authorization rules are strictly preserved', async () => {
    const key = `${PREFIX}_key_s11_rental`;

    // Attempt to submit FOR_SALE with an idempotency key
    const salePayload = {
      name: `${PREFIX} Illegal Sale Property`,
      type: 'VILLA',
      city: 'Erbil',
      listingType: 'FOR_SALE',
      price: 250000,
    };

    const resSale = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(salePayload),
    });
    assert.strictEqual(resSale.status, 400, 'FOR_SALE must be rejected with 400 VALIDATION_ERROR');
    const saleErr = await resSale.json();
    assert.ok(saleErr.message.includes('rental-only release'), 'Must cite rental-only release boundary');

    // Attempt to assign property to foreign owner without permissions
    const forbiddenAssignPayload = {
      name: `${PREFIX} Illegal Assignment`,
      type: 'VILLA',
      city: 'Erbil',
      ownerId: ownerB.id, // Owner A tries to assign to Owner B without agent role
    };

    const resForbidden = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': `${key}_forbidden`,
      },
      body: JSON.stringify(forbiddenAssignPayload),
    });
    assert.strictEqual(resForbidden.status, 403, 'Unauthorized foreign assignment must return 403 FORBIDDEN');
  });

  // --------------------------------------------------------------------------
  // Scenario 12: Expiration/cleanup behavior matches documented retention policy
  // --------------------------------------------------------------------------
  await t.test('12. Expiration and cleanup behavior treats expired keys as fresh requests', async () => {
    const key = `${PREFIX}_key_s12_expired`;
    const payload = {
      name: `${PREFIX} Expired Key Property`,
      type: 'VILLA',
      city: 'Erbil',
      currency: 'USD',
    };

    // Pre-insert an expired idempotency record (expired 1 hour ago)
    const expiredTimestamp = new Date(Date.now() - 3600 * 1000);
    await db.insert(idempotencyRecords).values({
      key,
      scope: 'POST:/api/properties',
      userId: ownerA.id,
      requestHash: 'historical_hash_expired',
      resourceId: 'historical_expired_prop_id',
      responseStatus: 201,
      responseBody: { id: 'historical_expired_prop_id', name: 'Historical Prop' },
      expiresAt: expiredTimestamp,
    });

    // Make request using the expired key
    const res = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201, 'Expired key must be pruned and allowed as a fresh creation');
    const data = await res.json();
    assert.notStrictEqual(data.id, 'historical_expired_prop_id', 'Must create a new property, not return expired historical data');
    createdPropertyIds.push(data.id);

    // Verify database record has updated future expiresAt
    const dbRecord = await db.select().from(idempotencyRecords).where(
      and(
        eq(idempotencyRecords.userId, ownerA.id),
        eq(idempotencyRecords.key, key)
      )
    );
    assert.strictEqual(dbRecord.length, 1);
    assert.ok(new Date(dbRecord[0].expiresAt).getTime() > Date.now(), 'New record expiresAt must be in the future');
    assert.strictEqual(dbRecord[0].resourceId, data.id);
  });

  // --------------------------------------------------------------------------
  // Scenario 13: Invalid idempotency key format is rejected with 400
  // --------------------------------------------------------------------------
  await t.test('13. Malformed or excessively long idempotency key is rejected with 400', async () => {
    const payload = {
      name: `${PREFIX} Bad Key Prop`,
      type: 'VILLA',
      city: 'Erbil',
    };

    // 1. Whitespace only key
    const resEmpty = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': '    ',
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resEmpty.status, 400, 'Whitespace key must be rejected with 400');
    const emptyErr = await resEmpty.json();
    assert.strictEqual(emptyErr.error, 'VALIDATION_ERROR');

    // 2. Key exceeding 255 chars
    const overlyLongKey = 'a'.repeat(256);
    const resLong = await fetch(`${baseUrl}/properties`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenOwnerA}`,
        'Idempotency-Key': overlyLongKey,
      },
      body: JSON.stringify(payload),
    });
    assert.strictEqual(resLong.status, 400, 'Key > 255 chars must be rejected with 400');
    const longErr = await resLong.json();
    assert.strictEqual(longErr.error, 'VALIDATION_ERROR');
  });
});
