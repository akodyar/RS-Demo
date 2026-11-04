import { Router, Request, Response } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requireRole, requireActiveRole } from '../middleware/auth.js';
import { tenantRepository } from '../repositories/tenant.js';
import { UserRole } from '../../types/index.js';
import { db } from '../../db/index.js';
import { documents, conversations, notifications, leases, leaseTenants, paymentRecords, maintenanceRequests, securityDeposits, rentSchedules } from '../../db/schema.js';
import { eq, and, desc, inArray, gte } from 'drizzle-orm';
import { auditService } from '../services/audit.js';
import { moveOutInspectionService } from '../services/move-out-inspection.js';
import { securityDepositDeductionService } from '../services/security-deposit-deduction.js';
import { maintenanceRepository } from '../repositories/maintenance.js';
import { financeService } from '../services/finance.js';
import { convertCurrency } from '../../utils/formatters.js';

const router = Router();

export const ALLOWED_TENANT_WORKSPACE_ROLES: (UserRole | string)[] = [
  UserRole.TENANT,
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
];

// Router boundary guard: strictly enforce authentication and active workspace context
router.use(requireAuth);
router.use(requireActiveRole(ALLOWED_TENANT_WORKSPACE_ROLES));

const ALLOWED_TENANT_ROLES: (UserRole | string)[] = [
  UserRole.TENANT,
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
];



const failClosedDbResponse = (res: Response) => {
  return res.status(503).json({
    error: 'DATABASE_NOT_CONFIGURED',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The authoritative relational storage service is unconfigured in this environment. Fail-closed enforced.',
  });
};

const requireActiveLease = async (req: Request, res: Response, next: import('express').NextFunction) => {
  try {
    const tenantUserId = req.user!.id;
    const activeLeases = await db.select()
      .from(leaseTenants)
      .innerJoin(leases, eq(leaseTenants.leaseId, leases.id))
      .where(and(
        eq(leaseTenants.tenantId, tenantUserId),
        inArray(leases.status, ['ACTIVE', 'EXPIRING'])
      )).limit(1);

    if (activeLeases.length === 0) {
      return res.status(403).json({ error: 'NO_ACTIVE_LEASE', message: 'You do not have an active lease.' });
    }
    next();
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify active lease' });
  }
};

/**
 * GET /api/tenant/dashboard
 * Aggregated dashboard payload strictly derived from authoritative relational schema.
 */
router.get('/dashboard', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  try {
    const tenantUserId = req.user!.id;
    const dashboardData = await tenantRepository.getAuthoritativeDashboard(tenantUserId);
    res.json(dashboardData);
  } catch (error: any) {
    console.error('[Tenant Dashboard Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve tenant dashboard' });
  }
});

/**
 * GET /api/tenant/onboarding-status
 * Prospective/onboarding payload: applications and pending lease offers.
 * Explicitly accessible to authenticated tenants without requiring an active lease.
 */
router.get('/onboarding-status', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const tenantUserId = req.user!.id;
    const data = await tenantRepository.getTenantOnboardingData(tenantUserId);
    res.json(data);
  } catch (error: any) {
    console.error('[Tenant Onboarding Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve tenant onboarding status' });
  }
});

/**
 * GET /api/tenant/applications
 * Retrieves tenant's submitted rental applications.
 */
router.get('/applications', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const tenantUserId = req.user!.id;
    const data = await tenantRepository.getTenantOnboardingData(tenantUserId);
    res.json(data.applications);
  } catch (error: any) {
    console.error('[Tenant Applications Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve applications' });
  }
});


/**
 * POST /api/tenant/payments/pay-rent
 * Executes rent payment and triggers HomeHub platform fee posting.
 * Supports dual-currency payments (USD <-> IQD) when allowConversion is specified.
 */
