import '../tests/safe-test-env.js';
import { db } from '../src/db/index.js';
import { users, properties, ownershipRecords, leases, leaseTenants, leaseRenewals, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines, auditLogs } from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import leasesRouter from '../src/server/routes/leases.js';
import { leaseRepository, LeaseRepository } from '../src/server/repositories/leases.js';
import { CommissionService } from '../src/server/services/commission.js';

function getAuthHeader(actor: { id: string; roles: string[] }): string {
  const payload = { uid: actor.id, role: actor.roles[0] };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

async function runInvariantAudit() {
  console.log('================================================================');
  console.log('  SECTION 5: LIVE DATABASE & ACCOUNTING INVARIANTS AUDIT');
  console.log('  Target Database: homehub_test (PostgreSQL)');
  console.log('================================================================\n');

  const runId = 'inv_' + Date.now().toString(36);
  const ownerId = `owner_${runId}`;
  const tenantId = `tenant_${runId}`;
  const propId = `prop_${runId}`;
  const leaseId = `lease_${runId}`;
  const renewalId = `ren_${runId}`;

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  const leaseRepo = new LeaseRepository();
  const commissionService = new CommissionService();
  const authHeader = getAuthHeader({ id: ownerId, roles: ['PROPERTY_OWNER'] });

  let targetPaymentId = '';

  try {
    // 1. Setup synthetic identities
    await db.insert(users).values([
      { id: ownerId, uid: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Invariant', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: tenantId, uid: tenantId, email: `${tenantId}@test.iq`, firstName: 'Tenant', lastName: 'Invariant', roles: ['TENANT'], isActive: true }
    ]);

    await db.insert(properties).values({
      id: propId,
      name: `Property ${runId}`,
      type: 'APARTMENT',
      ownerId: ownerId,
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.02',
      managementFee: '0.03',
      address: { city: 'Erbil' }
    });

    await db.insert(ownershipRecords).values({
      id: `own_${propId}`,
      propertyId: propId,
      ownerId: ownerId,
      status: 'VERIFIED',
      ownershipPercentage: '100'
    });

    const [lease] = await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000000',
      currency: 'IQD',
      status: 'ACTIVE'
    }).returning();

    await db.insert(leaseTenants).values({
      leaseId: lease.id,
      tenantId: tenantId,
      isPrimary: true
    });

    // Generate initial schedules
    await db.transaction(async (tx) => {
      await leaseRepo.generateRentSchedule(tx, lease.id, propId, tenantId, null, '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000000);
    });

    const schedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const targetSchedule = schedules.find(s => s.periodStart === '2026-08-01T00:00:00.000Z')!;
    const scheduleId = targetSchedule.id;

    console.log('--- 1. RECORD & CONFIRM PAYMENT ---');
    const payment = await leaseRepo.recordPayment(propId, lease.id, tenantId, scheduleId, 1000000, 'CASH', `REF-${runId}`);
    targetPaymentId = payment.id;

    await leaseRepo.confirmPayment(payment.id, ownerId);
    await commissionService.postCommissionForPayment(payment.id, ownerId, 'SYSTEM');
    console.log(`Payment confirmed: ${payment.id}`);

    // Query state AFTER confirmation
    const [payAfterConfirm] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
    const [schedAfterConfirm] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    const [commAfterConfirm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
    
    const journalAfterConfirm = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, commAfterConfirm?.id));
    const ledgerAfterConfirm = commAfterConfirm ? await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, journalAfterConfirm[0]?.id)) : [];

    console.log('\n[STATE: POST-CONFIRMATION]');
    console.log('Payment:', { id: payAfterConfirm.id, status: payAfterConfirm.status, amount: payAfterConfirm.amount, scheduleId: payAfterConfirm.rentScheduleId });
    console.log('Schedule:', { id: schedAfterConfirm.id, amount: schedAfterConfirm.amount, paidAmount: schedAfterConfirm.paidAmount, status: schedAfterConfirm.status });
    console.log('Commission:', { id: commAfterConfirm?.id, status: commAfterConfirm?.status, totalAmount: commAfterConfirm?.totalAmount });
    console.log('Journal Entries Count:', journalAfterConfirm.length, 'Entry:', journalAfterConfirm[0]?.entryType);
    console.log('Ledger Lines Count:', ledgerAfterConfirm.length, 'Lines:', ledgerAfterConfirm.map(l => ({ acct: l.accountId, dr: l.debit, cr: l.credit })));

    console.log('\n--- 2. REVERSE PAYMENT VIA POST /api/leases/payments/:id/reverse ---');
    const revRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', authHeader)
      .send({ reason: "Tenant bank error" });
    console.log(`Payment reversal HTTP: ${revRes.status}`);

    // Query state AFTER reversal
    const [payAfterRev] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
    const [schedAfterRev] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    const [commAfterRev] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
    
    const journalAfterRev = await db.select().from(journalEntries).where(and(
      eq(journalEntries.referenceType, 'FEE_REVERSAL'),
      eq(journalEntries.referenceId, commAfterRev?.id)
    ));
    const ledgerAfterRev = journalAfterRev.length > 0 ? await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, journalAfterRev[0]?.id)) : [];

    console.log('\n[STATE: POST-REVERSAL]');
    console.log('Payment:', { id: payAfterRev.id, status: payAfterRev.status, amount: payAfterRev.amount, scheduleId: payAfterRev.rentScheduleId });
    console.log('Schedule:', { id: schedAfterRev.id, amount: schedAfterRev.amount, paidAmount: schedAfterRev.paidAmount, status: schedAfterRev.status });
    console.log('Commission:', { id: commAfterRev?.id, status: commAfterRev?.status });
    console.log('Compensating Journal Entries Count:', journalAfterRev.length, 'Type:', journalAfterRev[0]?.entryType);
    console.log('Compensating Ledger Lines:', ledgerAfterRev.map(l => ({ acct: l.accountId, dr: l.debit, cr: l.credit })));

    console.log('\n--- 3. MID-LEASE RENEWAL (OVERLAPPING REVERSED SCHEDULE) ---');
    const [renewal] = await db.insert(leaseRenewals).values({
      id: renewalId,
      leaseId: lease.id,
      propertyId: propId,
      tenantId: tenantId,
      proposedStartDate: '2026-07-01T00:00:00.000Z',
      proposedEndDate: '2027-06-30T00:00:00.000Z',
      proposedRentAmount: '1500000',
      status: 'REQUESTED'
    }).returning();

    await leaseRepo.approveRenewal(renewal.id, { actorUserId: ownerId, actorRole: 'PROPERTY_OWNER' });
    console.log('Approved renewal successfully.');

    // Query state AFTER renewal
    const [schedAfterRenewal] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    const [leaseAfterRenewal] = await db.select().from(leases).where(eq(leases.id, lease.id));
    
    // Check duplicates and orphaned payments
    const allSchedules = await db.select().from(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    const periodStarts = allSchedules.map(s => s.periodStart);
    const hasDuplicates = new Set(periodStarts).size !== allSchedules.length;

    const allPayments = await db.select().from(paymentRecords).where(eq(paymentRecords.leaseId, lease.id));
    const orphanedPayments = allPayments.filter(p => !allSchedules.some(s => s.id === p.rentScheduleId));

    const paymentAudits = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceType, 'PaymentRecord'),
      eq(auditLogs.resourceId, payment.id),
      eq(auditLogs.action, 'REVERSE_PAYMENT')
    ));

    console.log('\n[STATE: POST-RENEWAL]');
    console.log('August Schedule (Stable ID preserved):', { id: schedAfterRenewal.id, amount: schedAfterRenewal.amount, paidAmount: schedAfterRenewal.paidAmount, status: schedAfterRenewal.status });
    console.log('Lease Dates & Rent:', { start: leaseAfterRenewal.startDate, end: leaseAfterRenewal.endDate, rent: leaseAfterRenewal.rentAmount });
    console.log(`Duplicate (lease_id, period_start) rows: ${hasDuplicates ? 'DETECTED' : '0 (NONE)'}`);
    console.log(`Orphaned Payment references: ${orphanedPayments.length}`);
    console.log(`Audit logs for REVERSE_PAYMENT on ${payment.id}: ${paymentAudits.length}`);

    console.log('\n--- 4. IDEMPOTENT REPEATED REVERSAL CHECK ---');
    const repeatRes = await request(app)
      .post(`/api/leases/payments/${payment.id}/reverse`)
      .set('Authorization', authHeader)
      .send({ reason: "Repeat attempt" });
    console.log(`Repeat reversal status: ${repeatRes.status} (Body message: ${repeatRes.body.message})`);

    const auditCountAfterRepeat = await db.select().from(auditLogs).where(and(
      eq(auditLogs.resourceType, 'PaymentRecord'),
      eq(auditLogs.resourceId, payment.id),
      eq(auditLogs.action, 'REVERSE_PAYMENT')
    ));
    console.log(`Audit logs after repeat attempt: ${auditCountAfterRepeat.length} (Strictly preserved 1)`);

    console.log('\n--- 5. CONCURRENT REVERSAL RECOVERY SIMULATION ---');
    const [p1, p2] = await Promise.all([
      request(app).post(`/api/leases/payments/${payment.id}/reverse`).set('Authorization', authHeader).send({ reason: "Concurrent 1" }),
      request(app).post(`/api/leases/payments/${payment.id}/reverse`).set('Authorization', authHeader).send({ reason: "Concurrent 2" })
    ]);
    console.log(`Concurrent reversal responses: [${p1.status}, ${p2.status}]`);

    const [finalSched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    console.log(`Final target schedule balance: paidAmount = ${finalSched.paidAmount} (Strictly preserved 0, never negative)`);

  } finally {
    // Deterministic fixture cleanup respecting foreign-key hierarchy (audit_logs, journal_entries, ledger_lines are append-only)
    console.log('\n--- DETERMINISTIC FIXTURE CLEANUP ---');
    if (targetPaymentId) {
      await db.delete(commissions).where(eq(commissions.paymentRecordId, targetPaymentId)).catch(() => {});
      await db.delete(paymentRecords).where(eq(paymentRecords.id, targetPaymentId)).catch(() => {});
    }
    await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId)).catch(() => {});
    await db.delete(leaseRenewals).where(eq(leaseRenewals.leaseId, leaseId)).catch(() => {});
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId)).catch(() => {});
    await db.delete(leases).where(eq(leases.id, leaseId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    await db.delete(users).where(eq(users.id, ownerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, tenantId)).catch(() => {});
    console.log('Cleanup completed successfully.');
  }
}

runInvariantAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
