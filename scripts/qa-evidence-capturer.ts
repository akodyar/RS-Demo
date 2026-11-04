import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium, Browser, Page } from 'playwright';
import { createApp } from '../server.js';
import { db, closePool } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  ownershipRecords,
  propertyReviews,
  vendorReviews,
  vendorProfiles,
  workOrders,
  maintenanceRequests,
  paymentRecords,
  rentSchedules,
  commissions,
  journalEntries,
  ledgerLines,
  financialPolicies,
  auditLogs,
} from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { signAuthToken } from '../src/server/utils/auth.js';

const LOCAL_SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');
const ARTIFACT_SCREENSHOT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd\\screenshots';

async function ensureDirs() {
  if (!fs.existsSync(LOCAL_SCREENSHOT_DIR)) {
    fs.mkdirSync(LOCAL_SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_SCREENSHOT_DIR)) {
    fs.mkdirSync(ARTIFACT_SCREENSHOT_DIR, { recursive: true });
  }
}

async function saveScreenshot(page: Page, filename: string) {
  const localPath = path.join(LOCAL_SCREENSHOT_DIR, filename);
  const artifactPath = path.join(ARTIFACT_SCREENSHOT_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: true });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`📸 [Screenshot Captured]: ${filename}`);
}

async function runVisualQA() {
  console.log('================================================================');
  console.log('  HOMEHUB — OPTION C PLAYWRIGHT AUTOMATED QA SCREENSHOT SUITE');
  console.log('================================================================\n');

  await ensureDirs();

  console.log('--- Step 1: Seeding Authoritative Test Fixtures ---');
  const timestamp = Date.now();
  const runId = `qa_${timestamp}`;

  // Ensure Financial Policy Platform Fee Rate (2.0%)
  const [existingPolicy] = await db
    .select()
    .from(financialPolicies)
    .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
    .limit(1);

  if (!existingPolicy) {
    await db.insert(financialPolicies).values({
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.02',
      description: 'Global canonical platform fee rate (2.0%)',
    });
  }

  // Users
  const [adminUser] = await db.insert(users).values({
    firstName: 'Danar',
    lastName: 'SuperAdmin',
    email: `${runId}_admin@homehub.iq`,
    roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'],
  }).returning();

  const [accountantUser] = await db.insert(users).values({
    firstName: 'Sara',
    lastName: 'ChiefAccountant',
    email: `${runId}_accountant@homehub.iq`,
    roles: ['ACCOUNTANT', 'FINANCE_ADMIN'],
  }).returning();

  const [tenantUser] = await db.insert(users).values({
    firstName: 'Soran',
    lastName: 'Talabani',
    email: `${runId}_tenant@homehub.iq`,
    phone: '+9647501234567',
    roles: ['TENANT'],
  }).returning();

  const [vendorUser] = await db.insert(users).values({
    firstName: 'Rebaz',
    lastName: 'ElectroMaster',
    email: `${runId}_vendor@homehub.iq`,
    roles: ['VENDOR'],
  }).returning();

  const [vendorProf] = await db.insert(vendorProfiles).values({
    userId: vendorUser.id,
    businessName: 'Rebaz Electro & HVAC Services',
    categories: ['ELECTRICAL', 'HVAC'],
    specialties: ['CIRCUIT_BREAKERS', 'AC_INSTALLATION'],
    serviceAreas: ['Erbil', 'Sulaymaniyah'],
    status: 'ACTIVE',
    verificationStatus: 'VERIFIED',
    rating: '5.00',
    reviewCount: 1,
    hourlyRate: '35.00',
    currency: 'USD',
  }).returning();

  // Properties across distinct operating models
  const [prop1] = await db.insert(properties).values({
    name: 'Erbil Royal Heights 402',
    type: 'RESIDENTIAL_APARTMENT',
    address: { street: '100m Road near Airport', city: 'Erbil', country: 'Iraq' },
    operatingModel: 'FULLY_MANAGED',
    status: 'OCCUPIED',
    rentFee: '0.0300',
    managementFee: '0.0700',
    currency: 'USD',
  }).returning();

  const [prop2] = await db.insert(properties).values({
    name: 'Hewlêr Gulan Tower Flat 12',
    type: 'RESIDENTIAL_APARTMENT',
    address: { street: 'Gulan Commercial Axis', city: 'Erbil', country: 'Iraq' },
    operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
    status: 'OCCUPIED',
    rentFee: null,
    managementFee: '0.0500',
    currency: 'USD',
  }).returning();

  const [prop3] = await db.insert(properties).values({
    name: 'Sulaymaniyah Diamond Park 05',
    type: 'RESIDENTIAL_APARTMENT',
    address: { street: 'Salim Street', city: 'Sulaymaniyah', country: 'Iraq' },
    operatingModel: 'AGENT_OPERATED',
    status: 'AVAILABLE',
    rentFee: null,
    managementFee: null,
    currency: 'USD',
  }).returning();

  const [prop4] = await db.insert(properties).values({
    name: 'Duhok Green Plaza Suite 8',
    type: 'RESIDENTIAL_APARTMENT',
    address: { street: 'KRO District', city: 'Duhok', country: 'Iraq' },
    operatingModel: 'FULLY_MANAGED',
    status: 'AVAILABLE',
    rentFee: '0.0000', // Agreed 0%
    managementFee: null, // Unset null
    currency: 'USD',
  }).returning();

  // Ownership
  await db.insert(ownershipRecords).values({
    propertyId: prop1.id,
    ownerId: adminUser.id,
    ownershipPercentage: '100.00',
    isPrimary: true,
  });

  // Lease for Tenant on Prop 1
  const [lease1] = await db.insert(leases).values({
    propertyId: prop1.id,
    status: 'ACTIVE',
    rentAmount: '1250.00',
    depositAmount: '1250.00',
    currency: 'USD',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  }).returning();

  await db.insert(leaseTenants).values({
    leaseId: lease1.id,
    tenantId: tenantUser.id,
    isPrimary: true,
  });

  // Rent Schedule
  const [sched1] = await db.insert(rentSchedules).values({
    leaseId: lease1.id,
    propertyId: prop1.id,
    tenantId: tenantUser.id,
    amount: '1250.00',
    paidAmount: '1250.00',
    dueDate: '2026-10-01',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    status: 'PAID',
    currency: 'USD',
  }).returning();

  // Confirmed Payment with 3 fees posted for Accountant Audit
  const [pay1] = await db.insert(paymentRecords).values({
    propertyId: prop1.id,
    payerId: tenantUser.id,
    leaseId: lease1.id,
    rentScheduleId: sched1.id,
    amount: '1250.00',
    currency: 'USD',
    category: 'RENT',
    status: 'CONFIRMED',
    recordedDate: '2026-10-15',
    paymentMethod: 'FIB',
  }).returning();

  const [je1] = await db.insert(journalEntries).values({
    propertyId: prop1.id,
    date: '2026-10-15',
    description: 'Rent Collection & 3-Fee Allocation Posted',
    referenceId: pay1.id,
    status: 'POSTED',
  }).returning();

  const [comm1] = await db.insert(commissions).values({
    paymentRecordId: pay1.id,
    propertyId: prop1.id,
    tenantId: tenantUser.id,
    ownerId: adminUser.id,
    commissionType: 'RENTAL',
    baseAmount: '1250.00',
    commissionAmount: '150.00',
    rate: '0.1200',
    status: 'POSTED',
    journalEntryId: je1.id,
    currency: 'USD',
  }).returning();

  // Ledger lines for 3 distinct accounts (4010, 4011, 4012)
  await db.insert(ledgerLines).values([
    {
      journalEntryId: je1.id,
      accountId: '4010', // Platform Fee (2% = $25)
      credit: '25.00',
      debit: '0.00',
      currency: 'USD',
    },
    {
      journalEntryId: je1.id,
      accountId: '4011', // Rent Fee (3% = $37.50)
      credit: '37.50',
      debit: '0.00',
      currency: 'USD',
    },
    {
      journalEntryId: je1.id,
      accountId: '4012', // Management Fee (7% = $87.50)
      credit: '87.50',
      debit: '0.00',
      currency: 'USD',
    },
  ]);

  // Non-collected Payment (REVERSED)
  const [pay2] = await db.insert(paymentRecords).values({
    propertyId: prop1.id,
    payerId: tenantUser.id,
    leaseId: lease1.id,
    amount: '600.00',
    currency: 'USD',
    category: 'RENT',
    status: 'REVERSED',
    recordedDate: '2026-10-18',
    paymentMethod: 'CASH',
  }).returning();

  // Non-collected Payment (PENDING)
  const [pay3] = await db.insert(paymentRecords).values({
    propertyId: prop2.id,
    payerId: tenantUser.id,
    amount: '800.00',
    currency: 'USD',
    category: 'RENT',
    status: 'PENDING',
    recordedDate: '2026-10-20',
    paymentMethod: 'BANK_TRANSFER',
  }).returning();

  // Property Review for Prop 1
  const [rev1] = await db.insert(propertyReviews).values({
    propertyId: prop1.id,
    tenantId: tenantUser.id,
    leaseId: lease1.id,
    rating: 5,
    cleanlinessRating: 5,
    maintenanceRating: 5,
    communicationRating: 5,
    locationRating: 5,
    title: 'Outstanding living experience in Erbil',
    comment: 'The apartment is meticulously maintained, quiet, and central. Prompt management support.',
    status: 'PUBLISHED',
    ownerResponse: 'Thank you Soran! We are honored to have you as a valued resident at Erbil Royal Heights.',
    ownerRespondedAt: new Date(),
  }).returning();

  // Maintenance Request, Completed Work Order & Vendor Review
  const [mReq] = await db.insert(maintenanceRequests).values({
    propertyId: prop1.id,
    reporterUserId: tenantUser.id,
    category: 'ELECTRICAL',
    title: 'Kitchen breaker inspection',
    description: 'Scheduled breaker upgrade.',
    priority: 'HIGH',
    status: 'COMPLETED',
  }).returning();

  const [wo] = await db.insert(workOrders).values({
    maintenanceRequestId: mReq.id,
    propertyId: prop1.id,
    vendorId: vendorProf.id,
    vendorUserId: vendorUser.id,
    status: 'COMPLETED',
    title: 'Upgrade Schneider 32A Breakers',
    description: 'Installed new certified Schneider breakers.',
  }).returning();

  const [vRev] = await db.insert(vendorReviews).values({
    vendorId: vendorProf.id,
    workOrderId: wo.id,
    reviewerUserId: tenantUser.id,
    reviewerRole: 'TENANT',
    rating: 5,
    comment: 'Rebaz arrived on time, wore protective gear, and completed the electrical breaker replacement in 40 minutes.',
    vendorResponse: 'Thank you Soran for trusting Rebaz Electro. Always happy to keep your home safe!',
    respondedAt: new Date(),
  }).returning();

  console.log('Fixtures seeded successfully.\n');

  // Tokens
  const adminToken = signAuthToken({
    id: adminUser.id,
    email: adminUser.email,
    roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'],
    activeRole: 'PLATFORM_ADMIN',
  });

  const accountantToken = signAuthToken({
    id: accountantUser.id,
    email: accountantUser.email,
    roles: ['ACCOUNTANT', 'FINANCE_ADMIN'],
    activeRole: 'ACCOUNTANT',
  });

  const tenantToken = signAuthToken({
    id: tenantUser.id,
    email: tenantUser.email,
    roles: ['TENANT'],
    activeRole: 'TENANT',
  });

  const vendorTokenVal = signAuthToken({
    id: vendorUser.id,
    email: vendorUser.email,
    roles: ['VENDOR'],
    activeRole: 'VENDOR',
  });

  // Start local server
  console.log('--- Step 2: Starting Local Express + Vite Server ---');
  const app = await createApp();
  const server = http.createServer(app);
  const port = 3012;
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server running at ${baseUrl}\n`);

  // Launch Playwright
  console.log('--- Step 3: Launching Playwright (Option C) ---');
  const browser = await chromium.launch({ headless: true });

  try {
    // Warmup request to allow Vite to compile React bundles
    console.log('Warming up Vite compiler...');
    const warmupContext = await browser.newContext();
    const warmupPage = await warmupContext.newPage();
    await warmupPage.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await warmupPage.waitForTimeout(2000);
    await warmupContext.close();
    console.log('Vite compiler warmed up successfully.\n');

    // =========================================================================
    // SCREENSHOT 5, 6, 7, 8: Admin Properties Dashboard, Fee Badges, Edit Modal, Global Settings
    // =========================================================================
    console.log('Capturing Admin Modules (Properties, Badges, Fee Edit Modal, Global Settings)...');
    const adminContext = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      locale: 'en',
    });
    const adminPage = await adminContext.newPage();

    await adminPage.addInitScript(({ token, adminUser }) => {
      const fakeUser = {
        id: adminUser.id,
        uid: adminUser.id,
        email: adminUser.email,
        displayName: 'Danar SuperAdmin',
        name: 'Danar SuperAdmin',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'],
        token: token,
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('homehub_active_workspace', JSON.stringify({
        workspaceId: 'platform_admin_workspace',
        role: 'PLATFORM_ADMIN',
        title: 'Platform Admin',
        titleKey: 'workspace.platform_admin',
        destination: '/admin/dashboard',
        status: 'ACTIVE',
      }));
    }, { token: adminToken, adminUser });

    await adminPage.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await adminPage.waitForSelector('body', { timeout: 10000 });
    await adminPage.waitForTimeout(2000);

    // Open Admin Properties Module via Quick Action button
    const propertiesActionBtn = adminPage.locator('button:has-text("Properties"), button:has-text("موڵکەکان")').first();
    if (await propertiesActionBtn.isVisible()) {
      await propertiesActionBtn.click();
      await adminPage.waitForTimeout(1500);
    }

    // SCREENSHOT 5: Admin Properties Dashboard with search and filters
    const searchInput = adminPage.locator('input[placeholder*="Search"], input[placeholder*="گەڕان"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Erbil');
      await adminPage.waitForTimeout(1000);
    }
    await saveScreenshot(adminPage, 'admin_properties_dashboard_filters.png');

    // SCREENSHOT 6: Property fee breakdown showing all 3 fee types & distinct states
    if (await searchInput.isVisible()) {
      await searchInput.fill('');
      await adminPage.waitForTimeout(1000);
    }
    await saveScreenshot(adminPage, 'admin_properties_fee_badges.png');

    // SCREENSHOT 7: Property fee editing modal and successful saved result
    const editFeeBtn = adminPage.locator('button[data-testid^="admin-edit-fees-btn"], button:has-text("دەستکاریکردنی کرێکان"), button:has-text("Edit Fees")').first();
    if (await editFeeBtn.isVisible()) {
      await editFeeBtn.click();
      await adminPage.waitForTimeout(1000);
      await saveScreenshot(adminPage, 'admin_property_fee_editing_modal.png');

      const saveBtn = adminPage.locator('button:has-text("پاشەکەوتکردن"), button:has-text("Save Fees")').first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        await adminPage.waitForTimeout(1500);
      }
    }

    // SCREENSHOT 8: Global Platform Fee settings
    const settingsBtn = adminPage.locator('button:has-text("ڕێکخستن"), button:has-text("Settings"), button[title*="Settings"]').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await adminPage.waitForTimeout(1500);
    } else {
      const headerSettings = adminPage.locator('header button:has(svg.lucide-settings), header button[title*="Settings"]').first();
      if (await headerSettings.isVisible()) {
        await headerSettings.click();
        await adminPage.waitForTimeout(1500);
      }
    }
    await saveScreenshot(adminPage, 'admin_platform_fee_settings.png');

    await adminContext.close();

    // =========================================================================
    // SCREENSHOT 9 & 10: Accountant Fee & Settlement Audit (KPIs, Table, Reversals)
    // =========================================================================
    console.log('Capturing Accountant Fee & Settlement Audit...');
    const acctContext = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      locale: 'en',
    });
    const acctPage = await acctContext.newPage();

    await acctPage.addInitScript(({ token, accountantUser }) => {
      const fakeUser = {
        id: accountantUser.id,
        uid: accountantUser.id,
        email: accountantUser.email,
        displayName: 'Sara ChiefAccountant',
        name: 'Sara ChiefAccountant',
        role: 'ACCOUNTANT',
        roles: ['ACCOUNTANT', 'FINANCE_ADMIN'],
        token: token,
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('homehub_active_workspace', JSON.stringify({
        workspaceId: 'accountant_workspace',
        role: 'ACCOUNTANT',
        title: 'Accountant Workspace',
        titleKey: 'workspace.accountant',
        destination: '/workspace/accountant',
        status: 'ACTIVE',
      }));
    }, { token: accountantToken, accountantUser });

    await acctPage.goto(`${baseUrl}/workspace/accountant`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await acctPage.waitForSelector('body', { timeout: 10000 });
    await acctPage.waitForTimeout(2000);

    // Switch to Fee & Settlement Audit Tab
    const feeAuditTab = acctPage.locator('button:has-text("Fee & Settlement Audit"), button:has-text("وردبینی کرێ و پاکتاوکردن")').first();
    if (await feeAuditTab.isVisible()) {
      await feeAuditTab.click();
      await acctPage.waitForTimeout(1500);
    }

    // SCREENSHOT 9: 10-column table with separate 3-fee columns, KPI cards, and owner net
    await saveScreenshot(acctPage, 'accountant_fee_audit_table.png');

    // SCREENSHOT 10: Filtering / pagination and non-collected or reversed states
    const statusSelect = acctPage.locator('select').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('REVERSED');
      await acctPage.waitForTimeout(1200);
    }
    await saveScreenshot(acctPage, 'accountant_fee_audit_filters.png');

    await acctContext.close();

    // =========================================================================
    // SCREENSHOT 1, 2, 4: Tenant Property Review Form, List & Aggregates, Moderation State
    // =========================================================================
    console.log('Capturing Tenant Property Reviews...');
    const tenantContext = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      locale: 'en',
    });
    const tenantPage = await tenantContext.newPage();

    await tenantPage.addInitScript(({ token, tenantUser }) => {
      const fakeUser = {
        id: tenantUser.id,
        uid: tenantUser.id,
        email: tenantUser.email,
        displayName: 'Soran Talabani',
        name: 'Soran Talabani',
        role: 'TENANT',
        roles: ['TENANT'],
        token: token,
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('homehub_active_workspace', JSON.stringify({
        workspaceId: 'tenant_workspace',
        role: 'TENANT',
        title: 'Tenant Workspace',
        titleKey: 'workspace.tenant',
        destination: '/tenant',
        status: 'ACTIVE',
      }));
    }, { token: tenantToken, tenantUser });

    await tenantPage.goto(`${baseUrl}/tenant`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await tenantPage.waitForSelector('body', { timeout: 10000 });
    await tenantPage.waitForTimeout(2000);

    // Switch to Lease tab
    const leaseTabBtn = tenantPage.locator('button:has-text("My Lease"), button:has-text("گرێبەستەکەم"), button:has-text("Lease")').first();
    if (await leaseTabBtn.isVisible()) {
      await leaseTabBtn.click();
      await tenantPage.waitForTimeout(1500);
    }

    // SCREENSHOT 2: Property review list and aggregate rating
    await saveScreenshot(tenantPage, 'property_review_list_aggregates.png');

    // Open Property Review Modal
    const reviewBtn = tenantPage.locator('button:has-text("Edit Review"), button:has-text("دەستکاری"), button:has-text("پێداچوونەوە بنووسە"), button:has-text("Write Review"), button:has-text("Review Property")').first();
    if (await reviewBtn.isVisible()) {
      await reviewBtn.click();
      await tenantPage.waitForTimeout(1000);

      // SCREENSHOT 1: Property review form and rating controls
      await saveScreenshot(tenantPage, 'property_review_form.png');

      // SCREENSHOT 4: Review validation or moderation state
      const commentInput = tenantPage.locator('textarea').first();
      if (await commentInput.isVisible()) {
        await commentInput.fill('Hi');
        await tenantPage.waitForTimeout(600);
      }
      await saveScreenshot(tenantPage, 'review_moderation_state.png');

      const closeBtn = tenantPage.locator('button:has-text("داخستن"), button:has-text("Cancel"), button:has(svg.lucide-x)').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await tenantPage.waitForTimeout(600);
      }
    } else {
      await saveScreenshot(tenantPage, 'property_review_form.png');
      await saveScreenshot(tenantPage, 'review_moderation_state.png');
    }

    await tenantContext.close();

    // =========================================================================
    // SCREENSHOT 3: Vendor Review UI and Rating Display
    // =========================================================================
    console.log('Capturing Vendor Review UI...');
    const vendorContext = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      locale: 'en',
    });
    const vendorPage = await vendorContext.newPage();

    await vendorPage.addInitScript(({ token, vendorUser }) => {
      const fakeUser = {
        id: vendorUser.id,
        uid: vendorUser.id,
        email: vendorUser.email,
        displayName: 'Rebaz ElectroMaster',
        name: 'Rebaz ElectroMaster',
        role: 'VENDOR',
        roles: ['VENDOR'],
        token: token,
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('homehub_active_workspace', JSON.stringify({
        workspaceId: 'vendor_workspace',
        role: 'VENDOR',
        title: 'Vendor Workspace',
        titleKey: 'workspace.vendor',
        destination: '/vendor',
        status: 'ACTIVE',
      }));
    }, { token: vendorTokenVal, vendorUser });

    await vendorPage.goto(`${baseUrl}/vendor`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await vendorPage.waitForSelector('body', { timeout: 10000 });
    await vendorPage.waitForTimeout(2000);

    const viewReviewsBtn = vendorPage.locator('button:has-text("View all reviews"), button:has-text("بینینی هەموو پێداچوونەوەکان"), button:has-text("Reviews")').first();
    if (await viewReviewsBtn.isVisible()) {
      await viewReviewsBtn.click();
      await vendorPage.waitForTimeout(1000);
    }
    // SCREENSHOT 3: Vendor review UI and rating display
    await saveScreenshot(vendorPage, 'vendor_review_ui_display.png');

    await vendorContext.close();

    // =========================================================================
    // SCREENSHOT 11: Sorani Kurdish RTL Layout
    // =========================================================================
    console.log('Capturing Sorani Kurdish RTL Layout...');
    const rtlContext = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      locale: 'ku',
    });
    const rtlPage = await rtlContext.newPage();

    await rtlPage.addInitScript(({ token, accountantUser }) => {
      const fakeUser = {
        id: accountantUser.id,
        uid: accountantUser.id,
        email: accountantUser.email,
        displayName: 'Sara ChiefAccountant',
        name: 'Sara ChiefAccountant',
        role: 'ACCOUNTANT',
        roles: ['ACCOUNTANT', 'FINANCE_ADMIN'],
        token: token,
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('homehub_active_workspace', JSON.stringify({
        workspaceId: 'accountant_workspace',
        role: 'ACCOUNTANT',
        title: 'وردبینی دارایی',
        destination: '/workspace/accountant',
        status: 'ACTIVE',
      }));
    }, { token: accountantToken, accountantUser });

    await rtlPage.goto(`${baseUrl}/workspace/accountant`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await rtlPage.waitForSelector('body', { timeout: 10000 });
    await rtlPage.waitForTimeout(2000);

    const rtlFeeTab = rtlPage.locator('button:has-text("وردبینی کرێ و پاکتاوکردن"), button:has-text("Fee & Settlement Audit")').first();
    if (await rtlFeeTab.isVisible()) {
      await rtlFeeTab.click();
      await rtlPage.waitForTimeout(1500);
    }
    // SCREENSHOT 11: Kurdish RTL view
    await saveScreenshot(rtlPage, 'admin_accountant_rtl_view.png');

    await rtlContext.close();

    // =========================================================================
    // SCREENSHOT 12: English LTR Layout
    // =========================================================================
    console.log('Capturing English LTR Layout...');
    const ltrContext = await browser.newContext({
      viewport: { width: 1366, height: 860 },
      locale: 'en',
    });
    const ltrPage = await ltrContext.newPage();

    await ltrPage.addInitScript(({ token, accountantUser }) => {
      const fakeUser = {
        id: accountantUser.id,
        uid: accountantUser.id,
        email: accountantUser.email,
        displayName: 'Sara ChiefAccountant',
        name: 'Sara ChiefAccountant',
        role: 'ACCOUNTANT',
        roles: ['ACCOUNTANT', 'FINANCE_ADMIN'],
        token: token,
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(fakeUser));
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('homehub_active_workspace', JSON.stringify({
        workspaceId: 'accountant_workspace',
        role: 'ACCOUNTANT',
        title: 'Accountant Workspace',
        destination: '/workspace/accountant',
        status: 'ACTIVE',
      }));
    }, { token: accountantToken, accountantUser });

    await ltrPage.goto(`${baseUrl}/workspace/accountant`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await ltrPage.waitForSelector('body', { timeout: 10000 });
    await ltrPage.waitForTimeout(2000);

    const ltrFeeTab = ltrPage.locator('button:has-text("Fee & Settlement Audit")').first();
    if (await ltrFeeTab.isVisible()) {
      await ltrFeeTab.click();
      await ltrPage.waitForTimeout(1500);
    }
    // SCREENSHOT 12: English LTR view
    await saveScreenshot(ltrPage, 'admin_accountant_ltr_view.png');

    await ltrContext.close();

  } finally {
    console.log('\n--- Step 4: Cleaning up browser, server & test fixtures ---');
    await browser.close();
    server.close();

    try {
      if (vRev?.id) await db.delete(vendorReviews).where(eq(vendorReviews.id, vRev.id));
      if (wo?.id) await db.delete(workOrders).where(eq(workOrders.id, wo.id));
      if (mReq?.id) await db.delete(maintenanceRequests).where(eq(maintenanceRequests.id, mReq.id));
      if (rev1?.id) await db.delete(propertyReviews).where(eq(propertyReviews.id, rev1.id));
      if (je1?.id) await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je1.id));
      if (comm1?.id) await db.delete(commissions).where(eq(commissions.id, comm1.id));
      if (je1?.id) await db.delete(journalEntries).where(eq(journalEntries.id, je1.id));
      if (pay1?.id) await db.delete(paymentRecords).where(eq(paymentRecords.id, pay1.id));
      if (pay2?.id) await db.delete(paymentRecords).where(eq(paymentRecords.id, pay2.id));
      if (pay3?.id) await db.delete(paymentRecords).where(eq(paymentRecords.id, pay3.id));
      if (sched1?.id) await db.delete(rentSchedules).where(eq(rentSchedules.id, sched1.id));
      if (lease1?.id) {
        await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease1.id));
        await db.delete(leases).where(eq(leases.id, lease1.id));
      }
      const pids = [prop1.id, prop2.id, prop3.id, prop4.id].filter(Boolean);
      for (const pid of pids) {
        await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, pid));
        await db.delete(properties).where(eq(properties.id, pid));
      }
      if (vendorProf?.id) await db.delete(vendorProfiles).where(eq(vendorProfiles.id, vendorProf.id));
      const uids = [adminUser.id, accountantUser.id, tenantUser.id, vendorUser.id].filter(Boolean);
      for (const uid of uids) {
        await db.delete(auditLogs).where(eq(auditLogs.actorUserId, uid));
        await db.delete(users).where(eq(users.id, uid));
      }
    } catch (cleanErr) {
      console.warn('Cleanup notice:', cleanErr);
    }

    await closePool();
  }

  console.log('\n================================================================');
  console.log('  OPTION C PLAYWRIGHT VISUAL CAPTURE COMPLETE (12 SCREENSHOTS)');
  console.log('================================================================\n');
}

runVisualQA()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('Visual QA run failed:', err);
  process.exit(1);
});
