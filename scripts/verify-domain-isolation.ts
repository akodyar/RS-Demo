import { chromium } from '@playwright/test';

async function main() {
  console.log('🚀 Starting Marketplace Domain Isolation Verification...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000/marketplace', { waitUntil: 'domcontentloaded', timeout: 10000 });
    console.log('✅ Navigated to http://localhost:3000/marketplace');

    // Helper to get text content
    const getResultSummary = async () => {
      const el = await page.locator('.font-black.text-slate-900.text-base').first();
      return (await el.innerText()).trim();
    };

    const countVisiblePropertyCards = async () => {
      return await page.locator('.aspect-\\[16\\/10\\]').count();
    };

    const countVisibleServiceCards = async () => {
      return await page.locator('a[href^="tel:"].bg-amber-50').count();
    };

    const countVisibleAgencyCards = async () => {
      return await page.locator('a[href^="tel:"].bg-indigo-50').count();
    };

    // First switch language to English for standard text testing
    await page.locator('select[aria-label="Language selection"]').selectOption('en');
    await page.waitForTimeout(400);

    // Test 1: Initial All Categories state
    console.log('\n--- 1. Testing "All Categories" Tab (English) ---');
    let count = await getResultSummary();
    console.log(`Total results found: ${count}`);
    const h3s = await page.locator('h3').allInnerTexts();
    console.log('All h3 elements on page:', h3s);
    if (count !== '13') throw new Error(`Expected 13 for all categories, got ${count}`);

    const propsCount1 = await countVisiblePropertyCards();
    const servCount1 = await countVisibleServiceCards();
    const agenCount1 = await countVisibleAgencyCards();
    console.log(`Visible in All Categories: Properties=${propsCount1}, Services=${servCount1}, Agencies=${agenCount1}`);
    if (propsCount1 !== 6) throw new Error(`Expected 6 properties in All Categories, got ${propsCount1}`);
    if (servCount1 !== 4) throw new Error(`Expected 4 services in All Categories, got ${servCount1}`);
    if (agenCount1 !== 3) throw new Error(`Expected 3 agencies in All Categories, got ${agenCount1}`);
    console.log('✅ All Categories displays all 3 domains with 13 total items');

    // Test 2: Services & Technicians Tab
    console.log('\n--- 2. Testing "Services & Technicians" Tab ---');
    const servicesTab = page.locator('button:has-text("Services & Technicians")').first();
    await servicesTab.click();
    await page.waitForTimeout(400);

    count = await getResultSummary();
    console.log(`Results found on Services tab: ${count}`);
    const h3sServices = await page.locator('h3').allInnerTexts();
    console.log('H3s on Services tab:', h3sServices);

    const propsCount2 = await countVisiblePropertyCards();
    const servCount2 = await countVisibleServiceCards();
    const agenCount2 = await countVisibleAgencyCards();
    console.log(`Visible on Services Tab: Properties=${propsCount2}, Services=${servCount2}, Agencies=${agenCount2}`);

    if (count !== '4') throw new Error(`Expected 4 results on Services tab, got ${count}`);
    if (propsCount2 !== 0) throw new Error(`STRICT ISOLATION VIOLATION: ${propsCount2} properties leaked into Services tab!`);
    if (agenCount2 !== 0) throw new Error(`STRICT ISOLATION VIOLATION: ${agenCount2} agencies leaked into Services tab!`);
    if (servCount2 !== 4) throw new Error(`Expected 4 services, found ${servCount2}`);
    if (h3sServices.some(h => h.includes('Apartments') || h.includes('Villas') || h.includes('Agencies'))) {
      throw new Error(`Heading leak on Services tab: ${JSON.stringify(h3sServices)}`);
    }
    console.log('✅ Services & Technicians tab strictly isolates domain to 4 services (0 properties, 0 agencies, 0 heading leaks)');

    // Test 3: Agencies & Brokers Tab
    console.log('\n--- 3. Testing "Agencies & Brokers" Tab ---');
    const agenciesTab = page.locator('button:has-text("Agencies & Brokers")').first();
    await agenciesTab.click();
    await page.waitForTimeout(400);

    count = await getResultSummary();
    console.log(`Results found on Agencies tab: ${count}`);
    const h3sAgencies = await page.locator('h3').allInnerTexts();
    console.log('H3s on Agencies tab:', h3sAgencies);

    const propsCount3 = await countVisiblePropertyCards();
    const servCount3 = await countVisibleServiceCards();
    const agenCount3 = await countVisibleAgencyCards();
    console.log(`Visible on Agencies Tab: Properties=${propsCount3}, Services=${servCount3}, Agencies=${agenCount3}`);

    if (count !== '3') throw new Error(`Expected 3 results on Agencies tab, got ${count}`);
    if (propsCount3 !== 0) throw new Error(`STRICT ISOLATION VIOLATION: ${propsCount3} properties leaked into Agencies tab!`);
    if (servCount3 !== 0) throw new Error(`STRICT ISOLATION VIOLATION: ${servCount3} services leaked into Agencies tab!`);
    if (agenCount3 !== 3) throw new Error(`Expected 3 agencies, found ${agenCount3}`);
    if (h3sAgencies.some(h => h.includes('Apartments') || h.includes('Villas') || h.includes('Services'))) {
      throw new Error(`Heading leak on Agencies tab: ${JSON.stringify(h3sAgencies)}`);
    }
    console.log('✅ Agencies & Brokers tab strictly isolates domain to 3 agencies (0 properties, 0 services, 0 heading leaks)');

    // Test 4: For Sale Tab
    console.log('\n--- 4. Testing "For Sale" Tab ---');
    const saleTab = page.locator('button:has-text("For Sale")').first();
    await saleTab.click();
    await page.waitForTimeout(400);

    count = await getResultSummary();
    console.log(`Results found on For Sale tab: ${count}`);
    const propsCount4 = await countVisiblePropertyCards();
    const servCount4 = await countVisibleServiceCards();
    const agenCount4 = await countVisibleAgencyCards();
    console.log(`Visible on For Sale Tab: Properties=${propsCount4}, Services=${servCount4}, Agencies=${agenCount4}`);

    if (count !== '4') throw new Error(`Expected 4 for sale properties, got ${count}`);
    if (propsCount4 !== 4) throw new Error(`Expected 4 property cards, got ${propsCount4}`);
    if (servCount4 !== 0) throw new Error(`Services leaked into For Sale tab: ${servCount4}`);
    if (agenCount4 !== 0) throw new Error(`Agencies leaked into For Sale tab: ${agenCount4}`);
    console.log('✅ For Sale tab strictly isolates domain to 4 properties (0 services, 0 agencies)');

    // Test 5: For Rent Tab
    console.log('\n--- 5. Testing "For Rent" Tab ---');
    const rentTab = page.locator('button:has-text("For Rent")').first();
    await rentTab.click();
    await page.waitForTimeout(400);

    count = await getResultSummary();
    console.log(`Results found on For Rent tab: ${count}`);
    const propsCount5 = await countVisiblePropertyCards();
    const servCount5 = await countVisibleServiceCards();
    const agenCount5 = await countVisibleAgencyCards();
    console.log(`Visible on For Rent Tab: Properties=${propsCount5}, Services=${servCount5}, Agencies=${agenCount5}`);

    if (count !== '2') throw new Error(`Expected 2 for rent properties, got ${count}`);
    if (propsCount5 !== 2) throw new Error(`Expected 2 property cards, got ${propsCount5}`);
    if (servCount5 !== 0) throw new Error(`Services leaked into For Rent tab: ${servCount5}`);
    if (agenCount5 !== 0) throw new Error(`Agencies leaked into For Rent tab: ${agenCount5}`);
    console.log('✅ For Rent tab strictly isolates domain to 2 properties (0 services, 0 agencies)');

    // Test 6: Apartments Tab
    console.log('\n--- 6. Testing "Apartments" Tab ---');
    const aptsTab = page.locator('button:has-text("Apartments")').first();
    await aptsTab.click();
    await page.waitForTimeout(400);

    count = await getResultSummary();
    console.log(`Results found on Apartments tab: ${count}`);
    const propsCount6 = await countVisiblePropertyCards();
    const servCount6 = await countVisibleServiceCards();
    const agenCount6 = await countVisibleAgencyCards();
    console.log(`Visible on Apartments Tab: Properties=${propsCount6}, Services=${servCount6}, Agencies=${agenCount6}`);

    if (count !== '3') throw new Error(`Expected 3 apartments, got ${count}`);
    if (propsCount6 !== 3) throw new Error(`Expected 3 property cards, got ${propsCount6}`);
    if (servCount6 !== 0) throw new Error(`Services leaked into Apartments tab: ${servCount6}`);
    if (agenCount6 !== 0) throw new Error(`Agencies leaked into Apartments tab: ${agenCount6}`);
    console.log('✅ Apartments tab strictly isolates domain to 3 apartments (0 services, 0 agencies)');

    // Test 7: Villas & Houses Tab
    console.log('\n--- 7. Testing "Villas & Houses" Tab ---');
    const villasTab = page.locator('button:has-text("Villas & Houses")').first();
    await villasTab.click();
    await page.waitForTimeout(400);

    count = await getResultSummary();
    console.log(`Results found on Villas tab: ${count}`);
    const propsCount7 = await countVisiblePropertyCards();
    const servCount7 = await countVisibleServiceCards();
    const agenCount7 = await countVisibleAgencyCards();
    console.log(`Visible on Villas Tab: Properties=${propsCount7}, Services=${servCount7}, Agencies=${agenCount7}`);

    if (count !== '3') throw new Error(`Expected 3 villas, got ${count}`);
    if (propsCount7 !== 3) throw new Error(`Expected 3 property cards, got ${propsCount7}`);
    if (servCount7 !== 0) throw new Error(`Services leaked into Villas tab: ${servCount7}`);
    if (agenCount7 !== 0) throw new Error(`Agencies leaked into Villas tab: ${agenCount7}`);
    console.log('✅ Villas & Houses tab strictly isolates domain to 3 villas (0 services, 0 agencies)');

    console.log('\n--- 8. Testing in Kurdish (ku) ---');
    await page.locator('select[aria-label="Language selection"]').selectOption('ku');
    await page.waitForTimeout(400);

    // Click Services in Kurdish
    const servicesTabKu = page.locator('button:has-text("وەستاکان و خزمەتگوزاری")').first();
    await servicesTabKu.click();
    await page.waitForTimeout(400);

    let countKu = await getResultSummary();
    console.log(`Results found on Kurdish Services tab: ${countKu}`);
    const propsCountKu = await countVisiblePropertyCards();
    const servCountKu = await countVisibleServiceCards();
    const agenCountKu = await countVisibleAgencyCards();
    console.log(`Visible on Kurdish Services Tab: Properties=${propsCountKu}, Services=${servCountKu}, Agencies=${agenCountKu}`);
    if (propsCountKu !== 0 || agenCountKu !== 0 || servCountKu !== 4) {
      throw new Error('Kurdish domain isolation failure on Services tab!');
    }
    console.log('✅ Kurdish domain isolation verified: 0 properties, 4 services, 0 agencies');

    console.log('\n--- 9. Testing in Arabic (ar) ---');
    await page.locator('select[aria-label="Language selection"]').selectOption('ar');
    await page.waitForTimeout(400);

    // Click Agencies in Arabic
    const agenciesTabAr = page.locator('button:has-text("الشركات والوسطاء")').first();
    await agenciesTabAr.click();
    await page.waitForTimeout(400);

    let countAr = await getResultSummary();
    console.log(`Results found on Arabic Agencies tab: ${countAr}`);
    const propsCountAr = await countVisiblePropertyCards();
    const servCountAr = await countVisibleServiceCards();
    const agenCountAr = await countVisibleAgencyCards();
    console.log(`Visible on Arabic Agencies Tab: Properties=${propsCountAr}, Services=${servCountAr}, Agencies=${agenCountAr}`);
    if (propsCountAr !== 0 || servCountAr !== 0 || agenCountAr !== 3) {
      throw new Error('Arabic domain isolation failure on Agencies tab!');
    }
    console.log('✅ Arabic domain isolation verified: 0 properties, 0 services, 3 agencies');

    console.log('\n🎉 ALL 9 MULTILINGUAL DOMAIN ISOLATION TESTS PASSED WITH 100% SUCCESS!');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
