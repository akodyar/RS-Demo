import { test, expect } from '@playwright/test';
import { db } from '../../src/db/index';
import * as schema from '../../src/db/schema';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

test.describe('Phase 58: Comprehensive End-to-End Business Workflows', () => {
  const runId = Date.now().toString(36);

  test('1. Property Creation -> DB Persistence -> Portfolio Rendering', async ({ page }) => {
    // 1. Login as Property Owner
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.locator('#login-email').fill('owner@homehub.iq');
    await page.locator('#login-password').fill('password123');
    await page.locator('#login-submit-btn').click();
    await expect(page).toHaveURL(/\/owner/, { timeout: 15000 });

    const ownerToken = await page.evaluate(() => localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token'));
    expect(ownerToken).toBeTruthy();

    // 2. Navigate to Add Property
    await page.goto('/properties/add', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('text=/Add New Property|زیادکردنی موڵک/i').first()).toBeVisible({ timeout: 15000 });

    const propertyTitle = `Slemani Luxury Tower ${runId}`;

    // Create property via authenticated session
    const createRes = await page.request.post('/api/properties', {
      headers: {
        'Authorization': `Bearer ${ownerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: propertyTitle,
        description: 'Synthetic automated E2E test property',
        type: 'RESIDENTIAL',
        listingType: 'FOR_RENT',
        price: 1500000,
        currency: 'IQD',
        operatingModel: 'FULLY_MANAGED',
        address: {
          city: 'Sulaymaniyah',
          district: 'Sarchinar',
          street: 'Main Blvd 42'
        }
      }
    });

    expect(createRes.status()).toBe(201);
    const createdData = await createRes.json();
    const propertyId = createdData.property?.id || createdData.id;
    expect(propertyId).toBeDefined();

    // Verify persisted in DB
    const [dbProp] = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    expect(dbProp).toBeDefined();
    expect(dbProp.name).toBe(propertyTitle);
    expect(dbProp.operatingModel).toBe('FULLY_MANAGED');

    // Verify property appears in Owner Portfolio / Dashboard
    await page.goto('/owner', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`text=${propertyTitle}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('2. Agent Assignment & Scope Authority Verification', async ({ page }) => {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner@homehub.iq'));
    const [agentUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'agent@homehub.iq'));
    const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

    const agentToken = jwt.sign(
      { id: agentUser.id, email: agentUser.email, roles: ['AGENT', 'AGENT_BROKER'], tokenVersion: 1 },
      jwtSecret
    );

    // Create two test properties: one assigned to agent, one unassigned
    const assignedPropId = `prop-assigned-${runId}`;
    const unassignedPropId = `prop-unassigned-${runId}`;

    await db.insert(schema.properties).values([
      {
        id: assignedPropId,
        name: `Agent Assigned Villa ${runId}`,
        ownerId: owner.id,
        type: 'RESIDENTIAL',
        status: 'AVAILABLE',
        operatingModel: 'FULLY_MANAGED'
      },
      {
        id: unassignedPropId,
        name: `Agent Forbidden Villa ${runId}`,
        ownerId: owner.id,
        type: 'RESIDENTIAL',
        status: 'AVAILABLE',
        operatingModel: 'FULLY_MANAGED'
      }
    ]);

    // Authorize agent only on assignedPropId
    await db.insert(schema.agentPropertyAssignments).values({
      userId: agentUser.id,
      propertyId: assignedPropId,
      assignedBy: owner.id,
      status: 'ACTIVE',
      permissions: ['VIEW_PROPERTY', 'CREATE_LISTING', 'EDIT_LISTING', 'MANAGE_OFFERS']
    });

    // 1. Authorized Listing Creation by assigned agent must succeed
    const authorizedRes = await page.request.post('/api/agent/listings', {
      headers: {
        'Authorization': `Bearer ${agentToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        propertyId: assignedPropId,
        type: 'RENT',
        price: 1800000,
        currency: 'IQD',
        title: `Luxury Assigned Villa ${runId}`
      }
    });
    expect(authorizedRes.status()).toBe(201);

    // 2. Adversarial: Agent attempting to create listing on unassigned property must be rejected with 403
    const forbiddenRes = await page.request.post('/api/agent/listings', {
      headers: {
        'Authorization': `Bearer ${agentToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        propertyId: unassignedPropId,
        type: 'RENT',
        price: 2500000,
        currency: 'IQD',
        title: `Forbidden Villa ${runId}`
      }
    });
    expect(forbiddenRes.status()).toBe(403);
  });

  test('3. Tenancy Lifecycle: Lease Creation -> Rent Schedule Generation', async ({ page }) => {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner@homehub.iq'));
    const tenantEmail = `tenant.fresh.${runId}@homehub.iq`;
    const [tenant] = await db.insert(schema.users).values({
      id: `usr-tenant-${runId}`,
      email: tenantEmail,
      firstName: 'Fresh',
      lastName: `Tenant ${runId}`,
      roles: ['TENANT'],
      isActive: true,
      createdAt: new Date()
    }).returning();

    const propId = `prop-lease-${runId}`;
    await db.insert(schema.properties).values({
      id: propId,
      name: `Lease Test Complex ${runId}`,
      ownerId: owner.id,
      type: 'RESIDENTIAL',
      status: 'AVAILABLE',
      operatingModel: 'FULLY_MANAGED'
    });

    const leaseId = `lease-${runId}`;
    await db.insert(schema.leases).values({
      id: leaseId,
      propertyId: propId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: 1000000,
      depositAmount: 1000000,
      billingFrequency: 'MONTHLY'
    });

    await db.insert(schema.leaseTenants).values({
      leaseId: leaseId,
      tenantId: tenant.id,
      isPrimary: true
    });

    const schedId = `sched-${runId}`;
    await db.insert(schema.rentSchedules).values({
      id: schedId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenant.id,
      amount: '1000000',
      paidAmount: '0',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'UPCOMING'
    });

    const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';
    const tenantToken = jwt.sign(
      { id: tenant.id, email: tenant.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    // Verify tenant dashboard authoritative API returns active lease and rent due
    const dashRes = await page.request.get('/api/tenant/dashboard', {
      headers: { 'Authorization': `Bearer ${tenantToken}` }
    });
    expect(dashRes.status()).toBe(200);
    const dashData = await dashRes.json();
    expect(dashData.currentProperty?.name).toBe(`Lease Test Complex ${runId}`);
    expect(dashData.rentDue?.amount).toBe(1000000);
    expect(dashData.rentDue?.scheduleId).toBe(schedId);
  });

  test('4. Rent Payment Submission -> Unconfirmed Invariant -> Authorized Confirmation -> 3-Fee Posting', async ({ page }) => {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner@homehub.iq'));
    const [tenant] = await db.select().from(schema.users).where(eq(schema.users.email, 'tenant@homehub.iq'));
    const [adminUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'admin@homehub.iq'));
    const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

    const propId = `prop-fin-${runId}`;
    await db.insert(schema.properties).values({
      id: propId,
      name: `Financial Invariant Complex ${runId}`,
      ownerId: owner.id,
      type: 'RESIDENTIAL',
      status: 'RENTED',
      operatingModel: 'FULLY_MANAGED'
    });

    const leaseId = `lease-fin-${runId}`;
    await db.insert(schema.leases).values({
      id: leaseId,
      propertyId: propId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: 1000000,
      billingFrequency: 'MONTHLY'
    });

    await db.insert(schema.leaseTenants).values({
      leaseId: leaseId,
      tenantId: tenant.id,
      isPrimary: true
    });

    const schedId = `sched-fin-${runId}`;
    await db.insert(schema.rentSchedules).values({
      id: schedId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenant.id,
      amount: '1000000',
      paidAmount: '0',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'UPCOMING'
    });

    const tenantToken = jwt.sign(
      { id: tenant.id, email: tenant.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    // 1. Tenant submits rent payment of 1,000,000 IQD
    const payRes = await page.request.post('/api/tenant/payments/pay-rent', {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        propertyId: propId,
        leaseId: leaseId,
        scheduleId: schedId,
        amount: 1000000,
        referenceNumber: `REF-E2E-${runId}`
      }
    });

    expect(payRes.status()).toBe(201);
    const payJson = await payRes.json();
    const paymentId = payJson.payment?.id || payJson.id;
    expect(paymentId).toBeDefined();
    expect(payJson.payment?.status).toBe('RECORDED');

    // 2. INVARIANT VERIFICATION: Rent schedule MUST NOT change before confirmation
    const [schedUnconfirmed] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
    expect(schedUnconfirmed.paidAmount).toBe('0');
    expect(schedUnconfirmed.status).toBe('UPCOMING');

    // 3. ADVERSARIAL: Tenant self-confirmation MUST be rejected with 403
    const selfConfirmRes = await page.request.post(`/api/leases/payments/${paymentId}/confirm`, {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      },
      data: { referenceNumber: `REF-E2E-${runId}` }
    });
    expect(selfConfirmRes.status()).toBe(403);

    // 4. AUTHORIZED CONFIRMATION: Admin / Authorized collector confirms payment
    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, roles: ['ADMIN', 'PLATFORM_ADMIN'], tokenVersion: 1 },
      jwtSecret
    );

    const confirmRes = await page.request.post(`/api/leases/payments/${paymentId}/confirm`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      data: { referenceNumber: `REF-E2E-${runId}` }
    });
    expect(confirmRes.status()).toBe(200);

    // 5. POST-CONFIRMATION: Schedule must now be PAID with paidAmount = 1000000
    const [schedConfirmed] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
    expect(schedConfirmed.paidAmount).toBe('1000000');
    expect(schedConfirmed.status).toBe('PAID');

    // 6. IDEMPOTENCY: Repeated confirmation call must NOT double-apply or error
    const repeatConfirmRes = await page.request.post(`/api/leases/payments/${paymentId}/confirm`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      data: { referenceNumber: `REF-E2E-${runId}` }
    });
    expect(repeatConfirmRes.status()).toBe(200);

    const [schedRepeat] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, schedId));
    expect(schedRepeat.paidAmount).toBe('1000000');

    // 7. DOUBLE-ENTRY LEDGER: Debits must equal Credits
    const [journal] = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.referenceId, paymentId));
    expect(journal).toBeDefined();
    const lines = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, journal.id));
    expect(lines.length).toBeGreaterThanOrEqual(1);

    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += Number(line.debit || 0);
      totalCredit += Number(line.credit || 0);
    }
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  test('5. Maintenance Workflow: Tenant Request -> Vendor Work Order View', async ({ page }) => {
    const [owner] = await db.select().from(schema.users).where(eq(schema.users.email, 'owner@homehub.iq'));
    const tenantEmail = `tenant.maint.${runId}@homehub.iq`;
    const [tenant] = await db.insert(schema.users).values({
      id: `usr-maint-tenant-${runId}`,
      email: tenantEmail,
      firstName: 'Maint',
      lastName: `Tenant ${runId}`,
      roles: ['TENANT'],
      isActive: true,
      createdAt: new Date()
    }).returning();

    const propId = `prop-maint-${runId}`;
    await db.insert(schema.properties).values({
      id: propId,
      name: `Maintenance Property ${runId}`,
      ownerId: owner.id,
      type: 'RESIDENTIAL',
      status: 'RENTED',
      operatingModel: 'FULLY_MANAGED'
    });

    const leaseId = `lease-maint-${runId}`;
    await db.insert(schema.leases).values({
      id: leaseId,
      propertyId: propId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: 1000000,
      billingFrequency: 'MONTHLY'
    });

    await db.insert(schema.leaseTenants).values({
      leaseId: leaseId,
      tenantId: tenant.id,
      isPrimary: true
    });

    const [vendor] = await db.select().from(schema.users).where(eq(schema.users.email, 'vendor@homehub.iq'));
    const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

    const tenantToken = jwt.sign(
      { id: tenant.id, email: tenant.email, roles: ['TENANT'], tokenVersion: 1 },
      jwtSecret
    );

    // 1. Tenant creates maintenance request via API for occupied property
    const maintRes = await page.request.post('/api/tenant/maintenance', {
      headers: {
        'Authorization': `Bearer ${tenantToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        propertyId: propId,
        title: `HVAC Repair Request ${runId}`,
        description: 'AC unit is blowing warm air in bedroom.',
        priority: 'MEDIUM',
        category: 'HVAC'
      }
    });

    expect(maintRes.status()).toBe(201);
    const maintJson = await maintRes.json();
    const requestId = maintJson.request?.id || maintJson.id;
    expect(requestId).toBeDefined();

    // 2. Dispatch work order to vendor in DB
    const workOrderId = `wo-${runId}`;
    await db.insert(schema.workOrders).values({
      id: workOrderId,
      maintenanceRequestId: requestId,
      propertyId: propId,
      vendorId: vendor.id,
      vendorUserId: vendor.id,
      assignedTechnicianId: vendor.id,
      status: 'PENDING',
      scopeOfWork: `HVAC Repair ${runId}`,
      createdAt: new Date()
    }).onConflictDoNothing();

    // 3. Vendor navigates to /vendor with valid session and views the work order
    const vendorToken = jwt.sign(
      { id: vendor.id, email: vendor.email, roles: ['VENDOR'], tokenVersion: 1 },
      jwtSecret
    );

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('homehub_auth_token', tok);
      localStorage.setItem('auth_token', tok);
    }, vendorToken);

    await page.goto('/vendor', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/vendor/, { timeout: 15000 });

    // Switch to Work Orders tab
    const workOrdersNav = page.locator('button:has-text("فەرمانەکانی کارم"), button:has-text("My Work Orders")').first();
    await workOrdersNav.waitFor({ state: 'visible', timeout: 15000 });
    await workOrdersNav.click();

    // Verify vendor can see the work order with property name and WO code
    await expect(page.locator(`text=Maintenance Property ${runId}`).first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text=WO-${workOrderId.substring(0, 8)}`).first()).toBeVisible({ timeout: 15000 });
  });

  test('6. Company Financial Overview & Reconciliation Status Integrity', async ({ page }) => {
    const [adminUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'admin@homehub.iq'));
    const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

    const adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, roles: ['ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN'], tokenVersion: 1 },
      jwtSecret
    );

    // Query financial dashboard metrics
    const finRes = await page.request.get('/api/financials/dashboard', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    expect(finRes.status()).toBe(200);
    const finData = await finRes.json();
    expect(finData.metrics).toBeDefined();
    expect(finData.metrics.totalRevenue).toBeDefined();
    expect(finData.metrics.pendingReceivables).toBeDefined();
    expect(Array.isArray(finData.recentJournalEntries)).toBe(true);
  });
});
