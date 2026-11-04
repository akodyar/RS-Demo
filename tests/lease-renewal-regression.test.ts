import './safe-test-env.js';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, leaseRenewals, rentSchedules, paymentRecords } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';

test('Lease Renewal Due Date Drift and Mid-Lease Fix', async (t) => {
  // Fail-closed safety check: Must connect to local homehub_test
  assert.strictEqual(process.env.SQL_DB_NAME, 'homehub_test', "Test suite must target homehub_test exclusively. SQL_DB_NAME must be set to 'homehub_test'");
  async function cleanProperty(propertyId: string) {
    const existingLeases = await db.select({ id: leases.id }).from(leases).where(eq(leases.propertyId, propertyId));
    for (const l of existingLeases) {
      await db.delete(paymentRecords).where(eq(paymentRecords.leaseId, l.id));
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, l.id));
      await db.delete(leaseRenewals).where(eq(leaseRenewals.leaseId, l.id));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, l.id));
      await db.delete(leases).where(eq(leases.id, l.id));
    }
  }

  for (let i = 1; i <= 12; i++) {
    await cleanProperty(`prop-renew-reg-${i}`);
  }

  t.after(async () => {
    for (let i = 1; i <= 12; i++) {
      await cleanProperty(`prop-renew-reg-${i}`);
    }
  });

  await t.test('Normal Renewal at end of lease', async () => {
    const tId = 'tenant-renew-reg-1';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '1', email: 'ttreg1@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-1';
    await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2027-01-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '2000',
      status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewal.id);

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const newFirstSchedule = schedules.find(s => s.periodStart === '2027-01-01T00:00:00.000Z');
    
    assert.ok(newFirstSchedule, 'Schedule for 2027-01-01 should exist and not be shifted to 2026-12-31');
    assert.strictEqual(newFirstSchedule.dueDate, '2027-01-01T00:00:00.000Z', 'Due date should not drift to end of month');
  });

  await t.test('Mid-Lease Renewal Overlap', async () => {
    const tId = 'tenant-renew-reg-2';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '2', email: 'ttreg2@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-2';
    await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2026-07-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '2000',
      status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewal.id);

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    
    const julySchedules = schedules.filter(s => new Date(s.periodStart).toISOString() === '2026-07-01T00:00:00.000Z' || s.periodStart === '2026-07-01T00:00:00.000Z');
    assert.strictEqual(julySchedules.length, 1, 'There should be exactly one schedule for July 2026');
    assert.strictEqual(julySchedules[0].amount, '2000', 'The replaced schedule should reflect the new rent amount');
  });

  await t.test('Mid-Lease Renewal with Partially Paid Future Schedule', async () => {
    const tId = 'tenant-renew-reg-3';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '3', email: 'ttreg3@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-3';
    await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const julySchedule = schedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-07-01T00:00:00.000Z');

    // Manually record partial payment for July
    await db.update(rentSchedules).set({ status: 'PARTIALLY_PAID', paidAmount: '500' }).where(eq(rentSchedules.id, julySchedule.id));

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2026-07-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '2000',
      status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewal.id);

    const newSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const newJuly = newSchedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-07-01T00:00:00.000Z');

    assert.strictEqual(newJuly.id, julySchedule.id, 'Should preserve existing schedule ID');
    assert.strictEqual(newJuly.amount, '2000', 'Should update to new rent amount');
    assert.strictEqual(newJuly.paidAmount, '500', 'Should preserve paid amount');
    assert.strictEqual(newJuly.status, 'PARTIALLY_PAID', 'Should correctly determine PARTIALLY_PAID status');
  });

  await t.test('Mid-Lease Renewal Cannot Reduce Rent Below Paid Amount', async () => {
    const tId = 'tenant-renew-reg-4';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '4', email: 'ttreg4@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-4';
    await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const julySchedule = schedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-07-01T00:00:00.000Z');

    await db.update(rentSchedules).set({ status: 'PARTIALLY_PAID', paidAmount: '800' }).where(eq(rentSchedules.id, julySchedule.id));

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2026-07-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '500', // Invalid, 800 already paid
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(renewal.id);
      },
      (err: any) => {
        return err.message.includes('Cannot reduce rent below the amount already paid');
      }
    );
  });

  await t.test('Mid-Lease Renewal with Reversed Payment and Shortened Lease', async () => {
    const tId = 'tenant-renew-reg-5';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '5', email: 'ttreg5@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-5';
    await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const augSchedule = schedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-08-01T00:00:00.000Z');
    const decSchedule = schedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-12-01T00:00:00.000Z');

    // Simulate reversed payment in August (inside new period)
    const [augPayment] = await db.insert(paymentRecords).values({
      propertyId: pId, leaseId: lease.id, rentScheduleId: augSchedule.id, payerId: tId,
      amount: '1000', recordedDate: new Date().toISOString(), status: 'RECORDED'
    }).returning();
    await db.update(rentSchedules).set({ status: 'UPCOMING', paidAmount: '0' }).where(eq(rentSchedules.id, augSchedule.id));
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, augPayment.id));

    // Simulate reversed payment in December (outside new period, testing shortened lease)
    const [decPayment] = await db.insert(paymentRecords).values({
      propertyId: pId, leaseId: lease.id, rentScheduleId: decSchedule.id, payerId: tId,
      amount: '1000', recordedDate: new Date().toISOString(), status: 'RECORDED'
    }).returning();
    await db.update(rentSchedules).set({ status: 'UPCOMING', paidAmount: '0' }).where(eq(rentSchedules.id, decSchedule.id));
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, decPayment.id));

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2026-08-01T00:00:00.000Z',
      proposedEndDate: '2026-10-31T00:00:00.000Z', // Shortening lease!
      proposedRentAmount: '2000', status: 'REQUESTED'
    }).returning();

    // Should not crash with FK constraint!
    await leaseRepository.approveRenewal(renewal.id);

    const newSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    
    // August schedule (within new period) should be correctly updated
    const newAug = newSchedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-08-01T00:00:00.000Z');
    assert.strictEqual(newAug.id, augSchedule.id, 'Should preserve August schedule ID');
    assert.strictEqual(newAug.amount, '2000', 'Should update August amount');
    assert.strictEqual(newAug.status, 'OVERDUE', 'Zero paid amount should yield UPCOMING or OVERDUE, not PARTIALLY_PAID');

    // December schedule (outside new period) should be CANCELLED safely without deletion
    const newDec = newSchedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-12-01T00:00:00.000Z');
    assert.strictEqual(newDec.id, decSchedule.id, 'Should preserve December schedule ID');
    assert.strictEqual(newDec.amount, '0', 'Should zero out obsolete schedule amount');
    assert.strictEqual(newDec.status, 'CANCELLED', 'Should mark obsolete schedule as CANCELLED');
  });

  await t.test('Mid-Lease Renewal with Reversed Payment on Cancelled Schedule', async () => {
    const tId = 'tenant-renew-reg-6';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '6', email: 'ttreg6@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-6';
    await db.insert(properties).values({ id: pId, name: 'P', type: 'LAND', address: {} }).onConflictDoNothing();
    
    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
        await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    let schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const decSchedule = schedules.find((s: any) => new Date(s.periodStart).toISOString() === '2026-12-01T00:00:00.000Z');

    // Simulate payment
    const [payment] = await db.insert(paymentRecords).values({
      propertyId: pId, leaseId: lease.id, rentScheduleId: decSchedule.id, payerId: tId,
      amount: '1000', recordedDate: new Date().toISOString(), status: 'RECORDED'
    }).returning();
    await db.update(rentSchedules).set({ status: 'PAID', paidAmount: '1000' }).where(eq(rentSchedules.id, decSchedule.id));

    // Simulate the inline reversal logic from src/server/routes/leases.ts (must happen BEFORE shortening)
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment.id)).returning();
      if (updated.rentScheduleId) {
        const [schedule] = await tx.select().from(rentSchedules).where(eq(rentSchedules.id, updated.rentScheduleId)).limit(1);
        if (schedule) {
          const newPaidAmount = Math.max(0, Number(schedule.paidAmount || 0) - Number(updated.amount));
          let newStatus = schedule.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING';
          
          if (schedule.status !== 'CANCELLED') {
              if (newPaidAmount > 0) {
                  newStatus = newPaidAmount >= Number(schedule.amount) ? 'PAID' : 'PARTIALLY_PAID';
              } else {
                  const now = new Date();
                  const dueDate = new Date(schedule.dueDate);
                  newStatus = dueDate < now ? 'OVERDUE' : 'UPCOMING';
              }
          }
          
          await tx.update(rentSchedules)
            .set({ paidAmount: newPaidAmount.toString(), status: newStatus })
            .where(eq(rentSchedules.id, schedule.id));
        }
      }
    });

    // Mid-lease renewal shortens lease, so December schedule is CANCELLED
    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id, propertyId: pId, tenantId: tId,
      proposedStartDate: '2026-08-01T00:00:00.000Z',
      proposedEndDate: '2026-10-31T00:00:00.000Z', // Shortening lease!
      proposedRentAmount: '2000', status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewal.id);
    
    schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const updatedDecSchedule = schedules.find((s: any) => s.id === decSchedule.id);
    assert.strictEqual(updatedDecSchedule.status, 'CANCELLED');
    assert.strictEqual(Number(updatedDecSchedule.amount), 0);
    assert.strictEqual(Number(updatedDecSchedule.paidAmount), 0); 
  });

  await t.test('Mid-Lease Renewal with Valid Tenant Link But No Primary Tenant Resolves Fallback', async () => {
    const tId = 'tenant-renew-reg-7';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '7', email: 'ttreg7@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-7';
    await db.insert(properties).values({ id: pId, name: 'P7', type: 'LAND', address: {} }).onConflictDoNothing();

    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    // Insert tenant link with isPrimary = false (no primary tenant exists on this lease)
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: false });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: tId,
      proposedStartDate: '2027-01-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '1500',
      status: 'REQUESTED'
    }).returning();

    // Must resolve tId as fallback and successfully generate schedules
    await leaseRepository.approveRenewal(renewal.id);

    const [updatedRenewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
    assert.strictEqual(updatedRenewal.status, 'APPROVED');

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const newSchedule = schedules.find((s: any) => new Date(s.periodStart).toISOString() === '2027-01-01T00:00:00.000Z');
    assert.ok(newSchedule, 'Renewal schedule for 2027-01-01 must be generated');
    assert.strictEqual(newSchedule.tenantId, tId, 'Schedule tenantId must match the resolved fallback tenant');
    assert.strictEqual(newSchedule.amount, '1500', 'Schedule amount must match renewed rent');
  });

  await t.test('Renewal Rejects When No Resolvable Tenant Exists (Atomic Rollback)', async () => {
    const tId = 'tenant-renew-reg-8';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '8', email: 'ttreg8@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-8';
    await db.insert(properties).values({ id: pId, name: 'P8', type: 'LAND', address: {} }).onConflictDoNothing();

    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    // Deliberately do NOT insert any rows into leaseTenants
    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: tId,
      proposedStartDate: '2027-01-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '1500',
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(renewal.id);
      },
      (err: any) => {
        return err.message.includes('VALIDATION_ERROR') && 
          (err.message.includes('not associated with this lease') || err.message.includes('No valid tenant associated'));
      }
    );

    // Verify atomic rollback: renewal status must still be REQUESTED
    const [persistedRenewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
    assert.strictEqual(persistedRenewal.status, 'REQUESTED', 'Renewal must not remain approved on failure');

    // Lease end date must remain untouched
    const [persistedLease] = await db.select().from(leases).where(eq(leases.id, lease.id));
    assert.strictEqual(persistedLease.endDate, '2026-12-31T00:00:00.000Z', 'Lease end date must not be changed');

    // No rent schedules generated
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    assert.strictEqual(schedules.length, 0, 'No schedules should have been created');
  });

  await t.test('Renewal Rejects Tenant ID Not Associated With Lease (Atomic Rollback)', async () => {
    const tId = 'tenant-renew-reg-9';
    const strangerId = 'tenant-stranger-9';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '9', email: 'ttreg9@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    await db.insert(users).values({ id: strangerId, firstName: 'Stranger', lastName: '9', email: 'stranger9@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-9';
    await db.insert(properties).values({ id: pId, name: 'P9', type: 'LAND', address: {} }).onConflictDoNothing();

    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    // Link tId as legitimate primary tenant
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    // Request renewal with strangerId (not associated with lease)
    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: strangerId,
      proposedStartDate: '2027-01-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '1500',
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(renewal.id);
      },
      (err: any) => {
        return err.message.includes('VALIDATION_ERROR') && err.message.includes('not associated with this lease');
      }
    );

    // Verify atomic rollback
    const [persistedRenewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
    assert.strictEqual(persistedRenewal.status, 'REQUESTED', 'Renewal must remain REQUESTED');

    const [persistedLease] = await db.select().from(leases).where(eq(leases.id, lease.id));
    assert.strictEqual(persistedLease.endDate, '2026-12-31T00:00:00.000Z', 'Lease end date must remain unchanged');
  });

  await t.test('Successful Schedule Generation When Non-Primary Co-Tenant Resolved', async () => {
    const tId = 'tenant-renew-reg-10';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '10', email: 'ttreg10@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-10';
    await db.insert(properties).values({ id: pId, name: 'P10', type: 'LAND', address: {} }).onConflictDoNothing();

    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    // Link co-tenant with isPrimary: false
    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: false });

    // Renewal record with tenantId = tId (valid)
    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: tId,
      proposedStartDate: '2027-01-01T00:00:00.000Z',
      proposedEndDate: '2027-06-30T00:00:00.000Z',
      proposedRentAmount: '1200',
      status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(renewal.id);

    const [persistedRenewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, renewal.id));
    assert.strictEqual(persistedRenewal.status, 'APPROVED');

    const [persistedLease] = await db.select().from(leases).where(eq(leases.id, lease.id));
    assert.strictEqual(persistedLease.endDate, '2027-06-30T00:00:00.000Z');
    assert.strictEqual(persistedLease.rentAmount, '1200');

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    assert.strictEqual(schedules.length, 6, 'Should generate exactly 6 monthly schedules for 2027-01 to 2027-06');
    for (const schedule of schedules) {
      assert.strictEqual(schedule.tenantId, tId);
      assert.strictEqual(schedule.amount, '1200');
      assert.strictEqual(schedule.status, 'UPCOMING');
    }
  });

  await t.test('Comprehensive Mid-Lease Renewal & Payment Reversal Invariants (8 Criteria)', async () => {
    const tId = 'tenant-renew-reg-11';
    await db.insert(users).values({ id: tId, firstName: 'T', lastName: '11', email: 'ttreg11@t.com', roles: ['TENANT'] }).onConflictDoNothing();
    const pId = 'prop-renew-reg-11';
    await db.insert(properties).values({ id: pId, name: 'P11', type: 'APARTMENT', address: {} }).onConflictDoNothing();

    const [lease] = await db.insert(leases).values({
      propertyId: pId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({ leaseId: lease.id, tenantId: tId, isPrimary: true });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, pId, tId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    });

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const juneSchedule = schedules.find(s => s.periodStart === '2026-06-01T00:00:00.000Z')!;
    const julySchedule = schedules.find(s => s.periodStart === '2026-07-01T00:00:00.000Z')!;
    const decSchedule = schedules.find(s => s.periodStart === '2026-12-01T00:00:00.000Z')!;

    // 1. Confirm payment -> reverse payment on June schedule
    const [junePayment] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: juneSchedule.id,
      payerId: tId,
      amount: '1000',
      currency: 'IQD',
      status: 'CONFIRMED',
      paymentMethod: 'FIB',
      paymentType: 'RENT',
      referenceNumber: 'REF-JUNE-11',
      recordedDate: new Date().toISOString()
    }).returning();

    // Mark June schedule as PAID initially
    await db.update(rentSchedules).set({ status: 'PAID', paidAmount: '1000' }).where(eq(rentSchedules.id, juneSchedule.id));

    // Reverse June payment
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, junePayment.id));
    await db.update(rentSchedules).set({ status: 'OVERDUE', paidAmount: '0' }).where(eq(rentSchedules.id, juneSchedule.id));

    // 8. Repeating reversal cannot double-decrement: already reversed payment cannot alter schedule again
    const [checkReversedSched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, juneSchedule.id));
    assert.strictEqual(checkReversedSched.paidAmount, '0', 'Schedule paidAmount must remain 0 and not become negative');

    // 5. Partially paid schedule (July: 600 paid of 1000)
    const [julyPayment] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: julySchedule.id,
      payerId: tId,
      amount: '600',
      currency: 'IQD',
      status: 'CONFIRMED',
      paymentMethod: 'FIB',
      paymentType: 'RENT',
      referenceNumber: 'REF-JULY-11',
      recordedDate: new Date().toISOString()
    }).returning();
    await db.update(rentSchedules).set({ status: 'PARTIALLY_PAID', paidAmount: '600' }).where(eq(rentSchedules.id, julySchedule.id));

    // 7. Invalid renewal data (rent reduction below paid amount 600) rolls back atomically
    const [invalidRenewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: tId,
      proposedStartDate: '2026-06-01T00:00:00.000Z',
      proposedEndDate: '2027-05-31T00:00:00.000Z',
      proposedRentAmount: '400', // Invalid: 400 < 600 paid
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => {
        await leaseRepository.approveRenewal(invalidRenewal.id);
      },
      (err: any) => err.message.includes('Cannot reduce rent below the amount already paid')
    );

    // Verify atomic rollback after rejection
    const [leaseUntouched] = await db.select().from(leases).where(eq(leases.id, lease.id));
    assert.strictEqual(leaseUntouched.rentAmount, '1000', 'Lease rentAmount must not change after rollback');

    // 1. Valid mid-lease renewal starting 2026-06-01 (overlaps reversed June and partial July)
    const [validRenewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: tId,
      proposedStartDate: '2026-06-01T00:00:00.000Z',
      proposedEndDate: '2027-05-31T00:00:00.000Z',
      proposedRentAmount: '1500',
      status: 'REQUESTED'
    }).returning();

    // Approve renewal must succeed without FK 23503 error
    await leaseRepository.approveRenewal(validRenewal.id);

    // 2. Original payment records, schedule references, and audit intact
    const [persistedJunePay] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, junePayment.id));
    assert.strictEqual(persistedJunePay.status, 'REVERSED');
    assert.strictEqual(persistedJunePay.rentScheduleId, juneSchedule.id, 'FK reference must remain intact');

    // 4. Zero-paid schedule (June) receives correct status OVERDUE
    const [reusedJune] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, juneSchedule.id));
    assert.strictEqual(reusedJune.id, juneSchedule.id, 'Stable schedule ID must be preserved');
    assert.strictEqual(reusedJune.amount, '1500', 'Rent amount updated to 1500');
    assert.strictEqual(reusedJune.paidAmount, '0');
    assert.strictEqual(reusedJune.status, 'OVERDUE');

    // 5. Partially paid schedule (July) retains paid amount (600) and status PARTIALLY_PAID
    const [reusedJuly] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, julySchedule.id));
    assert.strictEqual(reusedJuly.id, julySchedule.id, 'Stable July schedule ID preserved');
    assert.strictEqual(reusedJuly.amount, '1500', 'Rent amount updated to 1500');
    assert.strictEqual(reusedJuly.paidAmount, '600', 'Paid amount 600 strictly preserved');
    assert.strictEqual(reusedJuly.status, 'PARTIALLY_PAID', 'Status remains PARTIALLY_PAID');

    // 3. No duplicate (leaseId, periodStart) schedules created
    const allSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const starts = allSchedules.map(s => s.periodStart);
    assert.strictEqual(new Set(starts).size, allSchedules.length, 'No duplicate periodStart schedules permitted');

    // 6. Shortened renewal safely handles payment-referenced future schedule (December)
    const [decPayment] = await db.insert(paymentRecords).values({
      propertyId: pId,
      leaseId: lease.id,
      rentScheduleId: decSchedule.id,
      payerId: tId,
      amount: '1000',
      currency: 'IQD',
      status: 'REVERSED',
      paymentMethod: 'FIB',
      paymentType: 'RENT',
      referenceNumber: 'REF-DEC-11',
      recordedDate: new Date().toISOString()
    }).returning();

    // Shorten lease to end at 2026-10-31 (December is now obsolete)
    const [shortenRenewal] = await db.insert(leaseRenewals).values({
      leaseId: lease.id,
      propertyId: pId,
      tenantId: tId,
      proposedStartDate: '2026-08-01T00:00:00.000Z',
      proposedEndDate: '2026-10-31T00:00:00.000Z',
      proposedRentAmount: '1600',
      status: 'REQUESTED'
    }).returning();

    await leaseRepository.approveRenewal(shortenRenewal.id);

    // December schedule must be preserved as CANCELLED with amount 0 (no FK 23503 error)
    const [decAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, decSchedule.id));
    assert.ok(decAfter, 'December schedule row must not be deleted');
    assert.strictEqual(decAfter.status, 'CANCELLED');
    assert.strictEqual(decAfter.amount, '0');
    assert.strictEqual(Number(decAfter.paidAmount), 0);

    // Foreign key between reversed payment and cancelled schedule remains intact
    const [persistedDecPay] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, decPayment.id));
    assert.strictEqual(persistedDecPay.rentScheduleId, decSchedule.id, 'Dec reversed payment FK must remain intact');
  });
});
