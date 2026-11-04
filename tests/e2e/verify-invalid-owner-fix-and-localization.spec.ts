import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('INVALID_OWNER Fix & Comprehensive Localization Verification', () => {
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/b15a8afe-ad45-4185-aa01-7dfe7acd9bf8';

  test('Verify Step 6 Ownership default, localized INVALID_OWNER error, and successful self-creation in Kurdish RTL', async ({ page }) => {
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
          role: 'PROPERTY_OWNER',
          roles: ['PROPERTY_OWNER'],
        })
      );
    });

    // 1. Navigate to Add Property page in Kurdish
    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await expect(page.locator('#root')).toBeVisible({ timeout: 10000 });

    // Step 0: Type Selection -> Apartment
    const aptBtn = page.locator('[data-testid="property-type-apartment"]');
    await expect(aptBtn).toBeVisible({ timeout: 10000 });
    await aptBtn.click();

    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('تاوەری نیشتەجێبوونی گوڵان');
    await nextBtn.click();

    // Step 2: Location
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 3: Details
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 4: Amenities
    await page.waitForTimeout(400);
    await nextBtn.click();

    // Step 5: Photos (Add a sample preset photo)
    await page.waitForTimeout(400);
    const samplePresetBtn = page.locator('button:has-text("بینای دەرەوە"), button:has-text("Building Exterior")').first();
    if (await samplePresetBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await samplePresetBtn.click();
    }
    await nextBtn.click();

    // Step 6: Ownership (خاوەندارێتی)
    await page.waitForTimeout(500);

    // Verify Option 1: "خۆم خاوەنی مۆڵکەکەم (هەژماری خۆم)" is present and selected
    const selfOwnerText = page.locator('text=خۆم خاوەنی مۆڵکەکەم');
    await expect(selfOwnerText).toBeVisible({ timeout: 5000 });

    // Verify the "خودی خۆی / بنەڕەتی" badge is visible
    const selfBadge = page.locator('text=خودی خۆی / بنەڕەتی');
    await expect(selfBadge).toBeVisible({ timeout: 5000 });

    // Capture screenshot of Step 6 default state
    await page.screenshot({ path: path.join(artifactDir, 'step6-ownership-default-self.png'), fullPage: false });

    // Now test Option 2: Register on behalf of a client with invalid user to test localized error
    const clientOption = page.locator('text=تۆمارکردن بۆ کڕیار یان کۆمپانیا');
    await expect(clientOption).toBeVisible({ timeout: 5000 });
    await clientOption.click();

    // Fill in a non-existent client ID
    const ownerIdInput = page.locator('input[placeholder*="ئیمەیڵ"], input[placeholder*="Enter client email"]');
    await expect(ownerIdInput).toBeVisible({ timeout: 5000 });
    await ownerIdInput.fill('non_existent_client_user_xyz');

    // Proceed to Step 7 (Management)
    await nextBtn.click();
    await page.waitForTimeout(400);

    // Step 7: Management -> Select HomeHub managed or leave default
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Step 8: Review & Confirmation (پێداچوونەوە و ناردن)
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // Wait for the server validation error to be processed and localized
    const localizedErrorAlert = page.getByRole('alert');
    await expect(localizedErrorAlert).toBeVisible({ timeout: 10000 });
    await expect(localizedErrorAlert).toContainText('بەکارهێنەری دیاریکراو وەک خاوەن موڵک لە سیستەمدا بوونی نییە');

    // Verify inline field error on Step 6
    const inlineFieldError = page.locator('p:has-text("بەکارهێنەری دیاریکراو وەک خاوەن موڵک لە سیستەمدا بوونی نییە")');
    await expect(inlineFieldError).toBeVisible({ timeout: 5000 });

    // Verify the user was automatically routed back to Step 6 (خاوەندارێتی)
    await expect(ownerIdInput).toBeVisible({ timeout: 5000 });

    // Capture screenshot of the cleanly localized error in RTL without punctuation inversion
    await page.screenshot({ path: path.join(artifactDir, 'step6-localized-invalid-owner-error.png'), fullPage: false });

    // Now switch back to Self-Ownership: "خۆم خاوەنی مۆڵکەکەم"
    await selfOwnerText.click();

    // Proceed through Step 7 and Step 8 to submit successfully
    await nextBtn.click();
    await page.waitForTimeout(400);
    await nextBtn.click();
    await page.waitForTimeout(500);

    // Submit property
    await submitBtn.click();

    // Verify property created successfully and post-creation confirmed screen is visible
    const confirmationCard = page.locator('[data-testid="property-submitted-confirmation"]');
    await expect(confirmationCard).toBeVisible({ timeout: 15000 });

    // Verify confirmed management preference banner is displayed and duplicate options are not shown
    await expect(page.locator('[data-testid="preference-saved-banner"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="option-self-managed"]')).not.toBeVisible();

    // Capture screenshot of successful creation
    await page.screenshot({ path: path.join(artifactDir, 'property-created-successfully.png'), fullPage: false });
  });
});
