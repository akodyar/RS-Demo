import test from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, leaseRenewals, rentSchedules } from '../src/db/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';

// Load environment configuration
dotenv.config({ override: false });

// ============================================================================
// HARD FAIL-CLOSED SAFETY GATE
// Strictly enforce target database is local homehub_test before execution
// ============================================================================
const TARGET_TEST_DATABASE = 'homehub_test';

function assertSafeDatabaseConfig(): void {
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}'. Got: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  if (process.env.DATABASE_URL) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed. Aborting.`);
    }

    if (parsedUrl.pathname !== `/${TARGET_TEST_DATABASE}`) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL pathname must be '/${TARGET_TEST_DATABASE}'. Got: '${parsedUrl.pathname}'. Aborting.`);
    }
  }
}

test('Mid-Lease Renewal Cadence Shift', async (t) => {
  assertSafeDatabaseConfig();

  // Verify active database on real connection
  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(activeDb, TARGET_TEST_DATABASE, `Must be connected to '${TARGET_TEST_DATABASE}'. Got: '${activeDb}'`);

  const runId = `dup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tId = `tenant_${runId}`;
  const pId = `prop_${runId}`;

  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdRenewalIds: string[] = [];

  async function cleanupFixtures() {
    for (const renId of createdRenewalIds) {
      await db.delete(leaseRenewals).where(eq(leaseRenewals.id, renId));
    }
    for (const leaseId of createdLeaseIds) {
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
      await db.delete(leases).where(eq(leases.id, leaseId));
    }
    for (const propId of createdPropertyIds) {
      await db.delete(properties).where(eq(properties.id, propId));
    }
    for (const userId of createdUserIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  }

  try {
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: 'Dup', email: `${runId}@example.com`, roles: ['TENANT'] });
    createdUserIds.push(tId);
    await db.insert(properties).values({ id: pId, name: `P-Dup-${runId}`, type: 'LAND', address: {} });
    createdPropertyIds.push(pId);
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();
    createdLeaseIds.push(lease.id);

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    // Current schedules: 2026-07-01, 2026-08-01, ...
    
    // Now we renew mid-lease, but change the cadence to start on the 15th!
    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2026-07-15T00:00:00.000Z',
      proposedEndDate: '2027-07-14T00:00:00.000Z',
      proposedRentAmount: '2000',
      status: 'REQUESTED'
    }).returning();
    createdRenewalIds.push(renewal.id);

    await leaseRepository.approveRenewal(renewal.id);

    // Check schedules in July 2026
    const schedules = await db.select().from(rentSchedules).where(and(
      eq(rentSchedules.leaseId, lease.id),
      gte(rentSchedules.periodStart, '2026-07-01T00:00:00.000Z'),
      lte(rentSchedules.periodStart, '2026-07-31T00:00:00.000Z')
    ));

    // If there's a duplicate, we will see one for 07-01 and one for 07-15!
    console.log("Schedules for July:", schedules.map(s => ({ periodStart: s.periodStart, status: s.status })));
    
    // August 2026?
    const augSchedules = await db.select().from(rentSchedules).where(and(
      eq(rentSchedules.leaseId, lease.id),
      gte(rentSchedules.periodStart, '2026-08-01T00:00:00.000Z'),
      lte(rentSchedules.periodStart, '2026-08-31T00:00:00.000Z')
    ));
    console.log("Schedules for August:", augSchedules.map(s => ({ periodStart: s.periodStart, status: s.status })));

    const activeAugSchedules = augSchedules.filter(s => s.status !== 'CANCELLED');
    assert.strictEqual(activeAugSchedules.length, 1, 'There should only be one active schedule per month period even if cadence shifts');
  } finally {
    await cleanupFixtures();
  }
});

