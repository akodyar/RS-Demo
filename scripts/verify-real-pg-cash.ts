import { db } from '../src/db/index.js';
import { 
  users, properties, leases, leaseTenants, paymentRecords, commissions, 
  journalEntries, ledgerLines, financialPolicies, rentSchedules 
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { commissionService } from '../src/server/services/commission.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details: string) {
  if (condition) {
    console.log(`✅ PASS [${testName}] ${details}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testName}] ${details}`);
    failed++;
  }
}

async function runRealPostgresCashVerification() {
  console.log('================================================================');
  console.log('  CASH COLLECTION — REAL POSTGRESQL VERIFICATION');
  console.log('================================================================');

  // Verify DB connection
  const res = await db.execute('SELECT 1 as result');
  assert(res && typeof res === 'object', 'DB_CONNECTION', 'Successfully connected to REAL PostgreSQL');

  const stamp = Date.now().toString();
  const testPropId = `prop-pg-${stamp}`;
  const testTenantId = `usr-tenant-${stamp}`;
  const testLeaseId = `lease-pg-${stamp}`;
  const testScheduleId = `schedule-pg-${stamp}`;
  const adminId = `admin-pg-${stamp}`;
  const managerId = `manager-pg-${stamp}`;

  // Ensure policy exists
  await db.insert(financialPolicies).values({ policyType: 'RENT_MANAGEMENT_COMMISSION_RATE', policyValue: '0.05' }).onConflictDoNothing();

  // Setup isolated records
  await db.insert(users).values([
    { id: testTenantId, uid: testTenantId, email: `tenant${stamp}@test.com`, firstName: 'T', lastName: 'T', roles: ['TENANT'] },
    { id: adminId, uid: adminId, email: `admin${stamp}@test.com`, firstName: 'A', lastName: 'A', roles: ['PLATFORM_ADMIN'] },
    { id: managerId, uid: managerId, email: `mgr${stamp}@test.com`, firstName: 'M', lastName: 'M', roles: ['FINANCE_ADMIN'] },
  ]);
  
  await db.insert(properties).values({ id: testPropId, name: 'PG Prop', address: '1 PG St', type: 'RESIDENTIAL', status: 'ACTIVE' });
  await db.insert(leases).values({ id: testLeaseId, propertyId: testPropId, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '1000000', status: 'ACTIVE' });
  await db.insert(leaseTenants).values({ leaseId: testLeaseId, tenantId: testTenantId, isPrimary: true });
  await db.insert(rentSchedules).values({ 
    id: testScheduleId, 
    leaseId: testLeaseId, 
    propertyId: testPropId, 
    tenantId: testTenantId, 
    dueDate: '2026-01-01', 
    periodStart: '2026-01-01',
    periodEnd: '2026-01-31',
    amount: '1000000', 
    status: 'PENDING' 
  });

  try {
    // TEST 1: Full Payment
    console.log('\n--- FULL PAYMENT ---');
    const p1 = await leaseRepository.recordPayment(testPropId, testLeaseId, testTenantId, undefined, 1000000, 'CASH', 'REF1', adminId);
    assert(p1.status === 'RECORDED' && p1.collectorId === adminId, 'RECORDED_FULL', 'Full payment recorded with correct physical collector');

    // Confirm it
    await db.update(paymentRecords).set({ status: 'CONFIRMED', confirmedByUserId: managerId }).where(eq(paymentRecords.id, p1.id));
    await commissionService.postCommissionForPayment(p1.id, managerId);

    const [c1] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p1.id));
    assert(c1 && Number(c1.commissionAmount) === 50000, 'COMMISSION_FULL', '5% commission calculated accurately (50,000)');

    // Owner Payable (95%)
    const j1 = await db.select().from(journalEntries).where(eq(journalEntries.referenceId, p1.id));
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, j1[0].id));
    const ownerLine = lines.find(l => l.accountId === '2010');
    assert(!!ownerLine && Number(ownerLine.credit) === 950000, 'OWNER_PAYABLE_FULL', '950,000 posted to Owner Payable (2010)');

    // TEST 2: Reversal
    console.log('\n--- REVERSAL ---');
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, p1.id));
    await commissionService.reverseCommissionForPayment(p1.id, 'mistake', managerId, 'FINANCE_ADMIN');
    
    const [c1Rev] = await db.select().from(commissions).where(eq(commissions.id, c1.id));
    assert(c1Rev.status === 'REVERSED', 'REVERSAL_SUCCESS', 'Commission accurately reversed');

    // TEST 3: Partial / Multiple Payments
    console.log('\n--- MULTIPLE PARTIAL PAYMENTS ---');
    const p2 = await leaseRepository.recordPayment(testPropId, testLeaseId, testTenantId, testScheduleId, 400000, 'CASH', 'REF2', adminId);
    await db.update(paymentRecords).set({ status: 'CONFIRMED', confirmedByUserId: managerId }).where(eq(paymentRecords.id, p2.id));
    await commissionService.postCommissionForPayment(p2.id, managerId);

    const p3 = await leaseRepository.recordPayment(testPropId, testLeaseId, testTenantId, testScheduleId, 600000, 'CASH', 'REF3', adminId);
    await db.update(paymentRecords).set({ status: 'CONFIRMED', confirmedByUserId: managerId }).where(eq(paymentRecords.id, p3.id));
    await commissionService.postCommissionForPayment(p3.id, managerId);

    const [c2] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p2.id));
    const [c3] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p3.id));
    
    assert(Number(c2.commissionAmount) === 20000, 'PARTIAL_COMMISSION_1', 'First tranche (400k) commission is 20,000');
    assert(Number(c3.commissionAmount) === 30000, 'PARTIAL_COMMISSION_2', 'Second tranche (600k) commission is 30,000');

    const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, testScheduleId));
    assert(Number(sched.paidAmount) === 1000000 && sched.status === 'PAID', 'SCHEDULE_PAID', 'Rent schedule successfully marked PAID with 0 outstanding');

    // TEST 4: CONCURRENCY / RACE CONDITION
    console.log('\n--- CONCURRENCY (RACE CONDITION) ---');
    const p4 = await leaseRepository.recordPayment(testPropId, testLeaseId, testTenantId, undefined, 50000, 'CASH', 'REF-RACE', adminId);
    
    // Fire 3 simultaneous confirmations
    const confirmations = await Promise.allSettled([
      (async () => {
        const [updated] = await db.update(paymentRecords).set({ status: 'CONFIRMED', confirmedByUserId: managerId }).where(and(eq(paymentRecords.id, p4.id), eq(paymentRecords.status, 'RECORDED'))).returning();
        if (!updated) throw new Error("Payment was modified concurrently");
        await commissionService.postCommissionForPayment(p4.id, managerId);
        return updated;
      })(),
      (async () => {
        const [updated] = await db.update(paymentRecords).set({ status: 'CONFIRMED', confirmedByUserId: managerId }).where(and(eq(paymentRecords.id, p4.id), eq(paymentRecords.status, 'RECORDED'))).returning();
        if (!updated) throw new Error("Payment was modified concurrently");
        await commissionService.postCommissionForPayment(p4.id, managerId);
        return updated;
      })(),
      (async () => {
        const [updated] = await db.update(paymentRecords).set({ status: 'CONFIRMED', confirmedByUserId: managerId }).where(and(eq(paymentRecords.id, p4.id), eq(paymentRecords.status, 'RECORDED'))).returning();
        if (!updated) throw new Error("Payment was modified concurrently");
        await commissionService.postCommissionForPayment(p4.id, managerId);
        return updated;
      })()
    ]);

    const successes = confirmations.filter(c => c.status === 'fulfilled');
    const failures = confirmations.filter(c => c.status === 'rejected');
    assert(successes.length === 1, 'CONCURRENCY_ONE_SUCCESS', `Exactly ONE confirmation succeeded out of 3 simultaneous requests`);
    assert(failures.length === 2 && (failures[0] as PromiseRejectedResult).reason.message === "Payment was modified concurrently", 'CONCURRENCY_RACE_REJECTED', 'Concurrent requests safely rejected');

    const comm4 = await db.select().from(commissions).where(eq(commissions.paymentRecordId, p4.id));
    assert(comm4.length === 1, 'CONCURRENCY_SINGLE_COMMISSION', 'Exactly ONE commission record exists for the raced payment');

  } catch (err: any) {
    console.error('Test execution failed:', err);
    failed++;
  }

  console.log('\n================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runRealPostgresCashVerification();
