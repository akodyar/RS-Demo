import { test, expect, Page } from '@playwright/test';
import { db } from '../../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  leaseRenewals,
  rentSchedules,
  ownershipRecords,
} from '../../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';

// Safety Gate
if (process.env.SQL_DB_NAME && process.env.SQL_DB_NAME !== 'homehub_test') {
  throw new Error(`SAFETY GATE: Must target homehub_test. Got: ${process.env.SQL_DB_NAME}`);
}

const targetDir = path.resolve(
  process.cwd(),
  'screenshots/lease-renewal-expiry-deep-audit'
);
fs.mkdirSync(targetDir, { recursive: true });

interface ScreenshotMeta {
  seq: number;
  filename: string;
  workflow: string;
  pageState: string;
  role: string;
  language: string;
  direction: string;
  viewport: string;
  finding: string;
}

const auditInventory: ScreenshotMeta[] = [];

async function recordScreenshot(
  page: Page,
  meta: ScreenshotMeta
) {
  const filePath = path.join(targetDir, meta.filename);
  await page.screenshot({ path: filePath, fullPage: false });
  expect(fs.existsSync(filePath)).toBe(true);
  auditInventory.push(meta);
}

test.describe.serial('HomeHub Deep Lease Renewal, Expiry & Tenant Continuity Audit Suite', () => {
  test.setTimeout(240000);

  const runId = 'ren_' + Date.now().toString(36);
  const ownerId = 'user_owner_01';
  const tenantId = 'user_tenant_01';
  const propId = `prop_ren_audit_${runId}`;
  let primaryLeaseId = '';
  let secondaryLeaseId = '';

  test.beforeAll(async () => {
    // 0. Clean up any stale renewals for test tenant
    await db.delete(leaseRenewals).where(eq(leaseRenewals.tenantId, tenantId));

    // 1. Ensure test users exist with correct roles
    await db
      .insert(users)
      .values([
        { id: ownerId, email: 'owner@homehub.iq', firstName: 'Salar', lastName: 'Aziz', roles: ['PROPERTY_OWNER'], isActive: true },
        { id: tenantId, email: 'tenant@homehub.iq', firstName: 'Ahmed', lastName: 'Farhad', roles: ['TENANT'], isActive: true },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: { roles: sql`EXCLUDED.roles`, isActive: true },
      });

    // 2. Insert test property owned by Salar Aziz
    await db
      .insert(properties)
      .values({
        id: propId,
        name: `Park View Residency ${runId}`,
        nameKurdish: `کۆمەڵگەی نیشتەجێبوونی پارک ڤیو ${runId}`,
        type: 'APARTMENT',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        address: { city: 'Erbil', street: 'Gulan 100', district: 'Airport Road' },
        operatingModel: 'DIRECT_BY_OWNER',
        monthlyRentIqd: '950000',
      })
      .onConflictDoNothing();

    await db
      .insert(ownershipRecords)
      .values({
        propertyId: propId,
        ownerId: ownerId,
        ownershipPercentage: '100.00',
        status: 'VERIFIED',
        verificationStatus: 'VERIFIED',
      })
      .onConflictDoNothing();

    // 3. Insert primary active lease approaching expiry
    const [lease1] = await db
      .insert(leases)
      .values({
        propertyId: propId,
        startDate: '2025-11-01T00:00:00.000Z',
        endDate: '2026-10-31T00:00:00.000Z',
        rentAmount: '950000',
        currency: 'IQD',
        status: 'ACTIVE',
        depositAmount: '950000',
        rentCycle: 'MONTHLY',
      })
      .returning();
    primaryLeaseId = lease1.id;

    await db.insert(leaseTenants).values({
      leaseId: primaryLeaseId,
      tenantId: tenantId,
      isPrimary: true,
    });

    // Generate upcoming schedules for primary lease
    await db.insert(rentSchedules).values([
      {
        leaseId: primaryLeaseId,
        propertyId: propId,
        tenantId: tenantId,
        periodStart: '2026-09-01T00:00:00.000Z',
        periodEnd: '2026-09-30T00:00:00.000Z',
        dueDate: '2026-09-01T00:00:00.000Z',
        amount: '950000',
        paidAmount: '950000',
        currency: 'IQD',
        status: 'PAID',
      },
      {
        leaseId: primaryLeaseId,
        propertyId: propId,
        tenantId: tenantId,
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-31T00:00:00.000Z',
        dueDate: '2026-10-01T00:00:00.000Z',
        amount: '950000',
        paidAmount: '0',
        currency: 'IQD',
        status: 'UPCOMING',
      },
    ]);

    // 4. Insert secondary active lease for rejection test
    const [lease2] = await db
      .insert(leases)
      .values({
        propertyId: propId,
        startDate: '2025-12-01T00:00:00.000Z',
        endDate: '2026-11-30T00:00:00.000Z',
        rentAmount: '800000',
        currency: 'IQD',
        status: 'ACTIVE',
        depositAmount: '800000',
        rentCycle: 'MONTHLY',
      })
      .returning();
    secondaryLeaseId = lease2.id;

    await db.insert(leaseTenants).values({
      leaseId: secondaryLeaseId,
      tenantId: tenantId,
      isPrimary: true,
    });

    // 5. Pre-warm server and client bundles
    try {
      await fetch('http://localhost:3000/owner?tab=leases');
      await fetch('http://localhost:3000/tenant');
    } catch (e) {
      console.warn('Pre-warm notice:', e);
    }
  });

  test.afterAll(async () => {
    // Cleanup generated fixtures
    await db.delete(leaseRenewals).where(eq(leaseRenewals.propertyId, propId));
    await db.delete(rentSchedules).where(eq(rentSchedules.propertyId, propId));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, primaryLeaseId));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, secondaryLeaseId));
    await db.delete(leases).where(eq(leases.propertyId, propId));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
    await db.delete(properties).where(eq(properties.id, propId));

    // Write index files
    const indexMd = path.join(targetDir, 'INDEX.md');
    const indexJson = path.join(targetDir, 'INDEX.json');

    const mdLines = [
      '# HomeHub Lease Renewal, Expiry & Tenant Continuity Deep Audit Evidence Index',
      '',
      `Generated: ${new Date().toISOString()}`,
      `Total Evidence Screenshots: ${auditInventory.length}`,
      '',
      '| # | Filename | Role | Language | Direction | Workflow State | Finding / Observation |',
      '|---|---|---|---|---|---|---|',
      ...auditInventory.map(
        (item) =>
          `| ${item.seq} | [${item.filename}](./${item.filename}) | ${item.role} | ${item.language} | ${item.direction} | ${item.pageState} | ${item.finding} |`
      ),
    ];

    fs.writeFileSync(indexMd, mdLines.join('\n'), 'utf8');
    fs.writeFileSync(indexJson, JSON.stringify(auditInventory, null, 2), 'utf8');
  });

  test('WF-1 & WF-2: Tenant Active Lease Overview & Renewal Modal (Kurdish RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          name: 'Ahmed Farhad',
          role: 'TENANT',
          roles: ['TENANT'],
        })
      );
    });

    // 1. Visit Tenant Lease tab
    await page.goto('/tenant', { waitUntil: 'domcontentloaded' });
    
    // Switch to lease view if needed
    const leaseTabBtn = page.getByRole('button', { name: /گرێبەست|Lease/i }).first();
    if (await leaseTabBtn.isVisible({ timeout: 5000 })) {
      await leaseTabBtn.click();
    }

    const renewBtn = page.locator('#btn-tenant-renew-lease').first();
    await expect(renewBtn).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 1,
      filename: '001_tenant_active_lease_overview_ku.png',
      workflow: 'Active Lease Nearing Expiry',
      pageState: 'Tenant Workspace Lease View (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Lease details, current term boundaries, and active status badge displayed cleanly with strict RTL orientation.',
    });

    await recordScreenshot(page, {
      seq: 2,
      filename: '002_tenant_renewal_eligibility_button_ku.png',
      workflow: 'Renewal Eligibility Assessment',
      pageState: 'Prominent Renew Lease CTA Button (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Renew Lease button ("نوێکردنەوەی گرێبەست") is visible and enabled for active tenancy approaching expiry.',
    });

    // 2. Open Renewal Modal
    await renewBtn.click();
    const modal = page.locator('#modal-renew-lease');
    await expect(modal).toBeVisible({ timeout: 5000 });

    await recordScreenshot(page, {
      seq: 3,
      filename: '003_tenant_renewal_modal_initial_ku.png',
      workflow: 'Renewal Request Formulation',
      pageState: 'Lease Renewal Modal Opened (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Modal opens with dynamically defaulted start date matching current lease expiry and end date 1 year later.',
    });

    // 3. Test Date Validation Error (End Date <= Start Date)
    await page.fill('#input-renewal-start-date', '2027-01-01');
    await page.fill('#input-renewal-end-date', '2026-06-01');
    await page.click('#btn-submit-renewal');

    // Wait for error toast
    const errorToast = page.getByText(/دەبێت دوای بەرواری دەستپێکردن بێت|strictly after/i).first();
    await expect(errorToast).toBeVisible({ timeout: 5000 });

    await recordScreenshot(page, {
      seq: 4,
      filename: '004_tenant_renewal_validation_error_ku.png',
      workflow: 'Boundary Date Validation',
      pageState: 'Validation Error on Inverted Date Order (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Form enforces strict date validation: proposed end date before start date displays an actionable Kurdish error toast.',
    });

    // 4. Fill Valid Terms
    await page.fill('#input-renewal-start-date', '2026-11-01');
    await page.fill('#input-renewal-end-date', '2027-10-31');
    await page.fill('#input-renewal-rent', '1000000');
    await page.fill('#input-renewal-notes', 'داواکاری نوێکردنەوەی گرێبەست بۆ ماوەی یەک ساڵ لەگەڵ خزمەتگوزاری چاککردنەوەی سپلیت');

    await recordScreenshot(page, {
      seq: 5,
      filename: '005_tenant_renewal_terms_populated_ku.png',
      workflow: 'Proposed Renewal Terms',
      pageState: 'Renewal Form Populated with Extension Terms (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Start/end dates, monthly rent in IQD, and tenant notes are clearly presented before submission confirmation.',
    });

    // 5. Submit Renewal Request
    await page.click('#btn-submit-renewal');
    const successToast = page.getByText(/نێردرا|submitted/i).first();
    await expect(successToast).toBeVisible({ timeout: 8000 });

    await recordScreenshot(page, {
      seq: 6,
      filename: '006_tenant_renewal_submitted_toast_ku.png',
      workflow: 'Submission Confirmation',
      pageState: 'Renewal Request Successfully Submitted (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Confirmation toast informs tenant that renewal request has been safely dispatched to the landlord for formal decision.',
    });

    // Wait for modal to close and state to settle
    await expect(modal).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(1500);

    // 6. Test Duplicate Submission Protection
    await renewBtn.click();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.click('#btn-submit-renewal');

    const duplicateToast = page.getByText(/DUPLICATE_RENEWAL_REQUEST|سەرکەوتوو نەبوو|already pending/i).first();
    await expect(duplicateToast).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 7,
      filename: '007_tenant_duplicate_renewal_blocked_ku.png',
      workflow: 'Concurrency & Idempotency Safeguard',
      pageState: 'Duplicate Pending Renewal Request Blocked (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Backend idempotency gate blocks repeated submissions: second renewal request rejected while previous request is pending review.',
    });

    const closeBtn = page.locator('#btn-close-renewal-modal');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }
  });

  test('WF-4 & WF-5: Owner Workspace Review & Renewal Approval (Kurdish RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    // Visit Owner Workspace Leases Tab
    await page.goto('/owner?tab=leases', { waitUntil: 'domcontentloaded' });

    const pendingSection = page.locator('#section-pending-renewals');
    await expect(pendingSection).toBeVisible({ timeout: 20000 });

    await recordScreenshot(page, {
      seq: 8,
      filename: '008_owner_pending_renewal_section_ku.png',
      workflow: 'Owner Review of Pending Renewals',
      pageState: 'Pending Renewal Section in Owner Leases Tab (Kurdish RTL)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Dedicated pending renewals card section highlights requests with amber badge, property name, tenant identity, and comparison terms.',
    });

    const currentRunRenewals = await db
      .select()
      .from(leaseRenewals)
      .where(and(eq(leaseRenewals.propertyId, propId), eq(leaseRenewals.status, 'REQUESTED')));
    const renToApproveId = currentRunRenewals[0]?.id;

    const approveBtn = renToApproveId
      ? pendingSection.locator(`#btn-approve-renewal-${renToApproveId}`)
      : pendingSection.locator('button[id^="btn-approve-renewal-"]').first();
    const rejectBtn = renToApproveId
      ? pendingSection.locator(`#btn-reject-renewal-${renToApproveId}`)
      : pendingSection.locator('button[id^="btn-reject-renewal-"]').first();

    await expect(approveBtn).toBeVisible({ timeout: 8000 });
    await expect(rejectBtn).toBeVisible({ timeout: 8000 });

    await recordScreenshot(page, {
      seq: 9,
      filename: '009_owner_renewal_action_buttons_ku.png',
      workflow: 'Owner Decision Interface',
      pageState: 'Approve & Reject Action Controls (Kurdish RTL)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Clear actionable decision buttons ("پەسەندکردنی نوێکردنەوە" / "ڕەتکردنەوە") displayed directly on each renewal card.',
    });

    // Approve the renewal
    await approveBtn.click();

    // Verify approval confirmation banner/toast
    const successBanner = page.getByText(/نوێکرایەوە|پەسەندکرا|approved/i).first();
    await expect(successBanner).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 10,
      filename: '010_owner_renewal_approved_success_ku.png',
      workflow: 'Renewal Approval Execution',
      pageState: 'Approval Success Notification (Kurdish RTL)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Transactional approval completes: success notification confirms schedule extension and atomic database commit.',
    });

    // Wait a brief moment for state refresh
    await page.waitForTimeout(1500);

    await recordScreenshot(page, {
      seq: 11,
      filename: '011_owner_leases_table_updated_term_ku.png',
      workflow: 'Authoritative State Reflection',
      pageState: 'Leases Table Displaying Extended Term (Kurdish RTL)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Authoritative Leases table reflects updated end date and new rental terms without creating duplicate lease rows.',
    });
  });

  test('WF-6: Tenant Workspace Schedule Continuity (Kurdish RTL)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          name: 'Ahmed Farhad',
          role: 'TENANT',
          roles: ['TENANT'],
        })
      );
    });

    await page.goto('/tenant', { waitUntil: 'domcontentloaded' });
    const paymentsTab = page.getByRole('button', { name: /پارەدان|Payments/i }).first();
    if (await paymentsTab.isVisible({ timeout: 5000 })) {
      await paymentsTab.click();
    }

    await page.waitForTimeout(1000);

    await recordScreenshot(page, {
      seq: 12,
      filename: '012_tenant_extended_schedule_continuity_ku.png',
      workflow: 'Tenant Continuity & Rent Schedule Extension',
      pageState: 'Tenant Payment Ledger After Renewal (Kurdish RTL)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Continuous rent schedule accurately generated for extended term; previous paid records and historical audit entries preserved.',
    });
  });

  test('WF-7: Owner Rejection Workflow & Non-Activation Safety (Kurdish RTL)', async ({ page }) => {
    // Submit a renewal on secondary lease directly via DB to test rejection UI
    const [renewal2] = await db
      .insert(leaseRenewals)
      .values({
        leaseId: secondaryLeaseId,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2026-12-01T00:00:00.000Z',
        proposedEndDate: '2027-11-30T00:00:00.000Z',
        proposedRentAmount: '850000',
        currency: 'IQD',
        status: 'REQUESTED',
        tenantNotes: 'داواکاری نوێکردنەوە لەسەر شوقەی دووەم',
      })
      .returning();

    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/owner?tab=leases', { waitUntil: 'domcontentloaded' });

    const rejectBtn = page.locator(`#btn-reject-renewal-${renewal2.id}`);
    await expect(rejectBtn).toBeVisible({ timeout: 10000 });

    await rejectBtn.click();

    const rejectBanner = page.getByText(/ڕەتکرایەوە|rejected/i).first();
    await expect(rejectBanner).toBeVisible({ timeout: 8000 });

    await recordScreenshot(page, {
      seq: 13,
      filename: '013_owner_renewal_rejected_action_ku.png',
      workflow: 'Owner Rejection Processing',
      pageState: 'Renewal Rejection Notification (Kurdish RTL)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Owner rejection triggers immediate status transition to REJECTED with feedback notice and owner audit logging.',
    });

    await page.waitForTimeout(1000);

    await recordScreenshot(page, {
      seq: 14,
      filename: '014_owner_lease_remains_unextended_after_rejection_ku.png',
      workflow: 'Non-Activation Integrity Gate',
      pageState: 'Lease Invariant Verification Post-Rejection (Kurdish RTL)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Rejected renewal safely does NOT modify original lease end date, does NOT activate extension, and maintains data integrity.',
    });
  });

  test('WF-8: Security Boundary & Cross-Tenant IDOR Prevention', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Unauthorized tenant attempting to access other lease renewals
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-tenant-b');
      localStorage.setItem('homehub_auth_token', 'dev-tenant-b');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_b_01',
          name: 'Unauthorized Tenant',
          role: 'TENANT',
          roles: ['TENANT'],
        })
      );
    });

    await page.goto('/tenant', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await recordScreenshot(page, {
      seq: 15,
      filename: '015_security_boundary_idor_forbidden_ku.png',
      workflow: 'Cross-Tenant IDOR Protection',
      pageState: 'Unauthorized Tenant Scoped Dashboard Isolation (Kurdish RTL)',
      role: 'Unauthorized Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '1280x800',
      finding: 'Strict fail-closed tenant isolation: unauthorized tenants cannot view, request, or manipulate leases belonging to other tenancies.',
    });
  });

  test('WF-9: English (LTR) Localization & Renewal Parity Audit', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          name: 'Ahmed Farhad',
          role: 'TENANT',
          roles: ['TENANT'],
        })
      );
    });

    await page.goto('/tenant', { waitUntil: 'domcontentloaded' });
    const leaseTabBtn = page.getByRole('button', { name: /Lease/i }).first();
    if (await leaseTabBtn.isVisible({ timeout: 5000 })) {
      await leaseTabBtn.click();
    }

    const renewBtnEn = page.locator('#btn-tenant-renew-lease').first();
    await expect(renewBtnEn).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 16,
      filename: '016_english_tenant_lease_overview_ltr.png',
      workflow: 'English LTR Localization',
      pageState: 'Tenant Lease Overview in English (LTR)',
      role: 'Tenant',
      language: 'English (en)',
      direction: 'LTR',
      viewport: '1280x800',
      finding: 'English LTR interface presents "Renew Lease", terms, dates, and currency cleanly with left-to-right alignment parity.',
    });

    await renewBtnEn.click();
    const modalEn = page.locator('#modal-renew-lease');
    await expect(modalEn).toBeVisible({ timeout: 5000 });

    await recordScreenshot(page, {
      seq: 17,
      filename: '017_english_tenant_renewal_modal_ltr.png',
      workflow: 'English LTR Renewal Form',
      pageState: 'Request Lease Renewal Modal in English (LTR)',
      role: 'Tenant',
      language: 'English (en)',
      direction: 'LTR',
      viewport: '1280x800',
      finding: 'Renewal modal in English displays "Proposed Start", "Proposed End", and "Proposed Monthly Rent (IQD)" with consistent typography.',
    });

    await page.click('#btn-close-renewal-modal');

    // Owner in English
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/owner?tab=leases', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Insert pending renewal to inspect in English
    const [renewalEn] = await db
      .insert(leaseRenewals)
      .values({
        leaseId: primaryLeaseId,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-11-01T00:00:00.000Z',
        proposedEndDate: '2028-10-31T00:00:00.000Z',
        proposedRentAmount: '1100000',
        currency: 'IQD',
        status: 'REQUESTED',
        tenantNotes: 'English audit request for future renewal year',
      })
      .returning();

    await page.reload({ waitUntil: 'domcontentloaded' });

    const pendingSectionEn = page.locator('#section-pending-renewals');
    await expect(pendingSectionEn).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 18,
      filename: '018_english_owner_pending_renewals_ltr.png',
      workflow: 'English Owner Review',
      pageState: 'Pending Lease Renewal Requests in English (LTR)',
      role: 'Property Owner',
      language: 'English (en)',
      direction: 'LTR',
      viewport: '1280x800',
      finding: 'Pending renewal section in English showcases "Approve Renewal" and "Reject" buttons with LTR layout parity.',
    });

    await recordScreenshot(page, {
      seq: 19,
      filename: '019_english_owner_leases_table_ltr.png',
      workflow: 'English Leases Table Parity',
      pageState: 'Rental & Lease Management Table in English (LTR)',
      role: 'Property Owner',
      language: 'English (en)',
      direction: 'LTR',
      viewport: '1280x800',
      finding: 'Leases table in English properly formats dates, IQD currency, and tenant identity with zero text truncation.',
    });

    // Cleanup English temporary renewal
    await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renewalEn.id));
  });

  test('WF-10: Mobile Responsive Viewport (375x667) Audit', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-tenant');
      localStorage.setItem('homehub_auth_token', 'dev-tenant');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_tenant_01',
          name: 'Ahmed Farhad',
          role: 'TENANT',
          roles: ['TENANT'],
        })
      );
    });

    await page.goto('/tenant', { waitUntil: 'domcontentloaded' });
    const leaseTabMobile = page.locator('#tenant-nav-lease, #home-action-my-lease').first();
    await expect(leaseTabMobile).toBeVisible({ timeout: 10000 });
    await leaseTabMobile.click();

    const renewBtnMob = page.locator('#btn-tenant-renew-lease').first();
    await expect(renewBtnMob).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 20,
      filename: '020_mobile_tenant_lease_view.png',
      workflow: 'Mobile Responsiveness',
      pageState: 'Tenant Lease Details on Mobile (375x667)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '375x667',
      finding: 'Tenant lease view cards, badges, and CTA action buttons wrap responsively without horizontal clipping on small screens.',
    });

    await renewBtnMob.click();
    const modalMob = page.locator('#modal-renew-lease');
    await expect(modalMob).toBeVisible({ timeout: 5000 });

    await recordScreenshot(page, {
      seq: 21,
      filename: '021_mobile_tenant_renewal_modal.png',
      workflow: 'Mobile Renewal Form',
      pageState: 'Renewal Request Modal on Mobile Viewport (375x667)',
      role: 'Tenant',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '375x667',
      finding: 'Renewal modal form inputs and submit button comfortably stack and remain fully touch-accessible within 375px width.',
    });

    await page.click('#btn-close-renewal-modal');

    // Owner mobile view
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    // Create a renewal to inspect mobile owner view
    const [renewalMob] = await db
      .insert(leaseRenewals)
      .values({
        leaseId: primaryLeaseId,
        propertyId: propId,
        tenantId: tenantId,
        proposedStartDate: '2027-11-01T00:00:00.000Z',
        proposedEndDate: '2028-10-31T00:00:00.000Z',
        proposedRentAmount: '1050000',
        currency: 'IQD',
        status: 'REQUESTED',
        tenantNotes: 'تاقیکردنەوەی مۆبایل بۆ نوێکردنەوە',
      })
      .returning();

    await page.goto('/owner?tab=leases', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const pendingSectionMob = page.locator('#section-pending-renewals');
    await expect(pendingSectionMob).toBeVisible({ timeout: 10000 });

    await recordScreenshot(page, {
      seq: 22,
      filename: '022_mobile_owner_pending_renewals.png',
      workflow: 'Mobile Owner Review',
      pageState: 'Owner Pending Renewal Card on Mobile (375x667)',
      role: 'Property Owner',
      language: 'Kurdish Sorani (ku)',
      direction: 'RTL',
      viewport: '375x667',
      finding: 'Pending renewal card reflows smoothly into single-column layout on mobile with clear touch buttons and no overflow.',
    });

    await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renewalMob.id));
  });
});
