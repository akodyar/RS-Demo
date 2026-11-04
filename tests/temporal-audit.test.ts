import { injectPgliteMock } from './setup-pglite.js';
import { db } from '../src/db/index.js';
import { users, organizations, properties, leases, rentSchedules, paymentRecords, journalEntries, listings, propertyOffers, ownershipRecords, leaseTenants } from '../src/db/schema.js';
import { FinanceService } from '../src/server/services/finance.js';
import crypto from 'node:crypto';

async function runTemporalAudit() {
  console.log("================================================================");
  console.log("  HOMEHUB — TEMPORAL SAFETY & CONCURRENCY AUDIT");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testId: string, description: string) {
    if (condition) {
      console.log(`✅ PASS [${testId}] ${description}`);
      passed++;
    } else {
      console.error(`❌ FAIL [${testId}] ${description}`);
      failed++;
    }
  }

  // Setup generic test identities
  const userId = `user-conc-${Date.now()}`;
  const orgId = `org-conc-${Date.now()}`;
  const propId = `prop-conc-${Date.now()}`;
  const leaseId = `lease-conc-${Date.now()}`;
  const scheduleId = `sched-conc-${Date.now()}`;

  await db.insert(users).values({ id: userId, email: `${userId}@test.com`, firstName: 'Conc', lastName: 'User' }).onConflictDoNothing();
  await db.insert(organizations).values({ id: orgId, name: 'Conc Org', type: 'PROPERTY_MANAGEMENT' }).onConflictDoNothing();
  await db.insert(properties).values({ id: propId, name: 'Conc Property', address: '123 Conc St', status: 'ACTIVE', type: 'RESIDENTIAL' }).onConflictDoNothing();
  await db.insert(ownershipRecords).values({ propertyId: propId, ownerId: userId, ownershipPercentage: '100' }).onConflictDoNothing();

  const financeService = new FinanceService();

  // RACE 1: CONCURRENT RENT PAYMENT
  await db.insert(leases).values({ id: leaseId, propertyId: propId, startDate: new Date('2026-01-01').toISOString(), endDate: new Date('2026-12-31').toISOString(), rentAmount: '1000', currency: 'IQD', status: 'ACTIVE' }).onConflictDoNothing();
  await db.insert(leaseTenants).values({ leaseId: leaseId, tenantId: userId, isPrimary: true }).onConflictDoNothing();
  await db.insert(rentSchedules).values({ id: scheduleId, leaseId: leaseId, propertyId: propId, tenantId: userId, dueDate: new Date('2026-09-01').toISOString(), periodStart: new Date('2026-09-01').toISOString(), periodEnd: new Date('2026-09-30').toISOString(), amount: '1000', currency: 'IQD', status: 'PENDING' }).onConflictDoNothing();

  console.log("\n--- Executing 20 concurrent payments for the same rent schedule ---");
  
  const reference = `REF-CONC-${Date.now()}`;

  const paymentPromises = Array.from({ length: 20 }).map(() => {
    return financeService.recordPayment(
      propId,
      userId,
      1000,
      'IQD',
      'BANK_TRANSFER',
      reference,
      { rentScheduleId: scheduleId, leaseId: leaseId }
    ).then(() => 'SUCCESS').catch((e) => 'REJECTED');
  });

  const paymentResults = await Promise.all(paymentPromises);
  const paySuccess = paymentResults.filter(r => r === 'SUCCESS').length;
  const payRejected = paymentResults.filter(r => r === 'REJECTED').length;

  const finalPayments = await db.query.paymentRecords.findMany({ where: (p, { eq }) => eq(p.referenceNumber, reference) });
  
  console.log(`NUMBER OF CONCURRENT OPERATIONS: 20`);
  console.log(`SUCCESS COUNT: ${paySuccess}`);
  console.log(`REJECTED COUNT: ${payRejected}`);
  console.log(`FINAL RECORD COUNT: ${finalPayments.length}`);
  
  assert(finalPayments.length === 1, 'CONC-01', 'Idempotency key prevents duplicate payments on concurrent execution');
  assert(paySuccess === 1, 'CONC-02', 'Exactly one payment succeeds among concurrent executions');

  console.log('\n================================================================');
  console.log(`  CONCURRENCY AUDIT: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTemporalAudit().catch(e => {
  console.error('Fatal error in temporal audit:', e);
  process.exit(1);
});
