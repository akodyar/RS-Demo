const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const consoleMessages = [];
  page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
  
  const failedRequests = [];
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure() }));

  const responseErrors = [];
  page.on('response', res => {
    if (res.status() >= 400) {
      responseErrors.push({ url: res.url(), status: res.status() });
    }
  });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: 'screenshots/debug_homepage.png', fullPage: true });
  console.log('Console messages:', JSON.stringify(consoleMessages, null, 2));
  console.log('Failed requests:', JSON.stringify(failedRequests, null, 2));
  console.log('Response errors (>=400):', JSON.stringify(responseErrors, null, 2));
  
  const sponsoredSection = await page.$('[data-testid="sponsored-properties-section"]');
  console.log('Sponsored section HTML length:', sponsoredSection ? (await sponsoredSection.innerHTML()).length : 0);
  
  const hasErrorCard = await page.$('.border-rose-500\\/20');
  console.log('Has error card on page:', !!hasErrorCard);
  
  await browser.close();
}

test().catch(console.error);
