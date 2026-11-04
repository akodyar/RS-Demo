import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { properties, leases, leaseTenants, users, maintenanceRequests } from '../src/db/schema.js';
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

// Dedicated test fixture identifiers (completely isolated from shared demo seeds)
const FIXTURES = {
  properties: {
    propA: 'prop_iso_ten_a',
    propB: 'prop_iso_ten_b',
  },
  users: {
    active: 'usr_iso_ten_active',
    inactive: 'usr_iso_ten_inactive',
    terminated: 'usr_iso_ten_term',
    tenantB: 'usr_iso_ten_b',
    draft: 'usr_iso_ten_draft',
    pending: 'usr_iso_ten_pending',
    rejected: 'usr_iso_ten_rejected',
    expiring: 'usr_iso_ten_expiring',
    expired: 'usr_iso_ten_expired',
    buyer: 'usr_iso_non_tenant_buyer',
  },
  leases: {
    active: 'lease_iso_ten_active',
    terminated: 'lease_iso_ten_term',
    activeB: 'lease_iso_ten_active_b',
    draft: 'lease_iso_ten_draft',
    pending: 'lease_iso_ten_pending',
    rejected: 'lease_iso_ten_rejected',
    expiring: 'lease_iso_ten_expiring',
    expired: 'lease_iso_ten_expired',
  },
  leaseTenants: {
    active: 'lt_iso_ten_active',
    terminated: 'lt_iso_ten_term',
    activeB: 'lt_iso_ten_active_b',
    draft: 'lt_iso_ten_draft',
    pending: 'lt_iso_ten_pending',
    rejected: 'lt_iso_ten_rejected',
    expiring: 'lt_iso_ten_expiring',
    expired: 'lt_iso_ten_expired',
  },
  maintenance: {
    maintA: 'mnt_iso_ten_a',
    maintB: 'mnt_iso_ten_b',
  },
};

// Generates dev-register auth token mapped to isolated test user
function getAuthHeader(userId: string, role: string = 'TENANT'): string {
  const payload = { uid: userId, role };
  const token = 'dev-register-' + Buffer.from(JSON.stringify(payload)).toString('base64');
  return `Bearer ${token}`;
}

async function cleanupData() {
  const maintIds = Object.values(FIXTURES.maintenance);
  const ltIds = Object.values(FIXTURES.leaseTenants);
  const leaseIds = Object.values(FIXTURES.leases);
  const propIds = Object.values(FIXTURES.properties);
  const userIds = Object.values(FIXTURES.users);

  // Also include obsolete test-owned IDs from previous unisolated iterations
  const legacyTestUsers = [
    'user_tenant_draft',
    'user_tenant_pending',
    'user_tenant_rejected',
    'user_tenant_expired',
    'user_tenant_terminated_01',
    'user_tenant_trans_01',
  ];
  const legacyTestLeases = [
    'lease-active',
    'lease-draft',
    'lease-terminated',
    'lease-active-b',
    'lease-pending',
    'lease-rejected',
    'lease-expired',
    'lease-expiring',
    'lease-trans',
  ];
  const legacyTestProps = ['prop-tenant-a', 'prop-tenant-b'];

  try {
    await db.delete(maintenanceRequests).where(inArray(maintenanceRequests.id, maintIds));
    await db.delete(leaseTenants).where(inArray(leaseTenants.id, [...ltIds, 'lt-1', 'lt-3', 'lt-4', 'lt-d', 'lt-p', 'lt-r', 'lt-exing', 'lt-ex', 'lt-trans']));
    await db.delete(leases).where(inArray(leases.id, [...leaseIds, ...legacyTestLeases]));
    await db.delete(properties).where(inArray(properties.id, [...propIds, ...legacyTestProps]));
    await db.delete(users).where(inArray(users.id, [...userIds, ...legacyTestUsers]));
  } catch (err) {
    console.warn('Warning during cleanupData:', err);
  }
}

