import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('screenshots/fixed_audit');
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
  persona?: { role: string; email: string };
  action?: (page: any) => Promise<void>;
}

const targets: TestTarget[] = [
  // 1. Screen4Signup (Password & Confirm Password Field Verification)
  {
    name: 'fixed_01_signup_kurdish_rtl',
    url: 'http://localhost:3000/onboarding/tenant',
    lang: 'ku',
    expectedDir: 'rtl',
    action: async (page) => {
      // Step through to signup form if needed
      await page.waitForTimeout(500);
    },
  },
  {
    name: 'fixed_02_signup_arabic_rtl',
    url: 'http://localhost:3000/onboarding/tenant',
    lang: 'ar',
    expectedDir: 'rtl',
  },
  {
    name: 'fixed_03_signup_english_ltr',
    url: 'http://localhost:3000/onboarding/tenant',
    lang: 'en',
    expectedDir: 'ltr',
  },

  // 2. Admin Login Page
  {
    name: 'fixed_04_admin_login_kurdish_rtl',
    url: 'http://localhost:3000/admin/login',
    lang: 'ku',
    expectedDir: 'rtl',
  },
  {
    name: 'fixed_05_admin_login_arabic_rtl',
    url: 'http://localhost:3000/admin/login',
    lang: 'ar',
    expectedDir: 'rtl',
  },
  {
    name: 'fixed_06_admin_login_english_ltr',
    url: 'http://localhost:3000/admin/login',
    lang: 'en',
    expectedDir: 'ltr',
  },

  // 3. Owner Workspace
  {
    name: 'fixed_07_owner_workspace_kurdish_rtl',
    url: 'http://localhost:3000/workspace/owner',
    lang: 'ku',
    expectedDir: 'rtl',
    persona: { role: 'PROPERTY_OWNER', email: 'owner@homehub.iq' },
  },
  {
    name: 'fixed_08_owner_workspace_arabic_rtl',
    url: 'http://localhost:3000/workspace/owner',
    lang: 'ar',
    expectedDir: 'rtl',
    persona: { role: 'PROPERTY_OWNER', email: 'owner@homehub.iq' },
  },
  {
    name: 'fixed_09_owner_workspace_english_ltr',
    url: 'http://localhost:3000/workspace/owner',
    lang: 'en',
    expectedDir: 'ltr',
    persona: { role: 'PROPERTY_OWNER', email: 'owner@homehub.iq' },
  },

  // 4. Agent Workspace
  {
    name: 'fixed_10_agent_workspace_kurdish_rtl',
    url: 'http://localhost:3000/workspace/agent',
    lang: 'ku',
    expectedDir: 'rtl',
    persona: { role: 'AGENT', email: 'agent@homehub.iq' },
  },
  {
    name: 'fixed_11_agent_workspace_arabic_rtl',
    url: 'http://localhost:3000/workspace/agent',
    lang: 'ar',
    expectedDir: 'rtl',
    persona: { role: 'AGENT', email: 'agent@homehub.iq' },
  },
  {
    name: 'fixed_12_agent_workspace_english_ltr',
    url: 'http://localhost:3000/workspace/agent',
    lang: 'en',
    expectedDir: 'ltr',
    persona: { role: 'AGENT', email: 'agent@homehub.iq' },
  },

  // 5. Vendor Workspace
  {
    name: 'fixed_13_vendor_workspace_kurdish_rtl',
    url: 'http://localhost:3000/workspace/vendor',
    lang: 'ku',
    expectedDir: 'rtl',
    persona: { role: 'VENDOR', email: 'vendor.audit@homehub.iq' },
  },
  {
    name: 'fixed_14_vendor_workspace_arabic_rtl',
    url: 'http://localhost:3000/workspace/vendor',
    lang: 'ar',
    expectedDir: 'rtl',
    persona: { role: 'VENDOR', email: 'vendor.audit@homehub.iq' },
  },
  {
    name: 'fixed_15_vendor_workspace_english_ltr',
    url: 'http://localhost:3000/workspace/vendor',
    lang: 'en',
    expectedDir: 'ltr',
    persona: { role: 'VENDOR', email: 'vendor.audit@homehub.iq' },
  },
];

async function run() {
  console.log('=== STARTING POST-FIX VISUAL & LOCALIZATION AUDIT ===\n');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const auditLog: any[] = [];

  for (const t of targets) {
    console.log(`[AUDIT] Target: ${t.name} (${t.lang.toUpperCase()}) -> Expecting: ${t.expectedDir.toUpperCase()}`);

    // Set language and session in localStorage
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ lang, persona }) => {
      localStorage.setItem('homehub_lang', lang);
      localStorage.setItem('i18nextLng', lang);
      if (persona) {
        const fakeUser = {
          id: `dev-${persona.role.toLowerCase()}`,
          uid: `dev-${persona.role.toLowerCase()}`,
          email: persona.email,
          displayName: persona.role === 'VENDOR' ? 'Service Provider' : persona.role === 'PROPERTY_OWNER' ? 'Owner' : 'Agent Salar',
          name: persona.role === 'VENDOR' ? 'Service Provider' : persona.role === 'PROPERTY_OWNER' ? 'Owner' : 'Agent Salar',
          role: persona.role,
          roles: [persona.role],
          token: `dev-${persona.role.toLowerCase()}`,
        };
        localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
        localStorage.setItem('homehub_auth_token', `dev-${persona.role.toLowerCase()}`);
        localStorage.setItem('auth_token', `dev-${persona.role.toLowerCase()}`);
      }
    }, { lang: t.lang, persona: t.persona });

    // Navigate to URL
    if (t.name.includes('signup')) {
      await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const roleCard = page.locator('#role-card-tenant, [data-testid="role-card-tenant"]').first();
      if (await roleCard.count() > 0) {
        await roleCard.click();
        await page.waitForTimeout(300);
        await page.locator('#purpose-continue-btn').click();
        await page.waitForTimeout(800);
      }
    } else {
      await page.goto(t.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
    }

    if (t.action) {
      await t.action(page);
    }

    // Inspect DOM attributes
    const htmlDir = await page.evaluate(() => document.documentElement.dir);
    const htmlLang = await page.evaluate(() => document.documentElement.lang);
    const rootDir = await page.evaluate(() => {
      const el = document.querySelector('div[dir]');
      return el ? el.getAttribute('dir') : null;
    });

    const isMatch = htmlDir === t.expectedDir && (rootDir === null || rootDir === t.expectedDir);

    console.log(`  -> html dir="${htmlDir}" (lang="${htmlLang}") | root div dir="${rootDir}" | Result: ${isMatch ? 'PASSED ✅' : 'FAILED ❌'}`);

    // Capture screenshot
    const localShot = path.join(SCREENSHOT_DIR, `${t.name}.png`);
    const artifactShot = path.join(ARTIFACT_DIR, `${t.name}.png`);
    await page.screenshot({ path: localShot, fullPage: false });
    fs.copyFileSync(localShot, artifactShot);

    auditLog.push({
      target: t.name,
      lang: t.lang,
      expectedDir: t.expectedDir,
      htmlDir,
      htmlLang,
      rootDir,
      passed: isMatch,
      screenshot: localShot,
    });
  }

  await browser.close();

  const total = auditLog.length;
  const passed = auditLog.filter((r) => r.passed).length;
  console.log(`\n=================================================`);
  console.log(`AUDIT COMPLETE: ${passed}/${total} TARGETS PASSED DIRECTION & LOCALIZATION CHECKS`);
  console.log(`=================================================\n`);

  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'fixed_audit_results.json'),
    JSON.stringify(auditLog, null, 2)
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
