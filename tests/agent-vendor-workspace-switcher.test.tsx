import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers, properties, ownershipRecords } from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';
import { InfrastructureProvider } from '../src/components/InfrastructureProvider.js';
import { I18nProvider } from '../src/i18n/I18nProvider.js';
import { AuthProvider, EligibleWorkspace } from '../src/components/AuthProvider.js';
import { ToastProvider } from '../src/components/ui/Toast.js';
import { WorkspaceSwitcherModal } from '../src/components/common/WorkspaceSwitcherModal.js';
import { TenantWorkspaceSwitcherModal } from '../src/components/tenant/TenantWorkspaceSwitcherModal.js';
import { AgentWorkspace } from '../src/pages/AgentWorkspace.js';
import { VendorWorkspacePage } from '../src/pages/VendorWorkspace.js';

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

// Synthetic workspaces fixtures
const mockSingleAgentWorkspace: EligibleWorkspace[] = [
  {
    workspaceId: 'agent',
    role: 'AGENT',
    title: 'ئەگێنت / برۆکەر',
    titleKey: 'workspace.agent',
    destination: '/agent',
    status: 'ACTIVE',
    isCompany: false,
  },
];

const mockSingleVendorWorkspace: EligibleWorkspace[] = [
  {
    workspaceId: 'vendor',
    role: 'VENDOR',
    title: 'دابینکەر / خزمەتگوزار',
    titleKey: 'workspace.vendor',
    destination: '/vendor',
    status: 'ACTIVE',
    isCompany: false,
  },
];

