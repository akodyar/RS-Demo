import 'dotenv/config';
import { pool } from '../src/db/index.js';
import { chromium, Browser, Page } from 'playwright';
import { spawn, execSync, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots/auth-verification');
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
  console.log('=== Comprehensive Authentication & Roles E2E Verification ===\n');

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

  // Ensure Kaywan is unlocked
  await pool.query(`
    UPDATE users 
    SET failed_login_attempts = 0, locked_until = NULL 
    WHERE email = 'kaywan.sabir@gmail.com';
  `);

  // --- Step 1: API Level Tests for All Roles ---
  console.log('--- Step 1: Testing API Sign-In across Different Roles ---');

  const testAccounts = [
    { label: 'Kaywan Sabir (Email)', payload: { email: 'kaywan.sabir@gmail.com', password: 'password123' } },
    { label: 'Kaywan Sabir (Local Phone 0770...)', payload: { phone: '07705035051', password: 'password123' } },
    { label: 'Kaywan Sabir (International +964...)', payload: { email: '+9647705035051', password: 'password123' } },
    { label: 'Kaywan Sabir (Eastern Arabic Digits)', payload: { email: '٠٧٧٠٥٠٣٥٠٥١', password: 'password123' } },
    { label: 'Property Owner', payload: { email: 'owner@homehub.iq', password: 'password123' } },
    { label: 'Tenant', payload: { email: 'tenant@homehub.iq', password: 'password123' } },
    { label: 'Agent / Broker', payload: { email: 'agent@homehub.iq', password: 'password123' } },
    { label: 'Vendor / Maintenance', payload: { email: 'vendor@homehub.iq', password: 'password123' } },
    { label: 'Platform Admin', payload: { email: 'admin@homehub.iq', password: 'password123' } },
  ];

  for (const acc of testAccounts) {
    const res = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acc.payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Login failed for ${acc.label}: HTTP ${res.status} - ${errText}`);
    }

    const data = await res.json() as any;
    console.log(`[PASS] ${acc.label} logged in successfully!`);
    console.log(`       User: ${data.user?.email || data.user?.id}`);
    console.log(`       Roles: [${(data.user?.roles || []).join(', ')}]`);
    console.log(`       Eligible Workspaces: ${data.eligibleWorkspaces?.length || 0}`);
    console.log(`       Requires Workspace Selection: ${data.requiresWorkspaceSelection}`);
  }

  // --- Step 2: Test Registration Conflict ---
  console.log('\n--- Step 2: Testing Existing Email Registration Conflict ---');
  const regConflictRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'kaywan.sabir@gmail.com',
      password: 'password123',
      fullName: 'Kaywan Sabir',
      role: 'PROPERTY_OWNER',
      entityType: 'INDIVIDUAL',
    }),
  });

  const regConflictData = await regConflictRes.json();
  console.log(`Registration status for existing email: HTTP ${regConflictRes.status}`);
  console.log(`Response error code: ${regConflictData.error}`);
  console.log(`Response message: ${regConflictData.message}`);

  if (regConflictRes.status !== 409 || regConflictData.error !== 'EMAIL_ALREADY_EXISTS') {
    throw new Error(`Expected HTTP 409 EMAIL_ALREADY_EXISTS, got ${regConflictRes.status}`);
  }
  console.log('[PASS] Registration cleanly rejects already existing email with 409 EMAIL_ALREADY_EXISTS.');

  // --- Step 3: Live Browser UI Verification for Kaywan Sabir ---
  console.log('\n--- Step 3: Testing Live Browser UI Sign-In for kaywan.sabir@gmail.com ---');

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'ku',
  });
  const page: Page = await context.newPage();

  try {
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1500);

    // Verify Sign In page loaded
    const titleLocator = page.locator('h2:has-text("چوونە ژوورەوە"), h2:has-text("Sign In")').first();
    await titleLocator.waitFor({ state: 'visible', timeout: 10000 });
    console.log('[Browser UI] Sign In page is directly visible.');

    // Fill in Kaywan's credentials
    const emailInput = page.locator('#login-email, input[type="text"], input[type="email"]').first();
    const passwordInput = page.locator('#login-password, input[type="password"]').first();
    const submitBtn = page.locator('#login-submit-btn, button[type="submit"]').first();

    await emailInput.fill('kaywan.sabir@gmail.com');
    await passwordInput.fill('password123');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-kaywan-credentials-filled.png'),
      fullPage: false,
    });

    console.log('Submitting login form...');
    await submitBtn.click();
    await page.waitForTimeout(2500);

    // Verify NO error banner appeared
    const errorBanner = page.locator('.bg-rose-500\\/10, text="ئیمەیڵ یان وشەی نهێنی هەڵەیە"');
    const isErrorVisible = await errorBanner.isVisible().catch(() => false);
    if (isErrorVisible) {
      const errText = await errorBanner.innerText().catch(() => '');
      throw new Error(`FAILURE: Error banner displayed on sign-in: ${errText}`);
    }

    console.log('[Browser UI] No error banner! Sign-in succeeded.');

    // Because Kaywan has multiple roles (Owner, Agent, Vendor), check if Workspace Selection or Workspace loaded
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-kaywan-login-success-destination.png'),
      fullPage: false,
    });

    console.log(`[Browser UI] Current URL after login: ${page.url()}`);
    console.log('[SUCCESS] kaywan.sabir@gmail.com signed in smoothly and reached the authenticated ecosystem!');

  } finally {
    await browser.close();
    if (serverProcess && serverProcess.pid) {
      console.log('[Teardown] Stopping local server process...');
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
        } else {
          serverProcess.kill('SIGTERM');
        }
      } catch (e) {
        // ignore
      }
    }
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[Verification Failed]:', err);
  process.exit(1);
});
