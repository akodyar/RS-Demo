import { db } from './src/db/index.js';
import { users, properties, leases, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines } from './src/db/schema.js';
import { LeaseRepository } from './src/server/repositories/leases.js';
import { CommissionService } from './src/server/services/commission.js';
import { eq } from 'drizzle-orm';
import assert from 'assert';

process.env.SQL_HOST = 'localhost';
process.env.DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/homehub';

async function runTasks() {
  const leaseRepo = new LeaseRepository();
  const commissionService = new CommissionService();

  console.log("Setting up test data...");
  const [owner] = await db.insert(users).values({ email: `fail_owner_${Date.now()}@t.com`, firstName: 'O', lastName: 'O', role: 'PROPERTY_OWNER' }).returning();
  const [tenant] = await db.insert(users).values({ email: `fail_tenant_${Date.now()}@t.com`, firstName: 'T', lastName: 'T', role: 'TENANT' }).returning();
  const [prop] = await db.insert(properties).values({ name: 'Fail Prop', type: 'SINGLE_FAMILY', status: 'PUBLISHED', ownerId: owner.id }).returning();
  
  const lease = await leaseRepo.createLease(prop.id, null, [tenant.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
  await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, lease.id));
  
  const [schedule] = await db.insert(rentSchedules).values({
    leaseId: lease.id, propertyId: prop.id, tenantId: tenant.id, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01', periodEnd: '2026-01-31', dueDate: '2026-01-05'
  }).returning();

  // Initial State: Payment CONFIRMED, Commission POSTED
  const payment = await leaseRepo.recordPayment(prop.id, lease.id, tenant.id, schedule.id, 1000, 'CASH', 'REF-FAIL');
  await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, payment.id));
  await commissionService.postCommissionForPayment(payment.id, owner.id, 'SYSTEM');

  console.log("Simulating atomicity break...");
  await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, payment.id));
  await db.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, schedule.id));

  // Verify broken state
  let [comm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
  assert(comm.status === 'POSTED', "Commission should be stranded as POSTED");

  // Task 5: INJECT FAILURE DURING RECOVERY
  console.log("Task 5: Injecting failure during commission recovery...");
  
  // Save original method
  const originalReverse = commissionService.reverseCommissionForPayment;
  
  // Inject a mock that throws an error simulating a DB failure
  let failureInjected = false;
  commissionService.reverseCommissionForPayment = async function(...args: any[]) {
    if (!failureInjected) {
      failureInjected = true;
      throw new Error("SIMULATED_DB_CRASH");
    }
    // Second time, call original
    return originalReverse.apply(this, args as any);
  };

  // Attempt recovery (Route logic simulation)
  let recoveryError = null;
  try {
    const existingCommissions = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id)).limit(1);
    if (existingCommissions.length > 0 && existingCommissions[0].status !== 'REVERSED') {
      await commissionService.reverseCommissionForPayment(payment.id, "Self-healing", owner.id, "SYSTEM");
    }
  } catch (err: any) {
    recoveryError = err;
  }

  // Verify it failed truthfully
  assert(recoveryError !== null, "Recovery should have thrown an error");
  assert(recoveryError.message === 'SIMULATED_DB_CRASH', "Error should be the simulated crash");
  
  // Verify state is completely unchanged (still REVERSED payment, POSTED commission)
  [comm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
  assert(comm.status === 'POSTED', "Commission MUST still be POSTED after failed recovery");
  
  // NOW RETRY RECOVERY
  console.log("Task 5: Retrying recovery after simulated failure...");
  let retrySuccess = false;
  try {
    const existingCommissions = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id)).limit(1);
    if (existingCommissions.length > 0 && existingCommissions[0].status !== 'REVERSED') {
      await commissionService.reverseCommissionForPayment(payment.id, "Self-healing retry", owner.id, "SYSTEM");
      retrySuccess = true;
    }
  } catch (err: any) {
    console.error("Retry failed:", err);
  }

  assert(retrySuccess === true, "Retry should succeed");
  
  // Verify successful recovery
  [comm] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id));
  assert(comm.status === 'REVERSED', "Commission MUST be REVERSED after successful retry");
  
  console.log("  => Recovery failure injection & retry successfully verified.");

  process.exit(0);
}

runTasks().catch(console.error);
