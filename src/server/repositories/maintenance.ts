import { db } from '../../db/index.js';
import { maintenanceRequests, maintenanceQuotes, workOrders, inspections, users, organizations, properties } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export class MaintenanceRepository {
  // Tenant creates a request
  async createRequest(reporterUserId: string, propertyId: string, unitId: string | null, category: string, priority: string, title: string, description: string) {
    const [request] = await db.insert(maintenanceRequests).values({
      reporterUserId,
      propertyId,
      unitId,
      category,
      priority,
      title,
      description,
      status: 'REPORTED'
    }).returning();
    return request;
  }

  // Get requests for a specific property (Owner/Company view)
  async getRequestsByProperty(propertyId: string) {
    return await db.select({
      request: maintenanceRequests,
      reporter: users
    })
    .from(maintenanceRequests)
    .leftJoin(users, eq(maintenanceRequests.reporterUserId, users.id))
    .where(eq(maintenanceRequests.propertyId, propertyId));
  }

  // Get requests reported by a specific user (Tenant view)
  async getRequestsByReporter(reporterUserId: string) {
    return await db.select({
      request: maintenanceRequests,
      property: properties
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .where(eq(maintenanceRequests.reporterUserId, reporterUserId));
  }
  
  // Get requests assigned to a vendor
  async getRequestsByVendor(vendorId: string) {
    return await db.select({
      request: maintenanceRequests,
      property: properties
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .where(eq(maintenanceRequests.assignedVendorId, vendorId));
  }

  // Update status and optional vendor assignment
  async triageRequest(requestId: string, status: string, assignedVendorId?: string, priority?: string) {
    const updateData: any = { status, updatedAt: new Date() };
    if (assignedVendorId) updateData.assignedVendorId = assignedVendorId;
    if (priority) updateData.priority = priority;

    // Auto-create WO on generic triage to WORK_ORDER_CREATED
    if (status === 'WORK_ORDER_CREATED') {
      const [reqRecord] = await db.select({ propertyId: maintenanceRequests.propertyId, assignedVendorId: maintenanceRequests.assignedVendorId })
        .from(maintenanceRequests)
        .where(eq(maintenanceRequests.id, requestId))
        .limit(1);
      if (reqRecord) {
        await db.insert(workOrders).values({
          maintenanceRequestId: requestId,
          vendorId: assignedVendorId || reqRecord.assignedVendorId || null,
          propertyId: reqRecord.propertyId
        }).onConflictDoNothing();
      }
    }
    const [updated] = await db.update(maintenanceRequests)
      .set(updateData)
      .where(eq(maintenanceRequests.id, requestId))
      .returning();
    return updated;
  }

  // Vendor submits a quote
  async submitQuote(maintenanceRequestId: string, vendorId: string, propertyId: string, totalAmount: number, notes: string, validUntil: string) {
    return await db.transaction(async (tx) => {
      const [quote] = await tx.insert(maintenanceQuotes).values({
        maintenanceRequestId,
        vendorId,
        propertyId,
        totalAmount: totalAmount.toString(),
        notes,
        validUntil,
        status: 'PENDING_APPROVAL'
      }).returning();
      
      // Update request status
      await tx.update(maintenanceRequests)
        .set({ status: 'QUOTE_RECEIVED', updatedAt: new Date() })
        .where(eq(maintenanceRequests.id, maintenanceRequestId));
        
      return quote;
    });
  }

  // Owner/Manager approves a quote, which generates a work order
  async approveQuote(quoteId: string) {
    return await db.transaction(async (tx) => {
      // 1. Mark quote as APPROVED
      const [quote] = await tx.update(maintenanceQuotes)
        .set({ status: 'APPROVED' })
        .where(eq(maintenanceQuotes.id, quoteId))
        .returning();

      if (!quote) throw new Error("Quote not found");

      // 2. Update request status
      await tx.update(maintenanceRequests)
        .set({ status: 'WORK_ORDER_CREATED', updatedAt: new Date() })
        .where(eq(maintenanceRequests.id, quote.maintenanceRequestId));

      // 3. Create Work Order
      const [workOrder] = await tx.insert(workOrders).values({
        maintenanceRequestId: quote.maintenanceRequestId,
        quoteId: quote.id,
        vendorId: quote.vendorId,
        propertyId: quote.propertyId,
        status: 'SCHEDULED'
      }).returning();

      return workOrder;
    });
  }
  
  async getQuotesByRequestId(requestId: string) {
    return await db.select().from(maintenanceQuotes).where(eq(maintenanceQuotes.maintenanceRequestId, requestId));
  }
  async getWorkOrdersByRequestId(requestId: string) {
    return await db.select().from(workOrders).where(eq(workOrders.maintenanceRequestId, requestId));
  }

  async getWorkOrdersByProperty(propertyId: string) {
    return await db.select().from(workOrders).where(eq(workOrders.propertyId, propertyId));
  }
  
  async completeWorkOrder(workOrderId: string, inspectionPassed: boolean, inspectorId: string) {
    return await db.transaction(async (tx) => {
      // 1. Inspect
      const [wo] = await tx.select().from(workOrders).where(eq(workOrders.id, workOrderId));
      if (!wo) throw new Error("Work order not found");
      
      await tx.insert(inspections).values({
        workOrderId,
        propertyId: wo.propertyId,
        inspectorId,
        status: inspectionPassed ? 'PASSED' : 'FAILED',
        findings: inspectionPassed ? 'Work looks good.' : 'Rework needed.'
      });
      
      // 2. Mark complete if passed
      if (inspectionPassed) {
        await tx.update(workOrders).set({ status: 'COMPLETED', actualEndDate: new Date().toISOString() }).where(eq(workOrders.id, workOrderId));
        await tx.update(maintenanceRequests).set({ status: 'COMPLETED', updatedAt: new Date() }).where(eq(maintenanceRequests.id, wo.maintenanceRequestId));
      }
      
      return wo;
    });
  }
}

export const maintenanceRepository = new MaintenanceRepository();
