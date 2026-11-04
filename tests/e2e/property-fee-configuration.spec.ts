import { test, expect } from '@playwright/test';
import path from 'path';

const screenshotDir = path.resolve(process.cwd(), 'screenshots/fee-model');

test.describe('Property Fee Configuration & Legacy Calculator Removal', () => {

  const performTests = (locale, langCode) => {
    test.describe(`Locale: ${locale}`, () => {
      test.use({ locale: langCode });

      test('Test D — Legacy Calculator is NOT visible', async ({ page }) => {
        await page.goto(`/?lang=${langCode}`);
        await page.waitForTimeout(1000);
        
        // Assert calculator inputs/titles don't exist
        const calculatorInput = page.locator('input[type="number"][min="10000"]');
        await expect(calculatorInput).toHaveCount(0);
        
        // Navigate to Owner Workspace
        await page.goto(`/workspace/owner?lang=${langCode}`);
        await page.waitForTimeout(1000);

        // Assert Canonical % Commission pill card doesn't exist
        await expect(page.locator('text=950,000 IQD')).toHaveCount(0);
      });

      test('Test A, B, C — Property Registration and Details', async ({ page }) => {
        await page.addInitScript(() => {
          localStorage.setItem('auth_token', 'dev-owner');
          localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', role: 'OWNER' }));
        });

        await page.goto(`/properties/add?lang=${langCode}`, { waitUntil: 'domcontentloaded' });

        // Step 0: Select Apartment type to enable Next button
        const aptBtn = page.locator('[data-testid="property-type-apartment"]');
        await expect(aptBtn).toBeVisible({ timeout: 10000 });
        await aptBtn.click();

        const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
        await nextBtn.click(); // Now on Step 1: Basic Info

        const nameInput = page.locator('[data-testid="property-name"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });
        await nameInput.fill('Empire World Tower A');

        await page.waitForTimeout(400);
        await nextBtn.click(); // Now on Step 2: Location

        await page.waitForTimeout(400);
        await nextBtn.click(); // Now on Step 3: Specifications / Details

        // Assert pricing-tier banner, operating model dropdown, and agreed fee inputs are completely ABSENT from Step 3 (Details)
        await expect(page.locator('[data-testid="pricing-tier-banner"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="property-operating-model"]')).toHaveCount(0);
        await expect(page.locator('input[data-testid="property-rent-fee"]')).toHaveCount(0);
        await expect(page.locator('input[data-testid="property-management-fee"]')).toHaveCount(0);

        // Verify valid Details fields are rendered and operational
        const conditionSelect = page.locator('select').first();
        await expect(conditionSelect).toBeVisible({ timeout: 5000 });

        // Step 4: Amenities
        await nextBtn.click();
        await page.waitForTimeout(400);

        // Step 5: Photos
        await nextBtn.click();
        await page.waitForTimeout(400);

        // Step 6: Ownership
        await nextBtn.click();
        await page.waitForTimeout(400);

        // Step 7: Operations & Agreed Fees - Operating models are architecturally verified here
        await nextBtn.click();
        await page.waitForTimeout(400);

        const fullyManagedCard = page.locator('[data-testid="op-model-fully-managed"]');
        await expect(fullyManagedCard).toBeVisible({ timeout: 10000 });
        await fullyManagedCard.click();
        await expect(page.locator('[data-testid="agreed-mgmt-fee-input"]')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('[data-testid="agreed-rent-fee-input"]')).toBeVisible({ timeout: 5000 });
      });
    });
  };

  performTests('English', 'en');
  performTests('Kurdish Sorani', 'ku');
  performTests('Arabic', 'ar');

});
