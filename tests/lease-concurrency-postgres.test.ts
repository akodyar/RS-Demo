/**
 * HOMEHUB — Strengthened PostgreSQL Transaction Atomicity & Multi-Client Concurrency Verification Suite
 * 
 * Safety Rules:
 * 1. Hard fail-closed safety gate: TARGET MUST BE EXACTLY 'homehub_test'.
 * 2. Absolutely zero writes to 'homehub_production' or any other database.
 * 3. Retains 'homehub_test' intact — never drops the database.
 * 4. Deterministic cleanup limited strictly to fixtures created by this run.
 * 5. Bounded repeatable concurrency execution (default 3 runs, configurable via CONCURRENCY_REPEAT_COUNT).
 * 6. Hard timeout protection on all concurrent operations to fail fast on deadlocks.
 */

import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

// ============================================================================
// PHASE 1: HARD SAFETY GATE & CONFIGURATION
// ============================================================================
const targetDb = process.env.SQL_DB_NAME;
if (targetDb !== 'homehub_test') {
  console.error(`❌ HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be exactly 'homehub_test'. Current value: '${targetDb}'. Aborting.`);
  process.exit(1);
}

if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('/homehub_test')) {
  console.error(`❌ HARD SAFETY GATE TRIGGERED: DATABASE_URL must point to 'homehub_test'. Aborting.`);
  process.exit(1);
}

// Configurable bounded repeat mode with conservative default
const REPEAT_COUNT = Math.max(1, parseInt(process.env.CONCURRENCY_REPEAT_COUNT || '3', 10));

// Explicit test operation timeout in milliseconds (exposes deadlocks cleanly)
const OPERATION_TIMEOUT_MS = parseInt(process.env.TEST_OPERATION_TIMEOUT_MS || '10000', 10);

// Global run identifier for unique fixture isolation
const RUN_ID = `t${Date.now()}_${Math.floor(Math.random() * 10000)}`;

// Set application pool size to easily accommodate 25 concurrent clients
process.env.DB_POOL_MAX = '35';
process.env.DB_CONN_TIMEOUT_MS = '15000';

interface AssertionRecord {
  suite: string;
  name: string;
  passed: boolean;
  evidence: string;
}

interface ScenarioMetrics {
  scenario: string;
  iterations: number;
  totalAttempts: number;
  successes: number;
  expectedRejections: number;
  unexpectedErrors: number;
  invariantViolations: number;
}

const assertions: AssertionRecord[] = [];
const scenarioMetricsTable: ScenarioMetrics[] = [];

function recordPass(suite: string, name: string, evidence: string) {
  assertions.push({ suite, name, passed: true, evidence });
  console.log(`✅ [${suite}] ${name} — ${evidence}`);
}

function recordFail(suite: string, name: string, evidence: string) {
  assertions.push({ suite, name, passed: false, evidence });
  console.error(`❌ [${suite}] ${name} — ${evidence}`);
  throw new Error(`TEST FAILED: [${suite}] ${name} - ${evidence}`);
}

// Track fixture IDs for deterministic cleanup
const createdFixtureIds = {
  properties: [] as string[],
  units: [] as string[],
  users: [] as string[],
  organizations: [] as string[],
  organizationMembers: [] as string[],
  ownershipRecords: [] as string[],
  managementAgreements: [] as string[],
  rentalApplications: [] as string[],
  leases: [] as string[],
  leaseRenewals: [] as string[],
  rentSchedules: [] as string[],
  securityDeposits: [] as string[],
  paymentRecords: [] as string[],
};

// Barrier helper for coordinating concurrent clients simultaneously
function createBarrier(count: number) {
  let countRemaining = count;
  let release: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });

  return {
    wait: async () => {
      countRemaining--;
      if (countRemaining <= 0) {
        release();
      }
      await promise;
    }
  };
}

