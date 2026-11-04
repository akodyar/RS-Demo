import { chromium } from 'playwright';
import { db, closePool } from '../src/db/index';
import * as schema from '../src/db/schema';
import { inArray, eq } from 'drizzle-orm';

async function seed() {
  await db.insert(schema.users).values([
    { id: 'user_tenant_01', email: 'tenant@homehub.iq', firebaseUid: 'fb-e2e-1', firstName: 'Tenant', lastName: 'A', roles: ['TENANT'], createdAt: new Date() },
  ]).onConflictDoNothing();

  await db.insert(schema.properties).values([
    { id: 'e2e-tenant-prop-a', name: 'Prop E2E A', type: 'APARTMENT', address: {}, status: 'AVAILABLE' },
  ]).onConflictDoNothing();

  await db.insert(schema.leases).values([
    { id: 'e2e-lease-active', propertyId: 'e2e-tenant-prop-a', status: 'ACTIVE', startDate: '2024-01-01', endDate: '2030-01-01', rentAmount: 1000 },
  ]).onConflictDoNothing();

  await db.insert(schema.leaseTenants).values([
    { id: 'e2e-lt-1', leaseId: 'e2e-lease-active', tenantId: 'user_tenant_01', isPrimary: true },
  ]).onConflictDoNothing();

  await db.insert(schema.rentSchedules).values([
    {
      id: 'e2e-rent-1',
      leaseId: 'e2e-lease-active',
      propertyId: 'e2e-tenant-prop-a',
      tenantId: 'user_tenant_01',
      amount: 1000,
      currency: 'IQD',
      dueDate: new Date(new Date().setHours(24, 0, 0, 0)),
      periodStart: new Date(new Date().setHours(0, 0, 0, 0)),
      periodEnd: new Date(new Date().setHours(720, 0, 0, 0)),
      status: 'DUE',
    }
  ]).onConflictDoNothing();
}

async function main() {
  console.log('Seeding DB...');
  await seed();
  
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

  console.log('Navigating to /workspace/tenant...');
  await page.goto('http://localhost:3000/workspace/tenant');

  try {
    console.log('Waiting for the rent payment elements...');
    const button = page.locator('button', { hasText: /Pay Rent/i }).first();
    
    if (await button.isVisible({ timeout: 10000 })) {
      console.log('Found Pay Rent button, clicking...');
      await button.click();
      await page.waitForTimeout(2000); // Wait for modal animation
    } else {
      console.log('Could not find Pay Rent button. Trying to find any payment related block.');
    }

    console.log('Taking screenshot...');
    await page.screenshot({ path: 'screenshots/homehub-visual-fix-audit/before/tenant-rent-payment.png', fullPage: true });

    const text = await page.evaluate(() => document.body.innerText);
    const hasPlatformFee = text.toLowerCase().includes('platform fee');
    const hasSurcharge = text.toLowerCase().includes('surcharge');

    console.log(`ANALYSIS: hasPlatformFee = ${hasPlatformFee}, hasSurcharge = ${hasSurcharge}`);
    
    const feeMatches = text.match(/.*(fee|surcharge).*?\d+/gi);
    if (feeMatches) {
        console.log('Found fee lines:', feeMatches);
    }
  } catch (error) {
    console.error('Error during inspection:', error);
  }

  await browser.close();
  await closePool();
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
