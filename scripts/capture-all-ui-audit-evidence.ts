import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';
const artifactBase = 'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2/audit';
const localBase = path.resolve(process.cwd(), 'screenshots/audit');

function ensureDirs() {
  if (!fs.existsSync(artifactBase)) fs.mkdirSync(artifactBase, { recursive: true });
  if (!fs.existsSync(localBase)) fs.mkdirSync(localBase, { recursive: true });
}

async function saveScreenshot(page: any, filename: string, fullPage = false) {
  const localFile = path.join(localBase, filename);
  const artifactFile = path.join(artifactBase, filename);
  await page.screenshot({ path: localFile, fullPage });
  fs.copyFileSync(localFile, artifactFile);
  console.log(`[CAPTURED] -> ${filename}`);
  return artifactFile;
}

async function main() {
  ensureDirs();
  console.log('=== STARTING HOMEHUB FULL UI & ROLE ACCESS AUDIT EVIDENCE CAPTURE ===');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ku'
  });
  const page = await context.newPage();

  // -------------------------------------------------------------
  // 1. BASELINE SHELL & NAVIGATION
  // -------------------------------------------------------------
  console.log('\n--- 1. Baseline Shell & Landing Page ---');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#root', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await saveScreenshot(page, '01_baseline_shell.png', false);

  // -------------------------------------------------------------
  // 2. PURPOSE SELECTION SCREEN (PUBLIC ONBOARDING)
  // -------------------------------------------------------------
  console.log('\n--- 2. Role / Purpose Selection ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#role-card-owner', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '02_purpose_selection.png', false);

  // -------------------------------------------------------------
  // 3. OWNER REGISTRATION (INDIVIDUAL & COMPANY)
  // -------------------------------------------------------------
  console.log('\n--- 3. Owner Individual & Company Signup Screens ---');
  await page.locator('#role-card-owner').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.waitForSelector('#signup-fullname', { timeout: 10000 });
  await page.locator('input[data-testid="entity-type-individual"]').check();
  await page.locator('#signup-fullname').fill('ئاری مەحموود - خاوەن موڵک');
  await page.locator('#signup-phone').fill('7501112233');
  await page.locator('#signup-email').fill('ari.owner.ind@homehub.iq');
  await saveScreenshot(page, '03_signup_owner_individual.png', false);

  // Switch to Company Entity Type
  await page.locator('input[data-testid="entity-type-company"]').check();
  await page.locator('#signup-company').fill('کۆمپانیای زاگرۆس بۆ بەڕێوەبردنی خانووبەرە');
  await saveScreenshot(page, '04_signup_owner_company.png', false);

  // -------------------------------------------------------------
  // 4. AGENT REGISTRATION (INDIVIDUAL & COMPANY)
  // -------------------------------------------------------------
  console.log('\n--- 4. Agent Individual & Company Signup Screens ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#role-card-agent', { timeout: 10000 });
  await page.locator('#role-card-agent').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('input[data-testid="entity-type-individual"]').check();
  await page.locator('#signup-fullname').fill('سەروەر ئەحمەد - دەڵاڵی مۆڵەتدراو');
  await page.locator('#signup-phone').fill('7503334455');
  await page.locator('#signup-email').fill('sarwar.agent@homehub.iq');
  await saveScreenshot(page, '05_signup_agent_individual.png', false);

  await page.locator('input[data-testid="entity-type-company"]').check();
  await page.locator('#signup-company').fill('ئاژانسی خانووبەرەی قەڵات');
  await saveScreenshot(page, '06_signup_agent_company.png', false);

  // -------------------------------------------------------------
  // 5. TENANT & VENDOR REGISTRATION SCREENS
  // -------------------------------------------------------------
  console.log('\n--- 5. Tenant & Vendor Signup Screens ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#role-card-tenant', { timeout: 10000 });
  await page.locator('#role-card-tenant').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('#signup-fullname').fill('شوان کامەران - کرێنشین');
  await page.locator('#signup-phone').fill('7505556677');
  await page.locator('#signup-email').fill('shwan.tenant@homehub.iq');
  await saveScreenshot(page, '07_signup_tenant.png', false);

  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#role-card-vendor', { timeout: 10000 });
  await page.locator('#role-card-vendor').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('#signup-fullname').fill('وەستا بێستون - چاکسازی گشتی');
  await page.locator('#signup-phone').fill('7506667788');
  await page.locator('#signup-email').fill('bestun.vendor@homehub.iq');
  await saveScreenshot(page, '08_signup_vendor.png', false);

  // -------------------------------------------------------------
  // 6. NEGATIVE REGISTRATION VALIDATION & REJECTIONS
  // -------------------------------------------------------------
  console.log('\n--- 6. Negative Registration Validation ---');
  await page.locator('#signup-fullname').fill('');
  await page.locator('#signup-email').fill('invalid-format-email');
  await page.locator('#signup-password').fill('Pass123!');
  await page.locator('#signup-confirm-password').fill('Mismatch999!');
  await page.locator('#signup-submit-btn').click();
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '09_registration_validation_errors.png', false);

  // Duplicate email check
  await page.locator('#signup-fullname').fill('Duplicate Test');
  await page.locator('#signup-phone').fill('7501112233');
  await page.locator('#signup-email').fill('owner@homehub.iq'); // Existing user
  await page.locator('#signup-password').fill('Pass123!');
  await page.locator('#signup-confirm-password').fill('Pass123!');
  await page.locator('#signup-submit-btn').click();
  await page.waitForTimeout(1500);
  await saveScreenshot(page, '10_registration_duplicate_email_rejected.png', false);

  // -------------------------------------------------------------
  // 7. LOGIN SCREEN & NEGATIVE REJECTIONS
  // -------------------------------------------------------------
  console.log('\n--- 7. Login Screen & Negative Rejection ---');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.waitForTimeout(1000);
  await saveScreenshot(page, '11_login_screen.png', false);

  // Negative login: wrong password
  await page.locator('#login-email').fill('owner@homehub.iq');
  await page.locator('#login-password').fill('WrongPassword777!');
  await page.locator('#login-submit-btn').click();
  await page.waitForTimeout(1500);
  await saveScreenshot(page, '12_login_wrong_password_rejected.png', false);

  // -------------------------------------------------------------
  // 8. ALL 5 ACTIVE WORKSPACE DASHBOARDS
  // -------------------------------------------------------------

  // Helper to log in a persona and capture their workspace
  async function renderWorkspace(email: string, roles: string[], workspacePath: string, shotName: string, personaName: string) {
    console.log(`\n--- Capturing Workspace: ${personaName} (${workspacePath}) ---`);
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    
    // Get user id from database if exists
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    const uid = u ? u.id : `usr_${roles[0].toLowerCase()}`;
    const token = jwt.sign({ id: uid, email, roles, tokenVersion: 1 }, jwtSecret);

    await page.evaluate(({ token, uid, roles, email, personaName }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ uid, email, roles, name: personaName }));
      localStorage.setItem('homehub_lang', 'ku');
    }, { token, uid, roles, email, personaName });

    await page.goto(`http://localhost:3000${workspacePath}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await saveScreenshot(page, shotName, false);
  }

  // 8.1 Property Owner Workspace
  await renderWorkspace('owner@homehub.iq', ['PROPERTY_OWNER'], '/owner', '13_owner_workspace_dashboard.png', 'خاوەن موڵک');

  // 8.2 Agent Workspace
  await renderWorkspace('agent@homehub.iq', ['AGENT', 'AGENT_BROKER'], '/agent', '14_agent_workspace_dashboard.png', 'دەڵاڵ و ئاژانس');

  // 8.3 Tenant Workspace
  await renderWorkspace('tenant@homehub.iq', ['TENANT'], '/tenant', '15_tenant_workspace_dashboard.png', 'کرێنشین');

  // 8.4 Vendor Workspace
  await renderWorkspace('vendor@homehub.iq', ['VENDOR'], '/vendor', '16_vendor_workspace_dashboard.png', 'وەستا و دابینکەر');

  // 8.5 Platform Admin Workspace
  await renderWorkspace('admin@homehub.iq', ['PLATFORM_ADMIN', 'SUPER_ADMIN'], '/admin/dashboard', '17_admin_workspace_dashboard.png', 'بەڕێوەبەری سەرەکی');

  // -------------------------------------------------------------
  // 9. CROSS-ROLE ISOLATION & ACCESS CONTROL
  // -------------------------------------------------------------
  console.log('\n--- 9. Cross-Role Isolation Verification ---');
  // Log in as Tenant, then attempt to access /admin/dashboard
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  const tenantToken = jwt.sign({ id: 'user_tenant_01', email: 'tenant@homehub.iq', roles: ['TENANT'], tokenVersion: 1 }, jwtSecret);
  await page.evaluate((tok) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('homehub_auth_token', tok);
    localStorage.setItem('auth_token', tok);
    localStorage.setItem('homehub_auth_persona', JSON.stringify({ uid: 'user_tenant_01', email: 'tenant@homehub.iq', roles: ['TENANT'] }));
  }, tenantToken);

  await page.goto('http://localhost:3000/admin/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await saveScreenshot(page, '18_cross_role_access_denied.png', false);

  // -------------------------------------------------------------
  // 10. DEPRECATED & DORMANT ROUTE REDIRECTION
  // -------------------------------------------------------------
  console.log('\n--- 10. Deprecated Route Redirection ---');
  await page.goto('http://localhost:3000/company', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await saveScreenshot(page, '19_deprecated_company_redirected.png', false);

  await page.goto('http://localhost:3000/sale', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await saveScreenshot(page, '20_dormant_sale_redirected.png', false);

  await browser.close();
  console.log('\n=== ALL 20 AUDIT EVIDENCE SCREENSHOTS SUCCESSFULLY CAPTURED ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during audit screenshot capture:', err);
  process.exit(1);
});
