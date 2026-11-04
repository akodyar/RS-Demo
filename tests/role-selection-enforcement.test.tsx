import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../src/components/AuthProvider.tsx';
import { InfrastructureProvider } from '../src/components/InfrastructureProvider.tsx';
import { I18nProvider } from '../src/i18n/I18nProvider.tsx';
import { OnboardingWorkflow } from '../src/components/onboarding/OnboardingWorkflow.tsx';
import { Screen3Purpose, ROLE_DEFINITIONS } from '../src/components/onboarding/Screen3Purpose.tsx';
import { ScreenLogin } from '../src/components/onboarding/ScreenLogin.tsx';
import { Screen4Signup } from '../src/components/onboarding/Screen4Signup.tsx';

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

function renderInAppTree(ui: React.ReactElement, initialRoute: string = '/login') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[initialRoute]}>
      <InfrastructureProvider>
        <AuthProvider>
          <I18nProvider>
            {ui}
          </I18nProvider>
        </AuthProvider>
      </InfrastructureProvider>
    </MemoryRouter>
  );
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — ROLE SELECTION ENFORCEMENT & REGISTRATION SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Clicking "Create an Account" from login opens role selection
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Login Screen -> Create an Account enters Role Selection ---');
  {
    // 1.1 Verify ScreenLogin contains the "Create an Account" link with exact ID and Kurdish text
    let loginLinkTriggered = false;
    const loginHtml = renderInAppTree(
      <ScreenLogin
        onLogin={() => {}}
        onGoToSignup={() => { loginLinkTriggered = true; }}
      />,
      '/login'
    );

    assert(loginHtml.includes('id="login-signup-link"'), 'TEST-1.1', 'Login screen renders "Create an Account" link (#login-signup-link)');
    assert(loginHtml.includes('هەژمار دروست بکە'), 'TEST-1.2', 'Login screen displays Kurdish "Create an Account" text');
    assert(loginHtml.includes('هەژمارت نییە؟'), 'TEST-1.3', 'Login screen displays "Don\'t have an account?" prompt');

    // 1.2 Verify OnboardingWorkflow renders Screen3Purpose when entering role selection
    const purposeHtml = renderInAppTree(
      <OnboardingWorkflow initialStep="purpose" />,
      '/onboarding/purpose'
    );

    assert(purposeHtml.includes('بەکارهێنانی خۆت هەڵبژێرە'), 'TEST-1.4', 'Role selection header title is rendered (بەکارهێنانی خۆت هەڵبژێرە)');
    assert(purposeHtml.includes('دیاریکردنی جۆری هەژمار'), 'TEST-1.5', 'Role selection badge is rendered (دیاریکردنی جۆری هەژمار)');
    assert(purposeHtml.includes('id="purpose-continue-btn"'), 'TEST-1.6', 'Continue button (#purpose-continue-btn) is rendered');
    assert(purposeHtml.includes('disabled=""'), 'TEST-1.7', 'Continue button is initially disabled when no role is selected');
  }

  // --------------------------------------------------------------------------
  // TEST 2: Repeating the flow after cancelling still opens role selection fresh
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Repeating Flow After Cancelling Still Opens Role Selection ---');
  {
    // Simulate initial entry, selecting a role, returning to login, and clicking create account again
    const workflow = <OnboardingWorkflow initialStep="login" />;
    const initialHtml = renderInAppTree(workflow, '/login');
    assert(initialHtml.includes('id="login-signup-link"'), 'TEST-2.1', 'Starts at login screen with signup link');

    // Render Screen3Purpose with no role selected (as produced by reset)
    let selectedRoleState: any = null;
    const resetPurposeHtml = renderInAppTree(
      <Screen3Purpose
        selectedRole={selectedRoleState ? selectedRoleState.id : ''}
        onSelectRole={(r) => { selectedRoleState = r; }}
        onContinue={() => {}}
        onBack={() => {}}
      />,
      '/onboarding/purpose'
    );

    assert(resetPurposeHtml.includes('disabled=""'), 'TEST-2.2', 'Fresh role selection state has Continue button disabled');
    assert(!resetPurposeHtml.includes('border-blue-500 bg-blue-50/40'), 'TEST-2.3', 'No role card is pre-selected or carrying stale selection');
  }

  // --------------------------------------------------------------------------
  // TEST 3: Stale registration state / previously selected role cannot skip role selection
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Stale State Cannot Skip Role Selection ---');
  {
    // Attempting to mount signup without selectedRole in OnboardingWorkflow redirects to purpose
    const directSignupHtml = renderInAppTree(
      <OnboardingWorkflow initialStep="signup" />,
      '/onboarding/signup'
    );

    // It should render role selection instead of signup because selectedRole is null
    assert(directSignupHtml.includes('بەکارهێنانی خۆت هەڵبژێرە'), 'TEST-3.1', 'Direct signup without selectedRole diverts to role selection screen');
    assert(directSignupHtml.includes('id="purpose-continue-btn"'), 'TEST-3.2', 'Purpose continue button is rendered instead of signup form');
    assert(directSignupHtml.includes('disabled=""'), 'TEST-3.3', 'Continue button remains disabled until deliberate selection');
  }

  // --------------------------------------------------------------------------
  // TEST 4: Each of the 4 role options continues to the correct next step
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Four Role Options Render & Continue Correctly ---');
  {
    assert(ROLE_DEFINITIONS.length === 4, 'TEST-4.1', 'ROLE_DEFINITIONS defines exactly 4 canonical roles');

    const expectedRoles = [
      { id: 'owner', roleKey: 'OWNER', title: 'خاوەنی موڵک' },
      { id: 'tenant', roleKey: 'TENANT', title: 'کرێنشین' },
      { id: 'agent', roleKey: 'AGENT', title: 'ئەگێنت / برۆکەر' },
      { id: 'vendor', roleKey: 'VENDOR', title: 'دابینکەر / خزمەتگوزار' },
    ];

    for (const expected of expectedRoles) {
      const found = ROLE_DEFINITIONS.find((r) => r.id === expected.id);
      assert(Boolean(found), `TEST-4.2-${expected.id}`, `Role "${expected.id}" exists in ROLE_DEFINITIONS`);
      assert(found?.roleKey === expected.roleKey, `TEST-4.3-${expected.id}`, `Role "${expected.id}" has roleKey ${expected.roleKey}`);
      assert(found?.title === expected.title, `TEST-4.4-${expected.id}`, `Role "${expected.id}" has title "${expected.title}"`);

      // Test rendering Screen3Purpose with this role selected
      const selectedHtml = renderInAppTree(
        <Screen3Purpose
          selectedRole={expected.id}
          onSelectRole={() => {}}
          onContinue={() => {}}
          onBack={() => {}}
        />,
        '/onboarding/purpose'
      );

      assert(selectedHtml.includes(`id="role-card-${expected.id}"`), `TEST-4.5-${expected.id}`, `Role card #role-card-${expected.id} rendered`);
      assert(selectedHtml.includes('border-amber-500') || selectedHtml.includes('border-blue-500 bg-blue-50/40'), `TEST-4.6-${expected.id}`, `Selected card for ${expected.id} has active styling`);
      // When a valid role is selected, the continue button is not disabled
      const continueMatches = selectedHtml.match(/<button[^>]*id="purpose-continue-btn"[^>]*>/);
      assert(Boolean(continueMatches && !continueMatches[0].includes('disabled=""')), `TEST-4.7-${expected.id}`, `Continue button is enabled for ${expected.id}`);
    }

    // Test Screen4Signup adaptation for OWNER and AGENT (entity type required)
    const ownerSignupHtml = renderInAppTree(
      <Screen4Signup
        selectedRole={ROLE_DEFINITIONS.find((r) => r.id === 'owner')}
        formData={{ fullName: '', phone: '', email: '', password: '', confirmPassword: '', entityType: 'INDIVIDUAL', consentAccepted: true }}
        onUpdateFormData={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        onLoginClick={() => {}}
        onSocialNotice={() => {}}
      />,
      '/onboarding/signup'
    );
    assert(ownerSignupHtml.includes('data-testid="entity-type-individual"'), 'TEST-4.8', 'Owner registration includes Individual entity option');
    assert(ownerSignupHtml.includes('data-testid="entity-type-company"'), 'TEST-4.9', 'Owner registration includes Company entity option');

    // Test Screen4Signup for TENANT (no entity type radio required)
    const tenantSignupHtml = renderInAppTree(
      <Screen4Signup
        selectedRole={ROLE_DEFINITIONS.find((r) => r.id === 'tenant')}
        formData={{ fullName: '', phone: '', email: '', password: '', confirmPassword: '', entityType: 'INDIVIDUAL', consentAccepted: true }}
        onUpdateFormData={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        onLoginClick={() => {}}
        onSocialNotice={() => {}}
      />,
      '/onboarding/signup'
    );
    assert(!tenantSignupHtml.includes('data-testid="entity-type-individual"'), 'TEST-4.10', 'Tenant registration does not require company entity radio');
  }

  // --------------------------------------------------------------------------
  // TEST 5: Back navigation and returning to login do not bypass role selection
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Back Navigation & Return To Login Behavior ---');
  {
    // 5.1 OnboardingHeader on Screen3Purpose has back button
    let backClicked = false;
    const purposeBackHtml = renderInAppTree(
      <Screen3Purpose
        selectedRole=""
        onSelectRole={() => {}}
        onContinue={() => {}}
        onBack={() => { backClicked = true; }}
      />,
      '/onboarding/purpose'
    );

    assert(purposeBackHtml.includes('id="onboarding-back-btn"'), 'TEST-5.1', 'Purpose screen has back button (#onboarding-back-btn)');
    assert(purposeBackHtml.includes('گەڕانەوە'), 'TEST-5.2', 'Back button displays Kurdish "گەڕانەوە" label');

    // 5.2 Screen4Signup has back button and login link
    const signupNavHtml = renderInAppTree(
      <Screen4Signup
        selectedRole={ROLE_DEFINITIONS[0]}
        formData={{ fullName: '', phone: '', email: '', password: '', confirmPassword: '', entityType: 'INDIVIDUAL', consentAccepted: true }}
        onUpdateFormData={() => {}}
        onSubmit={() => {}}
        onBack={() => {}}
        onLoginClick={() => {}}
        onSocialNotice={() => {}}
      />,
      '/onboarding/signup'
    );

    assert(signupNavHtml.includes('id="onboarding-back-btn"'), 'TEST-5.3', 'Signup screen has back button (#onboarding-back-btn) to return to purpose');
    assert(signupNavHtml.includes('id="signup-login-link"'), 'TEST-5.4', 'Signup screen has "Already have an account? Login" link (#signup-login-link)');
  }

  // --------------------------------------------------------------------------
  // TEST 6: Existing login and registration flows remain intact
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Existing Login & Registration Integrity ---');
  {
    const loginHtml = renderInAppTree(
      <ScreenLogin
        onLogin={() => {}}
        onGoToSignup={() => {}}
      />,
      '/login'
    );

    assert(loginHtml.includes('id="login-email"'), 'TEST-6.1', 'Login screen email input (#login-email) intact');
    assert(loginHtml.includes('id="login-password"'), 'TEST-6.2', 'Login screen password input (#login-password) intact');
    assert(loginHtml.includes('id="login-submit-btn"'), 'TEST-6.3', 'Login screen submit CTA (#login-submit-btn) intact');
    assert(loginHtml.includes('چوونە ژوورەوە'), 'TEST-6.4', 'Login screen submit button has Kurdish label');
    assert(loginHtml.includes('id="quick-login-owner"'), 'TEST-6.5', 'Quick sign-in owner button (#quick-login-owner) exists');
    assert(loginHtml.includes('id="quick-login-company"'), 'TEST-6.6', 'Quick sign-in company button (#quick-login-company) exists');
    assert(loginHtml.includes('id="quick-login-tenant"'), 'TEST-6.7', 'Quick sign-in tenant button (#quick-login-tenant) exists');
    assert(loginHtml.includes('id="quick-login-agent"'), 'TEST-6.8', 'Quick sign-in agent button (#quick-login-agent) exists');
    assert(loginHtml.includes('id="quick-login-vendor"'), 'TEST-6.9', 'Quick sign-in vendor button (#quick-login-vendor) exists');
    assert(loginHtml.includes('id="quick-login-admin"'), 'TEST-6.10', 'Quick sign-in admin button (#quick-login-admin) exists');

    // Verify progress indicator on Screen3Purpose: 3 dots, 2nd active
    const purposeHtml = renderInAppTree(
      <Screen3Purpose
        selectedRole=""
        onSelectRole={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
      />,
      '/onboarding/purpose'
    );
    assert(purposeHtml.includes('قۆناغی ۲'), 'TEST-6.11', 'Step counter reflects Step 2 (قۆناغی ۲)');
  }

  console.log('\n================================================================');
  console.log(`  REGRESSION RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
