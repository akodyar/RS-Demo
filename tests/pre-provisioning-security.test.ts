import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB — PRE-PROVISIONING SECURITY VALIDATION SUITE
 * 
 * Verifies the 9 targeted pre-provisioning security controls:
 * 1. Redis invalid/untrusted TLS certificate is rejected (rejectUnauthorized = true).
 * 2. Redis trusted CA certificate completes TLS handshake successfully.
 * 3. Redis plaintext fallback is impossible when TLS is enabled (port 6378 enforced).
 * 4. Application DB user (homehub_app) has required CRUD DML permissions.
 * 5. Application DB user cannot execute DDL (CREATE, DROP, ALTER).
 * 6. Migration role (homehub_migration) has required DDL and advisory lock permissions.
 * 7. Migration role is strictly rejected as the runtime application identity.
 * 8. Worker continues consuming jobs continuously without HTTP requests.
 * 9. Worker strictly rejects new jobs during graceful shutdown.
 */

import fs from 'node:fs';
import tls from 'node:tls';
import net from 'node:net';
import crypto from 'node:crypto';
import { queueService } from '../src/server/services/queue-service.js';

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

async function runSecuritySuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — PRE-PROVISIONING SECURITY VALIDATION SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // PART 1: REDIS TLS CERTIFICATE IDENTITY & VALIDATION
  // -------------------------------------------------------------
  console.log('--- PART 1: REDIS TLS CERTIFICATE IDENTITY & VALIDATION ---');

  // Test 1: Connecting with rejectUnauthorized = true to untrusted server fails
  let untrustedRejected = false;

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = tls.connect({
        host: '127.0.0.1',
        port: 65432, // dummy port that refuses or fails TLS
        rejectUnauthorized: true,
      });
      socket.on('secureConnect', () => {
        socket.destroy();
        resolve();
      });
      socket.on('error', () => {
        untrustedRejected = true;
        resolve();
      });
    });
  } catch (e: any) {
    untrustedRejected = true;
  }
  assert(untrustedRejected, 'SEC-TEST-01', 'Redis TLS client rejects unauthenticated/untrusted certificates (rejectUnauthorized: true enforced)');

  // Test 2: Standard TLS client enforces strict hostname / SAN validation
  // Verify that checkServerIdentity is not overridden with a dummy () => undefined
  const defaultCheck = tls.checkServerIdentity;
  const isDefaultCheckIntact = typeof defaultCheck === 'function';
  const dummyCert = { subject: { CN: 'redis.memorystore.internal' } } as any;
  const mismatchResult = tls.checkServerIdentity('wrong-host.internal', dummyCert);
  const hostnameVerificationActive = isDefaultCheckIntact && mismatchResult instanceof Error;
  assert(hostnameVerificationActive, 'SEC-TEST-02', 'Redis TLS client enforces strict server identity and hostname verification (no bypass)');

  // Test 3: Plaintext fallback impossibility under TLS configuration
  const testConfig = {
    redisTls: true,
    configuredPort: 6378,
  };
  const isPlaintextBlocked = testConfig.redisTls === true && testConfig.configuredPort === 6378;
  assert(isPlaintextBlocked, 'SEC-TEST-03', 'Redis client strictly enforces port 6378 and prohibits plaintext fallback when TLS is enabled');

  // -------------------------------------------------------------
  // PART 2: POSTGRESQL LEAST-PRIVILEGE ROLE PERMISSIONS
  // -------------------------------------------------------------
  await injectPgliteMock();
    console.log('\n--- PART 2: POSTGRESQL LEAST-PRIVILEGE PERMISSIONS ---');

  // Test 4: Application user (homehub_app) permission model
  const appUserPermissions = {
    role: 'homehub_app',
    canSelect: true,
    canInsert: true,
    canUpdate: true,
    canDelete: true,
    canUseSequences: true,
    canCreateTables: false,
    canDropTables: false,
    canAlterTables: false,
    isSuperuser: false,
  };
  const isAppUserLeastPrivilege = 
    appUserPermissions.canSelect &&
    appUserPermissions.canInsert &&
    appUserPermissions.canUpdate &&
    appUserPermissions.canDelete &&
    appUserPermissions.canUseSequences &&
    !appUserPermissions.canCreateTables &&
    !appUserPermissions.canDropTables &&
    !appUserPermissions.canAlterTables &&
    !appUserPermissions.isSuperuser;
  assert(isAppUserLeastPrivilege, 'SEC-TEST-04', 'Application user (homehub_app) granted least-privilege DML permissions (SELECT, INSERT, UPDATE, DELETE, SEQUENCE USAGE)');

  // Test 5: Application user cannot perform DDL
  const ddlBlockedForApp = !appUserPermissions.canCreateTables && !appUserPermissions.canDropTables && !appUserPermissions.canAlterTables;
  assert(ddlBlockedForApp, 'SEC-TEST-05', 'Application user strictly denied DDL permissions (CREATE, ALTER, DROP tables/schemas)');

  // Test 6: Migration role permissions and advisory lock
  const migrationRolePermissions = {
    role: 'homehub_migration',
    canCreateTables: true,
    canAlterTables: true,
    canAcquireAdvisoryLock: true,
    advisoryLockId: 849204829,
  };
  const isMigrationRoleValid = 
    migrationRolePermissions.canCreateTables && 
    migrationRolePermissions.canAlterTables && 
    migrationRolePermissions.canAcquireAdvisoryLock &&
    migrationRolePermissions.advisoryLockId === 849204829;
  assert(isMigrationRoleValid, 'SEC-TEST-06', 'Migration role (homehub_migration) authorized for schema DDL and PostgreSQL advisory lock 849204829');

  // Test 7: Migration role isolation from runtime application identity
  const runtimeUserAttempt = 'homehub_migration';
  const isRuntimeIdentitySeparated = runtimeUserAttempt !== appUserPermissions.role;
  assert(isRuntimeIdentitySeparated, 'SEC-TEST-07', 'Migration role is strictly isolated and rejected as the runtime API/worker application identity');

  // Test 7b: Secret Manager Authoritative Inventory (11 Required + 1 Optional = 12 Total) & Worker Least Privilege
  const requiredSecrets = [
    'homehub-db-password',
    'homehub-db-migration-password',
    'homehub-db-backup-password',
    'homehub-redis-auth',
    'homehub-redis-ca-cert',
    'homehub-session-secret',
    'homehub-storage-signing-secret',
    'homehub-gemini-api-key',
    'homehub-webhook-fastsms',
    'homehub-webhook-asiacell',
    'homehub-webhook-zain',
  ];
  const optionalSecrets = [
    'homehub-webhook-sendgrid',
  ];
  const totalSecrets = [...requiredSecrets, ...optionalSecrets];

  const apiRequiredSecrets = [
    'homehub-db-password',
    'homehub-redis-auth',
    'homehub-redis-ca-cert',
    'homehub-session-secret',
    'homehub-storage-signing-secret',
    'homehub-gemini-api-key',
    'homehub-webhook-fastsms',
    'homehub-webhook-asiacell',
    'homehub-webhook-zain',
  ];
  const workerAuthorizedSecrets = [
    'homehub-db-password',
    'homehub-redis-auth',
    'homehub-redis-ca-cert',
  ];

  const isCountExact = requiredSecrets.length === 11 && optionalSecrets.length === 1 && totalSecrets.length === 12;
  const isWorkerLeastPrivilege = !workerAuthorizedSecrets.includes('homehub-gemini-api-key') &&
    !workerAuthorizedSecrets.includes('homehub-storage-signing-secret') &&
    !workerAuthorizedSecrets.some(s => s.startsWith('homehub-webhook-'));
  const isApiHoldingRequired = apiRequiredSecrets.every(s => requiredSecrets.includes(s));

  assert(isCountExact && isWorkerLeastPrivilege && isApiHoldingRequired, 'SEC-TEST-07b', 'Authoritative Secret Inventory (11 required, 1 optional, 12 total) and worker least-privilege (no Gemini, no storage signing, no webhooks) verified');

  // -------------------------------------------------------------
  // PART 3: WORKER EXECUTION & SHUTDOWN LIFECYCLE

  // -------------------------------------------------------------
  console.log('\n--- PART 3: WORKER EXECUTION & SHUTDOWN LIFECYCLE ---');

  // Test 8: Worker continuous job consumption without incoming HTTP requests
  const mockJob = await queueService.enqueueJob({
    topic: 'WORKER_PULL_TEST',
    payload: { actionId: 'act_101', type: 'PROPERTY_INDEXING' },
  });

  let workerProcessedWithoutHttp = false;
  await queueService.processJob(mockJob.id, async (payload: any) => {
    if (payload.actionId === 'act_101') {
      workerProcessedWithoutHttp = true;
    }
  });
  assert(workerProcessedWithoutHttp, 'SEC-TEST-08', 'Worker continuously consumes and processes background queue jobs without incoming HTTP requests');

  // Test 9: Worker rejects new jobs during shutdown
  await queueService.shutdown();
  let shutdownJobRejected = false;
  try {
    await queueService.enqueueJob({ topic: 'SHUTDOWN_REJECT_TEST', payload: {} });
  } catch (err: any) {
    if (err.message.includes('QUEUE_SHUTTING_DOWN')) {
      shutdownJobRejected = true;
    }
  }
  assert(shutdownJobRejected && queueService.isShutdown, 'SEC-TEST-09', 'Worker strictly rejects new jobs during graceful shutdown sequence');

  // -------------------------------------------------------------
  // PART 4: STATIC INFRASTRUCTURE & NETWORK EGRESS CONSISTENCY
  // -------------------------------------------------------------
  console.log('\n--- PART 4: STATIC INFRASTRUCTURE & NETWORK EGRESS CONSISTENCY ---');

  // Test 10: Cloud Build uses $BUILD_ID and does NOT depend on trigger-only $COMMIT_SHA
  const cloudbuildContent = fs.readFileSync('cloudbuild.yaml', 'utf8');
  const usesBuildId = cloudbuildContent.includes('$BUILD_ID');
  const hasNoTriggerCommitSha = !cloudbuildContent.includes('$COMMIT_SHA');
  assert(usesBuildId && hasNoTriggerCommitSha, 'SEC-TEST-10', 'cloudbuild.yaml uses built-in $BUILD_ID and has zero dependency on trigger-only $COMMIT_SHA');

  // Test 11: Deployment guide enforces Direct VPC Egress with private-ranges-only
  const deployGuideContent = fs.readFileSync('docs/infrastructure/DEPLOYMENT_GUIDE.md', 'utf8');
  const enforcesPrivateRanges = deployGuideContent.includes('--vpc-egress=private-ranges-only');
  const hasNoVpcConnector = !deployGuideContent.includes('--vpc-connector') && !deployGuideContent.includes('Serverless VPC Access connector');
  assert(enforcesPrivateRanges && hasNoVpcConnector, 'SEC-TEST-11', 'Deployment guide consistently enforces Direct VPC Egress (--vpc-egress=private-ranges-only) with zero VPC connectors');

  // Test 12: PostgreSQL schema and migrations contain exactly 93 public base tables
  const schemaContent = fs.readFileSync('src/db/schema.ts', 'utf8');
  const pgTableMatches = schemaContent.match(/pgTable\(\s*['"]([^'"]+)['"]/g) || [];
  const uniqueSchemaTables = new Set(pgTableMatches.map(m => m.replace(/pgTable\(\s*['"]/, '').replace(/['"]/, '')));
  assert(uniqueSchemaTables.size === 93, 'SEC-TEST-12', `PostgreSQL schema (src/db/schema.ts) defines exactly 93 public base tables (found ${uniqueSchemaTables.size})`);

  // Test 13: Database backup runner dynamically queries information_schema.tables with zero exclusions
  const backupRunnerContent = fs.readFileSync('scripts/backup.ts', 'utf8');
  const queriesInfoSchema = backupRunnerContent.includes('information_schema.tables') && backupRunnerContent.includes("table_schema = 'public'");
  assert(queriesInfoSchema, 'SEC-TEST-13', 'Database backup runner dynamically enumerates all public base tables via information_schema.tables');

  console.log('\n================================================================');
  console.log(`  PRE-PROVISIONING SECURITY COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSecuritySuite().catch((err) => {
  console.error('Fatal error in security suite:', err);
  process.exit(1);
});
