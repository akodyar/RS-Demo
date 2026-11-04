import { test, expect } from '@playwright/test';

test.describe('HomeHub — New English Homepage Design & Discovery Workflows', () => {
  test.beforeEach(async ({ context }) => {
    // Rule D-29: Abort remote Google Fonts to avoid timeouts
    await context.route(/(fonts.googleapis.com|fonts.gstatic.com)/, (r) => r.abort());
  });

  test('WF-01: Public English Homepage Loads Without Authentication & Displays Target Structure', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Verify LTR direction
    const bodyDir = await page.locator('div[dir="ltr"]').first();
    await expect(bodyDir).toBeVisible();

    // Verify Header
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('link', { name: 'HomeHub' })).toBeVisible();

    // Verify Hero Headline with 'Rental'
    const heading = page.locator('h1');
    await expect(heading).toContainText('Find Your Perfect');
    await expect(heading).toContainText('Rental');
    await expect(heading).toContainText('Home');

    // Verify Category Tabs
    await expect(page.getByTestId('search-tab-all')).toBeVisible();
    await expect(page.getByTestId('search-tab-apartments')).toBeVisible();
    await expect(page.getByTestId('search-tab-houses')).toBeVisible();
    await expect(page.getByTestId('search-tab-villas')).toBeVisible();
    await expect(page.getByTestId('search-tab-commercial')).toBeVisible();

    // Verify Feature Strip
    await expect(page.getByTestId('trust-feature-strip')).toBeVisible();
    await expect(page.getByText('Verified Properties')).toBeVisible();
    await expect(page.getByText('Trusted Listings')).toBeVisible();
    await expect(page.getByText('Across Kurdistan')).toBeVisible();
    await expect(page.getByText('24/7 Support')).toBeVisible();

    // Verify Sections: Sponsored Properties & Newest Rentals
    await expect(page.getByTestId('sponsored-properties-section')).toBeVisible();
    await expect(page.getByTestId('newest-rentals-section')).toBeVisible();

    // Verify Bottom CTA Strip & Footer
    await expect(page.getByTestId('bottom-cta-strip')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('WF-02: Search Controls and Category Tabs Function Reactively', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Click Category Tab: Apartments
    await page.getByTestId('search-tab-apartments').click();
    await expect(page.locator('#search-type-select')).toHaveValue('APARTMENT');

    // Click Category Tab: Commercial
    await page.getByTestId('search-tab-commercial').click();
    await expect(page.locator('#search-type-select')).toHaveValue('COMMERCIAL');

    // Enter Location
    await page.locator('#search-location-input').fill('Erbil');
    await expect(page.locator('#search-location-input')).toHaveValue('Erbil');

    // Select Price Range
    await page.locator('#search-rent-select').selectOption('500-1000');
    await expect(page.locator('#search-rent-select')).toHaveValue('500-1000');

    // Select Bedrooms
    await page.locator('#search-bedrooms-select').selectOption('2');
    await expect(page.locator('#search-bedrooms-select')).toHaveValue('2');
  });

  test('WF-03: Real Property Cards Render With Prices, Metadata and Interactive Favorites', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for card readiness
    await page.waitForSelector('[data-testid^="sponsored-card-"], [data-testid^="rental-card-"]', { timeout: 10000 });

    // Verify Sponsored card has SPONSORED pill
    const sponsoredPill = page.getByTestId('sponsored-pill').first();
    await expect(sponsoredPill).toBeVisible();
    await expect(sponsoredPill).toHaveText('SPONSORED');

    // Verify Favorite button toggle
    const favBtn = page.locator('button[aria-label="Save property"]').first();
    await expect(favBtn).toBeVisible();
    await favBtn.click();

    // Verify Heart turns rose/filled
    const heartSvg = favBtn.locator('svg');
    await expect(heartSvg).toHaveClass(/fill-rose-500/);
  });

  test('WF-04: Header Sign In and Dashboard Route Preservation', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('homehub_lang', 'en');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Verify Sign In link is present and routes to /login
    const signInBtn = page.getByRole('link', { name: 'Sign In' });
    await expect(signInBtn).toBeVisible();
    await expect(signInBtn).toHaveAttribute('href', '/login');

    // Verify Core Service Navigation links
    await expect(page.getByRole('link', { name: 'For Rent', exact: true })).toHaveAttribute('href', '/rentals');
    await expect(page.getByRole('link', { name: 'Rent Management', exact: true })).toHaveAttribute('href', '/rent-management');
    await expect(page.getByRole('link', { name: 'Property Services', exact: true })).toHaveAttribute('href', '/services');
    await expect(page.getByRole('link', { name: 'Add New Property', exact: true })).toHaveAttribute('href', '/properties/add');
  });
});
