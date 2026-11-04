import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('screenshots/rtl_ltr_audit');
const ARTIFACT_DIR = path.resolve(
  'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2/audit'
);

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

interface TestTarget {
  name: string;
  url: string;
  lang: 'ku' | 'ar' | 'en';
  expectedDir: 'rtl' | 'ltr';
  selector?: string;
}

const targets: TestTarget[] = [
  // Services Page
  { name: '01_services_page_kurdish_rtl', url: 'http://localhost:3000/services', lang: 'ku', expectedDir: 'rtl' },
  { name: '02_services_page_english_ltr', url: 'http://localhost:3000/services', lang: 'en', expectedDir: 'ltr' },
  { name: '03_services_page_arabic_rtl', url: 'http://localhost:3000/services', lang: 'ar', expectedDir: 'rtl' },

  // Rent Management Page
  { name: '04_rent_management_kurdish_rtl', url: 'http://localhost:3000/rent-management', lang: 'ku', expectedDir: 'rtl' },
  { name: '05_rent_management_english_ltr', url: 'http://localhost:3000/rent-management', lang: 'en', expectedDir: 'ltr' },

  // Tenant Onboarding
  { name: '06_tenant_onboarding_kurdish_rtl', url: 'http://localhost:3000/onboarding/tenant', lang: 'ku', expectedDir: 'rtl' },
  { name: '07_tenant_onboarding_english_ltr', url: 'http://localhost:3000/onboarding/tenant', lang: 'en', expectedDir: 'ltr' },

  // Admin Login with LanguageSelector
  { name: '08_admin_login_kurdish_rtl', url: 'http://localhost:3000/admin/login', lang: 'ku', expectedDir: 'rtl' },
  { name: '09_admin_login_english_ltr', url: 'http://localhost:3000/admin/login', lang: 'en', expectedDir: 'ltr' },
  { name: '10_admin_login_arabic_rtl', url: 'http://localhost:3000/admin/login', lang: 'ar', expectedDir: 'rtl' },

  // Property Command Center
  { name: '11_property_command_kurdish_rtl', url: 'http://localhost:3000/property/prop-001/command', lang: 'ku', expectedDir: 'rtl' },
  { name: '12_property_command_english_ltr', url: 'http://localhost:3000/property/prop-001/command', lang: 'en', expectedDir: 'ltr' },
];

async function run() {
  console.log('=== STARTING RTL/LTR VISUAL & DOM DIRECTION VERIFICATION ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const results: any[] = [];

  for (const t of targets) {
    console.log(`Testing [${t.name}] | URL: ${t.url} | Lang: ${t.lang} | Expecting: ${t.expectedDir.toUpperCase()}`);

    // Set language in localStorage before navigating
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate((lang) => {
      localStorage.setItem('homehub_lang', lang);
      localStorage.setItem('i18nextLng', lang);
    }, t.lang);

    // Navigate to target URL
    await page.goto(t.url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify documentElement.dir
    const htmlDir = await page.evaluate(() => document.documentElement.dir);
    const bodyClass = await page.evaluate(() => document.body.className);
    const rootDir = await page.evaluate(() => {
      const el = document.querySelector('div[dir]');
      return el ? el.getAttribute('dir') : null;
    });

    const isMatch = htmlDir === t.expectedDir;

    console.log(`  -> html dir="${htmlDir}" | root div dir="${rootDir}" | Match: ${isMatch ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Save screenshot
    const localShot = path.join(SCREENSHOT_DIR, `${t.name}.png`);
    const artifactShot = path.join(ARTIFACT_DIR, `${t.name}.png`);
    await page.screenshot({ path: localShot, fullPage: false });
    fs.copyFileSync(localShot, artifactShot);

    results.push({
      target: t.name,
      lang: t.lang,
      expectedDir: t.expectedDir,
      actualHtmlDir: htmlDir,
      actualRootDir: rootDir,
      passed: isMatch,
      screenshot: localShot,
    });
  }

  await browser.close();

  console.log('\n=== RTL/LTR VERIFICATION SUMMARY ===');
  console.table(results, ['target', 'lang', 'expectedDir', 'actualHtmlDir', 'passed']);

  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    console.log('\n✅ ALL 12 RTL/LTR AUDIT TARGETS PASSED WITH 100% DIRECTION COMPLIANCE!');
  } else {
    console.error('\n❌ SOME TARGETS FAILED DIRECTION VERIFICATION');
    process.exit(1);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Fatal error during RTL/LTR verification:', err);
  process.exit(1);
});
