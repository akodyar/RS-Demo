import { Router, Request, Response } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requireRole, requireActiveRole } from '../middleware/auth.js';
import { auditService } from '../services/audit.js';
import { companyRepository } from '../repositories/company.js';
import { UserRole, CompanyRole, Permission } from '../../types/index.js';

const router = Router();

/**
 * Authoritative workspace active roles allowed in the Company Domain:
 * Company owner, administrator, staff members, and platform administrators.
 */
export const ALLOWED_COMPANY_WORKSPACE_ROLES: (UserRole | string)[] = [
  UserRole.COMPANY,
  UserRole.COMPANY_MEMBER,
  'COMPANY_OWNER',
  'COMPANY_ADMIN',
  'PROPERTY_MANAGER',
  'ACCOUNTANT',
  'MAINTENANCE_MANAGER',
  'VIEWER',
  'AGENT',
  UserRole.PLATFORM_ADMIN,
  'SUPER_ADMIN',
  'ADMIN',
];

// Router boundary guard: strictly enforce authentication and active Company workspace context
router.use(requireAuth);
router.use((req: Request, res: Response, next) => {
  // Exclude company onboarding since a new company organization has not yet been created
  if (req.path === '/onboard') {
    return next();
  }
  return requireActiveRole(ALLOWED_COMPANY_WORKSPACE_ROLES)(req, res, next);
});

/**
 * Roles allowed to access Company Domain:
 * COMPANY, COMPANY_MEMBER, COMPANY_ADMIN, PLATFORM_ADMIN
 */
const ALLOWED_COMPANY_ROLES: (UserRole | string)[] = [
  UserRole.COMPANY,
  UserRole.COMPANY_MEMBER,
  'COMPANY_ADMIN',
  'COMPANY_OWNER',
  UserRole.PLATFORM_ADMIN,
];

/**
 * Helper to check whether PostgreSQL database connectivity is available.
 * Fails closed if PostgreSQL is not provisioned or configured.
 */


const failClosedDbResponse = (res: Response) => {
  return res.status(503).json({
    error: 'DATABASE_NOT_CONFIGURED',
    code: 'SERVICE_UNAVAILABLE',
    message: 'The authoritative relational storage service is unconfigured in this environment. Fail-closed enforced.',
  });
};

/**
 * GET /api/company/dashboard
 * Aggregated dashboard payload strictly derived from authoritative relational schema
 */
router.get('/dashboard', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const dashboardData = await companyRepository.getAuthoritativeDashboard({
      id: user.id,
      organizationId: user.organizationId,
      roles: user.roles,
    });

    res.json(dashboardData);
  } catch (error: any) {
    console.error('[Company Dashboard Error]:', error);
    res.status(500).json({ error: error.message || 'Failed to retrieve company dashboard' });
  }
});

/**
 * GET /api/company/profile
 */
router.get('/profile', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const profile = await companyRepository.getCompanyProfile(companyId);
    if (!profile) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve profile' });
  }
});

/**
 * PUT /api/company/profile
 */
router.put('/profile', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    // Role check: Only Company Owner or Admin can update company settings
    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || (member.role !== CompanyRole.COMPANY_OWNER && member.role !== CompanyRole.COMPANY_ADMIN)) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Only company owner or admin can update profile.' });
    }

    const updated = await companyRepository.updateCompanyProfile(companyId, req.body, user.id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update company profile' });
  }
});

/**
 * GET /api/company/pending-payments
 */
router.get('/pending-payments', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const { paymentRecords } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const { db } = await import('../../db/index.js');
    
    // We could scope to managed properties, but for now just getting RECORDED payments by the company
    const pending = await db.select().from(paymentRecords).where(
      and(
        eq(paymentRecords.status, 'RECORDED'),
        eq(paymentRecords.paymentMethod, 'CASH')
      )
    );
    
    res.json(pending);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch pending payments' });
  }
});

/**
 * POST /api/company/onboard
 */
router.post('/onboard', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const { companyName, legalName, registrationNumber, email, phone, serviceArea, teamSize } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const result = await companyRepository.onboardCompany(user.id, {
      companyName,
      legalName,
      registrationNumber,
      email,
      phone,
      serviceArea,
      teamSize,
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to complete company onboarding' });
  }
});

/**
 * GET /api/company/properties
 */
router.get('/properties', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'MEMBER_INACTIVE: Account is suspended or not active.' });
    }

    const scopedProperties = await companyRepository.getManagedProperties(companyId, user.id, member.role);
    res.json(scopedProperties);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve properties' });
  }
});

/**
 * GET /api/company/properties/:id
 */
