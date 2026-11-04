import http from 'node:http';
import express from 'express';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  agentProfiles,
  vendorProfiles,
  properties,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  workOrders,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { hashPassword, verifyAuthToken, signAuthToken } from '../src/server/utils/auth.js';
import { WorkspaceSwitcherModal } from '../src/components/common/WorkspaceSwitcherModal.tsx';
import { AuthProvider, EligibleWorkspace } from '../src/components/AuthProvider.tsx';
import { InfrastructureProvider } from '../src/components/InfrastructureProvider.tsx';
import { I18nProvider } from '../src/i18n/I18nProvider.tsx';

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

function renderModalWithI18n(
  ui: React.ReactElement,
  lang: 'ku' | 'ar' | 'en' = 'ku'
) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <InfrastructureProvider>
        <AuthProvider>
          <I18nProvider initialLanguage={lang}>
            {ui}
          </I18nProvider>
        </AuthProvider>
      </InfrastructureProvider>
    </MemoryRouter>
  );
}

async function runWorkspaceSwitcherEnrollmentSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — WORKSPACE SWITCHER MULTI-ROLE ENROLLMENT TEST SUITE');
  console.log('================================================================\n');

  // =========================================================================
  // SECTION A: UI COMPONENT TESTS
  // =========================================================================
  console.log('--- SECTION A: UI COMPONENT VERIFICATION ---');

  const singleWs: EligibleWorkspace[] = [
    {
      workspaceId: 'tenant',
      role: 'TENANT',
      title: 'کرێنشین',
      titleKey: 'workspace.tenant',
      destination: '/tenant',
      status: 'ACTIVE',
      isCompany: false,
    },
  ];

  // Test UI-1: Single Workspace Kurdish RTL View
  const htmlSingleKu = renderModalWithI18n(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={singleWs}
      activeWorkspace={singleWs[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('UI-01', 'Kurdish workspace switcher enforces dir="rtl"', htmlSingleKu.includes('dir="rtl"'));
  check('UI-02', 'Renders header: شوێنی کارەکەت هەڵبژێرە', htmlSingleKu.includes('شوێنی کارەکەت هەڵبژێرە'));
  check('UI-03', 'Renders active workspace card for Tenant', htmlSingleKu.includes('id="workspace-card-tenant"'));
  check('UI-04', 'Renders prominent + Activate Another Role button (#btn-activate-another-role)', htmlSingleKu.includes('id="btn-activate-another-role"'));
  check('UI-05', 'Renders exact Kurdish button label: + زیادکردنی ڕۆڵێکی نوێ', htmlSingleKu.includes('+ زیادکردنی ڕۆڵێکی نوێ'));
  check('UI-06', 'Renders single-workspace informational notice', htmlSingleKu.includes('id="tenant-no-alternative-workspaces-notice"'));

  // Test UI-2: Arabic RTL View
  const htmlSingleAr = renderModalWithI18n(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={singleWs}
      activeWorkspace={singleWs[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'ar'
  );

  check('UI-07', 'Arabic workspace switcher enforces dir="rtl"', htmlSingleAr.includes('dir="rtl"'));
  check('UI-08', 'Renders Arabic header: اختر مساحة العمل الخاصة بك', htmlSingleAr.includes('اختر مساحة العمل الخاصة بك'));
  check('UI-09', 'Renders Arabic button label: + تفعيل دور إضافي', htmlSingleAr.includes('+ تفعيل دور إضافي'));

  // Test UI-3: English LTR View
  const htmlSingleEn = renderModalWithI18n(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={singleWs}
      activeWorkspace={singleWs[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('UI-10', 'English workspace switcher enforces dir="ltr"', htmlSingleEn.includes('dir="ltr"'));
  check('UI-11', 'Renders English header: Choose your workspace', htmlSingleEn.includes('Choose your workspace'));
  check('UI-12', 'Renders English button label: + Activate Another Role', htmlSingleEn.includes('+ Activate Another Role'));

  // Test UI-4: Multi-Workspace View
  const quadWs: EligibleWorkspace[] = [
    { workspaceId: 'owner_personal', role: 'PROPERTY_OWNER', title: 'Owner', titleKey: 'workspace.owner_personal', destination: '/owner', status: 'ACTIVE' },
    { workspaceId: 'tenant', role: 'TENANT', title: 'Tenant', titleKey: 'workspace.tenant', destination: '/tenant', status: 'ACTIVE' },
    { workspaceId: 'agent', role: 'AGENT_BROKER', title: 'Agent', titleKey: 'workspace.agent', destination: '/agent', status: 'PENDING_VERIFICATION' },
    { workspaceId: 'vendor', role: 'VENDOR', title: 'Vendor', titleKey: 'workspace.vendor', destination: '/vendor', status: 'PENDING_VERIFICATION' },
  ];

  const htmlQuad = renderModalWithI18n(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={quadWs}
      activeWorkspace={quadWs[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('UI-13', 'Multi-workspace does NOT display single-workspace notice', !htmlQuad.includes('id="tenant-no-alternative-workspaces-notice"'));
  check('UI-14', 'Renders all 4 existing workspace cards', 
    htmlQuad.includes('id="workspace-card-owner_personal"') &&
    htmlQuad.includes('id="workspace-card-tenant"') &&
    htmlQuad.includes('id="workspace-card-agent"') &&
    htmlQuad.includes('id="workspace-card-vendor"')
  );

  // =========================================================================
  // SECTION B: BACKEND & DATABASE INTEGRATION TESTS
  // =========================================================================
  console.log('\n--- SECTION B: BACKEND & DATABASE INTEGRATION ---');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now();
  const testPassword = 'SecureEnrollPassword123!';
  const passwordHash = await hashPassword(testPassword);

  const cleanups: Array<() => Promise<void>> = [];

  try {
    // 1. Create a base user with TENANT role
    const testTenantEmail = `enroll_tenant_${runId}@homehub.iq`;
    const [testUser] = await db.insert(users).values({
      email: testTenantEmail,
      firstName: 'Enroll',
      lastName: 'Candidate',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      // Clean up any created vendor, agent, organization records
      await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, testUser.id));
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, testUser.id));
      const orgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, testUser.id));
      for (const m of orgMems) {
        await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
        await db.delete(organizations).where(eq(organizations.id, m.organizationId));
      }
      await db.delete(users).where(eq(users.id, testUser.id));
    });

    // Login as the tenant to obtain authoritative token
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testTenantEmail, password: testPassword }),
    });
    const loginData = await loginRes.json();
    const authToken = loginData.token;

    check('INT-01', 'Initial tenant login succeeds with HTTP 200', loginRes.status === 200);
    check('INT-02', 'Initial user has single TENANT role', loginData.user.roles.length === 1 && loginData.user.roles[0] === 'TENANT');
    check('INT-03', 'Initial user has 1 eligible workspace (tenant)', loginData.eligibleWorkspaces.length === 1);

    // 2. Reject unauthenticated enrollment
    const unauthRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'PROPERTY_OWNER' }),
    });
    check('INT-04', 'Unauthenticated enrollment is rejected with HTTP 401', unauthRes.status === 401);

    // 3. Reject invalid role identifier
    const invalidRoleRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'INVALID_SUPER_ROLE' }),
    });
    check('INT-05', 'Invalid role identifier is rejected with HTTP 400', invalidRoleRes.status === 400);

    // 4. Reject privileged role self-enrollment (PLATFORM_ADMIN, SUPER_ADMIN, ACCOUNTANT, FINANCE_ADMIN, COMPANY_ADMIN)
    const adminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'PLATFORM_ADMIN' }),
    });
    const adminEnrollData = await adminEnrollRes.json();
    check('INT-06', 'PLATFORM_ADMIN self-enrollment is rejected with HTTP 403', adminEnrollRes.status === 403);
    check('INT-07', 'Error code specifies FORBIDDEN_PRIVILEGED_ROLE', adminEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    const accountantEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'ACCOUNTANT' }),
    });
    const accountantEnrollData = await accountantEnrollRes.json();
    check('INT-07A', 'ACCOUNTANT self-enrollment is rejected with HTTP 403', accountantEnrollRes.status === 403);
    check('INT-07B', 'ACCOUNTANT error code specifies FORBIDDEN_PRIVILEGED_ROLE', accountantEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    const financeAdminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'FINANCE_ADMIN' }),
    });
    const financeAdminEnrollData = await financeAdminEnrollRes.json();
    check('INT-07C', 'FINANCE_ADMIN self-enrollment is rejected with HTTP 403', financeAdminEnrollRes.status === 403);
    check('INT-07D', 'FINANCE_ADMIN error code specifies FORBIDDEN_PRIVILEGED_ROLE', financeAdminEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    const companyAdminEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'COMPANY_ADMIN' }),
    });
    const companyAdminEnrollData = await companyAdminEnrollRes.json();
    check('INT-07E', 'COMPANY_ADMIN self-enrollment is rejected with HTTP 403', companyAdminEnrollRes.status === 403);
    check('INT-07F', 'COMPANY_ADMIN error code specifies FORBIDDEN_PRIVILEGED_ROLE', companyAdminEnrollData.error === 'FORBIDDEN_PRIVILEGED_ROLE');

    // 5. Enroll in PROPERTY_OWNER (Individual)
    const enrollOwnerRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'INDIVIDUAL' }),
    });
    const enrollOwnerData = await enrollOwnerRes.json();

    check('INT-08', 'Enrolling in PROPERTY_OWNER succeeds with HTTP 200', enrollOwnerRes.status === 200);
    check('INT-09', 'PostgreSQL users.roles updated to include PROPERTY_OWNER', enrollOwnerData.user.roles.includes('PROPERTY_OWNER') && enrollOwnerData.user.roles.includes('TENANT'));
    check('INT-10', 'Authoritative eligibleWorkspaces returned includes owner_personal and tenant', (() => {
      const ids = enrollOwnerData.eligibleWorkspaces.map((w: any) => w.workspaceId);
      return ids.includes('owner_personal') && ids.includes('tenant');
    })());

    // 6. Idempotent check: repeated enrollment does not duplicate roles array
    const repeatEnrollRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'PROPERTY_OWNER' }),
    });
    const repeatEnrollData = await repeatEnrollRes.json();
    const ownerRoleCount = repeatEnrollData.user.roles.filter((r: string) => r === 'PROPERTY_OWNER').length;
    check('INT-11', 'Repeated enrollment is idempotent (no duplicate roles in array)', ownerRoleCount === 1);

    // 7. Verify no IDOR: client cannot enroll another user by passing user ID
    const spoofUserRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'VENDOR', userId: 'spoofed-target-id' }),
    });
    check('INT-12', 'Spoofed userId in payload is ignored; enrolls authenticated user', spoofUserRes.status === 200);
    const [freshUserRecord] = await db.select().from(users).where(eq(users.id, testUser.id));
    check('INT-13', 'Authenticated user record receives VENDOR role', !!freshUserRecord.roles?.includes('VENDOR'));

    // 8. Verify VENDOR profile created in PENDING verification status
    const [vendorProf] = await db.select().from(vendorProfiles).where(eq(vendorProfiles.userId, testUser.id));
    check('INT-14', 'Vendor profile automatically initialized in PostgreSQL', !!vendorProf);
    check('INT-15', 'Vendor verificationStatus is PENDING', vendorProf?.verificationStatus === 'PENDING');

    // 8B. Validation: Reject invalid entityType
    const invalidEntityTypeRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'INVALID_TYPE' }),
    });
    const invalidEntityTypeData = await invalidEntityTypeRes.json();
    check('INT-15A', 'Reject invalid entityType with HTTP 400', invalidEntityTypeRes.status === 400);
    check('INT-15B', 'Error specifies VALIDATION_ERROR for entityType', invalidEntityTypeData.error === 'VALIDATION_ERROR');

    // 8C. Validation: Reject AGENT_BROKER COMPANY enrollment without company name
    const missingAgentCompanyRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'COMPANY', companyName: '   ' }),
    });
    const missingAgentCompanyData = await missingAgentCompanyRes.json();
    check('INT-15C', 'Reject Agent COMPANY without companyName with HTTP 400', missingAgentCompanyRes.status === 400);
    check('INT-15D', 'Error specifies VALIDATION_ERROR for missing company name', missingAgentCompanyData.error === 'VALIDATION_ERROR');

    // 9. Enroll in AGENT_BROKER as INDIVIDUAL
    const enrollAgentRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'INDIVIDUAL' }),
    });
    check('INT-16', 'Enrolling in AGENT_BROKER (Individual) succeeds with HTTP 200', enrollAgentRes.status === 200);
    const [agentProf] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, testUser.id));
    check('INT-17', 'Agent profile automatically initialized in PENDING_VERIFICATION', agentProf?.status === 'PENDING_VERIFICATION');
    check('INT-17A', 'Individual Agent profile does not have officeName set', agentProf?.officeName === null);

    // 9B. Enroll a separate user in AGENT_BROKER with COMPANY entityType
    const agentCompanyEmail = `agent_company_candidate_${runId}@homehub.iq`;
    const agentCompanyName = `Erbil Prime Agency ${runId}`;
    const [agentCompUser] = await db.insert(users).values({
      email: agentCompanyEmail,
      firstName: 'Agency',
      lastName: 'Leader',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    cleanups.push(async () => {
      await db.delete(agentProfiles).where(eq(agentProfiles.userId, agentCompUser.id));
      const orgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, agentCompUser.id));
      for (const m of orgMems) {
        await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
        await db.delete(organizations).where(eq(organizations.id, m.organizationId));
      }
      await db.delete(users).where(eq(users.id, agentCompUser.id));
    });

    const agentCompLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: agentCompanyEmail, password: testPassword }),
    });
    const agentCompLoginData = await agentCompLoginRes.json();

    const enrollAgentCompRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentCompLoginData.token}`,
      },
      body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'COMPANY', companyName: agentCompanyName }),
    });
    const enrollAgentCompData = await enrollAgentCompRes.json();

    check('INT-17B', 'Enrolling in AGENT_BROKER (Company) succeeds with HTTP 200', enrollAgentCompRes.status === 200);
    check('INT-17C', 'Agent Company user roles include AGENT_BROKER', enrollAgentCompData.user.roles.includes('AGENT_BROKER'));
    
    const [compAgentProf] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentCompUser.id));
    check('INT-17D', 'Agent profile initialized with officeName set to company name', compAgentProf?.officeName === agentCompanyName);
    check('INT-17E', 'Agent profile status is PENDING_VERIFICATION', compAgentProf?.status === 'PENDING_VERIFICATION');

    const agentOrgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, agentCompUser.id));
    check('INT-17F', 'Organization member record created with role COMPANY_ADMIN', agentOrgMems.length === 1 && agentOrgMems[0].role === 'COMPANY_ADMIN');
    
    const [agentOrg] = await db.select().from(organizations).where(eq(organizations.id, agentOrgMems[0].organizationId));
    check('INT-17G', 'Organization created with type AGENT_COMPANY', agentOrg?.type === 'AGENT_COMPANY');
    check('INT-17H', 'Organization created with status PENDING_VERIFICATION', agentOrg?.status === 'PENDING_VERIFICATION');
    check('INT-17I', 'Organization name matches company name', agentOrg?.name === agentCompanyName);

    const agentCompWs = enrollAgentCompData.eligibleWorkspaces.find((w: any) => w.isCompany);
    check('INT-17J', 'Eligible workspaces includes company workspace with isCompany: true', !!agentCompWs);
    check('INT-17K', 'Company workspace organizationName is correct', agentCompWs?.organizationName === agentCompanyName);
    check('INT-17L', 'Company workspace destination is /company', agentCompWs?.destination === '/company');
    check('INT-17M', 'Eligible workspaces also includes agent workspace (/agent)', enrollAgentCompData.eligibleWorkspaces.some((w: any) => w.workspaceId === 'agent'));

    // 10. Enroll in PROPERTY_OWNER with COMPANY entityType
    const companyName = `Test Horizon Estates ${runId}`;
    const enrollCompanyRes = await fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'COMPANY', companyName }),
    });
    const enrollCompanyData = await enrollCompanyRes.json();
    check('INT-18', 'Enrolling in owner COMPANY succeeds with HTTP 200', enrollCompanyRes.status === 200);
    const companyWs = enrollCompanyData.eligibleWorkspaces.find((w: any) => w.isCompany);
    check('INT-19', 'Company workspace is resolved with isCompany: true', !!companyWs);
    check('INT-20', 'Company name is stored correctly', companyWs?.organizationName === companyName);

    // 11. Verify cross-domain boundaries remain intact
    // Tenant has NO active leases or rent schedules fabricated
    const userLeases = await db.select().from(leaseTenants).where(eq(leaseTenants.tenantId, testUser.id));
    check('INT-21', 'Cross-Domain Invariant: Tenant enrollment does NOT fabricate active leases', userLeases.length === 0);

    // Owner has NO properties assigned
    const ownedProps = await db.select().from(ownershipRecords).where(eq(ownershipRecords.ownerId, testUser.id));
    check('INT-22', 'Cross-Domain Invariant: Owner enrollment does NOT assign unrelated properties', ownedProps.length === 0);

    // Agent has NO management agreements
    const agentAgreements = await db.select().from(managementAgreements).where(eq(managementAgreements.ownerId, testUser.id));
    check('INT-23', 'Cross-Domain Invariant: Agent enrollment does NOT create management agreements', agentAgreements.length === 0);

    // Vendor has NO work orders assigned
    const vendorWorkOrders = await db.select().from(workOrders).where(eq(workOrders.vendorId, vendorProf.id));
    check('INT-24', 'Cross-Domain Invariant: Vendor enrollment does NOT expose unrelated work orders', vendorWorkOrders.length === 0);

    // 12. Workspace switching without signout
    // Switch to newly enrolled VENDOR workspace
    const switchRes = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ workspaceId: 'vendor' }),
    });
    const switchData = await switchRes.json();

    check('INT-25', 'Workspace switch returns HTTP 200 without requiring signout', switchRes.status === 200);
    check('INT-26', 'Refreshed token has activeRole: VENDOR', (() => {
      const decoded = verifyAuthToken(switchData.token);
      return decoded.activeRole === 'VENDOR';
    })());
    check('INT-27', 'Active workspace is vendor with destination /vendor', switchData.activeWorkspace?.destination === '/vendor');

    // 13. Subsequent fresh login preserves all workspaces
    const freshLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testTenantEmail, password: testPassword }),
    });
    const freshLoginData = await freshLoginRes.json();

    check('INT-28', 'Subsequent fresh login requires workspace selection', freshLoginData.requiresWorkspaceSelection === true);
    check('INT-29', 'All 5 workspaces resolved on fresh login (owner, tenant, agent, vendor, company)', freshLoginData.eligibleWorkspaces?.length >= 5);

  } finally {
    // Run deterministic teardowns
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (e) {
        console.warn('Teardown warning:', e);
      }
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  WORKSPACE SWITCHER MULTI-ROLE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWorkspaceSwitcherEnrollmentSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
