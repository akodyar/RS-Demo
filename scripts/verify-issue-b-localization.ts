import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, Page } from 'playwright';
import { createApp } from '../server.js';
import { closePool } from '../src/db/index.js';
import { translations, SupportedLanguage } from '../src/i18n/I18nProvider.js';

const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  'artifacts/evidence-gaps-closure-20261022/screenshots/localization'
);
const IDE_ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\7756e8f5-757f-4652-9b27-841739126ee1';

const LOCALES = [
  { code: 'ku' as SupportedLanguage, dir: 'rtl', label: 'Kurdish Sorani' },
  { code: 'ar' as SupportedLanguage, dir: 'rtl', label: 'Arabic' },
  { code: 'en' as SupportedLanguage, dir: 'ltr', label: 'English' },
];

interface TestResult {
  locale: string;
  area: string;
  testName: string;
  passed: boolean;
  details?: string;
}

const testResults: TestResult[] = [];

async function capture(page: Page, filename: string): Promise<string> {
  const localPath = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  if (fs.existsSync(IDE_ARTIFACT_DIR)) {
    try {
      fs.copyFileSync(localPath, path.join(IDE_ARTIFACT_DIR, filename));
    } catch {}
  }
  return localPath;
}

async function runLocalizationAudit() {
  console.log('========================================================================');
  console.log('🌐 HOMEHUB — ISSUE B: COMPREHENSIVE LOCALIZATION AUDIT & VERIFICATION');
  console.log('========================================================================');

  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  }

  const app = await createApp();
  const server = http.createServer(app);
  const PORT = 3088;

  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;
  console.log(`[Setup] Local Express + Vite test server listening on ${baseUrl}`);

  console.log('[Setup] Launching project-local Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  console.log('[Setup] Warming up Vite dev server at root...');
  await page.goto(`${baseUrl}/?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(1000);
  console.log('[Setup] Vite server warmed up successfully.');

  try {
    for (const locale of LOCALES) {
      console.log(`\n------------------------------------------------------------------------`);
      console.log(`📍 Testing Locale: ${locale.label} (${locale.code.toUpperCase()}) | Direction: ${locale.dir.toUpperCase()}`);
      console.log(`------------------------------------------------------------------------`);

      const dict = translations[locale.code];

      // -------------------------------------------------------------
      // AREA 1: ADMIN FEE MANAGEMENT & TIERED PRICING
      // -------------------------------------------------------------
      console.log(`[Area 1] Admin Fee Management & Tiered Pricing (${locale.code})...`);
      await page.evaluate(
        ({ code }) => {
          localStorage.setItem('homehub_lang', code);
          localStorage.setItem('auth_token', 'dev-platform_admin');
          localStorage.setItem(
            'homehub_auth_persona',
            JSON.stringify({
              id: 'admin_user_01',
              role: 'SUPER_ADMIN',
              roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
            })
          );
        },
        { code: locale.code }
      );
      await page.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);

      // Verify HTML dir and lang
      const htmlDir = await page.getAttribute('html', 'dir');
      const htmlLang = await page.getAttribute('html', 'lang');
      console.log(`  - <html> dir="${htmlDir}", lang="${htmlLang}"`);
      const dirMatches = htmlDir === locale.dir;
      const langMatches = htmlLang === locale.code;
      testResults.push({
        locale: locale.code,
        area: 'Shared UI',
        testName: `HTML Direction & Language Attribute matches ${locale.dir}/${locale.code}`,
        passed: dirMatches && langMatches,
        details: `dir=${htmlDir}, lang=${htmlLang}`,
      });

      // Navigate to Settings Module via quick action
      const settingsQuickAction = page.locator('[data-testid="admin-quick-action-settings"]');
      await settingsQuickAction.waitFor({ state: 'visible', timeout: 10000 });
      await settingsQuickAction.click();
      await page.waitForTimeout(600);

      // Verify AdminSettingsModule fee input
      const feeInput = page.locator('[data-testid="admin-platform-fee-input"]');
      await feeInput.waitFor({ state: 'visible', timeout: 10000 });
      const feeInputValue = await feeInput.inputValue();
      console.log(`  - Platform fee input value: "${feeInputValue}" (Expected 0.03)`);
      testResults.push({
        locale: locale.code,
        area: 'Admin Fee Management',
        testName: 'Global Platform Fee input displays 0.03',
        passed: feeInputValue === '0.03',
        details: `value=${feeInputValue}`,
      });

      // Assert Fee Settings Heading matches locale dictionary
      const heading = await page.locator('h2').innerText();
      const expectedFeeHeading = dict['fee.admin_title'] || 'Fee Management & Operating Policies';
      const headingExpected = heading.includes(expectedFeeHeading);
      console.log(`  - Heading text: "${heading.trim()}" -> ${headingExpected ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Admin Fee Management',
        testName: 'Admin Fee Settings Heading Localized',
        passed: headingExpected,
        details: heading.trim(),
      });

      // Test localized validation error by entering rate > 0.50
      await feeInput.fill('0.75');
      await page.waitForTimeout(300);
      const feeError = page.locator('[data-testid="admin-platform-fee-error"]');
      await feeError.waitFor({ state: 'visible', timeout: 5000 });
      const feeErrorText = await feeError.innerText();
      const expectedFeeError = dict['fee.err_max'] || 'Rate cannot exceed 50%';
      const feeErrorLocalized = feeErrorText.includes(expectedFeeError);
      console.log(`  - Rate error message: "${feeErrorText}" -> ${feeErrorLocalized ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Admin Fee Management',
        testName: 'Platform Fee validation error localized',
        passed: feeErrorLocalized,
        details: feeErrorText,
      });

      // Reset fee input to 0.03
      await feeInput.fill('0.03');
      await page.waitForTimeout(200);

      const feeShot = await capture(page, `01-admin-fee-management-${locale.code}-${locale.dir}.png`);
      console.log(`  📸 Captured: ${path.basename(feeShot)}`);

      // Return to Dashboard from Settings
      const backBtn = page.locator('[data-testid="admin-settings-back-btn"]');
      await backBtn.click();
      await page.waitForTimeout(500);

      // Open More Menu via Bottom Nav to access Tiered Pricing
      const moreNavBtn = page.locator('[data-testid="admin-nav-more"]');
      await moreNavBtn.waitFor({ state: 'visible', timeout: 5000 });
      await moreNavBtn.click();
      await page.waitForTimeout(400);

      // Click Tiered Pricing in More Menu
      const pricingMenuBtn = page.locator('[data-testid="admin-module-pricing"]');
      await pricingMenuBtn.waitFor({ state: 'visible', timeout: 5000 });
      await pricingMenuBtn.click();
      await page.waitForTimeout(600);

      // Assert Tiered Pricing Module title matches locale dictionary
      const pricingHeading = await page.locator('h2').innerText();
      const expectedPricingHeading = dict['pricing.title'] || 'Tiered Pricing Configuration';
      const pricingHeadingLocalized = pricingHeading.includes(expectedPricingHeading);
      console.log(`  - Pricing heading: "${pricingHeading.trim()}" -> ${pricingHeadingLocalized ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Admin Fee Management',
        testName: 'Pricing Tiers Module Heading Localized',
        passed: pricingHeadingLocalized,
        details: pricingHeading.trim(),
      });

      // Open Create New Tier Modal
      const createTierBtn = page.locator('[data-testid="create-tier-btn"]');
      await createTierBtn.waitFor({ state: 'visible', timeout: 5000 });
      await createTierBtn.click();
      await page.waitForTimeout(400);

      const modalTitle = page.locator('#create-tier-modal-title');
      const modalTitleText = await modalTitle.innerText();
      const expectedModalTitle = dict['pricing.modal_title'] || 'Create New Pricing Tier';
      const modalTitleLocalized = modalTitleText.includes(expectedModalTitle);
      console.log(`  - Create Tier modal title: "${modalTitleText}" -> ${modalTitleLocalized ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Admin Fee Management',
        testName: 'Create Tier Modal Title Localized',
        passed: modalTitleLocalized,
        details: modalTitleText,
      });

      const modalShot = await capture(page, `02-pricing-tier-modal-${locale.code}-${locale.dir}.png`);
      console.log(`  📸 Captured: ${path.basename(modalShot)}`);

      // Trigger validation error in Create Tier Modal
      const submitBtn = page.locator('[data-testid="tier-submit-btn"]');
      await submitBtn.click();
      await page.waitForTimeout(300);

      const nameError = page.locator('[data-testid="tier-name-error"]');
      await nameError.waitFor({ state: 'visible', timeout: 5000 });
      const nameErrorText = await nameError.innerText();
      const expectedNameError = dict['pricing.err_name_required'] || 'Tier name is required';
      const nameErrorLocalized = nameErrorText.includes(expectedNameError);
      console.log(`  - Tier name validation error: "${nameErrorText}" -> ${nameErrorLocalized ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Admin Fee Management',
        testName: 'Tier Modal Validation Error Localized',
        passed: nameErrorLocalized,
        details: nameErrorText,
      });

      const valShot = await capture(page, `03-pricing-tier-validation-${locale.code}-${locale.dir}.png`);
      console.log(`  📸 Captured: ${path.basename(valShot)}`);

      // Close modal by clicking Cancel button
      const tierCancelBtn = page.locator('[data-testid="tier-cancel-btn"]');
      await tierCancelBtn.click();
      await page.locator('#create-tier-modal-title').waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(300);

      // Return to Dashboard from Pricing
      const pricingBackBtn = page.locator('[data-testid="admin-pricing-back-btn"]');
      await pricingBackBtn.waitFor({ state: 'visible', timeout: 5000 });
      await pricingBackBtn.click();
      await pricingBackBtn.waitFor({ state: 'hidden', timeout: 5000 });
      await page.waitForTimeout(500);

      // -------------------------------------------------------------
      // AREA 2: PROPERTY VERIFICATION LIFECYCLE
      // -------------------------------------------------------------
      console.log(`\n[Area 2] Property Verification Lifecycle (${locale.code})...`);
      const propsAction = page.locator('[data-testid="admin-quick-action-properties"]');
      await propsAction.waitFor({ state: 'visible', timeout: 10000 });
      await propsAction.click();
      await page.waitForTimeout(800);

      // Wait for properties list to finish loading and cards to appear
      const inspectPropBtn = page.locator('button[data-testid^="admin-inspect-prop-btn-"]').first();
      await inspectPropBtn.waitFor({ state: 'visible', timeout: 15000 });
      await inspectPropBtn.click();
      await page.waitForTimeout(600);

      const rejectBtn = page.locator('[data-testid="admin-reject-btn"]');
      const approveBtn = page.locator('[data-testid="admin-approve-btn"]');
      const rejectInput = page.locator('[data-testid="admin-reject-reason-input"]');

      const inspectVisible = (await rejectBtn.isVisible()) && (await approveBtn.isVisible()) && (await rejectInput.isVisible());
      console.log(`  - Property inspection modal controls visible: ${inspectVisible ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Property Verification',
        testName: 'Property Inspection Decision Controls Rendered',
        passed: inspectVisible,
      });

      const verifShot = await capture(page, `04-property-verification-inspect-${locale.code}-${locale.dir}.png`);
      console.log(`  📸 Captured: ${path.basename(verifShot)}`);

      // Close inspection modal by clicking close button
      const closeBtn = page.locator('[data-testid="admin-inspect-close-btn"], [data-testid="admin-inspect-close-btn-bottom"], button:has-text("داخستن (Close)")').first();
      if (await closeBtn.isVisible({ timeout: 3000 })) {
        await closeBtn.click();
        await page.waitForTimeout(400);
      }

      // -------------------------------------------------------------
      // AREA 3: POST-CREATION MANAGEMENT CHOICE
      // -------------------------------------------------------------
      console.log(`\n[Area 3] Post-Creation Owner Management Choice (${locale.code})...`);
      await page.evaluate(
        ({ code }) => {
          localStorage.setItem('homehub_lang', code);
          localStorage.setItem('auth_token', 'dev-owner');
          localStorage.setItem(
            'homehub_auth_persona',
            JSON.stringify({
              id: 'user_owner_01',
              role: 'PROPERTY_OWNER',
              roles: ['PROPERTY_OWNER'],
            })
          );
        },
        { code: locale.code }
      );

      // Open property creation wizard directly with step 10 / query parameter
      await page.goto(`${baseUrl}/properties/add?prop_id=demo_prop_01`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForTimeout(800);

      // Verify all 3 options exist
      const optionSelf = page.locator('[data-testid="option-self-managed"]');
      const optionHomehub = page.locator('[data-testid="option-homehub-managed"]');
      const optionAgent = page.locator('[data-testid="option-agent-managed"]');

      await optionSelf.waitFor({ state: 'visible', timeout: 15000 });
      await optionHomehub.waitFor({ state: 'visible', timeout: 5000 });
      await optionAgent.waitFor({ state: 'visible', timeout: 5000 });

      testResults.push({
        locale: locale.code,
        area: 'Management Choice',
        testName: 'All 3 Management Options Rendered',
        passed: true,
      });

      // Verify option titles localized
      const selfTitle = await optionSelf.innerText();
      const homehubTitle = await optionHomehub.innerText();
      const agentTitle = await optionAgent.innerText();

      let titlesLocalized = false;
      if (locale.code === 'ku') {
        titlesLocalized =
          selfTitle.includes('بەڕێوەبردنی خۆیی') &&
          homehubTitle.includes('بەڕێوەبردن لەلایەن هۆم‌هەب') &&
          agentTitle.includes('بەڕێوەبردن لەلایەن ئاژانس / کۆمپانیا');
      } else if (locale.code === 'ar') {
        titlesLocalized =
          selfTitle.includes('إدارة ذاتية') &&
          homehubTitle.includes('إدارة هوم هب') &&
          agentTitle.includes('إدارة وكيل / شركة');
      } else {
        titlesLocalized =
          selfTitle.includes('Self-Managed') &&
          homehubTitle.includes('HomeHub-Managed') &&
          agentTitle.includes('Agent-Managed');
      }
      console.log(`  - Management choice titles localized: ${titlesLocalized ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Management Choice',
        testName: 'Management Choice Titles Localized',
        passed: titlesLocalized,
        details: `Self: ${selfTitle.slice(0, 25)}, HomeHub: ${homehubTitle.slice(0, 25)}, Agent: ${agentTitle.slice(0, 25)}`,
      });

      // Select Option B (HOMEHUB_MANAGED)
      await optionHomehub.click();
      await page.waitForTimeout(300);

      // Confirm preference selection
      const confirmBtn = page.locator('[data-testid="save-management-preference-btn"]');
      await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
      await confirmBtn.click();
      await page.waitForTimeout(600);

      const savedAlert = page.locator('[data-testid="preference-saved-banner"]');
      await savedAlert.waitFor({ state: 'visible', timeout: 8000 });
      const alertVisible = await savedAlert.isVisible();
      console.log(`  - Preference saved alert visible: ${alertVisible ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Management Choice',
        testName: 'Preference Saved Banner Displayed',
        passed: alertVisible,
      });

      const choiceShot = await capture(page, `05-management-choice-${locale.code}-${locale.dir}.png`);
      console.log(`  📸 Captured: ${path.basename(choiceShot)}`);

      // -------------------------------------------------------------
      // AREA 4: RELOAD PERSISTENCE & RESPONSIVE LAYOUT (NO OVERFLOW)
      // -------------------------------------------------------------
      console.log(`\n[Area 4] Reload Persistence & Responsive Layout (${locale.code})...`);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(800);

      // Assert persisted language in localStorage
      const persistedLang = await page.evaluate(() => localStorage.getItem('homehub_lang'));
      const langPersisted = persistedLang === locale.code;
      console.log(`  - Persisted language after reload: "${persistedLang}" -> ${langPersisted ? 'PASS' : 'FAIL'}`);
      testResults.push({
        locale: locale.code,
        area: 'Shared UI',
        testName: 'Locale Persisted in LocalStorage after Reload',
        passed: langPersisted,
        details: `persisted=${persistedLang}`,
      });

      // Check horizontal overflow
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  - Horizontal layout overflow detected: ${isOverflowing ? 'YES (FAIL)' : 'NO (PASS)'}`);
      testResults.push({
        locale: locale.code,
        area: 'Shared UI',
        testName: 'Responsive Viewport Zero Horizontal Overflow',
        passed: !isOverflowing,
      });

      const persistShot = await capture(page, `06-management-choice-persisted-${locale.code}-${locale.dir}.png`);
      console.log(`  📸 Captured: ${path.basename(persistShot)}`);
    }

    console.log('\n========================================================================');
    console.log('📊 ISSUE B LOCALIZATION TEST MATRIX SUMMARY');
    console.log('========================================================================');

    let totalPassed = 0;
    let totalFailed = 0;

    for (const r of testResults) {
      if (r.passed) {
        totalPassed++;
        console.log(`  ✅ [PASS] [${r.locale.toUpperCase()}] [${r.area}] ${r.testName}`);
      } else {
        totalFailed++;
        console.log(`  ❌ [FAIL] [${r.locale.toUpperCase()}] [${r.area}] ${r.testName} (${r.details || ''})`);
      }
    }

    console.log(`\nTotal Assertions: ${testResults.length}`);
    console.log(`Passed: ${totalPassed}`);
    console.log(`Failed: ${totalFailed}`);

    // Save summary report JSON
    const reportPath = path.join(process.cwd(), 'artifacts/evidence-gaps-closure-20261022/reports/LOCALIZATION_MATRIX_REPORT.json');
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ testResults, summary: { total: testResults.length, passed: totalPassed, failed: totalFailed } }, null, 2)
    );
    console.log(`Saved localization matrix report: ${reportPath}`);

    if (totalFailed > 0) {
      console.error(`Localization audit failed with ${totalFailed} failing assertions.`);
      process.exitCode = 1;
    } else {
      console.log('🎉 Issue B Localization Audit: 100% PASSED across all 3 locales!');
      process.exitCode = 0;
    }
  } catch (err: any) {
    console.error('Fatal error during localization audit:', err);
    process.exitCode = 1;
  } finally {
    await browser.close().catch(() => {});
    await new Promise<void>((resolve) => server.close(() => resolve())).catch(() => {});
    await closePool().catch(() => {});
    console.log('[Cleanup] Browser, server, and database connection cleanly closed.');
    process.exit(process.exitCode || 0);
  }
}

runLocalizationAudit().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
