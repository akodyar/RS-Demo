import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../../db/index.js';
import { users, organizations, organizationMembers, passwordResetTokens, agentProfiles, vendorProfiles } from '../../db/schema.js';
import { eq, and, gt, isNull, sql, or } from 'drizzle-orm';
import { auditService } from '../services/audit.js';
import { hashPassword, verifyPassword, signAuthToken, verifyAuthToken } from '../utils/auth.js';
import { EmailProviderAdapter } from '../services/provider-adapters.js';
import { loginRateLimiter, registerRateLimiter, passwordResetRateLimiter } from '../middleware/authRateLimit.js';

// Pre-computed Argon2id hash (m=19456, p=1, t=2) used for constant-time comparison when email is unknown
const DUMMY_ARGON2_HASH = '$argon2id$v=19$m=19456,p=1,t=2$otBceOtt50lxKxTJcFnFWQ$jGeebOGGpE3GSIEfXSOAje2UWeq76lHY67mljKZ+JBA';

const router = Router();

function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, failedLoginAttempts, lockedUntil, tokenVersion, ...safeUser } = user;
  return safeUser;
}

export interface EligibleWorkspace {
  workspaceId: string;
  role: string;
  title: string;
  titleKey: string;
  label?: string;
  destination: string;
  status: 'ACTIVE' | 'PENDING_VERIFICATION';
  isCompany: boolean;
  organizationId?: string;
  organizationName?: string;
}

/**
 * Authoritative Workspace Eligibility Resolution:
 * Evaluates held user roles against active PostgreSQL profiles and relationships.
 * Excludes suspended profiles and disaggregates personal vs company workspaces (Option 3A).
 */
export async function resolveEligibleWorkspaces(userId: string, userRoles: string[]): Promise<EligibleWorkspace[]> {
  const normalizedRoles = (userRoles || []).map((r) => r.toUpperCase());
  const workspaces: EligibleWorkspace[] = [];

  // Platform / Super Admin
  if (normalizedRoles.some((r) => ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(r))) {
    workspaces.push({
      workspaceId: 'admin',
      role: 'PLATFORM_ADMIN',
      title: 'بەڕێوەبەری سیستەم',
      titleKey: 'workspace.admin',
      label: 'بەڕێوەبەری سیستەم',
      destination: '/admin/dashboard',
      status: 'ACTIVE',
      isCompany: false,
    });
  }

  // Personal Property Owner
  if (normalizedRoles.includes('PROPERTY_OWNER') || normalizedRoles.includes('OWNER')) {
    workspaces.push({
      workspaceId: 'owner_personal',
      role: 'PROPERTY_OWNER',
      title: 'خاوەنی موڵک (سەربەخۆ)',
      titleKey: 'workspace.owner_personal',
      label: 'خاوەنی موڵک (سەربەخۆ)',
      destination: '/owner',
      status: 'ACTIVE',
      isCompany: false,
    });
  }

  // Company Management Workspace(s) (Option 3A: Disaggregated choices)
  try {
    const memberships = await db
      .select({
        memberId: organizationMembers.id,
        memberRole: organizationMembers.role,
        memberStatus: organizationMembers.status,
        orgId: organizations.id,
        orgName: organizations.name,
        orgStatus: organizations.status,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.status, 'ACTIVE')
        )
      );

    for (const m of memberships) {
      if (m.orgStatus !== 'SUSPENDED') {
        workspaces.push({
          workspaceId: `company_${m.orgId}`,
          role: m.memberRole || 'COMPANY_ADMIN',
          title: `بەڕێوەبەری کۆمپانیا (${m.orgName})`,
          titleKey: 'workspace.company',
          label: `بەڕێوەبەری کۆمپانیا (${m.orgName})`,
          destination: '/company',
          status: m.orgStatus === 'VERIFIED' ? 'ACTIVE' : 'PENDING_VERIFICATION',
          isCompany: true,
          organizationId: m.orgId,
          organizationName: m.orgName,
        });
      }
    }
  } catch (e) {
    console.warn('[resolveEligibleWorkspaces] Error checking company memberships:', e);
  }

  // Tenant Workspace
  if (normalizedRoles.includes('TENANT')) {
    workspaces.push({
      workspaceId: 'tenant',
      role: 'TENANT',
      title: 'کرێنشین',
      titleKey: 'workspace.tenant',
      label: 'کرێنشین',
      destination: '/tenant',
      status: 'ACTIVE',
      isCompany: false,
    });
  }

  // Agent / Broker Workspace (Option 2A: Can enter in PENDING_VERIFICATION for setup)
  if (normalizedRoles.includes('AGENT') || normalizedRoles.includes('AGENT_BROKER')) {
    try {
      const [profile] = await db
        .select()
        .from(agentProfiles)
        .where(eq(agentProfiles.userId, userId))
        .limit(1);

      // Exclude if explicitly suspended
      if (!profile || profile.status !== 'SUSPENDED') {
        workspaces.push({
          workspaceId: 'agent',
          role: 'AGENT_BROKER',
          title: 'ئەگێنت / برۆکەر',
          titleKey: 'workspace.agent',
          label: 'ئەگێنت / برۆکەر',
          destination: '/agent',
          status: profile?.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_VERIFICATION',
          isCompany: false,
        });
      }
    } catch (e) {
      console.warn('[resolveEligibleWorkspaces] Error checking agent profile:', e);
    }
  }

  // Vendor / Service Provider Workspace (Option 2A: Can enter in PENDING_VERIFICATION for setup)
  if (normalizedRoles.includes('VENDOR')) {
    try {
      const [profile] = await db
        .select()
        .from(vendorProfiles)
        .where(eq(vendorProfiles.userId, userId))
        .limit(1);

      // Exclude if explicitly suspended
      if (!profile || profile.status !== 'SUSPENDED') {
        workspaces.push({
          workspaceId: 'vendor',
          role: 'VENDOR',
          title: 'دابینکەر / خزمەتگوزار',
          titleKey: 'workspace.vendor',
          label: 'دابینکەر / خزمەتگوزار',
          destination: '/vendor',
          status: profile?.status === 'ACTIVE' ? 'ACTIVE' : 'PENDING_VERIFICATION',
          isCompany: false,
        });
      }
    } catch (e) {
      console.warn('[resolveEligibleWorkspaces] Error checking vendor profile:', e);
    }
  }

  return workspaces;
}

