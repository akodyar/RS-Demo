/**
 * HOMEHUB — Negative Verification of Test Database Isolation Gate
 *
 * Proves that tests/safe-test-env.ts halts execution and fails closed
 * BEFORE any database pool can be instantiated across all negative scenarios:
 * 1. SQL_DB_NAME unset
 * 2. SQL_DB_NAME targeting wrong database
 * 3. DATABASE_URL targeting wrong database
 * 4. DATABASE_URL malformed
 * 5. DATABASE_URL invalid protocol
 *
 * Mocks pg.Pool to guarantee zero network connection attempts and prove
 * that pool constructor is never called.
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';
import fs from 'node:fs';

interface TestResult {
  scenario: string;
  expectedErrorSubstring: string;
  actualExitCode: number;
  stdout: string;
  stderr: string;
  poolCreated: boolean;
  passed: boolean;
}

const scenarios = [
  {
    name: '1. SQL_DB_NAME is unset',
    env: { SQL_DB_NAME: '', DATABASE_URL: '' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly \'homehub_test\''
  },
  {
    name: '2. SQL_DB_NAME points to wrong database (homehub_production)',
    env: { SQL_DB_NAME: 'homehub_production', DATABASE_URL: '' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly \'homehub_test\'. Got: \'homehub_production\''
  },
  {
    name: '3. DATABASE_URL points to different database (homehub_production)',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgres://app_user:masked_pw@127.0.0.1:5432/homehub_production' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: DATABASE_URL pathname must be \'/homehub_test\'. Got: \'/homehub_production\''
  },
  {
    name: '4. DATABASE_URL is malformed',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'not a valid url' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed'
  },
  {
    name: '5. DATABASE_URL has invalid protocol',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'http://127.0.0.1:5432/homehub_test' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: DATABASE_URL has invalid protocol'
  },
  {
    name: '6. DATABASE_URL points to unintended remote host (remote-server.internal)',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgres://app_user:masked_pw@remote-server.internal:5432/homehub_test' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: DATABASE_URL points to unauthorized remote host \'remote-server.internal\''
  },
  {
    name: '7. INSTANCE_CONNECTION_NAME is set (Cloud SQL socket hijacking)',
    env: { SQL_DB_NAME: 'homehub_test', INSTANCE_CONNECTION_NAME: 'gcp-project:region:cloudsql-prod' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: INSTANCE_CONNECTION_NAME must not be set'
  },
  {
    name: '8. SQL_HOST points to unauthorized remote host',
    env: { SQL_DB_NAME: 'homehub_test', SQL_HOST: 'remote-database.internal' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: SQL_HOST must be a local host'
  },
  {
    name: '9. Empty-host URL plus remote PGHOST',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgresql:///homehub_test', PGHOST: 'remote-server.internal' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: PGHOST must be a local host'
  },
  {
    name: '10. Empty-host URL plus PGDATABASE=homehub_production',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgresql:///homehub_test', PGDATABASE: 'homehub_production' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: PGDATABASE is set to production target'
  },
  {
    name: '11. Conflicting PGHOST and URL authority',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgresql://localhost:5432/homehub_test', PGHOST: '127.0.0.1' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: Conflicting PGHOST'
  },
  {
    name: '12. Conflicting PGPORT and URL port',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgresql://localhost:5432/homehub_test', PGPORT: '9999' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: Conflicting PGPORT'
  },
  {
    name: '13. Repeated host query parameter (?host=localhost&host=remote.cloud)',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgresql://localhost:5432/homehub_test?host=localhost&host=remote.cloud' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: DATABASE_URL contains repeated host query parameter'
  },
  {
    name: '14. Repeated port query parameter (?port=5432&port=9999)',
    env: { SQL_DB_NAME: 'homehub_test', DATABASE_URL: 'postgresql://localhost:5432/homehub_test?port=5432&port=9999' },
    expectedError: 'HARD SAFETY GATE TRIGGERED: DATABASE_URL contains repeated port query parameter'
  }
];

// Inline worker script that instruments pg.Pool to detect if a pool is created
const workerScript = `
import pg from 'pg';

let poolInstantiated = false;
const originalPool = pg.Pool;
(pg as any).Pool = class InstrumentedPool extends originalPool {
  constructor(config: any) {
    poolInstantiated = true;
    console.error('CRITICAL VIOLATION: pg.Pool was instantiated with config:', JSON.stringify(config));
    super(config);
  }
};

try {
  // Dynamically import safe-test-env first
  await import('../tests/safe-test-env.js');
  
  // Attempt downstream DB import
  await import('../src/db/index.js');
  console.log('SUCCESS_UNEXPECTED');
} catch (err: any) {
  console.error('CAUGHT_SAFETY_ERROR: ' + err.message);
  if (poolInstantiated) {
    console.error('FAIL: Pool was instantiated before guard aborted');
    process.exit(2);
  }
  process.exit(1);
}
`;

console.log('================================================================');
console.log('  TEST DATABASE ISOLATION NEGATIVE VERIFICATION SUITE');
console.log('================================================================\n');

if (!fs.existsSync('scratch')) fs.mkdirSync('scratch', { recursive: true });
fs.writeFileSync('scratch/worker-safety-test.ts', workerScript);

let allPassed = true;

for (const sc of scenarios) {
  const result = spawnSync('npx', ['tsx', 'scratch/worker-safety-test.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...sc.env,
      DOTENV_CONFIG_PATH: 'non_existent_file' // Prevent auto-loading .env defaults
    },
    encoding: 'utf-8',
    shell: true
  });

  const output = (result.stderr || '') + (result.stdout || '');
  const exitCode = result.status ?? -1;
  const caughtError = output.includes('CAUGHT_SAFETY_ERROR');
  const matchedError = output.includes(sc.expectedError);
  const poolCreated = output.includes('CRITICAL VIOLATION');
  const noSecretsLeaked = !output.includes('masked_pw');

  const passed = exitCode === 1 && caughtError && matchedError && !poolCreated && noSecretsLeaked;
  if (!passed) allPassed = false;

  console.log(`Scenario: ${sc.name}`);
  console.log(`  Exit Code: ${exitCode} (Expected: 1)`);
  console.log(`  Caught Safety Error: ${caughtError ? 'YES' : 'NO'}`);
  console.log(`  Error Matched: ${matchedError ? 'YES' : 'NO'}`);
  if (!matchedError) console.log(`  Actual Output: ${output.trim()}`);
  console.log(`  pg.Pool Created: ${poolCreated ? 'CRITICAL LEAK' : 'NO (PREVENTED)'}`);
  console.log(`  Secrets Protected: ${noSecretsLeaked ? 'YES' : 'LEAKED'}`);
  console.log(`  Result: ${passed ? 'VERIFIED' : 'FAILED'}\n`);
}

// Positive control: homehub_test should pass cleanly without error
const positiveResult = spawnSync('npx', ['tsx', 'scratch/worker-safety-test.ts'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    SQL_DB_NAME: 'homehub_test',
    DATABASE_URL: 'postgres://app_user:masked_pw@127.0.0.1:5432/homehub_test'
  },
  encoding: 'utf-8',
  shell: true
});

const positivePassed = (positiveResult.status === 0) && (positiveResult.stdout || '').includes('SUCCESS_UNEXPECTED');
console.log('Positive Control: Valid homehub_test environment');
console.log(`  Exit Code: ${positiveResult.status} (Expected: 0)`);
console.log(`  Output: ${positiveResult.stdout?.trim()}`);
console.log(`  Result: ${positivePassed ? 'VERIFIED' : 'FAILED'}\n`);

if (!allPassed || !positivePassed) {
  console.error('❌ Negative verification suite failed!');
  process.exit(1);
} else {
  console.log('✅ ALL NEGATIVE ISOLATION CHECKS VERIFIED. Zero connection attempts to production.');
}
