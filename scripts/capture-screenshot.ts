/**
 * Reusable Option C Playwright Screenshot Utility for HomeHub
 * Usage: npx tsx scripts/capture-screenshot.ts [route] [outputName]
 * Example: npx tsx scripts/capture-screenshot.ts /login login-preview.png
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';
import { closePool } from '../src/db/index.js';

const targetRoute = process.argv[2] || '/login';
const outputFilename = process.argv[3] || 'screenshot.png';

const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots');

async function capture() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const app = await createApp();
  const server = http.createServer(app);
  const port = 3010;

  await new Promise<void>((resolve) => server.listen(port, resolve));
  const baseUrl = `http://localhost:${port}`;
  console.log(`[Option C] Server active at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  try {
    const fullUrl = `${baseUrl}${targetRoute.startsWith('/') ? targetRoute : '/' + targetRoute}`;
    console.log(`[Option C] Navigating to ${fullUrl}...`);
    
    // Initial Vite compile warmup handled with bounded 45s timeout
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForSelector('body', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const outPath = path.join(SCREENSHOT_DIR, outputFilename);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`[Option C] Screenshot captured successfully: ${outPath}`);
  } finally {
    await browser.close();
    server.close();
    await closePool();
  }
}

capture()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[Option C] Capture failed:', err);
    process.exit(1);
  });
