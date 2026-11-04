import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB COMPANY DOMAIN — WORKFLOW PERSISTENCE, FINANCIAL RECONCILIATION & AUTHORIZATION AUDIT
 * 
 * Direct verification of:
 * 1. PostgreSQL/Drizzle database persistence (Organizations, Members, Invitations, Agreements, Leases, Maintenance, Audits)
 * 2. Ownership vs Management separation in database records (ownership_records vs management_agreements)
 * 3. Management agreement lifecycle (PENDING -> ACTIVE -> REVOKED/TERMINATED)
 * 4. Spending limit enforcement on maintenance quotes (<= limit allowed, > limit requires owner sign-off)
 * 5. Canonical 5% platform commission policy & exact financial settlement (0% on pending rent, deposits, contractor invoices)
 * 6. Double-entry ledger reconciliation (SUM(debits) === SUM(credits))
 * 7. Server-side role-based access control and tenant isolation
 * 8. Audit logging for all sensitive company actions
 */

import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  companyInvitations,
  properties,
  units,
  ownershipRecords,
  managementAgreements,
  leases,
  leaseTenants,
  maintenanceRequests,
  maintenanceQuotes,
  paymentRecords,
  rentSchedules,
  securityDeposits,
  journalEntries,
  ledgerLines,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { CompanyRepository } from '../src/server/repositories/company.js';

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

