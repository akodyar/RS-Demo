/**
 * HOMEHUB — Test Database Isolation & Fail-Closed Safety Gate
 *
 * Ensures that any test importing this module:
 * 1. Loads .env if not already loaded.
 * 2. Immediately verifies SQL_DB_NAME === 'homehub_test'.
 * 3. Enforces authorized local host bounds (localhost / 127.0.0.1) on SQL_HOST and DATABASE_URL.
 * 4. Reconciles DATABASE_URL with SQL_DB_NAME to prevent conflicting routing.
 * 5. Rejects Cloud SQL INSTANCE_CONNECTION_NAME in local test runs.
 * 6. Fails closed and halts execution BEFORE any database pool targeting production can be created.
 */
import 'dotenv/config';
import { parse as parseConnectionString } from 'pg-connection-string';

export const TARGET_TEST_DATABASE = 'homehub_test';
export const AUTHORIZED_LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];

export function assertSafeDatabaseConfig(): void {
  // 1. Strictly enforce target database name
  const targetDb = process.env.SQL_DB_NAME;
  if (targetDb !== TARGET_TEST_DATABASE) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_DB_NAME must be explicitly '${TARGET_TEST_DATABASE}'. Got: '${targetDb || 'UNSET'}'. Aborting.`);
  }

  // 2. Reject remote Cloud SQL instance connection in local tests
  if (process.env.INSTANCE_CONNECTION_NAME) {
    throw new Error(`HARD SAFETY GATE TRIGGERED: INSTANCE_CONNECTION_NAME must not be set for local test execution. Aborting.`);
  }

  // 3. Validate ambient PGDATABASE if set
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
      throw new Error(`HARD SAFETY GATE TRIGGERED: PGDATABASE is set to production target '${process.env.PGDATABASE}'. Aborting.`);
    }
    if (lowerEnvDb !== TARGET_TEST_DATABASE && !lowerEnvDb.endsWith('_test')) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: Tests are strictly forbidden from targeting non-test databases via PGDATABASE ('${process.env.PGDATABASE}'). Target must be '${TARGET_TEST_DATABASE}'. Aborting.`);
    }
  }

  // 4. Validate ambient PGHOST if set
  if (process.env.PGHOST) {
    const envHost = process.env.PGHOST.trim().toLowerCase();
    if (!AUTHORIZED_LOCAL_HOSTS.includes(envHost)) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: PGHOST must be a local host (localhost, 127.0.0.1). Got unauthorized host: '${process.env.PGHOST}'. Aborting.`);
    }
  }

  // 5. Validate SQL_HOST if set
  if (process.env.SQL_HOST) {
    const host = process.env.SQL_HOST.trim().toLowerCase();
    if (!AUTHORIZED_LOCAL_HOSTS.includes(host)) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: SQL_HOST must be a local host (localhost, 127.0.0.1). Got unauthorized host: '${host}'. Aborting.`);
    }
  }

  // 6. Validate DATABASE_URL if set
  if (process.env.DATABASE_URL) {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(process.env.DATABASE_URL);
    } catch {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL is malformed. Aborting.`);
    }

    if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL has invalid protocol '${parsedUrl.protocol}'. Aborting.`);
    }

    let effectiveConfig: any;
    try {
      effectiveConfig = parseConnectionString(process.env.DATABASE_URL);
    } catch {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL could not be parsed by PostgreSQL parser. Aborting.`);
    }

    // Detect repeated or conflicting host in query parameters vs URL authority
    const hostQueryParams = parsedUrl.searchParams.getAll('host');
    if (hostQueryParams.length > 1) {
      throw new Error(
        `HARD SAFETY GATE TRIGGERED: DATABASE_URL contains repeated host query parameter. Connection hijacking risk detected. Aborting.`
      );
    }
    if (hostQueryParams.length === 1) {
      const qHost = hostQueryParams[0].trim().toLowerCase();
      const urlHost = parsedUrl.hostname.trim().toLowerCase();
      if (urlHost && qHost !== urlHost) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: Conflicting host in DATABASE_URL. Authority specifies '${urlHost}' but query specifies host='${qHost}'. Aborting.`
        );
      }
    }

    // Detect repeated or conflicting port in query parameters vs URL authority
    const portQueryParams = parsedUrl.searchParams.getAll('port');
    if (portQueryParams.length > 1) {
      throw new Error(
        `HARD SAFETY GATE TRIGGERED: DATABASE_URL contains repeated port query parameter. Aborting.`
      );
    }
    if (portQueryParams.length === 1) {
      const qPort = portQueryParams[0].trim();
      const urlPort = parsedUrl.port ? parsedUrl.port.trim() : '';
      if (urlPort && qPort !== urlPort) {
        throw new Error(
          `HARD SAFETY GATE TRIGGERED: Conflicting port in DATABASE_URL. Authority specifies '${urlPort}' but query specifies port='${qPort}'. Aborting.`
        );
      }
    }

    // Detect PGHOST conflicts
    const urlHost = parsedUrl.hostname.trim().toLowerCase();
    const parsedHost = (effectiveConfig.host || urlHost || '').trim().toLowerCase();
    const envPgHost = process.env.PGHOST ? process.env.PGHOST.trim().toLowerCase() : undefined;

    let effectiveHost: string;
    if (parsedHost === '') {
      effectiveHost = envPgHost || 'localhost';
      if (envPgHost && !AUTHORIZED_LOCAL_HOSTS.includes(envPgHost)) {
        throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL has empty host and PGHOST points to unauthorized remote host '${process.env.PGHOST}'. Aborting.`);
      }
    } else {
      effectiveHost = parsedHost;
      if (envPgHost && envPgHost !== parsedHost) {
        throw new Error(`HARD SAFETY GATE TRIGGERED: Conflicting PGHOST. Authority specifies '${parsedHost}' but environment specifies PGHOST='${process.env.PGHOST}'. Aborting.`);
      }
    }

    // Detect PGPORT conflicts
    const urlPort = parsedUrl.port ? parsedUrl.port.trim() : '';
    const envPgPort = process.env.PGPORT ? process.env.PGPORT.trim() : undefined;
    if (urlPort && envPgPort && envPgPort !== urlPort) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: Conflicting PGPORT. Authority specifies '${urlPort}' but environment specifies PGPORT='${process.env.PGPORT}'. Aborting.`);
    }

    if (effectiveHost.startsWith('/') || effectiveHost.includes('cloudsql')) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL targets Unix domain or Cloud SQL socket '${effectiveHost}'. Forbidden in tests. Aborting.`);
    }

    if (!AUTHORIZED_LOCAL_HOSTS.includes(effectiveHost)) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL points to unauthorized remote host '${effectiveHost}'. Local tests must target localhost or 127.0.0.1. Aborting.`);
    }

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

    if (decodedDb.toLowerCase() !== TARGET_TEST_DATABASE && !decodedDb.toLowerCase().endsWith('_test')) {
      throw new Error(`HARD SAFETY GATE TRIGGERED: DATABASE_URL pathname must be '/${TARGET_TEST_DATABASE}'. Got: '/${decodedDb}'. Aborting.`);
    }
  }
}

// Fail closed immediately at module evaluation time before downstream modules initialize database pools
assertSafeDatabaseConfig();
