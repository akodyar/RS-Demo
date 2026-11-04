import { chromium } from 'playwright';

async function testHomepage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'ku',
  });
  const page = await context.newPage();

  const consoleLogs: string[] = [];
  const networkErrors: string[] = [];

  page.on('console', msg => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => consoleLogs.push(`[PAGE_ERROR] ${err.message}`));
  page.on('response', res => {
    if (res.status() >= 400) {
      networkErrors.push(`[${res.status()}] ${res.url()}`);
    }
  });

  console.log('Navigating to http://localhost:3000/...');
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  console.log('Console logs (first 10):', consoleLogs.slice(0, 10));
  console.log('Network errors:', networkErrors);

  await page.screenshot({ path: 'scratch/live_homepage_check.png', fullPage: true });
  console.log('Screenshot saved to scratch/live_homepage_check.png');

  // Check if error alerts are present
  const sponsoredError = await page.$('text="بارکردنی موڵکە سپۆنسەرکراوەکان سەرکەوتوو نەبوو"');
  const newestError = await page.$('text="بارکردنی نوێترین موڵکەکانی کرێ سەرکەوتوو نەبوو"');
  console.log('Sponsored error visible:', !!sponsoredError);
  console.log('Newest error visible:', !!newestError);

  await browser.close();
}

testHomepage().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
