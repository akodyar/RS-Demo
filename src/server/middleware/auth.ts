declare module 'express-serve-static-core' {
  interface Request {
    user?: any;
    firebaseUser?: any;
  }
}

import { Request, Response, NextFunction } from 'express';
import { Permission, UserRole, AuthorityStatus } from '../../types/index.js';
import { auditService } from '../services/audit.js';
import { db } from '../../db/index.js';
import { ownershipRecords, managementAgreements, leaseTenants, leases, users, organizations, organizationMembers, agentPropertyAssignments, workOrders } from '../../db/schema.js';
import { eq, and, inArray, or } from 'drizzle-orm';
import { auth as firebaseAuth } from '../config/firebase.js';
import { verifyAuthToken } from '../utils/auth.js';

/**
 * SECURITY FOUNDATION:
 * Fail-Closed Authorization Middlewares
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid credentials' });
  }

  const token = authHeader.split('Bearer ')[1];
  const isProduction = process.env.NODE_ENV === 'production';

  // CRITICAL SECURITY ENFORCEMENT:
  // In production, mock tokens and dev-persona tokens are strictly prohibited.
  if (isProduction && (token === 'dev-platform_admin' || token.startsWith('dev-'))) {
    return res.status(401).json({
      error: 'MOCK_AUTH_FORBIDDEN_IN_PRODUCTION',
      message: 'Mock or dev credentials are fundamentally forbidden in the production environment.',
    });
  }

  // Isolated development authentication handling
  if (!isProduction && (token === 'dev-platform_admin' || token.startsWith('dev-'))) {
    const devRoleMap: Record<string, { role: string[]; name: string; email: string; id: string; organizationId?: string }> = {
      'dev-platform_admin': {
        role: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
        name: 'Platform Super Admin',
        email: 'superadmin@homehub.iq',
        id: 'admin_user_01',
      },
      'dev-super-admin': {
        role: ['SUPER_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'],
        name: 'Platform Super Admin',
        email: 'superadmin@homehub.iq',
        id: 'admin_user_01',
      },
      'dev-admin': {
        role: ['PLATFORM_ADMIN', 'ADMIN'],
        name: 'Platform Admin',
        email: 'admin@homehub.iq',
        id: 'admin_user_02',
      },
      'dev-platform-admin': {
        role: ['PLATFORM_ADMIN', 'ADMIN'],
        name: 'Platform Admin',
        email: 'admin@homehub.iq',
        id: 'admin_user_02',
      },
      'dev-operations': {
        role: ['OPERATIONS_ADMIN'],
        name: 'Operations Admin',
        email: 'operations@homehub.iq',
        id: 'admin_user_ops',
      },
      'dev-compliance': {
        role: ['COMPLIANCE_ADMIN'],
        name: 'Compliance Admin',
        email: 'compliance@homehub.iq',
        id: 'admin_user_comp',
      },
      'dev-finance': {
        role: ['FINANCE_ADMIN'],
        name: 'Finance Admin',
        email: 'finance@homehub.iq',
        id: 'admin_user_fin',
      },
      'dev-support': {
        role: ['SUPPORT_ADMIN'],
        name: 'Support Admin',
        email: 'support@homehub.iq',
        id: 'admin_user_sup',
      },
      'dev-security': {
        role: ['SECURITY_ADMIN'],
        name: 'Security Admin',
        email: 'security@homehub.iq',
        id: 'admin_user_sec',
      },
      'dev-property': {
        role: ['PROPERTY_ADMIN'],
        name: 'Property Admin',
        email: 'property@homehub.iq',
        id: 'admin_user_prop',
      },
      'dev-marketplace': {
        role: ['MARKETPLACE_ADMIN'],
        name: 'Marketplace Admin',
        email: 'marketplace@homehub.iq',
        id: 'admin_user_mkt',
      },
      'dev-verification': {
        role: ['VERIFICATION_ADMIN'],
        name: 'Verification Admin',
        email: 'verification@homehub.iq',
        id: 'admin_user_verif',
      },
      'dev-ai-governance': {
        role: ['AI_GOVERNANCE_ADMIN'],
        name: 'AI Governance Admin',
        email: 'ai@homehub.iq',
        id: 'admin_user_ai',
      },
      'dev-auditor': {
        role: ['AUDITOR'],
        name: 'System Auditor',
        email: 'auditor@homehub.iq',
        id: 'admin_user_auditor',
      },
      'dev-readonly': {
        role: ['READ_ONLY_ADMIN'],
        name: 'Read Only Admin',
        email: 'readonly@homehub.iq',
        id: 'admin_user_readonly',
      },
      'dev-read-only': {
        role: ['READ_ONLY_ADMIN'],
        name: 'Read Only Admin',
        email: 'readonly@homehub.iq',
        id: 'admin_user_readonly',
      },
      'dev-owner': {
        role: ['PROPERTY_OWNER'],
        name: 'Salar Aziz',
        email: 'owner@homehub.iq',
        id: 'user_owner_01',
      },
      'dev-property_owner': {
        role: ['PROPERTY_OWNER'],
        name: 'Salar Aziz',
        email: 'owner@homehub.iq',
        id: 'user_owner_01',
      },
      'dev-property-owner': {
        role: ['PROPERTY_OWNER'],
        name: 'Salar Aziz',
        email: 'owner@homehub.iq',
        id: 'user_owner_01',
      },
      'dev-owner-b': {
        role: ['PROPERTY_OWNER'],
        name: 'Karwan Sleman',
        email: 'owner_b@homehub.iq',
        id: 'user_owner_02',
      },
      'dev-company': {
        role: ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'],
        name: 'Zagros Real Estate',
        email: 'company@homehub.iq',
        id: 'user_company_01',
        organizationId: 'org_company_01',
      },
      'dev-company_admin': {
        role: ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'],
        name: 'Zagros Real Estate',
        email: 'company@homehub.iq',
        id: 'user_company_01',
        organizationId: 'org_company_01',
      },
      'dev-company-admin': {
        role: ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'],
        name: 'Zagros Real Estate',
        email: 'company@homehub.iq',
        id: 'user_company_01',
        organizationId: 'org_company_01',
      },
      'dev-company-b': {
        role: ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'],
        name: 'Hawler Management',
        email: 'company_b@homehub.iq',
        id: 'user_company_02',
        organizationId: 'org_company_02',
      },
      'dev-tenant': {
        role: ['TENANT'],
        name: 'Ahmed Farhad',
        email: 'tenant@homehub.iq',
        id: 'user_tenant_01',
      },
      'dev-tenant-inactive': {
        role: ['TENANT'],
        name: 'Inactive Tenant',
        email: 'tenant_inactive@homehub.iq',
        id: 'user_tenant_inactive_01',
      },
      'dev-tenant-trans': {
        role: ['TENANT'],
        name: 'Trans Tenant',
        email: 'tenant_trans@homehub.iq',
        id: 'user_tenant_trans_01',
      },
      'dev-tenant-b': {
        role: ['TENANT'],
        name: 'Tenant B',
        email: 'tenant_b@homehub.iq',
        id: 'user_tenant_b_01',
      },
      'dev-tenant-draft': {
        role: ['TENANT'],
        name: 'Draft Tenant',
        email: 'tenant_draft@homehub.iq',
        id: 'user_tenant_draft',
      },
      'dev-tenant-pending': {
        role: ['TENANT'],
        name: 'Pending Tenant',
        email: 'tenant_pending@homehub.iq',
        id: 'user_tenant_pending',
      },
      'dev-tenant-rejected': {
        role: ['TENANT'],
        name: 'Rejected Tenant',
        email: 'tenant_rejected@homehub.iq',
        id: 'user_tenant_rejected',
      },
      'dev-tenant-expiring': {
        role: ['TENANT'],
        name: 'Expiring Tenant',
        email: 'tenant_expiring@homehub.iq',
        id: 'user_tenant_expiring',
      },
      'dev-tenant-expired': {
        role: ['TENANT'],
        name: 'Expired Tenant',
        email: 'tenant_expired@homehub.iq',
        id: 'user_tenant_expired',
      },
      'dev-tenant-terminated': {
        role: ['TENANT'],
        name: 'Terminated Tenant',
        email: 'tenant_terminated@homehub.iq',
        id: 'user_tenant_terminated_01',
      },
      'dev-buyer': {
        role: ['BUYER'],
        name: 'Zana Mustafa',
        email: 'buyer@homehub.iq',
        id: 'user_buyer_01',
      },
      'dev-buyer-b': {
        role: ['BUYER'],
        name: 'Diyar Ali',
        email: 'buyer_b@homehub.iq',
        id: 'user_buyer_02',
      },
      'dev-vendor': {
        role: ['VENDOR'],
        name: 'Erbil Quick Fix Services',
        email: 'vendor@homehub.iq',
        id: 'user_vendor_01',
      },
      'dev-vendor-b': {
        role: ['VENDOR'],
        name: 'Baban Maintenance',
        email: 'vendor_b@homehub.iq',
        id: 'user_vendor_02',
      },
      'dev-vendor-company': {
        role: ['VENDOR', 'COMPANY_MEMBER'],
        name: 'Kurdistan Facilities Co.',
        email: 'vendor_company@homehub.iq',
        id: 'user_vendor_company_01',
        organizationId: 'org_vendor_01',
      },
      'dev-investor': {
        role: ['INVESTOR'],
        name: 'Kawa Qadir',
        email: 'investor@homehub.iq',
        id: 'user_investor_01',
      },
      'dev-agent': {
        role: ['AGENT_BROKER'],
        name: 'Ahmed Rahman',
        email: 'agent@homehub.iq',
        id: 'user_agent_01',
      },
      'dev-agent-b': {
        role: ['AGENT_BROKER'],
        name: 'Danyar Barzani',
        email: 'agent_b@homehub.iq',
        id: 'user_agent_02',
      },
      'dev-company-agent': {
        role: ['AGENT_BROKER', 'COMPANY_MEMBER'],
        name: 'Soran Agency Broker',
        email: 'company_agent@homehub.iq',
        id: 'user_agent_company_01',
        organizationId: 'org_company_01',
      },
    };

    const persona = devRoleMap[token];
    if (persona) {
      req.user = {
        id: persona.id,
        uid: persona.id,
        email: persona.email,
        name: persona.name,
        roles: persona.role,
        organizationId: persona.organizationId,
        isActive: true,
        activeRole: persona.role[0] || null,
        workspaceId: persona.organizationId ? ('company_' + persona.organizationId) : (persona.role[0]?.toLowerCase() || null),
      };

      // Ensure dev persona exists in relational users table if database is online
      try {
        const parts = persona.name.trim().split(' ');
        const fName = parts[0] || 'User';
        const lName = parts.slice(1).join(' ') || fName;

        await db.insert(users).values({
          id: persona.id,
          uid: persona.id,
          email: persona.email,
          firstName: fName,
          lastName: lName,
          roles: persona.role,
          isActive: true,
        }).onConflictDoUpdate({
          target: users.id,
          set: {
            firstName: fName,
            lastName: lName,
            email: persona.email,
            roles: persona.role,
            isActive: true,
          },
        });

        if (persona.organizationId) {
          await db.insert(organizations).values({
            id: persona.organizationId,
            name: persona.name,
            type: 'COMPANY',
            status: 'VERIFIED',
            verified: true,
          }).onConflictDoNothing();

          await db.insert(organizationMembers).values({
            id: `member_${persona.id}_${persona.organizationId}`,
            organizationId: persona.organizationId,
            userId: persona.id,
            role: 'COMPANY_OWNER',
            status: 'ACTIVE',
          }).onConflictDoNothing();
        }
      } catch {
        // If DB is unconfigured, fail-closed handling in downstream requireDatabase will trigger
      }

      return next();
    }

    if (token.startsWith('dev-register-')) {
      const decodedInfo = Buffer.from(token.split('dev-register-')[1], 'base64').toString('utf-8');
      try {
        const parsed = JSON.parse(decodedInfo);
        const decodedUid = parsed.uid || 'new-user';
        
        // Attempt to load from database for subsequent requests
        try {
          const dbUsers = await db.select().from(users).where(eq(users.uid, decodedUid)).limit(1);
          if (dbUsers.length > 0) {
            req.user = {
              ...dbUsers[0],
              activeRole: (dbUsers[0].roles as any)?.[0] || null,
              workspaceId: (dbUsers[0].roles as any)?.[0]?.toLowerCase() || null,
              organizationId: parsed.organizationId || (dbUsers[0] as any).organizationId,
            } as any;
            return next();
          }
        } catch (e) {
          // Ignore DB errors during initial sync
        }
        
        (req as any).firebaseUser = {
          uid: decodedUid,
          email: parsed.email || 'new@example.com',
          name: parsed.name || 'New User'
        };
        
        let fallbackRole = parsed.role;
        if (!fallbackRole) {
          if (req.baseUrl.includes('/api/agent')) fallbackRole = 'AGENT_BROKER';
          else if (req.baseUrl.includes('/api/owner')) fallbackRole = 'PROPERTY_OWNER';
          else if (req.baseUrl.includes('/api/company')) fallbackRole = 'COMPANY_MEMBER';
          else if (req.baseUrl.includes('/api/vendor')) fallbackRole = 'VENDOR';
          else fallbackRole = 'TENANT';
        } else {
          if (fallbackRole === 'OWNER') fallbackRole = 'PROPERTY_OWNER';
          if (fallbackRole === 'BROKER') fallbackRole = 'AGENT';
          if (fallbackRole === 'AGENT') fallbackRole = 'AGENT_BROKER';
        }
        
        const isSyncRoute = req.originalUrl && req.originalUrl.includes('/sync');
        if (isSyncRoute) {
          // Allow /sync to authoritatively validate and provision user in PostgreSQL
          return next();
        }

        // If user record is not found in database and route is not /sync:
        return res.status(401).json({ error: 'Unauthorized: User record not found' });
      } catch (e) {
        // Fallback if not valid JSON
      }
    }

    return res.status(401).json({
      error: 'INVALID_DEV_TOKEN',
      message: `Unknown development token: "${token}". Valid dev tokens: ${Object.keys(devRoleMap).join(', ')}`,
    });
  }

  // 1. Authoritative Native Token Verification (PostgreSQL Backend JWT)
  try {
    const decoded = verifyAuthToken(token);
    const dbUsers = await db.select().from(users).where(eq(users.id, decoded.id)).limit(1);

    if (dbUsers.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: User record not found' });
    }

    req.user = {
      ...dbUsers[0],
      activeRole: decoded.activeRole || (dbUsers[0].roles as any)?.[0] || null,
      workspaceId: decoded.workspaceId || null,
      organizationId: decoded.organizationId || (dbUsers[0] as any).organizationId,
    };


    if (!req.user.organizationId && req.user.workspaceId?.startsWith('company_')) {
      const targetOrgId = req.user.workspaceId.substring('company_'.length);
      const member = await db.select({ orgId: organizationMembers.organizationId })
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.userId, dbUsers[0].id),
          eq(organizationMembers.organizationId, targetOrgId),
          eq(organizationMembers.status, 'ACTIVE')
        ))
        .limit(1);
      if (member.length > 0) {
        req.user.organizationId = member[0].orgId;
      }
    }

    if (!req.user?.isActive) {
      return res.status(403).json({ error: 'Forbidden: Account suspended' });
    }

    // Authoritative Server-Side Session Invalidation (Token Version)
    // If user logged out or reset password, tokenVersion in PostgreSQL was incremented.
    // Tokens carrying an obsolete tokenVersion are authoritatively rejected.
    const currentDbVersion = req.user.tokenVersion ?? 1;
    const tokenVersion = decoded.tokenVersion ?? 1;
    if (tokenVersion !== currentDbVersion) {
      return res.status(401).json({
        error: 'TOKEN_REVOKED',
        message: 'Unauthorized: Session has been invalidated or expired. Please sign in again.',
      });
    }

    return next();
  } catch {
    // Fall through to legacy identity verification if native JWT verification fails
  }

  // 2. Legacy Identity Verification Fallback (Transition Support)
  if (firebaseAuth) {
    try {
      const decodedToken = await firebaseAuth.verifyIdToken(token, true);

      (req as any).firebaseUser = decodedToken;

      const dbUsers = await db.select().from(users).where(eq(users.uid, decodedToken.uid)).limit(1);

      if (dbUsers.length === 0) {
        if (req.originalUrl && req.originalUrl.includes('/sync')) {
          return next();
        }
        return res.status(401).json({ error: 'Unauthorized: User record not found' });
      }

      req.user = dbUsers[0] as any;

      if (!req.user?.isActive) {
        return res.status(403).json({ error: 'Forbidden: Account suspended' });
      }

      return next();
    } catch {
      // Invalid token
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid token' });
};

export const requireRole = (allowedRoles: (UserRole | string)[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !Array.isArray(req.user.roles) || !req.user.roles.some((role: any) => (allowedRoles as any[]).includes(role))) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }
    next();
  };
};

/**
 * Verifies whether the assigned company membership role permits the requested active role
 * according to the authoritative company role hierarchy.
 */
