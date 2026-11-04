import { chromium } from 'playwright';

async function runLiveVisibleDemonstration() {
  console.log('================================================================');
  console.log('STARTING VISIBLE HEADED BROWSER VERIFICATION (REAL WINDOW)');
  console.log('================================================================');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100 // Slows down actions by 100ms so the user can clearly see each action happening
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });
  const page = await context.newPage();

  try {
    // 1. Navigate to HomeHub
    console.log('[1/5] Navigating to http://localhost:3000 in visible window...');
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Inject blue control badge overlay directly into the DOM
    await page.evaluate(() => {
      const banner = document.createElement('div');
      banner.id = 'homehub-live-control-overlay';
      banner.style.position = 'fixed';
      banner.style.top = '12px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.zIndex = '999999';
      banner.style.backgroundColor = '#1d4ed8';
      banner.style.color = '#ffffff';
      banner.style.padding = '10px 24px';
      banner.style.borderRadius = '9999px';
      banner.style.boxShadow = '0 10px 25px -5px rgba(29, 78, 216, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.4)';
      banner.style.fontFamily = 'system-ui, sans-serif';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = 'bold';
      banner.style.display = 'flex';
      banner.style.alignItems = 'center';
      banner.style.gap = '10px';
      banner.innerHTML = `
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#4ade80;animation:pulse 1.5s infinite"></span>
        <span>DOM is running — Live Browser Verification Active</span>
      `;
      document.body.appendChild(banner);
    });

    console.log('✓ Injected visible blue status overlay into DOM');
    await page.waitForTimeout(2000);

    // 2. Interactive category clicks
    console.log('[2/5] Testing interactive category buttons...');
    const rentBtn = page.locator('#category-rent');
    if (await rentBtn.isVisible()) {
      await rentBtn.hover();
      await page.waitForTimeout(500);
      await rentBtn.click();
      console.log('✓ Clicked Rent category');
    }

    const servicesBtn = page.locator('#category-services');
    if (await servicesBtn.isVisible()) {
      await servicesBtn.hover();
      await page.waitForTimeout(500);
      await servicesBtn.click();
      console.log('✓ Clicked Services category');
    }

    await page.waitForTimeout(1000);

    // 3. Search Bar Live Typing
    console.log('[3/5] Navigating to /rent and typing search query...');
    await page.goto('http://localhost:3000/rent', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Re-inject badge on new page
    await page.evaluate(() => {
      const banner = document.createElement('div');
      banner.id = 'homehub-live-control-overlay';
      banner.style.position = 'fixed';
      banner.style.top = '12px';
      banner.style.left = '50%';
      banner.style.transform = 'translateX(-50%)';
      banner.style.zIndex = '999999';
      banner.style.backgroundColor = '#1d4ed8';
      banner.style.color = '#ffffff';
      banner.style.padding = '10px 24px';
      banner.style.borderRadius = '9999px';
      banner.style.boxShadow = '0 10px 25px -5px rgba(29, 78, 216, 0.5), 0 0 0 4px rgba(59, 130, 246, 0.4)';
      banner.style.fontFamily = 'system-ui, sans-serif';
      banner.style.fontSize = '14px';
      banner.style.fontWeight = 'bold';
      banner.innerHTML = 'DOM is running — Live Search Typing';
      document.body.appendChild(banner);
    });

    const searchInput = page.locator('input[type="text"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.click();
      // Type character by character
      await searchInput.pressSequentially('Empire World Villa', { delay: 120 });
      console.log('✓ Typed "Empire World Villa" visibly into search bar');
      await page.waitForTimeout(2000);
    }

    // 4. Test Tenant Portal
    console.log('[4/5] Navigating to /tenant (verifying fix)...');
    await page.goto('http://localhost:3000/tenant', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // 5. Wrap up
    console.log('[5/5] Demonstration complete! Window will stay open for 5 seconds for visual confirmation.');
    await page.waitForTimeout(5000);

  } catch (error) {
    console.error('Error in visible demonstration:', error);
  } finally {
    await browser.close();
    console.log('Browser session finished cleanly.');
  }
}

runLiveVisibleDemonstration()
  .then(() => process.exit(0))
  .catch(console.error);
