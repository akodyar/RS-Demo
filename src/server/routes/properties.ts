import { Router } from 'express';
import { requireAuth, requirePropertyPermission, requireRole } from '../middleware/auth.js';
import { Permission, Property, UserRole } from '../../types/index.js';
import { propertyRepository } from '../repositories/properties.js';
import { auditService } from '../services/audit.js';
import { db } from '../../db/index.js';
import { leases, leaseTenants, users, rentSchedules, organizations } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireDatabase } from '../middleware/dbGuard.js';

const router = Router();

const checkDbConfig = requireDatabase;
import { pricingService } from '../services/pricing.js';

router.get('/pricing-tier', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const result = await pricingService.resolveTierForOwner(req.user!.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/eligible-agents', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const agents = await propertyRepository.getEligibleAgents();
    res.json({ status: 'ok', agents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', requireAuth, checkDbConfig, requireRole([
  UserRole.PROPERTY_OWNER, 
  UserRole.COMPANY, 
  UserRole.COMPANY_MEMBER, 
  UserRole.AGENT_BROKER, 
  UserRole.PLATFORM_ADMIN,
  'COMPANY',
  'COMPANY_MEMBER',
  'AGENT'
]), async (req, res) => {
  try {
    const rawKey = req.headers['idempotency-key'] ?? req.body?.idempotencyKey;
    const idempotencyKey = typeof rawKey === 'string' ? rawKey : (rawKey ? String(rawKey) : null);

    const creatorRoles = [...(req.user!.roles || [])];
    if (req.user!.activeRole && !creatorRoles.includes(req.user!.activeRole)) {
      creatorRoles.push(req.user!.activeRole);
    }
    if (req.user!.organizationId || (req.user!.workspaceId && req.user!.workspaceId.startsWith('company_'))) {
      if (!creatorRoles.includes('COMPANY')) creatorRoles.push('COMPANY');
      if (!creatorRoles.includes('COMPANY_ADMIN')) creatorRoles.push('COMPANY_ADMIN');
    }

    const propertyPayload = { ...req.body };
    if (!propertyPayload.ownerId && !propertyPayload.companyId && req.user!.organizationId) {
      propertyPayload.companyId = req.user!.organizationId;
    }

    const property = await propertyRepository.createProperty(req.user!.id, creatorRoles, propertyPayload, {
      idempotencyKey,
      scope: 'POST:/api/properties'
    });

    if (!(property as any).__isReplay) {
      await auditService.logAction({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles[0] as string,
        action: 'CREATE_PROPERTY',
        resourceType: 'Property',
        resourceId: property.id as string,
        changes: req.body,
        ipAddress: (req.ip || "") as string
      });
    }
    res.status(201).json(property);
  } catch (error: any) {
    const msg = error.message || 'Failed to create property';
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
    console.error('[PROPERTIES_ROUTE] Unexpected error in createProperty:', error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred while processing the property.'
    });
  }
});

router.get('/', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const properties = await propertyRepository.getPropertiesByOwner(req.user!.id);
    res.json(properties);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', requireAuth, checkDbConfig, requirePropertyPermission(Permission.VIEW_PROPERTY), async (req, res) => {
  try {
    const property = await propertyRepository.getPropertyById(req.params.id as string);
    if (!property) return res.status(404).json({ error: "Property not found" });
    res.json(property);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/management-preference', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const managementPreference = req.body.managementPreference || req.body.preference;
    const agentCompanyId = req.body.agentCompanyId || req.body.managingAgentId || req.body.agentId;
    if (!managementPreference) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'managementPreference is required.' });
    }

    const updated = await propertyRepository.setManagementPreference(
      req.user!.id,
      req.user!.roles,
      req.user!.organizationId,
      req.params.id as string,
      managementPreference,
      agentCompanyId
    );

    res.json({ status: 'ok', property: updated });
  } catch (error: any) {
    const msg = error.message || 'Failed to update management preference';
    if (msg.startsWith('FORBIDDEN:') || msg.includes('FORBIDDEN')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    }
    if (msg.startsWith('NOT_FOUND:')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.startsWith('CONFLICT:')) {
      return res.status(409).json({ error: 'CONFLICT', message: msg });
    }
    if (msg.startsWith('VALIDATION_ERROR:') || msg.startsWith('INVALID_')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    console.error('[PROPERTIES_ROUTE] Error setting management preference:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: msg });
  }
});

router.post('/:id/resubmit', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const updated = await propertyRepository.resubmitProperty(
      req.user!.id,
      req.user!.roles,
      req.params.id as string
    );
    res.json({ status: 'ok', property: updated });
  } catch (error: any) {
    const msg = error.message || 'Failed to resubmit property';
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: msg });
  }
});

router.patch('/:id/material-update', requireAuth, checkDbConfig, async (req, res) => {
  try {
    const result = await propertyRepository.handleMaterialPropertyUpdate(
      req.user!.id,
      req.user!.roles,
      req.params.id as string,
      req.body
    );
    res.json({ status: 'ok', requiresReReview: result.reReviewTriggered, ...result });
  } catch (error: any) {
    const msg = error.message || 'Failed to update property';
    if (msg.startsWith('FORBIDDEN:')) return res.status(403).json({ error: 'FORBIDDEN', message: msg });
    if (msg.startsWith('NOT_FOUND:')) return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR', message: msg });
  }
});

router.post('/:id/units', requireAuth, checkDbConfig, requirePropertyPermission(Permission.EDIT_PROPERTY), async (req, res) => {
  try {
    const unit = await propertyRepository.addUnit(req.params.id as string, req.body);
    res.status(201).json(unit);
  } catch (error: any) {
    const msg = error.message || 'Failed to create unit';
    if (msg.startsWith('CONFLICT:')) {
      return res.status(409).json({ error: 'CONFLICT', message: msg });
    }
    if (msg.startsWith('NOT_FOUND:')) {
      return res.status(404).json({ error: 'NOT_FOUND', message: msg });
    }
    if (msg.startsWith('VALIDATION_ERROR:') || msg.startsWith('INVALID_')) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: msg });
    }
    console.error('[PROPERTIES_ROUTE] Unexpected error in addUnit:', error);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred while creating the unit.'
    });
  }
});

// Leases for property
router.get('/:id/leases', requireAuth, checkDbConfig, requirePropertyPermission(Permission.VIEW_FINANCIALS), async (req, res) => {
  try {
    const propertyLeases = await db.select({
      lease: leases,
      tenant: users
    })
    .from(leases)
    .leftJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
    .leftJoin(users, eq(leaseTenants.tenantId, users.id))
    .where(eq(leases.propertyId, req.params.id as string));
    
    // Group by lease to handle multiple tenants nicely if needed, but for now just return the join
    res.json(propertyLeases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Authoritative financial summary for PropertyCommandCenter
router.get('/:id/financial-summary', requireAuth, checkDbConfig, requirePropertyPermission(Permission.VIEW_FINANCIALS), async (req, res) => {
  try {
    const summary = await propertyRepository.getAuthoritativeFinancialSummary(
      req.params.id as string,
      req.query.scheduleId as string | undefined
    );
    res.json(summary);
  } catch (error: any) {
    if (error.message === "Property not found") {
      return res.status(404).json({ error: "Property not found" });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
