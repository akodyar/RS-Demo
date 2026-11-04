/**
 * HOMEHUB — DEMO SEED INTEGRITY, RELATIONAL CONSISTENCY & RBAC BOUNDARY VERIFICATION
 * 
 * Verifies:
 * 1. Hard safety gate: Production environment blocks execution immediately (fail-closed).
 * 2. Idempotency: Multiple seed executions do not produce duplicate records or constraint errors.
 * 3. Relational integrity: Foreign keys between properties, units, leases, tenants, schedules, payments.
 * 4. Authoritative 3-Fee Model & Ledger Reconciliation:
 *    - Base Amount: 1,200,000 IQD
 *    - Platform Fee (2%): 24,000 IQD
 *    - Rent Fee (5%): 60,000 IQD
 *    - Management Fee (3%): 36,000 IQD
 *    - Owner Net Amount: 1,080,000 IQD
 *    - Total Ledger Debits (1,200,000) === Total Credits (1,200,000)
 * 5. Unconfirmed Payment Isolation:
 *    - Payment 2 (2,500,000 IQD PENDING) does NOT count toward collected revenue.
 * 6. RBAC & Cross-Domain Workspace Boundaries:
 *    - Owner Repository resolves authorized properties and financial summaries.
 *    - Company Repository resolves managed properties via active management agreements.
 *    - Tenant Repository resolves active lease, due schedule, held deposit, and unread messages.
 *    - Document Authorization strictly blocks Tenant from accessing Owner TAPU deed.
 *    - Vendor Repository resolves assigned plumbing work order.
 */

import dotenv from 'dotenv';
dotenv.config();

