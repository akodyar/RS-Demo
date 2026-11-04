import { test, expect } from '@playwright/test';
import { db, closePool } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import * as crypto from 'crypto';
import dotenv from 'dotenv';
import { eq, inArray } from 'drizzle-orm';
dotenv.config({ path: '.env' });

let testData = {
  tenantAId: '',
  tenantBId: '',
  ownerAId: '',
  ownerBId: '',
  adminId: '',
  agentId: '',
  propAId: '',
  propBId: '',
  billAId: '',
  billBId: '',
};

test.beforeAll(async () => {
  // Setup isolated test database records
  const uuid = () => crypto.randomUUID();
  testData = {
    tenantAId: 'user_tenant_01',
    tenantBId: 'user_tenant_b_01',
    ownerAId: 'user_owner_01',
    ownerBId: 'user_owner_02',
    adminId: 'admin_user_02',
    agentId: 'user_agent_01',
    propAId: 'e2e-prop-a',
    propBId: 'e2e-prop-b',
    billAId: 'e2e-bill-a',
    billBId: 'e2e-bill-b',
  };

  await db.delete(schema.utilityPayments).where(
    inArray(schema.utilityPayments.billId, 
      db.select({ id: schema.utilityBills.id }).from(schema.utilityBills).where(inArray(schema.utilityBills.tenantId, [testData.tenantAId, testData.tenantBId]))
    )
  );
  await db.delete(schema.utilityBills).where(inArray(schema.utilityBills.tenantId, [testData.tenantAId, testData.tenantBId]));

  await db.insert(schema.users).values([
    { id: testData.ownerAId, email: `owner.a.${Date.now()}@test.com`, passwordHash: 'hash', roles: ['OWNER'], firstName: 'Owner', lastName: 'A', status: 'ACTIVE' },
    { id: testData.ownerBId, email: `owner.b.${Date.now()}@test.com`, passwordHash: 'hash', roles: ['OWNER'], firstName: 'Owner', lastName: 'B', status: 'ACTIVE' },
    { id: testData.tenantAId, email: `tenant.a.${Date.now()}@test.com`, passwordHash: 'hash', roles: ['TENANT'], firstName: 'Tenant', lastName: 'A', status: 'ACTIVE' },
    { id: testData.tenantBId, email: `tenant.b.${Date.now()}@test.com`, passwordHash: 'hash', roles: ['TENANT'], firstName: 'Tenant', lastName: 'B', status: 'ACTIVE' },
    { id: testData.adminId, email: `admin.${Date.now()}@test.com`, passwordHash: 'hash', roles: ['PLATFORM_ADMIN'], firstName: 'Admin', lastName: 'A', status: 'ACTIVE' },
  ]).onConflictDoNothing();

  await db.insert(schema.properties).values([
    { id: testData.propAId, ownerId: testData.ownerAId, name: 'Prop A', type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED' },
    { id: testData.propBId, ownerId: testData.ownerBId, name: 'Prop B', type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED' }
  ]).onConflictDoNothing();

  await db.insert(schema.ownershipRecords).values([
    { id: uuid(), ownerId: testData.ownerAId, propertyId: testData.propAId, ownershipType: 'INDIVIDUAL', status: 'VERIFIED', verifiedAt: new Date() },
    { id: uuid(), ownerId: testData.ownerBId, propertyId: testData.propBId, ownershipType: 'INDIVIDUAL', status: 'VERIFIED', verifiedAt: new Date() }
  ]).onConflictDoNothing();

  await db.insert(schema.leases).values([
    { id: 'e2e-lease-util-a', propertyId: testData.propAId, status: 'ACTIVE', startDate: '2024-01-01', endDate: '2030-01-01', rentAmount: '1200000', currency: 'USD' }
  ]).onConflictDoNothing();

  await db.insert(schema.leaseTenants).values([
    { id: 'e2e-lt-util-a', leaseId: 'e2e-lease-util-a', tenantId: testData.tenantAId, isPrimary: true }
  ]).onConflictDoNothing();

  await db.insert(schema.utilityBills).values([
    { id: testData.billAId, propertyId: testData.propAId, leaseId: 'e2e-lease-util-a', tenantId: testData.tenantAId, type: 'WATER', amount: '100', outstandingAmount: '100', currency: 'USD', status: 'PENDING', billingDate: '2026-11-01', dueDate: '2026-12-01' },
    { id: testData.billBId, propertyId: testData.propBId, tenantId: testData.tenantBId, type: 'ELECTRICITY', amount: '200', outstandingAmount: '200', currency: 'USD', status: 'PENDING', billingDate: '2026-11-01', dueDate: '2026-12-01' }
  ]).onConflictDoNothing();
});

test.afterAll(async () => {
  await db.delete(schema.utilityPayments).where(
    inArray(schema.utilityPayments.billId, [testData.billAId, testData.billBId])
  );
  await db.delete(schema.utilityBills).where(inArray(schema.utilityBills.id, [testData.billAId, testData.billBId]));
  await db.delete(schema.leaseTenants).where(eq(schema.leaseTenants.id, 'e2e-lt-util-a'));
  await db.delete(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, 'e2e-lease-util-a'));
  await db.delete(schema.leases).where(eq(schema.leases.id, 'e2e-lease-util-a'));
  await closePool();
});

// A small helper to set local storage auth tokens
async function loginAs(page: any, userId: string, role: string) {
  // HomeHub Dev environment checks local storage
  await page.goto('/');
  await page.evaluate(({ id, role }) => {
    let token = `dev-${role.toLowerCase()}`;
    if (role === 'OWNER' && id === 'user_owner_02') {
      token = 'dev-owner-b';
    }
    localStorage.setItem('homehub_auth_persona', JSON.stringify({id, role}));
    localStorage.setItem('auth_token', token);
    localStorage.setItem('homehub_lang', 'en');
  }, { id: userId, role });
  await page.goto(role === 'TENANT' ? '/workspace/tenant' : '/workspace/owner');
}

test.describe('Utility Billing - English LTR', () => {
  test('Tenant Workflow: Visibility and Isolation', async ({ page }) => {
    await loginAs(page, testData.tenantAId, 'TENANT');
    
    // Click utility bills from quick actions
    await page.click('#quick-action-utility-bills');

    // Wait for bills to load
    await expect(page.locator('text=WATER Bill').first()).toBeVisible();
    await expect(page.locator('text=100 USD').first()).toBeVisible();

    // Verify isolation (Bill B shouldn't be here)
    await expect(page.locator('text=ELECTRICITY Bill')).not.toBeVisible();
  });

  test('Tenant Workflow: Payment', async ({ page }) => {
    await loginAs(page, testData.tenantAId, 'TENANT');
    
    await page.click('#quick-action-utility-bills');

    // Wait for bills to load
    await expect(page.locator('text=WATER Bill').first()).toBeVisible();

    // Pay action, wait for the response to avoid false positives on 'PAID' text in UI
    const payPromise = page.waitForResponse((res) => res.url().includes('/pay'));
    await page.locator('button').filter({ hasText: 'Pay' }).filter({ hasNotText: 'Payments' }).first().click();
    const payRes = await payPromise;
    expect(payRes.status()).toBe(201);

    // Verify DB
    const [bill] = await db.select().from(schema.utilityBills).where(eq(schema.utilityBills.id, testData.billAId));
    expect(bill.status).toBe('PAID');
    expect(bill.outstandingAmount).toBe('0');
  });

  test('Owner Workflow: Visibility', async ({ page }) => {
    await loginAs(page, testData.ownerBId, 'OWNER');
    
    await page.locator('button:has-text("Accounting"), button:has-text("Earnings")').filter({ visible: true }).first().click();
    // Wait for the unpaid utility bills block to appear in the table
    await expect(page.locator('text=Unpaid Utility Bills')).toBeVisible({ timeout: 15000 });
    
    // Verify unpaid bills appears in the expansion
    await expect(page.locator('text=Unpaid Utility Bills')).toBeVisible();
    await expect(page.locator('text=ELECTRICITY Bill')).toBeVisible();
    await expect(page.locator('text=200 USD')).toBeVisible();

    // Owner B cannot see Prop A's bills
    await expect(page.locator('text=Prop A')).not.toBeVisible();
  });
});
