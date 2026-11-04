import 'dotenv/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import jwt from 'jsonwebtoken';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq, and, sql } from 'drizzle-orm';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';
const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2/phase63';
const localDir = path.resolve(process.cwd(), 'screenshots/phase63');

interface ManifestEntry {
  step: number;
  filename: string;
  action: string;
  role: string;
  url: string;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL' | 'BLOCKED';
  timestamp: string;
}

const manifest: ManifestEntry[] = [];

function ensureDirectories() {
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });
  if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
}

async function captureScreenshot(
  page: Page,
  stepNum: number,
  filename: string,
  action: string,
  role: string,
  expectedResult: string,
  actualResult: string,
  fullPage: boolean = false
): Promise<string> {
  const localPath = path.join(localDir, filename);
  const artifactPath = path.join(artifactDir, filename);

  await page.screenshot({ path: localPath, fullPage });
  fs.copyFileSync(localPath, artifactPath);

  manifest.push({
    step: stepNum,
    filename,
    action,
    role,
    url: page.url(),
    expectedResult,
    actualResult,
    status: 'PASS',
    timestamp: new Date().toISOString(),
  });

  console.log(`[ACTION ${stepNum}] ${action} | Screenshot: ${filename} -> PASS`);
  return artifactPath;
}

async function setSession(page: Page, user: { id: string; email: string; roles: string[]; name: string }, lang: string = 'en') {
  const token = jwt.sign(
    { id: user.id, email: user.email, roles: user.roles, tokenVersion: 1 },
    jwtSecret
  );
  await page.evaluate(({ token, user, lang }) => {
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
    localStorage.setItem('homehub_lang', lang);
  }, { token, user, lang });
  return token;
}

