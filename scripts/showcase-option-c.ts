import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { closePool } from '../src/db/index.js';

const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\7756e8f5-757f-4652-9b27-841739126ee1';
const WORKSPACE_SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'option_c_demo');

async function runOptionCShowcase() {
  console.log('================================================================');
  console.log('🚀 HOMEHUB — OPTION C PLAYWRIGHT BROWSER VERIFICATION & CAPTURE');
  console.log('================================================================');

  if (!fs.existsSync(WORKSPACE_SCREENSHOT_DIR)) {
    fs.mkdirSync(WORKSPACE_SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const app = await createApp();
  const server = http.createServer(app);
  const PORT = 3045;

  await new Promise<void>((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;
  console.log(`[Option C] Local test server listening on ${baseUrl}`);

  console.log('[Option C] Launching Chromium via project-local Playwright (v1.63.0)...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  const capturedArtifacts: Array<{ name: string; title: string; localPath: string; artifactPath: string }> = [];

  async function saveScreenshot(filename: string, title: string) {
    const localPath = path.join(WORKSPACE_SCREENSHOT_DIR, filename);
    const artifactPath = path.join(ARTIFACT_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    fs.copyFileSync(localPath, artifactPath);
    capturedArtifacts.push({ name: filename, title, localPath, artifactPath });
    console.log(`  📸 [Captured] ${title} -> ${filename}`);
  }

  try {
    // -------------------------------------------------------------
    // Scenario 1: Kurdish RTL Public Marketplace / Landing Page
    // -------------------------------------------------------------
    console.log('\n[Scenario 1] Navigating to HomeHub Landing Page in Kurdish (Sorani RTL)...');
    await page.goto(`${baseUrl}/?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await saveScreenshot('01_home_marketplace_kurdish_rtl.png', 'Marketplace & Landing Page (Kurdish RTL)');

    // -------------------------------------------------------------
    // Scenario 2: English LTR Public Marketplace / Language Switch
    // -------------------------------------------------------------
    console.log('\n[Scenario 2] Switching to English (LTR)...');
    await page.goto(`${baseUrl}/?lang=en`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await saveScreenshot('02_home_marketplace_english_ltr.png', 'Marketplace & Landing Page (English LTR)');

    // -------------------------------------------------------------
    // Scenario 3: Login Portal & Role Gateway
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Navigating to Login & Role Gateway (/login)...');
    await page.goto(`${baseUrl}/login?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await saveScreenshot('03_login_and_roles_portal.png', 'Authentication & Role Selection Portal');

    // -------------------------------------------------------------
    // Scenario 4: Services Directory
    // -------------------------------------------------------------
    console.log('\n[Scenario 4] Navigating to Services Directory (/services)...');
    await page.goto(`${baseUrl}/services?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await saveScreenshot('04_services_directory_kurdish.png', 'Services Directory & Vendor Listings');

    // -------------------------------------------------------------
    // Scenario 5: Authenticated Owner Dashboard
    // -------------------------------------------------------------
    console.log('\n[Scenario 5] Injecting Owner Persona & Navigating to Owner Dashboard (/owner)...');
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
        firstName: 'Salar',
        lastName: 'Aziz',
      }));
    });
    await page.goto(`${baseUrl}/owner?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await saveScreenshot('05_owner_dashboard_authenticated.png', 'Authenticated Owner Dashboard (Portfolio & Rent)');

    // -------------------------------------------------------------
    // Scenario 6: Authenticated Admin Dashboard
    // -------------------------------------------------------------
    console.log('\n[Scenario 6] Injecting Admin Persona & Navigating to Admin Dashboard (/admin/dashboard)...');
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
        firstName: 'Super',
        lastName: 'Admin',
      }));
    });
    await page.goto(`${baseUrl}/admin/dashboard?lang=ku`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await saveScreenshot('06_admin_dashboard_authenticated.png', 'Authenticated Admin Dashboard (Governance & Fees)');

    console.log('\n================================================================');
    console.log(`✅ ALL ${capturedArtifacts.length} SCREENSHOTS CAPTURED SUCCESSFULLY VIA OPTION C!`);
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Error during Option C showcase execution:', err);
    throw err;
  } finally {
    await browser.close();
    server.close();
    await closePool();
    console.log('[Option C] Cleanup completed cleanly.');
  }
}

runOptionCShowcase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Fatal Error]', err);
    process.exit(1);
  });
