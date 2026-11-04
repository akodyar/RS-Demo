const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  const html = await page.$eval('[data-testid="sponsored-properties-section"]', el => el.outerHTML);
  console.log('SPONSORED SECTION FULL HTML:\n', html);
  await browser.close();
}
test().catch(console.error);
