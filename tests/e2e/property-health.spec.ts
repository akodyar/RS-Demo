import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

test.describe('Property Health Dashboard E2E', () => {
  const OWNER_TOKEN = 'dev-owner';
  const AGENT_TOKEN = 'dev-agent';

  test.beforeAll(async () => {
    // Ensure test property exists
    await db.insert(schema.properties).values({
      id: 'prop-agent-health-e2e',
      name: 'Agent Health Test Property',
      type: 'APARTMENT',
      status: 'AVAILABLE',
      operatingModel: 'AGENT_OPERATED',
    }).onConflictDoNothing();

    // Ensure active assignment for user_agent_01
    await db.insert(schema.agentPropertyAssignments).values({
      id: 'assign-health-agent-01',
      userId: 'user_agent_01',
      propertyId: 'prop-agent-health-e2e',
      assignedBy: 'user_owner_01',
      permissions: ['MANAGE_LEASES', 'VIEW_FINANCIALS', 'MAINTENANCE_COORDINATION'],
      status: 'ACTIVE',
    }).onConflictDoNothing();

    // Ensure verified ownership for user_owner_01
    await db.insert(schema.ownershipRecords).values({
      id: 'owner-rec-health-01',
      ownerId: 'user_owner_01',
      propertyId: 'prop-agent-health-e2e',
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    }).onConflictDoNothing();
  });

  test('Owner dashboard displays property health dashboard', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', email: 'owner@example.com', roles: ['PROPERTY_OWNER'] }));
      localStorage.setItem('homehub_lang', 'en');
    }, OWNER_TOKEN);

    await page.goto('/workspace/owner', { waitUntil: 'domcontentloaded' });

    // Verify Property Health Dashboard is rendered
    await expect(page.locator('h2', { hasText: 'Property Portfolio Health' })).toBeVisible({ timeout: 15000 });

    // Verify KPI cards inside health dashboard
    await expect(page.locator('text=Total Properties').first()).toBeVisible();
    await expect(page.locator('text=Healthy').first()).toBeVisible();
    await expect(page.locator('text=Attention Needed').first()).toBeVisible();
    await expect(page.locator('text=Critical Issues').first()).toBeVisible();
  });

  test('Agent dashboard displays property health dashboard', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_agent_01', email: 'agent@homehub.iq', roles: ['AGENT_BROKER'] }));
      localStorage.setItem('homehub_lang', 'en');
    }, AGENT_TOKEN);

    await page.goto('/workspace/agent', { waitUntil: 'domcontentloaded' });

    // Verify Property Health Dashboard is rendered
    await expect(page.locator('h2', { hasText: 'Property Portfolio Health' })).toBeVisible({ timeout: 15000 });

    // Verify KPI cards inside health dashboard
    await expect(page.locator('text=Total Properties').first()).toBeVisible();
    await expect(page.locator('text=Healthy').first()).toBeVisible();
  });

  test('Multi-locale RTL rendering works correctly', async ({ page }) => {
    await page.addInitScript((token) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('homehub_auth_token', token);
      localStorage.setItem('homehub_auth_persona', JSON.stringify({ id: 'user_owner_01', email: 'owner@example.com', roles: ['PROPERTY_OWNER'] }));
      localStorage.setItem('homehub_lang', 'ku');
    }, OWNER_TOKEN);

    await page.goto('/workspace/owner?lang=ku', { waitUntil: 'domcontentloaded' });

    // Wait and verify Kurdish translated heading & RTL dir
    await expect(page.locator('h2').filter({ hasText: 'تەندروستی پۆرتفۆلیۆی موڵکەکان' })).toBeVisible({ timeout: 15000 });
    const dirKu = await page.evaluate(() => document.documentElement.dir);
    expect(dirKu).toBe('rtl');

    // Switch to English (LTR)
    await page.goto('/workspace/owner?lang=en', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('h2', { hasText: 'Property Portfolio Health' })).toBeVisible({ timeout: 15000 });
    const dirEn = await page.evaluate(() => document.documentElement.dir);
    expect(dirEn).toBe('ltr');
  });
});
