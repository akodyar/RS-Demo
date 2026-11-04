import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://127.0.0.1:3000';
const OUTPUT_DIR = path.resolve(__dirname, '../screenshots/homehub-new-english-homepage-design');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function capture() {
  console.log(`[Option C Playwright] Launching browser to capture redesigned homepage...`);
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Viewport (1440x900 matching Image 2)
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
  });

  // Rule D-29: Abort remote Google Fonts to prevent 25s screenshot timeout
  await context.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());

  const page = await context.newPage();

  // Set English language in localStorage before load
  await page.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'en');
  });

  console.log(`Navigating to ${BASE_URL}...`);
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Ensure English is set
  await page.evaluate(() => {
    localStorage.setItem('homehub_lang', 'en');
    window.dispatchEvent(new Event('storage'));
  });

  // Wait for card readiness (cards loaded)
  try {
    await page.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 8000 });
    console.log('Cards rendered successfully.');
  } catch (e) {
    console.warn('Timed out waiting for cards selector, continuing with capture...');
  }

  // Ensure all images are loaded
  await page.evaluate(async () => {
    const selectors = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      selectors.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      })
    );
  });
  await page.waitForTimeout(500);

  // 1. Desktop Full Page
  const fullPath = path.join(OUTPUT_DIR, '01-desktop-homepage-full.png');
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`Captured: ${fullPath}`);

  // 2. Desktop Above-The-Fold (Hero + Floating Search + Feature Strip)
  const heroPath = path.join(OUTPUT_DIR, '02-desktop-hero-and-search.png');
  await page.screenshot({ path: heroPath, fullPage: false });
  console.log(`Captured: ${heroPath}`);

  // 3. Desktop Feature Strip & Sponsored Properties Section
  const sponsoredSection = page.locator('[data-testid="sponsored-properties-section"]');
  if (await sponsoredSection.count() > 0) {
    const sponsoredPath = path.join(OUTPUT_DIR, '03-desktop-sponsored-section.png');
    await sponsoredSection.screenshot({ path: sponsoredPath });
    console.log(`Captured: ${sponsoredPath}`);
  }

  // 4. Desktop Newest Rentals Section
  const newestSection = page.locator('[data-testid="newest-rentals-section"]');
  if (await newestSection.count() > 0) {
    const newestPath = path.join(OUTPUT_DIR, '04-desktop-newest-rentals-section.png');
    await newestSection.screenshot({ path: newestPath });
    console.log(`Captured: ${newestPath}`);
  }

  // 5. Desktop Bottom CTA Strip & Footer
  const ctaSection = page.locator('[data-testid="bottom-cta-strip"]');
  if (await ctaSection.count() > 0) {
    const ctaPath = path.join(OUTPUT_DIR, '05-desktop-cta-strip.png');
    await ctaSection.screenshot({ path: ctaPath });
    console.log(`Captured: ${ctaPath}`);
  }

  // 6. Tablet Viewport (768x1024)
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
    locale: 'en-US',
  });
  await tabletContext.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const tabletPage = await tabletContext.newPage();
  await tabletPage.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'en');
  });
  console.log('Navigating tablet...');
  await tabletPage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await tabletPage.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 10000 });
  } catch (e) {}

  await tabletPage.evaluate(async () => {
    const selectors = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      selectors.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      })
    );
  });
  await tabletPage.waitForTimeout(1000);
  const tabletPath = path.join(OUTPUT_DIR, '06-tablet-homepage.png');
  await tabletPage.screenshot({ path: tabletPath, fullPage: true });
  console.log(`Captured: ${tabletPath}`);

  // 7. Mobile Viewport (375x812)
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    locale: 'en-US',
  });
  await mobileContext.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'en');
  });

  console.log('Navigating mobile...');
  await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await mobilePage.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 10000 });
  } catch (e) {}

  await mobilePage.evaluate(async () => {
    const selectors = Array.from(document.querySelectorAll('img'));
    await Promise.all(
      selectors.map((img) => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.addEventListener('load', resolve);
          img.addEventListener('error', resolve);
        });
      })
    );
  });
  await mobilePage.waitForTimeout(1000);
  const mobilePath = path.join(OUTPUT_DIR, '07-mobile-homepage.png');
  await mobilePage.screenshot({ path: mobilePath, fullPage: true });
  console.log(`Captured: ${mobilePath}`);

  await browser.close();
  console.log('All screenshots captured successfully.');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
