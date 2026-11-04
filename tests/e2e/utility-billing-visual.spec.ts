import { test, expect } from '@playwright/test';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

test.describe('Utility Billing Visual & RTL Verification', () => {
  test.skip('Capture screenshots for LTR and RTL layouts', async ({ page }) => {
    // Obsolete test. Visuals are captured by capture-audit-visuals.spec.ts which includes DB setup.
    // 1. Mock authentication
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('homehub_auth_persona', JSON.stringify({id: 'user_tenant_01', role: 'TENANT'}));
      localStorage.setItem('auth_token', 'dev-tenant');
    });
    
    // Reload to apply auth and go to dashboard
    await page.goto('/workspace/tenant');
    
    // Wait for the Dashboard to load by looking for the button
    await page.waitForSelector('#quick-action-utility-bills', { timeout: 10000 });

    // Click the Utility Bills quick action
    await page.click('#quick-action-utility-bills');
    
    // Wait for the Utility Bills section to appear
    await page.waitForSelector('text=Utility Bills', { timeout: 10000 });
    
    // Wait a brief moment for any bills to fetch
    await page.waitForTimeout(2000);

    // Take English (LTR) screenshot
    await page.screenshot({ path: 'test-results/utility-billing-en-ltr.png', fullPage: true });

    // Verify a bill exists (e.g. WATER Bill)
    const billText = await page.locator('text=WATER Bill').isVisible();
    console.log('WATER Bill visible in English:', billText);

    // Switch to Kurdish Sorani (RTL)
    // There is a language switcher, but we can also force the RTL direction if the UI doesn't have an easy selector
    // Or we can click the language switcher:
    // Actually, looking at the layout, let's force the dir and lang directly if the switcher is hard to find
    await page.evaluate(() => {
      localStorage.setItem('homehub_language', 'ku');
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ku';
    });
    await page.reload();
    
    await page.waitForSelector('#quick-action-utility-bills', { timeout: 10000 });
    await page.click('#quick-action-utility-bills');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/utility-billing-ku-rtl.png', fullPage: true });

    // Switch to Arabic (RTL)
    await page.evaluate(() => {
      localStorage.setItem('homehub_language', 'ar');
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    });
    await page.reload();
    
    await page.waitForSelector('#quick-action-utility-bills', { timeout: 10000 });
    await page.click('#quick-action-utility-bills');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/utility-billing-ar-rtl.png', fullPage: true });
    
    console.log('Visual verification complete!');
  });
});
