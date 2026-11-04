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
import { OwnerWorkspacePage } from '../src/pages/OwnerWorkspace.js';

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

// Synthetic workspaces fixtures for Owner
const mockSingleOwnerWorkspace: EligibleWorkspace[] = [
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

const mockMultiWorkspacesForOwner: EligibleWorkspace[] = [
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
    workspaceId: 'tenant',
    role: 'TENANT',
    title: 'کرێنشین',
    titleKey: 'workspace.tenant',
    destination: '/tenant',
    status: 'ACTIVE',
    isCompany: false,
  },
  {
    workspaceId: 'company_zagros_re',
    role: 'COMPANY_ADMIN',
    title: 'بەڕێوەبەری کۆمپانیا',
    titleKey: 'workspace.company',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_zagros_re',
    organizationName: 'Zagros Properties International Ltd',
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

async function runOwnerWorkspaceSwitcherSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — OWNER WORKSPACE SWITCHER REGRESSION TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // PART 1: Dashboard Entry Points & Trigger Buttons
  // ---------------------------------------------------------------------------
  console.log('--- PART 1: Dashboard Entry Points & Trigger Buttons ---');

  const ownerDashboardHtml = renderWithContext(<OwnerWorkspacePage />, 'ku');
  check('OW-01', 'Owner dashboard includes quick switcher button in header (#owner-header-switch-workspace-btn)',
    ownerDashboardHtml.includes('id="owner-header-switch-workspace-btn"'));

  check('OW-02', 'Owner dashboard includes profile dropdown toggle (#owner-profile-btn)',
    ownerDashboardHtml.includes('id="owner-profile-btn"'));

  const ownerDropdownHtml = renderWithContext(<OwnerWorkspacePage initialProfileDropdownOpen={true} />, 'ku');
  check('OW-03', 'Owner dashboard includes switcher entry in profile dropdown menu (#owner-switch-workspace-btn)',
    ownerDropdownHtml.includes('id="owner-switch-workspace-btn"'));

  // ---------------------------------------------------------------------------
  // PART 2: Single-Workspace Owner Integrity (Truthful Non-Fabricated State)
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 2: Single-Workspace Integrity (Truthful Non-Fabricated State) ---');

  const singleOwnerModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockSingleOwnerWorkspace}
      activeWorkspace={mockSingleOwnerWorkspace[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('OW-04', 'Single-workspace Owner renders notice that no alternatives exist (#tenant-no-alternative-workspaces-notice)',
    singleOwnerModalHtml.includes('id="tenant-no-alternative-workspaces-notice"'));

  check('OW-05', 'Single-workspace Owner displays only 1 workspace card and no fabricated options',
    singleOwnerModalHtml.includes('id="workspace-card-owner_personal"') &&
    !singleOwnerModalHtml.includes('workspace-card-tenant') &&
    !singleOwnerModalHtml.includes('workspace-card-agent') &&
    !singleOwnerModalHtml.includes('workspace-card-vendor'));

  // ---------------------------------------------------------------------------
  // PART 3: Multi-Role Alternatives & Active Workspace State
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 3: Multi-Role Alternatives & Active Workspace State ---');

  const multiOwnerModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForOwner}
      activeWorkspace={mockMultiWorkspacesForOwner[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('OW-06', 'Active Owner workspace correctly displays active badge (#tenant-switcher-active-badge)',
    multiOwnerModalHtml.includes('id="tenant-switcher-active-badge"') &&
    multiOwnerModalHtml.includes('aria-current="true"'));

  check('OW-07', 'Active Owner workspace has disabled card preventing redundant click submission',
    multiOwnerModalHtml.includes('id="workspace-card-owner_personal"') &&
    multiOwnerModalHtml.includes('disabled=""'));

  check('OW-08', 'Eligible alternative workspaces offer explicit selectable buttons (#btn-select-workspace-*)',
    multiOwnerModalHtml.includes('id="btn-select-workspace-tenant"') &&
    multiOwnerModalHtml.includes('id="btn-select-workspace-company_zagros_re"'));

  check('OW-09', 'Mixed-direction organization name is isolated with <bdi> tag',
    multiOwnerModalHtml.includes('<bdi class="font-medium text-slate-700">Zagros Properties International Ltd</bdi>'));

  // ---------------------------------------------------------------------------
  // PART 4: Multi-Language & RTL Layout Invariants & Owner Stay Button
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 4: Multi-Language & RTL Layout Invariants ---');

  const kurdishOwnerModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForOwner}
      activeWorkspace={mockMultiWorkspacesForOwner[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('OW-10', 'Kurdish Owner modal enforces dir="rtl", font-arabic, and Kurdish stay button ("مانەوە لە پۆرتالی خاوەن موڵک")',
    kurdishOwnerModalHtml.includes('dir="rtl"') &&
    kurdishOwnerModalHtml.includes('font-arabic') &&
    kurdishOwnerModalHtml.includes('مانەوە لە پۆرتالی خاوەن موڵک'));

  const arabicOwnerModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForOwner}
      activeWorkspace={mockMultiWorkspacesForOwner[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'ar'
  );

  check('OW-11', 'Arabic Owner modal enforces dir="rtl" and Arabic stay button ("البقاء في بوابة المالك")',
    arabicOwnerModalHtml.includes('dir="rtl"') &&
    arabicOwnerModalHtml.includes('البقاء في بوابة المالك'));

  const englishOwnerModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForOwner}
      activeWorkspace={mockMultiWorkspacesForOwner[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('OW-12', 'English Owner modal enforces dir="ltr", font-sans, and English stay button ("Stay on Owner Portal")',
    englishOwnerModalHtml.includes('dir="ltr"') &&
    englishOwnerModalHtml.includes('font-sans') &&
    englishOwnerModalHtml.includes('Stay on Owner Portal'));

  // ---------------------------------------------------------------------------
  // PART 5: Accessibility, Busy Loading, and Error States
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 5: Accessibility, Busy Loading, and Error States ---');

  check('OW-13', 'Modal enforces accessible dialog semantics (role="dialog", aria-modal="true", aria-labelledby)',
    englishOwnerModalHtml.includes('role="dialog"') &&
    englishOwnerModalHtml.includes('aria-modal="true"') &&
    englishOwnerModalHtml.includes('aria-labelledby="tenant-switcher-modal-title"'));

  const switchingModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      isSwitching={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForOwner}
      activeWorkspace={mockMultiWorkspacesForOwner[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('OW-14', 'While switching is in flight, all cards and actions are disabled to prevent duplicate submissions',
    switchingModalHtml.includes('id="btn-close-tenant-workspace-modal" type="button" disabled=""') &&
    switchingModalHtml.includes('id="tenant-switcher-logout-btn" type="button" disabled=""') &&
    switchingModalHtml.includes('id="tenant-switcher-close-btn" type="button" disabled=""'));

  const errorModalHtml = renderWithContext(
    <WorkspaceSwitcherModal
      isOpen={true}
      error="Network connection failure. Active workspace preserved."
      onClose={() => {}}
      workspaces={mockMultiWorkspacesForOwner}
      activeWorkspace={mockMultiWorkspacesForOwner[0]}
      onSelectWorkspace={async () => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('OW-15', 'Error state is rendered prominently in #tenant-workspace-switch-error without unmounting list',
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

    // 1. Create Multi-Role Owner user (PROPERTY_OWNER + TENANT)
    const ownerEmail = `owner_multi_${runId}@homehub.iq`;
    const [ownerUser] = await db.insert(users).values({
      email: ownerEmail,
      firstName: 'Dara',
      lastName: 'Owner',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // 2. Insert verified property and ownership record for this owner
    const [prop] = await db.insert(properties).values({
      name: `Dara Towers Unit ${runId}`,
      address: 'Gulan St, Erbil',
      city: 'Erbil',
      type: 'RESIDENTIAL_BUILDING',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: prop.id,
      ownerId: ownerUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    cleanups.push(async () => {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
      await db.delete(properties).where(eq(properties.id, prop.id));
      await db.delete(users).where(eq(users.id, ownerUser.id));
    });

    const initialOwnerToken = signAuthToken({
      id: ownerUser.id,
      email: ownerUser.email,
      roles: ['PROPERTY_OWNER', 'TENANT'],
      activeRole: 'PROPERTY_OWNER',
      workspaceId: 'owner_personal',
      tokenVersion: 1,
    });

    // Step A: Owner selects legitimate TENANT workspace -> 200 + new scoped JWT
    const resOwnerToTenant = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialOwnerToken}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });

    const bodyOwnerToTenant = await resOwnerToTenant.json();
    check('OW-16', 'Owner can switch to authorized TENANT workspace via POST /api/auth/select-workspace',
      resOwnerToTenant.status === 200 &&
      bodyOwnerToTenant.activeWorkspace?.role === 'TENANT' &&
      bodyOwnerToTenant.activeWorkspace?.destination === '/tenant');

    // Step B: Owner attempts to select unassigned AGENT workspace -> 403 Forbidden
    const resOwnerToAgentForbidden = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialOwnerToken}`,
      },
      body: JSON.stringify({ workspaceId: 'agent' }),
    });

    check('OW-17', 'Owner cannot switch to unauthorized AGENT workspace (returns 403 INVALID_WORKSPACE_SELECTION)',
      resOwnerToAgentForbidden.status === 403);

    // Step C: Owner attempts to select forged company workspace -> 403 Forbidden
    const resOwnerToForgedOrg = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialOwnerToken}`,
      },
      body: JSON.stringify({ workspaceId: 'company_unauthorized_fake_org_999' }),
    });

    check('OW-18', 'Owner cannot switch to forged company workspace (returns 403 INVALID_WORKSPACE_SELECTION)',
      resOwnerToForgedOrg.status === 403);

    // Step D: Blank or missing workspaceId returns 400
    const resBlank = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialOwnerToken}`,
      },
      body: JSON.stringify({ workspaceId: '' }),
    });

    check('OW-19', 'Blank workspaceId is rejected with 400 VALIDATION_ERROR',
      resBlank.status === 400);

    // Step E: Verify active-role guards enforce workspace role:
    // A user with activeRole 'TENANT' calling an Owner-only route is blocked
    const tenantScopedToken = bodyOwnerToTenant.token;

    const resTenantCallingAgent = await fetch(`${baseUrl}/agent/properties`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tenantScopedToken}`,
      },
    });

    check('OW-20', 'Active role guard enforces workspace boundaries (TENANT activeRole blocked on Agent API with 403)',
      resTenantCallingAgent.status === 403);

    // Step F: Single-workspace Owner cannot select other workspaces
    const singleOwnerEmail = `owner_single_${runId}@homehub.iq`;
    const [singleOwnerUser] = await db.insert(users).values({
      email: singleOwnerEmail,
      firstName: 'Single',
      lastName: 'Owner',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, singleOwnerUser.id));
    });

    const singleOwnerToken = signAuthToken({
      id: singleOwnerUser.id,
      email: singleOwnerUser.email,
      roles: ['PROPERTY_OWNER'],
      activeRole: 'PROPERTY_OWNER',
      workspaceId: 'owner_personal',
      tokenVersion: 1,
    });

    const resSingleOwnerAttempt = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleOwnerToken}`,
      },
      body: JSON.stringify({ workspaceId: 'tenant' }),
    });

    check('OW-21', 'Single-workspace Owner cannot switch to unassigned tenant workspace (returns 403)',
      resSingleOwnerAttempt.status === 403);

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
  console.log(`  OWNER WORKSPACE SWITCHER RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runOwnerWorkspaceSwitcherSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
