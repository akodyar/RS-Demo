process.env.SQL_HOST = 'localhost';
import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, commissions, journalEntries, ledgerLines, rentalApplications } from '../src/db/schema.js';
import { LeaseRepository } from '../src/server/repositories/leases.js';
import { CommissionService } from '../src/server/services/commission.js';
import { eq, and } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import leasesRouter from '../src/server/routes/leases.js';

describe('Payment Reversal Atomicity & Self-Healing', () => {
  let app: any;
  let testOwner: any;
  let testTenant: any;
  let testProperty: any;
  let testLease: any;
  let testSchedule: any;
  let testPayment: any;
  
  const leaseRepo = new LeaseRepository();
  const commissionService = new CommissionService();

  before(async () => {
    app = express();
    app.use(express.json());
    
    // Mock user for auth
    const [owner] = await db.insert(users).values({ 
      email: `rev_o_${Date.now()}@t.com`, firstName: 'O', lastName: 'O', role: 'PLATFORM_ADMIN', roles: ['PLATFORM_ADMIN'] 
    }).returning();
    testOwner = owner;

    app.use((req: any, res: any, next: any) => {
      req.user = { id: testOwner.id, roles: ['PLATFORM_ADMIN'] };
      next();
    });
    
    // Mount routes
    const mainRouter = express.Router();
    mainRouter.use('/properties/:propertyId/leases', leasesRouter);
    app.use('/api', mainRouter);

    // Setup data
    const [tenant] = await db.insert(users).values({ email: `rev_t_${Date.now()}@t.com`, firstName: 'T', lastName: 'T', role: 'TENANT', roles: ['TENANT'] }).returning();
    testTenant = tenant;
    const [prop] = await db.insert(properties).values({ name: 'Prop Rev Test', type: 'SINGLE_FAMILY', status: 'PUBLISHED', ownerId: testOwner.id }).returning();
    testProperty = prop;

    await db.insert(rentalApplications).values({
      propertyId: testProperty.id,
      applicantUserId: testTenant.id,
      status: 'APPROVED',
    });
    
    const lease = await leaseRepo.createLease(testProperty.id, null, [testTenant.id], '2026-01-01T00:00:00.000Z', '2026-12-31T00:00:00.000Z', 1000);
    testLease = lease;
    
    const [schedule] = await db.insert(rentSchedules).values({
      leaseId: testLease.id, propertyId: testProperty.id, tenantId: testTenant.id, amount: '1000', currency: 'IQD', status: 'UPCOMING', periodStart: '2026-01-01', periodEnd: '2026-01-31', dueDate: '2026-01-05'
    }).returning();
    testSchedule = schedule;

    // Record & Confirm Payment
    testPayment = await leaseRepo.recordPayment(testProperty.id, testLease.id, testTenant.id, testSchedule.id, 1000, 'CASH', 'REF-REV');
    await db.update(paymentRecords).set({ status: 'CONFIRMED' }).where(eq(paymentRecords.id, testPayment.id));
    await commissionService.postCommissionForPayment(testPayment.id, testOwner.id, 'SYSTEM');
  });

  after(async () => {
    // cleanup
    await db.delete(commissions).where(eq(commissions.paymentRecordId, testPayment.id));
    await db.delete(paymentRecords).where(eq(paymentRecords.id, testPayment.id));
    await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, testLease.id));
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, testLease.id));
    await db.delete(rentalApplications).where(eq(rentalApplications.propertyId, testProperty.id));
    await db.delete(leases).where(eq(leases.id, testLease.id));
    await db.delete(ledgerLines);
    await db.delete(journalEntries).where(eq(journalEntries.propertyId, testProperty.id));
    await db.delete(properties).where(eq(properties.id, testProperty.id));
    await db.delete(users).where(eq(users.id, testTenant.id));
    await db.delete(users).where(eq(users.id, testOwner.id));
  });

  it('should self-heal a stranded commission on a reversed payment', async () => {
    // 1. Manually simulate the atomicity break (Payment REVERSED, Schedule UPCOMING, Commission ACTIVE)
    await db.update(paymentRecords).set({ status: 'REVERSED' }).where(eq(paymentRecords.id, testPayment.id));
    await db.update(rentSchedules).set({ paidAmount: '0', status: 'UPCOMING' }).where(eq(rentSchedules.id, testSchedule.id));
    
    // Verify broken state
    const [comms] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, testPayment.id));
    assert.strictEqual(comms.status, 'POSTED'); // ACTIVE/POSTED, not reversed!

    // 2. Trigger the self-healing route by trying to reverse it again
    const res = await request(app)
      .post(`/api/properties/${testProperty.id}/leases/payments/${testPayment.id}/reverse`)
      .send({ reason: 'Self-healing test' });
      
    // Should return success with "Recovered missing reversal data"
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.message, "Recovered missing reversal data");

    // 3. Verify it is now fully reversed
    const [healedComms] = await db.select().from(commissions).where(eq(commissions.paymentRecordId, testPayment.id));
    assert.strictEqual(healedComms.status, 'REVERSED');
  });
});
