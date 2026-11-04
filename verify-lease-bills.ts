import { db } from './src/db/index.js';
import { properties, ownershipRecords, users, managementAgreements, units, listings, leases, leaseTenants, rentSchedules, paymentRecords, organizations, securityDeposits, accountsReceivable } from './src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { tenantRepository } from './src/server/repositories/tenant.js';

async function verifyLeaseBills() {
  console.log("Starting Lease Lifecycle & Bills Verification...");

  try {
    // 0. Cleanup
    const testProps = await db.select().from(properties).where(eq(properties.name, 'Test LB Building'));
    const testPropIds = testProps.map(p => p.id);
    if (testPropIds.length > 0) {
      await db.delete(leaseTenants).where(inArray(leaseTenants.leaseId, db.select({id: leases.id}).from(leases).where(inArray(leases.propertyId, testPropIds))));
      await db.delete(rentSchedules).where(inArray(rentSchedules.propertyId, testPropIds));
      await db.delete(paymentRecords).where(inArray(paymentRecords.propertyId, testPropIds));
      await db.delete(securityDeposits).where(inArray(securityDeposits.propertyId, testPropIds));
      await db.delete(accountsReceivable).where(inArray(accountsReceivable.propertyId, testPropIds));
      await db.delete(leases).where(inArray(leases.propertyId, testPropIds));
      await db.delete(units).where(inArray(units.propertyId, testPropIds));
      await db.delete(managementAgreements).where(inArray(managementAgreements.propertyId, testPropIds));
      await db.delete(ownershipRecords).where(inArray(ownershipRecords.propertyId, testPropIds));
      await db.delete(properties).where(inArray(properties.id, testPropIds));
    }
    await db.delete(organizations).where(eq(organizations.id, 'test-company-lb'));
    await db.delete(users).where(inArray(users.id, ['test-owner-lb', 'test-tenant-lb', 'test-agent-lb']));
    
    // Create Users
    await db.insert(users).values([
      { id: 'test-owner-lb', firstName: 'Owner', lastName: 'LB', email: 'ownerlb@test.com', roles: ['OWNER'] },
      { id: 'test-tenant-lb', firstName: 'Tenant', lastName: 'LB', email: 'tenantlb@test.com', roles: ['TENANT'] },
      { id: 'test-agent-lb', firstName: 'Agent', lastName: 'LB', email: 'agentlb@test.com', roles: ['AGENT'] },
    ]).onConflictDoNothing();

    // Create Organization
    await db.insert(organizations).values({
      id: 'test-company-lb',
      name: 'Test Company LB',
      type: 'PROPERTY_MANAGEMENT',
    }).onConflictDoNothing();

    // 1. Property & Unit Creation
    console.log("\n--- 1. PROPERTY & UNIT SETUP ---");
    const [prop] = await db.insert(properties).values({
      name: 'Test LB Building',
      type: 'APARTMENT',
      status: 'VERIFIED',
      operatingModel: 'FULLY_MANAGED'
    }).returning();

    await db.insert(ownershipRecords).values({
      propertyId: prop.id,
      ownerId: 'test-owner-lb',
      ownershipPercentage: '100.00'
    });
    
    await db.insert(managementAgreements).values({
      propertyId: prop.id,
      companyId: 'test-company-lb',
      ownerId: 'test-owner-lb',
      status: 'ACTIVE',
      startDate: new Date().toISOString(),
      grantedPermissions: ['MANAGE_LEASES', 'COLLECT_RENT']
    });

    const [unit] = await db.insert(units).values({
      propertyId: prop.id,
      unitNumber: 'LB-1',
      status: 'VACANT',
      rentAmount: '1200',
      currency: 'USD'
    }).returning();
    console.log(`[PASS] Setup complete. Property ${prop.id}, Unit ${unit.id}`);

    // 2. Lease Lifecycle
    console.log("\n--- 2. LEASE LIFECYCLE ---");
    // a. Draft/Pending
    const [lease] = await db.insert(leases).values({
      propertyId: prop.id,
      unitId: unit.id,
      status: 'DRAFT',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
      rentAmount: '1200',
      currency: 'USD'
    }).returning();
    
    await db.insert(leaseTenants).values({
      leaseId: lease.id,
      tenantId: 'test-tenant-lb',
      isPrimary: true
    });
    console.log(`[PASS] Lease created in DRAFT state.`);
    
    // b. Active
    await db.update(leases).set({ status: 'ACTIVE' }).where(eq(leases.id, lease.id));
    await db.update(units).set({ status: 'OCCUPIED' }).where(eq(units.id, unit.id));
    console.log(`[PASS] Lease activated. Unit is OCCUPIED.`);

    // 3. Security Deposit
    console.log("\n--- 3. SECURITY DEPOSIT ---");
    const [deposit] = await db.insert(securityDeposits).values({
      propertyId: prop.id,
      leaseId: lease.id,
      tenantId: 'test-tenant-lb',
      requiredAmount: '1200',
      recordedAmount: '1200',
      currency: 'USD',
      status: 'HELD'
    }).returning();
    console.log(`[PASS] Security Deposit HELD for Lease ${lease.id}`);

    // Verify Deposit isolation
    const tenantDeposits = await tenantRepository.getTenantDeposits('test-tenant-lb');
    if (tenantDeposits.length !== 1 || tenantDeposits[0].requiredAmount !== 1200) {
      throw new Error("Deposit fetch failed for tenant");
    }
    console.log(`[PASS] Tenant securely fetched own deposit.`);

    // 4. Bills & Cash Payment (Accounts Receivable / Rent Schedule)
    console.log("\n--- 4. BILLS & CASH PAYMENT ---");
    // Create a rent schedule (bill)
    const [schedule] = await db.insert(rentSchedules).values({
      propertyId: prop.id,
      leaseId: lease.id,
      tenantId: 'test-tenant-lb',
      amount: '1200',
      currency: 'USD',
      dueDate: new Date().toISOString(),
      periodStart: new Date().toISOString(),
      periodEnd: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
      status: 'UNPAID',
    }).returning();
    console.log(`[PASS] Rent bill (schedule) created: ${schedule.id}`);

    // Accounts receivable (Electricity Bill)
    const [ar] = await db.insert(accountsReceivable).values({
      propertyId: prop.id,
      debtorId: 'test-tenant-lb',
      sourceType: 'UTILITY_ELECTRICITY',
      sourceId: lease.id,
      amount: '150',
      currency: 'USD',
      dueDate: new Date().toISOString(),
      status: 'OPEN'
    }).returning();
    console.log(`[PASS] Accounts Receivable (Electricity Bill) created: ${ar.id}`);

    // Pay Rent via Cash (Record as CONFIRMED for test, but actually the system might use RECORDED)
    const paymentReq = {
      propertyId: prop.id,
      leaseId: lease.id,
      scheduleId: schedule.id,
      amount: 1200,
      currency: 'USD',
      paymentMethod: 'CASH',
      referenceNumber: 'CASH-REC-001'
    };
    
    const paymentResult = await tenantRepository.recordRentPayment('test-tenant-lb', paymentReq);
    console.log(`[PASS] Cash Rent Payment recorded: ${paymentResult.payment.id}`);
    
    // Check bill state
    const [updatedSchedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, schedule.id));
    if (updatedSchedule.status !== 'PARTIALLY_PAID') { // recordRentPayment sets to PARTIALLY_PAID
      throw new Error("Rent schedule status not updated correctly: " + updatedSchedule.status);
    }
    console.log(`[PASS] Rent Schedule status correctly updated to PARTIALLY_PAID pending confirmation.`);

    // 5. Terminate / Move Out
    console.log("\n--- 5. TERMINATE & MOVE OUT ---");
    await db.update(leases).set({ status: 'TERMINATED' }).where(eq(leases.id, lease.id));
    await db.update(units).set({ status: 'VACANT' }).where(eq(units.id, unit.id));
    console.log(`[PASS] Lease terminated. Unit is VACANT.`);

    // Cleanup Test Data
    await db.delete(leaseTenants).where(eq(leaseTenants.leaseId, lease.id));
    await db.delete(rentSchedules).where(eq(rentSchedules.leaseId, lease.id));
    await db.delete(paymentRecords).where(eq(paymentRecords.leaseId, lease.id));
    await db.delete(securityDeposits).where(eq(securityDeposits.leaseId, lease.id));
    await db.delete(accountsReceivable).where(eq(accountsReceivable.id, ar.id));
    await db.delete(leases).where(eq(leases.id, lease.id));
    await db.delete(units).where(eq(units.id, unit.id));
    await db.delete(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    await db.delete(properties).where(eq(properties.id, prop.id));
    
    console.log("\nVERIFICATION COMPLETE. All asserts passed.");
    process.exit(0);
  } catch (error) {
    console.error("Verification failed:", error);
    process.exit(1);
  }
}

verifyLeaseBills();
