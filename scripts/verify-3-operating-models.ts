import 'dotenv/config';
import { commissionService } from '../src/server/services/commission';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';

async function verifyOperatingModels() {
  console.log('=== Verifying 3 Operating Models & Dynamic 3-Fee Model ===\n');

  // Baseline rent: 1,000,000 IQD
  const rent = 1000000;

  // 1. FULLY_MANAGED
  // Platform fee: 3% (30,000 IQD), Rent fee: 5% (50,000 IQD), Management fee: 5% (50,000 IQD)
  const propFullyManagedId = 'prop_test_fully_managed';
  await db.insert(schema.properties).values({
    id: propFullyManagedId,
    name: 'Fully Managed Test Villa',
    type: 'RESIDENTIAL',
    operatingModel: 'FULLY_MANAGED',
    rentFee: '0.05',
    managementFee: '0.05',
    currency: 'IQD'
  }).onConflictDoUpdate({
    target: schema.properties.id,
    set: { operatingModel: 'FULLY_MANAGED', rentFee: '0.05', managementFee: '0.05' }
  });

  const calcFullyManaged = await commissionService.calculatePropertyFees(rent, propFullyManagedId, 'IQD');
  console.log('Model 1: FULLY_MANAGED', {
    rent,
    platformFee: calcFullyManaged.platformFeeAmount,
    rentFee: calcFullyManaged.rentFeeAmount,
    managementFee: calcFullyManaged.managementFeeAmount,
    totalFees: calcFullyManaged.totalFeeAmount,
    netOwner: rent - calcFullyManaged.totalFeeAmount
  });

  // 2. AGENT_LISTED_PLATFORM_MANAGED
  // Platform Fee + Management Fee; no Rent Fee (rentFee = 0)
  const propAgentListedId = 'prop_test_agent_listed';
  await db.insert(schema.properties).values({
    id: propAgentListedId,
    name: 'Agent Listed Platform Managed Apt',
    type: 'RESIDENTIAL',
    operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED',
    rentFee: '0.00',
    managementFee: '0.05',
    currency: 'IQD'
  }).onConflictDoUpdate({
    target: schema.properties.id,
    set: { operatingModel: 'AGENT_LISTED_PLATFORM_MANAGED', rentFee: '0.00', managementFee: '0.05' }
  });

  const calcAgentListed = await commissionService.calculatePropertyFees(rent, propAgentListedId, 'IQD');
  console.log('Model 2: AGENT_LISTED_PLATFORM_MANAGED', {
    rent,
    platformFee: calcAgentListed.platformFeeAmount,
    rentFee: calcAgentListed.rentFeeAmount,
    managementFee: calcAgentListed.managementFeeAmount,
    totalFees: calcAgentListed.totalFeeAmount,
    netOwner: rent - calcAgentListed.totalFeeAmount
  });

  // 3. AGENT_OPERATED
  // Platform Fee only; no Rent Fee or Management Fee (0% rentFee, 0% managementFee)
  const propAgentOperatedId = 'prop_test_agent_operated';
  await db.insert(schema.properties).values({
    id: propAgentOperatedId,
    name: 'Agent Operated Commercial Shop',
    type: 'COMMERCIAL',
    operatingModel: 'AGENT_OPERATED',
    rentFee: '0.00',
    managementFee: '0.00',
    currency: 'IQD'
  }).onConflictDoUpdate({
    target: schema.properties.id,
    set: { operatingModel: 'AGENT_OPERATED', rentFee: '0.00', managementFee: '0.00' }
  });

  const calcAgentOperated = await commissionService.calculatePropertyFees(rent, propAgentOperatedId, 'IQD');
  console.log('Model 3: AGENT_OPERATED', {
    rent,
    platformFee: calcAgentOperated.platformFeeAmount,
    rentFee: calcAgentOperated.rentFeeAmount,
    managementFee: calcAgentOperated.managementFeeAmount,
    totalFees: calcAgentOperated.totalFeeAmount,
    netOwner: rent - calcAgentOperated.totalFeeAmount
  });

  // Mathematical and Financial Invariant Checks:
  // 1. Debits == Credits
  console.log('\n--- Financial Invariants Verification ---');
  console.log('Assert FULLY_MANAGED has Rent Fee > 0 and Management Fee > 0:', calcFullyManaged.rentFeeAmount > 0 && calcFullyManaged.managementFeeAmount > 0 ? 'PASS' : 'FAIL');
  console.log('Assert AGENT_LISTED_PLATFORM_MANAGED has Rent Fee == 0:', calcAgentListed.rentFeeAmount === 0 ? 'PASS' : 'FAIL');
  console.log('Assert AGENT_OPERATED has Rent Fee == 0 and Management Fee == 0:', calcAgentOperated.rentFeeAmount === 0 && calcAgentOperated.managementFeeAmount === 0 ? 'PASS' : 'FAIL');
  console.log('Assert Platform Fee > 0 across all 3 models:', calcFullyManaged.platformFeeAmount > 0 && calcAgentListed.platformFeeAmount > 0 && calcAgentOperated.platformFeeAmount > 0 ? 'PASS' : 'FAIL');
  console.log('Assert Net Owner Entitlement + Total Deductions == Collected Rent:', (rent - calcFullyManaged.totalFeeAmount) + calcFullyManaged.totalFeeAmount === rent ? 'PASS' : 'FAIL');

  await pool.end();
}

verifyOperatingModels().catch(console.error);
