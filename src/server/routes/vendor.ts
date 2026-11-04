import { Router, Request, Response } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requireActiveRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { vendorRepository } from '../repositories/vendor.js';
import { vendorService } from '../services/vendor.js';
import { auditService } from '../services/audit.js';
import { WorkOrderStatus } from '../../types/vendor.js';

export const vendorRouter = Router();

export const ALLOWED_VENDOR_WORKSPACE_ROLES: (UserRole | string)[] = [
  UserRole.VENDOR,
  'VENDOR',
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
  'ADMIN',
];

// Global Gatekeeper for Vendor Domain: Require Authentication and Active Vendor Workspace Context
vendorRouter.use(requireAuth);
vendorRouter.use(requireActiveRole(ALLOWED_VENDOR_WORKSPACE_ROLES));
vendorRouter.use((req: Request, res: Response, next) => {
  const allowedRoles = [
    UserRole.VENDOR, 
    UserRole.COMPANY_MEMBER, 
    UserRole.PLATFORM_ADMIN, 
    'VENDOR', 
    'COMPANY_MEMBER', 
    'PLATFORM_ADMIN', 
    'SUPER_ADMIN', 
    'ADMIN'
  ];
  const userRoles = req.user?.roles || [];
  const hasRole = userRoles.some((role: any) => allowedRoles.includes(role));

  if (!hasRole) {
    return res.status(403).json({
      error: 'Forbidden: Insufficient role permissions for Vendor / Service Provider domain.',
      code: 'ROLE_FORBIDDEN',
    });
  }
  next();
});

const requireApprovedVendor = async (req: Request, res: Response, next: any) => {
  try {
    const profile = await vendorRepository.getProfile(req.user!.id);
    if (!profile || profile.status !== 'ACTIVE' || profile.verificationStatus !== 'APPROVED') {
      return res.status(403).json({
        error: 'VENDOR_VERIFICATION_REQUIRED',
        code: 'PROFILE_PENDING_VERIFICATION',
        message: 'Your vendor profile is pending verification or license approval. Professional operations are restricted until verification is complete.',
      });
    }
    next();
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: 'Failed to verify vendor profile status' });
  }
};


// =========================================================================
// 1. DASHBOARD & AGGREGATED VIEWS
// =========================================================================

