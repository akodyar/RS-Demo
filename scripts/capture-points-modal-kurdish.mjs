import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, '..', 'screenshots', 'kurdish-localization-audit');
mkdirSync(screenshotsDir, { recursive: true });

const BASE_URL = 'http://127.0.0.1:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ckb-IQ',
  });

  // Abort external fonts to prevent hanging
  await context.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());

  const page = await context.newPage();

  // Set auth and Kurdish Sorani language
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'dev-owner');
    localStorage.setItem('homehub_auth_token', 'dev-owner');
    localStorage.setItem('homehub_lang', 'ku');
    localStorage.setItem('homehub_auth_persona', JSON.stringify({
      id: 'user_owner_01',
      role: 'PROPERTY_OWNER',
      roles: ['PROPERTY_OWNER'],
    }));
  });

  console.log('🌐 Navigating to Owner workspace in Kurdish Sorani...');
  await page.goto(`${BASE_URL}/owner?tab=wallet`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Click purchase points button
  console.log('🔘 Opening Points Purchase Modal...');
  const purchaseBtn = page.locator('[data-testid="purchase-points-btn"]');
  if (await purchaseBtn.count() > 0) {
    await purchaseBtn.click();
  } else {
    // If not on tab, click nav button
    const pointsNav = page.locator('[data-testid="owner-nav-points"]');
    if (await pointsNav.count() > 0) {
      await pointsNav.click();
      await page.waitForTimeout(1000);
      await page.locator('[data-testid="purchase-points-btn"]').click();
    }
  }

  // Wait for modal to be visible and packages to load
  const modal = page.locator('[data-testid="points-purchase-modal"]');
  await modal.waitFor({ timeout: 10000 });
  
  try {
    await page.locator('[data-testid^="package-option-"]').first().waitFor({ timeout: 10000 });
    console.log('✅ Package options loaded in DOM');
  } catch (e) {
    console.log('⚠️ Wait for package options timed out:', e.message);
  }
  await page.waitForTimeout(1000);

  console.log('📸 Capturing Points Purchase Modal in Kurdish Sorani...');
  await page.screenshot({
    path: join(screenshotsDir, 'points-purchase-modal-kurdish.png'),
    fullPage: false,
  });

  // Also capture full view
  await page.screenshot({
    path: join(screenshotsDir, 'points-purchase-modal-kurdish-full.png'),
    fullPage: true,
  });

  await browser.close();
  console.log(`✅ Kurdish localized modal screenshots saved to: ${screenshotsDir}`);
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
