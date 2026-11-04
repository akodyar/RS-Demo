import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/index.js';
import { eq, sql, and, or, ilike, desc } from 'drizzle-orm';
import {
  users,
  organizations,
  properties,
  listings,
  verificationRecords,
  auditLogs,
  disputes,
  journalEntries,
  maintenanceRequests,
  pricingTiers,
  financialPolicies,
  ownershipRecords
} from '../../db/schema.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { auditService } from '../services/audit.js';
import { propertyRepository } from '../repositories/properties.js';

const router = Router();

// Fine-grained admin role definitions
const ALL_ADMIN_ROLES = [
  'SUPER_ADMIN', 'PLATFORM_ADMIN', 'OPERATIONS_ADMIN', 'PROPERTY_ADMIN',
  'MARKETPLACE_ADMIN', 'VERIFICATION_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE_ADMIN',
  'SUPPORT_ADMIN', 'SECURITY_ADMIN', 'AI_GOVERNANCE_ADMIN', 'AUDITOR', 'READ_ONLY_ADMIN', 'ADMIN'
];

const requireAnyAdmin = requireRole(ALL_ADMIN_ROLES);
const requireSuperAdmin = requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN']);
const requireAdmin = requireRole(['ADMIN', 'SUPER_ADMIN', 'PLATFORM_ADMIN', 'OPERATIONS_ADMIN']);
const requireFinanceAdmin = requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'ADMIN', 'AUDITOR', 'READ_ONLY_ADMIN']);
const requireUserReader = requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN', 'SUPPORT_ADMIN', 'AUDITOR', 'READ_ONLY_ADMIN']);

// Mutation guard: Strictly deny READ_ONLY_ADMIN and AUDITOR from modifying platform state
const requireMutationPermission = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.roles?.some((r: string) => ['READ_ONLY_ADMIN', 'AUDITOR'].includes(r))) {
    return res.status(403).json({ error: 'Forbidden: Read-only administrator cannot perform mutations' });
  }
  next();
};

// Health
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    adminPersistence: 'PERSISTENT_POSTGRESQL',
    timestamp: new Date().toISOString(),
  });
});

// Metrics
router.get('/metrics', requireAuth, requireAnyAdmin, async (req, res) => {
  const [{ count: totalUsers }] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [{ count: totalCompanies }] = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  const [{ count: totalProperties }] = await db.select({ count: sql<number>`count(*)` }).from(properties);

  res.json({
    status: 'ok',
    metrics: {
      totalUsers: Number(totalUsers),
      totalCompanies: Number(totalCompanies),
      totalProperties: Number(totalProperties),
    },
    userComposition: [],
    criticalAlertsCount: 0,
    pendingApprovals: { tapu: 0, listings: 0, companies: 0 },
    revenueSummary: { totalMtd: 0, trend: 'up' },
    systemHealth: { database: 'Healthy', queue: 'Healthy' }
  });
});

// Users
router.get('/users', requireAuth, requireUserReader, async (req, res) => {
  const allUsers = await db.select().from(users);
  res.json({ status: 'ok', users: allUsers });
});

router.post('/users/:id/status', requireAuth, requireMutationPermission, requireSuperAdmin, async (req, res) => {
  const { status } = req.body;
  const id = req.params.id as string;
  const [user] = await db.update(users)
    .set({ isActive: status === 'active', updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
    
  if (!user) return res.status(404).json({ error: 'User not found' });
  
  await auditService.logAction({
    action: 'ADMIN_USER_STATUS_CHANGE',
    actorUserId: req.user!.id,
    actorRole: 'SUPER_ADMIN',
    resourceType: 'USER',
    resourceId: user.id,
    changes: { newStatus: status }
  });

  res.json({ status: 'ok', user });
});

router.post('/users/:id/role', requireAuth, requireMutationPermission, requireSuperAdmin, async (req, res) => {
  const { role } = req.body;
  const id = req.params.id as string;
  const [user] = await db.update(users)
    .set({ roles: [role], updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
    
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ status: 'ok', user });
});

router.post('/users', requireAuth, requireMutationPermission, requireSuperAdmin, async (req, res) => {
  const { firstName, lastName, email, phone, role } = req.body;
  if (!email || !firstName || !lastName) {
    return res.status(400).json({ error: 'Missing required fields: firstName, lastName, and email' });
  }

  const [newUser] = await db.insert(users).values({
    firstName,
    lastName,
    email,
    phone: phone || null,
    roles: role ? [role] : ['TENANT'],
    isActive: true,
  }).returning();

  await auditService.logAction({
    action: 'ADMIN_USER_CREATED',
    actorUserId: req.user!.id,
    actorRole: 'SUPER_ADMIN',
    resourceType: 'USER',
    resourceId: newUser.id,
    changes: { email, role: role || 'TENANT' },
  });

  res.status(201).json({ status: 'ok', user: newUser });
});

router.delete('/users/:id', requireAuth, requireMutationPermission, requireSuperAdmin, async (req, res) => {
  const id = req.params.id as string;
  const [deletedUser] = await db.delete(users).where(eq(users.id, id)).returning();
  if (!deletedUser) return res.status(404).json({ error: 'User not found' });

  await auditService.logAction({
    action: 'ADMIN_USER_DELETED',
    actorUserId: req.user!.id,
    actorRole: 'SUPER_ADMIN',
    resourceType: 'USER',
    resourceId: deletedUser.id,
    changes: { email: deletedUser.email },
  });

  res.json({ status: 'ok', deleted: true, id: deletedUser.id });
});

// Companies
router.get('/companies', requireAuth, requireAnyAdmin, async (req, res) => {
  const allOrgs = await db.select().from(organizations);
  res.json({ status: 'ok', companies: allOrgs });
});

router.post('/companies/:id/status', requireAuth, requireMutationPermission, requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'OPERATIONS_ADMIN']), async (req, res) => {
  const { status } = req.body;
  const id = req.params.id as string;
  const [company] = await db.update(organizations)
    .set({ status: status === 'active' ? 'VERIFIED' : 'PENDING_VERIFICATION', updatedAt: new Date() })
    .where(eq(organizations.id, id))
    .returning();
    
  if (!company) return res.status(404).json({ error: 'Company not found' });
  res.json({ status: 'ok', company });
});

