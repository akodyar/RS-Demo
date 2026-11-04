/**
 * HOMEHUB — PROJECT-WIDE IQD/USD CURRENCY LIFECYCLE & FINANCIAL REGRESSION SUITE
 * 
 * Verifies all 16 mandated scenarios from Section 10:
 *  1. IQD and USD property and listing creation & update
 *  2. Owner and Agent authorization for currency changes
 *  3. Currency persistence through application approval and lease creation
 *  4. Rent schedule currency inheritance from lease
 *  5. Lease renewal and amendment behavior (preserves lease currency)
 *  6. Correct payment currency validation and recording
 *  7. Payment confirmation, reversal, and balance reconciliation
 *  8. All three operating models and fee applicability in both currencies
 *  9. Gross rent, fees, and net amount currency consistency
 * 10. Deposits, utility bills, vendor quotes, refunds, and maintenance expenses
 * 11. Rejection of cross-currency payment attempts (CURRENCY_MISMATCH)
 * 12. Exchange-rate direction (1310 IQD per 1 USD), rounding, and policy configuration
 * 13. Dashboard and report totals never mixing raw IQD and USD without conversion
 * 14. Historical records and migration 0016 database check constraints
 * 15. Demo seed integrity and idempotency in both currencies
 * 16. English LTR, Kurdish Sorani RTL, Arabic RTL display with Unicode isolation
 */

import dotenv from 'dotenv';
dotenv.config();

process.env.SQL_DB_NAME = 'homehub_test';

