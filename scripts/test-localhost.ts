import { chromium } from 'playwright';

async function testLocalhost() {
  console.log('Launching browser to test http://localhost:3000...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  console.log('Navigating to http://localhost:3000...');
  const res = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('Page response status:', res?.status());
  
  await page.waitForTimeout(3000);
  const title = await page.title();
  console.log('Page Title:', title);

  const screenshotPath = 'screenshots/localhost_test.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Saved screenshot to ${screenshotPath}`);

  await browser.close();
  console.log('Browser test finished successfully.');
}

testLocalhost()
  .then(() => process.exit(0))
  .catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
