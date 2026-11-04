import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://127.0.0.1:3000';
const OUTPUT_DIR = path.resolve(__dirname, '../screenshots/homehub-midnight-gold-redesign');
const ARTIFACT_DIR = 'C:/Users/zakar/.gemini/antigravity-ide/brain/a88ea70c-5a19-4bfc-abb8-c1fe2c97ec8f';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function capture() {
  console.log(`[Option C Playwright] Launching browser to capture Midnight Slate & Champagne Gold redesign...`);
  const browser = await chromium.launch({ headless: true });

  const captureLang = async (lang, isRtl = false) => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: lang === 'en' ? 'en-US' : (lang === 'ku' ? 'ckb-IQ' : 'ar-IQ'),
    });

    // Abort remote Google Fonts to prevent timeout
    await context.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());

    const page = await context.newPage();

    await page.addInitScript((l) => {
      localStorage.setItem('homehub_lang', l);
    }, lang);

    console.log(`Navigating to ${BASE_URL} (${lang})...`);
    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.evaluate((l) => {
      localStorage.setItem('homehub_lang', l);
      window.dispatchEvent(new Event('storage'));
    }, lang);

    try {
      await page.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 8000 });
    } catch (e) {
      console.warn('Selector wait finished');
    }

    // Wait a brief moment for styles and images
    await page.waitForTimeout(1000);

    if (lang === 'en') {
      // 1. Desktop Hero + Header + Search
      const heroPath = path.join(OUTPUT_DIR, '01-midnight-gold-desktop-hero-english.png');
      await page.screenshot({ path: heroPath });
      console.log(`Saved: ${heroPath}`);

      // 2. Scrolled to Sponsored Properties & Newest Rentals
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="sponsored-properties-section"]');
        if (el) el.scrollIntoView();
      });
      await page.waitForTimeout(500);
      const cardsPath = path.join(OUTPUT_DIR, '02-midnight-gold-desktop-cards-english.png');
      await page.screenshot({ path: cardsPath });
      console.log(`Saved: ${cardsPath}`);

      // 3. Scrolled to Footer & CTA Strip
      await page.evaluate(() => {
        const el = document.querySelector('[data-testid="bottom-cta-strip"]');
        if (el) el.scrollIntoView();
      });
      await page.waitForTimeout(500);
      const footerPath = path.join(OUTPUT_DIR, '03-midnight-gold-desktop-footer-english.png');
      await page.screenshot({ path: footerPath });
      console.log(`Saved: ${footerPath}`);

      // Copy to artifacts dir
      fs.copyFileSync(heroPath, path.join(ARTIFACT_DIR, '01-midnight-gold-desktop-hero-english.png'));
      fs.copyFileSync(cardsPath, path.join(ARTIFACT_DIR, '02-midnight-gold-desktop-cards-english.png'));
      fs.copyFileSync(footerPath, path.join(ARTIFACT_DIR, '03-midnight-gold-desktop-footer-english.png'));
    } else if (lang === 'ku') {
      const kuPath = path.join(OUTPUT_DIR, '04-midnight-gold-desktop-kurdish-rtl.png');
      await page.screenshot({ path: kuPath });
      console.log(`Saved: ${kuPath}`);
      fs.copyFileSync(kuPath, path.join(ARTIFACT_DIR, '04-midnight-gold-desktop-kurdish-rtl.png'));
    } else if (lang === 'ar') {
      const arPath = path.join(OUTPUT_DIR, '05-midnight-gold-desktop-arabic-rtl.png');
      await page.screenshot({ path: arPath });
      console.log(`Saved: ${arPath}`);
      fs.copyFileSync(arPath, path.join(ARTIFACT_DIR, '05-midnight-gold-desktop-arabic-rtl.png'));
    }

    await context.close();
  };

  // Capture Desktop EN, KU, AR
  await captureLang('en');
  await captureLang('ku', true);
  await captureLang('ar', true);

  // Capture Mobile Kurdish (390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ckb-IQ',
  });
  await mobileContext.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const mobilePage = await mobileContext.newPage();
  await mobilePage.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'ku');
  });
  await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(1000);
  const mobilePath = path.join(OUTPUT_DIR, '06-midnight-gold-mobile-kurdish-rtl.png');
  await mobilePage.screenshot({ path: mobilePath });
  console.log(`Saved: ${mobilePath}`);
  fs.copyFileSync(mobilePath, path.join(ARTIFACT_DIR, '06-midnight-gold-mobile-kurdish-rtl.png'));
  await mobileContext.close();

  await browser.close();
  console.log('All Midnight Slate & Champagne Gold screenshots captured successfully!');
}

capture().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
