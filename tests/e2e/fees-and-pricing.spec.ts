import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import path from 'path';

dotenv.config({ path: '.env' });

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/fees');

test.describe.serial('Domain 1-5: Three-Fee Model, Admin Fee Config, Property Fees & Tiered Pricing', () => {

  test('1. Admin Platform Fee Configuration & Persistence', async ({ page, request }) => {
    // Authenticate as dev-platform_admin
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_admin_01', role: 'PLATFORM_ADMIN' }));
    });

    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000);

    // Open profile menu and click Settings
    const profileToggle = page.locator('[data-testid="admin-profile-menu-toggle"]');
    await expect(profileToggle).toBeVisible({ timeout: 10000 });
    await profileToggle.click();

    const settingsBtn = page.locator('[data-testid="admin-header-settings"]');
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click();

    // Verify Platform Fee Rate input exists
    const feeInput = page.locator('[data-testid="admin-platform-fee-input"]');
    await expect(feeInput).toBeVisible({ timeout: 10000 });

    // Change fee rate to 0.03 (3%)
    await feeInput.fill('0.03');

    // Take screenshot of filled setting
    await page.screenshot({ path: path.join(screenshotDir, 'admin-platform-fee-3-percent.png'), fullPage: true });

    // Click Save button
    const saveBtn = page.locator('[data-testid="admin-save-settings-btn"]');
    await saveBtn.click();

    // Wait for success indicator
    await page.waitForTimeout(1000);

    // Verify in PostgreSQL authoritative store
    const dbPolicy = await db.select().from(schema.financialPolicies)
      .where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
      .limit(1);
    expect(dbPolicy.length).toBeGreaterThan(0);
    expect(Number(dbPolicy[0].policyValue)).toBe(0.03);

    // Reload page to verify persistence in browser
    await page.reload();
    await page.waitForTimeout(2000);

    // Reopen Settings to verify persisted value
    await profileToggle.click();
    await settingsBtn.click();
    await expect(feeInput).toHaveValue('0.03');

    // Screenshot persisted value
    await page.screenshot({ path: path.join(screenshotDir, 'admin-platform-fee-3-percent-persisted.png'), fullPage: true });
  });

  test('2. Fee Authority & Client-Side Tampering Rejection', async ({ request }) => {
    // Attempt invalid platform fee: negative
    const resNegative = await request.post('/api/admin/settings', {
      headers: { Authorization: `Bearer dev-platform_admin` },
      data: { platformFeeRate: -0.05 }
    });
    expect(resNegative.status()).toBe(400);

    // Attempt invalid platform fee: > 1
    const resOver = await request.post('/api/admin/settings', {
      headers: { Authorization: `Bearer dev-platform_admin` },
      data: { platformFeeRate: 2.5 }
    });
    expect(resOver.status()).toBe(400);

    // Attempt unauthorized user changing settings
    const resUnauth = await request.post('/api/admin/settings', {
      headers: { Authorization: `Bearer dev-tenant` },
      data: { platformFeeRate: 0.01 }
    });
    expect(resUnauth.status()).toBe(403);
  });

  test('3. Property-Specific Rent Fee & Management Fee in Add Property Wizard', async ({ page, request }) => {
    // Authenticate as dev-owner
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', role: 'OWNER' }));
    });

    await page.goto('/properties/add');
    await page.waitForTimeout(2000);

    // Step 0: Property Type
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    // Step 1: Basic Info
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Audit Test Residence');

    // Select For Rent (and verify FOR_SALE is disabled)
    const rentBtn = page.locator('[data-testid="purpose-rent"]');
    await rentBtn.click();

    const saleDisabled = page.locator('[data-testid="purpose-sale-disabled"]');
    await expect(saleDisabled).toBeDisabled();

    const priceInput = page.locator('[data-testid="property-price"]');
    await priceInput.fill('1600');

    await nextBtn.click();

    // Step 2: Location
    await nextBtn.click();

    // Step 3: Specs & Details
    // Verify pricing-tier banner, operating model, and agreed fee fields are completely absent from Step 3
    await expect(page.locator('[data-testid="property-rent-fee"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="property-management-fee"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="property-operating-model"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="pricing-tier-banner"]')).toHaveCount(0);

    // Capture screenshot of clean Details step
    await page.screenshot({ path: path.join(screenshotDir, 'property-step3-details-cleaned.png'), fullPage: true });

    // Step 4: Amenities
    await nextBtn.click();
    // Step 5: Photos
    await nextBtn.click();
    // Step 6: Ownership Claim
    await nextBtn.click();

    // Step 7: Operating Model & Management (Architectural location for operating model & fee configuration)
    await nextBtn.click();

    const fullyManagedCard = page.locator('[data-testid="op-model-fully-managed"]');
    await expect(fullyManagedCard).toBeVisible({ timeout: 10000 });
    await fullyManagedCard.click();

    const agreedRentFeeInput = page.locator('[data-testid="agreed-rent-fee-input"]');
    const agreedMgmtFeeInput = page.locator('[data-testid="agreed-mgmt-fee-input"]');
    await expect(agreedRentFeeInput).toBeVisible({ timeout: 5000 });
    await expect(agreedMgmtFeeInput).toBeVisible({ timeout: 5000 });

    // Confirm initial state is empty
    await expect(agreedRentFeeInput).toHaveValue('');
    await expect(agreedMgmtFeeInput).toHaveValue('');

    // Enter agreed fees: 5% (0.05) rent fee, 10% (0.10) management fee
    await agreedRentFeeInput.fill('0.05');
    await agreedMgmtFeeInput.fill('0.10');

    // Step 8: Review & Confirmation
    await nextBtn.click();

    // Submit Property
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // Wait for submission completion
    await page.waitForTimeout(2000);

    // Verify property in PostgreSQL
    const createdProps = await db.select().from(schema.properties)
      .where(eq(schema.properties.name, 'Audit Test Residence'))
      .limit(1);

    expect(createdProps.length).toBeGreaterThan(0);
    const createdProp = createdProps[0];
    expect(Number(createdProp.rentFee)).toBe(0.05);
    expect(Number(createdProp.managementFee)).toBe(0.10);
    expect(createdProp.operatingModel).toBe('FULLY_MANAGED');

    // Screenshot persisted verification
    await page.screenshot({ path: path.join(screenshotDir, 'property-fees-persisted.png'), fullPage: true });

    // Clean up created test property
    await db.delete(schema.verificationRecords).where(eq(schema.verificationRecords.propertyId, createdProp.id));
    await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, createdProp.id));
    await db.delete(schema.listings).where(eq(schema.listings.propertyId, createdProp.id));
    await db.delete(schema.properties).where(eq(schema.properties.id, createdProp.id));
  });

  test('4. Tiered Pricing Module & Server Tier Resolution', async ({ page, request }) => {
    // Authenticate as dev-platform_admin
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-platform_admin');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_admin_01', role: 'PLATFORM_ADMIN' }));
    });

    await page.goto('/admin/dashboard');
    await page.waitForTimeout(2000);

    // Open More Menu
    const moreNav = page.locator('[data-testid="admin-nav-more"]');
    await expect(moreNav).toBeVisible({ timeout: 10000 });
    await moreNav.click();

    // Select Pricing Module
    const pricingModuleBtn = page.locator('[data-testid="admin-module-pricing"]');
    await expect(pricingModuleBtn).toBeVisible({ timeout: 5000 });
    await pricingModuleBtn.click();

    // Verify Tiered Pricing Configuration header
    await expect(page.locator('text=Tiered Pricing Configuration')).toBeVisible({ timeout: 10000 });

    // Capture screenshot of Admin Tiered Pricing Module
    await page.screenshot({ path: path.join(screenshotDir, 'admin-tiered-pricing-module.png'), fullPage: true });

    // API Verification: fetch pricing tiers
    const tiersRes = await request.get('/api/admin/pricing-tiers', {
      headers: { Authorization: `Bearer dev-platform_admin` }
    });
    expect(tiersRes.status()).toBe(200);
    const tiersData = await tiersRes.json();
    expect(Array.isArray(tiersData.pricingTiers)).toBe(true);

    // API Verification: owner pricing tier resolution
    const ownerTierRes = await request.get('/api/properties/pricing-tier', {
      headers: { Authorization: `Bearer dev-owner` }
    });
    expect(ownerTierRes.status()).toBe(200);
    const ownerTierData = await ownerTierRes.json();
    expect(ownerTierData).toHaveProperty('propertyCount');
    expect(ownerTierData).toHaveProperty('tier');
  });

  test('5. Property Fee Validation & Tampering Resistance', async ({ request }) => {
    // Attempt creating property with negative rent fee
    const resNegFee = await request.post('/api/properties', {
      headers: { Authorization: `Bearer dev-owner` },
      data: {
        name: 'Tamper Prop',
        type: 'Apartment',
        rentFee: -0.15,
      }
    });
    expect(resNegFee.status()).toBe(400);

    // Attempt creating property with rent fee > 1.0 (e.g. 150%)
    const resOverFee = await request.post('/api/properties', {
      headers: { Authorization: `Bearer dev-owner` },
      data: {
        name: 'Tamper Prop 2',
        type: 'Apartment',
        rentFee: 1.5,
      }
    });
    expect(resOverFee.status()).toBe(400);

    // Attempt creating property with NaN management fee
    const resNanFee = await request.post('/api/properties', {
      headers: { Authorization: `Bearer dev-owner` },
      data: {
        name: 'Tamper Prop 3',
        type: 'Apartment',
        managementFee: 'invalid_nan',
      }
    });
    expect(resNanFee.status()).toBe(400);
  });
});