router.post('/payments/pay-rent', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  
  try {
    const { propertyId, leaseId, scheduleId, amount, currency, paymentMethod, referenceNumber, allowConversion } = req.body;
    if (!propertyId || !leaseId || !amount) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing propertyId, leaseId, or amount' });
    }

    const result = await tenantRepository.recordRentPayment(req.user!.id, {
      propertyId,
      leaseId,
      scheduleId,
      amount: Number(amount),
      currency: currency || undefined,
      paymentMethod: paymentMethod || 'FIB',
      referenceNumber,
      allowConversion: Boolean(allowConversion),
    });

    res.status(201).json({
      success: true,
      payment: result.payment,
      commissionPosted: !result.commission.alreadyPosted,
      commissionAmount: result.commission.calculation.commissionAmount,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_TENANT_LEASE_ACCESS' || error.message === 'UNAUTHORIZED_SCHEDULE_ACCESS') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to pay for this lease or schedule.' });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tenant/payments/conversion-quote
 * Returns real-time dual-currency conversion quote for a rent schedule.
 */
router.get('/payments/conversion-quote', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const { scheduleId, targetCurrency } = req.query;
    if (!scheduleId || !targetCurrency) {
      return res.status(400).json({ error: 'Missing scheduleId or targetCurrency' });
    }

    const [schedule] = await db.select().from(rentSchedules).where(eq(rentSchedules.id, String(scheduleId))).limit(1);
    if (!schedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    const exchangeRate = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD', 1310);
    const scheduleCurrency = (schedule.currency || 'IQD').toUpperCase();
    const tCur = String(targetCurrency).toUpperCase();

    const remainingDue = Math.max(0, Number(schedule.amount) - Number(schedule.paidAmount || 0));
    const convertedAmount = convertCurrency(remainingDue, scheduleCurrency, tCur, exchangeRate);

    res.json({
      scheduleId: schedule.id,
      scheduleCurrency,
      remainingDue,
      targetCurrency: tCur,
      exchangeRate,
      convertedAmount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tenant/maintenance
 * Reports a new maintenance issue.
 */
router.post('/maintenance', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  
  try {
    const { propertyId, unitId, category, priority, title, description } = req.body;
    if (!propertyId || !category || !title || !description) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing required maintenance fields' });
    }

    const request = await tenantRepository.createMaintenanceRequest(req.user!.id, {
      propertyId,
      unitId,
      category,
      priority: priority || 'NORMAL',
      title,
      description,
    });

    res.status(201).json(request);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_PROPERTY_MAINTENANCE_ACCESS') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only request maintenance for properties you occupy.' });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tenant/lease/renew
 * Initiates a lease renewal request.
 */
router.post('/lease/renew', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  
  try {
    const { leaseId, propertyId, proposedStartDate, proposedEndDate, proposedRentAmount, tenantNotes } = req.body;
    if (!leaseId || !propertyId || !proposedStartDate || !proposedEndDate) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing required renewal dates' });
    }

    const renewal = await tenantRepository.requestLeaseRenewal(req.user!.id, {
      leaseId,
      propertyId,
      proposedStartDate,
      proposedEndDate,
      proposedRentAmount,
      tenantNotes,
    });

    res.status(201).json(renewal);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_LEASE_RENEWAL_ACCESS') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to renew this lease.' });
    }
    res.status(400).json({ error: error.message, message: error.message });
  }
});

/**
 * POST /api/tenant/lease/move-out
 * Initiates a move-out request.
 */
router.post('/lease/move-out', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  
  try {
    const { leaseId, propertyId, requestedMoveOutDate, reason, forwardingAddress } = req.body;
    if (!leaseId || !propertyId || !requestedMoveOutDate) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing requested move-out date' });
    }

    const moveOut = await tenantRepository.requestMoveOut(req.user!.id, {
      leaseId,
      propertyId,
      requestedMoveOutDate,
      reason,
      forwardingAddress,
    });

    res.status(201).json(moveOut);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED_MOVE_OUT_ACCESS') {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to request move-out for this lease.' });
    }
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tenant/ai/assist
 * Tenant AI Assistant with strict tenant-scoped context.
 */
router.post('/ai/assist', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Query is required' });
    }

    const response = await tenantRepository.getTenantAIAssist(req.user!.id, query);
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/tenant/deposits
 * Security deposit details and segregation from rent.
 */
router.get('/deposits', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  try {
    const deposits = await tenantRepository.getTenantDeposits(req.user!.id);
    res.json(deposits);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tenant/lease/:leaseId/accept
 * Tenant executes acceptance of an offered lease.
 */
router.post('/lease/:leaseId/accept', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const leaseId = String(req.params.leaseId);
    const acceptedLease = await tenantRepository.acceptLeaseOffer(req.user!.id, leaseId);
    res.json({ success: true, lease: acceptedLease });
  } catch (error: any) {
    if (
      error.message === 'UNAUTHORIZED_TENANT_LEASE_ACCESS' ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('AUTHORIZATION')
    ) {
      return res.status(403).json({ error: 'FORBIDDEN', message: error.message || 'You are not authorized to accept this lease.' });
    }
    res.status(400).json({ error: error.message });
  }
});

import { utilityBillRepository } from '../repositories/utility-bills.js';

/**
 * GET /api/tenant/utility-bills
 */