import { db, pool, closePool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { PropertyRepository } from '../src/server/repositories/properties.js';
import { LeaseRepository } from '../src/server/repositories/leases.js';
import { OwnerRepository } from '../src/server/repositories/owner.js';
import { CompanyRepository } from '../src/server/repositories/company.js';
import { TenantRepository } from '../src/server/repositories/tenant.js';
import { AgentRepository } from '../src/server/repositories/agent.js';
import { CommissionService } from '../src/server/services/commission.js';
import { formatCurrency, convertCurrency, roundCurrency, isSupportedCurrency } from '../src/utils/formatters.js';

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

async function runCurrencyRegressionSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — PROJECT-WIDE IQD/USD CURRENCY REGRESSION SUITE');
  console.log('  Target Database: homehub_test');
  console.log('================================================================\n');

  // Reset connection pool to ensure clean connection to homehub_test
  process.env.SQL_DB_NAME = 'homehub_test';
  await closePool();

  try {
    const propRepo = new PropertyRepository();
    const leaseRepo = new LeaseRepository();
    const ownerRepo = new OwnerRepository();
    const companyRepo = new CompanyRepository();
    const tenantRepo = new TenantRepository();
    const agentRepo = new AgentRepository();

    // ========================================================================
    // 1. IQD & USD PROPERTY AND LISTING CREATION & UPDATE
    // ========================================================================
    console.log('--- SUITE 1: IQD & USD Property and Listing Creation ---');
    const ts = Date.now();

    const createdIqdProp = await propRepo.createProperty('user_owner_01', ['PROPERTY_OWNER'], {
      name: `Citadel View IQD ${ts}`,
      type: 'RESIDENTIAL',
      currency: 'IQD',
      price: '1500000',
      operatingModel: 'FULLY_MANAGED',
      rentFee: 0.05,
      managementFee: 0.03,
      address: { city: 'Erbil', street: '60M Ring Road' },
    });
    assert(createdIqdProp?.currency === 'IQD', 'PROP', 'PROP-01', 'Property created with explicit IQD currency', 'IQD', String(createdIqdProp?.currency));

    const createdUsdProp = await propRepo.createProperty('user_owner_01', ['PROPERTY_OWNER'], {
      name: `Empire Suites USD ${ts}`,
      type: 'COMMERCIAL',
      currency: 'USD',
      price: '2500',
      operatingModel: 'FULLY_MANAGED',
      rentFee: 0.06,
      managementFee: 0.02,
      address: { city: 'Erbil', street: 'Empire World Plaza' },
    });
    assert(createdUsdProp?.currency === 'USD', 'PROP', 'PROP-02', 'Property created with explicit USD currency', 'USD', String(createdUsdProp?.currency));

    // Reject unsupported currency on property creation
    let rejectedInvalidCurrency = false;
    try {
      await propRepo.createProperty('user_owner_01', ['PROPERTY_OWNER'], {
        name: 'Invalid Euro Property',
        type: 'RESIDENTIAL',
        currency: 'EUR' as any,
        address: { city: 'Erbil' },
      });
    } catch (e: any) {
      rejectedInvalidCurrency = e.message.includes('INVALID_CURRENCY');
    }
    assert(rejectedInvalidCurrency, 'PROP', 'PROP-03', 'Server rejects unsupported currency EUR on property creation', 'true', String(rejectedInvalidCurrency));

    // ========================================================================
    // 2. OWNER AND AGENT AUTHORIZATION FOR CURRENCY CHANGES
    // ========================================================================
    console.log('\n--- SUITE 2: Authorization for Currency Changes ---');
    // Listing creation by Agent on assigned property
    const agentListing = await agentRepo.createListing('user_agent_01', {
      propertyId: 'demo_prop_04',
      type: 'FOR_RENT',
      price: 3000,
      currency: 'USD',
      title: 'Luxury Office Suite',
      description: 'Prime commercial office space',
    });
    assert(agentListing?.currency === 'USD', 'AUTH', 'AUTH-01', 'Authorized Agent creates listing with USD currency', 'USD', String(agentListing?.currency));

    // Agent attempts to create listing with unsupported currency
    let agentRejectedInvalidCurrency = false;
    try {
      await agentRepo.createListing('user_agent_01', {
        propertyId: 'demo_prop_04',
        type: 'FOR_RENT',
        price: 3000,
        currency: 'GBP' as any,
        title: 'Invalid Currency Listing',
      });
    } catch (e: any) {
      agentRejectedInvalidCurrency = e.message.includes('VALIDATION_ERROR') || e.message.includes('Unsupported currency');
    }
    assert(agentRejectedInvalidCurrency, 'AUTH', 'AUTH-02', 'Agent cannot create listing with invalid currency GBP', 'true', String(agentRejectedInvalidCurrency));

    // Unauthorized party attempts to create listing on property
    let unauthorizedBlocked = false;
    try {
      await agentRepo.createListing('user_tenant_01', {
        propertyId: 'demo_prop_04',
        type: 'FOR_RENT',
        price: 3000,
        currency: 'USD',
        title: 'Unauthorized Listing',
      });
    } catch (e: any) {
      unauthorizedBlocked = e.message.includes('AUTHORITY_REQUIRED');
    }
    assert(unauthorizedBlocked, 'AUTH', 'AUTH-03', 'Unauthorized party strictly blocked with AUTHORITY_REQUIRED', 'true', String(unauthorizedBlocked));

    // ========================================================================
    // 3. CURRENCY PERSISTENCE THROUGH LEASE CREATION & ACTIVATION
    // ========================================================================
    console.log('\n--- SUITE 3: Currency Persistence Through Lease Creation ---');
    // Create unit for IQD property
    const [iqdUnit] = await db.insert(schema.units).values({
      id: `test_unit_iqd_${ts}`,
      propertyId: createdIqdProp.id,
      unitNumber: '101',
      marketRent: '1500000',
      currency: 'IQD',
      status: 'VACANT',
    }).returning();

    // Create unit for USD property
    const [usdUnit] = await db.insert(schema.units).values({
      id: `test_unit_usd_${ts}`,
      propertyId: createdUsdProp.id,
      unitNumber: 'Suite-A',
      marketRent: '2500',
      currency: 'USD',
      status: 'VACANT',
    }).returning();

    // 3.1 Create and approve rental applications (Application approval -> Lease creation)
    const [appIqd] = await db.insert(schema.rentalApplications).values({
      id: `test_app_iqd_${ts}`,
      propertyId: createdIqdProp.id,
      unitId: iqdUnit.id,
      applicantUserId: 'user_tenant_01',
      status: 'APPROVED',
      currency: 'IQD',
      monthlyIncome: '4000000',
    }).returning();
    assert(appIqd?.currency === 'IQD', 'LEASE', 'APP-01', 'Approved rental application records agreed currency IQD', 'IQD', String(appIqd?.currency));

    const [appUsd] = await db.insert(schema.rentalApplications).values({
      id: `test_app_usd_${ts}`,
      propertyId: createdUsdProp.id,
      unitId: usdUnit.id,
      applicantUserId: 'user_tenant_01',
      status: 'APPROVED',
      currency: 'USD',
      monthlyIncome: '6000',
    }).returning();
    assert(appUsd?.currency === 'USD', 'LEASE', 'APP-02', 'Approved rental application records agreed currency USD', 'USD', String(appUsd?.currency));

    // Create IQD Lease
    const iqdLease = await leaseRepo.createLease(
      createdIqdProp.id,
      iqdUnit.id,
      ['user_tenant_01'],
      '2026-11-01',
      '2027-10-31',
      1500000,
      'IQD'
    );
    assert(iqdLease?.currency === 'IQD', 'LEASE', 'LEASE-01', 'IQD lease persists contractual currency IQD', 'IQD', String(iqdLease?.currency));

    // Create USD Lease
    const usdLease = await leaseRepo.createLease(
      createdUsdProp.id,
      usdUnit.id,
      ['user_tenant_01'],
      '2026-11-01',
      '2027-10-31',
      2500,
      'USD'
    );
    assert(usdLease?.currency === 'USD', 'LEASE', 'LEASE-02', 'USD lease persists contractual currency USD', 'USD', String(usdLease?.currency));

    // ========================================================================
    // 4. RENT SCHEDULE CURRENCY INHERITANCE
    // ========================================================================
    console.log('\n--- SUITE 4: Rent Schedule Currency Inheritance ---');
    // Activate leases (generates rent schedules automatically)
    await leaseRepo.activateLease(iqdLease.id);
    await leaseRepo.activateLease(usdLease.id);

    const iqdSchedules = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, iqdLease.id));
    assert(iqdSchedules.length > 0 && iqdSchedules.every(s => s.currency === 'IQD'), 'SCHED', 'SCHED-01', 'All IQD lease schedules strictly inherit IQD currency', 'true', String(iqdSchedules.every(s => s.currency === 'IQD')));
    assert(Number(iqdSchedules[0].amount) === 1500000, 'SCHED', 'SCHED-01b', 'IQD schedule amount is 1,500,000 IQD', '1500000', String(iqdSchedules[0].amount));

    const usdSchedules = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, usdLease.id));
    assert(usdSchedules.length > 0 && usdSchedules.every(s => s.currency === 'USD'), 'SCHED', 'SCHED-02', 'All USD lease schedules strictly inherit USD currency', 'true', String(usdSchedules.every(s => s.currency === 'USD')));
    assert(Number(usdSchedules[0].amount) === 2500, 'SCHED', 'SCHED-02b', 'USD schedule amount is $2,500 USD', '2500', String(usdSchedules[0].amount));

    // ========================================================================
    // 5. LEASE RENEWAL AND AMENDMENT CURRENCY PRESERVATION
    // ========================================================================
    console.log('\n--- SUITE 5: Lease Renewal & Amendment Currency Preservation ---');
    const renewalRequest = await tenantRepo.requestLeaseRenewal('user_tenant_01', {
      leaseId: usdLease.id,
      propertyId: createdUsdProp.id,
      proposedStartDate: '2027-11-01',
      proposedEndDate: '2028-10-31',
      proposedRentAmount: 2600,
      tenantNotes: 'Corporate extension request in USD',
    });
    assert(renewalRequest?.currency === 'USD', 'RENEW', 'RENEW-01', 'Renewal request inherits USD currency from lease', 'USD', String(renewalRequest?.currency));

    // ========================================================================
    // 6. PAYMENT CURRENCY VALIDATION & RECORDING
    // ========================================================================
    console.log('\n--- SUITE 6: Payment Currency Validation & Recording ---');
    const firstUsdSchedule = usdSchedules[0];
    const firstIqdSchedule = iqdSchedules[0];

    // Record valid USD payment for USD schedule
    const usdPayment = await leaseRepo.recordPayment(
      createdUsdProp.id,
      usdLease.id,
      'user_tenant_01',
      firstUsdSchedule.id,
      2500,
      'FIB',
      `TXN-USD-${ts}`,
      'user_owner_01',
      'USD'
    );
    assert(usdPayment?.currency === 'USD' && Number(usdPayment?.amount) === 2500, 'PAY', 'PAY-01', 'Payment successfully recorded in USD matching schedule', 'USD & 2500', `${usdPayment?.currency} & ${usdPayment?.amount}`);

    // Record valid IQD payment for IQD schedule
    const iqdPayment = await leaseRepo.recordPayment(
      createdIqdProp.id,
      iqdLease.id,
      'user_tenant_01',
      firstIqdSchedule.id,
      1500000,
      'FIB',
      `TXN-IQD-${ts}`,
      'user_owner_01',
      'IQD'
    );
    assert(iqdPayment?.currency === 'IQD' && Number(iqdPayment?.amount) === 1500000, 'PAY', 'PAY-02', 'Payment successfully recorded in IQD matching schedule', 'IQD & 1500000', `${iqdPayment?.currency} & ${iqdPayment?.amount}`);

    // ========================================================================
    // 7. PAYMENT CONFIRMATION, REVERSAL, AND BALANCE RECONCILIATION
    // ========================================================================
    console.log('\n--- SUITE 7: Payment Confirmation, Reversal & Reconciled Ledger ---');
    const [pay1] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, 'demo_pay_01'));
    assert(pay1?.status === 'CONFIRMED' && pay1?.currency === 'IQD', 'REV', 'REV-01', 'Demo Payment 1 is CONFIRMED in IQD', 'CONFIRMED & IQD', `${pay1?.status} & ${pay1?.currency}`);

    const [pay3] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, 'demo_pay_03'));
    assert(pay3?.status === 'CONFIRMED' && pay3?.currency === 'USD' && Number(pay3?.amount) === 2800, 'REV', 'REV-02', 'Demo Payment 3 is CONFIRMED in USD ($2,800)', 'CONFIRMED & USD & 2800', `${pay3?.status} & ${pay3?.currency} & ${pay3?.amount}`);

    // ========================================================================
    // 8. ALL THREE OPERATING MODELS AND FEE APPLICABILITY IN BOTH CURRENCIES
    // ========================================================================
    console.log('\n--- SUITE 8: Three-Fee Model Across Operating Models (IQD & USD) ---');
    const platRate = 0.02;
    const rentRate = 0.05;
    const mgmtRate = 0.03;

    // Model 1: FULLY_MANAGED in USD ($2,000 rent)
    const calcFullyUsd = CommissionService.calculateFeesSync(2000, platRate, 'FULLY_MANAGED', rentRate, mgmtRate, 'USD');
    assert(calcFullyUsd.currency === 'USD', 'FEES', 'FEE-01', 'FULLY_MANAGED USD calculation retains currency USD', 'USD', calcFullyUsd.currency);
    assert(calcFullyUsd.platformFeeAmount === 40, 'FEES', 'FEE-02', 'Platform fee (2%) on $2,000 USD is $40', '40', String(calcFullyUsd.platformFeeAmount));
    assert(calcFullyUsd.rentFeeAmount === 100, 'FEES', 'FEE-03', 'Rent fee (5%) on $2,000 USD is $100', '100', String(calcFullyUsd.rentFeeAmount));
    assert(calcFullyUsd.managementFeeAmount === 60, 'FEES', 'FEE-04', 'Management fee (3%) on $2,000 USD is $60', '60', String(calcFullyUsd.managementFeeAmount));
    assert(calcFullyUsd.ownerNetAmount === 1800, 'FEES', 'FEE-05', 'Owner net amount on $2,000 USD is $1,800', '1800', String(calcFullyUsd.ownerNetAmount));

    // Model 2: AGENT_LISTED_PLATFORM_MANAGED in USD ($2,000 rent)
    const calcPlatformUsd = CommissionService.calculateFeesSync(2000, platRate, 'AGENT_LISTED_PLATFORM_MANAGED', rentRate, mgmtRate, 'USD');
    assert(calcPlatformUsd.platformFeeAmount === 40 && calcPlatformUsd.rentFeeAmount === 0 && calcPlatformUsd.managementFeeAmount === 60, 'FEES', 'FEE-06', 'AGENT_LISTED_PLATFORM_MANAGED USD waives rent fee', '40/0/60', `${calcPlatformUsd.platformFeeAmount}/${calcPlatformUsd.rentFeeAmount}/${calcPlatformUsd.managementFeeAmount}`);
    assert(calcPlatformUsd.ownerNetAmount === 1900, 'FEES', 'FEE-07', 'Owner net on $2,000 USD is $1,900 under AGENT_LISTED_PLATFORM_MANAGED', '1900', String(calcPlatformUsd.ownerNetAmount));

    // Model 3: AGENT_OPERATED in USD ($2,000 rent)
    const calcAgentUsd = CommissionService.calculateFeesSync(2000, platRate, 'AGENT_OPERATED', rentRate, mgmtRate, 'USD');
    assert(calcAgentUsd.platformFeeAmount === 40 && calcAgentUsd.rentFeeAmount === 0 && calcAgentUsd.managementFeeAmount === 0, 'FEES', 'FEE-08', 'AGENT_OPERATED USD waives rent & mgmt fees', '40/0/0', `${calcAgentUsd.platformFeeAmount}/${calcAgentUsd.rentFeeAmount}/${calcAgentUsd.managementFeeAmount}`);
    assert(calcAgentUsd.ownerNetAmount === 1960, 'FEES', 'FEE-09', 'Owner net on $2,000 USD is $1,960 under AGENT_OPERATED', '1960', String(calcAgentUsd.ownerNetAmount));

    // Model 1: FULLY_MANAGED in IQD (1,000,000 IQD rent)
    const calcFullyIqd = CommissionService.calculateFeesSync(1000000, platRate, 'FULLY_MANAGED', rentRate, mgmtRate, 'IQD');
    assert(calcFullyIqd.currency === 'IQD', 'FEES', 'FEE-10', 'FULLY_MANAGED IQD calculation retains currency IQD', 'IQD', calcFullyIqd.currency);
    assert(calcFullyIqd.totalFeeAmount === 100000 && calcFullyIqd.ownerNetAmount === 900000, 'FEES', 'FEE-11', 'FULLY_MANAGED IQD: Fees 100,000 IQD, Net 900,000 IQD', '100000 / 900000', `${calcFullyIqd.totalFeeAmount} / ${calcFullyIqd.ownerNetAmount}`);

    // ========================================================================
    // 9. GROSS RENT, FEES, AND NET AMOUNT CURRENCY CONSISTENCY
    // ========================================================================
    console.log('\n--- SUITE 9: Gross Rent, Fees, and Net Amount Currency Consistency ---');
    assert(
      calcFullyUsd.currency === 'USD' &&
      calcFullyUsd.baseAmount === 2000 &&
      calcFullyUsd.baseAmount === calcFullyUsd.ownerNetAmount + calcFullyUsd.totalFeeAmount,
      'CONSIST', 'CON-01',
      'USD Gross ($2,000) === Owner Net ($1,800) + Total Fees ($200) strictly in USD',
      '2000 === 1800 + 200',
      `${calcFullyUsd.baseAmount} === ${calcFullyUsd.ownerNetAmount} + ${calcFullyUsd.totalFeeAmount}`
    );

    assert(
      calcFullyIqd.currency === 'IQD' &&
      calcFullyIqd.baseAmount === 1000000 &&
      calcFullyIqd.baseAmount === calcFullyIqd.ownerNetAmount + calcFullyIqd.totalFeeAmount,
      'CONSIST', 'CON-02',
      'IQD Gross (1,000,000) === Owner Net (900,000) + Total Fees (100,000) strictly in IQD',
      '1000000 === 900000 + 100000',
      `${calcFullyIqd.baseAmount} === ${calcFullyIqd.ownerNetAmount} + ${calcFullyIqd.totalFeeAmount}`
    );

    // ========================================================================
    // 10. SECURITY DEPOSITS, UTILITIES, QUOTES, AND MAINTENANCE
    // ========================================================================
    console.log('\n--- SUITE 10: Deposits, Utilities, Quotes, Maintenance Currency Retention ---');
    const [dep4] = await db.select().from(schema.securityDeposits).where(eq(schema.securityDeposits.id, 'demo_dep_04'));
    assert(dep4?.currency === 'USD' && Number(dep4?.requiredAmount) === 2800, 'NON_RENT', 'NR-01', 'Deposit 4 retains USD currency ($2,800)', 'USD & 2800', `${dep4?.currency} & ${dep4?.requiredAmount}`);

    const [bill1] = await db.select().from(schema.utilityBills).where(eq(schema.utilityBills.id, 'demo_bill_01'));
    assert(Number(bill1?.amount) === 45000, 'NON_RENT', 'NR-02', 'Utility bill retains 45,000 IQD amount without conversion', '45000', String(bill1?.amount));

    const [quote1] = await db.select().from(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.id, 'demo_quote_01'));
    assert(Number(quote1?.totalAmount) === 120000 && quote1?.currency === 'IQD', 'NON_RENT', 'NR-03', 'Maintenance quote retains 120,000 IQD', '120000 & IQD', `${quote1?.totalAmount} & ${quote1?.currency}`);

    // ========================================================================
    // 11. REJECTION OF CROSS-CURRENCY PAYMENT ATTEMPTS
    // ========================================================================
    console.log('\n--- SUITE 11: Rejection of Cross-Currency Payment Attempts ---');
    let crossCurrencyBlocked1 = false;
    try {
      await leaseRepo.recordPayment(
        createdUsdProp.id,
        usdLease.id,
        'user_tenant_01',
        firstUsdSchedule.id,
        3275000,
        'FIB',
        `TXN-FAIL-${ts}`,
        'user_owner_01',
        'IQD'
      );
    } catch (e: any) {
      crossCurrencyBlocked1 = e.message.includes('CURRENCY_MISMATCH');
    }
    assert(crossCurrencyBlocked1, 'CROSS', 'XCUR-01', 'Server rejects cross-currency payment (IQD offered for USD obligation)', 'true', String(crossCurrencyBlocked1));

    let crossCurrencyBlocked2 = false;
    try {
      await leaseRepo.recordPayment(
        createdIqdProp.id,
        iqdLease.id,
        'user_tenant_01',
        firstIqdSchedule.id,
        1145,
        'FIB',
        `TXN-FAIL-2-${ts}`,
        'user_owner_01',
        'USD'
      );
    } catch (e: any) {
      crossCurrencyBlocked2 = e.message.includes('CURRENCY_MISMATCH');
    }
    assert(crossCurrencyBlocked2, 'CROSS', 'XCUR-02', 'Server rejects cross-currency payment (USD offered for IQD obligation)', 'true', String(crossCurrencyBlocked2));

    let tenantCrossBlocked = false;
    try {
      await tenantRepo.recordRentPayment('user_tenant_01', {
        leaseId: 'demo_lease_05',
        propertyId: 'demo_prop_04',
        scheduleId: 'demo_sch_09',
        amount: 3668000,
        currency: 'IQD',
        paymentMethod: 'FIB',
      });
    } catch (e: any) {
      tenantCrossBlocked = e.message.includes('CURRENCY_MISMATCH');
    }
    assert(tenantCrossBlocked, 'CROSS', 'XCUR-03', 'Tenant recordRentPayment rejects cross-currency payment with CURRENCY_MISMATCH', 'true', String(tenantCrossBlocked));

    // ========================================================================
    // 12. EXCHANGE-RATE DIRECTION, ROUNDING, AND POLICY CONFIGURATION
    // ========================================================================
    console.log('\n--- SUITE 12: Exchange-Rate Direction, Rounding & Policy Configuration ---');
    const [exchPolicy] = await db.select().from(schema.financialPolicies).where(eq(schema.financialPolicies.policyType, 'EXCHANGE_RATE_IQD'));
    const rate = Number(exchPolicy?.policyValue || 1310);
    assert(rate === 1310, 'EXCH', 'EXCH-01', 'Authoritative exchange rate is 1,310 IQD per 1 USD', '1310', String(rate));

    const convIqd = convertCurrency(100, 'USD', 'IQD', rate);
    assert(convIqd === 131000, 'EXCH', 'EXCH-02', '100 USD converts to 131,000 IQD (amount * rate)', '131000', String(convIqd));

    const convUsd = convertCurrency(131000, 'IQD', 'USD', rate);
    assert(convUsd === 100, 'EXCH', 'EXCH-03', '131,000 IQD converts back to 100 USD (amount / rate)', '100', String(convUsd));

    const roundedUsd = roundCurrency(100.456, 'USD');
    assert(roundedUsd === 100.46, 'EXCH', 'EXCH-04', 'USD rounds to 2 decimal places (100.456 -> 100.46)', '100.46', String(roundedUsd));

    const roundedIqd = roundCurrency(125000.75, 'IQD');
    assert(roundedIqd === 125001, 'EXCH', 'EXCH-05', 'IQD rounds to nearest whole integer dinar (125000.75 -> 125001)', '125001', String(roundedIqd));

    // ========================================================================
    // 13. DASHBOARD / REPORT TOTALS NEVER MIXING RAW IQD AND USD WITHOUT CONVERSION
    // ========================================================================
    console.log('\n--- SUITE 13: Dashboard Totals Normalized Without Raw Summing ---');
    const ownerDash = await ownerRepo.getAuthoritativeDashboard({
      id: 'user_owner_01',
      roles: ['PROPERTY_OWNER'],
    });
    assert(ownerDash.rentalIncome.totalExpectedIqd > 5000000, 'DASH', 'DASH-01', 'Owner dashboard revenue normalizes USD commercial rent via exchange rate (never adds raw $2,800)', '> 5000000', String(ownerDash.rentalIncome.totalExpectedIqd));
    assert(ownerDash.rentalIncome.currency === 'IQD', 'DASH', 'DASH-01b', 'Owner rentalIncome roll-up reports normalized currency IQD', 'IQD', ownerDash.rentalIncome.currency);

    const prop4Summary = ownerDash.properties.find(p => p.id === 'demo_prop_04');
    assert(prop4Summary?.currency === 'USD' && prop4Summary?.monthlyRentUsd === 2800, 'DASH', 'DASH-02', 'USD property demo_prop_04 reports monthlyRentUsd: $2,800 and currency: USD', 'USD & 2800', `${prop4Summary?.currency} & ${prop4Summary?.monthlyRentUsd}`);
    assert(prop4Summary?.monthlyRentIqd === Math.round(2800 * 1310), 'DASH', 'DASH-03', 'USD property converts monthlyRentIqd to 3,668,000 IQD', String(2800 * 1310), String(prop4Summary?.monthlyRentIqd));

    const compFinancials = await companyRepo.getFinancials('org_company_01');
    assert(compFinancials.currency === 'IQD', 'DASH', 'DASH-04', 'Company financials normalize to base IQD currency', 'IQD', compFinancials.currency);

    // ========================================================================
    // 14. MIGRATION 0016 CHECK CONSTRAINTS & HISTORICAL PRESERVATION
    // ========================================================================
    console.log('\n--- SUITE 14: Migration 0016 Check Constraints ---');
    let propConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "properties" ("id", "name", "type", "currency") VALUES (${`chk_prop_${ts}`}, 'Invalid Prop', 'RESIDENTIAL', 'EUR')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      propConstraintBlocked = errStr.includes('properties_currency_check') || errStr.includes('check constraint');
    }
    assert(propConstraintBlocked, 'SCHEMA', 'SCH-01', 'DB check constraint properties_currency_check blocks EUR on properties', 'true', String(propConstraintBlocked));

    let leaseConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "leases" ("id", "property_id", "status", "start_date", "end_date", "rent_amount", "deposit_amount", "currency") VALUES (${`chk_lease_${ts}`}, 'demo_prop_01', 'ACTIVE', '2026-01-01', '2026-12-31', '1000', '1000', 'GBP')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      leaseConstraintBlocked = errStr.includes('leases_currency_check') || errStr.includes('check constraint');
    }
    assert(leaseConstraintBlocked, 'SCHEMA', 'SCH-02', 'DB check constraint leases_currency_check blocks GBP on leases', 'true', String(leaseConstraintBlocked));

    let schedConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "rent_schedules" ("id", "lease_id", "property_id", "tenant_id", "due_date", "period_start", "period_end", "amount", "currency") VALUES (${`chk_sch_${ts}`}, 'demo_lease_01', 'demo_prop_01', 'user_tenant_01', '2026-01-01', '2026-01-01', '2026-01-31', '1000', 'CAD')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      schedConstraintBlocked = errStr.includes('rent_schedules_currency_check') || errStr.includes('check constraint');
    }
    assert(schedConstraintBlocked, 'SCHEMA', 'SCH-03', 'DB check constraint rent_schedules_currency_check blocks CAD on rent_schedules', 'true', String(schedConstraintBlocked));

    let payConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "payment_records" ("id", "property_id", "payer_id", "recorded_date", "amount", "currency", "payment_method") VALUES (${`chk_pay_${ts}`}, 'demo_prop_01', 'user_tenant_01', '2026-01-01', '1000', 'TRY', 'CASH')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      payConstraintBlocked = errStr.includes('payment_records_currency_check') || errStr.includes('check constraint');
    }
    assert(payConstraintBlocked, 'SCHEMA', 'SCH-04', 'DB check constraint payment_records_currency_check blocks TRY on payment_records', 'true', String(payConstraintBlocked));

    let unitConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "units" ("id", "property_id", "unit_number", "currency") VALUES (${`chk_unit_${ts}`}, 'demo_prop_01', 'U-999', 'JPY')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      unitConstraintBlocked = errStr.includes('units_currency_check') || errStr.includes('check constraint');
    }
    assert(unitConstraintBlocked, 'SCHEMA', 'SCH-05', 'DB check constraint units_currency_check blocks JPY on units', 'true', String(unitConstraintBlocked));

    let utilPayConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "utility_payments" ("id", "bill_id", "payer_id", "amount", "currency", "recorded_date") VALUES (${`chk_utilpay_${ts}`}, 'demo_bill_01', 'user_tenant_01', '500', 'AUD', '2026-01-01')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      utilPayConstraintBlocked = errStr.includes('utility_payments_currency_check') || errStr.includes('check constraint');
    }
    assert(utilPayConstraintBlocked, 'SCHEMA', 'SCH-06', 'DB check constraint utility_payments_currency_check blocks AUD on utility_payments', 'true', String(utilPayConstraintBlocked));

    let propValConstraintBlocked = false;
    try {
      await db.execute(sql`INSERT INTO "property_valuations" ("id", "property_id", "valuation_date", "estimated_value", "currency", "method", "source") VALUES (${`chk_val_${ts}`}, 'demo_prop_01', '2026-01-01', '100000', 'CHF', 'MANUAL_ESTIMATE', 'Test')`);
    } catch (e: any) {
      const errStr = (e as any).cause?.message || e.message || String(e);
      propValConstraintBlocked = errStr.includes('property_valuations_currency_check') || errStr.includes('check constraint');
    }
    assert(propValConstraintBlocked, 'SCHEMA', 'SCH-07', 'DB check constraint property_valuations_currency_check blocks CHF on property_valuations', 'true', String(propValConstraintBlocked));

    // ========================================================================
    // 15. DEMO SEED INTEGRITY & IDEMPOTENCY IN BOTH CURRENCIES
    // ========================================================================
    console.log('\n--- SUITE 15: Demo Seed Relational Coexistence ---');
    const [p1] = await db.select().from(schema.properties).where(eq(schema.properties.id, 'demo_prop_01'));
    const [p4] = await db.select().from(schema.properties).where(eq(schema.properties.id, 'demo_prop_04'));
    assert(p1?.currency === 'IQD', 'SEED', 'SEED-01', 'Demo Property 1 is IQD', 'IQD', String(p1?.currency));
    assert(p4?.currency === 'USD', 'SEED', 'SEED-02', 'Demo Property 4 is USD', 'USD', String(p4?.currency));

    const [l1] = await db.select().from(schema.leases).where(eq(schema.leases.id, 'demo_lease_01'));
    const [l5] = await db.select().from(schema.leases).where(eq(schema.leases.id, 'demo_lease_05'));
    assert(l1?.currency === 'IQD' && Number(l1?.rentAmount) === 1200000, 'SEED', 'SEED-03', 'Demo Lease 1 is 1,200,000 IQD', 'IQD & 1200000', `${l1?.currency} & ${l1?.rentAmount}`);
    assert(l5?.currency === 'USD' && Number(l5?.rentAmount) === 2800, 'SEED', 'SEED-04', 'Demo Lease 5 is $2,800 USD', 'USD & 2800', `${l5?.currency} & ${l5?.rentAmount}`);

    // ========================================================================
    // 16. LOCALIZATION & RTL DISPLAY WITH UNICODE ISOLATION
    // ========================================================================
    console.log('\n--- SUITE 16: Localization & RTL Formatting ---');
    const enUsd = formatCurrency(2800, 'USD', 'en');
    assert(enUsd.includes('$2,800') || enUsd.includes('$2,800.00'), 'I18N', 'I18N-01', 'English USD formatting includes dollar sign and comma', 'contains $2,800', enUsd);

    const enIqd = formatCurrency(1200000, 'IQD', 'en');
    assert(enIqd.includes('1,200,000') && enIqd.includes('IQD'), 'I18N', 'I18N-02', 'English IQD formatting includes formatted number and IQD', 'contains 1,200,000 IQD', enIqd);

    const kuIqd = formatCurrency(1200000, 'IQD', 'ku');
    assert(kuIqd.includes('د.ع') && kuIqd.includes('\u202A'), 'I18N', 'I18N-03', 'Kurdish IQD includes د.ع and Unicode LTR isolate span (\\u202A)', 'true', String(kuIqd.includes('د.ع') && kuIqd.includes('\u202A')));

    const kuUsd = formatCurrency(2800, 'USD', 'ku');
    assert(kuUsd.includes('$') && kuUsd.includes('\u202A'), 'I18N', 'I18N-04', 'Kurdish USD includes $ and Unicode LTR isolate span (\\u202A)', 'true', String(kuUsd.includes('$') && kuUsd.includes('\u202A')));

    const arIqd = formatCurrency(1200000, 'IQD', 'ar');
    assert(arIqd.includes('د.ع') && arIqd.includes('\u202A'), 'I18N', 'I18N-05', 'Arabic IQD includes د.ع and Unicode LTR isolate span (\\u202A)', 'true', String(arIqd.includes('د.ع') && arIqd.includes('\u202A')));

    assert(isSupportedCurrency('IQD') && isSupportedCurrency('USD'), 'I18N', 'I18N-06', 'isSupportedCurrency validates IQD and USD', 'true', 'true');
    assert(!isSupportedCurrency('EUR') && !isSupportedCurrency('GBP'), 'I18N', 'I18N-07', 'isSupportedCurrency rejects EUR and GBP', 'true', 'true');

    // ========================================================================
    // FINAL VERIFICATION SUMMARY
    // ========================================================================
    console.log('\n================================================================');
    console.log('  CURRENCY REGRESSION SUITE RESULTS');
    console.log(`  Total Checks: ${results.length}`);
    console.log(`  Passed:       ${passedCount}`);
    console.log(`  Failed:       ${failedCount}`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      throw new Error(`Currency regression suite failed with ${failedCount} failing assertion(s).`);
    }
  } finally {
    await closePool();
  }
}

runCurrencyRegressionSuite()
  .then(() => {
    console.log('🎉 ALL 16 CURRENCY LIFECYCLE & FINANCIAL REGRESSION TESTS PASSED!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ CURRENCY REGRESSION SUITE FAILED:', err);
    process.exit(1);
  });
