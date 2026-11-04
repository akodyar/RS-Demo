import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { closePool } from '../src/db/index.js';

const ARTIFACT_DIR = 'C:\\Users\\zakar\\.gemini\\antigravity-ide\\brain\\885f5a39-23d2-4761-9d37-8b94a82a12dd';
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

async function testTakeScreenshot() {
  console.log('--- Option C: Project-Local Playwright Test Screenshot ---');

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const app = await createApp();
  const server = http.createServer(app);
  const port = 3008;

  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}`;
  console.log(`Server started at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  try {
    console.log(`Navigating to ${baseUrl}/login ...`);
    // Vite initial module compilation on Windows can take ~15-20s on first request
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('Navigation successful, waiting for body or login element...');
    await page.waitForSelector('body', { timeout: 15000 });
    // Brief pause to allow React hydration/rendering
    await page.waitForTimeout(1000);

    const localShotPath = path.join(SCREENSHOT_DIR, 'test_playwright_shot.png');
    const artifactShotPath = path.join(ARTIFACT_DIR, 'test_playwright_shot.png');

    await page.screenshot({ path: localShotPath, fullPage: true });
    console.log(`Saved screenshot locally: ${localShotPath}`);

    // Copy to artifact directory so it can be rendered/displayed
    fs.copyFileSync(localShotPath, artifactShotPath);
    console.log(`Saved screenshot to artifact directory: ${artifactShotPath}`);

    console.log('Screenshot capture completed successfully!');
  } finally {
    await browser.close();
    server.close();
    await closePool();
  }
}

testTakeScreenshot()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Screenshot test failed:', err);
    process.exit(1);
  });
