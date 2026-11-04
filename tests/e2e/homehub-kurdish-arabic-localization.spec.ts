import { test, expect } from '@playwright/test';

test.describe('HomeHub — Kurdish Sorani, Arabic and English Multilingual & RTL Parity', () => {
  test.beforeEach(async ({ context }) => {
    // Rule D-29: Abort remote Google Fonts to avoid timeouts
    await context.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  });

  /* ─────────────────────────────────────────────────────────────
     WF-01: English Baseline (LTR) Verification
     ───────────────────────────────────────────────────────────── */
  test('WF-01: English Baseline Loads in LTR with Expected Typography & Content', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Root & Document Direction
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('ltr');
    const rootDir = await page.locator('div[dir="ltr"]').first();
    await expect(rootDir).toBeVisible();

    // 2. Hero Headline
    const heading = page.locator('h1');
    await expect(heading).toContainText('Find Your Perfect');
    await expect(heading).toContainText('Rental');
    await expect(heading).toContainText('Home');

    // 3. Category Tabs (English)
    await expect(page.getByTestId('search-tab-all')).toHaveText('All Properties');
    await expect(page.getByTestId('search-tab-apartments')).toHaveText('Apartments');
    await expect(page.getByTestId('search-tab-houses')).toHaveText('Houses');
    await expect(page.getByTestId('search-tab-villas')).toHaveText('Villas');
    await expect(page.getByTestId('search-tab-commercial')).toHaveText('Commercial');

    // 4. Trust Feature Strip
    await expect(page.getByText('Verified Properties')).toBeVisible();
    await expect(page.getByText('Trusted Listings')).toBeVisible();
    await expect(page.getByText('Across Kurdistan')).toBeVisible();
    await expect(page.getByText('24/7 Support')).toBeVisible();

    // 5. Sections: Sponsored & Newest Rentals
    await expect(page.getByRole('heading', { name: /Sponsored Properties/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Newest Rentals/ })).toBeVisible();

    // 6. Bottom CTA Strip & Footer
    await expect(page.getByTestId('bottom-cta-strip')).toBeVisible();
    await expect(page.getByText('Looking to Rent Your Property?')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  /* ─────────────────────────────────────────────────────────────
     WF-02: Kurdish Sorani True RTL Layout & Content
     ───────────────────────────────────────────────────────────── */
  test('WF-02: Kurdish Sorani Loads in True RTL with Authentic Terminology', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Root & Document Direction
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('rtl');
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('ku');

    // 2. Kurdish Hero Headline
    const heading = page.locator('h1');
    await expect(heading).toContainText('باشترین ماڵ بۆ');
    await expect(heading).toContainText('کرێ');
    await expect(heading).toContainText('بدۆزەوە');

    // 3. Category Tabs (Kurdish Sorani)
    await expect(page.getByTestId('search-tab-all')).toHaveText('هەموو موڵکەکان');
    await expect(page.getByTestId('search-tab-apartments')).toHaveText('شوقەکان');
    await expect(page.getByTestId('search-tab-houses')).toHaveText('خانووەکان');
    await expect(page.getByTestId('search-tab-villas')).toHaveText('ڤێلاکان');
    await expect(page.getByTestId('search-tab-commercial')).toHaveText('بازرگانی');

    // 4. Trust Feature Strip (Kurdish Sorani)
    await expect(page.getByText('موڵکی پەسەندکراو')).toBeVisible();
    await expect(page.getByText('ڕیکلامی باوەڕپێکراو')).toBeVisible();
    await expect(page.getByText('لە سەرانسەری کوردستان')).toBeVisible();
    await expect(page.getByText('پشتیوانی ٢٤/٧')).toBeVisible();

    // 5. Section Headings (Kurdish Sorani)
    await expect(page.getByText('موڵکە سپۆنسەرکراوەکان')).toBeVisible();
    await expect(page.getByText('نوێترین موڵکەکانی کرێ')).toBeVisible();

    // 6. Sponsored Badges & Price Period
    const sponsoredPill = page.getByTestId('sponsored-pill').first();
    await expect(sponsoredPill).toBeVisible();
    await expect(sponsoredPill).toHaveText('سپۆنسەرکراو');

    // 7. Bottom CTA Strip (Kurdish Sorani)
    await expect(page.getByText('دەتەوێت موڵکەکەت بە کرێ بدەیت؟')).toBeVisible();
    await expect(page.getByRole('link', { name: 'موڵکەکەت تۆمار بکە' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'بەڕێوەبردنی کرێ بپشکنە' })).toBeVisible();

    // 8. Footer (Kurdish Sorani)
    await expect(page.getByText('سێ خزمەتگوزارییە سەرەکییەکە')).toBeVisible();
    await expect(page.getByText('یاسای دینامیکی ٣-تێچوو')).toBeVisible();
  });

  /* ─────────────────────────────────────────────────────────────
     WF-03: Arabic True RTL Layout & Content
     ───────────────────────────────────────────────────────────── */
  test('WF-03: Arabic Loads in True RTL with Professional Iraqi Phrasing', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ar');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 1. Root & Document Direction
    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('rtl');
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('ar');

    // 2. Arabic Hero Headline
    const heading = page.locator('h1');
    await expect(heading).toContainText('اعثر على منزلك المثالي');
    await expect(heading).toContainText('للإيجار');

    // 3. Category Tabs (Arabic)
    await expect(page.getByTestId('search-tab-all')).toHaveText('جميع العقارات');
    await expect(page.getByTestId('search-tab-apartments')).toHaveText('الشقق');
    await expect(page.getByTestId('search-tab-houses')).toHaveText('المنازل');
    await expect(page.getByTestId('search-tab-villas')).toHaveText('الفلل');
    await expect(page.getByTestId('search-tab-commercial')).toHaveText('عقارات تجارية');

    // 4. Trust Feature Strip (Arabic)
    await expect(page.getByText('عقارات موثقة')).toBeVisible();
    await expect(page.getByText('إعلانات موثوقة')).toBeVisible();
    await expect(page.getByText('في جميع أنحاء كردستان')).toBeVisible();
    await expect(page.getByText('دعم على مدار الساعة')).toBeVisible();

    // 5. Section Headings (Arabic)
    await expect(page.getByText('عقارات مميزة')).toBeVisible();
    await expect(page.getByText('أحدث عقارات الإيجار')).toBeVisible();

    // 6. Sponsored Badges & Price Period
    const sponsoredPill = page.getByTestId('sponsored-pill').first();
    await expect(sponsoredPill).toBeVisible();
    await expect(sponsoredPill).toHaveText('مميز');

    // 7. Bottom CTA Strip (Arabic)
    await expect(page.getByText('هل تبحث عن تأجير عقارك؟')).toBeVisible();
    await expect(page.getByRole('link', { name: 'أضف عقارك للإيجار' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'استكشف إدارة الإيجارات' })).toBeVisible();

    // 8. Footer (Arabic)
    await expect(page.getByText('الخدمات الثلاث الأساسية')).toBeVisible();
    await expect(page.getByText('سياسة الرسوم الثلاثية الديناميكية')).toBeVisible();
  });

  /* ─────────────────────────────────────────────────────────────
     WF-04: Dynamic Language Switching (Immediate UI Update)
     ───────────────────────────────────────────────────────────── */
  test('WF-04: Language Selector Switches Immediately (en -> ku -> ar -> en) Without Page Reload', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    const langSelect = page.locator('header select').first();
    await expect(langSelect).toBeVisible();

    // Switch to Kurdish
    await langSelect.selectOption('ku');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('هەموو موڵکەکان')).toBeVisible();
    await expect(page.getByText('باشترین ماڵ بۆ')).toBeVisible();

    // Switch to Arabic
    await langSelect.selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('جميع العقارات')).toBeVisible();
    await expect(page.getByText('اعثر على منزلك المثالي')).toBeVisible();

    // Switch back to English
    await langSelect.selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByText('All Properties')).toBeVisible();
    await expect(page.getByText('Find Your Perfect')).toBeVisible();
  });

  /* ─────────────────────────────────────────────────────────────
     WF-05: Localized Search Form & Tab Interaction
     ───────────────────────────────────────────────────────────── */
  test('WF-05: Category Tabs and Search Filters Function Reactively in RTL', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Click Category Tab: Apartments (شوقەکان)
    await page.getByTestId('search-tab-apartments').click();
    await expect(page.locator('#search-type-select')).toHaveValue('APARTMENT');

    // Click Category Tab: Commercial (بازرگانی)
    await page.getByTestId('search-tab-commercial').click();
    await expect(page.locator('#search-type-select')).toHaveValue('COMMERCIAL');

    // Type Location in Kurdish
    await page.locator('#search-location-input').fill('هەولێر - دریم ستی');
    await expect(page.locator('#search-location-input')).toHaveValue('هەولێر - دریم ستی');

    // Select Price Range
    await page.locator('#search-rent-select').selectOption('500-1000');
    await expect(page.locator('#search-rent-select')).toHaveValue('500-1000');
  });

  /* ─────────────────────────────────────────────────────────────
     WF-06: Bidirectional Safety on Currency & Metrics
     ───────────────────────────────────────────────────────────── */
  test('WF-06: Numeric Prices and Dimensions Retain Correct LTR Isolation in RTL', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'ku');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for real cards
    await page.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 10000 });

    // Verify price element has dir="ltr"
    const priceSpan = page.locator('span[dir="ltr"]').first();
    await expect(priceSpan).toBeVisible();
    const text = await priceSpan.innerText();
    expect(text).toMatch(/(\$|IQD)\s?[\d,]+/);

    // Verify favorite heart toggle in Kurdish RTL
    const favBtn = page.locator('button[aria-label="پاشەکەوتکردنی موڵک"]').first();
    await expect(favBtn).toBeVisible();
    await favBtn.click();
    await expect(favBtn.locator('svg')).toHaveClass(/fill-rose-500/);
  });
});
