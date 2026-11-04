import { Router } from 'express';
import { requireAuth, requirePropertyPermission, requireRole } from '../middleware/auth.js';
import { Permission, UserRole } from '../../types/index.js';
import { maintenanceRepository } from '../repositories/maintenance.js';
import { ownerRepository } from '../repositories/owner.js';
import { auditService } from '../services/audit.js';
import { db } from '../../db/index.js';
import { maintenanceRequests, maintenanceQuotes, workOrders, leases, leaseTenants, properties, ownershipRecords } from '../../db/schema.js';
import { eq, and, or, inArray, gte } from 'drizzle-orm';
import { requireDatabase } from '../middleware/dbGuard.js';

const router = Router();

const checkDbConfig = requireDatabase;

// ==========================================
// TENANT / REPORTER ROUTES
// ==========================================

// Get my maintenance requests
router.get('/my-requests', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const requests = await maintenanceRepository.getRequestsByReporter(req.user!.id);
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a maintenance request (Tenant or Authorized Manager)
router.post('/', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const { propertyId, unitId, category, priority, title, description } = req.body;
    
    // Minimal validation
    if (!propertyId || !title || !description || !category || !priority) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify property exists
    const [property] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!property) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Property not found" });
    }

    // Authorization Check:
    // User must be a tenant with an active lease on this property, OR have MANAGE_MAINTENANCE permission on this property
    const isPlatformAdmin = req.user!.roles.includes('PLATFORM_ADMIN') || req.user!.roles.includes('SUPER_ADMIN');
    let isAuthorized = isPlatformAdmin;

    if (!isAuthorized) {
      // 1. Tenant occupying property check: Requires active or expiring lease with valid end date
      const todayStr = new Date().toISOString().slice(0, 10);
      const tenantOccupancy = await db.select({
        leaseId: leases.id
      })
        .from(leases)
        .innerJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
        .where(and(
          eq(leaseTenants.tenantId, req.user!.id),
          eq(leases.propertyId, propertyId),
          inArray(leases.status, ['ACTIVE', 'EXPIRING']),
          gte(leases.endDate, todayStr)
        )).limit(1);

      if (tenantOccupancy.length > 0) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      // 2. Property Manager / Owner authority check
      isAuthorized = await ownerRepository.verifyPropertyPermission(
        req.user!,
        propertyId,
        Permission.MANAGE_MAINTENANCE
      );
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: You are not authorized to submit maintenance requests for this property."
      });
    }

    const request = await maintenanceRepository.createRequest(
      req.user!.id,
      propertyId,
      unitId,
      category,
      priority,
      title,
      description
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_MAINTENANCE_REQUEST',
      resourceType: 'MaintenanceRequest',
      resourceId: request.id as string,
      changes: { propertyId, title },
      ipAddress: (req.ip || "") as string
    });

    res.status(201).json(request);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// PROPERTY MANAGER / OWNER ROUTES
// ==========================================

