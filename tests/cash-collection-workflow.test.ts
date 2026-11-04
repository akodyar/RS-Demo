import { injectPgliteMock } from './setup-pglite.js';
import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { paymentRecords, commissions, users, properties, organizations, leases, leaseTenants, journalEntries, ledgerLines, rentSchedules } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
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

async function runCashCollectionTest() {
  console.log('================================================================');
  console.log('  CASH COLLECTION & COMMISSION WORKFLOW — ADVERSARIAL SUITE');
  console.log('================================================================');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  await injectPgliteMock();
  try {
      const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
      resetDbHealthCache();
  } catch(e) {}

  // 1. Seed Required Data
  const testPropId = `prop-cash-${Date.now()}`;
  const testTenantId = `user_tenant_01`; // Use mock auth identity
  const testLeaseId = `lease-cash-${Date.now()}`;
  const testScheduleId = `schedule-cash-${Date.now()}`;

  await db.insert(users).values({ id: testTenantId, uid: testTenantId, email: `${testTenantId}@test.com`, firstName: 'Test', lastName: 'Tenant', roles: ['TENANT'] }).onConflictDoNothing();
  await db.insert(properties).values({ id: testPropId, name: 'Cash Property', address: '123 Cash St', type: 'RESIDENTIAL', status: 'ACTIVE' }).onConflictDoNothing();
  await db.insert(leases).values({ id: testLeaseId, propertyId: testPropId, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: '1000000', status: 'ACTIVE' }).onConflictDoNothing();
  await db.insert(leaseTenants).values({ leaseId: testLeaseId, tenantId: testTenantId, isPrimary: true }).onConflictDoNothing();
  await db.insert(rentSchedules).values({ id: testScheduleId, leaseId: testLeaseId, propertyId: testPropId, tenantId: testTenantId, dueDate: '2026-01-01', amount: '1000000', periodStart: '2026-01-01', periodEnd: '2026-01-31', status: 'PENDING' }).onConflictDoNothing();
  
  const { financialPolicies } = await import('../src/db/schema.js');
  await db.insert(financialPolicies).values({ policyType: 'RENT_MANAGEMENT_COMMISSION_RATE', policyValue: '0.05' }).onConflictDoNothing();

  try {
    // TEST 1: Record Partial Cash Payment
    console.log('\n--- TEST 1: RECORD & CONFIRM PARTIAL PAYMENT ---');
    const recordRes1 = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-finance',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        propertyId: testPropId,
        leaseId: testLeaseId,
        payerId: testTenantId,
        amount: 400000,
        paymentMethod: 'CASH',
        referenceNumber: 'CASH-PART1',
        collectorId: 'admin_user_fin'
      })
    });
    const recordData1 = await recordRes1.json() as any;
    assert(recordRes1.status === 201 && recordData1.status === 'RECORDED', 'CASH_PAYMENT_1_RECORDED', `Partial payment 1 recorded`);
    const payment1Id = recordData1.id;

    const confirmRes1 = await fetch(`${baseUrl}/leases/payments/${payment1Id}/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dev-finance',
        'Content-Type': 'application/json'
      }
    });
    const confirmData1 = await confirmRes1.json() as any;
    assert(confirmRes1.status === 200 && confirmData1.payment.status === 'CONFIRMED', 'CASH_PAYMENT_1_CONFIRMED', `Partial payment 1 confirmed`);
    assert(confirmData1.payment.confirmedByUserId === 'admin_user_fin', 'CONFIRMER_IDENTITY_RECORDED', `Confirmer identity successfully recorded`);

    const comm1 = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment1Id));
    assert(comm1.length === 1 && Number(comm1[0].commissionAmount) === 20000, 'PARTIAL_COMMISSION_CORRECT_1', `Commission for 400k is 20,000 (5%)`);

    // TEST 2: Record Second Partial Cash Payment
    console.log('\n--- TEST 2: RECORD & CONFIRM MULTIPLE PARTIAL PAYMENTS ---');
    const recordRes2 = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-finance', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: testPropId,
        leaseId: testLeaseId,
        payerId: testTenantId,
        amount: 600000,
        paymentMethod: 'CASH',
        referenceNumber: 'CASH-PART2'
      })
    });
    const recordData2 = await recordRes2.json() as any;
    const payment2Id = recordData2.id;
    
    await fetch(`${baseUrl}/leases/payments/${payment2Id}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-finance', 'Content-Type': 'application/json' }
    });

    const comm2 = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment2Id));
    assert(comm2.length === 1 && Number(comm2[0].commissionAmount) === 30000, 'PARTIAL_COMMISSION_CORRECT_2', `Commission for 600k is 30,000 (5%)`);

    // TEST 3: REVERSAL
    console.log('\n--- TEST 3: PAYMENT REVERSAL ---');
    const reverseRes = await fetch(`${baseUrl}/leases/payments/${payment2Id}/reverse`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-finance', 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Entered incorrectly' })
    });
    const reverseData = await reverseRes.json() as any;
    assert(reverseRes.status === 200 && reverseData.payment.status === 'REVERSED', 'PAYMENT_REVERSED', `Payment successfully reversed`);
    assert(reverseData.commissionReversal !== null && reverseData.commissionReversal.commission.status === 'REVERSED', 'COMMISSION_REVERSED', `Commission accurately reversed with compensating entries`);

    // TEST 4: Idempotency (Duplicate Confirmation)
    console.log('\n--- TEST 4: DUPLICATE CONFIRMATION (IDEMPOTENCY) ---');
    const duplicateRes = await fetch(`${baseUrl}/leases/payments/${payment1Id}/confirm`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-finance', 'Content-Type': 'application/json' }
    });
    const duplicateData = await duplicateRes.json() as any;
    assert(duplicateRes.status === 200 && duplicateData.message === "Payment is already confirmed", 'IDEMPOTENCY_MESSAGE', 'Duplicate confirmation safely returns');
    
    // TEST 5: Overpayment Rejection
    console.log('\n--- TEST 5: OVERPAYMENT REJECTION ---');
    const overpayRes = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-finance', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: testPropId,
        leaseId: testLeaseId,
        payerId: testTenantId,
        amount: 2000000, // 2M on a 1M lease that is already paid
        rentScheduleId: testScheduleId, // Need a schedule to trigger overpayment check
        paymentMethod: 'CASH'
      })
    });
    assert(overpayRes.status === 400, 'OVERPAYMENT_REJECTED', 'Overpayment securely rejected with 400 Bad Request');
    
    // TEST 6: Digital Payment Regression
    console.log('\n--- TEST 6: DIGITAL PAYMENT REGRESSION ---');
    const digitalRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer dev-tenant', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        propertyId: testPropId,
        leaseId: testLeaseId,
        amount: 500000,
        currency: 'IQD',
        paymentMethod: 'FIB'
      })
    });
    
    const digitalData = await digitalRes.json() as any;
    assert(digitalRes.status === 201 && digitalData.payment.status === 'CONFIRMED', 'DIGITAL_PAYMENT_CONFIRMED', 'Digital payment inserts securely as CONFIRMED');
    
  } finally {
    server.close();
  }

  // Final Execution Summary
  console.log('\n================================================================');
  console.log('  CASH COLLECTION ADVERSARIAL TEST SUMMARY');
  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed > 0) {
    console.error('❌ SOME ADVERSARIAL TESTS FAILED.');
    process.exit(1);
  } else {
    console.log('✅ ALL CASH COLLECTION ADVERSARIAL TESTS PASSED.');
  }
}

runCashCollectionTest().catch((err) => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
