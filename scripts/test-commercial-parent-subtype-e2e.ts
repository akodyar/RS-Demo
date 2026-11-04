import { chromium, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import pg from 'pg';

const BASE_URL = 'http://localhost:3000';
const EVIDENCE_DIR = path.join(
  process.cwd(),
  'screenshots',
  'rental-property-search-deep-audit-2026-10-30',
  'targeted-e2e-verification'
);

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

const { Pool } = pg;
const dbPool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/homehub_test' });

async function setupPageAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('auth_token', 'dev-owner');
    window.localStorage.setItem('homehub_auth_token', 'dev-owner');
    window.localStorage.setItem('homehub_lang', 'en');
    window.localStorage.setItem(
      'homehub_auth_persona',
      JSON.stringify({
        id: 'user_owner_01',
        email: 'owner@homehub.iq',
        roles: ['PROPERTY_OWNER'],
        activeRole: 'PROPERTY_OWNER',
        name: 'Salar Aziz',
      })
    );
  });
}

async function advanceWizard(page: Page) {
  const nextBtn = page.locator('[data-testid="add-property-next-btn"]');
  await nextBtn.scrollIntoViewIfNeeded();
  await nextBtn.click({ timeout: 8000 });
  await page.waitForTimeout(300);
}

async function runCommercialTests() {
  console.log('========================================================================');
  console.log('  TASK 1: COMMERCIAL PARENT & SUBTYPE E2E VERIFICATION');
  console.log('========================================================================');

  // Verify target test DB
  const dbCheck = await dbPool.query('SELECT current_database() as db');
  const currentDb = dbCheck.rows[0].db;
  console.log(`[Safety Check] Database verified: ${currentDb}`);
  if (currentDb !== 'homehub_test') {
    throw new Error(`CRITICAL ABORT: Refusing to run tests against ${currentDb}. Expected homehub_test.`);
  }

  // 1. Clean previous test items with prefix 'E2E Comm -'
  await dbPool.query(`DELETE FROM listings WHERE title LIKE 'E2E Comm - %'`);
  await dbPool.query(`DELETE FROM verification_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Comm - %')`);
  await dbPool.query(`DELETE FROM documents WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Comm - %')`);
  await dbPool.query(`DELETE FROM ownership_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Comm - %')`);
  await dbPool.query(`DELETE FROM properties WHERE name LIKE 'E2E Comm - %'`);
  console.log('[Cleanup] Cleaned previous E2E commercial test records.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 }, locale: 'en-US' });
  await setupPageAuth(page);

  // 2. We will create properties through the Add Property Wizard:
  //    A. Generic Commercial (Step 0 button: property-type-commercial)
  //    B. Office Space (Step 0 button: property-type-office)
  //    C. Warehouse & Storage (Step 0 button: property-type-warehouse)
  //    D. House (Step 0 button: property-type-house)
  //    E. Pure Industrial Record (explained: Add Property Wizard Step 0 exposes "Warehouse & Storage"
  //       which sets type: 'Warehouse' with industrialUse: 'WAREHOUSE'. Pure canonical 'INDUSTRIAL'
  //       enum is ingested via /api/properties to test server-side taxonomy behavior).

  const testProperties = [
    {
      key: 'commercial',
      buttonTestId: 'property-type-commercial',
      name: 'E2E Comm - Prime Highway Commercial Showroom',
      price: 3200,
      expectedCanonical: 'COMMERCIAL',
      viaWizard: true,
    },
    {
      key: 'office',
      buttonTestId: 'property-type-office',
      name: 'E2E Comm - Modern Executive Office Suite',
      price: 1800,
      expectedCanonical: 'OFFICE',
      viaWizard: true,
    },
    {
      key: 'warehouse',
      buttonTestId: 'property-type-warehouse',
      name: 'E2E Comm - Central Logistics Distribution Warehouse',
      price: 2500,
      expectedCanonical: 'WAREHOUSE',
      viaWizard: true,
    },
    {
      key: 'house',
      buttonTestId: 'property-type-house',
      name: 'E2E Comm - Luxury Family Suburban House',
      price: 1600,
      expectedCanonical: 'HOUSE',
      viaWizard: true,
    },
    {
      key: 'industrial',
      buttonTestId: null,
      name: 'E2E Comm - Heavy Manufacturing Industrial Facility',
      price: 4500,
      expectedCanonical: 'INDUSTRIAL',
      viaWizard: false, // Ingested via API/taxonomy check
    }
  ];

  console.log('\n--- PHASE 1: PROPERTY CREATION & PERSISTENCE ---');
  for (const item of testProperties) {
    if (item.viaWizard) {
      console.log(`Creating via Wizard: "${item.name}" (Type: ${item.key})`);
      await page.goto(`${BASE_URL}/properties/add`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(`[data-testid="${item.buttonTestId}"]`, { timeout: 10000 });
      await page.click(`[data-testid="${item.buttonTestId}"]`);
      await advanceWizard(page); // to Step 1

      await page.waitForSelector('[data-testid="property-name"]', { timeout: 10000 });
      await page.fill('[data-testid="property-name"]', item.name);
      await page.fill('[data-testid="property-description"]', 'Quality commercial real estate testing unit.');
      await page.fill('[data-testid="property-price"]', String(item.price));
      await advanceWizard(page); // to Step 2

      await page.waitForTimeout(300);
      const streetInput = page.locator('input[placeholder*="street" i], input[data-testid="property-street"]').first();
      if (await streetInput.isVisible()) await streetInput.fill('Airport Road 100M');
      await advanceWizard(page); // to Step 3

      await page.waitForTimeout(300);
      await advanceWizard(page); // to Step 4 Amenities
      await page.waitForTimeout(300);
      await advanceWizard(page); // to Step 5 Photos
      await page.waitForTimeout(300);
      await advanceWizard(page); // to Step 6 Ownership
      await page.waitForTimeout(300);
      await advanceWizard(page); // to Step 7 Management
      await page.waitForTimeout(300);
      await advanceWizard(page); // to Step 8 Review

      await page.waitForSelector('[data-testid="add-property-submit-btn"]', { timeout: 10000 });
      await page.click('[data-testid="add-property-submit-btn"]');
      await page.waitForSelector('[data-testid="property-submitted-confirmation"]', { timeout: 15000 });
      console.log(`  -> Successfully created via Wizard and verified confirmation.`);
    } else {
      // Ingest canonical INDUSTRIAL directly via API to verify taxonomy alignment
      console.log(`Ingesting via API: "${item.name}" (Canonical Type: INDUSTRIAL)`);
      const res = await fetch(`${BASE_URL}/api/properties`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dev-owner'
        },
        body: JSON.stringify({
          name: item.name,
          type: 'INDUSTRIAL',
          address: { city: 'Erbil', street: 'Industrial Zone South' },
          currency: 'USD',
          listingType: 'FOR_RENT',
          price: item.price
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`API creation of INDUSTRIAL property failed: ${JSON.stringify(data)}`);
      console.log(`  -> Successfully created via API (ID: ${data.id})`);
    }

    // Verify DB record
    const [propRow] = (await dbPool.query(`SELECT id, name, type, status, verification_status FROM properties WHERE name = $1`, [item.name])).rows;
    if (!propRow) throw new Error(`DB verification failed: ${item.name} not found!`);
    console.log(`  -> DB Verified: Type="${propRow.type}", VerificationStatus="${propRow.verification_status}"`);

    // Verify and Publish listing so it is discoverable in marketplace search
    await dbPool.query(`UPDATE properties SET status = 'ACTIVE', verification_status = 'VERIFIED' WHERE id = $1`, [propRow.id]);
    await dbPool.query(`UPDATE ownership_records SET status = 'VERIFIED' WHERE property_id = $1`, [propRow.id]);
    const listingId = `comm-list-${item.key}-${Date.now()}`;
    await dbPool.query(
      `INSERT INTO listings (id, property_id, publisher_user_id, type, price, currency, status, title, description)
       VALUES ($1, $2, 'user_owner_01', 'FOR_RENT', $3, 'USD', 'PUBLISHED', $4, $5)`,
      [listingId, propRow.id, item.price, item.name, `Active test listing for ${item.expectedCanonical}`]
    );
    console.log(`  -> Published listing (${listingId}) for marketplace search.`);
  }

  console.log('\n--- PHASE 2: API SEARCH QUERY VERIFICATION ---');
  // We test 4 API queries against /api/marketplace/listings/search:
  // 1. propertyType=COMMERCIAL
  // 2. propertyType=OFFICE
  // 3. propertyType=WAREHOUSE
  // 4. propertyType=HOUSE

  async function searchApi(propertyType: string) {
    const res = await fetch(`${BASE_URL}/api/marketplace/listings/search?type=RENT&propertyType=${propertyType}&limit=100`);
    const data = await res.json();
    return (data.items || []).map((x: any) => ({
      title: x.title,
      type: x.property?.type
    }));
  }

  const commResults = await searchApi('COMMERCIAL');
  const officeResults = await searchApi('OFFICE');
  const warehouseResults = await searchApi('WAREHOUSE');
  const houseResults = await searchApi('HOUSE');

  const commTitles = commResults.map(r => r.title);
  const officeTitles = officeResults.map(r => r.title);
  const warehouseTitles = warehouseResults.map(r => r.title);
  const houseTitles = houseResults.map(r => r.title);

  console.log('\nAPI Check 1: Commercial Parent Aggregation');
  const commHasGeneric = commTitles.includes('E2E Comm - Prime Highway Commercial Showroom');
  const commHasOffice = commTitles.includes('E2E Comm - Modern Executive Office Suite');
  const commHasWarehouse = commTitles.includes('E2E Comm - Central Logistics Distribution Warehouse');
  const commHasIndustrial = commTitles.includes('E2E Comm - Heavy Manufacturing Industrial Facility');
  const commExcludesHouse = !commTitles.includes('E2E Comm - Luxury Family Suburban House');
  console.log(`  Generic Commercial appears: ${commHasGeneric}`);
  console.log(`  Office appears under parent: ${commHasOffice}`);
  console.log(`  Warehouse appears under parent: ${commHasWarehouse}`);
  console.log(`  Industrial appears under parent: ${commHasIndustrial}`);
  console.log(`  House excluded from Commercial: ${commExcludesHouse}`);

  console.log('\nAPI Check 2: Office Subtype Isolation');
  const officeHasOffice = officeTitles.includes('E2E Comm - Modern Executive Office Suite');
  const officeExcludesGeneric = !officeTitles.includes('E2E Comm - Prime Highway Commercial Showroom');
  const officeExcludesWarehouse = !officeTitles.includes('E2E Comm - Central Logistics Distribution Warehouse');
  const officeExcludesIndustrial = !officeTitles.includes('E2E Comm - Heavy Manufacturing Industrial Facility');
  const officeExcludesHouse = !officeTitles.includes('E2E Comm - Luxury Family Suburban House');
  console.log(`  Office appears: ${officeHasOffice}`);
  console.log(`  Generic Commercial excluded: ${officeExcludesGeneric}`);
  console.log(`  Warehouse excluded: ${officeExcludesWarehouse}`);
  console.log(`  Industrial excluded: ${officeExcludesIndustrial}`);
  console.log(`  House excluded: ${officeExcludesHouse}`);

  console.log('\nAPI Check 3: Warehouse & Storage Subtype Isolation');
  const warehouseHasWarehouse = warehouseTitles.includes('E2E Comm - Central Logistics Distribution Warehouse');
  const warehouseHasIndustrial = warehouseTitles.includes('E2E Comm - Heavy Manufacturing Industrial Facility');
  const warehouseExcludesGeneric = !warehouseTitles.includes('E2E Comm - Prime Highway Commercial Showroom');
  const warehouseExcludesOffice = !warehouseTitles.includes('E2E Comm - Modern Executive Office Suite');
  const warehouseExcludesHouse = !warehouseTitles.includes('E2E Comm - Luxury Family Suburban House');
  console.log(`  Warehouse appears: ${warehouseHasWarehouse}`);
  console.log(`  Industrial appears in Warehouse/Storage: ${warehouseHasIndustrial}`);
  console.log(`  Generic Commercial excluded: ${warehouseExcludesGeneric}`);
  console.log(`  Office excluded: ${warehouseExcludesOffice}`);
  console.log(`  House excluded: ${warehouseExcludesHouse}`);

  console.log('\nAPI Check 4: Houses Search & Substring Collision Guard');
  const houseHasHouse = houseTitles.includes('E2E Comm - Luxury Family Suburban House');
  const houseExcludesWarehouse = !houseTitles.includes('E2E Comm - Central Logistics Distribution Warehouse');
  const houseExcludesIndustrial = !houseTitles.includes('E2E Comm - Heavy Manufacturing Industrial Facility');
  const houseExcludesCommercial = !houseTitles.includes('E2E Comm - Prime Highway Commercial Showroom');
  console.log(`  House appears: ${houseHasHouse}`);
  console.log(`  Warehouse strictly excluded (no substring collision): ${houseExcludesWarehouse}`);
  console.log(`  Industrial excluded: ${houseExcludesIndustrial}`);
  console.log(`  Commercial excluded: ${houseExcludesCommercial}`);

  console.log('\n--- PHASE 3: LIVE BROWSER UI VERIFICATION & SCREENSHOTS ---');

  // Step 3A: Search Commercial Parent via Homepage Tab
  console.log('1. Testing Browser UI: Search Commercial Parent tab');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="search-tab-commercial"]', { timeout: 10000 });
  await page.click('[data-testid="search-tab-commercial"]');
  await page.waitForTimeout(300);
  await page.click('#search-submit-button');
  await page.waitForSelector('#search-explorer-input', { timeout: 15000 });
  await page.waitForTimeout(800);

  const uiCommHasGeneric = await page.locator('text=E2E Comm - Prime Highway Commercial Showroom').isVisible();
  const uiCommHasOffice = await page.locator('text=E2E Comm - Modern Executive Office Suite').isVisible();
  const uiCommHasWarehouse = await page.locator('text=E2E Comm - Central Logistics Distribution Warehouse').isVisible();
  const uiCommHasIndustrial = await page.locator('text=E2E Comm - Heavy Manufacturing Industrial Facility').isVisible();
  const uiCommExcludesHouse = !(await page.locator('text=E2E Comm - Luxury Family Suburban House').isVisible().catch(() => false));

  console.log(`   UI Commercial Tab: Generic=${uiCommHasGeneric}, Office=${uiCommHasOffice}, Warehouse=${uiCommHasWarehouse}, Industrial=${uiCommHasIndustrial}, ExcludesHouse=${uiCommExcludesHouse}`);
  const shotComm = 'comm-01-browser-commercial-parent.png';
  await page.screenshot({ path: path.join(EVIDENCE_DIR, shotComm) });
  console.log(`   Captured: ${shotComm}`);

  // Step 3B: Search Office Space via Homepage "More" Dropdown
  console.log('2. Testing Browser UI: Search Office Space subtype via More dropdown');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home-more-rental-types-btn"]', { timeout: 10000 });
  await page.click('[data-testid="home-more-rental-types-btn"]');
  await page.waitForSelector('[data-testid="other-rental-type-office"]', { timeout: 5000 });
  await page.click('[data-testid="other-rental-type-office"]');
  await page.waitForTimeout(300);
  await page.click('#search-submit-button');
  await page.waitForSelector('#search-explorer-input', { timeout: 15000 });
  await page.waitForTimeout(800);

  const uiOfficeHasOffice = await page.locator('text=E2E Comm - Modern Executive Office Suite').isVisible();
  const uiOfficeExcludesGeneric = !(await page.locator('text=E2E Comm - Prime Highway Commercial Showroom').isVisible().catch(() => false));
  const uiOfficeExcludesWarehouse = !(await page.locator('text=E2E Comm - Central Logistics Distribution Warehouse').isVisible().catch(() => false));
  const uiOfficeExcludesIndustrial = !(await page.locator('text=E2E Comm - Heavy Manufacturing Industrial Facility').isVisible().catch(() => false));
  const uiOfficeExcludesHouse = !(await page.locator('text=E2E Comm - Luxury Family Suburban House').isVisible().catch(() => false));

  console.log(`   UI Office Subtype: Office=${uiOfficeHasOffice}, ExcludesGeneric=${uiOfficeExcludesGeneric}, ExcludesWarehouse=${uiOfficeExcludesWarehouse}, ExcludesIndustrial=${uiOfficeExcludesIndustrial}, ExcludesHouse=${uiOfficeExcludesHouse}`);
  const shotOffice = 'comm-02-browser-office-subtype.png';
  await page.screenshot({ path: path.join(EVIDENCE_DIR, shotOffice) });
  console.log(`   Captured: ${shotOffice}`);

  // Step 3C: Search Warehouse & Storage via Homepage "More" Dropdown
  console.log('3. Testing Browser UI: Search Warehouse & Storage subtype via More dropdown');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="home-more-rental-types-btn"]', { timeout: 10000 });
  await page.click('[data-testid="home-more-rental-types-btn"]');
  await page.waitForSelector('[data-testid="other-rental-type-warehouse"]', { timeout: 5000 });
  await page.click('[data-testid="other-rental-type-warehouse"]');
  await page.waitForTimeout(300);
  await page.click('#search-submit-button');
  await page.waitForSelector('#search-explorer-input', { timeout: 15000 });
  await page.waitForTimeout(800);

  const uiWhHasWarehouse = await page.locator('text=E2E Comm - Central Logistics Distribution Warehouse').isVisible();
  const uiWhHasIndustrial = await page.locator('text=E2E Comm - Heavy Manufacturing Industrial Facility').isVisible();
  const uiWhExcludesGeneric = !(await page.locator('text=E2E Comm - Prime Highway Commercial Showroom').isVisible().catch(() => false));
  const uiWhExcludesOffice = !(await page.locator('text=E2E Comm - Modern Executive Office Suite').isVisible().catch(() => false));
  const uiWhExcludesHouse = !(await page.locator('text=E2E Comm - Luxury Family Suburban House').isVisible().catch(() => false));

  console.log(`   UI Warehouse Subtype: Warehouse=${uiWhHasWarehouse}, Industrial=${uiWhHasIndustrial}, ExcludesGeneric=${uiWhExcludesGeneric}, ExcludesOffice=${uiWhExcludesOffice}, ExcludesHouse=${uiWhExcludesHouse}`);
  const shotWarehouse = 'comm-03-browser-warehouse-subtype.png';
  await page.screenshot({ path: path.join(EVIDENCE_DIR, shotWarehouse) });
  console.log(`   Captured: ${shotWarehouse}`);

  // Step 3D: Search Houses via Homepage Houses Tab
  console.log('4. Testing Browser UI: Search Houses tab (validating substring exclusion of Warehouse)');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="search-tab-houses"]', { timeout: 10000 });
  await page.click('[data-testid="search-tab-houses"]');
  await page.waitForTimeout(300);
  await page.click('#search-submit-button');
  await page.waitForSelector('#search-explorer-input', { timeout: 15000 });
  await page.waitForTimeout(800);

  const uiHouseHasHouse = await page.locator('text=E2E Comm - Luxury Family Suburban House').isVisible();
  const uiHouseExcludesWarehouse = !(await page.locator('text=E2E Comm - Central Logistics Distribution Warehouse').isVisible().catch(() => false));
  const uiHouseExcludesIndustrial = !(await page.locator('text=E2E Comm - Heavy Manufacturing Industrial Facility').isVisible().catch(() => false));
  const uiHouseExcludesCommercial = !(await page.locator('text=E2E Comm - Prime Highway Commercial Showroom').isVisible().catch(() => false));

  console.log(`   UI Houses Tab: House=${uiHouseHasHouse}, ExcludesWarehouse=${uiHouseExcludesWarehouse}, ExcludesIndustrial=${uiHouseExcludesIndustrial}, ExcludesCommercial=${uiHouseExcludesCommercial}`);
  const shotHouse = 'comm-04-browser-houses-search.png';
  await page.screenshot({ path: path.join(EVIDENCE_DIR, shotHouse) });
  console.log(`   Captured: ${shotHouse}`);

  // Cleanup browser
  await browser.close();

  // Teardown database fixtures
  await dbPool.query(`DELETE FROM listings WHERE title LIKE 'E2E Comm - %'`);
  await dbPool.query(`DELETE FROM verification_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Comm - %')`);
  await dbPool.query(`DELETE FROM documents WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Comm - %')`);
  await dbPool.query(`DELETE FROM ownership_records WHERE property_id IN (SELECT id FROM properties WHERE name LIKE 'E2E Comm - %')`);
  await dbPool.query(`DELETE FROM properties WHERE name LIKE 'E2E Comm - %'`);
  await dbPool.end();
  console.log('[Cleanup] Test fixtures cleanly deleted.');

  // Final assertions check
  const allApiPassed = (
    commHasGeneric && commHasOffice && commHasWarehouse && commHasIndustrial && commExcludesHouse &&
    officeHasOffice && officeExcludesGeneric && officeExcludesWarehouse && officeExcludesIndustrial && officeExcludesHouse &&
    warehouseHasWarehouse && warehouseHasIndustrial && warehouseExcludesGeneric && warehouseExcludesOffice && warehouseExcludesHouse &&
    houseHasHouse && houseExcludesWarehouse && houseExcludesIndustrial && houseExcludesCommercial
  );

  const allUiPassed = (
    uiCommHasGeneric && uiCommHasOffice && uiCommHasWarehouse && uiCommHasIndustrial && uiCommExcludesHouse &&
    uiOfficeHasOffice && uiOfficeExcludesGeneric && uiOfficeExcludesWarehouse && uiOfficeExcludesIndustrial && uiOfficeExcludesHouse &&
    uiWhHasWarehouse && uiWhHasIndustrial && uiWhExcludesGeneric && uiWhExcludesOffice && uiWhExcludesHouse &&
    uiHouseHasHouse && uiHouseExcludesWarehouse && uiHouseExcludesIndustrial && uiHouseExcludesCommercial
  );

  console.log('\n========================================================================');
  console.log(`TASK 1 SUMMARY: API Check -> ${allApiPassed ? 'PASS' : 'FAIL'} | Browser UI -> ${allUiPassed ? 'PASS' : 'FAIL'}`);
  console.log('========================================================================');

  if (!allApiPassed || !allUiPassed) {
    throw new Error('Task 1 Commercial Verification FAILED assertions!');
  }
}

runCommercialTests().catch(err => {
  console.error('Task 1 encountered error:', err);
  process.exit(1);
});

