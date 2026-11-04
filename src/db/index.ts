import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { parse as parseConnectionString } from 'pg-connection-string';
import dotenv from 'dotenv';
import * as schema from './schema.js';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: pg.Pool | undefined;
}

export const TARGET_TEST_DATABASE = 'homehub_test';
export const AUTHORIZED_LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

/**
 * Determines whether the current process is running in a test or verification context.
 */
export function isTestContext(): boolean {
  if (process.env.NODE_ENV === 'test' || process.env.HOMEHUB_TEST === 'true') {
    return true;
  }
  if (process.env.VITEST !== undefined || process.env.PLAYWRIGHT_TEST_BASE_URL !== undefined) {
    return true;
  }
  if (typeof (process as any).test === 'function') {
    return true;
  }
  if (process.argv && process.argv.length > 0) {
    return process.argv.some(arg => {
      const lower = arg.toLowerCase();
      return (
        lower.includes('test') ||
        lower.endsWith('.test.ts') ||
        lower.endsWith('.test.js') ||
        lower.endsWith('.spec.ts') ||
        lower.endsWith('.spec.js')
      );
    });
  }
  return false;
}

/**
 * Authoritatively validates any supplied PostgreSQL connection string using
 * pg's native pg-connection-string parser to resolve the effective host, port,
 * and decoded database target before pool or client creation.
 * Reconciles query parameters, repeated query keys, and ambient PG* environment variables.
 */