export function isCompanyRolePermitted(assignedRole: string, activeRole: string): boolean {
  const assigned = String(assignedRole || '').toUpperCase();
  const active = String(activeRole || '').toUpperCase();

  // Exact match is always permitted
  if (assigned === active) return true;

  // COMPANY_OWNER holds top-level authority over all company roles
  if (assigned === 'COMPANY_OWNER') {
    return [
      'COMPANY_OWNER',
      'COMPANY_ADMIN',
      'COMPANY',
      'COMPANY_MEMBER',
      'PROPERTY_MANAGER',
      'ACCOUNTANT',
      'MAINTENANCE_MANAGER',
      'AGENT',
      'VIEWER',
    ].includes(active);
  }

  // COMPANY_ADMIN holds administrative authority, but cannot claim COMPANY_OWNER
  if (assigned === 'COMPANY_ADMIN') {
    return [
      'COMPANY_ADMIN',
      'COMPANY',
      'COMPANY_MEMBER',
      'PROPERTY_MANAGER',
      'ACCOUNTANT',
      'MAINTENANCE_MANAGER',
      'AGENT',
      'VIEWER',
    ].includes(active);
  }

  // COMPANY (principal) behaves like COMPANY_ADMIN / COMPANY_OWNER
  if (assigned === 'COMPANY') {
    return [
      'COMPANY',
      'COMPANY_ADMIN',
      'COMPANY_MEMBER',
      'PROPERTY_MANAGER',
      'ACCOUNTANT',
      'MAINTENANCE_MANAGER',
      'AGENT',
      'VIEWER',
    ].includes(active);
  }

  // Operational staff roles can only claim their assigned role, or generic COMPANY_MEMBER / VIEWER
  if (['PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_MANAGER', 'AGENT'].includes(assigned)) {
    return active === assigned || active === 'COMPANY_MEMBER' || active === 'VIEWER';
  }

  // Generic COMPANY_MEMBER can claim COMPANY_MEMBER or VIEWER
  if (assigned === 'COMPANY_MEMBER') {
    return active === 'COMPANY_MEMBER' || active === 'VIEWER';
  }

  // VIEWER can ONLY claim VIEWER
  if (assigned === 'VIEWER') {
    return active === 'VIEWER';
  }

  return false;
}

