import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Ownership & Management Wizard Consolidation (E2E)', () => {
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/b15a8afe-ad45-4185-aa01-7dfe7acd9bf8';

  test('Owner registers property with Self-Managed model, verifies review step and eliminated post-registration duplicate modal', async ({ page }) => {
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

    // 1. Navigate to Add Property
    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    // Step 0: Type Selection -> Apartment
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('Erbil Royal Penthouse');
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
    const yearBuiltInput = page.locator('input[data-testid="year-built"], input[name="yearBuilt"], input[placeholder*="Built"], input[placeholder*="2020"]').first();
    if (await yearBuiltInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await yearBuiltInput.fill('2023');
    }
    const areaInput = page.locator('input[data-testid="square-feet"], input[name="squareFeet"], input[placeholder*="Area"], input[placeholder*="m²"], input[placeholder*="150"]').first();
    if (await areaInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await areaInput.fill('185');
    }
    await nextBtn.click();

    // Step 4: Amenities
    await page.waitForTimeout(300);
    await nextBtn.click();

    // Step 5: Photos
    await page.waitForTimeout(300);
    const samplePresetBtn = page.locator('button:has-text("Building Exterior"), button:has-text("بینای دەرەوە")').first();
    if (await samplePresetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await samplePresetBtn.click();
    }
    await nextBtn.click();

    // Step 6: Ownership
    await page.waitForTimeout(400);
    const selfOwnerCard = page.locator('[data-testid="owner-type-self"]');
    await expect(selfOwnerCard).toBeVisible({ timeout: 5000 });
    await selfOwnerCard.click();

    // Verify ownership percentage field exists and is preserved
    const pctInput = page.locator('[data-testid="ownership-percentage-input"]');
    await expect(pctInput).toBeVisible({ timeout: 5000 });
    await expect(pctInput).toHaveValue('100');

    // Screenshot Step 6
    await page.screenshot({ path: path.join(artifactDir, 'wizard-step6-ownership-consolidated.png'), fullPage: false });
    await nextBtn.click();

    // Step 7: Management
    await page.waitForTimeout(400);
    const selfManagedCard = page.locator('[data-testid="option-self-managed"]');
    const homehubManagedCard = page.locator('[data-testid="option-homehub-managed"]');
    const agentManagedCard = page.locator('[data-testid="option-agent-managed"]');

    await expect(selfManagedCard).toBeVisible({ timeout: 5000 });
    await expect(homehubManagedCard).toBeVisible({ timeout: 5000 });
    await expect(agentManagedCard).toBeVisible({ timeout: 5000 });

    // Select Self-Managed
    await selfManagedCard.click();

    // In Self-Managed, neither agreed-mgmt-fee-input nor agreed-rent-fee-input should be visible
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).not.toBeVisible();

    // Screenshot Step 7
    await page.screenshot({ path: path.join(artifactDir, 'wizard-step7-management-self.png'), fullPage: false });
    await nextBtn.click();

    // Step 8: Review
    await page.waitForTimeout(400);
    const reviewOwner = page.locator('[data-testid="review-actual-owner"]');
    const reviewManager = page.locator('[data-testid="review-actual-manager"]');
    const reviewOpModel = page.locator('[data-testid="review-operating-model"]');
    const reviewFees = page.locator('[data-testid="review-applicable-fees"]');

    await expect(reviewOwner).toBeVisible({ timeout: 5000 });
    await expect(reviewManager).toBeVisible({ timeout: 5000 });
    await expect(reviewOpModel).toBeVisible({ timeout: 5000 });
    await expect(reviewFees).toBeVisible({ timeout: 5000 });

    // Check fee applicability for Self-Managed
    await expect(reviewFees).toContainText('Platform Fee');

    // Screenshot Step 8 Review
    await page.screenshot({ path: path.join(artifactDir, 'wizard-step8-review-consolidated.png'), fullPage: false });

    // Submit property registration
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // Post-Registration Screen Verification
    // Must show confirmed success card, verified status, and NOT duplicate management preferences modal
    const confirmationCard = page.locator('[data-testid="property-submitted-confirmation"]');
    await expect(confirmationCard).toBeVisible({ timeout: 15000 });

    const savedBanner = page.locator('[data-testid="preference-saved-banner"]');
    await expect(savedBanner).toBeVisible({ timeout: 5000 });

    const portfolioBtn = page.locator('[data-testid="go-to-portfolio-btn"]');
    await expect(portfolioBtn).toBeVisible({ timeout: 5000 });

    // Ensure the old duplicate management selection cards are NOT rendered on post-registration screen
    await expect(page.locator('[data-testid="option-self-managed"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="option-homehub-managed"]')).not.toBeVisible();

    // Screenshot confirmed post-registration screen
    await page.screenshot({ path: path.join(artifactDir, 'post-registration-consolidated-confirmation.png'), fullPage: false });
  });

  test('Step 7 Agent-Managed searchable dropdown and dynamic 3-fee model switching', async ({ page }) => {
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

    await page.goto('/properties/add', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    // Navigate to Step 7 directly through basic inputs
    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();
    await page.locator('[data-testid="property-name"]').fill('Agent Managed Test Unit');
    await nextBtn.click(); // Loc
    await page.waitForTimeout(200);
    await nextBtn.click(); // Details
    await page.waitForTimeout(200);
    await nextBtn.click(); // Amenities
    await page.waitForTimeout(200);
    await nextBtn.click(); // Photos
    await page.waitForTimeout(200);
    await nextBtn.click(); // Ownership
    await page.waitForTimeout(300);
    await nextBtn.click(); // Management

    // Step 7: Test Agent-Managed with Searchable Dropdown
    await page.waitForTimeout(400);
    const agentManagedCard = page.locator('[data-testid="option-agent-managed"]');
    await agentManagedCard.click();

    // Searchable dropdown should appear
    const agentSelect = page.locator('[data-testid="agent-company-select"]');
    await expect(agentSelect).toBeVisible({ timeout: 5000 });

    // Search input should filter options
    const searchInput = page.locator('[data-testid="agent-search-input"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('Zagros');

    // Verify option filtered
    const zagrosOption = page.locator('option:has-text("Zagros")');
    if (await zagrosOption.count() > 0) {
      await agentSelect.selectOption({ label: await zagrosOption.first().textContent() || '' });
    }

    // Test sub-model: AGENT_LISTED_PLATFORM_MANAGED vs AGENT_OPERATED
    const agentListedRadio = page.locator('[data-testid="op-model-agent-listed"]');
    const agentOperatedRadio = page.locator('[data-testid="op-model-agent-operated"]');

    // Select AGENT_LISTED_PLATFORM_MANAGED: Management fee input shown, Rent fee NOT shown
    await agentListedRadio.click();
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).not.toBeVisible();

    // Select AGENT_OPERATED: Both fee inputs hidden
    await agentOperatedRadio.click();
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).not.toBeVisible();

    // Select HomeHub-Managed: Fully managed, both fee inputs shown
    const homehubCard = page.locator('[data-testid="option-homehub-managed"]');
    await homehubCard.click();
    await expect(agentSelect).not.toBeVisible();
    await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).toBeVisible({ timeout: 3000 });

    // Screenshot Step 7 dynamic state
    await page.screenshot({ path: path.join(artifactDir, 'wizard-step7-management-agent-dropdown.png'), fullPage: false });
  });

  test('Step 6 On Behalf of Someone Else: Registered Company searchable dropdown', async ({ page }) => {
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
    await page.locator('[data-testid="property-name"]').fill('ڤێلای شاری خەونەکان');
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();

    // Step 6: Select "On Behalf of Someone Else" (تۆمارکردن بۆ کڕیار یان کۆمپانیا)
    await page.waitForTimeout(400);
    const otherOwnerCard = page.locator('[data-testid="owner-type-other"]');
    await otherOwnerCard.click();

    // Select Company Entity Type
    const companyRadio = page.locator('input[value="COMPANY"]');
    await companyRadio.click();

    // Verify searchable registered company dropdown appears
    const companySelect = page.locator('[data-testid="owner-company-select"]');
    await expect(companySelect).toBeVisible({ timeout: 5000 });

    // Search input
    const companySearch = page.locator('[data-testid="owner-company-search-input"]');
    await expect(companySearch).toBeVisible({ timeout: 5000 });

    // Screenshot Step 6 Company selection in Kurdish RTL
    await page.screenshot({ path: path.join(artifactDir, 'wizard-step6-owner-company-dropdown-ku.png'), fullPage: false });
  });
});
