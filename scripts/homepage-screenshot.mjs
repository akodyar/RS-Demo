/**
 * HomeHub Homepage Redesign — Screenshot Capture Script
 * Uses project-local Playwright (Option C per AGENTS.md)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotsDir = join(__dirname, '..', 'screenshots', 'homepage-redesign');
mkdirSync(screenshotsDir, { recursive: true });

const BASE_URL = 'http://127.0.0.1:3000';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });

  // Abort external Google Fonts to prevent network hang timeouts (D-29)
  await context.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());

  const page = await context.newPage();
  
  // Navigate with domcontentloaded
  console.log('🌐 Navigating to homepage on port 3000...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Set English language
  await page.evaluate(() => {
    localStorage.setItem('homehub_lang', 'en');
  });
  
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for rental cards to render
  try {
    await page.locator('[data-testid^="rental-card-"]').first().waitFor({ timeout: 10000 });
    console.log('✅ Rental listings rendered from database');
  } catch (e) {
    console.log('⚠️ Rental cards wait timed out or no cards present');
  }
  await page.waitForTimeout(1000);

  // 1. Full-page screenshot
  console.log('📸 1/6 Full homepage...');
  await page.screenshot({
    path: join(screenshotsDir, '01-homepage-full.png'),
    fullPage: true,
  });

  // 2. Hero section (above the fold)
  console.log('📸 2/6 Hero section...');
  await page.screenshot({
    path: join(screenshotsDir, '02-hero-section.png'),
    fullPage: false,
  });

  // 3. Rental listings section
  console.log('📸 3/6 Rental listings...');
  const listingsSection = page.locator('[data-testid="homepage-rental-listings"]');
  if (await listingsSection.count() > 0) {
    await listingsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: join(screenshotsDir, '03-rental-listings.png'),
      fullPage: false,
    });
  } else {
    console.log('⚠️ Rental listings section not in DOM');
  }

  // 4. Scroll down further for How It Works / Services
  console.log('📸 4/6 How It Works / Core Services...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.55));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: join(screenshotsDir, '04-how-it-works.png'),
    fullPage: false,
  });

  // 5. CTA + Footer
  console.log('📸 5/6 CTA and Footer...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(screenshotsDir, '05-cta-footer.png'),
    fullPage: false,
  });

  // 6. Mobile viewport
  console.log('📸 6/6 Mobile viewport...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => localStorage.setItem('homehub_lang', 'en'));
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: join(screenshotsDir, '06-mobile-homepage.png'),
    fullPage: true,
  });

  await browser.close();
  console.log(`\n✅ All 6 screenshots saved to: ${screenshotsDir}`);
}

main().catch((err) => {
  console.error('❌ Screenshot capture failed:', err.message);
  process.exit(1);
});