export function validateEffectiveConnectionUrl(
  databaseUrl: string,
  isTest: boolean,
  isProduction: boolean,
  configuredSqlDbName?: string
): {
  effectiveHost: string;
  effectivePort: number;
  effectiveDb: string;
  effectiveUser: string;
  effectivePassword?: string;
  ssl: any;
} {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error(
      isTest
        ? 'HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed. Aborting.'
        : 'CRITICAL CONFIGURATION ERROR: DATABASE_URL is malformed in development mode. Aborting.'
    );
  }

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error(
      isTest
        ? `HARD SAFETY GATE TRIGGERED: DATABASE_URL has invalid protocol '${parsedUrl.protocol}'. Aborting.`
        : `CRITICAL CONFIGURATION ERROR: DATABASE_URL has invalid protocol '${parsedUrl.protocol}'. PostgreSQL protocol required.`
    );
  }

  // Parse using pg's authoritative parser (same parser used by pg.Pool / pg.Client)
  let effectiveConfig: any;
  try {
    effectiveConfig = parseConnectionString(databaseUrl);
  } catch {
    throw new Error(
      isTest
        ? 'HARD SAFETY GATE TRIGGERED: DATABASE_URL could not be parsed by PostgreSQL parser. Aborting.'
        : 'CRITICAL CONFIGURATION ERROR: DATABASE_URL could not be parsed by PostgreSQL parser. Aborting.'
    );
  }

  // 1. Detect repeated or conflicting host in query parameters vs URL authority
  const hostQueryParams = parsedUrl.searchParams.getAll('host');
  if (hostQueryParams.length > 1) {
    throw new Error(
      isTest
        ? 'HARD SAFETY GATE TRIGGERED: DATABASE_URL contains repeated host query parameter. Connection hijacking risk detected. Aborting.'
        : 'CRITICAL CONFIGURATION ERROR: DATABASE_URL contains repeated host query parameter. Connection hijacking risk detected. Aborting.'
    );
  }
  if (hostQueryParams.length === 1) {
    const qHost = hostQueryParams[0].trim().toLowerCase();
    const urlHost = parsedUrl.hostname.trim().toLowerCase();
    if (urlHost && qHost !== urlHost) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: Conflicting host in DATABASE_URL. Authority specifies '${urlHost}' but query specifies host='${qHost}'. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: Conflicting host in DATABASE_URL. Authority specifies '${urlHost}' but query specifies host='${qHost}'. Aborting.`
      );
    }
  }

  // 2. Detect repeated or conflicting port in query parameters vs URL authority
  const portQueryParams = parsedUrl.searchParams.getAll('port');
  if (portQueryParams.length > 1) {
    throw new Error(
      isTest
        ? 'HARD SAFETY GATE TRIGGERED: DATABASE_URL contains repeated port query parameter. Aborting.'
        : 'CRITICAL CONFIGURATION ERROR: DATABASE_URL contains repeated port query parameter. Aborting.'
    );
  }
  if (portQueryParams.length === 1) {
    const qPort = portQueryParams[0].trim();
    const urlPort = parsedUrl.port ? parsedUrl.port.trim() : '';
    if (urlPort && qPort !== urlPort) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: Conflicting port in DATABASE_URL. Authority specifies '${urlPort}' but query specifies port='${qPort}'. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: Conflicting port in DATABASE_URL. Authority specifies '${urlPort}' but query specifies port='${qPort}'. Aborting.`
      );
    }
  }

  // 3. Resolve effective host and detect PGHOST conflicts
  const urlHost = parsedUrl.hostname.trim().toLowerCase();
  const parsedHost = (effectiveConfig.host || urlHost || '').trim().toLowerCase();
  const envPgHost = process.env.PGHOST ? process.env.PGHOST.trim().toLowerCase() : undefined;

  let effectiveHost: string;
  if (parsedHost === '') {
    // Empty-host URL (e.g. postgresql:///homehub_test)
    // In pg.ConnectionParameters, empty host falls back to process.env.PGHOST || 'localhost'
    effectiveHost = envPgHost || 'localhost';
    if (envPgHost && !isProduction && !AUTHORIZED_LOCAL_HOSTS.includes(envPgHost)) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: DATABASE_URL has empty host and PGHOST points to unauthorized remote host '${process.env.PGHOST}'. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: DATABASE_URL has empty host and PGHOST points to unauthorized remote host '${process.env.PGHOST}'. Local development must target localhost or 127.0.0.1.`
      );
    }
  } else {
    effectiveHost = parsedHost;
    if (envPgHost && envPgHost !== parsedHost) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: Conflicting PGHOST. Authority specifies '${parsedHost}' but environment specifies PGHOST='${process.env.PGHOST}'. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: Conflicting PGHOST. Authority specifies '${parsedHost}' but environment specifies PGHOST='${process.env.PGHOST}'. Aborting.`
      );
    }
  }

  // 4. Resolve effective port and detect PGPORT conflicts
  const urlPort = parsedUrl.port ? parsedUrl.port.trim() : '';
  const envPgPort = process.env.PGPORT ? process.env.PGPORT.trim() : undefined;
  if (urlPort && envPgPort && envPgPort !== urlPort) {
    throw new Error(
      isTest
        ? `HARD SAFETY GATE TRIGGERED: Conflicting PGPORT. Authority specifies '${urlPort}' but environment specifies PGPORT='${process.env.PGPORT}'. Aborting.`
        : `CRITICAL CONFIGURATION ERROR: Conflicting PGPORT. Authority specifies '${urlPort}' but environment specifies PGPORT='${process.env.PGPORT}'. Aborting.`
    );
  }

  let effectivePort = 5432;
  if (effectiveConfig.port) {
    effectivePort = parseInt(effectiveConfig.port, 10);
  } else if (urlPort) {
    effectivePort = parseInt(urlPort, 10);
  } else if (envPgPort) {
    effectivePort = parseInt(envPgPort, 10);
  }

  // 5. Decode database name (handling nested percent-encoding) and check PGDATABASE
  const rawDb = (effectiveConfig.database || parsedUrl.pathname.replace(/^\//, '') || '').trim();
  let decodedDb = rawDb;
  try {
    let prev = '';
    while (decodedDb !== prev && decodedDb.includes('%')) {
      prev = decodedDb;
      decodedDb = decodeURIComponent(decodedDb);
    }
  } catch {
    decodedDb = rawDb.trim();
  }
  decodedDb = decodedDb.trim();

  let envPgDb: string | undefined;
  if (process.env.PGDATABASE) {
    let val = process.env.PGDATABASE.trim();
    try {
      let prev = '';
      while (val !== prev && val.includes('%')) {
        prev = val;
        val = decodeURIComponent(val);
      }
    } catch {}
    envPgDb = val.trim();
  }

  if (!isProduction && envPgDb) {
    const lowerEnvDb = envPgDb.toLowerCase();
    if (lowerEnvDb === 'homehub_production' || lowerEnvDb.includes('prod')) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: PGDATABASE is set to production target '${process.env.PGDATABASE}'. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: PGDATABASE is set to production target '${process.env.PGDATABASE}'. Direct connection to production database is strictly prohibited in development mode.`
      );
    }
    if (decodedDb && lowerEnvDb !== decodedDb.toLowerCase()) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: Conflicting database configuration. PGDATABASE is '${process.env.PGDATABASE}' but DATABASE_URL targets '${decodedDb}'. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: Conflicting database configuration in development mode. PGDATABASE is '${process.env.PGDATABASE}' but DATABASE_URL targets '${decodedDb}'. Aborting.`
      );
    }
  }

  const effectiveDb = decodedDb || (envPgDb || '');

  if (!isProduction) {
    // Invariant 1: Reject Cloud SQL socket / Unix socket outside of production
    if (effectiveHost.startsWith('/') || effectiveHost.includes('cloudsql')) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: DATABASE_URL targets Unix domain or Cloud SQL socket '${effectiveHost}'. Forbidden outside production. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: DATABASE_URL targets Unix domain or Cloud SQL socket '${effectiveHost}'. Forbidden outside production.`
      );
    }

    // Invariant 2: Reject unauthorized remote hosts
    if (!AUTHORIZED_LOCAL_HOSTS.includes(effectiveHost)) {
      throw new Error(
        isTest
          ? `HARD SAFETY GATE TRIGGERED: DATABASE_URL points to unauthorized remote host '${effectiveHost}'. Local tests must target localhost or 127.0.0.1. Aborting.`
          : `CRITICAL CONFIGURATION ERROR: DATABASE_URL points to unauthorized remote host '${effectiveHost}'. Local development must target localhost or 127.0.0.1.`
      );
    }

    // Invariant 3: Target database name must be non-empty
    if (!effectiveDb) {
      throw new Error(
        isTest
          ? 'HARD SAFETY GATE TRIGGERED: DATABASE_URL must specify a target database name. Aborting.'
          : 'CRITICAL CONFIGURATION ERROR: DATABASE_URL must specify a target database name.'
      );
    }

    if (isTest) {
      // Invariant 4: Tests must strictly target TARGET_TEST_DATABASE ('homehub_test')
      const lowerEffectiveDb = effectiveDb.toLowerCase();
      if (lowerEffectiveDb !== TARGET_TEST_DATABASE && !lowerEffectiveDb.endsWith('_test')) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: Tests are strictly forbidden from targeting non-test databases. Effective database must be '${TARGET_TEST_DATABASE}', got '${effectiveDb}'. Aborting.`
        );
      }

      // Invariant 5: Reconcile with SQL_DB_NAME
      if (configuredSqlDbName && configuredSqlDbName.trim().toLowerCase() !== TARGET_TEST_DATABASE) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: Conflicting database configuration. SQL_DB_NAME is '${configuredSqlDbName}' but DATABASE_URL targets '${effectiveDb}'. Aborting.`
        );
      }
    } else {
      // Invariant 6: Development must NEVER target homehub_production or contain 'prod'
      const lowerEffectiveDb = effectiveDb.toLowerCase();
      if (lowerEffectiveDb === 'homehub_production' || lowerEffectiveDb.includes('prod')) {
        throw new Error(
          `CRITICAL CONFIGURATION ERROR: Direct connection to production database '${effectiveDb}' via DATABASE_URL is strictly prohibited in development mode.`
        );
      }

      // Invariant 7: Reconcile with SQL_DB_NAME in development
      if (configuredSqlDbName && configuredSqlDbName.trim().toLowerCase() !== lowerEffectiveDb) {
        throw new Error(
          `CRITICAL CONFIGURATION ERROR: Conflicting database configuration in development mode. SQL_DB_NAME is '${configuredSqlDbName}' but DATABASE_URL targets '${effectiveDb}'. Aborting.`
        );
      }
    }
  }

  const effectiveUser = (effectiveConfig.user || process.env.DB_APP_USER || process.env.SQL_USER || 'homehub_app').trim();
  const effectivePassword = effectiveConfig.password || process.env.DB_APP_PASSWORD || process.env.DB_PASSWORD || process.env.SQL_PASSWORD;
  let ssl: any = false;
  if (isProduction || process.env.DATABASE_SSL === 'true' || effectiveConfig.ssl) {
    ssl = process.env.DATABASE_SSL !== 'false' ? (effectiveConfig.ssl || { rejectUnauthorized: false }) : false;
  }

  return {
    effectiveHost,
    effectivePort,
    effectiveDb,
    effectiveUser,
    effectivePassword,
    ssl,
  };
}

/**
 * Authoritative fail-closed database configuration validator.
 * Executed BEFORE any pg.Pool instance can be constructed.
 */
export function validateDatabaseConfigBeforePoolCreation(): {
  isProduction: boolean;
  isTest: boolean;
  targetDb: string;
  host: string;
  port?: number;
  ssl: any;
  poolConfig: pg.PoolConfig;
} {
  // 1. Ensure local environment is loaded if not already populated
  if (!process.env.SQL_DB_NAME && !process.env.DATABASE_URL) {
    try {
      dotenv.config();
    } catch {
      // Ignore if dotenv is not present or unreadable
    }
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = isTestContext();

  // --------------------------------------------------------------------------
  // TEST EXECUTION SAFETY GATE
  // --------------------------------------------------------------------------
  if (isTest) {
    // Invariant 1: Reject Cloud SQL socket / remote instance connections in tests
    if (process.env.INSTANCE_CONNECTION_NAME) {
      throw new Error(
        'HARD SAFETY GATE TRIGGERED: INSTANCE_CONNECTION_NAME must not be set for test execution. Tests are strictly forbidden from connecting to Cloud SQL.'
      );
    }

    // Invariant 2: Check ambient PGDATABASE in tests
    if (process.env.PGDATABASE) {
      let envPgDb = process.env.PGDATABASE.trim();
      try {
        let prev = '';
        while (envPgDb !== prev && envPgDb.includes('%')) {
          prev = envPgDb;
          envPgDb = decodeURIComponent(envPgDb);
        }
      } catch {}
      const lowerEnvDb = envPgDb.toLowerCase();
      if (lowerEnvDb === 'homehub_production' || lowerEnvDb.includes('prod')) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: PGDATABASE is set to production target '${process.env.PGDATABASE}'. Aborting.`
        );
      }
      if (lowerEnvDb !== TARGET_TEST_DATABASE && !lowerEnvDb.endsWith('_test')) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: Tests are strictly forbidden from targeting non-test databases via PGDATABASE ('${process.env.PGDATABASE}'). Target must be '${TARGET_TEST_DATABASE}'. Aborting.`
        );
      }
    }

    // Invariant 3: Check ambient PGHOST in tests
    if (process.env.PGHOST) {
      const envHost = process.env.PGHOST.trim().toLowerCase();
      if (!AUTHORIZED_LOCAL_HOSTS.includes(envHost)) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: PGHOST must be a local host (localhost, 127.0.0.1). Got unauthorized host: '${process.env.PGHOST}'. Aborting.`
        );
      }
    }

    // Invariant 4: Validate DATABASE_URL if present
    if (process.env.DATABASE_URL) {
      validateEffectiveConnectionUrl(process.env.DATABASE_URL, true, false, process.env.SQL_DB_NAME);
    } else {
      // Invariant 5: Validate SQL_HOST and SQL_DB_NAME when DATABASE_URL is absent
      if (process.env.SQL_HOST) {
        const host = process.env.SQL_HOST.trim().toLowerCase();
        if (!AUTHORIZED_LOCAL_HOSTS.includes(host)) {
          throw new Error(
            `HARD SAFETY GATE TRIGGERED: SQL_HOST must be a local host (localhost, 127.0.0.1). Got unauthorized host: '${host}'. Aborting.`
          );
        }
      }

      const targetDb = process.env.SQL_DB_NAME;
      if (!targetDb) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}' for test execution. Value is UNSET. Refusing to default to production database.`
        );
      }

      if (targetDb !== TARGET_TEST_DATABASE) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: Tests are strictly forbidden from targeting '${targetDb}'. Target database must be explicitly '${TARGET_TEST_DATABASE}'. Aborting.`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // NON-PRODUCTION (DEVELOPMENT) SAFETY GATE
  // --------------------------------------------------------------------------
  if (!isProduction && !isTest) {
    // Invariant 1: Reject Cloud SQL socket / remote instance connections outside production
    if (process.env.INSTANCE_CONNECTION_NAME) {
      throw new Error(
        'CRITICAL CONFIGURATION ERROR: INSTANCE_CONNECTION_NAME must not be set outside of NODE_ENV=production. Local development is strictly forbidden from connecting to Cloud SQL.'
      );
    }

    // Invariant 2: Check ambient PGDATABASE in development
    if (process.env.PGDATABASE) {
      let envPgDb = process.env.PGDATABASE.trim();
      try {
        let prev = '';
        while (envPgDb !== prev && envPgDb.includes('%')) {
          prev = envPgDb;
          envPgDb = decodeURIComponent(envPgDb);
        }
      } catch {}
      const lowerEnvDb = envPgDb.toLowerCase();
      if (lowerEnvDb === 'homehub_production' || lowerEnvDb.includes('prod')) {
        throw new Error(
          `CRITICAL CONFIGURATION ERROR: PGDATABASE is set to production target '${process.env.PGDATABASE}'. Direct connection to production database is strictly prohibited in development mode.`
        );
      }
    }

    // Invariant 3: Check ambient PGHOST in development
    if (process.env.PGHOST) {
      const envHost = process.env.PGHOST.trim().toLowerCase();
      if (!AUTHORIZED_LOCAL_HOSTS.includes(envHost)) {
        throw new Error(
          `CRITICAL CONFIGURATION ERROR: PGHOST must be a local host (localhost, 127.0.0.1) in development mode. Got unauthorized host: '${process.env.PGHOST}'. Aborting.`
        );
      }
    }

    if (process.env.DATABASE_URL) {
      // Invariant 4: Validate effective connection URL in development mode
      validateEffectiveConnectionUrl(process.env.DATABASE_URL, false, false, process.env.SQL_DB_NAME);
    } else {
      // Invariant 5: Validate SQL_HOST and SQL_DB_NAME when DATABASE_URL is absent
      if (process.env.SQL_HOST) {
        const host = process.env.SQL_HOST.trim().toLowerCase();
        if (!AUTHORIZED_LOCAL_HOSTS.includes(host)) {
          throw new Error(
            `CRITICAL CONFIGURATION ERROR: SQL_HOST must be a local host (localhost, 127.0.0.1) in development mode. Got unauthorized host: '${host}'. Aborting.`
          );
        }
      }

      const targetDb = process.env.SQL_DB_NAME;
      if (!targetDb) {
        throw new Error(
          'CRITICAL CONFIGURATION ERROR: SQL_DB_NAME or DATABASE_URL must be explicitly configured. Defaulting to homehub_production is strictly prohibited outside of NODE_ENV=production.'
        );
      }
      if (targetDb.toLowerCase() === 'homehub_production' || targetDb.toLowerCase().includes('prod')) {
        throw new Error(
          `CRITICAL CONFIGURATION ERROR: Direct connection to production database '${targetDb}' is strictly prohibited in development mode (NODE_ENV=${process.env.NODE_ENV || 'development'}).`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION RESOLUTION (ENFORCE ONE EFFECTIVE TARGET)
  // --------------------------------------------------------------------------
  let host = process.env.SQL_HOST || 'localhost';
  let port: number | undefined = parseInt(process.env.SQL_PORT || '5432', 10);
  let effectiveDbName: string;
  let effectiveUser = process.env.DB_APP_USER || process.env.SQL_USER || 'homehub_app';
  let effectivePassword = process.env.DB_APP_PASSWORD || process.env.DB_PASSWORD || process.env.SQL_PASSWORD;
  let ssl: any = false;

  if (process.env.INSTANCE_CONNECTION_NAME) {
    // Cloud SQL Unix domain socket in production
    host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
    port = undefined;
  } else if (isProduction || process.env.DATABASE_SSL === 'true') {
    ssl = process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false;
  }

  if (process.env.DATABASE_URL) {
    const validated = validateEffectiveConnectionUrl(
      process.env.DATABASE_URL,
      isTest,
      isProduction,
      process.env.SQL_DB_NAME
    );
    effectiveDbName = validated.effectiveDb;
    host = validated.effectiveHost;
    port = validated.effectivePort;
    effectiveUser = validated.effectiveUser;
    effectivePassword = validated.effectivePassword;
    ssl = validated.ssl;
  } else {
    effectiveDbName = isProduction
      ? (process.env.SQL_DB_NAME || 'homehub_production')
      : (process.env.SQL_DB_NAME || (isTest ? TARGET_TEST_DATABASE : 'homehub_dev'));
  }

  // Construct explicit, normalized poolConfig without raw connectionString
  // This guarantees pg.Pool and pg.Client cannot be overridden by hidden environment variables
  const poolConfig: pg.PoolConfig = {
    host,
    port,
    database: effectiveDbName,
    user: effectiveUser,
    password: effectivePassword,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONN_TIMEOUT_MS || '15000', 10),
    ssl,
  };

  return {
    isProduction,
    isTest,
    targetDb: effectiveDbName,
    host,
    port,
    ssl,
    poolConfig,
  };
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    // Fail-closed validation strictly before pool creation
    const { poolConfig } = validateDatabaseConfigBeforePoolCreation();

    global._postgresPool = new pg.Pool(poolConfig);

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
export const getPool = () => createPool();
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const currentPool = createPool();
    const value = (currentPool as any)[prop];
    return typeof value === 'function' ? value.bind(currentPool) : value;
  }
});

export const closePool = async () => {
  if (global._postgresPool) {
    const p = global._postgresPool;
    global._postgresPool = undefined;
    await p.end();
  }
};

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
