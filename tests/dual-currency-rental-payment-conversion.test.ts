import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  commissions,
  ownershipRecords,
  financialPolicies,
} from '../src/db/schema.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { eq, inArray } from 'drizzle-orm';

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
    tenant: 'usr_dual_tenant_01',
    landlord: 'usr_dual_landlord_01',
    admin: 'usr_dual_admin_01',
  },
  properties: {
    usdProp: 'prop_dual_usd_01',
    iqdProp: 'prop_dual_iqd_01',
  },
  ownership: {
    usdOwn: 'own_dual_usd_01',
    iqdOwn: 'own_dual_iqd_01',
  },
  leases: {
    usdLease: 'lease_dual_usd_01',
    iqdLease: 'lease_dual_iqd_01',
  },
  schedules: {
    usdSched: 'sched_dual_usd_01',
    iqdSched: 'sched_dual_iqd_01',
  },
};

function getAuthHeader(userId: string, role: string = 'TENANT'): string {
  const payload = { uid: userId, role };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

async function cleanupData() {
  try {
    const schedIds = Object.values(FIXTURES.schedules);
    await db.delete(paymentRecords).where(inArray(paymentRecords.rentScheduleId, schedIds));
    await db.delete(commissions).where(inArray(commissions.propertyId, Object.values(FIXTURES.properties)));
    await db.delete(rentSchedules).where(inArray(rentSchedules.id, schedIds));
    await db.delete(leaseTenants).where(inArray(leaseTenants.tenantId, [FIXTURES.users.tenant]));
    await db.delete(leases).where(inArray(leases.id, Object.values(FIXTURES.leases)));
    await db.delete(ownershipRecords).where(inArray(ownershipRecords.id, Object.values(FIXTURES.ownership)));
    await db.delete(properties).where(inArray(properties.id, Object.values(FIXTURES.properties)));
    await db.delete(users).where(inArray(users.id, Object.values(FIXTURES.users)));
  } catch (err) {
    console.warn('Warning during cleanupData:', err);
  }
}

async function runDualCurrencyVerification() {
  console.log('================================================================');
  console.log('  HOMEHUB — DUAL-CURRENCY RENTAL PAYMENT VERIFICATION');
  console.log('================================================================');

  const TARGET_TEST_DATABASE = 'homehub_test';
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    console.error(`ABORT: Tests must run exclusively against '${TARGET_TEST_DATABASE}'. Current: '${targetDb}'`);
    process.exit(1);
  }

  await cleanupData();

  // 1. Ensure exchange rate policy exists (1310 IQD per USD)
  const [existingPolicy] = await db.select().from(financialPolicies)
    .where(eq(financialPolicies.policyType, 'EXCHANGE_RATE_IQD'));
  if (!existingPolicy) {
    await db.insert(financialPolicies).values({
      policyType: 'EXCHANGE_RATE_IQD',
      policyValue: '1310',
      active: true,
      description: 'Official Central Bank Exchange Rate',
      effectiveFrom: new Date(),
    });
  }

  // 2. Seed Users
  await db.insert(users).values([
    {
      id: FIXTURES.users.tenant,
      uid: FIXTURES.users.tenant,
      email: 'dual_tenant@homehub.test',
      phone: '+9647500000095',
      firstName: 'Kardo',
      lastName: 'Aziz',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: FIXTURES.users.landlord,
      uid: FIXTURES.users.landlord,
      email: 'dual_landlord@homehub.test',
      phone: '+9647500000096',
      firstName: 'Sirwan',
      lastName: 'Barzan',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: FIXTURES.users.admin,
      uid: FIXTURES.users.admin,
      email: 'dual_admin@homehub.test',
      phone: '+9647500000097',
      firstName: 'System',
      lastName: 'Admin',
      roles: ['PLATFORM_ADMIN'],
      isActive: true,
    },
  ]);

  // 3. Seed USD Property & Lease ($1,000 USD/mo)
  await db.insert(properties).values({
    id: FIXTURES.properties.usdProp,
    name: 'Dream City Luxury Tower (USD)',
    type: 'APARTMENT',
    status: 'RENTED',
    address: { street: 'Dream City Avenue', city: 'Erbil' },
    currency: 'USD',
  });

  await db.insert(ownershipRecords).values({
    id: FIXTURES.ownership.usdOwn,
    propertyId: FIXTURES.properties.usdProp,
    ownerId: FIXTURES.users.landlord,
    status: 'VERIFIED',
    ownershipPercentage: '100',
  });

  await db.insert(leases).values({
    id: FIXTURES.leases.usdLease,
    propertyId: FIXTURES.properties.usdProp,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1000',
    currency: 'USD',
    status: 'ACTIVE',
  });

  await db.insert(leaseTenants).values({
    id: 'lt_dual_usd_01',
    leaseId: FIXTURES.leases.usdLease,
    tenantId: FIXTURES.users.tenant,
    isPrimary: true,
  });

  await db.insert(rentSchedules).values({
    id: FIXTURES.schedules.usdSched,
    leaseId: FIXTURES.leases.usdLease,
    propertyId: FIXTURES.properties.usdProp,
    tenantId: FIXTURES.users.tenant,
    amount: '1000',
    currency: 'USD',
    dueDate: '2026-11-01',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    status: 'UPCOMING',
    paidAmount: '0',
  });

  // 4. Seed IQD Property & Lease (1,310,000 IQD/mo)
  await db.insert(properties).values({
    id: FIXTURES.properties.iqdProp,
    name: 'Bakhtiyari Garden Villa (IQD)',
    type: 'APARTMENT',
    status: 'RENTED',
    address: { street: 'Bakhtiyari Main', city: 'Sulaymaniyah' },
    currency: 'IQD',
  });

  await db.insert(ownershipRecords).values({
    id: FIXTURES.ownership.iqdOwn,
    propertyId: FIXTURES.properties.iqdProp,
    ownerId: FIXTURES.users.landlord,
    status: 'VERIFIED',
    ownershipPercentage: '100',
  });

  await db.insert(leases).values({
    id: FIXTURES.leases.iqdLease,
    propertyId: FIXTURES.properties.iqdProp,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1310000',
    currency: 'IQD',
    status: 'ACTIVE',
  });

  await db.insert(leaseTenants).values({
    id: 'lt_dual_iqd_01',
    leaseId: FIXTURES.leases.iqdLease,
    tenantId: FIXTURES.users.tenant,
    isPrimary: false,
  });

  await db.insert(rentSchedules).values({
    id: FIXTURES.schedules.iqdSched,
    leaseId: FIXTURES.leases.iqdLease,
    propertyId: FIXTURES.properties.iqdProp,
    tenantId: FIXTURES.users.tenant,
    amount: '1310000',
    currency: 'IQD',
    dueDate: '2026-11-01',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    status: 'UPCOMING',
    paidAmount: '0',
  });

  // Start express server
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://localhost:${port}/api`;

  try {
    // TEST 1: Tenant requests real-time conversion quote for USD rent schedule to IQD
    const quoteRes = await fetch(`${baseUrl}/tenant/payments/conversion-quote?scheduleId=${FIXTURES.schedules.usdSched}&targetCurrency=IQD`, {
      headers: { Authorization: getAuthHeader(FIXTURES.users.tenant) },
    });
    const quoteData = await quoteRes.json();
    assert(
      quoteRes.status === 200 &&
      quoteData.scheduleCurrency === 'USD' &&
      quoteData.targetCurrency === 'IQD' &&
      Number(quoteData.exchangeRate) === 1310 &&
      Number(quoteData.convertedAmount) === 1310000,
      'CONVERSION_QUOTE_ACCURATE',
      `Expected $1000 USD to quote 1,310,000 IQD at rate 1310, got ${quoteData.convertedAmount}`
    );

    // TEST 2: Paying USD schedule in IQD without allowConversion throws CURRENCY_MISMATCH
    const unquotedRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.tenant),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.properties.usdProp,
        leaseId: FIXTURES.leases.usdLease,
        scheduleId: FIXTURES.schedules.usdSched,
        amount: 1310000,
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: 'TXN-NO-CONV',
        allowConversion: false,
      }),
    });
    const unquotedBody = await unquotedRes.json();
    assert(
      unquotedRes.status === 400 && String(unquotedBody.error).includes('CURRENCY_MISMATCH'),
      'CROSS_CURRENCY_WITHOUT_CONSENT_REJECTED',
      `Expected CURRENCY_MISMATCH without allowConversion, got ${unquotedRes.status} (${unquotedBody.error})`
    );

    // TEST 3: Paying USD schedule in IQD with allowConversion: true succeeds (1,310,000 IQD for $1,000 USD)
    const convertedPayRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.tenant),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.properties.usdProp,
        leaseId: FIXTURES.leases.usdLease,
        scheduleId: FIXTURES.schedules.usdSched,
        amount: 1310000,
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: 'TXN-FIB-IQD-USD-01',
        allowConversion: true,
      }),
    });
    const convertedPayBody = await convertedPayRes.json();
    assert(
      convertedPayRes.status === 201 &&
      convertedPayBody.success === true &&
      convertedPayBody.payment.currency === 'IQD' &&
      Number(convertedPayBody.payment.amount) === 1310000,
      'CROSS_CURRENCY_PAYMENT_RECORDED',
      `Expected payment recorded in IQD for USD schedule, got status ${convertedPayRes.status}, amount: ${convertedPayBody?.payment?.amount}`
    );

    const paymentId = convertedPayBody.payment.id;

    // TEST 4: Overpayment prevention across currencies (100,000 additional IQD rejected)
    const overpayRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.tenant),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.properties.usdProp,
        leaseId: FIXTURES.leases.usdLease,
        scheduleId: FIXTURES.schedules.usdSched,
        amount: 100000,
        currency: 'IQD',
        paymentMethod: 'FIB',
        allowConversion: true,
      }),
    });
    assert(
      overpayRes.status === 400 && String((await overpayRes.json()).error).includes('exceeds'),
      'CROSS_CURRENCY_OVERPAYMENT_BLOCKED',
      `Expected aggregate overpayment rejection, got ${overpayRes.status}`
    );

    // TEST 5: Payment confirmation successfully updates USD schedule to PAID
    await leaseRepository.confirmPayment(paymentId, FIXTURES.users.admin, {
      referenceNumber: 'CONF-FIB-1310K-IQD',
    });

    const [confirmedSched] = await db.select().from(rentSchedules)
      .where(eq(rentSchedules.id, FIXTURES.schedules.usdSched));

    assert(
      confirmedSched.status === 'PAID' && Number(confirmedSched.paidAmount) === 1000,
      'USD_SCHEDULE_SETTLED_BY_IQD_PAYMENT',
      `Expected USD schedule status PAID with paidAmount 1000, got status=${confirmedSched.status}, paid=${confirmedSched.paidAmount}`
    );

    // TEST 6: Reverse direction — Paying IQD schedule (1,310,000 IQD) with $1,000 USD
    const payIqdWithUsd = await leaseRepository.recordPayment(
      FIXTURES.properties.iqdProp,
      FIXTURES.leases.iqdLease,
      FIXTURES.users.tenant,
      FIXTURES.schedules.iqdSched,
      1000,
      'CASH',
      'TXN-USD-CASH-1000',
      FIXTURES.users.admin,
      'USD',
      { allowConversion: true }
    );

    assert(
      payIqdWithUsd.currency === 'USD' && Number(payIqdWithUsd.amount) === 1000,
      'USD_PAYMENT_RECORDED_FOR_IQD_SCHEDULE',
      `Recorded USD payment for IQD obligation, got amt=${payIqdWithUsd.amount}, cur=${payIqdWithUsd.currency}`
    );

    // Confirm the USD payment against the IQD schedule
    await leaseRepository.confirmPayment(payIqdWithUsd.id, FIXTURES.users.admin);

    const [confirmedIqdSched] = await db.select().from(rentSchedules)
      .where(eq(rentSchedules.id, FIXTURES.schedules.iqdSched));

    assert(
      confirmedIqdSched.status === 'PAID' && Number(confirmedIqdSched.paidAmount) === 1310000,
      'IQD_SCHEDULE_SETTLED_BY_USD_PAYMENT',
      `Expected IQD schedule status PAID with paidAmount 1,310,000, got status=${confirmedIqdSched.status}, paid=${confirmedIqdSched.paidAmount}`
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

runDualCurrencyVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
