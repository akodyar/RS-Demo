/**
 * HOMEHUB — Database Gateway Direct Fail-Closed Verification Suite (Phase 64.7)
 *
 * Verifies that src/db/index.ts itself rejects all unsafe configurations
 * BEFORE pg.Pool construction, even when tests/safe-test-env.ts is NOT imported:
 *
 * Part 1: Test Mode Hard Safety Gates (NODE_ENV=test or test process)
 * 1. Missing SQL_DB_NAME during test execution
 * 2. Attempt to target homehub_production during test execution
 * 3. DATABASE_URL targeting homehub_production during test execution
 * 4. Malformed DATABASE_URL in test
 * 5. Invalid DATABASE_URL protocol in test
 * 6. DATABASE_URL targeting remote host in test
 * 7. INSTANCE_CONNECTION_NAME set during test execution (Cloud SQL hijacking)
 * 8. SQL_HOST targeting remote host in test
 * 9. Conflicting SQL_DB_NAME and DATABASE_URL in test
 * 10. Valid test configuration connects safely to homehub_test
 * 11. Local test URL with conflicting host query parameter (?host=remote.cloud)
 * 12. Local test URL with conflicting port query parameter (?port=9999)
 * 13. Local test URL with query-param Cloud SQL socket (?host=/cloudsql/prod)
 * 14. Local test URL with URL-encoded non-test target (/homehub_%70%72%6f%64%75%63%74%69%6f%6e)
 *
 * Part 2: Non-Production Development Safety Gates (NODE_ENV=development)
 * 15. Missing SQL_DB_NAME and DATABASE_URL in dev mode fails closed
 * 16. Remote DATABASE_URL targeting homehub_production in dev halts before pool creation
 * 17. Remote DATABASE_URL targeting another database in dev halts before pool creation
 * 18. Local DATABASE_URL targeting homehub_production in dev halts before pool creation
 * 19. Malformed DATABASE_URL in dev halts before pool creation
 * 20. Invalid-protocol DATABASE_URL in dev halts before pool creation
 * 21. Conflicting DATABASE_URL and SQL_DB_NAME in dev halts before pool creation
 * 22. INSTANCE_CONNECTION_NAME set in dev halts before pool creation
 * 23. Remote SQL_HOST in dev halts before pool creation
 * 24. Local dev URL with conflicting host query parameter (?host=remote.cloud)
 * 25. Local dev URL with conflicting port query parameter (?port=9999)
 * 26. URL-encoded production target in dev (homehub_%70%72%6f%64%75%63%74%69%6f%6e)
 * 27. Normalized uppercase production target in dev (HOMEHUB_PRODUCTION)
 * 28. Fully percent-encoded production target in dev (%68%6f%6d%65%68%75%62%5f%70%72%6f%64%75%63%74%69%6f%6e)
 * 29. Valid explicitly configured local development DATABASE_URL succeeds safely
 * 30. Valid explicitly configured local development SQL_DB_NAME succeeds safely
 *
 * Part 3: PG Environment Overrides & Repeated Query Parameter Gates (Phase 64.7)
 * 31. Empty-host URL plus remote PGHOST in test halts before pool creation
 * 32. Empty-host URL plus remote PGHOST in dev halts before pool creation
 * 33. Empty-host URL plus PGDATABASE=homehub_production in test halts before pool creation
 * 34. Empty-host URL plus PGDATABASE=homehub_production in dev halts before pool creation
 * 35. Conflicting PGHOST and URL authority in test halts before pool creation
 * 36. Conflicting PGHOST and URL authority in dev halts before pool creation
 * 37. Conflicting PGPORT and URL port in test halts before pool creation
 * 38. Conflicting PGPORT and URL port in dev halts before pool creation
 * 39. Repeated host query parameter in test halts before pool creation
 * 40. Repeated host query parameter in dev halts before pool creation
 * 41. Repeated port query parameter in test halts before pool creation
 * 42. Repeated port query parameter in dev halts before pool creation
 * 43. Valid empty-host URL in test mode succeeds safely with default localhost
 */

import test from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const workerPath = path.resolve('scratch/gateway-worker-runner.ts');

