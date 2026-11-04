import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  units,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  commissions,
  journalEntries,
  ledgerLines,
  reversalRecords,
  financialPolicies,
  rentalApplications,
} from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import apiRouter from '../src/server/routes/api.js';
import { signAuthToken } from '../src/server/utils/auth.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { Permission, UserRole, CompanyRole, LeaseStatus } from '../src/types/index.js';

test('Phase 32 — Manager Payment F-02 Remediation & Cross-Workspace Continuity Suite', async (t) => {
  const runId = `f02_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  // Express Test Harness
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  // Personas
  const ownerId = `owner_${runId}`;
  const companyOrgId = `org_${runId}`;
  const managerId = `mgr_${runId}`;
  const tenantId = `tnt_${runId}`;
  const foreignOwnerId = `fowner_${runId}`;

  const ownerToken = signAuthToken({ id: ownerId, email: `${ownerId}@homehub.iq`, roles: [UserRole.PROPERTY_OWNER] });
  const managerToken = signAuthToken({
    id: managerId,
    email: `${managerId}@agency.iq`,
    roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER],
    organizationId: companyOrgId,
  });
  const tenantToken = signAuthToken({ id: tenantId, email: `${tenantId}@tenant.iq`, roles: [UserRole.TENANT] });
  const foreignOwnerToken = signAuthToken({ id: foreignOwnerId, email: `${foreignOwnerId}@other.iq`, roles: [UserRole.PROPERTY_OWNER] });

  const propId = `prop_${runId}`;
  const unitId = `unit_${runId}`;
  const leaseId = `lease_${runId}`;
  const scheduleId = `sch_${runId}`;
  const schedule2Id = `sch2_${runId}`;
  const applicationId = `app_${runId}`;

  // Provision Database Fixtures
  await db.insert(users).values([
    { id: ownerId, firstName: 'Karwan', lastName: 'Owner', email: `${ownerId}@homehub.iq`, roles: [UserRole.PROPERTY_OWNER] },
    { id: managerId, firstName: 'Diyar', lastName: 'Manager', email: `${managerId}@agency.iq`, roles: [UserRole.COMPANY, UserRole.COMPANY_MEMBER] },
    { id: tenantId, firstName: 'Aram', lastName: 'Tenant', email: `${tenantId}@tenant.iq`, roles: [UserRole.TENANT] },
    { id: foreignOwnerId, firstName: 'Foreign', lastName: 'Owner', email: `${foreignOwnerId}@other.iq`, roles: [UserRole.PROPERTY_OWNER] },
  ]);

  await db.insert(organizations).values({
    id: companyOrgId,
    name: 'HomeHub Management Agency',
    type: 'PROPERTY_MANAGEMENT',
  });

  await db.insert(organizationMembers).values({
    organizationId: companyOrgId,
    userId: managerId,
    role: CompanyRole.PROPERTY_MANAGER,
    status: 'ACTIVE',
  });

  await db.insert(properties).values({
    id: propId,
    name: `Test Property ${runId}`,
    type: 'RESIDENTIAL',
    currency: 'IQD',
    status: 'ACTIVE',
  });

  await db.insert(units).values({
    id: unitId,
    propertyId: propId,
    unitNumber: `101_${runId}`,
    status: 'VACANT',
  });

  await db.insert(ownershipRecords).values({
    propertyId: propId,
    ownerId: ownerId,
    status: 'VERIFIED',
    ownershipPercentage: '100.00',
  });

  await db.insert(managementAgreements).values({
    propertyId: propId,
    companyId: companyOrgId,
    ownerId: ownerId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    grantedPermissions: [
      Permission.MANAGE_LEASES,
      Permission.COLLECT_RENT,
      Permission.VIEW_FINANCIALS,
      Permission.MANAGE_FINANCIALS,
    ],
  });

  await db.insert(financialPolicies).values([
    { policyType: 'PLATFORM_FEE_RATE', policyValue: '0.02', active: true, effectiveFrom: new Date() },
    { policyType: 'RENT_MANAGEMENT_COMMISSION_RATE', policyValue: '0.05', active: true, effectiveFrom: new Date() },
  ]).onConflictDoNothing();

  await db.insert(rentalApplications).values({
    id: applicationId,
    propertyId: propId,
    unitId: unitId,
    applicantUserId: tenantId,
    status: 'APPROVED',
  });

  // Create ACTIVE Lease with 1,000,000 IQD rent
  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    unitId: unitId,
    status: LeaseStatus.ACTIVE,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '1000000',
    currency: 'IQD',
    depositAmount: '500000',
    rentalApplicationId: applicationId,
  });

  await db.insert(leaseTenants).values({
    leaseId: leaseId,
    tenantId: tenantId,
    isPrimary: true,
  });

  // Two 1,000,000 IQD Schedules
  await db.insert(rentSchedules).values([
    {
      id: scheduleId,
      leaseId: leaseId,
      propertyId: propId,
      unitId: unitId,
      tenantId: tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-01-05',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      status: 'UPCOMING',
      paidAmount: '0',
    },
    {
      id: schedule2Id,
      leaseId: leaseId,
      propertyId: propId,
      unitId: unitId,
      tenantId: tenantId,
      amount: '1000000',
      currency: 'IQD',
      dueDate: '2026-02-05',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      status: 'UPCOMING',
      paidAmount: '0',
    },
  ]);

  let managerPaymentId: string;
  let tenantPaymentId: string;

  // ========================================================================
  // SCENARIO 1: Manager records unconfirmed partial payment (Defect F-02 Verification)
  // ========================================================================
  await t.test('1. Manager records unconfirmed partial payment; schedule paidAmount and status remain unchanged', async () => {
    const res = await request(app)
      .post('/api/leases/payments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: 400000,
        currency: 'IQD',
        paymentMethod: 'CASH',
        referenceNumber: `CASH-MGR-${runId}`,
      });

    assert.strictEqual(res.status, 201, `Failed to record manager payment: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.status, 'RECORDED');
    assert.strictEqual(Number(res.body.amount), 400000);
    managerPaymentId = res.body.id;

    // CRUCIAL INVARIANT: rent_schedules.paidAmount must NOT be mutated while payment is unconfirmed!
    const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(scheduleAfter.paidAmount || 0), 0, 'Schedule paidAmount must remain strictly 0 for RECORDED payment');
    assert.strictEqual(scheduleAfter.status, 'UPCOMING', 'Schedule status must remain UPCOMING');
  });

  // ========================================================================
  // SCENARIO 2: Tenant records legitimate remaining balance without double-counting rejection
  // ========================================================================
  await t.test('2. Tenant records remaining 600,000 IQD balance without double-counting rejection', async () => {
    // In unpatched F-02, this threw HTTP 400 "Payment amount exceeds remaining rent due" because the 400k was counted twice!
    const res = await request(app)
      .post('/api/tenant/payments/pay-rent')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId: propId,
        leaseId: leaseId,
        scheduleId: scheduleId,
        amount: 600000,
        currency: 'IQD',
        paymentMethod: 'FIB',
        referenceNumber: `FIB-REF-${runId}`,
      });

    assert.strictEqual(res.status, 201, `Tenant remaining payment must succeed with 201: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.payment.status, 'RECORDED');
    assert.strictEqual(Number(res.body.payment.amount), 600000);
    tenantPaymentId = res.body.payment.id;

    // Schedule paidAmount is STILL 0 because both payments are unconfirmed
    const [scheduleAfter] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(scheduleAfter.paidAmount || 0), 0, 'Schedule paidAmount remains 0 with 2 unconfirmed claims');
    assert.strictEqual(scheduleAfter.status, 'UPCOMING', 'Schedule status remains UPCOMING with unconfirmed claims');
  });

  // ========================================================================
  // SCENARIO 3: Aggregate pending claims protect schedule from genuine overpayment
  // ========================================================================
  await t.test('3. Aggregate pending claims protect schedule against genuine overpayment', async () => {
    // Total committed is 400k (manager) + 600k (tenant) = 1,000,000 IQD.
    // An attempt to pay even 1 IQD more must be rejected by both routes.
    const tenantOverpay = await request(app)
      .post('/api/tenant/payments/pay-rent')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId: propId,
        leaseId: leaseId,
        scheduleId: scheduleId,
        amount: 10000,
        currency: 'IQD',
        paymentMethod: 'FIB',
      });

    assert.strictEqual(tenantOverpay.status, 400, 'Tenant overpayment must return HTTP 400');
    assert.ok(tenantOverpay.body.error?.includes('exceeds remaining rent due'));

    const managerOverpay = await request(app)
      .post('/api/leases/payments')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        propertyId: propId,
        leaseId: leaseId,
        rentScheduleId: scheduleId,
        payerId: tenantId,
        amount: 50000,
        currency: 'IQD',
        paymentMethod: 'CASH',
      });

    assert.strictEqual(managerOverpay.status, 400, 'Manager overpayment must return HTTP 400');
    assert.ok(managerOverpay.body.message?.includes('exceeds remaining rent due') || managerOverpay.body.error?.includes('VALIDATION_ERROR'));
  });

  // ========================================================================
  // SCENARIO 4: Confirming payments recalculates schedule correctly from confirmed records
  // ========================================================================
  await t.test('4. Confirming payments recalculates schedule correctly from confirmed records', async () => {
    // Step A: Confirm Manager 400k CASH payment
    const confirm1 = await request(app)
      .post(`/api/leases/payments/${managerPaymentId}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    assert.strictEqual(confirm1.status, 200, `Confirmation 1 failed: ${JSON.stringify(confirm1.body)}`);
    assert.strictEqual(confirm1.body.payment.status, 'CONFIRMED');

    const [schedAfter1] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(schedAfter1.paidAmount), 400000, 'Schedule paidAmount is now 400,000 IQD');
    assert.strictEqual(schedAfter1.status, 'PARTIALLY_PAID', 'Schedule status transitions to PARTIALLY_PAID');

    // Step B: Confirm Tenant 600k FIB digital payment (Phase 31 integration)
    const confirm2 = await request(app)
      .post(`/api/leases/payments/${tenantPaymentId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ referenceNumber: `VERIFIED-FIB-${runId}` });

    assert.strictEqual(confirm2.status, 200, `Confirmation 2 failed: ${JSON.stringify(confirm2.body)}`);
    assert.strictEqual(confirm2.body.payment.status, 'CONFIRMED');

    const [schedAfter2] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(schedAfter2.paidAmount), 1000000, 'Schedule paidAmount is now 1,000,000 IQD');
    assert.strictEqual(schedAfter2.status, 'PAID', 'Schedule status transitions to PAID');
  });

  // ========================================================================
  // SCENARIO 5: Repeated confirmation is idempotent and does not duplicate amounts or fees
  // ========================================================================
  await t.test('5. Repeated confirmation is idempotent and does not duplicate amounts or fees', async () => {
    const reconfirm = await request(app)
      .post(`/api/leases/payments/${managerPaymentId}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    assert.strictEqual(reconfirm.status, 200);

    const [sched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(sched.paidAmount), 1000000, 'Schedule paidAmount remains exactly 1,000,000 IQD');
    assert.strictEqual(sched.status, 'PAID');

    const comms = await db.select().from(commissions).where(eq(commissions.paymentRecordId, managerPaymentId));
    assert.strictEqual(comms.length, 1, 'Exactly one commission record exists for payment 1');
  });

  // ========================================================================
  // SCENARIO 6: Reversal reconciles schedule paidAmount strictly to remaining confirmed funds
  // ========================================================================
  await t.test('6. Payment reversal reconciles schedule paidAmount and status down to remaining confirmed sum', async () => {
    const revRes = await request(app)
      .post(`/api/leases/payments/${managerPaymentId}/reverse`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ reason: 'Correction of cash record' });

    assert.strictEqual(revRes.status, 200, `Reversal failed: ${JSON.stringify(revRes.body)}`);
    assert.strictEqual(revRes.body.payment.status, 'REVERSED');

    const [schedAfterRev] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(schedAfterRev.paidAmount), 600000, 'Schedule paidAmount reduced strictly to remaining 600,000 IQD');
    assert.strictEqual(schedAfterRev.status, 'PARTIALLY_PAID', 'Schedule status reverted to PARTIALLY_PAID');
  });

  // ========================================================================
  // SCENARIO 7: Cross-currency payment attempts are strictly rejected
  // ========================================================================
  await t.test('7. Cross-currency payment attempts are strictly rejected with CURRENCY_MISMATCH', async () => {
    await assert.rejects(
      async () => {
        await leaseRepository.recordPayment(
          propId,
          leaseId,
          tenantId,
          schedule2Id,
          500,
          'CASH',
          `USD-FAIL-${runId}`,
          managerId,
          'USD'
        );
      },
      /CURRENCY_MISMATCH/,
      'Direct call must reject USD payment for IQD schedule'
    );
  });

  // Deterministic Teardown (best-effort; respect immutable tables)
  try {
    await db.delete(commissions).where(eq(commissions.propertyId, propId)).catch(() => {});
    const jes = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propId)).catch(() => []);
    for (const je of jes || []) {
      await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, je.id)).catch(() => {});
    }
    await db.delete(journalEntries).where(eq(journalEntries.propertyId, propId)).catch(() => {});
    await db.delete(paymentRecords).where(eq(paymentRecords.propertyId, propId)).catch(() => {});
    await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, leaseId)).catch(() => {});
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId)).catch(() => {});
    await db.delete(leases).where(eq(leases.propertyId, propId)).catch(() => {});
    await db.delete(rentalApplications).where(eq(rentalApplications.id, applicationId)).catch(() => {});
    await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, propId)).catch(() => {});
    await db.delete(units).where(eq(units.propertyId, propId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, companyOrgId)).catch(() => {});
    await db.delete(organizations).where(eq(organizations.id, companyOrgId)).catch(() => {});
    await db.delete(users).where(inArray(users.id, [ownerId, managerId, tenantId, foreignOwnerId])).catch(() => {});
  } catch {
    // Teardown is best effort
  }
});

