import 'dotenv/config';
import { pool } from '../src/db/index.js';
import { chromium, Browser, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), 'screenshots/homepage-sections-verification');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode !== undefined);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port: number, timeoutMs = 25000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkPort(port)) return;
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(`Server failed to start on port ${port} within ${timeoutMs}ms`);
}

async function runVerification() {
  console.log('=== Step 1: Testing Backend Endpoints for Homepage Sections ===\n');

  // 1. Sponsored Placement Endpoint
  const sponsoredRes = await fetch('http://localhost:3000/api/promotions/placements/HOMEPAGE?limit=10').catch(() => null);
  let serverProcess: ChildProcess | null = null;

  if (!sponsoredRes || !sponsoredRes.ok) {
    console.log('[Setup] Starting development server on port 3000...');
    serverProcess = spawn('npx', ['tsx', 'server.ts'], {
      shell: true,
      env: { ...process.env, PORT: '3000' },
      stdio: 'pipe',
    });
    await waitForServer(3000);
    console.log('[Setup] Server running on port 3000.');
  }

  // Verify /api/promotions/placements/HOMEPAGE
  const spRes = await fetch('http://localhost:3000/api/promotions/placements/HOMEPAGE?limit=10');
  if (!spRes.ok) throw new Error(`Sponsored endpoint returned status ${spRes.status}`);
  const spData = await spRes.json();
  console.log(`[API] /api/promotions/placements/HOMEPAGE count: ${spData.items?.length || 0}`);
  if (!spData.items || spData.items.length < 10) {
    throw new Error(`Expected at least 10 sponsored items, got ${spData.items?.length}`);
  }

  // Verify /api/marketplace/listings/search?type=RENT&status=PUBLISHED&limit=10
  const nrRes = await fetch('http://localhost:3000/api/marketplace/listings/search?type=RENT&status=PUBLISHED&limit=10&sortBy=createdAt&sortOrder=desc');
  if (!nrRes.ok) throw new Error(`Newest rentals endpoint returned status ${nrRes.status}`);
  const nrData = await nrRes.json();
  console.log(`[API] /api/marketplace/listings/search (All) count: ${nrData.items?.length || 0}`);
  if (!nrData.items || nrData.items.length < 10) {
    throw new Error(`Expected at least 10 newest rental items, got ${nrData.items?.length}`);
  }

  // Verify per-category counts in newest rentals
  const categories = ['APARTMENT', 'HOUSE', 'VILLA', 'COMMERCIAL', 'STUDIO', 'OFFICE', 'WAREHOUSE', 'DUPLEX', 'RESIDENTIAL'];
  for (const cat of categories) {
    const catRes = await fetch(`http://localhost:3000/api/marketplace/listings/search?type=RENT&status=PUBLISHED&limit=10&sortBy=createdAt&sortOrder=desc&propertyType=${cat}`);
    const catData = await catRes.json();
    console.log(`[API] Newest rentals for category ${cat}: ${catData.items?.length || 0} items`);
    if (!catData.items || catData.items.length < 10) {
      throw new Error(`Expected 10 items for category ${cat}, got ${catData.items?.length}`);
    }
  }

  console.log('\n=== Step 2: Testing Live Browser UI for Homepage Sections ===\n');

  const browser: Browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'en',
  });
  const page: Page = await context.newPage();

  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000); // Allow react hydration

    // 1. Verify Sponsored Properties Section
    const sponsoredSection = page.getByTestId('sponsored-properties-section');
    await sponsoredSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const sponsoredCards = sponsoredSection.locator('[data-testid^="sponsored-card-"]');
    const sponsoredCount = await sponsoredCards.count();
    console.log(`[Browser UI] Visible Sponsored Cards on Homepage: ${sponsoredCount}`);

    const pills = sponsoredSection.getByTestId('sponsored-pill');
    const pillCount = await pills.count();
    console.log(`[Browser UI] Visible SPONSORED Badges: ${pillCount}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-homepage-sponsored-10-cards.png'),
      fullPage: false,
    });

    if (sponsoredCount < 10) {
      throw new Error(`Expected 10 sponsored cards visible, but found ${sponsoredCount}`);
    }

    // 2. Verify Newest Rentals Section
    const newestSection = page.getByTestId('newest-rentals-section');
    await newestSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    const rentalCards = newestSection.locator('[data-testid^="rental-card-"]');
    const rentalCount = await rentalCards.count();
    console.log(`[Browser UI] Visible Newest Rental Cards on Homepage: ${rentalCount}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-homepage-newest-rentals-10-cards.png'),
      fullPage: false,
    });

    if (rentalCount < 10) {
      throw new Error(`Expected 10 newest rental cards visible, but found ${rentalCount}`);
    }

    // 3. Test Filter Dropdown for categories on Homepage
    const categoryDropdown = page.locator('#search-property-type-select');
    if (await categoryDropdown.isVisible()) {
      console.log('[Browser UI] Testing Property Type reactive filtering in Newest Rentals...');
      
      // Select Studio
      await categoryDropdown.selectOption('STUDIO');
      await page.waitForTimeout(1500);
      const studioCount = await newestSection.locator('[data-testid^="rental-card-"]').count();
      console.log(`[Browser UI] Newest Rentals filtered by STUDIO: ${studioCount} cards`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '03-homepage-newest-studio-10-cards.png'),
        fullPage: false,
      });

      // Select Villas
      await categoryDropdown.selectOption('VILLA');
      await page.waitForTimeout(1500);
      const villaCount = await newestSection.locator('[data-testid^="rental-card-"]').count();
      console.log(`[Browser UI] Newest Rentals filtered by VILLA: ${villaCount} cards`);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04-homepage-newest-villa-10-cards.png'),
        fullPage: false,
      });
    }

    console.log('\n[SUCCESS] Homepage Sponsored Properties (10 cards) & Newest Rentals (10 cards) fully verified!');
  } finally {
    await browser.close();
    if (serverProcess) {
      console.log('[Teardown] Stopping local server process...');
      serverProcess.kill('SIGTERM');
      serverProcess.kill('SIGKILL');
    }
    await pool.end();
  }
}

runVerification().catch((err) => {
  console.error('[Verification Failed]:', err);
  process.exit(1);
});

