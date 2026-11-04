import { chromium } from 'playwright';
import path from 'path';

const SCREENSHOT_DIR = 'C:/Users/zakar/.gemini/antigravity-ide/brain/5172a641-f264-4bd3-8354-6a5348d40477/browser_verification_screenshots';

async function testSearchFilter() {
  console.log('Testing live property search on http://localhost:3000/rent...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000/rent', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1000);

    const searchInput = page.locator('input[type="text"]').first();
    const isVisible = await searchInput.isVisible();
    console.log(`Search input is visible: ${isVisible}`);

    console.log('Typing query "Empire" into search bar...');
    await searchInput.fill('Empire');
    const typedVal = await searchInput.inputValue();
    console.log(`✓ Verified typed value in DOM: "${typedVal}"`);

    await page.waitForTimeout(1000);

    // Capture screenshot showing typed search
    const screenshotPath = path.join(SCREENSHOT_DIR, '10_live_search_typed_empire.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✓ Screenshot saved to: ${screenshotPath}`);

  } finally {
    await browser.close();
  }
}

testSearchFilter()
  .then(() => process.exit(0))
  .catch(console.error);