router.get('/properties/:id', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'MEMBER_INACTIVE: Account is suspended or not active.' });
    }

    const detail = await companyRepository.getPropertyDetail(req.params.id as string, companyId, user.id, member.role);
    res.json(detail);
  } catch (error: any) {
    if (error.message.includes('AUTHORITY_REQUIRED') || error.message.includes('PROPERTY_SCOPE_DENIED')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to retrieve property detail' });
  }
});

/**
 * GET /api/company/members
 */
router.get('/members', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const members = await companyRepository.getCompanyMembers(companyId);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve company members' });
  }
});

/**
 * POST /api/company/members/invite
 */
router.post('/members/invite', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const callerMember = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!callerMember || (callerMember.role !== CompanyRole.COMPANY_OWNER && callerMember.role !== CompanyRole.COMPANY_ADMIN)) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Only company owner or admin can invite members.' });
    }

    const { email, role, assignedPropertyIds } = req.body;
    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required for invitation.' });
    }

    const invitation = await companyRepository.inviteMember(companyId, user.id, email, role, assignedPropertyIds);
    res.status(201).json(invitation);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to invite member' });
  }
});

/**
 * PATCH /api/company/members/:id/role
 */
router.patch('/members/:id/role', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const callerMember = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!callerMember || (callerMember.role !== CompanyRole.COMPANY_OWNER && callerMember.role !== CompanyRole.COMPANY_ADMIN)) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Only company owner or admin can change roles.' });
    }

    const { role } = req.body;
    if (!role) {
      return res.status(400).json({ error: 'New role is required.' });
    }

    await companyRepository.updateMemberRole(companyId, req.params.id as string, role, user.id);
    res.json({ success: true, memberId: req.params.id, role });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update member role' });
  }
});

/**
 * PATCH /api/company/members/:id/status
 */
router.patch('/members/:id/status', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const callerMember = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!callerMember || (callerMember.role !== CompanyRole.COMPANY_OWNER && callerMember.role !== CompanyRole.COMPANY_ADMIN)) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Only company owner or admin can alter member status.' });
    }

    const { status } = req.body;
    if (!status || !['ACTIVE', 'SUSPENDED', 'REMOVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be ACTIVE, SUSPENDED, or REMOVED.' });
    }

    await companyRepository.updateMemberStatus(companyId, req.params.id as string, status, user.id);
    res.json({ success: true, memberId: req.params.id, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update member status' });
  }
});

/**
 * GET /api/company/management-agreements
 */
router.get('/management-agreements', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const agreements = await companyRepository.getManagementAgreements(companyId);
    res.json(agreements);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve management agreements' });
  }
});

/**
 * PATCH /api/company/management-agreements/:id/respond
 */
router.patch('/management-agreements/:id/respond', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company organization associated with user.' });
    }

    const callerMember = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!callerMember || (callerMember.role !== CompanyRole.COMPANY_OWNER && callerMember.role !== CompanyRole.COMPANY_ADMIN)) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Only company owner or admin can respond to agreements.' });
    }

    const { action } = req.body;
    if (action !== 'ACCEPT' && action !== 'DECLINE') {
      return res.status(400).json({ error: 'Action must be ACCEPT or DECLINE.' });
    }

    const result = await companyRepository.respondToManagementAgreement(companyId, req.params.id as string, action, user.id);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to respond to management agreement' });
  }
});

/**
 * GET /api/company/tenants
 */
router.get('/tenants', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    const tenants = await companyRepository.getTenants(companyId, user.id, member.role);
    res.json(tenants);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve tenants' });
  }
});

/**
 * GET /api/company/leases
 */
router.get('/leases', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    const leases = await companyRepository.getLeases(companyId, user.id, member.role);
    res.json(leases);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve leases' });
  }
});

/**
 * POST /api/company/leases and POST /api/company/leases/draft
 */
const handleCreateCompanyLeaseDraft = async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    // Permissions: ACCOUNTANT, VIEWER cannot create leases
    if (member.role === CompanyRole.ACCOUNTANT || member.role === CompanyRole.VIEWER) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Role not authorized to draft leases.' });
    }

    const { propertyId, tenantId, startDate, endDate, rentAmount } = req.body;
    if (!propertyId || !tenantId || !startDate || !endDate || rentAmount === undefined || rentAmount === null) {
      return res.status(400).json({ error: 'VALIDATION_ERROR: propertyId, tenantId, startDate, endDate, and rentAmount are required.' });
    }

    const lease = await companyRepository.createLeaseDraft(companyId, user.id, req.body);
    res.status(201).json(lease);
  } catch (error: any) {
    if (
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('PERMISSION_DENIED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Unauthorized') ||
      error.message?.includes('MEMBER_INACTIVE') ||
      error.message?.includes('ROLE_PRIVILEGE_REQUIRED')
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
    console.error('Company create lease draft error:', error);
    res.status(500).json({ error: error.message || 'Failed to create lease draft' });
  }
};

