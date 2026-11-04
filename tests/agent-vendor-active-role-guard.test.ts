import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  agentProfiles,
  vendorProfiles,
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';

let passed = 0;
let failed = 0;
const results: Array<{ id: string; desc: string; pass: boolean; details?: any }> = [];

function check(testId: string, description: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
    results.push({ id: testId, desc: description, pass: true });
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`, details ? `— Details: ${JSON.stringify(details)}` : '');
    failed++;
    results.push({ id: testId, desc: description, pass: false, details });
  }
}

async function runActiveRoleGuardSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — MULTI-ROLE ACTIVE WORKSPACE GUARD REGRESSION SUITE');
  console.log('  Testing Agent, Vendor, and Company Domain Active Context Guards');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now();
  const testPassword = 'PasswordForActiveGuardTest123!';
  const passwordHash = await hashPassword(testPassword);

  const cleanups: Array<() => Promise<void>> = [];

  try {
    // -------------------------------------------------------------------------
    // FIXTURES SETUP
    // -------------------------------------------------------------------------
    // 1. Dual Agent + Tenant User
    const [dualAgentUser] = await db.insert(users).values({
      email: `act_guard_dual_agent_${runId}@homehub.iq`,
      firstName: 'Agent',
      lastName: 'Dual',
      passwordHash,
      roles: ['TENANT', 'AGENT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, dualAgentUser.id));
      await db.delete(users).where(eq(users.id, dualAgentUser.id));
    });

    const [dualAgentProfile] = await db.insert(agentProfiles).values({
      userId: dualAgentUser.id,
      displayName: 'Dual Agent Profile',
      status: 'ACTIVE',
    }).returning();

    // 2. Dual Vendor + Tenant User
    const [dualVendorUser] = await db.insert(users).values({
      email: `act_guard_dual_vendor_${runId}@homehub.iq`,
      firstName: 'Vendor',
      lastName: 'Dual',
      passwordHash,
      roles: ['TENANT', 'VENDOR'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, dualVendorUser.id));
      await db.delete(users).where(eq(users.id, dualVendorUser.id));
    });

    const [dualVendorProfile] = await db.insert(vendorProfiles).values({
      userId: dualVendorUser.id,
      businessName: 'Dual Vendor Maintenance',
      status: 'ACTIVE',
      verificationStatus: 'APPROVED',
    }).returning();

    // 3. Dual Company Member + Tenant User
    const [companyOrg] = await db.insert(organizations).values({
      name: `ActiveGuard Org ${runId}`,
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, companyOrg.id));
      await db.delete(organizations).where(eq(organizations.id, companyOrg.id));
    });

    const [dualCompanyUser] = await db.insert(users).values({
      email: `act_guard_dual_co_${runId}@homehub.iq`,
      firstName: 'Company',
      lastName: 'Dual',
      passwordHash,
      roles: ['TENANT', 'COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, dualCompanyUser.id));
      await db.delete(users).where(eq(users.id, dualCompanyUser.id));
    });

    await db.insert(organizationMembers).values({
      userId: dualCompanyUser.id,
      organizationId: companyOrg.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    });

    // 4. Company Viewer User (for containment check)
    const [companyViewerUser] = await db.insert(users).values({
      email: `act_guard_viewer_${runId}@homehub.iq`,
      firstName: 'Company',
      lastName: 'Viewer',
      passwordHash,
      roles: ['COMPANY_MEMBER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, companyViewerUser.id));
      await db.delete(users).where(eq(users.id, companyViewerUser.id));
    });

    await db.insert(organizationMembers).values({
      userId: companyViewerUser.id,
      organizationId: companyOrg.id,
      role: 'VIEWER',
      status: 'ACTIVE',
    });

    // 5. Tenant-Only User
    const [tenantOnlyUser] = await db.insert(users).values({
      email: `act_guard_tenant_${runId}@homehub.iq`,
      firstName: 'Tenant',
      lastName: 'Only',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, tenantOnlyUser.id));
      await db.delete(organizations).where(eq(organizations.name, `Test Onboarding Co ${runId}`));
      await db.delete(users).where(eq(users.id, tenantOnlyUser.id));
    });

    // 6. Platform Admin User
    const [adminUser] = await db.insert(users).values({
      email: `act_guard_admin_${runId}@homehub.iq`,
      firstName: 'Platform',
      lastName: 'Admin',
      passwordHash,
      roles: ['PLATFORM_ADMIN'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, adminUser.id));
    });

    // =========================================================================
    // BLOCK 1: AGENT DOMAIN ACTIVE WORKSPACE ROUTE GUARD
    // =========================================================================
    console.log('\n--- BLOCK 1: AGENT DOMAIN ACTIVE WORKSPACE GUARD ---');

    // AG-ACT-01: Active TENANT token calling /api/agent/dashboard must be rejected
    const agentInTenantToken = signAuthToken({
      id: dualAgentUser.id,
      email: dualAgentUser.email,
      roles: ['TENANT', 'AGENT'],
      activeRole: 'TENANT',
      workspaceId: 'tenant',
      tokenVersion: 1,
    });

    const ag01Res = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { Authorization: `Bearer ${agentInTenantToken}` },
    });
    const ag01Data = await ag01Res.json();
    check(
      'AG-ACT-01',
      'Dual Agent+Tenant user with active TENANT workspace calling /api/agent/dashboard is rejected with 403 INCORRECT_ACTIVE_ROLE_CONTEXT',
      ag01Res.status === 403 && ag01Data.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: ag01Res.status, body: ag01Data }
    );

    // AG-ACT-02: Neutral token calling /api/agent/dashboard must be rejected
    const agentNeutralToken = signAuthToken({
      id: dualAgentUser.id,
      email: dualAgentUser.email,
      roles: ['TENANT', 'AGENT'],
      activeRole: null,
      workspaceId: null,
      tokenVersion: 1,
    });

    const ag02Res = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { Authorization: `Bearer ${agentNeutralToken}` },
    });
    const ag02Data = await ag02Res.json();
    check(
      'AG-ACT-02',
      'Neutral multi-role token calling /api/agent/dashboard is rejected with 403 WORKSPACE_CONTEXT_REQUIRED',
      ag02Res.status === 403 && ag02Data.code === 'WORKSPACE_CONTEXT_REQUIRED',
      { status: ag02Res.status, body: ag02Data }
    );

    // AG-ACT-03: User without Agent role calling /api/agent/dashboard
    const nonAgentToken = signAuthToken({
      id: tenantOnlyUser.id,
      email: tenantOnlyUser.email,
      roles: ['TENANT'],
      activeRole: 'TENANT',
      workspaceId: 'tenant',
      tokenVersion: 1,
    });

    const ag03Res = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { Authorization: `Bearer ${nonAgentToken}` },
    });
    check(
      'AG-ACT-03',
      'Tenant-only user calling /api/agent/dashboard is rejected with 403',
      ag03Res.status === 403,
      { status: ag03Res.status }
    );

    // AG-ACT-04: Forged Agent activeRole on user without Agent in roles
    const forgedAgentToken = signAuthToken({
      id: tenantOnlyUser.id,
      email: tenantOnlyUser.email,
      roles: ['TENANT'],
      activeRole: 'AGENT_BROKER',
      workspaceId: 'agent',
      tokenVersion: 1,
    });

    const ag04Res = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { Authorization: `Bearer ${forgedAgentToken}` },
    });
    const ag04Data = await ag04Res.json();
    check(
      'AG-ACT-04',
      'Forged activeRole=AGENT_BROKER on user without Agent role is rejected with 403 FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      ag04Res.status === 403 && ag04Data.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: ag04Res.status, body: ag04Data }
    );

    // AG-ACT-05: Authorized Agent with active AGENT_BROKER workspace passes (200 OK)
    const validAgentToken = signAuthToken({
      id: dualAgentUser.id,
      email: dualAgentUser.email,
      roles: ['TENANT', 'AGENT'],
      activeRole: 'AGENT_BROKER',
      workspaceId: 'agent',
      tokenVersion: 1,
    });

    const ag05Res = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { Authorization: `Bearer ${validAgentToken}` },
    });
    const ag05Data = await ag05Res.json();
    check(
      'AG-ACT-05',
      'Authorized Agent with active AGENT_BROKER workspace successfully reaches /api/agent/dashboard (200 OK)',
      ag05Res.status === 200 && ag05Data.kpi !== undefined,
      { status: ag05Res.status, body: ag05Data }
    );

    // AG-ACT-06: Platform Admin emergency bypass allows /api/agent/dashboard
    const adminAgentToken = signAuthToken({
      id: adminUser.id,
      email: adminUser.email,
      roles: ['PLATFORM_ADMIN'],
      activeRole: 'PLATFORM_ADMIN',
      tokenVersion: 1,
    });

    const ag06Res = await fetch(`${baseUrl}/agent/dashboard`, {
      headers: { Authorization: `Bearer ${adminAgentToken}` },
    });
    check(
      'AG-ACT-06',
      'Platform Admin retains documented emergency oversight into Agent domain (200 OK)',
      ag06Res.status === 200,
      { status: ag06Res.status }
    );

    // =========================================================================
    // BLOCK 2: VENDOR DOMAIN ACTIVE WORKSPACE ROUTE GUARD
    // =========================================================================
    console.log('\n--- BLOCK 2: VENDOR DOMAIN ACTIVE WORKSPACE GUARD ---');

    // VN-ACT-01: Active TENANT token calling /api/vendor/work-orders must be rejected
    const vendorInTenantToken = signAuthToken({
      id: dualVendorUser.id,
      email: dualVendorUser.email,
      roles: ['TENANT', 'VENDOR'],
      activeRole: 'TENANT',
      workspaceId: 'tenant',
      tokenVersion: 1,
    });

    const vn01Res = await fetch(`${baseUrl}/vendor/work-orders`, {
      headers: { Authorization: `Bearer ${vendorInTenantToken}` },
    });
    const vn01Data = await vn01Res.json();
    check(
      'VN-ACT-01',
      'Dual Vendor+Tenant user with active TENANT workspace calling /api/vendor/work-orders is rejected with 403 INCORRECT_ACTIVE_ROLE_CONTEXT',
      vn01Res.status === 403 && vn01Data.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: vn01Res.status, body: vn01Data }
    );

    // VN-ACT-02: Neutral token calling /api/vendor/work-orders must be rejected
    const vendorNeutralToken = signAuthToken({
      id: dualVendorUser.id,
      email: dualVendorUser.email,
      roles: ['TENANT', 'VENDOR'],
      activeRole: null,
      workspaceId: null,
      tokenVersion: 1,
    });

    const vn02Res = await fetch(`${baseUrl}/vendor/work-orders`, {
      headers: { Authorization: `Bearer ${vendorNeutralToken}` },
    });
    const vn02Data = await vn02Res.json();
    check(
      'VN-ACT-02',
      'Neutral multi-role token calling /api/vendor/work-orders is rejected with 403 WORKSPACE_CONTEXT_REQUIRED',
      vn02Res.status === 403 && vn02Data.code === 'WORKSPACE_CONTEXT_REQUIRED',
      { status: vn02Res.status, body: vn02Data }
    );

    // VN-ACT-03: User without Vendor role calling /api/vendor/work-orders
    const vn03Res = await fetch(`${baseUrl}/vendor/work-orders`, {
      headers: { Authorization: `Bearer ${nonAgentToken}` },
    });
    check(
      'VN-ACT-03',
      'Tenant-only user calling /api/vendor/work-orders is rejected with 403',
      vn03Res.status === 403,
      { status: vn03Res.status }
    );

    // VN-ACT-04: Forged Vendor activeRole on user without Vendor role
    const forgedVendorToken = signAuthToken({
      id: tenantOnlyUser.id,
      email: tenantOnlyUser.email,
      roles: ['TENANT'],
      activeRole: 'VENDOR',
      workspaceId: 'vendor',
      tokenVersion: 1,
    });

    const vn04Res = await fetch(`${baseUrl}/vendor/work-orders`, {
      headers: { Authorization: `Bearer ${forgedVendorToken}` },
    });
    const vn04Data = await vn04Res.json();
    check(
      'VN-ACT-04',
      'Forged activeRole=VENDOR on user without Vendor role is rejected with 403 FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      vn04Res.status === 403 && vn04Data.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: vn04Res.status, body: vn04Data }
    );

    // VN-ACT-05: Authorized Vendor with active VENDOR workspace passes (200 OK)
    const validVendorToken = signAuthToken({
      id: dualVendorUser.id,
      email: dualVendorUser.email,
      roles: ['TENANT', 'VENDOR'],
      activeRole: 'VENDOR',
      workspaceId: 'vendor',
      tokenVersion: 1,
    });

    const vn05Res = await fetch(`${baseUrl}/vendor/work-orders`, {
      headers: { Authorization: `Bearer ${validVendorToken}` },
    });
    check(
      'VN-ACT-05',
      'Authorized Vendor with active VENDOR workspace successfully reaches /api/vendor/work-orders (200 OK)',
      vn05Res.status === 200,
      { status: vn05Res.status }
    );

    // VN-ACT-06: Platform Admin emergency bypass allows /api/vendor/work-orders
    const vn06Res = await fetch(`${baseUrl}/vendor/work-orders`, {
      headers: { Authorization: `Bearer ${adminAgentToken}` },
    });
    check(
      'VN-ACT-06',
      'Platform Admin retains documented emergency oversight into Vendor domain (200 OK)',
      vn06Res.status === 200,
      { status: vn06Res.status }
    );

    // =========================================================================
    // BLOCK 3: COMPANY DOMAIN ACTIVE WORKSPACE ROUTE GUARD
    // =========================================================================
    console.log('\n--- BLOCK 3: COMPANY DOMAIN ACTIVE WORKSPACE GUARD ---');

    // CO-ACT-01: Active TENANT token calling /api/company/dashboard must be rejected
    const companyInTenantToken = signAuthToken({
      id: dualCompanyUser.id,
      email: dualCompanyUser.email,
      roles: ['TENANT', 'COMPANY_MEMBER'],
      activeRole: 'TENANT',
      workspaceId: 'tenant',
      tokenVersion: 1,
    });

    const co01Res = await fetch(`${baseUrl}/company/dashboard`, {
      headers: { Authorization: `Bearer ${companyInTenantToken}` },
    });
    const co01Data = await co01Res.json();
    check(
      'CO-ACT-01',
      'Dual Company+Tenant user with active TENANT workspace calling /api/company/dashboard is rejected with 403 INCORRECT_ACTIVE_ROLE_CONTEXT',
      co01Res.status === 403 && co01Data.error === 'INCORRECT_ACTIVE_ROLE_CONTEXT',
      { status: co01Res.status, body: co01Data }
    );

    // CO-ACT-02: Neutral token calling /api/company/dashboard must be rejected
    const companyNeutralToken = signAuthToken({
      id: dualCompanyUser.id,
      email: dualCompanyUser.email,
      roles: ['TENANT', 'COMPANY_MEMBER'],
      activeRole: null,
      workspaceId: null,
      tokenVersion: 1,
    });

    const co02Res = await fetch(`${baseUrl}/company/dashboard`, {
      headers: { Authorization: `Bearer ${companyNeutralToken}` },
    });
    const co02Data = await co02Res.json();
    check(
      'CO-ACT-02',
      'Neutral multi-role token calling /api/company/dashboard is rejected with 403 WORKSPACE_CONTEXT_REQUIRED',
      co02Res.status === 403 && co02Data.code === 'WORKSPACE_CONTEXT_REQUIRED',
      { status: co02Res.status, body: co02Data }
    );

    // CO-ACT-03: Authorized Company Admin with active company workspace reaches /api/company/dashboard
    const validCompanyToken = signAuthToken({
      id: dualCompanyUser.id,
      email: dualCompanyUser.email,
      roles: ['TENANT', 'COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${companyOrg.id}`,
      organizationId: companyOrg.id,
      tokenVersion: 1,
    });

    const co03Res = await fetch(`${baseUrl}/company/dashboard`, {
      headers: { Authorization: `Bearer ${validCompanyToken}` },
    });
    const co03Data = await co03Res.json();
    check(
      'CO-ACT-03',
      'Authorized Company Admin with matching active company workspace reaches /api/company/dashboard (200 OK)',
      co03Res.status === 200 && co03Data.company !== undefined,
      { status: co03Res.status, body: co03Data }
    );

    // CO-ACT-04: VIEWER asserting COMPANY_ADMIN activeRole is rejected (role containment)
    const escalatedViewerToken = signAuthToken({
      id: companyViewerUser.id,
      email: companyViewerUser.email,
      roles: ['COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${companyOrg.id}`,
      organizationId: companyOrg.id,
      tokenVersion: 1,
    });

    const co04Res = await fetch(`${baseUrl}/company/dashboard`, {
      headers: { Authorization: `Bearer ${escalatedViewerToken}` },
    });
    const co04Data = await co04Res.json();
    check(
      'CO-ACT-04',
      'Assigned VIEWER attempting to assert COMPANY_ADMIN activeRole on /api/company/dashboard is rejected with 403 FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      co04Res.status === 403 && co04Data.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: co04Res.status, body: co04Data }
    );

    // CO-ACT-05: Mismatched workspaceId and organizationId is rejected
    const mismatchedCompanyToken = signAuthToken({
      id: dualCompanyUser.id,
      email: dualCompanyUser.email,
      roles: ['TENANT', 'COMPANY_MEMBER'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: 'company_00000000-0000-0000-0000-000000000000',
      organizationId: companyOrg.id,
      tokenVersion: 1,
    });

    const co05Res = await fetch(`${baseUrl}/company/dashboard`, {
      headers: { Authorization: `Bearer ${mismatchedCompanyToken}` },
    });
    const co05Data = await co05Res.json();
    check(
      'CO-ACT-05',
      'Mismatched workspaceId and organizationId on /api/company/dashboard is rejected with 403 FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      co05Res.status === 403 && co05Data.error === 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
      { status: co05Res.status, body: co05Data }
    );

    // CO-ACT-06: Platform Admin emergency bypass allows /api/company/profile
    const adminCompanyToken = signAuthToken({
      id: adminUser.id,
      email: adminUser.email,
      roles: ['PLATFORM_ADMIN'],
      activeRole: 'PLATFORM_ADMIN',
      organizationId: companyOrg.id,
      tokenVersion: 1,
    });

    const co06Res = await fetch(`${baseUrl}/company/profile`, {
      headers: { Authorization: `Bearer ${adminCompanyToken}` },
    });
    const co06Data = await co06Res.json();
    check(
      'CO-ACT-06',
      'Platform Admin retains documented emergency oversight into Company domain (200 OK)',
      co06Res.status === 200 && co06Data.id === companyOrg.id,
      { status: co06Res.status, body: co06Data }
    );

    // CO-ACT-07: Company Onboarding exception: Authenticated user without company workspace can call /api/company/onboard
    const co07Res = await fetch(`${baseUrl}/company/onboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nonAgentToken}`, // Tenant token without company workspace
      },
      body: JSON.stringify({
        companyName: `Test Onboarding Co ${runId}`,
      }),
    });
    check(
      'CO-ACT-07',
      'POST /api/company/onboard is accessible to authenticated users without company workspace (Status 201)',
      co07Res.status === 201,
      { status: co07Res.status }
    );

  } finally {
    server.close();
    // Run deterministic cleanup
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.warn('Cleanup warning:', err);
      }
    }
  }

  console.log('\n================================================================');
  console.log(`ACTIVE WORKSPACE GUARD SUITE SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runActiveRoleGuardSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
