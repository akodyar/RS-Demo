import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem(
      'homehub_auth_persona',
      JSON.stringify({
        uid: 'dev-vendor-123',
        email: 'vendor@homehub.iq',
        displayName: 'Omar Hassan',
        role: 'VENDOR',
      })
    );
  });
  
  await page.goto('http://localhost:3000/workspace/vendor?lang=en', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(1000);
  
  const docWidth = await page.evaluate(() => document.documentElement.clientWidth);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(`1024px Viewport -> clientWidth: ${docWidth}, scrollWidth: ${scrollWidth}`);
  
  const badElements = await page.evaluate((w) => {
    const list: any[] = [];
    document.querySelectorAll('*').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.right > w + 1) {
        list.push({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          right: rect.right,
          width: rect.width,
        });
      }
    });
    return list;
  }, docWidth);
  
  console.log('Bad elements:', JSON.stringify(badElements, null, 2));
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