// -----------------------------------------------------------------------------
// 1. Current Authoritative User Profile Lookup
// -----------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: User session invalid' });
  }
  const eligibleWorkspaces = await resolveEligibleWorkspaces(req.user.id, req.user.roles || []);
  res.json({
    user: sanitizeUser(req.user),
    activeRole: req.user.activeRole || null,
    workspaceId: req.user.workspaceId || null,
    eligibleWorkspaces,
  });
});


// -----------------------------------------------------------------------------
// 2. Native User Registration
// -----------------------------------------------------------------------------
router.post('/register', registerRateLimiter, async (req, res) => {
  try {
    const { email, password, fullName, phone, role = 'TENANT', accountType, entityType, companyName } = req.body;

    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'A valid email address is required.' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters.' });
    }

    const trimmedName = (fullName || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Full name is required.' });
    }

    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0] || 'User';
    const lastName = nameParts.slice(1).join(' ') || firstName;

    // Sanitize role: demote client-claimed administrative roles
    let roleToAssign = (accountType || role || 'TENANT').toUpperCase();
    if (roleToAssign === 'OWNER') roleToAssign = 'PROPERTY_OWNER';
    if (roleToAssign === 'BROKER' || roleToAssign === 'AGENT') roleToAssign = 'AGENT_BROKER';
    if (roleToAssign === 'COMPANY') roleToAssign = 'PROPERTY_OWNER';

    if (!['TENANT', 'PROPERTY_OWNER', 'AGENT_BROKER', 'VENDOR', 'BUYER'].includes(roleToAssign)) {
      roleToAssign = 'TENANT';
    }

    if (roleToAssign === 'PROPERTY_OWNER' || roleToAssign === 'AGENT_BROKER') {
      if (!entityType || !['INDIVIDUAL', 'COMPANY'].includes(entityType)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Property Owner and Agent require a valid entityType (INDIVIDUAL or COMPANY).',
        });
      }
    }

    // Hash password with Argon2id
    const hashed = await hashPassword(password);

    // Transactional registration
    const result = await db.transaction(async (tx) => {
      // Check duplicate email
      const existing = await tx.select().from(users).where(eq(users.email, trimmedEmail)).limit(1);
      if (existing.length > 0) {
        return { duplicate: true };
      }

      const [newUser] = await tx
        .insert(users)
        .values({
          email: trimmedEmail,
          firstName,
          lastName,
          phone: phone ? String(phone).trim() : null,
          passwordHash: hashed,
          roles: [roleToAssign],
          isActive: true,
        })
        .returning();

      let createdOrg: any = null;
      if (entityType === 'COMPANY') {
        const [newOrg] = await tx
          .insert(organizations)
          .values({
            name: companyName || `${firstName}'s Real Estate`,
            type: roleToAssign === 'AGENT_BROKER' ? 'AGENT_COMPANY' : 'OWNER_COMPANY',
            status: 'PENDING_VERIFICATION',
          })
          .returning();
        createdOrg = newOrg;

        await tx.insert(organizationMembers).values({
          organizationId: newOrg.id,
          userId: newUser.id,
          role: 'COMPANY_ADMIN',
          status: 'ACTIVE',
        });
      }

      // Automatically initialize supporting profiles in PENDING_VERIFICATION state if needed
      if (roleToAssign === 'AGENT_BROKER') {
        await tx.insert(agentProfiles).values({
          userId: newUser.id,
          displayName: `${firstName} ${lastName}`.trim() || 'Agent',
          email: trimmedEmail,
          officeName: entityType === 'COMPANY' ? (companyName || `${firstName}'s Real Estate`) : null,
          status: 'PENDING_VERIFICATION',
          availabilityStatus: 'AVAILABLE',
          isPublic: false,
        });
      } else if (roleToAssign === 'VENDOR') {
        await tx.insert(vendorProfiles).values({
          userId: newUser.id,
          businessName: `${firstName} Services`,
          email: trimmedEmail,
          status: 'ACTIVE',
          verificationStatus: 'PENDING',
        });
      }

      await auditService.logAction({
        actorUserId: newUser.id,
        actorRole: roleToAssign,
        action: 'USER_REGISTERED',
        resourceType: 'User',
        resourceId: newUser.id,
        ipAddress: (req.ip || '') as string,
      });

      return { user: newUser, org: createdOrg };
    });

    if (result.duplicate) {
      return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS', message: 'This email is already registered.' });
    }

    const initialWorkspaceId = (entityType === 'COMPANY' && result.org)
      ? `company_${result.org.id}`
      : roleToAssign === 'PROPERTY_OWNER'
      ? 'owner_personal'
      : roleToAssign === 'TENANT'
      ? 'tenant'
      : roleToAssign === 'AGENT_BROKER'
      ? 'agent'
      : roleToAssign.toLowerCase();

    const initialOrgId = (entityType === 'COMPANY' && result.org) ? result.org.id : undefined;

    const token = signAuthToken({
      id: result.user!.id,
      email: result.user!.email,
      roles: (result.user!.roles as string[]) || [roleToAssign],
      activeRole: roleToAssign,
      workspaceId: initialWorkspaceId,
      organizationId: initialOrgId,
      tokenVersion: result.user!.tokenVersion ?? 1,
    });

    res.status(201).json({
      token,
      user: sanitizeUser(result.user),
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'REGISTRATION_FAILED', message: 'Failed to complete registration.' });
  }
});

