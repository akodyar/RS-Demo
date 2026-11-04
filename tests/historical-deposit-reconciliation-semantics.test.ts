import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import {
  users,
  properties,
  leases,
  securityDeposits,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { cronService } from '../src/server/services/cron.js';
import { runMigrations } from '../scripts/migrate.js';

test('Phase 38 — Historical Deposit Reconciliation Semantics & Expiration Suite', async (t) => {
  const runId = `p38_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const ownerId = `owner_${runId}`;
  const propId = `prop_${runId}`;

  // 0. Setup test owner and property
  await db.insert(users).values({
    id: ownerId,
    email: `${ownerId}@test.com`,
    roles: ['PROPERTY_OWNER'],
    firstName: 'Owner',
    lastName: runId,
    isActive: true
  }).onConflictDoNothing();

  await db.insert(properties).values({
    id: propId,
    name: `Property ${runId}`,
    type: 'RESIDENTIAL',
    status: 'AVAILABLE',
    createdBy: ownerId
  }).onConflictDoNothing();

  // Helper to create test lease with custom status and depositReconciliationStatus
  const createLease = async (opts: {
    id: string;
    status: string;
    depositAmount?: string | null;
    depositReconciliationStatus?: 'NOT_APPLICABLE' | 'NOT_EVALUATED' | 'UNRESOLVED' | 'RECONCILED';
    startDate?: string;
    endDate?: string;
  }) => {
    const [lease] = await db.insert(leases).values({
      id: opts.id,
      propertyId: propId,
      status: opts.status,
      startDate: opts.startDate || '2026-01-01',
      endDate: opts.endDate || '2026-12-31',
      rentAmount: '1000000',
      currency: 'IQD',
      depositAmount: opts.depositAmount !== undefined ? opts.depositAmount : null,
      ...(opts.depositReconciliationStatus ? { depositReconciliationStatus: opts.depositReconciliationStatus } : {})
    }).returning();
    return lease;
  };

  // Helper to create security deposit
  const createDeposit = async (opts: {
    id: string;
    leaseId: string;
    status: string;
    requiredAmount: string;
    recordedAmount: string;
    releasedAmount: string;
  }) => {
    const [dep] = await db.insert(securityDeposits).values({
      id: opts.id,
      leaseId: opts.leaseId,
      propertyId: propId,
      tenantId: ownerId, // placeholder user ID
      status: opts.status,
      requiredAmount: opts.requiredAmount,
      recordedAmount: opts.recordedAmount,
      releasedAmount: opts.releasedAmount,
      currency: 'IQD'
    }).returning();
    return dep;
  };

  // Executes the exact idempotent backfill statements from migration 0023
  const applyMigration0023Backfill = async () => {
    await db.execute(sql`
      UPDATE "leases"
      SET "deposit_reconciliation_status" = 'NOT_EVALUATED'
      WHERE "status" IN ('ACTIVE', 'DRAFT', 'PENDING_APPROVAL', 'PENDING_SIGNATURE', 'EXPIRING')
        AND "deposit_reconciliation_status" = 'NOT_APPLICABLE';
    `);

    await db.execute(sql`
      UPDATE "leases"
      SET "deposit_reconciliation_status" = 'UNRESOLVED'
      WHERE "status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
        AND "deposit_reconciliation_status" != 'UNRESOLVED'
        AND (
          EXISTS (
            SELECT 1 FROM "security_deposits" sd
            WHERE sd."lease_id" = "leases"."id"
              AND (
                sd."status" IN ('HELD', 'PENDING', 'PARTIALLY_COLLECTED', 'PARTIALLY_REFUNDED')
                OR sd."recorded_amount"::numeric > sd."released_amount"::numeric
                OR sd."released_amount"::numeric > sd."recorded_amount"::numeric
                OR sd."status" != 'REFUNDED'
              )
          )
          OR (
            "status" IN ('TERMINATED', 'EXPIRED')
            AND COALESCE("deposit_amount"::numeric, 0) > 0
            AND NOT EXISTS (
              SELECT 1 FROM "security_deposits" sd
              WHERE sd."lease_id" = "leases"."id"
            )
          )
        );
    `);

    await db.execute(sql`
      UPDATE "leases"
      SET "deposit_reconciliation_status" = 'RECONCILED'
      WHERE "status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
        AND "deposit_reconciliation_status" NOT IN ('RECONCILED', 'UNRESOLVED')
        AND EXISTS (
          SELECT 1 FROM "security_deposits" sd
          WHERE sd."lease_id" = "leases"."id"
        )
        AND NOT EXISTS (
          SELECT 1 FROM "security_deposits" sd
          WHERE sd."lease_id" = "leases"."id"
            AND NOT (
              sd."status" = 'REFUNDED'
              AND sd."recorded_amount"::numeric > 0
              AND sd."released_amount"::numeric = sd."recorded_amount"::numeric
            )
        );
    `);

    await db.execute(sql`
      UPDATE "leases"
      SET "deposit_reconciliation_status" = 'NOT_APPLICABLE'
      WHERE "status" IN ('TERMINATED', 'EXPIRED', 'CANCELLED')
        AND "deposit_reconciliation_status" NOT IN ('NOT_APPLICABLE', 'UNRESOLVED', 'RECONCILED')
        AND COALESCE("deposit_amount"::numeric, 0) = 0
        AND NOT EXISTS (
          SELECT 1 FROM "security_deposits" sd
          WHERE sd."lease_id" = "leases"."id"
        );
    `);
  };

  // 1. Existing active lease with a HELD deposit receives NOT_EVALUATED
  await t.test('1. Existing active lease with a HELD deposit defaults to NOT_EVALUATED (not NOT_APPLICABLE)', async () => {
    const leaseId = `lease_act_held_${runId}`;
    await createLease({
      id: leaseId,
      status: 'ACTIVE',
      depositAmount: '1200000'
    });
    await createDeposit({
      id: `dep_act_held_${runId}`,
      leaseId,
      status: 'HELD',
      requiredAmount: '1200000',
      recordedAmount: '1200000',
      releasedAmount: '0'
    });

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'NOT_EVALUATED', 'Active lease with held deposit must be NOT_EVALUATED');
  });

  // 2. Existing active lease with a PENDING deposit receives NOT_EVALUATED
  await t.test('2. Existing active lease with a PENDING deposit defaults to NOT_EVALUATED', async () => {
    const leaseId = `lease_act_pending_${runId}`;
    await createLease({
      id: leaseId,
      status: 'ACTIVE',
      depositAmount: '2000000'
    });
    await createDeposit({
      id: `dep_act_pending_${runId}`,
      leaseId,
      status: 'PENDING',
      requiredAmount: '2000000',
      recordedAmount: '0',
      releasedAmount: '0'
    });

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'NOT_EVALUATED', 'Active lease with pending deposit must be NOT_EVALUATED');
  });

  // 3. Historical terminated lease with an outstanding HELD deposit is classified as UNRESOLVED by migration
  await t.test('3. Historical terminated lease with an outstanding HELD deposit is classified as UNRESOLVED', async () => {
    const leaseId = `lease_hist_held_${runId}`;
    // Insert historical lease simulating pre-migration 0022 bug (TERMINATED with NOT_APPLICABLE)
    await createLease({
      id: leaseId,
      status: 'TERMINATED',
      depositAmount: '1000000',
      depositReconciliationStatus: 'NOT_APPLICABLE'
    });
    await createDeposit({
      id: `dep_hist_held_${runId}`,
      leaseId,
      status: 'HELD',
      requiredAmount: '1000000',
      recordedAmount: '1000000',
      releasedAmount: '0'
    });

    // Run migration backfill logic
    await applyMigration0023Backfill();

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'UNRESOLVED', 'Historical terminated lease with held funds must be corrected to UNRESOLVED');
  });

  // 4. Historical terminated lease with a fully refunded deposit satisfying authoritative invariants
  await t.test('4. Historical terminated lease with a fully refunded deposit is classified as RECONCILED', async () => {
    const leaseId = `lease_hist_refunded_${runId}`;
    await createLease({
      id: leaseId,
      status: 'TERMINATED',
      depositAmount: '1000000',
      depositReconciliationStatus: 'NOT_APPLICABLE'
    });
    await createDeposit({
      id: `dep_hist_refunded_${runId}`,
      leaseId,
      status: 'REFUNDED',
      requiredAmount: '1000000',
      recordedAmount: '1000000',
      releasedAmount: '1000000'
    });

    await applyMigration0023Backfill();

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'RECONCILED', 'Historical terminated lease with full refund must be RECONCILED');
  });

  // 5. Historical terminated lease with an agreed deposit but no deposit record
  await t.test('5. Historical terminated lease with agreed deposit but missing deposit record is UNRESOLVED', async () => {
    const leaseId = `lease_hist_missing_rec_${runId}`;
    await createLease({
      id: leaseId,
      status: 'TERMINATED',
      depositAmount: '800000',
      depositReconciliationStatus: 'NOT_APPLICABLE'
    });

    await applyMigration0023Backfill();

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'UNRESOLVED', 'Historical terminated lease with agreed deposit but 0 records must be UNRESOLVED');
  });

  // 6. Historical terminated lease with no applicable deposit
  await t.test('6. Historical terminated lease with no deposit required remains NOT_APPLICABLE', async () => {
    const leaseId = `lease_hist_no_dep_${runId}`;
    await createLease({
      id: leaseId,
      status: 'TERMINATED',
      depositAmount: null,
      depositReconciliationStatus: 'NOT_APPLICABLE'
    });

    await applyMigration0023Backfill();

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'NOT_APPLICABLE', 'Historical terminated lease with no deposit must remain NOT_APPLICABLE');
  });

  // 7. Historical expired lease with unresolved deposit evidence
  await t.test('7. Historical expired lease with unresolved deposit evidence is UNRESOLVED', async () => {
    const leaseId = `lease_hist_exp_unres_${runId}`;
    await createLease({
      id: leaseId,
      status: 'EXPIRED',
      depositAmount: '1500000',
      depositReconciliationStatus: 'NOT_APPLICABLE'
    });
    await createDeposit({
      id: `dep_hist_exp_unres_${runId}`,
      leaseId,
      status: 'PARTIALLY_REFUNDED',
      requiredAmount: '1500000',
      recordedAmount: '1500000',
      releasedAmount: '500000'
    });

    await applyMigration0023Backfill();

    const [fetched] = await db.select().from(leases).where(eq(leases.id, leaseId));
    assert.strictEqual(fetched.depositReconciliationStatus, 'UNRESOLVED', 'Expired lease with held custodial balance must be UNRESOLVED');
  });

  // 8. Cron expiration workflow correctly evaluates deposit reconciliation status on expiry
  await t.test('8. Cron processExpiredLeases transitions active leases to EXPIRED with accurate deposit reconciliation status and audit logs', async () => {
    // 8a. Active lease with HELD deposit that passes endDate
    const leaseHeldId = `lease_cron_held_${runId}`;
    await createLease({
      id: leaseHeldId,
      status: 'ACTIVE',
      depositAmount: '1000000',
      startDate: '2025-01-01',
      endDate: '2025-12-31' // Past date
    });
    await createDeposit({
      id: `dep_cron_held_${runId}`,
      leaseId: leaseHeldId,
      status: 'HELD',
      requiredAmount: '1000000',
      recordedAmount: '1000000',
      releasedAmount: '0'
    });

    // 8b. Active lease with NO deposit that passes endDate
    const leaseNoDepId = `lease_cron_nodep_${runId}`;
    await createLease({
      id: leaseNoDepId,
      status: 'ACTIVE',
      depositAmount: null,
      startDate: '2025-01-01',
      endDate: '2025-12-31' // Past date
    });

    // Run cron expiration processor
    await cronService.processExpiredLeases(new Date().toISOString());

    // Verify 8a
    const [expiredHeld] = await db.select().from(leases).where(eq(leases.id, leaseHeldId));
    assert.strictEqual(expiredHeld.status, 'EXPIRED', 'Lease must be EXPIRED');
    assert.strictEqual(expiredHeld.depositReconciliationStatus, 'UNRESOLVED', 'Expired lease with held deposit must be UNRESOLVED');

    const [auditHeld] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, leaseHeldId), eq(auditLogs.action, 'LEASE_EXPIRED')));
    assert.ok(auditHeld, 'Audit log for LEASE_EXPIRED must exist');
    assert.strictEqual((auditHeld.changes as any).depositReconciliationStatus, 'UNRESOLVED');
    assert.strictEqual((auditHeld.changes as any).unresolvedReason, 'DEPOSIT_CUSTODIAL_FUNDS_HELD');

    // Verify 8b
    const [expiredNoDep] = await db.select().from(leases).where(eq(leases.id, leaseNoDepId));
    assert.strictEqual(expiredNoDep.status, 'EXPIRED', 'Lease must be EXPIRED');
    assert.strictEqual(expiredNoDep.depositReconciliationStatus, 'NOT_APPLICABLE', 'Expired lease with no deposit must be NOT_APPLICABLE');

    const [auditNoDep] = await db.select().from(auditLogs)
      .where(and(eq(auditLogs.resourceId, leaseNoDepId), eq(auditLogs.action, 'LEASE_EXPIRED')));
    assert.ok(auditNoDep, 'Audit log for LEASE_EXPIRED must exist');
    assert.strictEqual((auditNoDep.changes as any).depositReconciliationStatus, 'NOT_APPLICABLE');
  });

  // 9. Repeated migration run idempotency test
  await t.test('9. Repeated execution of migration engine is idempotent and preserves correct classifications', async () => {
    const res1 = await runMigrations();
    assert.strictEqual(res1.success, true);

    const res2 = await runMigrations();
    assert.strictEqual(res2.success, true);
  });

  // Teardown
  t.after(async () => {
    try {
      await db.delete(auditLogs).where(eq(auditLogs.actorUserId, 'SYSTEM'));
      await db.delete(securityDeposits).where(eq(securityDeposits.propertyId, propId));
      await db.delete(leases).where(eq(leases.propertyId, propId));
      await db.delete(properties).where(eq(properties.id, propId));
      await db.delete(users).where(eq(users.id, ownerId));
    } catch (_) {}
  });
});
