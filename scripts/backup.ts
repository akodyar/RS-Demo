/**
 * HomeHub Production Database Backup Runner
 * 
 * Supports:
 * - Table enumeration & streaming extraction via PostgreSQL connection
 * - SHA-256 cryptographic checksum calculation
 * - Metadata manifest generation (timestamp, tables, checksum, schema version)
 * - Optional gzip compression
 * - Fail-closed error handling
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import pg from 'pg';
import { loadServerConfig } from '../src/server/config/env.js';

export interface BackupManifest {
  backupId: string;
  createdAt: string;
  database: string;
  schemaVersion: string;
  tableCount: number;
  tables: string[];
  totalRecords: number;
  sha256Checksum: string;
  compression: 'gzip';
  format: 'json-archive';
}

export async function createDatabaseBackup(options: {
  outputDir?: string;
  pool?: pg.Pool;
} = {}): Promise<{ manifest: BackupManifest; filePath: string }> {
  const config = loadServerConfig();
  const outputDir = options.outputDir || path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const pool = options.pool || (config.database.url || process.env.DATABASE_URL
    ? new pg.Pool({ connectionString: config.database.url || process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
    : new pg.Pool({
        host: config.database.host || 'localhost',
        port: config.database.port || 5432,
        user: process.env.DB_BACKUP_USER || (process.env.NODE_ENV === 'production' ? 'homehub_backup' : 'postgres'),
        password: process.env.DB_BACKUP_PASSWORD || 'postgres',
        database: (() => {
          const isProduction = process.env.NODE_ENV === 'production';
          const target = config.database.database || process.env.SQL_DB_NAME || (isProduction ? 'homehub_production' : 'homehub_test');
          if (!isProduction && target === 'homehub_production') {
            throw new Error("HARD SAFETY GATE TRIGGERED: Backups targeting 'homehub_production' are prohibited in non-production environments.");
          }
          return target;
        })(),
        ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 10000,
      }));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupId = `homehub-backup-${timestamp}`;
  const backupData: Record<string, any[]> = {};
  let totalRecords = 0;

  try {
    // 1. Fetch all public user tables
    const tablesRes = await pool.query<{ table_name: string }>(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC;
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[BACKUP] Discovered ${tables.length} tables to backup.`);

    // 2. Extract records for each table
    for (const table of tables) {
      // Safe query - table name sanitized via regex check
      if (!/^[a-zA-Z0-9_]+$/.test(table)) {
        throw new Error(`Unsafe table name encountered: ${table}`);
      }
      const dataRes = await pool.query(`SELECT * FROM "${table}"`);
      backupData[table] = dataRes.rows;
      totalRecords += dataRes.rows.length;
    }

    // 3. Serialize and compress
    const rawJson = JSON.stringify(backupData);
    const compressed = zlib.gzipSync(Buffer.from(rawJson, 'utf-8'));

    // 4. Calculate SHA-256 checksum
    const sha256Checksum = crypto.createHash('sha256').update(compressed).digest('hex');

    let schemaVersion = '0005_closed_domain_closure';
    try {
      const journalPath = path.resolve(process.cwd(), 'drizzle/meta/_journal.json');
      if (fs.existsSync(journalPath)) {
        const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
        if (Array.isArray(journal.entries) && journal.entries.length > 0) {
          schemaVersion = journal.entries[journal.entries.length - 1].tag;
        }
      }
    } catch (_) {}

    const manifest: BackupManifest = {
      backupId,
      createdAt: new Date().toISOString(),
      database: config.database.database || 'postgres',
      schemaVersion,
      tableCount: tables.length,
      tables,
      totalRecords,
      sha256Checksum,
      compression: 'gzip',
      format: 'json-archive',
    };

    const filePath = path.join(outputDir, `${backupId}.json.gz`);
    const manifestPath = path.join(outputDir, `${backupId}.manifest.json`);

    fs.writeFileSync(filePath, compressed);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    console.log(`[BACKUP] Successfully created backup: ${filePath} (${compressed.length} bytes, SHA256: ${sha256Checksum.substring(0, 12)}...)`);
    return { manifest, filePath };
  } finally {
    if (!options.pool) {
      await pool.end();
    }
  }
}

// Direct CLI execution
const isDirectCli = Boolean(process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('scripts/backup.ts'));
if (isDirectCli) {
  createDatabaseBackup()
    .then(({ manifest, filePath }) => {
      console.log(`[BACKUP] Completed successfully. File: ${filePath}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error('[BACKUP] Failed:', err);
      process.exit(1);
    });
}
