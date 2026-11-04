import { chromium } from 'playwright';

const viewports = [
  { width: 1440, height: 900 }
];

const workspaces = [
  { name: 'Owner', url: '/workspace/owner', expectText: 'Database Offline' },
  { name: 'Tenant', url: '/workspace/tenant', expectText: 'Database Service Unavailable' }
];

async function run() {
  console.log('Starting E2E Dashboard Verification (DB OUTAGE)...');
  const browser = await chromium.launch();
  let hasErrors = false;

  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: vp });

    for (const ws of workspaces) {
      const page = await context.newPage();
      try {
        console.log(`  Navigating to ${ws.name} workspace (${ws.url})...`);
        const response = await page.goto(`http://localhost:3000${ws.url}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        await page.waitForTimeout(2000);

        const textVisible = await page.isVisible(`text="${ws.expectText}"`);
        if (textVisible) {
          console.log(`    [PASS] Expected outage text "${ws.expectText}" is visible!`);
        } else {
          console.error(`    [FAIL] Expected outage text "${ws.expectText}" was NOT found!`);
          hasErrors = true;
        }

      } catch (err: any) {
        console.error(`    [FAIL] Error testing ${ws.name}: ${err.message}`);
        hasErrors = true;
      }
      await page.close();
    }
    await context.close();
  }

  await browser.close();
  if (hasErrors) {
    console.error('\nVerification completed with ERRORS.');
    process.exit(1);
  } else {
    console.log('\nVerification completed SUCCESSFULLY.');
  }
}

run()
  .then(() => process.exit(0))
  .catch(console.error);
