import { Router } from 'express';
import { requireAuth, requirePropertyPermission } from '../middleware/auth.js';
import { Permission, LeaseStatus, PaymentStatus } from '../../types/index.js';
import { auditService } from '../services/audit.js';
import { leaseRepository } from '../repositories/leases.js';
import { db } from '../../db/index.js';
import { leases, leaseTenants, properties, units, rentSchedules, paymentRecords, commissions, organizationMembers, auditLogs } from '../../db/schema.js';
import { CompanyRole } from '../../types/index.js';
import { eq, and } from 'drizzle-orm';
import { commissionService } from '../services/commission.js';

import { requireDatabase } from '../middleware/dbGuard.js';

const router = Router();

const checkDbConfig = requireDatabase;

// ==========================================
// LEASE MANAGEMENT
// ==========================================

// Get My Leases (For Tenant)
router.get('/my-leases', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const tenantId = req.user!.id;
    // Join leaseTenants -> leases -> properties & units
    const records = await db.select({
      lease: leases,
      property: properties,
      unit: units
    })
    .from(leaseTenants)
    .innerJoin(leases, eq(leaseTenants.leaseId, leases.id))
    .innerJoin(properties, eq(leases.propertyId, properties.id))
    .leftJoin(units, eq(leases.unitId, units.id))
    .where(eq(leaseTenants.tenantId, tenantId));

    // For each lease, maybe fetch the next rent schedule
    for (const record of records) {
      const upcoming = await db.query.rentSchedules.findFirst({
        where: and(eq(rentSchedules.leaseId, record.lease.id), eq(rentSchedules.status, 'UPCOMING')),
        orderBy: (schedules, { asc }) => [asc(schedules.dueDate)]
      });
      (record as any).nextRent = upcoming;
    }

    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
});

// Create Lease
router.post('/', requireAuth, checkDbConfig, requirePropertyPermission(Permission.MANAGE_LEASES), async (req, res) => {
  try {
    const { propertyId, unitId, tenantIds, startDate, endDate, rentAmount, currency } = req.body;
    if (!propertyId || !startDate || !endDate || !rentAmount || !tenantIds || tenantIds.length === 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing required fields" });
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Start date must be before end date" });
    }

    const lease = await leaseRepository.createLease(propertyId, unitId, tenantIds, startDate, endDate, rentAmount, currency);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_LEASE',
      resourceType: 'Lease',
      resourceId: lease.id as string,
      changes: { propertyId, unitId, status: LeaseStatus.DRAFT },
      ipAddress: (req.ip || "") as string
    });

    res.status(201).json(lease);
  } catch (error: any) {
    res.status(400).json({ error: "BAD_REQUEST", message: error.message });
  }
});

// Activate Lease
router.post('/:leaseId/activate', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const { leaseId } = req.params;
    
    // Authorization Check
    const { ownerRepository } = await import('../repositories/owner.js');
    const [leaseRecord] = await db.select().from(leases).where(eq(leases.id, leaseId as string)).limit(1);
    
    if (!leaseRecord) {
      return res.status(404).json({ error: "BAD_REQUEST", message: "Lease not found" });
    }
    
    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      leaseRecord.propertyId,
      Permission.MANAGE_LEASES
    );
    
    if (!hasPermission) {
      return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Forbidden: You lack required permissions for this resource." });
    }

    if (leaseRecord.status === LeaseStatus.PENDING_APPROVAL) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: Lease is awaiting owner approval and cannot be activated directly."
      });
    }

    const activeLease = await leaseRepository.activateLease(leaseId as string);
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'ACTIVATE_LEASE',
      resourceType: 'Lease',
      resourceId: leaseId as string,
      changes: { status: LeaseStatus.ACTIVE },
      ipAddress: (req.ip || "") as string
    });

    res.json(activeLease);
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORIZATION_ERROR') ||
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('FORBIDDEN')
    ) {
      return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: error.message });
    }
    if (
      error.message?.includes('VALIDATION_ERROR') ||
      error.message?.includes('Cannot activate lease')
    ) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: error.message });
    }
    res.status(400).json({ error: "BAD_REQUEST", message: error.message });
  }
});