// Get property maintenance requests
router.get('/property/:propertyId', requireAuth, checkDbConfig, requirePropertyPermission(Permission.VIEW_MAINTENANCE), async (req, res) => {
  try {
    const requests = await maintenanceRepository.getRequestsByProperty(req.params.propertyId as string);
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request Details (Quotes & Work Orders) with strict IDOR verification
router.get('/:id/details', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, req.params.id as string)).limit(1);
    if (!request) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Maintenance request not found" });
    }

    const isPlatformAdmin = req.user!.roles.includes('PLATFORM_ADMIN') || req.user!.roles.includes('SUPER_ADMIN');
    const isReporter = req.user!.id === request.reporterUserId;
    let isAssignedVendor = Boolean(
      request.assignedVendorId &&
      (req.user!.id === request.assignedVendorId || req.user!.organizationId === request.assignedVendorId)
    );

    if (!isAssignedVendor && request.assignedVendorId) {
      const { organizationMembers } = await import('../../db/schema.js');
      const mems = await db.select().from(organizationMembers).where(and(
        eq(organizationMembers.userId, req.user!.id),
        eq(organizationMembers.organizationId, request.assignedVendorId),
        eq(organizationMembers.status, 'ACTIVE')
      )).limit(1);
      if (mems.length > 0) {
        isAssignedVendor = true;
      }
    }

    let isAuthorized = isPlatformAdmin || isReporter || isAssignedVendor;

    if (!isAuthorized) {
      isAuthorized = await ownerRepository.verifyPropertyPermission(
        req.user!,
        request.propertyId,
        Permission.VIEW_MAINTENANCE
      );
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: You lack authority to view details for this maintenance request."
      });
    }

    const quotes = await maintenanceRepository.getQuotesByRequestId(req.params.id as string);
    const workOrders = await maintenanceRepository.getWorkOrdersByRequestId(req.params.id as string);
    res.json({ quotes, workOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Triage / Assign request with strict property management authority verification
router.put('/:id/triage', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, req.params.id as string)).limit(1);
    if (!request) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Maintenance request not found" });
    }

    const isAuthorized = await ownerRepository.verifyPropertyPermission(
      req.user!,
      request.propertyId,
      Permission.MANAGE_MAINTENANCE
    );

    if (!isAuthorized) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: You lack authority to triage maintenance requests for this property."
      });
    }

    const { status, assignedVendorId, priority } = req.body;
    const updated = await maintenanceRepository.triageRequest(req.params.id as string, status, assignedVendorId, priority);
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'TRIAGE_MAINTENANCE_REQUEST',
      resourceType: 'MaintenanceRequest',
      resourceId: req.params.id as string,
      changes: { status, assignedVendorId, priority },
      ipAddress: (req.ip || "") as string
    });
    
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Approve Quote with strict property-level authority verification
router.post('/quote/:quoteId/approve', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.COMPANY_MEMBER, UserRole.PLATFORM_ADMIN]), checkDbConfig, async (req, res) => {
  try {
    const [quote] = await db.select().from(maintenanceQuotes).where(eq(maintenanceQuotes.id, req.params.quoteId as string)).limit(1);
    if (!quote) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Quote not found" });
    }

    const isAuthorized = await ownerRepository.verifyPropertyPermission(
      req.user!,
      quote.propertyId,
      Permission.MANAGE_MAINTENANCE
    );

    if (!isAuthorized) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: You lack authority to approve quotes for this property."
      });
    }

    const workOrder = await maintenanceRepository.approveQuote(req.params.quoteId as string);
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'APPROVE_QUOTE',
      resourceType: 'Quote',
      resourceId: req.params.quoteId as string,
      changes: { status: 'APPROVED', workOrderId: workOrder.id },
      ipAddress: (req.ip || "") as string
    });
    
    res.json(workOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// VENDOR ROUTES
// ==========================================

router.get('/vendor/requests', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const requests = await maintenanceRepository.getRequestsByVendor(req.user!.id);
    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vendor submitting quote with request existence & property derivation
router.post('/:id/quote', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, req.params.id as string)).limit(1);
    if (!request) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Maintenance request not found" });
    }

    const isPlatformAdmin = req.user!.roles.includes('PLATFORM_ADMIN') || req.user!.roles.includes('SUPER_ADMIN');
    const isAssigned = request.assignedVendorId
      ? (request.assignedVendorId === req.user!.id || request.assignedVendorId === req.user!.organizationId)
      : true;
    const isVendorRole = req.user!.roles.includes('VENDOR') || req.user!.roles.includes(UserRole.VENDOR);

    if (!isPlatformAdmin && (!isVendorRole || !isAssigned)) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: You are not authorized to quote for this maintenance request."
      });
    }

    const { totalAmount, notes, validUntil } = req.body;
    if (!totalAmount || Number(totalAmount) <= 0) {
      return res.status(400).json({ error: "VALIDATION_ERROR", message: "A positive totalAmount is required." });
    }

    // Authoritative propertyId derived from persisted maintenance request (overwriting client-supplied body)
    const quote = await maintenanceRepository.submitQuote(
      req.params.id as string,
      req.user!.id,
      request.propertyId,
      totalAmount,
      notes,
      validUntil
    );
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SUBMIT_QUOTE',
      resourceType: 'MaintenanceQuote',
      resourceId: quote.id as string,
      changes: { totalAmount, requestId: req.params.id as string },
      ipAddress: (req.ip || "") as string
    });
    
    res.json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all requests for properties managed by the user
router.get('/company/queue', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const requests = await db.select({
      request: maintenanceRequests,
      property: properties
    })
    .from(maintenanceRequests)
    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))
    .innerJoin(ownershipRecords, eq(properties.id, ownershipRecords.propertyId))
    .where(eq(ownershipRecords.ownerId, req.user!.id));

    res.json(requests);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// WORK ORDER COMPLETION ROUTE
// ==========================================
const handleCompleteWorkOrder = async (req: any, res: any) => {
  try {
    const targetId = req.params.id as string;
    const [wo] = await db.select().from(workOrders).where(
      or(eq(workOrders.id, targetId), eq(workOrders.maintenanceRequestId, targetId))
    ).limit(1);

    if (!wo) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Work order not found" });
    }

    const isPlatformAdmin = req.user!.roles.includes('PLATFORM_ADMIN') || req.user!.roles.includes('SUPER_ADMIN');
    let isAuthorized = isPlatformAdmin;

    // 1. Property Manager / Owner verification on authoritative wo.propertyId
    if (!isAuthorized) {
      isAuthorized = await ownerRepository.verifyPropertyPermission(
        req.user!,
        wo.propertyId,
        Permission.MANAGE_MAINTENANCE
      );
    }

    // 2. Assigned Vendor verification
    if (!isAuthorized) {
      const isAssignedDirectly = wo.vendorUserId === req.user!.id || 
        wo.assignedTechnicianId === req.user!.id || 
        (wo.vendorId && wo.vendorId === req.user!.organizationId);
      if (isAssignedDirectly) {
        isAuthorized = true;
      } else if (wo.vendorId) {
        const { organizationMembers } = await import('../../db/schema.js');
        const mems = await db.select().from(organizationMembers).where(and(
          eq(organizationMembers.userId, req.user!.id),
          eq(organizationMembers.organizationId, wo.vendorId),
          eq(organizationMembers.status, 'ACTIVE')
        )).limit(1);
        if (mems.length > 0) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({
        error: "AUTHORIZATION_ERROR",
        message: "Forbidden: You lack authority to complete this work order."
      });
    }

    const { inspectionPassed = true, findings } = req.body || {};
    const completedWo = await maintenanceRepository.completeWorkOrder(
      wo.id,
      inspectionPassed !== false,
      req.user!.id
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'COMPLETE_WORK_ORDER',
      resourceType: 'WorkOrder',
      resourceId: wo.id,
      changes: { status: 'COMPLETED', inspectionPassed: inspectionPassed !== false, findings },
      ipAddress: (req.ip || "") as string
    });

    res.json({ message: "Work order completed successfully", workOrder: completedWo });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

router.post('/:id/complete', requireAuth, checkDbConfig, handleCompleteWorkOrder);
router.post('/work-orders/:id/complete', requireAuth, checkDbConfig, handleCompleteWorkOrder);

export default router;
