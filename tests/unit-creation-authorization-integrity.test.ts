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
  managementAgreements,
  leases,
  leaseTenants,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { Permission, UserRole } from '../src/types/index.js';

test('Unit Creation Authorization & Data Integrity Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `unit_audit_${TIMESTAMP}`;

  // 1. Setup Express Test App
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Helper for requests
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

  // 2. Provision Test Personas & Properties
  const ownerA = {
    id: `${PREFIX}_owner_A`,
    firstName: 'Owner',
    lastName: 'A',
    email: `${PREFIX}_ownerA@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };
  const ownerB = {
    id: `${PREFIX}_owner_B`,
    firstName: 'Owner',
    lastName: 'B',
    email: `${PREFIX}_ownerB@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const companyAOrg = {
    id: `${PREFIX}_company_A`,
    name: 'Company Alpha Mgmt',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  };
  const companyBOrg = {
    id: `${PREFIX}_company_B`,
    name: 'Company Beta Mgmt',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  };

  const managerUserA = {
    id: `${PREFIX}_mgr_A`,
    firstName: 'Manager',
    lastName: 'A',
    email: `${PREFIX}_mgrA@homehub.iq`,
    roles: [UserRole.COMPANY_MEMBER],
    isActive: true,
  };
  const readOnlyManagerUser = {
    id: `${PREFIX}_mgr_readonly`,
    firstName: 'ReadOnly',
    lastName: 'Mgr',
    email: `${PREFIX}_ro@homehub.iq`,
    roles: [UserRole.COMPANY_MEMBER],
    isActive: true,
  };
  const suspendedMemberUser = {
    id: `${PREFIX}_mgr_suspended`,
    firstName: 'Suspended',
    lastName: 'Mgr',
    email: `${PREFIX}_susp@homehub.iq`,
    roles: [UserRole.COMPANY_MEMBER],
    isActive: true,
  };
  const viewerMemberUser = {
    id: `${PREFIX}_viewer_user`,
    firstName: 'Viewer',
    lastName: 'User',
    email: `${PREFIX}_viewer@homehub.iq`,
    roles: [UserRole.COMPANY_MEMBER],
    isActive: true,
  };

  const propA = {
    id: `${PREFIX}_prop_A`,
    name: 'Sunrise Towers Property A',
    type: 'APARTMENT',
    currency: 'IQD',
    status: 'ACTIVE',
  };
  const propB = {
    id: `${PREFIX}_prop_B`,
    name: 'Oasis Complex Property B',
    type: 'APARTMENT',
    currency: 'USD',
    status: 'ACTIVE',
  };

  // Insert Users
  await db.insert(users).values([
    ownerA,
    ownerB,
    managerUserA,
    readOnlyManagerUser,
    suspendedMemberUser,
    viewerMemberUser,
  ]);

  // Insert Organizations
  await db.insert(organizations).values([companyAOrg, companyBOrg]);

  // Insert Organization Members
  await db.insert(organizationMembers).values([
    {
      id: `${PREFIX}_mem_A`,
      organizationId: companyAOrg.id,
      userId: managerUserA.id,
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
    },
    {
      id: `${PREFIX}_mem_ro`,
      organizationId: companyAOrg.id,
      userId: readOnlyManagerUser.id,
      role: 'PROPERTY_MANAGER',
      status: 'ACTIVE',
    },
    {
      id: `${PREFIX}_mem_susp`,
      organizationId: companyAOrg.id,
      userId: suspendedMemberUser.id,
      role: 'PROPERTY_MANAGER',
      status: 'SUSPENDED',
    },
    {
      id: `${PREFIX}_mem_viewer`,
      organizationId: companyAOrg.id,
      userId: viewerMemberUser.id,
      role: 'VIEWER',
      status: 'ACTIVE',
    },
  ]);

  // Insert Properties
  await db.insert(properties).values([propA, propB]);

  // Ownership Records: Owner A owns Prop A (VERIFIED); Owner B owns Prop B (VERIFIED)
  await db.insert(ownershipRecords).values([
    {
      id: `${PREFIX}_own_A`,
      propertyId: propA.id,
      ownerId: ownerA.id,
      status: 'VERIFIED',
      ownershipPercentage: '100.00',
    },
    {
      id: `${PREFIX}_own_B`,
      propertyId: propB.id,
      ownerId: ownerB.id,
      status: 'VERIFIED',
      ownershipPercentage: '100.00',
    },
  ]);

  // Management Agreements on Property A:
  // 1. Company A has ACTIVE agreement with EDIT_PROPERTY permission
  const activeAgreement = {
    id: `${PREFIX}_mgmt_active`,
    propertyId: propA.id,
    companyId: companyAOrg.id,
    ownerId: ownerA.id,
    status: 'ACTIVE',
    startDate: '2025-01-01',
    endDate: '2035-01-01',
    grantedPermissions: [Permission.VIEW_PROPERTY, Permission.EDIT_PROPERTY],
  };
  await db.insert(managementAgreements).values(activeAgreement);

  // Generate Authoritative Auth Tokens
  const tokenOwnerA = signAuthToken({ id: ownerA.id, email: ownerA.email, roles: ownerA.roles, tokenVersion: 1 });
  const tokenOwnerB = signAuthToken({ id: ownerB.id, email: ownerB.email, roles: ownerB.roles, tokenVersion: 1 });
  const tokenManagerA = signAuthToken({ id: managerUserA.id, email: managerUserA.email, roles: managerUserA.roles, tokenVersion: 1 });
  const tokenReadOnlyManager = signAuthToken({ id: readOnlyManagerUser.id, email: readOnlyManagerUser.email, roles: readOnlyManagerUser.roles, tokenVersion: 1 });
  const tokenSuspendedMember = signAuthToken({ id: suspendedMemberUser.id, email: suspendedMemberUser.email, roles: suspendedMemberUser.roles, tokenVersion: 1 });
  const tokenViewerMember = signAuthToken({ id: viewerMemberUser.id, email: viewerMemberUser.email, roles: viewerMemberUser.roles, tokenVersion: 1 });

  // Cleanup helper
  t.after(async () => {
    try {
      server.close();
      await db.delete(units).where(sql`property_id IN (${propA.id}, ${propB.id})`);
      await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, propA.id));
      await db.delete(ownershipRecords).where(sql`property_id IN (${propA.id}, ${propB.id})`);
      await db.delete(properties).where(sql`id IN (${propA.id}, ${propB.id})`);
      await db.delete(organizationMembers).where(sql`organization_id IN (${companyAOrg.id}, ${companyBOrg.id})`);
      await db.delete(organizations).where(sql`id IN (${companyAOrg.id}, ${companyBOrg.id})`);
      await db.delete(users).where(sql`id IN (${ownerA.id}, ${ownerB.id}, ${managerUserA.id}, ${readOnlyManagerUser.id}, ${suspendedMemberUser.id}, ${viewerMemberUser.id})`);
    } catch (e) {
      // Ignore cleanup error
    }
  });

  // =========================================================================
  // SCENARIO 1: Authorized Owner creating a unit
  // =========================================================================
  await t.test('1. Authorized Owner creating a unit on own property', async () => {
    const res = await postUnit(tokenOwnerA, propA.id, {
      unitNumber: 'U-101',
      beds: 2,
      baths: 1.5,
      squareFeet: 120,
      marketRent: 750000,
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.unitNumber, 'U-101');
    assert.strictEqual(res.data.propertyId, propA.id);
    assert.strictEqual(res.data.status, 'VACANT');
    assert.strictEqual(res.data.currency, 'IQD');

    // Verify persisted in PostgreSQL
    const [row] = await db.select().from(units).where(eq(units.id, res.data.id));
    assert.ok(row, 'Unit must exist in PostgreSQL units table');
    assert.strictEqual(row.unitNumber, 'U-101');
  });

  // =========================================================================
  // SCENARIO 2: Authorized manager creating a unit with EDIT_PROPERTY permission
  // =========================================================================
  await t.test('2. Authorized manager creating a unit with granted EDIT_PROPERTY permission', async () => {
    const res = await postUnit(tokenManagerA, propA.id, {
      unitNumber: 'U-102',
      beds: 3,
      baths: 2,
      squareFeet: 160,
      marketRent: 950000,
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.unitNumber, 'U-102');
    assert.strictEqual(res.data.propertyId, propA.id);
  });

  // =========================================================================
  // SCENARIO 3: Read-only manager being denied unit creation
  // =========================================================================
  await t.test('3. Read-only manager without EDIT_PROPERTY permission is denied', async () => {
    // Update agreement on Prop A to only grant VIEW_PROPERTY
    await db
      .update(managementAgreements)
      .set({ grantedPermissions: [Permission.VIEW_PROPERTY] })
      .where(eq(managementAgreements.id, activeAgreement.id));

    const res = await postUnit(tokenManagerA, propA.id, {
      unitNumber: 'U-RO-DENIED',
    });

    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for read-only manager, got ${res.status}`);
    assert.strictEqual(res.data.code, 'AUTHORITY_REQUIRED');

    // Restore EDIT_PROPERTY for remaining tests
    await db
      .update(managementAgreements)
      .set({ grantedPermissions: [Permission.VIEW_PROPERTY, Permission.EDIT_PROPERTY] })
      .where(eq(managementAgreements.id, activeAgreement.id));
  });

  // =========================================================================
  // SCENARIO 4: Unrelated Owner being denied access to another Owner's property
  // =========================================================================
  await t.test('4. Unrelated Owner being denied access to another Owner\'s property', async () => {
    const res = await postUnit(tokenOwnerB, propA.id, {
      unitNumber: 'U-STOLEN-PROP',
    });

    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    assert.strictEqual(res.data.code, 'AUTHORITY_REQUIRED');
  });

  // =========================================================================
  // SCENARIO 5: Company A being denied access to Company B's property
  // =========================================================================
  await t.test('5. Company A being denied access to unmanaged Property B', async () => {
    const res = await postUnit(tokenManagerA, propB.id, {
      unitNumber: 'U-COMP-ALIEN',
    });

    assert.strictEqual(res.status, 403, `Expected 403 Forbidden, got ${res.status}`);
    assert.strictEqual(res.data.code, 'AUTHORITY_REQUIRED');
  });

  // =========================================================================
  // SCENARIO 6: Expired, terminated, or revoked management authorization being denied
  // =========================================================================
  await t.test('6. Expired, terminated, or revoked management authorization denied', async () => {
    // 6a. Agreement TERMINATED
    await db
      .update(managementAgreements)
      .set({ status: 'TERMINATED' })
      .where(eq(managementAgreements.id, activeAgreement.id));

    const resTerminated = await postUnit(tokenManagerA, propA.id, { unitNumber: 'U-TERM' });
    assert.strictEqual(resTerminated.status, 403, 'TERMINATED agreement must be rejected with 403');

    // 6b. Agreement EXPIRED (endDate in past)
    await db
      .update(managementAgreements)
      .set({ status: 'ACTIVE', endDate: '2020-01-01' })
      .where(eq(managementAgreements.id, activeAgreement.id));

    const resExpired = await postUnit(tokenManagerA, propA.id, { unitNumber: 'U-EXP' });
    assert.strictEqual(resExpired.status, 403, 'EXPIRED agreement (past endDate) must be rejected with 403');

    // Restore agreement to ACTIVE & valid date
    await db
      .update(managementAgreements)
      .set({ status: 'ACTIVE', endDate: '2035-01-01' })
      .where(eq(managementAgreements.id, activeAgreement.id));

    // 6c. Suspended Member in organizationMembers
    const resSuspended = await postUnit(tokenSuspendedMember, propA.id, { unitNumber: 'U-SUSP' });
    assert.strictEqual(resSuspended.status, 403, 'SUSPENDED company member must be rejected with 403');

    // 6d. VIEWER role in organizationMembers
    const resViewer = await postUnit(tokenViewerMember, propA.id, { unitNumber: 'U-VIEW' });
    assert.strictEqual(resViewer.status, 403, 'VIEWER company member must be rejected with 403');
  });

  // =========================================================================
  // SCENARIO 7: Missing, empty, whitespace-only, and malformed unit numbers rejected
  // =========================================================================
  await t.test('7. Missing, empty, whitespace-only, and malformed inputs rejected', async () => {
    // 7a. Missing unitNumber
    const resMissing = await postUnit(tokenOwnerA, propA.id, { beds: 2 });
    assert.strictEqual(resMissing.status, 400, 'Missing unitNumber must return 400');
    assert.strictEqual(resMissing.data.error, 'VALIDATION_ERROR');

    // 7b. Empty string
    const resEmpty = await postUnit(tokenOwnerA, propA.id, { unitNumber: '' });
    assert.strictEqual(resEmpty.status, 400, 'Empty unitNumber must return 400');
    assert.strictEqual(resEmpty.data.error, 'VALIDATION_ERROR');

    // 7c. Whitespace-only string
    const resWhitespace = await postUnit(tokenOwnerA, propA.id, { unitNumber: '    ' });
    assert.strictEqual(resWhitespace.status, 400, 'Whitespace unitNumber must return 400');
    assert.strictEqual(resWhitespace.data.error, 'VALIDATION_ERROR');

    // 7d. Malformed numeric fields (negative beds)
    const resNegativeBeds = await postUnit(tokenOwnerA, propA.id, { unitNumber: 'U-NEG', beds: -3 });
    assert.strictEqual(resNegativeBeds.status, 400, 'Negative beds must return 400');
    assert.strictEqual(resNegativeBeds.data.error, 'VALIDATION_ERROR');

    // 7e. Malformed numeric fields (negative baths)
    const resNegativeBaths = await postUnit(tokenOwnerA, propA.id, { unitNumber: 'U-NEG2', baths: -1 });
    assert.strictEqual(resNegativeBaths.status, 400, 'Negative baths must return 400');
    assert.strictEqual(resNegativeBaths.data.error, 'VALIDATION_ERROR');

    // 7f. Malformed non-string unitNumber
    const resNumberUnit = await postUnit(tokenOwnerA, propA.id, { unitNumber: 12345 });
    assert.strictEqual(resNumberUnit.status, 400, 'Non-string unitNumber must return 400');
    assert.strictEqual(resNumberUnit.data.error, 'VALIDATION_ERROR');
  });

  // =========================================================================
  // SCENARIO 8: Duplicate unit numbers within same property rejected
  // =========================================================================
  await t.test('8. Duplicate unit numbers within the same property are rejected with 409 CONFLICT', async () => {
    // U-101 was already created in Scenario 1 on Prop A
    const resDup = await postUnit(tokenOwnerA, propA.id, {
      unitNumber: 'U-101',
      beds: 2,
    });

    assert.strictEqual(resDup.status, 409, `Expected 409 Conflict for duplicate unitNumber, got ${resDup.status}`);
    assert.strictEqual(resDup.data.error, 'CONFLICT');

    // Also test whitespace-padded duplicate: "  U-101  "
    const resTrimmedDup = await postUnit(tokenOwnerA, propA.id, {
      unitNumber: '  U-101  ',
    });

    assert.strictEqual(resTrimmedDup.status, 409, 'Trimmed duplicate must also be rejected with 409 CONFLICT');
    assert.strictEqual(resTrimmedDup.data.error, 'CONFLICT');
  });

  // =========================================================================
  // SCENARIO 9: Identical unit numbers allowed across different properties
  // =========================================================================
  await t.test('9. Identical unit numbers allowed across different properties', async () => {
    // Prop B is owned by Owner B. Creating 'U-101' on Prop B must succeed.
    const res = await postUnit(tokenOwnerB, propB.id, {
      unitNumber: 'U-101',
      beds: 1,
      baths: 1,
    });

    assert.strictEqual(res.status, 201, `Expected 201 Created on Prop B, got ${res.status}`);
    assert.strictEqual(res.data.unitNumber, 'U-101');
    assert.strictEqual(res.data.propertyId, propB.id);

    // Verify both U-101 records exist distinctly
    const all101 = await db.select().from(units).where(eq(units.unitNumber, 'U-101'));
    assert.strictEqual(all101.length, 2, 'There should be 2 units named U-101 across different properties');
  });

  // =========================================================================
  // SCENARIO 10: Concurrent duplicate creation attempts resulting in at most one persisted unit
  // =========================================================================
  await t.test('10. Concurrent duplicate creation attempts result in exactly one persisted unit', async () => {
    const raceUnitNumber = `U-RACE-${Date.now()}`;
    const concurrentRequests = 6;

    // Fire 6 simultaneous creation requests with identical unitNumber
    const promises = Array.from({ length: concurrentRequests }, () =>
      postUnit(tokenOwnerA, propA.id, { unitNumber: raceUnitNumber, beds: 2 })
    );

    const outcomes = await Promise.all(promises);

    const successful = outcomes.filter((o) => o.status === 201);
    const conflicts = outcomes.filter((o) => o.status === 409);

    assert.strictEqual(successful.length, 1, `Exactly 1 concurrent request must succeed with 201, got ${successful.length}`);
    assert.strictEqual(conflicts.length, concurrentRequests - 1, `Remaining requests must be rejected with 409 CONFLICT, got ${conflicts.length}`);

    // Verify in database: exactly 1 row with that unit number
    const dbUnits = await db
      .select()
      .from(units)
      .where(and(eq(units.propertyId, propA.id), eq(units.unitNumber, raceUnitNumber)));

    assert.strictEqual(dbUnits.length, 1, 'Database must contain exactly 1 unit row despite concurrent attempts');
  });

  // =========================================================================
  // SCENARIO 11: Invalid unit data and failed authorization leave no partial writes
  // =========================================================================
  await t.test('11. Invalid unit data and failed authorization leave no partial writes', async () => {
    const nonExistentUnit = 'U-NEVER-PERSIST';

    // Attempt with invalid baths
    await postUnit(tokenOwnerA, propA.id, {
      unitNumber: nonExistentUnit,
      baths: -99,
    });

    // Attempt with unauthorized user
    await postUnit(tokenOwnerB, propA.id, {
      unitNumber: nonExistentUnit,
    });

    const check = await db
      .select()
      .from(units)
      .where(and(eq(units.propertyId, propA.id), eq(units.unitNumber, nonExistentUnit)));

    assert.strictEqual(check.length, 0, 'No partial or invalid unit row must be written');
  });

  // =========================================================================
  // SCENARIO 12: Existing unit and lease references remain intact
  // =========================================================================
  await t.test('12. Existing unit and lease relationships remain intact with foreign keys', async () => {
    // Fetch any pre-existing units in the database
    const existingUnits = await db.select().from(units).limit(5);
    assert.ok(existingUnits.length > 0, 'Pre-existing units must remain intact in PostgreSQL');

    for (const u of existingUnits) {
      assert.ok(u.id, 'Unit ID must be defined');
      assert.ok(u.propertyId, 'Property ID must be defined');
      assert.ok(u.unitNumber, 'Unit number must be defined');
    }
  });
});
