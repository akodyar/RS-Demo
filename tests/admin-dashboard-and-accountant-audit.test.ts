import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  ownershipRecords,
  commissions,
  journalEntries,
  ledgerLines,
  financialPolicies,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import adminRouter from '../src/server/routes/admin.js';
import financialsRouter from '../src/server/routes/financials.js';
import { financeService } from '../src/server/services/finance.js';

process.env.SQL_HOST = 'localhost';

const app = express();
app.use(express.json());

// Auth simulation middleware for testing
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    if (token === 'super_admin_token') {
      (req as any).user = { id: 'usr_super_admin_test', roles: ['SUPER_ADMIN', 'ADMIN'] };
    } else if (token === 'finance_admin_token') {
      (req as any).user = { id: 'usr_finance_admin_test', roles: ['FINANCE_ADMIN', 'ADMIN'] };
    } else if (token === 'accountant_token') {
      (req as any).user = { id: 'usr_accountant_test', roles: ['ACCOUNTANT'] };
    } else if (token === 'read_only_admin_token') {
      (req as any).user = { id: 'usr_ro_admin_test', roles: ['READ_ONLY_ADMIN'] };
    } else if (token === 'auditor_token') {
      (req as any).user = { id: 'usr_auditor_test', roles: ['AUDITOR'] };
    } else if (token === 'owner_token') {
      (req as any).user = { id: 'usr_owner_test', roles: ['PROPERTY_OWNER'] };
    } else if (token === 'tenant_token') {
      (req as any).user = { id: 'usr_tenant_test', roles: ['TENANT'] };
    } else if (token === 'agent_token') {
      (req as any).user = { id: 'usr_agent_test', roles: ['AGENT_BROKER'] };
    }
  }
  next();
});

app.use('/api/admin', adminRouter);
app.use('/api/financials', financialsRouter);