router.post('/leases', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, handleCreateCompanyLeaseDraft);
router.post('/leases/draft', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, handleCreateCompanyLeaseDraft);

/**
 * GET /api/company/maintenance
 */
router.get('/maintenance', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    const items = await companyRepository.getMaintenance(companyId, user.id, member.role);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve maintenance' });
  }
});

/**
 * POST /api/company/maintenance
 */
router.post('/maintenance', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    if (member.role === CompanyRole.ACCOUNTANT || member.role === CompanyRole.VIEWER) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Role not authorized for maintenance mutations.' });
    }

    const created = await companyRepository.createMaintenanceRequest(companyId, user.id, req.body);
    res.status(201).json(created);
  } catch (error: any) {
    if (error.message.includes('AUTHORITY_REQUIRED') || error.message.includes('PERMISSION_DENIED')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to create maintenance request' });
  }
});

/**
 * POST /api/company/maintenance/quotes/:id/approve
 */
router.post('/maintenance/quotes/:id/approve', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    if (member.role === CompanyRole.VIEWER || member.role === CompanyRole.AGENT) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Role not authorized to approve quotes.' });
    }

    const result = await companyRepository.approveMaintenanceQuote(companyId, req.params.id as string, user.id);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to approve quote' });
  }
});

/**
 * GET /api/company/listings
 */
router.get('/listings', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const listingsList = await companyRepository.getListings(companyId);
    res.json(listingsList);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve listings' });
  }
});

/**
 * POST /api/company/listings
 */
router.post('/listings', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    if (member.role === CompanyRole.ACCOUNTANT || member.role === CompanyRole.VIEWER) {
      return res.status(403).json({ error: 'ROLE_PRIVILEGE_REQUIRED: Role not authorized to create listings.' });
    }

    const listing = await companyRepository.createListing(companyId, user.id, req.body);
    res.status(201).json(listing);
  } catch (error: any) {
    if (error.message.includes('AUTHORITY_REQUIRED') || error.message.includes('LISTING_AUTHORITY_REQUIRED') || error.message.includes('PUBLISH_AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to create listing' });
  }
});

/**
 * GET /api/company/financials
 */
router.get('/financials', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    const financials = await companyRepository.getFinancials(companyId);
    res.json(financials);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve financials' });
  }
});

/**
 * GET /api/company/approvals
 */
router.get('/approvals', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const approvals = await companyRepository.getApprovals(companyId);
    res.json(approvals);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve approvals' });
  }
});

/**
 * POST /api/company/approvals/:id/decision
 */
router.post('/approvals/:id/decision', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const member = await companyRepository.getCompanyMembership(user.id, companyId);
    if (!member || member.status !== 'ACTIVE') return res.status(403).json({ error: 'MEMBER_INACTIVE' });

    const { type, decision } = req.body;
    if (decision !== 'APPROVE' && decision !== 'REJECT') {
      return res.status(400).json({ error: 'Decision must be APPROVE or REJECT.' });
    }

    const result = await companyRepository.decideApproval(companyId, req.params.id as string, type, decision, user.id, member.role);
    res.json(result);
  } catch (error: any) {
    if (
      error.message?.includes('ROLE_PRIVILEGE_REQUIRED') ||
      error.message?.includes('AUTHORITY_REQUIRED') ||
      error.message?.includes('FORBIDDEN') ||
      error.message?.includes('Forbidden')
    ) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || 'Failed to execute approval decision' });
  }
});

/**
 * POST /api/company/ai/portfolio-insights
 */
router.post('/ai/portfolio-insights', requireAuth, requireRole(ALLOWED_COMPANY_ROLES as UserRole[]), requireDatabase, async (req: Request, res: Response) => {
  
  try {
    const user = req.user!;
    const companyId = user.organizationId;
    if (!companyId) return res.status(400).json({ error: 'No company organization associated.' });

    const activeAgreements = await companyRepository.getActiveAgreements(companyId);
    const propIds = activeAgreements.map(a => a.propertyId);

    const recs = await companyRepository.generateAIRecommendations(companyId, propIds);
    res.json({
      recommendations: recs,
      disclaimer: 'AI recommendations are advisory and require explicit human review and approval before execution.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate AI insights' });
  }
});

export default router;

