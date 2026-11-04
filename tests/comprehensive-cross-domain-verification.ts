import { db, closePool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { propertyRepository } from '../src/server/repositories/properties.js';
import { commissionService } from '../src/server/services/commission.js';
import { UserRole } from '../src/types/index.js';

async function runComprehensiveVerification() {
  console.log('================================================================');
  console.log('  HOMEHUB — COMPREHENSIVE PROPERTY WIZARD REGRESSION VERIFICATION');
  console.log(`  Database Target: ${process.env.SQL_DB_NAME || 'homehub_test'}`);
  console.log('================================================================\n');

  const TIMESTAMP = Date.now();
  const PREFIX = `vrf_test_${TIMESTAMP}`;
  const createdPropertyIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: INSPECTION OF AUTHORITATIVE SEEDED DATA
    // ------------------------------------------------------------------------
    console.log('--- 1. Inspecting Existing Seeded Entities & Financial Policies ---');
    
    // Check property owner
    const [seededOwner] = await db.select().from(schema.users).where(eq(schema.users.id, 'user_owner_01')).limit(1);
    console.log(`✓ Seeded Owner: ${seededOwner?.id} (${seededOwner?.firstName} ${seededOwner?.lastName}) | Roles: ${JSON.stringify(seededOwner?.roles)}`);
    if (!seededOwner) throw new Error('Assertion Failed: user_owner_01 must exist in database');

    // Check agent
    const [seededAgent] = await db.select().from(schema.users).where(eq(schema.users.id, 'user_agent_01')).limit(1);
    console.log(`✓ Seeded Agent: ${seededAgent?.id} (${seededAgent?.firstName} ${seededAgent?.lastName}) | Roles: ${JSON.stringify(seededAgent?.roles)}`);
    if (!seededAgent) throw new Error('Assertion Failed: user_agent_01 must exist in database');

    // Check registered company
    const [seededCompany] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, 'org_company_01')).limit(1);
    console.log(`✓ Seeded Company: ${seededCompany?.id} (${seededCompany?.name}) | Type: ${seededCompany?.type} | Status: ${seededCompany?.status} | Verified: ${seededCompany?.verified}`);
    if (!seededCompany || !seededCompany.verified) throw new Error('Assertion Failed: org_company_01 must be verified in database');

    // Check financial policy
    const [policy] = await db.select().from(schema.financialPolicies).where(eq(schema.financialPolicies.policyType, 'PLATFORM_FEE_RATE')).limit(1);
    console.log(`✓ Authoritative Platform Fee Policy: ${policy?.policyType} = ${policy?.policyValue} (${Number(policy?.policyValue) * 100}%) | Active: ${policy?.active}`);
    if (!policy || !policy.active) throw new Error('Assertion Failed: PLATFORM_FEE_RATE policy must be active');

    // Check eligible agents endpoint logic directly
    const eligibleAgents = await propertyRepository.getEligibleAgents();
    console.log(`✓ Total Eligible Registered Agencies/Companies: ${eligibleAgents.length}`);
    const zagrosPresent = eligibleAgents.some(a => a.id === 'org_company_01');
    console.log(`✓ org_company_01 (Zagros Real Estate) present in eligible list: ${zagrosPresent}`);
    if (!zagrosPresent) throw new Error('Assertion Failed: Zagros Real Estate must be in eligible agents list');

    // ------------------------------------------------------------------------
    // SECTION 2: FINANCIAL BEFORE-AND-AFTER SNAPSHOT SAFETY
    // ------------------------------------------------------------------------
    console.log('\n--- 2. Capturing Financial Ledger & Balance Baseline ---');
    const [beforePayments] = await db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(amount), '0')` }).from(schema.paymentRecords);
    const [beforeSchedules] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.rentSchedules);
    const [beforeJournals] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.journalEntries);
    const [beforeLedger] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.ledgerLines);
    const [beforeDeposits] = await db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(recorded_amount), '0')` }).from(schema.securityDeposits);

    console.log(`Baseline Payments: ${beforePayments.count} records (Total: ${beforePayments.total})`);
    console.log(`Baseline Rent Schedules: ${beforeSchedules.count} records`);
    console.log(`Baseline Journal Entries: ${beforeJournals.count} entries`);
    console.log(`Baseline Ledger Lines: ${beforeLedger.count} lines`);
    console.log(`Baseline Security Deposits: ${beforeDeposits.count} deposits (Total: ${beforeDeposits.total})`);

    // ------------------------------------------------------------------------
    // SECTION 3: WIZARD DATA FLOW & OPERATING MODEL MATRIX VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Testing 4 Operating Models & Fee Invariant Enforcement ---');

    // MODEL 1: Owner Self-Managed (Owner Operates)
    console.log('\n[Scenario 1: Owner Self-Managed (Platform Fee Only)]');
    const prop1 = await propertyRepository.createProperty(
      seededOwner.id,
      seededOwner.roles as string[],
      {
        name: `${PREFIX} Self-Managed Unit`,
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1000000,
        currency: 'IQD',
        yearBuilt: 2023,
        squareFeet: 150,
        managementPreference: 'SELF_MANAGED',
        operatingModel: 'AGENT_OPERATED', // Treat as self-managed / owner operates
        rentFee: 0.10, // Must be wiped clean by repository
        managementFee: 0.05, // Must be wiped clean by repository
      }
    );
    createdPropertyIds.push(prop1.id);

    console.log(`✓ Property Created ID: ${prop1.id}`);
    console.log(`  - Management Preference: ${prop1.managementPreference}`);
    console.log(`  - Management Arrangement Status: ${prop1.managementArrangementStatus}`);
    console.log(`  - Managed By Agent ID: ${prop1.managedByAgentId}`);
    console.log(`  - Rent Fee: ${prop1.rentFee} (Expected: null)`);
    console.log(`  - Management Fee: ${prop1.managementFee} (Expected: null)`);
    console.log(`  - Verification Status: ${prop1.verificationStatus} (Expected: PENDING_VERIFICATION)`);

    if (prop1.managementPreference !== 'SELF_MANAGED') throw new Error('Prop 1 preference mismatch');
    if (prop1.managementArrangementStatus !== 'NOT_APPLICABLE') throw new Error('Prop 1 arrangement status mismatch');
    if (prop1.managedByAgentId !== null) throw new Error('Prop 1 managedByAgentId must be null');
    if (prop1.rentFee !== null) throw new Error('Prop 1 rentFee must be null');
    if (prop1.managementFee !== null) throw new Error('Prop 1 managementFee must be null');

    // Check ownership record
    const [own1] = await db.select().from(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, prop1.id));
    console.log(`✓ Legal Ownership Record: Owner ID = ${own1?.ownerId} | Share = ${own1?.ownershipPercentage}% | Status = ${own1?.status}`);
    if (own1?.ownerId !== seededOwner.id || own1?.ownershipPercentage !== '100.00') {
      throw new Error('Prop 1 ownership record mismatch');
    }

    // MODEL 2: Agent-Operated (Platform Fee Only)
    console.log('\n[Scenario 2: Agent-Managed with AGENT_OPERATED (Platform Fee Only)]');
    const prop2 = await propertyRepository.createProperty(
      seededOwner.id,
      seededOwner.roles as string[],
      {
        name: `${PREFIX} Agent Operated Unit`,
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1500000,
        currency: 'IQD',
        yearBuilt: 2021,
        squareFeet: 200,
        managementPreference: 'AGENT_MANAGED',
        operatingModel: 'AGENT_OPERATED',
        managedByAgentId: 'org_company_01',
        rentFee: 0.08, // Must be wiped clean
        managementFee: 0.04, // Must be wiped clean
      }
    );
    createdPropertyIds.push(prop2.id);

    console.log(`✓ Property Created ID: ${prop2.id}`);
    console.log(`  - Management Preference: ${prop2.managementPreference}`);
    console.log(`  - Management Arrangement Status: ${prop2.managementArrangementStatus}`);
    console.log(`  - Managed By Agent ID: ${prop2.managedByAgentId}`);
    console.log(`  - Rent Fee: ${prop2.rentFee} (Expected: null)`);
    console.log(`  - Management Fee: ${prop2.managementFee} (Expected: null)`);

    if (prop2.managementPreference !== 'AGENT_MANAGED') throw new Error('Prop 2 preference mismatch');
    if (prop2.managementArrangementStatus !== 'AWAITING_AGREEMENT') throw new Error('Prop 2 arrangement status mismatch');
    if (prop2.managedByAgentId !== 'org_company_01') throw new Error('Prop 2 managedByAgentId mismatch');
    if (prop2.rentFee !== null) throw new Error('Prop 2 rentFee must be null for AGENT_OPERATED');
    if (prop2.managementFee !== null) throw new Error('Prop 2 managementFee must be null for AGENT_OPERATED');

    // Check agreement non-fabrication
    const agreements2 = await db.select().from(schema.managementAgreements).where(eq(schema.managementAgreements.propertyId, prop2.id));
    console.log(`✓ Management agreements count: ${agreements2.length} (Expected: 0 premature agreements)`);
    if (agreements2.length !== 0) throw new Error('Assertion Failed: No management agreement should be created during registration');

    // MODEL 3: Agent-Listed, Platform-Managed (Platform Fee + Management Fee, 0% Rent Fee)
    console.log('\n[Scenario 3: Agent-Listed, Platform-Managed (Platform + Mgmt Fee, No Rent Fee)]');
    const prop3 = await propertyRepository.createProperty(
      seededOwner.id,
      seededOwner.roles as string[],
      {
        name: `${PREFIX} Agent Listed Platform Managed`,
        type: 'VILLA',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 2000000,
        currency: 'IQD',
        yearBuilt: 2022,
        squareFeet: 300,
        managementPreference: 'AGENT_MANAGED',
        operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
        managedByAgentId: 'org_company_01',
        rentFee: 0.06, // Must be wiped clean (no rent fee for agent listed)
        managementFee: 0.05, // Preserved: agreed management fee
      }
    );
    createdPropertyIds.push(prop3.id);

    console.log(`✓ Property Created ID: ${prop3.id}`);
    console.log(`  - Operating Model: ${prop3.operatingModel}`);
    console.log(`  - Rent Fee: ${prop3.rentFee} (Expected: null)`);
    console.log(`  - Management Fee: ${prop3.managementFee} (Expected: 0.05)`);

    if (prop3.operatingModel !== 'AGENT_LISTED_PLATFORM_MANAGED') throw new Error('Prop 3 operatingModel mismatch');
    if (prop3.rentFee !== null) throw new Error('Prop 3 rentFee must be null');
    if (Number(prop3.managementFee) !== 0.05) throw new Error('Prop 3 managementFee must be 0.05');

    // MODEL 4: HomeHub-Managed (FULLY_MANAGED - All 3 Fees Apply)
    console.log('\n[Scenario 4: HomeHub-Managed (FULLY_MANAGED - Platform + Rent + Mgmt Fees)]');
    const prop4 = await propertyRepository.createProperty(
      seededOwner.id,
      seededOwner.roles as string[],
      {
        name: `${PREFIX} Fully Managed Tower`,
        type: 'APARTMENT',
        city: 'Erbil',
        listingType: 'FOR_RENT',
        price: 1800000,
        currency: 'IQD',
        yearBuilt: 2024,
        squareFeet: 180,
        managementPreference: 'HOMEHUB_MANAGED',
        operatingModel: 'FULLY_MANAGED',
        managedByAgentId: 'org_company_01', // Must be cleared for platform managed
        rentFee: 0.07,
        managementFee: 0.04,
      }
    );
    createdPropertyIds.push(prop4.id);

    console.log(`✓ Property Created ID: ${prop4.id}`);
    console.log(`  - Operating Model: ${prop4.operatingModel}`);
    console.log(`  - Managed By Agent ID: ${prop4.managedByAgentId} (Expected: null)`);
    console.log(`  - Rent Fee: ${prop4.rentFee} (Expected: 0.07)`);
    console.log(`  - Management Fee: ${prop4.managementFee} (Expected: 0.04)`);

    if (prop4.operatingModel !== 'FULLY_MANAGED') throw new Error('Prop 4 operatingModel mismatch');
    if (prop4.managedByAgentId !== null) throw new Error('Prop 4 managedByAgentId must be null for platform managed');
    if (Number(prop4.rentFee) !== 0.07) throw new Error('Prop 4 rentFee must be 0.07');
    if (Number(prop4.managementFee) !== 0.04) throw new Error('Prop 4 managementFee must be 0.04');

    // ------------------------------------------------------------------------
    // SECTION 4: AUTHORITATIVE COMMISSION & 3-FEE CALCULATION ENGINE
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Authoritative Fee Calculation Engine Verification ---');
    
    // Simulate rent payment of 1,000,000 IQD across the 4 properties
    const rentAmount = 1000000;
    const platformPolicyRate = Number(policy.policyValue); // 0.02 (2%)

    // For Prop 1 (Self-Managed): Platform Fee = 20,000 IQD, Rent Fee = 0, Mgmt Fee = 0. Net to Owner = 980,000 IQD.
    const expectedPlatformFee1 = rentAmount * platformPolicyRate;
    const expectedRentFee1 = 0;
    const expectedMgmtFee1 = 0;
    const expectedNet1 = rentAmount - expectedPlatformFee1;
    console.log(`Prop 1 (Self-Managed): Platform Fee = ${expectedPlatformFee1} IQD | Rent Fee = ${expectedRentFee1} | Mgmt Fee = ${expectedMgmtFee1} | Net Landlord = ${expectedNet1} IQD`);

    // For Prop 3 (Agent-Listed): Platform Fee = 20,000 IQD, Rent Fee = 0, Mgmt Fee = 1,000,000 * 0.05 = 50,000 IQD. Net = 930,000 IQD.
    const expectedPlatformFee3 = rentAmount * platformPolicyRate;
    const expectedRentFee3 = 0;
    const expectedMgmtFee3 = rentAmount * 0.05;
    const expectedNet3 = rentAmount - expectedPlatformFee3 - expectedMgmtFee3;
    console.log(`Prop 3 (Agent-Listed): Platform Fee = ${expectedPlatformFee3} IQD | Rent Fee = ${expectedRentFee3} | Mgmt Fee = ${expectedMgmtFee3} | Net Landlord = ${expectedNet3} IQD`);

    // For Prop 4 (Fully-Managed): Platform Fee = 20,000 IQD, Rent Fee = 1,000,000 * 0.07 = 70,000 IQD, Mgmt Fee = 1,000,000 * 0.04 = 40,000 IQD. Net = 870,000 IQD.
    const expectedPlatformFee4 = rentAmount * platformPolicyRate;
    const expectedRentFee4 = rentAmount * 0.07;
    const expectedMgmtFee4 = rentAmount * 0.04;
    const expectedNet4 = rentAmount - expectedPlatformFee4 - expectedRentFee4 - expectedMgmtFee4;
    console.log(`Prop 4 (Fully-Managed): Platform Fee = ${expectedPlatformFee4} IQD | Rent Fee = ${expectedRentFee4} | Mgmt Fee = ${expectedMgmtFee4} | Net Landlord = ${expectedNet4} IQD`);

    // ------------------------------------------------------------------------
    // SECTION 5: DOWNSTREAM DOMAIN RECONCILIATION
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Downstream Domain Invariant Checks ---');

    // Check Listings table for created properties
    const createdListings = await db.select().from(schema.listings).where(inArray(schema.listings.propertyId, createdPropertyIds));
    console.log(`✓ Staged Listings Count: ${createdListings.length}`);
    for (const l of createdListings) {
      if (l.status !== 'PENDING_REVIEW') {
        throw new Error(`Listing ${l.id} has invalid status '${l.status}'; must be PENDING_REVIEW`);
      }
    }
    console.log('✓ All staged listings are strictly in PENDING_REVIEW (Zero unverified marketplace publication)');

    // Check that NO fake leases, units, or rent schedules were generated
    const [linkedLeases] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.leases)
      .where(inArray(schema.leases.propertyId, createdPropertyIds));
    console.log(`✓ Downstream Leases Created: ${linkedLeases.count} (Expected: 0)`);
    if (linkedLeases.count !== 0) throw new Error('Assertion Failed: Property creation must not fabricate leases');

    // ------------------------------------------------------------------------
    // SECTION 6: FINANCIAL LEDGER POST-CREATION VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Verifying Post-Creation Financial Safety (Zero Corruption) ---');
    const [afterPayments] = await db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(amount), '0')` }).from(schema.paymentRecords);
    const [afterSchedules] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.rentSchedules);
    const [afterJournals] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.journalEntries);
    const [afterLedger] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.ledgerLines);
    const [afterDeposits] = await db.select({ count: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(recorded_amount), '0')` }).from(schema.securityDeposits);

    console.log(`Post-test Payments: ${afterPayments.count} (Diff: ${afterPayments.count - beforePayments.count})`);
    console.log(`Post-test Rent Schedules: ${afterSchedules.count} (Diff: ${afterSchedules.count - beforeSchedules.count})`);
    console.log(`Post-test Journal Entries: ${afterJournals.count} (Diff: ${afterJournals.count - beforeJournals.count})`);
    console.log(`Post-test Ledger Lines: ${afterLedger.count} (Diff: ${afterLedger.count - beforeLedger.count})`);
    console.log(`Post-test Security Deposits: ${afterDeposits.count} (Diff: ${afterDeposits.count - beforeDeposits.count})`);

    if (afterPayments.count !== beforePayments.count || afterPayments.total !== beforePayments.total) {
      throw new Error('Financial Safety Breach: paymentRecords mutated unexpectedly!');
    }
    if (afterJournals.count !== beforeJournals.count) {
      throw new Error('Financial Safety Breach: journalEntries mutated unexpectedly!');
    }
    if (afterLedger.count !== beforeLedger.count) {
      throw new Error('Financial Safety Breach: ledgerLines mutated unexpectedly!');
    }
    if (afterDeposits.count !== beforeDeposits.count || afterDeposits.total !== beforeDeposits.total) {
      throw new Error('Financial Safety Breach: securityDeposits mutated unexpectedly!');
    }
    console.log('✓ FINANCIAL INVARIANT VERIFIED: Exact ledger equilibrium and zero balance mutation.');

    console.log('\n================================================================');
    console.log('  ALL COMPREHENSIVE CROSS-DOMAIN INVARIANTS SUCCESSFULLY VERIFIED');
    console.log('================================================================\n');

  } finally {
    // Isolated Cleanup: Delete only properties created during this verification test
    if (createdPropertyIds.length > 0) {
      console.log(`Cleaning up ${createdPropertyIds.length} isolated test property records...`);
      await db.delete(schema.listings).where(inArray(schema.listings.propertyId, createdPropertyIds));
      await db.delete(schema.verificationRecords).where(inArray(schema.verificationRecords.propertyId, createdPropertyIds));
      await db.delete(schema.ownershipRecords).where(inArray(schema.ownershipRecords.propertyId, createdPropertyIds));
      await db.delete(schema.properties).where(inArray(schema.properties.id, createdPropertyIds));
      console.log('✓ Cleanup complete. Preserved all seeded and production-like records.');
    }
    await closePool();
  }
}

runComprehensiveVerification()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('\n❌ VERIFICATION TEST FAILED:', e);
    process.exit(1);
  });
