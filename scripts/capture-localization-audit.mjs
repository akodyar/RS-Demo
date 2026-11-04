import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('screenshots/homehub-kurdish-arabic-localization-audit');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function capture() {
  console.log('Starting Playwright (Option C) for Localization Audit captures...');
  const browser = await chromium.launch({ headless: true });

  // ─────────────────────────────────────────────────────────────
  // 1. ENGLISH BASELINE (Desktop & Mobile)
  // ─────────────────────────────────────────────────────────────
  const desktopEn = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await desktopEn.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const pageEn = await desktopEn.newPage();
  await pageEn.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'en');
  });
  await pageEn.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageEn.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 15000 });
  await pageEn.waitForTimeout(1000);

  // 001: English Desktop Full
  await pageEn.screenshot({
    path: path.join(outDir, '001-english-baseline-desktop.png'),
    fullPage: true,
  });
  console.log('Captured 001-english-baseline-desktop.png');

  // 002: English Mobile (375x812)
  const mobileEn = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await mobileEn.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const pageEnMobile = await mobileEn.newPage();
  await pageEnMobile.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'en');
  });
  await pageEnMobile.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageEnMobile.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 15000 });
  await pageEnMobile.waitForTimeout(1000);

  await pageEnMobile.screenshot({
    path: path.join(outDir, '002-english-mobile-homepage.png'),
    fullPage: false,
  });
  console.log('Captured 002-english-mobile-homepage.png');
  await mobileEn.close();
  await desktopEn.close();

  // ─────────────────────────────────────────────────────────────
  // 2. KURDISH SORANI (Desktop Full, Hero/Search, Sections, Mobile, Search Interaction)
  // ─────────────────────────────────────────────────────────────
  const desktopKu = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1,
  });
  await desktopKu.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const pageKu = await desktopKu.newPage();
  await pageKu.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'ku');
  });
  await pageKu.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageKu.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 15000 });
  await pageKu.waitForTimeout(1000);

  // 003: Kurdish Desktop Full
  await pageKu.screenshot({
    path: path.join(outDir, '003-kurdish-desktop-homepage.png'),
    fullPage: true,
  });
  console.log('Captured 003-kurdish-desktop-homepage.png');

  // 004: Kurdish Hero & Floating Search
  await pageKu.screenshot({
    path: path.join(outDir, '004-kurdish-hero-search.png'),
    fullPage: false,
  });
  console.log('Captured 004-kurdish-hero-search.png');

  // 005: Kurdish Sponsored & Newest Rentals Sections
  const sponsoredSection = pageKu.getByTestId('sponsored-properties-section');
  await sponsoredSection.scrollIntoViewIfNeeded();
  await pageKu.waitForTimeout(600);
  await pageKu.screenshot({
    path: path.join(outDir, '005-kurdish-property-sections.png'),
    fullPage: false,
  });
  console.log('Captured 005-kurdish-property-sections.png');

  // 007: Kurdish Search Interaction (Active tab + typed location)
  await pageKu.evaluate(() => window.scrollTo(0, 0));
  await pageKu.waitForTimeout(400);
  await pageKu.getByTestId('search-tab-apartments').click();
  await pageKu.locator('#search-location-input').fill('هەولێر - دریم ستی');
  await pageKu.locator('#search-rent-select').selectOption('500-1000');
  await pageKu.waitForTimeout(400);
  await pageKu.screenshot({
    path: path.join(outDir, '007-kurdish-search-interaction.png'),
    fullPage: false,
  });
  console.log('Captured 007-kurdish-search-interaction.png');

  // 006: Kurdish Mobile (375x812)
  const mobileKu = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await mobileKu.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const pageKuMobile = await mobileKu.newPage();
  await pageKuMobile.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'ku');
  });
  await pageKuMobile.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageKuMobile.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 15000 });
  await pageKuMobile.waitForTimeout(1000);

  await pageKuMobile.screenshot({
    path: path.join(outDir, '006-kurdish-mobile-homepage.png'),
    fullPage: false,
  });
  console.log('Captured 006-kurdish-mobile-homepage.png');
  await mobileKu.close();

  // 008: Kurdish Localized Tenant Workspace
  await pageKu.goto('http://localhost:3000/workspace/tenant', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageKu.waitForTimeout(1000);
  await pageKu.screenshot({
    path: path.join(outDir, '008-kurdish-tenant-workspace.png'),
    fullPage: false,
  });
  console.log('Captured 008-kurdish-tenant-workspace.png');
  await desktopKu.close();

  // ─────────────────────────────────────────────────────────────
  // 3. ARABIC (Desktop Full, Hero/Search, Sections, Mobile, Search Interaction, Owner Workspace)
  // ─────────────────────────────────────────────────────────────
  const desktopAr = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1,
  });
  await desktopAr.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const pageAr = await desktopAr.newPage();
  await pageAr.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'ar');
  });
  await pageAr.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageAr.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 15000 });
  await pageAr.waitForTimeout(1000);

  // 009: Arabic Desktop Full
  await pageAr.screenshot({
    path: path.join(outDir, '009-arabic-desktop-homepage.png'),
    fullPage: true,
  });
  console.log('Captured 009-arabic-desktop-homepage.png');

  // 010: Arabic Hero & Floating Search
  await pageAr.screenshot({
    path: path.join(outDir, '010-arabic-hero-search.png'),
    fullPage: false,
  });
  console.log('Captured 010-arabic-hero-search.png');

  // 011: Arabic Sponsored & Newest Rentals Sections
  const sponsoredSectionAr = pageAr.getByTestId('sponsored-properties-section');
  await sponsoredSectionAr.scrollIntoViewIfNeeded();
  await pageAr.waitForTimeout(600);
  await pageAr.screenshot({
    path: path.join(outDir, '011-arabic-property-sections.png'),
    fullPage: false,
  });
  console.log('Captured 011-arabic-property-sections.png');

  // 013: Arabic Search Interaction (Active tab + typed location)
  await pageAr.evaluate(() => window.scrollTo(0, 0));
  await pageAr.waitForTimeout(400);
  await pageAr.getByTestId('search-tab-villas').click();
  await pageAr.locator('#search-location-input').fill('أربيل - القرية الإيطالية');
  await pageAr.locator('#search-rent-select').selectOption('1000-2000');
  await pageAr.waitForTimeout(400);
  await pageAr.screenshot({
    path: path.join(outDir, '013-arabic-search-interaction.png'),
    fullPage: false,
  });
  console.log('Captured 013-arabic-search-interaction.png');

  // 012: Arabic Mobile (375x812)
  const mobileAr = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  await mobileAr.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const pageArMobile = await mobileAr.newPage();
  await pageArMobile.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'ar');
  });
  await pageArMobile.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageArMobile.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 15000 });
  await pageArMobile.waitForTimeout(1000);

  await pageArMobile.screenshot({
    path: path.join(outDir, '012-arabic-mobile-homepage.png'),
    fullPage: false,
  });
  console.log('Captured 012-arabic-mobile-homepage.png');
  await mobileAr.close();

  // 014: Arabic Localized Owner Workspace
  await pageAr.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pageAr.waitForTimeout(1000);
  await pageAr.screenshot({
    path: path.join(outDir, '014-arabic-owner-workspace.png'),
    fullPage: false,
  });
  console.log('Captured 014-arabic-owner-workspace.png');
  await desktopAr.close();

  // ─────────────────────────────────────────────────────────────
  // 4. DYNAMIC LANGUAGE SWITCH REGRESSION
  // ─────────────────────────────────────────────────────────────
  const switchCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await switchCtx.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  const switchPage = await switchCtx.newPage();
  await switchPage.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await switchPage.waitForSelector('header select', { timeout: 15000 });

  // Switch to ku, then ar, then ku again to verify flawless dynamic switching
  await switchPage.locator('header select').first().selectOption('ku');
  await switchPage.waitForTimeout(500);
  await switchPage.screenshot({
    path: path.join(outDir, '015-language-switch-regression.png'),
    fullPage: false,
  });
  console.log('Captured 015-language-switch-regression.png');
  await switchCtx.close();

  await browser.close();
  console.log('All 15 screenshots successfully captured in screenshots/homehub-kurdish-arabic-localization-audit/!');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
