import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Comprehensive Property Wizard Verification & Screenshot Capture', () => {
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/b15a8afe-ad45-4185-aa01-7dfe7acd9bf8';

  test('Exercise all 16 required wizard states, dropdown interactions, review, post-registration, RTL, and mobile layout', async ({ page }) => {
    // ------------------------------------------------------------------------
    // SETUP: Authenticated Property Owner Persona
    // ------------------------------------------------------------------------
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          email: 'owner@homehub.iq',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    // ------------------------------------------------------------------------
    // STATE 1: Wizard Initial State (Step 0: Type Selection)
    // ------------------------------------------------------------------------
    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });

    // Capture 01: Initial State
    await page.screenshot({ path: path.join(artifactDir, '01-wizard-initial-type-step.png'), fullPage: false });

    // Progress through Step 0 -> Step 1
    await aptBtn.click();
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Erbil Royal Penthouse Deluxe');
    await nextBtn.click();

    // Step 2: Location
    await page.waitForTimeout(300);
    const cityInput = page.locator('input[placeholder*="City"], select[name="city"]').first();
    if (await cityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cityInput.fill('Erbil');
    }
    await nextBtn.click();

    // Step 3: Details (Preserve Year Built & Total Area)
    await page.waitForTimeout(300);
    const yearBuiltInput = page.locator('[data-testid="property-year-built"]');
    await expect(yearBuiltInput).toBeVisible({ timeout: 5000 });
    await yearBuiltInput.fill('2023');

    const areaInput = page.locator('[data-testid="property-square-feet"]');
    await expect(areaInput).toBeVisible({ timeout: 5000 });
    await areaInput.fill('185');
    await nextBtn.click();

    // Step 4: Amenities
    await page.waitForTimeout(300);
    await nextBtn.click();

    // Step 5: Photos (Add preset photo)
    await page.waitForTimeout(300);
    const samplePresetBtn = page.locator('button:has-text("Building Exterior"), button:has-text("بینای دەرەوە")').first();
    if (await samplePresetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await samplePresetBtn.click();
    }
    await nextBtn.click();

    // ------------------------------------------------------------------------
    // STATE 2: Ownership Step — Self-Owner (Step 6)
    // ------------------------------------------------------------------------
    await page.waitForTimeout(400);
    const selfOwnerCard = page.locator('[data-testid="owner-type-self"]');
    const otherOwnerCard = page.locator('[data-testid="owner-type-other"]');
    await expect(selfOwnerCard).toBeVisible({ timeout: 5000 });
    await expect(otherOwnerCard).toBeVisible({ timeout: 5000 });

    // Select self-owner
    await selfOwnerCard.click();
    await expect(page.locator('[data-testid="ownership-percentage-input"]')).toHaveValue('100');

    // Capture 02: Self-Owner
    await page.screenshot({ path: path.join(artifactDir, '02-ownership-step-self-owner.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 3: Ownership Step — On-Behalf-Of Individual (Step 6)
    // ------------------------------------------------------------------------
    await otherOwnerCard.click();
    const indRadio = page.locator('[data-testid="owner-type-individual"]');
    const compRadio = page.locator('[data-testid="owner-type-company"]');
    await expect(indRadio).toBeVisible({ timeout: 5000 });
    await expect(compRadio).toBeVisible({ timeout: 5000 });

    await indRadio.click();
    const clientInput = page.locator('input[placeholder*="Enter client email"], input[placeholder*="ئیمەیڵ"]').first();
    await expect(clientInput).toBeVisible({ timeout: 5000 });
    await clientInput.fill('client.salar@homehub.test');

    // Capture 03: On-Behalf-Of Individual
    await page.screenshot({ path: path.join(artifactDir, '03-ownership-step-on-behalf-individual.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 4: Ownership Step — On-Behalf-Of Company (Step 6)
    // ------------------------------------------------------------------------
    await compRadio.click();
    const companySelect = page.locator('[data-testid="owner-company-select"]');
    const companySearchInput = page.locator('[data-testid="owner-company-search-input"]');
    await expect(companySelect).toBeVisible({ timeout: 5000 });
    await expect(companySearchInput).toBeVisible({ timeout: 5000 });

    // Capture 04: On-Behalf-Of Company Initial (empty select with placeholder)
    await page.screenshot({ path: path.join(artifactDir, '04-ownership-step-on-behalf-company.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 5: Owner Company Dropdown with Seeded Results (Selected Option)
    // ------------------------------------------------------------------------
    // Select seeded company (org_company_01 - Zagros Real Estate) to visibly show populated selection
    await companySelect.selectOption({ value: 'org_company_01' });
    await page.waitForTimeout(300);

    // Capture 05: Dropdown with seeded company selected
    await page.screenshot({ path: path.join(artifactDir, '05-owner-company-dropdown-seeded-results.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 6: Dropdown Search with Matching Results
    // ------------------------------------------------------------------------
    await companySearchInput.fill('Zagros');
    await page.waitForTimeout(200);
    const matchingOption = companySelect.locator('option:has-text("Zagros")');
    await expect(matchingOption).toBeAttached({ timeout: 3000 });

    // Capture 06: Search Match
    await page.screenshot({ path: path.join(artifactDir, '06-owner-company-dropdown-search-match.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 7: Dropdown Search with No Results
    // ------------------------------------------------------------------------
    await companySearchInput.fill('XYZNonExistentCompany999');
    await page.waitForTimeout(200);
    // When no matching company exists, only the placeholder option is displayed
    await expect(companySelect.locator('option')).toHaveCount(1);

    // Capture 07: Search No Results
    await page.screenshot({ path: path.join(artifactDir, '07-owner-company-dropdown-search-no-match.png'), fullPage: false });

    // Revert to self-owner for final registration flow
    await selfOwnerCard.click();
    await page.waitForTimeout(300);
    await nextBtn.click();

    // ------------------------------------------------------------------------
    // STATE 8: Management Step — Self-Managed (Step 7)
    // ------------------------------------------------------------------------
    await page.waitForTimeout(400);
    const selfManagedCard = page.locator('[data-testid="option-self-managed"]');
    const homehubManagedCard = page.locator('[data-testid="option-homehub-managed"]');
    const agentManagedCard = page.locator('[data-testid="option-agent-managed"]');

    await expect(selfManagedCard).toBeVisible({ timeout: 5000 });
    await expect(homehubManagedCard).toBeVisible({ timeout: 5000 });
    await expect(agentManagedCard).toBeVisible({ timeout: 5000 });

    await selfManagedCard.click();
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).not.toBeVisible();

    // Capture 08: Self-Managed
    await page.screenshot({ path: path.join(artifactDir, '08-management-step-self-managed.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 9: Management Step — HomeHub-Managed (Step 7)
    // ------------------------------------------------------------------------
    await homehubManagedCard.click();
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).toBeVisible({ timeout: 3000 });

    // Capture 09: HomeHub-Managed
    await page.screenshot({ path: path.join(artifactDir, '09-management-step-homehub-managed.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 10: Management Step — Agent-Managed with Dropdown (Step 7)
    // ------------------------------------------------------------------------
    await agentManagedCard.click();
    const agentSelect = page.locator('[data-testid="agent-company-select"]');
    const agentSearchInput = page.locator('[data-testid="agent-search-input"]');
    await expect(agentSelect).toBeVisible({ timeout: 5000 });
    await expect(agentSearchInput).toBeVisible({ timeout: 5000 });

    await agentSearchInput.fill('Zagros');
    await page.waitForTimeout(200);

    // Capture 10: Agent-Managed with Search
    await page.screenshot({ path: path.join(artifactDir, '10-management-step-agent-managed.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 11: Applicable Fee Inputs: Agent-Listed vs Fully Managed (Step 7)
    // ------------------------------------------------------------------------
    const agentListedRadio = page.locator('[data-testid="op-model-agent-listed"]');
    await agentListedRadio.click();
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).not.toBeVisible();

    // Capture 11: Fee Inputs for Agent-Listed
    await page.screenshot({ path: path.join(artifactDir, '11-fee-inputs-agent-listed-vs-fully-managed.png'), fullPage: false });

    // Set to Self-Managed for completion
    await selfManagedCard.click();
    await page.waitForTimeout(300);
    await nextBtn.click();

    // ------------------------------------------------------------------------
    // STATE 12: Review Step — All Specifications (Step 8)
    // ------------------------------------------------------------------------
    await page.waitForTimeout(400);
    const reviewOwner = page.locator('[data-testid="review-actual-owner"]');
    const reviewManager = page.locator('[data-testid="review-actual-manager"]');
    const reviewOpModel = page.locator('[data-testid="review-operating-model"]');
    const reviewFees = page.locator('[data-testid="review-applicable-fees"]');
    const reviewYearBuilt = page.locator('[data-testid="review-year-built"]');
    const reviewTotalArea = page.locator('[data-testid="review-total-area"]');

    await expect(reviewOwner).toBeVisible({ timeout: 5000 });
    await expect(reviewManager).toBeVisible({ timeout: 5000 });
    await expect(reviewOpModel).toBeVisible({ timeout: 5000 });
    await expect(reviewFees).toBeVisible({ timeout: 5000 });
    await expect(reviewYearBuilt).toHaveText('2023');
    await expect(reviewTotalArea).toContainText('185');

    // Capture 12: Review Step
    await page.screenshot({ path: path.join(artifactDir, '12-review-step-all-specifications.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // STATE 13 & 14: Registration Success, Verification Status & No Duplicate
    // ------------------------------------------------------------------------
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    await submitBtn.click();

    // Verify confirmation card
    const confirmationCard = page.locator('[data-testid="property-submitted-confirmation"]');
    await expect(confirmationCard).toBeVisible({ timeout: 15000 });

    const savedBanner = page.locator('[data-testid="preference-saved-banner"]');
    await expect(savedBanner).toBeVisible({ timeout: 5000 });

    // Capture 13: Registration Success & Verified Status
    await page.screenshot({ path: path.join(artifactDir, '13-registration-success-verified-status.png'), fullPage: false });

    // Verify NO duplicate management choice is present
    await expect(page.locator('[data-testid="option-self-managed"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="option-homehub-managed"]')).not.toBeVisible();

    // Scroll to preference saved banner and hover over primary action button to capture distinct interactive post-registration state
    const portfolioBtn = page.locator('button:has-text("Go to My Portfolio")').first();
    await savedBanner.scrollIntoViewIfNeeded();
    await portfolioBtn.hover();
    await page.waitForTimeout(300);

    // Capture 14: Post-Registration Confirmation (Distinct Confirmed Arrangement View)
    await page.screenshot({ path: path.join(artifactDir, '14-post-registration-confirmed-no-duplicate.png'), fullPage: false });
  });

  // --------------------------------------------------------------------------
  // STATE 15: Kurdish Sorani RTL Wizard Flow
  // --------------------------------------------------------------------------
  test('Capture State 15: Kurdish Sorani RTL Layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
      localStorage.setItem('homehub_language', 'ku');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          email: 'owner@homehub.iq',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();
    await page.locator('[data-testid="property-name"]').fill('تاوەری نیشتەجێبوونی گوڵان');
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();

    // In Step 6 in Kurdish Sorani RTL
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="owner-type-self"]')).toBeVisible({ timeout: 5000 });

    // Capture 15: Kurdish Sorani RTL
    await page.screenshot({ path: path.join(artifactDir, '15-kurdish-sorani-rtl-wizard-flow.png'), fullPage: false });
  });

  // --------------------------------------------------------------------------
  // STATE 16: Mobile Viewport (375x812) Responsive Layout
  // --------------------------------------------------------------------------
  test('Capture State 16: Mobile Viewport Responsive Layout', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
      localStorage.setItem('homehub_language', 'en');
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_token', 'dev-owner');
      localStorage.setItem(
        'homehub_auth_persona',
        JSON.stringify({
          id: 'user_owner_01',
          email: 'owner@homehub.iq',
          name: 'Salar Aziz',
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();
    await page.locator('[data-testid="property-name"]').fill('Mobile Test Apartment');
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click(); // Now at Step 6

    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="owner-type-self"]')).toBeVisible({ timeout: 5000 });

    // Progress to Step 7
    await nextBtn.click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-testid="option-self-managed"]')).toBeVisible({ timeout: 5000 });

    // Capture 16: Mobile Viewport Responsive Layout
    await page.screenshot({ path: path.join(artifactDir, '16-mobile-width-wizard-layout.png'), fullPage: false });
  });
});
