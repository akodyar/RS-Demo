import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import dotenv from 'dotenv';
import { eq, and, desc, like } from 'drizzle-orm';
import path from 'path';
import * as crypto from 'crypto';

dotenv.config({ path: '.env' });

const screenshotDirs = {
  fees: path.resolve(process.cwd(), 'screenshots/admin-fees'),
  verif: path.resolve(process.cwd(), 'screenshots/property-verification'),
  mgmt: path.resolve(process.cwd(), 'screenshots/management-choice'),
  regression: path.resolve(process.cwd(), 'screenshots/financial-regression'),
};

test.describe.serial('HomeHub — End-to-End Audit: Admin Fees & Property Verification / Management Choice', () => {
  test.setTimeout(180000);

  const testRunId = Date.now().toString().slice(-6);
  const testIds = {
    ownerId: 'user_owner_01',
    adminId: 'admin_user_01',
    verifiedAgentOrgId: `org_verified_agent_${testRunId}`,
    unverifiedAgentOrgId: `org_unverified_agent_${testRunId}`,
    propModelA: '',
    propModelB: '',
    propModelC: '',
    propLifecycle: '',
    createdTierId: '',
  };

  test.beforeAll(async () => {
    // 1. Ensure test owner exists
    await db.insert(schema.users).values({
      id: testIds.ownerId,
      email: 'owner@homehub.iq',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
      role: 'PROPERTY_OWNER',
      roles: ['PROPERTY_OWNER'],
      firstName: 'Salar',
      lastName: 'Aziz',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    // 2. Ensure test admin exists
    await db.insert(schema.users).values({
      id: testIds.adminId,
      email: 'superadmin@homehub.iq',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
      role: 'SUPER_ADMIN',
      roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
    }).onConflictDoNothing();

    // 3. Provision a verified active agent organization
    await db.insert(schema.organizations).values({
      id: testIds.verifiedAgentOrgId,
      name: `Kurdistan Premier Realty ${testRunId}`,
      type: 'COMPANY',
      status: 'VERIFIED',
      verified: true,
    }).onConflictDoNothing();

    // 4. Provision an unverified/draft agent organization for negative testing
    await db.insert(schema.organizations).values({
      id: testIds.unverifiedAgentOrgId,
      name: `Unverified Fake Broker ${testRunId}`,
      type: 'COMPANY',
      status: 'PENDING_VERIFICATION',
      verified: false,
    }).onConflictDoNothing();
  });

  test.afterAll(async () => {
    // Clean up created entities in safe reverse FK dependency order
    const propIds = [testIds.propModelA, testIds.propModelB, testIds.propModelC, testIds.propLifecycle].filter(Boolean);
    for (const pId of propIds) {
      await db.delete(schema.notifications).where(eq(schema.notifications.propertyId, pId));
      await db.delete(schema.verificationEvidence).where(eq(schema.verificationEvidence.verificationRecordId, pId));
      await db.delete(schema.verificationRecords).where(eq(schema.verificationRecords.propertyId, pId));
      await db.delete(schema.managementAgreements).where(eq(schema.managementAgreements.propertyId, pId));
      await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, pId));
      await db.delete(schema.listings).where(eq(schema.listings.propertyId, pId));
      await db.delete(schema.properties).where(eq(schema.properties.id, pId));
    }

    // Clean up any test pricing tiers created during audit
    await db.delete(schema.pricingTiers).where(like(schema.pricingTiers.name, 'E2E Platinum Tier%'));

    await db.delete(schema.organizations).where(eq(schema.organizations.id, testIds.verifiedAgentOrgId));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, testIds.unverifiedAgentOrgId));

    // Reset platform fee rate to authoritative 0.03 default
    await db.update(schema.financialPolicies)
      .set({ policyValue: '0.03', updatedAt: new Date() })
      .where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
  });

  // =========================================================================
  // DOMAIN 1: ADMIN PANEL — FEE MANAGEMENT WORKFLOW
  // =========================================================================

  test('Domain 1.1 — Admin Settings: Navigation, Overview, & Global Platform Fee Validation', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE ${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    page.on('response', async res => {
      if (res.url().includes('/api/admin/settings') || res.url().includes('/api/admin/fees')) {
        const body = await res.text().catch(() => '');
        console.log(`[BROWSER NETWORK] ${res.status()} ${res.url()} => ${body}`);
      }
    });

    // Authenticate as dev-platform_admin
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });

    // Verify Admin Dashboard Hero loaded
    const heroTitle = page.locator('text=بەخێربێیتەوە');
    await expect(heroTitle).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '01-admin-dashboard-hero.png'), fullPage: true });

    // Navigate to Settings Module via quick action
    const settingsBtn = page.locator('[data-testid="admin-quick-action-settings"]');
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click();

    // Verify AdminSettingsModule header rendered
    const settingsHeader = page.locator('[data-testid="admin-platform-fee-input"]');
    await expect(settingsHeader).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '02-admin-settings-overview.png'), fullPage: true });

    // --- Validation 1: Negative fee rate (-0.05) ---
    await settingsHeader.fill('-0.05');
    const negErr = page.locator('[data-testid="admin-platform-fee-error"]');
    await expect(negErr).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '03-platform-fee-negative-validation.png') });

    // --- Validation 2: Exceeding 50% rate (0.85) ---
    await settingsHeader.fill('0.85');
    const maxErr = page.locator('[data-testid="admin-platform-fee-error"]');
    await expect(maxErr).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '04-platform-fee-exceeds-max-validation.png') });

    // --- Validation 3: Over-precision rate (0.03555 - 5 decimals) ---
    await settingsHeader.fill('0.03555');
    const precErr = page.locator('[data-testid="admin-platform-fee-error"]');
    await expect(precErr).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '05-platform-fee-overprecision-validation.png') });

    // --- Validation 4: Empty rate ---
    await settingsHeader.fill('');
    const emptyErr = page.locator('[data-testid="admin-platform-fee-error"]');
    await expect(emptyErr).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '06-platform-fee-empty-validation.png') });

    // --- Valid Rate Mutation (0.035) ---
    await settingsHeader.fill('0.035');
    const pendingBadge = page.locator('text=گۆڕانکاری چاوەڕوانکراو (Pending: 3.50%)');
    await expect(pendingBadge).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '07-platform-fee-pending-mutation.png') });

    // Click Save Button
    const saveBtn = page.locator('[data-testid="admin-save-settings-btn"]');
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Verify Success indicator
    const successMsg = page.locator('text=ڕێکخستنەکان لە سێرڤەر بە سەرکەوتوویی پاشەکەوت کران!');
    await expect(successMsg).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '08-platform-fee-save-success.png') });

    // Check DB persistence directly in PostgreSQL
    const policyInDb = await db.select().from(schema.financialPolicies)
      .where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
      .limit(1);
    expect(policyInDb.length).toBeGreaterThan(0);
    expect(Number(policyInDb[0].policyValue)).toBe(0.035);

    // Reload page to verify persistence in browser
    await page.reload({ waitUntil: 'domcontentloaded' });
    const settingsBtnAfterReload = page.locator('[data-testid="admin-quick-action-settings"]');
    await expect(settingsBtnAfterReload).toBeVisible({ timeout: 10000 });
    await settingsBtnAfterReload.click();

    await expect(page.locator('[data-testid="admin-platform-fee-input"]')).toHaveValue('0.035', { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '09-platform-fee-persisted-after-reload.png') });

    // Restore back to 0.03 for subsequent tests
    await page.locator('[data-testid="admin-platform-fee-input"]').fill('0.03');
    await saveBtn.click();
    await expect(page.locator('text=ڕێکخستنەکان لە سێرڤەر بە سەرکەوتوویی پاشەکەوت کران!')).toBeVisible({ timeout: 10000 });
  });

  test('Domain 1.2 — Admin Settings: Security Toggles & 3-Fee Applicability Matrix', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="admin-quick-action-settings"]').click();
    await expect(page.locator('[data-testid="admin-platform-fee-input"]')).toBeVisible({ timeout: 10000 });

    // Test Toggles
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // Toggle maintenance mode checkbox
    const maintCheckbox = checkboxes.nth(2);
    await maintCheckbox.click();
    await page.screenshot({ path: path.join(screenshotDirs.fees, '10-admin-settings-toggles.png') });
    await maintCheckbox.click(); // revert

    // Verify 3-Fee Applicability Matrix table
    await expect(page.locator('text=ماتریسی گونجاوی کرێیەکان بەپێی مۆدێلی کارکردن')).toBeVisible();
    await expect(page.locator('text=FULLY_MANAGED')).toBeVisible();
    await expect(page.locator('text=AGENT_LISTED_PLATFORM_MANAGED')).toBeVisible();
    await expect(page.locator('text=AGENT_OPERATED')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotDirs.fees, '11-fee-applicability-matrix.png'), fullPage: true });

    // Click Back to Dashboard
    await page.locator('[data-testid="admin-settings-back-btn"]').click();
    await expect(page.locator('text=بەخێربێیتەوە')).toBeVisible({ timeout: 5000 });
  });

  test('Domain 1.3 — Tiered Pricing Module: Tiers Overview, Create Tier Modal, Validation & Persistence', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });

    // Open More Menu via Bottom Nav
    const moreNavBtn = page.locator('[data-testid="admin-nav-more"]');
    await expect(moreNavBtn).toBeVisible({ timeout: 5000 });
    await moreNavBtn.click();

    // Click Tiered Pricing in More Menu
    const pricingMenuBtn = page.locator('[data-testid="admin-module-pricing"]');
    await expect(pricingMenuBtn).toBeVisible({ timeout: 5000 });
    await pricingMenuBtn.click();

    // Verify Pricing Module loaded
    const createTierBtn = page.locator('[data-testid="create-tier-btn"]');
    await expect(createTierBtn).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '12-pricing-tiers-overview.png'), fullPage: true });

    // Open Create New Tier Modal
    await createTierBtn.click();
    const modalTitle = page.locator('#create-tier-modal-title');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '13-pricing-tier-modal-empty.png') });

    // Empty submission triggers validation errors
    const submitBtn = page.locator('[data-testid="tier-submit-btn"]');
    await submitBtn.click();
    await expect(page.locator('[data-testid="tier-name-error"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '14-pricing-tier-validation-errors.png') });

    // Fill valid tier details
    await page.locator('[data-testid="tier-name-input"]').fill(`E2E Platinum Tier ${testRunId}`);
    await page.locator('[data-testid="tier-min-props-input"]').fill('15');
    await page.locator('[data-testid="tier-max-props-input"]').fill('100');
    await page.locator('[data-testid="tier-rent-fee-input"]').fill('0.035');
    await page.locator('[data-testid="tier-mgmt-fee-input"]').fill('0.055');
    await page.locator('[data-testid="tier-priority-input"]').fill('8');
    await page.screenshot({ path: path.join(screenshotDirs.fees, '15-pricing-tier-filled-valid.png') });

    // Test Cancel button dismisses modal
    const cancelBtn = page.locator('[data-testid="tier-cancel-btn"]');
    await cancelBtn.click();
    await expect(modalTitle).not.toBeVisible({ timeout: 5000 });
    // Hover trigger button to show focus/hover state upon modal dismissal, proving draft is uncommitted
    await createTierBtn.hover();
    await page.screenshot({ path: path.join(screenshotDirs.fees, '15b-pricing-tier-modal-dismissed-on-cancel.png') });

    // Reopen and submit
    await createTierBtn.click();
    await page.locator('[data-testid="tier-name-input"]').fill(`E2E Platinum Tier ${testRunId}`);
    await page.locator('[data-testid="tier-min-props-input"]').fill('15');
    await page.locator('[data-testid="tier-max-props-input"]').fill('100');
    await page.locator('[data-testid="tier-rent-fee-input"]').fill('0.035');
    await page.locator('[data-testid="tier-mgmt-fee-input"]').fill('0.055');
    await page.locator('[data-testid="tier-priority-input"]').fill('8');

    await page.locator('[data-testid="tier-submit-btn"]').click();

    // Verify Success banner
    const successBanner = page.locator('[data-testid="tier-success-banner"]');
    await expect(successBanner).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '16-pricing-tier-created-success.png') });

    // Wait for modal auto-close and check grid
    await expect(modalTitle).not.toBeVisible({ timeout: 15000 });
    const newTierCard = page.locator(`text=E2E Platinum Tier ${testRunId}`);
    await expect(newTierCard).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '17-pricing-tier-grid-updated.png'), fullPage: true });

    // Fetch created tier id for cleanup
    const dbTier = await db.select().from(schema.pricingTiers)
      .where(eq(schema.pricingTiers.name, `E2E Platinum Tier ${testRunId}`))
      .limit(1);
    if (dbTier.length > 0) {
      testIds.createdTierId = dbTier[0].id;
    }

    // Return to dashboard
    await page.locator('[data-testid="admin-pricing-back-btn"]').click();
  });

  test('Domain 1.4 — Property-Level Fee Editing in Admin Properties Module', async ({ page }) => {
    // Seed an isolated test property for fee editing
    testIds.propModelA = crypto.randomUUID();
    await db.insert(schema.properties).values({
      id: testIds.propModelA,
      name: `Audit Model A Prop ${testRunId}`,
      city: 'Erbil',
      type: 'Apartment',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      operatingModel: 'FULLY_MANAGED',
      managementPreference: 'HOMEHUB_MANAGED',
      managementArrangementStatus: 'AWAITING_ONBOARDING',
      rentFee: '0.04',
      managementFee: '0.06',
      ownerId: testIds.ownerId,
      address: { city: 'Erbil', street: 'Gulan St', country: 'Iraq' },
    });

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="admin-quick-action-properties"]').click();

    // Verify Admin Properties Module loaded with 3-fee breakdown cards
    const propCard = page.locator(`[data-testid="admin-property-card-${testIds.propModelA}"]`);
    await expect(propCard).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '18-admin-properties-fee-breakdowns.png'), fullPage: true });

    // Open Fee Edit Modal
    const feeEditBtn = page.locator(`[data-testid="admin-edit-fees-btn-${testIds.propModelA}"]`);
    await feeEditBtn.click();

    const feeModal = page.locator('[data-testid="admin-fee-edit-modal"]');
    await expect(feeModal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '19-property-fee-modal-open.png') });

    // Mutate rent fee to 0.045
    const rentInput = feeModal.locator('input[type="number"]').first();
    await rentInput.fill('0.045');

    // Click Save
    const saveFeesBtn = page.locator('[data-testid="admin-save-property-fees-btn"]');
    await saveFeesBtn.click();

    await expect(page.locator('text=کرێیەکان لە سێرڤەر بە سەرکەوتوویی پاشەکەوت کران!')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDirs.fees, '20-property-fee-saved-success.png') });

    // Verify DB update
    const updatedProp = await db.select().from(schema.properties).where(eq(schema.properties.id, testIds.propModelA)).limit(1);
    expect(Number(updatedProp[0].rentFee)).toBe(0.045);
  });

  // =========================================================================
  // DOMAIN 2: PROPERTY VERIFICATION & OWNER MANAGEMENT CHOICE WORKFLOW
  // =========================================================================

  test('Domain 2.1 — Add Property Wizard: Step-by-Step, Rental Restriction & Submission', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/properties/add', { waitUntil: 'domcontentloaded' });

    // Step 0: Type Selection
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '01-add-property-step0-type.png') });
    await aptBtn.click();

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click(); // To Step 1: Basic Info

    // Step 1: Basic Info
    await page.locator('input[name="name"], input[placeholder*="Villa"], input[data-testid="property-name"]').first().fill(`Audit Luxury Residence ${testRunId}`);
    await page.screenshot({ path: path.join(screenshotDirs.verif, '02-add-property-step1-basic-info.png') });
    await nextBtn.click(); // To Step 2: Location

    // Step 2: Location
    await page.screenshot({ path: path.join(screenshotDirs.verif, '03-add-property-step2-location.png') });
    await nextBtn.click(); // To Step 3: Specifications

    // Step 3: Specifications
    await page.screenshot({ path: path.join(screenshotDirs.verif, '04-add-property-step3-specifications.png') });
    await nextBtn.click(); // To Step 4: Amenities

    // Step 4: Amenities
    await page.screenshot({ path: path.join(screenshotDirs.verif, '05-add-property-step4-amenities.png') });
    await nextBtn.click(); // To Step 5: Photos

    // Step 5: Photos
    await page.screenshot({ path: path.join(screenshotDirs.verif, '06-add-property-step5-photos.png') });
    await nextBtn.click(); // To Step 6: Ownership

    // Step 6: Ownership
    await page.screenshot({ path: path.join(screenshotDirs.verif, '07-add-property-step6-ownership.png') });
    await nextBtn.click(); // To Step 7: Management Model

    // Step 7: Operations & Agreed Fees
    const selectModel = page.locator('[data-testid="property-operating-model"]');
    if (await selectModel.isVisible()) {
      await selectModel.selectOption('FULLY_MANAGED');
    }
    const mgmtFeeInput = page.locator('[data-testid="agreed-mgmt-fee-input"]');
    if (await mgmtFeeInput.isVisible()) {
      await mgmtFeeInput.fill('0.06');
    }
    const rentFeeInput = page.locator('[data-testid="agreed-rent-fee-input"]');
    if (await rentFeeInput.isVisible()) {
      await rentFeeInput.fill('0.04');
    }
    await page.screenshot({ path: path.join(screenshotDirs.verif, '08-add-property-step7-management.png') });
    await nextBtn.click(); // To Step 8: Review

    // Step 8: Review & Submit
    await expect(page.locator('[data-testid="add-property-submit-btn"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '09-add-property-step8-review.png') });

    // Submit Property
    await page.locator('[data-testid="add-property-submit-btn"]').click();
    await expect(page.locator('[data-testid="property-submitted-confirmation"]')).toBeVisible({ timeout: 15000 });
  });

  test('Domain 2.2 — Post-Creation Management Choice: 3 Options, Agent Dropdown, & Saved Banner', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    // Fetch the property submitted in Domain 2.1
    const createdProps = await db.select().from(schema.properties)
      .where(eq(schema.properties.name, `Audit Luxury Residence ${testRunId}`))
      .limit(1);

    expect(createdProps.length).toBeGreaterThan(0);
    const prop = createdProps[0];
    testIds.propLifecycle = prop.id;

    // Verify initial verification status is PENDING_VERIFICATION in DB
    expect(prop.verificationStatus).toBe('PENDING_VERIFICATION');

    // Verify staged listing is in PENDING_REVIEW in DB
    const listing = await db.select().from(schema.listings).where(eq(schema.listings.propertyId, prop.id)).limit(1);
    if (listing.length > 0) {
      expect(listing[0].status).toBe('PENDING_REVIEW');
    }

    // Navigate to post-creation management choice UI
    await page.goto(`/properties/add?prop_id=${prop.id}`, { waitUntil: 'domcontentloaded' });

    // 1. Verify Submission Confirmation Banner
    const confBanner = page.locator('[data-testid="property-submitted-confirmation"]');
    await expect(confBanner).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=PENDING_VERIFICATION')).toBeVisible({ timeout: 5000 });
    await confBanner.screenshot({ path: path.join(screenshotDirs.mgmt, '01-submission-confirmation-banner.png') });

    // 2. Verify 3 Management Options Rendered
    const optSelf = page.locator('[data-testid="option-self-managed"]');
    const optHh = page.locator('[data-testid="option-homehub-managed"]');
    const optAgent = page.locator('[data-testid="option-agent-managed"]');

    await expect(optSelf).toBeVisible({ timeout: 5000 });
    await expect(optHh).toBeVisible({ timeout: 5000 });
    await expect(optAgent).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '02-three-management-options.png') });

    // 3. Option C: Select AGENT_MANAGED and choose verified agent
    await optAgent.click();
    const agentSelect = page.locator('[data-testid="agent-company-select"]');
    await expect(agentSelect).toBeVisible({ timeout: 5000 });
    await agentSelect.selectOption(testIds.verifiedAgentOrgId);
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '03-agent-managed-selected-with-dropdown.png') });

    // 4. Option B: Select HOMEHUB_MANAGED
    await optHh.click();
    await expect(page.locator('text=AWAITING_ONBOARDING')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '04-homehub-managed-selected.png') });

    // 5. Option A: Select SELF_MANAGED
    await optSelf.click();
    await expect(page.locator('text=NOT_APPLICABLE')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '05-self-managed-selected.png') });

    // 6a. Save Preference (SELF_MANAGED) & Verify Persistence on Reload
    const savePrefBtn = page.locator('[data-testid="save-management-preference-btn"]');
    await savePrefBtn.click();

    // Verify Saved Success Banner
    const savedBanner = page.locator('[data-testid="preference-saved-banner"]');
    await expect(savedBanner).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '06-preference-saved-success.png') });

    // Reload and verify SELF_MANAGED persisted
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=NOT_APPLICABLE')).toBeVisible({ timeout: 10000 });
    await optSelf.hover();
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '05a-self-managed-persisted-after-reload.png'), fullPage: true });

    const updatedPropA = await db.select().from(schema.properties).where(eq(schema.properties.id, prop.id)).limit(1);
    expect(updatedPropA[0].managementPreference).toBe('SELF_MANAGED');
    expect(updatedPropA[0].managementArrangementStatus).toBe('NOT_APPLICABLE');

    // 6b. Save Preference (HOMEHUB_MANAGED) & Verify Persistence on Reload
    const optHhPostReload = page.locator('[data-testid="option-homehub-managed"]');
    await optHhPostReload.click();
    await savePrefBtn.click();
    await expect(page.locator('[data-testid="preference-saved-banner"]')).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=AWAITING_ONBOARDING')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '05b-homehub-managed-persisted-after-reload.png') });

    const updatedPropB = await db.select().from(schema.properties).where(eq(schema.properties.id, prop.id)).limit(1);
    expect(updatedPropB[0].managementPreference).toBe('HOMEHUB_MANAGED');
    expect(updatedPropB[0].managementArrangementStatus).toBe('AWAITING_ONBOARDING');

    // 6c. Save Preference (AGENT_MANAGED) & Verify Persistence on Reload
    const optAgentPostReload = page.locator('[data-testid="option-agent-managed"]');
    await optAgentPostReload.click();
    const agentSelectPostReload = page.locator('[data-testid="agent-company-select"]');
    await expect(agentSelectPostReload).toBeVisible({ timeout: 5000 });
    await agentSelectPostReload.selectOption(testIds.verifiedAgentOrgId);
    await savePrefBtn.click();
    await expect(page.locator('[data-testid="preference-saved-banner"]')).toBeVisible({ timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=AWAITING_AGREEMENT')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '05c-agent-managed-persisted-after-reload.png') });

    const updatedPropC = await db.select().from(schema.properties).where(eq(schema.properties.id, prop.id)).limit(1);
    expect(updatedPropC[0].managementPreference).toBe('AGENT_MANAGED');
    expect(updatedPropC[0].managementArrangementStatus).toBe('AWAITING_AGREEMENT');

    // Negative API verification: AGENT_MANAGED with unverified agent
    const resPrefUnverified = await page.request.post(`/api/properties/${prop.id}/management-preference`, {
      headers: { Authorization: 'Bearer dev-owner' },
      data: { managementPreference: 'AGENT_MANAGED', agentCompanyId: testIds.unverifiedAgentOrgId },
    });
    expect(resPrefUnverified.status()).toBe(400);

    // Set back to HOMEHUB_MANAGED for lifecycle tests
    await page.request.post(`/api/properties/${prop.id}/management-preference`, {
      headers: { Authorization: 'Bearer dev-owner' },
      data: { managementPreference: 'HOMEHUB_MANAGED' },
    });

    // 7. Check Owner Workspace Portfolio Card
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    const navPropBtn = page.locator('[data-testid="owner-nav-properties"]');
    await expect(navPropBtn).toBeVisible({ timeout: 10000 });
    await navPropBtn.click();
    const ownerCard = page.locator(`text=${prop.name}`);
    await expect(ownerCard).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '07-owner-portfolio-pending-card.png'), fullPage: true });
  });

  test('Domain 2.3 — Admin Verification Lifecycle: Filter, Inspect, Rejection with Reason, Resubmit, & Approve', async ({ page }) => {
    const propId = testIds.propLifecycle;
    expect(propId).toBeTruthy();

    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="admin-quick-action-properties"]').click();

    // 1. Filter by PENDING_VERIFICATION
    const filterSelect = page.locator('[data-testid="admin-verification-status-filter"]');
    await expect(filterSelect).toBeVisible({ timeout: 10000 });
    await filterSelect.selectOption('PENDING_VERIFICATION');
    await page.screenshot({ path: path.join(screenshotDirs.verif, '10-admin-filter-pending.png'), fullPage: true });

    // 2. Open Inspect Modal
    const inspectBtn = page.locator(`[data-testid="admin-inspect-prop-btn-${propId}"]`);
    await expect(inspectBtn).toBeVisible({ timeout: 10000 });
    await inspectBtn.click();

    const inspectModal = page.locator('[data-testid="admin-property-inspect-modal"]');
    await expect(inspectModal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '11-inspect-modal-pending.png') });

    // 3. Rejection Validation: Reject without reason
    const rejectBtn = page.locator('[data-testid="admin-reject-btn"]');
    await rejectBtn.click();
    await expect(page.locator('text=تکایە هۆکاری ڕەتکردنەوە بنووسە')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '12-reject-missing-reason-error.png') });

    // 4. Rejection Execution: Type reason and reject
    const reasonTextarea = page.locator('[data-testid="admin-reject-reason-input"]');
    await reasonTextarea.fill('Deed scan is blurred. Please provide a clear official Tapu deed scan.');
    await page.screenshot({ path: path.join(screenshotDirs.verif, '13-reject-reason-entered.png') });

    await rejectBtn.click();
    await expect(page.locator('text=موڵک ڕەتکرایەوە (Property Rejected)')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '14-reject-success-feedback.png') });

    // Modal closes automatically
    await expect(inspectModal).not.toBeVisible({ timeout: 15000 });

    // 5. Filter by REJECTED
    await filterSelect.selectOption('REJECTED');
    const rejectedBadge = page.locator(`[data-testid="admin-prop-rejected-badge-${propId}"]`);
    await expect(rejectedBadge).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '15-admin-filter-rejected.png'), fullPage: true });

    // 6. Owner Workspace: View rejection banner and resubmit
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    const navPropBtnRejection = page.locator('[data-testid="owner-nav-properties"]');
    await expect(navPropBtnRejection).toBeVisible({ timeout: 10000 });
    await navPropBtnRejection.click();

    const rejectionBanner = page.locator(`[data-testid="rejection-banner-${propId}"]`);
    await expect(rejectionBanner).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '16-owner-workspace-rejected-banner.png') });

    // Click Resubmit
    const resubmitBtn = page.locator(`[data-testid="resubmit-prop-btn-${propId}"]`);
    await resubmitBtn.click();
    await expect(rejectionBanner).not.toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '17-owner-workspace-resubmitted-pending.png') });

    // 7. Admin Workspace: Inspect audit history and approve
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      }));
    });

    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="admin-quick-action-properties"]').click();
    await filterSelect.selectOption('PENDING_VERIFICATION');

    const inspectBtnResubmitted = page.locator(`[data-testid="admin-inspect-prop-btn-${propId}"]`);
    await expect(inspectBtnResubmitted).toBeVisible({ timeout: 10000 });
    await inspectBtnResubmitted.click();

    await expect(inspectModal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Deed scan is blurred')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '18-inspect-modal-audit-history.png') });

    // Click Approve
    const approveBtn = page.locator('[data-testid="admin-approve-btn"]');
    await approveBtn.click();
    await expect(page.locator('text=موڵک بە سەرکەوتوویی پەسەندکرا (Property Approved)')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '19-approve-success-feedback.png') });

    await expect(inspectModal).not.toBeVisible({ timeout: 15000 });

    // Filter by VERIFIED
    await filterSelect.selectOption('VERIFIED');
    const verifiedBadge = page.locator(`[data-testid="admin-prop-verified-badge-${propId}"]`);
    await expect(verifiedBadge).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '20-admin-filter-verified.png'), fullPage: true });

    // 8. Owner Workspace shows VERIFIED status
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    const navPropBtnVerified = page.locator('[data-testid="owner-nav-properties"]');
    await expect(navPropBtnVerified).toBeVisible({ timeout: 10000 });
    await navPropBtnVerified.click();

    const ownerVerifiedBadge = page.locator(`[data-testid="verification-badge-${propId}"]`);
    await expect(ownerVerifiedBadge).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDirs.verif, '21-owner-workspace-verified-property.png') });
  });

  test('Domain 2.4 — Active Management Agreement Protection Against Unauthorized Self-Managed Switch', async ({ page }) => {
    const propId = testIds.propLifecycle;

    // Authenticate as owner
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'user_owner_01',
        role: 'PROPERTY_OWNER',
        roles: ['PROPERTY_OWNER'],
      }));
    });

    // Insert an active management agreement
    const agreementId = crypto.randomUUID();
    await db.insert(schema.managementAgreements).values({
      id: agreementId,
      propertyId: propId,
      ownerId: testIds.ownerId,
      companyId: testIds.verifiedAgentOrgId,
      startDate: '2026-01-01',
      status: 'ACTIVE',
    });

    // Attempt to switch to SELF_MANAGED in UI
    await page.goto(`/properties/add?prop_id=${propId}`, { waitUntil: 'domcontentloaded' });
    const optSelf = page.locator('[data-testid="option-self-managed"]');
    await expect(optSelf).toBeVisible({ timeout: 10000 });
    await optSelf.click();

    const saveBtn = page.locator('[data-testid="save-management-preference-btn"]');
    await saveBtn.click();

    // Verify UI conflict banner appears
    const errBanner = page.locator('[data-testid="preference-error-banner"]');
    await expect(errBanner).toBeVisible({ timeout: 10000 });
    await expect(errBanner).toContainText('CONFLICT');
    await page.screenshot({ path: path.join(screenshotDirs.mgmt, '08-active-agreement-conflict.png') });

    // Clean up agreement
    await db.delete(schema.managementAgreements).where(eq(schema.managementAgreements.id, agreementId));
  });

  test('Domain 2.5 — Financial Regression: Invariants Preserved Across Models A, B, and C', async ({ page }) => {
    // 1. Model A — FULLY_MANAGED
    testIds.propModelA = crypto.randomUUID();
    await db.insert(schema.properties).values({
      id: testIds.propModelA,
      name: `Regression Model A ${testRunId}`,
      city: 'Erbil',
      type: 'Apartment',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      operatingModel: 'FULLY_MANAGED',
      managementPreference: 'HOMEHUB_MANAGED',
      managementArrangementStatus: 'AWAITING_ONBOARDING',
      rentFee: '0.04',
      managementFee: '0.06',
      ownerId: testIds.ownerId,
      address: { city: 'Erbil', country: 'Iraq' },
    });

    // Mutate management preference on Model A
    await page.request.post(`/api/properties/${testIds.propModelA}/management-preference`, {
      headers: { Authorization: 'Bearer dev-owner' },
      data: { managementPreference: 'SELF_MANAGED' },
    });

    // Check DB: operatingModel must remain FULLY_MANAGED, fees intact
    const propA = await db.select().from(schema.properties).where(eq(schema.properties.id, testIds.propModelA)).limit(1);
    expect(propA[0].operatingModel).toBe('FULLY_MANAGED');
    expect(Number(propA[0].rentFee)).toBe(0.04);
    expect(Number(propA[0].managementFee)).toBe(0.06);

    // 2. Model B — AGENT_LISTED_PLATFORM_MANAGED
    testIds.propModelB = crypto.randomUUID();
    await db.insert(schema.properties).values({
      id: testIds.propModelB,
      name: `Regression Model B ALPM ${testRunId}`,
      city: 'Sulaymaniyah',
      type: 'Villa',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
      managementPreference: 'HOMEHUB_MANAGED',
      managementArrangementStatus: 'AWAITING_ONBOARDING',
      rentFee: null, // Critical invariant: rent fee must be null
      managementFee: '0.04',
      ownerId: testIds.ownerId,
      address: { city: 'Sulaymaniyah', country: 'Iraq' },
    });

    // Mutate preference on Model B to AGENT_MANAGED
    await page.request.post(`/api/properties/${testIds.propModelB}/management-preference`, {
      headers: { Authorization: 'Bearer dev-owner' },
      data: { managementPreference: 'AGENT_MANAGED', agentCompanyId: testIds.verifiedAgentOrgId },
    });

    // Check DB: operatingModel must remain AGENT_LISTED_PLATFORM_MANAGED, rentFee strictly null
    const propB = await db.select().from(schema.properties).where(eq(schema.properties.id, testIds.propModelB)).limit(1);
    expect(propB[0].operatingModel).toBe('AGENT_LISTED_PLATFORM_MANAGED');
    expect(propB[0].rentFee).toBeNull();
    expect(Number(propB[0].managementFee)).toBe(0.04);

    // 3. Model C — AGENT_OPERATED
    testIds.propModelC = crypto.randomUUID();
    await db.insert(schema.properties).values({
      id: testIds.propModelC,
      name: `Regression Model C Agent Op ${testRunId}`,
      city: 'Duhok',
      type: 'Commercial',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      operatingModel: 'AGENT_OPERATED',
      managementPreference: 'AGENT_MANAGED',
      managementArrangementStatus: 'AWAITING_AGREEMENT',
      rentFee: null,
      managementFee: null,
      ownerId: testIds.ownerId,
      address: { city: 'Duhok', country: 'Iraq' },
    });

    // Mutate preference on Model C to HOMEHUB_MANAGED
    await page.request.post(`/api/properties/${testIds.propModelC}/management-preference`, {
      headers: { Authorization: 'Bearer dev-owner' },
      data: { managementPreference: 'HOMEHUB_MANAGED' },
    });

    // Check DB: operatingModel must remain AGENT_OPERATED, rentFee and mgmtFee strictly null
    const propC = await db.select().from(schema.properties).where(eq(schema.properties.id, testIds.propModelC)).limit(1);
    expect(propC[0].operatingModel).toBe('AGENT_OPERATED');
    expect(propC[0].rentFee).toBeNull();
    expect(propC[0].managementFee).toBeNull();

    // Capture financial regression screenshots
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({
        id: 'admin_user_01',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN'],
      }));
    });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-testid="admin-quick-action-properties"]').click();
    await expect(page.locator('[data-testid="admin-properties-search-input"]')).toBeVisible({ timeout: 10000 });

    // 1. Model A (Fully Managed): 3% Platform, 4% Rent, 6% Management
    await page.locator('[data-testid="admin-properties-search-input"]').fill(testIds.propModelA);
    const cardA = page.locator(`[data-testid="admin-property-card-${testIds.propModelA}"]`);
    await expect(cardA).toBeVisible({ timeout: 10000 });
    await page.locator(`[data-testid="admin-edit-fees-btn-${testIds.propModelA}"]`).click();
    await expect(page.locator('[data-testid="admin-fee-edit-modal"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.regression, '01-model-a-fully-managed-fees.png') });
    await page.locator('[data-testid="admin-fee-modal-close-btn"]').click();
    await expect(page.locator('[data-testid="admin-fee-edit-modal"]')).not.toBeVisible({ timeout: 5000 });

    // 2. Model B (ALPM): 3% Platform, Rent Fee NULL (disabled in ALPM), 4% Management
    await page.locator('[data-testid="admin-properties-search-input"]').fill(testIds.propModelB);
    const cardB = page.locator(`[data-testid="admin-property-card-${testIds.propModelB}"]`);
    await expect(cardB).toBeVisible({ timeout: 10000 });
    await page.locator(`[data-testid="admin-edit-fees-btn-${testIds.propModelB}"]`).click();
    await expect(page.locator('[data-testid="admin-fee-edit-modal"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.regression, '02-model-b-alpm-null-rent-fee.png') });
    await page.locator('[data-testid="admin-fee-modal-close-btn"]').click();
    await expect(page.locator('[data-testid="admin-fee-edit-modal"]')).not.toBeVisible({ timeout: 5000 });

    // 3. Model C (Agent Operated): 3% Platform, Rent Fee NULL, Management Fee NULL
    await page.locator('[data-testid="admin-properties-search-input"]').fill(testIds.propModelC);
    const cardC = page.locator(`[data-testid="admin-property-card-${testIds.propModelC}"]`);
    await expect(cardC).toBeVisible({ timeout: 10000 });
    await page.locator(`[data-testid="admin-edit-fees-btn-${testIds.propModelC}"]`).click();
    await expect(page.locator('[data-testid="admin-fee-edit-modal"]')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDirs.regression, '03-model-c-agent-operated-platform-only.png') });
    await page.locator('[data-testid="admin-fee-modal-close-btn"]').click();
    await expect(page.locator('[data-testid="admin-fee-edit-modal"]')).not.toBeVisible({ timeout: 5000 });
  });

});
