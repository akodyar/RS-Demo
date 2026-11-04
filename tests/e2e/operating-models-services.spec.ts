import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import path from 'path';

dotenv.config({ path: '.env' });

const screenshotDir = path.resolve(process.cwd(), 'screenshots/homehub-full-audit/rental-models');

test.describe.serial('Domain 6 & 7: Property Management Services & Three Rental Operating Models', () => {
  let propAId = '';
  let propBId = '';
  let propCId = '';

  test.afterAll(async () => {
    // Cleanup
    for (const id of [propAId, propBId, propCId]) {
      if (id) {
        await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, id));
        await db.delete(schema.managementAgreements).where(eq(schema.managementAgreements.propertyId, id));
        await db.delete(schema.listings).where(eq(schema.listings.propertyId, id));
        await db.delete(schema.properties).where(eq(schema.properties.id, id));
      }
    }
  });

  test('1. Model A — Fully Managed / Platform-Operated', async ({ page, request }) => {
    // Create property with Model A
    const res = await request.post('/api/properties', {
      headers: { Authorization: `Bearer dev-owner` },
      data: {
        name: 'Model A Fully Managed Residence',
        type: 'Apartment',
        operatingModel: 'FULLY_MANAGED',
        rentFee: 0.05,
        managementFee: 0.10,
        address: { city: 'Erbil', street: 'Gulan St' }
      }
    });
    expect(res.status()).toBe(201);
    const prop = await res.json();
    propAId = prop.id;

    // Verify in PostgreSQL
    const dbProp = await db.query.properties.findFirst({
      where: eq(schema.properties.id, propAId)
    });
    expect(dbProp?.operatingModel).toBe('FULLY_MANAGED');

    // Commission service verification: All 3 fees apply (Platform + Rent + Management)
    const { commissionService } = await import('../../src/server/services/commission.js');
    const calc = await commissionService.calculatePropertyFees(1000, propAId, 'USD');
    expect(calc.operatingModel).toBe('FULLY_MANAGED');
    expect(calc.platformFeeAmount).toBeGreaterThan(0);
    expect(calc.rentFeeAmount).toBe(50); // 5% of 1000
    expect(calc.managementFeeAmount).toBe(100); // 10% of 1000
    expect(calc.totalFeeAmount).toBe(calc.platformFeeAmount + 50 + 100);

    // View in Owner Dashboard
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', role: 'OWNER' }));
    });
    await page.goto('/workspace/owner');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    // Take screenshot of Model A representation
    await page.screenshot({ path: path.join(screenshotDir, 'model-a-fully-managed.png'), fullPage: true });
  });

  test('2. Model B — Agent-Listed, Platform-Managed', async ({ page, request }) => {
    // Create property with Model B
    const res = await request.post('/api/properties', {
      headers: { Authorization: `Bearer dev-owner` },
      data: {
        name: 'Model B Agent-Listed Platform-Managed Prop',
        type: 'Apartment',
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        rentFee: 0.05,
        managementFee: 0.08,
        address: { city: 'Sulaymaniyah', street: 'Salim St' }
      }
    });
    expect(res.status()).toBe(201);
    const prop = await res.json();
    propBId = prop.id;

    // Verify in PostgreSQL
    const dbProp = await db.query.properties.findFirst({
      where: eq(schema.properties.id, propBId)
    });
    expect(dbProp?.operatingModel).toBe('AGENT_LISTED_PLATFORM_MANAGED');

    // Commission service verification: Platform Fee + Management Fee only (No Rent Fee to platform)
    const { commissionService } = await import('../../src/server/services/commission.js');
    const calc = await commissionService.calculatePropertyFees(1000, propBId, 'USD');
    expect(calc.operatingModel).toBe('AGENT_LISTED_PLATFORM_MANAGED');
    expect(calc.platformFeeAmount).toBeGreaterThan(0);
    expect(calc.rentFeeAmount).toBe(0); // 0 rent fee to platform in Model B
    expect(calc.managementFeeAmount).toBe(80); // 8% of 1000
    expect(calc.totalFeeAmount).toBe(calc.platformFeeAmount + 80);

    // Navigate to Owner Workspace and capture Model B screenshot
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', role: 'OWNER' }));
    });
    await page.goto('/workspace/owner');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(screenshotDir, 'model-b-agent-listed-platform-managed.png'), fullPage: true });
  });

  test('3. Model C — Agent-Operated Entirely', async ({ page, request }) => {
    // Create property with Model C
    const res = await request.post('/api/properties', {
      headers: { Authorization: `Bearer dev-owner` },
      data: {
        name: 'Model C Agent-Operated Prop',
        type: 'Villa',
        operatingModel: 'AGENT_OPERATED',
        rentFee: 0.04,
        managementFee: 0.06,
        address: { city: 'Duhok', street: 'KRO St' }
      }
    });
    expect(res.status()).toBe(201);
    const prop = await res.json();
    propCId = prop.id;

    // Verify in PostgreSQL
    const dbProp = await db.query.properties.findFirst({
      where: eq(schema.properties.id, propCId)
    });
    expect(dbProp?.operatingModel).toBe('AGENT_OPERATED');

    // Commission service verification: Platform Fee only (HomeHub does not operate or collect rent/management fee)
    const { commissionService } = await import('../../src/server/services/commission.js');
    const calc = await commissionService.calculatePropertyFees(1000, propCId, 'USD');
    expect(calc.operatingModel).toBe('AGENT_OPERATED');
    expect(calc.platformFeeAmount).toBeGreaterThan(0);
    expect(calc.rentFeeAmount).toBe(0);
    expect(calc.managementFeeAmount).toBe(0);
    expect(calc.totalFeeAmount).toBe(calc.platformFeeAmount);

    // View Agent Workspace managing properties
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-company');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_company_01', role: 'COMPANY_ADMIN' }));
    });
    await page.goto('/workspace/agent');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(screenshotDir, 'model-c-agent-operated.png'), fullPage: true });
  });

  test('4. Property Management Services & Authorization Scope Enforcement', async ({ request, page }) => {
    // Tenant cannot access owner management endpoint
    const tenantToOwner = await request.get('/api/owner/properties', {
      headers: { Authorization: `Bearer dev-tenant` }
    });
    expect([401, 403]).toContain(tenantToOwner.status());

    // Tenant cannot access agent management endpoint
    const tenantToAgent = await request.get('/api/agent/properties', {
      headers: { Authorization: `Bearer dev-tenant` }
    });
    expect([401, 403]).toContain(tenantToAgent.status());

    // Owner can access own properties
    const ownerRes = await request.get('/api/owner/properties', {
      headers: { Authorization: `Bearer dev-owner` }
    });
    expect(ownerRes.status()).toBe(200);

    // Agent can access assigned properties
    const agentRes = await request.get('/api/agent/properties', {
      headers: { Authorization: `Bearer dev-company` }
    });
    expect(agentRes.status()).toBe(200);

    // Screenshot of management services in owner workspace
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'dev-owner');
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', role: 'OWNER' }));
    });
    await page.goto('/workspace/owner');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(screenshotDir, 'management-services-overview.png'), fullPage: true });
  });
});
