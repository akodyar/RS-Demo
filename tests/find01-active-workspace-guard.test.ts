import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  units,
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword, verifyAuthToken, signAuthToken } from '../src/server/utils/auth.js';

let passed = 0;
let failed = 0;

function check(testId: string, description: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`, details ? `— Details: ${JSON.stringify(details)}` : '');
    failed++;
  }
}

async function runFind01Suite() {
  console.log('================================================================');
  console.log('  HOMEHUB — FIND-01 ACTIVE WORKSPACE ROUTE GUARD REGRESSION SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now();
  const testPassword = 'PasswordForFind01Test123!';
  const passwordHash = await hashPassword(testPassword);

  const cleanups: Array<() => Promise<void>> = [];

  try {
    // -------------------------------------------------------------------------
    // FIXTURES SETUP
    // -------------------------------------------------------------------------
    // 1. Dual-role user (OWNER + TENANT)
    const [dualUser] = await db.insert(users).values({
      email: `find01_dual_${runId}@homehub.iq`,
      firstName: 'Dual',
      lastName: 'User',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, dualUser.id));
    });

    // 2. Tenant-only user
    const [tenantOnlyUser] = await db.insert(users).values({
      email: `find01_tenant_${runId}@homehub.iq`,
      firstName: 'Tenant',
      lastName: 'Only',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, tenantOnlyUser.id));
    });

    // 3. Owner-only user
    const [ownerOnlyUser] = await db.insert(users).values({
      email: `find01_owner_${runId}@homehub.iq`,
      firstName: 'Owner',
      lastName: 'Only',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, ownerOnlyUser.id));
    });

    // 4. Victim owner and victim property
    const [victimOwner] = await db.insert(users).values({
      email: `find01_victim_${runId}@homehub.iq`,
      firstName: 'Victim',
      lastName: 'Owner',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, victimOwner.id));
    });

    const [victimProperty] = await db.insert(properties).values({
      name: `Victim Property ${runId}`,
      address: 'Erbil 100m Road',
      city: 'Erbil',
      type: 'RESIDENTIAL_APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();
    cleanups.push(async () => {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, victimProperty.id));
      await db.delete(properties).where(eq(properties.id, victimProperty.id));
    });

    await db.insert(ownershipRecords).values({
      propertyId: victimProperty.id,
      ownerId: victimOwner.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    // 5. Dual user's owned property
    const [dualOwnedProperty] = await db.insert(properties).values({
      name: `Dual User Owned Property ${runId}`,
      address: 'Sulaymaniyah Salim St',
      city: 'Sulaymaniyah',
      type: 'RESIDENTIAL_APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();
    cleanups.push(async () => {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, dualOwnedProperty.id));
      await db.delete(properties).where(eq(properties.id, dualOwnedProperty.id));
    });

    await db.insert(ownershipRecords).values({
      propertyId: dualOwnedProperty.id,
      ownerId: dualUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    // 6. Dual user's leased property and active lease (for tenant workspace)
    const [leasedProperty] = await db.insert(properties).values({
      name: `Leased Property ${runId}`,
      address: 'Duhok Center',
      city: 'Duhok',
      type: 'RESIDENTIAL_APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();

    const [leasedUnit] = await db.insert(units).values({
      propertyId: leasedProperty.id,
      unitNumber: `U-${runId}`,
      floor: 1,
      status: 'OCCUPIED',
    }).returning();

    const [activeLease] = await db.insert(leases).values({
      propertyId: leasedProperty.id,
      unitId: leasedUnit.id,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: '500000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: activeLease.id,
      tenantId: dualUser.id,
      isPrimary: true,
    });

    // Also attach tenantOnlyUser to a separate active lease
    const [tenantOnlyLease] = await db.insert(leases).values({
      propertyId: leasedProperty.id,
      unitId: leasedUnit.id,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: '450000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: tenantOnlyLease.id,
      tenantId: tenantOnlyUser.id,
      isPrimary: true,
    });

    cleanups.push(async () => {
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, activeLease.id));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, tenantOnlyLease.id));
      await db.delete(leases).where(eq(leases.propertyId, leasedProperty.id));
      await db.delete(units).where(eq(units.propertyId, leasedProperty.id));
      await db.delete(properties).where(eq(properties.id, leasedProperty.id));
    });

    // 7. Company Organization & Member
    const [companyOrg] = await db.insert(organizations).values({
      name: `Kurdistan Property Management ${runId}`,
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    }).returning();

    const [companyUser] = await db.insert(users).values({
      email: `find01_company_member_${runId}@homehub.iq`,
      firstName: 'Company',
      lastName: 'Manager',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    await db.insert(organizationMembers).values({
      organizationId: companyOrg.id,
      userId: companyUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    });

    // Managed property for company
    const [managedProperty] = await db.insert(properties).values({
      name: `Company Managed Property ${runId}`,
      address: 'Erbil Dream City',
      city: 'Erbil',
      type: 'RESIDENTIAL_VILLA',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: managedProperty.id,
      ownerId: victimOwner.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    await db.insert(managementAgreements).values({
      propertyId: managedProperty.id,
      companyId: companyOrg.id,
      ownerId: victimOwner.id,
      startDate: '2026-01-01',
      endDate: '2028-01-01',
      status: 'ACTIVE',
      grantedPermissions: ['VIEW_PROPERTY', 'MANAGE_LEASES', 'COLLECT_RENT', 'VIEW_FINANCES'],
    });

    cleanups.push(async () => {
      await db.delete(managementAgreements).where(eq(managementAgreements.companyId, companyOrg.id));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, managedProperty.id));
      await db.delete(properties).where(eq(properties.id, managedProperty.id));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, companyOrg.id));
      await db.delete(organizations).where(eq(organizations.id, companyOrg.id));
      await db.delete(users).where(eq(users.id, companyUser.id));
    });

    // =========================================================================
    // SCENARIO 1 & 2: DUAL USER IN TENANT WORKSPACE
    // =========================================================================
    console.log('\n--- SCENARIOS 1 & 2: DUAL USER IN TENANT WORKSPACE ---');

    // Login dual user
    const loginDualRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: dualUser.email, password: testPassword }),
    });
    const loginDualData = await loginDualRes.json();
    const neutralDualToken = loginDualData.token;

    // Select TENANT workspace
    const selectTenantRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${neutralDualToken}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });
    const selectTenantData = await selectTenantRes.json();
    const dualTenantToken = selectTenantData.token;

    // Scenario 1: Dual user with active TENANT workspace cannot call owner-only endpoints
    const ownerPropsWithTenantTokenRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${dualTenantToken}` },
    });
    const ownerPropsWithTenantData = await ownerPropsWithTenantTokenRes.json();

    check(
      'FIND01-SCENARIO-1A',
      'Dual user with active TENANT workspace cannot call GET /api/owner/properties (403 Forbidden)',
      ownerPropsWithTenantTokenRes.status === 403 &&
      ownerPropsWithTenantData.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT' &&
      ownerPropsWithTenantData.code === 'WORKSPACE_CONTEXT_REQUIRED',
      { status: ownerPropsWithTenantTokenRes.status, body: ownerPropsWithTenantData }
    );

    const ownerDashboardWithTenantTokenRes = await fetch(`${baseUrl}/owner/dashboard`, {
      headers: { Authorization: `Bearer ${dualTenantToken}` },
    });
    const ownerDashboardWithTenantData = await ownerDashboardWithTenantTokenRes.json();

    check(
      'FIND01-SCENARIO-1B',
      'Dual user with active TENANT workspace cannot call GET /api/owner/dashboard (403 Forbidden)',
      ownerDashboardWithTenantTokenRes.status === 403 &&
      ownerDashboardWithTenantData.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: ownerDashboardWithTenantTokenRes.status, body: ownerDashboardWithTenantData }
    );

    // Scenario 2: Same user can access valid tenant endpoints when active workspace is TENANT
    const tenantDashboardRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${dualTenantToken}` },
    });
    const tenantDashboardData = await tenantDashboardRes.json();

    check(
      'FIND01-SCENARIO-2',
      'Dual user with active TENANT workspace successfully accesses GET /api/tenant/dashboard (200 OK)',
      tenantDashboardRes.status === 200 && (tenantDashboardData.currentProperty !== undefined || tenantDashboardData.user !== undefined),
      { status: tenantDashboardRes.status }
    );

    // =========================================================================
    // SCENARIO 3: SWITCH TO OWNER WORKSPACE
    // =========================================================================
    console.log('\n--- SCENARIO 3: SWITCH TO OWNER WORKSPACE ---');

    // Select OWNER workspace
    const selectOwnerRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dualTenantToken}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });
    const selectOwnerData = await selectOwnerRes.json();
    const dualOwnerToken = selectOwnerData.token;

    // Access authorized owner endpoint
    const ownerPropsWithOwnerTokenRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${dualOwnerToken}` },
    });
    const ownerPropsWithOwnerData = await ownerPropsWithOwnerTokenRes.json();

    check(
      'FIND01-SCENARIO-3A',
      'After selecting owner workspace, user can access GET /api/owner/properties (200 OK)',
      ownerPropsWithOwnerTokenRes.status === 200 && Array.isArray(ownerPropsWithOwnerData),
      { status: ownerPropsWithOwnerTokenRes.status }
    );

    // Under owner workspace, tenant endpoint is now rejected
    const tenantEndpointWithOwnerTokenRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${dualOwnerToken}` },
    });
    const tenantEndpointWithOwnerData = await tenantEndpointWithOwnerTokenRes.json();

    check(
      'FIND01-SCENARIO-3B',
      'After switching to owner workspace, tenant endpoint is denied with 403 INCORRECT_ACTIVE_ROLE_CONTEXT',
      tenantEndpointWithOwnerTokenRes.status === 403 &&
      tenantEndpointWithOwnerData.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: tenantEndpointWithOwnerTokenRes.status, body: tenantEndpointWithOwnerData }
    );

    // =========================================================================
    // SCENARIOS 4 & 5: SINGLE-ROLE USERS CANNOT CROSS WORKSPACE BOUNDARIES
    // =========================================================================
    console.log('\n--- SCENARIOS 4 & 5: SINGLE-ROLE ISOLATION ---');

    // 4. Tenant-only user login
    const loginTenantOnlyRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: tenantOnlyUser.email, password: testPassword }),
    });
    const loginTenantOnlyData = await loginTenantOnlyRes.json();
    const tenantOnlyToken = loginTenantOnlyData.token;

    const tenantOnlyToOwnerRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${tenantOnlyToken}` },
    });
    const tenantOnlyToOwnerData = await tenantOnlyToOwnerRes.json();

    check(
      'FIND01-SCENARIO-4',
      'Tenant-only user cannot access GET /api/owner/properties (403 INCORRECT_ACTIVE_ROLE_CONTEXT)',
      tenantOnlyToOwnerRes.status === 403 && tenantOnlyToOwnerData.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: tenantOnlyToOwnerRes.status, body: tenantOnlyToOwnerData }
    );

    // 5. Owner-only user login
    const loginOwnerOnlyRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ownerOnlyUser.email, password: testPassword }),
    });
    const loginOwnerOnlyData = await loginOwnerOnlyRes.json();
    const ownerOnlyToken = loginOwnerOnlyData.token;

    const ownerOnlyToTenantRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${ownerOnlyToken}` },
    });
    const ownerOnlyToTenantData = await ownerOnlyToTenantRes.json();

    check(
      'FIND01-SCENARIO-5',
      'Owner-only user cannot access GET /api/tenant/dashboard (403 INCORRECT_ACTIVE_ROLE_CONTEXT)',
      ownerOnlyToTenantRes.status === 403 && ownerOnlyToTenantData.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: ownerOnlyToTenantRes.status, body: ownerOnlyToTenantData }
    );

    // =========================================================================
    // SCENARIO 6: COMPANY WORKSPACE RETENTION
    // =========================================================================
    console.log('\n--- SCENARIO 6: COMPANY WORKSPACE ACCESS ---');

    const loginCompanyRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: companyUser.email, password: testPassword }),
    });
    const loginCompanyData = await loginCompanyRes.json();
    const companyToken = loginCompanyData.token;

    // Company member accesses owner domain
    const companyToOwnerRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    const companyToOwnerData = await companyToOwnerRes.json();

    check(
      'FIND01-SCENARIO-6',
      'Company user in active company workspace retains legitimate access to owner properties (200 OK)',
      companyToOwnerRes.status === 200 && Array.isArray(companyToOwnerData),
      { status: companyToOwnerRes.status }
    );

    // =========================================================================
    // SCENARIO 7: FORGED OR MISSING ACTIVE WORKSPACE CLAIMS FAIL CLOSED
    // =========================================================================
    console.log('\n--- SCENARIO 7: FORGED & MISSING ACTIVE WORKSPACE CLAIMS ---');

    // 7A: Missing activeRole claim (neutral multi-role login token)
    const neutralToOwnerRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${neutralDualToken}` },
    });
    const neutralToOwnerData = await neutralToOwnerRes.json();

    check(
      'FIND01-SCENARIO-7A',
      'Neutral multi-role token without activeRole fails closed on /api/owner/properties (403 WORKSPACE_CONTEXT_REQUIRED)',
      neutralToOwnerRes.status === 403 && neutralToOwnerData.code === 'WORKSPACE_CONTEXT_REQUIRED',
      { status: neutralToOwnerRes.status, body: neutralToOwnerData }
    );

    const neutralToTenantRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: `Bearer ${neutralDualToken}` },
    });
    const neutralToTenantData = await neutralToTenantRes.json();

    check(
      'FIND01-SCENARIO-7B',
      'Neutral multi-role token without activeRole fails closed on /api/tenant/dashboard (403 WORKSPACE_CONTEXT_REQUIRED)',
      neutralToTenantRes.status === 403 && neutralToTenantData.code === 'WORKSPACE_CONTEXT_REQUIRED',
      { status: neutralToTenantRes.status, body: neutralToTenantData }
    );

    // 7C: Forged activeRole claim: tenant-only user presents token with signed activeRole: 'PROPERTY_OWNER'
    const forgedOwnerClaimToken = signAuthToken({
      id: tenantOnlyUser.id,
      email: tenantOnlyUser.email,
      roles: ['TENANT'], // Note: DB user has only TENANT
      activeRole: 'PROPERTY_OWNER', // Spoofed activeRole claim!
      workspaceId: 'owner_personal',
      tokenVersion: 1,
    });

    const forgedRes = await fetch(`${baseUrl}/owner/properties`, {
      headers: { Authorization: `Bearer ${forgedOwnerClaimToken}` },
    });
    const forgedData = await forgedRes.json();

    check(
      'FIND01-SCENARIO-7C',
      'Forged activeRole claim inconsistent with user DB roles is rejected with 403 FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      forgedRes.status === 403 && forgedData.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH' && forgedData.code === 'ACTIVE_ROLE_MISMATCH',
      { status: forgedRes.status, body: forgedData }
    );

    // 7D: Request body / header injection cannot bypass activeRole
    const bodyInjectionRes = await fetch(`${baseUrl}/owner/properties`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${dualTenantToken}`,
        'X-Active-Role': 'PROPERTY_OWNER',
        'X-Workspace-Id': 'owner_personal',
      },
    });
    const bodyInjectionData = await bodyInjectionRes.json();

    check(
      'FIND01-SCENARIO-7D',
      'Header or parameter injection cannot override JWT active workspace context (403 Forbidden)',
      bodyInjectionRes.status === 403 && bodyInjectionData.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: bodyInjectionRes.status, body: bodyInjectionData }
    );

    // =========================================================================
    // SCENARIO 8: RESOURCE-LEVEL AUTHORIZATION PRESERVATION
    // =========================================================================
    console.log('\n--- SCENARIO 8: RESOURCE-LEVEL AUTHORIZATION PRESERVATION ---');

    // 8A: Dual user with valid OWNER workspace cannot access victim's property
    const victimPropAccessRes = await fetch(`${baseUrl}/owner/properties/${victimProperty.id}`, {
      headers: { Authorization: `Bearer ${dualOwnerToken}` },
    });
    const victimPropAccessData = await victimPropAccessRes.json();

    check(
      'FIND01-SCENARIO-8A',
      'Owner cannot access another user property (Resource-level IDOR blocked with 403/404)',
      victimPropAccessRes.status === 403 || victimPropAccessRes.status === 404,
      { status: victimPropAccessRes.status, body: victimPropAccessData }
    );

    // 8B: Dual user with valid OWNER workspace can access their own property
    const ownPropAccessRes = await fetch(`${baseUrl}/owner/properties/${dualOwnedProperty.id}`, {
      headers: { Authorization: `Bearer ${dualOwnerToken}` },
    });
    const ownPropAccessData = await ownPropAccessRes.json();

    check(
      'FIND01-SCENARIO-8B',
      'Owner can access their own verified property (Resource-level authorization allowed with 200 OK)',
      ownPropAccessRes.status === 200 && ownPropAccessData.property?.id === dualOwnedProperty.id,
      { status: ownPropAccessRes.status }
    );

  } finally {
    // Teardown
    console.log('\n--- CLEANING FIXTURES ---');
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.warn('Cleanup warning:', err);
      }
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  FIND-01 REGRESSION SUITE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFind01Suite().catch((err) => {
  console.error('FIND-01 Suite Unhandled Error:', err);
  process.exit(1);
});
