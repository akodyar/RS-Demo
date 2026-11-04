import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requireRole, requireActiveRole, requirePropertyPermission } from '../middleware/auth.js';
import { auditService } from '../services/audit.js';
import { ownerRepository } from '../repositories/owner.js';
import { propertyRepository } from '../repositories/properties.js';
import { OwnerDashboardData, OwnerPropertyItem, OwnerApprovalRequest, OwnerNotificationItem } from '../../types/owner.js';
import { UserRole, Permission } from '../../types/index.js';
import { db } from '../../db/index.js';
import { 
  properties, 
  ownershipRecords, 
  managementAgreements, 
  maintenanceRequests, 
  maintenanceQuotes,
  users,
  organizations,
  propertyOffers,
  offerCounterHistory,
  propertyViewings,
  salesContracts,
  securityDeposits,
  leases,
  leaseTenants
} from '../../db/schema.js';
import { eq, and, inArray, or } from 'drizzle-orm';
import { financeService } from '../services/finance.js';
import { propertyHealthService } from '../services/propertyHealth.js';
import { moveOutInspectionService } from '../services/move-out-inspection.js';
import { securityDepositDeductionService } from '../services/security-deposit-deduction.js';
import { FeatureFlags } from '../../utils/featureFlags.js';

const router = Router();

/**
 * Authoritative workspace active roles allowed in the Owner Domain:
 * Individual property owners, property management companies, company staff, and platform administrators.
 */
export const ALLOWED_OWNER_WORKSPACE_ROLES: (UserRole | string)[] = [
  UserRole.PROPERTY_OWNER,
  'OWNER',
  UserRole.COMPANY,
  UserRole.COMPANY_MEMBER,
  'COMPANY_OWNER',
  'COMPANY_ADMIN',
  'PROPERTY_MANAGER',
  'ACCOUNTANT',
  'MAINTENANCE_MANAGER',
  'VIEWER',
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
];

// Router boundary guard: strictly enforce authentication and active workspace context
router.use(requireAuth);
router.use(requireActiveRole(ALLOWED_OWNER_WORKSPACE_ROLES));

/**
 * Roles allowed to access the Owner Domain:
 * PROPERTY_OWNER, COMPANY (Management Company), COMPANY_MEMBER, PLATFORM_ADMIN
 */
const ALLOWED_OWNER_ROLES: (UserRole | string)[] = [
  UserRole.PROPERTY_OWNER,
  'OWNER',
  UserRole.COMPANY,
  UserRole.COMPANY_MEMBER,
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
];

/**
 * Helper to check whether PostgreSQL database connectivity is available.
 * Fails closed if PostgreSQL is not provisioned or configured.
 */


/**
 * GET /api/owner/dashboard
 * Aggregated dashboard payload strictly derived from authoritative relational schema
 * (properties, ownership_records, management_agreements, leases, rent_schedules, payment_records, maintenance_requests).
 */
router.get('/dashboard', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const user = req.user!;
    const dashboardData = await ownerRepository.getAuthoritativeDashboard({
      id: user.id,
      organizationId: user.organizationId,
      roles: user.roles,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    res.json(dashboardData);
  } catch (error: any) {
    console.error('Authoritative Owner Dashboard error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve authoritative owner dashboard' });
  }
});

/**
 * GET /api/owner/properties
 * List of properties strictly scoped via verified ownershipRecords or active managementAgreements
 */
router.get('/properties', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const user = req.user!;
    const scopedProperties = await ownerRepository.getScopedOwnerProperties({
      id: user.id,
      organizationId: user.organizationId,
      roles: user.roles,
    });

    res.json(scopedProperties);
  } catch (error: any) {
    console.error('Authoritative Owner Properties error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve properties' });
  }
});

/**
 * GET /api/owner/properties/health
 * Returns the authoritative health status for all accessible properties
 */
router.get('/properties/health', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const user = req.user!;
    const scopedProperties = await ownerRepository.getScopedOwnerProperties({
      id: user.id,
      organizationId: user.organizationId,
      roles: user.roles,
    });
    const propertyIds = scopedProperties.map(p => p.id);
    const health = await propertyHealthService.getPropertiesHealth(propertyIds, 'OWNER');
    res.json(health);
  } catch (error: any) {
    console.error('Authoritative Owner Property Health error:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve property health' });
  }
});

/**
 * POST /api/owner/properties
 * Add a new property with authoritative VERIFIED ownership record in PostgreSQL transaction
 */
