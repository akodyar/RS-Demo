import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  ownershipRecords,
  paymentRecords,
  commissions,
  ownerSettlements,
  payoutRequests,
  journalEntries,
  ledgerLines,
  rentSchedules,
} from '../src/db/schema.js';
import { commissionService } from '../src/server/services/commission.js';
import { eq, inArray, and } from 'drizzle-orm';

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

const FIXTURES = {
  users: {
    owner: 'usr_settle_owner_01',
    tenant: 'usr_settle_tenant_01',
    admin: 'usr_settle_admin_01',
  },
  properties: {
    prop1: 'prop_settle_01',
  },
  ownership: {
    rec1: 'own_settle_01',
  },
  leases: {
    lease1: 'lease_settle_01',
  },
  payments: {
    pay1: 'pay_settle_01',
  },
};

function getAuthHeader(userId: string, role: string): string {
  const payload = { uid: userId, role };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

async function cleanupData() {
  try {
    await db.delete(payoutRequests).where(inArray(payoutRequests.ownerId, [FIXTURES.users.owner]));
    await db.delete(ownerSettlements).where(inArray(ownerSettlements.ownerId, [FIXTURES.users.owner]));
    await db.delete(commissions).where(inArray(commissions.propertyId, [FIXTURES.properties.prop1]));
    await db.delete(paymentRecords).where(inArray(paymentRecords.propertyId, [FIXTURES.properties.prop1]));

    const jes = await db.select({ id: journalEntries.id }).from(journalEntries)
      .where(inArray(journalEntries.propertyId, [FIXTURES.properties.prop1, 'GLOBAL']));
    const jeIds = jes.map(j => j.id);
    if (jeIds.length > 0) {
      await db.delete(ledgerLines).where(inArray(ledgerLines.journalEntryId, jeIds));
      await db.delete(journalEntries).where(inArray(journalEntries.id, jeIds));
    }

    await db.delete(rentSchedules).where(inArray(rentSchedules.leaseId, Object.values(FIXTURES.leases)));
    await db.delete(leaseTenants).where(inArray(leaseTenants.tenantId, [FIXTURES.users.tenant]));
    await db.delete(leases).where(inArray(leases.id, Object.values(FIXTURES.leases)));
    await db.delete(ownershipRecords).where(inArray(ownershipRecords.id, Object.values(FIXTURES.ownership)));
    await db.delete(properties).where(inArray(properties.id, Object.values(FIXTURES.properties)));
    await db.delete(users).where(inArray(users.id, Object.values(FIXTURES.users)));
  } catch (err) {
    console.warn('Warning during cleanupData:', err);
  }
}

async function runSettlementPayoutVerification() {
  console.log('================================================================');
  console.log('  HOMEHUB — OWNER SETTLEMENT & PAYOUT ACCOUNTING VERIFICATION');
  console.log('================================================================');

  const TARGET_TEST_DATABASE = 'homehub_test';
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    console.error(`ABORT: Tests must run exclusively against '${TARGET_TEST_DATABASE}'. Current: '${targetDb}'`);
    process.exit(1);
  }

  await cleanupData();

  // 1. Seed Users
  await db.insert(users).values([
    {
      id: FIXTURES.users.owner,
      uid: FIXTURES.users.owner,
      email: 'settle_owner@homehub.test',
      phone: '+9647500000091',
      firstName: 'Hawkar',
      lastName: 'Haji',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: FIXTURES.users.tenant,
      uid: FIXTURES.users.tenant,
      email: 'settle_tenant@homehub.test',
      phone: '+9647500000092',
      firstName: 'Baban',
      lastName: 'Omer',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: FIXTURES.users.admin,
      uid: FIXTURES.users.admin,
      email: 'settle_admin@homehub.test',
      phone: '+9647500000093',
      firstName: 'Finance',
      lastName: 'Admin',
      roles: ['PLATFORM_ADMIN'],
      isActive: true,
    },
  ]);

  // 2. Seed Property with operating model AGENT_OPERATED (3% platform fee, 97% owner net)
  await db.insert(properties).values({
    id: FIXTURES.properties.prop1,
    name: 'Erbil Royal Penthouse',
    type: 'APARTMENT',
    status: 'RENTED',
    address: { street: 'Gulan Street 55', city: 'Erbil' },
    operatingModel: 'AGENT_OPERATED',
  });

  // 3. Seed Ownership Record
  await db.insert(ownershipRecords).values({
    id: FIXTURES.ownership.rec1,
    propertyId: FIXTURES.properties.prop1,
    ownerId: FIXTURES.users.owner,
    status: 'VERIFIED',
    ownershipPercentage: '100',
  });

  // 4. Seed Lease
  await db.insert(leases).values({
    id: FIXTURES.leases.lease1,
    propertyId: FIXTURES.properties.prop1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1000000',
    currency: 'IQD',
    status: 'ACTIVE',
  });

  // 5. Seed Confirmed Payment Record of 1,000,000 IQD
  await db.insert(paymentRecords).values({
    id: FIXTURES.payments.pay1,
    propertyId: FIXTURES.properties.prop1,
    leaseId: FIXTURES.leases.lease1,
    payerId: FIXTURES.users.tenant,
    amount: '1000000',
    currency: 'IQD',
    status: 'CONFIRMED',
    paymentMethod: 'FIB',
    referenceNumber: 'TXN-RENT-1M-SETTLE',
    recordedDate: new Date().toISOString(),
  });

  // Start express app
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // TEST 1: Commission service automatically generates owner settlement upon rent confirmation
    const commResult = await commissionService.postCommissionForPayment(
      FIXTURES.payments.pay1,
      FIXTURES.users.admin,
      'PLATFORM_ADMIN'
    );

    assert(
      commResult.alreadyPosted === false && Number(commResult.calculation?.baseAmount) === 1000000,
      'COMMISSION_POSTED_SUCCESSFULLY',
      `Commission calculated base: ${commResult.calculation?.baseAmount}, net: ${commResult.calculation?.ownerNetAmount}`
    );

    // Verify owner settlement created in DB
    const [settlement] = await db.select().from(ownerSettlements)
      .where(eq(ownerSettlements.ownerId, FIXTURES.users.owner));

    assert(
      settlement !== undefined &&
      settlement.status === 'AVAILABLE' &&
      Number(settlement.totalCollectedIqd) === 1000000 &&
      Number(settlement.netPayableIqd) === commResult.calculation!.ownerNetAmount,
      'AUTOMATIC_OWNER_SETTLEMENT_CREATED',
      `Expected settlement with ${commResult.calculation!.ownerNetAmount} IQD net payable, got net=${settlement?.netPayableIqd}, status=${settlement?.status}`
    );

    // TEST 2: Owner sees settlement in GET /api/settlements/owner/settlements
    const ownerSettlementsRes = await fetch(`${baseUrl}/settlements/owner/settlements`, {
      headers: { Authorization: getAuthHeader(FIXTURES.users.owner, 'PROPERTY_OWNER') },
    });
    const ownerSettlementsList = await ownerSettlementsRes.json();
    assert(
      ownerSettlementsRes.status === 200 &&
      ownerSettlementsList.length === 1 &&
      ownerSettlementsList[0].id === settlement.id,
      'OWNER_SETTLEMENTS_LIST_ACCESSIBLE',
      `Expected 1 settlement for owner, got status ${ownerSettlementsRes.status}, count: ${ownerSettlementsList.length}`
    );

    // TEST 3: Payout request exceeding settlement balance is rejected
    const excessivePayoutRes = await fetch(`${baseUrl}/settlements/owner/settlements/${settlement.id}/payout`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.owner, 'PROPERTY_OWNER'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amountIqd: 1500000 }),
    });
    assert(
      excessivePayoutRes.status === 400,
      'EXCESSIVE_PAYOUT_AMOUNT_REJECTED',
      `Expected 400 for excessive payout amount, got ${excessivePayoutRes.status}`
    );

    // TEST 4: Owner requests valid payout of full 970,000 IQD
    const validPayoutRes = await fetch(`${baseUrl}/settlements/owner/settlements/${settlement.id}/payout`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.owner, 'PROPERTY_OWNER'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amountIqd: 970000,
        bankName: 'First Iraqi Bank',
        bankAccountNumber: 'FIB-ACC-883921',
        iban: 'IQ00FIB000000000883921',
      }),
    });
    const payoutBody = await validPayoutRes.json();
    assert(
      validPayoutRes.status === 200 &&
      payoutBody.status === 'REQUESTED' &&
      Number(payoutBody.amountIqd) === 970000,
      'PAYOUT_REQUEST_CREATED',
      `Expected 200 OK with status REQUESTED, got ${validPayoutRes.status} (${payoutBody.status})`
    );

    const payoutId = payoutBody.id;

    // Verify settlement status transitioned to REQUESTED
    const [updatedSettlement] = await db.select().from(ownerSettlements)
      .where(eq(ownerSettlements.id, settlement.id));
    assert(
      updatedSettlement.status === 'REQUESTED',
      'SETTLEMENT_STATUS_REQUESTED',
      `Expected settlement status REQUESTED, got ${updatedSettlement.status}`
    );

    // TEST 5: Finance Admin processes payout without confirmation ref -> rejected 400
    const noRefRes = await fetch(`${baseUrl}/settlements/finance/payouts/${payoutId}/process`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.admin, 'PLATFORM_ADMIN'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    assert(
      noRefRes.status === 400,
      'PAYOUT_MISSING_CONFIRMATION_REF_REJECTED',
      `Expected 400 when missing confirmation reference, got ${noRefRes.status}`
    );

    // TEST 6: Finance Admin completes payout with external reference -> posts Dr 2010 / Cr 1010
    const processRes = await fetch(`${baseUrl}/settlements/finance/payouts/${payoutId}/process`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.admin, 'PLATFORM_ADMIN'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        externalTransactionReference: 'FIB-TRX-2026-99120',
      }),
    });
    const processBody = await processRes.json();
    assert(
      processRes.status === 200 &&
      processBody.success === true &&
      processBody.status === 'COMPLETED' &&
      Boolean(processBody.journalEntryId),
      'PAYOUT_PROCESS_COMPLETED',
      `Expected 200 OK and journalEntryId, got ${processRes.status} (JE: ${processBody.journalEntryId})`
    );

    // TEST 7: General Ledger Verification — Dr 2010 (Owner Net Payable) / Cr 1010 (Operating Cash)
    const payoutJeLines = await db.select().from(ledgerLines)
      .where(eq(ledgerLines.journalEntryId, processBody.journalEntryId));

    assert(
      payoutJeLines.length === 2,
      'PAYOUT_JE_LINE_COUNT',
      `Expected exactly 2 ledger lines, got ${payoutJeLines.length}`
    );

    const debit2010 = payoutJeLines.find(l => l.accountId === '2010');
    const credit1010 = payoutJeLines.find(l => l.accountId === '1010');

    assert(
      debit2010 !== undefined &&
      Number(debit2010.debit) === 970000 &&
      Number(debit2010.credit) === 0,
      'PAYOUT_DEBIT_2010_OWNER_PAYABLE',
      `Expected Dr 2010 of 970,000 IQD, got debit=${debit2010?.debit}, credit=${debit2010?.credit}`
    );

    assert(
      credit1010 !== undefined &&
      Number(credit1010.credit) === 970000 &&
      Number(credit1010.debit) === 0,
      'PAYOUT_CREDIT_1010_OPERATING_CASH',
      `Expected Cr 1010 of 970,000 IQD, got credit=${credit1010?.credit}, debit=${credit1010?.debit}`
    );

    // TEST 8: Repeated process call is rejected as already completed (idempotency defense)
    const repeatRes = await fetch(`${baseUrl}/settlements/finance/payouts/${payoutId}/process`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.admin, 'PLATFORM_ADMIN'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        externalTransactionReference: 'FIB-TRX-2026-99120',
      }),
    });
    assert(
      repeatRes.status === 400,
      'REPEAT_PAYOUT_PROCESSING_REJECTED',
      `Expected 400 for repeated payout process, got ${repeatRes.status}`
    );

    // TEST 9: Settlement status is marked PAID
    const [finalSettlement] = await db.select().from(ownerSettlements)
      .where(eq(ownerSettlements.id, settlement.id));
    assert(
      finalSettlement.status === 'PAID',
      'SETTLEMENT_MARKED_PAID',
      `Expected settlement status PAID, got ${finalSettlement.status}`
    );

    // TEST 10: Insufficient Account 2010 Liability Balance Rejection (Defect C-03 Remediation)
    // Create a new settlement and payout request for 50,000 IQD when only 10,000 IQD remains in Account 2010
    const [overdrawSettlement] = await db.insert(ownerSettlements).values({
      ownerId: FIXTURES.users.owner,
      propertyId: FIXTURES.properties.prop1,
      periodStartDate: new Date(),
      periodEndDate: new Date(),
      totalCollectedIqd: '100000',
      platformCommissionIqd: '2000',
      companyCommissionIqd: '0',
      totalExpensesIqd: '0',
      netPayableIqd: '50000',
      status: 'AVAILABLE',
    }).returning();

    const [overdrawPayout] = await db.insert(payoutRequests).values({
      settlementId: overdrawSettlement.id,
      ownerId: FIXTURES.users.owner,
      amountIqd: '50000',
      status: 'REQUESTED',
      requestedByUserId: FIXTURES.users.owner,
    }).returning();

    const overdrawProcessRes = await fetch(`${baseUrl}/settlements/finance/payouts/${overdrawPayout.id}/process`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.admin, 'PLATFORM_ADMIN'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'COMPLETED',
        externalTransactionReference: 'FIB-TRX-OVERDRAW-TEST',
      }),
    });
    const overdrawBody = await overdrawProcessRes.json();

    assert(
      overdrawProcessRes.status === 400 &&
      overdrawBody.error === 'INSUFFICIENT_PAYABLE_BALANCE',
      'OVERDRAW_PAYOUT_REJECTED_BY_2010_BALANCE',
      `Expected 400 INSUFFICIENT_PAYABLE_BALANCE, got ${overdrawProcessRes.status}: ${JSON.stringify(overdrawBody)}`
    );

  } finally {
    server.close();
    await cleanupData();
  }

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runSettlementPayoutVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
