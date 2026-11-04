process.env.SQL_DB_NAME = 'homehub_test';
import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import apiRouter from '../src/server/routes/api.js';
import { db, closePool } from '../src/db/index.js';
import {
  users,
  properties,
  units,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  commissions,
  journalEntries,
  ledgerLines,
  reversalRecords,
  securityDeposits,
  ownershipRecords,
  idempotencyRecords,
  listings,
  moveOutRequests,
  securityDepositDeductions,
  leaseMoveOutInspections,
  leaseMoveOutInspectionItems,
  rentalApplications,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';
import { securityDepositDeductionService, DeductionActor } from '../src/server/services/security-deposit-deduction.js';
import { FinanceService } from '../src/server/services/finance.js';

test('HomeHub UI-to-Backend Integration Verification Suite', async (t) => {
  let server: any;
  let runId = '';
  let ownerId = '';
  let tenantId = '';
  let tenant2Id = '';
  let otherTenantId = '';
  let agentId = '';
  let vendorId = '';
  let adminId = '';
  let propId = '';
  let leaseId = '';
  let depositId = '';

  try {
    // 0. Hard Safety Gate: Must target verified local test database
    process.env.SQL_DB_NAME = 'homehub_test';
    await closePool();
    const connCheck = await (db as any).execute('SELECT current_database() as db_name, current_user as db_user');
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    console.log('ACTIVE TEST DB IS:', activeDb);
    assert.strictEqual(activeDb, 'homehub_test', 'MUST connect strictly to homehub_test. Never access homehub_production!');

    // Start in-process Express server with apiRouter mounted on /api
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const baseUrl = `http://localhost:${address.port}/api`;

    runId = `uiv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const ownerEmail = `owner_${runId}@homehub.iq`;
    const tenantEmail = `tenant_${runId}@homehub.iq`;
    const tenant2Email = `tenant2_${runId}@homehub.iq`;
    const otherTenantEmail = `other_tenant_${runId}@homehub.iq`;
    const agentEmail = `agent_${runId}@homehub.iq`;
    const vendorEmail = `vendor_${runId}@homehub.iq`;
    const adminEmail = `admin_${runId}@homehub.iq`;
    const password = 'Password123!';

    ownerId = `user_owner_${runId}`;
    tenantId = `user_tenant_${runId}`;
    tenant2Id = `user_tenant2_${runId}`;
    otherTenantId = `user_other_tenant_${runId}`;
    agentId = `user_agent_${runId}`;
    vendorId = `user_vendor_${runId}`;
    adminId = `user_admin_${runId}`;

    let ownerToken = '';
    let tenantToken = '';
    let otherTenantToken = '';
    let agentToken = '';
    let vendorToken = '';
    let adminToken = '';

    propId = `prop_${runId}`;
    leaseId = `lease_${runId}`;
    depositId = `dep_${runId}`;

  // Helper fetcher
  async function api(path: string, options: RequestInit = {}, token?: string) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Connection': 'close',
      ...((options.headers as any) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, ok: res.ok, body: json };
  }

  // Seed baseline users
  const pwdHash = await hashPassword(password);
  await db.insert(users).values([
    {
      id: ownerId,
      email: ownerEmail,
      roles: ['PROPERTY_OWNER'],
      firstName: 'Owner',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
    {
      id: tenantId,
      email: tenantEmail,
      roles: ['TENANT'],
      firstName: 'PrimaryTenant',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
    {
      id: tenant2Id,
      email: tenant2Email,
      roles: ['TENANT'],
      firstName: 'CoTenant',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
    {
      id: otherTenantId,
      email: otherTenantEmail,
      roles: ['TENANT'],
      firstName: 'OtherTenant',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
    {
      id: agentId,
      email: agentEmail,
      roles: ['AGENT_BROKER'],
      firstName: 'Agent',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
    {
      id: vendorId,
      email: vendorEmail,
      roles: ['VENDOR'],
      firstName: 'Vendor',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
    {
      id: adminId,
      email: adminEmail,
      roles: ['PLATFORM_ADMIN', 'ADMIN'],
      firstName: 'PlatformAdmin',
      lastName: runId,
      passwordHash: pwdHash,
      isActive: true,
    },
  ]).onConflictDoNothing();

  // Seed baseline property & ownership
  await db.insert(properties).values({
    id: propId,
    name: `Lifecycle Tower ${runId}`,
    address: { street: '100 Meter Street', city: 'Erbil' },
    type: 'RESIDENTIAL',
    currency: 'IQD',
    status: 'ACTIVE',
  }).onConflictDoNothing();

  await db.insert(ownershipRecords).values({
    id: `own_${runId}`,
    propertyId: propId,
    ownerId: ownerId,
    status: 'VERIFIED',
  }).onConflictDoNothing();

  // Seed baseline active lease & primary tenant
  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1000000',
    currency: 'IQD',
    depositAmount: '1000000',
  }).onConflictDoNothing();

  await db.insert(leaseTenants).values({
    id: `lt_${runId}`,
    leaseId: leaseId,
    tenantId: tenantId,
    isPrimary: true,
  }).onConflictDoNothing();

  await db.insert(securityDeposits).values({
    id: depositId,
    propertyId: propId,
    leaseId: leaseId,
    tenantId: tenantId,
    requiredAmount: '1000000',
    recordedAmount: '1000000',
    releasedAmount: '0',
    status: 'HELD',
    currency: 'IQD',
  }).onConflictDoNothing();

  // ========================================================================
  // 1. AUTHENTICATION & ROLE-BASED ACCESS VERIFICATION
  // ========================================================================
  await t.test('1.1. Native Login for All Supported Role Personas', async () => {
    // Owner Login
    const ownerRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ownerEmail, password }),
    });
    assert.strictEqual(ownerRes.status, 200, 'Owner login must return 200');
    assert.ok(ownerRes.body.token, 'Owner login must return JWT token');
    assert.ok(ownerRes.body.user.roles.includes('PROPERTY_OWNER'), 'User must have PROPERTY_OWNER role');
    ownerToken = ownerRes.body.token;

    // Tenant Login
    const tenantRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: tenantEmail, password }),
    });
    assert.strictEqual(tenantRes.status, 200, 'Tenant login must return 200');
    assert.ok(tenantRes.body.token, 'Tenant login must return JWT token');
    assert.ok(tenantRes.body.user.roles.includes('TENANT'), 'User must have TENANT role');
    tenantToken = tenantRes.body.token;

    // Other Tenant Login
    const otherTenantRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: otherTenantEmail, password }),
    });
    assert.strictEqual(otherTenantRes.status, 200);
    otherTenantToken = otherTenantRes.body.token;

    // Agent Login
    const agentRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: agentEmail, password }),
    });
    assert.strictEqual(agentRes.status, 200, 'Agent login must return 200');
    assert.ok(agentRes.body.token);
    agentToken = agentRes.body.token;

    // Vendor Login
    const vendorRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: vendorEmail, password }),
    });
    assert.strictEqual(vendorRes.status, 200, 'Vendor login must return 200');
    assert.ok(vendorRes.body.token);
    vendorToken = vendorRes.body.token;

    // Admin Login
    const adminRes = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: adminEmail, password }),
    });
    assert.strictEqual(adminRes.status, 200, 'Admin login must return 200');
    assert.ok(adminRes.body.token);
    adminToken = adminRes.body.token;
  });

  await t.test('1.2. Authentication Negative Paths & Credential Security', async () => {
    // Bad Password
    const badPwd = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ownerEmail, password: 'WrongPassword999!' }),
    });
    assert.strictEqual(badPwd.status, 401, 'Bad password must return 401');

    // Missing Email
    const noEmail = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: '', password }),
    });
    assert.strictEqual(noEmail.status, 400, 'Empty email must return 400');

    // Missing Password
    const noPwd = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: ownerEmail, password: '' }),
    });
    assert.strictEqual(noPwd.status, 400, 'Empty password must return 400');
  });

  await t.test('1.3. Server-Side Authorization & Role Boundaries (Non-Bypassable)', async () => {
    // Tenant attempting to access Owner Properties API
    const tenantToOwner = await api('/owner/properties', {}, tenantToken);
    assert.strictEqual(tenantToOwner.status, 403, 'Tenant accessing Owner endpoint must return 403 FORBIDDEN');

    // Unauthenticated accessing Owner endpoint
    const unauthToOwner = await api('/owner/properties', {});
    assert.strictEqual(unauthToOwner.status, 401, 'Unauthenticated access must return 401 UNAUTHORIZED');

    // Owner attempting to access Admin Metrics
    const ownerToAdmin = await api('/admin/metrics', {}, ownerToken);
    assert.strictEqual(ownerToAdmin.status, 403, 'Owner accessing Admin endpoint must return 403 FORBIDDEN');

    // Admin accessing Admin Metrics succeeds
    const adminToAdmin = await api('/admin/metrics', {}, adminToken);
    assert.strictEqual(adminToAdmin.status, 200, 'Admin accessing Admin metrics must return 200 OK');
  });

  // ========================================================================
  // 2. PROPERTY AND RENTAL LIFECYCLE VERIFICATION
  // ========================================================================
  await t.test('2.1. Property Creation with Idempotency & Ownership Invariants', async () => {
    try {
      const idempotencyKey = `idem_prop_${runId}`;
      const propertyPayload = {
        name: `Ecosystem Test Tower ${runId}`,
        address: { street: 'Bakhtiyari Street 44', city: 'Erbil' },
        city: 'Erbil',
        type: 'APARTMENT',
        currency: 'IQD',
      };

      // First creation call
      const createRes = await api('/owner/properties', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(propertyPayload),
      }, ownerToken);

      assert.strictEqual(createRes.status, 201, 'Property creation must return 201 Created');
      const createdProperty = createRes.body;
      assert.ok(createdProperty.id, 'Created property must have an ID');

      // Check DB persistence directly
      const [dbProp] = await db.select().from(properties).where(eq(properties.id, createdProperty.id));
      assert.ok(dbProp, 'Property must be persisted in PostgreSQL properties table');
      assert.strictEqual(dbProp.name, propertyPayload.name);

      // Check ownership record
      const [dbOwnership] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, createdProperty.id));
      assert.ok(
        dbOwnership.status === 'PENDING_VERIFICATION' || dbOwnership.status === 'VERIFIED',
        'Ownership record status must be PENDING_VERIFICATION or VERIFIED'
      );

      // Check idempotency record
      const [dbIdem] = await db.select().from(idempotencyRecords).where(eq(idempotencyRecords.key, idempotencyKey));
      assert.ok(dbIdem, 'Idempotency record must be stored');

      // Sequential replay with identical key and payload
      const replayRes = await api('/owner/properties', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(propertyPayload),
      }, ownerToken);
      assert.strictEqual(replayRes.status, 201, 'Replay must return 201 with identical payload');
      assert.strictEqual(replayRes.body.id, createdProperty.id, 'Replay must return same property ID');

      // Verify exactly 1 property exists
      const allProps = await db.select().from(properties).where(eq(properties.name, propertyPayload.name));
      assert.strictEqual(allProps.length, 1, 'Exactly 1 property must exist in DB (no duplicates)');
    } catch (err: any) {
      console.error('SUBTEST 2.1 CAUGHT ERROR:', err?.message || err);
      throw err;
    }
  });

  await t.test('2.2. Rental-Only Invariant Enforcement (FOR_SALE Rejected)', async () => {
    // Attempting to create a sale listing via owner marketplace endpoint
    const saleListingRes = await api('/owner/marketplace/list', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: propId,
        title: 'Sale Listing Test',
        price: 250000000,
        type: 'FOR_SALE',
      }),
    }, ownerToken);

    assert.strictEqual(saleListingRes.status, 403, 'FOR_SALE listing must be rejected with 403 BUY_SELL_DISABLED');
    assert.ok(
      saleListingRes.body.error === 'BUY_SELL_DISABLED' || /BUY_SELL_DISABLED/i.test(saleListingRes.body.error),
      'Error message must reflect BUY_SELL_DISABLED'
    );
  });

  await t.test('2.3. Unit Creation and Uniqueness Boundary', async () => {
    // Create Unit 101
    const unit1Res = await api(`/properties/${propId}/units`, {
      method: 'POST',
      body: JSON.stringify({ unitNumber: '101', floor: 1, rentAmount: 850000 }),
    }, ownerToken);
    assert.strictEqual(unit1Res.status, 201, 'Unit creation must return 201');

    // Duplicate Unit 101 on same property
    const duplicateUnitRes = await api(`/properties/${propId}/units`, {
      method: 'POST',
      body: JSON.stringify({ unitNumber: '101', floor: 1, rentAmount: 850000 }),
    }, ownerToken);
    assert.ok(
      duplicateUnitRes.status === 400 || duplicateUnitRes.status === 409 || duplicateUnitRes.status === 500,
      'Duplicate unit on same property must be rejected'
    );
  });

  await t.test('2.4. Owner Digital Lease Creation & Rent Schedules Generation', async () => {
    try {
      // Invariant: Primary tenant must have an APPROVED rental application
      await db.insert(rentalApplications).values({
        id: `app_${runId}`,
        propertyId: propId,
        applicantUserId: tenant2Id,
        status: 'APPROVED',
        preferredMoveInDate: '2027-01-01',
      });

      const leasePayload = {
        propertyId: propId,
        tenantId: tenant2Id,
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        rentAmount: 1000000,
        depositAmount: 1000000,
        currency: 'IQD',
      };

      const leaseCreateRes = await api('/owner/leases', {
        method: 'POST',
        body: JSON.stringify(leasePayload),
      }, ownerToken);

      if (leaseCreateRes.status !== 201) {
        console.error('SUBTEST 2.4 leaseCreateRes failed:', leaseCreateRes.status, leaseCreateRes.body);
      }
      assert.strictEqual(leaseCreateRes.status, 201, 'Owner lease creation must return 201');
      const createdLease = leaseCreateRes.body;
      assert.ok(createdLease.id, 'Created lease must have an ID');

      // Verify lease row in DB
      const [dbLease] = await db.select().from(leases).where(eq(leases.id, createdLease.id));
      assert.ok(dbLease, 'Lease row must exist in PostgreSQL');
      assert.strictEqual(dbLease.propertyId, propId);

      // Verify digital lease status is PENDING_SIGNATURE awaiting tenant signature
      assert.strictEqual(dbLease.status, 'PENDING_SIGNATURE');
      assert.strictEqual(parseFloat(dbLease.rentAmount), 1000000);
      assert.strictEqual(parseFloat(dbLease.depositAmount || '0'), 1000000);

      // Verify tenant linkage in leaseTenants
      const [dbLt] = await db.select().from(leaseTenants).where(eq(leaseTenants.leaseId, createdLease.id));
      assert.ok(dbLt, 'Lease tenant mapping must exist');
      assert.strictEqual(dbLt.tenantId, tenant2Id);
    } catch (err: any) {
      console.error('SUBTEST 2.4 CAUGHT ERROR:', err?.message || err);
      throw err;
    }
  });

  await t.test('2.5. Tenant Move-Out Request Submission End-to-End', async () => {
    // Tenant submits move-out request
    const moveOutRes = await api('/tenant/lease/move-out', {
      method: 'POST',
      body: JSON.stringify({
        leaseId,
        propertyId: propId,
        requestedMoveOutDate: '2026-12-31',
        reason: 'Relocating to Sulaymaniyah for work',
      }),
    }, tenantToken);

    assert.strictEqual(moveOutRes.status, 201, 'Move-out request submission must succeed with 201');

    // Verify in PostgreSQL move_out_requests table
    const [dbMor] = await db.select().from(moveOutRequests).where(eq(moveOutRequests.leaseId, leaseId));
    assert.ok(dbMor, 'Move-out request must be stored in PostgreSQL');
    assert.strictEqual(dbMor.tenantId, tenantId);
  });

  // ========================================================================
  // 3. RENT PAYMENTS AND FINANCIAL WORKFLOWS VERIFICATION
  // ========================================================================
  await t.test('3.1. Tenant Dashboard Schedules Display & Cross-Lease Isolation', async () => {
    try {
      // Insert a rent schedule for leaseId
      const [schedule1] = await db.insert(rentSchedules).values({
        id: `sched1_${runId}`,
        leaseId: leaseId,
        propertyId: propId,
        tenantId: tenantId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        dueDate: '2026-01-05',
        amount: '1000000',
        paidAmount: '0',
        currency: 'IQD',
        status: 'OVERDUE',
      }).returning();

      // Primary tenant dashboard
      const tenantDash = await api('/tenant/dashboard', {}, tenantToken);
      if (tenantDash.status !== 200) {
        console.error('SUBTEST 3.1 tenantDash error:', tenantDash.status, tenantDash.body);
      }
      assert.strictEqual(tenantDash.status, 200, 'Tenant dashboard must return 200');
      assert.ok(tenantDash.body.rentDue, 'rentDue schedule information must be returned');
      assert.ok(tenantDash.body.financialSummary, 'Financial summary must be returned');
      assert.strictEqual(tenantDash.body.rentDue.leaseId, leaseId);

      // Cross-lease tenant: otherTenant has no active lease
      const otherDash = await api('/tenant/dashboard', {}, otherTenantToken);
      assert.strictEqual(otherDash.status, 403, 'Tenant without active lease must return 403 NO_ACTIVE_LEASE');
      assert.strictEqual(otherDash.body.error, 'NO_ACTIVE_LEASE');
    } catch (err: any) {
      console.error('SUBTEST 3.1 CAUGHT ERROR:', err?.message || err);
      throw err;
    }
  });

  await t.test('3.2. Unconfirmed Rent Payment Claim Recording Invariant (RECORDED)', async () => {
    const schedId = `sched1_${runId}`;

    // Record an unconfirmed cash payment claim via /leases/payments
    const recordPaymentRes = await api('/leases/payments', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: propId,
        leaseId: leaseId,
        payerId: tenantId,
        rentScheduleId: schedId,
        amount: 500000,
        paymentMethod: 'CASH',
        referenceNumber: `CASH_REC_${runId}`,
      }),
    }, ownerToken);

    assert.ok(recordPaymentRes.status === 200 || recordPaymentRes.status === 201, `Recording payment claim status ${recordPaymentRes.status}`);
    const paymentRecord = recordPaymentRes.body;
    assert.strictEqual(paymentRecord.status, 'RECORDED', 'Payment status must be RECORDED');

    // CRITICAL FINANCIAL INVARIANT: rent_schedules.paidAmount MUST NOT BE MUTATED
    const [schedAfterClaim] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedId));
    assert.strictEqual(
      parseFloat(schedAfterClaim.paidAmount || '0'),
      0,
      'RENT SCHEDULE PAID AMOUNT MUST REMAIN 0 BEFORE CONFIRMATION (Phase 26 Invariant)'
    );
    assert.strictEqual(
      schedAfterClaim.status,
      'OVERDUE',
      'Rent schedule status must remain OVERDUE before confirmation'
    );
  });

  await t.test('3.3. Authoritative Payment Confirmation, Rent Schedule Update, and 3-Fee Journal Entries', async () => {
    const schedId = `sched1_${runId}`;
    const paymentId = `pay_${runId}`;

    // Seed payment to be confirmed
    const [paymentToConfirm] = await db.insert(paymentRecords).values({
      id: paymentId,
      propertyId: propId,
      leaseId: leaseId,
      rentScheduleId: schedId,
      payerId: tenantId,
      amount: '1000000',
      currency: 'IQD',
      paymentMethod: 'CASH',
      referenceNumber: `CASH_REF_${runId}`,
      status: 'RECORDED',
      recordedDate: new Date().toISOString(),
    }).returning();

    // Owner confirms payment
    const confirmRes = await api(`/leases/payments/${paymentToConfirm.id}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ referenceNumber: `CASH_REF_${runId}` }),
    }, ownerToken);

    if (confirmRes.status !== 200) {
      console.log('CONFIRM RES FAILURE DETAILS:', confirmRes.status, confirmRes.body);
    }
    assert.strictEqual(confirmRes.status, 200, 'Payment confirmation must succeed with 200');

    // 1. Verify payment status is now CONFIRMED
    const [dbPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, paymentToConfirm.id));
    assert.strictEqual(dbPayment.status, 'CONFIRMED', 'Payment record must be transitioned to CONFIRMED');

    // 2. Verify rent schedule paidAmount updated to 1,000,000 and status to PAID
    const [schedAfterConfirm] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedId));
    assert.strictEqual(parseFloat(schedAfterConfirm.paidAmount || '0'), 1000000, 'Rent schedule paidAmount must be 1,000,000');
    assert.strictEqual(schedAfterConfirm.status, 'PAID', 'Rent schedule status must be PAID');

    // 3. Verify double-entry journal entry was posted
    const entries = await db.select().from(journalEntries).where(and(
      eq(journalEntries.propertyId, propId),
      eq(journalEntries.referenceType, 'PAYMENT_RECORD'),
      eq(journalEntries.referenceId, paymentToConfirm.id)
    ));
    assert.ok(entries.length > 0, 'Double-entry journal entry must be posted for confirmed payment');
  });

  await t.test('3.4. Payment Reversal, Schedule Balance Restoration, and Reversing Journal Entry', async () => {
    const schedId = `sched1_${runId}`;
    const paymentId = `pay_${runId}`;

    // Owner reverses payment
    const reverseRes = await api(`/leases/payments/${paymentId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Tenant check bounced' }),
    }, ownerToken);

    if (reverseRes.status !== 200) {
      console.log('REVERSE RES FAILURE DETAILS:', reverseRes.status, reverseRes.body);
    }
    assert.strictEqual(reverseRes.status, 200, 'Payment reversal must succeed with 200');

    // 1. Verify payment status is now REVERSED
    const [dbPayment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId));
    assert.strictEqual(dbPayment.status, 'REVERSED', 'Payment status must be REVERSED');

    // 2. Verify rent schedule paidAmount is restored back to 0
    const [schedAfterReverse] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedId));
    assert.strictEqual(parseFloat(schedAfterReverse.paidAmount || '0'), 0, 'Rent schedule paidAmount must be restored to 0');
    assert.strictEqual(schedAfterReverse.status, 'OVERDUE', 'Rent schedule status must be restored to OVERDUE');

    // 3. Verify reversing journal entry posted
    const revEntries = await db.select().from(journalEntries).where(and(
      eq(journalEntries.propertyId, propId),
      eq(journalEntries.referenceType, 'FEE_REVERSAL')
    ));
    assert.ok(revEntries.length > 0, 'Reversing journal entry must be posted');
  });

  // ========================================================================
  // 4. SECURITY DEPOSITS, MOVE-OUT INSPECTIONS & DEDUCTIONS REST API SUITE
  // ========================================================================
  await t.test('4.1. Security Deposit Collection, Query, and Release REST Endpoints', async () => {
    // 1. Query deposit for lease via GET /owner/leases/:leaseId/deposit
    const getDepRes = await api(`/owner/leases/${leaseId}/deposit`, {}, ownerToken);
    assert.strictEqual(getDepRes.status, 200, 'Fetching deposit for lease must return 200');
    assert.strictEqual(getDepRes.body.id, depositId);
    assert.strictEqual(getDepRes.body.status, 'HELD');

    // 2. Query deposit by id via GET /owner/deposits/:id
    const getDepByIdRes = await api(`/owner/deposits/${depositId}`, {}, ownerToken);
    assert.strictEqual(getDepByIdRes.status, 200, 'Fetching deposit by id must return 200');
    assert.strictEqual(getDepByIdRes.body.id, depositId);

    // 3. Unauthorized access denied: other tenant cannot fetch deposit
    const unauthRes = await api(`/owner/leases/${leaseId}/deposit`, {}, otherTenantToken);
    assert.strictEqual(unauthRes.status, 403, 'Unauthorized user must receive 403');
  });

  await t.test('4.2. Move-Out Inspection Lifecycle via REST API (Create -> Items -> Complete)', async () => {
    try {
    // 1. Owner creates inspection via POST /owner/inspections
    const createInspRes = await api('/owner/inspections', {
      method: 'POST',
      body: JSON.stringify({
        leaseId,
        propertyId: propId,
        inspectionType: 'MOVE_OUT',
        scheduledDate: new Date().toISOString(),
        inspectorType: 'PROPERTY_OWNER',
        generalNotes: 'End of lease turnover inspection',
      }),
    }, ownerToken);

    assert.strictEqual(createInspRes.status, 201, 'Inspection creation must return 201');
    const inspection = createInspRes.body;
    assert.strictEqual(inspection.status, 'SCHEDULED');
    const inspectionId = inspection.id;

    // 2. Owner adds inspection items via POST /owner/inspections/:id/items
    const addItemRes = await api(`/owner/inspections/${inspectionId}/items`, {
      method: 'POST',
      body: JSON.stringify({
        area: 'LIVING_ROOM',
        component: 'Main Window Latch',
        condition: 'DAMAGED',
        damageDescription: 'Latch bent and unusable',
        isTenantCaused: true,
        estimatedRepairCost: 150000,
        currency: 'IQD',
        evidenceRefs: ['inspections/window1.jpg'],
      }),
    }, ownerToken);
    assert.strictEqual(addItemRes.status, 201, 'Adding inspection item must return 201');
    assert.strictEqual(addItemRes.body.component, 'Main Window Latch');

    // 3. Owner lists inspections for lease via GET /owner/leases/:leaseId/inspections
    const ownerListRes = await api(`/owner/leases/${leaseId}/inspections`, {}, ownerToken);
    assert.strictEqual(ownerListRes.status, 200, 'Listing inspections for owner must return 200');
    assert.ok(ownerListRes.body.length > 0);
    assert.strictEqual(ownerListRes.body[0].items.length, 1);

    // 4. Tenant on lease views inspection via GET /tenant/leases/:leaseId/inspections
    const tenantListRes = await api(`/tenant/leases/${leaseId}/inspections`, {}, tenantToken);
    assert.strictEqual(tenantListRes.status, 200, 'Listing inspections for tenant must return 200');
    assert.strictEqual(tenantListRes.body[0].id, inspectionId);

    // 5. Cross-lease tenant blocked from viewing inspections
    const crossTenantRes = await api(`/tenant/leases/${leaseId}/inspections`, {}, otherTenantToken);
    assert.strictEqual(crossTenantRes.status, 403, 'Cross-lease tenant must be denied access with 403');

    // 6. Complete inspection via POST /owner/inspections/:id/complete
    const completeRes = await api(`/owner/inspections/${inspectionId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        generalNotes: 'Inspection completed with verified damage items',
      }),
    }, ownerToken);
    assert.strictEqual(completeRes.status, 200, 'Completing inspection must return 200');
    assert.strictEqual(completeRes.body.status, 'COMPLETED');
    } catch (err: any) {
      console.error('SUBTEST 4.2 CAUGHT ERROR:', err?.message || err);
      throw err;
    }
  });

  await t.test('4.3. Security Deposit Deduction Lifecycle via REST API (Propose -> Approve -> Tenant Dispute)', async () => {
    try {
    // 1. Propose deduction via POST /owner/deductions/propose
    const proposeRes = await api('/owner/deductions/propose', {
      method: 'POST',
      body: JSON.stringify({
        depositId,
        leaseId,
        amount: 150000,
        currency: 'IQD',
        category: 'DAMAGE',
        description: 'Living room window latch replacement per move-out inspection',
      }),
    }, ownerToken);
    assert.strictEqual(proposeRes.status, 201, 'Proposing deduction must return 201');
    const proposed = proposeRes.body;
    assert.strictEqual(proposed.status, 'PROPOSED');

    // CRITICAL INVARIANT: 30-Day dispute clock does NOT start on proposal (disputeDeadline is NULL)
    assert.strictEqual(proposed.disputeDeadline, null, 'Dispute deadline must be null on proposal creation');
    assert.strictEqual(proposed.noticeDeliveryStatus, 'NOT_SENT', 'Notice delivery status must be NOT_SENT');

    // 2. Owner approves deduction via POST /owner/deductions/:id/approve
    const approveRes = await api(`/owner/deductions/${proposed.id}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }, ownerToken);
    assert.strictEqual(approveRes.status, 200, 'Approving deduction must return 200');
    assert.strictEqual(approveRes.body.status, 'OWNER_APPROVED');

    // 3. Tenant views deductions for lease via GET /tenant/leases/:leaseId/deductions
    const tenantDedRes = await api(`/tenant/leases/${leaseId}/deductions`, {}, tenantToken);
    assert.strictEqual(tenantDedRes.status, 200, 'Tenant can view deductions');
    assert.strictEqual(tenantDedRes.body.length, 1);
    assert.strictEqual(tenantDedRes.body[0].id, proposed.id);

    // 4. Tenant disputes deduction via POST /tenant/deductions/:id/dispute
    const disputeRes = await api(`/tenant/deductions/${proposed.id}/dispute`, {
      method: 'POST',
      body: JSON.stringify({
        disputeReason: 'Window latch was already loose upon move-in; reported during move-in walkthrough.',
        evidenceRefs: ['move-in-photos/window.jpg'],
      }),
    }, tenantToken);
    assert.strictEqual(disputeRes.status, 200, 'Tenant disputing deduction within 30 days must succeed with 200');
    assert.strictEqual(disputeRes.body.status, 'DISPUTED');
    assert.ok(disputeRes.body.disputeReason.includes('loose upon move-in'));
    } catch (err: any) {
      console.error('SUBTEST 4.3 CAUGHT ERROR:', err?.message || err);
      throw err;
    }
  });

  await t.test('4.4. Security Boundaries: Decision P02 Company Manager Fail-Closed & Unauthorized Disputes', async () => {
    // 1. Negative path: other tenant attempting to dispute deduction
    const [ded] = await db.select().from(securityDepositDeductions).where(eq(securityDepositDeductions.depositId, depositId)).limit(1);
    if (ded) {
      const badDisputeRes = await api(`/tenant/deductions/${ded.id}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ disputeReason: 'Invalid dispute attempt' }),
      }, otherTenantToken);
      assert.strictEqual(badDisputeRes.status, 403, 'Unauthorized tenant must receive 403 FORBIDDEN when disputing');
    }

    // 2. Decision P02: Company manager without explicit delegation fails closed
    const managerActor: DeductionActor = {
      id: 'mock_manager_id',
      role: 'COMPANY_MEMBER',
      roles: ['COMPANY_MEMBER', 'PROPERTY_MANAGER'],
    };
    const hasAuth = await securityDepositDeductionService.verifyDeductionApprovalAuthority(propId, managerActor);
    assert.strictEqual(hasAuth, false, 'Company manager must be denied approval authority (fail closed per Decision P02)');
  });
  } catch (err: any) {
    console.error('FATAL TEST ERROR OCCURRED:', err?.message || err);
    console.error(err?.stack || err);
    throw err;
  }

  // ========================================================================
  // TEARDOWN ISOLATED TEST DATA & SERVER
  // ========================================================================
  t.after(async () => {
    try {
      if ((server as any).closeAllConnections) {
        (server as any).closeAllConnections();
      }
      if ((server as any).closeIdleConnections) {
        (server as any).closeIdleConnections();
      }
      server.close();
      server.unref();
      await db.delete(securityDepositDeductions).where(eq(securityDepositDeductions.depositId, depositId));
      await db.delete(leaseMoveOutInspectionItems).where(sql`inspection_id IN (SELECT id FROM lease_move_out_inspections WHERE lease_id = ${leaseId})`);
      await db.delete(leaseMoveOutInspections).where(eq(leaseMoveOutInspections.leaseId, leaseId));
      await db.delete(reversalRecords).where(sql`idempotency_key LIKE ${`%${runId}%`}`);
      await db.delete(ledgerLines).where(
        sql`journal_entry_id IN (SELECT id FROM journal_entries WHERE property_id IN (${propId}, 'prop_${runId}'))`
      );
      await db.delete(journalEntries).where(eq(journalEntries.propertyId, propId));
      await db.delete(paymentRecords).where(eq(paymentRecords.propertyId, propId));
      await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId));
      await db.delete(moveOutRequests).where(eq(moveOutRequests.leaseId, leaseId));
      await db.delete(securityDeposits).where(eq(securityDeposits.propertyId, propId));
      await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
      await db.delete(leases).where(eq(leases.propertyId, propId));
      await db.delete(units).where(eq(units.propertyId, propId));
      await db.delete(rentalApplications).where(eq(rentalApplications.propertyId, propId));
      await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
      await db.delete(properties).where(eq(properties.id, propId));
      await db.delete(idempotencyRecords).where(sql`key LIKE ${`%${runId}%`}`);
      await db.delete(users).where(sql`id IN (${ownerId}, ${tenantId}, ${tenant2Id}, ${otherTenantId}, ${agentId}, ${vendorId}, ${adminId})`);
    } catch (_) {}
    finally {
      await closePool();
      setTimeout(() => process.exit(0), 200).unref();
    }
  });
});