// Properties with server-side pagination, search, filters, and fee metadata
router.get('/properties', requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const operatingModel = typeof req.query.operatingModel === 'string' ? req.query.operatingModel.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const verificationStatus = typeof req.query.verificationStatus === 'string' ? req.query.verificationStatus.trim() : '';

    // Fetch active global platform fee rate
    let globalPlatformFee = 0.05;
    try {
      const [feePolicy] = await db.select().from(financialPolicies)
        .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
        .limit(1);
      if (feePolicy) {
        globalPlatformFee = parseFloat(feePolicy.policyValue) || 0.05;
      }
    } catch (e) {
      console.warn('Failed to resolve PLATFORM_FEE_RATE, using fallback 0.05');
    }

    // Build conditions
    const conditions: any[] = [];

    if (city && city !== 'all') {
      conditions.push(sql`(${properties.address}->>'city' ILIKE ${'%' + city + '%'} OR ${properties.address}->>'cityKurdish' ILIKE ${'%' + city + '%'})`);
    }

    if (operatingModel && operatingModel !== 'all') {
      conditions.push(eq(properties.operatingModel, operatingModel));
    }

    if (status && status !== 'all') {
      conditions.push(eq(properties.status, status));
    }

    if (verificationStatus && verificationStatus !== 'all') {
      conditions.push(eq(properties.verificationStatus, verificationStatus));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(properties.name, searchPattern),
          ilike(properties.id, searchPattern),
          sql`(${properties.address}->>'city' ILIKE ${searchPattern})`,
          sql`(${properties.address}->>'tapuNumber' ILIKE ${searchPattern})`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db.select({
      count: sql<number>`count(*)`
    }).from(properties).where(whereClause);

    const totalCount = Number(countResult?.count || 0);

    // Fetch paginated properties
    const propRows = await db.select().from(properties)
      .where(whereClause)
      .orderBy(desc(properties.createdAt), desc(properties.id))
      .limit(limit)
      .offset((page - 1) * limit);

    // Fetch ownership and organization records for these properties to populate owner/agency names
    const propIds = propRows.map(p => p.id);
    const ownerMap = new Map<string, { name: string; id: string }>();
    const orgMap = new Map<string, string>();

    if (propIds.length > 0) {
      const owners = await db.select({
        propertyId: ownershipRecords.propertyId,
        ownerId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      }).from(ownershipRecords)
        .innerJoin(users, eq(ownershipRecords.ownerId, users.id))
        .where(sql`${ownershipRecords.propertyId} IN ${propIds}`);

      for (const o of owners) {
        if (!ownerMap.has(o.propertyId)) {
          ownerMap.set(o.propertyId, {
            id: o.ownerId,
            name: `${o.firstName || ''} ${o.lastName || ''}`.trim() || 'Owner'
          });
        }
      }

      const orgIds = propRows.map(p => p.managedByAgentId).filter((id): id is string => Boolean(id));
      if (orgIds.length > 0) {
        const orgs = await db.select().from(organizations)
          .where(sql`${organizations.id} IN ${orgIds}`);
        for (const org of orgs) {
          orgMap.set(org.id, org.name);
        }
      }
    }

    const formattedProperties = propRows.map(p => {
      const addr = (p.address as any) || {};
      const ownerInfo = ownerMap.get(p.id);
      const managingOrgName = p.managedByAgentId ? orgMap.get(p.managedByAgentId) : undefined;

      return {
        id: p.id,
        title: p.name,
        titleKurdish: p.name,
        type: p.type || 'APARTMENT',
        address: addr,
        city: addr.city || 'Erbil',
        priceUsd: Number(p.acquisitionCost || 0),
        priceIqd: Number(p.acquisitionCost || 0) * 1530,
        ownerName: ownerInfo?.name || 'HomeHub Property Owner',
        ownerId: ownerInfo?.id || '',
        managingAgencyName: managingOrgName,
        managingAgencyId: p.managedByAgentId || undefined,
        tapuNumber: addr.tapuNumber || `TN-${p.id.substring(0, 8)}`,
        tapuStatus: (p.verificationStatus as any) || (p.status as any) || 'PENDING_VERIFICATION',
        verificationStatus: p.verificationStatus || (p.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING_VERIFICATION'),
        rejectionReason: p.rejectionReason || null,
        managementPreference: p.managementPreference || null,
        managementArrangementStatus: p.managementArrangementStatus || 'NOT_APPLICABLE',
        photos: Array.isArray(p.photos) ? p.photos : [],
        documents: Array.isArray(p.documents) ? p.documents : [],
        verifiedAt: p.verifiedAt ? new Date(p.verifiedAt).toISOString() : null,
        verifiedBy: p.verifiedBy || null,
        dateSubmitted: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '2026-01-01',
        unitsCount: 1,
        isOccupied: false,
        operatingModel: p.operatingModel || 'FULLY_MANAGED',
        rentFee: p.rentFee !== null && p.rentFee !== undefined && p.rentFee !== '' ? Number(p.rentFee) : null,
        managementFee: p.managementFee !== null && p.managementFee !== undefined && p.managementFee !== '' ? Number(p.managementFee) : null,
        platformFee: globalPlatformFee,
        currency: p.currency || 'IQD'
      };
    });

    res.json({
      status: 'ok',
      properties: formattedProperties,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      },
      globalPlatformFee
    });
  } catch (error: any) {
    console.error('Failed to fetch admin properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Helper to validate fee values: null or number between 0 and 0.50 with max 4 decimal places
const validateFeeRate = (val: any, feeName: string) => {
  if (val === null || val === undefined || val === '') return { valid: true, parsed: null };
  const n = Number(val);
  if (isNaN(n) || !isFinite(n)) return { valid: false, error: `${feeName} must be a valid number or null` };
  if (n < 0) return { valid: false, error: `${feeName} cannot be negative` };
  if (n > 0.50) return { valid: false, error: `${feeName} cannot exceed 50% (0.50)` };
  const parts = String(val).trim().split('.');
  if (parts.length === 2 && parts[1].length > 4) {
    return { valid: false, error: `${feeName} precision cannot exceed 4 decimal places` };
  }
  return { valid: true, parsed: n };
};

const updatePropertyFeesHandler = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { rentFee, managementFee } = req.body;

    const [prop] = await db.select().from(properties).where(eq(properties.id, id)).limit(1);
    if (!prop) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const model = prop.operatingModel || 'FULLY_MANAGED';

    // Operating model applicability validation
    if (model === 'AGENT_OPERATED') {
      const hasRentFee = rentFee !== undefined && rentFee !== null && rentFee !== '';
      const hasMgmtFee = managementFee !== undefined && managementFee !== null && managementFee !== '';
      if (hasRentFee || hasMgmtFee) {
        return res.status(400).json({
          error: 'Rent fee and management fee do not apply to AGENT_OPERATED operating model',
          code: 'INCOMPATIBLE_FEE_FOR_OPERATING_MODEL',
          message: 'AGENT_OPERATED properties cannot have Rent Fee or Management Fee configured.'
        });
      }
    } else if (model === 'AGENT_LISTED_PLATFORM_MANAGED') {
      const hasRentFee = rentFee !== undefined && rentFee !== null && rentFee !== '';
      if (hasRentFee) {
        return res.status(400).json({
          error: 'Rent fee does not apply to AGENT_LISTED_PLATFORM_MANAGED operating model',
          code: 'INCOMPATIBLE_FEE_FOR_OPERATING_MODEL',
          message: 'AGENT_LISTED_PLATFORM_MANAGED properties cannot have Rent Fee configured.'
        });
      }
    }

    let nextRentFee = prop.rentFee;
    let nextMgmtFee = prop.managementFee;

    if (rentFee !== undefined) {
      const val = validateFeeRate(rentFee, 'Rent Fee');
      if (!val.valid) return res.status(400).json({ error: val.error });
      nextRentFee = val.parsed !== null ? String(val.parsed) : null;
    }

    if (managementFee !== undefined) {
      const val = validateFeeRate(managementFee, 'Management Fee');
      if (!val.valid) return res.status(400).json({ error: val.error });
      nextMgmtFee = val.parsed !== null ? String(val.parsed) : null;
    }

    const oldRentNum = prop.rentFee !== null && prop.rentFee !== undefined && prop.rentFee !== '' ? Number(prop.rentFee) : null;
    const newRentNum = nextRentFee !== null ? Number(nextRentFee) : null;
    const oldMgmtNum = prop.managementFee !== null && prop.managementFee !== undefined && prop.managementFee !== '' ? Number(prop.managementFee) : null;
    const newMgmtNum = nextMgmtFee !== null ? Number(nextMgmtFee) : null;

    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.update(properties).set({
        rentFee: nextRentFee,
        managementFee: nextMgmtFee,
        updatedAt: now
      }).where(eq(properties.id, id));

      await tx.insert(auditLogs).values({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles?.[0] || 'ADMIN',
        action: 'UPDATE_PROPERTY_FEES',
        resourceType: 'Property',
        resourceId: id,
        timestamp: now,
        changes: {
          propertyId: id,
          operatingModel: model,
          oldRentFee: oldRentNum,
          newRentFee: newRentNum,
          oldManagementFee: oldMgmtNum,
          newManagementFee: newMgmtNum,
          effectiveFrom: now.toISOString()
        }
      });
    });

    res.json({
      status: 'ok',
      message: 'Property fees updated successfully',
      property: {
        id: prop.id,
        operatingModel: model,
        rentFee: newRentNum,
        managementFee: newMgmtNum,
        updatedAt: now.toISOString()
      }
    });
  } catch (err: any) {
    console.error('Failed to update property fees:', err);
    res.status(500).json({ error: 'Failed to update property fees' });
  }
};

