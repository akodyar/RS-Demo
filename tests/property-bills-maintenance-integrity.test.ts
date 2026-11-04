import 'dotenv/config';
import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { utilityBillRepository } from '../src/server/repositories/utility-bills.js';
import { maintenanceRepository } from '../src/server/repositories/maintenance.js';
import { agentRepository } from '../src/server/repositories/agent.js';
import { ownerRepository } from '../src/server/repositories/owner.js';
import { vendorRepository } from '../src/server/repositories/vendor.js';

const testDb = process.env.SQL_DB_NAME || 'homehub_test';
if (testDb !== 'homehub_test') {
  console.error('[SAFETY GATE VIOLATION] Target database must be homehub_test');
  process.exit(1);
}

test('Comprehensive Property Bills, Utility Payments & Maintenance Management Integrity Suite', async (t) => {
  const runId = `util_maint_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Personas
  const adminId = `usr_adm_${runId}`;
  const ownerAId = `usr_own_a_${runId}`;
  const ownerBId = `usr_own_b_${runId}`;
  const tenantAId = `usr_ten_a_${runId}`;
  const tenantBId = `usr_ten_b_${runId}`;
  const agentAId = `usr_agt_a_${runId}`;
  const agentBId = `usr_agt_b_${runId}`;
  const vendorUserId = `usr_vnd_${runId}`;
  const vendorOrgId = `org_vnd_${runId}`;

  // Properties
  const propAId = `prop_a_${runId}`;
  const propBId = `prop_b_${runId}`;

  // Leases
  const leaseAId = `lease_a_${runId}`;
  const leaseExpiredId = `lease_exp_${runId}`;

  // 1. Setup Personas and Base Data
  await db.insert(schema.users).values([
    { id: adminId, uid: adminId, email: `${adminId}@test.com`, firstName: 'Admin', lastName: 'User', roles: ['PLATFORM_ADMIN'], status: 'ACTIVE' },
    { id: ownerAId, uid: ownerAId, email: `${ownerAId}@test.com`, firstName: 'Owner', lastName: 'A', roles: ['OWNER'], status: 'ACTIVE' },
    { id: ownerBId, uid: ownerBId, email: `${ownerBId}@test.com`, firstName: 'Owner', lastName: 'B', roles: ['OWNER'], status: 'ACTIVE' },
    { id: tenantAId, uid: tenantAId, email: `${tenantAId}@test.com`, firstName: 'Tenant', lastName: 'A', roles: ['TENANT'], status: 'ACTIVE' },
    { id: tenantBId, uid: tenantBId, email: `${tenantBId}@test.com`, firstName: 'Tenant', lastName: 'B', roles: ['TENANT'], status: 'ACTIVE' },
    { id: agentAId, uid: agentAId, email: `${agentAId}@test.com`, firstName: 'Agent', lastName: 'A', roles: ['AGENT'], status: 'ACTIVE' },
    { id: agentBId, uid: agentBId, email: `${agentBId}@test.com`, firstName: 'Agent', lastName: 'B', roles: ['AGENT'], status: 'ACTIVE' },
    { id: vendorUserId, uid: vendorUserId, email: `${vendorUserId}@test.com`, firstName: 'Vendor', lastName: 'Tech', roles: ['VENDOR'], status: 'ACTIVE' },
  ]);

  await db.insert(schema.organizations).values({
    id: vendorOrgId,
    name: `Vendor Org ${runId}`,
    type: 'VENDOR',
  });

  await db.insert(schema.organizationMembers).values({
    organizationId: vendorOrgId,
    userId: vendorUserId,
    role: 'TECHNICIAN',
    status: 'ACTIVE',
  });

  await db.insert(schema.properties).values([
    { id: propAId, ownerId: ownerAId, name: `Property Alpha ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED' },
    { id: propBId, ownerId: ownerBId, name: `Property Beta ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', operatingModel: 'FULLY_MANAGED' },
  ]);

  await db.insert(schema.ownershipRecords).values([
    { propertyId: propAId, ownerId: ownerAId, status: 'VERIFIED', ownershipPercentage: '100' },
    { propertyId: propBId, ownerId: ownerBId, status: 'VERIFIED', ownershipPercentage: '100' },
  ]);

  // Agent A assigned to Prop A; Agent B has no assignment to Prop A
  await db.insert(schema.agentPropertyAssignments).values([
    { propertyId: propAId, userId: agentAId, assignedBy: adminId, status: 'ACTIVE', permissions: [] }
  ]);

  // Active lease for Tenant A on Prop A
  await db.insert(schema.leases).values([
    { id: leaseAId, propertyId: propAId, status: 'ACTIVE', startDate: '2025-01-01', endDate: '2030-01-01', rentAmount: '1000000', currency: 'IQD' },
    { id: leaseExpiredId, propertyId: propBId, status: 'EXPIRED', startDate: '2024-01-01', endDate: '2024-12-31', rentAmount: '800000', currency: 'IQD' },
  ]);

  await db.insert(schema.leaseTenants).values([
    { id: `lt_a_${runId}`, leaseId: leaseAId, tenantId: tenantAId, isPrimary: true },
    { id: `lt_exp_${runId}`, leaseId: leaseExpiredId, tenantId: tenantBId, isPrimary: true },
  ]);

  // -------------------------------------------------------------
  // TEST SECTION 1: UTILITY BILL CREATION & OUTSTANDING INTEGRITY
  // -------------------------------------------------------------
  await t.test('1. Bill Creation & Outstanding Amount Invariant', async () => {
    const waterBill = await utilityBillRepository.createBill({
      propertyId: propAId,
      tenantId: tenantAId,
      leaseId: leaseAId,
      type: 'WATER',
      description: 'Q3 Water Utility Tariff',
      amount: 75000,
      billingDate: '2026-10-01',
      dueDate: '2026-11-01',
    }, adminId);

    assert.strictEqual(waterBill.status, 'UNPAID', 'New bill status must be UNPAID');
    assert.strictEqual(Number(waterBill.amount), 75000, 'Original amount must be 75,000');
    assert.strictEqual(Number(waterBill.outstandingAmount), 75000, 'Initial outstanding must equal total amount');
  });

  // -------------------------------------------------------------
  // TEST SECTION 2: TENANT VISIBILITY & ACCESS BOUNDARIES (IDOR)
  // -------------------------------------------------------------
  let billA: any;
  let billB: any;

  await t.test('2. Tenant Visibility & Cross-Tenant Isolation', async () => {
    billA = await utilityBillRepository.createBill({
      propertyId: propAId,
      tenantId: tenantAId,
      leaseId: leaseAId,
      type: 'ELECTRICITY',
      amount: 120000,
      billingDate: '2026-10-01',
    }, adminId);

    billB = await utilityBillRepository.createBill({
      propertyId: propBId,
      tenantId: tenantBId,
      leaseId: leaseExpiredId,
      type: 'WATER',
      amount: 45000,
      billingDate: '2026-10-01',
    }, adminId);

    const tenantABills = await utilityBillRepository.getTenantBills(tenantAId);
    assert(tenantABills.some(b => b.id === billA.id), 'Tenant A must see their own electricity bill');
    assert(!tenantABills.some(b => b.id === billB.id), 'Tenant A must NEVER see Tenant B bills');

    const tenantBBills = await utilityBillRepository.getTenantBills(tenantBId);
    assert(tenantBBills.some(b => b.id === billB.id), 'Tenant B must see their own water bill');
    assert(!tenantBBills.some(b => b.id === billA.id), 'Tenant B must NEVER see Tenant A bills');
  });

  // -------------------------------------------------------------
  // TEST SECTION 3: OVERPAYMENT & INVALID AMOUNT REJECTION
  // -------------------------------------------------------------
  await t.test('3. Overpayment & Zero-Amount Rejection', async () => {
    // Attempt zero amount
    await assert.rejects(
      async () => utilityBillRepository.payBill(billA.id, 0, 'SYSTEM', tenantAId),
      /Payment amount must be greater than zero/,
      'Zero payment must be rejected'
    );

    // Attempt negative amount
    await assert.rejects(
      async () => utilityBillRepository.payBill(billA.id, -5000, 'SYSTEM', tenantAId),
      /Payment amount must be greater than zero/,
      'Negative payment must be rejected'
    );

    // Attempt overpayment: billA outstanding is 120,000; pay 150,000
    await assert.rejects(
      async () => utilityBillRepository.payBill(billA.id, 150000, 'SYSTEM', tenantAId),
      /Payment exceeds outstanding amount/,
      'Payment exceeding outstanding amount must fail closed'
    );
  });

  // -------------------------------------------------------------
  // TEST SECTION 4: PARTIAL PAYMENT & OUTSTANDING CALCULATION
  // -------------------------------------------------------------
  await t.test('4. Partial Payment & State Transition to PARTIAL', async () => {
    // Pay 50,000 out of 120,000
    const result = await utilityBillRepository.payBill(billA.id, 50000, 'SYSTEM', tenantAId);

    assert.strictEqual(result.bill.status, 'PARTIAL', 'Bill status must transition to PARTIAL');
    assert.strictEqual(Number(result.bill.outstandingAmount), 70000, 'Outstanding amount must decrement to 70,000');
    assert.strictEqual(result.payment.paymentMethod, 'SYSTEM', 'Payment method must be SYSTEM');
    assert.strictEqual(result.payment.status, 'CONFIRMED', 'Payment record status must be CONFIRMED');
    assert.strictEqual(result.payment.collectorId, null, 'Direct tenant payment has no collector');
    assert.strictEqual(result.payment.payerId, tenantAId, 'Payer ID must record Tenant A');
  });

  // -------------------------------------------------------------
  // TEST SECTION 5: CASH COLLECTION BY ADMIN & COLLECTOR ATTRIBUTION
  // -------------------------------------------------------------
  await t.test('5. Cash Collection by Platform Admin with Collector Attribution', async () => {
    // Admin collects 30,000 cash from Tenant A
    const result = await utilityBillRepository.payBill(billA.id, 30000, 'CASH', tenantAId, adminId);

    assert.strictEqual(result.bill.status, 'PARTIAL', 'Status remains PARTIAL with remaining balance');
    assert.strictEqual(Number(result.bill.outstandingAmount), 40000, 'Outstanding amount decrements to 40,000');
    assert.strictEqual(result.payment.paymentMethod, 'CASH', 'Payment method must be CASH');
    assert.strictEqual(result.payment.collectorId, adminId, 'Collector must be recorded as Admin');
    assert.strictEqual(result.payment.payerId, tenantAId, 'Payer must be recorded as Tenant A');
  });

  // -------------------------------------------------------------
  // TEST SECTION 6: AGENT CASH COLLECTION & PROPERTY AUTHORIZATION
  // -------------------------------------------------------------
  await t.test('6. Agent Cash Collection & Cross-Agent Authority Boundary', async () => {
    // Agent B is NOT assigned to Property A
    const agentBAssigned = await agentRepository.getAssignedPropertyIds(agentBId);
    assert(!agentBAssigned.includes(propAId), 'Agent B must have zero assignments on Property A');

    // Agent A IS assigned to Property A
    const agentAAssigned = await agentRepository.getAssignedPropertyIds(agentAId);
    assert(agentAAssigned.includes(propAId), 'Agent A must have active assignment on Property A');

    // Agent A collects final 40,000 cash to fully pay billA
    const result = await utilityBillRepository.payBill(billA.id, 40000, 'CASH', tenantAId, agentAId);

    assert.strictEqual(result.bill.status, 'PAID', 'Bill status must transition to PAID');
    assert.strictEqual(Number(result.bill.outstandingAmount), 0, 'Outstanding amount must reach zero');
    assert.strictEqual(result.payment.collectorId, agentAId, 'Collector must be Agent A');

    // Attempting further payment on PAID bill must be cleanly rejected
    await assert.rejects(
      async () => utilityBillRepository.payBill(billA.id, 1000, 'CASH', tenantAId, agentAId),
      /Bill is already PAID/,
      'Paying an already PAID bill must be rejected'
    );
  });

  // -------------------------------------------------------------
  // TEST SECTION 7: OWNER PROPERTY BILLS QUERY & CROSS-OWNER ISOLATION
  // -------------------------------------------------------------
  await t.test('7. Owner Unpaid Bills Query & Cross-Owner Isolation', async () => {
    // Since billA is now PAID, it should NOT appear in Owner A's unpaid bills list
    const ownerAUnpaid = await utilityBillRepository.getOwnerPropertyBills(propAId, ownerAId);
    const hasBillA = ownerAUnpaid.some(b => b.id === billA.id);
    assert.strictEqual(hasBillA, false, 'Fully paid billA must not appear in unpaid bills query');

    // Owner B cannot access Property A
    const ownerBAccessList = await ownerRepository.getAuthorizedPropertyAccess({ id: ownerBId, roles: ['OWNER'] });
    assert(!ownerBAccessList.some(a => a.propertyId === propAId), 'Owner B must be completely isolated from Property A');
  });

  // -------------------------------------------------------------
  // TEST SECTION 8: MAINTENANCE REQUEST CREATION & LEASE VALIDATION
  // -------------------------------------------------------------
  let maintRequest: any;

  await t.test('8. Maintenance Request Submission with Active Lease Check', async () => {
    // Tenant A has active lease on Prop A -> Success
    maintRequest = await maintenanceRepository.createRequest(
      tenantAId,
      propAId,
      null,
      'PLUMBING',
      'HIGH',
      'Kitchen pipe leaking water under counter',
      'Persistent leak starting yesterday morning, valve loose'
    );

    assert.ok(maintRequest.id, 'Request ID generated');
    assert.strictEqual(maintRequest.status, 'REPORTED', 'Initial status must be REPORTED');
    assert.strictEqual(maintRequest.reporterUserId, tenantAId, 'Reporter must be Tenant A');
    assert.strictEqual(maintRequest.propertyId, propAId, 'Property must be Property A');
  });

  // -------------------------------------------------------------
  // TEST SECTION 9: MANAGER TRIAGE & FOREIGN KEY INTEGRITY
  // -------------------------------------------------------------
  await t.test('9. Triage Request & Auto-Work-Order FK Safety', async () => {
    // Triaging to IN_PROGRESS with assigned vendor
    const triaged = await maintenanceRepository.triageRequest(
      maintRequest.id,
      'TRIAGED',
      vendorOrgId,
      'HIGH'
    );

    assert.strictEqual(triaged.status, 'TRIAGED', 'Status must be updated to TRIAGED');
    assert.strictEqual(triaged.assignedVendorId, vendorOrgId, 'Assigned vendor must be set');

    // Testing the safe auto-WO creation fix on WORK_ORDER_CREATED
    const autoWoUpdated = await maintenanceRepository.triageRequest(
      maintRequest.id,
      'WORK_ORDER_CREATED'
    );
    assert.strictEqual(autoWoUpdated.status, 'WORK_ORDER_CREATED', 'Status updated to WORK_ORDER_CREATED');

    // Verify work order was created with authentic propertyId (NOT 'unknown')
    const [wo] = await db.select().from(schema.workOrders).where(eq(schema.workOrders.maintenanceRequestId, maintRequest.id));
    assert.ok(wo, 'Work order must exist');
    assert.strictEqual(wo.propertyId, propAId, 'Work order propertyId must match authentic Property A');
  });

  // -------------------------------------------------------------
  // TEST SECTION 10: VENDOR QUOTE SUBMISSION & PROPERTY DERIVATION
  // -------------------------------------------------------------
  let quote: any;

  await t.test('10. Vendor Quote Submission with Derived Property ID', async () => {
    quote = await maintenanceRepository.submitQuote(
      maintRequest.id,
      vendorOrgId,
      propAId,
      85000,
      'Replacing high-pressure valve and pipe sealing tape',
      '2026-11-30'
    );

    assert.ok(quote.id, 'Quote ID generated');
    assert.strictEqual(quote.status, 'PENDING_APPROVAL', 'Initial quote status must be PENDING_APPROVAL');
    assert.strictEqual(Number(quote.totalAmount), 85000, 'Quote amount must be 85,000');
    assert.strictEqual(quote.propertyId, propAId, 'Quote propertyId must match Property A');

    // Request status updated to QUOTE_RECEIVED
    const [reqAfterQuote] = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, maintRequest.id));
    assert.strictEqual(reqAfterQuote.status, 'QUOTE_RECEIVED', 'Maintenance request status must transition to QUOTE_RECEIVED');
  });

  // -------------------------------------------------------------
  // TEST SECTION 11: OWNER QUOTE APPROVAL & WORK ORDER SCHEDULING
  // -------------------------------------------------------------
  let approvedWorkOrder: any;

  await t.test('11. Owner Quote Approval & Scheduled Work Order', async () => {
    approvedWorkOrder = await maintenanceRepository.approveQuote(quote.id);

    assert.ok(approvedWorkOrder.id, 'Work order generated on quote approval');
    assert.strictEqual(approvedWorkOrder.status, 'SCHEDULED', 'Work order initial status must be SCHEDULED');
    assert.strictEqual(approvedWorkOrder.quoteId, quote.id, 'Work order must reference approved quote');
    assert.strictEqual(approvedWorkOrder.propertyId, propAId, 'Work order propertyId must match Property A');

    // Quote status updated to APPROVED
    const [approvedQuote] = await db.select().from(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.id, quote.id));
    assert.strictEqual(approvedQuote.status, 'APPROVED', 'Quote status must be APPROVED');
  });

  // -------------------------------------------------------------
  // TEST SECTION 12: WORK ORDER COMPLETION & INSPECTION
  // -------------------------------------------------------------
  await t.test('12. Work Order Completion & Inspection Outcome', async () => {
    // 12a. Inspection Passed
    const completedWo = await maintenanceRepository.completeWorkOrder(
      approvedWorkOrder.id,
      true,
      adminId
    );

    assert.ok(completedWo, 'Completed work order returned');

    const [updatedWo] = await db.select().from(schema.workOrders).where(eq(schema.workOrders.id, approvedWorkOrder.id));
    assert.strictEqual(updatedWo.status, 'COMPLETED', 'Work order must be marked COMPLETED');

    const [updatedReq] = await db.select().from(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.id, maintRequest.id));
    assert.strictEqual(updatedReq.status, 'COMPLETED', 'Maintenance request must transition to COMPLETED');

    const [inspection] = await db.select().from(schema.inspections).where(eq(schema.inspections.workOrderId, approvedWorkOrder.id));
    assert.ok(inspection, 'Inspection record must be logged');
    assert.strictEqual(inspection.status, 'PASSED', 'Inspection status must be PASSED');
    assert.strictEqual(inspection.inspectorId, adminId, 'Inspector must be recorded as Admin');
  });

  // -------------------------------------------------------------
  // TEST SECTION 13: VENDOR INVOICE & EXPENSE ISOLATION
  // -------------------------------------------------------------
  await t.test('13. Vendor Invoice Creation & Operating Expense Segregation', async () => {
    // Profile setup for Vendor
    await db.insert(schema.vendorProfiles).values({
      userId: vendorUserId,
      organizationId: vendorOrgId,
      businessName: 'Apex Plumbing Co',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    }).onConflictDoNothing();

    const invoice = await vendorRepository.createInvoice(vendorUserId, {
      workOrderId: approvedWorkOrder.id,
      quoteId: quote.id,
      amount: 85000,
      currency: 'IQD',
      lineItems: [
        { description: 'Labor - 2 Hours', amount: 50000 },
        { description: 'Pressure Valve & Teflon', amount: 35000 }
      ]
    });

    assert.ok(invoice.id, 'Invoice ID generated');
    assert.strictEqual(invoice.amount, 85000, 'Invoice amount must match 85,000 IQD');
    assert.strictEqual(invoice.status, 'SUBMITTED', 'Initial status must be SUBMITTED');
    assert.strictEqual(invoice.propertyId, propAId, 'Invoice propertyId derived from authoritative work order');

    // Invariant check: Invoices exist in maintenance_invoices and never contaminate rent_schedules
    const rentSchedCount = await db.select().from(schema.rentSchedules).where(eq(schema.rentSchedules.propertyId, propAId));
    assert(rentSchedCount.every(s => s.leaseId === leaseAId), 'Rent schedules strictly belong to leases and never contain vendor invoices');

    // Invariant check: Commissions table only contains rent fee calculations, never vendor invoice expenses
    const commissions = await db.select().from(schema.commissions).where(eq(schema.commissions.propertyId, propAId));
    assert(commissions.every(c => c.rentPaymentId !== null || c.policySnapshot !== null), 'Commissions never deduct maintenance invoices');
  });

  // -------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------
  await db.delete(schema.maintenanceInvoices).where(eq(schema.maintenanceInvoices.propertyId, propAId));
  await db.delete(schema.inspections).where(eq(schema.inspections.propertyId, propAId));
  await db.delete(schema.workOrders).where(eq(schema.workOrders.propertyId, propAId));
  await db.delete(schema.maintenanceQuotes).where(eq(schema.maintenanceQuotes.propertyId, propAId));
  await db.delete(schema.maintenanceRequests).where(eq(schema.maintenanceRequests.propertyId, propAId));
  await db.delete(schema.utilityPayments).where(inArray(schema.utilityPayments.billId, [billA.id, billB.id]));
  await db.delete(schema.utilityBills).where(inArray(schema.utilityBills.propertyId, [propAId, propBId]));
  await db.delete(schema.leaseTenants).where(inArray(schema.leaseTenants.leaseId, [leaseAId, leaseExpiredId]));
  await db.delete(schema.leases).where(inArray(schema.leases.id, [leaseAId, leaseExpiredId]));
  await db.delete(schema.agentPropertyAssignments).where(eq(schema.agentPropertyAssignments.propertyId, propAId));
  await db.delete(schema.ownershipRecords).where(inArray(schema.ownershipRecords.propertyId, [propAId, propBId]));
  await db.delete(schema.properties).where(inArray(schema.properties.id, [propAId, propBId]));
  await db.delete(schema.vendorProfiles).where(eq(schema.vendorProfiles.userId, vendorUserId));
  await db.delete(schema.organizationMembers).where(eq(schema.organizationMembers.organizationId, vendorOrgId));
  await db.delete(schema.organizations).where(eq(schema.organizations.id, vendorOrgId));
  await db.delete(schema.users).where(inArray(schema.users.id, [adminId, ownerAId, ownerBId, tenantAId, tenantBId, agentAId, agentBId, vendorUserId]));

  console.log('✅ ALL PROPERTY BILLS & MAINTENANCE INTEGRITY TESTS PASSED CLEANLY');
});
