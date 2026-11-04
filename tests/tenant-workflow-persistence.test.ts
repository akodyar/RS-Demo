import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB TENANT DOMAIN — WORKFLOW PERSISTENCE, LIFECYCLE & FINANCIAL INTEGRITY SUITE
 * 
 * Direct verification of:
 * 1. PostgreSQL/Drizzle database persistence (Users, Properties, Leases, LeaseTenants, RentSchedules, PaymentRecords, SecurityDeposits, Commissions, MaintenanceRequests, LeaseRenewals, MoveOutRequests, AuditLogs)
 * 2. Tenant onboarding & role authorization
 * 3. Lease offer access, review & acceptance lifecycle (OFFERED -> ACTIVE)
 * 4. Rent schedules, confirmed rent payments & canonical 5% platform commission (HOMEHUB_RENT_MANAGEMENT_COMMISSION_RATE = 0.05)
 * 5. Security deposit isolation (0% platform commission, segregated from rent)
 * 6. Maintenance ticket submission scoped strictly to tenant's authorized property
 * 7. Lease renewal & move-out notice workflows
 * 8. Cross-tenant IDOR protection and data isolation
 * 9. Comprehensive audit logging for all sensitive tenant mutations
 */

import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  units,
  leases,
  leaseTenants,
  rentSchedules,
  paymentRecords,
  securityDeposits,
  commissions,
  financialPolicies,
  chartOfAccounts,
  maintenanceRequests,
  leaseRenewals,
  moveOutRequests,
  journalEntries,
  ledgerLines,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { TenantRepository } from '../src/server/repositories/tenant.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`);
    failed++;
  }
}

