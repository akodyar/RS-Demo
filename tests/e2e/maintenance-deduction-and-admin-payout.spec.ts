import { test, expect, Page } from '@playwright/test';
import { db } from '../../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  chartOfAccounts,
  ownerSettlements,
  payoutRequests,
  journalEntries,
  ledgerLines,
  ownershipRecords,
} from '../../src/db/schema.js';
import { financeRepository } from '../../src/server/repositories/finance.js';
import { eq, desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

test.describe('HomeHub Maintenance Deduction & Admin Payout E2E Suite', () => {
  const runId = `maint_${Date.now()}`;
  const ownerUserId = 'user_owner_02';
  const adminUserId = 'admin_user_01';
  const propertyId = `prop_${runId}`;
  const leaseId = `lse_${runId}`;

  const targetDir = path.join(process.cwd(), 'screenshots', 'comprehensive-audit');

  const auditInventory: Array<{
    seq: number;
    filename: string;
    workflow: string;
    pageState: string;
    role: string;
    language: string;
    viewport: string;
    action: string;
    assertionResult: string;
    description: string;
  }> = [];

  const recordScreenshot = async (
    page: Page,
    meta: {
      seq: number;
      filename: string;
      workflow: string;
      pageState: string;
      role: string;
      language: string;
      viewport: string;
      action: string;
      assertionResult: string;
      description: string;
    }
  ) => {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const filePath = path.join(targetDir, meta.filename);
    await page.screenshot({ path: filePath, fullPage: false });
    auditInventory.push(meta);
    console.log(`[SCREENSHOT CAPTURED] #${meta.seq}: ${meta.filename} (${meta.action})`);
  };

  test.beforeAll(async () => {
    // 0. Clean prior settlements/payouts for user_owner_02
    await db.delete(payoutRequests).where(eq(payoutRequests.ownerId, ownerUserId));
    await db.delete(ownerSettlements).where(eq(ownerSettlements.ownerId, ownerUserId));

    // 1. Seed Owner and Admin Users
    await db.insert(users).values([
      {
        id: ownerUserId,
        uid: ownerUserId,
        firstName: 'Farhad',
        lastName: 'Landlord',
        email: `owner_${runId}@homehub.iq`,
        phone: '+9647501112233',
        roles: ['PROPERTY_OWNER'],
        isActive: true,
      },
      {
        id: adminUserId,
        uid: adminUserId,
        firstName: 'Finance',
        lastName: 'Administrator',
        email: `admin_${runId}@homehub.iq`,
        phone: '+9647508889900',
        roles: ['PLATFORM_ADMIN'],
        isActive: true,
      },
    ]).onConflictDoNothing();

    // 2. Seed Chart of Accounts
    const requiredCoa = [
      { code: '1010', name: 'Operating Cash / Bank', accountType: 'ASSET' },
      { code: '2000', name: 'Trade Accounts Payable', accountType: 'LIABILITY' },
      { code: '2010', name: 'Owner Net Entitlement Payable', accountType: 'LIABILITY' },
      { code: '4000', name: 'Property Rent Revenue Clearing', accountType: 'REVENUE' },
      { code: '4010', name: 'HomeHub Platform Fee Revenue', accountType: 'REVENUE' },
      { code: '5000', name: 'Operating Expenses', accountType: 'EXPENSE' },
    ];
    for (const coa of requiredCoa) {
      await db.insert(chartOfAccounts).values({
        id: `coa_${coa.code}`,
        code: coa.code,
        name: coa.name,
        accountType: coa.accountType,
        currency: 'IQD',
        active: true,
        systemAccount: true,
      }).onConflictDoUpdate({
        target: chartOfAccounts.code,
        set: { name: coa.name, accountType: coa.accountType, active: true },
      });
    }

    // 3. Seed Property & Ownership
    await db.insert(properties).values({
      id: propertyId,
      name: `Empire World Towers ${runId}`,
      type: 'RESIDENTIAL_APARTMENT',
      listingType: 'RENT',
      status: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      operatingModel: 'AGENT_OPERATED',
      managementPreference: 'SELF_MANAGED',
      managementArrangementStatus: 'NOT_APPLICABLE',
      address: { street: 'Gulan 100m', city: 'Erbil', region: 'Kurdistan' },
      bedrooms: 3,
      bathrooms: 2,
    });

    await db.insert(ownershipRecords).values({
      id: `own_${runId}`,
      propertyId,
      ownerId: ownerUserId,
      status: 'VERIFIED',
      ownershipPercentage: '100.00',
    });

    // 4. Seed Active Lease
    await db.insert(leases).values({
      id: leaseId,
      propertyId,
      startDate: '2026-11-01',
      endDate: '2027-10-31',
      rentAmount: '800',
      depositAmount: '800',
      currency: 'USD',
      status: 'ACTIVE',
    });

    // 5. Seed Initial Confirmed Rent Settlement
    // Total Collected: 1,048,000 IQD, Platform Fee (3%): 31,440 IQD, Net Payable: 1,016,560 IQD
    await db.insert(ownerSettlements).values({
      id: `stl_${runId}`,
      ownerId: ownerUserId,
      propertyId,
      periodStartDate: new Date('2026-10-01'),
      periodEndDate: new Date('2026-10-31'),
      totalCollectedIqd: '1048000',
      platformCommissionIqd: '31440',
      companyCommissionIqd: '0',
      totalExpensesIqd: '0',
      netPayableIqd: '1016560',
      status: 'AVAILABLE',
    });
  });

  // =========================================================================
  // WORKFLOW 1: Maintenance Expense Deduction from Landlord Settlement
  // =========================================================================
  test('WF-M1: Maintenance Expense of 150,000 IQD Deducted from Owner Settlement', async ({ page }) => {
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(30000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1. Process vendor maintenance expense of 150,000 IQD with owner deduction
    const expenseAmount = 150000;
    
    // Create Journal Entries:
    // a) Dr 5000 Maintenance Expense / Cr 2000 Trade AP
    await financeRepository.postJournalEntry(propertyId, `Vendor Repair: HVAC Compressor Fix`, [
      { accountId: '5000', debit: expenseAmount, credit: 0 },
      { accountId: '2000', debit: 0, credit: expenseAmount },
    ], { referenceType: 'MAINTENANCE_INVOICE', referenceId: `inv_${runId}` });

    // b) Dr 2010 Owner Net Entitlement / Cr 5000 Maintenance Expense (reduces owner liability)
    await financeRepository.postJournalEntry(propertyId, `Deduct HVAC Repair from Owner Settlement`, [
      { accountId: '2010', debit: expenseAmount, credit: 0 },
      { accountId: '5000', debit: 0, credit: expenseAmount },
    ], { referenceType: 'OWNER_EXPENSE_DEDUCTION', referenceId: `inv_${runId}` });

    // c) Update owner settlement in DB
    const [settlement] = await db.select().from(ownerSettlements).where(eq(ownerSettlements.id, `stl_${runId}`)).limit(1);
    const newNet = Number(settlement.netPayableIqd) - expenseAmount; // 1,016,560 - 150,000 = 866,560
    await db.update(ownerSettlements).set({
      totalExpensesIqd: expenseAmount.toString(),
      netPayableIqd: newNet.toString(),
      updatedAt: new Date(),
    }).where(eq(ownerSettlements.id, `stl_${runId}`));

    // Ingress as Owner
    await page.addInitScript(({ ownerId }) => {
      localStorage.setItem('auth_token', 'dev-owner-b');
      localStorage.setItem('homehub_auth_token', 'dev-owner-b');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: ownerId,
          roles: ['PROPERTY_OWNER'],
          activeRole: 'PROPERTY_OWNER',
        })
      );
    }, { ownerId: ownerUserId });

    // Navigate to /owner
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });

    // Open Settlements & Payouts tab
    const settlementsTabBtn = page.locator('#owner-nav-settlements').first();
    await expect(settlementsTabBtn).toBeVisible({ timeout: 15000 });
    await settlementsTabBtn.click();

    // Verify Settlements Table renders updated figures
    const netPayableCell = page.locator('text=866,560').first();
    await expect(netPayableCell).toBeVisible({ timeout: 15000 });

    const expenseCell = page.locator('text=-150,000').first();
    await expect(expenseCell).toBeVisible({ timeout: 15000 });

    await recordScreenshot(page, {
      seq: 11,
      filename: '11_owner_settlement_with_maintenance_deduction.png',
      workflow: 'Maintenance Settlement Deduction',
      pageState: 'Owner Settlements Tab with Expense Deductions',
      role: 'PROPERTY_OWNER',
      language: 'en',
      direction: 'ltr',
      viewport: '1280x800',
      action: 'View Settlements table with 150,000 IQD maintenance deduction',
      assertionResult: 'PASS: Net payable accurately decremented to 866,560 IQD',
      description: 'Owner reviews settlements table clearly showing 150,000 IQD maintenance expense deducted, resulting in 866,560 IQD net payable.',
    });

    // Landlord clicks "Request Payout"
    const requestPayoutBtn = page.locator(`[id="btn-request-payout-stl_${runId}"]`).first();
    await expect(requestPayoutBtn).toBeVisible({ timeout: 15000 });
    await requestPayoutBtn.click();

    // Verify Confirmation Dialog with decremented net payable
    const payoutModalAmount = page.locator('text=866,560 IQD').first();
    await expect(payoutModalAmount).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 12,
      filename: '12_owner_request_payout_with_deductions_modal.png',
      workflow: 'Maintenance Settlement Deduction',
      pageState: 'Payout Request Dialog with Deductions',
      role: 'PROPERTY_OWNER',
      language: 'en',
      direction: 'ltr',
      viewport: '1280x800',
      action: 'Click Request Payout for decremented net amount',
      assertionResult: 'PASS: Modal reflects accurate 866,560 IQD payout amount',
      description: 'Landlord confirms payout request for the post-deduction net balance of 866,560 IQD.',
    });

    // Confirm payout request
    const confirmPayoutModalBtn = page.locator('#btn-confirm-payout-modal').first();
    await confirmPayoutModalBtn.click();

    // Wait for status to transition to Requested
    const requestedBadge = page.locator('text=Requested').first();
    await expect(requestedBadge).toBeVisible({ timeout: 15000 });

    await recordScreenshot(page, {
      seq: 13,
      filename: '13_owner_payout_requested_with_deductions.png',
      workflow: 'Maintenance Settlement Deduction',
      pageState: 'Settlement in Requested State',
      role: 'PROPERTY_OWNER',
      language: 'en',
      direction: 'ltr',
      viewport: '1280x800',
      action: 'Confirm payout request',
      assertionResult: 'PASS: Payout status transitioned to Requested',
      description: 'Settlement status transitions to Requested and action button is disabled.',
    });
  });

  // =========================================================================
  // WORKFLOW 2: Admin Payout Queue & Bank Wire Execution
  // =========================================================================
  test('WF-M2: Admin Processes Owner Payout with Bank Wire Reference', async ({ page }) => {
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(30000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Fetch the payout request ID created in WF-M1
    const [payout] = await db.select().from(payoutRequests)
      .where(eq(payoutRequests.settlementId, `stl_${runId}`))
      .limit(1);

    expect(payout).toBeDefined();
    expect(payout.status).toBe('REQUESTED');
    expect(Number(payout.amountIqd)).toBe(866560);

    // Ingress as Accountant / Platform Admin
    await page.addInitScript(({ adminId }) => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: adminId,
          roles: ['PLATFORM_ADMIN'],
          activeRole: 'PLATFORM_ADMIN',
        })
      );
    }, { adminId: adminUserId });

    // Navigate to /accountant
    await page.goto('/accountant', { waitUntil: 'domcontentloaded' });

    // Click Settlements & Payouts tab in Accountant Workspace
    const accountantSettlementsTab = page.locator('#accountant-tab-settlements').first();
    await expect(accountantSettlementsTab).toBeVisible({ timeout: 15000 });
    await accountantSettlementsTab.click();

    // Verify Payout Request is listed in the queue
    const wireInput = page.locator(`[id="input-wire-ref-${payout.id}"]`).first();
    await expect(wireInput).toBeVisible({ timeout: 15000 });

    await recordScreenshot(page, {
      seq: 14,
      filename: '14_admin_payout_queue_requested.png',
      workflow: 'Admin Payout Processing',
      pageState: 'Accountant Payout Requests Queue',
      role: 'PLATFORM_ADMIN',
      language: 'en',
      direction: 'ltr',
      viewport: '1280x800',
      action: 'Admin inspects pending owner payout in queue',
      assertionResult: 'PASS: Payout request listed with 866,560 IQD amount',
      description: 'Admin/Accountant views pending payout requests queue in luxury dark theme.',
    });

    // Enter Bank Wire Reference
    const wireRef = 'FIB-WIRE-20261029-9944';
    await wireInput.fill(wireRef);

    // Click "Mark Completed" button and await process API response
    const markCompleteBtn = page.locator(`[id="btn-complete-payout-${payout.id}"]`).first();
    const [processResponse] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/process') && res.request().method() === 'POST'),
      markCompleteBtn.click(),
    ]);
    expect(processResponse.status()).toBe(200);

    // Wait for input to disappear and the wire ref to display
    await expect(wireInput).not.toBeVisible({ timeout: 15000 });
    const wireRefText = page.locator(`text=${wireRef}`).first();
    await expect(wireRefText).toBeVisible({ timeout: 15000 });

    await recordScreenshot(page, {
      seq: 15,
      filename: '15_admin_payout_processed_completed.png',
      workflow: 'Admin Payout Processing',
      pageState: 'Payout Request Completed with Wire Reference',
      role: 'PLATFORM_ADMIN',
      language: 'en',
      direction: 'ltr',
      viewport: '1280x800',
      action: 'Enter wire ref and click Mark Completed',
      assertionResult: 'PASS: Payout marked COMPLETED with wire reference',
      description: 'Admin completes payout recording wire reference; Dr 2010 / Cr 1010 journal entries posted.',
    });

    // Verify DB Double-Entry Journal Entry
    const [updatedPayout] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, payout.id)).limit(1);
    expect(updatedPayout.status).toBe('COMPLETED');
    expect(updatedPayout.externalTransactionReference).toBe(wireRef);

    const [updatedSettlement] = await db.select().from(ownerSettlements).where(eq(ownerSettlements.id, `stl_${runId}`)).limit(1);
    expect(updatedSettlement.status).toBe('PAID');
    expect(updatedSettlement.journalEntryId).toBeDefined();

    // Check Journal Lines
    const [je] = await db.select().from(journalEntries).where(eq(journalEntries.id, updatedSettlement.journalEntryId!)).limit(1);
    expect(je).toBeDefined();

    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id));
    expect(lines.length).toBe(2);

    const dr2010 = lines.find((l) => l.accountId === '2010');
    const cr1010 = lines.find((l) => l.accountId === '1010');

    expect(Number(dr2010?.debit)).toBe(866560);
    expect(Number(dr2010?.credit)).toBe(0);

    expect(Number(cr1010?.credit)).toBe(866560);
    expect(Number(cr1010?.debit)).toBe(0);

    console.log('✅ AUTHORITATIVE GENERAL LEDGER VERIFIED: Dr 2010: 866,560 IQD == Cr 1010: 866,560 IQD (Total Balance = 0)');
  });

  // =========================================================================
  // WORKFLOW 3: Landlord Final Verified Settlement State (PAID)
  // =========================================================================
  test('WF-M3: Landlord Refreshes Settlements Tab to Confirm PAID Status', async ({ page }) => {
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(30000);
    await page.setViewportSize({ width: 1280, height: 800 });

    // Ingress as Owner
    await page.addInitScript(({ ownerId }) => {
      localStorage.setItem('auth_token', 'dev-owner-b');
      localStorage.setItem('homehub_auth_token', 'dev-owner-b');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: ownerId,
          roles: ['PROPERTY_OWNER'],
          activeRole: 'PROPERTY_OWNER',
        })
      );
    }, { ownerId: ownerUserId });

    // Navigate to /owner
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });

    // Click Settlements & Payouts tab
    const settlementsTabBtn = page.locator('#owner-nav-settlements').first();
    await expect(settlementsTabBtn).toBeVisible({ timeout: 15000 });
    await settlementsTabBtn.click();

    // Verify Settlement Status is PAID
    const paidBadge = page.locator('text=PAID').or(page.locator('text=Paid')).first();
    await expect(paidBadge).toBeVisible({ timeout: 15000 });

    // Verify No Request Payout button remains active
    const requestPayoutBtn = page.locator(`[id="btn-request-payout-stl_${runId}"]`);
    await expect(requestPayoutBtn).toHaveCount(0);

    await recordScreenshot(page, {
      seq: 16,
      filename: '16_owner_settlement_final_paid_status.png',
      workflow: 'Final Settlement State',
      pageState: 'Owner Settlements Tab in Final PAID State',
      role: 'PROPERTY_OWNER',
      language: 'en',
      direction: 'ltr',
      viewport: '1280x800',
      action: 'Landlord inspects finalized settlement with PAID badge',
      assertionResult: 'PASS: Status marked PAID; liability fully settled',
      description: 'Settlement lifecycle fully closed: owner sees PAID badge and zero remaining debt.',
    });
  });
});

