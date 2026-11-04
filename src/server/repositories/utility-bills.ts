import { db } from '../../db/index.js';
import { utilityBills, utilityPayments, properties, users, leases, units } from '../../db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { auditService } from '../services/audit.js';

export class UtilityBillRepository {
  async getTenantBills(tenantId: string) {
    const bills = await db.select({
      bill: utilityBills,
      property: properties,
      unit: units
    })
    .from(utilityBills)
    .leftJoin(properties, eq(utilityBills.propertyId, properties.id))
    .leftJoin(units, eq(utilityBills.unitId, units.id))
    .where(eq(utilityBills.tenantId, tenantId))
    .orderBy(desc(utilityBills.createdAt));

    return bills.map(r => ({
      ...r.bill,
      property: r.property,
      unit: r.unit
    }));
  }

  async getOwnerPropertyBills(propertyId: string, ownerId: string) {
    // We expect the caller to verify owner authorization before calling this.
    // This fetches all unpaid and partially paid bills for the property.
    const bills = await db.select({
      bill: utilityBills,
      tenant: users,
      unit: units
    })
    .from(utilityBills)
    .leftJoin(users, eq(utilityBills.tenantId, users.id))
    .leftJoin(units, eq(utilityBills.unitId, units.id))
    .where(
      and(
        eq(utilityBills.propertyId, propertyId),
        sql`${utilityBills.outstandingAmount} > 0`,
        sql`${utilityBills.status} != 'CANCELLED'`
      )
    )
    .orderBy(desc(utilityBills.dueDate));

    return bills.map(r => ({
      ...r.bill,
      tenant: r.tenant ? { id: r.tenant.id, firstName: r.tenant.firstName, lastName: r.tenant.lastName } : null,
      unit: r.unit
    }));
  }

  async createBill(data: {
    propertyId: string,
    unitId?: string,
    tenantId?: string,
    leaseId?: string,
    type: string,
    description?: string,
    amount: number | string,
    billingDate: string,
    dueDate?: string,
  }, creatorUserId: string) {
    return await db.transaction(async (tx) => {
      const [newBill] = await tx.insert(utilityBills).values({
        propertyId: data.propertyId,
        unitId: data.unitId || null,
        tenantId: data.tenantId || null,
        leaseId: data.leaseId || null,
        type: data.type,
        description: data.description || null,
        amount: String(data.amount),
        outstandingAmount: String(data.amount),
        status: 'UNPAID',
        billingDate: data.billingDate,
        dueDate: data.dueDate || null,
      }).returning();

      await auditService.logAction({
        actorUserId: creatorUserId,
        actorRole: 'admin',
        action: 'CREATE_UTILITY_BILL',
        resourceType: 'UtilityBill',
        resourceId: newBill.id,
        changes: { amount: data.amount, type: data.type },
        ipAddress: '127.0.0.1'
      });

      return newBill;
    });
  }

  async payBill(billId: string, amount: number, paymentMethod: string, payerId: string, collectorId?: string) {
    return await db.transaction(async (tx) => {
      // 1. Lock the bill record
      const [bill] = await tx.select()
        .from(utilityBills)
        .where(eq(utilityBills.id, billId))
        .for('update');
      
      if (!bill) throw new Error('Utility bill not found');
      if (bill.status === 'PAID' || bill.status === 'CANCELLED') {
        throw new Error(`Bill is already ${bill.status}`);
      }
      
      const currentOutstanding = parseFloat(bill.outstandingAmount as string);
      if (amount <= 0) throw new Error('Payment amount must be greater than zero');
      if (amount > currentOutstanding) {
        throw new Error('Payment exceeds outstanding amount');
      }

      // 2. Create the payment record
      const idempotencyKey = `pay_${billId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const [payment] = await tx.insert(utilityPayments).values({
        billId: bill.id,
        amount: String(amount),
        paymentMethod: paymentMethod,
        status: 'CONFIRMED',
        collectorId: collectorId || null,
        payerId: payerId,
        idempotencyKey,
        recordedDate: new Date().toISOString(),
      }).returning();

      // 3. Update bill outstanding amount
      const roundedOutstanding = Math.round((currentOutstanding - amount) * 100) / 100;
      const newOutstanding = Math.max(0, roundedOutstanding);
      const newStatus = newOutstanding === 0 ? 'PAID' : 'PARTIAL';

      const [updatedBill] = await tx.update(utilityBills)
        .set({
          outstandingAmount: String(newOutstanding),
          status: newStatus,
          updatedAt: new Date()
        })
        .where(eq(utilityBills.id, bill.id))
        .returning();
      
      // 4. Audit
      await auditService.logAction({
        actorUserId: collectorId || payerId,
        actorRole: collectorId ? (collectorId === payerId ? 'tenant' : 'collector') : 'tenant',
        action: 'PAY_UTILITY_BILL',
        resourceType: 'UtilityPayment',
        resourceId: payment.id,
        changes: { amount, method: paymentMethod, billId },
        ipAddress: '127.0.0.1'
      });

      return { payment, bill: updatedBill };
    });
  }
}

export const utilityBillRepository = new UtilityBillRepository();