// Timeout wrapper to ensure stuck queries or deadlocks fail cleanly with diagnostic context
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`DEADLOCK_OR_TIMEOUT: Operation '${operationName}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

async function runTestSuite() {
  console.log('================================================================');
  console.log(`  HOMEHUB STRENGTHENED POSTGRESQL CONCURRENCY SUITE`);
  console.log(`  Target: homehub_test | Run ID: ${RUN_ID} | Repeats: ${REPEAT_COUNT}`);
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SAFETY GATE: Verify live connection identity directly before opening pool
  // --------------------------------------------------------------------------
  const gateClient = new pg.Client({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: parseInt(process.env.SQL_PORT || '5432', 10),
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD,
    database: 'homehub_test',
  });

  await gateClient.connect();
  const identityCheck = await gateClient.query('SELECT current_database(), current_user, inet_server_addr(), inet_server_port();');
  const liveDb = identityCheck.rows[0].current_database;
  const liveUser = identityCheck.rows[0].current_user;
  await gateClient.end();

  if (liveDb !== 'homehub_test') {
    console.error(`❌ FATAL: Live connection reported database '${liveDb}', expected 'homehub_test'. Aborting.`);
    process.exit(1);
  }

  recordPass('SAFETY_GATE', 'Live PostgreSQL target verified', `current_database: '${liveDb}', current_user: '${liveUser}'`);

  // Import application database and repositories AFTER safety gate verification
  const { db, closePool } = await import('../src/db/index.js');
  const { leaseRepository } = await import('../src/server/repositories/leases.js');
  const { ownerRepository } = await import('../src/server/repositories/owner.js');
  const { companyRepository } = await import('../src/server/repositories/company.js');
  const { Permission, UserRole, LeaseStatus } = await import('../src/types/index.js');
  const { properties, units, users, organizations, organizationMembers, ownershipRecords, managementAgreements, rentalApplications, leases, leaseTenants, leaseRenewals, rentSchedules, securityDeposits, paymentRecords } = await import('../src/db/schema.js');
  const { eq, and, inArray } = await import('drizzle-orm');

  // Shared verification pool for assertions (independent client pool)
  const verifyPool = new pg.Pool({
    host: process.env.SQL_HOST || '127.0.0.1',
    port: parseInt(process.env.SQL_PORT || '5432', 10),
    user: process.env.SQL_USER || 'homehub_app',
    password: process.env.SQL_PASSWORD,
    database: 'homehub_test',
    max: 10,
  });

  // Helper to query raw SQL
  const query = async (sqlText: string, params: any[] = []) => {
    return await verifyPool.query(sqlText, params);
  };

  try {
    // ------------------------------------------------------------------------
    // PHASE 4B: APPLICATION ROLE ACCESS VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 4B: APPLICATION RUNTIME ROLE PERMISSIONS ---');
    {
      const roleCheck = await query('SELECT current_user, session_user;');
      const appUser = roleCheck.rows[0].current_user;
      
      // Verify role is exactly homehub_app
      if (appUser === 'homehub_app') {
        recordPass('ROLE_AUTH', 'Runtime role confirmed as homehub_app', `current_user: '${appUser}'`);
      } else {
        recordFail('ROLE_AUTH', 'Runtime role mismatch', `Expected 'homehub_app', got '${appUser}'`);
      }

      // Verify app role is non-superuser
      const superCheck = await query(`SELECT rolsuper FROM pg_roles WHERE rolname = $1;`, [appUser]);
      if (superCheck.rows[0]?.rolsuper === false) {
        recordPass('ROLE_AUTH', 'Application role is strictly non-superuser', 'Privilege isolation confirmed');
      } else {
        recordFail('ROLE_AUTH', 'Application role has inappropriate superuser privilege', `rolsuper: ${superCheck.rows[0]?.rolsuper}`);
      }

      // Verify DML permissions on key tables
      const testDmlPropId = `prop_role_check_${RUN_ID}`;
      await query(`INSERT INTO properties (id, name, type, status) VALUES ($1, $2, $3, $4);`, [testDmlPropId, 'Role Test', 'APARTMENT', 'AVAILABLE']);
      createdFixtureIds.properties.push(testDmlPropId);
      const readDml = await query(`SELECT id FROM properties WHERE id = $1;`, [testDmlPropId]);
      await query(`UPDATE properties SET name = $1 WHERE id = $2;`, ['Role Test Updated', testDmlPropId]);
      
      if (readDml.rows.length === 1) {
        recordPass('ROLE_AUTH', 'Application role DML verification (SELECT, INSERT, UPDATE)', 'homehub_app possesses full verified DML grants');
      } else {
        recordFail('ROLE_AUTH', 'Application role lacks necessary DML privileges', 'Failed DML test');
      }
    }

    // Fixture Setup Helper
    let fixtureCounter = 0;
    async function createTestEnvironment(prefix: string) {
      fixtureCounter++;
      const pId = `prop_${RUN_ID}_${prefix}_${fixtureCounter}`;
      const uId = `unit_${RUN_ID}_${prefix}_${fixtureCounter}`;
      const ownerId = `user_owner_${RUN_ID}_${prefix}_${fixtureCounter}`;
      const tenantId = `user_tenant_${RUN_ID}_${prefix}_${fixtureCounter}`;
      const compId = `org_${RUN_ID}_${prefix}_${fixtureCounter}`;
      const mgrId = `user_mgr_${RUN_ID}_${prefix}_${fixtureCounter}`;

      // Insert Property
      await query(
        `INSERT INTO properties (id, name, type, status) VALUES ($1, $2, $3, $4);`,
        [pId, `Property ${prefix}`, 'APARTMENT', 'AVAILABLE']
      );
      createdFixtureIds.properties.push(pId);

      // Insert Unit
      await query(
        `INSERT INTO units (id, property_id, unit_number, status) VALUES ($1, $2, $3, $4);`,
        [uId, pId, `U-${fixtureCounter}`, 'AVAILABLE']
      );
      createdFixtureIds.units.push(uId);

      // Insert Owner User
      await query(
        `INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
        [ownerId, 'Owner', prefix, `owner_${prefix}_${RUN_ID}_${fixtureCounter}@test.com`, JSON.stringify(['PROPERTY_OWNER'])]
      );
      createdFixtureIds.users.push(ownerId);

      // Insert Ownership Record (VERIFIED)
      const ownRecId = `own_${RUN_ID}_${prefix}_${fixtureCounter}`;
      await query(
        `INSERT INTO ownership_records (id, property_id, owner_id, ownership_percentage, status) VALUES ($1, $2, $3, $4, $5);`,
        [ownRecId, pId, ownerId, '100.00', 'VERIFIED']
      );
      createdFixtureIds.ownershipRecords.push(ownRecId);

      // Insert Tenant User
      await query(
        `INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
        [tenantId, 'Tenant', prefix, `tenant_${prefix}_${RUN_ID}_${fixtureCounter}@test.com`, JSON.stringify(['TENANT'])]
      );
      createdFixtureIds.users.push(tenantId);

      // Insert Approved Rental Application
      const appId = `app_${RUN_ID}_${prefix}_${fixtureCounter}`;
      await query(
        `INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
        [appId, pId, tenantId, 'APPROVED']
      );
      createdFixtureIds.rentalApplications.push(appId);

      // Insert Organization (Company)
      await query(
        `INSERT INTO organizations (id, name, type) VALUES ($1, $2, $3);`,
        [compId, `Company ${prefix}`, 'COMPANY']
      );
      createdFixtureIds.organizations.push(compId);

      // Insert Manager User
      await query(
        `INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
        [mgrId, 'Manager', prefix, `mgr_${prefix}_${RUN_ID}_${fixtureCounter}@test.com`, JSON.stringify(['COMPANY'])]
      );
      createdFixtureIds.users.push(mgrId);

      // Link Manager User to Organization via organization_members
      const memId = `mem_${RUN_ID}_${prefix}_${fixtureCounter}`;
      await query(
        `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, $4, $5);`,
        [memId, compId, mgrId, 'PROPERTY_MANAGER', 'ACTIVE']
      );
      createdFixtureIds.organizationMembers.push(memId);

      // Insert Active Management Agreement
      const agId = `ag_${RUN_ID}_${prefix}_${fixtureCounter}`;
      await query(
        `INSERT INTO management_agreements (id, property_id, company_id, owner_id, start_date, status, granted_permissions)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [agId, pId, compId, ownerId, '2026-01-01', 'ACTIVE', JSON.stringify(['MANAGE_LEASES', 'VIEW_PROPERTY'])]
      );
      createdFixtureIds.managementAgreements.push(agId);

      return { pId, uId, ownerId, tenantId, compId, mgrId };
    }

    // ------------------------------------------------------------------------
    // PHASE 5: REAL POSTGRESQL TRANSACTION ATOMICITY TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 5: TRANSACTION ATOMICITY TESTS ---');

    // TEST 5.1: Overlap rejection creates zero partial lease, tenant link, schedule, or deposit
    {
      const env = await createTestEnvironment('tx_overlap');
      const seedLeaseId = `l_seed_${RUN_ID}_1`;
      await query(
        `INSERT INTO leases (id, property_id, unit_id, status, start_date, end_date, rent_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [seedLeaseId, env.pId, env.uId, 'ACTIVE', '2026-01-01', '2026-12-31', '1200']
      );
      createdFixtureIds.leases.push(seedLeaseId);

      let caughtError = false;
      let caughtErrorMsg: string | null = null;
      try {
        await ownerRepository.createLease(
          { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
          {
            propertyId: env.pId,
            unitId: env.uId,
            tenantId: env.tenantId,
            startDate: '2026-06-01',
            endDate: '2026-12-31',
            rentAmount: 1400,
          }
        );
      } catch (err: any) {
        caughtErrorMsg = err.message;
        caughtError = err.message.includes('VALIDATION_ERROR');
      }

      const leaseCheck = await query(`SELECT * FROM leases WHERE property_id = $1 AND start_date = '2026-06-01';`, [env.pId]);
      const linkCheck = await query(`SELECT * FROM lease_tenants WHERE tenant_id = $1 AND lease_id != $2;`, [env.tenantId, seedLeaseId]);
      const schedCheck = await query(`SELECT * FROM rent_schedules WHERE property_id = $1;`, [env.pId]);

      if (caughtError && leaseCheck.rows.length === 0 && linkCheck.rows.length === 0 && schedCheck.rows.length === 0) {
        recordPass('ATOM_01', 'Overlap rejection leaves zero partial records', 'Zero partial lease, tenant link, or rent schedule committed');
      } else {
        recordFail('ATOM_01', 'Overlap rejection failed or left orphaned records', `caughtError: ${caughtError} (msg: ${caughtErrorMsg}), Leases: ${leaseCheck.rows.length}, Links: ${linkCheck.rows.length}`);
      }
    }

    // TEST 5.2: Forced tenant-link failure rolls back preceding lease insert
    {
      const env = await createTestEnvironment('tx_fk_fail');
      const testLeaseId = `l_rollback_${RUN_ID}_2`;

      let rollbackCaught = false;
      try {
        await db.transaction(async (tx) => {
          await tx.insert(leases).values({
            id: testLeaseId,
            propertyId: env.pId,
            unitId: env.uId,
            status: LeaseStatus.PENDING_SIGNATURE,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            rentAmount: '1000',
          });

          // Forced violation: insert leaseTenant with invalid non-existent tenant ID (foreign key failure)
          await tx.insert(leaseTenants).values({
            id: `lt_fail_${RUN_ID}`,
            leaseId: testLeaseId,
            tenantId: 'non_existent_tenant_uuid_00000',
            isPrimary: true,
          });
        });
      } catch (err: any) {
        rollbackCaught = true;
      }

      const checkLease = await query(`SELECT * FROM leases WHERE id = $1;`, [testLeaseId]);
      if (rollbackCaught && checkLease.rows.length === 0) {
        recordPass('ATOM_02', 'Forced FK failure atomically rolls back lease insert', `Lease ${testLeaseId} rolled back cleanly`);
      } else {
        recordFail('ATOM_02', 'Lease insert survived rollback', `Rows found: ${checkLease.rows.length}`);
      }
    }

    // TEST 5.3: Invalid unit/property relationship is rejected without partial writes
    {
      const envA = await createTestEnvironment('tx_unit_rel_a');
      const envB = await createTestEnvironment('tx_unit_rel_b');

      let foreignUnitRejected = false;
      try {
        await ownerRepository.createLease(
          { id: envA.ownerId, roles: ['PROPERTY_OWNER'] },
          {
            propertyId: envA.pId,
            unitId: envB.uId, // Mismatched unit from Property B!
            tenantId: envA.tenantId,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            rentAmount: 1100,
          }
        );
      } catch (err: any) {
        foreignUnitRejected = err.message.includes('does not belong to the selected property') || err.message.includes('VALIDATION_ERROR');
      }

      const leaseA = await query(`SELECT * FROM leases WHERE property_id = $1;`, [envA.pId]);
      if (foreignUnitRejected && leaseA.rows.length === 0) {
        recordPass('ATOM_03', 'Cross-property unit mismatch rejected with zero partial writes', 'Rejected foreign unit before insert');
      } else {
        recordFail('ATOM_03', 'Cross-property unit created lease', `foreignUnitRejected: ${foreignUnitRejected}, Leases committed: ${leaseA.rows.length}`);
      }
    }

    // TEST 5.4: Activation of conflicting lease rolls back status change and schedule/deposit writes
    {
      const env = await createTestEnvironment('tx_activate_conflict');
      const draft1 = await leaseRepository.createLease(env.pId, env.uId, [env.tenantId], '2026-01-01', '2026-12-31', 1000);
      createdFixtureIds.leases.push(draft1.id);

      const tenant2Id = `user_tenant2_${RUN_ID}`;
      await query(
        `INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
        [tenant2Id, 'Tenant2', 'Conflict', `tenant2_${RUN_ID}@test.com`, JSON.stringify(['TENANT'])]
      );
      createdFixtureIds.users.push(tenant2Id);
      const app2Id = `app2_${RUN_ID}`;
      await query(
        `INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
        [app2Id, env.pId, tenant2Id, 'APPROVED']
      );
      createdFixtureIds.rentalApplications.push(app2Id);

      const draft2 = await leaseRepository.createLease(env.pId, env.uId, [tenant2Id], '2026-06-01', '2027-05-31', 1200);
      createdFixtureIds.leases.push(draft2.id);

      // Activate Draft 1 -> succeeds
      await leaseRepository.activateLease(draft1.id);

      // Activate Draft 2 -> must fail due to overlap with now-ACTIVE Draft 1
      let activateFailed = false;
      try {
        await leaseRepository.activateLease(draft2.id);
      } catch (err: any) {
        activateFailed = err.message.includes('VALIDATION_ERROR: Cannot activate lease');
      }

      const checkDraft2 = await query(`SELECT status FROM leases WHERE id = $1;`, [draft2.id]);
      const checkSched2 = await query(`SELECT * FROM rent_schedules WHERE lease_id = $1;`, [draft2.id]);
      const checkDep2 = await query(`SELECT * FROM security_deposits WHERE lease_id = $1;`, [draft2.id]);

      if (activateFailed && checkDraft2.rows[0]?.status === 'DRAFT' && checkSched2.rows.length === 0 && checkDep2.rows.length === 0) {
        recordPass('ATOM_04', 'Conflicting lease activation rollback', 'Draft 2 remained DRAFT; zero schedules or deposits created');
      } else {
        recordFail('ATOM_04', 'Conflicting lease activation modified state', `Status: ${checkDraft2.rows[0]?.status}, Scheds: ${checkSched2.rows.length}`);
      }
    }

    // TEST 5.5: Renewal conflict leaves existing lease, payments, and schedules consistent
    {
      const env = await createTestEnvironment('tx_renew_conflict');
      const leaseA = await leaseRepository.createLease(env.pId, env.uId, [env.tenantId], '2026-01-01', '2026-12-31', 1000);
      createdFixtureIds.leases.push(leaseA.id);
      await leaseRepository.activateLease(leaseA.id);

      const payId = `pay_${RUN_ID}_renew`;
      await query(
        `INSERT INTO payment_records (id, property_id, lease_id, payer_id, amount, recorded_date, status, payment_method)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [payId, env.pId, leaseA.id, env.tenantId, '1000', '2026-06-01', 'CONFIRMED', 'BANK_TRANSFER']
      );
      createdFixtureIds.paymentRecords.push(payId);

      const competingLeaseId = `l_comp_${RUN_ID}`;
      await query(
        `INSERT INTO leases (id, property_id, unit_id, status, start_date, end_date, rent_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [competingLeaseId, env.pId, env.uId, 'PENDING_APPROVAL', '2027-01-01', '2027-12-31', '1200']
      );
      createdFixtureIds.leases.push(competingLeaseId);

      const renId = `ren_${RUN_ID}_1`;
      await query(
        `INSERT INTO lease_renewals (id, lease_id, property_id, tenant_id, proposed_start_date, proposed_end_date, proposed_rent_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [renId, leaseA.id, env.pId, env.tenantId, '2027-01-01', '2027-12-31', '1100', 'REQUESTED']
      );
      createdFixtureIds.leaseRenewals.push(renId);

      let renewalFailed = false;
      try {
        await leaseRepository.approveRenewal(renId);
      } catch (err: any) {
        renewalFailed = err.message.includes('VALIDATION_ERROR: Cannot approve renewal');
      }

      const checkLeaseA = await query(`SELECT end_date, status FROM leases WHERE id = $1;`, [leaseA.id]);
      const checkPay = await query(`SELECT * FROM payment_records WHERE id = $1;`, [payId]);
      const schedCount = await query(`SELECT count(*) FROM rent_schedules WHERE lease_id = $1;`, [leaseA.id]);

      if (renewalFailed && checkLeaseA.rows[0]?.end_date === '2026-12-31' && checkPay.rows.length === 1 && parseInt(schedCount.rows[0].count, 10) === 12) {
        recordPass('ATOM_05', 'Renewal conflict cleanly rejected with zero state corruption', 'Original end date and 12 schedules preserved');
      } else {
        recordFail('ATOM_05', 'Renewal conflict altered original lease', `End date: ${checkLeaseA.rows[0]?.end_date}, Scheds: ${schedCount.rows[0]?.count}`);
      }
    }

    // TEST 5.6: Successful valid operation commits all intended related records
    {
      const env = await createTestEnvironment('tx_valid_commit');
      const lease = await leaseRepository.createLease(env.pId, env.uId, [env.tenantId], '2026-01-01', '2026-12-31', 1000);
      createdFixtureIds.leases.push(lease.id);

      await leaseRepository.activateLease(lease.id);

      const checkLease = await query(`SELECT status FROM leases WHERE id = $1;`, [lease.id]);
      const checkTenant = await query(`SELECT * FROM lease_tenants WHERE lease_id = $1;`, [lease.id]);
      const checkSched = await query(`SELECT count(*) FROM rent_schedules WHERE lease_id = $1;`, [lease.id]);

      if (checkLease.rows[0]?.status === 'ACTIVE' && checkTenant.rows.length === 1 && parseInt(checkSched.rows[0].count, 10) === 12) {
        recordPass('ATOM_06', 'Valid lease creation and activation commits all entities', 'ACTIVE status, tenant link, and 12 monthly rent schedules committed');
      } else {
        recordFail('ATOM_06', 'Valid operation failed to commit all entities', `Status: ${checkLease.rows[0]?.status}, Scheds: ${checkSched.rows[0]?.count}`);
      }
    }

    // ------------------------------------------------------------------------
    // PHASE 5B: FAILURE & RECOVERY BEHAVIOR TESTS
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 5B: FAILURE & RECOVERY BEHAVIOR TESTS ---');

    // TEST REC_01: Client reuse and pool health after a rejected transaction
    {
      const env = await createTestEnvironment('rec_pool_reuse');
      const seedLeaseId = `l_seed_reuse_${RUN_ID}`;
      await query(
        `INSERT INTO leases (id, property_id, unit_id, status, start_date, end_date, rent_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [seedLeaseId, env.pId, env.uId, 'ACTIVE', '2026-01-01', '2026-12-31', '1000']
      );
      createdFixtureIds.leases.push(seedLeaseId);

      // Intentionally cause transaction failure via overlap
      try {
        await ownerRepository.createLease(
          { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
          { propertyId: env.pId, unitId: env.uId, tenantId: env.tenantId, startDate: '2026-06-01', endDate: '2026-12-31', rentAmount: 1200 }
        );
      } catch {
        // Expected rejection
      }

      // Immediately execute normal query using the application pool
      const healthCheck = await db.select().from(properties).where(eq(properties.id, env.pId));
      if (healthCheck.length === 1) {
        recordPass('REC_01', 'Connection pool health intact after transaction failure', 'Client cleanly recycled; subsequent pool query succeeded without abort state');
      } else {
        recordFail('REC_01', 'Connection pool corrupted by failed transaction', 'Health check failed');
      }
    }

    // TEST REC_02: Lock waiting and bounded timeout behavior (PostgreSQL 55P03 lock timeout)
    {
      const env = await createTestEnvironment('rec_lock_timeout');
      
      // Dedicated client A checks out from verifyPool and locks property
      const clientA = await verifyPool.connect();
      const clientB = await verifyPool.connect();

      try {
        await clientA.query('BEGIN;');
        await clientA.query(`SELECT * FROM properties WHERE id = $1 FOR UPDATE;`, [env.pId]);

        // Client B attempts to acquire lock with 300ms lock_timeout
        let timeoutCaught = false;
        await clientB.query('BEGIN;');
        await clientB.query(`SET LOCAL lock_timeout = '300ms';`);
        try {
          await clientB.query(`SELECT * FROM properties WHERE id = $1 FOR UPDATE;`, [env.pId]);
        } catch (lockErr: any) {
          timeoutCaught = lockErr.code === '55P03' || /lock timeout|canceling statement/i.test(lockErr.message);
        }
        await clientB.query('ROLLBACK;');

        // Client A finishes cleanly
        await clientA.query('COMMIT;');

        // Now Client B retries after lock is released: must succeed immediately
        await clientB.query('BEGIN;');
        const retryResult = await clientB.query(`SELECT id FROM properties WHERE id = $1 FOR UPDATE;`, [env.pId]);
        await clientB.query('COMMIT;');

        if (timeoutCaught && retryResult.rows.length === 1) {
          recordPass('REC_02', 'Lock waiting and bounded timeout behavior', 'Client timed out cleanly (55P03) and succeeded upon lock release');
        } else {
          recordFail('REC_02', 'Lock timeout behavior failed', `Timeout caught: ${timeoutCaught}, Retry rows: ${retryResult.rows.length}`);
        }
      } finally {
        clientA.release();
        clientB.release();
      }
    }

    // TEST REC_03: Repeated attempts after an earlier conflicting operation rolls back
    {
      const env = await createTestEnvironment('rec_retry_after_rollback');
      
      // Simulating a failed attempt that aborts mid-transaction
      try {
        await db.transaction(async (tx) => {
          await leaseRepository.assertNoPhysicalSpaceOverlap(tx, {
            propertyId: env.pId,
            unitId: env.uId,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
          });
          // Abort deliberately
          throw new Error('SIMULATED_ABORT: Transaction failed mid-way');
        });
      } catch {
        // Expected abort
      }

      // Proving a subsequent attempt for the exact same unit & period succeeds with zero phantom locks
      const successLease = await ownerRepository.createLease(
        { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
        {
          propertyId: env.pId,
          unitId: env.uId,
          tenantId: env.tenantId,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          rentAmount: 1300,
        }
      );
      createdFixtureIds.leases.push(successLease.id);

      const committed = await query(`SELECT id, status FROM leases WHERE id = $1;`, [successLease.id]);
      if (committed.rows.length === 1) {
        recordPass('REC_03', 'Subsequent attempt succeeds after earlier operation rollbacks', 'Zero phantom locks; subsequent reservation committed cleanly');
      } else {
        recordFail('REC_03', 'Subsequent attempt blocked by phantom lock', 'Failed to commit lease');
      }
    }

    // TEST REC_04: Recovery after failed operation with corrected dates
    {
      const env = await createTestEnvironment('rec_corrected_dates');
      const seedLeaseId = `l_seed_corr_${RUN_ID}`;
      await query(
        `INSERT INTO leases (id, property_id, unit_id, status, start_date, end_date, rent_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [seedLeaseId, env.pId, env.uId, 'ACTIVE', '2026-01-01', '2026-12-31', '1000']
      );
      createdFixtureIds.leases.push(seedLeaseId);

      // Attempt overlapping date -> rejected
      try {
        await ownerRepository.createLease(
          { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
          { propertyId: env.pId, unitId: env.uId, tenantId: env.tenantId, startDate: '2026-06-01', endDate: '2026-12-31', rentAmount: 1000 }
        );
      } catch {
        // Expected rejection
      }

      // Immediately recover by submitting corrected non-overlapping dates (2027)
      const correctedLease = await ownerRepository.createLease(
        { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
        { propertyId: env.pId, unitId: env.uId, tenantId: env.tenantId, startDate: '2027-01-01', endDate: '2027-12-31', rentAmount: 1100 }
      );
      createdFixtureIds.leases.push(correctedLease.id);

      const checkCorrected = await query(`SELECT id FROM leases WHERE id = $1;`, [correctedLease.id]);
      if (checkCorrected.rows.length === 1) {
        recordPass('REC_04', 'Correction & retry recovery path succeeds', 'Corrected reservation for 2027 committed cleanly after 2026 conflict');
      } else {
        recordFail('REC_04', 'Corrected reservation failed', 'Could not commit corrected lease');
      }
    }

    // TEST REC_05: Idempotency & duplicate protection on concurrent activation of same lease
    {
      const env = await createTestEnvironment('rec_idempotent_activation');
      const draft = await leaseRepository.createLease(env.pId, env.uId, [env.tenantId], '2026-01-01', '2026-12-31', 1000);
      createdFixtureIds.leases.push(draft.id);
      await query(`UPDATE leases SET deposit_amount = '500' WHERE id = $1;`, [draft.id]);

      const barrier = createBarrier(2);

      const taskA = async () => {
        await barrier.wait();
        try {
          await leaseRepository.activateLease(draft.id);
          return { client: 'A', success: true };
        } catch (err: any) {
          return { client: 'A', success: false, error: err.message };
        }
      };

      const taskB = async () => {
        await barrier.wait();
        try {
          await leaseRepository.activateLease(draft.id);
          return { client: 'B', success: true };
        } catch (err: any) {
          return { client: 'B', success: false, error: err.message };
        }
      };

      const results = await Promise.all([taskA(), taskB()]);
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      // Database verification: exactly 12 rent schedules, exactly 1 security deposit, zero duplicate entries
      const schedCount = await query(`SELECT count(*) FROM rent_schedules WHERE lease_id = $1;`, [draft.id]);
      const depCount = await query(`SELECT count(*) FROM security_deposits WHERE lease_id = $1;`, [draft.id]);

      if (successes.length === 1 && failures.length === 1 && parseInt(schedCount.rows[0].count, 10) === 12 && parseInt(depCount.rows[0].count, 10) === 1) {
        recordPass('REC_05', 'Idempotent activation prevents duplicate schedules and deposits', 'Exactly 1 activation succeeded; exactly 12 schedules and 1 deposit generated');
      } else {
        recordFail('REC_05', 'Duplicate schedules or deposits created by concurrent activation', `Successes: ${successes.length}, Scheds: ${schedCount.rows[0]?.count}, Deps: ${depCount.rows[0]?.count}`);
      }
    }

    // ------------------------------------------------------------------------
    // PHASE 6: BOUNDED REPEATABLE MULTI-CLIENT CONCURRENCY RUNS
    // ------------------------------------------------------------------------
    console.log(`\n--- PHASE 6: BOUNDED REPEATABLE CONCURRENCY SUITE (${REPEAT_COUNT} ITERATIONS) ---`);

    // SCENARIO 6.1: 10 concurrent clients competing for the same unit lease
    {
      console.log(`\n[SCENARIO 6.1] 10 concurrent clients competing for the same unit (${REPEAT_COUNT} iterations)...`);
      let totalAttempts = 0;
      let totalSuccesses = 0;
      let totalRejections = 0;
      let unexpectedErrors = 0;
      let invariantViolations = 0;

      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`race10_iter${iter}`);
        const CLIENT_COUNT = 10;
        const tenants: string[] = [];

        for (let i = 0; i < CLIENT_COUNT; i++) {
          const tId = `user_race10_${RUN_ID}_${iter}_${i}`;
          await query(
            `INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
            [tId, `Tenant_${i}`, `R${iter}`, `race10_${RUN_ID}_${iter}_${i}@test.com`, JSON.stringify(['TENANT'])]
          );
          createdFixtureIds.users.push(tId);

          const appId = `app_race10_${RUN_ID}_${iter}_${i}`;
          await query(
            `INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
            [appId, env.pId, tId, 'APPROVED']
          );
          createdFixtureIds.rentalApplications.push(appId);
          tenants.push(tId);
        }

        const barrier = createBarrier(CLIENT_COUNT);
        const tasks = tenants.map((tenantId, index) => {
          return withTimeout(
            (async () => {
              await barrier.wait();
              try {
                const lease = await ownerRepository.createLease(
                  { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
                  {
                    propertyId: env.pId,
                    unitId: env.uId,
                    tenantId: tenantId,
                    startDate: '2026-01-01',
                    endDate: '2026-12-31',
                    rentAmount: 1000 + index * 10,
                  }
                );
                return { success: true, leaseId: lease.id, error: null };
              } catch (err: any) {
                const isExpected = err.message.includes('VALIDATION_ERROR');
                return { success: false, leaseId: null, error: err.message, isExpected };
              }
            })(),
            OPERATION_TIMEOUT_MS,
            `10_client_race_iter_${iter}_client_${index}`
          );
        });

        const results = await Promise.all(tasks);
        totalAttempts += results.length;
        const successes = results.filter(r => r.success);
        const expectedRejections = results.filter(r => !r.success && r.isExpected);
        const unexp = results.filter(r => !r.success && !r.isExpected);

        totalSuccesses += successes.length;
        totalRejections += expectedRejections.length;
        unexpectedErrors += unexp.length;

        // Fresh database query
        const committed = await query(`SELECT id FROM leases WHERE property_id = $1 AND unit_id = $2;`, [env.pId, env.uId]);
        for (const r of committed.rows) createdFixtureIds.leases.push(r.id);

        if (committed.rows.length !== 1 || successes.length !== 1) {
          invariantViolations++;
        }
      }

      scenarioMetricsTable.push({
        scenario: '10 Concurrent Clients (Same Unit)',
        iterations: REPEAT_COUNT,
        totalAttempts,
        successes: totalSuccesses,
        expectedRejections: totalRejections,
        unexpectedErrors,
        invariantViolations,
      });

      if (totalSuccesses === REPEAT_COUNT && invariantViolations === 0 && unexpectedErrors === 0) {
        recordPass('CONC_01', `10-client concurrent race across ${REPEAT_COUNT} iterations`, `Attempts: ${totalAttempts}, Wins: ${totalSuccesses}, Expected Rejections: ${totalRejections}, Invariant Violations: 0`);
      } else {
        recordFail('CONC_01', 'Race condition in 10-client race', `Wins: ${totalSuccesses}, Violations: ${invariantViolations}`);
      }
    }

    // SCENARIO 6.2: Whole-property vs Unit-level conflict race (both directions, bounded repeat)
    {
      console.log(`\n[SCENARIO 6.2] Competing whole-property vs unit-level (${REPEAT_COUNT} iterations)...`);
      let totalAttempts = 0;
      let totalSuccesses = 0;
      let totalRejections = 0;
      let unexpectedErrors = 0;
      let invariantViolations = 0;

      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`prop_vs_unit_${iter}`);
        
        const tWholeId = `t_wh_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [tWholeId, 'Whole', 'Tenant', `twh_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(tWholeId);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_wh_${RUN_ID}_${iter}`, env.pId, tWholeId, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_wh_${RUN_ID}_${iter}`);

        const tUnitId = `t_un_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [tUnitId, 'Unit', 'Tenant', `tun_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(tUnitId);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_un_${RUN_ID}_${iter}`, env.pId, tUnitId, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_un_${RUN_ID}_${iter}`);

        const barrier = createBarrier(2);

        const taskWhole = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              const l = await ownerRepository.createLease(
                { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
                { propertyId: env.pId, unitId: undefined, tenantId: tWholeId, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 3000 }
              );
              return { target: 'WHOLE', success: true, leaseId: l.id };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR');
              return { target: 'WHOLE', success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `prop_vs_unit_whole_${iter}`
        );

        const taskUnit = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              const l = await ownerRepository.createLease(
                { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
                { propertyId: env.pId, unitId: env.uId, tenantId: tUnitId, startDate: '2026-06-01', endDate: '2026-12-31', rentAmount: 1000 }
              );
              return { target: 'UNIT', success: true, leaseId: l.id };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR');
              return { target: 'UNIT', success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `prop_vs_unit_unit_${iter}`
        );

        const results = await Promise.all([taskWhole, taskUnit]);
        totalAttempts += 2;
        const successes = results.filter(r => r.success);
        const expectedRejections = results.filter(r => !r.success && r.isExpected);
        const unexp = results.filter(r => !r.success && !r.isExpected);

        totalSuccesses += successes.length;
        totalRejections += expectedRejections.length;
        unexpectedErrors += unexp.length;

        const committed = await query(`SELECT id FROM leases WHERE property_id = $1;`, [env.pId]);
        for (const r of committed.rows) createdFixtureIds.leases.push(r.id);

        if (committed.rows.length !== 1 || successes.length !== 1) {
          invariantViolations++;
        }
      }

      scenarioMetricsTable.push({
        scenario: 'Whole-Property vs Unit Conflict',
        iterations: REPEAT_COUNT,
        totalAttempts,
        successes: totalSuccesses,
        expectedRejections: totalRejections,
        unexpectedErrors,
        invariantViolations,
      });

      if (totalSuccesses === REPEAT_COUNT && invariantViolations === 0 && unexpectedErrors === 0) {
        recordPass('CONC_02', `Whole-Property vs Unit conflict race across ${REPEAT_COUNT} iterations`, `Attempts: ${totalAttempts}, Wins: ${totalSuccesses}, Invariant Violations: 0`);
      } else {
        recordFail('CONC_02', 'Conflict race failure', `Wins: ${totalSuccesses}, Violations: ${invariantViolations}`);
      }
    }

    // SCENARIO 6.3: Owner (PENDING_SIGNATURE) vs Company (PENDING_APPROVAL)
    {
      console.log(`\n[SCENARIO 6.3] Competing Owner vs Company reservation (${REPEAT_COUNT} iterations)...`);
      let totalAttempts = 0;
      let totalSuccesses = 0;
      let totalRejections = 0;
      let unexpectedErrors = 0;
      let invariantViolations = 0;

      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`own_vs_cmp_${iter}`);

        const tOwnId = `t_own_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [tOwnId, 'ApplicantA', 'Test', `town_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(tOwnId);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_own_${RUN_ID}_${iter}`, env.pId, tOwnId, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_own_${RUN_ID}_${iter}`);

        const tCmpId = `t_cmp_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [tCmpId, 'ApplicantB', 'Test', `tcmp_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(tCmpId);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_cmp_${RUN_ID}_${iter}`, env.pId, tCmpId, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_cmp_${RUN_ID}_${iter}`);

        const barrier = createBarrier(2);

        const taskOwner = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              const l = await ownerRepository.createLease(
                { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
                { propertyId: env.pId, unitId: env.uId, tenantId: tOwnId, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 1100 }
              );
              return { actor: 'OWNER', success: true, status: l.status };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR');
              return { actor: 'OWNER', success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `owner_task_${iter}`
        );

        const taskCompany = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              const l = await companyRepository.createLeaseDraft(
                env.compId,
                env.mgrId,
                { propertyId: env.pId, unitId: env.uId, tenantId: tCmpId, startDate: '2026-06-01', endDate: '2026-12-31', rentAmount: 1150 }
              );
              return { actor: 'COMPANY', success: true, status: l.status };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR');
              return { actor: 'COMPANY', success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `company_task_${iter}`
        );

        const results = await Promise.all([taskOwner, taskCompany]);
        totalAttempts += 2;
        const successes = results.filter(r => r.success);
        const expectedRejections = results.filter(r => !r.success && r.isExpected);
        const unexp = results.filter(r => !r.success && !r.isExpected);

        totalSuccesses += successes.length;
        totalRejections += expectedRejections.length;
        unexpectedErrors += unexp.length;

        const committed = await query(`SELECT id, status FROM leases WHERE property_id = $1 AND unit_id = $2;`, [env.pId, env.uId]);
        for (const r of committed.rows) createdFixtureIds.leases.push(r.id);

        if (committed.rows.length !== 1 || successes.length !== 1) {
          invariantViolations++;
        }
      }

      scenarioMetricsTable.push({
        scenario: 'Owner vs Company (PENDING_SIGNATURE vs PENDING_APPROVAL)',
        iterations: REPEAT_COUNT,
        totalAttempts,
        successes: totalSuccesses,
        expectedRejections: totalRejections,
        unexpectedErrors,
        invariantViolations,
      });

      if (totalSuccesses === REPEAT_COUNT && invariantViolations === 0 && unexpectedErrors === 0) {
        recordPass('CONC_03', `Owner vs Company mutual exclusion across ${REPEAT_COUNT} iterations`, `Attempts: ${totalAttempts}, Wins: ${totalSuccesses}, Invariant Violations: 0`);
      } else {
        recordFail('CONC_03', 'Owner vs Company race failure', `Wins: ${totalSuccesses}, Violations: ${invariantViolations}`);
      }
    }

    // SCENARIO 6.4: Concurrent activation of two overlapping DRAFT leases
    {
      console.log(`\n[SCENARIO 6.4] Concurrent activation of two overlapping DRAFT leases (${REPEAT_COUNT} iterations)...`);
      let totalAttempts = 0;
      let totalSuccesses = 0;
      let totalRejections = 0;
      let unexpectedErrors = 0;
      let invariantViolations = 0;

      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`act_race_${iter}`);

        const t1 = `t_act1_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t1, 'T1', 'Act', `tact1_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t1);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_act1_${RUN_ID}_${iter}`, env.pId, t1, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_act1_${RUN_ID}_${iter}`);

        const t2 = `t_act2_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t2, 'T2', 'Act', `tact2_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t2);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_act2_${RUN_ID}_${iter}`, env.pId, t2, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_act2_${RUN_ID}_${iter}`);

        const d1 = await leaseRepository.createLease(env.pId, env.uId, [t1], '2026-01-01', '2026-12-31', 1000);
        const d2 = await leaseRepository.createLease(env.pId, env.uId, [t2], '2026-06-01', '2026-12-31', 1200);
        createdFixtureIds.leases.push(d1.id, d2.id);

        const barrier = createBarrier(2);

        const taskAct1 = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              await leaseRepository.activateLease(d1.id);
              return { id: d1.id, success: true };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR: Cannot activate lease');
              return { id: d1.id, success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `activate_d1_${iter}`
        );

        const taskAct2 = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              await leaseRepository.activateLease(d2.id);
              return { id: d2.id, success: true };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR: Cannot activate lease');
              return { id: d2.id, success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `activate_d2_${iter}`
        );

        const results = await Promise.all([taskAct1, taskAct2]);
        totalAttempts += 2;
        const successes = results.filter(r => r.success);
        const expectedRejections = results.filter(r => !r.success && r.isExpected);
        const unexp = results.filter(r => !r.success && !r.isExpected);

        totalSuccesses += successes.length;
        totalRejections += expectedRejections.length;
        unexpectedErrors += unexp.length;

        const committedActive = await query(`SELECT id FROM leases WHERE property_id = $1 AND status = 'ACTIVE';`, [env.pId]);

        if (committedActive.rows.length !== 1 || successes.length !== 1) {
          invariantViolations++;
        }
      }

      scenarioMetricsTable.push({
        scenario: 'Concurrent DRAFT Activation',
        iterations: REPEAT_COUNT,
        totalAttempts,
        successes: totalSuccesses,
        expectedRejections: totalRejections,
        unexpectedErrors,
        invariantViolations,
      });

      if (totalSuccesses === REPEAT_COUNT && invariantViolations === 0 && unexpectedErrors === 0) {
        recordPass('CONC_04', `Concurrent DRAFT activation race across ${REPEAT_COUNT} iterations`, `Attempts: ${totalAttempts}, Wins: ${totalSuccesses}, Invariant Violations: 0`);
      } else {
        recordFail('CONC_04', 'Concurrent activation allowed double-active state', `Wins: ${totalSuccesses}, Violations: ${invariantViolations}`);
      }
    }

    // SCENARIO 6.5: Renewal approval competing with new lease creation
    {
      console.log(`\n[SCENARIO 6.5] Renewal competing with new lease creation (${REPEAT_COUNT} iterations)...`);
      let totalAttempts = 0;
      let totalSuccesses = 0;
      let totalRejections = 0;
      let unexpectedErrors = 0;
      let invariantViolations = 0;

      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`ren_race_${iter}`);

        const leaseA = await leaseRepository.createLease(env.pId, env.uId, [env.tenantId], '2026-01-01', '2026-12-31', 1000);
        createdFixtureIds.leases.push(leaseA.id);
        await leaseRepository.activateLease(leaseA.id);

        const renId = `ren_race_${RUN_ID}_${iter}`;
        await query(
          `INSERT INTO lease_renewals (id, lease_id, property_id, tenant_id, proposed_start_date, proposed_end_date, proposed_rent_amount, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [renId, leaseA.id, env.pId, env.tenantId, '2027-01-01', '2027-12-31', '1100', 'REQUESTED']
        );
        createdFixtureIds.leaseRenewals.push(renId);

        const tComp = `t_comp_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [tComp, 'CompTenant', 'Race', `tcomp_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(tComp);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_comp_${RUN_ID}_${iter}`, env.pId, tComp, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_comp_${RUN_ID}_${iter}`);

        const barrier = createBarrier(2);

        const taskRenewal = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              await leaseRepository.approveRenewal(renId);
              return { op: 'RENEWAL', success: true };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR: Cannot approve renewal');
              return { op: 'RENEWAL', success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `renewal_task_${iter}`
        );

        const taskNewLease = withTimeout(
          (async () => {
            await barrier.wait();
            try {
              const l = await ownerRepository.createLease(
                { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
                { propertyId: env.pId, unitId: env.uId, tenantId: tComp, startDate: '2027-01-01', endDate: '2027-12-31', rentAmount: 1300 }
              );
              return { op: 'NEW_LEASE', success: true, leaseId: l.id };
            } catch (err: any) {
              const isExpected = err.message.includes('VALIDATION_ERROR');
              return { op: 'NEW_LEASE', success: false, error: err.message, isExpected };
            }
          })(),
          OPERATION_TIMEOUT_MS,
          `new_lease_task_${iter}`
        );

        const results = await Promise.all([taskRenewal, taskNewLease]);
        totalAttempts += 2;
        const successes = results.filter(r => r.success);
        const expectedRejections = results.filter(r => !r.success && r.isExpected);
        const unexp = results.filter(r => !r.success && !r.isExpected);

        totalSuccesses += successes.length;
        totalRejections += expectedRejections.length;
        unexpectedErrors += unexp.length;

        const checkLeaseA = await query(`SELECT end_date FROM leases WHERE id = $1;`, [leaseA.id]);
        const checkNewLeases = await query(`SELECT id FROM leases WHERE property_id = $1 AND start_date = '2027-01-01';`, [env.pId]);
        for (const r of checkNewLeases.rows) createdFixtureIds.leases.push(r.id);

        const isExtended = checkLeaseA.rows[0]?.end_date === '2027-12-31';
        const isNewLease = checkNewLeases.rows.length === 1;

        if (successes.length !== 1 || (isExtended === isNewLease)) {
          invariantViolations++;
        }
      }

      scenarioMetricsTable.push({
        scenario: 'Renewal vs New Lease Race',
        iterations: REPEAT_COUNT,
        totalAttempts,
        successes: totalSuccesses,
        expectedRejections: totalRejections,
        unexpectedErrors,
        invariantViolations,
      });

      if (totalSuccesses === REPEAT_COUNT && invariantViolations === 0 && unexpectedErrors === 0) {
        recordPass('CONC_05', `Renewal vs New Lease race across ${REPEAT_COUNT} iterations`, `Attempts: ${totalAttempts}, Wins: ${totalSuccesses}, Invariant Violations: 0`);
      } else {
        recordFail('CONC_05', 'Renewal conflict allowed dual reservation', `Wins: ${totalSuccesses}, Violations: ${invariantViolations}`);
      }
    }

    // SCENARIO 6.6: Positive Control — Concurrent non-overlapping leases
    {
      console.log(`\n[SCENARIO 6.6] Positive Control: Concurrent non-overlapping leases (${REPEAT_COUNT} iterations)...`);
      let totalSuccesses = 0;
      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`pos_nonov_${iter}`);

        const t1 = `t_p1_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t1, 'P1', 'Test', `tp1_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t1);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_p1_${RUN_ID}_${iter}`, env.pId, t1, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_p1_${RUN_ID}_${iter}`);

        const t2 = `t_p2_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t2, 'P2', 'Test', `tp2_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t2);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_p2_${RUN_ID}_${iter}`, env.pId, t2, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_p2_${RUN_ID}_${iter}`);

        const barrier = createBarrier(2);
        const task1 = withTimeout(
          (async () => {
            await barrier.wait();
            return await ownerRepository.createLease(
              { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
              { propertyId: env.pId, unitId: env.uId, tenantId: t1, startDate: '2026-01-01', endDate: '2026-06-30', rentAmount: 1000 }
            );
          })(),
          OPERATION_TIMEOUT_MS,
          `pos_nonov_1_${iter}`
        );

        const task2 = withTimeout(
          (async () => {
            await barrier.wait();
            return await ownerRepository.createLease(
              { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
              { propertyId: env.pId, unitId: env.uId, tenantId: t2, startDate: '2026-07-01', endDate: '2026-12-31', rentAmount: 1000 }
            );
          })(),
          OPERATION_TIMEOUT_MS,
          `pos_nonov_2_${iter}`
        );

        const [l1, l2] = await Promise.all([task1, task2]);
        createdFixtureIds.leases.push(l1.id, l2.id);

        const committed = await query(`SELECT id FROM leases WHERE property_id = $1;`, [env.pId]);
        if (committed.rows.length === 2) totalSuccesses += 2;
      }

      scenarioMetricsTable.push({
        scenario: 'Positive Control: Non-Overlapping Dates',
        iterations: REPEAT_COUNT,
        totalAttempts: REPEAT_COUNT * 2,
        successes: totalSuccesses,
        expectedRejections: 0,
        unexpectedErrors: 0,
        invariantViolations: 0,
      });

      if (totalSuccesses === REPEAT_COUNT * 2) {
        recordPass('CONC_06', `Positive Control: Non-overlapping leases all succeed (${REPEAT_COUNT} iterations)`, `Committed: ${totalSuccesses} / ${REPEAT_COUNT * 2}`);
      } else {
        recordFail('CONC_06', 'Non-overlapping leases falsely collided', `Committed: ${totalSuccesses}`);
      }
    }

    // SCENARIO 6.7: Positive Control — Different units on same property
    {
      console.log(`\n[SCENARIO 6.7] Positive Control: Different units on same property (${REPEAT_COUNT} iterations)...`);
      let totalSuccesses = 0;
      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`pos_diffu_${iter}`);

        const u2Id = `unit2_${RUN_ID}_diff_${iter}`;
        await query(`INSERT INTO units (id, property_id, unit_number, status) VALUES ($1, $2, $3, $4);`,
          [u2Id, env.pId, `U-DIFF-${iter}`, 'AVAILABLE']);
        createdFixtureIds.units.push(u2Id);

        const t1 = `t_du1_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t1, 'DU1', 'Test', `tdu1_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t1);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_du1_${RUN_ID}_${iter}`, env.pId, t1, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_du1_${RUN_ID}_${iter}`);

        const t2 = `t_du2_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t2, 'DU2', 'Test', `tdu2_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t2);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_du2_${RUN_ID}_${iter}`, env.pId, t2, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_du2_${RUN_ID}_${iter}`);

        const barrier = createBarrier(2);
        const taskU1 = withTimeout(
          (async () => {
            await barrier.wait();
            return await ownerRepository.createLease(
              { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
              { propertyId: env.pId, unitId: env.uId, tenantId: t1, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 1000 }
            );
          })(),
          OPERATION_TIMEOUT_MS,
          `pos_diffu_1_${iter}`
        );

        const taskU2 = withTimeout(
          (async () => {
            await barrier.wait();
            return await ownerRepository.createLease(
              { id: env.ownerId, roles: ['PROPERTY_OWNER'] },
              { propertyId: env.pId, unitId: u2Id, tenantId: t2, startDate: '2026-01-01', endDate: '2026-12-31', rentAmount: 1100 }
            );
          })(),
          OPERATION_TIMEOUT_MS,
          `pos_diffu_2_${iter}`
        );

        const [r1, r2] = await Promise.all([taskU1, taskU2]);
        createdFixtureIds.leases.push(r1.id, r2.id);

        const committed = await query(`SELECT id FROM leases WHERE property_id = $1;`, [env.pId]);
        if (committed.rows.length === 2) totalSuccesses += 2;
      }

      scenarioMetricsTable.push({
        scenario: 'Positive Control: Different Units (Same Property)',
        iterations: REPEAT_COUNT,
        totalAttempts: REPEAT_COUNT * 2,
        successes: totalSuccesses,
        expectedRejections: 0,
        unexpectedErrors: 0,
        invariantViolations: 0,
      });

      if (totalSuccesses === REPEAT_COUNT * 2) {
        recordPass('CONC_07', `Positive Control: Different units all succeed (${REPEAT_COUNT} iterations)`, `Committed: ${totalSuccesses} / ${REPEAT_COUNT * 2}`);
      } else {
        recordFail('CONC_07', 'Different unit leases collided falsely', `Committed: ${totalSuccesses}`);
      }
    }

    // SCENARIO 6.8: Positive Control — Concurrent DRAFT offers remain non-blocking
    {
      console.log(`\n[SCENARIO 6.8] Positive Control: Concurrent DRAFT offers remain non-blocking (${REPEAT_COUNT} iterations)...`);
      let totalSuccesses = 0;
      for (let iter = 1; iter <= REPEAT_COUNT; iter++) {
        const env = await createTestEnvironment(`pos_draft_${iter}`);

        const t1 = `t_dr1_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t1, 'DR1', 'Test', `tdr1_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t1);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_dr1_${RUN_ID}_${iter}`, env.pId, t1, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_dr1_${RUN_ID}_${iter}`);

        const t2 = `t_dr2_${RUN_ID}_${iter}`;
        await query(`INSERT INTO users (id, first_name, last_name, email, roles) VALUES ($1, $2, $3, $4, $5);`,
          [t2, 'DR2', 'Test', `tdr2_${RUN_ID}_${iter}@test.com`, JSON.stringify(['TENANT'])]);
        createdFixtureIds.users.push(t2);
        await query(`INSERT INTO rental_applications (id, property_id, applicant_user_id, status) VALUES ($1, $2, $3, $4);`,
          [`app_dr2_${RUN_ID}_${iter}`, env.pId, t2, 'APPROVED']);
        createdFixtureIds.rentalApplications.push(`app_dr2_${RUN_ID}_${iter}`);

        const barrier = createBarrier(2);
        const taskD1 = withTimeout(
          (async () => {
            await barrier.wait();
            return await leaseRepository.createLease(env.pId, env.uId, [t1], '2026-01-01', '2026-12-31', 1000);
          })(),
          OPERATION_TIMEOUT_MS,
          `pos_draft_1_${iter}`
        );

        const taskD2 = withTimeout(
          (async () => {
            await barrier.wait();
            return await leaseRepository.createLease(env.pId, env.uId, [t2], '2026-01-01', '2026-12-31', 1000);
          })(),
          OPERATION_TIMEOUT_MS,
          `pos_draft_2_${iter}`
        );

        const [d1, d2] = await Promise.all([taskD1, taskD2]);
        createdFixtureIds.leases.push(d1.id, d2.id);

        const committed = await query(`SELECT id FROM leases WHERE property_id = $1 AND status = 'DRAFT';`, [env.pId]);
        if (committed.rows.length === 2 && d1.status === 'DRAFT' && d2.status === 'DRAFT') {
          totalSuccesses += 2;
        }
      }

      scenarioMetricsTable.push({
        scenario: 'Positive Control: Concurrent Non-Blocking DRAFTs',
        iterations: REPEAT_COUNT,
        totalAttempts: REPEAT_COUNT * 2,
        successes: totalSuccesses,
        expectedRejections: 0,
        unexpectedErrors: 0,
        invariantViolations: 0,
      });

      if (totalSuccesses === REPEAT_COUNT * 2) {
        recordPass('CONC_08', `Positive Control: Concurrent DRAFT offers non-blocking (${REPEAT_COUNT} iterations)`, `Committed: ${totalSuccesses} / ${REPEAT_COUNT * 2}`);
      } else {
        recordFail('CONC_08', 'DRAFT creation blocked or failed', `Committed: ${totalSuccesses}`);
      }
    }

    // ------------------------------------------------------------------------
    // SUMMARY OF REPEATABLE SCENARIO METRICS
    // ------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log('  CONCURRENCY SCENARIO SUMMARY & METRICS TABLE');
    console.log('================================================================');
    console.table(scenarioMetricsTable);

    console.log('\n================================================================');
    console.log(`🎉 ALL ${assertions.length} STRENGTHENED POSTGRESQL TESTS PASSED!`);
    console.log('================================================================\n');

  } finally {
    // Deterministic cleanup limited strictly to records created by this run
    console.log('[CLEANUP] Performing deterministic fixture cleanup for Run ID:', RUN_ID);
    try {
      if (createdFixtureIds.paymentRecords.length > 0) {
        await query(`DELETE FROM payment_records WHERE id = ANY($1);`, [createdFixtureIds.paymentRecords]);
      }
      if (createdFixtureIds.leases.length > 0) {
        await query(`DELETE FROM rent_schedules WHERE lease_id = ANY($1);`, [createdFixtureIds.leases]);
        await query(`DELETE FROM security_deposits WHERE lease_id = ANY($1);`, [createdFixtureIds.leases]);
      }
      if (createdFixtureIds.securityDeposits.length > 0) {
        await query(`DELETE FROM security_deposits WHERE id = ANY($1);`, [createdFixtureIds.securityDeposits]);
      }
      if (createdFixtureIds.leaseRenewals.length > 0) {
        await query(`DELETE FROM lease_renewals WHERE id = ANY($1);`, [createdFixtureIds.leaseRenewals]);
      }
      if (createdFixtureIds.leases.length > 0) {
        await query(`DELETE FROM lease_tenants WHERE lease_id = ANY($1);`, [createdFixtureIds.leases]);
        await query(`DELETE FROM leases WHERE id = ANY($1);`, [createdFixtureIds.leases]);
      }
      if (createdFixtureIds.rentalApplications.length > 0) {
        await query(`DELETE FROM rental_applications WHERE id = ANY($1);`, [createdFixtureIds.rentalApplications]);
      }
      if (createdFixtureIds.managementAgreements.length > 0) {
        await query(`DELETE FROM management_agreements WHERE id = ANY($1);`, [createdFixtureIds.managementAgreements]);
      }
      if (createdFixtureIds.ownershipRecords.length > 0) {
        await query(`DELETE FROM ownership_records WHERE id = ANY($1);`, [createdFixtureIds.ownershipRecords]);
      }
      if (createdFixtureIds.units.length > 0) {
        await query(`DELETE FROM units WHERE id = ANY($1);`, [createdFixtureIds.units]);
      }
      if (createdFixtureIds.properties.length > 0) {
        await query(`DELETE FROM properties WHERE id = ANY($1);`, [createdFixtureIds.properties]);
      }
      if (createdFixtureIds.organizationMembers.length > 0) {
        await query(`DELETE FROM organization_members WHERE id = ANY($1);`, [createdFixtureIds.organizationMembers]);
      }
      if (createdFixtureIds.organizations.length > 0) {
        await query(`DELETE FROM organizations WHERE id = ANY($1);`, [createdFixtureIds.organizations]);
      }
      if (createdFixtureIds.users.length > 0) {
        await query(`DELETE FROM users WHERE id = ANY($1);`, [createdFixtureIds.users]);
      }
      console.log('✅ Deterministic cleanup completed cleanly. homehub_test preserved for future tests.');
    } catch (cleanErr: any) {
      console.warn('⚠️ Warning during deterministic cleanup:', cleanErr.message);
    }

    await verifyPool.end();
    await closePool();
  }

  return { success: true, count: assertions.length, assertions, metrics: scenarioMetricsTable };
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test suite execution failed:', err);
    process.exit(1);
  });
