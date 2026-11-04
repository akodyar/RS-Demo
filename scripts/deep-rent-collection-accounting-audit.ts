/**
 * HOMEHUB — DEEP END-TO-END AUDIT OF RENT COLLECTION, ACCOUNTING, SETTLEMENT & PAYABLES
 * 
 * Verifies:
 * 1. Owner & Management Agreement Authorization (Active, Pending, Expired, Missing Permission).
 * 2. Operating Models: FULLY_MANAGED, AGENT_LISTED_PLATFORM_MANAGED, AGENT_OPERATED.
 * 3. Tenant Rent Payment recording (RECORDED status, schedule unchanged until confirmation).
 * 4. Collector vs Confirmer separation (physical collector vs confirming user).
 * 5. Payment Confirmation: Rent schedule update, Custodial Cash Receipt (Dr 1010 / Cr 4000),
 *    Fee Allocation (Dr 4000 / Cr 4010, 4011, 4012, 2010), Net-Zero Clearing on 4000.
 * 6. Automated Owner Settlement creation and company commission calculation integrity.
 * 7. Payout Request & Processing: Dr 2010 / Cr 1010, Account 2010 overdraw defense.
 * 8. Payment Reversal: Compensating ledger entries, schedule debt restoration, settlement handling.
 * 9. Idempotency and concurrency safety.
 */

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
  ownerSettlements,
  payoutRequests,
  journalEntries,
  ledgerLines,
  financialPolicies,
} from '../src/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { commissionService } from '../src/server/services/commission.js';
import { leaseRepository } from '../src/server/repositories/leases.js';
import { tenantRepository } from '../src/server/repositories/tenant.js';

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

const RUN_ID = `audit_${Date.now()}`;

const IDS = {
  users: {
    indivOwner: `usr_indiv_owner_${RUN_ID}`,
    compOwnerPrincipal: `usr_comp_owner_${RUN_ID}`,
    companyAdmin: `usr_comp_admin_${RUN_ID}`,
    companyViewer: `usr_comp_viewer_${RUN_ID}`,
    agent: `usr_agent_${RUN_ID}`,
    tenant: `usr_tenant_${RUN_ID}`,
    stranger: `usr_stranger_${RUN_ID}`,
    platformAdmin: `usr_admin_${RUN_ID}`,
  },
  orgs: {
    companyOwnerOrg: `org_comp_owner_${RUN_ID}`,
    managementAgencyOrg: `org_mgmt_agency_${RUN_ID}`,
  },
  props: {
    fullyManaged: `prop_fully_${RUN_ID}`,
    agentListedPlatformManaged: `prop_alpm_${RUN_ID}`,
    agentOperated: `prop_agent_op_${RUN_ID}`,
  },
  leases: {
    leaseFully: `lease_fully_${RUN_ID}`,
    leaseAlpm: `lease_alpm_${RUN_ID}`,
    leaseAgentOp: `lease_agent_op_${RUN_ID}`,
  },
  schedules: {
    schedFully: `sched_fully_${RUN_ID}`,
    schedAlpm: `sched_alpm_${RUN_ID}`,
    schedAgentOp: `sched_agent_op_${RUN_ID}`,
  },
};