router.get('/utility-bills', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  try {
    const bills = await utilityBillRepository.getTenantBills(req.user!.id);
    res.json(bills);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/tenant/utility-bills/:id/pay
 * Direct payment
 */
router.post('/utility-bills/:id/pay', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  try {
    const { amount, paymentMethod } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid amount is required' });
    }

    // Verify tenant authorization (ensure this bill belongs to the tenant)
    const bills = await utilityBillRepository.getTenantBills(req.user!.id);
    const bill = bills.find(b => b.id === req.params.id);
    if (!bill) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to pay this bill.' });
    }

    const billId = String(req.params.id);
    const result = await utilityBillRepository.payBill(billId, Number(amount), paymentMethod || 'SYSTEM', req.user!.id);
    res.status(200).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/tenant/maintenance
 * Tenant submits a maintenance request
 */
router.post('/maintenance', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, requireActiveLease, async (req: Request, res: Response) => {
  try {
    const { propertyId, unitId, category, priority, title, description } = req.body;
    if (!title || !description || !category || !priority) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing required maintenance fields' });
    }

    let targetPropertyId = propertyId;
    if (!targetPropertyId) {
      const active = await tenantRepository.getActiveLease(req.user!.id);
      if (active) targetPropertyId = active.propertyId;
    }

    if (!targetPropertyId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Property ID is required' });
    }

    // Verify tenant occupancy on this property
    const todayStr = new Date().toISOString().slice(0, 10);
    const tenantOccupancy = await db.select({
      leaseId: leases.id
    })
      .from(leases)
      .innerJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
      .where(and(
        eq(leaseTenants.tenantId, req.user!.id),
        eq(leases.propertyId, targetPropertyId),
        inArray(leases.status, ['ACTIVE', 'EXPIRING']),
        gte(leases.endDate, todayStr)
      )).limit(1);

    if (tenantOccupancy.length === 0) {
      return res.status(403).json({
        error: 'AUTHORIZATION_ERROR',
        message: 'Forbidden: You are not authorized to submit maintenance requests for this property.'
      });
    }

    const request = await maintenanceRepository.createRequest(
      req.user!.id,
      targetPropertyId,
      unitId || null,
      category,
      priority,
      title,
      description
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: 'TENANT',
      action: 'CREATE_MAINTENANCE_REQUEST',
      resourceType: 'MaintenanceRequest',
      resourceId: request.id as string,
      changes: { propertyId: targetPropertyId, title },
      ipAddress: (req.ip || '') as string
    });

    res.status(201).json(request);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/tenant/maintenance
 * Get maintenance requests reported by this tenant
 */
router.get('/maintenance', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const requests = await maintenanceRepository.getRequestsByReporter(req.user!.id);
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/* ========================================================================= */
/* TENANT MOVE-OUT INSPECTIONS & SECURITY DEPOSIT DEDUCTIONS                 */
/* ========================================================================= */

/**
 * GET /api/tenant/leases/:leaseId/inspections
 * Allows tenant to view inspections for their lease.
 */
router.get('/leases/:leaseId/inspections', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const leaseId = String(req.params.leaseId);
    const inspections = await moveOutInspectionService.getInspectionsForLease(leaseId, req.user!);
    res.json(inspections);
  } catch (error: any) {
    const msg = error.message || 'Error fetching inspections';
    if (msg.includes('ACCESS_DENIED') || msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * GET /api/tenant/inspections/:id
 * Allows tenant to view a specific inspection with items.
 */
router.get('/inspections/:id', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const inspection = await moveOutInspectionService.getInspectionWithItems(id, req.user!);
    res.json(inspection);
  } catch (error: any) {
    const msg = error.message || 'Error fetching inspection';
    if (msg.includes('ACCESS_DENIED') || msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * GET /api/tenant/leases/:leaseId/deductions
 * Allows tenant to view proposed, settled, or disputed deductions for their lease.
 */
router.get('/leases/:leaseId/deductions', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const leaseId = String(req.params.leaseId);
    const deductions = await securityDepositDeductionService.getDeductionsForLease(leaseId, req.user!);
    res.json(deductions);
  } catch (error: any) {
    const msg = error.message || 'Error fetching deductions';
    if (msg.includes('FORBIDDEN') || msg.includes('AUTHORIZATION')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * POST /api/tenant/deductions/:id/dispute
 * Allows tenant to formally dispute an approved deduction within the 30-day dispute window.
 */
router.post('/deductions/:id/dispute', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const { disputeReason, evidenceRefs } = req.body;
    if (!disputeReason || !disputeReason.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'disputeReason is required' });
    }

    const id = String(req.params.id);
    const deduction = await securityDepositDeductionService.disputeDeduction({
      deductionId: id,
      disputeReason: disputeReason.trim(),
      evidenceRefs: evidenceRefs || null,
    }, req.user!);

    res.json(deduction);
  } catch (error: any) {
    const msg = error.message || 'Error disputing deduction';
    if (msg.includes('FORBIDDEN') || msg.includes('AUTHORIZATION')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('DISPUTE_WINDOW_EXPIRED')) {
      return res.status(400).json({ error: 'DISPUTE_WINDOW_EXPIRED', message: msg });
    }
    if (msg.includes('INVALID_STATE') || msg.includes('VALIDATION_ERROR')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * GET /api/tenant/leases/:leaseId/deposit
 * Fetches authoritative security deposit for tenant's lease.
 */
router.get('/leases/:leaseId/deposit', requireAuth, requireRole(ALLOWED_TENANT_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const leaseId = String(req.params.leaseId);
    const roles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const isPlatformAdmin = roles.includes(UserRole.PLATFORM_ADMIN) || roles.includes('ADMIN');

    if (!isPlatformAdmin) {
      const tenantLinks = await db.select().from(leaseTenants).where(and(
        eq(leaseTenants.leaseId, leaseId),
        eq(leaseTenants.tenantId, req.user!.id)
      )).limit(1);

      if (tenantLinks.length === 0) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not a tenant on this lease.' });
      }
    }

    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.leaseId, leaseId)).limit(1);
    if (!deposit) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No security deposit found for this lease.' });
    }

    res.json(deposit);
  } catch (error: any) {
    res.status(500).json({ error: 'INTERNAL_ERROR', message: error.message || 'Error fetching deposit' });
  }
});

export default router;