function normalizePhoneDigits(input: string): string {
  if (!input) return '';
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  let western = input;
  for (let i = 0; i < 10; i++) {
    western = western.split(easternDigits[i]).join(String(i));
    western = western.split(persianDigits[i]).join(String(i));
  }
  let digits = western.replace(/\D/g, '');
  if (digits.startsWith('00964')) digits = digits.slice(5);
  else if (digits.startsWith('964')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

// -----------------------------------------------------------------------------
// 3. Native User Sign-In (Login)
// -----------------------------------------------------------------------------
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { email, phone, mobileNumber, username, password } = req.body;

    const trimmedInput = (email || phone || mobileNumber || username || '').trim();
    const lowerEmail = trimmedInput.toLowerCase();
    const phoneDigits = normalizePhoneDigits(trimmedInput);

    if (!trimmedInput || !password) {
      return res.status(400).json({ error: 'INVALID_CREDENTIALS', message: 'Email or phone and password are required.' });
    }

    const conditions = [
      eq(users.email, lowerEmail),
      eq(users.phone, trimmedInput),
      eq(sql`REPLACE(${users.phone}, ' ', '')`, trimmedInput.replace(/\s+/g, '')),
    ];

    if (phoneDigits.length >= 7) {
      conditions.push(
        sql`TRANSLATE(REPLACE(REPLACE(REPLACE(${users.phone}, ' ', ''), '+964', ''), '-', ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789') LIKE ${'%' + phoneDigits}`
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(or(...conditions))
      .limit(1);

    if (!user) {
      // Unknown email: constant-time dummy verification to neutralize timing side-channel attacks
      await verifyPassword(DUMMY_ARGON2_HASH, password);
      try {
        await auditService.logAction({
          actorUserId: 'unauthenticated',
          actorRole: 'ANONYMOUS',
          action: 'LOGIN_FAILED_UNKNOWN_USER',
          resourceType: 'AuthAttempt',
          resourceId: trimmedInput,
          ipAddress: (req.ip || '') as string,
        });
      } catch (err) {
        console.warn('[AUTH_AUDIT_WARNING] Failed to record unknown user login audit:', err);
      }
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    const isDev = process.env.NODE_ENV !== 'production';

    // Check temporary account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      // In development mode, allow clearing the lock if the user provides a valid password or initializes their password
      let devCanUnlock = false;
      if (isDev) {
        if (!user.passwordHash && password && password.length >= 6) {
          devCanUnlock = true;
        } else if (user.passwordHash) {
          if (password === 'password123' || (await verifyPassword(user.passwordHash, password))) {
            devCanUnlock = true;
          }
        }
      }

      if (!devCanUnlock) {
        const retryAfterSeconds = Math.max(1, Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 1000));
        res.setHeader('Retry-After', String(retryAfterSeconds));

        try {
          await auditService.logAction({
            actorUserId: user.id,
            actorRole: (user.roles as string[])?.[0] || 'TENANT',
            action: 'LOGIN_ATTEMPT_WHILE_LOCKED',
            resourceType: 'UserSession',
            resourceId: user.id,
            changes: { retryAfterSeconds },
            ipAddress: (req.ip || '') as string,
          });
        } catch (err) {
          console.warn('[AUTH_AUDIT_WARNING] Failed to record locked login attempt audit:', err);
        }

        return res.status(423).json({
          error: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked due to repeated failed login attempts. Please try again later.',
          retryAfter: retryAfterSeconds,
        });
      }
    }

    let isValid = false;

    if (user.passwordHash) {
      isValid = await verifyPassword(user.passwordHash, password);
      // In development environment, also allow master test password 'password123'
      if (!isValid && isDev && password === 'password123') {
        isValid = true;
      }
    } else {
      // Transition fallback for dev/demo seeded personas lacking pre-hashed passwords
      if (isDev) {
        if (password && password.length >= 6) {
          const hashed = await hashPassword(password);
          await db.update(users).set({ passwordHash: hashed, failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
          isValid = true;
        }
      }
    }

    if (!isValid) {
      // Increment failed attempts
      const nextFailed = (user.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: nextFailed };
      let justLocked = false;
      if (nextFailed >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
        justLocked = true;
      }
      await db.update(users).set(updates).where(eq(users.id, user.id));

      try {
        if (justLocked) {
          await auditService.logAction({
            actorUserId: user.id,
            actorRole: (user.roles as string[])?.[0] || 'TENANT',
            action: 'ACCOUNT_TEMPORARILY_LOCKED',
            resourceType: 'User',
            resourceId: user.id,
            changes: { failedAttempts: nextFailed, lockDurationMinutes: 15 },
            ipAddress: (req.ip || '') as string,
          });
        } else {
          await auditService.logAction({
            actorUserId: user.id,
            actorRole: (user.roles as string[])?.[0] || 'TENANT',
            action: 'LOGIN_FAILED',
            resourceType: 'UserSession',
            resourceId: user.id,
            changes: { failedAttempts: nextFailed },
            ipAddress: (req.ip || '') as string,
          });
        }
      } catch (err) {
        console.warn('[AUTH_AUDIT_WARNING] Failed to record login failure audit:', err);
      }

      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    // Check account active status
    if (!user.isActive) {
      return res.status(403).json({ error: 'ACCOUNT_SUSPENDED', message: 'Account is suspended. Please contact support.' });
    }

    // Reset failed attempts on successful login
    if ((user.failedLoginAttempts || 0) > 0 || user.lockedUntil) {
      await db
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, user.id));
    }

    try {
      await auditService.logAction({
        actorUserId: user.id,
        actorRole: (user.roles as string[])?.[0] || 'TENANT',
        action: 'LOGIN_SUCCESS',
        resourceType: 'UserSession',
        resourceId: user.id,
        ipAddress: (req.ip || '') as string,
      });
    } catch (err) {
      console.warn('[AUTH_AUDIT_WARNING] Failed to record login success audit:', err);
    }

    const eligibleWorkspaces = await resolveEligibleWorkspaces(user.id, (user.roles as string[]) || ['TENANT']);

    if (eligibleWorkspaces.length === 0) {
      return res.status(403).json({
        error: 'NO_ELIGIBLE_WORKSPACE',
        message: 'No active or authorized workspaces are available for this account. Please contact support.',
      });
    }

    if (eligibleWorkspaces.length === 1) {
      const activeWs = eligibleWorkspaces[0];
      const token = signAuthToken({
        id: user.id,
        email: user.email,
        roles: (user.roles as string[]) || [activeWs.role],
        activeRole: activeWs.role,
        workspaceId: activeWs.workspaceId,
        organizationId: activeWs.organizationId,
        tokenVersion: user.tokenVersion ?? 1,
      });

      return res.json({
        token,
        user: sanitizeUser(user),
        requiresWorkspaceSelection: false,
        activeWorkspace: activeWs,
        eligibleWorkspaces,
      });
    }

    // Multiple eligible workspaces: DO NOT silently enter any role!
    // Issue token marked with requiresWorkspaceSelection: true
    const token = signAuthToken({
      id: user.id,
      email: user.email,
      roles: (user.roles as string[]) || [],
      tokenVersion: user.tokenVersion ?? 1,
    });

    res.json({
      token,
      user: sanitizeUser(user),
      requiresWorkspaceSelection: true,
      activeWorkspace: null,
      eligibleWorkspaces,
    });

  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'LOGIN_FAILED', message: 'An unexpected authentication error occurred.' });
  }
});

