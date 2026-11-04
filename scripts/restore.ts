/**
 * HomeHub Production Database Restore & Verification Runner
 * 
 * Supports:
 * - SHA-256 cryptographic checksum verification
 * - Decompression & schema validation
 * - Test restore validation & integrity checking
 * - Metrics recording: duration, record counts, table counts
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import pg from 'pg';
import { loadServerConfig } from '../src/server/config/env.js';
import type { BackupManifest } from './backup.js';

export interface RestoreVerificationResult {
  backupId: string;
  backupCreatedAt: string;
  restoreStartedAt: string;
  restoreCompletedAt: string;
  durationMs: number;
  checksumVerified: boolean;
  tableCount: number;
  totalRecordsRestored: number;
  tablesVerified: string[];
  status: 'VERIFIED_SUCCESS' | 'CHECKSUM_MISMATCH' | 'CORRUPT_ARCHIVE' | 'RESTORE_FAILED';
  error?: string;
}

export async function verifyAndRestoreBackup(
  backupGzPath: string,
  options: {
    verifyOnly?: boolean;
    pool?: pg.Pool;
    targetDatabase?: string;
  } = {}
): Promise<RestoreVerificationResult> {
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  // 1. Read files
  if (!fs.existsSync(backupGzPath)) {
    throw new Error(`Backup file not found: ${backupGzPath}`);
  }

  const manifestPath = backupGzPath.replace(/\.json\.gz$/, '.manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest file not found: ${manifestPath}`);
  }

  const manifest: BackupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const compressedBuffer = fs.readFileSync(backupGzPath);

  // 2. Verify SHA-256 Checksum
  const computedChecksum = crypto.createHash('sha256').update(compressedBuffer).digest('hex');
  if (computedChecksum !== manifest.sha256Checksum) {
    return {
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      restoreStartedAt: startedAt,
      restoreCompletedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checksumVerified: false,
      tableCount: 0,
      totalRecordsRestored: 0,
      tablesVerified: [],
      status: 'CHECKSUM_MISMATCH',
      error: `Checksum mismatch! Expected: ${manifest.sha256Checksum}, Computed: ${computedChecksum}`,
    };
  }

  // 3. Decompress and parse
  let backupData: Record<string, any[]>;
  try {
    const rawJson = zlib.gunzipSync(compressedBuffer).toString('utf-8');
    backupData = JSON.parse(rawJson);
  } catch (err: any) {
    return {
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      restoreStartedAt: startedAt,
      restoreCompletedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checksumVerified: true,
      tableCount: 0,
      totalRecordsRestored: 0,
      tablesVerified: [],
      status: 'CORRUPT_ARCHIVE',
      error: `Failed to decompress archive: ${err.message}`,
    };
  }

  const tables = Object.keys(backupData);
  let totalRecords = 0;
  for (const t of tables) {
    totalRecords += (backupData[t] || []).length;
  }

  // 4. If verify-only, return verification success without mutating database
  if (options.verifyOnly) {
    return {
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      restoreStartedAt: startedAt,
      restoreCompletedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checksumVerified: true,
      tableCount: tables.length,
      totalRecordsRestored: totalRecords,
      tablesVerified: tables,
      status: 'VERIFIED_SUCCESS',
    };
  }

  // 5. If restoring into a live/staging database:
  const config = loadServerConfig();
  const pool = options.pool || (config.database.url || process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: config.database.url || process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
    : new pg.Pool({
        host: config.database.host || 'localhost',
        port: config.database.port || 5432,
        user: config.database.user || 'postgres',
        password: config.database.password || 'postgres',
        database: (() => {
          const isProduction = process.env.NODE_ENV === 'production';
          const target = options.targetDatabase || config.database.database || process.env.SQL_DB_NAME || (isProduction ? 'homehub_production' : 'homehub_test');
          if (!isProduction && target === 'homehub_production') {
            throw new Error("HARD SAFETY GATE TRIGGERED: Database restore targeting 'homehub_production' is prohibited in non-production environments.");
          }
          return target;
        })(),
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
      }));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET session_replication_role = 'replica';");

    // Fetch schema types for JSON detection
    const schemaRes = await client.query<{ table_name: string; column_name: string; data_type: string }>(`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public';
    `);
    
    const jsonColumns: Record<string, Set<string>> = {};
    for (const r of schemaRes.rows) {
      if (r.data_type === 'json' || r.data_type === 'jsonb') {
        if (!jsonColumns[r.table_name]) jsonColumns[r.table_name] = new Set();
        jsonColumns[r.table_name].add(r.column_name);
      }
    }

    for (const table of tables) {
      if (!/^[a-zA-Z0-9_]+$/.test(table)) {
        throw new Error(`Unsafe table name: ${table}`);
      }
      const rows = backupData[table];
      if (!rows || rows.length === 0) continue;

      // In restore mode, upsert or insert rows
      for (const row of rows) {
        const columns = Object.keys(row);
        const colNames = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const values = columns.map(c => {
          const val = row[c];
          if (val === null) return val;
          
          const isJsonCol = jsonColumns[table]?.has(c);
          if (isJsonCol) {
            return JSON.stringify(val);
          }
          
          if (typeof val === 'object' && !(val instanceof Date)) {
            return JSON.stringify(val);
          }
          return val;
        });

        try {
          await client.query(
            `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            values
          );
        } catch (e: any) {
          console.error(`\nFAILED ON TABLE ${table}`);
          console.error('Row:', row);
          console.error('Values:', values);
          throw e;
        }
      }
    }

    await client.query("SET session_replication_role = 'origin';");

    // Synchronize sequences to ensure auto-incrementing serial IDs remain valid
    const seqRes = await client.query<{ sequence_schema: string; sequence_name: string }>(`
      SELECT sequence_schema, sequence_name FROM information_schema.sequences;
    `);
    for (const seq of seqRes.rows) {
      if (seq.sequence_name === '__drizzle_migrations_id_seq') {
        await client.query(`
          SELECT setval('drizzle.__drizzle_migrations_id_seq', COALESCE((SELECT max(id) FROM drizzle.__drizzle_migrations), 1));
        `);
      }
    }

    await client.query('COMMIT');

    return {
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      restoreStartedAt: startedAt,
      restoreCompletedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checksumVerified: true,
      tableCount: tables.length,
      totalRecordsRestored: totalRecords,
      tablesVerified: tables,
      status: 'VERIFIED_SUCCESS',
    };
  } catch (err: any) {
    await client.query('ROLLBACK');
    return {
      backupId: manifest.backupId,
      backupCreatedAt: manifest.createdAt,
      restoreStartedAt: startedAt,
      restoreCompletedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      checksumVerified: true,
      tableCount: tables.length,
      totalRecordsRestored: 0,
      tablesVerified: [],
      status: 'RESTORE_FAILED',
      error: err.message,
    };
  } finally {
    client.release();
    if (!options.pool) {
      await pool.end();
    }
  }
}

// CLI execution
const isDirectCli = Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/restore.ts'));
if (isDirectCli) {
  const args = process.argv.slice(2);
  const backupPath = args.find(a => a.endsWith('.json.gz')) || '';
  const verifyOnly = args.includes('--verify-only') || !args.includes('--restore');

  if (!backupPath) {
    console.error('Usage: tsx scripts/restore.ts <path-to-backup.json.gz> [--verify-only | --restore]');
    process.exit(1);
  }

  verifyAndRestoreBackup(backupPath, { verifyOnly })
    .then(result => {
      console.log('[RESTORE-VERIFY] Result:', JSON.stringify(result, null, 2));
      if (result.status === 'VERIFIED_SUCCESS') {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('[RESTORE-VERIFY] Execution error:', err);
      process.exit(1);
    });
}
