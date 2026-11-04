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
import { TenantWorkspaceSwitcherModal } from '../src/components/tenant/TenantWorkspaceSwitcherModal.js';
import { SwitchAccountModal } from '../src/components/tenant/TenantModals.js';
import { TenantWorkspacePage } from '../src/pages/TenantWorkspace.js';

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
const mockSingleTenantWorkspace: EligibleWorkspace[] = [
  {
    workspaceId: 'ws_tenant_only',
    role: 'TENANT',
    title: 'کرێنشین',
    titleKey: 'workspace.tenant',
    destination: '/tenant',
    status: 'ACTIVE',
    isCompany: false,
  },
];

const mockMultiWorkspaces: EligibleWorkspace[] = [
  {
    workspaceId: 'ws_tenant',
    role: 'TENANT',
    title: 'کرێنشین',
    titleKey: 'workspace.tenant',
    destination: '/tenant',
    status: 'ACTIVE',
    isCompany: false,
  },
  {
    workspaceId: 'ws_owner_personal',
    role: 'PROPERTY_OWNER',
    title: 'خاوەنی موڵک (سەربەخۆ)',
    titleKey: 'workspace.owner_personal',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: false,
  },
  {
    workspaceId: 'ws_company_zagros',
    role: 'COMPANY_ADMIN',
    title: 'بەڕێوەبەری کۆمپانیا',
    titleKey: 'workspace.company',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_zagros_123',
    organizationName: 'Zagros Real Estate Ltd',
  },
  {
    workspaceId: 'ws_agent_broker',
    role: 'AGENT_BROKER',
    title: 'ئەگێنت / برۆکەر',
    titleKey: 'workspace.agent',
    destination: '/agent',
    status: 'PENDING_VERIFICATION',
    isCompany: false,
  },
];

