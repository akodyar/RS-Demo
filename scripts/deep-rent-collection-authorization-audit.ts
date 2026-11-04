/**
 * HOMEHUB — DEEP ADVERSARIAL AUTHORIZATION & INTEGRITY AUDIT
 * Tests negative authorization boundaries and security controls.
 */

import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  ownerSettlements,
  payoutRequests,
  journalEntries,
  ledgerLines,
} from '../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS [${testName}] ${details}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL [${testName}] ${details}`);
    failedTests++;
  }
}

const RUN_ID = `adv_${Date.now()}`;

const FIXTURES = {
  ownerA: `adv_owner_a_${RUN_ID}`,
  ownerB: `adv_owner_b_${RUN_ID}`,
  tenantA: `adv_tenant_a_${RUN_ID}`,
  tenantB: `adv_tenant_b_${RUN_ID}`,
  companyAdmin: `adv_comp_adm_${RUN_ID}`,
  companyViewer: `adv_comp_view_${RUN_ID}`,
  stranger: `adv_stranger_${RUN_ID}`,
  admin: `adv_admin_${RUN_ID}`,
  orgActive: `adv_org_act_${RUN_ID}`,
  orgPending: `adv_org_pnd_${RUN_ID}`,
  propA: `adv_prop_a_${RUN_ID}`,
  propB: `adv_prop_b_${RUN_ID}`,
  leaseA: `adv_lease_a_${RUN_ID}`,
  schedA: `adv_sched_a_${RUN_ID}`,
};