const workerCode = `
import pg from 'pg';

let poolConstructed = false;
let capturedConfig: any = null;
const OrigPool = pg.Pool;
(pg as any).Pool = class InstrumentedPool extends OrigPool {
  constructor(config: any) {
    poolConstructed = true;
    capturedConfig = config;
    if (process.env.TEST_POSITIVE !== 'true') {
      console.error('CRITICAL VIOLATION: pg.Pool constructor called with config:', JSON.stringify({
        database: config?.database,
        connectionString: config?.connectionString ? '[REDACTED_URL]' : undefined,
        host: config?.host,
        port: config?.port
      }));
    } else {
      console.log('POOL_CONSTRUCTED_SAFELY:', JSON.stringify({
        database: config?.database,
        hasConnectionString: !!config?.connectionString,
        host: config?.host,
        port: config?.port
      }));
    }
    super(config);
  }
};

try {
  // Directly import database gateway WITHOUT importing safe-test-env.ts
  const mod = await import('../src/db/index.js');
  
  // Access pool and db properties to trigger initialization
  const p = mod.pool;
  const db = mod.db;
  
  // In positive scenario, read pool property
  if (process.env.TEST_POSITIVE === 'true') {
    const total = (p as any).totalCount;
    console.log('POSITIVE_SUCCESS_POOL_CREATED');
    process.exit(0);
  }

  console.log('UNEXPECTED_SUCCESS_NO_ERROR');
  process.exit(0);
} catch (err: any) {
  console.error('CAUGHT_SAFETY_ERROR: ' + err.message);
  if (poolConstructed) {
    console.error('FAIL: Pool was constructed before safety guard aborted');
    process.exit(2);
  }
  process.exit(1);
}
`;

if (!fs.existsSync('scratch')) {
  fs.mkdirSync('scratch', { recursive: true });
}
fs.writeFileSync(workerPath, workerCode);

function runScenario(envOverrides: Record<string, string>, argvExtras: string[] = []): {
  exitCode: number;
  output: string;
} {
  const cleanEnv: Record<string, string> = {
    ...process.env,
    DOTENV_CONFIG_PATH: 'non_existent_file', // Block automatic .env loading
    ...envOverrides,
  };

  const args = ['tsx', 'scratch/gateway-worker-runner.ts', ...argvExtras];
  const result = spawnSync('npx', args, {
    cwd: process.cwd(),
    env: cleanEnv,
    encoding: 'utf-8',
    shell: true,
  });

  const output = (result.stderr || '') + (result.stdout || '');
  return {
    exitCode: result.status ?? -1,
    output,
  };
}