// -----------------------------------------------------------------------------
// 4. Native Logout (Authoritative Server-Side Session Invalidation)
// -----------------------------------------------------------------------------
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const decoded = verifyAuthToken(token);
        if (decoded?.id) {
          await db
            .update(users)
            .set({ tokenVersion: sql`COALESCE(token_version, 1) + 1` })
            .where(eq(users.id, decoded.id));
        }
      } catch {
        // Token was already expired or invalid; ignore
      }
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'LOGOUT_FAILED', message: 'Failed to complete logout.' });
  }
});

// -----------------------------------------------------------------------------
// 4a. Workspace Selection & Role Context Switching (Authoritative JWT Refresh)
// -----------------------------------------------------------------------------
router.post('/select-workspace', requireAuth, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'workspaceId is required.' });
    }

    const eligible = await resolveEligibleWorkspaces(req.user.id, req.user.roles || []);
    const chosen = eligible.find((w) => w.workspaceId === workspaceId);

    if (!chosen) {
      return res.status(403).json({
        error: 'INVALID_WORKSPACE_SELECTION',
        message: 'You are not authorized for the requested workspace.',
      });
    }

    // Sign a fresh token with authoritative activeRole, workspaceId, and organizationId
    const newToken = signAuthToken({
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles,
      activeRole: chosen.role,
      workspaceId: chosen.workspaceId,
      organizationId: chosen.organizationId,
      tokenVersion: req.user.tokenVersion ?? 1,
    });

    await auditService.logAction({
      actorUserId: req.user.id,
      actorRole: chosen.role,
      action: 'WORKSPACE_SELECTED',
      resourceType: 'UserSession',
      resourceId: req.user.id,
      changes: { workspaceId: chosen.workspaceId, role: chosen.role },
      ipAddress: (req.ip || '') as string,
    });

    res.json({
      token: newToken,
      activeWorkspace: chosen,
      user: sanitizeUser(req.user),
    });
  } catch (error: any) {
    console.error('Select workspace error:', error);
    res.status(500).json({ error: 'WORKSPACE_SELECTION_FAILED', message: 'Failed to select workspace.' });
  }
});

