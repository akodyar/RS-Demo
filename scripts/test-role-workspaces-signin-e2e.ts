import 'dotenv/config';
import { chromium, Browser, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots/role-workspaces-signin-verification');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port: number, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(port)) return;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Server failed to start on port ${port} within ${timeoutMs}ms`);
}

async function main() {
  console.log('=== Verifying Role Workspaces Footer Navigation to Direct Sign In ===\n');

  let serverProcess: ChildProcess | null = null;
  const isRunning = await checkPort(3000);
  if (!isRunning) {
    console.log('[Setup] Starting development server on port 3000...');
    serverProcess = spawn('npx', ['tsx', 'server.ts'], {
      shell: true,
      env: { ...process.env, PORT: '3000' },
      stdio: 'pipe',
    });
    await waitForServer(3000);
    console.log('[Setup] Server running on port 3000.');
  }

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ku',
  });
  const page: Page = await context.newPage();

  const linksToTest = [
    { name: 'Owner (خاوەن موڵک)', path: '/workspace/owner', screenshot: '01-click-owner-direct-signin.png' },
    { name: 'Tenant (کرێنشین)', path: '/workspace/tenant', screenshot: '02-click-tenant-direct-signin.png' },
    { name: 'Vendor (وەستا)', path: '/workspace/vendor', screenshot: '03-click-vendor-direct-signin.png' },
    { name: 'Company (Company Workspace)', path: '/workspace/company', screenshot: '04-click-company-direct-signin.png' },
  ];

  try {
    for (const link of linksToTest) {
      console.log(`\n--- Testing ${link.name} ---`);
      await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);

      // Scroll to footer Role Workspaces
      const footerLink = page.locator(`footer a[href="${link.path}"]`);
      await footerLink.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      console.log(`Clicking footer link: ${link.path}...`);
      await footerLink.click();
      await page.waitForTimeout(1500);

      // 1. Verify that Screen1Welcome ("All paths to real estate" / "Get Started") is NOT visible
      const welcomeHero = page.locator('text="All paths to real estate"');
      const welcomeGetStarted = page.locator('button:has-text("Get Started")');
      const isWelcomeHeroVisible = await welcomeHero.isVisible().catch(() => false);
      const isGetStartedVisible = await welcomeGetStarted.isVisible().catch(() => false);

      if (isWelcomeHeroVisible || isGetStartedVisible) {
        throw new Error(`FAILURE: Welcome onboarding screen (Screen 1) appeared for ${link.name}!`);
      }
      console.log(`[PASS] Screen1Welcome is successfully bypassed for ${link.name}.`);

      // 2. Verify that the actual Sign In form is directly visible
      // Inputs: email/phone and password
      const emailInput = page.locator('input[type="text"], input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"]').first();

      const hasEmail = await emailInput.isVisible();
      const hasPassword = await passwordInput.isVisible();
      const hasSubmit = await submitButton.isVisible();

      console.log(`Form elements visible -> Email: ${hasEmail}, Password: ${hasPassword}, Submit: ${hasSubmit}`);

      if (!hasEmail || !hasPassword || !hasSubmit) {
        throw new Error(`FAILURE: Direct Sign In form elements are not visible for ${link.name}!`);
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, link.screenshot),
        fullPage: false,
      });
      console.log(`[PASS] Direct Sign In verified for ${link.name}. Saved screenshot: ${link.screenshot}`);
    }

    console.log('\n[ALL PASSED] All 4 Role Workspaces successfully and directly bring up the Sign In page!');
  } finally {
    await browser.close();
    if (serverProcess) {
      console.log('[Teardown] Stopping local server process...');
      serverProcess.kill('SIGTERM');
      serverProcess.kill('SIGKILL');
    }
  }
}

main().catch((err) => {
  console.error('[Error]:', err);
  process.exit(1);
});

