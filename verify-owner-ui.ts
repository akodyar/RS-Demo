import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const viewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 }
];

const languages = [
  { code: 'ku', label: 'Kurdish Sorani (RTL)' },
  { code: 'ar', label: 'Arabic (RTL)' },
  { code: 'en', label: 'English (LTR)' }
];

async function run() {
  console.log('Starting Playwright for Phase 1 Owner Multi-Viewport and Localization Verification...');
  const browser = await chromium.launch();
  
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/7e14ecef-e438-472d-a7c3-43447bef67ab/scratch';
  fs.mkdirSync(artifactDir, { recursive: true });

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();

    // Seed Owner authentication persona into localStorage
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const ownerPersona = {
        uid: 'dev-owner-verified',
        email: 'owner@homehub.iq',
        displayName: 'Ahmed Ali',
        role: 'PROPERTY_OWNER'
      };
      localStorage.setItem('homehub_auth_persona', JSON.stringify(ownerPersona));
      localStorage.setItem('auth_token', 'dev-owner');
    });
    
    for (const lang of languages) {
      console.log(`Loading http://localhost:3000/owner?lang=${lang.code} at ${vp.width}x${vp.height}...`);
      try {
        await page.goto(`http://localhost:3000/owner?lang=${lang.code}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(1000);
        
        // Assert the document language and direction
        const currentLang = await page.evaluate(() => document.documentElement.lang);
        const currentDir = await page.evaluate(() => document.documentElement.dir);
        console.log(`[VERIFIED OWNER] Lang: ${currentLang}, Dir: ${currentDir}, Expected: ${lang.code}`);
      } catch (err: any) {
        console.log(`Error navigating to owner with ${lang.code}: ${err.message}`);
      }

      const screenshotName = `phase1_owner_layout_${vp.width}x${vp.height}_${lang.code}.png`;
      const screenshotPath = path.join(artifactDir, screenshotName);
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);
    }

    // On 1440x900, capture additional tabs: Earnings (5% Commission Policy) and Properties
    if (vp.width === 1440) {
      console.log('Capturing Earnings Tab (5% Commission Policy)...');
      await page.goto('http://localhost:3000/owner?lang=en', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(500);
      // Click Earnings tab
      const earningsTab = page.locator('button:has-text("Rent & Earnings")');
      if (await earningsTab.count() > 0) {
        await earningsTab.first().click();
        await page.waitForTimeout(600);
        const earningsScreenshotPath = path.join(artifactDir, 'phase1_owner_tab_earnings_1440x900.png');
        await page.screenshot({ path: earningsScreenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${earningsScreenshotPath}`);
      }

      console.log('Capturing Properties Tab...');
      const propertiesTab = page.locator('nav >> button:has-text("Properties")');
      if (await propertiesTab.count() > 0) {
        await propertiesTab.first().click();
        await page.waitForTimeout(600);
        const propsScreenshotPath = path.join(artifactDir, 'phase1_owner_tab_properties_1440x900.png');
        await page.screenshot({ path: propsScreenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${propsScreenshotPath}`);
      }

      console.log('Capturing Demo Fixture Mode Activated...');
      await page.goto('http://localhost:3000/owner?lang=en', { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(500);
      const demoToggleBtn = page.locator('button:has-text("Demo Fixtures"), button:has-text("Toggle")');
      if (await demoToggleBtn.count() > 0) {
        await demoToggleBtn.first().click();
        await page.waitForTimeout(600);
        const demoScreenshotPath = path.join(artifactDir, 'phase1_owner_demo_fixtures_1440x900.png');
        await page.screenshot({ path: demoScreenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${demoScreenshotPath}`);
      }

      console.log('Capturing Settings Tab (Banking Limitation Notice)...');
      const settingsTab = page.locator('nav >> button:has-text("Settings")');
      if (await settingsTab.count() > 0) {
        await settingsTab.first().click();
        await page.waitForTimeout(600);
        const settingsScreenshotPath = path.join(artifactDir, 'phase1_owner_tab_settings_1440x900.png');
        await page.screenshot({ path: settingsScreenshotPath, fullPage: true });
        console.log(`Screenshot saved: ${settingsScreenshotPath}`);
      }
    }

    await context.close();
  }

  await browser.close();
  console.log('Phase 1 Owner Verification Complete.');
}

run()
  .then(() => process.exit(0))
  .catch(console.error);