// Get Rent Schedule for a lease
router.get('/:leaseId/schedule', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const { leaseId } = req.params;
    
    const [leaseRecord] = await db.select().from(leases).where(eq(leases.id, leaseId as string)).limit(1);
    if (!leaseRecord) {
       return res.status(404).json({ error: "NOT_FOUND", message: "Lease not found" });
    }

    let hasPermission = false;
    
    // Check if user is a tenant on this lease
    if (req.user!.roles.includes('TENANT')) {
        const [tenantLink] = await db.select().from(leaseTenants).where(and(
            eq(leaseTenants.leaseId, leaseId as string),
            eq(leaseTenants.tenantId, req.user!.id)
        )).limit(1);
        if (tenantLink) {
            hasPermission = true;
        }
    }
    
    // If not a tenant on the lease, check property permission
    if (!hasPermission) {
        const { ownerRepository } = await import('../repositories/owner.js');
        hasPermission = await ownerRepository.verifyPropertyPermission(
            req.user!,
            leaseRecord.propertyId,
            Permission.VIEW_FINANCIALS
        );
    }
    
    if (!hasPermission) {
        return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Forbidden: You lack required permissions for this resource." });
    }

    const schedule = await db.query.rentSchedules.findMany({
      where: eq(rentSchedules.leaseId, leaseId as string),
      orderBy: (schedules, { asc }) => [asc(schedules.dueDate)]
    });
    res.json(schedule);
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Record a Payment
router.post('/payments', requireAuth, checkDbConfig, requirePropertyPermission(Permission.COLLECT_RENT), async (req, res) => {
  try {
    const { propertyId, leaseId, payerId, rentScheduleId, amount, paymentMethod, referenceNumber, collectorId, currency } = req.body;
    let finalPayerId = payerId;
    if (!finalPayerId || finalPayerId === 'user_tenant_01') {
      const [tenantRel] = await db.select().from(leaseTenants).where(eq(leaseTenants.leaseId, leaseId as string)).limit(1);
      if (tenantRel) {
        finalPayerId = tenantRel.tenantId;
      }
    }

    if (!propertyId || !finalPayerId || !amount) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Missing required payment fields" });
    }

    if (rentScheduleId) {
       const [schedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, rentScheduleId)).limit(1);
       if (schedule) {
         const pendingPayments = await db.select({ amount: paymentRecords.amount })
           .from(paymentRecords)
           .where(and(
             eq(paymentRecords.rentScheduleId, schedule.id),
             eq(paymentRecords.status, 'RECORDED')
           ));
         const pendingRecordedAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
         const currentConfirmedPaid = Number(schedule.paidAmount || 0);
         const totalCommitted = currentConfirmedPaid + pendingRecordedAmount + Number(amount);
         if (totalCommitted > Number(schedule.amount)) {
           return res.status(400).json({ error: "VALIDATION_ERROR", message: "Payment amount exceeds remaining rent due" });
         }
       }
    }

    if (collectorId && collectorId !== req.user!.id) {
       if (!req.user!.organizationId) {
         return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Only company members can specify a distinct collectorId" });
       }
       const [member] = await db.select().from(organizationMembers).where(
         and(
           eq(organizationMembers.userId, collectorId),
           eq(organizationMembers.organizationId, req.user!.organizationId),
           eq(organizationMembers.status, 'ACTIVE')
         )
       ).limit(1);
       if (!member) {
         return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Specified collectorId is not an authorized member of your company" });
       }
       
       if (member.role !== CompanyRole.COMPANY_OWNER && member.role !== CompanyRole.COMPANY_ADMIN) {
           const assignedProperties = (member.assignedPropertyIds as string[]) || [];
           if (assignedProperties.length > 0 && !assignedProperties.includes(propertyId)) {
               return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Collector is not assigned to this property" });
           }
           if (member.role === CompanyRole.MAINTENANCE_MANAGER || member.role === CompanyRole.VIEWER) {
               return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Collector role is not authorized to collect rent" });
           }
       }
    }

    const allowConversion = req.body.allowConversion !== undefined ? Boolean(req.body.allowConversion) : true;
    const payment = await leaseRepository.recordPayment(
      propertyId, 
      leaseId, 
      finalPayerId, 
      rentScheduleId, 
      amount, 
      paymentMethod || 'CASH', 
      referenceNumber, 
      collectorId || req.user!.id, 
      currency,
      { allowConversion }
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'RECORD_PAYMENT',
      resourceType: 'PaymentRecord',
      resourceId: payment.id as string,
      changes: { propertyId, amount, status: 'RECORDED' },
      ipAddress: (req.ip || "") as string
    });

    res.status(201).json(payment);
  } catch (error: any) {
    res.status(400).json({ error: "BAD_REQUEST", message: error.message });
  }
});

