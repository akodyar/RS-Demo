const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const pageErrors = [];
  page.on('console', msg => console.log('PAGE CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  const textContent = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="sponsored-properties-section"]');
    const r = document.querySelector('section:has([data-testid^="rental-card-"])') || document.querySelectorAll('section')[4];
    return {
      sponsored: s ? s.innerText : 'NO SPONSORED SECTION',
      fullBody: document.body.innerText.slice(0, 1000)
    };
  });
  
  console.log('SPONSORED SECTION TEXT:', textContent.sponsored);
  await browser.close();
}
test().catch(console.error);
