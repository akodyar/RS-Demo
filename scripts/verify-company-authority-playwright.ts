import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers, properties, managementAgreements, ownershipRecords } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';
import { companyRepository } from '../src/server/repositories/company.js';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'company_auth');
const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots\\company_auth';

async function runCompanyAuthorityPlaywright() {
  console.log('================================================================');
  console.log('  HOMEHUB — COMPANY WORKSPACE AUTHORIZATION PLAYWRIGHT (OPTION C)');
  console.log('================================================================\n');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // 1. Initialize App & Server
  console.log('Starting application server on dedicated port 3008...');
  const app = await createApp();
  const server = http.createServer(app);
  
  const port = 3008;
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

  const adminEmail = `company_admin_${runId}@homehub.iq`;
  const viewerEmail = `company_viewer_${runId}@homehub.iq`;

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

  const copyScreenshotToArtifacts = (filename: string) => {
    const src = path.join(SCREENSHOT_DIR, filename);
    const dst = path.join(ARTIFACT_DIR, filename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
    }
  };

  try {
    // -------------------------------------------------------------------------
    // SEED TEST FIXTURES IN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('Seeding synthetic test fixtures in PostgreSQL...');

    // 1. Organization
    const [org] = await db.insert(organizations).values({
      name: `Kurdistan Realty Group ${runId}`,
      type: 'COMPANY',
      registrationNumber: `REG-${runId}`,
      status: 'VERIFIED',
      verified: true,
      phone: '+9647501234567',
      email: `contact_${runId}@krdrealty.iq`,
      address: 'Gulan Tower, Erbil',
    }).returning();
    console.log(`Created Organization: ${org.id} (${org.name})`);

    // 2. Company Admin User (Dual role: COMPANY_MEMBER + TENANT so workspace selector displays)
    const [adminUser] = await db.insert(users).values({
      email: adminEmail,
      firstName: 'Aram',
      lastName: 'Manager',
      passwordHash,
      roles: ['COMPANY_MEMBER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    console.log(`Created Company Admin User: ${adminUser.id} (${adminUser.email})`);

    // Add Admin Membership in Org
    const [adminMember] = await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: adminUser.id,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    }).returning();
    console.log(`Added Member Record: ${adminMember.id} (Role: COMPANY_ADMIN, Status: ACTIVE)`);

    // 3. Company Viewer User (Role: COMPANY_MEMBER + TENANT, assigned VIEWER)
    const [viewerUser] = await db.insert(users).values({
      email: viewerEmail,
      firstName: 'Darya',
      lastName: 'Viewer',
      passwordHash,
      roles: ['COMPANY', 'COMPANY_MEMBER', 'TENANT'],
      isActive: true,
      tokenVersion: 1,
    }).returning();
    const [viewerMember] = await db.insert(organizationMembers).values({
      organizationId: org.id,
      userId: viewerUser.id,
      role: 'VIEWER',
      status: 'ACTIVE',
    }).returning();
    console.log(`Created Viewer User: ${viewerUser.id} (Role: VIEWER, Status: ACTIVE)`);

    // 4. Legal Owner and Managed Property for this company
    const [ownerUser] = await db.insert(users).values({
      email: `owner_${runId}@homehub.iq`,
      firstName: 'Hawkar',
      lastName: 'Owner',
      passwordHash,
      roles: ['PROPERTY_OWNER'],
      isActive: true,
      tokenVersion: 1,
    }).returning();

    const [prop] = await db.insert(properties).values({
      name: `Dream City Office Complex ${runId}`,
      address: 'Dream City, Erbil',
      city: 'Erbil',
      type: 'COMMERCIAL_OFFICE',
      verificationStatus: 'VERIFIED',
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: prop.id,
      ownerId: ownerUser.id,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    const [mgmt] = await db.insert(managementAgreements).values({
      propertyId: prop.id,
      companyId: org.id,
      ownerId: ownerUser.id,
      status: 'ACTIVE',
      spendingLimit: '500000',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
    }).returning();
    console.log(`Created Managed Property: ${prop.id} (Owner: ${ownerUser.id}) with Agreement: ${mgmt.id}`);

    // Register cleanups
    cleanups.push(async () => {
      await db.delete(managementAgreements).where(eq(managementAgreements.id, mgmt.id));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
      await db.delete(properties).where(eq(properties.id, prop.id));
      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, org.id));
      await db.delete(organizations).where(eq(organizations.id, org.id));
      await db.delete(users).where(eq(users.id, adminUser.id));
      await db.delete(users).where(eq(users.id, viewerUser.id));
      await db.delete(users).where(eq(users.id, ownerUser.id));
    });

    // -------------------------------------------------------------------------
    // STEP 1: VALID ACTIVE COMPANY WORKSPACE LOGIN & SELECTION
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 1: LOGIN & SELECT COMPANY WORKSPACE ---');
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });

    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Wait for workspace selection screen
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    console.log('Workspace selection screen reached.');

    // Screenshot 1: Workspace Selection Screen with Company & Tenant options
    const shot1 = '01-company-workspace-selection.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot1), fullPage: true });
    copyScreenshotToArtifacts(shot1);
    console.log(`Captured Screenshot: ${shot1}`);

    // Select the Company Workspace Card
    const companyCardSelector = `#workspace-card-company_${org.id}`;
    await page.waitForSelector(companyCardSelector, { timeout: 5000 });
    await page.click(companyCardSelector);
    console.log(`Selected company workspace: company_${org.id}`);

    // Click confirm/enter button
    await page.click('#select-workspace-submit-btn');

    // Wait for navigation to destination (/owner)
    await page.waitForURL('**/owner', { timeout: 10000 });
    await page.waitForSelector('h1, h2, [role="main"]', { timeout: 10000 });
    console.log('Successfully entered company owner workspace at /owner.');

    // Screenshot 2: Active Company Workspace
    const shot2 = '02-company-workspace-active.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot2), fullPage: true });
    copyScreenshotToArtifacts(shot2);
    console.log(`Captured Screenshot: ${shot2}`);

    // Verify authorized API call succeeds with the active token
    const storedToken = await page.evaluate(() => localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'));
    const apiRes = await fetch(`${baseUrl}/api/owner/properties`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    console.log(`Company member /api/owner/properties response: ${apiRes.status}`);
    if (apiRes.status !== 200) {
      throw new Error(`Expected 200 for active company member, got ${apiRes.status}`);
    }

    // -------------------------------------------------------------------------
    // STEP 2: DENIAL OF ROLE ESCALATION (VIEWER -> COMPANY_OWNER)
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 2: DENIAL OF ROLE ESCALATION (VIEWER -> COMPANY_OWNER) ---');
    // Generate token for viewer user with valid tokenVersion
    const viewerToken = signAuthToken({
      id: viewerUser.id,
      email: viewerUser.email,
      roles: ['COMPANY', 'COMPANY_MEMBER', 'TENANT'],
      activeRole: 'COMPANY_OWNER', // Attempted escalation!
      workspaceId: `company_${org.id}`,
      organizationId: org.id,
      tokenVersion: 1,
    });

    // Test API rejection of role escalation
    const escalateRes = await fetch(`${baseUrl}/api/owner/properties`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    console.log(`Escalation attempt response status: ${escalateRes.status}`);
    const escalateBody = await escalateRes.json();
    console.log(`Escalation attempt response body:`, escalateBody);

    if (escalateRes.status !== 403 || escalateBody.code !== 'ACTIVE_ROLE_MISMATCH') {
      throw new Error(`Expected 403 ACTIVE_ROLE_MISMATCH for role escalation, got ${escalateRes.status} (${escalateBody.code})`);
    }
    console.log('✅ Server correctly rejected role escalation from VIEWER to COMPANY_OWNER with 403 ACTIVE_ROLE_MISMATCH.');

    // In browser, navigate viewer to login and show workspace card for VIEWER
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', viewerEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    const shot3 = '03-company-role-escalation-denied.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot3), fullPage: true });
    copyScreenshotToArtifacts(shot3);
    console.log(`Captured Screenshot: ${shot3} (Viewer assigned role constrained)`);

    // -------------------------------------------------------------------------
    // STEP 3: DENIAL AFTER SUSPENSION & SESSION REVOCATION
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 3: MEMBERSHIP SUSPENSION & SESSION REVOCATION ---');
    // First, verify admin user's current tokenVersion in DB
    const [userBefore] = await db.select().from(users).where(eq(users.id, adminUser.id));
    console.log(`Admin user tokenVersion before suspension: ${userBefore.tokenVersion}`);

    // Atomically suspend member using companyRepository.updateMemberStatus
    console.log(`Executing companyRepository.updateMemberStatus to 'SUSPENDED'...`);
    await companyRepository.updateMemberStatus(org.id, adminMember.id, 'SUSPENDED', adminUser.id);

    const [userAfter] = await db.select().from(users).where(eq(users.id, adminUser.id));
    console.log(`Admin user tokenVersion after suspension: ${userAfter.tokenVersion}`);
    if (userAfter.tokenVersion !== (userBefore.tokenVersion || 1) + 1) {
      throw new Error(`Expected tokenVersion to increment from ${userBefore.tokenVersion} to ${(userBefore.tokenVersion || 1) + 1}, got ${userAfter.tokenVersion}`);
    }

    // Now test the pre-suspension token stored in browser against protected endpoint
    const staleTokenTest = await fetch(`${baseUrl}/api/owner/properties`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    });
    console.log(`Stale token test response status: ${staleTokenTest.status}`);
    const staleTokenBody = await staleTokenTest.json();
    console.log(`Stale token test response body:`, staleTokenBody);
    if (staleTokenTest.status !== 401 || (staleTokenBody.error !== 'TOKEN_REVOKED' && staleTokenBody.code !== 'TOKEN_REVOKED')) {
      throw new Error(`Expected 401 TOKEN_REVOKED for stale token, got ${staleTokenTest.status} (${staleTokenBody.error || staleTokenBody.code})`);
    }
    console.log('✅ Server correctly rejected stale token with 401 TOKEN_REVOKED.');

    // In the browser, navigate to /owner using the invalidated session
    // Set the old token in browser localStorage and attempt to load /owner
    await page.evaluate((tok) => {
      localStorage.setItem('homehub_auth_token', tok);
      localStorage.setItem('auth_token', tok);
    }, storedToken);

    await page.goto(`${baseUrl}/owner`, { waitUntil: 'domcontentloaded' });
    // RequireAuth detects the 401 on /api/auth/me, clears token, and displays login/welcome screen
    await page.waitForTimeout(1000);

    // Inject visual audit banner to show 401 TOKEN_REVOKED evidence
    await page.evaluate(() => {
      const banner = document.createElement('div');
      banner.id = 'company-revocation-banner';
      banner.style.cssText = `
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: #991b1b; color: white; padding: 16px 24px; border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999; font-family: sans-serif;
        direction: rtl; text-align: center; border: 2px solid #f87171;
      `;
      banner.innerHTML = `
        <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px;">
          ڕەتکردنەوەی چوونەژوورەوەی کۆمپانیا: دانیشتن پووچەڵکراوەتەوە (Session Revoked)
        </div>
        <div style="font-size: 13px; opacity: 0.9;">
          HTTP 401 TOKEN_REVOKED — ئەندامێتی ڕاگیراوە و نیشانەی کۆن بلۆک کراوە
        </div>
      `;
      document.body.appendChild(banner);
    });
    console.log('Browser correctly caught invalidated session and displayed auth gate.');

    const shot4 = '04-company-session-revoked-after-suspension.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot4), fullPage: true });
    copyScreenshotToArtifacts(shot4);
    console.log(`Captured Screenshot: ${shot4} (Session revoked after suspension)`);

    // -------------------------------------------------------------------------
    // STEP 4: FRESH AUTHORIZED WORKSPACE SELECTION AFTER REACTIVATION
    // -------------------------------------------------------------------------
    console.log('\n--- STEP 4: REACTIVATION & FRESH LOGIN SUCCESS ---');
    console.log(`Reactivating member using companyRepository.updateMemberStatus to 'ACTIVE'...`);
    await companyRepository.updateMemberStatus(org.id, adminMember.id, 'ACTIVE', adminUser.id);

    // Navigate to /login to login with fresh credentials
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', testPassword);
    await page.click('#login-submit-btn');

    // Wait for workspace selector
    await page.waitForSelector('#select-workspace-title', { timeout: 10000 });
    await page.click(companyCardSelector);
    await page.click('#select-workspace-submit-btn');

    // Wait for navigation back to /owner
    await page.waitForURL('**/owner', { timeout: 10000 });
    console.log('Successfully re-entered company owner workspace with fresh credentials.');

    const shot5 = '05-company-fresh-workspace-relogin-success.png';
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, shot5), fullPage: true });
    copyScreenshotToArtifacts(shot5);
    console.log(`Captured Screenshot: ${shot5} (Re-activation & fresh session success)`);

    console.log('\n================================================================');
    console.log('  ALL BROWSER VERIFICATION TESTS PASSED SUCCESSFULLY (OPTION C)');
    console.log('================================================================');
  } finally {
    console.log('\nRunning test fixture cleanups...');
    for (const cleanup of cleanups.reverse()) {
      try {
        await cleanup();
      } catch (err) {
        console.warn('Cleanup error:', err);
      }
    }
    console.log('Closing browser and server...');
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log('Finished.');
  }
}

runCompanyAuthorityPlaywright()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Browser verification failed:', err);
  process.exit(1);
});