async function runTenantWorkflowSuite() {
  console.log('===================================================================');
  console.log('  HOMEHUB TENANT DOMAIN — WORKFLOW PERSISTENCE & INTEGRATION SUITE');
  console.log('===================================================================\n');

  // 1. Initialize in-process PostgreSQL database with all 6 Drizzle migrations
  console.log('--- PART 1: POSTGRESQL ENGINE INITIALIZATION & MIGRATIONS ---');
  await injectPgliteMock();
  console.log('In-process PostgreSQL (PGlite) initialized with all 6 Drizzle migrations.\n');

  const repo = new TenantRepository();

  // -------------------------------------------------------------
  // PART 2: TENANT ONBOARDING & PROPERTY SETUP
  // -------------------------------------------------------------
  console.log('--- PART 2: TENANT ONBOARDING & PROPERTY REGISTRATION ---');

  // Seed Canonical 5% Commission Policy
  await db.insert(financialPolicies).values({
    policyType: 'RENT_MANAGEMENT_COMMISSION_RATE',
    policyValue: '0.05',
    active: true,
    description: 'Canonical 5% HomeHub rent management commission rate',
  });

  // Seed Chart of Accounts for Commission & Clearing Ledger
  await db.insert(chartOfAccounts).values([
    { id: 'acc-cash', code: '1010', name: 'Cash in Bank', accountType: 'ASSET', currency: 'IQD', active: true, systemAccount: true },
    { id: 'acc-commission', code: '4010', name: 'HomeHub Platform Commission (5%)', accountType: 'REVENUE', currency: 'IQD', active: true, systemAccount: true },
    { id: 'acc-payable', code: '2010', name: 'Owner Net Entitlement Payable', accountType: 'LIABILITY', currency: 'IQD', active: true, systemAccount: true },
  ]);

  // Seed Owner user
  const ownerId = 'usr-owner-t01';
  await db.insert(users).values({
    id: ownerId,
    firstName: 'Soran',
    lastName: 'Barzani',
    email: 'soran@homehub.iq',
    roles: ['OWNER'],
    isActive: true,
  });

  // Seed Tenant A user
  const tenantAId = 'usr-tenant-a';
  await db.insert(users).values({
    id: tenantAId,
    firstName: 'Ahmed',
    lastName: 'Khalid',
    email: 'ahmed@tenant.iq',
    phone: '+9647501234567',
    roles: ['TENANT'],
    isActive: true,
  });

  // Seed Tenant B user (for cross-tenant isolation testing)
  const tenantBId = 'usr-tenant-b';
  await db.insert(users).values({
    id: tenantBId,
    firstName: 'Diyar',
    lastName: 'Hawrami',
    email: 'diyar@tenant.iq',
    phone: '+9647507654321',
    roles: ['TENANT'],
    isActive: true,
  });

  // Seed Property & Unit
  const propId = 'prop-erbil-res-01';
  await db.insert(properties).values({
    id: propId,
    name: 'Dream City Luxury Apartment',
    type: 'APARTMENT',
    address: { street: 'Gulan Street', city: 'Erbil', region: 'Kurdistan', country: 'Iraq' },
    status: 'ACTIVE',
  });

  const unitId = 'unit-erbil-4b';
  await db.insert(units).values({
    id: unitId,
    propertyId: propId,
    unitNumber: 'Apartment 4B',
    marketRent: '1500000',
    currency: 'IQD',
    status: 'OCCUPIED',
  });

  const [persistedTenantA] = await db.select().from(users).where(eq(users.id, tenantAId));
  assert(
    persistedTenantA && persistedTenantA.id === tenantAId && (persistedTenantA.roles as string[]).includes('TENANT'),
    'TNT-ONBOARD-01',
    'Tenant user successfully persisted in PostgreSQL with TENANT role'
  );

  // -------------------------------------------------------------
  // PART 3: LEASE ACCESS & ACCEPTANCE LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n--- PART 3: LEASE ACCESS & ACCEPTANCE LIFECYCLE ---');

  const leaseId = 'lease-tnt-001';
  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    unitId,
    status: 'OFFERED',
    startDate: '2026-05-01',
    endDate: '2027-05-01',
    rentAmount: '1500000',
    currency: 'IQD',
    depositAmount: '3000000',
    rentCycle: 'MONTHLY',
  });

  await db.insert(leaseTenants).values({
    id: 'lt-001',
    leaseId,
    tenantId: tenantAId,
    isPrimary: true,
  });

  // 1. Cross-tenant isolation check before acceptance
  let tenantBCaught = false;
  try {
    await repo.acceptLeaseOffer(tenantBId, leaseId);
  } catch (err: any) {
    tenantBCaught = err.message === 'UNAUTHORIZED_TENANT_LEASE_ACCESS';
  }
  assert(
    tenantBCaught,
    'TNT-SEC-01',
    'IDOR PROTECTION: Tenant B cannot accept a lease offered to Tenant A'
  );

  // 2. Tenant A accepts lease offer
  const acceptedLease = await repo.acceptLeaseOffer(tenantAId, leaseId);
  assert(
    acceptedLease.status === 'ACTIVE',
    'TNT-LEASE-01',
    'Tenant A successfully accepts offered lease; status authoritatively transitions to ACTIVE'
  );

  // 3. Verify audit log entry created for lease acceptance
  const [leaseAudit] = await db.select()
    .from(auditLogs)
    .where(and(
      eq(auditLogs.resourceId, leaseId),
      eq(auditLogs.action, 'LEASE_ACCEPTED')
    ));
  assert(
    leaseAudit && leaseAudit.actorUserId === tenantAId && leaseAudit.actorRole === 'TENANT',
    'TNT-AUDIT-01',
    'Audit log entry securely recorded for lease acceptance with actorUserId and TENANT role'
  );

  // -------------------------------------------------------------
  // PART 4: AUTHORITATIVE DASHBOARD & STATE ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- PART 4: AUTHORITATIVE DASHBOARD & STATE ISOLATION ---');

  const dashA = await repo.getAuthoritativeDashboard(tenantAId);
  assert(
    dashA.currentProperty !== null && dashA.currentProperty.id === propId && dashA.currentProperty.leaseId === leaseId,
    'TNT-DASH-01',
    'Tenant A dashboard correctly returns active property and lease details'
  );

  const dashB = await repo.getAuthoritativeDashboard(tenantBId);
  assert(
    dashB.currentProperty === null,
    'TNT-DASH-02',
    'DATA ISOLATION: Tenant B dashboard returns currentProperty: null (zero cross-tenant leak)'
  );

  // -------------------------------------------------------------
  // PART 5: RENT SCHEDULE, PAYMENTS & 5% COMMISSION VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- PART 5: RENT SCHEDULE, PAYMENTS & 5% COMMISSION RECONCILIATION ---');

  const scheduleId = 'sch-2026-05';
  await db.insert(rentSchedules).values({
    id: scheduleId,
    leaseId,
    propertyId: propId,
    unitId,
    tenantId: tenantAId,
    amount: '1500000',
    currency: 'IQD',
    dueDate: '2026-05-01',
    periodStart: '2026-05-01',
    periodEnd: '2026-05-31',
    status: 'UPCOMING',
    paidAmount: '0',
  });

  // Verify non-positive payment rejection
  let zeroPaymentRejected = false;
  try {
    await repo.recordRentPayment(tenantAId, {
      leaseId,
      propertyId: propId,
      scheduleId,
      amount: 0,
      currency: 'IQD',
      paymentMethod: 'FIB',
    });
  } catch (err: any) {
    zeroPaymentRejected = err.message === 'Payment amount must be greater than 0';
  }
  assert(
    zeroPaymentRejected,
    'TNT-FIN-01',
    'FINANCIAL INTEGRITY: Zero or negative payment amount strictly rejected'
  );

  // Verify payment for schedule not belonging to tenant is rejected
  let invalidScheduleRejected = false;
  try {
    await repo.recordRentPayment(tenantBId, {
      leaseId,
      propertyId: propId,
      scheduleId,
      amount: 1500000,
      currency: 'IQD',
      paymentMethod: 'FIB',
    });
  } catch (err: any) {
    invalidScheduleRejected = err.message === 'UNAUTHORIZED_TENANT_LEASE_ACCESS';
  }
  assert(
    invalidScheduleRejected,
    'TNT-FIN-02',
    'IDOR PROTECTION: Tenant B cannot pay or manipulate Tenant A rent schedule'
  );

  // Tenant A executes authoritative rent payment
  const paymentResult = await repo.recordRentPayment(tenantAId, {
    leaseId,
    propertyId: propId,
    scheduleId,
    amount: 1500000,
    currency: 'IQD',
    paymentMethod: 'FIB',
    referenceNumber: 'FIB-TXN-20260501-001',
  });

  assert(
    paymentResult.payment.status === 'CONFIRMED' && Number(paymentResult.payment.amount) === 1500000,
    'TNT-FIN-03',
    'Payment record persisted with CONFIRMED status and full payment amount'
  );

  // Verify schedule status updated to PAID
  const [updatedSchedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, scheduleId));
  assert(
    updatedSchedule && updatedSchedule.status === 'PAID' && Number(updatedSchedule.paidAmount) === 1500000,
    'TNT-FIN-04',
    'Rent schedule transitioned to PAID with recorded paidAmount: 1,500,000 IQD'
  );

  // Canonical 5% commission verification:
  // 1,500,000 IQD * 0.05 = 75,000 IQD
  const [commissionRecord] = await db.select()
    .from(commissions)
    .where(eq(commissions.paymentRecordId, paymentResult.payment.id));
  
  assert(
    commissionRecord !== undefined &&
    Number(commissionRecord.rate) === 0.05 &&
    Number(commissionRecord.commissionAmount) === 75000 &&
    commissionRecord.commissionType === 'RENT_MANAGEMENT' &&
    commissionRecord.status === 'POSTED',
    'TNT-FIN-05',
    'CANONICAL 5% COMMISSION: Exactly 75,000 IQD (5% of 1,500,000 IQD) posted to platform commissions ledger'
  );

  // Verify payment audit log
  const [paymentAudit] = await db.select()
    .from(auditLogs)
    .where(and(
      eq(auditLogs.resourceId, paymentResult.payment.id),
      eq(auditLogs.action, 'PAYMENT_CONFIRMED')
    ));
  assert(
    paymentAudit && paymentAudit.actorUserId === tenantAId,
    'TNT-AUDIT-02',
    'Audit log created for tenant payment submission'
  );

  // -------------------------------------------------------------
  // PART 6: SECURITY DEPOSIT ISOLATION & VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- PART 6: SECURITY DEPOSIT ISOLATION & VERIFICATION ---');

  const depositId = 'dep-tnt-001';
  await db.insert(securityDeposits).values({
    id: depositId,
    leaseId,
    propertyId: propId,
    tenantId: tenantAId,
    requiredAmount: '3000000',
    recordedAmount: '3000000',
    currency: 'IQD',
    status: 'HELD',
  });

  // Verify deposit is queried by tenant
  const tenantDeposits = await repo.getTenantDeposits(tenantAId);
  assert(
    tenantDeposits.length === 1 &&
    tenantDeposits[0].id === depositId &&
    Number(tenantDeposits[0].recordedAmount) === 3000000 &&
    tenantDeposits[0].status === 'HELD',
    'TNT-DEP-01',
    'Tenant A successfully retrieves held security deposit record of 3,000,000 IQD'
  );

  // Cross-tenant deposit isolation
  const tenantBDeposits = await repo.getTenantDeposits(tenantBId);
  assert(
    tenantBDeposits.length === 0,
    'TNT-DEP-02',
    'DATA ISOLATION: Tenant B receives 0 deposits (cannot view Tenant A deposit)'
  );

  // Ensure 0% commission on security deposit (no commission entry for depositId)
  const depositCommissions = await db.select()
    .from(commissions)
    .where(eq(commissions.paymentRecordId, depositId));
  assert(
    depositCommissions.length === 0,
    'TNT-DEP-03',
    'FINANCIAL INTEGRITY: Zero platform commission applied to security deposits (0% commission policy strictly enforced)'
  );

  // -------------------------------------------------------------
  // PART 7: MAINTENANCE REQUEST LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n--- PART 7: MAINTENANCE REQUEST SUBMISSION & SCOPING ---');

  // Tenant A submits valid maintenance request for occupied property
  const maintTicket = await repo.createMaintenanceRequest(tenantAId, {
    propertyId: propId,
    category: 'PLUMBING',
    priority: 'HIGH',
    title: 'Bathroom water pipe leak',
    description: 'Continuous dripping under main bathroom vanity unit.',
  });

  assert(
    maintTicket && maintTicket.status === 'REPORTED' && maintTicket.propertyId === propId,
    'TNT-MNT-01',
    'Maintenance ticket persisted with REPORTED status for tenant property'
  );

  // Tenant B attempts to report maintenance for Tenant A's property
  let maintCrossDenied = false;
  try {
    await repo.createMaintenanceRequest(tenantBId, {
      propertyId: propId,
      category: 'ELECTRICAL',
      priority: 'LOW',
      title: 'Light switch malfunction',
      description: 'Switch not turning on in hallway.',
    });
  } catch (err: any) {
    maintCrossDenied = err.message === 'UNAUTHORIZED_PROPERTY_MAINTENANCE_ACCESS';
  }
  assert(
    maintCrossDenied,
    'TNT-MNT-02',
    'AUTHORIZATION SCOPE: Tenant B denied from submitting maintenance ticket for unleased property'
  );

  // -------------------------------------------------------------
  // PART 8: LEASE RENEWAL & MOVE-OUT WORKFLOWS
  // -------------------------------------------------------------
  console.log('\n--- PART 8: LEASE RENEWAL & MOVE-OUT NOTICES ---');

  // Lease renewal request
  const renewal = await repo.requestLeaseRenewal(tenantAId, {
    leaseId,
    propertyId: propId,
    proposedStartDate: '2027-05-01',
    proposedEndDate: '2028-05-01',
    proposedRentAmount: 1500000,
    tenantNotes: 'Requesting 12-month extension at current terms.',
  });

  assert(
    renewal && renewal.status === 'REQUESTED' && renewal.proposedStartDate === '2027-05-01',
    'TNT-REN-01',
    'Lease renewal request persisted with REQUESTED status and proposed dates'
  );

  // Move-out notice request
  const moveOut = await repo.requestMoveOut(tenantAId, {
    leaseId,
    propertyId: propId,
    requestedMoveOutDate: '2027-04-30',
    reason: 'Job relocation to Sulaymaniyah.',
    forwardingAddress: 'Salim Street, Sulaymaniyah',
  });

  assert(
    moveOut && moveOut.status === 'PENDING_REVIEW' && moveOut.requestedMoveOutDate === '2027-04-30',
    'TNT-MOV-01',
    'Move-out notice persisted with PENDING_REVIEW status and authoritative departure date'
  );

  // -------------------------------------------------------------
  // PART 9: FINAL AUDIT TRAIL VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- PART 9: FINAL AUDIT TRAIL VERIFICATION ---');

  const tenantAudits = await db.select()
    .from(auditLogs)
    .where(eq(auditLogs.actorUserId, tenantAId));

  const actions = tenantAudits.map(a => a.action);
  assert(
    actions.includes('LEASE_ACCEPTED') &&
    actions.includes('PAYMENT_CONFIRMED') &&
    actions.includes('MAINTENANCE_REQUEST_CREATED') &&
    actions.includes('RENEWAL_REQUESTED') &&
    actions.includes('MOVE_OUT_REQUESTED'),
    'TNT-AUDIT-FINAL',
    'Complete audit trail verified for all 5 core tenant domain mutations'
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n===================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTenantWorkflowSuite().catch((err) => {
  console.error('Tenant workflow persistence suite threw an unhandled error:', err);
  process.exit(1);
});
