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
  managementAgreements,
  commissions,
  journalEntries,
  ledgerLines,
  financialPolicies,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { CommissionService, commissionService } from '../src/server/services/commission.js';
import { financeService } from '../src/server/services/finance.js';
import { propertyRepository } from '../src/server/repositories/properties.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import adminRouter from '../src/server/routes/admin.js';
import { Permission } from '../src/types/index.js';

process.env.SQL_HOST = 'localhost';

const app = express();
app.use(express.json());
// Inject test user header middleware to simulate authentication
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    if (token === 'super_admin_token') {
      (req as any).user = { id: 'usr_super_admin_test', roles: ['SUPER_ADMIN', 'ADMIN'] };
    } else if (token === 'finance_admin_token') {
      (req as any).user = { id: 'usr_finance_admin_test', roles: ['FINANCE_ADMIN', 'ADMIN'] };
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

test('Admin Fee Management & Authority Invariant Suite', async (t) => {

  // =========================================================================
  // SECTION 1: Authoritative Shared Calculation Path (CommissionService)
  // =========================================================================

  await t.test('1. AGENT_OPERATED: only Platform Fee applies; Rent Fee and Management Fee are null and 0', () => {
    const calc = CommissionService.calculateFeesSync(
      1_000_000, // 1,000,000 IQD base rent
      0.03,      // 3% Platform Fee
      'AGENT_OPERATED',
      0.05,      // Provided rent fee input must be ignored
      0.07,      // Provided management fee input must be ignored
      'IQD'
    );

    assert.strictEqual(calc.platformFeeAmount, 30_000, 'Platform fee must be 30,000 IQD');
    assert.strictEqual(calc.rentFeeRate, null, 'Rent fee rate must be strictly null for AGENT_OPERATED');
    assert.strictEqual(calc.rentFeeAmount, 0, 'Rent fee amount must be strictly 0 for AGENT_OPERATED');
    assert.strictEqual(calc.managementFeeRate, null, 'Management fee rate must be strictly null for AGENT_OPERATED');
    assert.strictEqual(calc.managementFeeAmount, 0, 'Management fee amount must be strictly 0 for AGENT_OPERATED');
    assert.strictEqual(calc.totalFeeAmount, 30_000, 'Total fees must equal only platform fee');
    assert.strictEqual(calc.ownerNetAmount, 970_000, 'Owner net must equal 970,000 IQD');
  });

  await t.test('2. AGENT_LISTED_PLATFORM_MANAGED: Platform Fee & agreed Management Fee apply; Rent Fee does not apply', () => {
    const calc = CommissionService.calculateFeesSync(
      1_000_000,
      0.03,      // 3% Platform Fee
      'AGENT_LISTED_PLATFORM_MANAGED',
      0.05,      // Rent fee input must be waived/inapplicable
      0.08,      // 8% agreed Management Fee
      'IQD'
    );

    assert.strictEqual(calc.platformFeeAmount, 30_000, 'Platform fee must be 30,000 IQD');
    assert.strictEqual(calc.rentFeeRate, null, 'Rent fee rate must be null for AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(calc.rentFeeAmount, 0, 'Rent fee amount must be 0 for AGENT_LISTED_PLATFORM_MANAGED');
    assert.strictEqual(calc.managementFeeRate, 0.08, 'Management fee rate must be preserved');
    assert.strictEqual(calc.managementFeeAmount, 80_000, 'Management fee amount must be 80,000 IQD');
    assert.strictEqual(calc.totalFeeAmount, 110_000, 'Total fees must be 30k + 80k = 110k');
    assert.strictEqual(calc.ownerNetAmount, 890_000, 'Owner net must be 890,000 IQD');
  });

  await t.test('3. FULLY_MANAGED: all three agreed/configured fees apply', () => {
    const calc = CommissionService.calculateFeesSync(
      1_000_000,
      0.03, // 3% Platform Fee
      'FULLY_MANAGED',
      0.04, // 4% Rent Fee
      0.06, // 6% Management Fee
      'IQD'
    );

    assert.strictEqual(calc.platformFeeAmount, 30_000);
    assert.strictEqual(calc.rentFeeRate, 0.04);
    assert.strictEqual(calc.rentFeeAmount, 40_000);
    assert.strictEqual(calc.managementFeeRate, 0.06);
    assert.strictEqual(calc.managementFeeAmount, 60_000);
    assert.strictEqual(calc.totalFeeAmount, 130_000);
    assert.strictEqual(calc.ownerNetAmount, 870_000);
  });

  await t.test('4. Unset property-specific fees are distinguishable from explicitly agreed 0% fees', () => {
    // Unset fees (null input)
    const calcUnset = CommissionService.calculateFeesSync(
      1_000_000,
      0.03,
      'FULLY_MANAGED',
      null, // Unset rent fee
      null, // Unset management fee
      'IQD'
    );
    assert.strictEqual(calcUnset.rentFeeRate, null, 'Unset rent fee must remain null');
    assert.strictEqual(calcUnset.rentFeeAmount, 0);
    assert.strictEqual(calcUnset.managementFeeRate, null, 'Unset management fee must remain null');
    assert.strictEqual(calcUnset.managementFeeAmount, 0);
    assert.strictEqual(calcUnset.totalFeeAmount, 30_000);

    // Explicitly agreed 0% fees (0 input)
    const calcZero = CommissionService.calculateFeesSync(
      1_000_000,
      0.03,
      'FULLY_MANAGED',
      0, // Agreed 0% rent fee
      0, // Agreed 0% management fee
      'IQD'
    );
    assert.strictEqual(calcZero.rentFeeRate, 0, 'Agreed 0% rent fee must be number 0, not null');
    assert.strictEqual(calcZero.rentFeeAmount, 0);
    assert.strictEqual(calcZero.managementFeeRate, 0, 'Agreed 0% management fee must be number 0, not null');
    assert.strictEqual(calcZero.managementFeeAmount, 0);
    assert.strictEqual(calcZero.totalFeeAmount, 30_000);

    // Assertion: Unset rate !== Agreed 0% rate
    assert.notStrictEqual(calcUnset.rentFeeRate, calcZero.rentFeeRate, 'Unset fee must never be conflated with agreed 0% fee');
  });

  await t.test('5. Multi-currency rounding precision (USD vs IQD)', () => {
    // USD rounding: 2 decimal places
    const calcUsd = CommissionService.calculateFeesSync(
      1234.56,
      0.025, // 2.5%
      'FULLY_MANAGED',
      0.015, // 1.5%
      0.035, // 3.5%
      'USD'
    );
    // 1234.56 * 0.025 = 30.864 -> 30.86
    assert.strictEqual(calcUsd.platformFeeAmount, 30.86);
    // 1234.56 * 0.015 = 18.5184 -> 18.52
    assert.strictEqual(calcUsd.rentFeeAmount, 18.52);
    // 1234.56 * 0.035 = 43.2096 -> 43.21
    assert.strictEqual(calcUsd.managementFeeAmount, 43.21);
    assert.strictEqual(calcUsd.totalFeeAmount, 92.59);
    assert.strictEqual(Math.round((calcUsd.baseAmount - calcUsd.totalFeeAmount) * 100) / 100, calcUsd.ownerNetAmount);
  });

  // =========================================================================
  // SECTION 2: Admin Endpoints Authorization & Validation Security
  // =========================================================================

  await t.test('6. GET /api/admin/fees: Admin reads configuration; non-admins are rejected', async () => {
    // Unauthenticated
    const resNoAuth = await request(app).get('/api/admin/fees');
    assert.strictEqual(resNoAuth.status, 401, 'Unauthenticated request must be 401');

    // Tenant
    const resTenant = await request(app)
      .get('/api/admin/fees')
      .set('Authorization', 'Bearer tenant_token');
    assert.strictEqual(resTenant.status, 403, 'Tenant must be forbidden (403)');

    // Owner
    const resOwner = await request(app)
      .get('/api/admin/fees')
      .set('Authorization', 'Bearer owner_token');
    assert.strictEqual(resOwner.status, 403, 'Owner must be forbidden (403)');

    // Authorized Admin
    const resAdmin = await request(app)
      .get('/api/admin/fees')
      .set('Authorization', 'Bearer super_admin_token');
    assert.strictEqual(resAdmin.status, 200, 'Admin request must be 200');
    assert.strictEqual(resAdmin.body.status, 'ok');
    assert.ok(resAdmin.body.fees.platformFee, 'Must return platformFee configuration');
    assert.ok(resAdmin.body.fees.operatingModelMatrix, 'Must return operatingModelMatrix');
    assert.strictEqual(resAdmin.body.fees.portfolioTiersStatus.status, 'INACTIVE_UNAPPROVED');
  });

  await t.test('7. Mutation Guard: READ_ONLY_ADMIN and AUDITOR cannot mutate fees', async () => {
    // READ_ONLY_ADMIN attempting PATCH /api/admin/fees/platform
    const resRO = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer read_only_admin_token')
      .send({ rate: 0.025 });
    assert.strictEqual(resRO.status, 403, 'READ_ONLY_ADMIN must receive 403');
    assert.ok(resRO.body.error.includes('Read-only administrator cannot perform mutations'));

    // AUDITOR attempting POST /api/admin/settings
    const resAuditor = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', 'Bearer auditor_token')
      .send({ platformFeeRate: 0.025 });
    assert.strictEqual(resAuditor.status, 403, 'AUDITOR must receive 403 on settings mutation');
    assert.ok(resAuditor.body.error.includes('Read-only administrator cannot perform mutations'));
  });

  await t.test('8. Rate Validation: Negative, excessive, non-numeric, and over-precision rates are rejected', async () => {
    // Negative rate
    const resNeg = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rate: -0.01 });
    assert.strictEqual(resNeg.status, 400);
    assert.ok(resNeg.body.error.includes('negative'));

    // Rate > 0.50 (50%)
    const resOver = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rate: 0.60 });
    assert.strictEqual(resOver.status, 400);
    assert.ok(resOver.body.error.includes('exceed 50%'));

    // Rate > 4 decimal places
    const resPrecision = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rate: 0.02555 });
    assert.strictEqual(resPrecision.status, 400);
    assert.ok(resPrecision.body.error.includes('precision'));

    // Non-numeric rate
    const resString = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer finance_admin_token')
      .send({ rate: 'not_a_number' });
    assert.strictEqual(resString.status, 400);

    // Empty / missing rate
    const resEmpty = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer finance_admin_token')
      .send({});
    assert.strictEqual(resEmpty.status, 400);
  });

  await t.test('9. Authorized Rate Mutation: Persists to DB, updates effectiveFrom, and writes audit log', async () => {
    // Read current rate before mutation
    const initialRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');

    const testRate = 0.035; // 3.5%
    const resMutate = await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer super_admin_token')
      .send({ rate: testRate });

    assert.strictEqual(resMutate.status, 200);
    assert.strictEqual(resMutate.body.status, 'ok');
    assert.strictEqual(resMutate.body.platformFee.rate, testRate);
    assert.ok(resMutate.body.platformFee.effectiveFrom, 'Must record effectiveFrom timestamp');

    // Verify DB persistence
    const persistedRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
    assert.strictEqual(persistedRate, testRate, 'DB policy value must match mutated rate');

    // Verify audit log entry
    const [recentAudit] = await db.select()
      .from(auditLogs)
      .where(and(
        eq(auditLogs.action, 'PLATFORM_FEE_RATE_UPDATED'),
        eq(auditLogs.resourceId, 'PLATFORM_FEE_RATE')
      ))
      .orderBy(desc(auditLogs.timestamp))
      .limit(1);

    assert.ok(recentAudit, 'Audit log entry must be created');
    assert.strictEqual((recentAudit.changes as any)?.newRate, testRate);
    assert.strictEqual((recentAudit.changes as any)?.oldRate, initialRate);

    // Restore to initialRate for clean test state
    await request(app)
      .patch('/api/admin/fees/platform')
      .set('Authorization', 'Bearer super_admin_token')
      .send({ rate: initialRate });
  });

  // =========================================================================
  // SECTION 3: Property-Level Fee Authorization & Invariants
  // =========================================================================

  await t.test('10. Property-level fee validation enforces operating-model applicability in updateProperty', async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const ownerUserId = `usr_owner_fees_${runId}`;
    const agentUserId = `usr_agent_fees_${runId}`;
    const propertyId = `prop_fees_${runId}`;

    // Seed test users & property
    await db.insert(users).values([
      { id: ownerUserId, firstName: 'Owner', lastName: 'Fees', email: `${ownerUserId}@test.com`, phone: `+96477000${runId.slice(0, 4)}`, roles: ['PROPERTY_OWNER'] },
      { id: agentUserId, firstName: 'Agent', lastName: 'Fees', email: `${agentUserId}@test.com`, phone: `+96477001${runId.slice(0, 4)}`, roles: ['AGENT_BROKER'] },
    ]);

    // Create property with AGENT_OPERATED model
    await db.insert(properties).values({
      id: propertyId,
      name: 'Agent Operated Property',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      operatingModel: 'AGENT_OPERATED',
      rentFee: null,
      managementFee: null,
      status: 'AVAILABLE',
      currency: 'IQD',
    });

    await db.insert(ownershipRecords).values({
      propertyId,
      ownerId: ownerUserId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    // 1. Attempt setting rentFee on AGENT_OPERATED property -> Must throw
    await assert.rejects(
      async () => {
        await ownerRepository.updateProperty(
          { id: ownerUserId, roles: ['PROPERTY_OWNER'] },
          propertyId,
          { rentFee: 0.05 }
        );
      },
      (err: Error) => err.message.includes('Rent fee does not apply to AGENT_OPERATED operating model'),
      'Must reject rentFee on AGENT_OPERATED property'
    );

    // 2. Attempt setting managementFee on AGENT_OPERATED property -> Must throw
    await assert.rejects(
      async () => {
        await ownerRepository.updateProperty(
          { id: ownerUserId, roles: ['PROPERTY_OWNER'] },
          propertyId,
          { managementFee: 0.05 }
        );
      },
      (err: Error) => err.message.includes('Management fee does not apply to AGENT_OPERATED operating model'),
      'Must reject managementFee on AGENT_OPERATED property'
    );

    // 3. Unauthorized Agent (without property permission) cannot edit property
    await assert.rejects(
      async () => {
        await ownerRepository.updateProperty(
          { id: agentUserId, roles: ['AGENT_BROKER'] },
          propertyId,
          { name: 'Tampered Property Name' }
        );
      },
      (err: Error) => err.message.includes('AUTHORITY_REQUIRED'),
      'Unauthorized agent cannot edit property'
    );

    // Clean up
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
    await db.delete(properties).where(eq(properties.id, propertyId));
    await db.delete(users).where(eq(users.id, ownerUserId));
    await db.delete(users).where(eq(users.id, agentUserId));
  });

  // =========================================================================
  // SECTION 4: Effective-Time Preservation & Historical Invariant
  // =========================================================================

  await t.test('11. Historical posted fee records are not silently recalculated when global rate changes', async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const ownerId = `usr_hist_o_${runId}`;
    const tenantId = `usr_hist_t_${runId}`;
    const propId = `prop_hist_${runId}`;
    const leaseId = `lease_hist_${runId}`;
    const schedId = `sched_hist_${runId}`;
    const paymentId = `pay_hist_${runId}`;
    const commissionId = `comm_hist_${runId}`;
    const jeId = `je_hist_${runId}`;

    await db.insert(users).values([
      { id: ownerId, firstName: 'Hist', lastName: 'Owner', email: `${ownerId}@test.com`, phone: `+96477010${runId.slice(0, 4)}`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, firstName: 'Hist', lastName: 'Tenant', email: `${tenantId}@test.com`, phone: `+96477011${runId.slice(0, 4)}`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId,
      name: 'Historical Rate Test Property',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',
      managementFee: '0.06',
      status: 'AVAILABLE',
      currency: 'IQD',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
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

    await db.insert(rentSchedules).values({
      id: schedId,
      leaseId,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      paidAmount: '1000000',
      dueDate: '2026-02-01',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      status: 'PAID',
      currency: 'IQD',
    });

    await db.insert(paymentRecords).values({
      id: paymentId,
      propertyId: propId,
      leaseId,
      rentScheduleId: schedId,
      payerId: tenantId,
      amount: '1000000',
      status: 'CONFIRMED',
      paymentMethod: 'CASH',
      recordedDate: '2026-02-01',
      currency: 'IQD',
    });

    // Seed journal entry first
    await db.insert(journalEntries).values({
      id: jeId,
      propertyId: propId,
      date: '2026-02-01',
      description: 'Historical Rent Collection',
      referenceId: paymentId,
      status: 'POSTED',
    });

    // Post commission referencing journal entry under historical rate 0.03 (3%)
    await db.insert(commissions).values({
      id: commissionId,
      paymentRecordId: paymentId,
      propertyId: propId,
      tenantId,
      ownerId,
      commissionType: 'RENTAL',
      baseAmount: '1000000',
      commissionAmount: '130000', // 30k platform + 40k rent + 60k mgmt
      rate: '0.03',               // Historical rate recorded on commission
      status: 'POSTED',
      journalEntryId: jeId,
    });

    await db.insert(ledgerLines).values([
      { id: `ll_1_${runId}`, journalEntryId: jeId, accountId: '1010', debit: '1000000', credit: '0' },
      { id: `ll_2_${runId}`, journalEntryId: jeId, accountId: '4010', debit: '0', credit: '30000' }, // Platform Fee
      { id: `ll_3_${runId}`, journalEntryId: jeId, accountId: '4011', debit: '0', credit: '40000' }, // Rent Fee
      { id: `ll_4_${runId}`, journalEntryId: jeId, accountId: '4012', debit: '0', credit: '60000' }, // Mgmt Fee
      { id: `ll_5_${runId}`, journalEntryId: jeId, accountId: '2010', debit: '0', credit: '870000' }, // Owner Net
    ]);

    // Now mutate global platform fee to 0.05 (5%) in database policy
    await db.insert(financialPolicies).values({
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.05',
      active: true,
      description: 'Test Mutation Rate',
    }).onConflictDoUpdate({
      target: financialPolicies.policyType,
      set: { policyValue: '0.05', updatedAt: new Date() },
    });

    // Query authoritative financial summary for the historical property period
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(propId, schedId);

    // INVARIANT: Historical summary MUST respect historical rate (3%), NOT active policy rate (5%)
    assert.strictEqual(summary.platformFeeRate, 0.03, 'Summary must respect historical platform fee rate');
    assert.strictEqual(summary.platformFeeAmount, 30_000, 'Historical platform fee amount must remain 30,000 IQD');
    assert.strictEqual(summary.rentFeeAmount, 40_000, 'Historical rent fee amount must remain 40,000 IQD');
    assert.strictEqual(summary.managementFeeAmount, 60_000, 'Historical management fee amount must remain 60,000 IQD');
    assert.strictEqual(summary.totalFeeAmount, 130_000, 'Historical total fees must remain 130,000 IQD');
    assert.strictEqual(summary.ownerNetAmount, 870_000, 'Historical owner net must remain 870,000 IQD');

    // Clean up
    await db.update(financialPolicies).set({ policyValue: '0.03', updatedAt: new Date() }).where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
    await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, jeId));
    await db.delete(commissions).where(eq(commissions.id, commissionId));
    await db.delete(journalEntries).where(eq(journalEntries.id, jeId));
    await db.delete(paymentRecords).where(eq(paymentRecords.id, paymentId));
    await db.delete(rentSchedules).where(eq(rentSchedules.id, schedId));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
    await db.delete(leases).where(eq(leases.id, leaseId));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
    await db.delete(properties).where(eq(properties.id, propId));
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, tenantId));
  });

  // =========================================================================
  // SECTION 5: Financial Safety & Payment Reversal Reconciliation
  // =========================================================================

  await t.test('12. Financial safety: Unpaid, pending, and failed payments are excluded from fee calculation', async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const propId = `prop_safety_${runId}`;
    const ownerId = `usr_saf_o_${runId}`;
    const tenantId = `usr_saf_t_${runId}`;
    const leaseId = `lease_saf_${runId}`;
    const schedId = `sched_saf_${runId}`;

    await db.insert(users).values([
      { id: ownerId, firstName: 'Saf', lastName: 'Owner', email: `${ownerId}@test.com`, phone: `+96477020${runId.slice(0, 4)}`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, firstName: 'Saf', lastName: 'Tenant', email: `${tenantId}@test.com`, phone: `+96477021${runId.slice(0, 4)}`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId,
      name: 'Financial Safety Property',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05',
      managementFee: '0.05',
      status: 'AVAILABLE',
      currency: 'IQD',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
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

    await db.insert(rentSchedules).values({
      id: schedId,
      leaseId,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      paidAmount: '0',
      dueDate: '2026-03-01',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      status: 'UPCOMING',
      currency: 'IQD',
    });

    // 1. Insert PENDING payment record
    const payPendingId = `pay_pend_${runId}`;
    await db.insert(paymentRecords).values({
      id: payPendingId,
      propertyId: propId,
      leaseId,
      rentScheduleId: schedId,
      payerId: tenantId,
      amount: '500000',
      status: 'PENDING',
      paymentMethod: 'FIB',
      recordedDate: '2026-03-01',
      currency: 'IQD',
    });

    // 2. Insert FAILED payment record
    const payFailedId = `pay_fail_${runId}`;
    await db.insert(paymentRecords).values({
      id: payFailedId,
      propertyId: propId,
      leaseId,
      rentScheduleId: schedId,
      payerId: tenantId,
      amount: '500000',
      status: 'FAILED',
      paymentMethod: 'FASTPAY',
      recordedDate: '2026-03-01',
      currency: 'IQD',
    });

    // Fetch authoritative financial summary
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(propId, schedId);

    // INVARIANT: Confirmed collected rent must be 0; no fees calculated on pending/failed
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'Unconfirmed payments must yield 0 confirmed collected rent');
    assert.strictEqual(summary.platformFeeAmount, 0, 'Zero fees on unconfirmed collections');
    assert.strictEqual(summary.rentFeeAmount, 0);
    assert.strictEqual(summary.managementFeeAmount, 0);
    assert.strictEqual(summary.totalFeeAmount, 0);
    assert.strictEqual(summary.ownerNetAmount, 0);

    // Clean up
    await db.delete(paymentRecords).where(eq(paymentRecords.propertyId, propId));
    await db.delete(rentSchedules).where(eq(rentSchedules.id, schedId));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
    await db.delete(leases).where(eq(leases.id, leaseId));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
    await db.delete(properties).where(eq(properties.id, propId));
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, tenantId));
  });

  await t.test('13. Payment reversal reconciliation: Reversed payments correctly exclude fees and net owner amounts', async () => {
    const runId = Math.random().toString(36).substring(2, 7);
    const propId = `prop_rev_${runId}`;
    const ownerId = `usr_rev_o_${runId}`;
    const tenantId = `usr_rev_t_${runId}`;
    const leaseId = `lease_rev_${runId}`;
    const schedId = `sched_rev_${runId}`;
    const payId = `pay_rev_${runId}`;

    await db.insert(users).values([
      { id: ownerId, firstName: 'Rev', lastName: 'Owner', email: `${ownerId}@test.com`, phone: `+96477030${runId.slice(0, 4)}`, roles: ['PROPERTY_OWNER'] },
      { id: tenantId, firstName: 'Rev', lastName: 'Tenant', email: `${tenantId}@test.com`, phone: `+96477031${runId.slice(0, 4)}`, roles: ['TENANT'] },
    ]);

    await db.insert(properties).values({
      id: propId,
      name: 'Reversal Reconciliation Property',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.04',
      managementFee: '0.06',
      status: 'AVAILABLE',
      currency: 'IQD',
    });

    await db.insert(ownershipRecords).values({
      propertyId: propId,
      ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });

    await db.insert(leases).values({
      id: leaseId,
      propertyId: propId,
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

    await db.insert(rentSchedules).values({
      id: schedId,
      leaseId,
      propertyId: propId,
      tenantId,
      amount: '1000000',
      paidAmount: '0',
      dueDate: '2026-04-01',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      status: 'UPCOMING',
      currency: 'IQD',
    });

    // 1. Initially payment is REVERSED
    await db.insert(paymentRecords).values({
      id: payId,
      propertyId: propId,
      leaseId,
      rentScheduleId: schedId,
      payerId: tenantId,
      amount: '1000000',
      status: 'REVERSED',
      paymentMethod: 'BANK_TRANSFER',
      recordedDate: '2026-04-01',
      currency: 'IQD',
    });

    // Authoritative financial summary must exclude REVERSED payments
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(propId, schedId);
    assert.strictEqual(summary.confirmedCollectedRent, 0, 'REVERSED payment must not count as collected rent');
    assert.strictEqual(summary.totalFeeAmount, 0, 'No fees retained on reversed payment');
    assert.strictEqual(summary.ownerNetAmount, 0);

    // Clean up
    await db.delete(paymentRecords).where(eq(paymentRecords.id, payId));
    await db.delete(rentSchedules).where(eq(rentSchedules.id, schedId));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
    await db.delete(leases).where(eq(leases.id, leaseId));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId));
    await db.delete(properties).where(eq(properties.id, propId));
    await db.delete(users).where(eq(users.id, ownerId));
    await db.delete(users).where(eq(users.id, tenantId));
  });

});