/**
 * WORKSPACE CONTEXT GUARD:
 * Enforces that the client request originates from an authorized active role session.
 * Platform Admin retains emergency cross-workspace oversight.
 */
export const requireActiveRole = (allowedRoles: (UserRole | string)[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized: Missing user session' });
      }

      const isPlatformAdmin = req.user.roles?.includes('PLATFORM_ADMIN') || req.user.roles?.includes('SUPER_ADMIN');
      if (isPlatformAdmin) {
        return next();
      }

      const activeRole = req.user.activeRole;
      if (!activeRole || !(allowedRoles as string[]).includes(activeRole)) {
        return res.status(403).json({
          error: 'INCORRECT_ACTIVE_ROLE_CONTEXT',
          message: `This operation requires active workspace context: ${(allowedRoles as string[]).join(', ')}. Current active workspace: ${activeRole || 'NONE'}.`,
          code: 'WORKSPACE_CONTEXT_REQUIRED',
          requiredRoles: allowedRoles,
          currentActiveRole: activeRole || null,
        });
      }

      // Authoritative Active Role Integrity Validation:
      // Ensure activeRole is actually assigned to the authenticated user in the database
      // or through an authorized company membership. This prevents forged JWT claims.
      const userRoles = (Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles])
        .filter(Boolean)
        .map((r: string) => String(r).toUpperCase());
      const normalizedActive = String(activeRole).toUpperCase();

      const hasDirectRole = userRoles.includes(normalizedActive) ||
        (normalizedActive === 'PROPERTY_OWNER' && userRoles.includes('OWNER')) ||
        (normalizedActive === 'OWNER' && userRoles.includes('PROPERTY_OWNER')) ||
        (normalizedActive === 'AGENT_BROKER' && (userRoles.includes('AGENT') || userRoles.includes('BROKER'))) ||
        (normalizedActive === 'AGENT' && (userRoles.includes('AGENT_BROKER') || userRoles.includes('BROKER')));

      let hasCompanyAuthority = false;
      const COMPANY_ROLES = [
        'COMPANY', 'COMPANY_MEMBER', 'COMPANY_OWNER', 'COMPANY_ADMIN', 
        'PROPERTY_MANAGER', 'ACCOUNTANT', 'MAINTENANCE_MANAGER', 'VIEWER', 'AGENT'
      ];

      if (COMPANY_ROLES.includes(normalizedActive)) {
        const orgId = req.user.organizationId;
        const wsId = req.user.workspaceId;

        // Authoritative Company Workspace Authority Validation:
        // 1. Both workspaceId and organizationId must be present
        // 2. workspaceId must match established format: `company_${organizationId}`
        if (orgId && wsId && wsId === `company_${orgId}`) {
          const [membership] = await db
            .select({
              memberId: organizationMembers.id,
              memberRole: organizationMembers.role,
              memberStatus: organizationMembers.status,
              orgId: organizations.id,
              orgStatus: organizations.status,
            })
            .from(organizationMembers)
            .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
            .where(
              and(
                eq(organizationMembers.userId, req.user.id),
                eq(organizationMembers.organizationId, orgId),
                eq(organizationMembers.status, 'ACTIVE')
              )
            )
            .limit(1);

          if (membership && membership.orgStatus !== 'SUSPENDED') {
            if (isCompanyRolePermitted(membership.memberRole, normalizedActive)) {
              hasCompanyAuthority = true;
            }
          }
        }
      }

      if (!hasDirectRole && !hasCompanyAuthority) {
        return res.status(403).json({
          error: 'FORBIDDEN_ACTIVE_ROLE_MISMATCH',
          message: `Active role '${activeRole}' is not assigned to the authenticated user.`,
          code: 'ACTIVE_ROLE_MISMATCH',
        });
      }

      next();
    } catch (error: any) {
      console.error('[requireActiveRole] Error validating active workspace role:', error);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An error occurred while validating active workspace authorization.',
      });
    }
  };
};