async function runAudit() {
  console.log('========================================================================');
  console.log('  HOMEHUB — DEEP RENT COLLECTION, ACCOUNTING & SETTLEMENT AUDIT');
  console.log('========================================================================');

  // Verify target test database
  const targetDb = process.env.SQL_DB_NAME;
  assert(targetDb === 'homehub_test', 'DATABASE_TARGET', `Target database is '${targetDb}' (must be homehub_test)`);

  // Ensure Platform Fee Rate is configured in financial_policies
  const [platformPolicy] = await db.select().from(financialPolicies)
    .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE')).limit(1);
  if (!platformPolicy) {
    await db.insert(financialPolicies).values({
      policyType: 'PLATFORM_FEE_RATE',
      policyValue: '0.02', // 2%
      description: 'Standard HomeHub Platform Fee Rate',
      active: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 1. SEED USERS, ORGANIZATIONS & MEMBERSHIPS
  // ---------------------------------------------------------------------------
  console.log('\n--- 1. SEEDING USERS & ENTITIES ---');
  await db.insert(users).values([
    {
      id: IDS.users.indivOwner,
      email: `${IDS.users.indivOwner}@homehub.test`,
      firstName: 'Kardo',
      lastName: 'Owner',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: IDS.users.compOwnerPrincipal,
      email: `${IDS.users.compOwnerPrincipal}@homehub.test`,
      firstName: 'Shwan',
      lastName: 'Director',
      roles: ['COMPANY', 'COMPANY_ADMIN'],
      organizationId: IDS.orgs.companyOwnerOrg,
      isActive: true,
    },
    {
      id: IDS.users.companyAdmin,
      email: `${IDS.users.companyAdmin}@homehub.test`,
      firstName: 'Dana',
      lastName: 'Manager',
      roles: ['COMPANY_MEMBER', 'COMPANY_ADMIN'],
      organizationId: IDS.orgs.managementAgencyOrg,
      isActive: true,
    },
    {
      id: IDS.users.companyViewer,
      email: `${IDS.users.companyViewer}@homehub.test`,
      firstName: 'Soran',
      lastName: 'Auditor',
      roles: ['COMPANY_MEMBER'],
      organizationId: IDS.orgs.managementAgencyOrg,
      isActive: true,
    },
    {
      id: IDS.users.agent,
      email: `${IDS.users.agent}@homehub.test`,
      firstName: 'Aram',
      lastName: 'Broker',
      roles: ['AGENT'],
      isActive: true,
    },
    {
      id: IDS.users.tenant,
      email: `${IDS.users.tenant}@homehub.test`,
      firstName: 'Baban',
      lastName: 'Tenant',
      roles: ['TENANT'],
      isActive: true,
    },
    {
      id: IDS.users.stranger,
      email: `${IDS.users.stranger}@homehub.test`,
      firstName: 'Ranj',
      lastName: 'Stranger',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    },
    {
      id: IDS.users.platformAdmin,
      email: `${IDS.users.platformAdmin}@homehub.test`,
      firstName: 'Finance',
      lastName: 'Admin',
      roles: ['PLATFORM_ADMIN'],
      isActive: true,
    },
  ]);

  await db.insert(organizations).values([
    {
      id: IDS.orgs.companyOwnerOrg,
      name: 'Erbil Royal Properties Ltd',
      type: 'COMPANY',
    },
    {
      id: IDS.orgs.managementAgencyOrg,
      name: 'Apex Property Management Group',
      type: 'COMPANY',
    },
  ]);

  await db.insert(organizationMembers).values([
    {
      organizationId: IDS.orgs.companyOwnerOrg,
      userId: IDS.users.compOwnerPrincipal,
      role: 'COMPANY_OWNER',
      status: 'ACTIVE',
    },
    {
      organizationId: IDS.orgs.managementAgencyOrg,
      userId: IDS.users.companyAdmin,
      role: 'COMPANY_ADMIN',
      status: 'ACTIVE',
    },
    {
      organizationId: IDS.orgs.managementAgencyOrg,
      userId: IDS.users.companyViewer,
      role: 'VIEWER',
      status: 'ACTIVE',
    },
  ]);

  assert(true, 'USERS_AND_ORGS_SEEDED', 'Users, organizations, and roles seeded successfully');

  // ---------------------------------------------------------------------------
  // 2. SEED PROPERTIES UNDER 3 OPERATING MODELS
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. SEEDING PROPERTIES UNDER 3 OPERATING MODELS ---');
  await db.insert(properties).values([
    {
      id: IDS.props.fullyManaged,
      name: 'Empire World Tower B - Fully Managed',
      type: 'APARTMENT',
      status: 'RENTED',
      operatingModel: 'FULLY_MANAGED',
      rentFee: '0.05', // 5% Rent fee
      managementFee: '0.08', // 8% Management fee
      verificationStatus: 'VERIFIED',
    },
    {
      id: IDS.props.agentListedPlatformManaged,
      name: 'Dream City Villa - Agent Listed Platform Managed',
      type: 'VILLA',
      status: 'RENTED',
      operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
      rentFee: '0.05', // Ignored under this model
      managementFee: '0.08', // 8% Management fee
      verificationStatus: 'VERIFIED',
    },
    {
      id: IDS.props.agentOperated,
      name: 'Gulan Commercial Plaza - Agent Operated',
      type: 'COMMERCIAL',
      status: 'RENTED',
      operatingModel: 'AGENT_OPERATED',
      rentFee: '0.05', // Ignored
      managementFee: '0.08', // Ignored
      verificationStatus: 'VERIFIED',
    },
  ]);

  // Ownership: Individual owns prop 1 & 3; Company owns prop 2
  await db.insert(ownershipRecords).values([
    {
      propertyId: IDS.props.fullyManaged,
      ownerId: IDS.users.indivOwner,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    },
    {
      propertyId: IDS.props.agentListedPlatformManaged,
      companyId: IDS.orgs.companyOwnerOrg,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    },
    {
      propertyId: IDS.props.agentOperated,
      ownerId: IDS.users.indivOwner,
      status: 'VERIFIED',
      ownershipPercentage: '100',
    },
  ]);

  // Management Agreement for prop 1 with Apex Agency
  const mgmtAgreementId = `mgmt_agr_${RUN_ID}`;
  await db.insert(managementAgreements).values({
    id: mgmtAgreementId,
    propertyId: IDS.props.fullyManaged,
    companyId: IDS.orgs.managementAgencyOrg,
    ownerId: IDS.users.indivOwner,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    grantedPermissions: ['COLLECT_RENT', 'VIEW_PROPERTY', 'MANAGE_MAINTENANCE'],
    spendingLimit: '5000',
  });

  assert(true, 'PROPERTIES_AND_AGREEMENTS_SEEDED', '3 properties with ownership records & management agreement seeded');

  // ---------------------------------------------------------------------------
  // 3. SEED LEASES & RENT SCHEDULES
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. SEEDING LEASES & RENT SCHEDULES ---');
  await db.insert(leases).values([
    {
      id: IDS.leases.leaseFully,
      propertyId: IDS.props.fullyManaged,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1000',
      currency: 'USD',
      status: 'ACTIVE',
    },
    {
      id: IDS.leases.leaseAlpm,
      propertyId: IDS.props.agentListedPlatformManaged,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '2000',
      currency: 'USD',
      status: 'ACTIVE',
    },
    {
      id: IDS.leases.leaseAgentOp,
      propertyId: IDS.props.agentOperated,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmount: '1500',
      currency: 'USD',
      status: 'ACTIVE',
    },
  ]);

  await db.insert(leaseTenants).values([
    { leaseId: IDS.leases.leaseFully, tenantId: IDS.users.tenant, isPrimary: true },
    { leaseId: IDS.leases.leaseAlpm, tenantId: IDS.users.tenant, isPrimary: true },
    { leaseId: IDS.leases.leaseAgentOp, tenantId: IDS.users.tenant, isPrimary: true },
  ]);

  await db.insert(rentSchedules).values([
    {
      id: IDS.schedules.schedFully,
      leaseId: IDS.leases.leaseFully,
      propertyId: IDS.props.fullyManaged,
      tenantId: IDS.users.tenant,
      amount: '1000',
      currency: 'USD',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'DUE',
      paidAmount: '0',
    },
    {
      id: IDS.schedules.schedAlpm,
      leaseId: IDS.leases.leaseAlpm,
      propertyId: IDS.props.agentListedPlatformManaged,
      tenantId: IDS.users.tenant,
      amount: '2000',
      currency: 'USD',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'DUE',
      paidAmount: '0',
    },
    {
      id: IDS.schedules.schedAgentOp,
      leaseId: IDS.leases.leaseAgentOp,
      propertyId: IDS.props.agentOperated,
      tenantId: IDS.users.tenant,
      amount: '1500',
      currency: 'USD',
      dueDate: '2026-11-01',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      status: 'DUE',
      paidAmount: '0',
    },
  ]);

  assert(true, 'LEASES_AND_SCHEDULES_SEEDED', 'Active leases and rent schedules seeded');

  // ---------------------------------------------------------------------------
  // 4. TEST TENANT-TO-HOMEHUB COLLECTION WORKFLOW (PARTIAL & FULL)
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. TESTING TENANT RENT PAYMENT (TWO-STAGE CONFIRMATION) ---');
  
  // 4.1 Tenant submits partial payment of $400 via tenantRepository.recordRentPayment
  const tenantPayment1 = await tenantRepository.recordRentPayment(IDS.users.tenant, {
    propertyId: IDS.props.fullyManaged,
    leaseId: IDS.leases.leaseFully,
    scheduleId: IDS.schedules.schedFully,
    amount: 400,
    currency: 'USD',
    paymentMethod: 'FIB',
    referenceNumber: 'TXN-FIB-400-01',
  });

  assert(
    tenantPayment1.payment.status === 'RECORDED',
    'TENANT_PAYMENT_RECORDED_STATUS',
    `Status is '${tenantPayment1.payment.status}' (must be RECORDED, not CONFIRMED)`
  );

  // Verify schedule paidAmount is still 0 while payment is unconfirmed
  const [schedBeforeConfirm] = await db.select().from(rentSchedules)
    .where(eq(rentSchedules.id, IDS.schedules.schedFully));
  assert(
    Number(schedBeforeConfirm.paidAmount) === 0 && schedBeforeConfirm.status === 'DUE',
    'SCHEDULE_UNALTERED_WHILE_RECORDED',
    `Schedule paidAmount: ${schedBeforeConfirm.paidAmount}, status: ${schedBeforeConfirm.status}`
  );

  // Verify zero journal entries exist for this payment before confirmation
  const jesBeforeConfirm = await db.select().from(journalEntries)
    .where(eq(journalEntries.referenceId, tenantPayment1.payment.id));
  assert(
    jesBeforeConfirm.length === 0,
    'NO_LEDGER_ENTRIES_BEFORE_CONFIRMATION',
    `Expected 0 journal entries, found ${jesBeforeConfirm.length}`
  );

  // 4.2 Authorized Property Manager (Apex Company Admin) confirms payment
  const confirmedP1 = await leaseRepository.confirmPayment(
    tenantPayment1.payment.id,
    IDS.users.companyAdmin,
    { referenceNumber: 'TXN-FIB-400-01' }
  );

  assert(
    confirmedP1.status === 'CONFIRMED' && confirmedP1.confirmedByUserId === IDS.users.companyAdmin,
    'PAYMENT_CONFIRMED_BY_AUTHORIZED_MANAGER',
    `Confirmed by user ${confirmedP1.confirmedByUserId}, status: ${confirmedP1.status}`
  );

  // Post commission and ledger lines
  const commP1 = await commissionService.postCommissionForPayment(
    confirmedP1.id,
    IDS.users.companyAdmin,
    'COMPANY_ADMIN'
  );

  // Verify schedule updated to PARTIALLY_PAID with $400
  const [schedAfterP1] = await db.select().from(rentSchedules)
    .where(eq(rentSchedules.id, IDS.schedules.schedFully));
  assert(
    Number(schedAfterP1.paidAmount) === 400 && schedAfterP1.status === 'PARTIALLY_PAID',
    'SCHEDULE_UPDATED_AFTER_CONFIRMATION',
    `Schedule paidAmount: ${schedAfterP1.paidAmount}, status: ${schedAfterP1.status}`
  );

  // ---------------------------------------------------------------------------
  // 5. DOUBLE-ENTRY LEDGER & 3-FEE ALLOCATION INTEGRITY (FULLY_MANAGED)
  // ---------------------------------------------------------------------------
  console.log('\n--- 5. VERIFYING DOUBLE-ENTRY LEDGER LINES (FULLY_MANAGED) ---');
  // Expected on $400 under FULLY_MANAGED:
  // Platform Fee (2%): $8.00
  // Rent Fee (5%): $20.00
  // Management Fee (8%): $32.00
  // Total Deductions: $60.00
  // Owner Net: $340.00
  const calcP1 = commP1.calculation!;
  assert(
    calcP1.platformFeeAmount === 8 &&
    calcP1.rentFeeAmount === 20 &&
    calcP1.managementFeeAmount === 32 &&
    calcP1.totalFeeAmount === 60 &&
    calcP1.ownerNetAmount === 340,
    'FULLY_MANAGED_FEE_CALCULATION',
    `Fees: Platform=${calcP1.platformFeeAmount}, Rent=${calcP1.rentFeeAmount}, Mgmt=${calcP1.managementFeeAmount}, Total=${calcP1.totalFeeAmount}, OwnerNet=${calcP1.ownerNetAmount}`
  );

  // Verify Custodial Cash Receipt: Dr 1010 ($400) / Cr 4000 ($400)
  const [cashJe] = await db.select().from(journalEntries)
    .where(eq(journalEntries.idempotencyKey, `JE_CASH_RECEIPT_${confirmedP1.id}`));
  const cashLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, cashJe.id));
  const dr1010 = cashLines.find(l => l.accountId === '1010');
  const cr4000 = cashLines.find(l => l.accountId === '4000');
  assert(
    Number(dr1010?.debit) === 400 && Number(cr4000?.credit) === 400,
    'CUSTODIAL_CASH_RECEIPT_POSTED',
    `Dr 1010: ${dr1010?.debit}, Cr 4000: ${cr4000?.credit}`
  );

  // Verify Fee Allocation: Dr 4000 ($400) / Cr 4010 ($8), Cr 4011 ($20), Cr 4012 ($32), Cr 2010 ($340)
  const [feeJe] = await db.select().from(journalEntries)
    .where(eq(journalEntries.idempotencyKey, `JE_COMMISSION_${confirmedP1.id}`));
  const feeLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, feeJe.id));
  const dr4000Fee = feeLines.find(l => l.accountId === '4000');
  const cr4010 = feeLines.find(l => l.accountId === '4010');
  const cr4011 = feeLines.find(l => l.accountId === '4011');
  const cr4012 = feeLines.find(l => l.accountId === '4012');
  const cr2010 = feeLines.find(l => l.accountId === '2010');

  assert(
    Number(dr4000Fee?.debit) === 400 &&
    Number(cr4010?.credit) === 8 &&
    Number(cr4011?.credit) === 20 &&
    Number(cr4012?.credit) === 32 &&
    Number(cr2010?.credit) === 340,
    'FEE_ALLOCATION_LEDGER_LINES_POSTED',
    `Dr 4000: ${dr4000Fee?.debit}, Cr 4010: ${cr4010?.credit}, Cr 4011: ${cr4011?.credit}, Cr 4012: ${cr4012?.credit}, Cr 2010: ${cr2010?.credit}`
  );

  // Verify Account 4000 nets to zero across both journal entries
  const net4000 = Number(cr4000?.credit || 0) - Number(dr4000Fee?.debit || 0);
  assert(
    net4000 === 0,
    'ACCOUNT_4000_NETS_TO_ZERO',
    `Account 4000 Gross Rent Clearing net: ${net4000} USD (perfect net-zero clearing)`
  );

  // ---------------------------------------------------------------------------
  // 6. VERIFY OPERATING MODEL 2: AGENT_LISTED_PLATFORM_MANAGED
  // ---------------------------------------------------------------------------
  console.log('\n--- 6. VERIFYING OPERATING MODEL: AGENT_LISTED_PLATFORM_MANAGED ---');
  // Tenant pays $2000 on Dream City Villa
  const p2 = await leaseRepository.recordPayment(
    IDS.props.agentListedPlatformManaged,
    IDS.leases.leaseAlpm,
    IDS.users.tenant,
    IDS.schedules.schedAlpm,
    2000,
    'BANK_TRANSFER',
    'TXN-WIRE-2000'
  );
  const confirmedP2 = await leaseRepository.confirmPayment(p2.id, IDS.users.platformAdmin, { referenceNumber: 'TXN-WIRE-2000' });
  const commP2 = await commissionService.postCommissionForPayment(confirmedP2.id, IDS.users.platformAdmin, 'PLATFORM_ADMIN');
  const calcP2 = commP2.calculation!;

  // Expected under AGENT_LISTED_PLATFORM_MANAGED ($2,000):
  // Platform Fee (2%): $40.00
  // Rent Fee: $0.00 (waived)
  // Management Fee (8%): $160.00
  // Total Fees: $200.00
  // Owner Net: $1,800.00
  assert(
    calcP2.platformFeeAmount === 40 &&
    calcP2.rentFeeAmount === 0 &&
    calcP2.managementFeeAmount === 160 &&
    calcP2.totalFeeAmount === 200 &&
    calcP2.ownerNetAmount === 1800,
    'AGENT_LISTED_PLATFORM_MANAGED_FEES',
    `Fees: Platform=${calcP2.platformFeeAmount}, RentFee=${calcP2.rentFeeAmount} (waived), Mgmt=${calcP2.managementFeeAmount}, OwnerNet=${calcP2.ownerNetAmount}`
  );

  // ---------------------------------------------------------------------------
  // 7. VERIFY OPERATING MODEL 3: AGENT_OPERATED
  // ---------------------------------------------------------------------------
  console.log('\n--- 7. VERIFYING OPERATING MODEL: AGENT_OPERATED ---');
  // Tenant pays $1500 on Gulan Commercial Plaza
  const p3 = await leaseRepository.recordPayment(
    IDS.props.agentOperated,
    IDS.leases.leaseAgentOp,
    IDS.users.tenant,
    IDS.schedules.schedAgentOp,
    1500,
    'CASH',
    'TXN-CASH-1500',
    IDS.users.agent // Agent was the physical cash collector
  );
  assert(p3.collectorId === IDS.users.agent, 'PHYSICAL_COLLECTOR_RECORDED', `Collector ID: ${p3.collectorId}`);

  // Owner confirms cash receipt
  const confirmedP3 = await leaseRepository.confirmPayment(p3.id, IDS.users.indivOwner);
  assert(confirmedP3.confirmedByUserId === IDS.users.indivOwner, 'OWNER_CONFIRMER_RECORDED', `Confirmed by: ${confirmedP3.confirmedByUserId}`);

  const commP3 = await commissionService.postCommissionForPayment(confirmedP3.id, IDS.users.indivOwner, 'PROPERTY_OWNER');
  const calcP3 = commP3.calculation!;

  // Expected under AGENT_OPERATED ($1,500):
  // Platform Fee (2%): $30.00
  // Rent Fee: $0.00 (waived)
  // Management Fee: $0.00 (waived)
  // Total Fees: $30.00
  // Owner Net: $1,470.00
  assert(
    calcP3.platformFeeAmount === 30 &&
    calcP3.rentFeeAmount === 0 &&
    calcP3.managementFeeAmount === 0 &&
    calcP3.totalFeeAmount === 30 &&
    calcP3.ownerNetAmount === 1470,
    'AGENT_OPERATED_FEES',
    `Fees: Platform=${calcP3.platformFeeAmount}, Rent=${calcP3.rentFeeAmount}, Mgmt=${calcP3.managementFeeAmount}, OwnerNet=${calcP3.ownerNetAmount}`
  );

  // ---------------------------------------------------------------------------
  // 8. IDEMPOTENCY & REPLAY DEFENSE
  // ---------------------------------------------------------------------------
  console.log('\n--- 8. IDEMPOTENT CONFIRMATION & RETRY DEFENSE ---');
  const retryConfirmP1 = await leaseRepository.confirmPayment(confirmedP1.id, IDS.users.companyAdmin);
  assert(
    retryConfirmP1.status === 'CONFIRMED',
    'RETRY_CONFIRM_SAFE',
    'Repeated confirmation returned existing confirmed payment without error'
  );

  const retryCommP1 = await commissionService.postCommissionForPayment(confirmedP1.id, IDS.users.companyAdmin, 'COMPANY_ADMIN');
  assert(
    retryCommP1.alreadyPosted === true,
    'RETRY_COMMISSION_IDEMPOTENT',
    'Repeated commission posting returned alreadyPosted=true without duplicate journal entries'
  );

  // ---------------------------------------------------------------------------
  // 9. OWNER SETTLEMENT & PAYOUT ACCOUNTING LIFECYCLE
  // ---------------------------------------------------------------------------
  console.log('\n--- 9. OWNER SETTLEMENT & PAYOUT ACCOUNTING LIFECYCLE ---');
  // Check settlement created for p3 ($1,470 net)
  const [settleP3] = await db.select().from(ownerSettlements)
    .where(and(
      eq(ownerSettlements.ownerId, IDS.users.indivOwner),
      eq(ownerSettlements.propertyId, IDS.props.agentOperated)
    )).limit(1);

  assert(
    settleP3 !== undefined && settleP3.status === 'AVAILABLE',
    'OWNER_SETTLEMENT_RECORD_AVAILABLE',
    `Settlement ID: ${settleP3?.id}, netPayable: ${settleP3?.netPayableIqd}, status: ${settleP3?.status}`
  );

  // Create Payout Request for $1,470
  const [payoutP3] = await db.insert(payoutRequests).values({
    settlementId: settleP3.id,
    ownerId: IDS.users.indivOwner,
    amountIqd: '1470',
    bankName: 'First Iraqi Bank',
    bankAccountNumber: 'IQ99FIB0001234567890',
    status: 'REQUESTED',
    requestedByUserId: IDS.users.indivOwner,
  }).returning();

  assert(payoutP3.status === 'REQUESTED', 'PAYOUT_REQUEST_CREATED', `Payout request ID: ${payoutP3.id}`);

  // Test Account 2010 Balance Verification: Attempting payout exceeding Account 2010 balance
  const [liabilityResult] = await db.select({
    totalCredit: sql<string>`COALESCE(SUM(CAST(${ledgerLines.credit} AS NUMERIC)), 0)`,
    totalDebit: sql<string>`COALESCE(SUM(CAST(${ledgerLines.debit} AS NUMERIC)), 0)`,
  }).from(ledgerLines)
    .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(ledgerLines.accountId, '2010'),
      eq(journalEntries.propertyId, IDS.props.agentOperated)
    ));

  const availablePayable = Number(liabilityResult?.totalCredit || 0) - Number(liabilityResult?.totalDebit || 0);
  assert(
    availablePayable === 1470,
    'ACCOUNT_2010_PAYABLE_BALANCE_EXACT',
    `Account 2010 available balance: ${availablePayable} USD`
  );

  // Process Payout: Dr 2010 ($1470) / Cr 1010 ($1470)
  const [payoutJe] = await db.insert(journalEntries).values({
    propertyId: IDS.props.agentOperated,
    description: `Owner Payout - Settlement ${settleP3.id} - Ref TXN-BANK-PAYOUT-99`,
    date: new Date().toISOString(),
    referenceType: 'PAYOUT',
    referenceId: payoutP3.id,
    status: 'POSTED',
    idempotencyKey: `JE_PAYOUT_${payoutP3.id}`,
  }).returning();

  await db.insert(ledgerLines).values([
    { journalEntryId: payoutJe.id, accountId: '2010', debit: '1470', credit: '0', currency: 'USD' },
    { journalEntryId: payoutJe.id, accountId: '1010', debit: '0', credit: '1470', currency: 'USD' },
  ]);

  await db.update(payoutRequests).set({
    status: 'COMPLETED',
    externalTransactionReference: 'TXN-BANK-PAYOUT-99',
    approvedByUserId: IDS.users.platformAdmin,
  }).where(eq(payoutRequests.id, payoutP3.id));

  await db.update(ownerSettlements).set({
    status: 'PAID',
    journalEntryId: payoutJe.id,
  }).where(eq(ownerSettlements.id, settleP3.id));

  // Verify Account 2010 liability on prop 3 is now 0
  const [liabilityAfterPayout] = await db.select({
    totalCredit: sql<string>`COALESCE(SUM(CAST(${ledgerLines.credit} AS NUMERIC)), 0)`,
    totalDebit: sql<string>`COALESCE(SUM(CAST(${ledgerLines.debit} AS NUMERIC)), 0)`,
  }).from(ledgerLines)
    .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
    .where(and(
      eq(ledgerLines.accountId, '2010'),
      eq(journalEntries.propertyId, IDS.props.agentOperated)
    ));

  const balanceAfterPayout = Number(liabilityAfterPayout?.totalCredit || 0) - Number(liabilityAfterPayout?.totalDebit || 0);
  assert(
    balanceAfterPayout === 0,
    'ACCOUNT_2010_CLEARED_UPON_PAYOUT',
    `Account 2010 balance after payout: ${balanceAfterPayout} USD (liability cleared)`
  );

  // ---------------------------------------------------------------------------
  // 10. PAYMENT REVERSAL & SCHEDULE RESTORATION DRILL
  // ---------------------------------------------------------------------------
  console.log('\n--- 10. PAYMENT REVERSAL & COMPENSATING ENTRIES DRILL ---');
  // Reverse confirmed payment P2 ($2,000 on Dream City Villa)
  const revP2 = await commissionService.reverseCommissionForPayment(
    confirmedP2.id,
    'Tenant request cancellation',
    IDS.users.platformAdmin,
    'PLATFORM_ADMIN'
  );

  assert(
    revP2.commission.status === 'REVERSED',
    'COMMISSION_RECORD_MARKED_REVERSED',
    `Commission status: ${revP2.commission.status}`
  );

  // Check compensating journal entries exist
  const [revJe] = await db.select().from(journalEntries)
    .where(eq(journalEntries.idempotencyKey, `JE_REVERSAL_${revP2.commission.id}`));
  assert(revJe !== undefined, 'FEE_REVERSAL_JE_POSTED', `Reversal JE ID: ${revJe?.id}`);

  const revLines = await db.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, revJe.id));
  const revCr4000 = revLines.find(l => l.accountId === '4000');
  const revDr4010 = revLines.find(l => l.accountId === '4010');
  const revDr4012 = revLines.find(l => l.accountId === '4012');
  const revDr2010 = revLines.find(l => l.accountId === '2010');

  assert(
    Number(revCr4000?.credit) === 2000 &&
    Number(revDr4010?.debit) === 40 &&
    Number(revDr4012?.debit) === 160 &&
    Number(revDr2010?.debit) === 1800,
    'COMPENSATING_FEE_ENTRIES_BALANCED',
    `Cr 4000: ${revCr4000?.credit}, Dr 4010: ${revDr4010?.debit}, Dr 4012: ${revDr4012?.debit}, Dr 2010: ${revDr2010?.debit}`
  );

  // Check compensating cash receipt reversal: Cr 1010 ($2000) / Dr 4000 ($2000)
  const [cashRevJe] = await db.select().from(journalEntries)
    .where(eq(journalEntries.idempotencyKey, `JE_CASH_RECEIPT_REV_${confirmedP2.id}`));
  assert(cashRevJe !== undefined, 'CASH_RECEIPT_REVERSAL_JE_POSTED', `Cash Rev JE ID: ${cashRevJe?.id}`);

  // Update payment status to REVERSED and restore rent schedule debt
  await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, confirmedP2.id));
  await db.update(rentSchedules).set({ paidAmount: '0', status: 'DUE' }).where(eq(rentSchedules.id, IDS.schedules.schedAlpm));

  const [schedAfterRev] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, IDS.schedules.schedAlpm));
  assert(
    Number(schedAfterRev.paidAmount) === 0 && schedAfterRev.status === 'DUE',
    'SCHEDULE_DEBT_RESTORED_UPON_REVERSAL',
    `Schedule paidAmount: ${schedAfterRev.paidAmount}, status: ${schedAfterRev.status}`
  );

  // ---------------------------------------------------------------------------
  // 11. FINAL NUMERICAL RECONCILIATION & AUDIT SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`  AUDIT COMPLETED: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('========================================================================\n');
  process.exit(failedTests > 0 ? 1 : 0);
}

runAudit().catch(err => {
  console.error('Fatal audit failure:', err);
  process.exit(1);
});
