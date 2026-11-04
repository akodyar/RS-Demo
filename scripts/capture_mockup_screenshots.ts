import { chromium } from 'playwright';
import path from 'path';

async function captureMockups() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2 // High-DPI for super crisp images
  });
  const page = await context.newPage();

  const htmlPath = 'file:///' + path.resolve('C:/Users/zakar/.gemini/antigravity/brain/46e58428-0760-4215-9bed-a78ce6b19522/navbar_redesign_mockups.html').replace(/\\/g, '/');
  console.log('Navigating to:', htmlPath);

  await page.goto(htmlPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000); // Wait for fonts and styling

  const outDir = 'C:/Users/zakar/.gemini/antigravity/brain/46e58428-0760-4215-9bed-a78ce6b19522';

  // 1. Screenshot Option 1 container
  const opt1 = await page.$('#mockup-view-1');
  if (opt1) {
    await opt1.screenshot({ path: path.join(outDir, 'mockup_option1_pill.png') });
    console.log('Saved mockup_option1_pill.png');
  }

  // 1b. Hover on Finance dropdown to capture flyout menu
  const financeBtn = await page.$('#mockup-view-1 .group');
  if (financeBtn) {
    await financeBtn.hover();
    await page.waitForTimeout(300);
    await opt1.screenshot({ path: path.join(outDir, 'mockup_option1_dropdown.png') });
    console.log('Saved mockup_option1_dropdown.png');
  }

  // 2. Screenshot Option 2 container
  const opt2 = await page.$('#mockup-view-2');
  if (opt2) {
    await opt2.screenshot({ path: path.join(outDir, 'mockup_option2_dualtier.png') });
    console.log('Saved mockup_option2_dualtier.png');
  }

  // 3. Screenshot Option 3 container
  const opt3 = await page.$('#mockup-view-3');
  if (opt3) {
    await opt3.screenshot({ path: path.join(outDir, 'mockup_option3_rail.png') });
    console.log('Saved mockup_option3_rail.png');
  }

  // 4. Screenshot Option 4 container
  const opt4 = await page.$('#mockup-view-4');
  if (opt4) {
    await opt4.screenshot({ path: path.join(outDir, 'mockup_option4_island.png') });
    console.log('Saved mockup_option4_island.png');
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

captureMockups().catch(err => {
  console.error('Failed to capture mockups:', err);
  process.exit(1);
});

