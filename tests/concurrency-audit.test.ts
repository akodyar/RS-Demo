import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Concurrency Audit: Lease Overlaps', async (t) => {
  const leaseRepoPath = path.join(__dirname, '..', 'src', 'server', 'repositories', 'leases.ts');
  const repoCode = fs.readFileSync(leaseRepoPath, 'utf-8');

  await t.test('createLease overlap logic relies on read-then-insert without locks', () => {
    // 1. Does createLease check for overlapping leases using a read-then-insert sequence?
    assert.ok(repoCode.includes('await tx.query.leases.findMany'), 'Reads from database');
    assert.ok(repoCode.includes('await tx.insert(leases).values'), 'Inserts into database sequentially after reading');
    assert.ok(!repoCode.includes('FOR UPDATE'), 'Does not use explicit row locking or serialization');
  });

  await t.test('activateLease lacks overlap checks entirely', () => {
    const activateMethod = repoCode.substring(repoCode.indexOf('async activateLease'), repoCode.indexOf('async recordPayment'));
    
    assert.ok(activateMethod.includes('await tx.update(leases)'), 'Updates lease status');
    assert.ok(activateMethod.includes('set({ status: LeaseStatus.ACTIVE })'), 'Sets status to ACTIVE');
    
    const overlapCheckInActivate = activateMethod.includes('await tx.query.leases.findMany');
    assert.ok(!overlapCheckInActivate, 'activateLease lacks overlap protection entirely! Conflicting DRAFT leases can both be activated.');
  });
});