// -----------------------------------------------------------------------------
// 4b. Role Enrollment (Add Role to Existing Identity Without Duplicate Account)
// -----------------------------------------------------------------------------
router.post('/roles/enroll', requireAuth, async (req, res) => {
  try {
    const { role, entityType, companyName } = req.body;
    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Role is required.' });
    }

    let normalizedRole = role.toUpperCase();
    if (normalizedRole === 'OWNER') normalizedRole = 'PROPERTY_OWNER';
    if (normalizedRole === 'BROKER') normalizedRole = 'AGENT_BROKER';
    if (normalizedRole === 'AGENT') normalizedRole = 'AGENT_BROKER';

    // Strict Security Guard: Prohibit client self-enrollment into privileged administrative and internal roles!
    const FORBIDDEN_PRIVILEGED_ROLES = [
      // Platform & System Administration
      'PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN',
      'OPERATIONS_ADMIN', 'PROPERTY_ADMIN', 'MARKETPLACE_ADMIN',
      'VERIFICATION_ADMIN', 'FINANCE_ADMIN', 'COMPLIANCE_ADMIN',
      'SUPPORT_ADMIN', 'SECURITY_ADMIN', 'AI_GOVERNANCE_ADMIN',
      'AUDITOR', 'READ_ONLY_ADMIN',
      // Privileged Financial & Organization Roles
      'ACCOUNTANT', 'COMPANY_ADMIN', 'COMPANY_OWNER',
      'PROPERTY_MANAGER', 'MAINTENANCE_MANAGER'
    ];
    if (FORBIDDEN_PRIVILEGED_ROLES.includes(normalizedRole)) {
      return res.status(403).json({
        error: 'FORBIDDEN_PRIVILEGED_ROLE',
        message: 'Administrative and system roles cannot be self-enrolled. Contact system administration.',
      });
    }

    const ALLOWED_ENROLL_ROLES = ['TENANT', 'PROPERTY_OWNER', 'AGENT_BROKER', 'VENDOR', 'BUYER'];
    if (!ALLOWED_ENROLL_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        error: 'INVALID_ROLE',
        message: `Invalid role "${role}". Allowed roles: ${ALLOWED_ENROLL_ROLES.join(', ')}`,
      });
    }

    if (entityType && !['INDIVIDUAL', 'COMPANY'].includes(entityType)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid entityType. Must be INDIVIDUAL or COMPANY.',
      });
    }

    const trimmedCompanyName = typeof companyName === 'string' ? companyName.trim() : '';
    if ((normalizedRole === 'PROPERTY_OWNER' || normalizedRole === 'AGENT_BROKER') && entityType === 'COMPANY') {
      if (!trimmedCompanyName) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Company name is required for company enrollment.',
        });
      }
    }

    // Atomic transaction in PostgreSQL to update user roles and supporting records
    const updatedUser = await db.transaction(async (tx) => {
      const [currentUser] = await tx.select().from(users).where(eq(users.id, req.user.id)).limit(1).for('update');
      if (!currentUser) {
        throw new Error('USER_NOT_FOUND');
      }

      const existingRoles: string[] = (currentUser.roles as string[]) || [];
      const roleSet = new Set(existingRoles);
      
      let updatedRoles = existingRoles;
      if (!roleSet.has(normalizedRole)) {
        roleSet.add(normalizedRole);
        updatedRoles = Array.from(roleSet);
        await tx.update(users)
          .set({ roles: updatedRoles, updatedAt: new Date() })
          .where(eq(users.id, currentUser.id));
      }

      // Automatically initialize supporting profiles in PENDING_VERIFICATION state if needed
      if (normalizedRole === 'AGENT_BROKER') {
        const [existingProfile] = await tx.select().from(agentProfiles).where(eq(agentProfiles.userId, currentUser.id)).limit(1);
        if (!existingProfile) {
          await tx.insert(agentProfiles).values({
            userId: currentUser.id,
            displayName: `${currentUser.firstName} ${currentUser.lastName}`.trim() || 'Agent',
            email: currentUser.email,
            officeName: entityType === 'COMPANY' ? trimmedCompanyName : null,
            status: 'PENDING_VERIFICATION',
            availabilityStatus: 'AVAILABLE',
            isPublic: false,
          });
        } else if (entityType === 'COMPANY' && trimmedCompanyName && !existingProfile.officeName) {
          await tx.update(agentProfiles)
            .set({ officeName: trimmedCompanyName, updatedAt: new Date() })
            .where(eq(agentProfiles.id, existingProfile.id));
        }

        if (entityType === 'COMPANY') {
          // Idempotent organization & membership creation for Agent Company enrollment
          const [existingMemberOrg] = await tx
            .select({
              orgId: organizations.id,
            })
            .from(organizationMembers)
            .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
            .where(
              and(
                eq(organizationMembers.userId, currentUser.id),
                eq(organizations.type, 'AGENT_COMPANY'),
                eq(organizations.name, trimmedCompanyName)
              )
            )
            .limit(1);

          if (!existingMemberOrg) {
            const [newOrg] = await tx.insert(organizations).values({
              name: trimmedCompanyName,
              type: 'AGENT_COMPANY',
              status: 'PENDING_VERIFICATION',
            }).returning();

            await tx.insert(organizationMembers).values({
              organizationId: newOrg.id,
              userId: currentUser.id,
              role: 'COMPANY_ADMIN',
              status: 'ACTIVE',
            });
          }
        }
      } else if (normalizedRole === 'VENDOR') {
        const [existingProfile] = await tx.select().from(vendorProfiles).where(eq(vendorProfiles.userId, currentUser.id)).limit(1);
        if (!existingProfile) {
          await tx.insert(vendorProfiles).values({
            userId: currentUser.id,
            businessName: `${currentUser.firstName} Services`,
            email: currentUser.email,
            status: 'ACTIVE',
            verificationStatus: 'PENDING',
          });
        }
      } else if (normalizedRole === 'PROPERTY_OWNER' && entityType === 'COMPANY') {
        const targetOwnerOrgName = trimmedCompanyName || `${currentUser.firstName}'s Real Estate`;
        // Idempotent organization & membership creation for Owner Company enrollment
        const [existingOwnerOrg] = await tx
          .select({
            orgId: organizations.id,
          })
          .from(organizationMembers)
          .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
          .where(
            and(
              eq(organizationMembers.userId, currentUser.id),
              eq(organizations.type, 'OWNER_COMPANY'),
              eq(organizations.name, targetOwnerOrgName)
            )
          )
          .limit(1);

        if (!existingOwnerOrg) {
          const [newOrg] = await tx.insert(organizations).values({
            name: targetOwnerOrgName,
            type: 'OWNER_COMPANY',
            status: 'PENDING_VERIFICATION',
          }).returning();

          await tx.insert(organizationMembers).values({
            organizationId: newOrg.id,
            userId: currentUser.id,
            role: 'COMPANY_ADMIN',
            status: 'ACTIVE',
          });
        }
      }

      await auditService.logAction({
        actorUserId: currentUser.id,
        actorRole: normalizedRole,
        action: 'ROLE_ENROLLED',
        resourceType: 'UserRole',
        resourceId: currentUser.id,
        changes: { enrolledRole: normalizedRole, entityType, companyName: trimmedCompanyName || undefined },
        ipAddress: (req.ip || '') as string,
      });

      return {
        ...currentUser,
        roles: updatedRoles,
      };
    });

    const eligibleWorkspaces = await resolveEligibleWorkspaces(updatedUser.id, updatedUser.roles as string[]);

    res.json({
      success: true,
      message: `Role ${normalizedRole} added successfully.`,
      user: sanitizeUser(updatedUser),
      eligibleWorkspaces,
    });
  } catch (error: any) {
    if (error?.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User account not found.' });
    }
    console.error('Role enrollment error:', error);
    res.status(500).json({ error: 'ROLE_ENROLLMENT_FAILED', message: 'Failed to enroll in role.' });
  }
});


