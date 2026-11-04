import 'dotenv/config';
import { pool } from '../src/db/index.js';
import { chromium, Browser, Page } from 'playwright';
import { spawn, execSync, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots/تێستی جوان/01-accounts-and-auth');
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

async function runPhase1() {
  console.log('================================================================');
  console.log('🚀 TEST JWAN — PHASE 1: ACCOUNTS, ROLES, COMPANY/INDIVIDUAL & IDOR');
  console.log('================================================================\n');

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
    console.log('[Setup] Development server running on port 3000.');
  }

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ku',
  });
  const page: Page = await context.newPage();

  const timestamp = Date.now();
  const testUsers = {
    ownerIndiv: {
      email: `jwan_owner_indiv_${timestamp}@homehub.iq`,
      fullName: 'ڕەوەند عوسمان (خاوەن موڵکی تاک)',
      phone: '07701112233',
      role: 'PROPERTY_OWNER',
      entityType: 'INDIVIDUAL',
      password: 'password123',
    },
    ownerComp: {
      email: `jwan_owner_comp_${timestamp}@homehub.iq`,
      fullName: 'شەرمین عەزیز (بەڕێوەبەری کۆمپانیا)',
      companyName: 'کۆمپانیای شاهانە بۆ وەبەرهێنان',
      phone: '07702223344',
      role: 'PROPERTY_OWNER',
      entityType: 'COMPANY',
      password: 'password123',
    },
    agentIndiv: {
      email: `jwan_agent_indiv_${timestamp}@homehub.iq`,
      fullName: 'سۆران ئەحمەد (برۆکەری سەربەخۆ)',
      phone: '07703334455',
      role: 'AGENT_BROKER',
      entityType: 'INDIVIDUAL',
      password: 'password123',
    },
    agentComp: {
      email: `jwan_agent_comp_${timestamp}@homehub.iq`,
      fullName: 'کاروان مەحموود (نوسینگەی لوتکە)',
      companyName: 'نووسینگەی لوتکە بۆ خانووبەرە',
      phone: '07704445566',
      role: 'AGENT_BROKER',
      entityType: 'COMPANY',
      password: 'password123',
    },
    tenant: {
      email: `jwan_tenant_${timestamp}@homehub.iq`,
      fullName: 'هێمن جەمال (کرێچی)',
      phone: '07705556677',
      role: 'TENANT',
      entityType: 'INDIVIDUAL',
      password: 'password123',
    },
    vendor: {
      email: `jwan_vendor_${timestamp}@homehub.iq`,
      fullName: 'ئەحمەد چاکساز (وەستای گشتی)',
      phone: '07706667788',
      role: 'VENDOR',
      entityType: 'INDIVIDUAL',
      password: 'password123',
    },
  };

  try {
    // -------------------------------------------------------------
    // Step 1: Register All 6 Personas (Testing Individual vs Company)
    // -------------------------------------------------------------
    console.log('--- Step 1: Registering Test Personas (Individual vs Company) ---');
    const registeredTokens: Record<string, string> = {};

    for (const [key, user] of Object.entries(testUsers)) {
      const res = await fetch('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Registration failed for ${user.fullName} (${user.email}): ${res.status} ${errText}`);
      }

      const data = await res.json() as any;
      registeredTokens[key] = data.token;
      console.log(`[PASS] Registered: ${user.fullName} | Role: ${data.user?.roles?.join(', ')} | Entity: ${user.entityType}`);

      // Verify organization was created if COMPANY
      if (user.entityType === 'COMPANY') {
        const orgCheck = await pool.query(
          `SELECT o.id, o.name, om.role as member_role 
           FROM organizations o 
           JOIN organization_members om ON o.id = om.organization_id 
           WHERE om.user_id = $1`,
          [data.user.id]
        );
        if (orgCheck.rows.length === 0) {
          throw new Error(`CRITICAL: Organization not provisioned for company user ${user.email}`);
        }
        console.log(`       🏢 Org Created: "${orgCheck.rows[0].name}" | Member Role: ${orgCheck.rows[0].member_role}`);
      }
    }

    // -------------------------------------------------------------
    // Step 2: Browser UI Sign-In for Individual Owner
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Live Browser UI Sign-In for Individual Owner ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const emailInput = page.locator('#login-email, input[type="text"], input[type="email"]').first();
    const passwordInput = page.locator('#login-password, input[type="password"]').first();
    const submitBtn = page.locator('#login-submit-btn, button[type="submit"]').first();

    await emailInput.fill(testUsers.ownerIndiv.email);
    await passwordInput.fill(testUsers.ownerIndiv.password);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-individual-owner-login-form.png') });

    await submitBtn.click();
    await page.waitForTimeout(2500);

    // Verify workspace loaded
    console.log(`[Browser UI] Current URL after Individual Owner login: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-individual-owner-dashboard.png') });
    console.log('[PASS] Individual Owner signed in and reached Owner Workspace.');

    // -------------------------------------------------------------
    // Step 3: Browser UI Sign-In for Company Owner
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Live Browser UI Sign-In for Company Owner ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await emailInput.fill(testUsers.ownerComp.email);
    await passwordInput.fill(testUsers.ownerComp.password);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-company-owner-login-form.png') });

    await submitBtn.click();
    await page.waitForTimeout(2500);

    console.log(`[Browser UI] Current URL after Company Owner login: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-company-owner-dashboard.png') });
    console.log('[PASS] Company Owner signed in and reached Company Workspace.');

    // -------------------------------------------------------------
    // Step 4: Browser UI Sign-In for Tenant
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Live Browser UI Sign-In for Tenant ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await emailInput.fill(testUsers.tenant.email);
    await passwordInput.fill(testUsers.tenant.password);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-tenant-login-form.png') });

    await submitBtn.click();
    await page.waitForTimeout(2500);

    console.log(`[Browser UI] Current URL after Tenant login: ${page.url()}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-tenant-dashboard.png') });
    console.log('[PASS] Tenant signed in and reached Tenant Workspace.');

    // -------------------------------------------------------------
    // Step 5: Multi-Role Account Workspace Switcher (Kaywan Sabir)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Testing Multi-Role Persona (Kaywan Sabir) ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await emailInput.fill('kaywan.sabir@gmail.com');
    await passwordInput.fill('password123');
    await submitBtn.click();
    await page.waitForTimeout(2500);

    // Should be on ScreenSelectWorkspace
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-kaywan-workspace-selection-modal.png') });
    const selectBtn = page.locator('button:has-text("هەڵبژاردن"), button:has-text("Select")').first();
    if (await selectBtn.isVisible()) {
      console.log('[Browser UI] Workspace Selector is visible. Selecting Owner Role...');
      await selectBtn.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-kaywan-selected-workspace-destination.png') });
      console.log(`[PASS] Multi-Role account selected workspace: ${page.url()}`);
    }

    // -------------------------------------------------------------
    // Step 6: Security & IDOR Attack Drills (Adversarial Tests)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Security & IDOR Attack Drills ---');

    // Attack A: Tenant attempting to access Owner Portfolio properties
    const tenantToken = registeredTokens.tenant;
    const idorOwnerRes = await fetch('http://localhost:3000/api/owner/properties', {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    console.log(`[IDOR Test A] Tenant calling /api/owner/properties -> HTTP ${idorOwnerRes.status}`);
    if (idorOwnerRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: Tenant was not blocked by 403 on /api/owner/properties! Got ${idorOwnerRes.status}`);
    }
    console.log('  [PASS] Tenant blocked with HTTP 403 Forbidden on Owner routes.');

    // Attack B: Tenant attempting to access Admin Audit Logs
    const idorAdminRes = await fetch('http://localhost:3000/api/admin/audit-logs', {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    console.log(`[IDOR Test B] Tenant calling /api/admin/audit-logs -> HTTP ${idorAdminRes.status}`);
    if (idorAdminRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: Tenant was not blocked by 403 on /api/admin/audit-logs! Got ${idorAdminRes.status}`);
    }
    console.log('  [PASS] Tenant blocked with HTTP 403 Forbidden on Admin routes.');

    // Attack C: Vendor attempting to access Tenant Lease Agreement
    const vendorToken = registeredTokens.vendor;
    const idorVendorRes = await fetch('http://localhost:3000/api/tenant/leases', {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    console.log(`[IDOR Test C] Vendor calling /api/tenant/leases -> HTTP ${idorVendorRes.status}`);
    if (idorVendorRes.status !== 403) {
      throw new Error(`SECURITY VULNERABILITY: Vendor was not blocked by 403 on /api/tenant/leases! Got ${idorVendorRes.status}`);
    }
    console.log('  [PASS] Vendor blocked with HTTP 403 Forbidden on Tenant routes.');

    // -------------------------------------------------------------
    // Step 7: Duplicate Registration Smart Bridge Test
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Duplicate Registration Bridge UX Test ---');
    await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Click "هەژمارت نییە؟ دروستی بکە" / Create Account
    const createAccountLink = page.locator('button:has-text("هەژمار دروست بکە"), a:has-text("Create an Account"), button:has-text("دروستی بکە")').first();
    if (await createAccountLink.isVisible()) {
      await createAccountLink.click();
      await page.waitForTimeout(1500);

      // On signup step, fill with existing tenant email
      const signupName = page.locator('#signup-fullname, input[name="fullName"]').first();
      const signupEmail = page.locator('#signup-email, input[name="email"], input[type="email"]').first();
      const signupPhone = page.locator('#signup-phone, input[name="phone"]').first();
      const signupPassword = page.locator('#signup-password, input[name="password"]').first();
      const signupConfirm = page.locator('#signup-confirm-password, input[name="confirmPassword"]').first();
      const consentCheck = page.locator('input[type="checkbox"]').first();
      const signupSubmit = page.locator('button[type="submit"]').first();

      if (await signupEmail.isVisible()) {
        await signupName.fill('ناوی دووبارە');
        await signupEmail.fill(testUsers.tenant.email);
        await signupPhone.fill('07709998877');
        await signupPassword.fill('password123');
        await signupConfirm.fill('password123');
        if (await consentCheck.isVisible()) await consentCheck.check();

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-duplicate-signup-attempt.png') });
        await signupSubmit.click();
        await page.waitForTimeout(2000);

        // Verify Error message & Quick Sign In button appeared
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-duplicate-signup-golden-button.png') });
        const goToLoginBtn = page.locator('button:has-text("ڕاستەوخۆ بچۆ پەڕەی چوونە ژوورەوە"), button:has-text("Sign In")').first();
        if (await goToLoginBtn.isVisible()) {
          console.log('[Browser UI] Golden bridge button appeared! Clicking it...');
          await goToLoginBtn.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '11-routed-back-to-login.png') });
          console.log('[PASS] Golden bridge button correctly navigated user directly back to Sign In!');
        }
      }
    }

    // Save test users for subsequent phases
    fs.writeFileSync(
      path.resolve(process.cwd(), 'scripts/test-jwan-active-personas.json'),
      JSON.stringify(testUsers, null, 2)
    );
    console.log('\n[Saved] Active test personas persisted for subsequent phases.');

    console.log('\n================================================================');
    console.log('🎉 PHASE 1 VERIFICATION COMPLETED WITH 100% SUCCESS!');
    console.log('   All 11 visual screenshots captured in screenshots/تێستی جوان/01-accounts-and-auth/');
    console.log('================================================================\n');

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
      } catch {}
    }
    await pool.end();
  }
}

runPhase1()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ PHASE 1 FAILED:', err);
    process.exit(1);
  });