test('Admin Properties Dashboard & Accountant Fee Audit Comprehensive Suite', async (t) => {
  const runId = Math.random().toString(36).substring(2, 7);
  const ownerId = `usr_test_owner_${runId}`;
  const tenantId = `usr_test_tenant_${runId}`;

  // Test properties
  const propFullyManagedId = `prop_fm_${runId}`;
  const propAgentListedId = `prop_alpm_${runId}`;
  const propAgentOperatedId = `prop_ao_${runId}`;

  // Test lease & payments
  const leaseId = `lease_aud_${runId}`;
  const schedConfirmedId = `sched_conf_${runId}`;
  const schedPendingId = `sched_pend_${runId}`;
  const schedReversedId = `sched_rev_${runId}`;
  const schedHistId = `sched_hist_${runId}`;

  const payConfirmedId = `pay_conf_${runId}`;
  const payPendingId = `pay_pend_${runId}`;
  const payReversedId = `pay_rev_${runId}`;
  const payHistId = `pay_hist_${runId}`;

  const jeHistId = `je_hist_${runId}`;
  const commHistId = `comm_hist_${runId}`;

  // Setup fixtures
  await t.test('0. Setup test fixtures across all three operating models', async () => {
    // Seed test users
    await db.insert(users).values([
      { id: ownerId, firstName: 'Audit', lastName: 'Owner', email: `${ownerId}@test.com`, phone: `+96477020${runId.slice(0, 4)}`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, firstName: 'Audit', lastName: 'Tenant', email: `${tenantId}@test.com`, phone: `+96477021${runId.slice(0, 4)}`, roles: ['TENANT'] },
    ]);

    // Seed properties for all three operating models
    await db.insert(properties).values([
      {
        id: propFullyManagedId,
        name: `Fully Managed Tower ${runId}`,
        type: 'APARTMENT',
        address: { city: 'Erbil', street: 'Gulan St' },
        operatingModel: 'FULLY_MANAGED',
        rentFee: '0.0400',
        managementFee: '0.0600',
        status: 'AVAILABLE',
        currency: 'IQD',
      },
      {
        id: propAgentListedId,
        name: `Agent Listed Platform Managed Complex ${runId}`,
        type: 'APARTMENT',
        address: { city: 'Sulaymaniyah', street: 'Salim St' },
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        rentFee: null, // Rent fee cannot apply to ALPM
        managementFee: '0.0700',
        status: 'AVAILABLE',
        currency: 'IQD',
      },
      {
        id: propAgentOperatedId,
        name: `Agent Operated Villa ${runId}`,
        type: 'VILLA',
        address: { city: 'Duhok', street: 'KRO St' },
        operatingModel: 'AGENT_OPERATED',
        rentFee: null, // Neither fee applies to AGENT_OPERATED
        managementFee: null,
        status: 'AVAILABLE',
        currency: 'IQD',
      },
    ]);

    // Seed ownership records
    await db.insert(ownershipRecords).values([
      { propertyId: propFullyManagedId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { propertyId: propAgentListedId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { propertyId: propAgentOperatedId, ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // Seed lease for fully managed property
    await db.insert(leases).values({
      id: leaseId,
      propertyId: propFullyManagedId,
      rentAmount: '1000000',
      status: 'ACTIVE',
      currency: 'IQD',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    });

    await db.insert(leaseTenants).values({
      leaseId,
      tenantId,
      isPrimary: true,
    });

    // Seed rent schedules
    await db.insert(rentSchedules).values([
      {
        id: schedConfirmedId,
        leaseId,
        propertyId: propFullyManagedId,
        tenantId,
        amount: '1000000',
        paidAmount: '1000000',
        dueDate: '2026-03-01',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        status: 'PAID',
        currency: 'IQD',
      },
      {
        id: schedPendingId,
        leaseId,
        propertyId: propFullyManagedId,
        tenantId,
        amount: '1000000',
        paidAmount: '0',
        dueDate: '2026-04-01',
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        status: 'PENDING',
        currency: 'IQD',
      },
      {
        id: schedReversedId,
        leaseId,
        propertyId: propFullyManagedId,
        tenantId,
        amount: '1000000',
        paidAmount: '0',
        dueDate: '2026-05-01',
        periodStart: '2026-05-01',
        periodEnd: '2026-05-31',
        status: 'PENDING',
        currency: 'IQD',
      },
      {
        id: schedHistId,
        leaseId,
        propertyId: propFullyManagedId,
        tenantId,
        amount: '1000000',
        paidAmount: '1000000',
        dueDate: '2026-01-01',
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        status: 'PAID',
        currency: 'IQD',
      },
    ]);

    // Seed payment records
    await db.insert(paymentRecords).values([
      // 1. Confirmed collection (dynamically calculated)
      {
        id: payConfirmedId,
        propertyId: propFullyManagedId,
        leaseId,
        rentScheduleId: schedConfirmedId,
        payerId: tenantId,
        amount: '1000000',
        status: 'CONFIRMED',
        paymentMethod: 'BANK_TRANSFER',
        recordedDate: '2026-03-02',
        currency: 'IQD',
      },
      // 2. Pending collection (must NOT count as collected rent or incur fees)
      {
        id: payPendingId,
        propertyId: propFullyManagedId,
        leaseId,
        rentScheduleId: schedPendingId,
        payerId: tenantId,
        amount: '1000000',
        status: 'PENDING',
        paymentMethod: 'CASH',
        recordedDate: '2026-04-02',
        currency: 'IQD',
      },
      // 3. Reversed collection (must NOT count as collected rent or incur fees)
      {
        id: payReversedId,
        propertyId: propFullyManagedId,
        leaseId,
        rentScheduleId: schedReversedId,
        payerId: tenantId,
        amount: '1000000',
        status: 'REVERSED',
        paymentMethod: 'CASH',
        recordedDate: '2026-05-02',
        currency: 'IQD',
      },
      // 4. Historical posted collection with locked ledger lines
      {
        id: payHistId,
        propertyId: propFullyManagedId,
        leaseId,
        rentScheduleId: schedHistId,
        payerId: tenantId,
        amount: '1000000',
        status: 'CONFIRMED',
        paymentMethod: 'FIB',
        recordedDate: '2026-01-02',
        currency: 'IQD',
      },
    ]);

    // Seed historical posted journal entry and ledger lines for payHistId
    await db.insert(journalEntries).values({
      id: jeHistId,
      propertyId: propFullyManagedId,
      date: '2026-01-02',
      description: 'Historical Rent Collection Posted',
      referenceId: payHistId,
      status: 'POSTED',
    });

    await db.insert(commissions).values({
      id: commHistId,
      paymentRecordId: payHistId,
      propertyId: propFullyManagedId,
      tenantId,
      ownerId,
      commissionType: 'RENTAL',
      baseAmount: '1000000',
      commissionAmount: '130000', // 30k (3%) + 40k (4%) + 60k (6%)
      rate: '0.03',               // Historical 3% platform fee
      status: 'POSTED',
      journalEntryId: jeHistId,
    });

    await db.insert(ledgerLines).values([
      { id: `ll_1_${runId}`, journalEntryId: jeHistId, accountId: '1010', debit: '1000000', credit: '0' },
      { id: `ll_2_${runId}`, journalEntryId: jeHistId, accountId: '4010', debit: '0', credit: '30000' }, // Platform fee
      { id: `ll_3_${runId}`, journalEntryId: jeHistId, accountId: '4011', debit: '0', credit: '40000' }, // Rent fee
      { id: `ll_4_${runId}`, journalEntryId: jeHistId, accountId: '4012', debit: '0', credit: '60000' }, // Mgmt fee
      { id: `ll_5_${runId}`, journalEntryId: jeHistId, accountId: '2010', debit: '0', credit: '870000' }, // Owner net
    ]);
  });

  // =========================================================================
  // SECTION 1: Admin Properties Dashboard API & Pagination
  // =========================================================================

  await t.test('1. GET /api/admin/properties enforces authentication and authorization', async () => {
    // Unauthenticated -> 401
    const resNoAuth = await request(app).get('/api/admin/properties');
    assert.strictEqual(resNoAuth.status, 401, 'Unauthenticated request must be 401');

    // Tenant -> 403
    const resTenant = await request(app)
      .get('/api/admin/properties')
      .set('Authorization', 'Bearer tenant_token');
    assert.strictEqual(resTenant.status, 403, 'Tenant must be forbidden (403)');

    // Owner -> 403
    const resOwner = await request(app)
      .get('/api/admin/properties')
      .set('Authorization', 'Bearer owner_token');
    assert.strictEqual(resOwner.status, 403, 'Owner must be forbidden (403)');

    // Read-only Admin -> 200 (can view dashboard)
    const resRO = await request(app)
      .get('/api/admin/properties')
      .set('Authorization', 'Bearer read_only_admin_token');
    assert.strictEqual(resRO.status, 200, 'Read-only admin can read properties');

    // Super Admin -> 200
    const resAdmin = await request(app)
      .get('/api/admin/properties')
      .set('Authorization', 'Bearer super_admin_token');
    assert.strictEqual(resAdmin.status, 200, 'Super admin can read properties');
    assert.strictEqual(resAdmin.body.status, 'ok');
    assert.ok(Array.isArray(resAdmin.body.properties));
    assert.ok(resAdmin.body.pagination);
    assert.strictEqual(typeof resAdmin.body.pagination.total, 'number');
    assert.strictEqual(typeof resAdmin.body.globalPlatformFee, 'number');
  });

  await t.test('2. GET /api/admin/properties supports server-side pagination, search, and filtering', async () => {
    // Pagination parameters
    const resPage1 = await request(app)
      .get('/api/admin/properties?page=1&limit=2')
      .set('Authorization', 'Bearer super_admin_token');
    assert.strictEqual(resPage1.status, 200);
    assert.strictEqual(resPage1.body.pagination.page, 1);
    assert.strictEqual(resPage1.body.pagination.limit, 2);
    assert.ok(resPage1.body.properties.length <= 2);

    // Search by name
    const resSearch = await request(app)
      .get(`/api/admin/properties?search=${encodeURIComponent(runId)}`)
      .set('Authorization', 'Bearer super_admin_token');
    assert.strictEqual(resSearch.status, 200);
    assert.ok(resSearch.body.properties.length >= 3, 'Must match all 3 created test properties');

    // Filter by city: Erbil
    const resErbil = await request(app)
      .get(`/api/admin/properties?search=${encodeURIComponent(runId)}&city=Erbil`)
      .set('Authorization', 'Bearer super_admin_token');
    assert.strictEqual(resErbil.status, 200);
    assert.ok(resErbil.body.properties.every((p: any) => p.address?.city === 'Erbil'));

    // Filter by operating model: AGENT_OPERATED
    const resAO = await request(app)
      .get(`/api/admin/properties?search=${encodeURIComponent(runId)}&operatingModel=AGENT_OPERATED`)
      .set('Authorization', 'Bearer super_admin_token');
    assert.strictEqual(resAO.status, 200);
    assert.strictEqual(resAO.body.properties.length, 1);
    assert.strictEqual(resAO.body.properties[0].id, propAgentOperatedId);
    assert.strictEqual(resAO.body.properties[0].operatingModel, 'AGENT_OPERATED');
  });

  await t.test('3. GET /api/admin/properties exposes canonical 3-fee visibility and operating model', async () => {
    const res = await request(app)
      .get(`/api/admin/properties?search=${encodeURIComponent(runId)}`)
      .set('Authorization', 'Bearer super_admin_token');

    assert.strictEqual(res.status, 200);
    const fm = res.body.properties.find((p: any) => p.id === propFullyManagedId);
    const alpm = res.body.properties.find((p: any) => p.id === propAgentListedId);
    const ao = res.body.properties.find((p: any) => p.id === propAgentOperatedId);

    // FULLY_MANAGED: both rentFee and managementFee configured
    assert.ok(fm, 'Fully managed property must be in list');
    assert.strictEqual(fm.operatingModel, 'FULLY_MANAGED');
    assert.strictEqual(fm.rentFee, 0.04);
    assert.strictEqual(fm.managementFee, 0.06);
    assert.strictEqual(typeof fm.platformFee, 'number');

    // AGENT_LISTED_PLATFORM_MANAGED: rentFee null, managementFee configured
    assert.ok(alpm, 'ALPM property must be in list');
    assert.strictEqual(alpm.operatingModel, 'AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(alpm.rentFee, null);
    assert.strictEqual(alpm.managementFee, 0.07);

    // AGENT_OPERATED: both fees null
    assert.ok(ao, 'Agent operated property must be in list');
    assert.strictEqual(ao.operatingModel, 'AGENT_OPERATED');
    assert.strictEqual(ao.rentFee, null);
    assert.strictEqual(ao.managementFee, null);
  });

  // =========================================================================
  // SECTION 2: Property-Specific Fee Mutation & Validation
  // =========================================================================

  await t.test('4. Fee mutation endpoint enforces role permissions and blocks read-only roles', async () => {
    // READ_ONLY_ADMIN -> 403
    const resRO = await request(app)
      .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
      .set('Authorization', 'Bearer read_only_admin_token')
      .send({ rentFee: 0.03 });
    assert.strictEqual(resRO.status, 403, 'READ_ONLY_ADMIN must be rejected with 403');

    // AUDITOR -> 403
    const resAuditor = await request(app)
      .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
      .set('Authorization', 'Bearer auditor_token')
      .send({ rentFee: 0.03 });
    assert.strictEqual(resAuditor.status, 403, 'AUDITOR must be rejected with 403');

    // Non-finance admin role (AGENT_BROKER) -> 403
    const resAgent = await request(app)
      .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
      .set('Authorization', 'Bearer agent_token')
      .send({ rentFee: 0.03 });
    assert.strictEqual(resAgent.status, 403, 'Agent broker must be rejected with 403');
  });

  await t.test('5. Rate validation rejects negative, excessive, and over-precision rates', async () => {
    // Negative rate
    const resNeg = await request(app)
      .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rentFee: -0.01 });
    assert.strictEqual(resNeg.status, 400);
    assert.ok(resNeg.body.error.includes('negative'));

    // Rate > 0.50 (50%)
    const resOver = await request(app)
      .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ managementFee: 0.55 });
    assert.strictEqual(resOver.status, 400);
    assert.ok(resOver.body.error.includes('50%'));

    // Precision > 4 decimal places
    const resPrecision = await request(app)
      .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rentFee: 0.02555 });
    assert.strictEqual(resPrecision.status, 400);
    assert.ok(resPrecision.body.error.includes('precision'));
  });

  await t.test('6. Operating model applicability strictly rejects invalid fee assignments', async () => {
    // AGENT_OPERATED cannot accept rentFee
    const resAoRent = await request(app)
      .patch(`/api/admin/properties/${propAgentOperatedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rentFee: 0.03 });
    assert.strictEqual(resAoRent.status, 400);
    assert.ok(resAoRent.body.error.includes('AGENT_OPERATED'));

    // AGENT_OPERATED cannot accept managementFee
    const resAoMgmt = await request(app)
      .patch(`/api/admin/properties/${propAgentOperatedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ managementFee: 0.05 });
    assert.strictEqual(resAoMgmt.status, 400);
    assert.ok(resAoMgmt.body.error.includes('AGENT_OPERATED'));

    // AGENT_LISTED_PLATFORM_MANAGED cannot accept rentFee
    const resAlpmRent = await request(app)
      .patch(`/api/admin/properties/${propAgentListedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rentFee: 0.03 });
    assert.strictEqual(resAlpmRent.status, 400);
    assert.ok(resAlpmRent.body.error.includes('AGENT_LISTED_PLATFORM_MANAGED'));

    // But AGENT_LISTED_PLATFORM_MANAGED CAN accept managementFee
    const resAlpmMgmt = await request(app)
      .patch(`/api/admin/properties/${propAgentListedId}/fees`)
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ managementFee: 0.08 });
    assert.strictEqual(resAlpmMgmt.status, 200);
    assert.strictEqual(resAlpmMgmt.body.property.managementFee, 0.08);
  });

  await t.test('7. Authorized fee update preserves null vs agreed 0% and writes atomic audit log', async () => {
    try {
      // Update to agreed 0%
      const resZero = await request(app)
        .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
        .set('Authorization', 'Bearer super_admin_token')
        .send({ rentFee: 0 });
      assert.strictEqual(resZero.status, 200);
      assert.strictEqual(resZero.body.property.rentFee, 0, 'Agreed 0% must be stored as number 0');

      // Verify audit log for agreed 0% update
      const [auditZero] = await db.select()
        .from(auditLogs)
        .where(and(
          eq(auditLogs.action, 'UPDATE_PROPERTY_FEES'),
          eq(auditLogs.resourceId, propFullyManagedId)
        ))
        .orderBy(desc(auditLogs.timestamp))
        .limit(1);

      assert.ok(auditZero, 'Audit log must be created on fee mutation');
      assert.strictEqual(auditZero.actorUserId, 'usr_super_admin_test');
      assert.strictEqual((auditZero.changes as any)?.newRentFee, 0);

      // Update to unset (null)
      const resUnset = await request(app)
        .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
        .set('Authorization', 'Bearer super_admin_token')
        .send({ rentFee: null });
      assert.strictEqual(resUnset.status, 200);
      assert.strictEqual(resUnset.body.property.rentFee, null, 'Unset fee must be returned as null');

      // Verify DB persistence of null vs 0
      const [propDb] = await db.select().from(properties).where(eq(properties.id, propFullyManagedId));
      assert.strictEqual(propDb.rentFee, null, 'Database column must store null when unset');
    } finally {
      // Restore to 0.04
      await request(app)
        .patch(`/api/admin/properties/${propFullyManagedId}/fees`)
        .set('Authorization', 'Bearer super_admin_token')
        .send({ rentFee: 0.04 });
    }
  });

  // =========================================================================
  // SECTION 3: Accountant Fee & Settlement Audit Endpoint
  // =========================================================================

  await t.test('8. GET /api/financials/fee-audit enforces finance authorization', async () => {
    // Unauthenticated -> 401
    const resNoAuth = await request(app).get('/api/financials/fee-audit');
    assert.strictEqual(resNoAuth.status, 401);

    // Tenant -> 403
    const resTenant = await request(app)
      .get('/api/financials/fee-audit')
      .set('Authorization', 'Bearer tenant_token');
    assert.strictEqual(resTenant.status, 403);

    // Owner -> 403
    const resOwner = await request(app)
      .get('/api/financials/fee-audit')
      .set('Authorization', 'Bearer owner_token');
    assert.strictEqual(resOwner.status, 403);

    // Accountant -> 200
    const resAccountant = await request(app)
      .get('/api/financials/fee-audit')
      .set('Authorization', 'Bearer accountant_token');
    assert.strictEqual(resAccountant.status, 200);
    assert.strictEqual(resAccountant.body.status, 'ok');
    assert.ok(Array.isArray(resAccountant.body.items));
    assert.ok(resAccountant.body.summary);
    assert.ok(resAccountant.body.pagination);
  });

  await t.test('9. GET /api/financials/fee-audit returns separated 3-fee components and reconciles owner net', async () => {
    const res = await request(app)
      .get(`/api/financials/fee-audit?search=${encodeURIComponent(runId)}`)
      .set('Authorization', 'Bearer accountant_token');

    assert.strictEqual(res.status, 200);
    const items = res.body.items;
    assert.ok(items.length >= 4, 'Must return all 4 test payment items');

    // 1. Confirmed collection item (dynamically calculated)
    const confItem = items.find((i: any) => i.id === payConfirmedId);
    assert.ok(confItem, 'Confirmed payment item must exist');
    assert.strictEqual(confItem.status, 'CONFIRMED');
    assert.strictEqual(confItem.collectedRent, 1_000_000);
    assert.strictEqual(confItem.calculationBasis, 'CALCULATED_CONFIRMED');

    // Invariant: 3 separate fee components present
    assert.strictEqual(typeof confItem.platformFeeAmount, 'number');
    assert.strictEqual(typeof confItem.rentFeeAmount, 'number');
    assert.strictEqual(typeof confItem.managementFeeAmount, 'number');
    assert.strictEqual(confItem.rentFeeRate, 0.04);
    assert.strictEqual(confItem.managementFeeRate, 0.06);

    // Invariant: Total deductions = sum of the 3 fee components (no double counting)
    const expectedDeductions = confItem.platformFeeAmount + confItem.rentFeeAmount + confItem.managementFeeAmount;
    assert.strictEqual(confItem.totalDeductions, expectedDeductions);

    // Invariant: Owner Net = collectedRent - totalDeductions
    assert.strictEqual(confItem.ownerNetAmount, confItem.collectedRent - confItem.totalDeductions);
  });

  await t.test('10. Non-collected payments (PENDING, FAILED, REVERSED) do NOT incur fees or report collected rent', async () => {
    const res = await request(app)
      .get(`/api/financials/fee-audit?search=${encodeURIComponent(runId)}`)
      .set('Authorization', 'Bearer accountant_token');

    const items = res.body.items;

    // 1. PENDING item
    const pendItem = items.find((i: any) => i.id === payPendingId);
    assert.ok(pendItem, 'Pending payment must be in audit table');
    assert.strictEqual(pendItem.status, 'PENDING');
    assert.strictEqual(pendItem.collectedRent, 0, 'Pending payment must have 0 collected rent');
    assert.strictEqual(pendItem.platformFeeAmount, 0, 'Pending payment must have 0 platform fee');
    assert.strictEqual(pendItem.rentFeeAmount, 0, 'Pending payment must have 0 rent fee');
    assert.strictEqual(pendItem.managementFeeAmount, 0, 'Pending payment must have 0 management fee');
    assert.strictEqual(pendItem.totalDeductions, 0, 'Pending payment must have 0 total deductions');
    assert.strictEqual(pendItem.ownerNetAmount, 0, 'Pending payment must have 0 owner net');
    assert.strictEqual(pendItem.calculationBasis, 'NON_COLLECTED');

    // 2. REVERSED item
    const revItem = items.find((i: any) => i.id === payReversedId);
    assert.ok(revItem, 'Reversed payment must be in audit table');
    assert.strictEqual(revItem.status, 'REVERSED');
    assert.strictEqual(revItem.isReversed, true, 'isReversed flag must be true');
    assert.strictEqual(revItem.collectedRent, 0, 'Reversed payment must have 0 net collected rent');
    assert.strictEqual(revItem.totalDeductions, 0, 'Reversed payment must have 0 deductions');
    assert.strictEqual(revItem.ownerNetAmount, 0, 'Reversed payment must have 0 owner net');
    assert.strictEqual(revItem.calculationBasis, 'NON_COLLECTED');
  });

  await t.test('11. Historical posted rates are preserved and NOT recalculated with current policy rate', async () => {
    // Mutate global platform fee to 0.05 (5%) in database policy
    const currentRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    await db.insert(financialPolicies).values({
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.05',
      active: true,
      description: 'Temporary Test Policy Mutation',
    }).onConflictDoUpdate({
      target: financialPolicies.policyType,
      set: { policyValue: '0.05', updatedAt: new Date() },
    });

    try {
      const res = await request(app)
        .get(`/api/financials/fee-audit?search=${encodeURIComponent(runId)}`)
        .set('Authorization', 'Bearer accountant_token');

      const items = res.body.items;
      const histItem = items.find((i: any) => i.id === payHistId);

      assert.ok(histItem, 'Historical posted payment must be present');
      assert.strictEqual(histItem.calculationBasis, 'POSTED_LEDGER');

      // The historical payment had 30,000 IQD posted platform fee (3% of 1M)
      // Even though global policy is now 5% (50,000 IQD), it MUST remain 30,000 IQD!
      assert.strictEqual(histItem.platformFeeAmount, 30_000, 'Historical platform fee must remain 30,000 IQD, not 50,000');
      assert.strictEqual(histItem.rentFeeAmount, 40_000, 'Historical rent fee must remain 40,000 IQD');
      assert.strictEqual(histItem.managementFeeAmount, 60_000, 'Historical management fee must remain 60,000 IQD');
      assert.strictEqual(histItem.totalDeductions, 130_000, 'Historical total deductions must remain 130,000 IQD');
      assert.strictEqual(histItem.ownerNetAmount, 870_000, 'Historical owner net must remain 870,000 IQD');
    } finally {
      // Restore policy rate
      await db.insert(financialPolicies).values({
        policyType: 'PLATFORM_FEE_RATE',
        policyValue: currentRate.toString(),
        active: true,
      }).onConflictDoUpdate({
        target: financialPolicies.policyType,
        set: { policyValue: currentRate.toString(), updatedAt: new Date() },
      });
    }
  });

  // Teardown
  await t.test('99. Teardown test fixtures', async () => {
    // Delete ledger lines
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, jeHistId));
    // Delete commissions
    await db.delete(commissions).where(eq(commissions.paymentRecordId, payHistId));
    // Delete journal entries
    await db.delete(journalEntries).where(eq(journalEntries.id, jeHistId));
    // Delete payment records
    await db.delete(paymentRecords).where(eq(paymentRecords.propertyId, propFullyManagedId));
    // Delete rent schedules
    await db.delete(rentSchedules).where(eq(rentSchedules.propertyId, propFullyManagedId));
    // Delete lease tenants
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
    // Delete leases
    await db.delete(leases).where(eq(leases.id, leaseId));
    // Delete ownership records
    await db.delete(ownershipRecords).where(eq(ownershipRecords.ownerId, ownerId));
    // Delete properties
    await db.delete(properties).where(eq(properties.id, propFullyManagedId));
    await db.delete(properties).where(eq(properties.id, propAgentListedId));
    await db.delete(properties).where(eq(properties.id, propAgentOperatedId));
    // Delete users
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, tenantId));
  });
});