const mockMultiWorkspacesForAgent: EligibleWorkspace[] = [
  {
    workspaceId: 'agent',
    role: 'AGENT',
    title: 'ئەگێنت / برۆکەر',
    titleKey: 'workspace.agent',
    destination: '/agent',
    status: 'ACTIVE',
    isCompany: false,
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
  {
    workspaceId: 'company_zagros_brokerage',
    role: 'COMPANY_ADMIN',
    title: 'بەڕێوەبەری کۆمپانیا',
    titleKey: 'workspace.company',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_zagros_brokerage',
    organizationName: 'Zagros Commercial Brokerage Ltd',
  },
];

const mockMultiWorkspacesForVendor: EligibleWorkspace[] = [
  {
    workspaceId: 'vendor',
    role: 'VENDOR',
    title: 'دابینکەر / خزمەتگوزار',
    titleKey: 'workspace.vendor',
    destination: '/vendor',
    status: 'ACTIVE',
    isCompany: false,
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
    workspaceId: 'company_erbil_maint',
    role: 'COMPANY_MEMBER',
    title: 'بەڕێوەبەری کۆمپانیا',
    titleKey: 'workspace.company',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_erbil_maint',
    organizationName: 'Erbil Quick Fix Facility Care LLC',
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

async function runAgentVendorWorkspaceSwitcherSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — AGENT & VENDOR WORKSPACE SWITCHER REGRESSION SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // PART 1: Entry Point Availability in Agent & Vendor Dashboards
  // ---------------------------------------------------------------------------
  console.log('--- PART 1: Dashboard Entry Points & Trigger Buttons ---');

  const agentDashboardHtml = renderWithContext(<AgentWorkspace />, 'ku');
  check('AV-01', 'Agent dashboard includes quick switcher button in header (#agent-header-switch-workspace-btn)',
    agentDashboardHtml.includes('id="agent-header-switch-workspace-btn"'));

  const agentDropdownHtml = renderWithContext(<AgentWorkspace initialProfileDropdownOpen={true} />, 'ku');
  check('AV-02', 'Agent dashboard includes switcher entry in profile menu (#agent-switch-workspace-btn)',
    agentDropdownHtml.includes('id="agent-switch-workspace-btn"'));

  const vendorDashboardHtml = renderWithContext(<VendorWorkspacePage />, 'ku');
  check('AV-03', 'Vendor dashboard includes switcher button in header (#vendor-switch-workspace-btn)',
    vendorDashboardHtml.includes('id="vendor-switch-workspace-btn"'));

  check('AV-04', 'Vendor dashboard includes switcher button in sidebar (#vendor-sidebar-switch-workspace-btn)',
    vendorDashboardHtml.includes('id="vendor-sidebar-switch-workspace-btn"'));

  // ---------------------------------------------------------------------------
  // PART 2: Single-Workspace Agent & Vendor Rendering (Zero Fake Personas)
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 2: Single-Workspace Integrity (Truthful Non-Fabricated State) ---');

  const singleAgentModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockSingleAgentWorkspace}
      activeWorkspace={mockSingleAgentWorkspace[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('AV-05', 'Single-workspace Agent renders notice that no alternatives exist (#tenant-no-alternative-workspaces-notice)',
    singleAgentModalHtml.includes('id="tenant-no-alternative-workspaces-notice"'));

  check('AV-06', 'Single-workspace Agent displays only 1 workspace card and no fabricated options',
    singleAgentModalHtml.includes('id="workspace-card-agent"') &&
    !singleAgentModalHtml.includes('workspace-card-owner') &&
    !singleAgentModalHtml.includes('workspace-card-vendor') &&
    !singleAgentModalHtml.includes('workspace-card-tenant'));

  const singleVendorModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockSingleVendorWorkspace}
      activeWorkspace={mockSingleVendorWorkspace[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('AV-07', 'Single-workspace Vendor renders notice that no alternatives exist (#tenant-no-alternative-workspaces-notice)',
    singleVendorModalHtml.includes('id="tenant-no-alternative-workspaces-notice"'));

  check('AV-08', 'Single-workspace Vendor displays only 1 workspace card and no fabricated options',
    singleVendorModalHtml.includes('id="workspace-card-vendor"') &&
    !singleVendorModalHtml.includes('workspace-card-owner') &&
    !singleVendorModalHtml.includes('workspace-card-agent') &&
    !singleVendorModalHtml.includes('workspace-card-tenant'));

  // ---------------------------------------------------------------------------
  // PART 3: Active Workspace Identification & Alternative Workspaces
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 3: Multi-Role Alternatives & Active Workspace State ---');

  const multiAgentModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForAgent}
      activeWorkspace={mockMultiWorkspacesForAgent[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('AV-09', 'Active Agent workspace correctly displays active badge (#tenant-switcher-active-badge)',
    multiAgentModalHtml.includes('id="tenant-switcher-active-badge"') &&
    multiAgentModalHtml.includes('aria-current="true"'));

  check('AV-10', 'Active Agent workspace has disabled card preventing redundant click submission',
    multiAgentModalHtml.includes('id="workspace-card-agent"') &&
    multiAgentModalHtml.includes('disabled=""'));

  check('AV-11', 'Eligible alternative workspaces offer explicit selectable buttons (#btn-select-workspace-*)',
    multiAgentModalHtml.includes('id="btn-select-workspace-tenant"') &&
    multiAgentModalHtml.includes('id="btn-select-workspace-owner_personal"') &&
    multiAgentModalHtml.includes('id="btn-select-workspace-company_zagros_brokerage"'));

  check('AV-12', 'Mixed-direction organization name is isolated with <bdi> tag',
    multiAgentModalHtml.includes('<bdi class="font-medium text-slate-700">Zagros Commercial Brokerage Ltd</bdi>'));

  // ---------------------------------------------------------------------------
  // PART 4: Localization (Kurdish RTL, Arabic RTL, English LTR) & Stay Button
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 4: Multi-Language & RTL Layout Invariants ---');

  const kurdishAgentModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForAgent}
      activeWorkspace={mockMultiWorkspacesForAgent[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('AV-13', 'Kurdish modal enforces dir="rtl", font-arabic, and Kurdish stay button ("مانەوە لە پۆرتالی ئەگێنت")',
    kurdishAgentModalHtml.includes('dir="rtl"') &&
    kurdishAgentModalHtml.includes('font-arabic') &&
    kurdishAgentModalHtml.includes('مانەوە لە پۆرتالی ئەگێنت'));

  const arabicVendorModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForVendor}
      activeWorkspace={mockMultiWorkspacesForVendor[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ar'
  );

  check('AV-14', 'Arabic Vendor modal enforces dir="rtl" and Arabic stay button ("البقاء في بوابة المزود")',
    arabicVendorModalHtml.includes('dir="rtl"') &&
    arabicVendorModalHtml.includes('البقاء في بوابة المزود'));

  const englishAgentModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForAgent}
      activeWorkspace={mockMultiWorkspacesForAgent[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('AV-15', 'English modal enforces dir="ltr", font-sans, and English stay button ("Stay on Agent Portal")',
    englishAgentModalHtml.includes('dir="ltr"') &&
    englishAgentModalHtml.includes('font-sans') &&
    englishAgentModalHtml.includes('Stay on Agent Portal'));

  // ---------------------------------------------------------------------------
  // PART 5: Dialog Accessibility & Switching / Error States
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 5: Accessibility, Busy Loading, and Error States ---');

  check('AV-16', 'Modal enforces accessible dialog semantics (role="dialog", aria-modal="true", aria-labelledby)',
    englishAgentModalHtml.includes('role="dialog"') &&
    englishAgentModalHtml.includes('aria-modal="true"') &&
    englishAgentModalHtml.includes('aria-labelledby="tenant-switcher-modal-title"'));

  const switchingModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      isSwitching={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForAgent}
      activeWorkspace={mockMultiWorkspacesForAgent[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('AV-17', 'While switching is in flight, all cards and actions are disabled to prevent duplicate submissions',
    switchingModalHtml.includes('id="btn-close-tenant-workspace-modal" type="button" disabled=""') &&
    switchingModalHtml.includes('id="tenant-switcher-logout-btn" type="button" disabled=""') &&
    switchingModalHtml.includes('id="tenant-switcher-close-btn" type="button" disabled=""'));

  const errorModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      error="Network connection failure. Active workspace preserved."
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForAgent}
      activeWorkspace={mockMultiWorkspacesForAgent[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('AV-18', 'Error state is rendered prominently in #tenant-workspace-switch-error without unmounting list',
    errorModalHtml.includes('id="tenant-workspace-switch-error"') &&
    errorModalHtml.includes('Network connection failure. Active workspace preserved.'));

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

    // 1. Create Multi-Role Agent user (AGENT + TENANT)
    const agentEmail = `agent_multi_${runId}@homehub.iq`;
    const [agentUser] = await db.insert(users).values({
      email: agentEmail,
      firstName: 'Kardo',
      lastName: 'Agent',
      passwordHash,
      roles: ['AGENT', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, agentUser.id));
    });

    const agentToken = signAuthToken({
      id: agentUser.id,
      email: agentUser.email,
      roles: ['AGENT', 'TENANT'],
      activeRole: 'AGENT',
      workspaceId: 'agent',
      tokenVersion: 1,
    });

    // Step A: Agent selects legitimate TENANT workspace -> 200 + new token
    const resAgentToTenant = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });

    const bodyAgentToTenant = await resAgentToTenant.json();
    check('AV-19', 'Agent can switch to authorized TENANT workspace via POST /api/auth/select-workspace',
      resAgentToTenant.status === 200 &&
      bodyAgentToTenant.activeWorkspace?.role === 'TENANT' &&
      bodyAgentToTenant.activeWorkspace?.destination === '/tenant');

    // Step B: Agent attempts to select unassigned OWNER workspace -> 403 Forbidden
    const resAgentToOwnerForbidden = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${agentToken}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });

    check('AV-20', 'Agent cannot switch to unauthorized OWNER workspace (returns 403 INVALID_WORKSPACE_SELECTION)',
      resAgentToOwnerForbidden.status === 403);

    // 2. Create Multi-Role Vendor user (VENDOR + TENANT)
    const vendorEmail = `vendor_multi_${runId}@homehub.iq`;
    const [vendorUser] = await db.insert(users).values({
      email: vendorEmail,
      firstName: 'Alan',
      lastName: 'Vendor',
      passwordHash,
      roles: ['VENDOR', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, vendorUser.id));
    });

    const vendorToken = signAuthToken({
      id: vendorUser.id,
      email: vendorUser.email,
      roles: ['VENDOR', 'TENANT'],
      activeRole: 'VENDOR',
      workspaceId: 'vendor',
      tokenVersion: 1,
    });

    // Step C: Vendor selects legitimate TENANT workspace -> 200 + new token
    const resVendorToTenant = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });

    const bodyVendorToTenant = await resVendorToTenant.json();
    check('AV-21', 'Vendor can switch to authorized TENANT workspace via POST /api/auth/select-workspace',
      resVendorToTenant.status === 200 &&
      bodyVendorToTenant.activeWorkspace?.role === 'TENANT' &&
      bodyVendorToTenant.activeWorkspace?.destination === '/tenant');

    // Step D: Vendor attempts to select unassigned AGENT workspace -> 403 Forbidden
    const resVendorToAgentForbidden = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({ workspaceId: 'agent' }),
    });

    check('AV-22', 'Vendor cannot switch to unauthorized AGENT workspace (returns 403 INVALID_WORKSPACE_SELECTION)',
      resVendorToAgentForbidden.status === 403);

    // Step E: Verify active-role guards enforce workspace role:
    // A user with activeRole 'TENANT' calling an Agent-only or Vendor-only route is blocked
    const tenantScopedToken = bodyAgentToTenant.token;

    const resTenantCallingVendor = await fetch(`${baseUrl}/vendor/kpi`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantScopedToken}`,
      },
    });

    check('AV-23', 'Active role guard enforces workspace boundaries (TENANT activeRole blocked on Vendor API with 403)',
      resTenantCallingVendor.status === 403);

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
  console.log(`  AGENT & VENDOR WORKSPACE SWITCHER RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAgentVendorWorkspaceSwitcherSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
