import 'dotenv/config';
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
  rentalApplications,
  leases,
  leaseTenants,
  rentSchedules,
} from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { Permission, UserRole, CompanyRole, LeaseStatus } from '../src/types/index.js';

test('Unified Lease-Creation Validation & Security Suite (Owner & Company Routes)', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `lease_sec_${TIMESTAMP}`;

  // 1. Setup Express Test Server
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  // Helper HTTP POST
  async function postJson(endpoint: string, token: string, body: any) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
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

  // 2. Provision Personas & Organizations in PostgreSQL
  const ownerA = {
    id: `${PREFIX}_owner_A`,
    firstName: 'Karwan',
    lastName: 'Owner',
    email: `${PREFIX}_ownerA@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const unauthorizedOwner = {
    id: `${PREFIX}_owner_unauth`,
    firstName: 'Ranj',
    lastName: 'UnauthOwner',
    email: `${PREFIX}_unauth@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const companyAOrg = {
    id: `${PREFIX}_company_A`,
    name: 'Unified Property Management Ltd',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  };

  const companyAdminUser = {
    id: `${PREFIX}_company_admin`,
    firstName: 'Soran',
    lastName: 'Manager',
    email: `${PREFIX}_soran@mgmt.iq`,
    roles: [UserRole.COMPANY],
    isActive: true,
  };

  const companyAccountantUser = {
    id: `${PREFIX}_company_accountant`,
    firstName: 'Rebaz',
    lastName: 'Accountant',
    email: `${PREFIX}_rebaz@mgmt.iq`,
    roles: [UserRole.COMPANY_MEMBER],
    isActive: true,
  };

  const unauthCompanyOrg = {
    id: `${PREFIX}_company_unauth`,
    name: 'Unauth Company Ltd',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  };

  const unauthCompanyUser = {
    id: `${PREFIX}_unauth_comp_user`,
    firstName: 'Dilan',
    lastName: 'Unauth',
    email: `${PREFIX}_dilan@unauth.iq`,
    roles: [UserRole.COMPANY],
    isActive: true,
  };

  const legitimateTenant = {
    id: `${PREFIX}_legit_tenant`,
    firstName: 'Haval',
    lastName: 'Tenant',
    email: `${PREFIX}_tenant@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const legitimateTenant2 = {
    id: `${PREFIX}_legit_tenant_2`,
    firstName: 'Goran',
    lastName: 'TenantTwo',
    email: `${PREFIX}_tenant2@homehub.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const nonTenantUser = {
    id: `${PREFIX}_non_tenant_user`,
    firstName: 'Bnar',
    lastName: 'NotTenant',
    email: `${PREFIX}_bnar@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER], // does NOT have TENANT role
    isActive: true,
  };

  // Insert Users
  await db.insert(users).values([
    ownerA,
    unauthorizedOwner,
    companyAdminUser,
    companyAccountantUser,
    unauthCompanyUser,
    legitimateTenant,
    legitimateTenant2,
    nonTenantUser,
  ]);

  // Insert Organizations
  await db.insert(organizations).values([companyAOrg, unauthCompanyOrg]);

  // Insert Organization Memberships
  await db.insert(organizationMembers).values([
    {
      id: `${PREFIX}_mem_admin`,
      organizationId: companyAOrg.id,
      userId: companyAdminUser.id,
      role: CompanyRole.COMPANY_ADMIN,
      status: 'ACTIVE',
    },
    {
      id: `${PREFIX}_mem_accountant`,
      organizationId: companyAOrg.id,
      userId: companyAccountantUser.id,
      role: CompanyRole.ACCOUNTANT,
      status: 'ACTIVE',
    },
    {
      id: `${PREFIX}_mem_unauth`,
      organizationId: unauthCompanyOrg.id,
      userId: unauthCompanyUser.id,
      role: CompanyRole.COMPANY_ADMIN,
      status: 'ACTIVE',
    },
  ]);

  // Provision Properties
  const propA = {
    id: `${PREFIX}_prop_A`,
    name: 'Empire World Tower Suite 101',
    type: 'APARTMENT',
    currency: 'USD',
    status: 'ACTIVE',
  };

  const propB = {
    id: `${PREFIX}_prop_B`,
    name: 'Dream City Villa 202',
    type: 'VILLA',
    currency: 'IQD',
    status: 'ACTIVE',
  };

  await db.insert(properties).values([propA, propB]);

  // Provision Ownership
  await db.insert(ownershipRecords).values([
    {
      id: `${PREFIX}_own_A`,
      propertyId: propA.id,
      ownerId: ownerA.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
    {
      id: `${PREFIX}_own_B`,
      propertyId: propB.id,
      ownerId: ownerA.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
  ]);

  // Provision Management Agreement for propA to companyAOrg
  await db.insert(managementAgreements).values([
    {
      id: `${PREFIX}_mgmt_A`,
      propertyId: propA.id,
      companyId: companyAOrg.id,
      ownerId: ownerA.id,
      status: 'ACTIVE',
      startDate: '2025-01-01',
      endDate: '2035-01-01',
      grantedPermissions: [Permission.MANAGE_LEASES, Permission.VIEW_FINANCIALS],
    },
  ]);

  // Provision Rental Applications
  // 1. Approved application for legitimateTenant on propA
  const approvedAppPropA = {
    id: `${PREFIX}_app_approved_propA`,
    propertyId: propA.id,
    applicantUserId: legitimateTenant.id,
    status: 'APPROVED',
  };

  // 2. Submitted (unapproved) application for legitimateTenant2 on propA
  const unapprovedAppPropA = {
    id: `${PREFIX}_app_submitted_propA`,
    propertyId: propA.id,
    applicantUserId: legitimateTenant2.id,
    status: 'SUBMITTED',
  };

  // 3. Approved application for legitimateTenant on propB (different property)
  const approvedAppPropB = {
    id: `${PREFIX}_app_approved_propB`,
    propertyId: propB.id,
    applicantUserId: legitimateTenant.id,
    status: 'APPROVED',
  };

  await db.insert(rentalApplications).values([
    approvedAppPropA,
    unapprovedAppPropA,
    approvedAppPropB,
  ]);

  // Issue Tokens
  const tokenOwnerA = signAuthToken({
    id: ownerA.id,
    email: ownerA.email,
    roles: ownerA.roles,
    tokenVersion: 1,
  });

  const tokenUnauthOwner = signAuthToken({
    id: unauthorizedOwner.id,
    email: unauthorizedOwner.email,
    roles: unauthorizedOwner.roles,
    tokenVersion: 1,
  });

  const tokenCompanyAdmin = signAuthToken({
    id: companyAdminUser.id,
    email: companyAdminUser.email,
    roles: companyAdminUser.roles,
    organizationId: companyAOrg.id,
    tokenVersion: 1,
  });

  const tokenCompanyAccountant = signAuthToken({
    id: companyAccountantUser.id,
    email: companyAccountantUser.email,
    roles: companyAccountantUser.roles,
    organizationId: companyAOrg.id,
    tokenVersion: 1,
  });

  const tokenUnauthCompany = signAuthToken({
    id: unauthCompanyUser.id,
    email: unauthCompanyUser.email,
    roles: unauthCompanyUser.roles,
    organizationId: unauthCompanyOrg.id,
    tokenVersion: 1,
  });

  // Track created leases for cleanup
  const createdLeaseIds: string[] = [];

  t.after(async () => {
    try {
      server.close();
      if (createdLeaseIds.length > 0) {
        await db.delete(rentSchedules).where(inArray(rentSchedules.leaseId, createdLeaseIds));
        await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, createdLeaseIds));
        await db.delete(leases).where(inArray(leases.id, createdLeaseIds));
      }
      await db.delete(rentalApplications).where(inArray(rentalApplications.propertyId, [propA.id, propB.id]));
      await db.delete(managementAgreements).where(inArray(managementAgreements.propertyId, [propA.id, propB.id]));
      await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, [propA.id, propB.id]));
      await db.delete(properties).where(inArray(properties.id, [propA.id, propB.id]));
      await db.delete(organizationMembers).where(inArray(organizationMembers.organizationId, [companyAOrg.id, unauthCompanyOrg.id]));
      await db.delete(organizations).where(inArray(organizations.id, [companyAOrg.id, unauthCompanyOrg.id]));
      await db.delete(users).where(inArray(users.id, [
        ownerA.id,
        unauthorizedOwner.id,
        companyAdminUser.id,
        companyAccountantUser.id,
        unauthCompanyUser.id,
        legitimateTenant.id,
        legitimateTenant2.id,
        nonTenantUser.id,
      ]));
    } catch (e) {
      // Ignore cleanup error in test
    }
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 1: REJECTION OF NON-EXISTENT TENANT
  // --------------------------------------------------------------------------
  await t.test('1. Rejects non-existent tenant in Owner route (POST /api/owner/leases)', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: 'non_existent_user_000',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /VALIDATION_ERROR: One or more specified tenants do not exist/);
  });

  await t.test('2. Rejects non-existent tenant in Company route (POST /api/company/leases/draft)', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: 'non_existent_user_000',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /VALIDATION_ERROR: One or more specified tenants do not exist/);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 2: REJECTION OF USER WITHOUT TENANT ROLE
  // --------------------------------------------------------------------------
  await t.test('3. Rejects user without TENANT role in Owner route', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: nonTenantUser.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /lacks the TENANT role/);
  });

  await t.test('4. Rejects user without TENANT role in Company route', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: nonTenantUser.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /lacks the TENANT role/);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 3: REJECTION OF TENANT WITH NO APPROVED APPLICATION
  // --------------------------------------------------------------------------
  await t.test('5. Rejects tenant with SUBMITTED (not APPROVED) application in Owner route', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: legitimateTenant2.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /does not have an APPROVED rental application for this property/);
  });

  await t.test('6. Rejects tenant with SUBMITTED (not APPROVED) application in Company route', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: legitimateTenant2.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /does not have an APPROVED rental application for this property/);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 4: REJECTION OF APPLICATION FOR DIFFERENT PROPERTY
  // --------------------------------------------------------------------------
  await t.test('7. Rejects application approved for a different property in Owner route', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propB.id,
      tenantId: legitimateTenant2.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1500000,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /does not have an APPROVED rental application for this property/);
  });

  await t.test('8. Rejects application approved for different tenant or property in Company route', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: legitimateTenant2.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /does not have an APPROVED rental application for this property/);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 5: REJECTION OF MISSING, MALFORMED, EQUAL, OR INVERTED DATES
  // --------------------------------------------------------------------------
  await t.test('9. Rejects inverted lease dates (startDate > endDate) in Owner route', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2027-06-01',
      endDate: '2026-06-01',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /must be strictly before end date/);
  });

  await t.test('10. Rejects inverted lease dates (startDate > endDate) in Company route', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2027-06-01',
      endDate: '2026-06-01',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /must be strictly before end date/);
  });

  await t.test('11. Rejects equal lease dates (startDate === endDate) in Owner route', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /must be strictly before end date/);
  });

  await t.test('12. Rejects equal lease dates (startDate === endDate) in Company route', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-06-01',
      endDate: '2026-06-01',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /must be strictly before end date/);
  });

  await t.test('13. Rejects malformed dates in Owner and Company routes', async () => {
    const resOwner = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: 'invalid-date',
      endDate: '2026-06-01',
      rentAmount: 1200,
    });
    assert.strictEqual(resOwner.status, 400);

    const resCompany = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-06-01',
      endDate: 'not-a-date',
      rentAmount: 1200,
    });
    assert.strictEqual(resCompany.status, 400);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 6: REJECTION OF UNAUTHORIZED CALLERS
  // --------------------------------------------------------------------------
  await t.test('14. Rejects Owner route caller without ownership/authority (HTTP 403)', async () => {
    const res = await postJson('/owner/leases', tokenUnauthOwner, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 403);
    assert.match(res.data.error, /AUTHORITY_REQUIRED/);
  });

  await t.test('15. Rejects Company route caller without management agreement (HTTP 403)', async () => {
    const res = await postJson('/company/leases/draft', tokenUnauthCompany, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 403);
    assert.match(res.data.error, /AUTHORITY_REQUIRED: No active management agreement/);
  });

  await t.test('16. Rejects Company member with ACCOUNTANT role drafting leases (HTTP 403)', async () => {
    const res = await postJson('/company/leases/draft', tokenCompanyAccountant, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 403);
    assert.match(res.data.error, /ROLE_PRIVILEGE_REQUIRED/);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 7: TRANSACTION ROLLBACK VERIFICATION
  // --------------------------------------------------------------------------
  await t.test('17. Verifies transaction rollback: rejected request produces NO partial rows', async () => {
    const beforeLeases = await db.select().from(leases).where(eq(leases.propertyId, propA.id));
    const beforeLeaseTenants = await db.select().from(leaseTenants);

    // Call with invalid tenant role
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: nonTenantUser.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      rentAmount: 1200,
    });
    assert.strictEqual(res.status, 400);

    const afterLeases = await db.select().from(leases).where(eq(leases.propertyId, propA.id));
    const afterLeaseTenants = await db.select().from(leaseTenants);

    assert.strictEqual(afterLeases.length, beforeLeases.length, 'No partial lease row should exist');
    assert.strictEqual(afterLeaseTenants.length, beforeLeaseTenants.length, 'No partial leaseTenant row should exist');
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 8: VALID OWNER LEASE CREATION WORKFLOW
  // --------------------------------------------------------------------------
  let ownerCreatedLeaseId = '';

  await t.test('18. Valid Owner lease creation succeeds with PENDING_SIGNATURE status', async () => {
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-07-01',
      endDate: '2027-06-30',
      rentAmount: 1200,
      currency: 'USD',
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id, 'Lease must have an ID');
    assert.strictEqual(res.data.status, LeaseStatus.PENDING_SIGNATURE, 'Owner lease must be PENDING_SIGNATURE');
    ownerCreatedLeaseId = res.data.id;
    createdLeaseIds.push(ownerCreatedLeaseId);

    // Verify leaseTenants row exists in PostgreSQL
    const ltRows = await db.select().from(leaseTenants).where(eq(leaseTenants.leaseId, ownerCreatedLeaseId));
    assert.strictEqual(ltRows.length, 1);
    assert.strictEqual(ltRows[0].tenantId, legitimateTenant.id);
    assert.strictEqual(ltRows[0].isPrimary, true);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 9: DUPLICATE LEASE EXPLOITATION PREVENTION
  // --------------------------------------------------------------------------
  await t.test('19. Prevents duplicate lease creation for same tenant during overlapping period', async () => {
    // Attempt to create another lease for the same tenant on propA overlapping 2026-07-01 to 2027-06-30
    const res = await postJson('/owner/leases', tokenOwnerA, {
      propertyId: propA.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: 1200,
    });

    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /already has an active or pending lease|overlaps with an existing active or pending lease/);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 10: VALID COMPANY DRAFT LEASE CREATION WORKFLOW
  // --------------------------------------------------------------------------
  let companyCreatedLeaseId = '';

  await t.test('20. Valid Company draft lease creation succeeds with PENDING_APPROVAL status', async () => {
    // Create management agreement on propB for companyAOrg
    await db.insert(managementAgreements).values({
      id: `${PREFIX}_mgmt_B`,
      propertyId: propB.id,
      companyId: companyAOrg.id,
      ownerId: ownerA.id,
      status: 'ACTIVE',
      startDate: '2025-01-01',
      endDate: '2035-01-01',
      grantedPermissions: [Permission.MANAGE_LEASES, Permission.VIEW_FINANCIALS],
    });

    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propB.id,
      tenantId: legitimateTenant.id,
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: 1500000,
      currency: 'IQD',
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.id, 'Draft lease must have an ID');
    assert.strictEqual(res.data.status, 'PENDING_APPROVAL', 'Company lease must be PENDING_APPROVAL');
    companyCreatedLeaseId = res.data.id;
    createdLeaseIds.push(companyCreatedLeaseId);

    // Verify leaseTenants row exists in PostgreSQL
    const ltRows = await db.select().from(leaseTenants).where(eq(leaseTenants.leaseId, companyCreatedLeaseId));
    assert.strictEqual(ltRows.length, 1);
    assert.strictEqual(ltRows[0].tenantId, legitimateTenant.id);
    assert.strictEqual(ltRows[0].isPrimary, true);
  });

  await t.test('21. Valid Company draft lease via /api/company/leases route alias also works', async () => {
    const tenant3 = {
      id: `${PREFIX}_legit_tenant_3`,
      firstName: 'Shkar',
      lastName: 'TenantThree',
      email: `${PREFIX}_tenant3@homehub.iq`,
      roles: [UserRole.TENANT],
      isActive: true,
    };
    await db.insert(users).values(tenant3);

    await db.insert(rentalApplications).values({
      id: `${PREFIX}_app_approved_propB_t3`,
      propertyId: propB.id,
      applicantUserId: tenant3.id,
      status: 'APPROVED',
    });

    const res = await postJson('/company/leases', tokenCompanyAdmin, {
      propertyId: propB.id,
      tenantId: tenant3.id,
      startDate: '2027-09-01',
      endDate: '2028-08-31',
      rentAmount: 1600000,
      currency: 'IQD',
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.status, 'PENDING_APPROVAL');

    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, res.data.id));
    await db.delete(leases).where(eq(leases.id, res.data.id));
    await db.delete(rentalApplications).where(eq(rentalApplications.id, `${PREFIX}_app_approved_propB_t3`));
    await db.delete(users).where(eq(users.id, tenant3.id));
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 11: LEASE ACTIVATION ROLLBACK AND SCHEDULE INTEGRITY
  // --------------------------------------------------------------------------
  await t.test('22. Lease activation prevents active lease with zero schedules and validates dates', async () => {
    // If a lease has inverted dates in the database (e.g. legacy/tampered row), activateLease rejects and rolls back
    const corruptedLease = await db.insert(leases).values({
      id: `${PREFIX}_corrupted_lease`,
      propertyId: propB.id,
      startDate: '2029-01-01',
      endDate: '2028-01-01', // inverted
      rentAmount: '1000000',
      currency: 'IQD',
      status: LeaseStatus.PENDING_SIGNATURE,
    }).returning();
    createdLeaseIds.push(corruptedLease[0].id);

    await db.insert(leaseTenants).values({
      leaseId: corruptedLease[0].id,
      tenantId: legitimateTenant.id,
      isPrimary: true,
    });

    await assert.rejects(
      async () => {
        await leaseRepository.activateLease(corruptedLease[0].id);
      },
      /must be strictly before end date/
    );

    // Verify lease was NOT activated
    const [checkLease] = await db.select().from(leases).where(eq(leases.id, corruptedLease[0].id));
    assert.strictEqual(checkLease.status, LeaseStatus.PENDING_SIGNATURE, 'Lease status must remain unactivated');

    // Verify zero rent schedules were generated
    const checkSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, corruptedLease[0].id));
    assert.strictEqual(checkSchedules.length, 0, 'Zero rent schedules must exist for failed activation');
  });
});
