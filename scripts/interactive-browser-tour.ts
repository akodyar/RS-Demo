import 'dotenv/config';
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { desc } from 'drizzle-orm';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';
const artifactBase = 'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2/tour';
const localBase = path.resolve(process.cwd(), 'screenshots/tour');

function ensureDirs() {
  if (!fs.existsSync(artifactBase)) fs.mkdirSync(artifactBase, { recursive: true });
  if (!fs.existsSync(localBase)) fs.mkdirSync(localBase, { recursive: true });
}

async function saveTourScreenshot(page: any, name: string) {
  const localFile = path.join(localBase, name);
  const artifactFile = path.join(artifactBase, name);
  await page.screenshot({ path: localFile, fullPage: false });
  fs.copyFileSync(localFile, artifactFile);
  console.log(`[TOUR MILESTONE] Captured: ${name}`);
  return artifactFile;
}

async function setAuth(page: any, user: { id: string; email: string; roles: string[]; name: string }) {
  const token = jwt.sign(
    { id: user.id, email: user.email, roles: user.roles, tokenVersion: 1 },
    jwtSecret
  );
  await page.evaluate(({ token, user }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('homehub_auth_token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('homehub_auth_persona', JSON.stringify({
      uid: user.id,
      email: user.email,
      roles: user.roles,
      name: user.name
    }));
    localStorage.setItem('homehub_lang', 'ku');
  }, { token, user });
}

async function clearAuth(page: any) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('homehub_lang', 'ku');
  });
}

async function main() {
  ensureDirs();
  console.log('===============================================================');
  console.log('  STARTING INTERACTIVE VISIBLE BROWSER TOUR OF HOMEHUB');
  console.log('  Mode: Visible Desktop Browser Window (headless: false)');
  console.log('===============================================================\n');

  // Fetch the latest property created in the database
  const latestProps = await db.select().from(schema.properties).orderBy(desc(schema.properties.createdAt)).limit(1);
  const samplePropId = latestProps[0]?.id || '';

  // Synthetic personas for the tour
  const demoOwner = {
    id: 'usr_tour_owner',
    email: 'owner@homehub.iq',
    name: 'دیلان خاوەن موڵک (Owner)',
    roles: ['PROPERTY_OWNER']
  };
  const demoAgent = {
    id: 'usr_tour_agent',
    email: 'agent@homehub.iq',
    name: 'ئارام بریکار (Agent)',
    roles: ['AGENT', 'AGENT_BROKER']
  };
  const demoTenant = {
    id: 'usr_tour_tenant',
    email: 'tenant@homehub.iq',
    name: 'سەردار کرێنشین (Tenant)',
    roles: ['TENANT']
  };

  // Launch visible browser
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600, // Smooth human-visible interaction pacing
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null // Takes full window size
  });

  const page = await context.newPage();

  // 1. Home / Landing Page
  console.log('1. Navigating to Home Page (http://localhost:3000)...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await saveTourScreenshot(page, 'tour_01_home_page.png');

  // 2. Rentals Marketplace
  console.log('2. Navigating to Rentals Marketplace (http://localhost:3000/rentals)...');
  await page.goto('http://localhost:3000/rentals', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await saveTourScreenshot(page, 'tour_02_rentals_marketplace.png');

  // 3. Services & Contractors Hub
  console.log('3. Navigating to Services Marketplace (http://localhost:3000/services)...');
  await page.goto('http://localhost:3000/services', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await saveTourScreenshot(page, 'tour_03_services_hub.png');

  // 4. Rent Management Explainer
  console.log('4. Navigating to Rent Management (http://localhost:3000/rent-management)...');
  await page.goto('http://localhost:3000/rent-management', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollBy({ top: 350, behavior: 'smooth' }));
  await page.waitForTimeout(1500);
  await saveTourScreenshot(page, 'tour_04_rent_management.png');

  // 5. Onboarding / Purpose Selector
  console.log('5. Navigating to Onboarding / Role Selector (http://localhost:3000/onboarding/purpose)...');
  await clearAuth(page);
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await saveTourScreenshot(page, 'tour_05_onboarding_purpose.png');

  // 6. Login Screen
  console.log('6. Navigating to Login Page (http://localhost:3000/login)...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await saveTourScreenshot(page, 'tour_06_login_screen.png');

  // 7. Owner Workspace
  console.log('7. Switching to Owner Persona and opening Owner Workspace (http://localhost:3000/owner)...');
  await setAuth(page, demoOwner);
  await page.goto('http://localhost:3000/owner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await saveTourScreenshot(page, 'tour_07_owner_workspace.png');

  // 8. Agent Workspace
  console.log('8. Switching to Agent Persona and opening Agent Workspace (http://localhost:3000/agent)...');
  await setAuth(page, demoAgent);
  await page.goto('http://localhost:3000/agent', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await saveTourScreenshot(page, 'tour_08_agent_workspace.png');

  // 9. Tenant Workspace
  console.log('9. Switching to Tenant Persona and opening Tenant Workspace (http://localhost:3000/tenant)...');
  await setAuth(page, demoTenant);
  await page.goto('http://localhost:3000/tenant', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await saveTourScreenshot(page, 'tour_09_tenant_workspace.png');

  // 10. Property Command Center / Detail Page
  if (samplePropId) {
    console.log(`10. Navigating to Property Command Center (/properties/${samplePropId})...`);
    await page.goto(`http://localhost:3000/properties/${samplePropId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveTourScreenshot(page, 'tour_10_property_detail.png');
  }

  // 11. Return to Main Marketplace & keep open for viewing
  console.log('11. Returning to Main Marketplace view for user inspection...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  console.log('Tour completed! Leaving browser open for 15 seconds so you can see it on your screen...');
  await page.waitForTimeout(15000);

  await browser.close();
  console.log('Browser closed cleanly.');
  process.exit(0);
}

main().catch(err => {
  console.error('Tour error:', err);
  process.exit(1);
});
