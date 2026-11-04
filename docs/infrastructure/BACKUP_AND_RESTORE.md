# HomeHub Database Backup & Restore Policy

## 1. Objectives & SLAs

- **RPO (Recovery Point Objective)**: <= 1 hour (Maximum acceptable data loss window).
- **RTO (Recovery Time Objective)**: <= 30 minutes (Time to complete restore and return to service).
- **Retention Schedule**:
  - Hourly snapshots: Retained 24 hours.
  - Daily backups: Retained 30 days.
  - Monthly archives: Retained 7 years (for compliance and financial auditing).
- **Encryption**: AES-256 at rest, TLS 1.3 in transit.
- **Integrity Guarantee**: SHA-256 cryptographic checksum generated at creation and verified prior to every restore.

## 2. Backup Architecture

Backups are created using the versioned runner:
```bash
npx tsx scripts/backup.ts
```

Output directory: `/backups/`
Artifacts generated:
1. `homehub-backup-<timestamp>.json.gz`: Gzip-compressed archive of all base tables in the `public` schema.
2. `homehub-backup-<timestamp>.manifest.json`: Cryptographic manifest detailing:
   - `backupId`
   - `createdAt`
   - `database`
   - `schemaVersion`
   - `tableCount`
   - `tables`
   - `totalRecords`
   - `sha256Checksum`

## 3. Restore Verification Procedure

Restores are tested without risking live production data using:
```bash
# Verify integrity without database mutation:
npx tsx scripts/restore.ts backups/homehub-backup-<timestamp>.json.gz --verify-only

# Restore into target staging/recovery database:
npx tsx scripts/restore.ts backups/homehub-backup-<timestamp>.json.gz --restore
```

### Restore Verification Pipeline:
1. **File Existence**: Verifies both `.json.gz` and `.manifest.json` are present.
2. **Cryptographic Validation**: Recalculates SHA-256 of the compressed buffer and asserts exact match with manifest.
3. **Decompression & Schema Check**: Unzips JSON and asserts validity of all table records.
4. **Transactional Insertion**: Wraps table restoration in `BEGIN ... COMMIT` with `ON CONFLICT DO NOTHING`.
5. **Connectivity & Audit Assertions**: Asserts database query readiness and logs duration and record counts.

## 4. Evidence Distinction & Drill Boundaries

- **Backup Implementation Coverage**: The backup script dynamically queries `information_schema.tables` and covers 100% of all public PostgreSQL base tables across the entire schema (all 93 public base tables, verified across `src/db/schema.ts` and migrations 0000-0010).
- **Local Restore Drill**: The executed local restore drill covered a verified sample of 14 core domain tables with relational foreign keys.
- **Drill Classification**: This local drill is formally classified as a **14-table local verification drill**, NOT a full production disaster-recovery validation.
- **Production Disaster Recovery (PITR)**: Full production backup across all 93 tables and continuous point-in-time recovery (PITR via WAL archiving) remains documented infrastructure architecture configuration on Cloud SQL until real production infrastructure is provisioned and live-verified.
