import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const artifactDir = 'C:/Users/zakar/.gemini/antigravity-ide/brain/ac5dd336-573d-4138-b29c-30467160e6e2';
  const localDir = path.resolve(process.cwd(), 'screenshots');

  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  console.log('[SCREENSHOT] Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'en-US'
  });
  const page = await context.newPage();

  console.log('[SCREENSHOT] Navigating to http://localhost:3000/services...');
  await page.goto('http://localhost:3000/services', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });

  // Bounded wait for root container and main content
  console.log('[SCREENSHOT] Waiting for #root or body to render...');
  await page.waitForSelector('#root', { timeout: 10000 });

  // Allow a short moment for dynamic components and styles to settle
  await page.waitForTimeout(2000);

  const title = await page.title();
  const url = page.url();
  console.log(`[SCREENSHOT] Loaded Page Title: "${title}", URL: "${url}"`);

  const localPath = path.join(localDir, 'services_page.png');
  const artifactPath = path.join(artifactDir, 'services_page.png');
  const localFullPath = path.join(localDir, 'services_page_full.png');
  const artifactFullPath = path.join(artifactDir, 'services_page_full.png');

  // Standard viewport screenshot
  await page.screenshot({ path: localPath, fullPage: false });
  fs.copyFileSync(localPath, artifactPath);
  console.log(`[SCREENSHOT] Saved viewport screenshot: ${artifactPath}`);

  // Full page screenshot
  await page.screenshot({ path: localFullPath, fullPage: true });
  fs.copyFileSync(localFullPath, artifactFullPath);
  console.log(`[SCREENSHOT] Saved full page screenshot: ${artifactFullPath}`);

  await browser.close();
  console.log('[SCREENSHOT] Browser closed successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
  console.error('[SCREENSHOT] Error during screenshot capture:', err);
  process.exit(1);
});
