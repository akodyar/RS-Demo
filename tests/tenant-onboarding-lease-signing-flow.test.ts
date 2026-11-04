import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  rentalApplications,
  ownershipRecords,
  rentSchedules,
  securityDeposits,
} from '../src/db/schema.js';
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
    tenant: 'usr_flow_tenant_onboard',
    intruder: 'usr_flow_tenant_intruder',
    landlord: 'usr_flow_landlord_onboard',
  },
  properties: {
    prop1: 'prop_flow_onboard_01',
  },
  ownershipRecords: {
    rec1: 'own_flow_onboard_01',
  },
  leases: {
    leasePending: 'lease_flow_pending_01',
  },
  leaseTenants: {
    lt1: 'lt_flow_pending_01',
  },
  applications: {
    app1: 'app_flow_onboard_01',
  },
};

function getAuthHeader(userId: string, role: string = 'TENANT'): string {
  const payload = { uid: userId, role };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

async function cleanupData() {
  try {
    await db.delete(securityDeposits).where(inArray(securityDeposits.leaseId, Object.values(FIXTURES.leases)));
    await db.delete(rentSchedules).where(inArray(rentSchedules.leaseId, Object.values(FIXTURES.leases)));
    await db.delete(rentalApplications).where(inArray(rentalApplications.id, Object.values(FIXTURES.applications)));
    await db.delete(leaseTenants).where(inArray(leaseTenants.id, Object.values(FIXTURES.leaseTenants)));
    await db.delete(leases).where(inArray(leases.id, Object.values(FIXTURES.leases)));
    await db.delete(ownershipRecords).where(inArray(ownershipRecords.id, Object.values(FIXTURES.ownershipRecords)));
    await db.delete(properties).where(inArray(properties.id, Object.values(FIXTURES.properties)));
    await db.delete(users).where(inArray(users.id, Object.values(FIXTURES.users)));
  } catch (err) {
    console.warn('Warning during cleanupData:', err);
  }
}

async function runOnboardingFlowVerification() {
  console.log('================================================================');
  console.log('  HOMEHUB TENANT DOMAIN — ONBOARDING & LEASE SIGNING FLOW');
  console.log('================================================================');

  const TARGET_TEST_DATABASE = 'homehub_test';
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    console.error(`ABORT: Tests must run exclusively against '${TARGET_TEST_DATABASE}'. Current: '${targetDb}'`);
    process.exit(1);
  }

  await cleanupData();

  // 1. Seed test users
  await db.insert(users).values([
    {
      id: FIXTURES.users.tenant,
      uid: FIXTURES.users.tenant,
      email: 'onboard_tenant@homehub.test',
      phone: '+9647500000081',
      firstName: 'Aram',
      lastName: 'Karim',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: FIXTURES.users.intruder,
      uid: FIXTURES.users.intruder,
      email: 'onboard_intruder@homehub.test',
      phone: '+9647500000082',
      firstName: 'Intruder',
      lastName: 'User',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: FIXTURES.users.landlord,
      uid: FIXTURES.users.landlord,
      email: 'onboard_landlord@homehub.test',
      phone: '+9647500000083',
      firstName: 'Slemani Luxury',
      lastName: 'Properties',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
  ]);

  // 2. Seed property
  await db.insert(properties).values({
    id: FIXTURES.properties.prop1,
    name: 'Slemani Garden View Villa',
    type: 'APARTMENT',
    status: 'AVAILABLE',
    address: { street: 'Sarchinar Boulevard 12', city: 'Sulaymaniyah' },
  });

  // 3. Seed ownership record
  await db.insert(ownershipRecords).values({
    id: FIXTURES.ownershipRecords.rec1,
    propertyId: FIXTURES.properties.prop1,
    ownerId: FIXTURES.users.landlord,
    status: 'VERIFIED',
    ownershipPercentage: '100',
  });

  // 4. Seed rental application
  await db.insert(rentalApplications).values({
    id: FIXTURES.applications.app1,
    propertyId: FIXTURES.properties.prop1,
    applicantUserId: FIXTURES.users.tenant,
    status: 'UNDER_REVIEW',
    monthlyIncome: '3500000',
    notes: 'Family moving to Slemani in November',
  });

  // 5. Seed pending lease offer
  await db.insert(leases).values({
    id: FIXTURES.leases.leasePending,
    propertyId: FIXTURES.properties.prop1,
    startDate: '2026-11-01',
    endDate: '2027-10-31',
    rentAmount: '1200000',
    depositAmount: '1200000',
    currency: 'IQD',
    status: 'PENDING_SIGNATURE',
  });

  // 6. Connect tenant to lease via leaseTenants
  await db.insert(leaseTenants).values({
    id: FIXTURES.leaseTenants.lt1,
    leaseId: FIXTURES.leases.leasePending,
    tenantId: FIXTURES.users.tenant,
    isPrimary: true,
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
    // TEST 1: Tenant with no active lease receives 403 NO_ACTIVE_LEASE on /tenant/dashboard
    const dashRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: getAuthHeader(FIXTURES.users.tenant) },
    });
    const dashBody = await dashRes.json();
    assert(
      dashRes.status === 403 && (dashBody.error === 'NO_ACTIVE_LEASE' || dashBody.code === 'NO_ACTIVE_LEASE'),
      'DASHBOARD_NO_ACTIVE_LEASE_BLOCKED',
      `Expected 403 NO_ACTIVE_LEASE on dashboard, got ${dashRes.status} (${dashBody.error})`
    );

    // TEST 2: Tenant can access /tenant/onboarding-status without active lease
    const onboardRes = await fetch(`${baseUrl}/tenant/onboarding-status`, {
      headers: { Authorization: getAuthHeader(FIXTURES.users.tenant) },
    });
    const onboardData = await onboardRes.json();
    assert(
      onboardRes.status === 200,
      'ONBOARDING_STATUS_200_OK',
      `Expected 200 OK from /onboarding-status, got ${onboardRes.status}`
    );

    // TEST 3: Onboarding status contains submitted applications
    const apps = onboardData.applications || [];
    assert(
      apps.length === 1 && apps[0].id === FIXTURES.applications.app1 && apps[0].propertyName === 'Slemani Garden View Villa',
      'ONBOARDING_APPLICATION_HYDRATED',
      `Expected 1 application with property name, got ${apps.length} (Name: ${apps[0]?.propertyName})`
    );

    // TEST 4: Onboarding status contains pending lease offers with full terms
    const pendingLeases = onboardData.pendingLeases || [];
    const targetLease = pendingLeases.find((l: any) => l.id === FIXTURES.leases.leasePending);
    assert(
      targetLease !== undefined &&
      Number(targetLease.monthlyRent) === 1200000 &&
      targetLease.landlordName === 'Slemani Luxury Properties' &&
      targetLease.propertyName === 'Slemani Garden View Villa',
      'PENDING_LEASE_OFFER_DETAILS',
      `Expected lease offer with rent 1,200,000 IQD and landlord info, got rent=${targetLease?.monthlyRent}, landlord=${targetLease?.landlordName}`
    );

    // TEST 5: Direct applications route returns applications
    const appRes = await fetch(`${baseUrl}/tenant/applications`, {
      headers: { Authorization: getAuthHeader(FIXTURES.users.tenant) },
    });
    const appList = await appRes.json();
    assert(
      appRes.status === 200 && appList.length === 1,
      'APPLICATIONS_ROUTE_SUCCESS',
      `Expected 200 OK and 1 application, got ${appRes.status} and length ${appList.length}`
    );

    // TEST 6: IDOR Protection: Intruder cannot accept this lease
    const intruderAcceptRes = await fetch(`${baseUrl}/tenant/lease/${FIXTURES.leases.leasePending}/accept`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.intruder),
        'Content-Type': 'application/json',
      },
    });
    assert(
      intruderAcceptRes.status === 403,
      'INTRUDER_LEASE_ACCEPT_BLOCKED',
      `Expected 403 for unauthorized lease accept, got ${intruderAcceptRes.status}`
    );

    // TEST 7: Tenant accepts the pending lease offer
    const acceptRes = await fetch(`${baseUrl}/tenant/lease/${FIXTURES.leases.leasePending}/accept`, {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(FIXTURES.users.tenant),
        'Content-Type': 'application/json',
      },
    });
    const acceptBody = await acceptRes.json();
    assert(
      acceptRes.status === 200 && acceptBody.success === true && acceptBody.lease.status === 'ACTIVE',
      'TENANT_LEASE_ACCEPT_SUCCESS',
      `Expected 200 OK with lease status ACTIVE, got ${acceptRes.status} (status: ${acceptBody?.lease?.status})`
    );

    // TEST 8: After acceptance, /tenant/dashboard succeeds with 200 OK and active lease data
    const activeDashRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { Authorization: getAuthHeader(FIXTURES.users.tenant) },
    });
    const activeDashBody = await activeDashRes.json();
    assert(
      activeDashRes.status === 200 &&
      (activeDashBody.myLease?.leaseId === FIXTURES.leases.leasePending || activeDashBody.currentProperty?.id === FIXTURES.properties.prop1) &&
      activeDashBody.currentProperty?.name === 'Slemani Garden View Villa',
      'DASHBOARD_ACTIVE_AFTER_ACCEPTANCE',
      `Expected 200 OK with active lease on dashboard, got ${activeDashRes.status} (Lease: ${activeDashBody.myLease?.leaseId})`
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

runOnboardingFlowVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