/**
 * RESOURCE AUTHORIZATION
 * Strictly checks if the authenticated user has the necessary granular Permission
 * for a specific Property, resolving Owners vs Management Companies.
 */
export const requirePropertyPermission = (requiredPermission: Permission) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const propertyId = (req.params.propertyId || req.params.id || req.body.propertyId || req.query.propertyId) as string;
    
    if (!req.user || !propertyId) {
      return res.status(400).json({ error: 'Bad Request: Missing context for authorization check' });
    }

    let hasAuthority = false;

    // SCENARIO 0: Platform Admin or Finance Admin has global system authority
    if (
      req.user.roles.includes(UserRole.PLATFORM_ADMIN) || 
      req.user.roles.includes('PLATFORM_ADMIN') || 
      req.user.roles.includes('FINANCE_ADMIN') || 
      req.user.roles.includes('SUPER_ADMIN')
    ) {
      hasAuthority = true;
    }

    // SCENARIO 1: Is User the verified Owner of the property?
    if (!hasAuthority && (req.user.roles.includes(UserRole.PROPERTY_OWNER) || req.user.roles.includes('PROPERTY_OWNER'))) {
      const ownerRecord = await db.select().from(ownershipRecords).where(and(
        eq(ownershipRecords.ownerId, req.user.id),
        eq(ownershipRecords.propertyId, propertyId),
        requiredPermission === Permission.VIEW_PROPERTY
          ? or(eq(ownershipRecords.status, 'VERIFIED'), eq(ownershipRecords.status, 'PENDING_VERIFICATION'), eq(ownershipRecords.status, 'REJECTED'))
          : eq(ownershipRecords.status, 'VERIFIED')
      )).limit(1);

      if (ownerRecord.length > 0) {
        hasAuthority = true;
      }
    }

    // SCENARIO 2: Is User a Company Member or Company Admin? (Direct Company Ownership or Active Management Agreement)
    const isCompanyPrincipal = req.user.roles.includes(UserRole.COMPANY) || 
      req.user.roles.includes(UserRole.COMPANY_MEMBER) || 
      req.user.roles.includes('COMPANY') ||
      req.user.roles.includes('COMPANY_MEMBER') ||
      req.user.roles.includes('COMPANY_ADMIN');

    let userOrgId = req.user.organizationId;
    if (!userOrgId && isCompanyPrincipal) {
      const orgMem = await db.select({ organizationId: organizationMembers.organizationId }).from(organizationMembers).where(and(
        eq(organizationMembers.userId, req.user.id),
        eq(organizationMembers.status, 'ACTIVE')
      )).limit(1);
      if (orgMem.length > 0) {
        userOrgId = orgMem[0].organizationId;
        req.user.organizationId = userOrgId;
      }
    }

    if (!hasAuthority && isCompanyPrincipal && userOrgId) {
      // If user is COMPANY_MEMBER, verify active organization membership
      let isMemberActive = true;
      let memberRole: string | null = null;
      if (
        (req.user.roles.includes(UserRole.COMPANY_MEMBER) || req.user.roles.includes('COMPANY_MEMBER')) &&
        !req.user.roles.includes(UserRole.COMPANY) && !req.user.roles.includes('COMPANY')
      ) {
        const mem = await db.select().from(organizationMembers).where(and(
          eq(organizationMembers.userId, req.user.id),
          eq(organizationMembers.organizationId, userOrgId),
          eq(organizationMembers.status, 'ACTIVE')
        )).limit(1);
        if (mem.length === 0) {
          isMemberActive = false;
        } else {
          memberRole = mem[0].role;
        }
      }

      // Read-only member role (VIEWER) cannot execute write operations
      const isReadOnlyRole = memberRole === 'VIEWER';
      const permittedByRole = !isReadOnlyRole || requiredPermission === Permission.VIEW_PROPERTY;

      if (isMemberActive && permittedByRole) {
        // 2a. Direct Company Ownership
        const companyOwnerRecord = await db.select().from(ownershipRecords).where(and(
          eq(ownershipRecords.companyId, userOrgId),
          eq(ownershipRecords.propertyId, propertyId),
          requiredPermission === Permission.VIEW_PROPERTY
            ? or(eq(ownershipRecords.status, 'VERIFIED'), eq(ownershipRecords.status, 'PENDING_VERIFICATION'), eq(ownershipRecords.status, 'REJECTED'))
            : eq(ownershipRecords.status, 'VERIFIED')
        )).limit(1);

        if (companyOwnerRecord.length > 0) {
          hasAuthority = true;
        } else {
          // 2b. Authorized Management Agreement
          const agreements = await db.select().from(managementAgreements).where(and(
            eq(managementAgreements.companyId, userOrgId),
            eq(managementAgreements.propertyId, propertyId),
            eq(managementAgreements.status, 'ACTIVE')
          )).limit(1);

          if (agreements.length > 0) {
            const agreement = agreements[0];
            const isNotExpired = !agreement.endDate || new Date(agreement.endDate).getTime() >= Date.now();
            if (isNotExpired) {
              const grantedPermissions = (agreement.grantedPermissions as string[]) || [];
              if (grantedPermissions.includes(requiredPermission) || grantedPermissions.includes(String(requiredPermission))) {
                hasAuthority = true; // Authorized under active management agreement
              }
            }
          }
        }
      }
    }
    
    // SCENARIO 3: Tenant access bounds
    if (!hasAuthority && req.user.roles.includes(UserRole.TENANT)) {
      const tenantLeases = await db.select()
        .from(leases)
        .innerJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
        .where(and(
          eq(leaseTenants.tenantId, req.user.id),
          eq(leases.propertyId, propertyId),
          eq(leases.status, 'ACTIVE')
        )).limit(1);

      const hasActiveLease = tenantLeases.length > 0;
      const isTenantPermittedAction = [Permission.VIEW_PROPERTY].includes(requiredPermission);
      if (hasActiveLease && isTenantPermittedAction) {
        hasAuthority = true;
      }
    }

    // SCENARIO 4: Agent with an ACTIVE Agent Property Assignment
    if (!hasAuthority && (req.user.roles.includes(UserRole.AGENT_BROKER) || req.user.roles.includes('AGENT_BROKER') || req.user.roles.includes('AGENT'))) {
      const assignments = await db.select().from(agentPropertyAssignments).where(and(
        eq(agentPropertyAssignments.userId, req.user.id),
        eq(agentPropertyAssignments.propertyId, propertyId),
        eq(agentPropertyAssignments.status, 'ACTIVE')
      )).limit(1);

      if (assignments.length > 0) {
        const assigned = assignments[0];
        const isNotExpired = !assigned.expiryDate || new Date(assigned.expiryDate) > new Date();
        const grantedPermissions = (assigned.permissions as string[]) || [];
        if (isNotExpired && grantedPermissions.includes(requiredPermission)) {
          hasAuthority = true;
        }
      }
    }

    // SCENARIO 5: Vendor with an ACTIVE Work Order assigned to this property
    if (!hasAuthority && req.user.roles.includes(UserRole.VENDOR)) {
      const activeWorkOrders = await db.select().from(workOrders).where(and(
        eq(workOrders.vendorUserId, req.user.id),
        eq(workOrders.propertyId, propertyId),
        inArray(workOrders.status, ['ASSIGNED', 'SCHEDULED', 'IN_PROGRESS', 'PENDING_APPROVAL'])
      )).limit(1);

      if (activeWorkOrders.length > 0) {
        // Vendors are granted task-scoped view property or maintenance permissions only
        const vendorPermitted = [Permission.VIEW_PROPERTY, Permission.MANAGE_MAINTENANCE].includes(requiredPermission);
        if (vendorPermitted) {
          hasAuthority = true;
        }
      }
    }

    if (!hasAuthority) {
      // Log unauthorized access attempt via Audit Logger
      await auditService.logAction({
        actorUserId: req.user.id,
        actorRole: req.user.roles[0] as string, // primary
        action: `DENIED_ACCESS_${requiredPermission}`,
        resourceType: 'Property',
        resourceId: propertyId,
        ipAddress: (req.ip || "") as string
      });

      return res.status(403).json({ 
        error: 'Forbidden: You lack required permissions for this resource.',
        code: 'AUTHORITY_REQUIRED'
      });
    }
    
    next();
  };
};