router.post('/properties', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.PLATFORM_ADMIN]), requireDatabase, async (req, res) => {
  try {
    const rawKey = req.headers['idempotency-key'] ?? req.body?.idempotencyKey;
    const idempotencyKey = typeof rawKey === 'string' ? rawKey : (rawKey ? String(rawKey) : null);

    const { name, city, type, monthlyRentIqd, unitsCount, address, operatingModel, managedByAgentId, ownerId, companyId, currency, listingType, price } = req.body;

    let resolvedType = type;
    if (typeof type === 'string') {
      const tUpper = type.trim().toUpperCase();
      if (tUpper.includes('APARTMENT') || type.includes('شوقە')) resolvedType = 'APARTMENT';
      else if (tUpper.includes('VILLA') || type.includes('ڤێلا')) resolvedType = 'VILLA';
      else if (tUpper.includes('HOUSE') || type.includes('خانوو')) resolvedType = 'HOUSE';
      else if (tUpper.includes('COMMERCIAL') || type.includes('بازرگانی')) resolvedType = 'COMMERCIAL';
    }

    const newProperty = await propertyRepository.createProperty(req.user!.id, req.user!.roles, {
      name,
      city,
      type: resolvedType,
      address: address || (city ? { city, country: 'Iraq', region: 'Kurdistan' } : undefined),
      operatingModel: operatingModel || undefined,
      managedByAgentId: managedByAgentId || undefined,
      ownerId: ownerId || undefined,
      companyId: companyId || undefined,
      currency: currency || undefined,
      listingType: listingType || undefined,
      price: price || undefined,
    }, {
      idempotencyKey,
      scope: 'POST:/api/owner/properties'
    });

    if (!(newProperty as any).__isReplay) {
      // Audit Log
      await auditService.logAction({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles[0] as string,
        action: 'OWNER_CREATE_PROPERTY',
        resourceType: 'Property',
        resourceId: newProperty.id,
        changes: { name, type, city, operatingModel, managedByAgentId },
        ipAddress: (req.ip || '') as string,
      });
    }

    res.status(201).json(newProperty);
  } catch (error: any) {
    const msg = error.message || 'Failed to create property';
    if (msg.startsWith('INVALID_AGENT:')) {
      return res.status(500).json({ error: msg });
    }
    if (msg.startsWith('FORBIDDEN:') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.startsWith('NOT_FOUND:')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.startsWith('CONFLICT:')) {
      return res.status(409).json({ error: 'CONFLICT', message: msg });
    }
    if (
      msg.startsWith('VALIDATION_ERROR:') || 
      msg.startsWith('INVALID_') || 
      msg.includes('required') || 
      msg.includes('Invalid operating model')
    ) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    console.error('[OWNER_ROUTE] Unexpected error in createProperty:', error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred while processing the property.'
    });
  }
});

/**
 * GET /api/owner/approvals
 * Returns pending approval requests derived from relational maintenance quotes & agreements
 */
