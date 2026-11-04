import { chromium } from 'playwright';

async function checkSections() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const sponsoredSection = await page.$('[data-testid="sponsored-properties-section"]');
  const sponsoredCards = await page.$$('[data-testid="sponsored-properties-section"] [data-testid="sponsored-pill"]');
  console.log('Sponsored cards count:', sponsoredCards.length);

  const newestSection = await page.$('[data-testid="newest-rentals-section"]');
  const newestCards = await page.$$('[data-testid="newest-rentals-section"] a[href^="/rentals/"]');
  console.log('Newest rental links count:', newestCards.length);

  await browser.close();
}

checkSections().catch(console.error);
