import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_DIR = path.resolve('screenshots/option-3-workspace-audit-2026-10-30');

const DIRS = {
  INDEX: path.join(BASE_DIR, '00-index'),
  PUBLIC: path.join(BASE_DIR, '01-public-marketplace'),
  AUTH: path.join(BASE_DIR, '02-authentication-onboarding'),
  OWNER_INDIVIDUAL: path.join(BASE_DIR, '03-owner-individual'),
  OWNER_COMPANY: path.join(BASE_DIR, '04-owner-company'),
  AGENT: path.join(BASE_DIR, '05-agent-broker'),
  TENANT: path.join(BASE_DIR, '06-tenant'),
  VENDOR: path.join(BASE_DIR, '07-vendor-maintenance'),
  ADMIN: path.join(BASE_DIR, '08-admin'),
  ACCOUNTANT: path.join(BASE_DIR, '09-accountant-finance'),
  CRM: path.join(BASE_DIR, '10-crm-communications'),
  MANAGEMENT: path.join(BASE_DIR, '11-property-management'),
  OTHER: path.join(BASE_DIR, '12-other-workspaces'),
  RESPONSIVE: path.join(BASE_DIR, '13-responsive'),
  RTL_KU: path.join(BASE_DIR, '14-kurdish-sorani-rtl'),
  RTL_AR: path.join(BASE_DIR, '15-arabic-rtl'),
  LTR_EN: path.join(BASE_DIR, '16-english-ltr'),
  DEFECTS_BEFORE: path.join(BASE_DIR, '17-defects-before-fix'),
  DEFECTS_AFTER: path.join(BASE_DIR, '18-defects-after-fix'),
  FINAL_REGRESSION: path.join(BASE_DIR, '19-final-regression'),
};

Object.values(DIRS).forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

async function setAuth(page: Page, role: string, lang: string = 'ku') {
  const token = `dev-${role.toLowerCase()}`;
  await page.addInitScript(({ role, token, lang }) => {
    localStorage.setItem('homehub_lang', lang);
    localStorage.setItem('homehub_auth_persona', JSON.stringify({
      id: `dev_${role.toLowerCase()}_user`,
      role,
      name: `Developer (${role})`,
      email: `${role.toLowerCase()}@homehub.iq`,
      token,
      roles: [role]
    }));
    localStorage.setItem('homehub_auth_token', token);
    localStorage.setItem('auth_token', token);
  }, { role, token, lang });
}

async function safeShot(page: Page, targetPath: string) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.screenshot({ path: targetPath, fullPage: false });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
}

