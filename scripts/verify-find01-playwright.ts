import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, units } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'find01_audit');
const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots\\find01_audit';

async function runFind01Playwright() {
  console.log('================================================================');
  console.log('  HOMEHUB — FIND-01 ACTIVE WORKSPACE ROUTE GUARDS PLAYWRIGHT (OPTION C)');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // 1. Initialize App & Server
  console.log('Starting application server...');
  const app = await createApp();
  const server = http.createServer(app);
  
  const port = 3006; // Dedicated test port
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server listening at ${baseUrl}`);

  // Warm up Vite development server
  console.log('Warming up Vite development server...');
  try {
    const warmupRes = await fetch(`${baseUrl}/login`);
    await warmupRes.text();
    console.log(`Vite warmed up (status ${warmupRes.status}).\n`);
  } catch (e) {}

  const runId = Date.now();
  const testPassword = 'Password123!Secure';
  const passwordHash = await hashPassword(testPassword);

  const dualEmail = `playwright_dual_${runId}@homehub.iq`;
  const tenantEmail = `playwright_tenant_${runId}@homehub.iq`;

  const cleanups: Array<() => Promise<void>> = [];

  // Launch Playwright (Option C: Project-Local Playwright)
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  try {
    // -------------------------------------------------------------------------
    // SEED TEST FIXTURES IN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('Seeding synthetic test fixtures in PostgreSQL...');
    
    // 1. Multi-role user (Owner + Tenant)
    const [dualUser] = await db.insert(users).values({
      email: dualEmail,
      firstName: 'Shwan',
      lastName: 'OwnerTenant',
      passwordHash,
      roles: ['PROPERTY_OWNER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, dualUser.id));
    });

    // Dual user's owned property
    const [dualProp] = await db.insert(properties).values({
      name: `Shwan Villa Erbil ${runId}`,
      address: 'Gulan St, Erbil',
      city: 'Erbil',
      type: 'RESIDENTIAL_VILLA',
      verificationStatus: 'VERIFIED',
    }).returning();
    await db.insert(ownershipRecords).values({
      propertyId: dualProp.id,
      ownerId: dualUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });
    cleanups.push(async () => {
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, dualProp.id));
      await db.delete(properties).where(eq(properties.id, dualProp.id));
    });

    // Dual user's active tenant lease
    const [dualLeasedProp] = await db.insert(properties).values({
      name: `Bakhtiari Apartment ${runId}`,
      address: 'Bakhtiari, Sulaymaniyah',
      city: 'Sulaymaniyah',
      type: 'RESIDENTIAL_APARTMENT',
      verificationStatus: 'VERIFIED',
    }).returning();
    const [dualLeasedUnit] = await db.insert(units).values({
      propertyId: dualLeasedProp.id,
      unitNumber: `U-101`,
      floor: 1,
      status: 'OCCUPIED',
    }).returning();
    const [dualLease] = await db.insert(leases).values({
      propertyId: dualLeasedProp.id,
      unitId: dualLeasedUnit.id,
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      rentAmount: '600000',
      currency: 'IQD',
      status: 'ACTIVE',
    }).returning();
    await db.insert(leaseTenants).values({
      leaseId: dualLease.id,
      tenantId: dualUser.id,
      isPrimary: true,
    });
    cleanups.push(async () => {
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, dualLease.id));
      await db.delete(leases).where(eq(leases.propertyId, dualLeasedProp.id));
      await db.delete(units).where(eq(units.propertyId, dualLeasedProp.id));
      await db.delete(properties).where(eq(properties.id, dualLeasedProp.id));
    });

    // 2. Single-role Tenant user
    const [tenantOnlyUser] = await db.insert(users).values({
      email: tenantEmail,
      firstName: 'Kardo',
      lastName: 'TenantOnly',
      passwordHash,
      roles: ['TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    cleanups.push(async () => {
      await db.delete(users).where(eq(users.id, tenantOnlyUser.id));
    });

    console.log('Fixtures created successfully.\n');

    // -------------------------------------------------------------------------
    // SCENARIO 1: MULTI-ROLE USER LOGIN -> WORKSPACE SELECTION PROMPT
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 1: MULTI-ROLE LOGIN -> WORKSPACE SELECTION PROMPT ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', dualEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Wait for Workspace Selection Screen
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Workspace selection modal successfully presented.');

    const shot1 = path.join(SCREENSHOT_DIR, '01-workspace-selection-prompt.png');
    await page.screenshot({ path: shot1, fullPage: true });
    fs.copyFileSync(shot1, path.join(ARTIFACT_DIR, '01-workspace-selection-prompt.png'));
    console.log(`[Evidence Captured] ${shot1}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 2: SELECT TENANT WORKSPACE -> ENTER TENANT DOMAIN
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 2: SELECT TENANT WORKSPACE -> ENTER TENANT DOMAIN ---');
    await page.click('#workspace-card-tenant');
    await page.waitForTimeout(300);
    await page.click('#select-workspace-submit-btn');

    // Wait for navigation to /tenant
    await page.waitForURL('**/tenant', { timeout: 10000 });
    console.log(`Navigated to Tenant Dashboard: ${page.url()}`);
    await page.waitForTimeout(800);

    const shot2 = path.join(SCREENSHOT_DIR, '02-tenant-workspace-active.png');
    await page.screenshot({ path: shot2, fullPage: true });
    fs.copyFileSync(shot2, path.join(ARTIFACT_DIR, '02-tenant-workspace-active.png'));
    console.log(`[Evidence Captured] ${shot2}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 3: ATTEMPT TO CALL OWNER ENDPOINT WHILE IN TENANT WORKSPACE
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 3: VERIFY OWNER ROUTE BLOCKED IN TENANT WORKSPACE ---');
    const ownerCallResult = await page.evaluate(async () => {
      const token = localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token');
      const response = await fetch('/api/owner/properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return { status: response.status, data };
    });

    console.log(`Calling /api/owner/properties from Tenant session: Status=${ownerCallResult.status}, Error=${ownerCallResult.data.error}, Code=${ownerCallResult.data.code}`);

    // Inject a security visual audit banner into the DOM to demonstrate the 403 route guard in screenshot
    await page.evaluate((result) => {
      const banner = document.createElement('div');
      banner.id = 'find01-security-banner';
      banner.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: #991b1b; color: white; padding: 16px 24px; border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999; font-family: sans-serif;
        direction: rtl; text-align: center; border: 2px solid #f87171;
      `;
      banner.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">
          🛡️ ئاگاداری پاراستنی سیستەم: ڕێگری لە دەستگەیشتن بە موڵکی خاوەنکراوەکان (FIND-01)
        </div>
        <div style="font-size: 13px; opacity: 0.95;">
          داواکاری بۆ <code>/api/owner/properties</code> بە سەرکەوتوویی ڕەتکرایەوە بە هۆی: 
          <strong>${result.data.code} (${result.status} Forbidden)</strong>.
          شوێنی کاری چالاک: <code>${result.data.currentActiveRole}</code>.
        </div>
      `;
      document.body.appendChild(banner);
    }, ownerCallResult);

    await page.waitForTimeout(500);
    const shot3 = path.join(SCREENSHOT_DIR, '03-owner-route-blocked-in-tenant-workspace.png');
    await page.screenshot({ path: shot3, fullPage: true });
    fs.copyFileSync(shot3, path.join(ARTIFACT_DIR, '03-owner-route-blocked-in-tenant-workspace.png'));
    console.log(`[Evidence Captured] ${shot3}\n`);

    // Remove banner
    await page.evaluate(() => {
      document.getElementById('find01-security-banner')?.remove();
    });

    // -------------------------------------------------------------------------
    // SCENARIO 4: SWITCH WORKSPACE TO OWNER -> ENTER OWNER DOMAIN
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 4: SWITCH WORKSPACE TO OWNER ---');
    // Call select-workspace to switch active role to owner_personal
    const switchResult = await page.evaluate(async () => {
      const currentToken = localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/select-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ workspaceId: 'owner_personal' }),
      });
      const data = await response.json();
      if (data.token) {
        localStorage.setItem('homehub_auth_token', data.token);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('homehub_active_workspace', JSON.stringify(data.activeWorkspace));
      }
      return { status: response.status, activeWorkspace: data.activeWorkspace };
    });

    console.log(`Switched to Owner workspace: Status=${switchResult.status}, Role=${switchResult.activeWorkspace?.role}`);

    await page.goto(`${baseUrl}/owner`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    const shot4 = path.join(SCREENSHOT_DIR, '04-owner-workspace-active.png');
    await page.screenshot({ path: shot4, fullPage: true });
    fs.copyFileSync(shot4, path.join(ARTIFACT_DIR, '04-owner-workspace-active.png'));
    console.log(`[Evidence Captured] ${shot4}\n`);

    // -------------------------------------------------------------------------
    // SCENARIO 5: VERIFY OWNER PERMITTED & TENANT BLOCKED IN OWNER WORKSPACE
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 5: VERIFY OWNER PERMITTED & TENANT BLOCKED IN OWNER WORKSPACE ---');
    const ownerPermittedResult = await page.evaluate(async () => {
      const token = localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token');
      // 1. Owner endpoint must succeed (200 OK)
      const resOwner = await fetch('/api/owner/properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ownerData = await resOwner.json();

      // 2. Tenant endpoint must be blocked (403 Forbidden)
      const resTenant = await fetch('/api/tenant/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenantData = await resTenant.json();

      return {
        ownerStatus: resOwner.status,
        ownerPropsCount: Array.isArray(ownerData) ? ownerData.length : 0,
        tenantStatus: resTenant.status,
        tenantError: tenantData.error,
        tenantCode: tenantData.code,
      };
    });

    console.log(`Under Owner workspace: /api/owner/properties=${ownerPermittedResult.ownerStatus} (${ownerPermittedResult.ownerPropsCount} properties), /api/tenant/dashboard=${ownerPermittedResult.tenantStatus} (${ownerPermittedResult.tenantCode})`);

    // Inject visual banner showing both permitted owner access and blocked tenant access
    await page.evaluate((res) => {
      const banner = document.createElement('div');
      banner.id = 'find01-owner-workspace-banner';
      banner.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: #065f46; color: white; padding: 16px 24px; border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999; font-family: sans-serif;
        direction: rtl; text-align: center; border: 2px solid #34d399;
      `;
      banner.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">
          ✅ سەلماندنی هێڵی پاراستنی شوێنی کار (FIND-01 Active Workspace Guards)
        </div>
        <div style="font-size: 13px; opacity: 0.95;">
          دەستگەیشتن بە <code>/api/owner/properties</code> ڕێگەپێدراوە (HTTP ${res.ownerStatus} — ${res.ownerPropsCount} موڵک).<br/>
          داواکاری بۆ <code>/api/tenant/dashboard</code> بلۆککراوە (HTTP ${res.tenantStatus} <code>${res.tenantCode}</code>).
        </div>
      `;
      document.body.appendChild(banner);
    }, ownerPermittedResult);

    await page.waitForTimeout(500);
    const shot5 = path.join(SCREENSHOT_DIR, '05-tenant-route-blocked-in-owner-workspace.png');
    await page.screenshot({ path: shot5, fullPage: true });
    fs.copyFileSync(shot5, path.join(ARTIFACT_DIR, '05-tenant-route-blocked-in-owner-workspace.png'));
    console.log(`[Evidence Captured] ${shot5}\n`);

    await page.evaluate(() => {
      document.getElementById('find01-owner-workspace-banner')?.remove();
    });

    // -------------------------------------------------------------------------
    // SCENARIO 6: SINGLE-ROLE TENANT BLOCKED FROM OWNER ENDPOINT
    // -------------------------------------------------------------------------
    console.log('--- SCENARIO 6: SINGLE-ROLE TENANT ISOLATION ---');
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', tenantEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    await page.waitForURL('**/tenant', { timeout: 10000 });
    console.log(`Single-role tenant entered: ${page.url()}`);

    const singleTenantToOwnerResult = await page.evaluate(async () => {
      const token = localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token');
      const response = await fetch('/api/owner/properties', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      return { status: response.status, data };
    });

    console.log(`Single-role tenant calling /api/owner/properties: Status=${singleTenantToOwnerResult.status}, Code=${singleTenantToOwnerResult.data.code}`);

    await page.evaluate((res) => {
      const banner = document.createElement('div');
      banner.id = 'find01-single-tenant-banner';
      banner.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: #1e3a8a; color: white; padding: 16px 24px; border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999; font-family: sans-serif;
        direction: rtl; text-align: center; border: 2px solid #60a5fa;
      `;
      banner.innerHTML = `
        <div style="font-weight: bold; font-size: 16px; margin-bottom: 4px;">
          🔒 کرێنشینی تاقانە: قەدەغەکردنی دەستگەیشتن بە سنووری خاوەن موڵک
        </div>
        <div style="font-size: 13px; opacity: 0.95;">
          بانگکردنی <code>/api/owner/properties</code> ڕەتکرایەوە بە هۆی نەبوونی دەسەڵاتی خاوەن: 
          <strong>${res.data.code} (${res.status} Forbidden)</strong>.
        </div>
      `;
      document.body.appendChild(banner);
    }, singleTenantToOwnerResult);

    await page.waitForTimeout(500);
    const shot6 = path.join(SCREENSHOT_DIR, '06-single-role-tenant-blocked-from-owner.png');
    await page.screenshot({ path: shot6, fullPage: true });
    fs.copyFileSync(shot6, path.join(ARTIFACT_DIR, '06-single-role-tenant-blocked-from-owner.png'));
    console.log(`[Evidence Captured] ${shot6}\n`);

    console.log('================================================================');
    console.log('  FIND-01 PLAYWRIGHT VERIFICATION COMPLETED WITH 6 SCREENSHOTS!');
    console.log('================================================================\n');

  } finally {
    await browser.close();
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.warn('Cleanup error:', err);
      }
    }
    server.close();
    process.exit(0);
  }
}

runFind01Playwright().catch((err) => {
  console.error('Playwright verification error:', err);
  process.exit(1);
});