vendorRouter.get('/dashboard', async (req: Request, res: Response) => {
  
  try {
    const dashboard = await vendorRepository.getAuthoritativeDashboard(req.user!.id);
    res.json(dashboard);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 2. VENDOR PROFILE & LICENSES
// =========================================================================

vendorRouter.get('/profile', async (req: Request, res: Response) => {
  
  try {
    const profile = await vendorRepository.getProfile(req.user!.id);
    res.json(profile || {
      userId: req.user!.id,
      businessName: req.user!.name || 'Service Provider',
      status: 'ACTIVE',
      verificationStatus: 'PENDING',
    });
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.put('/profile', async (req: Request, res: Response) => {
  
  try {
    // Prevent client from mutating privileged authorization fields
    const safePayload = { ...req.body };
    delete safePayload.id;
    delete safePayload.userId;
    delete safePayload.status;
    delete safePayload.verificationStatus;
    delete safePayload.rating;
    delete safePayload.reviewCount;

    const updated = await vendorRepository.upsertProfile(req.user!.id, safePayload);
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'UPDATE_VENDOR_PROFILE',
      resourceType: 'VendorProfile',
      resourceId: updated.id,
      changes: safePayload,
      ipAddress: (req.ip || '') as string,
    });
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

vendorRouter.get('/licenses', async (req: Request, res: Response) => {
  
  try {
    const licenses = await vendorRepository.getLicenses(req.user!.id);
    res.json(licenses);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.post('/licenses', async (req: Request, res: Response) => {
  
  try {
    const { licenseType, licenseNumber, issuingAuthority, issueDate, expiryDate, documentUrl, notes } = req.body;
    if (!licenseType || !licenseNumber || !issuingAuthority) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS: licenseType, licenseNumber, and issuingAuthority are required.' });
    }

    const created = await vendorRepository.submitLicense(req.user!.id, {
      licenseType,
      licenseNumber,
      issuingAuthority,
      issueDate,
      expiryDate,
      documentUrl,
      notes,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SUBMIT_VENDOR_LICENSE',
      resourceType: 'VendorLicense',
      resourceId: created.id,
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(created);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 3. SERVICE REQUESTS & WORK ORDERS
// =========================================================================

vendorRouter.get('/service-requests', async (req: Request, res: Response) => {
  
  try {
    const requests = await vendorRepository.getAssignedServiceRequests(req.user!.id);
    res.json(requests);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.get('/work-orders', async (req: Request, res: Response) => {
  
  try {
    const status = req.query.status as string | undefined;
    const workOrders = await vendorRepository.getWorkOrders(req.user!.id, status ? { status } : undefined);
    res.json(workOrders);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.get('/work-orders/:id', async (req: Request, res: Response) => {
  
  try {
    const wo = await vendorRepository.getWorkOrderById(req.params.id as string, req.user!.id);
    if (!wo) {
      return res.status(404).json({ error: 'Work order not found or unauthorized' });
    }
    res.json(wo);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.put('/work-orders/:id/status', requireApprovedVendor, async (req: Request, res: Response) => {
  
  try {
    const { status, notes, photos } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'MISSING_STATUS: status is required.' });
    }

    const currentWo = await vendorRepository.getWorkOrderById(req.params.id as string, req.user!.id);
    if (!currentWo) {
      return res.status(404).json({ error: 'Work order not found or unauthorized.' });
    }

    // State machine validation
    vendorService.validateWorkOrderTransition(currentWo.status, status as WorkOrderStatus);

    const updated = await vendorRepository.updateWorkOrderStatus(
      req.params.id as string,
      req.user!.id,
      status as WorkOrderStatus,
      notes,
      photos
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: `TRANSITION_WORK_ORDER_${status}`,
      resourceType: 'WorkOrder',
      resourceId: updated.id,
      changes: { previousStatus: currentWo.status, newStatus: status, notes },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('INVALID_STATE_TRANSITION')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 4. QUOTES & ESTIMATES (Strictly Confidential per Vendor)
// =========================================================================

vendorRouter.get('/quotes', async (req: Request, res: Response) => {
  
  try {
    const quotes = await vendorRepository.getQuotes(req.user!.id);
    res.json(quotes);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.get('/quotes/:id', async (req: Request, res: Response) => {
  
  try {
    const quote = await vendorRepository.getQuoteById(req.params.id as string, req.user!.id);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found or unauthorized' });
    }
    // Confidentiality check
    vendorService.ensureQuoteConfidentiality(req.user!.id, quote);
    res.json(quote);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    if (err.message.startsWith('CONFIDENTIALITY_VIOLATION')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.post('/quotes', requireApprovedVendor, async (req: Request, res: Response) => {
  
  try {
    const { maintenanceRequestId, propertyId, totalAmount, laborAmount, materialsAmount, feesAmount, currency, estimatedDuration, warrantyTerms, lineItems, validUntil, notes } = req.body;

    if (!maintenanceRequestId || !propertyId || totalAmount === undefined) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS: maintenanceRequestId, propertyId, and totalAmount are required.' });
    }

    // Validate breakdown and ensure no negative amounts
    vendorService.validateQuoteBreakdown({
      totalAmount: Number(totalAmount),
      laborAmount: laborAmount !== undefined ? Number(laborAmount) : undefined,
      materialsAmount: materialsAmount !== undefined ? Number(materialsAmount) : undefined,
      feesAmount: feesAmount !== undefined ? Number(feesAmount) : undefined,
    });

    const quote = await vendorRepository.createQuote(req.user!.id, {
      maintenanceRequestId,
      propertyId,
      totalAmount: Number(totalAmount),
      laborAmount: laborAmount !== undefined ? Number(laborAmount) : undefined,
      materialsAmount: materialsAmount !== undefined ? Number(materialsAmount) : undefined,
      feesAmount: feesAmount !== undefined ? Number(feesAmount) : undefined,
      currency,
      estimatedDuration,
      warrantyTerms,
      lineItems,
      validUntil,
      notes,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SUBMIT_VENDOR_QUOTE',
      resourceType: 'MaintenanceQuote',
      resourceId: quote.id,
      changes: { totalAmount, maintenanceRequestId, propertyId },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(quote);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

vendorRouter.post('/quotes/:id/revise', requireApprovedVendor, async (req: Request, res: Response) => {
  
  try {
    const { totalAmount, laborAmount, materialsAmount, feesAmount, lineItems, notes } = req.body;
    if (totalAmount === undefined) {
      return res.status(400).json({ error: 'MISSING_TOTAL_AMOUNT' });
    }

    vendorService.validateQuoteBreakdown({
      totalAmount: Number(totalAmount),
      laborAmount: laborAmount !== undefined ? Number(laborAmount) : undefined,
      materialsAmount: materialsAmount !== undefined ? Number(materialsAmount) : undefined,
      feesAmount: feesAmount !== undefined ? Number(feesAmount) : undefined,
    });

    const revised = await vendorRepository.reviseQuote(req.params.id as string, req.user!.id, {
      totalAmount: Number(totalAmount),
      laborAmount: laborAmount !== undefined ? Number(laborAmount) : undefined,
      materialsAmount: materialsAmount !== undefined ? Number(materialsAmount) : undefined,
      feesAmount: feesAmount !== undefined ? Number(feesAmount) : undefined,
      lineItems,
      notes,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'REVISE_VENDOR_QUOTE',
      resourceType: 'MaintenanceQuote',
      resourceId: revised.id,
      changes: { totalAmount, revisionNumber: revised.revisionNumber },
      ipAddress: (req.ip || '') as string,
    });

    res.json(revised);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 5. INVOICES & FINANCIAL REFERENCES
// =========================================================================

vendorRouter.get('/invoices', async (req: Request, res: Response) => {
  
  try {
    const invoices = await vendorRepository.getInvoices(req.user!.id);
    res.json(invoices);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.post('/invoices', requireApprovedVendor, async (req: Request, res: Response) => {
  
  try {
    const { workOrderId, quoteId, amount, currency, lineItems, dueDate } = req.body;
    if (!workOrderId || amount === undefined) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS: workOrderId and amount are required.' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT: Invoice amount must be greater than zero.' });
    }

    const invoice = await vendorRepository.createInvoice(req.user!.id, {
      workOrderId,
      quoteId,
      amount: Number(amount),
      currency,
      lineItems,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_VENDOR_INVOICE',
      resourceType: 'MaintenanceInvoice',
      resourceId: invoice.id,
      changes: { amount, workOrderId },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(invoice);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 6. SCHEDULE & TASKS
// =========================================================================

vendorRouter.get('/schedule', async (req: Request, res: Response) => {
  
  try {
    const { startDate, endDate } = req.query;
    const events = await vendorRepository.getEvents(req.user!.id, startDate as string, endDate as string);
    res.json(events);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.post('/schedule', async (req: Request, res: Response) => {
  
  try {
    const { title, eventType, startTime, endTime, location, linkedWorkOrderId, linkedPropertyId, notes } = req.body;
    if (!title || !eventType || !startTime || !endTime) {
      return res.status(400).json({ error: 'MISSING_REQUIRED_FIELDS: title, eventType, startTime, and endTime are required.' });
    }

    const event = await vendorRepository.createEvent(req.user!.id, {
      title,
      eventType,
      startTime,
      endTime,
      location,
      linkedWorkOrderId,
      linkedPropertyId,
      notes,
    });

    res.status(201).json(event);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

vendorRouter.get('/tasks', async (req: Request, res: Response) => {
  
  try {
    const tasks = await vendorRepository.getTasks(req.user!.id);
    res.json(tasks);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.post('/tasks', async (req: Request, res: Response) => {
  
  try {
    const { title, description, priority, dueDate, linkedWorkOrderId, linkedRequestId } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'MISSING_TITLE: title is required.' });
    }

    const task = await vendorRepository.createTask(req.user!.id, {
      title,
      description,
      priority,
      dueDate,
      linkedWorkOrderId,
      linkedRequestId,
    });

    res.status(201).json(task);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

vendorRouter.put('/tasks/:id', async (req: Request, res: Response) => {
  
  try {
    const updated = await vendorRepository.updateTask(req.params.id as string, req.user!.id, req.body);
    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 7. REVIEWS & RATINGS
// =========================================================================

vendorRouter.get('/reviews', async (req: Request, res: Response) => {
  
  try {
    const reviews = await vendorRepository.getReviews(req.user!.id);
    res.json(reviews);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(500).json({ error: err.message });
  }
});

vendorRouter.post('/reviews/:id/respond', async (req: Request, res: Response) => {
  
  try {
    const { response } = req.body;
    if (!response || !response.trim()) {
      return res.status(400).json({ error: 'MISSING_RESPONSE: Response text is required.' });
    }

    const updated = await vendorRepository.respondToReview(req.params.id as string, req.user!.id, response.trim());
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'RESPOND_TO_VENDOR_REVIEW',
      resourceType: 'VendorReview',
      resourceId: updated.id,
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (err: any) {
    if (err.message === 'DATABASE_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// 8. ADVISORY AI CO-PILOT
// =========================================================================

vendorRouter.post('/ai/assist', async (req: Request, res: Response) => {
  try {
    const { query, workOrderId, requestId } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'MISSING_QUERY: query text is required.' });
    }

    const aiResult = await vendorService.processAiQuery(req.user!.id, query, { workOrderId, requestId });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'VENDOR_AI_ASSIST_QUERY',
      resourceType: 'VendorAiCoPilot',
      resourceId: req.user!.id,
      changes: { query, blocked: aiResult.isAutonomousExecutionBlocked, category: aiResult.category },
      ipAddress: (req.ip || '') as string,
    });

    res.json(aiResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