// Confirm a Payment (Cash or Eligible Digital Methods)
router.post('/payments/:paymentId/confirm', requireAuth, checkDbConfig, async (req, res, next) => {
  try {
    const paymentId = req.params.paymentId as string;
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId)).limit(1);
    if (!payment) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Payment not found" });
    }
    
    // Inject propertyId for requirePropertyPermission middleware
    req.params.propertyId = payment.propertyId;
    req.body.propertyId = payment.propertyId;
    (req as any).loadedPayment = payment;
    next();
  } catch (error: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}, requirePropertyPermission(Permission.COLLECT_RENT), async (req, res) => {
  try {
    const payment = (req as any).loadedPayment;
    
    // Idempotency: if already confirmed
    if (payment.status === 'CONFIRMED') {
      // Self-healing: if status is confirmed but commission failed previously
      const existingCommissions = await db.select().from(commissions).where(eq(commissions.paymentRecordId, payment.id)).limit(1);
      if (existingCommissions.length === 0) {
        const commissionResult = await commissionService.postCommissionForPayment(payment.id, req.user!.id, req.user!.roles[0]);
        return res.json({ message: "Recovered missing commission", payment, commission: commissionResult });
      }
      return res.json({ message: "Payment is already confirmed", payment });
    }

    // Verify eligible for confirmation
    if (payment.status !== 'RECORDED') {
      return res.status(400).json({ error: "INVALID_STATE", message: "Only RECORDED payments can be confirmed" });
    }
    const SUPPORTED_MANUAL_CONFIRMATION_METHODS = ['CASH', 'FIB', 'FASTPAY', 'ZAINCASH', 'BANK_TRANSFER'] as const;
    if (!payment.paymentMethod || !SUPPORTED_MANUAL_CONFIRMATION_METHODS.includes(payment.paymentMethod as any)) {
      return res.status(400).json({ 
        error: "INVALID_METHOD", 
        message: `Payment method '${payment.paymentMethod}' is not supported for manual confirmation` 
      });
    }

    const effectiveReference = (req.body?.referenceNumber || payment.referenceNumber || '').trim();
    if (payment.paymentMethod !== 'CASH' && !effectiveReference) {
      return res.status(400).json({ 
        error: "MISSING_VERIFICATION_EVIDENCE", 
        message: "Digital payment confirmation requires a valid transaction reference number" 
      });
    }

    // Transactional confirmation via authoritative leaseRepository
    const confirmedPayment = await leaseRepository.confirmPayment(
      payment.id, 
      req.user!.id,
      effectiveReference ? { referenceNumber: effectiveReference } : undefined
    );

    // 2. Trigger Commission Posting
    const commissionResult = await commissionService.postCommissionForPayment(
      confirmedPayment.id,
      req.user!.id,
      req.user!.roles[0] as string
    );

    // 3. Audit Log
    const auditAction = payment.paymentMethod === 'CASH' ? 'CONFIRM_CASH_PAYMENT' : 'CONFIRM_DIGITAL_PAYMENT';
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: auditAction,
      resourceType: 'PaymentRecord',
      resourceId: confirmedPayment.id as string,
      changes: { 
        status: 'CONFIRMED', 
        confirmedByUserId: req.user!.id,
        paymentMethod: confirmedPayment.paymentMethod,
        referenceNumber: confirmedPayment.referenceNumber,
        commissionAmount: commissionResult.calculation?.totalFeeAmount || 0 
      },
      ipAddress: (req.ip || "") as string
    });

    res.json({ payment: confirmedPayment, commission: commissionResult });
  } catch (error: any) {
    res.status(400).json({ error: "BAD_REQUEST", message: error.message });
  }
});

// Reverse a Payment
function isTestFailureInjectionAllowed(): boolean {
  return process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_FAILURE_INJECTION === 'true';
}