// -----------------------------------------------------------------------------
// 5. Password Reset Request (Forgot Password)
// -----------------------------------------------------------------------------
router.post('/forgot-password', passwordResetRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const trimmedEmail = (email || '').trim().toLowerCase();

    if (trimmedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      const [user] = await db.select().from(users).where(eq(users.email, trimmedEmail)).limit(1);
      if (user) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        try {
          await auditService.logAction({
            actorUserId: user.id,
            actorRole: (user.roles as string[])?.[0] || 'TENANT',
            action: 'PASSWORD_RESET_REQUESTED',
            resourceType: 'User',
            resourceId: user.id,
            ipAddress: (req.ip || '') as string,
          });
        } catch (err) {
          console.warn('[AUTH_AUDIT_WARNING] Failed to record password reset requested audit:', err);
        }

        // Email delivery via standard provider adapter:
        // If external SMTP/SES/SendGrid credentials exist, dispatches email.
        // If unconfigured, fails closed without fabricating false delivery.
        const emailAdapter = new EmailProviderAdapter();
        if (emailAdapter.isConfigured()) {
          await emailAdapter.sendEmail({
            to: trimmedEmail,
            subject: 'HomeHub Password Reset',
            body: `Your password reset token is: ${rawToken}`,
          });
        } else if (process.env.NODE_ENV !== 'production') {
          // Development-only diagnostic logging (strictly prevented in production)
          console.log(`[DEV_AUTH_RECOVERY] Reset token generated for ${trimmedEmail}: ${rawToken}`);
        }
      }
    }

    // Always return generic notice to prevent email enumeration
    res.json({
      message: 'If an account exists with this email, password recovery instructions have been dispatched.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'RECOVERY_ERROR', message: 'Failed to process password recovery request.' });
  }
});

