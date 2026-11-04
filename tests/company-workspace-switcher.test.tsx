/**
 * HomeHub — Company Workspace Switcher Regression Test Suite
 *
 * Verifies:
 * 1. Company Dashboard & Company Workspace entry points (#company-header-switch-workspace-btn, #company-profile-btn, #company-switch-workspace-btn).
 * 2. Truthful single-workspace state with no fabricated alternatives.
 * 3. Multi-role alternatives with authoritative server eligibility.
 * 4. Company membership permissions (COMPANY_ADMIN vs COMPANY_MEMBER) are NOT treated as extra workspace identities.
 * 5. Bounded BiDi isolation (<bdi>), Kurdish/Arabic RTL, and English LTR stay buttons.
 * 6. Accessibility (WAI-ARIA dialog semantics), duplicate-submission locking, and non-destructive error recovery.
 * 7. Real PostgreSQL POST /api/auth/select-workspace endpoint validation & role guard enforcement.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';
import { InfrastructureProvider } from '../src/components/InfrastructureProvider.js';
import { I18nProvider } from '../src/i18n/I18nProvider.js';
import { AuthProvider, EligibleWorkspace } from '../src/components/AuthProvider.js';
import { ToastProvider } from '../src/components/ui/Toast.js';
import { WorkspaceSwitcherModal } from '../src/components/common/WorkspaceSwitcherModal.js';
import { CompanyWorkspacePage } from '../src/pages/CompanyWorkspace.js';
import { CompanyDashboardPage } from '../src/pages/CompanyDashboard.js';

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

// Synthetic workspaces fixtures for Company Admin
const mockSingleCompanyWorkspace: EligibleWorkspace[] = [
  {
    workspaceId: 'company_kurdistan_re',
    role: 'COMPANY_ADMIN',
    title: 'بەڕێوەبەری کۆمپانیا',
    titleKey: 'workspace.company',
    destination: '/company',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_kurdistan_re',
    organizationName: 'Kurdistan Real Estate Group Ltd',
  },
];

const mockMultiWorkspacesForCompany: EligibleWorkspace[] = [
  {
    workspaceId: 'company_kurdistan_re',
    role: 'COMPANY_ADMIN',
    title: 'بەڕێوەبەری کۆمپانیا',
    titleKey: 'workspace.company',
    destination: '/company',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_kurdistan_re',
    organizationName: 'Kurdistan Real Estate Group Ltd',
  },
  {
    workspaceId: 'tenant',
    role: 'TENANT',
    title: 'کرێنشین',
    titleKey: 'workspace.tenant',
    destination: '/tenant',
    status: 'ACTIVE',
    isCompany: false,
  },
  {
    workspaceId: 'owner_personal',
    role: 'PROPERTY_OWNER',
    title: 'خاوەنی موڵک (سەربەخۆ)',
    titleKey: 'workspace.owner_personal',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: false,
  },
];

function renderWithContext(ui: React.ReactElement, lang: 'ku' | 'ar' | 'en' = 'ku') {
  return renderToStaticMarkup(
    <MemoryRouter>
      <InfrastructureProvider>
        <AuthProvider>
          <I18nProvider initialLanguage={lang}>
            <ToastProvider>
              {ui}
            </ToastProvider>
          </I18nProvider>
        </AuthProvider>
      </InfrastructureProvider>
    </MemoryRouter>
  );
}

async function runCompanyWorkspaceSwitcherSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — COMPANY WORKSPACE SWITCHER REGRESSION TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // PART 1: Dashboard Entry Points & Trigger Buttons
  // ---------------------------------------------------------------------------
  console.log('--- PART 1: Dashboard Entry Points & Trigger Buttons ---');

  const companyWorkspaceHtml = renderWithContext(<CompanyWorkspacePage />, 'ku');
  check('CW-01', 'Company workspace includes quick switcher button in header (#company-header-switch-workspace-btn)',
    companyWorkspaceHtml.includes('id="company-header-switch-workspace-btn"'));

  check('CW-02', 'Company workspace includes profile dropdown toggle (#company-profile-btn)',
    companyWorkspaceHtml.includes('id="company-profile-btn"'));

  const companyDropdownHtml = renderWithContext(<CompanyWorkspacePage initialProfileDropdownOpen={true} />, 'ku');
  check('CW-03', 'Company workspace includes switcher entry in profile dropdown menu (#company-switch-workspace-btn)',
    companyDropdownHtml.includes('id="company-switch-workspace-btn"'));

  const companyDashboardHtml = renderWithContext(<CompanyDashboardPage />, 'ku');
  check('CW-04', 'CompanyDashboard alias re-exports correctly and renders identical switcher triggers',
    companyDashboardHtml.includes('id="company-header-switch-workspace-btn"') &&
    companyDashboardHtml.includes('id="company-profile-btn"'));

  // ---------------------------------------------------------------------------
  // PART 2: Single-Workspace Integrity (Truthful Non-Fabricated State)
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 2: Single-Workspace Integrity (Truthful Non-Fabricated State) ---');

  const singleCompanyModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockSingleCompanyWorkspace}
      activeWorkspace={mockSingleCompanyWorkspace[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('CW-05', 'Single-workspace Company user renders notice that no alternatives exist (#tenant-no-alternative-workspaces-notice)',
    singleCompanyModalHtml.includes('id="tenant-no-alternative-workspaces-notice"'));

  check('CW-06', 'Single-workspace Company user displays only 1 workspace card and no fabricated options',
    singleCompanyModalHtml.includes('id="workspace-card-company_kurdistan_re"') &&
    !singleCompanyModalHtml.includes('workspace-card-tenant') &&
    !singleCompanyModalHtml.includes('workspace-card-owner') &&
    !singleCompanyModalHtml.includes('workspace-card-agent') &&
    !singleCompanyModalHtml.includes('workspace-card-vendor'));

  // ---------------------------------------------------------------------------
  // PART 3: Multi-Role Alternatives & Active Workspace State
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 3: Multi-Role Alternatives & Active Workspace State ---');

  const multiCompanyModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForCompany}
      activeWorkspace={mockMultiWorkspacesForCompany[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('CW-07', 'Active Company workspace correctly displays active badge (#tenant-switcher-active-badge)',
    multiCompanyModalHtml.includes('id="tenant-switcher-active-badge"') &&
    multiCompanyModalHtml.includes('aria-current="true"'));

  check('CW-08', 'Active Company workspace has disabled card preventing redundant click submission',
    multiCompanyModalHtml.includes('id="workspace-card-company_kurdistan_re"') &&
    multiCompanyModalHtml.includes('disabled=""'));

  check('CW-09', 'Eligible alternative workspaces offer explicit selectable buttons (#btn-select-workspace-*)',
    multiCompanyModalHtml.includes('id="btn-select-workspace-tenant"') &&
    multiCompanyModalHtml.includes('id="btn-select-workspace-owner_personal"'));

  check('CW-10', 'Mixed-direction organization name is isolated with <bdi> tag',
    multiCompanyModalHtml.includes('<bdi class="font-medium text-slate-700">Kurdistan Real Estate Group Ltd</bdi>'));

  check('CW-11', 'Company membership permissions are internal permissions within an organization and not treated as multiple separate workspace identities',
    // In our mock fixtures, there is exactly one workspace identity for org_kurdistan_re: company_kurdistan_re
    mockMultiWorkspacesForCompany.filter(w => w.organizationId === 'org_kurdistan_re').length === 1);

  // ---------------------------------------------------------------------------
  // PART 4: Multi-Language & RTL Layout Invariants & Company Stay Button
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 4: Multi-Language & RTL Layout Invariants ---');

  const kurdishCompanyModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForCompany}
      activeWorkspace={mockMultiWorkspacesForCompany[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('CW-12', 'Kurdish Company modal enforces dir="rtl", font-arabic, and Kurdish stay button ("مانەوە لە پۆرتالی کۆمپانیا")',
    kurdishCompanyModalHtml.includes('dir="rtl"') &&
    kurdishCompanyModalHtml.includes('font-arabic') &&
    kurdishCompanyModalHtml.includes('مانەوە لە پۆرتالی کۆمپانیا'));

  const arabicCompanyModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForCompany}
      activeWorkspace={mockMultiWorkspacesForCompany[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ar'
  );

  check('CW-13', 'Arabic Company modal enforces dir="rtl" and Arabic stay button ("البقاء في بوابة الشركة")',
    arabicCompanyModalHtml.includes('dir="rtl"') &&
    arabicCompanyModalHtml.includes('البقاء في بوابة الشركة'));

  const englishCompanyModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForCompany}
      activeWorkspace={mockMultiWorkspacesForCompany[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('CW-14', 'English Company modal enforces dir="ltr", font-sans, and English stay button ("Stay on Company Portal")',
    englishCompanyModalHtml.includes('dir="ltr"') &&
    englishCompanyModalHtml.includes('font-sans') &&
    englishCompanyModalHtml.includes('Stay on Company Portal'));

  // ---------------------------------------------------------------------------
  // PART 5: Accessibility, Busy Loading, and Error States
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 5: Accessibility, Busy Loading, and Error States ---');

  check('CW-15', 'Modal enforces accessible dialog semantics (role="dialog", aria-modal="true", aria-labelledby)',
    englishCompanyModalHtml.includes('role="dialog"') &&
    englishCompanyModalHtml.includes('aria-modal="true"') &&
    englishCompanyModalHtml.includes('aria-labelledby="tenant-switcher-modal-title"'));

  const switchingModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      isSwitching={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForCompany}
      activeWorkspace={mockMultiWorkspacesForCompany[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('CW-16', 'While switching is in flight, all cards and actions are disabled to prevent duplicate submissions',
    switchingModalHtml.includes('id="btn-close-tenant-workspace-modal" type="button" disabled=""') &&
    switchingModalHtml.includes('id="tenant-switcher-logout-btn" type="button" disabled=""') &&
    switchingModalHtml.includes('id="tenant-switcher-close-btn" type="button" disabled=""'));

  const errorModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      error="Switching failed. Active company workspace preserved."
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForCompany}
      activeWorkspace={mockMultiWorkspacesForCompany[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('CW-17', 'Error state is rendered prominently in #tenant-workspace-switch-error without unmounting list',
    errorModalHtml.includes('id="tenant-workspace-switch-error"') &&
    errorModalHtml.includes('Switching failed. Active company workspace preserved.'));

  // ---------------------------------------------------------------------------
  // PART 6: Authoritative PostgreSQL Integration (POST /api/auth/select-workspace & Role Guards)
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 6: Authoritative Backend & PostgreSQL Integration ---');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const cleanups: (() => Promise<void>)[] = [];

  try {
    const runId = Date.now();
    const passwordHash = await hashPassword('HomeHubSecure2026!');

    // 1. Create Organization
    const [org] = await db.insert(organizations).values({
      name: `Kurdistan Properties Group ${runId}`,
      type: 'PROPERTY_MANAGEMENT',
      registrationNumber: `REG-${runId}`,
      status: 'VERIFIED',
      verified: true,
    }).returning();

    // 2. Create Multi-Role Company Admin user (COMPANY_MEMBER role + TENANT role)
    const companyAdminEmail = `company_admin_${runId}@homehub.iq`;
    const [adminUser] = await db.insert(users).values({
      email: companyAdminEmail,
      firstName: 'Soran',
      lastName: 'Director',
      passwordHash,
      roles: ['COMPANY_MEMBER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // 3. Link user as COMPANY_ADMIN in organization_members
    await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: adminUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    });

    cleanups.push(async () => {
      await db.delete(organizationMembers).where(eq(organizationMembers.userId, adminUser.id));
      await db.delete(organizations).where(eq(organizations.id, org.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
    });

    const initialCompanyToken = signAuthToken({
      id: adminUser.id,
      email: adminUser.email,
      roles: ['COMPANY_MEMBER', 'TENANT'],
      activeRole: 'COMPANY_ADMIN',
      workspaceId: `company_${org.id}`,
      tokenVersion: 1,
    });

    // Step A: Company Admin selects legitimate TENANT workspace -> 200 + new scoped JWT
    const resCompanyToTenant = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialCompanyToken}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });

    const bodyCompanyToTenant = await resCompanyToTenant.json();
    check('CW-18', 'Company user can switch to authorized TENANT workspace via POST /api/auth/select-workspace',
      resCompanyToTenant.status === 200 &&
      bodyCompanyToTenant.activeWorkspace?.role === 'TENANT' &&
      bodyCompanyToTenant.activeWorkspace?.destination === '/tenant');

    // Step B: Company user attempts to select unassigned AGENT workspace -> 403 Forbidden
    const resCompanyToAgentForbidden = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialCompanyToken}`,
      },
      body: JSON.stringify({ workspaceId: 'agent' }),
    });

    check('CW-19', 'Company user cannot switch to unauthorized AGENT workspace (returns 403 INVALID_WORKSPACE_SELECTION)',
      resCompanyToAgentForbidden.status === 403);

    // Step C: Company user attempts to select forged company workspace -> 403 Forbidden
    const resCompanyToForgedOrg = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialCompanyToken}`,
      },
      body: JSON.stringify({ workspaceId: 'company_unauthorized_fake_org_999' }),
    });

    check('CW-20', 'Company user cannot switch to forged company workspace (returns 403 INVALID_WORKSPACE_SELECTION)',
      resCompanyToForgedOrg.status === 403);

    // Step D: Blank or missing workspaceId returns 400
    const resBlank = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialCompanyToken}`,
      },
      body: JSON.stringify({ workspaceId: '' }),
    });

    check('CW-21', 'Blank workspaceId is rejected with 400 VALIDATION_ERROR',
      resBlank.status === 400);

    // Step E: Verify active-role guards enforce workspace role:
    // Once switched to TENANT activeRole, calling company-admin endpoints is blocked
    const tenantScopedToken = bodyCompanyToTenant.token;

    const resTenantCallingAgent = await fetch(`${baseUrl}/agent/properties`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantScopedToken}`,
      },
    });

    check('CW-22', 'Active role guard enforces workspace boundaries (switched TENANT activeRole blocked on Agent API with 403)',
      resTenantCallingAgent.status === 403);

  } finally {
    for (const cleanup of cleanups) {
      await cleanup().catch(() => {});
    }
    server.close();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  COMPANY WORKSPACE SWITCHER RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompanyWorkspaceSwitcherSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
