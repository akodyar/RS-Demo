import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, properties, leases, leaseTenants, rentSchedules, paymentRecords, ownershipRecords, securityDeposits } from '../src/db/schema.js';
import { eq, and, asc } from 'drizzle-orm';
import { tenantRepository } from '../src/server/repositories/tenant.js';
import { leaseRepository } from '../src/server/repositories/leases.js';

process.env.SQL_HOST = 'localhost';

test('Co-Tenant Rent Schedule & Deposit Visibility Suite', async (t) => {
  const runId = Date.now().toString(36) + Math.floor(Math.random() * 1000);
  const primaryTenantId = `t-primary-${runId}`;
  const coTenantId = `t-cotenant-${runId}`;
  const otherTenantId = `t-other-${runId}`;
  const nonMemberTenantId = `t-nonmember-${runId}`;
  const ownerId = `o-vis-${runId}`;
  const propId = `p-vis-${runId}`;
  const otherPropId = `p-other-${runId}`;

  // 1. Seed users
  await db.insert(users).values([
    { id: primaryTenantId, firstName: 'Primary', lastName: 'Tenant', email: `${primaryTenantId}@test.com`, roles: ['TENANT'] },
    { id: coTenantId, firstName: 'Co', lastName: 'Tenant', email: `${coTenantId}@test.com`, roles: ['TENANT'] },
    { id: otherTenantId, firstName: 'Other', lastName: 'Tenant', email: `${otherTenantId}@test.com`, roles: ['TENANT'] },
    { id: nonMemberTenantId, firstName: 'NonMember', lastName: 'Tenant', email: `${nonMemberTenantId}@test.com`, roles: ['TENANT'] },
    { id: ownerId, firstName: 'Owner', lastName: 'User', email: `${ownerId}@test.com`, roles: ['PROPERTY_OWNER'] },
  ]);

  // 2. Seed properties & ownership
  await db.insert(properties).values([
    { id: propId, name: 'Co-Tenancy Residence', type: 'RESIDENTIAL', status: 'ACTIVE' },
    { id: otherPropId, name: 'Isolated Residence', type: 'RESIDENTIAL', status: 'ACTIVE' },
  ]);

  await db.insert(ownershipRecords).values([
    { propertyId: propId, ownerId: ownerId, ownershipPercentage: '100', status: 'VERIFIED' },
    { propertyId: otherPropId, ownerId: ownerId, ownershipPercentage: '100', status: 'VERIFIED' },
  ]);

  // 3. Create Multi-Tenant Lease (1,000,000 IQD/mo, 1,000,000 IQD deposit)
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear() + 1, now.getMonth(), 1);

  const [sharedLease] = await db.insert(leases).values({
    propertyId: propId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rentAmount: '1000000',
    depositAmount: '1000000',
    currency: 'IQD',
    status: 'ACTIVE',
  }).returning();

  // Attach primary tenant and co-tenant to shared lease
  await db.insert(leaseTenants).values([
    { leaseId: sharedLease.id, tenantId: primaryTenantId, isPrimary: true },
    { leaseId: sharedLease.id, tenantId: coTenantId, isPrimary: false },
  ]);

  // Generate rent schedule (associated with primary tenant by default)
  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(
      tx,
      sharedLease.id,
      propId,
      primaryTenantId,
      null,
      start.toISOString(),
      end.toISOString(),
      1000000,
      'IQD'
    );
  });

  // Generate security deposit for the shared lease
  const [sharedDeposit] = await db.insert(securityDeposits).values({
    leaseId: sharedLease.id,
    propertyId: propId,
    tenantId: primaryTenantId,
    requiredAmount: '1000000',
    recordedAmount: '1000000',
    releasedAmount: '0',
    currency: 'IQD',
    status: 'HELD',
  }).returning();

  // 4. Create an isolated second lease for otherTenantId
  const [otherLease] = await db.insert(leases).values({
    propertyId: otherPropId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    rentAmount: '500000',
    depositAmount: '500000',
    currency: 'IQD',
    status: 'ACTIVE',
  }).returning();

  await db.insert(leaseTenants).values([
    { leaseId: otherLease.id, tenantId: otherTenantId, isPrimary: true },
  ]);

  await db.transaction(async (tx) => {
    await leaseRepository.generateRentSchedule(
      tx,
      otherLease.id,
      otherPropId,
      otherTenantId,
      null,
      start.toISOString(),
      end.toISOString(),
      500000,
      'IQD'
    );
  });

  const sharedSchedules = await db.select().from(rentSchedules)
    .where(eq(rentSchedules.leaseId, sharedLease.id))
    .orderBy(asc(rentSchedules.dueDate));

  assert.ok(sharedSchedules.length >= 12, 'Must have at least 12 monthly rent schedules');

  // --------------------------------------------------------------------------
  // Requirement 1: Primary tenant sees correct lease schedules and summary
  // --------------------------------------------------------------------------
  await t.test('1. Primary tenant sees correct lease schedules and financial summary', async () => {
    const dash = await tenantRepository.getAuthoritativeDashboard(primaryTenantId);

    assert.ok(dash.rentDue, 'Primary tenant must have rentDue');
    assert.strictEqual(dash.rentDue.scheduleId, sharedSchedules[0].id);
    assert.strictEqual(dash.rentDue.amount, 1000000);
    assert.strictEqual(dash.rentDue.currency, 'IQD');
    assert.strictEqual(dash.financialSummary.outstanding, 12000000);
    assert.strictEqual(dash.financialSummary.overdue, 0);
    assert.strictEqual(dash.currentProperty?.leaseId, sharedLease.id);
  });

  // --------------------------------------------------------------------------
  // Requirement 2: Secondary co-tenant on the same active lease sees the same authoritative rent obligations
  // --------------------------------------------------------------------------
  await t.test('2. Secondary co-tenant on the same active lease sees the same authoritative lease-level rent obligations', async () => {
    const dash = await tenantRepository.getAuthoritativeDashboard(coTenantId);

    assert.ok(dash.rentDue, 'Secondary co-tenant must have rentDue on their active lease');
    assert.strictEqual(dash.rentDue.scheduleId, sharedSchedules[0].id, 'Co-tenant must see the same active schedule');
    assert.strictEqual(dash.rentDue.amount, 1000000, 'Co-tenant must see the exact rent amount due');
    assert.strictEqual(dash.rentDue.currency, 'IQD', 'Co-tenant currency must match lease currency');
    assert.strictEqual(dash.financialSummary.outstanding, 12000000, 'Co-tenant must see the authoritative outstanding balance');
    assert.strictEqual(dash.financialSummary.overdue, 0);
    assert.strictEqual(dash.currentProperty?.leaseId, sharedLease.id, 'Co-tenant property summary must link to shared lease');

    // Upcoming events must include the rent due event for co-tenant
    const rentEvent = dash.upcomingEvents.find(e => e.type === 'RENT_DUE');
    assert.ok(rentEvent, 'Co-tenant must have RENT_DUE upcoming event');
    assert.strictEqual(rentEvent.date, sharedSchedules[0].dueDate);
  });

  // --------------------------------------------------------------------------
  // Requirement 3: Co-tenant dashboard correctly reports outstanding and overdue rent
  // --------------------------------------------------------------------------
  await t.test('3. Co-tenant dashboard correctly reports outstanding and overdue rent when applicable', async () => {
    const overdueSchedule = sharedSchedules[0];

    // Mark first schedule as OVERDUE with partial payment of 300,000 IQD
    await db.update(rentSchedules)
      .set({
        status: 'OVERDUE',
        paidAmount: '300000',
      })
      .where(eq(rentSchedules.id, overdueSchedule.id));

    try {
      const coDash = await tenantRepository.getAuthoritativeDashboard(coTenantId);
      const priDash = await tenantRepository.getAuthoritativeDashboard(primaryTenantId);

      // Both primary and co-tenant must see identical rentDue and overdue balances
      assert.strictEqual(coDash.rentDue?.scheduleId, overdueSchedule.id);
      assert.strictEqual(coDash.rentDue?.amount, 700000, 'Remaining overdue balance must be 700,000 IQD');
      assert.strictEqual(coDash.rentDue?.isOverdue, true, 'Must flag as overdue');
      assert.strictEqual(coDash.financialSummary.overdue, 700000, 'Overdue summary must be 700,000 IQD');
      assert.strictEqual(coDash.financialSummary.outstanding, 11000000, 'Remaining 11 installments must be outstanding');

      assert.strictEqual(coDash.financialSummary.overdue, priDash.financialSummary.overdue, 'Co-tenant overdue must match primary tenant');
      assert.strictEqual(coDash.financialSummary.outstanding, priDash.financialSummary.outstanding, 'Co-tenant outstanding must match primary tenant');
    } finally {
      // Revert first schedule
      await db.update(rentSchedules)
        .set({ status: 'UPCOMING', paidAmount: '0' })
        .where(eq(rentSchedules.id, overdueSchedule.id));
    }
  });

  // --------------------------------------------------------------------------
  // Requirement 4: A tenant on a different lease cannot access the first lease's schedules
  // --------------------------------------------------------------------------
  await t.test('4. A tenant on a different lease cannot access the first lease schedules', async () => {
    const otherDash = await tenantRepository.getAuthoritativeDashboard(otherTenantId);

    assert.ok(otherDash.rentDue);
    assert.strictEqual(otherDash.currentProperty?.leaseId, otherLease.id, 'Must be scoped to other lease');
    assert.notStrictEqual(otherDash.rentDue.scheduleId, sharedSchedules[0].id, 'Must NOT see shared lease schedules');
    assert.strictEqual(otherDash.rentDue.amount, 500000, 'Must see own lease rent amount');
    assert.strictEqual(otherDash.financialSummary.outstanding, 6000000, 'Must see own lease total outstanding');
  });

  // --------------------------------------------------------------------------
  // Requirement 5: A user who is not a member of the lease cannot access its schedules or deposit
  // --------------------------------------------------------------------------
  await t.test('5. A user who is not a member of the lease has no access to its schedules or deposit', async () => {
    const nonMemberDash = await tenantRepository.getAuthoritativeDashboard(nonMemberTenantId);

    assert.strictEqual(nonMemberDash.currentProperty, null, 'Non-member has no current property');
    assert.strictEqual(nonMemberDash.myLease, null, 'Non-member has no active lease');
    assert.strictEqual(nonMemberDash.rentDue, null, 'Non-member has no rent due');
    assert.strictEqual(nonMemberDash.financialSummary.outstanding, 0, 'Non-member has 0 outstanding');
    assert.strictEqual(nonMemberDash.financialSummary.overdue, 0, 'Non-member has 0 overdue');
    assert.strictEqual(nonMemberDash.securityDeposit, null, 'Non-member has no security deposit');

    const nonMemberDeposits = await tenantRepository.getTenantDeposits(nonMemberTenantId);
    assert.strictEqual(nonMemberDeposits.length, 0, 'Non-member receives empty deposits list');
  });

  // --------------------------------------------------------------------------
  // Requirement 6: Security-deposit visibility follows the verified deposit ownership model
  // --------------------------------------------------------------------------
  await t.test('6. Security-deposit visibility follows the verified deposit ownership model', async () => {
    // Both primary tenant and co-tenant on the active lease must see the lease security deposit
    const priDash = await tenantRepository.getAuthoritativeDashboard(primaryTenantId);
    const coDash = await tenantRepository.getAuthoritativeDashboard(coTenantId);

    assert.ok(priDash.securityDeposit, 'Primary tenant must see deposit');
    assert.strictEqual(priDash.securityDeposit.id, sharedDeposit.id);
    assert.strictEqual(priDash.securityDeposit.requiredAmount, 1000000);
    assert.strictEqual(priDash.securityDeposit.status, 'HELD');

    assert.ok(coDash.securityDeposit, 'Secondary co-tenant must see lease deposit via verified lease membership');
    assert.strictEqual(coDash.securityDeposit.id, sharedDeposit.id, 'Co-tenant must see the shared lease deposit ID');
    assert.strictEqual(coDash.securityDeposit.requiredAmount, 1000000, 'Co-tenant must see required deposit amount');
    assert.strictEqual(coDash.securityDeposit.recordedAmount, 1000000, 'Co-tenant must see recorded deposit amount');
    assert.strictEqual(coDash.securityDeposit.status, 'HELD', 'Co-tenant must see deposit status');

    // Test getTenantDeposits endpoint method
    const coDeposits = await tenantRepository.getTenantDeposits(coTenantId);
    assert.strictEqual(coDeposits.length, 1, 'Co-tenant must receive 1 deposit from getTenantDeposits');
    assert.strictEqual(coDeposits[0].id, sharedDeposit.id);
    assert.strictEqual(coDeposits[0].leaseId, sharedLease.id);

    // Other tenant must not see shared deposit
    const otherDeposits = await tenantRepository.getTenantDeposits(otherTenantId);
    assert.ok(otherDeposits.every(d => d.leaseId !== sharedLease.id), 'Other tenant cannot see shared lease deposit');
  });

  // --------------------------------------------------------------------------
  // Requirement 7: Dashboard reads are strictly non-mutating
  // --------------------------------------------------------------------------
  await t.test('7. Dashboard reads do not mutate financial state or schedule status', async () => {
    const [beforeSchedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sharedSchedules[0].id));

    // Perform multiple dashboard reads as co-tenant and primary tenant
    await tenantRepository.getAuthoritativeDashboard(coTenantId);
    await tenantRepository.getAuthoritativeDashboard(primaryTenantId);
    await tenantRepository.getTenantDeposits(coTenantId);

    const [afterSchedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, sharedSchedules[0].id));

    assert.strictEqual(afterSchedule.status, beforeSchedule.status, 'Schedule status must remain untouched');
    assert.strictEqual(afterSchedule.paidAmount, beforeSchedule.paidAmount, 'Paid amount must remain untouched');
    assert.strictEqual(afterSchedule.amount, beforeSchedule.amount, 'Schedule amount must remain untouched');
  });

  // --------------------------------------------------------------------------
  // Requirement 8: Existing single-tenant dashboard behavior remains unchanged
  // --------------------------------------------------------------------------
  await t.test('8. Existing single-tenant dashboard behavior remains unchanged', async () => {
    const otherDash = await tenantRepository.getAuthoritativeDashboard(otherTenantId);

    assert.ok(otherDash.user, 'Must have user profile');
    assert.strictEqual(otherDash.user.id, otherTenantId);
    assert.strictEqual(otherDash.currentProperty?.id, otherPropId);
    assert.strictEqual(otherDash.currentProperty?.monthlyRent, 500000);
    assert.strictEqual(otherDash.rentDue?.amount, 500000);
    assert.strictEqual(otherDash.financialSummary.outstanding, 6000000);
  });
});