router.patch('/properties/:id/fees', requireAuth, requireMutationPermission, requireFinanceAdmin, updatePropertyFeesHandler);
router.post('/properties/:id/fees', requireAuth, requireMutationPermission, requireFinanceAdmin, updatePropertyFeesHandler);


router.post('/properties/:id/tapu-status', requireAuth, requireMutationPermission, requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'COMPLIANCE_ADMIN', 'VERIFICATION_ADMIN', 'PROPERTY_ADMIN']), async (req, res) => {
  const { tapuStatus } = req.body;
  const id = req.params.id as string;
  const [prop] = await db.update(properties)
    .set({
      status: tapuStatus,
      verificationStatus: tapuStatus === 'VERIFIED' ? 'VERIFIED' : tapuStatus === 'REJECTED' ? 'REJECTED' : 'PENDING_VERIFICATION',
      updatedAt: new Date()
    })
    .where(eq(properties.id, id))
    .returning();
    
  if (!prop) return res.status(404).json({ error: 'Property not found' });
  res.json({ status: 'ok', property: prop });
});

router.post('/properties/:id/approve', requireAuth, requireMutationPermission, requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'COMPLIANCE_ADMIN', 'VERIFICATION_ADMIN', 'PROPERTY_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { notes } = req.body || {};
    const prop = await propertyRepository.approveProperty(req.user!.id, req.user!.roles || ['PLATFORM_ADMIN'], id, notes);
    res.json({ status: 'ok', property: prop });
  } catch (error: any) {
    const msg = error.message || 'Failed to approve property';
    if (msg.includes('not found') || msg.startsWith('NOT_FOUND:')) {
      return res.status(404).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
});

