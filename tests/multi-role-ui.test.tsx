import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, EligibleWorkspace } from '../src/components/AuthProvider.tsx';
import { InfrastructureProvider } from '../src/components/InfrastructureProvider.tsx';
import { I18nProvider } from '../src/i18n/I18nProvider.tsx';
import { ScreenSelectWorkspace } from '../src/components/onboarding/ScreenSelectWorkspace.tsx';
import { OnboardingWorkflow } from '../src/components/onboarding/OnboardingWorkflow.tsx';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string, details?: any) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`, details ? `— Details: ${JSON.stringify(details)}` : '');
    failed++;
  }
}

const mockWorkspaces: EligibleWorkspace[] = [
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
    workspaceId: 'company_org_123',
    role: 'COMPANY_ADMIN',
    title: 'بەڕێوەبەری کۆمپانیا (Zagros Real Estate)',
    titleKey: 'workspace.company',
    destination: '/owner',
    status: 'ACTIVE',
    isCompany: true,
    organizationId: 'org_123',
    organizationName: 'Zagros Real Estate',
  },
  {
    workspaceId: 'agent',
    role: 'AGENT_BROKER',
    title: 'ئەگێنت / برۆکەر',
    titleKey: 'workspace.agent',
    destination: '/agent',
    status: 'PENDING_VERIFICATION',
    isCompany: false,
  },
];

function renderWithI18n(ui: React.ReactElement, lang: 'ku' | 'ar' | 'en' = 'ku') {
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

async function runMultiRoleUiSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — MULTI-ROLE WORKSPACE SELECTOR UI TEST SUITE');
  console.log('================================================================\n');

  // --- PART 1: KURDISH SORANI (RTL) ---
  console.log('--- TEST 1: Kurdish Sorani RTL Workspace Selection UI ---');
  const htmlKu = renderWithI18n(
    <ScreenSelectWorkspace
      workspaces={mockWorkspaces}
      onSelectWorkspace={() => {}}
      userName="Aram Ahmed"
    />,
    'ku'
  );

  assert(htmlKu.includes('dir="rtl"'), 'UI-01', 'Kurdish selection screen enforces dir="rtl"');
  assert(htmlKu.includes('شوێنی کارەکەت هەڵبژێرە'), 'UI-02', 'Renders Kurdish header: شوێنی کارەکەت هەڵبژێرە');
  assert(htmlKu.includes('id="workspace-card-owner_personal"'), 'UI-03', 'Renders Owner personal workspace card');
  assert(htmlKu.includes('id="workspace-card-tenant"'), 'UI-04', 'Renders Tenant workspace card');
  assert(htmlKu.includes('id="workspace-card-company_org_123"'), 'UI-05', 'Renders Company workspace card');
  assert(htmlKu.includes('id="workspace-card-agent"'), 'UI-06', 'Renders Agent workspace card');
  assert(htmlKu.includes('لە چاوەڕوانی پەسەندکردن'), 'UI-07', 'Pending agent card displays pending status badge');
  assert(htmlKu.includes('چالاک'), 'UI-08', 'Active workspace displays active status badge');
  assert(htmlKu.includes('کۆمپانیا'), 'UI-09', 'Company workspace displays company badge');
  assert(htmlKu.includes('id="select-workspace-submit-btn"'), 'UI-10', 'Submit CTA button exists');

  // --- PART 2: ARABIC (RTL) ---
  console.log('\n--- TEST 2: Arabic RTL Workspace Selection UI ---');
  const htmlAr = renderWithI18n(
    <ScreenSelectWorkspace
      workspaces={mockWorkspaces}
      onSelectWorkspace={() => {}}
      userName="Aram Ahmed"
    />,
    'ar'
  );

  assert(htmlAr.includes('dir="rtl"'), 'UI-11', 'Arabic selection screen enforces dir="rtl"');
  assert(htmlAr.includes('اختر مساحة العمل الخاصة بك'), 'UI-12', 'Renders Arabic header: اختر مساحة العمل الخاصة بك');
  assert(htmlAr.includes('قيد المراجعة'), 'UI-13', 'Pending agent card displays Arabic pending status: قيد المراجعة');
  assert(htmlAr.includes('نشط'), 'UI-14', 'Active workspace displays Arabic active badge: نشط');

  // --- PART 3: ENGLISH (LTR) ---
  console.log('\n--- TEST 3: English LTR Workspace Selection UI ---');
  const htmlEn = renderWithI18n(
    <ScreenSelectWorkspace
      workspaces={mockWorkspaces}
      onSelectWorkspace={() => {}}
      userName="Aram Ahmed"
    />,
    'en'
  );

  assert(htmlEn.includes('dir="ltr"'), 'UI-15', 'English selection screen enforces dir="ltr"');
  assert(htmlEn.includes('Choose your workspace'), 'UI-16', 'Renders English header: Choose your workspace');
  assert(htmlEn.includes('Pending Review'), 'UI-17', 'Pending agent card displays English pending status');
  assert(htmlEn.includes('Active'), 'UI-18', 'Active workspace displays English active badge');
  assert(htmlEn.includes('Enter Workspace'), 'UI-19', 'Renders English submit button: Enter Workspace');

  // --- PART 4: ONBOARDING WORKFLOW INTEGRATION ---
  console.log('\n--- TEST 4: OnboardingWorkflow Integration ---');
  const workflowHtml = renderWithI18n(
    <OnboardingWorkflow initialStep="select_workspace" />,
    'ku'
  );

  assert(workflowHtml.includes('select-workspace-submit-btn') || workflowHtml.includes('شوێنی کارەکەت هەڵبژێرە'), 'UI-20', 'OnboardingWorkflow initialStep="select_workspace" renders workspace selector');

  console.log('\n================================================================');
  console.log(`  MULTI-ROLE UI RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMultiRoleUiSuite().catch((err) => {
  console.error('Fatal UI test error:', err);
  process.exit(1);
});