test('Database Gateway (src/db/index.ts) Direct Fail-Closed Security Suite', async (t) => {
  // ==========================================================================
  // PART 1: TEST EXECUTION SAFETY GATE
  // ==========================================================================
  await t.test('1. Missing SQL_DB_NAME in test execution halts before pool creation', () => {
    const res = runScenario({ SQL_DB_NAME: '', DATABASE_URL: '', NODE_ENV: 'test' });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly 'homehub_test'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('2. Attempting to target homehub_production in test execution halts before pool creation', () => {
    const res = runScenario({ SQL_DB_NAME: 'homehub_production', DATABASE_URL: '', NODE_ENV: 'test' });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /Tests are strictly forbidden from targeting 'homehub_production'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('3. DATABASE_URL targeting homehub_production in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgres://app:pw@127.0.0.1:5432/homehub_production',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /Tests are strictly forbidden from targeting non-test databases/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('4. Malformed DATABASE_URL in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'invalid-url',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL is malformed/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('5. Invalid DATABASE_URL protocol in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'http://127.0.0.1:5432/homehub_test',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL has invalid protocol/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('6. DATABASE_URL pointing to remote host in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgres://app:pw@remote.cloud:5432/homehub_test',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL points to unauthorized remote host 'remote\.cloud'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('7. INSTANCE_CONNECTION_NAME set during test execution halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      INSTANCE_CONNECTION_NAME: 'my-project:region:cloudsql-prod',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /INSTANCE_CONNECTION_NAME must not be set for test execution/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('8. SQL_HOST pointing to unauthorized remote host in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      SQL_HOST: 'remote-pg.internal',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /SQL_HOST must be a local host/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('9. Conflicting SQL_DB_NAME and DATABASE_URL in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_dev',
      DATABASE_URL: 'postgres://localhost:5432/homehub_test',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /Conflicting database configuration/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('10. Valid test configuration connects safely to homehub_test', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      SQL_HOST: 'localhost',
      SQL_PORT: '5432',
      SQL_USER: 'homehub_app',
      TEST_POSITIVE: 'true',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 0, 'Process must exit with code 0 on valid test configuration');
    assert.match(res.output, /POSITIVE_SUCCESS_POOL_CREATED/);
    assert.match(res.output, /"database":"homehub_test"/);
  });

  await t.test('11. Local test URL with conflicting host query parameter halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgres://localhost:5432/homehub_test?host=remote.cloud',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting host param');
    assert.match(res.output, /Conflicting host in DATABASE_URL/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('12. Local test URL with conflicting port query parameter halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgres://localhost:5432/homehub_test?port=9999',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting port param');
    assert.match(res.output, /Conflicting port in DATABASE_URL/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('13. Local test URL with query-param Cloud SQL socket halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgres://localhost:5432/homehub_test?host=/cloudsql/prod-instance',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on Cloud SQL query socket');
    assert.match(res.output, /Conflicting host in DATABASE_URL|Unix domain or Cloud SQL socket/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('14. Local test URL with URL-encoded non-test target halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgres://localhost:5432/homehub_%70%72%6f%64%75%63%74%69%6f%6e',
      NODE_ENV: 'test'
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on URL-encoded non-test target');
    assert.match(res.output, /Tests are strictly forbidden from targeting non-test databases/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  // ==========================================================================
  // PART 2: DEVELOPMENT ENVIRONMENT SAFETY GATE
  // ==========================================================================
  await t.test('15. Missing SQL_DB_NAME and DATABASE_URL in dev mode fails closed', () => {
    const res = runScenario(
      { NODE_ENV: 'development', SQL_DB_NAME: '', DATABASE_URL: '' },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 in dev mode with missing config');
    assert.match(res.output, /Defaulting to homehub_production is strictly prohibited outside of NODE_ENV=production/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('16. Remote DATABASE_URL targeting homehub_production in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://app:pw@remote.cloud:5432/homehub_production',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL points to unauthorized remote host 'remote\.cloud'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('17. Remote DATABASE_URL targeting another database in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://app:pw@remote.cloud:5432/homehub_dev',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL points to unauthorized remote host 'remote\.cloud'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('18. Local DATABASE_URL targeting homehub_production in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://app:pw@127.0.0.1:5432/homehub_production',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /Direct connection to production database 'homehub_production' via DATABASE_URL is strictly prohibited in development mode/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('19. Malformed DATABASE_URL in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'invalid-url-dev',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL is malformed in development mode/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('20. Invalid-protocol DATABASE_URL in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'mysql://127.0.0.1:5432/homehub_dev',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /DATABASE_URL has invalid protocol 'mysql:'\. PostgreSQL protocol required/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('21. Conflicting DATABASE_URL and SQL_DB_NAME in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://127.0.0.1:5432/homehub_dev',
        SQL_DB_NAME: 'homehub_other',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /Conflicting database configuration in development mode\. SQL_DB_NAME is 'homehub_other' but DATABASE_URL targets 'homehub_dev'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('22. INSTANCE_CONNECTION_NAME set in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        INSTANCE_CONNECTION_NAME: 'my-project:region:cloudsql-dev',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /INSTANCE_CONNECTION_NAME must not be set outside of NODE_ENV=production/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('23. Remote SQL_HOST in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        SQL_HOST: 'remote-pg.internal',
        SQL_DB_NAME: 'homehub_dev',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1');
    assert.match(res.output, /SQL_HOST must be a local host \(localhost, 127\.0\.0\.1\) in development mode/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('24. Local dev URL with conflicting host query parameter halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/homehub_dev?host=remote.cloud',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting host param in dev');
    assert.match(res.output, /Conflicting host in DATABASE_URL/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('25. Local dev URL with conflicting port query parameter halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/homehub_dev?port=9999',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting port param in dev');
    assert.match(res.output, /Conflicting port in DATABASE_URL/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('26. URL-encoded production target in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/homehub_%70%72%6f%64%75%63%74%69%6f%6e',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on URL-encoded production target');
    assert.match(res.output, /Direct connection to production database 'homehub_production'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('27. Normalized uppercase production target in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/HOMEHUB_PRODUCTION',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on uppercase production target');
    assert.match(res.output, /Direct connection to production database 'HOMEHUB_PRODUCTION'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('28. Fully percent-encoded production target in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://localhost:5432/%68%6f%6d%65%68%75%62%5f%70%72%6f%64%75%63%74%69%6f%6e',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on fully percent-encoded production target');
    assert.match(res.output, /Direct connection to production database 'homehub_production'/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('29. Valid explicitly configured local development DATABASE_URL succeeds safely', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgres://homehub_app:secret@127.0.0.1:5432/homehub_test',
        SQL_DB_NAME: 'homehub_test',
        TEST_POSITIVE: 'true',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 0, 'Process must exit with code 0 on valid dev DATABASE_URL');
    assert.match(res.output, /POSITIVE_SUCCESS_POOL_CREATED/);
    assert.match(res.output, /POOL_CONSTRUCTED_SAFELY/);
    assert.match(res.output, /"hasConnectionString":false/);
    assert.match(res.output, /"host":"127.0.0.1"/);
    assert.match(res.output, /"database":"homehub_test"/);
  });

  await t.test('30. Valid explicitly configured local development SQL_DB_NAME succeeds safely', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        SQL_HOST: 'localhost',
        SQL_PORT: '5432',
        SQL_DB_NAME: 'homehub_test',
        SQL_USER: 'homehub_app',
        TEST_POSITIVE: 'true',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 0, 'Process must exit with code 0 on valid dev SQL_DB_NAME');
    assert.match(res.output, /POSITIVE_SUCCESS_POOL_CREATED/);
    assert.match(res.output, /POOL_CONSTRUCTED_SAFELY/);
    assert.match(res.output, /"database":"homehub_test"/);
  });

  // ==========================================================================
  // Part 3: Phase 64.7 PG Environment Override & Repeated Query Key Gates
  // ==========================================================================

  await t.test('31. Empty-host URL plus remote PGHOST in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql:///homehub_test',
      PGHOST: 'remote.cloudsql.google.com',
      NODE_ENV: 'test',
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on empty host with remote PGHOST in test');
    assert.match(res.output, /PGHOST points to unauthorized remote host|PGHOST must be a local host/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('32. Empty-host URL plus remote PGHOST in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql:///homehub_dev',
        PGHOST: 'remote.cloudsql.google.com',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on empty host with remote PGHOST in dev');
    assert.match(res.output, /PGHOST points to unauthorized remote host|PGHOST must be a local host/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('33. Empty-host URL plus PGDATABASE=homehub_production in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql:///homehub_test',
      PGDATABASE: 'homehub_production',
      NODE_ENV: 'test',
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on PGDATABASE=homehub_production in test');
    assert.match(res.output, /PGDATABASE is set to production target/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('34. Empty-host URL plus PGDATABASE=homehub_production in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql:///homehub_dev',
        PGDATABASE: 'homehub_production',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on PGDATABASE=homehub_production in dev');
    assert.match(res.output, /PGDATABASE is set to production target/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('35. Conflicting PGHOST and URL authority in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql://localhost:5432/homehub_test',
      PGHOST: '127.0.0.1',
      NODE_ENV: 'test',
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting PGHOST in test');
    assert.match(res.output, /Conflicting PGHOST/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('36. Conflicting PGHOST and URL authority in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/homehub_dev',
        PGHOST: '127.0.0.1',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting PGHOST in dev');
    assert.match(res.output, /Conflicting PGHOST/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('37. Conflicting PGPORT and URL port in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql://localhost:5432/homehub_test',
      PGPORT: '9999',
      NODE_ENV: 'test',
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting PGPORT in test');
    assert.match(res.output, /Conflicting PGPORT/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('38. Conflicting PGPORT and URL port in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/homehub_dev',
        PGPORT: '9999',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on conflicting PGPORT in dev');
    assert.match(res.output, /Conflicting PGPORT/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('39. Repeated host query parameter in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql://localhost:5432/homehub_test?host=localhost&host=remote.cloud',
      NODE_ENV: 'test',
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on repeated host parameter in test');
    assert.match(res.output, /repeated host query parameter/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('40. Repeated host query parameter in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/homehub_dev?host=localhost&host=remote.cloud',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on repeated host parameter in dev');
    assert.match(res.output, /repeated host query parameter/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('41. Repeated port query parameter in test halts before pool creation', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql://localhost:5432/homehub_test?port=5432&port=9999',
      NODE_ENV: 'test',
    });
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on repeated port parameter in test');
    assert.match(res.output, /repeated port query parameter/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('42. Repeated port query parameter in dev halts before pool creation', () => {
    const res = runScenario(
      {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://localhost:5432/homehub_dev?port=5432&port=9999',
      },
      ['server.ts']
    );
    assert.strictEqual(res.exitCode, 1, 'Process must exit with code 1 on repeated port parameter in dev');
    assert.match(res.output, /repeated port query parameter/);
    assert.doesNotMatch(res.output, /CRITICAL VIOLATION/);
  });

  await t.test('43. Valid empty-host URL in test mode succeeds safely with default localhost', () => {
    const res = runScenario({
      SQL_DB_NAME: 'homehub_test',
      DATABASE_URL: 'postgresql:///homehub_test',
      NODE_ENV: 'test',
      TEST_POSITIVE: 'true',
    });
    assert.strictEqual(res.exitCode, 0, 'Process must exit with code 0 on valid empty-host test URL');
    assert.match(res.output, /POSITIVE_SUCCESS_POOL_CREATED/);
    assert.match(res.output, /POOL_CONSTRUCTED_SAFELY/);
    assert.match(res.output, /"hasConnectionString":false/);
    assert.match(res.output, /"host":"localhost"/);
    assert.match(res.output, /"database":"homehub_test"/);
  });
});