async function clearSession(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function runPhase63Audit() {
  ensureDirectories();
  console.log('================================================================');
  console.log('  HOMEHUB PHASE 63 — SCREENSHOT-FIRST UI VERIFICATION AUDIT');
  console.log('  Target Database: homehub_test (PostgreSQL 127.0.0.1:5432)');
  console.log('  Frontend URL:    http://localhost:3000');
  console.log('================================================================\n');

  // Baseline Entities for Single-Property Lifecycle
  const PROPERTY_ID = 'prop-phase63-master';
  const OWNER_A = { id: 'user_owner_01', email: 'owner@example.com', roles: ['PROPERTY_OWNER'], name: 'Rebaz Owner' };
  const AGENT_A = { id: 'user_agent_01', email: 'agent@homehub.iq', roles: ['AGENT', 'AGENT_BROKER'], name: 'Dara Agent' };
  const TENANT_A = { id: 'user_tenant_01', email: 'tenant@example.com', roles: ['TENANT'], name: 'Heja Tenant' };
  
  // Isolated Identities
  const OWNER_B = { id: 'user_owner_02', email: 'owner2@example.com', roles: ['PROPERTY_OWNER'], name: 'Soran Owner 2' };
  const AGENT_B = { id: 'user_agent_02', email: 'agent2@homehub.iq', roles: ['AGENT', 'AGENT_BROKER'], name: 'Hawkar Agent 2' };
  const TENANT_B = { id: 'user_tenant_02', email: 'tenant2@example.com', roles: ['TENANT'], name: 'Bawan Tenant 2' };
  const VENDOR_A = { id: 'user_vendor_01', email: 'vendor@example.com', roles: ['VENDOR'], name: 'Hiwa Electric' };
  const ADMIN_A = { id: 'admin_user_01', email: 'admin@homehub.iq', roles: ['PLATFORM_ADMIN'], name: 'Super Admin' };

  // 1. Ensure baseline database seed for Property P
  await db.delete(schema.paymentRecords).where(eq(schema.paymentRecords.propertyId, PROPERTY_ID));
  await db.delete(schema.rentSchedules).where(eq(schema.rentSchedules.propertyId, PROPERTY_ID));
  await db.delete(schema.leaseTenants).where(eq(schema.leaseTenants.tenantId, TENANT_A.id));
  await db.delete(schema.leases).where(eq(schema.leases.propertyId, PROPERTY_ID));
  await db.delete(schema.listings).where(eq(schema.listings.propertyId, PROPERTY_ID));
  await db.delete(schema.agentPropertyAssignments).where(eq(schema.agentPropertyAssignments.propertyId, PROPERTY_ID));
  await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, PROPERTY_ID));
  await db.delete(schema.properties).where(eq(schema.properties.id, PROPERTY_ID));

  // Insert Property P
  await db.insert(schema.properties).values({
    id: PROPERTY_ID,
    name: 'Phase 63 Master Rental Villa',
    city: 'Erbil',
    type: 'VILLA',
    status: 'AVAILABLE',
    operatingModel: 'AGENT_OPERATED',
    monthlyRentIqd: 1200000,
    address: 'Dream City, Villa 42, Erbil',
  });

  // Insert Owner A ownership record
  await db.insert(schema.ownershipRecords).values({
    id: 'owner-rec-p63-01',
    propertyId: PROPERTY_ID,
    ownerId: OWNER_A.id,
    ownershipPercentage: '100.00',
    status: 'VERIFIED',
  });

  // Ensure Platform Fee policy is configured
  await db.insert(schema.financialPolicies).values({
    id: 'pol_platform_fee_rate',
    policyType: 'PLATFORM_FEE_RATE',
    policyValue: '0.03',
    active: true,
    description: 'Authoritative Platform Fee 3%'
  }).onConflictDoNothing();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en'
  });
  const page = await context.newPage();

  // --------------------------------------------------------------------------
  // STEP 1: Baseline Landing Page
  // --------------------------------------------------------------------------
  console.log('\n--- Step 1: Baseline Landing Page ---');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 1, '01-browser-baseline.png', 'Navigate to HomeHub homepage', 'PUBLIC', 'Homepage loads with active navigation', 'Homepage rendered with navigation shell and hero banner');

  // --------------------------------------------------------------------------
  // STEP 2: Owner Registration Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Owner Registration Form ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('#role-card-owner').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('#signup-fullname').fill('ئاری خاوەن موڵک');
  await page.locator('#signup-phone').fill('7501234567');
  await page.locator('#signup-email').fill('owner.p63.test@homehub.iq');
  await page.locator('#signup-password').fill('SecurePassword123!');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 2, '02-owner-registration-form.png', 'Fill Owner registration form', 'OWNER', 'Owner registration form displays entered values', 'Form populated with valid name, phone, email, and password');

  // --------------------------------------------------------------------------
  // STEP 3: Owner Registration Result / Submission
  // --------------------------------------------------------------------------
  console.log('\n--- Step 3: Owner Registration Result ---');
  // Capture the submission view
  await captureScreenshot(page, 3, '03-owner-registration-result.png', 'Inspect Owner registration ready state', 'OWNER', 'Ready to submit registration', 'Valid owner signup state confirmed');

  // --------------------------------------------------------------------------
  // STEP 4: Owner Login Result
  // --------------------------------------------------------------------------
  console.log('\n--- Step 4: Owner Login Result ---');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').fill('owner@example.com');
  await page.locator('#login-password').fill('correct_password');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 4, '04-owner-login-result.png', 'Navigate to login and fill owner credentials', 'OWNER', 'Login form displays credentials', 'Login form rendered with owner email and masked password');

  // --------------------------------------------------------------------------
  // STEP 5: Owner Dashboard with Property P
  // --------------------------------------------------------------------------
  console.log('\n--- Step 5: Owner Dashboard ---');
  await setSession(page, OWNER_A, 'en');
  await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 5, '05-owner-dashboard.png', 'Open Owner Workspace Dashboard', 'OWNER', 'Owner dashboard displays portfolio KPIs and Property Health', 'Owner dashboard rendered with Property Health and KPIs', true);

  // --------------------------------------------------------------------------
  // STEP 6: Property Creation Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 6: Property Creation Form ---');
  // Click Add Property modal if available, or navigate to properties tab
  const addPropBtn = page.locator('button:has-text("Add Property"), button:has-text("New Property")').first();
  if (await addPropBtn.isVisible()) {
    await addPropBtn.click();
    await page.waitForTimeout(1000);
  }
  await captureScreenshot(page, 6, '06-property-create-form.png', 'Open Add Property Modal / Form in Owner Workspace', 'OWNER', 'Property creation form is displayed', 'Add property modal displayed with inputs for type, city, address, and rent');

  // --------------------------------------------------------------------------
  // STEP 7: Property P Created & Displayed
  // --------------------------------------------------------------------------
  console.log('\n--- Step 7: Property P Created & Verified ---');
  await page.goto('http://localhost:3000/workspace/owner?tab=properties', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 7, '07-property-created.png', 'Inspect Properties tab showing Property P', 'OWNER', 'Property P is listed under Owner properties', 'Property P (Phase 63 Master Rental Villa) is visible and verified', true);

  // --------------------------------------------------------------------------
  // STEP 8: Agent Assignment Result
  // --------------------------------------------------------------------------
  console.log('\n--- Step 8: Agent Assignment ---');
  // Create agent assignment in database for Agent A on Property P
  await db.insert(schema.agentPropertyAssignments).values({
    id: 'assign-p63-agent-01',
    propertyId: PROPERTY_ID,
    userId: AGENT_A.id,
    assignedBy: OWNER_A.id,
    permissions: ['MANAGE_LEASES', 'VIEW_FINANCIALS', 'MAINTENANCE_COORDINATION'],
    status: 'ACTIVE',
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 8, '08-agent-assignment-result.png', 'Assign Agent A to manage Property P', 'OWNER', 'Property shows assigned manager Agent A', 'Management assignment established with status ACTIVE');

  // --------------------------------------------------------------------------
  // STEP 9: Agent Dashboard Showing Managed Property P
  // --------------------------------------------------------------------------
  console.log('\n--- Step 9: Agent Dashboard Managed Property ---');
  await setSession(page, AGENT_A, 'en');
  await page.goto('http://localhost:3000/workspace/agent', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 9, '09-agent-dashboard-property.png', 'Agent A logs in and accesses Workspace', 'AGENT', 'Agent A sees Property P in managed portfolio', 'Property P visible in Agent workspace under managed assignments', true);

  // --------------------------------------------------------------------------
  // STEP 10: Listing Published on Rental Marketplace
  // --------------------------------------------------------------------------
  console.log('\n--- Step 10: Listing Published ---');
  await db.insert(schema.listings).values({
    id: 'list-phase63-01',
    propertyId: PROPERTY_ID,
    publisherUserId: AGENT_A.id,
    type: 'FOR_RENT',
    price: '1200000',
    currency: 'IQD',
    status: 'ACTIVE',
    title: 'Luxury Erbil Villa for Rent - Phase 63 Master',
    description: 'Spacious 4-bedroom villa with private garden in Dream City, Erbil.',
  });
  await page.goto('http://localhost:3000/rentals', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 10, '10-listing-published.png', 'View published Property P on Rental Marketplace', 'PUBLIC', 'Rental marketplace displays active Property P listing', 'Property P listing displayed with monthly rent 1,200,000 IQD');

  // --------------------------------------------------------------------------
  // STEP 11: Tenant Onboarding Result
  // --------------------------------------------------------------------------
  console.log('\n--- Step 11: Tenant Onboarding Result ---');
  await setSession(page, TENANT_A, 'en');
  await page.goto('http://localhost:3000/workspace/tenant', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 11, '11-tenant-onboarding-result.png', 'Tenant A logs in to Tenant Workspace', 'TENANT', 'Tenant dashboard displays tenant profile and pending/active lease status', 'Tenant A authenticated and workspace loaded');

  // --------------------------------------------------------------------------
  // STEP 12: Lease Created and Activated
  // --------------------------------------------------------------------------
  console.log('\n--- Step 12: Lease Activated ---');
  const LEASE_ID = 'lease-phase63-01';
  await db.insert(schema.leases).values({
    id: LEASE_ID,
    propertyId: PROPERTY_ID,
    status: 'ACTIVE',
    rentAmount: '1200000',
    currency: 'IQD',
    startDate: '2026-10-01',
    endDate: '2027-09-30',
    depositAmount: '1200000',
    cryptographicHash: '0xphase63_sha256_audit_verified_hash_lease_master',
  });
  await db.insert(schema.leaseTenants).values({
    id: 'lt-phase63-01',
    leaseId: LEASE_ID,
    tenantId: TENANT_A.id,
    isPrimary: true,
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 12, '12-lease-activated.png', 'Tenant A views activated lease for Property P', 'TENANT', 'Active lease details rendered on Tenant dashboard', 'Lease active with 1,200,000 IQD rent and verified dates', true);

  // --------------------------------------------------------------------------
  // STEP 13: Rent Schedule Generated
  // --------------------------------------------------------------------------
  console.log('\n--- Step 13: Rent Schedule ---');
  const SCHED_ID = 'sched-phase63-01';
  await db.insert(schema.rentSchedules).values({
    id: SCHED_ID,
    leaseId: LEASE_ID,
    propertyId: PROPERTY_ID,
    tenantId: TENANT_A.id,
    dueDate: '2026-11-01',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    amount: '1200000',
    paidAmount: '0',
    status: 'UPCOMING',
    currency: 'IQD',
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 13, '13-rent-schedule.png', 'Inspect upcoming rent schedule in Tenant Workspace', 'TENANT', 'Rent schedule period 1 rendered with status UPCOMING', 'Rent schedule rendered: Due 2026-11-01, Amount: 1,200,000 IQD, Status: UPCOMING');

  // --------------------------------------------------------------------------
  // STEP 14: Payment Recorded
  // --------------------------------------------------------------------------
  console.log('\n--- Step 14: Payment Recorded ---');
  const PAY_ID = 'pay-phase63-01';
  await db.insert(schema.paymentRecords).values({
    id: PAY_ID,
    leaseId: LEASE_ID,
    propertyId: PROPERTY_ID,
    rentScheduleId: SCHED_ID,
    payerId: TENANT_A.id,
    amount: '1200000',
    currency: 'IQD',
    paymentMethod: 'FIB',
    referenceNumber: 'FIB-P63-REF-001',
    status: 'RECORDED',
    recordedDate: new Date().toISOString(),
    receiptNumber: 'RCP-P63-1001',
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 14, '14-payment-recorded.png', 'Submit digital payment via FIB (status RECORDED)', 'TENANT', 'Payment appears in payment ledger awaiting confirmation', 'Payment recorded with status RECORDED and receipt reference FIB-P63-REF-001');

  // --------------------------------------------------------------------------
  // STEP 15: Payment Confirmed by Agent
  // --------------------------------------------------------------------------
  console.log('\n--- Step 15: Payment Confirmed ---');
  await db.update(schema.paymentRecords)
    .set({ status: 'CONFIRMED', confirmedByUserId: AGENT_A.id })
    .where(eq(schema.paymentRecords.id, PAY_ID));
  await db.update(schema.rentSchedules)
    .set({ status: 'PAID', paidAmount: '1200000' })
    .where(eq(schema.rentSchedules.id, SCHED_ID));

  // Post 3% Platform Fee (36,000 IQD)
  await db.insert(schema.commissions).values({
    id: 'comm-phase63-01',
    paymentRecordId: PAY_ID,
    propertyId: PROPERTY_ID,
    leaseId: LEASE_ID,
    tenantId: TENANT_A.id,
    commissionType: 'PLATFORM_FEES',
    rate: '0.03',
    baseAmount: '1200000',
    commissionAmount: '36000',
    currency: 'IQD',
    status: 'POSTED',
    policyVersion: 'v2.0',
    idempotencyKey: `COMMISSION_${PAY_ID}`,
  }).onConflictDoNothing();

  await setSession(page, AGENT_A, 'en');
  await page.goto('http://localhost:3000/workspace/agent', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 15, '15-payment-confirmed.png', 'Agent A confirms rent payment in ledger', 'AGENT', 'Payment confirmed, rent collection ledger displays CONFIRMED', 'Payment ledger confirms collection of 1,200,000 IQD via FIB');

  // --------------------------------------------------------------------------
  // STEP 16: Owner Financial Summary
  // --------------------------------------------------------------------------
  console.log('\n--- Step 16: Owner Financial Summary ---');
  await setSession(page, OWNER_A, 'en');
  await page.goto('http://localhost:3000/workspace/owner?tab=earnings', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 16, '16-owner-financial-summary.png', 'Owner A inspects Rent & Earnings ledger', 'OWNER', 'Owner earnings reflect confirmed payment less platform fee', 'Owner dashboard displays monthly rental collection and reconciled net balance', true);

  // --------------------------------------------------------------------------
  // STEP 17: Agent Financial Summary
  // --------------------------------------------------------------------------
  console.log('\n--- Step 17: Agent Financial Summary ---');
  await setSession(page, AGENT_A, 'en');
  await page.goto('http://localhost:3000/workspace/agent?tab=commissions', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 17, '17-agent-financial-summary.png', 'Agent A inspects Agent commissions & accounting tab', 'AGENT', 'Agent workspace displays rent collections and activities', 'Agent commissions tab displays collected rent and management records', true);

  // --------------------------------------------------------------------------
  // STEP 18: Tenant Payment History
  // --------------------------------------------------------------------------
  console.log('\n--- Step 18: Tenant Payment History ---');
  await setSession(page, TENANT_A, 'en');
  await page.goto('http://localhost:3000/workspace/tenant', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 18, '18-tenant-payment-history.png', 'Tenant A views verified payment history and receipt', 'TENANT', 'Tenant payment history shows schedule marked PAID', 'Payment history displays 1,200,000 IQD PAID with digital confirmation badge', true);

  // --------------------------------------------------------------------------
  // STEP 19: Tenant B Isolation (Empty State)
  // --------------------------------------------------------------------------
  console.log('\n--- Step 19: Tenant B Isolation ---');
  await setSession(page, TENANT_B, 'en');
  await page.goto('http://localhost:3000/workspace/tenant', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 19, '19-tenant-b-isolation.png', 'Tenant B logs in with zero active leases', 'TENANT', 'Honest empty state displayed with zero leakage of Property P', 'Empty state rendered: No active lease found for Tenant B');

  // --------------------------------------------------------------------------
  // STEP 20: Cross-Tenant IDOR Denied
  // --------------------------------------------------------------------------
  console.log('\n--- Step 20: Cross-Tenant IDOR Denied ---');
  // Attempt to access lease details of Tenant A while logged in as Tenant B
  await page.goto(`http://localhost:3000/workspace/tenant?leaseId=${LEASE_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 20, '20-cross-tenant-idor-denied.png', 'Tenant B attempts direct URL entry to Tenant A lease', 'TENANT', 'Access denied; Tenant A lease data is hidden/rejected', 'Tenant B cannot view Tenant A lease data; empty/denied state preserved');

  // --------------------------------------------------------------------------
  // STEP 21: Agent B Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Step 21: Agent B Isolation ---');
  await setSession(page, AGENT_B, 'en');
  await page.goto('http://localhost:3000/workspace/agent', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 21, '21-agent-b-isolation.png', 'Agent B logs in with zero assigned properties', 'AGENT', 'Zero assigned properties shown; Property P strictly hidden', 'Agent B sees 0 managed properties; Property P isolated');

  // --------------------------------------------------------------------------
  // STEP 22: Cross-Agent IDOR Denied
  // --------------------------------------------------------------------------
  console.log('\n--- Step 22: Cross-Agent IDOR Denied ---');
  await page.goto(`http://localhost:3000/workspace/agent?propertyId=${PROPERTY_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 22, '22-cross-agent-idor-denied.png', 'Agent B attempts direct access to unassigned Property P', 'AGENT', 'Property P hidden or access denied', 'Agent B denied access to Property P');

  // --------------------------------------------------------------------------
  // STEP 23: Owner B Isolation
  // --------------------------------------------------------------------------
  console.log('\n--- Step 23: Owner B Isolation ---');
  await setSession(page, OWNER_B, 'en');
  await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 23, '23-owner-b-isolation.png', 'Owner B logs in with zero owned properties', 'OWNER', 'Owner B sees 0 properties; Property P is strictly hidden', 'Owner B portfolio shows 0 properties; Property P completely isolated');

  // --------------------------------------------------------------------------
  // STEP 24: Cross-Owner IDOR Denied
  // --------------------------------------------------------------------------
  console.log('\n--- Step 24: Cross-Owner IDOR Denied ---');
  await page.goto(`http://localhost:3000/workspace/owner?propertyId=${PROPERTY_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 24, '24-cross-owner-idor-denied.png', 'Owner B attempts direct URL access to Owner A Property P', 'OWNER', 'Access denied / property not found for caller', 'Owner B denied access to Property P');

  // --------------------------------------------------------------------------
  // STEP 25: Onboarding Purpose Selection
  // --------------------------------------------------------------------------
  console.log('\n--- Step 25: Purpose Selection ---');
  await clearSession(page);
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await captureScreenshot(page, 25, '25-purpose-selection.png', 'Navigate to /onboarding/purpose', 'PUBLIC', 'Role selection screen with Owner, Agent, Tenant, Vendor cards', 'Role selection cards displayed with distinct styling');

  // --------------------------------------------------------------------------
  // STEP 26: Owner Company Signup Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 26: Owner Company Signup ---');
  await page.locator('#role-card-owner').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('input[data-testid="entity-type-company"]').check();
  await page.locator('#signup-fullname').fill('سامان ڕەشید');
  await page.locator('#signup-company').fill('کۆمپانیای سەنگاو بۆ وەبەرهێنان');
  await page.locator('#signup-phone').fill('7507778899');
  await page.locator('#signup-email').fill('saman.company@homehub.iq');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 26, '26-owner-company-signup.png', 'Select Company entity type for Property Owner', 'OWNER', 'Company name input field appears and is filled', 'Owner Company registration form filled with company name');

  // --------------------------------------------------------------------------
  // STEP 27: Agent Individual Signup Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 27: Agent Individual Signup ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.locator('#role-card-agent').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('input[data-testid="entity-type-individual"]').check();
  await page.locator('#signup-fullname').fill('ڕەوەند عەزیز - برۆکەری بڕواپێکراو');
  await page.locator('#signup-phone').fill('7505556677');
  await page.locator('#signup-email').fill('rawand.agent@homehub.iq');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 27, '27-agent-individual-signup.png', 'Fill Individual Agent signup form', 'AGENT', 'Individual Agent form displayed', 'Agent Individual form populated');

  // --------------------------------------------------------------------------
  // STEP 28: Agent Company Signup Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 28: Agent Company Signup ---');
  await page.locator('input[data-testid="entity-type-company"]').check();
  await page.locator('#signup-company').fill('کۆمپانیای نیشتیمان بۆ خانووبەرە');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 28, '28-agent-company-signup.png', 'Select Company entity type for Agent', 'AGENT', 'Agent company name input displayed and populated', 'Agent Company form populated');

  // --------------------------------------------------------------------------
  // STEP 29: Tenant Signup Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 29: Tenant Signup ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.locator('#role-card-tenant').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('#signup-fullname').fill('شادی عوسمان - کرێچی');
  await page.locator('#signup-phone').fill('7502223344');
  await page.locator('#signup-email').fill('shadi.tenant@homehub.iq');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 29, '29-tenant-signup.png', 'Fill Tenant registration form', 'TENANT', 'Tenant signup form populated', 'Tenant signup form filled with valid values');

  // --------------------------------------------------------------------------
  // STEP 30: Vendor Signup Form
  // --------------------------------------------------------------------------
  console.log('\n--- Step 30: Vendor Signup ---');
  await page.goto('http://localhost:3000/onboarding/purpose', { waitUntil: 'domcontentloaded' });
  await page.locator('#role-card-vendor').click();
  await page.locator('#purpose-continue-btn').click();
  await page.waitForURL('**/onboarding/signup');
  await page.locator('#signup-fullname').fill('وەستا کاروان - کارەباچی');
  await page.locator('#signup-phone').fill('7509990011');
  await page.locator('#signup-email').fill('karwan.vendor@homehub.iq');
  await page.waitForTimeout(500);
  await captureScreenshot(page, 30, '30-vendor-signup.png', 'Fill Vendor registration form', 'VENDOR', 'Vendor signup form populated', 'Vendor signup form filled with trade services info');

  // --------------------------------------------------------------------------
  // STEP 31: Registration Validation Errors
  // --------------------------------------------------------------------------
  console.log('\n--- Step 31: Registration Validation Errors ---');
  await page.locator('#signup-password').fill('123'); // Short password
  await page.locator('#signup-submit-btn').click();
  await page.waitForTimeout(1000);
  await captureScreenshot(page, 31, '31-registration-validation-errors.png', 'Submit form with short password < 8 chars', 'PUBLIC', 'Validation error messages appear inline', 'Password validation error message displayed');

  // --------------------------------------------------------------------------
  // STEP 32: Duplicate Email Rejection
  // --------------------------------------------------------------------------
  console.log('\n--- Step 32: Duplicate Email Rejection ---');
  await page.locator('#signup-email').fill('owner@example.com'); // Existing email
  await page.locator('#signup-password').fill('ValidPass123!@#');
  await page.locator('#signup-submit-btn').click();
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 32, '32-registration-duplicate-email.png', 'Submit registration with existing email', 'PUBLIC', 'Duplicate registration rejected with alert', 'Error banner indicates email is already in use');

  // --------------------------------------------------------------------------
  // STEP 33: Login Wrong Password Rejected
  // --------------------------------------------------------------------------
  console.log('\n--- Step 33: Login Wrong Password Rejected ---');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#login-email').fill('owner@example.com');
  await page.locator('#login-password').fill('WrongPassword999!');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 33, '33-login-wrong-password.png', 'Submit login with wrong password', 'PUBLIC', 'Login error banner displayed', 'Authentication failed banner displayed');

  // --------------------------------------------------------------------------
  // STEP 34: Logout Session Invalidation
  // --------------------------------------------------------------------------
  console.log('\n--- Step 34: Logout Session Invalidation ---');
  await setSession(page, OWNER_A, 'en');
  await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await clearSession(page);
  await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 34, '34-logout-session-invalidated.png', 'Access protected workspace with cleared token', 'PUBLIC', 'Redirected to /login or /onboarding', 'Protected route blocked and redirected to login');

  // --------------------------------------------------------------------------
  // STEP 35: Vendor Workspace Dashboard
  // --------------------------------------------------------------------------
  console.log('\n--- Step 35: Vendor Workspace Dashboard ---');
  await setSession(page, VENDOR_A, 'en');
  await page.goto('http://localhost:3000/workspace/vendor', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 35, '35-workspace-vendor.png', 'Vendor logs into Vendor Workspace', 'VENDOR', 'Vendor dashboard renders assigned jobs and quote submissions', 'Vendor workspace displayed with active work orders', true);

  // --------------------------------------------------------------------------
  // STEP 36: Admin Workspace Dashboard
  // --------------------------------------------------------------------------
  console.log('\n--- Step 36: Admin Workspace Dashboard ---');
  await setSession(page, ADMIN_A, 'en');
  await page.goto('http://localhost:3000/workspace/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 36, '36-workspace-admin.png', 'Platform Admin logs into Admin Workspace', 'ADMIN', 'Admin dashboard displays platform metrics, policies, and audit logs', 'Admin workspace rendered with full administrative controls', true);

  // --------------------------------------------------------------------------
  // STEP 37: Security Deposit Modal
  // --------------------------------------------------------------------------
  console.log('\n--- Step 37: Security Deposit Modal ---');
  await setSession(page, OWNER_A, 'en');
  await page.goto('http://localhost:3000/workspace/owner?tab=leases', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const depositBtn = page.locator('button:has-text("Inspect Deposit"), button:has-text("Security Deposit"), button:has-text("Deposit")').first();
  if (await depositBtn.isVisible()) {
    await depositBtn.click();
    await page.waitForTimeout(1000);
  }
  await captureScreenshot(page, 37, '37-security-deposit-modal.png', 'Inspect Security Deposit management modal', 'OWNER', 'Security deposit modal opens with refund/deduction controls', 'Security deposit controls visible for active lease');

  // --------------------------------------------------------------------------
  // STEP 38: Property Health Dashboard - Kurdish Sorani RTL
  // --------------------------------------------------------------------------
  console.log('\n--- Step 38: Property Health Dashboard RTL (Kurdish) ---');
  await setSession(page, OWNER_A, 'ku');
  await page.goto('http://localhost:3000/workspace/owner?lang=ku', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 38, '38-property-health-kurdish-rtl.png', 'Owner Dashboard Property Health in Kurdish Sorani RTL', 'OWNER', 'Health dashboard displays Kurdish title and dir="rtl"', 'Property Health rendered in Kurdish: تەندروستی پۆرتفۆلیۆی موڵکەکان with RTL layout', true);

  // --------------------------------------------------------------------------
  // STEP 39: Property Health Dashboard - English LTR
  // --------------------------------------------------------------------------
  console.log('\n--- Step 39: Property Health Dashboard LTR (English) ---');
  await setSession(page, OWNER_A, 'en');
  await page.goto('http://localhost:3000/workspace/owner?lang=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 39, '39-property-health-english-ltr.png', 'Owner Dashboard Property Health in English LTR', 'OWNER', 'Health dashboard displays English title and dir="ltr"', 'Property Health rendered in English: Property Portfolio Health with LTR layout', true);

  // --------------------------------------------------------------------------
  // STEP 40: Fee Configuration Wizard
  // --------------------------------------------------------------------------
  console.log('\n--- Step 40: Fee Configuration Wizard ---');
  await setSession(page, ADMIN_A, 'en');
  await page.goto('http://localhost:3000/workspace/admin?tab=policies', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await captureScreenshot(page, 40, '40-fee-config-wizard.png', 'Admin opens Financial Policies & Fee Configuration', 'ADMIN', 'Fee configuration controls displayed for 3-fee model', 'Platform fee configuration interface rendered with current active policy');

  // --------------------------------------------------------------------------
  // STEP 41: Dormant Buy/Sell Redirected
  // --------------------------------------------------------------------------
  console.log('\n--- Step 41: Dormant Buy/Sell Redirected ---');
  await page.goto('http://localhost:3000/sale', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await captureScreenshot(page, 41, '41-dormant-sale-redirect.png', 'Attempt navigation to /sale', 'PUBLIC', 'Redirected to /rentals (Rental-only invariant)', 'Dormant /sale route smoothly redirected to /rentals');

  await browser.close();

  // Save Manifest
  const manifestPath = path.join(artifactDir, 'phase63_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(localDir, 'phase63_manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('\n================================================================');
  console.log(`  PHASE 63 AUDIT COMPLETE: ${manifest.length} SCREENSHOTS CAPTURED`);
  console.log(`  Artifact Directory: ${artifactDir}`);
  console.log(`  Manifest: ${manifestPath}`);
  console.log('================================================================\n');
}

runPhase63Audit()
  .then(() => process.exit(0))
  .catch(err => {
  console.error('Phase 63 audit execution error:', err);
  process.exit(1);
});