async function runRealPostgresTenantVerification() {
  console.log('================================================================');
  console.log('  HOMEHUB TENANT DOMAIN — REAL POSTGRESQL VERIFICATION');
  console.log('================================================================');

  // Hard safety gate: must target homehub_test
  const TARGET_TEST_DATABASE = 'homehub_test';
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}'. Current value: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  process.env.SQL_HOST = process.env.SQL_HOST || '127.0.0.1';
  process.env.SQL_PORT = process.env.SQL_PORT || '5432';

  // Verify live connection database name
  const connCheck = await (db as any).execute('SELECT current_database() as db_name, current_user as db_user');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  if (activeDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: Active connection is to '${activeDb}', but must be '${TARGET_TEST_DATABASE}'. Aborting.`);
  }
  console.log(`Connected to verified test database: '${activeDb}' as '${connCheck.rows?.[0]?.db_user || 'unknown'}'`);

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    await cleanupData();

    // 1. Insert Isolated Test Users (zero reuse of shared demo accounts)
    await db.insert(users).values([
      { id: FIXTURES.users.active, uid: FIXTURES.users.active, email: 'iso_active@test.homehub.iq', firstName: 'IsoActive', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.inactive, uid: FIXTURES.users.inactive, email: 'iso_inactive@test.homehub.iq', firstName: 'IsoInactive', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.terminated, uid: FIXTURES.users.terminated, email: 'iso_term@test.homehub.iq', firstName: 'IsoTerm', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.tenantB, uid: FIXTURES.users.tenantB, email: 'iso_b@test.homehub.iq', firstName: 'IsoB', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.draft, uid: FIXTURES.users.draft, email: 'iso_draft@test.homehub.iq', firstName: 'IsoDraft', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.pending, uid: FIXTURES.users.pending, email: 'iso_pending@test.homehub.iq', firstName: 'IsoPending', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.rejected, uid: FIXTURES.users.rejected, email: 'iso_rejected@test.homehub.iq', firstName: 'IsoRejected', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.expiring, uid: FIXTURES.users.expiring, email: 'iso_expiring@test.homehub.iq', firstName: 'IsoExpiring', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.expired, uid: FIXTURES.users.expired, email: 'iso_expired@test.homehub.iq', firstName: 'IsoExpired', lastName: 'Tenant', roles: ['TENANT'], isActive: true },
      { id: FIXTURES.users.buyer, uid: FIXTURES.users.buyer, email: 'iso_buyer@test.homehub.iq', firstName: 'IsoBuyer', lastName: 'User', roles: ['BUYER'], isActive: true },
    ]);

    // 2. Insert Isolated Properties
    await db.insert(properties).values([
      { id: FIXTURES.properties.propA, name: 'Isolated Prop A', type: 'APARTMENT', address: { street: '100 Iso St' }, status: 'AVAILABLE' },
      { id: FIXTURES.properties.propB, name: 'Isolated Prop B', type: 'APARTMENT', address: { street: '200 Iso St' }, status: 'AVAILABLE' },
    ]);

    // 3. Insert Isolated Leases
    await db.insert(leases).values([
      { id: FIXTURES.leases.active, propertyId: FIXTURES.properties.propA, status: 'ACTIVE', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1000' },
      { id: FIXTURES.leases.terminated, propertyId: FIXTURES.properties.propA, status: 'TERMINATED', startDate: '2023-01-01', endDate: '2024-01-01', rentAmount: '1000' },
      { id: FIXTURES.leases.activeB, propertyId: FIXTURES.properties.propB, status: 'ACTIVE', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1500' },
      { id: FIXTURES.leases.draft, propertyId: FIXTURES.properties.propA, status: 'DRAFT', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1000' },
      { id: FIXTURES.leases.pending, propertyId: FIXTURES.properties.propA, status: 'PENDING', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1000' },
      { id: FIXTURES.leases.rejected, propertyId: FIXTURES.properties.propA, status: 'REJECTED', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1000' },
      { id: FIXTURES.leases.expiring, propertyId: FIXTURES.properties.propA, status: 'EXPIRING', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1000' },
      { id: FIXTURES.leases.expired, propertyId: FIXTURES.properties.propA, status: 'EXPIRED', startDate: '2024-01-01', endDate: '2025-01-01', rentAmount: '1000' },
    ]);

    // 4. Insert Isolated Lease Tenants (1-to-1 links, strictly isolated)
    await db.insert(leaseTenants).values([
      { id: FIXTURES.leaseTenants.active, leaseId: FIXTURES.leases.active, tenantId: FIXTURES.users.active, isPrimary: true },
      { id: FIXTURES.leaseTenants.terminated, leaseId: FIXTURES.leases.terminated, tenantId: FIXTURES.users.terminated, isPrimary: true },
      { id: FIXTURES.leaseTenants.activeB, leaseId: FIXTURES.leases.activeB, tenantId: FIXTURES.users.tenantB, isPrimary: true },
      { id: FIXTURES.leaseTenants.draft, leaseId: FIXTURES.leases.draft, tenantId: FIXTURES.users.draft, isPrimary: true },
      { id: FIXTURES.leaseTenants.pending, leaseId: FIXTURES.leases.pending, tenantId: FIXTURES.users.pending, isPrimary: true },
      { id: FIXTURES.leaseTenants.rejected, leaseId: FIXTURES.leases.rejected, tenantId: FIXTURES.users.rejected, isPrimary: true },
      { id: FIXTURES.leaseTenants.expiring, leaseId: FIXTURES.leases.expiring, tenantId: FIXTURES.users.expiring, isPrimary: true },
      { id: FIXTURES.leaseTenants.expired, leaseId: FIXTURES.leases.expired, tenantId: FIXTURES.users.expired, isPrimary: true },
    ]);

    // 5. Insert Isolated Maintenance Tickets for IDOR Testing
    await db.insert(maintenanceRequests).values([
      {
        id: FIXTURES.maintenance.maintA,
        propertyId: FIXTURES.properties.propA,
        reporterUserId: FIXTURES.users.active,
        category: 'PLUMBING',
        priority: 'NORMAL',
        status: 'REPORTED',
        title: 'Tenant A Faucet Issue',
        description: 'Dripping water in bathroom',
      },
      {
        id: FIXTURES.maintenance.maintB,
        propertyId: FIXTURES.properties.propB,
        reporterUserId: FIXTURES.users.tenantB,
        category: 'ELECTRICAL',
        priority: 'HIGH',
        status: 'REPORTED',
        title: 'Tenant B Circuit Breaker',
        description: 'Breaker keeps tripping in kitchen',
      },
    ]);

    console.log('\n--- REAL POSTGRESQL AUTH & ROLE ISOLATION MATRIX ---');

    // 1. Unauthenticated request blocked
    const unauthRes = await fetch(`${baseUrl}/tenant/dashboard`);
    assert(unauthRes.status === 401, 'UNAUTHENTICATED_BLOCKED', `401 expected for missing token, got ${unauthRes.status}`);

    // 2. Non-tenant role blocked
    const nonTenantRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.buyer, 'BUYER') }
    });
    assert(nonTenantRes.status === 403, 'NON_TENANT_ROLE_BLOCKED', `403 expected for non-tenant role, got ${nonTenantRes.status}`);

    console.log('\n--- REAL POSTGRESQL LEASE LIFECYCLE ACCESS MATRIX ---');

    // 3. NO LEASE -> 403 NO_ACTIVE_LEASE
    const noLeaseRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.inactive) }
    });
    const noLeaseBody = await noLeaseRes.json().catch(() => ({}));
    assert(noLeaseRes.status === 403 && noLeaseBody.error === 'NO_ACTIVE_LEASE', 'NO_LEASE', `403 NO_ACTIVE_LEASE expected for user with zero leases, got ${noLeaseRes.status} (${noLeaseBody.error})`);

    // 4. TERMINATED LEASE -> 403 NO_ACTIVE_LEASE
    const termRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.terminated) }
    });
    assert(termRes.status === 403, 'TERMINATED_LEASE', `403 expected for terminated lease, got ${termRes.status}`);

    // 5. DRAFT LEASE -> 403
    const draftRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.draft) }
    });
    assert(draftRes.status === 403, 'DRAFT_LEASE', `403 expected for draft lease, got ${draftRes.status}`);

    // 6. PENDING LEASE -> 403
    const pendingRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.pending) }
    });
    assert(pendingRes.status === 403, 'PENDING_LEASE', `403 expected for pending lease, got ${pendingRes.status}`);

    // 7. REJECTED LEASE -> 403
    const rejectedRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.rejected) }
    });
    assert(rejectedRes.status === 403, 'REJECTED_LEASE', `403 expected for rejected lease, got ${rejectedRes.status}`);

    // 8. EXPIRED LEASE -> 403
    const expiredRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.expired) }
    });
    assert(expiredRes.status === 403, 'EXPIRED_LEASE', `403 expected for expired lease, got ${expiredRes.status}`);

    // 9. EXPIRING LEASE -> 200 (permitted active state per schema)
    const expiringRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.expiring) }
    });
    assert(expiringRes.status === 200, 'EXPIRING_LEASE', `200 expected for expiring lease, got ${expiringRes.status}`);

    // 10. ACTIVE LEASE -> 200
    const activeRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.active) }
    });
    assert(activeRes.status === 200, 'ACTIVE_LEASE', `200 expected for active lease, got ${activeRes.status}`);

    console.log('\n--- REAL POSTGRESQL IDOR & DATA BOUNDARY TESTING ---');

    // 11. Cross-tenant payment blocked (Tenant A cannot pay for Tenant B's lease on Prop B)
    const crossTenantPay = await fetch(`${baseUrl}/tenant/payments/pay-rent`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(FIXTURES.users.active),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        propertyId: FIXTURES.properties.propB,
        leaseId: FIXTURES.leases.activeB,
        amount: 500,
      }),
    });
    assert(
      crossTenantPay.status === 403 || crossTenantPay.status === 404,
      'CROSS_TENANT_PAYMENT_BLOCKED',
      `Tenant A blocked from paying Tenant B's lease, got ${crossTenantPay.status}`
    );

    // 12. Cross-tenant dashboard data isolation (Tenant A dashboard must NOT see Tenant B's maintenance)
    const tenantADashRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.active) },
    });
    const tenantADashData = await tenantADashRes.json();
    const seesTenantBMaint = Array.isArray(tenantADashData.maintenanceRequests) &&
      tenantADashData.maintenanceRequests.some((m: any) => m.id === FIXTURES.maintenance.maintB);
    const seesTenantAMaint = Array.isArray(tenantADashData.maintenanceRequests) &&
      tenantADashData.maintenanceRequests.some((m: any) => m.id === FIXTURES.maintenance.maintA);

    assert(!seesTenantBMaint, 'CROSS_TENANT_MAINTENANCE_ISOLATION', 'Tenant A dashboard strictly isolated from Tenant B maintenance requests');
    assert(seesTenantAMaint, 'TENANT_OWN_MAINTENANCE_VISIBLE', 'Tenant A dashboard correctly sees own maintenance request');

    console.log('\n--- REAL POSTGRESQL STATE TRANSITION VERIFICATION ---');

    // 13. State Transition: Verify Tenant A has 200 before mutation
    const preTransitionRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.active) },
    });
    assert(preTransitionRes.status === 200, 'STATE_TRANSITION_PRE_CONDITION', `Pre-transition access confirmed (200), got ${preTransitionRes.status}`);

    // Mutate Tenant A's only active lease to TERMINATED in PostgreSQL
    await db.update(leases).set({ status: 'TERMINATED' }).where(eq(leases.id, FIXTURES.leases.active));

    // 14. Post-Transition Check: Tenant A must immediately be denied with 403 NO_ACTIVE_LEASE
    // Because this test is isolated with dedicated fixtures, NO SECOND ACTIVE LEASE exists to mask revocation.
    const postTransitionRes = await fetch(`${baseUrl}/tenant/dashboard`, {
      headers: { 'Authorization': getAuthHeader(FIXTURES.users.active) },
    });
    const postTransitionBody = await postTransitionRes.json().catch(() => ({}));
    assert(
      postTransitionRes.status === 403 && postTransitionBody.error === 'NO_ACTIVE_LEASE',
      'STATE_TRANSITION_POST_CONDITION',
      `403 NO_ACTIVE_LEASE immediately enforced after transitioning ACTIVE->TERMINATED, got ${postTransitionRes.status} (${postTransitionBody.error})`
    );

    console.log('\n================================================================');
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    if (failed > 0) process.exit(1);

  } catch (error) {
    console.error('Fatal error during test execution:', error);
    process.exit(1);
  } finally {
    await cleanupData();
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runRealPostgresTenantVerification();
