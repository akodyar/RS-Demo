import { chromium } from 'playwright';
import path from 'path';

async function verifyOption3Live() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();

  console.log('Setting localStorage for owner persona...');
  await page.addInitScript(() => {
    localStorage.setItem('homehub_lang', 'ku');
    localStorage.setItem('homehub_auth_persona', JSON.stringify({
      id: 'owner_demo_01',
      role: 'OWNER',
      name: 'ڕێبین ئەحمەد',
      email: 'rebin@homehub.iq'
    }));
  });

  console.log('Navigating to http://localhost:3000/workspace/owner...');
  await page.goto('http://localhost:3000/workspace/owner', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const outDir = 'C:/Users/zakar/.gemini/antigravity/brain/46e58428-0760-4215-9bed-a78ce6b19522';

  // Check if rail is visible
  const rail = await page.$('aside[aria-label="Owner Workspace Navigation Rail"]');
  console.log('Sidebar Rail present:', !!rail);

  // Check if header is visible
  const header = await page.$('header');
  console.log('Header present:', !!header);

  // Check key selectors
  const propBtn = await page.$('#owner-nav-properties');
  console.log('Properties tab present:', !!propBtn);

  const leaseBtn = await page.$('#owner-nav-leases');
  console.log('Tenants tab present:', !!leaseBtn);

  const earningsBtn = await page.$('#owner-nav-earnings');
  console.log('Earnings tab present:', !!earningsBtn);

  const settlementsBtn = await page.$('#owner-nav-settlements');
  console.log('Settlements tab present:', !!settlementsBtn);

  const maintenanceBtn = await page.$('#tab-nav-maintenance');
  console.log('Maintenance tab present:', !!maintenanceBtn);

  const switcherBtn = await page.$('#owner-header-switch-workspace-btn');
  console.log('Workspace Switcher present:', !!switcherBtn);

  const profileBtn = await page.$('#owner-profile-btn');
  console.log('Profile button present:', !!profileBtn);

  // 1. Capture Overview tab
  await page.screenshot({ path: path.join(outDir, 'live_owner_option3_overview.png'), fullPage: false });
  console.log('Saved live_owner_option3_overview.png');

  // 2. Click Maintenance Tab
  if (maintenanceBtn) {
    await maintenanceBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'live_owner_option3_maintenance.png'), fullPage: false });
    console.log('Saved live_owner_option3_maintenance.png');
  }

  // 3. Click Properties Tab
  if (propBtn) {
    await propBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'live_owner_option3_properties.png'), fullPage: false });
    console.log('Saved live_owner_option3_properties.png');
  }

  // 4. Click Notification Bell
  const bellBtn = await page.$('#owner-notification-bell-btn');
  if (bellBtn) {
    await bellBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(outDir, 'live_owner_option3_notifications.png'), fullPage: false });
    console.log('Saved live_owner_option3_notifications.png');
  }

  await browser.close();
  console.log('Verification finished successfully!');
}

verifyOption3Live().catch(err => {
  console.error('Error during live verification:', err);
  process.exit(1);
});
