process.env.SQL_HOST = 'localhost';
import test, { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index';
import { users, properties, leases, leaseTenants, rentSchedules, leaseRenewals, paymentRecords, commissions, ledgerLines } from '../src/db/schema';
import { leaseRepository } from '../src/server/repositories/leases';
import { tenantRepository } from '../src/server/repositories/tenant';
import { commissionService } from '../src/server/services/commission';
import { eq, asc } from 'drizzle-orm';

describe('Lease Shortening Financial Integrity', () => {
  let propertyId: string;
  let tenantId: string;
  let leaseId: string;

  before(async () => {
    const pId = `prop-shorten-${Date.now()}`;
    const tId = `ten-shorten-${Date.now()}`;
    
    await db.insert(users).values([
      { id: tId, firstName: 'Tenant', lastName: 'Short', email: `${tId}@test.com`, roles: ['TENANT'] }
    ]).onConflictDoNothing();
    
    await db.insert(properties).values({ 
      id: pId, 
      name: 'Prop Shorten', 
      type: 'LAND', 
      address: {}, 
      operatingModel: 'AGENT_OPERATED' 
    });

    propertyId = pId;
    tenantId = tId;
  });

  async function createLease(startDate: string, endDate: string) {
    const pId = `prop-shorten-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await db.insert(properties).values({ 
      id: pId, 
      name: 'Prop Shorten', 
      type: 'LAND', 
      address: {}, 
      operatingModel: 'AGENT_OPERATED' 
    });

    const [lease] = await db.insert(leases).values({ 
      propertyId: pId, 
      startDate, 
      endDate, 
      rentAmount: '1000', 
      status: 'ACTIVE' 
    }).returning();
    
    await db.insert(leaseTenants).values({ 
      leaseId: lease.id, 
      tenantId, 
      isPrimary: true 
    });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(tx, lease.id, pId, tenantId, null, startDate, endDate, 1000);
    });

    return { leaseId: lease.id, propertyId: pId };
  }

  it('1. Rejects shortening when an obsolete schedule has an unreconciled partial payment', async () => {
    const { leaseId: lId, propertyId: pId } = await createLease('2026-01-01', '2027-01-01');
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lId)).orderBy(asc(rentSchedules.dueDate));
    const targetSchedule = schedules[6]; // Month 7

    const recordResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: pId,
      leaseId: lId,
      scheduleId: targetSchedule.id,
      amount: 500,
      currency: 'IQD',
      paymentMethod: 'CASH',
    });

    // Mark payment CONFIRMED and update schedule paidAmount to simulate collected payment
    await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, recordResult.payment.id));
    await db.update(rentSchedules).set({ paidAmount: '500', status: 'PARTIALLY_PAID' }).where(eq(rentSchedules.id, targetSchedule.id));

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lId,
      propertyId: pId,
      tenantId,
      proposedStartDate: '2026-01-01',
      proposedEndDate: '2026-07-01', // Before Month 7
      proposedRentAmount: '1000',
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => { await leaseRepository.approveRenewal(renewal.id); },
      /has collected payments/
    );
  });

  it('2. Rejects shortening when an obsolete schedule has an unreconciled full payment', async () => {
    const { leaseId: lId, propertyId: pId } = await createLease('2026-01-01', '2027-01-01');
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lId)).orderBy(asc(rentSchedules.dueDate));
    const targetSchedule = schedules[6];

    const recordResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: pId,
      leaseId: lId,
      scheduleId: targetSchedule.id,
      amount: 1000,
      currency: 'IQD',
      paymentMethod: 'CASH',
    });

    // Mark payment CONFIRMED and update schedule paidAmount
    await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, recordResult.payment.id));
    await db.update(rentSchedules).set({ paidAmount: '1000', status: 'PAID' }).where(eq(rentSchedules.id, targetSchedule.id));

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lId,
      propertyId: pId,
      tenantId,
      proposedStartDate: '2026-01-01',
      proposedEndDate: '2026-07-01',
      proposedRentAmount: '1000',
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => { await leaseRepository.approveRenewal(renewal.id); },
      /has collected payments/
    );
  });

  it('4. A rejected renewal leaves the lease and schedules unchanged', async () => {
    const { leaseId: lId, propertyId: pId } = await createLease('2026-01-01', '2027-01-01');
    const schedulesBefore = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lId)).orderBy(asc(rentSchedules.dueDate));
    const targetSchedule = schedulesBefore[6];

    const recordResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: pId,
      leaseId: lId,
      scheduleId: targetSchedule.id,
      amount: 500,
      currency: 'IQD',
      paymentMethod: 'CASH',
    });

    // Mark payment CONFIRMED and update schedule paidAmount
    await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, recordResult.payment.id));
    await db.update(rentSchedules).set({ paidAmount: '500', status: 'PARTIALLY_PAID' }).where(eq(rentSchedules.id, targetSchedule.id));

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lId,
      propertyId: pId,
      tenantId,
      proposedStartDate: '2026-01-01',
      proposedEndDate: '2026-07-01',
      proposedRentAmount: '1000',
      status: 'REQUESTED'
    }).returning();

    await assert.rejects(
      async () => { await leaseRepository.approveRenewal(renewal.id); }
    );

    const [leaseAfter] = await db.select().from(leases).where(eq(leases.id, lId));
    assert.strictEqual(leaseAfter.endDate, '2027-01-01');

    const schedulesAfter = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lId)).orderBy(asc(rentSchedules.dueDate));
    const targetAfter = schedulesAfter.find(s => s.id === targetSchedule.id);
    assert.strictEqual(targetAfter?.amount, '1000');
    assert.strictEqual(targetAfter?.paidAmount, '500');
    assert.strictEqual(targetAfter?.status, 'PARTIALLY_PAID');
  });

  it('3. A fully reversed payment does not block renewal, and preserves history', async () => {
    const { leaseId: lId, propertyId: pId } = await createLease('2026-01-01', '2027-01-01');
    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lId)).orderBy(asc(rentSchedules.dueDate));
    const targetSchedule = schedules[6];

    const recordResult = await tenantRepository.recordRentPayment(tenantId, {
      propertyId: pId,
      leaseId: lId,
      scheduleId: targetSchedule.id,
      amount: 1000,
      currency: 'IQD',
      paymentMethod: 'CASH',
    });

    const pIdRecord = recordResult.payment.id;

    // Simulate Reversal (which zeroes out paidAmount via Math.max(0, ...))
    await db.transaction(async (tx) => {
      const [updated] = await tx.update(paymentRecords)
        .set({ status: 'REVERSED' })
        .where(eq(paymentRecords.id, pIdRecord))
        .returning();

      const [schedule] = await tx.select().from(rentSchedules).where(eq(rentSchedules.id, targetSchedule.id)).limit(1);
      const newPaidAmount = Math.max(0, Number(schedule.paidAmount || 0) - Number(updated.amount));
      await tx.update(rentSchedules).set({ paidAmount: newPaidAmount.toString(), status: 'UPCOMING' }).where(eq(rentSchedules.id, schedule.id));
    });

    const [renewal] = await db.insert(leaseRenewals).values({
      leaseId: lId,
      propertyId: pId,
      tenantId,
      proposedStartDate: '2026-01-01',
      proposedEndDate: '2026-07-01',
      proposedRentAmount: '1000',
      status: 'REQUESTED'
    }).returning();

    // Should succeed because paidAmount is 0
    await leaseRepository.approveRenewal(renewal.id);

    const [paymentRecordAfter] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, pIdRecord));
    assert.strictEqual(paymentRecordAfter.status, 'REVERSED');
    
    const schedulesAfter = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lId)).orderBy(asc(rentSchedules.dueDate));
    const targetAfter = schedulesAfter.find(s => s.id === targetSchedule.id);
    assert.strictEqual(targetAfter?.amount, '0');
    assert.strictEqual(targetAfter?.paidAmount, '0');
    assert.strictEqual(targetAfter?.status, 'CANCELLED');
  });
});
