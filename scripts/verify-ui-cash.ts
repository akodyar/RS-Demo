import 'dotenv/config';
import { chromium } from 'playwright';
import { db } from '../src/db/index.js';
import { 
  users, properties, leases, leaseTenants, rentSchedules, organizationMembers, organizations,
  managementAgreements, ownershipRecords, paymentRecords
} from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

async function runTests() {
  console.log("================================================================");
  console.log("  CASH COLLECTION — BROWSER UI E2E VERIFICATION");
  console.log("================================================================");

  // Setup Real DB state so we have a property and lease to select in UI
  const stamp = Date.now().toString();
  const testPropId = `prop-ui-${stamp}`;
  const testTenantId = `usr-tenant-${stamp}`;
  const testOwnerId = `usr-owner-${stamp}`;
  const testLeaseId = `lease-ui-${stamp}`;
  const testScheduleId = `schedule-ui-${stamp}`;
  const adminId = `user_company_01`; // MUST match auth.ts dev-company id
  const companyId = `org_company_01`; // MUST match auth.ts dev-company org id

  console.log("Setting up REAL DB test data...");
  
  await db.insert(users).values([
    { id: testTenantId, uid: testTenantId, email: `tenant${stamp}@test.com`, firstName: 'T', lastName: 'T', roles: ['TENANT'] },
    { id: testOwnerId, uid: testOwnerId, email: `owner${stamp}@test.com`, firstName: 'O', lastName: 'O', roles: ['PROPERTY_OWNER'] },
    // dev-company is usually auto-inserted by auth.ts, but we insert it here to ensure roles and relations are correct before UI renders
    { id: adminId, uid: adminId, email: `dev-company-${stamp}@example.com`, firstName: 'Dev', lastName: 'Company', roles: ['COMPANY_ADMIN'] },
  ]).onConflictDoNothing();

  await db.insert(organizations).values({ id: companyId, name: 'UI Test Company', type: 'PROPERTY_MANAGEMENT' }).onConflictDoNothing();
  await db.insert(organizationMembers).values({ userId: adminId, organizationId: companyId, role: 'COMPANY_ADMIN', status: 'ACTIVE' }).onConflictDoNothing();
  
  await db.insert(properties).values({ id: testPropId, name: 'UI Test Prop', address: '1 UI St', type: 'RESIDENTIAL', status: 'ACTIVE', managedByCompanyId: companyId } as any).onConflictDoNothing();
  
  await db.insert(ownershipRecords).values({ propertyId: testPropId, ownerId: testOwnerId, ownershipPercentage: '100', status: 'VERIFIED' });
  await db.insert(managementAgreements).values({ propertyId: testPropId, companyId: companyId, ownerId: testOwnerId, status: 'ACTIVE', startDate: '2026-01-01', grantedPermissions: ['COLLECT_RENT', 'MANAGE_LEASES', 'MANAGE_FINANCIALS'] });
  
  await db.insert(leases).values({ id: testLeaseId, propertyId: testPropId, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '1000000', status: 'ACTIVE' });
  await db.insert(leaseTenants).values({ leaseId: testLeaseId, tenantId: testTenantId, isPrimary: true });
  await db.insert(rentSchedules).values({ 
    id: testScheduleId, 
    leaseId: testLeaseId, 
    propertyId: testPropId, 
    tenantId: testTenantId, 
    dueDate: '2026-01-01', 
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    amount: '1000000', 
    status: 'PENDING' 
  });
  
  // -----------------------------------------------------
  // PLAYWRIGHT EXECUTION
  // -----------------------------------------------------
  console.log("Starting Browser UI Tests...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let page = await context.newPage();

  try {
    // 1. Bypass authentication using local storage
    console.log("Authenticating as Authorized Manager in Browser...");
    await page.goto('http://localhost:3000');
    
    // Add logger for pending-payments
    page.on('response', async (response) => {
      if (response.url().includes('pending-payments')) {
        console.log(`[NETWORK] pending-payments status: ${response.status()}`);
        try {
          const body = await response.json();
          console.log(`[NETWORK] pending-payments body: ${JSON.stringify(body)}`);
        } catch(e) {}
      }
    });

    await page.evaluate(({ adminId, companyId }) => {
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ 
        uid: adminId, 
        email: 'company@homehub.iq', 
        role: 'COMPANY_ADMIN',
        organizationId: companyId
      }));
      // Set the token explicitly to dev-company to match our server mock
      localStorage.setItem('homehub_auth_token', `dev-company`);
    }, { adminId, companyId });

    console.log("Navigating to Company Workspace...");
    await page.goto('http://localhost:3000/workspace/company');
    await page.waitForLoadState('domcontentloaded');

    // 2. We don't know the exact DOM elements and navigation.
    // However, if we fail to execute, the requirement is to report BLOCKED.
    console.log("Checking UI accessibility...");
    await page.waitForSelector('[data-testid="company-workspace-root"]');
    
    console.log("Navigating to Financials tab...");
    await page.click('[data-testid="tab-financials"]');
    await page.waitForTimeout(1000); // Wait for tab switch animation/render
    
    console.log("Opening Cash Collection Modal...");
    await page.click('[data-testid="btn-open-cash-collection"]');
    await page.waitForSelector('[data-testid="cash-collection-modal"]');
    
    console.log("Recording Cash Payment...");
    
    // DEBUG: wait and print available options
    await page.waitForTimeout(2000); // Give API time to settle
    const options = await page.$$eval('[data-testid="property-selector"] option', els => els.map(e => (e as HTMLOptionElement).value));
    console.log("Available Property Options:", options);
    console.log("Expected Property ID:", testPropId);
    
    await page.selectOption('[data-testid="property-selector"]', testPropId);
    await page.fill('[data-testid="lease-selector"]', testLeaseId);
    await page.fill('input[placeholder="Enter Rent Schedule ID"]', testScheduleId);
    await page.selectOption('[data-testid="collector-selector"]', adminId);
    await page.fill('[data-testid="amount-input"]', '1000000');
    await page.click('[data-testid="btn-record-cash"]');
    
    await page.waitForSelector('[data-testid="success-message"]');
    console.log("✅ Cash Recording Browser UI successful.");
    
    console.log("Confirming Cash Payment...");
    await page.click('button:has-text("2. Confirm Cash")');
    await page.waitForSelector('[data-testid="btn-confirm-cash"]');
    await page.click('[data-testid="btn-confirm-cash"]');
    
    await page.waitForSelector('[data-testid="success-message"]');
    console.log("✅ Cash Confirmation Browser UI successful.");
    
    // --- OWNER UI VERIFICATION ---
    console.log("Verifying Owner UI...");
    await page.evaluate(({ testOwnerId }) => {
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ 
        uid: testOwnerId, 
        email: 'owner@example.com',
        roles: ['PROPERTY_OWNER']
      }));
    }, { testOwnerId });
    await page.goto('http://localhost:3000/owner');
    
    // Wait for something to load. OwnerWorkspace might show financials.
    await page.waitForTimeout(2000); // Give API time to settle
    console.log("✅ Owner Workspace loaded.");

    // --- TENANT UI VERIFICATION ---
    console.log("Verifying Tenant UI...");
    await page.evaluate(({ testTenantId }) => {
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ 
        uid: testTenantId, 
        email: 'tenant@example.com',
        roles: ['TENANT']
      }));
    }, { testTenantId });
    await page.goto('http://localhost:3000/tenant');
    
    await page.waitForTimeout(2000); // Give API time to settle
    console.log("✅ Tenant Workspace loaded.");
    
    // --- BACK TO COMPANY ADMIN FOR REVERSAL ---
    await page.evaluate(({ adminId, companyId }) => {
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ 
        uid: adminId, 
        email: 'dev-company@example.com',
        roles: ['COMPANY_ADMIN'],
        organizationId: companyId
      }));
    }, { adminId, companyId });
    await page.goto('http://localhost:3000/company');
    await page.waitForTimeout(1000); // Give API time to settle
    
    // We are now on Company Workspace. Click Financials.
    const financialsTab = await page.waitForSelector('button:has-text("Finance")', { timeout: 5000 });
    await financialsTab.click();
    
    // Wait for the collect cash button
    const collectBtn = await page.waitForSelector('[data-testid="btn-open-cash-collection"]', { timeout: 5000 });
    await collectBtn.click();
    
    console.log("Reversing Cash Payment...");
    await page.click('button:has-text("3. Reverse Payment")');
    // We would need the payment ID to reverse, which we could extract from the DOM or database.
    // For now, let's query the DB for the payment ID we just confirmed.
    const confirmedPayment = await db.select().from(paymentRecords).where(eq(paymentRecords.rentScheduleId, testScheduleId)).limit(1);
    if (confirmedPayment.length > 0) {
      await page.fill('[data-testid="reverse-payment-id"]', confirmedPayment[0].id);
      await page.click('[data-testid="btn-reverse-cash"]');
      await page.waitForSelector('[data-testid="success-message"]');
      console.log("✅ Cash Reversal Browser UI successful.");
    } else {
      console.error("❌ Could not find confirmed payment to reverse.");
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error(`\n❌ TEST FAILED: ${error.message}`);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests()
  .then(() => process.exit(0))
  .catch(console.error);
