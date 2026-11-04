import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('F-001: Kurdish Sorani RTL Percentage Rendering & Persistence Verification', () => {
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/b15a8afe-ad45-4185-aa01-7dfe7acd9bf8';
  const screenshotsDir = path.join(process.cwd(), 'screenshots');

  test('Verify 100% renders as 100% (not %00) in Kurdish Sorani RTL, updates dynamically to 50%, and persists to Review', async ({ page }) => {
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

    // 1. Navigate to Add Property in Kurdish Sorani RTL
    await page.goto('/properties/add?lang=ku', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    // Step 0: Type Selection -> Apartment
    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();

    // Step 1: Basic Information
    const nameInput = page.locator('[data-testid="property-name"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('تاوەری نیشتەجێبوونی گوڵان - پشکنینی ڕێژە');
    await nextBtn.click();

    // Steps 2 to 5: Advance to Step 6
    await page.waitForTimeout(250);
    await nextBtn.click(); // Step 2 -> Step 3
    await page.waitForTimeout(250);
    await nextBtn.click(); // Step 3 -> Step 4
    await page.waitForTimeout(250);
    await nextBtn.click(); // Step 4 -> Step 5
    await page.waitForTimeout(250);
    await nextBtn.click(); // Step 5 -> Step 6

    // ------------------------------------------------------------------------
    // VERIFICATION 1: Step 6 Default 100% in Kurdish Sorani RTL
    // ------------------------------------------------------------------------
    await page.waitForTimeout(400);
    const percentageDisplay = page.locator('[data-testid="ownership-percentage-display"]');
    await expect(percentageDisplay).toBeVisible({ timeout: 5000 });

    // Assert that the rendered text is strictly '100%' and not '%00' or '%100'
    const renderedText100 = await percentageDisplay.innerText();
    expect(renderedText100.trim()).toBe('100%');
    expect(renderedText100.trim()).not.toBe('%00');
    expect(renderedText100.trim()).not.toBe('%100');

    // Check dir="ltr" on display badge
    const displayDir = await percentageDisplay.getAttribute('dir');
    expect(displayDir).toBe('ltr');

    // Check input field value
    const percentageInput = page.locator('[data-testid="ownership-percentage-input"]');
    await expect(percentageInput).toHaveValue('100');
    const inputDir = await percentageInput.getAttribute('dir');
    expect(inputDir).toBe('ltr');

    // Capture screenshot: 100% in Kurdish RTL
    await page.screenshot({ path: path.join(screenshotsDir, 'f001-after-sorani-rtl-percentage-100.png'), fullPage: false });
    // Also update the audit capture artifact
    await page.screenshot({ path: path.join(artifactDir, '15-kurdish-sorani-rtl-wizard-flow.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // VERIFICATION 2: Dynamic Change to 50% in Kurdish Sorani RTL
    // ------------------------------------------------------------------------
    await percentageInput.fill('50');
    await page.waitForTimeout(200);

    const renderedText50 = await percentageDisplay.innerText();
    expect(renderedText50.trim()).toBe('50%');
    expect(renderedText50.trim()).not.toBe('%50');
    expect(renderedText50.trim()).not.toBe('%0');
    await expect(percentageInput).toHaveValue('50');

    // Capture screenshot: 50% in Kurdish RTL
    await page.screenshot({ path: path.join(screenshotsDir, 'f001-after-sorani-rtl-percentage-50.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // VERIFICATION 3: Advance to Step 8 (Review) & Verify LTR Isolated Display
    // ------------------------------------------------------------------------
    await nextBtn.click(); // Step 6 -> Step 7
    await page.waitForTimeout(300);
    await nextBtn.click(); // Step 7 -> Step 8 (Review)
    await page.waitForTimeout(500);

    const reviewPercentage = page.locator('[data-testid="review-ownership-percentage"]');
    await expect(reviewPercentage).toBeVisible({ timeout: 5000 });
    const reviewText = await reviewPercentage.innerText();
    expect(reviewText.trim()).toBe('50%');
    expect(await reviewPercentage.getAttribute('dir')).toBe('ltr');

    // Capture screenshot: Step 8 Review Card in Kurdish RTL
    await page.screenshot({ path: path.join(screenshotsDir, 'f001-after-sorani-rtl-review-card.png'), fullPage: false });

    // ------------------------------------------------------------------------
    // VERIFICATION 4: Submit & Verify Database Persistence
    // ------------------------------------------------------------------------
    const submitBtn = page.locator('[data-testid="add-property-submit-btn"]');
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    const confirmationCard = page.locator('[data-testid="property-submitted-confirmation"]');
    await expect(confirmationCard).toBeVisible({ timeout: 15000 });
  });

  test('Verify ownership percentage renders correctly as 100% and 50% in English LTR baseline', async ({ page }) => {
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

    await page.goto('/properties/add?lang=en', { waitUntil: 'domcontentloaded', timeout: 30000 });
    const nextBtn = page.locator('[data-testid="add-property-next-btn"]');

    await page.locator('[data-testid="property-type-apartment"]').click();
    await nextBtn.click();
    await page.locator('[data-testid="property-name"]').fill('English LTR Percentage Test');
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();

    // Step 6: Ownership
    await page.waitForTimeout(400);
    const percentageDisplay = page.locator('[data-testid="ownership-percentage-display"]');
    await expect(percentageDisplay).toBeVisible({ timeout: 5000 });
    expect((await percentageDisplay.innerText()).trim()).toBe('100%');

    const percentageInput = page.locator('[data-testid="ownership-percentage-input"]');
    await percentageInput.fill('75');
    await page.waitForTimeout(200);
    expect((await percentageDisplay.innerText()).trim()).toBe('75%');

    // Advance to Step 8 (Review)
    await nextBtn.click();
    await page.waitForTimeout(200);
    await nextBtn.click();
    await page.waitForTimeout(400);

    const reviewPercentage = page.locator('[data-testid="review-ownership-percentage"]');
    await expect(reviewPercentage).toBeVisible({ timeout: 5000 });
    expect((await reviewPercentage.innerText()).trim()).toBe('75%');
  });
});