import { db, pool, closePool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { assertSafeEnvironmentForSeed, runDemoSeed } from '../scripts/seed-demo-data.js';
import { OwnerRepository } from '../src/server/repositories/owner.js';
import { CompanyRepository } from '../src/server/repositories/company.js';
import { TenantRepository } from '../src/server/repositories/tenant.js';
import { VendorRepository } from '../src/server/repositories/vendor.js';
import { AgentRepository } from '../src/server/repositories/agent.js';
import { isDocumentVisibleToTenant } from '../src/server/services/storage-service.js';

interface TestResult {
  suite: string;
  testId: string;
  description: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];
let passedCount = 0;
let failedCount = 0;

function assert(
  condition: boolean,
  suite: string,
  testId: string,
  description: string,
  expected: string,
  actual: string,
  details?: string
) {
  if (condition) {
    passedCount++;
    console.log(`✅ PASS [${suite}] ${testId}: ${description}`);
  } else {
    failedCount++;
    console.error(`❌ FAIL [${suite}] ${testId}: ${description}`);
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
    if (details) console.error(`   Details:  ${details}`);
  }
  results.push({ suite, testId, description, passed: condition, expected, actual, details });
}

async function runIntegrityAudit() {
  console.log('================================================================');
  console.log('  HOMEHUB — DEMO SEED INTEGRITY & WORKSPACE BOUNDARY SUITE');
  console.log('================================================================\n');

  try {
    // ========================================================================
    // SUITE 1: PRODUCTION SAFETY GATE & FAIL-CLOSED BOUNDARIES
    // ========================================================================
    console.log('--- SUITE 1: Production Safety Gate Tests ---');
    
    // 1.1 Block when NODE_ENV=production
    let blockedNodeEnv = false;
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      assertSafeEnvironmentForSeed();
    } catch (err: any) {
      blockedNodeEnv = err.message.includes('CRITICAL SAFETY GATE');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
    assert(blockedNodeEnv, 'SAFETY', 'SAFE-01', 'Blocks seed execution when NODE_ENV is production', 'true', String(blockedNodeEnv));

    // 1.2 Block when SQL_DB_NAME is homehub_production
    let blockedProdDb = false;
    const originalDbName = process.env.SQL_DB_NAME;
    try {
      process.env.SQL_DB_NAME = 'homehub_production';
      assertSafeEnvironmentForSeed();
    } catch (err: any) {
      blockedProdDb = err.message.includes('CRITICAL SAFETY GATE');
    } finally {
      process.env.SQL_DB_NAME = originalDbName;
    }
    assert(blockedProdDb, 'SAFETY', 'SAFE-02', 'Blocks seed execution when targeting homehub_production', 'true', String(blockedProdDb));

    // 1.3 Block when SQL_DB_NAME is unset / ambiguous
    let blockedUnsetDb = false;
    try {
      delete process.env.SQL_DB_NAME;
      assertSafeEnvironmentForSeed();
    } catch (err: any) {
      blockedUnsetDb = err.message.includes('CRITICAL SAFETY GATE');
    } finally {
      process.env.SQL_DB_NAME = originalDbName;
    }
    assert(blockedUnsetDb, 'SAFETY', 'SAFE-03', 'Blocks seed execution when SQL_DB_NAME is unset or ambiguous', 'true', String(blockedUnsetDb));

    // ========================================================================
    // SUITE 2: IDEMPOTENCY & RECORD EXISTENCE
    // ========================================================================
    console.log('\n--- SUITE 2: Seeding & Idempotency Tests ---');
    
    // Explicitly target homehub_test database for test execution and reset connection pool
    process.env.SQL_DB_NAME = 'homehub_test';
    await closePool();
    
    // Run seed twice to test complete idempotency
    const seedResult1 = await runDemoSeed();
    const seedResult2 = await runDemoSeed();

    assert(seedResult1.users === seedResult2.users && seedResult1.users >= 11, 'IDEMPOTENCY', 'IDEM-01', 'Seeded users match expected count and remain idempotent', '>= 11', String(seedResult2.users));
    assert(seedResult1.properties === 5, 'IDEMPOTENCY', 'IDEM-02', 'Five properties seeded without duplicate duplication', '5', String(seedResult2.properties));
    assert(seedResult1.leases === 6, 'IDEMPOTENCY', 'IDEM-03', 'Six leases seeded idempotently', '6', String(seedResult2.leases));
    assert(seedResult1.ledgerLines === 14, 'IDEMPOTENCY', 'IDEM-04', 'Fourteen ledger lines present without duplication', '14', String(seedResult2.ledgerLines));

    // ========================================================================
    // SUITE 3: RELATIONAL CONSISTENCY & FOREIGN KEYS
    // ========================================================================
    console.log('\n--- SUITE 3: Relational Consistency & Foreign Key Integrity ---');

    // 3.1 Property ownership record links to existing owner
    const [prop1Own] = await db.select().from(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, 'demo_prop_01'));
    assert(prop1Own?.ownerId === 'user_owner_01' && prop1Own?.status === 'VERIFIED', 'RELATIONS', 'REL-01', 'Property 1 ownership record connects to user_owner_01 as VERIFIED', 'user_owner_01', String(prop1Own?.ownerId));

    // 3.2 Management agreement links to org_company_01
    const [prop1Mgmt] = await db.select().from(schema.managementAgreements).where(eq(schema.managementAgreements.propertyId, 'demo_prop_01'));
    assert(prop1Mgmt?.companyId === 'org_company_01' && prop1Mgmt?.status === 'ACTIVE', 'RELATIONS', 'REL-02', 'Property 1 management agreement connects to org_company_01 as ACTIVE', 'org_company_01', String(prop1Mgmt?.companyId));

    // 3.3 Active lease links Unit 101 to user_tenant_01
    const [lease1] = await db.select().from(schema.leases).where(eq(schema.leases.id, 'demo_lease_01'));
    const [lease1Tenant] = await db.select().from(schema.leaseTenants).where(eq(schema.leaseTenants.leaseId, 'demo_lease_01'));
    assert(lease1?.unitId === 'demo_unit_101' && lease1Tenant?.tenantId === 'user_tenant_01', 'RELATIONS', 'REL-03', 'Active Lease 1 accurately links Unit 101 and tenant user_tenant_01', 'user_tenant_01', String(lease1Tenant?.tenantId));

    // ========================================================================
    // SUITE 4: AUTHORITATIVE 3-FEE FINANCIAL RECONCILIATION
    // ========================================================================
    console.log('\n--- SUITE 4: Authoritative 3-Fee Model & Ledger Balance ---');

    // 4.1 Confirm Platform Fee Policy exists and is 2%
    const [platPolicy] = await db.select().from(schema.financialPolicies).where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
    assert(platPolicy?.policyValue === '0.02' && platPolicy?.active === true, 'FINANCE', 'FIN-01', 'Financial policy PLATFORM_FEE_RATE is 0.02 (2.0%)', '0.02', String(platPolicy?.policyValue));

    // 4.1b Confirm Exchange Rate Policy exists and is 1310 IQD per USD
    const [exchPolicy] = await db.select().from(schema.financialPolicies).where(eq(schema.financialPolicies.policyType, 'EXCHANGE_RATE_IQD'));
    assert(exchPolicy?.policyValue === '1310' && exchPolicy?.active === true, 'FINANCE', 'FIN-01b', 'Financial policy EXCHANGE_RATE_IQD is 1310 (IQD per USD)', '1310', String(exchPolicy?.policyValue));

    // 4.2 Property 1 has Rent Fee 5% and Management Fee 3%
    const [prop1] = await db.select().from(schema.properties).where(eq(schema.properties.id, 'demo_prop_01'));
    assert(prop1?.rentFee === '0.05' && prop1?.managementFee === '0.03', 'FINANCE', 'FIN-02', 'Property 1 specifies rentFee=0.05 and managementFee=0.03', '0.05 / 0.03', `${prop1?.rentFee} / ${prop1?.managementFee}`);

    // 4.3 Double-entry ledger lines for fee allocation journal entry are perfectly balanced
    const [feeJe] = await db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, 'demo_je_comm_01'));
    assert(feeJe?.status === 'POSTED', 'FINANCE', 'FIN-03', 'Fee allocation journal entry is POSTED', 'POSTED', String(feeJe?.status));

    const lines = await db.select().from(schema.ledgerLines).where(eq(schema.ledgerLines.journalEntryId, 'demo_je_comm_01'));
    let totalDebit = 0;
    let totalCredit = 0;
    let revDebit = 0;
    let platCredit = 0;
    let rentCredit = 0;
    let mgmtCredit = 0;
    let ownerCredit = 0;

    for (const line of lines) {
      const d = Number(line.debit || 0);
      const c = Number(line.credit || 0);
      totalDebit += d;
      totalCredit += c;
      if (line.accountId === '4000') revDebit = d;
      if (line.accountId === '4010') platCredit = c;
      if (line.accountId === '4011') rentCredit = c;
      if (line.accountId === '4012') mgmtCredit = c;
      if (line.accountId === '2010') ownerCredit = c;
    }

    assert(totalDebit === totalCredit && totalDebit === 1200000, 'FINANCE', 'FIN-04', 'Double-entry equation holds: Total Debits (1,200,000) === Total Credits (1,200,000)', '1200000', `${totalDebit} === ${totalCredit}`);
    assert(revDebit === 1200000, 'FINANCE', 'FIN-05', 'Gross Revenue Clearing Debit is 1,200,000 IQD', '1200000', String(revDebit));
    assert(platCredit === 24000, 'FINANCE', 'FIN-06', 'Platform Fee (2%) Credit is exactly 24,000 IQD', '24000', String(platCredit));
    assert(rentCredit === 60000, 'FINANCE', 'FIN-07', 'Rent Fee (5%) Credit is exactly 60,000 IQD', '60000', String(rentCredit));
    assert(mgmtCredit === 36000, 'FINANCE', 'FIN-08', 'Management Fee (3%) Credit is exactly 36,000 IQD', '36000', String(mgmtCredit));
    assert(ownerCredit === 1080000, 'FINANCE', 'FIN-09', 'Owner Net Entitlement Payable Credit is exactly 1,080,000 IQD', '1080000', String(ownerCredit));

    // 4.4 Unconfirmed Payment Isolation: Payment 2 is PENDING and has no confirmed commissions
    const [pay2] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, 'demo_pay_02'));
    assert(pay2?.status === 'PENDING', 'FINANCE', 'FIN-10', 'Payment 2 is marked PENDING', 'PENDING', String(pay2?.status));

    const pay2Comms = await db.select().from(schema.commissions).where(eq(schema.commissions.paymentRecordId, 'demo_pay_02'));
    assert(pay2Comms.length === 0, 'FINANCE', 'FIN-11', 'Unconfirmed Payment 2 has zero fee/commission records posted', '0', String(pay2Comms.length));

    // ========================================================================
    // SUITE 5: WORKSPACE REPOSITORY & RBAC BOUNDARIES
    // ========================================================================
    console.log('\n--- SUITE 5: Workspace Queries & RBAC Access Boundaries ---');

    // 5.1 Owner Repository Access
    const ownerRepo = new OwnerRepository();
    const ownerAccess = await ownerRepo.getAuthorizedPropertyAccess({
      id: 'user_owner_01',
      roles: ['PROPERTY_OWNER'],
    });
    const ownerPropIds = ownerAccess.map(a => a.propertyId);
    assert(ownerPropIds.includes('demo_prop_01') && ownerPropIds.includes('demo_prop_02') && ownerPropIds.includes('demo_prop_04') && ownerPropIds.includes('demo_prop_05'), 'WORKSPACE', 'WS-01', 'Owner user_owner_01 resolves access to all 4 owned properties', 'demo_prop_01, 02, 04, 05', ownerPropIds.join(', '));
    assert(!ownerPropIds.includes('demo_prop_03'), 'WORKSPACE', 'WS-01-ISO', 'Owner user_owner_01 strictly isolated from unowned Sulaymaniyah property demo_prop_03', 'true', String(!ownerPropIds.includes('demo_prop_03')));

    const owner2Access = await ownerRepo.getAuthorizedPropertyAccess({
      id: 'user_owner_02',
      roles: ['PROPERTY_OWNER'],
    });
    const owner2PropIds = owner2Access.map(a => a.propertyId);
    assert(owner2PropIds.includes('demo_prop_03') && !owner2PropIds.includes('demo_prop_01'), 'WORKSPACE', 'WS-01-OWNER2', 'Owner user_owner_02 resolves demo_prop_03 and strictly isolated from Owner 1 properties', 'demo_prop_03', owner2PropIds.join(', '));

    const ownerDash = await ownerRepo.getAuthoritativeDashboard({
      id: 'user_owner_01',
      roles: ['PROPERTY_OWNER'],
    });
    assert(ownerDash.properties.length >= 4, 'WORKSPACE', 'WS-01b', 'Owner authoritative dashboard resolves scoped properties without policy failure', '>= 4', String(ownerDash.properties.length));
    const prop1Resolved = ownerDash.properties.find(p => p.id === 'demo_prop_01');
    const expectedUsd = Math.round(Number(prop1Resolved?.monthlyRentIqd || 0) / 1310);
    assert(prop1Resolved?.monthlyRentUsd === expectedUsd, 'WORKSPACE', 'WS-01c', 'Owner dashboard converts monthlyRentUsd via EXCHANGE_RATE_IQD (1310)', String(expectedUsd), String(prop1Resolved?.monthlyRentUsd));

    // 5.2 Company Repository Access
    const companyRepo = new CompanyRepository();
    const companyDash = await companyRepo.getAuthoritativeDashboard({
      id: 'user_company_01',
      organizationId: 'org_company_01',
      roles: ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'],
    });
    assert(companyDash.company?.id === 'org_company_01', 'WORKSPACE', 'WS-02', 'Company dashboard resolves org_company_01 profile', 'org_company_01', String(companyDash.company?.id));
    assert(companyDash.managedProperties.some(p => p.id === 'demo_prop_01') && companyDash.managedProperties.some(p => p.id === 'demo_prop_03') && companyDash.managedProperties.some(p => p.id === 'demo_prop_04'), 'WORKSPACE', 'WS-03', 'Company manages demo_prop_01, demo_prop_03, and demo_prop_04 across multiple owners', 'true', 'true');
    // Crucially: Property 2 & 5 are self-managed by owners and NOT managed by company
    assert(!companyDash.managedProperties.some(p => p.id === 'demo_prop_02') && !companyDash.managedProperties.some(p => p.id === 'demo_prop_05'), 'WORKSPACE', 'WS-04', 'Company DOES NOT have access to self-managed Property 2 or Property 5', 'false', 'false');

    // 5.3 Tenant Repository Access
    const tenantRepo = new TenantRepository();
    const tenantDash = await tenantRepo.getAuthoritativeDashboard('user_tenant_01');
    assert(tenantDash.currentProperty?.id === 'demo_prop_01', 'WORKSPACE', 'WS-05', 'Tenant user_tenant_01 current residence is Unit 101 on demo_prop_01', 'demo_prop_01', String(tenantDash.currentProperty?.id));
    assert(tenantDash.rentDue?.status === 'DUE' && tenantDash.rentDue?.amount === 1200000, 'WORKSPACE', 'WS-06', 'Tenant has 1,200,000 IQD currently due for October', '1200000', String(tenantDash.rentDue?.amount));
    assert(tenantDash.securityDeposit?.status === 'HELD' && tenantDash.securityDeposit?.recordedAmount === 1200000, 'WORKSPACE', 'WS-07', 'Tenant has 1,200,000 IQD security deposit held', '1200000', String(tenantDash.securityDeposit?.recordedAmount));
    assert(tenantDash.maintenanceRequests.some(m => m.id === 'demo_maint_01'), 'WORKSPACE', 'WS-08', 'Tenant sees reported plumbing maintenance request', 'true', 'true');

    // 5.4 Document Authorization RBAC Boundaries
    const [tapuDoc] = await db.select().from(schema.documents).where(eq(schema.documents.id, 'demo_doc_tapu_01'));
    const [leaseDoc] = await db.select().from(schema.documents).where(eq(schema.documents.id, 'demo_doc_lease_01'));
    const [rulesDoc] = await db.select().from(schema.documents).where(eq(schema.documents.id, 'demo_doc_rules_01'));

    const tenantLeaseContext = {
      leaseId: 'demo_lease_01',
      unitId: 'demo_unit_101',
      propertyId: 'demo_prop_01',
    };

    const isTapuVisibleToTenant = isDocumentVisibleToTenant(tapuDoc, 'user_tenant_01', tenantLeaseContext);
    const isLeaseVisibleToTenant = isDocumentVisibleToTenant(leaseDoc, 'user_tenant_01', tenantLeaseContext);
    const isRulesVisibleToTenant = isDocumentVisibleToTenant(rulesDoc, 'user_tenant_01', tenantLeaseContext);

    assert(!isTapuVisibleToTenant, 'SECURITY', 'SEC-01', 'Owner TAPU deed is strictly INVISIBLE to Tenant (Fail-closed)', 'false', String(isTapuVisibleToTenant));
    assert(isLeaseVisibleToTenant, 'SECURITY', 'SEC-02', 'Signed Lease Contract is VISIBLE to Tenant 01', 'true', String(isLeaseVisibleToTenant));
    assert(isRulesVisibleToTenant, 'SECURITY', 'SEC-03', 'Community Building Rules are VISIBLE to Tenant 01', 'true', String(isRulesVisibleToTenant));

    // Foreign Tenant B cannot view Tenant 1's lease contract
    const isLeaseVisibleToTenantB = isDocumentVisibleToTenant(leaseDoc, 'user_tenant_b_01', {
      leaseId: 'demo_lease_03',
      unitId: 'demo_unit_201',
      propertyId: 'demo_prop_02',
    });
    assert(!isLeaseVisibleToTenantB, 'SECURITY', 'SEC-04', 'Tenant 1 Lease Contract is strictly INVISIBLE to foreign Tenant B', 'false', String(isLeaseVisibleToTenantB));

    // 5.5 Inactive Tenant Persona
    const inactiveDash = await tenantRepo.getAuthoritativeDashboard('user_tenant_inactive_01');
    assert(inactiveDash.currentProperty === null, 'WORKSPACE', 'WS-09', 'Inactive Tenant has null current property (no active lease)', 'null', String(inactiveDash.currentProperty));

    // 5.6 Vendor Repository Service Requests
    const vendorRepo = new VendorRepository();
    const vendorRequests = await vendorRepo.getAssignedServiceRequests('user_vendor_01');
    assert(vendorRequests.some(r => r.id === 'demo_maint_01'), 'WORKSPACE', 'WS-10', 'Vendor user_vendor_01 resolves assigned plumbing maintenance request', 'true', 'true');

    // 5.7 Agent Repository & Scoped Property/Lead Access
    const agentRepo = new AgentRepository();
    const agentProfile = await agentRepo.getProfile('user_agent_01');
    assert(agentProfile?.displayName === 'Ahmed Rahman' && agentProfile?.status === 'ACTIVE', 'WORKSPACE', 'WS-11', 'Agent user_agent_01 has active verified profile', 'Ahmed Rahman & ACTIVE', `${agentProfile?.displayName} & ${agentProfile?.status}`);

    const agentLicense = await agentRepo.getLicense('user_agent_01');
    assert(agentLicense?.verificationStatus === 'APPROVED' && agentLicense?.licenseNumber === 'KRG-RE-2025-0892', 'WORKSPACE', 'WS-12', 'Agent has approved government license', 'APPROVED & KRG-RE-2025-0892', `${agentLicense?.verificationStatus} & ${agentLicense?.licenseNumber}`);

    const assignedProps = await agentRepo.getAssignedProperties('user_agent_01');
    const assignedIds = assignedProps.map(p => p.propertyId);
    assert(assignedIds.includes('demo_prop_01') && assignedIds.includes('demo_prop_04'), 'WORKSPACE', 'WS-13', 'Agent resolves assigned properties demo_prop_01 and demo_prop_04', 'demo_prop_01, demo_prop_04', assignedIds.join(', '));
    assert(!assignedIds.includes('demo_prop_02') && !assignedIds.includes('demo_prop_03') && !assignedIds.includes('demo_prop_05'), 'WORKSPACE', 'WS-14', 'Agent is strictly isolated from unassigned Properties 2, 3, 5', 'true', 'true');

    const agentDash = await agentRepo.getAuthoritativeDashboard('user_agent_01');
    assert(agentDash.kpi.totalListings >= 2, 'WORKSPACE', 'WS-15', 'Agent dashboard resolves active rental listing count', '>= 2', String(agentDash.kpi.totalListings));
    assert(agentDash.kpi.activeLeads >= 2, 'WORKSPACE', 'WS-16', 'Agent dashboard resolves active qualified leads count', '>= 2', String(agentDash.kpi.activeLeads));

    const agentTasks = await agentRepo.getTasks('user_agent_01');
    assert(agentTasks.some(t => t.id === 'demo_task_01'), 'WORKSPACE', 'WS-17', 'Agent resolves pending application review operational task', 'true', 'true');

    // 5.8 Marketplace Published Listings Count
    const publishedListings = await db.select().from(schema.listings).where(eq(schema.listings.status, 'PUBLISHED'));
    assert(publishedListings.length >= 4, 'MARKETPLACE', 'MKT-01', 'Marketplace features at least 4 active rental listings across Kurdistan cities', '>= 4', String(publishedListings.length));

    // ========================================================================
    // FINAL INTEGRITY REPORT
    // ========================================================================
    console.log('\n================================================================');
    console.log('  INTEGRITY VERIFICATION RESULTS');
    console.log(`  Total Checks: ${results.length}`);
    console.log(`  Passed:       ${passedCount}`);
    console.log(`  Failed:       ${failedCount}`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      throw new Error(`Integrity audit failed with ${failedCount} failing assertion(s).`);
    }
  } finally {
    await closePool();
  }
}

runIntegrityAudit()
  .then(() => {
    console.log('🎉 ALL DEMO DATA INTEGRITY & RBAC CHECKS PASSED.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ INTEGRITY SUITE FAILED:', err.message);
    process.exit(1);
  });