// -----------------------------------------------------------------------------
// 6. Complete Password Reset
// -----------------------------------------------------------------------------
router.post('/reset-password', passwordResetRateLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Token and a valid password (6+ chars) are required.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date();

    const [record] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .limit(1);

    if (!record) {
      return res.status(400).json({ error: 'INVALID_TOKEN', message: 'Recovery token is invalid or has expired.' });
    }

    const hashed = await hashPassword(newPassword);

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          passwordHash: hashed,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: sql`COALESCE(token_version, 1) + 1`,
        })
        .where(eq(users.id, record.userId));
      await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.id, record.id));
    });

    try {
      await auditService.logAction({
        actorUserId: record.userId,
        actorRole: 'TENANT',
        action: 'PASSWORD_RESET_COMPLETED',
        resourceType: 'User',
        resourceId: record.userId,
        ipAddress: (req.ip || '') as string,
      });
    } catch (err) {
      console.warn('[AUTH_AUDIT_WARNING] Failed to record password reset completed audit:', err);
    }

    res.json({ success: true, message: 'Password has been reset successfully.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'RESET_FAILED', message: 'Failed to reset password.' });
  }
});

// -----------------------------------------------------------------------------
// 7. Backward-Compatible /sync Endpoint
// -----------------------------------------------------------------------------
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const { accountType = 'TENANT', entityType, companyName } = req.body;

    // If user already exists in req.user, just return
    if (req.user && req.user.id) {
      return res.json({ user: sanitizeUser(req.user) });
    }

    if (!req.firebaseUser) {
      return res.status(401).json({ error: 'Unauthorized: Missing valid token' });
    }

    const { uid, email, name, picture } = req.firebaseUser;
    if (!email) {
      return res.status(400).json({ error: 'Email required for provisioning' });
    }

    const firstName = name ? name.split(' ')[0] : 'Unknown';
    const lastName = name && name.includes(' ') ? name.substring(name.indexOf(' ') + 1) : 'User';

    let roleToAssign = accountType;
    if (roleToAssign === 'OWNER') roleToAssign = 'PROPERTY_OWNER';
    if (roleToAssign === 'BROKER' || roleToAssign === 'AGENT') roleToAssign = 'AGENT_BROKER';
    if (roleToAssign === 'COMPANY') roleToAssign = 'PROPERTY_OWNER';

    if (!['TENANT', 'PROPERTY_OWNER', 'AGENT_BROKER', 'VENDOR'].includes(roleToAssign)) {
      roleToAssign = 'TENANT';
    }

    if (roleToAssign === 'PROPERTY_OWNER' || roleToAssign === 'AGENT_BROKER') {
      if (!entityType || !['INDIVIDUAL', 'COMPANY'].includes(entityType)) {
        return res.status(400).json({ error: 'Property Owner and Agent require a valid entityType (INDIVIDUAL or COMPANY)' });
      }
    }

    const [newUser] = await db
      .insert(users)
      .values({
        uid,
        email,
        firstName,
        lastName,
        avatarUrl: picture || null,
        roles: [roleToAssign],
        isActive: true,
      })
      .returning();

    if (entityType === 'COMPANY') {
      const [newOrg] = await db
        .insert(organizations)
        .values({
          name: companyName || `${firstName}'s Real Estate`,
          type: roleToAssign === 'AGENT_BROKER' ? 'AGENT_COMPANY' : 'OWNER_COMPANY',
          status: 'PENDING_VERIFICATION',
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId: newUser.id,
        role: 'COMPANY_ADMIN',
        status: 'ACTIVE',
      });
    }

    if (roleToAssign === 'AGENT_BROKER') {
      await db.insert(agentProfiles).values({
        userId: newUser.id,
        displayName: `${firstName} ${lastName}`.trim() || 'Agent',
        email,
        officeName: entityType === 'COMPANY' ? (companyName || `${firstName}'s Real Estate`) : null,
        status: 'PENDING_VERIFICATION',
        availabilityStatus: 'AVAILABLE',
        isPublic: false,
      });
    } else if (roleToAssign === 'VENDOR') {
      await db.insert(vendorProfiles).values({
        userId: newUser.id,
        businessName: `${firstName} Services`,
        email,
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
      });
    }

    await auditService.logAction({
      actorUserId: newUser.id,
      actorRole: roleToAssign,
      action: 'USER_PROVISIONED',
      resourceType: 'User',
      resourceId: newUser.id,
      ipAddress: (req.ip || '') as string,
    });

    res.json({ user: sanitizeUser(newUser) });
  } catch (error: any) {
    console.error('Auth sync error:', error);
    res.status(500).json({ error: 'Failed to sync user profile' });
  }
});

export default router;
