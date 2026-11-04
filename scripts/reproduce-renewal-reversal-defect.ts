import '../tests/safe-test-env.js';
import express from 'express';
import request from 'supertest';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { leaseRepository } from '../src/server/repositories/leases';
import leasesRouter from '../src/server/routes/leases';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

async function reproduceSequence() {
  console.log('================================================================');
  console.log('  DEFECT REPRODUCTION: Payment Reversal vs Mid-Lease Renewal');
  console.log('  Database: homehub_test (PostgreSQL)');
  console.log('================================================================\n');

  const runId = 'repro_' + Date.now().toString(36);
  const ownerId = `usr_owner_${runId}`;
  const tenantId = `usr_tenant_${runId}`;
  const propId = `prop_${runId}`;
  const leaseId = `lease_${runId}`;

  // Express app setup for supported route invocation
  const app = express();
  app.use(express.json());
  app.use('/api/leases', leasesRouter);

  const ownerToken = jwt.sign({ id: ownerId, email: `${ownerId}@test.iq`, roles: ['PROPERTY_OWNER'], tokenVersion: 1 }, jwtSecret);
  const authHeader = `Bearer ${ownerToken}`;

  try {
    // Setup synthetic identities
    await db.insert(schema.users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Repro', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: tenantId, email: `${tenantId}@test.iq`, firstName: 'Tenant', lastName: 'Repro', roles: ['TENANT'], isActive: true }
    ]);

    await db.insert(schema.properties).values({
      id: propId,
      name: `Repro Property ${runId}`,
      type: 'RESIDENTIAL',
      currency: 'IQD',
      operatingModel: 'FULLY_MANAGED',
      status: 'ACTIVE'
    });

    await db.insert(schema.ownershipRecords).values({
      id: `own_${runId}`,
      propertyId: propId,
      ownerId: ownerId,
      ownershipPercentage: '100',
      status: 'VERIFIED'
    });

    // -------------------------------------------------------------
    // Step 1: Create lease and rent schedules (2026-01-01 to 2026-12-31)
    // -------------------------------------------------------------
    console.log('Step 1: Creating lease and 12-month rent schedules...');
    await db.insert(schema.leases).values({
      id: leaseId,
      propertyId: propId,
      status: 'ACTIVE',
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-12-31T00:00:00.000Z',
      rentAmount: '1000000',
      currency: 'IQD'
    });

    await db.insert(schema.leaseTenants).values({
      id: `lt_${runId}`,
      leaseId: leaseId,
      tenantId: tenantId,
      isPrimary: true
    });

    await db.transaction(async (tx) => {
      await leaseRepository.generateRentSchedule(
        tx,
        leaseId,
        propId,
        tenantId,
        null,
        '2026-01-01T00:00:00.000Z',
        '2026-12-31T00:00:00.000Z',
        1000000,
        'IQD'
      );
    });

    const schedulesBefore = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, leaseId));
    console.log(`-> Created ${schedulesBefore.length} rent schedules.`);
    const targetSchedule = schedulesBefore.find(s => s.periodStart.startsWith('2026-08-01'));
    if (!targetSchedule) throw new Error('August 2026 schedule not found');
    console.log(`-> Target Schedule for payment: ID=${targetSchedule.id}, PeriodStart=${targetSchedule.periodStart}, Status=${targetSchedule.status}`);

    // -------------------------------------------------------------
    // Step 2: Record and confirm payment against August schedule
    // -------------------------------------------------------------
    console.log('\nStep 2: Recording and confirming payment against August schedule...');
    const payId = `pay_${runId}`;
    await db.insert(schema.paymentRecords).values({
      id: payId,
      propertyId: propId,
      leaseId: leaseId,
      rentScheduleId: targetSchedule.id,
      payerId: tenantId,
      amount: '1000000',
      currency: 'IQD',
      status: 'RECORDED',
      paymentMethod: 'FIB',
      paymentType: 'RENT',
      referenceNumber: `FIB-REF-${payId}`,
      recordedDate: new Date().toISOString()
    });

    // Confirm payment via supported route
    const confirmRes = await request(app)
      .post(`/api/leases/payments/${payId}/confirm`)
      .set('Authorization', authHeader)
      .send({ confirmedAt: new Date().toISOString() });
    
    console.log(`-> Payment confirmation response status: ${confirmRes.status}`);

    const [confirmedPay] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, payId));
    const [confirmedSched] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, targetSchedule.id));
    console.log(`-> Payment Status: ${confirmedPay.status} | Schedule Status: ${confirmedSched.status} | Schedule PaidAmount: ${confirmedSched.paidAmount}`);

    // -------------------------------------------------------------
    // Step 3: Reverse the payment through actual supported application path
    // -------------------------------------------------------------
    console.log('\nStep 3: Reversing payment via POST /api/leases/payments/:paymentId/reverse...');
    const reverseRes = await request(app)
      .post(`/api/leases/payments/${payId}/reverse`)
      .set('Authorization', authHeader)
      .send({ reason: 'Accidental tenant double-payment reversal' });

    console.log(`-> Payment reversal response status: ${reverseRes.status}`);

    // -------------------------------------------------------------
    // Step 4: Verify original payment record, schedule reference, and balance
    // -------------------------------------------------------------
    console.log('\nStep 4: Inspecting payment and schedule states after reversal...');
    const [reversedPay] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, payId));
    const [reversedSched] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, targetSchedule.id));

    console.log(`-> Reversed Payment Status: ${reversedPay.status} (Expected: REVERSED)`);
    console.log(`-> Reversed Payment rentScheduleId: ${reversedPay.rentScheduleId} (Expected: ${targetSchedule.id})`);
    console.log(`-> Target Schedule PaidAmount: ${reversedSched.paidAmount} (Expected: 0)`);
    console.log(`-> Target Schedule Status: ${reversedSched.status} (Expected: OVERDUE or UPCOMING)`);

    // Verify foreign key integrity between payment and schedule
    const fkCheck = await pool.query(
      `SELECT p.id as pay_id, p.status as pay_status, s.id as sched_id, s.status as sched_status 
       FROM payment_records p 
       JOIN rent_schedules s ON p.rent_schedule_id = s.id 
       WHERE p.id = $1`,
      [payId]
    );
    console.log('-> Live PostgreSQL FK Join verification:');
    console.table(fkCheck.rows);

    // -------------------------------------------------------------
    // Step 5: Request valid mid-lease renewal overlapping the referenced schedule
    // -------------------------------------------------------------
    console.log('\nStep 5: Requesting mid-lease renewal overlapping referenced August schedule (effective 2026-07-01 to 2027-12-31 at 1,500,000 IQD)...');
    const renewalId = `ren_${runId}`;
    await db.insert(schema.leaseRenewals).values({
      id: renewalId,
      leaseId: leaseId,
      propertyId: propId,
      tenantId: tenantId,
      proposedStartDate: '2026-07-01T00:00:00.000Z',
      proposedEndDate: '2027-12-31T00:00:00.000Z',
      proposedRentAmount: '1500000',
      currency: 'IQD',
      status: 'REQUESTED'
    });

    // -------------------------------------------------------------
    // Step 6: Attempt approveRenewal() and observe if FK 23503 occurs
    // -------------------------------------------------------------
    console.log('\nStep 6: Executing leaseRepository.approveRenewal()...');
    let errorCaught: any = null;
    let approvedRenewal: any = null;

    try {
      approvedRenewal = await leaseRepository.approveRenewal(renewalId);
    } catch (err: any) {
      errorCaught = err;
    }

    if (errorCaught) {
      console.log(`\n*** DEFECT REPRODUCED: approveRenewal failed! ***`);
      console.log(`Error Name: ${errorCaught.name}`);
      console.log(`Error Message: ${errorCaught.message}`);
      console.log(`Error Code: ${errorCaught.code}`);
      console.log(`Detail: ${errorCaught.detail}`);
      console.log(`Constraint: ${errorCaught.constraint}`);
    } else {
      console.log(`\n*** DEFECT NOT REPRODUCED: approveRenewal succeeded cleanly! ***`);
      console.log(`Approved Renewal ID: ${approvedRenewal.id}, Status: ${approvedRenewal.status}`);

      // Inspect August schedule after renewal
      const [finalAugustSched] = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.id, targetSchedule.id));
      console.log(`\nPost-Renewal August Schedule State:`);
      console.log(`-> Schedule ID: ${finalAugustSched.id} (Stable ID preserved: ${finalAugustSched.id === targetSchedule.id ? 'YES' : 'NO'})`);
      console.log(`-> New Amount: ${finalAugustSched.amount} (Expected: 1500000)`);
      console.log(`-> Paid Amount: ${finalAugustSched.paidAmount} (Expected: 0)`);
      console.log(`-> Status: ${finalAugustSched.status}`);

      // Check foreign key link to reversed payment
      const [finalPay] = await db.select().from(schema.paymentRecords).where(eq(schema.paymentRecords.id, payId));
      console.log(`-> Payment ${finalPay.id} still references Schedule ${finalPay.rentScheduleId}: ${finalPay.rentScheduleId === finalAugustSched.id ? 'VALID (PASS)' : 'BROKEN (FAIL)'}`);

      // Count schedules for lease to ensure no duplicate periods
      const allSchedules = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, leaseId));
      const periodStarts = allSchedules.map(s => s.periodStart);
      const uniqueStarts = new Set(periodStarts);
      console.log(`-> Total Schedules: ${allSchedules.length} | Unique Period Starts: ${uniqueStarts.size} -> No duplicates: ${allSchedules.length === uniqueStarts.size ? 'PASS' : 'FAIL'}`);
    }

  } finally {
    // Deterministic synthetic cleanup
    await db.delete(schema.leaseRenewals).where(eq(schema.leaseRenewals.leaseId, leaseId)).catch(() => {});
    await db.delete(schema.paymentRecords).where(eq(schema.paymentRecords.leaseId, leaseId)).catch(() => {});
    await db.delete(schema.rentSchedules).where(eq(schema.rentSchedules.leaseId, leaseId)).catch(() => {});
    await db.delete(schema.leaseTenants).where(eq(schema.leaseTenants.leaseId, leaseId)).catch(() => {});
    await db.delete(schema.leases).where(eq(schema.leases.id, leaseId)).catch(() => {});
    await db.delete(schema.ownershipRecords).where(eq(schema.ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(schema.properties).where(eq(schema.properties.id, propId)).catch(() => {});
    await db.delete(schema.users).where(eq(schema.users.id, ownerId)).catch(() => {});
    await db.delete(schema.users).where(eq(schema.users.id, tenantId)).catch(() => {});
    await pool.end();
  }
}

reproduceSequence().catch(console.error);