router.post('/properties/:id/reject', requireAuth, requireMutationPermission, requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'COMPLIANCE_ADMIN', 'VERIFICATION_ADMIN', 'PROPERTY_ADMIN', 'ADMIN', 'OPERATIONS_ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required and must not be empty' });
    }
    const prop = await propertyRepository.rejectProperty(req.user!.id, req.user!.roles || ['PLATFORM_ADMIN'], id, reason.trim());
    res.json({ status: 'ok', property: prop });
  } catch (error: any) {
    const msg = error.message || 'Failed to reject property';
    if (msg.includes('not found') || msg.startsWith('NOT_FOUND:')) {
      return res.status(404).json({ error: msg });
    }
    if (msg.includes('required')) {
      return res.status(400).json({ error: msg });
    }
    res.status(500).json({ error: msg });
  }
});

router.get('/properties/:id/verification-history', requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    const history = await db.select({
      id: verificationRecords.id,
      subjectType: verificationRecords.subjectType,
      subjectId: verificationRecords.subjectId,
      status: verificationRecords.status,
      notes: verificationRecords.reviewNotes,
      rejectionReason: verificationRecords.rejectionReason,
      createdAt: verificationRecords.createdAt,
      reviewerId: verificationRecords.reviewedBy,
      reviewerFirstName: users.firstName,
      reviewerLastName: users.lastName,
      reviewerEmail: users.email
    })
    .from(verificationRecords)
    .leftJoin(users, eq(verificationRecords.reviewedBy, users.id))
    .where(and(
      eq(verificationRecords.subjectType, 'PROPERTY'),
      or(eq(verificationRecords.propertyId, id), eq(verificationRecords.subjectId, id))
    ))
    .orderBy(desc(verificationRecords.createdAt));

    res.json({ status: 'ok', history });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch verification history' });
  }
});

