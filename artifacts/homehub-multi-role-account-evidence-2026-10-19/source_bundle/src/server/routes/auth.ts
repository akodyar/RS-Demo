import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../../db/index.js';
import { users, organizations, organizationMembers, passwordResetTokens } from '../../db/schema.js';
import { eq, and, gt, isNull, sql } from 'drizzle-orm';
import { auditService } from '../services/audit.js';
import { hashPassword, verifyPassword, signAuthToken, verifyAuthToken } from '../utils/auth.js';
import { EmailProviderAdapter } from '../services/provider-adapters.js';

const router = Router();

function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, failedLoginAttempts, lockedUntil, tokenVersion, ...safeUser } = user;
  return safeUser;
}

// -----------------------------------------------------------------------------
// 1. Current Authoritative User Profile Lookup
// -----------------------------------------------------------------------------
router.get('/me', requireAuth, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: User session invalid' });
  }
  res.json({ user: sanitizeUser(req.user) });
});

// -----------------------------------------------------------------------------
// 2. Native User Registration
// -----------------------------------------------------------------------------
router.post('/register', async (req, res) => {
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
    if (roleToAssign === 'BROKER') roleToAssign = 'AGENT';
    if (roleToAssign === 'COMPANY') roleToAssign = 'PROPERTY_OWNER';

    if (!['TENANT', 'PROPERTY_OWNER', 'AGENT', 'VENDOR', 'BUYER'].includes(roleToAssign)) {
      roleToAssign = 'TENANT';
    }

    if (roleToAssign === 'PROPERTY_OWNER' || roleToAssign === 'AGENT') {
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

      if (entityType === 'COMPANY') {
        const [newOrg] = await tx
          .insert(organizations)
          .values({
            name: companyName || `${firstName}'s Real Estate`,
            type: roleToAssign === 'AGENT' ? 'AGENT_COMPANY' : 'OWNER_COMPANY',
            status: 'PENDING_VERIFICATION',
          })
          .returning();

        await tx.insert(organizationMembers).values({
          organizationId: newOrg.id,
          userId: newUser.id,
          role: 'COMPANY_ADMIN',
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

      return { user: newUser };
    });

    if (result.duplicate) {
      return res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS', message: 'This email is already registered.' });
    }

    const token = signAuthToken({
      id: result.user!.id,
      email: result.user!.email,
      roles: (result.user!.roles as string[]) || [roleToAssign],
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

// -----------------------------------------------------------------------------
// 3. Native User Sign-In (Login)
// -----------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const trimmedEmail = (email || '').trim().toLowerCase();
    if (!trimmedEmail || !password) {
      return res.status(400).json({ error: 'INVALID_CREDENTIALS', message: 'Email and password are required.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, trimmedEmail)).limit(1);

    if (!user) {
      // Unknown email: reject with generic invalid credentials
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    }

    // Check temporary account lockout
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      return res.status(423).json({
        error: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to repeated failed login attempts. Please try again later.',
      });
    }

    let isValid = false;

    if (user.passwordHash) {
      isValid = await verifyPassword(user.passwordHash, password);
    } else {
      // Transition fallback for dev/demo seeded personas lacking pre-hashed passwords
      const isDev = process.env.NODE_ENV !== 'production';
      if (isDev && password === 'password123') {
        const hashed = await hashPassword('password123');
        await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, user.id));
        isValid = true;
      }
    }

    if (!isValid) {
      // Increment failed attempts
      const nextFailed = (user.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: nextFailed };
      if (nextFailed >= 5) {
        updates.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      }
      await db.update(users).set(updates).where(eq(users.id, user.id));

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

    const token = signAuthToken({
      id: user.id,
      email: user.email,
      roles: (user.roles as string[]) || ['TENANT'],
      tokenVersion: user.tokenVersion ?? 1,
    });

    res.json({
      token,
      user: sanitizeUser(user),
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
// 5. Password Reset Request (Forgot Password)
// -----------------------------------------------------------------------------
router.post('/forgot-password', async (req, res) => {
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
router.post('/reset-password', async (req, res) => {
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
    if (roleToAssign === 'BROKER') roleToAssign = 'AGENT';
    if (roleToAssign === 'COMPANY') roleToAssign = 'PROPERTY_OWNER';

    if (!['TENANT', 'PROPERTY_OWNER', 'AGENT', 'VENDOR'].includes(roleToAssign)) {
      roleToAssign = 'TENANT';
    }

    if (roleToAssign === 'PROPERTY_OWNER' || roleToAssign === 'AGENT') {
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
          type: roleToAssign === 'AGENT' ? 'AGENT_COMPANY' : 'OWNER_COMPANY',
          status: 'PENDING_VERIFICATION',
        })
        .returning();

      await db.insert(organizationMembers).values({
        organizationId: newOrg.id,
        userId: newUser.id,
        role: 'COMPANY_ADMIN',
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
