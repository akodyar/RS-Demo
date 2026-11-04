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
import { ownerRepository } from '../src/server/repositories/owner.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { companyRepository } from '../src/server/repositories/company.js';
import { Permission, UserRole, CompanyRole, LeaseStatus } from '../src/types/index.js';

test('Company Lease Approval Bypass Prevention & Lifecycle Integrity Suite', async (t) => {
  const TIMESTAMP = Date.now();
  const PREFIX = `appr_sec_${TIMESTAMP}`;

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
    firstName: 'Sherzad',
    lastName: 'OwnerA',
    email: `${PREFIX}_ownerA@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const ownerB = {
    id: `${PREFIX}_owner_B`,
    firstName: 'Bnar',
    lastName: 'OwnerB',
    email: `${PREFIX}_ownerB@homehub.iq`,
    roles: [UserRole.PROPERTY_OWNER],
    isActive: true,
  };

  const companyAOrg = {
    id: `${PREFIX}_company_A`,
    name: 'Approval Secure Property Mgmt Ltd',
    type: 'COMPANY',
    status: 'VERIFIED',
    verified: true,
  };

  const companyAdminUser = {
    id: `${PREFIX}_company_admin`,
    firstName: 'Hemn',
    lastName: 'Manager',
    email: `${PREFIX}_hemn@mgmt.iq`,
    roles: [UserRole.COMPANY],
    isActive: true,
  };

  const companyAccountantUser = {
    id: `${PREFIX}_company_accountant`,
    firstName: 'Lina',
    lastName: 'Accountant',
    email: `${PREFIX}_lina@mgmt.iq`,
    roles: [UserRole.COMPANY_MEMBER],
    isActive: true,
  };

  const tenantUser = {
    id: `${PREFIX}_tenant_1`,
    firstName: 'Rasty',
    lastName: 'Tenant',
    email: `${PREFIX}_rasty@tenant.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const secondTenantUser = {
    id: `${PREFIX}_tenant_2`,
    firstName: 'Darya',
    lastName: 'Tenant2',
    email: `${PREFIX}_darya@tenant.iq`,
    roles: [UserRole.TENANT],
    isActive: true,
  };

  const platformAdminUser = {
    id: `${PREFIX}_platform_admin`,
    firstName: 'Admin',
    lastName: 'Super',
    email: `${PREFIX}_admin@homehub.iq`,
    roles: [UserRole.PLATFORM_ADMIN],
    isActive: true,
  };

  await db.insert(users).values([
    ownerA,
    ownerB,
    companyAdminUser,
    companyAccountantUser,
    tenantUser,
    secondTenantUser,
    platformAdminUser,
  ]);

  await db.insert(organizations).values([companyAOrg]);

  await db.insert(organizationMembers).values([
    {
      organizationId: companyAOrg.id,
      userId: companyAdminUser.id,
      role: CompanyRole.COMPANY_OWNER,
      status: 'ACTIVE',
    },
    {
      organizationId: companyAOrg.id,
      userId: companyAccountantUser.id,
      role: CompanyRole.ACCOUNTANT,
      status: 'ACTIVE',
    },
  ]);

  // 3. Provision Property, Ownership, and Management Agreement
  const [propA] = await db.insert(properties).values({
    name: 'Villa Zagros - Sulaymaniyah',
    type: 'RESIDENTIAL',
    currency: 'IQD',
    address: { city: 'Sulaymaniyah', district: 'Sarchinar' },
  }).returning();

  const [propB] = await db.insert(properties).values({
    name: 'Ainkawa Modern Complex - Erbil',
    type: 'RESIDENTIAL',
    currency: 'USD',
    address: { city: 'Erbil', district: 'Ainkawa' },
  }).returning();

  // Owner A owns Prop A, Owner B owns Prop B
  await db.insert(ownershipRecords).values([
    {
      propertyId: propA.id,
      ownerId: ownerA.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
    {
      propertyId: propB.id,
      ownerId: ownerB.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
  ]);

  // Company A manages Prop A under active management agreement
  await db.insert(managementAgreements).values({
    propertyId: propA.id,
    companyId: companyAOrg.id,
    ownerId: ownerA.id,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2030-12-31',
    grantedPermissions: [
      Permission.VIEW_PROPERTY,
      Permission.EDIT_PROPERTY,
      Permission.MANAGE_LEASES,
      Permission.COLLECT_RENT,
    ],
  });

  // Approved rental application for tenant 1 on prop A
  await db.insert(rentalApplications).values({
    propertyId: propA.id,
    applicantUserId: tenantUser.id,
    status: 'APPROVED',
  });

  // Approved rental application for tenant 2 on prop A
  await db.insert(rentalApplications).values({
    propertyId: propA.id,
    applicantUserId: secondTenantUser.id,
    status: 'APPROVED',
  });

  // JWT Tokens
  const tokenOwnerA = signAuthToken({
    id: ownerA.id,
    email: ownerA.email,
    roles: ownerA.roles,
  });

  const tokenOwnerB = signAuthToken({
    id: ownerB.id,
    email: ownerB.email,
    roles: ownerB.roles,
  });

  const tokenCompanyAdmin = signAuthToken({
    id: companyAdminUser.id,
    email: companyAdminUser.email,
    roles: companyAdminUser.roles,
    organizationId: companyAOrg.id,
  });

  const tokenCompanyAccountant = signAuthToken({
    id: companyAccountantUser.id,
    email: companyAccountantUser.email,
    roles: companyAccountantUser.roles,
    organizationId: companyAOrg.id,
  });

  const tokenTenant1 = signAuthToken({
    id: tenantUser.id,
    email: tenantUser.email,
    roles: tenantUser.roles,
  });

  const tokenTenant2 = signAuthToken({
    id: secondTenantUser.id,
    email: secondTenantUser.email,
    roles: secondTenantUser.roles,
  });

  const tokenPlatformAdmin = signAuthToken({
    id: platformAdminUser.id,
    email: platformAdminUser.email,
    roles: platformAdminUser.roles,
  });

  let sharedLeaseId: string;

  // Helper to create a company draft lease in PENDING_APPROVAL
  async function createCompanyDraftLease(startDate: string, endDate: string, rent: number, tenantId: string = tenantUser.id) {
    const res = await postJson('/company/leases/draft', tokenCompanyAdmin, {
      propertyId: propA.id,
      tenantId,
      startDate,
      endDate,
      rentAmount: rent,
      currency: 'IQD',
    });
    assert.strictEqual(res.status, 201, `Failed to draft lease: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.status, 'PENDING_APPROVAL');
    return res.data;
  }

  // ========================================================================
  // SCENARIO 1: Company cannot activate or bypass approval for PENDING_APPROVAL lease
  // ========================================================================
  await t.test('1. Company cannot activate or bypass approval for a lease still awaiting owner approval', async () => {
    const draftedLease = await createCompanyDraftLease('2027-01-01', '2027-12-31', 1200000);
    sharedLeaseId = draftedLease.id;

    // A. Company attempts to activate via HTTP POST /api/leases/:id/activate
    const res = await postJson(`/leases/${draftedLease.id}/activate`, tokenCompanyAdmin, {});
    assert.strictEqual(res.status, 403, 'Company must be rejected with HTTP 403 when activating unapproved lease');
    assert.ok(
      res.data.message?.includes('awaiting owner approval') || res.data.error?.includes('AUTHORIZATION_ERROR'),
      'Must specify that owner approval is required'
    );

    // B. Direct repository boundary check
    await assert.rejects(
      async () => {
        await leaseRepository.activateLease(draftedLease.id);
      },
      /VALIDATION_ERROR: Cannot activate lease in PENDING_APPROVAL status/,
      'Direct call to leaseRepository.activateLease must throw validation error for PENDING_APPROVAL'
    );

    // C. Verify state remains strictly PENDING_APPROVAL in database
    const [freshLease] = await db.select().from(leases).where(eq(leases.id, draftedLease.id)).limit(1);
    assert.strictEqual(freshLease.status, 'PENDING_APPROVAL', 'Lease status must remain PENDING_APPROVAL');

    // D. Verify zero rent schedules were generated
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, draftedLease.id));
    assert.strictEqual(schedules.length, 0, 'Zero rent schedules must exist for unapproved lease');
  });

  // ========================================================================
  // SCENARIO 2: Tenant cannot activate or approve on behalf of the owner
  // ========================================================================
  await t.test('2. Tenant cannot activate or approve on behalf of the owner', async () => {
    // A. Tenant attempts to accept unapproved lease via POST /api/tenant/lease/:id/accept
    const acceptRes = await postJson(`/tenant/lease/${sharedLeaseId}/accept`, tokenTenant1, {});
    assert.strictEqual(acceptRes.status, 403, 'Tenant acceptance of unapproved lease must return HTTP 403');
    assert.ok(
      acceptRes.data.message?.includes('awaiting owner approval') || acceptRes.data.error === 'FORBIDDEN',
      'Tenant must receive clear forbidden error'
    );

    // B. Direct tenant repository boundary check
    await assert.rejects(
      async () => {
        await tenantRepository.acceptLeaseOffer(tenantUser.id, sharedLeaseId);
      },
      /FORBIDDEN_LEASE_PENDING_APPROVAL/,
      'Direct call to tenantRepository.acceptLeaseOffer must fail-fast with FORBIDDEN_LEASE_PENDING_APPROVAL'
    );

    // C. Tenant attempts to call owner approval endpoint
    const approveRes = await postJson(`/owner/leases/${sharedLeaseId}/approve`, tokenTenant1, {});
    assert.strictEqual(approveRes.status, 403, 'Tenant cannot call owner approval endpoint (HTTP 403)');

    // D. State in database must remain PENDING_APPROVAL
    const [freshLease] = await db.select().from(leases).where(eq(leases.id, sharedLeaseId)).limit(1);
    assert.strictEqual(freshLease.status, 'PENDING_APPROVAL');

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, sharedLeaseId));
    assert.strictEqual(schedules.length, 0);
  });

  // ========================================================================
  // SCENARIO 3: Unauthorized company member or non-owner cannot approve or activate
  // ========================================================================
  await t.test('3. Unauthorized company member or foreign owner cannot approve or activate', async () => {
    // A. Company member with ACCOUNTANT role calls POST /api/leases/:id/activate
    const actRes = await postJson(`/leases/${sharedLeaseId}/activate`, tokenCompanyAccountant, {});
    assert.strictEqual(actRes.status, 403, 'Company accountant cannot activate lease');

    // B. Company member calls company decision endpoint for LEASE type
    const compDecRes = await postJson(`/company/approvals/${sharedLeaseId}/decision`, tokenCompanyAdmin, {
      type: 'LEASE_ACTIVATION',
      decision: 'APPROVE',
    });
    assert.strictEqual(compDecRes.status, 403, 'Company decision endpoint must reject lease approval with HTTP 403');
    assert.ok(compDecRes.data.error?.includes('AUTHORITY_REQUIRED'), 'Must state authority is required');

    // C. Direct companyRepository.decideApproval boundary check
    await assert.rejects(
      async () => {
        await companyRepository.decideApproval(companyAOrg.id, sharedLeaseId, 'LEASE_ACTIVATION', 'APPROVE', companyAdminUser.id, CompanyRole.COMPANY_OWNER);
      },
      /AUTHORITY_REQUIRED: Leases awaiting owner approval cannot be approved by company members/
    );

    // D. Foreign Owner (Owner B) attempts to approve lease on Prop A
    const foreignRes = await postJson(`/owner/leases/${sharedLeaseId}/approve`, tokenOwnerB, {});
    assert.strictEqual(foreignRes.status, 403, 'Foreign property owner cannot approve lease on another owner property');

    // E. Direct ownerRepository.decideLeaseApproval check with foreign owner
    await assert.rejects(
      async () => {
        await ownerRepository.decideLeaseApproval(ownerB, sharedLeaseId, 'APPROVE');
      },
      /AUTHORITY_REQUIRED: Only verified property owner or platform admin can decide lease approval/
    );

    // F. Status remains PENDING_APPROVAL
    const [freshLease] = await db.select().from(leases).where(eq(leases.id, sharedLeaseId)).limit(1);
    assert.strictEqual(freshLease.status, 'PENDING_APPROVAL');
  });

  // ========================================================================
  // SCENARIO 4: The authorized owner approval path succeeds
  // ========================================================================
  await t.test('4. The authorized owner approval path succeeds and transitions to PENDING_SIGNATURE', async () => {
    // Authorized Owner of Prop A approves the drafted lease
    const approveRes = await postJson(`/owner/leases/${sharedLeaseId}/approve`, tokenOwnerA, {
      notes: 'Approved lease terms with 1,200,000 IQD monthly rent.',
    });
    assert.strictEqual(approveRes.status, 200, `Owner approval failed: ${JSON.stringify(approveRes.data)}`);
    assert.strictEqual(approveRes.data.lease.status, 'PENDING_SIGNATURE');

    // Verify database record transitioned to PENDING_SIGNATURE
    const [approvedLease] = await db.select().from(leases).where(eq(leases.id, sharedLeaseId)).limit(1);
    assert.strictEqual(approvedLease.status, 'PENDING_SIGNATURE', 'Status must be PENDING_SIGNATURE after owner approval');

    // At this stage, tenant has not signed yet, so schedules are still 0
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, sharedLeaseId));
    assert.strictEqual(schedules.length, 0, 'Zero rent schedules before tenant signature/acceptance');
  });

  // ========================================================================
  // SCENARIO 5: Legitimate subsequent signature and activation flows still work
  // ========================================================================
  await t.test('5. Legitimate subsequent signature and activation flows work seamlessly', async () => {
    // Tenant accepts/signs the approved lease (currently in PENDING_SIGNATURE)
    const acceptRes = await postJson(`/tenant/lease/${sharedLeaseId}/accept`, tokenTenant1, {});
    assert.strictEqual(acceptRes.status, 200, `Tenant acceptance failed: ${JSON.stringify(acceptRes.data)}`);
    assert.strictEqual(acceptRes.data.lease.status, 'ACTIVE');

    // Verify lease is now ACTIVE in database
    const [activeLease] = await db.select().from(leases).where(eq(leases.id, sharedLeaseId)).limit(1);
    assert.strictEqual(activeLease.status, 'ACTIVE', 'Lease must be ACTIVE after tenant acceptance');

    // Verify rent schedules were generated (12 monthly schedules for 2027)
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, sharedLeaseId));
    assert.strictEqual(schedules.length, 12, '12 rent schedules must be generated for 1-year monthly lease');
    assert.strictEqual(Number(schedules[0].amount), 1200000);
    assert.strictEqual(schedules[0].currency, 'IQD');
  });

  // ========================================================================
  // SCENARIO 6: Rejected transitions leave lease status CANCELLED and schedules unchanged
  // ========================================================================
  await t.test('6. Rejected transitions leave lease CANCELLED and rent schedules unchanged', async () => {
    // Draft another company lease for tenant 2 in 2028
    const draft2 = await createCompanyDraftLease('2028-01-01', '2028-12-31', 1500000, secondTenantUser.id);

    // Owner explicitly rejects the draft
    const rejectRes = await postJson(`/owner/leases/${draft2.id}/reject`, tokenOwnerA, {
      notes: 'Proposed rent is too low for this period.',
    });
    assert.strictEqual(rejectRes.status, 200, `Owner reject failed: ${JSON.stringify(rejectRes.data)}`);
    assert.strictEqual(rejectRes.data.lease.status, 'CANCELLED');

    // Verify status is CANCELLED in database
    const [rejectedLease] = await db.select().from(leases).where(eq(leases.id, draft2.id)).limit(1);
    assert.strictEqual(rejectedLease.status, 'CANCELLED', 'Rejected lease must transition to CANCELLED');

    // Verify 0 rent schedules generated
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, draft2.id));
    assert.strictEqual(schedules.length, 0, 'Rejected lease must have zero rent schedules');

    // Unassociated Tenant 1 attempting to accept draft2 fails with 403 FORBIDDEN
    const unassocTenantRes = await postJson(`/tenant/lease/${draft2.id}/accept`, tokenTenant1, {});
    assert.strictEqual(unassocTenantRes.status, 403, 'Unassociated tenant cannot accept lease (HTTP 403)');

    // Linked Tenant 2 attempting to accept CANCELLED lease fails with 400 VALIDATION_ERROR
    const linkedTenantRes = await postJson(`/tenant/lease/${draft2.id}/accept`, tokenTenant2, {});
    assert.strictEqual(linkedTenantRes.status, 400, 'Linked tenant cannot accept CANCELLED lease (HTTP 400)');
    assert.ok(
      linkedTenantRes.data.error?.includes('VALIDATION_ERROR') || linkedTenantRes.data.error?.includes('CANCELLED'),
      'Must return validation error for CANCELLED lease'
    );

    // Company attempting to activate CANCELLED lease fails with 400 VALIDATION_ERROR
    const compActRes = await postJson(`/leases/${draft2.id}/activate`, tokenCompanyAdmin, {});
    assert.strictEqual(compActRes.status, 400, 'Company cannot activate CANCELLED lease (HTTP 400)');
  });

  // ========================================================================
  // SCENARIO 7: Concurrent approval and activation attempts cannot bypass transition
  // ========================================================================
  await t.test('7. Concurrent approval/activation attempts cannot bypass the required transition', async () => {
    // Draft lease for tenant 2 in 2029
    const draft3 = await createCompanyDraftLease('2029-01-01', '2029-12-31', 1300000, secondTenantUser.id);

    // Fire concurrent attempts:
    // 1x Owner Approval
    // 2x Unauthorized Company Activations
    // 2x Unauthorized Tenant Acceptances (before approval)
    const promises = [
      postJson(`/leases/${draft3.id}/activate`, tokenCompanyAdmin, {}),
      postJson(`/tenant/lease/${draft3.id}/accept`, tokenTenant1, {}),
      postJson(`/owner/leases/${draft3.id}/approve`, tokenOwnerA, { notes: 'Approved in concurrency test' }),
      postJson(`/leases/${draft3.id}/activate`, tokenCompanyAccountant, {}),
      postJson(`/tenant/lease/${draft3.id}/accept`, tokenTenant1, {}),
    ];

    const results = await Promise.allSettled(promises);

    // The owner approval attempt must succeed (status 200)
    const ownerResult = results[2];
    assert.strictEqual(ownerResult.status, 'fulfilled');
    assert.strictEqual((ownerResult as any).value.status, 200);

    // Verify lease reached PENDING_SIGNATURE or ACTIVE cleanly, never corrupted
    const [finalLease] = await db.select().from(leases).where(eq(leases.id, draft3.id)).limit(1);
    assert.ok(
      finalLease.status === 'PENDING_SIGNATURE' || finalLease.status === 'ACTIVE',
      `Lease reached safe status: ${finalLease.status}`
    );

    // If final status is PENDING_SIGNATURE, verify exactly 0 schedules were generated prematurely
    if (finalLease.status === 'PENDING_SIGNATURE') {
      const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, draft3.id));
      assert.strictEqual(schedules.length, 0, 'Zero schedules while still in PENDING_SIGNATURE');
    }
  });

  // Cleanup HTTP server
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});