// Marketplace
router.get('/marketplace', requireAuth, requireAnyAdmin, async (req, res) => {
  const allListings = await db.select().from(listings);
  res.json({ status: 'ok', marketplace: allListings });
});

router.post('/marketplace/:id/status', requireAuth, requireMutationPermission, requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'MARKETPLACE_ADMIN']), async (req, res) => {
  const { status } = req.body;
  const id = req.params.id as string;
  const [listing] = await db.update(listings)
    .set({ status, updatedAt: new Date() })
    .where(eq(listings.id, id))
    .returning();
    
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json({ status: 'ok', listing });
});

// Verifications
router.get('/verifications', requireAuth, requireAnyAdmin, async (req, res) => {
  const verifications = await db.select().from(verificationRecords);
  res.json({ status: 'ok', verifications });
});

router.post('/verifications/:id/status', requireAuth, requireMutationPermission, requireRole(['SUPER_ADMIN', 'PLATFORM_ADMIN', 'VERIFICATION_ADMIN', 'COMPLIANCE_ADMIN']), async (req, res) => {
  const { status } = req.body;
  const id = req.params.id as string;
  const [verif] = await db.update(verificationRecords)
    .set({ status, reviewedAt: new Date(), reviewedBy: req.user!.id })
    .where(eq(verificationRecords.id, id))
    .returning();
    
  if (!verif) return res.status(404).json({ error: 'Verification not found' });
  res.json({ status: 'ok', verification: verif });
});

// Audit Logs
router.get('/audit-logs', requireAuth, requireAnyAdmin, async (req, res) => {
  const logs = await db.select().from(auditLogs).limit(500);
  res.json({ status: 'ok', auditLogs: logs });
});

// Finance Ledger
router.get('/finance/ledger', requireAuth, requireFinanceAdmin, async (req, res) => {
  const entries = await db.select().from(journalEntries).limit(500);
  res.json({ status: 'ok', ledger: entries });
});

// Maintenance
router.get('/maintenance', requireAuth, requireAdmin, async (req, res) => {
  const requests = await db.select().from(maintenanceRequests).limit(500);
  res.json({ status: 'ok', maintenance: requests });
});

// Disputes
router.get('/disputes', requireAuth, requireAdmin, async (req, res) => {
  const allDisputes = await db.select().from(disputes).limit(500);
  res.json({ status: 'ok', disputes: allDisputes });
});

