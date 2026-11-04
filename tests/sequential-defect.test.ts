import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Concurrency Audit: Lease Overlaps Sequential Defect', async (t) => {
  const leaseRepoPath = path.join(__dirname, '..', 'src', 'server', 'repositories', 'leases.ts');
  const repoCode = fs.readFileSync(leaseRepoPath, 'utf-8');

  await t.test('activateLease allows activating multiple overlapping DRAFT leases sequentially', () => {
    const createMethod = repoCode.substring(repoCode.indexOf('async createLease'), repoCode.indexOf('async activateLease'));
    const activateMethod = repoCode.substring(repoCode.indexOf('async activateLease'), repoCode.indexOf('async recordPayment'));
    
    // createLease checks for overlap but ignores DRAFT leases.
    assert.ok(createMethod.includes('eq(leases.status, LeaseStatus.ACTIVE)'));
    assert.ok(createMethod.includes('eq(leases.status, LeaseStatus.PENDING_APPROVAL)'));
    assert.ok(!createMethod.includes('eq(leases.status, LeaseStatus.DRAFT)'), 'Does not block overlapping DRAFT leases');

    // activateLease does NOT perform any overlap check.
    const overlapCheckInActivate = activateMethod.includes('tx.query.leases.findMany') || activateMethod.includes('tx.select().from(leases).where(and(...overlapConditions))');
    assert.ok(!overlapCheckInActivate, 'activateLease lacks overlap protection entirely');
  });
});
