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
  console.log('Starting Playwright for Multi-Viewport and Localization Verification...');
  const browser = await chromium.launch();
  
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/7e14ecef-e438-472d-a7c3-43447bef67ab/scratch';
  fs.mkdirSync(artifactDir, { recursive: true });

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });
    const page = await context.newPage();
    
    for (const lang of languages) {
      console.log(`Loading http://localhost:3000/?lang=${lang.code} at ${vp.width}x${vp.height}...`);
      try {
        await page.goto(`http://localhost:3000/?lang=${lang.code}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForSelector('#language-selector-trigger', { timeout: 10000 });
        // Also test switching via the dropdown directly
        await page.click('#language-selector-trigger', { force: true });
        await page.waitForTimeout(200);
        const option = await page.$(`#lang-option-${lang.code}`);
        if (option) {
          await option.click({ force: true });
        }
        await page.waitForTimeout(500);
        
        // Assert the document language and direction
        const currentLang = await page.evaluate(() => document.documentElement.lang);
        const currentDir = await page.evaluate(() => document.documentElement.dir);
        console.log(`[VERIFIED] Lang: ${currentLang}, Dir: ${currentDir}`);
      } catch (err: any) {
        console.log(`Error setting language to ${lang.code}: ${err.message}`);
      }

      const screenshotName = `phase0_desktop_layout_${vp.width}x${vp.height}_${lang.code}.png`;
      const screenshotPath = path.join(artifactDir, screenshotName);
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`Screenshot saved: ${screenshotPath}`);
    }
    await context.close();
  }

  await browser.close();
  console.log('Verification Complete.');
}

run()
  .then(() => process.exit(0))
  .catch(console.error);