router.post('/disputes', requireAuth, requireSuperAdmin, async (req, res) => {
  const { title, category, description, initiatorUserId, status } = req.body;
  if (!title || !description || !initiatorUserId) {
    return res.status(400).json({ error: 'Missing required fields: title, description, initiatorUserId' });
  }

  const disputeNumber = `DSP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;

  const [newDispute] = await db.insert(disputes).values({
    disputeNumber,
    title,
    category: category || 'OTHER',
    description,
    initiatorUserId,
    status: status || 'OPEN',
    resolutionOutcome: 'PENDING',
    externalLegalReviewRequired: false,
  }).returning();

  await auditService.logAction({
    action: 'ADMIN_DISPUTE_CREATED',
    actorUserId: req.user!.id,
    actorRole: 'SUPER_ADMIN',
    resourceType: 'DISPUTE',
    resourceId: newDispute.id,
    changes: { disputeNumber, title },
  });

  res.status(201).json({ status: 'ok', dispute: newDispute });
});

router.delete('/disputes/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const id = req.params.id as string;
  const [deleted] = await db.delete(disputes).where(eq(disputes.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: 'Dispute not found' });

  await auditService.logAction({
    action: 'ADMIN_DISPUTE_DELETED',
    actorUserId: req.user!.id,
    actorRole: 'SUPER_ADMIN',
    resourceType: 'DISPUTE',
    resourceId: deleted.id,
    changes: { disputeNumber: deleted.disputeNumber },
  });

  res.json({ status: 'ok', deleted: true, id: deleted.id });
});

// Pricing Tiers
router.get('/pricing-tiers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const tiers = await db.select().from(pricingTiers).orderBy(pricingTiers.priority);
    res.json({ status: 'ok', pricingTiers: tiers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing tiers' });
  }
});

router.post('/pricing-tiers', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, minProperties, maxProperties, rentFeeRate, managementFeeRate, priority } = req.body;
    
    // Validate
    if (minProperties < 0) return res.status(400).json({ error: 'minProperties cannot be negative' });
    if (maxProperties !== null && maxProperties < minProperties) {
      return res.status(400).json({ error: 'maxProperties cannot be less than minProperties' });
    }

    const [newTier] = await db.insert(pricingTiers).values({
      name,
      minProperties,
      maxProperties,
      rentFeeRate,
      managementFeeRate,
      priority
    }).returning();

    await auditService.logAction({
      action: 'ADMIN_PRICING_TIER_CREATED',
      actorUserId: req.user!.id,
      actorRole: 'SUPER_ADMIN',
      resourceType: 'PRICING_TIER',
      resourceId: newTier.id,
      changes: newTier,
    });

    res.status(201).json({ status: 'ok', tier: newTier });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create pricing tier' });
  }
});

router.put('/pricing-tiers/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, minProperties, maxProperties, rentFeeRate, managementFeeRate, priority } = req.body;
    const id = req.params.id as string;
    
    if (minProperties < 0) return res.status(400).json({ error: 'minProperties cannot be negative' });
    if (maxProperties !== null && maxProperties < minProperties) {
      return res.status(400).json({ error: 'maxProperties cannot be less than minProperties' });
    }

    const [updated] = await db.update(pricingTiers).set({
      name,
      minProperties,
      maxProperties,
      rentFeeRate,
      managementFeeRate,
      priority,
      updatedAt: new Date()
    }).where(eq(pricingTiers.id, id)).returning();

    if (!updated) return res.status(404).json({ error: 'Tier not found' });

    await auditService.logAction({
      action: 'ADMIN_PRICING_TIER_UPDATED',
      actorUserId: req.user!.id,
      actorRole: 'SUPER_ADMIN',
      resourceType: 'PRICING_TIER',
      resourceId: updated.id,
      changes: updated,
    });

    res.json({ status: 'ok', tier: updated });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing tier' });
  }
});

router.delete('/pricing-tiers/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id as string;
    const [deleted] = await db.delete(pricingTiers).where(eq(pricingTiers.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Tier not found' });

    await auditService.logAction({
      action: 'ADMIN_PRICING_TIER_DELETED',
      actorUserId: req.user!.id,
      actorRole: 'SUPER_ADMIN',
      resourceType: 'PRICING_TIER',
      resourceId: deleted.id,
      changes: { name: deleted.name },
    });

    res.json({ status: 'ok', deleted: true, id: deleted.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete pricing tier' });
  }
});

// AI Governance
router.get('/ai-governance', requireAuth, requireAdmin, (req, res) => {
  res.json({ status: 'ok', aiGovernance: [], items: [] });
});

// Security Events (Stub for now, as table wasn't verified fully)
router.get('/security-events', requireAuth, requireAdmin, (req, res) => {
  res.json({ status: 'ok', securityEvents: [] });
});

// Reports
router.get('/reports', requireAuth, requireAdmin, (req, res) => {
  res.json({ status: 'ok', reports: [] });
});

// Fee Management Validation Helper
function validatePlatformFeeRate(rate: any): { valid: boolean; error?: string; parsedRate?: number } {
  if (rate === undefined || rate === null || rate === '') {
    return { valid: false, error: 'Platform fee rate is required' };
  }
  if (typeof rate !== 'number' && typeof rate !== 'string') {
    return { valid: false, error: 'Platform fee rate must be a valid number' };
  }
  if (typeof rate === 'string' && rate.trim() === '') {
    return { valid: false, error: 'Platform fee rate cannot be empty' };
  }
  const numRate = Number(rate);
  if (isNaN(numRate) || !isFinite(numRate)) {
    return { valid: false, error: 'Platform fee rate must be a valid finite number' };
  }
  if (numRate < 0) {
    return { valid: false, error: 'Platform fee rate cannot be negative' };
  }
  if (numRate > 0.50) {
    return { valid: false, error: 'Platform fee rate cannot exceed 50% (0.50)' };
  }
  const strVal = String(rate).trim();
  const decimalParts = strVal.split('.');
  if (decimalParts.length === 2 && decimalParts[1].length > 4) {
    return { valid: false, error: 'Platform fee rate precision cannot exceed 4 decimal places' };
  }
  return { valid: true, parsedRate: numRate };
}

// Fee Management Endpoints
router.get('/fees', requireAuth, requireAnyAdmin, async (req, res) => {
  try {
    const { financialPolicies } = await import('../../db/schema.js');
    const [policy] = await db.select().from(financialPolicies)
      .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
      .limit(1);

    const platformFeeRate = policy ? parseFloat(policy.policyValue) : 0.03;

    res.json({
      status: 'ok',
      fees: {
        platformFee: {
          key: 'PLATFORM_FEE_RATE',
          name: 'Global Platform Fee',
          rate: platformFeeRate,
          description: policy?.description || 'Universal system platform fee charged to owner on confirmed collections across all operating models.',
          effectiveFrom: policy?.effectiveFrom || null,
          updatedAt: policy?.updatedAt || null,
          active: policy ? policy.active : true,
          scope: 'GLOBAL',
        },
        operatingModelMatrix: {
          FULLY_MANAGED: {
            name: 'Fully Managed',
            platformFee: { applies: true, scope: 'GLOBAL' },
            rentFee: { applies: true, scope: 'PROPERTY_SPECIFIC' },
            managementFee: { applies: true, scope: 'PROPERTY_SPECIFIC' },
          },
          AGENT_LISTED_PLATFORM_MANAGED: {
            name: 'Agent Listed Platform Managed',
            platformFee: { applies: true, scope: 'GLOBAL' },
            rentFee: { applies: false, scope: 'INAPPLICABLE' },
            managementFee: { applies: true, scope: 'PROPERTY_SPECIFIC' },
          },
          AGENT_OPERATED: {
            name: 'Agent Operated',
            platformFee: { applies: true, scope: 'GLOBAL' },
            rentFee: { applies: false, scope: 'INAPPLICABLE' },
            managementFee: { applies: false, scope: 'INAPPLICABLE' },
          },
        },
        propertyFeesPolicy: {
          rentFee: {
            name: 'Rent Fee',
            scope: 'PROPERTY_SPECIFIC',
            description: 'Property-specific agreed percentage. Unset by default (never silently defaulted to 0%). Applies only to FULLY_MANAGED properties on confirmed collected rent.',
          },
          managementFee: {
            name: 'Management Fee',
            scope: 'PROPERTY_SPECIFIC',
            description: 'Property-specific agreed percentage. Unset by default (never silently defaulted to 0%). Applies to FULLY_MANAGED and AGENT_LISTED_PLATFORM_MANAGED properties on confirmed collected rent.',
          },
        },
        portfolioTiersStatus: {
          enabled: false,
          status: 'INACTIVE_UNAPPROVED',
          message: 'Configurable portfolio-based fee tiers are defined in schema but tier thresholds and percentages are not approved in this release.',
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch fee configuration:', error);
    res.status(500).json({ error: 'Failed to fetch fee configuration' });
  }
});

const updatePlatformFeeHandler = async (req: Request, res: Response) => {
  try {
    const rawRate = req.body.rate !== undefined ? req.body.rate : req.body.platformFeeRate;
    const validation = validatePlatformFeeRate(rawRate);
    if (!validation.valid || validation.parsedRate === undefined) {
      return res.status(400).json({ error: validation.error || 'Invalid platform fee rate' });
    }

    const numRate = validation.parsedRate;
    const { financialPolicies } = await import('../../db/schema.js');
    const { auditService } = await import('../services/audit.js');

    const existing = await db.select().from(financialPolicies)
      .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
      .limit(1);

    const oldRate = existing.length > 0 ? parseFloat(existing[0].policyValue) : 0.03;
    const now = new Date();

    let updatedPolicy: any;
    if (existing.length > 0) {
      const [up] = await db.update(financialPolicies)
        .set({
          policyValue: String(numRate),
          effectiveFrom: now,
          updatedAt: now,
        })
        .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
        .returning();
      updatedPolicy = up;
    } else {
      const [ins] = await db.insert(financialPolicies).values({
        policyType: 'PLATFORM_FEE_RATE',
        policyValue: String(numRate),
        active: true,
        effectiveFrom: now,
        description: 'Global HomeHub Platform Fee Rate',
      }).returning();
      updatedPolicy = ins;
    }

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles?.[0] || 'ADMIN',
      action: 'PLATFORM_FEE_RATE_UPDATED',
      resourceType: 'FinancialPolicy',
      resourceId: 'PLATFORM_FEE_RATE',
      changes: { oldRate, newRate: numRate, effectiveFrom: now.toISOString() },
    });

    res.json({
      status: 'ok',
      platformFee: {
        rate: numRate,
        oldRate,
        effectiveFrom: updatedPolicy.effectiveFrom,
        updatedAt: updatedPolicy.updatedAt,
      },
      message: 'Global Platform Fee updated successfully. New rate applies to future confirmed collections; historical transactions preserved.',
    });
  } catch (error) {
    console.error('Failed to update platform fee rate:', error);
    res.status(500).json({ error: 'Failed to update platform fee rate' });
  }
};

router.patch('/fees/platform', requireAuth, requireMutationPermission, requireFinanceAdmin, updatePlatformFeeHandler);
router.post('/fees/platform', requireAuth, requireMutationPermission, requireFinanceAdmin, updatePlatformFeeHandler);

// Settings
router.get('/settings', requireAuth, requireAdmin, async (req, res) => {
  const { financeService } = await import('../services/finance.js');
  const platformFeeRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');
  let exchangeRateIqd = 1530; // fallback if not found
  try {
    exchangeRateIqd = await financeService.fetchFinancialPolicy('EXCHANGE_RATE_IQD');
  } catch (e) {
    console.warn('EXCHANGE_RATE_IQD policy not found, using fallback 1530');
  }
  res.json({ status: 'ok', settings: { exchangeRateIqd, platformFeeRate } });
});

router.post('/settings', requireAuth, requireMutationPermission, requireAdmin, async (req, res) => {
  try {
    const { platformFeeRate, exchangeRateIqd } = req.body;
    const { financialPolicies } = await import('../../db/schema.js');
    const { auditService } = await import('../services/audit.js');

    if (platformFeeRate !== undefined) {
      const validation = validatePlatformFeeRate(platformFeeRate);
      if (!validation.valid || validation.parsedRate === undefined) {
        return res.status(400).json({ error: validation.error || 'Platform fee rate must be a valid number between 0 and 0.50' });
      }
      const numRate = validation.parsedRate;
      const existing = await db.select().from(financialPolicies)
        .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
        .limit(1);

      const oldRate = existing.length > 0 ? parseFloat(existing[0].policyValue) : 0.03;
      const now = new Date();

      if (existing.length > 0) {
        await db.update(financialPolicies)
          .set({ policyValue: String(numRate), effectiveFrom: now, updatedAt: now })
          .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'));
      } else {
        await db.insert(financialPolicies).values({
          policyType: 'PLATFORM_FEE_RATE',
          policyValue: String(numRate),
          effectiveFrom: now,
          active: true,
          description: 'Global HomeHub Platform Fee Rate',
        });
      }
      await auditService.logAction({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles?.[0] || 'ADMIN',
        action: 'PLATFORM_FEE_RATE_UPDATED',
        resourceType: 'FinancialPolicy',
        resourceId: 'PLATFORM_FEE_RATE',
        changes: { oldRate, newRate: numRate, effectiveFrom: now.toISOString() },
      });
    }

    if (exchangeRateIqd !== undefined) {
      const numRate = Number(exchangeRateIqd);
      if (isNaN(numRate) || numRate <= 0) {
        return res.status(400).json({ error: 'Exchange rate must be a positive number (IQD per USD)' });
      }
      const existing = await db.select().from(financialPolicies)
        .where(eq(financialPolicies.policyType, 'EXCHANGE_RATE_IQD'))
        .limit(1);
      if (existing.length > 0) {
        await db.update(financialPolicies)
          .set({ policyValue: String(numRate), updatedAt: new Date() })
          .where(eq(financialPolicies.policyType, 'EXCHANGE_RATE_IQD'));
      } else {
        await db.insert(financialPolicies).values({
          policyType: 'EXCHANGE_RATE_IQD',
          policyValue: String(numRate),
          active: true,
          description: 'Exchange Rate IQD per 1 USD',
        });
      }
      await auditService.logAction({
        actorUserId: req.user!.id,
        actorRole: req.user!.roles?.[0] || 'ADMIN',
        action: 'EXCHANGE_RATE_IQD_UPDATED',
        resourceType: 'FinancialPolicy',
        resourceId: 'EXCHANGE_RATE_IQD',
        changes: { newRate: numRate },
      });
    }

    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Admin settings update error:', err);
    res.status(500).json({ error: err.message || 'Failed to update settings' });
  }
});

import { utilityBillRepository } from '../repositories/utility-bills.js';

/**
 * POST /api/admin/utility-bills
 * Admin creates a new utility bill
 */
router.post('/utility-bills', requireAuth, requireRole(['PLATFORM_ADMIN', 'SYSTEM_ADMIN']), async (req, res) => {
  try {
    const { propertyId, unitId, tenantId, type, description, amount, billingDate, dueDate } = req.body;
    if (!propertyId || !type || !amount || !billingDate) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Missing required bill fields' });
    }
    const newBill = await utilityBillRepository.createBill({
      propertyId, unitId, tenantId, type, description, amount, billingDate, dueDate
    }, req.user!.id);
    res.status(201).json(newBill);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/admin/utility-bills/:id/collect-cash
 * Admin cash collection
 */
router.post('/utility-bills/:id/collect-cash', requireAuth, requireRole(['PLATFORM_ADMIN', 'SYSTEM_ADMIN']), async (req, res) => {
  try {
    const { amount, payerId } = req.body;
    if (!amount || amount <= 0 || !payerId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Valid amount and payerId are required' });
    }
    const result = await utilityBillRepository.payBill(req.params.id as string, Number(amount), 'CASH', payerId, req.user!.id);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
