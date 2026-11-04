const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function verifyHomePage() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const scratchDir = path.resolve('scratch');
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const results = {
    viewports: [],
    languages: [],
    sections: {},
    calculator: {},
    routeChecks: {},
  };

  console.log('--- 1. Testing Viewports & Horizontal Overflow ---');
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize(vp);
    await page.goto('http://localhost:3000/?lang=ku', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(500);

    const overflow = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = document.documentElement.clientWidth;
      return {
        scrollW,
        clientW,
        hasHorizontalOverflow: scrollW > clientW,
      };
    });

    console.log(`Viewport ${vp.width}x${vp.height}: scrollW=${overflow.scrollW}, clientW=${overflow.clientW}, overflow=${overflow.hasHorizontalOverflow}`);
    results.viewports.push({ ...vp, ...overflow });

    const shotPath = path.join(scratchDir, `home_${vp.width}x${vp.height}_ku.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
  }

  console.log('--- 2. Testing 4 Core Services Sections ---');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:3000/?lang=ku', { waitUntil: 'domcontentloaded', timeout: 10000 });

  const sectionIds = ['properties-for-sale', 'properties-for-rent', 'rent-management', 'property-services'];
  for (const id of sectionIds) {
    const el = await page.$(`#${id}`);
    results.sections[id] = !!el;
    console.log(`Section #${id}: ${el ? 'FOUND' : 'MISSING'}`);
  }

  console.log('--- 3. Testing Languages & RTL / LTR Directions ---');
  const langs = ['ku', 'ar', 'en'];
  for (const lang of langs) {
    await page.goto(`http://localhost:3000/?lang=${lang}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(300);

    const dirInfo = await page.evaluate(() => ({
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
    }));

    const expectedDir = (lang === 'ku' || lang === 'ar') ? 'rtl' : 'ltr';
    const pass = dirInfo.dir === expectedDir;
    console.log(`Language ${lang}: dir=${dirInfo.dir}, expected=${expectedDir}, pass=${pass}`);
    results.languages.push({ lang, dir: dirInfo.dir, expectedDir, pass });

    const shotPath = path.join(scratchDir, `home_1440x900_${lang}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
  }

  console.log('--- 4. Testing Interactive 5% Commission Calculator ---');
  await page.goto('http://localhost:3000/?lang=en', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(300);

  // Scroll to calculator
  const rentMgmtSection = await page.$('#rent-management');
  if (rentMgmtSection) {
    await rentMgmtSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Click Partial scenario button
    const partialBtn = await page.$('button:has-text("Partial (60% Collected)")');
    if (partialBtn) {
      await partialBtn.click();
      await page.waitForTimeout(300);
      const textPartial = await page.textContent('#rent-management');
      results.calculator.partialChecked = textPartial.includes('30,000') && textPartial.includes('570,000');
      console.log(`Partial scenario calculation verification: ${results.calculator.partialChecked ? 'PASS' : 'FAIL'}`);
    }

    // Click Unpaid scenario button
    const unpaidBtn = await page.$('button:has-text("Unpaid / Defaulted (0%)")');
    if (unpaidBtn) {
      await unpaidBtn.click();
      await page.waitForTimeout(300);
      const textUnpaid = await page.textContent('#rent-management');
      results.calculator.unpaidChecked = textUnpaid.includes('0 IQD') && textUnpaid.includes('0%');
      console.log(`Unpaid scenario calculation verification: ${results.calculator.unpaidChecked ? 'PASS' : 'FAIL'}`);
    }

    // Click Full scenario button
    const fullBtn = await page.$('button:has-text("Full (100% Collected)")');
    if (fullBtn) {
      await fullBtn.click();
      await page.waitForTimeout(300);
      const textFull = await page.textContent('#rent-management');
      results.calculator.fullChecked = textFull.includes('50,000') && textFull.includes('950,000');
      console.log(`Full scenario calculation verification: ${results.calculator.fullChecked ? 'PASS' : 'FAIL'}`);
    }
  }

  console.log('--- 5. Verifying Route Integrity ---');
  const routesToTest = [
    { name: 'Home', path: '/' },
    { name: 'Welcome', path: '/welcome' },
    { name: 'Onboarding', path: '/onboarding' },
    { name: 'Marketplace', path: '/marketplace' },
    { name: 'Owner Workspace', path: '/workspace/owner' },
    { name: 'Tenant Workspace', path: '/workspace/tenant' },
    { name: 'Vendor Workspace', path: '/workspace/vendor' },
    { name: 'Platform Admin', path: '/workspace/platform-admin' },
  ];

  for (const r of routesToTest) {
    try {
      const resp = await page.goto(`http://localhost:3000${r.path}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      const status = resp ? resp.status() : 'no response';
      const title = await page.title();
      results.routeChecks[r.name] = { path: r.path, status, title, ok: status === 200 };
      console.log(`Route ${r.name} (${r.path}): status=${status}, OK=${status === 200}`);
    } catch (e) {
      results.routeChecks[r.name] = { path: r.path, error: e.message, ok: false };
      console.log(`Route ${r.name} (${r.path}): ERROR ${e.message}`);
    }
  }

  console.log('--- Verification Complete ---');
  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

verifyHomePage().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