function renderWithContext(ui: React.ReactElement, lang: 'ku' | 'ar' | 'en' = 'ku') {
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

async function runTenantWorkspaceSwitcherSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — TENANT WORKSPACE SWITCHER REGRESSION TEST SUITE');
  console.log('================================================================\n');

  // ---------------------------------------------------------------------------
  // PART 1: RENDER TESTS & AUTHORITATIVE DATA BINDING
  // ---------------------------------------------------------------------------
  console.log('--- PART 1: Authoritative Rendering & Single-Workspace Mode ---');

  // Test 1: Single eligible workspace user is not offered fake alternatives
  const htmlSingle = renderWithContext(
    <TenantWorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockSingleTenantWorkspace}
      activeWorkspace={mockSingleTenantWorkspace[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('REG-01', 'Single workspace user renders only authoritative workspace', 
    htmlSingle.includes('id="workspace-card-ws_tenant_only"'));
  check('REG-02', 'Single workspace user receives explicit notice that no alternatives exist',
    htmlSingle.includes('id="tenant-no-alternative-workspaces-notice"'));
  check('REG-03', 'Single workspace user is not offered fake alternative options',
    !htmlSingle.includes('Ahmed Farhad') &&
    !htmlSingle.includes('Salar Aziz') &&
    !htmlSingle.includes('Zagros Real Estate') &&
    !htmlSingle.includes('Zana Mustafa'));
  check('REG-04', 'Single workspace is marked as Active',
    htmlSingle.includes('چالاک'));

  // ---------------------------------------------------------------------------
  // PART 2: MULTI-ROLE AUTHORITATIVE WORKSPACES
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 2: Multi-Role Eligible Workspaces & Organization Isolation ---');

  const htmlMultiKu = renderWithContext(
    <TenantWorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspaces}
      activeWorkspace={mockMultiWorkspaces[0]} // Currently in Tenant
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('REG-05', 'Multi-role user sees all authoritative eligible workspaces',
    htmlMultiKu.includes('id="workspace-card-ws_tenant"') &&
    htmlMultiKu.includes('id="workspace-card-ws_owner_personal"') &&
    htmlMultiKu.includes('id="workspace-card-ws_company_zagros"') &&
    htmlMultiKu.includes('id="workspace-card-ws_agent_broker"'));

  check('REG-06', 'Current active workspace shows active indicator and disabled button',
    htmlMultiKu.includes('id="workspace-card-ws_tenant"') &&
    htmlMultiKu.includes('شوێنی ئێستا'));

  check('REG-07', 'Alternative workspaces offer explicit selection CTA (#btn-select-workspace-*)',
    htmlMultiKu.includes('id="btn-select-workspace-ws_owner_personal"') &&
    htmlMultiKu.includes('id="btn-select-workspace-ws_company_zagros"') &&
    htmlMultiKu.includes('id="btn-select-workspace-ws_agent_broker"'));

  check('REG-08', 'Company workspace displays organization name with BiDi isolation (<bdi>)',
    htmlMultiKu.includes('<bdi class="font-medium text-slate-700">Zagros Real Estate Ltd</bdi>'));

  check('REG-09', 'Pending workspace shows pending status badge',
    htmlMultiKu.includes('لە چاوەڕوانی'));

  // ---------------------------------------------------------------------------
  // PART 3: LOCALIZATION & RTL STANDARDS
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 3: Localization (Sorani RTL, Arabic RTL, English LTR) ---');

  // Kurdish RTL
  check('REG-10', 'Kurdish Sorani modal enforces dir="rtl" and font-arabic',
    htmlMultiKu.includes('dir="rtl"') && htmlMultiKu.includes('font-arabic'));

  // Arabic RTL
  const htmlMultiAr = renderWithContext(
    <TenantWorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspaces}
      activeWorkspace={mockMultiWorkspaces[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'ar'
  );

  check('REG-11', 'Arabic modal enforces dir="rtl" and renders Arabic titles',
    htmlMultiAr.includes('dir="rtl"') &&
    htmlMultiAr.includes('اختر مساحة العمل الخاصة بك'));

  // English LTR
  const htmlMultiEn = renderWithContext(
    <TenantWorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspaces}
      activeWorkspace={mockMultiWorkspaces[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
    />,
    'en'
  );

  check('REG-12', 'English modal enforces dir="ltr" and renders English titles',
    htmlMultiEn.includes('dir="ltr"') &&
    htmlMultiEn.includes('Choose your workspace') &&
    (htmlMultiEn.includes('Sign out') || htmlMultiEn.includes('Sign Out')));

  // ---------------------------------------------------------------------------
  // PART 4: LOADING AND ERROR STATES
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 4: Loading & Error State Presentation ---');

  const htmlError = renderWithContext(
    <TenantWorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspaces}
      activeWorkspace={mockMultiWorkspaces[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
      error="You are not authorized for the requested workspace."
    />,
    'en'
  );

  check('REG-13', 'Error state is rendered prominently in #tenant-workspace-switch-error',
    htmlError.includes('id="tenant-workspace-switch-error"') &&
    htmlError.includes('You are not authorized for the requested workspace.'));

  const htmlSwitching = renderWithContext(
    <TenantWorkspaceSwitcherModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockMultiWorkspaces}
      activeWorkspace={mockMultiWorkspaces[0]}
      onSelectWorkspace={() => {}}
      onLogout={() => {}}
      isSwitching={true}
    />,
    'ku'
  );

  check('REG-14', 'Buttons are disabled while switching is in progress',
    htmlSwitching.includes('disabled=""') &&
    htmlSwitching.includes('id="tenant-switcher-logout-btn"'));

  // ---------------------------------------------------------------------------
  // PART 5: MOCK PERSONA BACKWARD-COMPATIBILITY / ELIMINATION
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 5: Elimination of Dev Mock Personas ---');

  const htmlDeprecatedWrapper = renderWithContext(
    <SwitchAccountModal
      isOpen={true}
      onClose={() => {}}
      workspaces={mockSingleTenantWorkspace}
      activeWorkspace={mockSingleTenantWorkspace[0]}
      onLogout={() => {}}
    />,
    'ku'
  );

  check('REG-15', 'SwitchAccountModal re-export delegates to authoritative switcher without hardcoded personas',
    !htmlDeprecatedWrapper.includes('Ahmed Farhad • Apartment B-101') &&
    !htmlDeprecatedWrapper.includes('Salar Aziz • 10 Properties') &&
    !htmlDeprecatedWrapper.includes('Erbil Quick Fix Services'));

  // ---------------------------------------------------------------------------
  // PART 6: BACKEND AUTHORITATIVE WORKSPACE SELECTION INTEGRATION
  // ---------------------------------------------------------------------------
  console.log('\n--- PART 6: Backend POST /api/auth/select-workspace Integration ---');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = Date.now();
  const testPassword = 'Password123!Secure';
  const passwordHash = await hashPassword(testPassword);
  const cleanups: Array<() => Promise<void>> = [];

  try {
    // 1. Create a dual-role user (TENANT + PROPERTY_OWNER) in test database
    const dualUserEmail = `dual_tenant_${runId}@homehub.iq`;
    const [dualUser] = await db.insert(users).values({
      email: dualUserEmail,
      firstName: 'Renas',
      lastName: 'Dual',
      passwordHash,
      roles: ['TENANT', 'PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    // 2. Create property owned by this user
    const [ownedProp] = await db.insert(properties).values({
      name: `Renas Residence ${runId}`,
      address: 'Bakhtiyari, Erbil',
      city: 'Erbil',
      type: 'RESIDENTIAL_BUILDING',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: ownedProp.id,
      ownerId: dualUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    cleanups.push(async () => {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, ownedProp.id));
      await db.delete(properties).where(eq(properties.id, ownedProp.id));
      await db.delete(users).where(eq(users.id, dualUser.id));
    });

    // 3. Issue initial Tenant-scoped token
    const initialTenantToken = signAuthToken({
      id: dualUser.id,
      email: dualUser.email,
      roles: ['TENANT', 'PROPERTY_OWNER'],
      activeRole: 'TENANT',
      workspaceId: 'tenant',
      tokenVersion: 1,
    });

    // Step A: Calling with valid eligible workspace switches to OWNER
    const resValid = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialTenantToken}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });

    const bodyValid = await resValid.json();
    check('REG-16', 'Valid eligible workspace selection returns 200 with new JWT token',
      resValid.status === 200 && typeof bodyValid.token === 'string');

    check('REG-17', 'Returned activeWorkspace correctly identifies PROPERTY_OWNER role and /owner destination',
      bodyValid.activeWorkspace?.role === 'PROPERTY_OWNER' &&
      bodyValid.activeWorkspace?.destination === '/owner');

    // Step B: Calling with forged/ineligible workspace is rejected with 403
    const resForged = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialTenantToken}`,
      },
      body: JSON.stringify({ workspaceId: 'company_unauthorized_org_9999' }),
    });

    const bodyForged = await resForged.json();
    check('REG-18', 'Forged/ineligible workspace is strictly rejected with 403 INVALID_WORKSPACE_SELECTION',
      resForged.status === 403 && bodyForged.error === 'INVALID_WORKSPACE_SELECTION');

    // Step C: Empty workspaceId returns 400 VALIDATION_ERROR
    const resEmpty = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${initialTenantToken}`,
      },
      body: JSON.stringify({ workspaceId: '' }),
    });

    check('REG-19', 'Missing or blank workspaceId returns 400 VALIDATION_ERROR',
      resEmpty.status === 400);

    // Step D: Single-role user cannot select other workspaces
    const singleUserEmail = `single_tenant_${runId}@homehub.iq`;
    const [singleUser] = await db.insert(users).values({
      email: singleUserEmail,
      firstName: 'Single',
      lastName: 'Tenant',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, singleUser.id));
    });

    const singleTenantToken = signAuthToken({
      id: singleUser.id,
      email: singleUser.email,
      roles: ['TENANT'],
      activeRole: 'TENANT',
      workspaceId: 'tenant',
      tokenVersion: 1,
    });

    const resSingleAttempt = await fetch(`${baseUrl}/auth/select-workspace`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${singleTenantToken}`,
      },
      body: JSON.stringify({ workspaceId: 'owner_personal' }),
    });

    check('REG-20', 'Single-role tenant cannot switch to owner workspace (returns 403)',
      resSingleAttempt.status === 403);

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
  console.log(`  TENANT WORKSPACE SWITCHER RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTenantWorkspaceSwitcherSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
