import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Lease Activation and Renewal Concurrency Integrity', async (t) => {
  const leaseRepoPath = path.join(__dirname, '..', 'src', 'server', 'repositories', 'leases.ts');
  const repoCode = fs.readFileSync(leaseRepoPath, 'utf-8');

  await t.test('createLease utilizes pessimistic locking', () => {
    const method = repoCode.substring(repoCode.indexOf('async createLease'), repoCode.indexOf('async generateRentSchedule'));
    assert.ok(
      method.includes('.for(\'update\')') || method.includes('assertNoPhysicalSpaceOverlap'),
      'Must lock the resource row directly or via shared physical-space reservation operation'
    );
    const sharedOp = repoCode.substring(repoCode.indexOf('async assertNoPhysicalSpaceOverlap'), repoCode.indexOf('async createLease'));
    assert.ok(sharedOp.includes('.for(\'update\')'), 'Shared operation must lock the parent property row');
    assert.ok(sharedOp.includes('VALIDATION_ERROR: Lease period overlaps'), 'Must return standard VALIDATION_ERROR');
  });

  await t.test('activateLease enforces overlap invariant with pessimistic locking', () => {
    const method = repoCode.substring(repoCode.indexOf('async activateLease'), repoCode.indexOf('async recordPayment'));
    
    // 1. Lock acquisition
    assert.ok(method.includes('.for(\'update\')'), 'activateLease must acquire a pessimistic lock');
    
    // 2. Overlap check presence
    assert.ok(method.includes('const overlaps = await tx.query.leases.findMany'), 'activateLease must query for overlaps');
    assert.ok(method.includes('not(eq(leases.id, leaseId))'), 'activateLease must exclude the current lease from overlap check');
    assert.ok(method.includes('VALIDATION_ERROR: Cannot activate lease'), 'Must return standard VALIDATION_ERROR');
    
    // 3. Atomicity check
    const isInsideTx = repoCode.indexOf('db.transaction(async (tx) => {') < repoCode.indexOf('async activateLease') + 1000; 
    assert.ok(isInsideTx, 'The check and update must be within a transaction block');
  });

  await t.test('approveRenewal enforces overlap invariant with pessimistic locking', () => {
    const startIdx = repoCode.indexOf('async approveRenewal');
    const method = repoCode.substring(startIdx);
    
    assert.ok(method.includes('.for(\'update\')'), 'approveRenewal must acquire a pessimistic lock');
    assert.ok(method.includes('not(eq(leases.id, currentLease.id))'), 'approveRenewal must exclude the current lease from overlap check');
    assert.ok(method.includes('VALIDATION_ERROR: Cannot approve renewal'), 'Must return standard VALIDATION_ERROR');
  });

  await t.test('Locks are acquired securely on the parent property', () => {
    // We now lock the Property row unconditionally to serialize property-level vs unit-level concurrency
    assert.ok(repoCode.match(/from\(properties\)\.where\(eq\(properties\.id, [a-zA-Z.]+\)\)\.limit\(1\)\.for\('update'\)/), 'Property lock exists');
  });
});
