import { injectPgliteMock } from './setup-pglite.js';
import fs from 'node:fs';
import path from 'node:path';
import { verifyAndRestoreBackup } from '../scripts/restore.js';

async function testTamperDetection() {
  console.log('================================================================');
  console.log('  HOMEHUB — BACKUP RESTORE TAMPER DETECTION TEST');
  console.log('================================================================');

  const backupDir = path.resolve(process.cwd(), 'backups');
  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json.gz'));
  if (files.length === 0) {
    throw new Error('No backup archive found to test');
  }

  const validBackupPath = path.join(backupDir, files[0]);
  const validManifestPath = validBackupPath.replace(/\.json\.gz$/, '.manifest.json');

  // 1. Test authentic archive
  console.log('\n--- 1. Testing Authentic Backup ---');
  const authenticResult = await verifyAndRestoreBackup(validBackupPath, { verifyOnly: true });
  if (authenticResult.status !== 'VERIFIED_SUCCESS' || !authenticResult.checksumVerified) {
    throw new Error('Authentic backup failed verification!');
  }
  console.log(`✅ Authentic backup verified (table count: ${authenticResult.tableCount}, status: ${authenticResult.status})`);

  // 2. Create tampered archive
  console.log('\n--- 2. Testing Tampered Archive (Anti-Tamper Cryptographic Check) ---');
  const tamperedBackupPath = path.join(backupDir, 'tampered-test.json.gz');
  const tamperedManifestPath = path.join(backupDir, 'tampered-test.manifest.json');

  const buffer = Buffer.from(fs.readFileSync(validBackupPath));
  // Mutate one byte in the compressed buffer
  buffer[buffer.length - 10] = (buffer[buffer.length - 10] + 1) % 256;

  fs.writeFileSync(tamperedBackupPath, buffer);
  fs.copyFileSync(validManifestPath, tamperedManifestPath);

  try {
    const tamperedResult = await verifyAndRestoreBackup(tamperedBackupPath, { verifyOnly: true });
    if (tamperedResult.status === 'CHECKSUM_MISMATCH' && !tamperedResult.checksumVerified) {
      console.log('✅ PASS: Tampered archive detected and rejected with CHECKSUM_MISMATCH!');
    } else {
      throw new Error(`SECURITY FAILURE: Tampered archive was NOT rejected! Status: ${tamperedResult.status}`);
    }
  } finally {
    // Clean up temporary tampered files
    if (fs.existsSync(tamperedBackupPath)) fs.unlinkSync(tamperedBackupPath);
    if (fs.existsSync(tamperedManifestPath)) fs.unlinkSync(tamperedManifestPath);
  }

  console.log('\n🎉 BACKUP/RESTORE CRYPTOGRAPHIC TAMPER DETECTION VERIFIED.');
}

testTamperDetection()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Tamper detection test failed:', err);
    process.exit(1);
  });
