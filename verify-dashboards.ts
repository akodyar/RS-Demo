import { chromium } from 'playwright';

const viewports = [
  { width: 1440, height: 900 },
  { width: 1366, height: 768 }
];

const workspaces = [
  { name: 'Owner', url: '/workspace/owner' },
  { name: 'Tenant', url: '/workspace/tenant' },
  { name: 'Company', url: '/workspace/company' },
  { name: 'Agent', url: '/workspace/agent' },
  { name: 'Vendor', url: '/workspace/vendor' },
  { name: 'Buyer', url: '/workspace/buyer' },
  { name: 'Admin', url: '/workspace/platform-admin' }
];

async function run() {
  console.log('Starting E2E Dashboard Verification (Healthy DB)...');
  const browser = await chromium.launch();
  let hasErrors = false;

  for (const vp of viewports) {
    console.log(`\nTesting Viewport: ${vp.width}x${vp.height}`);
    const context = await browser.newContext({ viewport: vp });

    for (const ws of workspaces) {
      const page = await context.newPage();
      try {
        console.log(`  Navigating to ${ws.name} workspace (${ws.url})...`);
        const response = await page.goto(`http://localhost:3000${ws.url}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        
        if (!response?.ok()) {
          console.error(`    [FAIL] HTTP Status: ${response?.status()} ${response?.statusText()}`);
          hasErrors = true;
          continue;
        }

        // Check if database warning banner is present
        const bannerVisible = await page.isVisible('text="Database Service Unavailable"');
        if (bannerVisible) {
          console.error(`    [FAIL] Database warning banner is visible!`);
          hasErrors = true;
        } else {
          console.log(`    [PASS] No database warning banner.`);
        }

        // Check if there's any generic crash text
        const errorBoundary = await page.isVisible('text="Something went wrong"');
        if (errorBoundary) {
          console.error(`    [FAIL] Application crashed (Error Boundary).`);
          hasErrors = true;
        } else {
          console.log(`    [PASS] Application loaded successfully.`);
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
