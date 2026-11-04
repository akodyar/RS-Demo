import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:3000/');
  await page.goto('http://localhost:3000/');

  console.log('Setting localStorage for authentication...');
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'dev-tenant');
    localStorage.setItem('homehub_auth_token', 'dev-tenant');
    localStorage.setItem('homehub_auth_persona', JSON.stringify({ uid: 'user_tenant_01', roles: ['TENANT'], name: 'Tenant A' }));
    localStorage.setItem('homehub_lang', 'en');
  });

  // Intercept the dashboard request and return mock active lease
  await page.route('**/api/tenant/dashboard', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hasActiveLease: true,
        tenant: { id: 'user_tenant_01', name: 'Tenant A', email: 'tenant@homehub.iq' },
        property: {
          id: 'prop-1',
          name: 'Empire World Tower',
          address: { city: 'Erbil', street: 'Empire World' },
          type: 'APARTMENT',
          unitNumber: '404'
        },
        lease: {
          id: 'lease-1',
          status: 'ACTIVE',
          startDate: '2024-01-01',
          endDate: '2025-01-01',
          rentAmount: 1200,
          currency: 'IQD',
          depositAmount: 1200
        },
        upcomingRent: {
          id: 'rent-schedule-1',
          amount: 1200,
          dueDate: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
          status: 'DUE',
          periodStart: '2024-06-01',
          periodEnd: '2024-06-30'
        },
        paymentHistory: [],
        maintenanceRequests: [],
        documents: []
      })
    });
  });

  console.log('Navigating to /workspace/tenant...');
  await page.goto('http://localhost:3000/workspace/tenant');

  try {
    console.log('Waiting for the dashboard to load...');
    await page.waitForSelector('#quick-action-pay-rent', { timeout: 10000 });
    
    console.log('Clicking Pay Rent...');
    await page.click('#quick-action-pay-rent');
    
    console.log('Waiting for modal to open...');
    await page.waitForSelector('text=Total Tenant Payable', { timeout: 10000 });
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'screenshots/homehub-visual-fix-audit/after/tenant-rent-payment.png', fullPage: true });

    const text = await page.evaluate(() => document.body.innerText);
    const hasPlatformFee = text.toLowerCase().includes('platform fee');
    const hasSurcharge = text.toLowerCase().includes('surcharge');

    console.log(`ANALYSIS: hasPlatformFee = ${hasPlatformFee}, hasSurcharge = ${hasSurcharge}`);
    
  } catch (error) {
    console.error('Error during inspection:', error);
    await page.screenshot({ path: 'screenshots/homehub-visual-fix-audit/errors/tenant-rent-payment-error.png', fullPage: true });
  }

  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
