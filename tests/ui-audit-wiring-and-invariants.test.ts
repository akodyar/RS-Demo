process.env.SQL_DB_NAME = 'homehub_test';
import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db, closePool } from '../src/db/index.js';
import {
  users,
  properties,
  units,
  leases,
  leaseTenants,
  ownershipRecords,
  securityDeposits,
  securityDepositDeductions,
} from '../src/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, signAuthToken } from '../src/server/utils/auth.js';
import { ownerRepository } from '../src/server/repositories/owner.js';

test('UI Audit Wiring & Invariants: activeLeaseId, Deposit API, and Expired Dispute Window', async (t) => {
  // Pre-flight check
  process.env.SQL_DB_NAME = 'homehub_test';
  await closePool();
  const connCheck = await (db as any).execute('SELECT current_database() as db_name, current_user as db_user');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, 'homehub_test', 'MUST connect strictly to homehub_test');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const runId = `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const ownerId = `usr_own_${runId}`;
  const tenantId = `usr_ten_${runId}`;
  const propId = `prop_${runId}`;
  const unitId = `unit_${runId}`;
  const leaseId = `lease_${runId}`;
  const depositId = `dep_${runId}`;
  const deductionExpiredId = `ded_exp_${runId}`;

  const pwdHash = await hashPassword('Password123!');
  const ownerToken = signAuthToken({ id: ownerId, email: `owner_${runId}@homehub.iq`, roles: ['PROPERTY_OWNER', 'OWNER'] });
  const tenantToken = signAuthToken({ id: tenantId, email: `tenant_${runId}@homehub.iq`, roles: ['TENANT'] });

  try {
    // 1. Seed users
    await db.insert(users).values([
      {
        id: ownerId,
        email: `owner_${runId}@homehub.iq`,
        passwordHash: pwdHash,
        phone: `+964750100${Math.floor(1000 + Math.random() * 9000)}`,
        roles: ['PROPERTY_OWNER', 'OWNER'],
        status: 'ACTIVE',
        firstName: 'AuditOwner',
        lastName: 'Erbil',
      },
      {
        id: tenantId,
        email: `tenant_${runId}@homehub.iq`,
        passwordHash: pwdHash,
        phone: `+964750200${Math.floor(1000 + Math.random() * 9000)}`,
        roles: ['TENANT'],
        status: 'ACTIVE',
        firstName: 'AuditTenant',
        lastName: 'Hawler',
      },
    ]);

    // 2. Seed property and ownership
    await db.insert(properties).values({
      id: propId,
      name: `Audit Tower ${runId}`,
      address: { city: 'Erbil', district: 'Dream City' },
      type: 'APARTMENT',
      status: 'AVAILABLE',
      currency: 'IQD',
      operatingModel: 'DIRECT_MANAGEMENT',
    });

    await db.insert(ownershipRecords).values({
      id: `own_rec_${runId}`,
      propertyId: propId,
      ownerId: ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100.00',
      isPrimary: true,
      ownershipType: 'SOLE_OWNER',
    });

    // 3. Seed unit and active lease
    await db.insert(units).values({
      id: unitId,
      propertyId: propId,
      unitNumber: '101',
      rentAmount: '1200000',
      status: 'OCCUPIED',
    });

    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 3600 * 1000);

    await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
      unitId: unitId,
      status: 'ACTIVE',
      rentAmount: '1200000',
      currency: 'IQD',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      securityDeposit: '1200000',
    });

    await db.insert(leaseTenants).values({
      id: `lt_${runId}`,
      leaseId: leaseId,
      tenantId: tenantId,
      isPrimary: true,
    });

    // 4. Seed security deposit
    await db.insert(securityDeposits).values({
      id: depositId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenantId,
      requiredAmount: '1200000',
      recordedAmount: '1200000',
      currency: 'IQD',
      status: 'HELD',
    });

    // 5. Seed deduction with expired dispute deadline (e.g., 5 days ago)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000);
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 3600 * 1000);

    await db.insert(securityDepositDeductions).values({
      id: deductionExpiredId,
      depositId: depositId,
      leaseId: leaseId,
      proposedById: ownerId,
      amount: '150000',
      currency: 'IQD',
      category: 'DAMAGE',
      description: 'Broken window latch - expired contestation window',
      status: 'OWNER_APPROVED',
      noticeDeliveryStatus: 'DELIVERED',
      tenantNotifiedAt: thirtyFiveDaysAgo,
      disputeDeadline: fiveDaysAgo,
    });

    // TEST 1: Verify ownerRepository.getScopedOwnerProperties returns activeLeaseId
    await t.test('1. OwnerRepository maps activeLeaseId in returned properties', async () => {
      const ownerUser = { id: ownerId, role: 'PROPERTY_OWNER', roles: ['PROPERTY_OWNER', 'OWNER'] };
      const props = await ownerRepository.getScopedOwnerProperties(ownerUser);
      const matched = props.find((p) => p.id === propId);
      assert.ok(matched, 'Property must be returned');
      assert.strictEqual(matched.activeLeaseId, leaseId, 'Property must have activeLeaseId populated');
      assert.strictEqual(matched.status, 'Occupied');
      console.log('✓ Test 1: activeLeaseId properly populated in owner repository');
    });

    // TEST 2: Verify Owner Deposit endpoint works with leaseId
    await t.test('2. Owner Deposit API endpoint returns authoritative escrow balances', async () => {
      const res = await fetch(`${baseUrl}/owner/leases/${leaseId}/deposit`, {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
      });
      assert.strictEqual(res.status, 200, 'Owner deposit endpoint must return 200 OK');
      const data = await res.json();
      assert.ok(data.id, 'Must return deposit details');
      assert.strictEqual(data.status, 'HELD');
      assert.strictEqual(Number(data.recordedAmount), 1200000);
      assert.strictEqual(Number(data.requiredAmount), 1200000);
      console.log('✓ Test 2: Deposit API successfully returns authoritative balances');
    });

    // TEST 3: Verify Expired Dispute Window Rejection
    await t.test('3. Tenant dispute submission fails closed (400) if 30-day window expired', async () => {
      const res = await fetch(`${baseUrl}/tenant/deductions/${deductionExpiredId}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tenantToken}`,
        },
        body: JSON.stringify({
          disputeReason: 'Late contestation attempt',
        }),
      });
      assert.strictEqual(res.status, 400, 'Must return 400 Bad Request for expired contestation window');
      const data = await res.json();
      assert.ok(
        data.error?.toLowerCase().includes('expired') || data.error?.toLowerCase().includes('window') || data.message?.toLowerCase().includes('expired'),
        'Error must state dispute deadline has passed'
      );
      console.log('✓ Test 3: Expired dispute window correctly rejected by backend');
    });

    // TEST 4: Verify Tenant Deposit endpoint works for tenant on lease
    await t.test('4. Tenant Deposit API endpoint returns authoritative escrow balances to tenant', async () => {
      const res = await fetch(`${baseUrl}/tenant/leases/${leaseId}/deposit`, {
        headers: {
          Authorization: `Bearer ${tenantToken}`,
        },
      });
      assert.strictEqual(res.status, 200, 'Tenant deposit endpoint must return 200 OK');
      const data = await res.json();
      assert.ok(data.id, 'Must return deposit details');
      assert.strictEqual(data.status, 'HELD');
      assert.strictEqual(Number(data.recordedAmount), 1200000);
      assert.strictEqual(Number(data.requiredAmount), 1200000);
      console.log('✓ Test 4: Tenant Deposit API successfully returns authoritative balances');
    });

    // TEST 5: Verify Property Financial Summary endpoint derives active lease and fee structure
    await t.test('5. Property Financial Summary endpoint derives active lease and fee structure', async () => {
      const res = await fetch(`${baseUrl}/properties/${propId}/financial-summary`, {
        headers: {
          Authorization: `Bearer ${ownerToken}`,
        },
      });
      assert.strictEqual(res.status, 200, 'Financial summary endpoint must return 200 OK');
      const data = await res.json();
      assert.strictEqual(data.propertyId, propId);
      assert.strictEqual(data.hasActiveLease, true);
      assert.strictEqual(data.activeLeaseId, leaseId);
      console.log('✓ Test 5: Property financial summary correctly derives active lease ID');
    });

  } finally {
    if ((server as any).closeAllConnections) {
      (server as any).closeAllConnections();
    }
    server.close();
    server.unref();

    try {
      await db.delete(securityDepositDeductions).where(eq(securityDepositDeductions.depositId, depositId));
      await db.delete(securityDeposits).where(eq(securityDeposits.id, depositId));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
      await db.delete(leases).where(eq(leases.id, leaseId));
      await db.delete(units).where(eq(units.id, unitId));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
      await db.delete(properties).where(eq(properties.id, propId));
      await db.delete(users).where(sql`id IN (${ownerId}, ${tenantId})`);
    } catch (_) {}

    await closePool();
    setTimeout(() => process.exit(0), 100).unref();
  }
});