async function main() {
  console.log('--- Starting Visual Remediation & Multi-Folder Evidence Capture ---');
  const browser = await chromium.launch({ headless: true });

  // 1. Re-capture Fixed Workspaces (Owner, Company, Agent) with high-contrast text and loaded health data
  console.log('1. Re-capturing fixed Owner, Company, and Agent overviews...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'OWNER', 'ku');
    await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500); // Allow async PropertyHealthDashboard to finish resolving
    await safeShot(page, path.join(DIRS.OWNER_INDIVIDUAL, 'owner_indiv__01_initial_overview__ku-desktop.png'));
    await safeShot(page, path.join(DIRS.DEFECTS_AFTER, 'defect_02_owner_greeting_contrast_fixed.png'));
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_01_owner_workspace.png'));
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'COMPANY_ADMIN', 'ku');
    await page.goto('http://localhost:3000/company', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await safeShot(page, path.join(DIRS.OWNER_COMPANY, 'company_mgmt__01_initial_overview__ku-desktop.png'));
    await safeShot(page, path.join(DIRS.DEFECTS_AFTER, 'defect_03_company_welcome_contrast_fixed.png'));
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_02_company_workspace.png'));
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'AGENT', 'ku');
    await page.goto('http://localhost:3000/agent', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await safeShot(page, path.join(DIRS.AGENT, 'agent_ws__01_initial_overview__ku-desktop.png'));
    await safeShot(page, path.join(DIRS.DEFECTS_AFTER, 'defect_04_agent_greeting_contrast_fixed.png'));
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_03_agent_workspace.png'));
    await ctx.close();
  }

  // 2. Populate 11-property-management with Maintenance Operations Workspace
  console.log('2. Populating 11-property-management...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'PLATFORM_ADMIN', 'ku');
    await page.goto('http://localhost:3000/workspace/maintenance', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await safeShot(page, path.join(DIRS.MANAGEMENT, 'maint_ops__01_initial_overview__ku-desktop.png'));
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_04_maintenance_workspace.png'));

    // Test tabs
    const queueTab = await page.$('[data-testid="maint-tab-queue"]');
    if (queueTab) {
      await queueTab.click({ force: true, noWaitAfter: true });
      await page.waitForTimeout(500);
      await safeShot(page, path.join(DIRS.MANAGEMENT, 'maint_ops__tab_01_queue_active__ku-desktop.png'));
    }

    const triagedTab = await page.$('[data-testid="maint-tab-triaged"]');
    if (triagedTab) {
      await triagedTab.click({ force: true, noWaitAfter: true });
      await page.waitForTimeout(500);
      await safeShot(page, path.join(DIRS.MANAGEMENT, 'maint_ops__tab_02_triaged_active__ku-desktop.png'));
    }

    const quotesTab = await page.$('[data-testid="maint-tab-quotes"]');
    if (quotesTab) {
      await quotesTab.click({ force: true, noWaitAfter: true });
      await page.waitForTimeout(500);
      await safeShot(page, path.join(DIRS.MANAGEMENT, 'maint_ops__tab_03_quotes_active__ku-desktop.png'));
    }

    await ctx.close();
  }

  // 3. Multilingual Comparative Captures (14-kurdish-sorani-rtl, 15-arabic-rtl, 16-english-ltr)
  console.log('3. Capturing multilingual Option 3 comparison matrices...');
  const multiWorkspaces = [
    { name: 'owner', route: 'http://localhost:3000/workspace/owner', role: 'OWNER' },
    { name: 'tenant', route: 'http://localhost:3000/tenant', role: 'TENANT' },
    { name: 'vendor', route: 'http://localhost:3000/vendor', role: 'VENDOR' },
    { name: 'agent', route: 'http://localhost:3000/agent', role: 'AGENT' },
    { name: 'admin', route: 'http://localhost:3000/admin/control-center', role: 'PLATFORM_ADMIN' },
    { name: 'accountant', route: 'http://localhost:3000/workspace/accountant', role: 'ACCOUNTANT' }
  ];

  for (const ws of multiWorkspaces) {
    // KU (Kurdish Sorani RTL)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await setAuth(page, ws.role, 'ku');
      await page.goto(ws.route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await safeShot(page, path.join(DIRS.RTL_KU, `${ws.name}__ku_sorani_rtl.png`));
      await ctx.close();
    }

    // AR (Arabic RTL)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await setAuth(page, ws.role, 'ar');
      await page.goto(ws.route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await safeShot(page, path.join(DIRS.RTL_AR, `${ws.name}__ar_arabic_rtl.png`));
      await ctx.close();
    }

    // EN (English LTR)
    {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      await setAuth(page, ws.role, 'en');
      await page.goto(ws.route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      await safeShot(page, path.join(DIRS.LTR_EN, `${ws.name}__en_english_ltr.png`));
      await ctx.close();
    }
  }

  // 4. Populate 17-defects-before-fix and 18-defects-after-fix
  console.log('4. Populating defects before & after...');
  // Capture Defect A: Clean Marketplace vs error box
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'BUYER', 'ku');
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await safeShot(page, path.join(DIRS.DEFECTS_AFTER, 'defect_01_marketplace_sponsored_fixed.png'));
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_05_public_marketplace.png'));
    await ctx.close();
  }

  // Capture Defect C: Admin Companies crash fix
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'PLATFORM_ADMIN', 'ku');
    await page.goto('http://localhost:3000/admin/control-center', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const companiesTab = await page.$('[data-testid="admin-tab-companies"]');
    if (companiesTab) {
      await companiesTab.click({ force: true, noWaitAfter: true });
      await page.waitForTimeout(800);
      await safeShot(page, path.join(DIRS.DEFECTS_AFTER, 'defect_05_admin_companies_null_safe_fixed.png'));
      await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_06_admin_companies_active.png'));
    }
    await ctx.close();
  }

  // Additional regression evidence for 19-final-regression
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'TENANT', 'ku');
    await page.goto('http://localhost:3000/tenant', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_07_tenant_workspace.png'));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'VENDOR', 'ku');
    await page.goto('http://localhost:3000/vendor', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_08_vendor_workspace.png'));
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await setAuth(page, 'ACCOUNTANT', 'ku');
    await page.goto('http://localhost:3000/workspace/accountant', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await safeShot(page, path.join(DIRS.FINAL_REGRESSION, 'reg_09_accountant_workspace.png'));
    await ctx.close();
  }

  // For 17-defects-before-fix: copy user uploaded error screenshot if available, or generate visual records
  const userMediaSrc = path.resolve('screenshots/option-3-workspace-audit-2026-10-30/01-public-marketplace/marketplace_sponsored_error_before.png');
  // If user provided defect snapshots exist in artifact directory, copy them
  const brainDir = path.resolve('C:/Users/zakar/.gemini/antigravity/brain/46e58428-0760-4215-9bed-a78ce6b19522/.user_uploaded');
  if (fs.existsSync(brainDir)) {
    const files = fs.readdirSync(brainDir);
    files.forEach((f, idx) => {
      if (f.endsWith('.png')) {
        fs.copyFileSync(path.join(brainDir, f), path.join(DIRS.DEFECTS_BEFORE, `defect_before_user_evidence_${idx + 1}.png`));
      }
    });
  }

  await browser.close();
  console.log('--- Completed All Evidence Population ---');
}

main().catch(err => {
  console.error('Error populating evidence:', err);
  process.exit(1);
});
