import { db } from './src/db/index.js';
import { users, properties, leases, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines } from './src/db/schema.js';
import { LeaseRepository } from './src/server/repositories/leases.js';
import { FinanceService } from './src/server/services/finance.js';
import { CommissionService } from './src/server/services/commission.js';
import { eq } from 'drizzle-orm';

process.env.SQL_HOST = 'localhost';
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/homehub';

async function run() {
  const leaseRepo = new LeaseRepository();
  const financeService = new FinanceService();
  const commissionService = new CommissionService();
  
  // Setup data
  const [owner] = await db.insert(users).values({ email: `o_${Date.now()}@t.com`, firstName: 'O', lastName: 'O', role: 'PROPERTY_OWNER' }).returning();
  const [tenant] = await db.insert(users).values({ email: `t_${Date.now()}@t.com`, firstName: 'T', lastName: 'T', role: 'TENANT' }).returning();
  const [prop] = await db.insert(properties).values({ name: 'Prop Atomicity', type: 'SINGLE_FAMILY', status: 'PUBLISHED', ownerId: owner.id }).returning();

  const lease = await leaseRepo.createLease(prop.id, null, [tenant.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
  await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, lease.id));
  
  const [schedule] = await db.insert(rentSchedules).values({
    leaseId: lease.id, propertyId: prop.id, tenantId: tenant.id, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01', periodEnd: '2026-01-31', dueDate: '2026-01-05'
  }).returning();

  // 1. Record & Confirm Payment
  const payment = await leaseRepo.recordPayment(prop.id, lease.id, tenant.id, schedule.id, 1000, 'CASH', 'REF123');
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, payment.id));
  await commissionService.postCommissionForPayment(payment.id, owner.id, 'SYSTEM');

  console.log("Setup complete. Payment CONFIRMED, Schedule PAID, Commission POSTED.");

  // 2. Simulate Atomicity Break during Reversal
  // We manually replicate what `POST /payments/:paymentId/reverse` does up to the transaction commit
  await db.transaction(async (tx) => {
    await tx.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment.id));
    await tx.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, schedule.id));
  });

  // CRASH SIMULATION: We DON'T call commissionService.reverseCommissionForPayment

  // 3. Verify Disagreement
  const [finalPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, payment.id));
  const [finalSchedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
  const [finalCommission] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));

  console.log("\n--- Verification ---");
  console.log("Payment Status:", finalPayment.status);
  console.log("Schedule Status:", finalSchedule.status, "Paid Amount:", finalSchedule.paidAmount);
  console.log("Commission Status:", finalCommission?.status || 'NOT FOUND', "(Should be REVERSED, but is ACTIVE!)");

  process.exit(0);
}

run().catch(console.error);
