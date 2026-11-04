import { chromium } from 'playwright';

async function testWarehouseFixed() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });

  console.log('Navigating to rentals for Warehouse...');
  await page.goto('http://localhost:3000/rentals?propertyType=WAREHOUSE', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const cardLocator = page.locator('text=E2E Consistency - Heavy Logistics Storage Warehouse');
  try {
    await cardLocator.first().waitFor({ state: 'visible', timeout: 10000 });
    console.log('SUCCESS! Warehouse property is visible on page!');
  } catch (err) {
    console.error('Failed to find warehouse property:', err);
  }

  await browser.close();
}

testWarehouseFixed().catch(console.error);