router.get('/approvals', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const user = req.user!;
    const accessList = await ownerRepository.getAuthorizedPropertyAccess(user);
    const propIds = accessList.map(a => a.propertyId);

    if (propIds.length === 0) {
      return res.json([]);
    }

    // Query pending maintenance quotes for these properties
    const pendingQuotes = await db
      .select({
        quote: maintenanceQuotes,
        request: maintenanceRequests,
        vendor: organizations,
        property: properties,
      })
      .from(maintenanceQuotes)
      .innerJoin(maintenanceRequests, eq(maintenanceQuotes.maintenanceRequestId, maintenanceRequests.id))
      .innerJoin(organizations, eq(maintenanceQuotes.vendorId, organizations.id))
      .innerJoin(properties, eq(maintenanceQuotes.propertyId, properties.id))
      .where(and(
        inArray(maintenanceQuotes.propertyId, propIds),
        eq(maintenanceQuotes.status, 'PENDING_APPROVAL')
      ));

    const { financeService } = await import('../services/finance.js');
    const exchangeRateIqd = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');
    
    const mappedApprovals = pendingQuotes.map(pq => ({
      id: pq.quote.id,
      type: 'MAINTENANCE_QUOTE',
      ownerId: user.id,
      propertyId: pq.property.id,
      requesterName: pq.vendor.name,
      requesterRole: 'Vendor / Maintenance Contractor',
      action: `Approve Quote for: ${pq.request.title}`,
      actionKurdish: `پەسەندکردنی خەمڵاندنی چاکسازی: ${pq.request.title}`,
      relatedEntity: pq.property.name,
      amountIqd: (pq.quote.currency === 'IQD') ? Math.round(Number(pq.quote.totalAmount)) : Math.round(Number(pq.quote.totalAmount) * exchangeRateIqd),
      riskLevel: Number(pq.quote.totalAmount) > 500 ? 'HIGH' : 'MEDIUM',
      reason: pq.quote.notes || pq.request.description,
      createdAt: pq.quote.createdAt ? new Date(pq.quote.createdAt).toISOString() : new Date().toISOString(),
      status: pq.quote.status as any,
    }));

    // Query pending leases awaiting owner approval
    const pendingLeases = await db
      .select({
        lease: leases,
        property: properties,
      })
      .from(leases)
      .innerJoin(properties, eq(leases.propertyId, properties.id))
      .where(and(
        inArray(leases.propertyId, propIds),
        eq(leases.status, 'PENDING_APPROVAL')
      ));

    const mappedLeaseApprovals = pendingLeases.map(pl => ({
      id: pl.lease.id,
      type: 'LEASE',
      ownerId: user.id,
      propertyId: pl.property.id,
      requesterName: 'Management Company',
      requesterRole: 'Property Management Company',
      action: `Approve Lease Draft for: ${pl.property.name}`,
      actionKurdish: `پەسەندکردنی ڕەشنووسی گرێبەستی کرێ: ${pl.property.name}`,
      relatedEntity: pl.property.name,
      amountIqd: (pl.lease.currency === 'IQD') ? Math.round(Number(pl.lease.rentAmount)) : Math.round(Number(pl.lease.rentAmount) * exchangeRateIqd),
      riskLevel: 'HIGH',
      reason: `Company draft lease from ${pl.lease.startDate} to ${pl.lease.endDate}`,
      createdAt: pl.lease.createdAt ? new Date(pl.lease.createdAt).toISOString() : new Date().toISOString(),
      status: pl.lease.status as any,
    }));

    res.json([...mappedApprovals, ...mappedLeaseApprovals]);
  } catch (error: any) {
    console.error('Owner approvals error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/approvals/:id/decide
 * Authoritative decision on quote/approval strictly validated via ownership/management authority
 */
router.post('/approvals/:id/decide', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), requireDatabase, async (req, res) => {
  
  try {
    const targetId = String(req.params.id);
    const { decision, notes, type } = req.body;

    if (!['APPROVED', 'REJECTED', 'APPROVE', 'REJECT'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be APPROVED or REJECTED' });
    }

    // If explicitly marked as lease approval or type is LEASE
    if (type === 'LEASE' || type === 'LEASE_ACTIVATION') {
      const updated = await ownerRepository.decideLeaseApproval(req.user!, targetId, decision, notes);
      return res.json({ success: true, lease: updated });
    }

    // Try finding in maintenanceQuotes first
    const [quote] = await db
      .select()
      .from(maintenanceQuotes)
      .where(eq(maintenanceQuotes.id, targetId))
      .limit(1);

    if (quote) {
      // Verify caller authority over this property
      const hasPermission = await ownerRepository.verifyPropertyPermission(
        req.user!,
        quote.propertyId,
        Permission.EDIT_PROPERTY
      );

      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden: You lack authority to decide approvals for this property.' });
      }

      if (quote.status !== 'PENDING_APPROVAL') {
        return res.status(400).json({ error: `Cannot decide approval that is already ${quote.status}` });
      }

      const quoteDecision = decision.toUpperCase().startsWith('APPROV') ? 'APPROVED' : 'REJECTED';
      const [updatedQuote] = await db
        .update(maintenanceQuotes)
        .set({
          status: quoteDecision,
          notes: notes ? `${quote.notes || ''} [Decided: ${quoteDecision}]: ${notes}` : quote.notes,
        })
        .where(eq(maintenanceQuotes.id, targetId))
        .returning();

      await auditService.logAction({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles[0] as string,
        action: `OWNER_APPROVAL_${quoteDecision}`,
        resourceType: 'MaintenanceQuote',
        resourceId: targetId,
        changes: { decision: quoteDecision, notes, propertyId: quote.propertyId },
        ipAddress: (req.ip || '') as string,
      });

      return res.json({ success: true, quote: updatedQuote });
    }

    // If not a quote, check if target is a lease
    const [leaseRecord] = await db
      .select()
      .from(leases)
      .where(eq(leases.id, targetId))
      .limit(1);

    if (leaseRecord) {
      const updated = await ownerRepository.decideLeaseApproval(req.user!, targetId, decision, notes);
      return res.json({ success: true, lease: updated });
    }

    return res.status(404).json({ error: 'Approval item not found' });
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('Unauthorized')
    ) {
      return res.status(403).json({ error: error.message });
    }
    if (
      error.message?.includes('VALIDATION_ERROR') ||
      error.message?.includes('Cannot decide approval') ||
      error.message?.includes('not found')
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Decide approval error:', error);
    res.status(500).json({ error: error.message || 'Failed to decide approval' });
  }
});

/**
 * GET /api/owner/properties/:id
 * Property details with units, active leases, management agreements, and ownership records
 */
router.get('/properties/:id', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyId = String(req.params.id);
    const details = await ownerRepository.getPropertyById(req.user!, propertyId);

    if (!details) {
      return res.status(404).json({
        error: 'NOT_FOUND_OR_FORBIDDEN',
        message: 'Property not found or you lack authority to view it.',
      });
    }

    res.json(details);
  } catch (error: any) {
    console.error('Owner property details error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/owner/properties/:id
 * Update property metadata (requires EDIT_PROPERTY permission)
 */
router.put('/properties/:id', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyId = String(req.params.id);
    const updated = await ownerRepository.updateProperty(req.user!, propertyId, req.body);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_UPDATE_PROPERTY',
      resourceType: 'Property',
      resourceId: propertyId,
      changes: req.body,
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner update property error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/leases
 * Authoritative lease list scoped strictly to caller's authorized properties
 */
router.get('/leases', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const leasesList = await ownerRepository.getScopedLeases(req.user!, propertyId);
    res.json(leasesList);
  } catch (error: any) {
    console.error('Owner leases error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/renewals
 * Scoped list of lease renewals for properties the caller is authorized to manage
 */
router.get('/renewals', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const renewals = await ownerRepository.getScopedRenewals(req.user!, propertyId);
    res.json(renewals);
  } catch (error: any) {
    console.error('Owner renewals error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/leases/:id
 * Lease details, rent schedules, and payment records
 */
router.get('/leases/:id', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const leaseId = String(req.params.id);
    const leaseDetails = await ownerRepository.getLeaseDetails(req.user!, leaseId);

    if (!leaseDetails) {
      return res.status(404).json({ error: 'Lease not found' });
    }

    res.json(leaseDetails);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner lease details error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/leases
 * Create lease and rent schedule (requires MANAGE_LEASES permission)
 */
router.post('/leases', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const { propertyId, unitId, tenantId, startDate, endDate, rentAmount, currency, depositAmount, rentCycle } = req.body;
    if (!propertyId || !tenantId || !startDate || !endDate || rentAmount === undefined || rentAmount === null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: propertyId, tenantId, startDate, endDate, and rentAmount are required' });
    }

    let resolvedTenantId = String(tenantId).trim();
    const [existingById] = await db.select({ id: users.id }).from(users).where(eq(users.id, resolvedTenantId)).limit(1);
    if (!existingById) {
      const [existingByPhoneOrEmail] = await db.select({ id: users.id }).from(users).where(
        or(
          eq(users.phone, resolvedTenantId),
          eq(users.email, resolvedTenantId)
        )
      ).limit(1);
      if (existingByPhoneOrEmail) {
        resolvedTenantId = existingByPhoneOrEmail.id;
      }
    }

    const newLease = await ownerRepository.createLease(req.user!, {
      propertyId,
      unitId,
      tenantId: resolvedTenantId,
      startDate,
      endDate,
      rentAmount: Number(rentAmount),
      currency,
      depositAmount: depositAmount ? Number(depositAmount) : undefined,
      rentCycle,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_CREATE_LEASE',
      resourceType: 'Lease',
      resourceId: newLease.id,
      changes: { propertyId, tenantId, rentAmount, startDate, endDate },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(newLease);
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Unauthorized') ||
      error.message?.includes('AUTH_MEMBER_NOT_FOUND')
    ) {
      return res.status(403).json({ error: error.message });
    }
    if (
      error.message?.includes('VALIDATION_ERROR') ||
      error.message?.includes('CONFLICT') ||
      error.message?.includes('INVALID_') ||
      error.message?.includes('Invalid')
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Owner create lease error:', error);
    res.status(500).json({ error: error.message || 'Failed to create lease' });
  }
});

/**
 * POST /api/owner/leases/:id/approve
 * Authoritative Owner approval of a lease draft (status: PENDING_APPROVAL -> PENDING_SIGNATURE)
 */
router.post('/leases/:id/approve', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const leaseId = String(req.params.id);
    const { notes } = req.body;
    const updated = await ownerRepository.decideLeaseApproval(req.user!, leaseId, 'APPROVE', notes);
    res.json({ success: true, lease: updated });
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('Unauthorized')
    ) {
      return res.status(403).json({ error: error.message });
    }
    if (
      error.message?.includes('VALIDATION_ERROR') ||
      error.message?.includes('Cannot decide approval') ||
      error.message?.includes('not found')
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Owner approve lease error:', error);
    res.status(500).json({ error: error.message || 'Failed to approve lease' });
  }
});

/**
 * POST /api/owner/leases/:id/reject
 * Authoritative Owner rejection of a lease draft (status: PENDING_APPROVAL -> CANCELLED)
 */
router.post('/leases/:id/reject', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const leaseId = String(req.params.id);
    const { notes } = req.body;
    const updated = await ownerRepository.decideLeaseApproval(req.user!, leaseId, 'REJECT', notes);
    res.json({ success: true, lease: updated });
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('Unauthorized')
    ) {
      return res.status(403).json({ error: error.message });
    }
    if (
      error.message?.includes('VALIDATION_ERROR') ||
      error.message?.includes('Cannot decide approval') ||
      error.message?.includes('not found')
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Owner reject lease error:', error);
    res.status(500).json({ error: error.message || 'Failed to reject lease' });
  }
});

/**
 * POST /api/owner/leases/:id/decide
 * Authoritative Owner decision on a lease draft (APPROVE / REJECT)
 */
router.post('/leases/:id/decide', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const leaseId = String(req.params.id);
    const { decision, notes } = req.body;
    if (!decision) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: decision is required (APPROVE or REJECT)' });
    }
    const updated = await ownerRepository.decideLeaseApproval(req.user!, leaseId, decision, notes);
    res.json({ success: true, lease: updated });
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Forbidden') ||
      error.message?.includes('Unauthorized')
    ) {
      return res.status(403).json({ error: error.message });
    }
    if (
      error.message?.includes('VALIDATION_ERROR') ||
      error.message?.includes('Cannot decide approval') ||
      error.message?.includes('not found')
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Owner decide lease error:', error);
    res.status(500).json({ error: error.message || 'Failed to decide lease approval' });
  }
});

/**
 * GET /api/owner/maintenance
 * Scoped maintenance requests
 */
router.get('/maintenance', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const maintenanceList = await ownerRepository.getScopedMaintenance(req.user!, propertyId);
    res.json(maintenanceList);
  } catch (error: any) {
    console.error('Owner maintenance error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/finances
 * Authoritative financial breakdown reconciling EXPECTED, SCHEDULED, PAID, OUTSTANDING, OVERDUE, EXPENSES, NET
 */
router.get('/finances', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const finances = await ownerRepository.getAuthoritativeFinances(req.user!, propertyId);
    res.json(finances);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner finances error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/reports
 * Authoritative portfolio reports with verifiable data tracing
 */
router.get('/reports', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const reports = await ownerRepository.getAuthoritativeReports(req.user!);
    res.json(reports);
  } catch (error: any) {
    console.error('Owner reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/management-agreements
 * List management agreements for owner or assigned company
 */
router.get('/management-agreements', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const agreements = await ownerRepository.getManagementAgreements(req.user!);
    res.json(agreements);
  } catch (error: any) {
    console.error('Get management agreements error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/management-agreements/invite
 * Owner invites company with spending limit and granted permissions (status: PENDING)
 */
router.post('/management-agreements/invite', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.PLATFORM_ADMIN]), requireDatabase, async (req, res) => {
  
  try {
    const { propertyId, companyId, grantedPermissions, spendingLimit, startDate, endDate } = req.body;
    if (!propertyId || !companyId || !grantedPermissions || !startDate) {
      return res.status(400).json({ error: 'propertyId, companyId, grantedPermissions, and startDate are required' });
    }

    const agreement = await ownerRepository.inviteCompany(req.user!.id, {
      propertyId,
      companyId,
      grantedPermissions,
      spendingLimit,
      startDate,
      endDate,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_INVITE_MANAGEMENT_COMPANY',
      resourceType: 'ManagementAgreement',
      resourceId: agreement.id,
      changes: { propertyId, companyId, grantedPermissions, spendingLimit },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(agreement);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Invite company error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/management-agreements/:id/accept
 * Company accepts pending management agreement
 */
router.post('/management-agreements/:id/accept', requireAuth, requireRole([UserRole.COMPANY, UserRole.COMPANY_MEMBER]), requireDatabase, async (req, res) => {
  
  try {
    const agreementId = String(req.params.id);
    const orgId = req.user!.organizationId;

    if (!orgId) {
      return res.status(403).json({ error: 'Forbidden: Caller has no organization context.' });
    }

    const updated = await ownerRepository.acceptAgreement(req.user!.id, orgId, agreementId);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'COMPANY_ACCEPT_MANAGEMENT_AGREEMENT',
      resourceType: 'ManagementAgreement',
      resourceId: agreementId,
      changes: { status: 'ACTIVE' },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Accept agreement error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/management-agreements/:id/terminate
 * Owner or Company terminates agreement
 */
router.post('/management-agreements/:id/terminate', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const agreementId = String(req.params.id);
    const updated = await ownerRepository.terminateAgreement(req.user!, agreementId);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'TERMINATE_MANAGEMENT_AGREEMENT',
      resourceType: 'ManagementAgreement',
      resourceId: agreementId,
      changes: { status: 'TERMINATED' },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Terminate agreement error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/documents
 * Documents scoped to caller's authorized properties
 */
router.get('/documents', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const docs = await ownerRepository.getScopedDocuments(req.user!, propertyId);
    res.json(docs);
  } catch (error: any) {
    console.error('Owner documents error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/documents
 * Create document
 */
router.post('/documents', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const { propertyId, title, documentType, fileUrl, metadata } = req.body;
    if (!propertyId || !title || !documentType) {
      return res.status(400).json({ error: 'propertyId, title, and documentType are required' });
    }

    const newDoc = await ownerRepository.createDocument(req.user!, {
      propertyId,
      title,
      documentType,
      fileUrl,
      metadata,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_CREATE_DOCUMENT',
      resourceType: 'Document',
      resourceId: newDoc.id,
      changes: { propertyId, title, documentType },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(newDoc);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner create document error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/conversations
 * Conversations for current user
 */
router.get('/conversations', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const convs = await ownerRepository.getScopedConversations(req.user!);
    res.json(convs);
  } catch (error: any) {
    console.error('Owner conversations error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/conversations/:id/messages
 * Messages in conversation
 */
router.get('/conversations/:id/messages', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const conversationId = String(req.params.id);
    const msgs = await ownerRepository.getConversationMessages(req.user!, conversationId);
    res.json(msgs);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner conversation messages error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/conversations/:id/messages
 * Send message in conversation
 */
router.post('/conversations/:id/messages', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const conversationId = String(req.params.id);
    const { content, messageType } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const newMsg = await ownerRepository.sendMessage(req.user!, conversationId, content, messageType);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_SEND_MESSAGE',
      resourceType: 'Message',
      resourceId: newMsg.id,
      changes: { conversationId, messageType },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(newMsg);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner send message error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/marketplace/list and POST /api/owner/marketplace/listings
 * Create draft listing for marketplace
 */
router.post(['/marketplace/list', '/marketplace/listings'], requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const { propertyId, type, price, currency, title, description } = req.body;
    if (!propertyId || !type || !price || !title) {
      return res.status(400).json({ error: 'propertyId, type, price, and title are required' });
    }

    if (typeof type !== 'string' || !type.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Listing type must be a non-empty string.' });
    }

    const normalizedType = type.trim().toUpperCase();

    // RENTAL-ONLY BOUNDARY ENFORCEMENT:
    // Reject SALE / FOR_SALE when buying and selling is disabled
    if ((normalizedType === 'FOR_SALE' || normalizedType === 'SALE') && !FeatureFlags.BUY_SELL_ENABLED) {
      return res.status(403).json({
        error: 'BUY_SELL_DISABLED',
        message: 'Sale workflows and FOR_SALE listings are disabled in this rental-only release.'
      });
    }

    if (normalizedType !== 'FOR_RENT' && normalizedType !== 'RENT') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Invalid listing type '${type}'. Only rental listings ('FOR_RENT') are supported in this release.`
      });
    }

    const canonicalType = normalizedType === 'RENT' ? 'FOR_RENT' : normalizedType;

    const listing = await ownerRepository.listPropertyOnMarketplace(req.user!, {
      propertyId,
      type: canonicalType,
      price: Number(price),
      currency,
      title,
      description,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_CREATE_MARKETPLACE_LISTING',
      resourceType: 'Listing',
      resourceId: listing.id,
      changes: { propertyId, type: canonicalType, price, title },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(listing);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    if (error.message?.includes('BUY_SELL_DISABLED')) {
      return res.status(403).json({ error: 'BUY_SELL_DISABLED', message: error.message });
    }
    if (error.message?.includes('VALIDATION_ERROR')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: error.message });
    }
    console.error('Owner marketplace list error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/marketplace/:listingId/status
 * Update listing status (e.g. PUBLISHED, PAUSED, ARCHIVED)
 */
router.post('/marketplace/:listingId/status', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const listingId = String(req.params.listingId);
    const { status } = req.body;
    if (!['PUBLISHED', 'PAUSED', 'ARCHIVED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be PUBLISHED, PAUSED, or ARCHIVED' });
    }

    const updated = await ownerRepository.updateListingStatus(req.user!, listingId, status);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: `OWNER_LISTING_STATUS_${status}`,
      resourceType: 'Listing',
      resourceId: listingId,
      changes: { status },
      ipAddress: (req.ip || '') as string,
    });

    res.json(updated);
  } catch (error: any) {
    if (error.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + error.message });
    }
    console.error('Owner listing status error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/notifications
 * Scoped notifications from system events
 */
router.get('/notifications', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const userNotifs = await ownerRepository.getScopedNotifications(req.user!);
    res.json(userNotifs);
  } catch (error: any) {
    console.error('Owner notifications error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/notifications/read-all
 * Mark read for user notifications
 */
router.post('/notifications/read-all', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const { notificationIds } = req.body;
    await ownerRepository.markNotificationsAsRead(req.user!, notificationIds);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Owner notifications read-all error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/maintenance
 * Authoritatively create maintenance request in PostgreSQL maintenance_requests table
 */
router.post('/maintenance', requireAuth, requireRole([UserRole.PROPERTY_OWNER, UserRole.COMPANY, UserRole.PLATFORM_ADMIN]), requireDatabase, async (req, res) => {
  
  try {
    const { propertyId, title, category, priority, description } = req.body;
    if (!propertyId || !title || !description) {
      return res.status(400).json({ error: 'Property, title, and description are required.' });
    }

    // Verify caller authority over this property
    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      propertyId,
      Permission.CREATE_MAINTENANCE
    );

    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden: You lack authority to dispatch maintenance for this property.' });
    }

    const [newRequest] = await db
      .insert(maintenanceRequests)
      .values({
        propertyId,
        reporterUserId: req.user!.id,
        category: category || 'GENERAL',
        title,
        description,
        priority: priority || 'MEDIUM',
        status: 'REPORTED',
      })
      .returning();

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'OWNER_REQUEST_MAINTENANCE',
      resourceType: 'MaintenanceRequest',
      resourceId: newRequest.id,
      changes: { propertyId, title, category, priority },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json({ success: true, ticketId: newRequest.id, request: newRequest });
  } catch (error: any) {
    console.error('Owner maintenance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// OWNER OFFERS & VIEWINGS INTEGRATION
// ==========================================

router.get('/offers', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyAccess = await ownerRepository.getAuthorizedPropertyAccess(req.user!);
    const propertyIds = propertyAccess.map(p => p.propertyId);

    if (propertyIds.length === 0) {
      return res.json([]);
    }

    const offers = await db
      .select({
        offer: propertyOffers,
        property: properties
      })
      .from(propertyOffers)
      .innerJoin(properties, eq(propertyOffers.propertyId, properties.id))
      .where(inArray(propertyOffers.propertyId, propertyIds));

    res.json(offers.map(o => ({
      ...o.offer,
      offerAmount: Number(o.offer.offerAmount),
      propertyName: o.property.name
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/offers/:id/decide', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const offerId = String(req.params.id);
    const { action, counterAmount, note } = req.body; // ACCEPT, REJECT, COUNTER

    const [offer] = await db.select().from(propertyOffers).where(eq(propertyOffers.id, offerId)).limit(1);
    if (!offer) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Verify caller ownership/management authority over property
    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      offer.propertyId,
      Permission.EDIT_PROPERTY
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden: You lack authority to decide offers on this property' });
    }

    if (action === 'COUNTER') {
      if (!counterAmount || counterAmount <= 0) {
        return res.status(400).json({ error: 'counterAmount must be positive' });
      }
      await db.update(propertyOffers).set({
        offerAmount: String(counterAmount),
        status: 'COUNTERED',
        updatedAt: new Date()
      }).where(eq(propertyOffers.id, offerId));

      await db.insert(offerCounterHistory).values({
        offerId,
        actorId: req.user!.id,
        actorRole: req.user!.roles.includes(UserRole.COMPANY) ? 'SELLER_COMPANY' : 'SELLER_OWNER',
        counterAmount: String(counterAmount),
        currency: offer.currency,
        status: 'COUNTERED',
        note
      });
      return res.json({ success: true, status: 'COUNTERED' });
    }

    if (action === 'ACCEPT') {
      await db.update(propertyOffers).set({
        status: 'ACCEPTED',
        updatedAt: new Date()
      }).where(eq(propertyOffers.id, offerId));

      // Create Sales Contract draft upon offer acceptance
      const contractNumber = `SC-${Date.now().toString().slice(-6)}`;
      await db.insert(salesContracts).values({
        offerId,
        propertyId: offer.propertyId,
        listingId: offer.listingId,
        buyerId: offer.buyerId,
        sellerId: req.user!.id,
        contractNumber,
        agreedPrice: String(offer.offerAmount),
        currency: offer.currency,
        status: 'DRAFTED',
        terms: offer.terms
      });

      return res.json({ success: true, status: 'ACCEPTED', contractNumber });
    }

    if (action === 'REJECT') {
      await db.update(propertyOffers).set({
        status: 'REJECTED',
        rejectionReason: note || 'Rejected by property owner',
        updatedAt: new Date()
      }).where(eq(propertyOffers.id, offerId));

      return res.json({ success: true, status: 'REJECTED' });
    }

    res.status(400).json({ error: 'Invalid action. Must be ACCEPT, REJECT, or COUNTER' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/viewings', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  
  try {
    const propertyAccess = await ownerRepository.getAuthorizedPropertyAccess(req.user!);
    const propertyIds = propertyAccess.map(p => p.propertyId);

    if (propertyIds.length === 0) {
      return res.json([]);
    }

    const viewings = await db
      .select({
        viewing: propertyViewings,
        property: properties
      })
      .from(propertyViewings)
      .innerJoin(properties, eq(propertyViewings.propertyId, properties.id))
      .where(inArray(propertyViewings.propertyId, propertyIds));

    res.json(viewings.map(v => ({
      ...v.viewing,
      propertyName: v.property.name
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

import { utilityBillRepository } from '../repositories/utility-bills.js';

/**
 * GET /api/owner/properties/:id/utility-bills
 * Unpaid and partial bills for a property
 */
router.get('/properties/:id/utility-bills', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const propertyId = String(req.params.id);

    // Verify ownership authoritatively
    const accessList = await ownerRepository.getAuthorizedPropertyAccess(req.user! as any);
    const hasAccess = accessList.some(a => a.propertyId === propertyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to view bills for this property.' });
    }

    const bills = await utilityBillRepository.getOwnerPropertyBills(propertyId, req.user!.id);
    res.json(bills);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/properties/:id/utility-bills
 * Owner records a new utility bill for their property
 */
router.post('/properties/:id/utility-bills', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const propertyId = String(req.params.id);

    // Verify ownership authoritatively
    const accessList = await ownerRepository.getAuthorizedPropertyAccess(req.user! as any);
    const hasAccess = accessList.some(a => a.propertyId === propertyId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to record bills for this property.' });
    }

    const { unitId, tenantId, leaseId, type, description, amount, billingDate, dueDate } = req.body;
    if (!type || !amount || Number(amount) <= 0 || !billingDate) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing required bill fields (valid type, positive amount, billingDate)' });
    }

    // Auto-resolve active lease and tenant if not provided
    let resolvedTenantId = tenantId;
    let resolvedLeaseId = leaseId;
    if (!resolvedTenantId || !resolvedLeaseId) {
      const activeLease = await db.select({
        lease: leases,
        tenantId: leaseTenants.tenantId
      })
      .from(leases)
      .leftJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
      .where(and(eq(leases.propertyId, propertyId), eq(leases.status, 'ACTIVE')))
      .limit(1);

      if (activeLease.length > 0) {
        resolvedLeaseId = resolvedLeaseId || activeLease[0].lease.id;
        resolvedTenantId = resolvedTenantId || activeLease[0].tenantId || undefined;
      }
    }

    const newBill = await utilityBillRepository.createBill({
      propertyId,
      unitId: unitId || undefined,
      tenantId: resolvedTenantId,
      leaseId: resolvedLeaseId,
      type: String(type).toUpperCase(),
      description: description || undefined,
      amount: Number(amount),
      billingDate,
      dueDate: dueDate || billingDate
    }, req.user!.id);

    res.status(201).json(newBill);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/owner/deposits/:id/collect
 */
router.post('/deposits/:id/collect', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const depositId = String(req.params.id);
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required' });

    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId)).limit(1);
    if (!deposit) return res.status(404).json({ error: 'Deposit not found' });

    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      deposit.propertyId,
      Permission.MANAGE_FINANCIALS
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to manage finances for this property.' });
    }

    const updated = await financeService.collectSecurityDeposit(depositId, Number(amount));
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/owner/deposits/:id/release
 */
router.post('/deposits/:id/release', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const depositId = String(req.params.id);
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'amount is required' });

    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId)).limit(1);
    if (!deposit) return res.status(404).json({ error: 'Deposit not found' });

    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      deposit.propertyId,
      Permission.MANAGE_FINANCIALS
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to manage finances for this property.' });
    }

    const updated = await financeService.releaseSecurityDeposit(depositId, Number(amount), {
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      ipAddress: req.ip,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/owner/leases/:leaseId/deposit
 * Fetches the authoritative security deposit record for a lease.
 */
router.get('/leases/:leaseId/deposit', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const leaseId = String(req.params.leaseId);
    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.leaseId, leaseId)).limit(1);
    if (!deposit) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'No security deposit found for this lease.' });
    }

    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      deposit.propertyId,
      Permission.VIEW_FINANCIALS
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to view finances for this property.' });
    }

    res.json(deposit);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal error fetching deposit' });
  }
});

/**
 * GET /api/owner/deposits/:id
 * Fetches a single security deposit record.
 */
router.get('/deposits/:id', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const depositId = String(req.params.id);
    const [deposit] = await db.select().from(securityDeposits).where(eq(securityDeposits.id, depositId)).limit(1);
    if (!deposit) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Deposit not found' });
    }

    const hasPermission = await ownerRepository.verifyPropertyPermission(
      req.user!,
      deposit.propertyId,
      Permission.VIEW_FINANCIALS
    );
    if (!hasPermission) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You are not authorized to view finances for this property.' });
    }

    res.json(deposit);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal error fetching deposit' });
  }
});

/* ========================================================================= */
/* MOVE-OUT INSPECTIONS (Owner / Property Manager Workflow)                  */
/* ========================================================================= */

/**
 * POST /api/owner/inspections
 * Schedules or creates a new move-out inspection.
 */
router.post('/inspections', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const inspection = await moveOutInspectionService.createInspection(req.body, req.user!);
    res.status(201).json(inspection);
  } catch (error: any) {
    const msg = error.message || 'Error creating inspection';
    if (msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('INVALID_') || msg.includes('VALIDATION_ERROR') || msg.includes('MISSING_BASELINE')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * GET /api/owner/leases/:leaseId/inspections
 * Fetches all move-out inspections for a given lease with items.
 */
router.get('/leases/:leaseId/inspections', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
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
 * GET /api/owner/inspections/:id
 * Fetches an inspection with its items.
 */
router.get('/inspections/:id', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
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
 * POST /api/owner/inspections/:id/items
 * Adds a granular inspection item.
 */
router.post('/inspections/:id/items', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const id = String(req.params.id);
    const item = await moveOutInspectionService.addInspectionItem(id, req.body, req.user!);
    res.status(201).json(item);
  } catch (error: any) {
    const msg = error.message || 'Error adding inspection item';
    if (msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('INSPECTION_NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('INVALID_') || msg.includes('INSPECTION_IMMUTABLE')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * PUT /api/owner/inspections/:id/items/:itemId
 * Updates an inspection item.
 */
router.put('/inspections/:id/items/:itemId', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const itemId = String(req.params.itemId);
    const item = await moveOutInspectionService.updateInspectionItem(itemId, req.body, req.user!);
    res.json(item);
  } catch (error: any) {
    const msg = error.message || 'Error updating inspection item';
    if (msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('INVALID_') || msg.includes('INSPECTION_IMMUTABLE')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * POST /api/owner/inspections/:id/complete
 * Completes an inspection.
 */
router.post('/inspections/:id/complete', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const id = String(req.params.id);
    const inspection = await moveOutInspectionService.completeInspection(id, req.body, req.user!);
    res.json(inspection);
  } catch (error: any) {
    const msg = error.message || 'Error completing inspection';
    if (msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('INSPECTION_NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('INVALID_') || msg.includes('INSPECTION_') || msg.includes('ITEMS_REQUIRED')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * POST /api/owner/inspections/:id/cancel
 * Cancels an inspection.
 */
router.post('/inspections/:id/cancel', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const id = String(req.params.id);
    const inspection = await moveOutInspectionService.cancelInspection(id, req.body.reason || 'Cancelled by manager', req.user!);
    res.json(inspection);
  } catch (error: any) {
    const msg = error.message || 'Error cancelling inspection';
    if (msg.includes('AUTHORIZATION_DENIED') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('INSPECTION_NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('INSPECTION_IMMUTABLE')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/* ========================================================================= */
/* SECURITY DEPOSIT DEDUCTIONS (Owner / Property Manager Workflow)           */
/* ========================================================================= */

/**
 * POST /api/owner/deductions/propose
 * Proposes a deduction against the tenant's security deposit.
 */
router.post('/deductions/propose', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const deduction = await securityDepositDeductionService.proposeDeduction(req.body, req.user!);
    res.status(201).json(deduction);
  } catch (error: any) {
    const msg = error.message || 'Error proposing deduction';
    if (msg.includes('FORBIDDEN') || msg.includes('AUTHORIZATION')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('VALIDATION_ERROR') || msg.includes('EXCEEDS_AVAILABLE_BALANCE') || msg.includes('INVALID_')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * POST /api/owner/deductions/:id/approve
 * Approves a proposed deduction.
 * Decision P02: Fails closed for company managers who lack explicit approval delegation.
 */
router.post('/deductions/:id/approve', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const id = String(req.params.id);
    const deduction = await securityDepositDeductionService.approveDeduction(id, req.user!);
    res.json(deduction);
  } catch (error: any) {
    const msg = error.message || 'Error approving deduction';
    if (msg.includes('FORBIDDEN') || msg.includes('AUTHORIZATION') || msg.includes('AUTHORITY')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('INVALID_STATE') || msg.includes('VALIDATION_ERROR')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * POST /api/owner/deductions/:id/reject
 * Rejects a proposed or disputed deduction.
 */
router.post('/deductions/:id/reject', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
  try {
    const id = String(req.params.id);
    const { rejectionReason } = req.body;
    const deduction = await securityDepositDeductionService.rejectDeduction(id, rejectionReason || 'Rejected', req.user!);
    res.json(deduction);
  } catch (error: any) {
    const msg = error.message || 'Error rejecting deduction';
    if (msg.includes('FORBIDDEN') || msg.includes('AUTHORIZATION')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.includes('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.includes('INVALID_STATE') || msg.includes('VALIDATION_ERROR')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
  }
});

/**
 * GET /api/owner/leases/:leaseId/deductions
 * Fetches all security deposit deductions for a given lease.
 */
router.get('/leases/:leaseId/deductions', requireAuth, requireRole(ALLOWED_OWNER_ROLES), requireDatabase, async (req, res) => {
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

export default router;