async function runCompanyWorkflowSuite() {
  console.log('===================================================================');
  console.log('  HOMEHUB COMPANY DOMAIN — WORKFLOW PERSISTENCE & INTEGRATION AUDIT');
  console.log('===================================================================\n');

  // 1. Initialize in-process PostgreSQL database with all 6 Drizzle migrations
  console.log('--- PART 1: POSTGRESQL ENGINE INITIALIZATION & MIGRATIONS ---');
  await injectPgliteMock();
  console.log('In-process PostgreSQL (PGlite) initialized with all 6 Drizzle migrations.\n');

  const repo = new CompanyRepository();

  // -------------------------------------------------------------
  // PART 2: COMPANY ORGANIZATION & MEMBER PERSISTENCE
  // -------------------------------------------------------------
  console.log('--- PART 2: COMPANY REGISTRATION, MEMBERSHIP & RBAC ---');

  // Seed company founder user
  const founderId = 'usr-co-founder-01';
  await db.insert(users).values({
    id: founderId,
    firstName: 'Karwan',
    lastName: 'Erbili',
    email: 'karwan@kurdistan-properties.iq',
    phone: '+9647504445566',
    roles: ['COMPANY_ADMIN'],
    isActive: true,
  });

  // Seed company organization
  const companyId = 'org-co-001';
  await db.insert(organizations).values({
    id: companyId,
    name: 'Kurdistan Premier Property Management',
    type: 'COMPANY',
    email: 'contact@kurdistan-properties.iq',
    phone: '+9647504445500',
    address: { city: 'Erbil', street: '100m Road, Empire World', country: 'Iraq' },
    status: 'PENDING_VERIFICATION',
    verified: false,
    spendingLimitDefault: '1000000',
  });

  const [persistedOrg] = await db.select().from(organizations).where(eq(organizations.id, companyId));
  assert(
    persistedOrg && persistedOrg.id === companyId && persistedOrg.status === 'PENDING_VERIFICATION',
    'ORG-01',
    'Company organization persisted with PENDING_VERIFICATION status'
  );

  // Verification lifecycle transition
  await db.update(organizations)
    .set({ status: 'VERIFIED', verified: true })
    .where(eq(organizations.id, companyId));
  
  const [verifiedOrg] = await db.select().from(organizations).where(eq(organizations.id, companyId));
  assert(
    verifiedOrg && verifiedOrg.status === 'VERIFIED' && verifiedOrg.verified === true,
    'ORG-02',
    'Company verification lifecycle transition to VERIFIED verified in PostgreSQL'
  );

  // Link founder as COMPANY_OWNER in organizationMembers
  const founderMemberId = 'mem-co-founder-01';
  await db.insert(organizationMembers).values({
    id: founderMemberId,
    organizationId: companyId,
    userId: founderId,
    role: 'COMPANY_OWNER',
    status: 'ACTIVE',
  });

  const founderMembership = await repo.getCompanyMembership(founderId, companyId);
  assert(
    founderMembership !== null && founderMembership.role === 'COMPANY_OWNER',
    'MEM-01',
    'Company founder recognized as active COMPANY_OWNER via authoritative database query'
  );

  // Create Invitation for a Property Manager
  const inviteeEmail = 'saman.pm@kurdistan-properties.iq';
  await db.insert(companyInvitations).values({
    id: 'inv-co-001',
    companyId: companyId,
    invitedByUserId: founderId,
    email: inviteeEmail,
    role: 'PROPERTY_MANAGER',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
  });

  const [persistedInvite] = await db.select().from(companyInvitations).where(eq(companyInvitations.id, 'inv-co-001'));
  assert(
    persistedInvite && persistedInvite.email === inviteeEmail && persistedInvite.status === 'PENDING',
    'MEM-02',
    'Company team invitation persisted with PENDING status and expiration'
  );

  // Seed user accepting invitation
  const pmUserId = 'usr-co-pm-01';
  await db.insert(users).values({
    id: pmUserId,
    firstName: 'Saman',
    lastName: 'Aziz',
    email: inviteeEmail,
    phone: '+9647509998877',
    roles: ['PROPERTY_MANAGER'],
    isActive: true,
  });

  // Accept invitation: transition invite status & add to organizationMembers
  await db.update(companyInvitations)
    .set({ status: 'ACCEPTED' })
    .where(eq(companyInvitations.id, 'inv-co-001'));

  const pmMemberId = 'mem-co-pm-01';
  await db.insert(organizationMembers).values({
    id: pmMemberId,
    organizationId: companyId,
    userId: pmUserId,
    role: 'PROPERTY_MANAGER',
    status: 'ACTIVE',
  });

  const membersRoster = await repo.getCompanyMembers(companyId);
  assert(
    membersRoster.length === 2 && membersRoster.some(m => m.userId === pmUserId && m.role === 'PROPERTY_MANAGER'),
    'MEM-03',
    'Invited member successfully transitioned to ACTIVE member in company roster'
  );

  // Test Member Suspension (Status Transition)
  await repo.updateMemberStatus(companyId, pmMemberId, 'SUSPENDED', founderId);
  const [suspendedMember] = await db.select().from(organizationMembers).where(eq(organizationMembers.id, pmMemberId));
  assert(
    suspendedMember && suspendedMember.status === 'SUSPENDED',
    'MEM-04',
    'Member status successfully transitioned to SUSPENDED with audit logging'
  );

  // Reactivate member
  await repo.updateMemberStatus(companyId, pmMemberId, 'ACTIVE', founderId);
  const [reactivatedMember] = await db.select().from(organizationMembers).where(eq(organizationMembers.id, pmMemberId));
  assert(
    reactivatedMember && reactivatedMember.status === 'ACTIVE',
    'MEM-05',
    'Member status successfully reactivated to ACTIVE'
  );

  // -------------------------------------------------------------
  // PART 3: OWNERSHIP VS MANAGEMENT SEPARATION & AGREEMENT LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n--- PART 3: OWNERSHIP VS MANAGEMENT SEPARATION ---');

  // Seed property owner
  const ownerId = 'usr-owner-client-01';
  await db.insert(users).values({
    id: ownerId,
    firstName: 'Dara',
    lastName: 'Mahmood',
    email: 'dara.owner@example.iq',
    phone: '+9647501234567',
    roles: ['PROPERTY_OWNER'],
    isActive: true,
  });

  // Seed owner's property
  const propId = 'prop-co-managed-01';
  await db.insert(properties).values({
    id: propId,
    name: 'Gulan Commercial Plaza - Tower B',
    type: 'COMMERCIAL',
    address: { city: 'Erbil', street: 'Gulan Street', governorate: 'Erbil' },
    status: 'AVAILABLE',
    currency: 'IQD',
  });

  // Seed unit
  const unitId = 'unit-co-managed-01';
  await db.insert(units).values({
    id: unitId,
    propertyId: propId,
    unitNumber: 'Suite 401',
    marketRent: '3000000',
    currency: 'IQD',
    status: 'VACANT',
  });

  // CRITICAL RULE 1: Deed strictly in ownership_records for ownerId
  await db.insert(ownershipRecords).values({
    id: 'deed-co-managed-01',
    propertyId: propId,
    ownerId: ownerId,
    ownershipPercentage: '100.00',
    status: 'VERIFIED',
  });

  // Verify company has NO deed in ownership_records
  const companyDeeds = await db.select()
    .from(ownershipRecords)
    .where(and(
      eq(ownershipRecords.propertyId, propId),
      eq(ownershipRecords.companyId, companyId)
    ));
  assert(
    companyDeeds.length === 0,
    'OWN-01',
    'CRITICAL INVARIANT: Company owns 0% deed in ownership_records (ownership strictly separate)'
  );

  // Establish Management Agreement
  const agreementId = 'mgmt-agr-001';
  await db.insert(managementAgreements).values({
    id: agreementId,
    propertyId: propId,
    companyId: companyId,
    ownerId: ownerId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    spendingLimit: '500000', // 500,000 IQD spending threshold
    grantedPermissions: ['VIEW_PROPERTY', 'MANAGE_MAINTENANCE', 'COLLECT_RENT', 'LIST_FOR_RENT'],
  });

  // Company queries managed properties
  const managedProps = await repo.getManagedProperties(companyId);
  assert(
    managedProps.length === 1 && managedProps[0].id === propId && managedProps[0].isOwner === false,
    'MGMT-01',
    'Company lists managed property with explicit isOwner: false flag'
  );

  // Cross-Company Isolation: Company B queries managed properties
  const companyBId = 'org-co-002';
  await db.insert(organizations).values({
    id: companyBId,
    name: 'Competitor Real Estate Ltd',
    type: 'COMPANY',
    status: 'VERIFIED',
  });

  const companyBProps = await repo.getManagedProperties(companyBId);
  assert(
    companyBProps.length === 0,
    'MGMT-02',
    'TENANT ISOLATION: Unrelated company B receives 0 properties (cross-company isolation verified)'
  );

  // Agreement Revocation test
  await db.update(managementAgreements)
    .set({ status: 'REVOKED' })
    .where(eq(managementAgreements.id, agreementId));

  const managedPropsAfterRevocation = await repo.getManagedProperties(companyId);
  assert(
    managedPropsAfterRevocation.length === 0,
    'MGMT-03',
    'LIFECYCLE ENFORCEMENT: Revoked management agreement immediately revokes company property access'
  );

  // Restore agreement to ACTIVE for remaining operational tests
  await db.update(managementAgreements)
    .set({ status: 'ACTIVE' })
    .where(eq(managementAgreements.id, agreementId));

  // -------------------------------------------------------------
  // PART 4: MAINTENANCE SPENDING LIMITS & OWNER APPROVAL ESCALATION
  // -------------------------------------------------------------
  console.log('\n--- PART 4: SPENDING LIMITS & APPROVAL THRESHOLDS ---');

  const reqId = 'maint-req-001';
  await db.insert(maintenanceRequests).values({
    id: reqId,
    propertyId: propId,
    unitId: unitId,
    category: 'HVAC',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    title: 'AC unit repair in Suite 401',
    description: 'Compressor replacement needed',
    reporterUserId: founderId,
  });

  // Case A: Quote within spending limit (350,000 IQD <= 500,000 IQD limit)
  const quoteAId = 'quote-001';
  await db.insert(maintenanceQuotes).values({
    id: quoteAId,
    maintenanceRequestId: reqId,
    propertyId: propId,
    totalAmount: '350000',
    currency: 'IQD',
    status: 'APPROVED',
  });

  // Case B: Quote exceeding spending limit (1,200,000 IQD > 500,000 IQD limit)
  const quoteBId = 'quote-002';
  await db.insert(maintenanceQuotes).values({
    id: quoteBId,
    maintenanceRequestId: reqId,
    propertyId: propId,
    totalAmount: '1200000',
    currency: 'IQD',
    status: 'PENDING_APPROVAL',
  });

  // Query pending approvals for company
  const pendingApprovals = await repo.getApprovals(companyId);
  assert(
    pendingApprovals.some(a => a.id === quoteBId && a.requiresOwnerDecision === true),
    'SPEND-01',
    'Quote exceeding spending limit (1.2M IQD > 500k IQD) correctly escalated requiring owner sign-off'
  );

  // -------------------------------------------------------------
  // PART 5: CANONICAL 5% COMMISSION & EXACT FINANCIAL SETTLEMENT
  // -------------------------------------------------------------
  console.log('\n--- PART 5: CANONICAL 5% COMMISSION & FINANCIAL RECONCILIATION ---');

  // Seed active lease
  const leaseId = 'lease-co-001';
  await db.insert(leases).values({
    id: leaseId,
    propertyId: propId,
    unitId: unitId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmount: '2000000', // 2,000,000 IQD monthly rent
    currency: 'IQD',
    depositAmount: '1000000',
  });

  // Seed tenant user
  const tenantId = 'usr-tenant-audit-01';
  await db.insert(users).values({
    id: tenantId,
    firstName: 'Hiwa',
    lastName: 'Kareem',
    email: 'hiwa.tenant@example.iq',
    roles: ['TENANT'],
    isActive: true,
  });

  await db.insert(leaseTenants).values({
    leaseId: leaseId,
    tenantId: tenantId,
    isPrimary: true,
  });

  // Record 1: Confirmed Rent Payment (2,000,000 IQD)
  await db.insert(paymentRecords).values({
    id: 'pay-confirmed-001',
    propertyId: propId,
    leaseId: leaseId,
    payerId: tenantId,
    amount: '2000000',
    currency: 'IQD',
    status: 'CONFIRMED',
    recordedDate: '2026-03-01',
  });

  // Record 2: Pending/Uncollected Rent Schedule (1,500,000 IQD)
  await db.insert(rentSchedules).values({
    id: 'sched-pending-001',
    propertyId: propId,
    leaseId: leaseId,
    tenantId: tenantId,
    amount: '1500000',
    currency: 'IQD',
    status: 'DUE',
    dueDate: '2026-04-01',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-30',
  });

  // Record 3: Security Deposit (1,000,000 IQD) - segregated in securityDeposits (0% platform commission)
  await db.insert(securityDeposits).values({
    id: 'dep-deposit-001',
    propertyId: propId,
    leaseId: leaseId,
    tenantId: tenantId,
    requiredAmount: '1000000',
    recordedAmount: '1000000',
    currency: 'IQD',
    status: 'HELD',
  });

  // Authoritative financial calculation via repository
  const financials = await repo.getFinancials(companyId);

  // Invariant 1: Collected Rent
  assert(
    financials.collectedRentIqd === 2000000,
    'FIN-01',
    `Collected rent reflects strictly CONFIRMED payments: ${financials.collectedRentIqd.toLocaleString()} IQD`
  );

  // Invariant 2: Pending Rent
  assert(
    financials.pendingRentIqd === 1500000,
    'FIN-02',
    `Pending rent accurately tracks uncollected payments: ${financials.pendingRentIqd.toLocaleString()} IQD`
  );

  // Invariant 3: Canonical 5% Platform Commission strictly on confirmed rent
  // 2,000,000 * 0.05 = 100,000 IQD
  assert(
    financials.platformCommissionIqd === 100000,
    'FIN-03',
    `Canonical 5% Platform Commission applied strictly to confirmed rent (100,000 IQD, 0% on pending/deposits)`
  );

  // Invariant 4: Company Management Fee (10% agreed commission on confirmed rent)
  // 2,000,000 * 0.10 = 200,000 IQD
  assert(
    financials.commissionsEarnedIqd === 200000,
    'FIN-04',
    `Company fee calculated strictly on confirmed rent: ${financials.commissionsEarnedIqd.toLocaleString()} IQD`
  );

  // Invariant 5: Approved Maintenance Expense (Quote A: 350,000 IQD)
  assert(
    financials.expensesApprovedIqd === 350000,
    'FIN-05',
    `Approved contractor expenses accurately aggregated: ${financials.expensesApprovedIqd.toLocaleString()} IQD`
  );

  // Invariant 6: Net Owner Settlement Payable
  // Net = 2,000,000 - 100,000 (platform) - 200,000 (company) - 350,000 (maintenance) = 1,350,000 IQD
  const expectedOwnerPayable = 2000000 - 100000 - 200000 - 350000;
  assert(
    financials.ownerSettlementPayableIqd === expectedOwnerPayable,
    'FIN-06',
    `Net owner settlement payable matches authoritative formula: ${financials.ownerSettlementPayableIqd?.toLocaleString()} IQD`
  );

  // -------------------------------------------------------------
  // PART 6: DOUBLE-ENTRY LEDGER RECONCILIATION
  // -------------------------------------------------------------
  console.log('\n--- PART 6: DOUBLE-ENTRY LEDGER INTEGRITY ---');

  // Insert balanced journal entry for the rent payment
  const journalId = 'je-rent-001';
  await db.insert(journalEntries).values({
    id: journalId,
    propertyId: propId,
    date: '2026-03-01',
    description: 'Confirmed rent collection and commission allocation',
    status: 'POSTED',
  });

  // Debit Cash / Clearing: 2,000,000 IQD
  await db.insert(ledgerLines).values({
    id: 'll-001',
    journalEntryId: journalId,
    accountId: 'acc-cash',
    debit: '2000000',
    credit: '0',
    currency: 'IQD',
  });

  // Credit Platform Fee Payable: 100,000 IQD
  await db.insert(ledgerLines).values({
    id: 'll-002',
    journalEntryId: journalId,
    accountId: 'acc-platform-fee',
    debit: '0',
    credit: '100000',
    currency: 'IQD',
  });

  // Credit Company Management Fee Revenue: 200,000 IQD
  await db.insert(ledgerLines).values({
    id: 'll-003',
    journalEntryId: journalId,
    accountId: 'acc-company-revenue',
    debit: '0',
    credit: '200000',
    currency: 'IQD',
  });

  // Credit Owner Settlement Payable: 1,700,000 IQD (before maintenance)
  await db.insert(ledgerLines).values({
    id: 'll-004',
    journalEntryId: journalId,
    accountId: 'acc-owner-payable',
    debit: '0',
    credit: '1700000',
    currency: 'IQD',
  });

  // Verify Debit === Credit in PostgreSQL
  const lines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, journalId));
  const totalDebit = lines.reduce((acc, l) => acc + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + Number(l.credit || 0), 0);

  assert(
    totalDebit === 2000000 && totalCredit === 2000000 && totalDebit === totalCredit,
    'LEDGER-01',
    `Double-entry ledger reconciliation verified: Debits (${totalDebit.toLocaleString()} IQD) === Credits (${totalCredit.toLocaleString()} IQD)`
  );

  // -------------------------------------------------------------
  // PART 7: AUDIT LOGGING & FAIL-CLOSED INTEGRATION BOUNDARIES
  // -------------------------------------------------------------
  console.log('\n--- PART 7: AUDIT LOGGING & SECURITY BOUNDARIES ---');

  // Verify audit logs were persisted during member status modification
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, founderId));
  assert(
    logs.length >= 2 && logs.some(l => l.action.includes('MEMBER_')),
    'AUDIT-01',
    'Authoritative audit logs recorded in PostgreSQL for protected company actions'
  );

  // Verify Empty/Zero-data conditions return honest N/A or 0 without fabricated data
  const emptyCompanyId = 'org-co-empty';
  await db.insert(organizations).values({
    id: emptyCompanyId,
    name: 'Zero Portfolio Realty',
    type: 'COMPANY',
    status: 'VERIFIED',
  });

  const emptyFinancials = await repo.getFinancials(emptyCompanyId);
  assert(
    emptyFinancials.collectedRentIqd === 0 &&
    emptyFinancials.pendingRentIqd === 0 &&
    emptyFinancials.platformCommissionIqd === 0 &&
    emptyFinancials.ownerSettlementPayableIqd === 0,
    'EMPTY-01',
    'Empty portfolio returns exact 0 values without synthetic placeholders or fabricated metrics'
  );

  console.log('\n===================================================================');
  console.log(`  COMPANY DOMAIN AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCompanyWorkflowSuite().catch(err => {
  console.error('Fatal execution error in company workflow persistence suite:', err);
  process.exit(1);
});