router.post('/payments/:paymentId/reverse', requireAuth, checkDbConfig, async (req, res, next) => {
  try {
    const paymentId = req.params.paymentId as string;
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId)).limit(1);
    if (!payment) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Payment not found" });
    }
    req.params.propertyId = payment.propertyId;
    req.body.propertyId = payment.propertyId;
    (req as any).loadedPayment = payment;
    next();
  } catch(error: any) {
    res.status(500).json({ error: "INTERNAL_ERROR", message: error.message });
  }
}, requirePropertyPermission(Permission.MANAGE_FINANCIALS), async (req, res) => {
  try {
    const payment = (req as any).loadedPayment;
    const { reason, _simulateFailure } = req.body;
    if (!reason) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "Reversal reason is required" });
    }

    if (payment.status === 'REVERSED') {
      const recoveryResult = await db.transaction(async (tx) => {
        // 1. Serialize recovery by acquiring an exclusive row-level lock on the payment record
        const [lockedPayment] = await tx.select().from(paymentRecords)
          .where(eq(paymentRecords.id, payment.id))
          .limit(1)
          .for('update');

        if (!lockedPayment) {
          throw new Error(`Payment record not found: ${payment.id}`);
        }

        // 2. Check commission reversal status
        let commissionReversal: any = null;
        let recoveredCommission = false;
        const existingCommissions = await tx.select().from(commissions)
          .where(eq(commissions.paymentRecordId, lockedPayment.id))
          .limit(1);

        if (existingCommissions.length > 0 && existingCommissions[0].status !== 'REVERSED') {
          commissionReversal = await commissionService.reverseCommissionForPayment(
            lockedPayment.id,
            reason,
            req.user!.id,
            req.user!.roles[0],
            tx
          );
          recoveredCommission = true;
        }

        // 3. Independent check for missing REVERSE_PAYMENT audit record
        let recoveredAudit = false;
        const existingAudit = await tx.select().from(auditLogs).where(and(
          eq(auditLogs.resourceType, 'PaymentRecord'),
          eq(auditLogs.resourceId, lockedPayment.id),
          eq(auditLogs.action, 'REVERSE_PAYMENT')
        )).limit(1);

        if (existingAudit.length === 0) {
          // Check if an authoritative fee reversal audit exists to preserve original reason/details
          let originalReason = reason;
          let originalActorUserId: string | undefined;
          let originalActorRole: string | undefined;
          let originalTimestamp: string | undefined;

          if (existingCommissions.length > 0) {
            const [feeAudit] = await tx.select().from(auditLogs).where(and(
              eq(auditLogs.resourceType, 'Commission'),
              eq(auditLogs.resourceId, existingCommissions[0].id),
              eq(auditLogs.action, 'HOMEHUB_FEES_REVERSED')
            )).limit(1);

            if (feeAudit) {
              if (feeAudit.changes && typeof feeAudit.changes === 'object' && (feeAudit.changes as any).reason) {
                originalReason = (feeAudit.changes as any).reason;
              }
              originalActorUserId = feeAudit.actorUserId;
              originalActorRole = feeAudit.actorRole;
              originalTimestamp = feeAudit.timestamp instanceof Date ? feeAudit.timestamp.toISOString() : (feeAudit.timestamp ? String(feeAudit.timestamp) : undefined);
            }
          }

          await auditService.logAction({
            actorUserId: req.user!.id,
            actorRole: req.user!.roles[0] as string,
            action: 'REVERSE_PAYMENT',
            resourceType: 'PaymentRecord',
            resourceId: lockedPayment.id as string,
            changes: {
              status: 'REVERSED',
              reason: originalReason || reason,
              originalStatus: lockedPayment.status,
              recovered: true,
              recoveringActorUserId: req.user!.id,
              recoveringActorRole: req.user!.roles[0] as string,
              ...(originalActorUserId ? {
                originalReversalActorUserId: originalActorUserId,
                originalReversalActorRole: originalActorRole,
                originalReversalTimestamp: originalTimestamp,
              } : {}),
            },
            ipAddress: (req.ip || "") as string,
            tx,
          });
          recoveredAudit = true;
        }

        // 4. Verify rent schedule invariant: CANCELLED schedules must remain CANCELLED
        if (lockedPayment.rentScheduleId) {
          const [schedule] = await tx.select().from(rentSchedules)
            .where(eq(rentSchedules.id, lockedPayment.rentScheduleId))
            .limit(1)
            .for('update');

          if (schedule && schedule.status === 'CANCELLED') {
            const remainingConfirmed = await tx.select({ amount: paymentRecords.amount })
              .from(paymentRecords)
              .where(and(
                eq(paymentRecords.rentScheduleId, lockedPayment.rentScheduleId),
                eq(paymentRecords.status, 'CONFIRMED')
              ));

            const confirmedPaidAmount = remainingConfirmed.reduce(
              (sum, p) => sum + Number(p.amount || 0),
              0
            );

            if (Number(schedule.paidAmount) !== confirmedPaidAmount) {
              await tx.update(rentSchedules)
                .set({ paidAmount: confirmedPaidAmount.toString() })
                .where(eq(rentSchedules.id, schedule.id));
            }
          }
        }

        return {
          payment: lockedPayment,
          commissionReversal,
          recoveredCommission,
          recoveredAudit,
        };
      });

      if (recoveryResult.recoveredCommission || recoveryResult.recoveredAudit) {
        return res.json({
          message: "Recovered missing reversal data",
          payment: recoveryResult.payment,
          commissionReversal: recoveryResult.commissionReversal,
          recoveredCommission: recoveryResult.recoveredCommission,
          recoveredAudit: recoveryResult.recoveredAudit,
        });
      }

      return res.json({ message: "Payment is already reversed", payment: recoveryResult.payment });
    }

    if (payment.status !== 'CONFIRMED' && payment.status !== 'RECORDED') {
      return res.status(400).json({ error: "INVALID_STATE", message: "Only CONFIRMED or RECORDED payments can be reversed" });
    }

    const { reversedPayment, commissionReversal } = await db.transaction(async (tx) => {
      const [updated] = await tx.update(paymentRecords)
        .set({ status: 'REVERSED' })
        .where(and(eq(paymentRecords.id, payment.id), eq(paymentRecords.status, payment.status)))
        .returning();

      if (!updated) {
        throw new Error(`Payment was modified concurrently. updated: ${updated}`);
      }

      if (updated.rentScheduleId) {
        const [schedule] = await tx.select().from(rentSchedules).where(eq(rentSchedules.id, updated.rentScheduleId)).limit(1).for('update');
        if (schedule) {
          const remainingConfirmed = await tx.select({ amount: paymentRecords.amount })
            .from(paymentRecords)
            .where(and(
              eq(paymentRecords.rentScheduleId, updated.rentScheduleId),
              eq(paymentRecords.status, 'CONFIRMED')
            ));

          const confirmedPaidAmount = remainingConfirmed.reduce(
            (sum, p) => sum + Number(p.amount || 0),
            0
          );

          let newStatus = schedule.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING';
          
          if (schedule.status !== 'CANCELLED') {
              if (confirmedPaidAmount > 0) {
                  newStatus = confirmedPaidAmount >= Number(schedule.amount) ? 'PAID' : 'PARTIALLY_PAID';
              } else {
                  const now = new Date();
                  const dueDate = new Date(schedule.dueDate);
                  newStatus = dueDate < now ? 'OVERDUE' : 'UPCOMING';
              }
          }
          
          await tx.update(rentSchedules)
            .set({ paidAmount: confirmedPaidAmount.toString(), status: newStatus })
            .where(eq(rentSchedules.id, schedule.id));
        }
      }

      // Test failure injection hook for atomic rollback verification (strictly test-mode only)
      if (isTestFailureInjectionAllowed() && _simulateFailure === 'COMMISSION_FAILURE') {
        throw new Error("SIMULATED_COMMISSION_FAILURE: Test failure injection");
      }

      let commRev = null;
      if (payment.status === 'CONFIRMED') {
        commRev = await commissionService.reverseCommissionForPayment(
          payment.id,
          reason,
          req.user!.id,
          req.user!.roles[0],
          tx
        );
      }

      // Test failure injection hook for audit-log atomic rollback verification (strictly test-mode only)
      if (isTestFailureInjectionAllowed() && _simulateFailure === 'AUDIT_FAILURE') {
        throw new Error("SIMULATED_AUDIT_FAILURE: Test failure injection");
      }

      await auditService.logAction({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles[0] as string,
        action: 'REVERSE_PAYMENT',
        resourceType: 'PaymentRecord',
        resourceId: payment.id as string,
        changes: { status: 'REVERSED', reason, originalStatus: payment.status },
        ipAddress: (req.ip || "") as string,
        tx,
      });

      return { reversedPayment: updated, commissionReversal: commRev };
    });

    res.json({ payment: reversedPayment, commissionReversal });
  } catch (error: any) {
    res.status(400).json({ error: "BAD_REQUEST", message: error.message });
  }
});

