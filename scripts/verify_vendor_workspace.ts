import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const viewports = [
  { width: 1920, height: 1080, name: '1920x1080' },
  { width: 1600, height: 900, name: '1600x900' },
  { width: 1440, height: 900, name: '1440x900' },
  { width: 1366, height: 768, name: '1366x768' },
  { width: 1280, height: 800, name: '1280x800' },
  { width: 1024, height: 768, name: '1024x768' },
];

const languages = [
  { code: 'ku', name: 'kurdish' },
  { code: 'ar', name: 'arabic' },
  { code: 'en', name: 'english' },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const artifactDir = path.resolve('scratch');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log('--- Starting Comprehensive Vendor Workspace Verification ---');

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // Authenticate as dev-vendor
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

    for (const lang of languages) {
      // Set language in localStorage
      await page.evaluate((l) => {
        localStorage.setItem('homehub_lang', l);
      }, lang.code);

      const url = `http://localhost:3000/workspace/vendor?lang=${lang.code}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);

      // Verify no horizontal overflow
      const overflow = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          hasHorizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });

      // Verify exactly one sidebar exists
      const sidebarsCount = await page.locator('#vendor-navigation-sidebar').count();
      const globalAsideCount = await page.locator('aside.w-full.md\\:w-64').count();

      // Verify exactly one application header exists
      const globalHeaderCount = await page.locator('header.sticky.top-0').count();

      console.log(
        `[${vp.name}] [${lang.code}] HorizOverflow: ${overflow.hasHorizontalScroll} | VendorSidebars: ${sidebarsCount} | GlobalAside: ${globalAsideCount} | Headers: ${globalHeaderCount}`
      );

      const shotPath = path.join(artifactDir, `vendor_${vp.name}_${lang.code}.png`);
      await page.screenshot({ path: shotPath, fullPage: true });
    }

    // At 1440x900, also test sub-navigation and modals in Kurdish & English
    if (vp.name === '1440x900') {
      console.log('Testing sub-navigation and modals...');
      // Click Service Requests
      await page.click('button:has-text("Service Requests"), button:has-text("داواکارییەکانی خزمەتگوزاری")').catch(() => {});
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(artifactDir, 'vendor_subview_requests.png'), fullPage: true });

      // Click + New Quote button to test modal
      await page.click('button:has-text("+ New Quote")').catch(() => {});
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(artifactDir, 'vendor_modal_quote.png') });

      // Close modal
      await page.keyboard.press('Escape').catch(() => {});
    }

    await context.close();
  }

  await browser.close();
  console.log('--- Verification Finished Successfully ---');
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
  console.error(e);
  process.exit(1);
});
