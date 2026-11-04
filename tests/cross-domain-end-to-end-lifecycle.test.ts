import test from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import express from 'express';
import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  properties,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  ownershipRecords,
  managementAgreements,
  listings,
  vendorProfiles,
  maintenanceRequests,
  workOrders,
  vendorReviews,
  propertyReviews,
  commissions,
  journalEntries,
  ledgerLines,
  auditLogs,
  financialPolicies,
} from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { CommissionService, commissionService } from '../src/server/services/commission.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { reviewRepository } from '../src/server/repositories/reviews.js';
import { financeService } from '../src/server/services/finance.js';
import adminRouter from '../src/server/routes/admin.js';
import financialsRouter from '../src/server/routes/financials.js';
import reviewsRouter from '../src/server/routes/reviews.js';
import leasesRouter from '../src/server/routes/leases.js';
import { vendorRouter } from '../src/server/routes/vendor.js';

process.env.SQL_HOST = 'localhost';
process.env.SQL_DB_NAME = 'homehub_test';

const TARGET_TEST_DATABASE = 'homehub_test';

test('Cross-Domain End-to-End Complete Lifecycle Test Suite', async (t) => {
  // --- SAFETY GATE ---
  const connCheck = await (db as any).execute('SELECT current_database() as db_name');
  const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
  assert.strictEqual(
    activeDb,
    TARGET_TEST_DATABASE,
    `SAFETY GATE: Test must execute on '${TARGET_TEST_DATABASE}'. Found: '${activeDb}'`
  );

  const runId = `cde2e_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  // Test Actor IDs
  const ownerId = `usr_owner_${runId}`;
  const managerId = `usr_manager_${runId}`;
  const tenantId = `usr_tenant_${runId}`;
  const vendorUserId = `usr_vendor_${runId}`;
  const adversaryId = `usr_adversary_${runId}`;
  const adminId = `usr_admin_${runId}`;
  const accountantId = `usr_acct_${runId}`;
  const companyOrgId = `org_mgmt_${runId}`;

  // Created IDs tracker for clean deterministic teardown
  const createdUserIds: string[] = [ownerId, managerId, tenantId, vendorUserId, adversaryId, adminId, accountantId];
  let propertyId: string = '';
  let listingId: string = '';
  let leaseId: string = '';
  let scheduleId: string = '';
  let paymentId: string = '';
  let vendorProfileId: string = '';
  let maintenanceRequestId: string = '';
  let workOrderId: string = '';
  let vendorReviewId: string = '';
  let propertyReviewId: string = '';

  // Setup express test app with authentication simulation including activeRole
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      if (token === 'admin_token') {
        (req as any).user = { id: adminId, roles: ['PLATFORM_ADMIN', 'ADMIN'], activeRole: 'PLATFORM_ADMIN', email: `${adminId}@homehub.iq` };
      } else if (token === 'accountant_token') {
        (req as any).user = { id: accountantId, roles: ['ACCOUNTANT', 'FINANCE_ADMIN'], activeRole: 'ACCOUNTANT', email: `${accountantId}@homehub.iq` };
      } else if (token === 'owner_token') {
        (req as any).user = { id: ownerId, roles: ['PROPERTY_OWNER'], activeRole: 'PROPERTY_OWNER', email: `${ownerId}@homehub.iq` };
      } else if (token === 'manager_token') {
        (req as any).user = { id: managerId, roles: ['COMPANY_ADMIN', 'AGENT', 'PROPERTY_MANAGER'], activeRole: 'COMPANY_ADMIN', organizationId: companyOrgId, email: `${managerId}@homehub.iq` };
      } else if (token === 'tenant_token') {
        (req as any).user = { id: tenantId, roles: ['TENANT'], activeRole: 'TENANT', email: `${tenantId}@homehub.iq` };
      } else if (token === 'vendor_token') {
        (req as any).user = { id: vendorUserId, roles: ['VENDOR'], activeRole: 'VENDOR', email: `${vendorUserId}@homehub.iq` };
      } else if (token === 'adversary_token') {
        (req as any).user = { id: adversaryId, roles: ['TENANT'], activeRole: 'TENANT', email: `${adversaryId}@homehub.iq` };
      }
    }
    next();
  });

  app.use('/api/admin', adminRouter);
  app.use('/api/financials', financialsRouter);
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/leases', leasesRouter);
  app.use('/api/vendor', vendorRouter);

  // Setup initial actors in database
  await db.insert(users).values([
    { id: ownerId, firstName: 'Karwan', lastName: 'Owner', email: `${ownerId}@homehub.iq`, roles: ['PROPERTY_OWNER'] },
    { id: managerId, firstName: 'Aram', lastName: 'Manager', email: `${managerId}@homehub.iq`, roles: ['COMPANY_ADMIN', 'AGENT', 'PROPERTY_MANAGER'] },
    { id: tenantId, firstName: 'Soran', lastName: 'Tenant', email: `${tenantId}@homehub.iq`, roles: ['TENANT'] },
    { id: vendorUserId, firstName: 'Rebaz', lastName: 'Vendor', email: `${vendorUserId}@homehub.iq`, roles: ['VENDOR'] },
    { id: adversaryId, firstName: 'Dana', lastName: 'Adversary', email: `${adversaryId}@homehub.iq`, roles: ['TENANT'] },
    { id: adminId, firstName: 'Danar', lastName: 'Admin', email: `${adminId}@homehub.iq`, roles: ['PLATFORM_ADMIN', 'ADMIN'] },
    { id: accountantId, firstName: 'Sara', lastName: 'Accountant', email: `${accountantId}@homehub.iq`, roles: ['ACCOUNTANT', 'FINANCE_ADMIN'] },
  ]);

  // Setup Management Company & Member
  await db.insert(organizations).values({
    id: companyOrgId,
    name: `Erbil Premier Properties ${runId}`,
    type: 'MANAGEMENT_COMPANY',
    status: 'VERIFIED',
    verified: true,
  });

  await db.insert(organizationMembers).values({
    id: `mem_${runId}`,
    organizationId: companyOrgId,
    userId: managerId,
    role: 'COMPANY_ADMIN',
    status: 'ACTIVE',
  });

  // Setup Vendor Profile
  const [vProf] = await db.insert(vendorProfiles).values({
    userId: vendorUserId,
    businessName: `Rebaz Technical Services ${runId}`,
    categories: ['ELECTRICAL', 'HVAC'],
    specialties: ['CIRCUIT_BREAKERS', 'AC_INSTALLATION'],
    serviceAreas: ['Erbil'],
    status: 'ACTIVE',
    verificationStatus: 'APPROVED',
    rating: '5.00',
    reviewCount: 0,
    hourlyRate: '35.00',
    currency: 'USD',
  }).returning();
  vendorProfileId = vProf.id;

  // Resolve current active platform fee rate from DB
  let currentPlatformFeeRate = 0.05;
  try {
    const [policy] = await db.select().from(financialPolicies)
      .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
      .limit(1);
    if (policy) currentPlatformFeeRate = parseFloat(policy.policyValue) || 0.05;
  } catch (e) {
    // fallback
  }

  // ===========================================================================
  // STAGE 1: Property Creation & Verified Ownership
  // ===========================================================================
  await t.test('1. Property Creation & Verified Ownership Record', async () => {
    const [prop] = await db.insert(properties).values({
      name: `Empire World Panorama ${runId}`,
      type: 'RESIDENTIAL_APARTMENT',
      address: { street: '100m Road', city: 'Erbil', country: 'Iraq' },
      operatingModel: 'FULLY_MANAGED',
      status: 'AVAILABLE',
      rentFee: '0.0300', // 3% Rent Fee
      managementFee: '0.0700', // 7% Management Fee
      currency: 'USD',
    }).returning();
    propertyId = prop.id;

    assert.ok(propertyId, 'Property should be created with a valid UUID');
    assert.strictEqual(prop.operatingModel, 'FULLY_MANAGED');
    assert.strictEqual(prop.rentFee, '0.0300');
    assert.strictEqual(prop.managementFee, '0.0700');

    // Rule 2: ownership_records alone defines ownership
    await db.insert(ownershipRecords).values({
      propertyId: propertyId,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      isPrimary: true,
      status: 'VERIFIED',
    });

    // Grant management authority to company
    await db.insert(managementAgreements).values({
      propertyId: propertyId,
      companyId: companyOrgId,
      ownerId: ownerId,
      status: 'ACTIVE',
      startDate: '2026-01-01',
      grantedPermissions: ['VIEW_PROPERTY', 'MANAGE_LEASES', 'COLLECT_RENT', 'MANAGE_FINANCIALS', 'EDIT_PROPERTY'],
    });

    const [verifiedOwn] = await db.select().from(ownershipRecords)
      .where(and(eq(ownershipRecords.propertyId, propertyId), eq(ownershipRecords.ownerId, ownerId)));
    assert.strictEqual(verifiedOwn.status, 'VERIFIED', 'Ownership record must be verified');
  });

  // ===========================================================================
  // STAGE 2: Rental Listing Publication
  // ===========================================================================
  await t.test('2. Rental Listing Publication in Marketplace', async () => {
    const [listing] = await db.insert(listings).values({
      propertyId: propertyId,
      publisherUserId: managerId,
      publisherCompanyId: companyOrgId,
      type: 'FOR_RENT',
      price: '1500.00',
      currency: 'USD',
      status: 'PUBLISHED',
      title: `Luxury Residence Erbil ${runId}`,
      description: 'Stunning 3-bedroom apartment with panoramic view.',
    }).returning();
    listingId = listing.id;

    assert.ok(listingId, 'Listing should be published');
    assert.strictEqual(listing.status, 'PUBLISHED');
    assert.strictEqual(listing.type, 'FOR_RENT');
  });

  // ===========================================================================
  // STAGE 3: Lease Activation & Tenant Association
  // ===========================================================================
  await t.test('3. Lease Activation & Tenant Association', async () => {
    const [lease] = await db.insert(leases).values({
      propertyId: propertyId,
      status: 'ACTIVE',
      rentAmount: '1500.00',
      depositAmount: '1500.00',
      currency: 'USD',
      startDate: '2026-11-01',
      endDate: '2027-10-31',
    }).returning();
    leaseId = lease.id;

    await db.insert(leaseTenants).values({
      leaseId: leaseId,
      tenantId: tenantId,
      isPrimary: true,
    });

    // Property transitions to OCCUPIED
    await db.update(properties).set({ status: 'OCCUPIED' }).where(eq(properties.id, propertyId));

    const [updatedProp] = await db.select().from(properties).where(eq(properties.id, propertyId));
    assert.strictEqual(updatedProp.status, 'OCCUPIED');
  });

  // ===========================================================================
  // STAGE 4: Rent Schedule & Payment Submission (RECORDED / Unconfirmed)
  // ===========================================================================
  await t.test('4. Rent Schedule Generation & Unconfirmed Payment Invariant', async () => {
    const [sched] = await db.insert(rentSchedules).values({
      leaseId: leaseId,
      propertyId: propertyId,
      tenantId: tenantId,
      amount: '1500.00',
      paidAmount: '0.00',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'UPCOMING',
      currency: 'USD',
    }).returning();
    scheduleId = sched.id;

    const [payment] = await db.insert(paymentRecords).values({
      leaseId: leaseId,
      propertyId: propertyId,
      rentScheduleId: scheduleId,
      payerId: tenantId,
      amount: '1500.00',
      currency: 'USD',
      category: 'RENT',
      status: 'RECORDED',
      recordedDate: '2026-11-01',
      paymentMethod: 'FIB',
      referenceNumber: `FIB-REF-${runId}`,
    }).returning();
    paymentId = payment.id;

    // Invariant: Unconfirmed payment does NOT increment schedule paidAmount
    const [freshSched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(freshSched.paidAmount, '0.00', 'Unconfirmed payment must not mark rent schedule as paid');
    assert.strictEqual(freshSched.status, 'UPCOMING');
  });

  // ===========================================================================
  // STAGE 5: Authorized Payment Confirmation & Dynamic 3-Fee Allocation
  // ===========================================================================
  await t.test('5. Authorized Payment Confirmation & 3-Fee Ledger Posting', async () => {
    // Confirm payment via leaseRepository
    const confirmed = await leaseRepository.confirmPayment(paymentId, managerId, {
      referenceNumber: `FIB-CONFIRMED-${runId}`,
    });
    assert.strictEqual(confirmed.status, 'CONFIRMED');

    // Post the 3-fee commission
    const commissionResult = await commissionService.postCommissionForPayment(
      paymentId,
      managerId,
      'AGENT'
    );

    assert.ok(commissionResult.commission, 'Commission record should be created');
    const comm = commissionResult.commission;
    assert.strictEqual(comm.status, 'POSTED');

    // Dynamic 3-Fee calculation
    const expectedPlatform = Math.round(1500 * currentPlatformFeeRate * 100) / 100;
    const expectedRent = 45; // 1500 * 0.03
    const expectedMgmt = 105; // 1500 * 0.07
    const expectedTotal = expectedPlatform + expectedRent + expectedMgmt;

    assert.strictEqual(Number(comm.commissionAmount), expectedTotal);

    // Verify ledger lines (Account 4010, 4011, 4012)
    assert.ok(comm.journalEntryId, 'Journal entry ID must be present');
    const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, comm.journalEntryId));
    
    const line4010 = lines.find((l) => l.accountId === '4010');
    const line4011 = lines.find((l) => l.accountId === '4011');
    const line4012 = lines.find((l) => l.accountId === '4012');

    assert.ok(line4010, 'Platform Fee ledger line (4010) must exist');
    assert.strictEqual(Number(line4010.credit), expectedPlatform);
    assert.ok(line4011, 'Rent Fee ledger line (4011) must exist');
    assert.strictEqual(Number(line4011.credit), expectedRent);
    assert.ok(line4012, 'Management Fee ledger line (4012) must exist');
    assert.strictEqual(Number(line4012.credit), expectedMgmt);

    // Rent schedule should now transition to PAID with 1500 paidAmount
    const [paidSched] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
    assert.strictEqual(Number(paidSched.paidAmount), 1500);
    assert.strictEqual(paidSched.status, 'PAID');
  });

  // ===========================================================================
  // STAGE 6: Accountant Fee & Settlement Audit Reconciliation
  // ===========================================================================
  await t.test('6. Accountant Fee & Settlement Audit Reconciliation', async () => {
    const res = await request(app)
      .get('/api/financials/fee-audit')
      .set('Authorization', 'Bearer accountant_token');

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.items), 'Items should be an array');

    const paymentAudit = res.body.items.find((r: any) => r.id === paymentId);
    assert.ok(paymentAudit, 'Payment should appear in Accountant Fee Audit items');

    assert.strictEqual(paymentAudit.operatingModel, 'FULLY_MANAGED');
    assert.strictEqual(paymentAudit.status, 'CONFIRMED');
    assert.strictEqual(Number(paymentAudit.collectedRent), 1500);

    const expectedPlatform = Math.round(1500 * currentPlatformFeeRate * 100) / 100;
    const expectedRent = 45;
    const expectedMgmt = 105;
    const expectedTotal = expectedPlatform + expectedRent + expectedMgmt;

    assert.strictEqual(Number(paymentAudit.platformFeeAmount), expectedPlatform);
    assert.strictEqual(Number(paymentAudit.rentFeeAmount), expectedRent);
    assert.strictEqual(Number(paymentAudit.managementFeeAmount), expectedMgmt);
    assert.strictEqual(Number(paymentAudit.totalDeductions), expectedTotal);
    assert.strictEqual(Number(paymentAudit.ownerNetAmount), 1500 - expectedTotal);
  });

  // ===========================================================================
  // STAGE 7: Maintenance Request & Work Order Completion
  // ===========================================================================
  await t.test('7. Maintenance Request & Work Order Completion', async () => {
    const [mReq] = await db.insert(maintenanceRequests).values({
      propertyId: propertyId,
      reporterUserId: tenantId,
      category: 'ELECTRICAL',
      title: 'Circuit breaker tripping on AC load',
      description: 'Breaker flips whenever high AC load is initialized.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
    }).returning();
    maintenanceRequestId = mReq.id;

    const [wo] = await db.insert(workOrders).values({
      maintenanceRequestId: maintenanceRequestId,
      propertyId: propertyId,
      vendorId: vendorProfileId,
      vendorUserId: vendorUserId,
      status: 'IN_PROGRESS',
      title: 'Replace breaker with 32A certified unit',
      description: 'Installed new certified Schneider breaker.',
    }).returning();
    workOrderId = wo.id;

    // Transition work order to COMPLETED
    await db.update(workOrders).set({ status: 'COMPLETED' }).where(eq(workOrders.id, workOrderId));
    await db.update(maintenanceRequests).set({ status: 'COMPLETED' }).where(eq(maintenanceRequests.id, maintenanceRequestId));

    const [completedWo] = await db.select().from(workOrders).where(eq(workOrders.id, workOrderId));
    assert.strictEqual(completedWo.status, 'COMPLETED');
  });

  // ===========================================================================
  // STAGE 8: Vendor Review Submission & Response
  // ===========================================================================
  await t.test('8. Vendor Review Qualification, Submission & Official Response', async () => {
    // 8.1 Unqualified user attempt (adversary without lease or work order association)
    const unqualifiedRes = await request(app)
      .post('/api/reviews/vendors')
      .set('Authorization', 'Bearer adversary_token')
      .send({
        workOrderId: workOrderId,
        rating: 5,
        comment: 'Unqualified review attempt should be rejected.',
      });
    assert.strictEqual(unqualifiedRes.status, 403, 'Unqualified user must be rejected with 403');
    assert.strictEqual(unqualifiedRes.body.code, 'NOT_QUALIFIED_TO_REVIEW');

    // 8.2 Authorized requesting tenant submits 5-star vendor review
    const validRes = await request(app)
      .post('/api/reviews/vendors')
      .set('Authorization', 'Bearer tenant_token')
      .send({
        workOrderId: workOrderId,
        rating: 5,
        comment: 'Rebaz was extremely prompt, polite, and installed certified parts in 30 minutes.',
      });
    assert.strictEqual(validRes.status, 201);
    vendorReviewId = validRes.body.id;
    assert.strictEqual(validRes.body.rating, 5);

    // 8.3 Anti-stuffing uniqueness: Repeated review attempt on same work order rejected
    const duplicateRes = await request(app)
      .post('/api/reviews/vendors')
      .set('Authorization', 'Bearer tenant_token')
      .send({
        workOrderId: workOrderId,
        rating: 5,
        comment: 'Duplicate review should be blocked.',
      });
    assert.strictEqual(duplicateRes.status, 409);
    assert.strictEqual(duplicateRes.body.code, 'REVIEW_ALREADY_EXISTS');

    // 8.4 Vendor posts official response via /api/vendor/reviews/:id/respond
    const respondRes = await request(app)
      .post(`/api/vendor/reviews/${vendorReviewId}/respond`)
      .set('Authorization', 'Bearer vendor_token')
      .send({
        response: 'Thank you Soran! Always happy to keep your home safe and comfortable.',
      });
    assert.strictEqual(respondRes.status, 200);
    assert.ok(respondRes.body.vendorResponse);
  });

  // ===========================================================================
  // STAGE 9: Tenant Property Review & Admin Moderation
  // ===========================================================================
  await t.test('9. Tenant Property Review, Public Aggregates & Moderation', async () => {
    // 9.1 Tenant submits property review
    const reviewRes = await request(app)
      .post('/api/reviews/properties')
      .set('Authorization', 'Bearer tenant_token')
      .send({
        propertyId: propertyId,
        rating: 5,
        cleanlinessRating: 5,
        maintenanceRating: 5,
        communicationRating: 5,
        locationRating: 5,
        title: 'Superb residence with high standards',
        comment: 'Quiet, clean, responsive property management and great community.',
      });

    assert.strictEqual(reviewRes.status, 201);
    propertyReviewId = reviewRes.body.id;
    assert.strictEqual(reviewRes.body.status, 'PUBLISHED');

    // 9.2 Owner posts verified response via /api/reviews/:id/respond
    const ownerResp = await request(app)
      .post(`/api/reviews/${propertyReviewId}/respond`)
      .set('Authorization', 'Bearer owner_token')
      .send({
        response: 'Thank you Soran, we are delighted to have you as our resident!',
      });
    assert.strictEqual(ownerResp.status, 200);

    // 9.3 Public aggregate computes 5.0 average
    const publicAgg = await request(app).get(`/api/reviews/properties/${propertyId}`);
    assert.strictEqual(publicAgg.status, 200);
    assert.strictEqual(publicAgg.body.aggregate.totalReviews, 1);
    assert.strictEqual(Number(publicAgg.body.aggregate.averageRating), 5.0);

    // 9.4 Moderation: Admin hides review (status -> HIDDEN) via /api/reviews/:id/moderate
    const hideRes = await request(app)
      .patch(`/api/reviews/${propertyReviewId}/moderate`)
      .set('Authorization', 'Bearer admin_token')
      .send({ status: 'HIDDEN', reason: 'Temporary verification audit' });
    assert.strictEqual(hideRes.status, 200);
    assert.strictEqual(hideRes.body.status, 'HIDDEN');

    // 9.5 Aggregate re-computation: HIDDEN review excluded from public average
    const hiddenAgg = await request(app).get(`/api/reviews/properties/${propertyId}`);
    assert.strictEqual(hiddenAgg.body.aggregate.totalReviews, 0);

    // 9.6 Restore review to PUBLISHED
    const restoreRes = await request(app)
      .patch(`/api/reviews/${propertyReviewId}/moderate`)
      .set('Authorization', 'Bearer admin_token')
      .send({ status: 'PUBLISHED' });
    assert.strictEqual(restoreRes.status, 200);
    assert.strictEqual(restoreRes.body.status, 'PUBLISHED');
  });

  // ===========================================================================
  // STAGE 10: Payment Reversal & Ledger Reconciliation
  // ===========================================================================
  await t.test('10. Payment Reversal & Exact Compensating Ledger Entries', async () => {
    // Reverse commission and mark payment as REVERSED
    const revRes = await commissionService.reverseCommissionForPayment(
      paymentId,
      'Bank dispute and ACH return by tenant bank',
      adminId,
      'PLATFORM_ADMIN'
    );

    assert.strictEqual(revRes.alreadyReversed, false);
    assert.ok(revRes.reversalJournalEntryId, 'Reversal journal entry must be created');

    // Verify compensating ledger lines created
    const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revRes.reversalJournalEntryId!));
    assert.strictEqual(revLines.length, 5, 'Must have 5 compensating ledger lines');

    // Update payment record to REVERSED
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, paymentId));

    // Verify that Accountant Fee Audit reflects REVERSED status with zero fees and net rent
    const auditRes = await request(app)
      .get('/api/financials/fee-audit')
      .set('Authorization', 'Bearer accountant_token');
    
    assert.strictEqual(auditRes.status, 200);
    const auditedPayment = auditRes.body.items.find((r: any) => r.id === paymentId);
    assert.ok(auditedPayment, 'Reversed payment must still be listed in audit trail');
    assert.strictEqual(auditedPayment.status, 'REVERSED');
    assert.strictEqual(Number(auditedPayment.collectedRent), 0, 'Reversed payment reports 0 collected rent');
    assert.strictEqual(Number(auditedPayment.totalDeductions), 0, 'Reversed payment reports 0 total fees');
    assert.strictEqual(Number(auditedPayment.ownerNetAmount), 0, 'Reversed payment reports 0 net owner rent');
  });

  // ===========================================================================
  // TEARDOWN: Deterministic Cleanup in Strict Reverse FK Order
  // ===========================================================================
  await t.test('99. Teardown Test Fixtures', async () => {
    try {
      if (vendorReviewId) await db.delete(vendorReviews).where(eq(vendorReviews.id, vendorReviewId));
      if (propertyReviewId) await db.delete(propertyReviews).where(eq(propertyReviews.id, propertyReviewId));
      if (workOrderId) await db.delete(workOrders).where(eq(workOrders.id, workOrderId));
      if (maintenanceRequestId) await db.delete(maintenanceRequests).where(eq(maintenanceRequests.id, maintenanceRequestId));
      
      if (paymentId) {
        const comms = await db.select().from(commissions).where(eq(commissions.paymentRecordId, paymentId));
        const journalIds = comms.map((c) => c.journalEntryId).filter(Boolean) as string[];
        await db.delete(commissions).where(eq(commissions.paymentRecordId, paymentId));
        for (const jId of journalIds) {
          await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, jId));
          await db.delete(journalEntries).where(eq(journalEntries.id, jId));
        }
        await db.delete(paymentRecords).where(eq(paymentRecords.id, paymentId));
      }

      if (scheduleId) await db.delete(rentSchedules).where(eq(rentSchedules.id, scheduleId));
      if (leaseId) {
        await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, leaseId));
        await db.delete(leases).where(eq(leases.id, leaseId));
      }

      if (listingId) await db.delete(listings).where(eq(listings.id, listingId));
      if (propertyId) {
        const pJournals = await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propertyId));
        for (const pj of pJournals) {
          await db.delete(ledgerLines).where(eq(ledgerLines.journalEntryId, pj.id));
          await db.delete(journalEntries).where(eq(journalEntries.id, pj.id));
        }
        await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, propertyId));
        await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propertyId));
        await db.delete(properties).where(eq(properties.id, propertyId));
      }

      if (vendorProfileId) await db.delete(vendorProfiles).where(eq(vendorProfiles.id, vendorProfileId));

      await db.delete(organizationMembers).where(eq(organizationMembers.organizationId, companyOrgId));
      await db.delete(organizations).where(eq(organizations.id, companyOrgId));

      for (const uid of createdUserIds) {
        await db.delete(auditLogs).where(eq(auditLogs.actorUserId, uid));
        await db.delete(users).where(eq(users.id, uid));
      }
    } catch (cleanErr) {
      console.warn('Teardown notice:', cleanErr);
    }
  });
});