function getAuthHeader(userId: string, role: string, orgId?: string): string {
  const payload = { uid: userId, role, organizationId: orgId };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

async function runAdversarialAudit() {
  console.log('========================================================================');
  console.log('  HOMEHUB — ADVERSARIAL SECURITY & AUTHORIZATION BOUNDARY AUDIT');
  console.log('========================================================================');

  // 1. Seed base fixtures
  await db.insert(users).values([
    { id: FIXTURES.ownerA, uid: FIXTURES.ownerA, email: `${FIXTURES.ownerA}@homehub.test`, firstName: 'Owner', lastName: 'A', roles: ['PROPERTY_OWNER'], isActive: true },
    { id: FIXTURES.ownerB, uid: FIXTURES.ownerB, email: `${FIXTURES.ownerB}@homehub.test`, firstName: 'Owner', lastName: 'B', roles: ['PROPERTY_OWNER'], isActive: true },
    { id: FIXTURES.tenantA, uid: FIXTURES.tenantA, email: `${FIXTURES.tenantA}@homehub.test`, firstName: 'Tenant', lastName: 'A', roles: ['TENANT'], isActive: true },
    { id: FIXTURES.tenantB, uid: FIXTURES.tenantB, email: `${FIXTURES.tenantB}@homehub.test`, firstName: 'Tenant', lastName: 'B', roles: ['TENANT'], isActive: true },
    { id: FIXTURES.companyAdmin, uid: FIXTURES.companyAdmin, email: `${FIXTURES.companyAdmin}@homehub.test`, firstName: 'Comp', lastName: 'Admin', roles: ['COMPANY_MEMBER', 'COMPANY_ADMIN'], organizationId: FIXTURES.orgActive, isActive: true },
    { id: FIXTURES.companyViewer, uid: FIXTURES.companyViewer, email: `${FIXTURES.companyViewer}@homehub.test`, firstName: 'Comp', lastName: 'Viewer', roles: ['COMPANY_MEMBER'], organizationId: FIXTURES.orgActive, isActive: true },
    { id: FIXTURES.stranger, uid: FIXTURES.stranger, email: `${FIXTURES.stranger}@homehub.test`, firstName: 'Stranger', lastName: 'User', roles: ['PROPERTY_OWNER'], isActive: true },
    { id: FIXTURES.admin, uid: FIXTURES.admin, email: `${FIXTURES.admin}@homehub.test`, firstName: 'Super', lastName: 'Admin', roles: ['PLATFORM_ADMIN'], isActive: true },
  ]);

  await db.insert(organizations).values([
    { id: FIXTURES.orgActive, name: 'Active PM Agency', type: 'COMPANY' },
    { id: FIXTURES.orgPending, name: 'Pending PM Agency', type: 'COMPANY' },
  ]);

  await db.insert(organizationMembers).values([
    { organizationId: FIXTURES.orgActive, userId: FIXTURES.companyAdmin, role: 'COMPANY_ADMIN', status: 'ACTIVE' },
    { organizationId: FIXTURES.orgActive, userId: FIXTURES.companyViewer, role: 'VIEWER', status: 'ACTIVE' },
  ]);

  await db.insert(properties).values([
    { id: FIXTURES.propA, name: 'Property A', type: 'APARTMENT', status: 'RENTED', operatingModel: 'FULLY_MANAGED', verificationStatus: 'VERIFIED' },
    { id: FIXTURES.propB, name: 'Property B', type: 'APARTMENT', status: 'RENTED', operatingModel: 'FULLY_MANAGED', verificationStatus: 'VERIFIED' },
  ]);

  await db.insert(ownershipRecords).values([
    { propertyId: FIXTURES.propA, ownerId: FIXTURES.ownerA, status: 'VERIFIED', ownershipPercentage: '100' },
    { propertyId: FIXTURES.propB, ownerId: FIXTURES.ownerB, status: 'VERIFIED', ownershipPercentage: '100' },
  ]);

  // Management Agreement for Prop A with Active Org (granted COLLECT_RENT)
  await db.insert(managementAgreements).values({
    propertyId: FIXTURES.propA,
    companyId: FIXTURES.orgActive,
    ownerId: FIXTURES.ownerA,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    grantedPermissions: ['COLLECT_RENT', 'VIEW_PROPERTY'],
  });

  // Expired Management Agreement for Prop B
  await db.insert(managementAgreements).values({
    propertyId: FIXTURES.propB,
    companyId: FIXTURES.orgActive,
    ownerId: FIXTURES.ownerB,
    status: 'ACTIVE',
    startDate: '2024-01-01',
    endDate: '2024-12-31', // EXPIRED!
    grantedPermissions: ['COLLECT_RENT', 'VIEW_PROPERTY'],
  });

  // Lease for Prop A with Tenant A
  await db.insert(leases).values({
    id: FIXTURES.leaseA,
    propertyId: FIXTURES.propA,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '500',
    currency: 'USD',
    status: 'ACTIVE',
  });
  await db.insert(leaseTenants).values({ leaseId: FIXTURES.leaseA, tenantId: FIXTURES.tenantA, isPrimary: true });

  await db.insert(rentSchedules).values({
    id: FIXTURES.schedA,
    leaseId: FIXTURES.leaseA,
    propertyId: FIXTURES.propA,
    tenantId: FIXTURES.tenantA,
    amount: '500',
    currency: 'USD',
    dueDate: '2026-11-01',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    status: 'DUE',
    paidAmount: '0',
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
    // -------------------------------------------------------------------------
    // TEST 1: Stranger attempting to record payment on Property A
    // -------------------------------------------------------------------------
    const strangerRes = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.stranger, 'PROPERTY_OWNER'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propA,
        leaseId: FIXTURES.leaseA,
        payerId: FIXTURES.tenantA,
        amount: 500,
        paymentMethod: 'CASH',
      }),
    });
    assert(
      strangerRes.status === 403,
      'STRANGER_CANNOT_RECORD_PAYMENT',
      `Expected 403 Forbidden for stranger, got ${strangerRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Company Member with VIEWER role attempting to record payment
    // -------------------------------------------------------------------------
    const viewerRes = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.companyViewer, 'COMPANY_MEMBER', FIXTURES.orgActive),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propA,
        leaseId: FIXTURES.leaseA,
        payerId: FIXTURES.tenantA,
        amount: 500,
        paymentMethod: 'CASH',
      }),
    });
    assert(
      viewerRes.status === 403,
      'COMPANY_VIEWER_CANNOT_RECORD_PAYMENT',
      `Expected 403 Forbidden for VIEWER role, got ${viewerRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Company attempting to record payment under EXPIRED management agreement
    // -------------------------------------------------------------------------
    const expiredRes = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.companyAdmin, 'COMPANY_ADMIN', FIXTURES.orgActive),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propB,
        amount: 500,
        paymentMethod: 'CASH',
      }),
    });
    assert(
      expiredRes.status === 403,
      'EXPIRED_AGREEMENT_DENIED_COLLECTION',
      `Expected 403 Forbidden for expired agreement, got ${expiredRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Tenant attempting to call /leases/payments (must use /tenant/payments/pay-rent)
    // -------------------------------------------------------------------------
    const tenantDirectRes = await fetch(`${baseUrl}/leases/payments`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.tenantA, 'TENANT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propA,
        leaseId: FIXTURES.leaseA,
        payerId: FIXTURES.tenantA,
        amount: 500,
        paymentMethod: 'CASH',
      }),
    });
    assert(
      tenantDirectRes.status === 403,
      'TENANT_CANNOT_ACCESS_MANAGER_PAYMENT_ROUTE',
      `Expected 403 Forbidden for Tenant on manager route, got ${tenantDirectRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Tenant B attempting to pay for Tenant A's lease via /tenant/payments/pay-rent
    // -------------------------------------------------------------------------
    const tenantBStealRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.tenantB, 'TENANT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propA,
        leaseId: FIXTURES.leaseA,
        scheduleId: FIXTURES.schedA,
        amount: 500,
        currency: 'USD',
        paymentMethod: 'FIB',
      }),
    });
    assert(
      tenantBStealRes.status === 403,
      'CROSS_TENANT_LEASE_ACCESS_BLOCKED',
      `Expected 403 Forbidden for Tenant B paying Tenant A lease, got ${tenantBStealRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Overpayment attempt (paying $800 on a $500 schedule)
    // -------------------------------------------------------------------------
    const overpayRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.tenantA, 'TENANT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propA,
        leaseId: FIXTURES.leaseA,
        scheduleId: FIXTURES.schedA,
        amount: 800,
        currency: 'USD',
        paymentMethod: 'FIB',
      }),
    });
    assert(
      overpayRes.status === 400,
      'OVERPAYMENT_REJECTED',
      `Expected 400 for overpayment amount ($800 > $500), got ${overpayRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Tenant A submits valid payment ($500)
    // -------------------------------------------------------------------------
    const validPayRes = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.tenantA, 'TENANT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.propA,
        leaseId: FIXTURES.leaseA,
        scheduleId: FIXTURES.schedA,
        amount: 500,
        currency: 'USD',
        paymentMethod: 'FIB',
        referenceNumber: 'TXN-ADV-FIB-500',
      }),
    });
    const validPayJson = await validPayRes.json();
    assert(
      validPayRes.status === 201 && validPayJson.payment.status === 'RECORDED',
      'VALID_TENANT_PAYMENT_SUBMITTED',
      `Payment ID: ${validPayJson.payment?.id}, status: ${validPayJson.payment?.status}`
    );

    const paymentId = validPayJson.payment.id;

    // -------------------------------------------------------------------------
    // TEST 8: Tenant attempting to confirm their own payment
    // -------------------------------------------------------------------------
    const tenantConfirmRes = await fetch(`${baseUrl}/leases/payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.tenantA, 'TENANT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referenceNumber: 'TXN-ADV-FIB-500' }),
    });
    assert(
      tenantConfirmRes.status === 403,
      'TENANT_CANNOT_CONFIRM_PAYMENT',
      `Expected 403 Forbidden for tenant self-confirmation, got ${tenantConfirmRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Stranger attempting to confirm payment
    // -------------------------------------------------------------------------
    const strangerConfirmRes = await fetch(`${baseUrl}/leases/payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.stranger, 'PROPERTY_OWNER'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referenceNumber: 'TXN-ADV-FIB-500' }),
    });
    assert(
      strangerConfirmRes.status === 403,
      'STRANGER_CANNOT_CONFIRM_PAYMENT',
      `Expected 403 Forbidden for stranger confirmation, got ${strangerConfirmRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Digital payment confirmation without reference number is rejected
    // -------------------------------------------------------------------------
    // Temporarily clear reference number
    await db.update(paymentRecords).set({ referenceNumber: null }).where(eq(paymentRecords.id, paymentId));
    const noRefConfirmRes = await fetch(`${baseUrl}/leases/payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.companyAdmin, 'COMPANY_ADMIN', FIXTURES.orgActive),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referenceNumber: '' }),
    });
    assert(
      noRefConfirmRes.status === 400,
      'DIGITAL_CONFIRMATION_REQUIRES_REFERENCE',
      `Expected 400 for missing verification evidence, got ${noRefConfirmRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Authorized Manager confirms digital payment with valid reference
    // -------------------------------------------------------------------------
    const validConfirmRes = await fetch(`${baseUrl}/leases/payments/${paymentId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.companyAdmin, 'COMPANY_ADMIN', FIXTURES.orgActive),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ referenceNumber: 'TXN-ADV-FIB-500' }),
    });
    const validConfirmJson = await validConfirmRes.json();
    assert(
      validConfirmRes.status === 200 && validConfirmJson.payment.status === 'CONFIRMED',
      'AUTHORIZED_MANAGER_CONFIRMS_PAYMENT',
      `Status: ${validConfirmJson.payment?.status}, confirmedBy: ${validConfirmJson.payment?.confirmedByUserId}`
    );

    // -------------------------------------------------------------------------
    // TEST 12: Tenant attempting to reverse confirmed payment
    // -------------------------------------------------------------------------
    const tenantRevRes = await fetch(`${baseUrl}/leases/payments/${paymentId}/reverse`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.tenantA, 'TENANT'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason: 'Malicious reversal attempt' }),
    });
    assert(
      tenantRevRes.status === 403,
      'TENANT_CANNOT_REVERSE_PAYMENT',
      `Expected 403 Forbidden for tenant payment reversal, got ${tenantRevRes.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 13: Stranger attempting to view Owner A's settlements
    // -------------------------------------------------------------------------
    const strangerSettleRes = await fetch(`${baseUrl}/settlements/owner/settlements`, {
      headers: { Authorization: getAuthHeader(FIXTURES.stranger, 'PROPERTY_OWNER') },
    });
    const strangerSettleList = await strangerSettleRes.json();
    assert(
      strangerSettleRes.status === 200 && strangerSettleList.length === 0,
      'CROSS_OWNER_SETTLEMENT_ISOLATION',
      `Stranger sees 0 settlements (isolated from Owner A)`
    );

    // -------------------------------------------------------------------------
    // TEST 14: Owner A sees their settlement
    // -------------------------------------------------------------------------
    const ownerASettleRes = await fetch(`${baseUrl}/settlements/owner/settlements`, {
      headers: { Authorization: getAuthHeader(FIXTURES.ownerA, 'PROPERTY_OWNER') },
    });
    const ownerASettleList = await ownerASettleRes.json();
    assert(
      ownerASettleRes.status === 200 && ownerASettleList.length === 1,
      'OWNER_SEES_OWN_SETTLEMENT',
      `Owner A sees exactly 1 settlement for ${ownerASettleList[0]?.netPayableIqd} net payable`
    );

    const settlementId = ownerASettleList[0].id;

    // -------------------------------------------------------------------------
    // TEST 15: Stranger attempting to request payout for Owner A's settlement
    // -------------------------------------------------------------------------
    const strangerPayoutRes = await fetch(`${baseUrl}/settlements/owner/settlements/${settlementId}/payout`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.stranger, 'PROPERTY_OWNER'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amountIqd: 100 }),
    });
    assert(
      strangerPayoutRes.status === 404,
      'STRANGER_CANNOT_REQUEST_PAYOUT_FOR_FOREIGN_SETTLEMENT',
      `Expected 404 (or 403) for foreign settlement payout request, got ${strangerPayoutRes.status}`
    );

    console.log('\n========================================================================');
    console.log(`  ADVERSARIAL AUDIT: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
    console.log('========================================================================\n');
  } finally {
    server.close();
  }
}

runAdversarialAudit().catch(err => {
  console.error('Fatal adversarial audit failure:', err);
  process.exit(1);
});