router.post('/move-out/:id/approve', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const { moveOutRequests } = await import('../../db/schema.js') as any;
    const [request] = await db.select().from(moveOutRequests).where(eq(moveOutRequests.id, req.params.id as any)).limit(1);
    
    if (!request) {
      return res.status(404).json({ error: "Move-out request not found" });
    }

    const { ownerRepository } = await import('../repositories/owner.js');
    const hasPermission = await ownerRepository.verifyPropertyPermission(req.user!, request.propertyId, Permission.MANAGE_LEASES);
    if (!hasPermission) {
      return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Forbidden" });
    }

    const updated = await leaseRepository.approveMoveOut(request.id, req.user);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/renewals/:id/approve', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const { leaseRenewals } = await import('../../db/schema.js') as any;
    const [renewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, req.params.id as any)).limit(1);
    
    if (!renewal) {
      return res.status(404).json({ error: "Renewal not found" });
    }

    const { ownerRepository } = await import('../repositories/owner.js');
    const hasPermission = await ownerRepository.verifyPropertyPermission(req.user!, renewal.propertyId, Permission.MANAGE_LEASES);
    if (!hasPermission) {
      return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Forbidden" });
    }

    // Authoritative role resolution for multi-role personas (prioritize the role granting MANAGE_LEASES)
    const roles: string[] = req.user!.roles || [];
    let actorRole = 'USER';
    if (roles.includes('SUPER_ADMIN')) actorRole = 'SUPER_ADMIN';
    else if (roles.includes('PLATFORM_ADMIN')) actorRole = 'PLATFORM_ADMIN';
    else if (roles.includes('PROPERTY_OWNER')) actorRole = 'PROPERTY_OWNER';
    else if (roles.includes('COMPANY')) actorRole = 'COMPANY';
    else if (roles.includes('COMPANY_MEMBER')) actorRole = 'COMPANY_MEMBER';
    else if (roles.includes('AGENT_BROKER') || roles.includes('AGENT')) actorRole = 'AGENT_BROKER';
    else if (roles.length > 0) actorRole = roles[0];

    const updated = await leaseRepository.approveRenewal(renewal.id, {
      actorUserId: req.user!.id,
      actorRole,
      ipAddress: (req.ip || "") as string,
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/renewals/:id/reject', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const { leaseRenewals } = await import('../../db/schema.js') as any;
    const [renewal] = await db.select().from(leaseRenewals).where(eq(leaseRenewals.id, req.params.id as any)).limit(1);
    
    if (!renewal) {
      return res.status(404).json({ error: "Renewal not found" });
    }

    const { ownerRepository } = await import('../repositories/owner.js');
    const hasPermission = await ownerRepository.verifyPropertyPermission(req.user!, renewal.propertyId, Permission.MANAGE_LEASES);
    if (!hasPermission) {
      return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Forbidden: You do not have permission to manage leases for this property." });
    }

    const { ownerNotes } = req.body || {};
    const roles: string[] = req.user!.roles || [];
    let actorRole = 'USER';
    if (roles.includes('SUPER_ADMIN')) actorRole = 'SUPER_ADMIN';
    else if (roles.includes('PLATFORM_ADMIN')) actorRole = 'PLATFORM_ADMIN';
    else if (roles.includes('PROPERTY_OWNER')) actorRole = 'PROPERTY_OWNER';
    else if (roles.includes('COMPANY')) actorRole = 'COMPANY';
    else if (roles.includes('COMPANY_MEMBER')) actorRole = 'COMPANY_MEMBER';
    else if (roles.includes('AGENT_BROKER') || roles.includes('AGENT')) actorRole = 'AGENT_BROKER';
    else if (roles.length > 0) actorRole = roles[0];

    const updated = await leaseRepository.rejectRenewal(renewal.id, ownerNotes, {
      actorUserId: req.user!.id,
      actorRole,
      ipAddress: (req.ip || "") as string,
    });

    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/payments/:id/receipt', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, req.params.id as any)).limit(1);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Tenant check
    let hasPermission = req.user!.id === payment.payerId;
    
    // Owner / Management check
    if (!hasPermission) {
      const { ownerRepository } = await import('../repositories/owner.js');
      hasPermission = await ownerRepository.verifyPropertyPermission(req.user!, payment.propertyId, Permission.VIEW_FINANCIALS);
    }

    if (!hasPermission) {
      return res.status(403).json({ error: "AUTHORIZATION_ERROR", message: "Forbidden" });
    }

    res.json({
      receiptNumber: payment.receiptNumber || (payment.status === 'CONFIRMED' ? `#RCP-${payment.id.slice(0, 6).toUpperCase()}` : null),
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      date: payment.recordedDate,
      status: payment.status,
      payerId: payment.payerId,
      propertyId: payment.propertyId,
      referenceNumber: payment.referenceNumber
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
