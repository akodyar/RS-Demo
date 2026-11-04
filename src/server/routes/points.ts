import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/dbGuard.js';
import { pointsEngine } from '../services/points-engine.js';
import { db } from '../../db/index.js';
import { pointsPurchasePackages, pointsPurchaseOrders } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const router = Router();

function handleRouteError(res: Response, err: any) {
  console.error('[POINTS_ROUTE_ERROR]', err);
  const msg = err?.message || 'Internal server error';
  if (msg.includes('UNAUTHENTICATED')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: msg });
  }
  if (
    msg.includes('UNAUTHORIZED_ACCESS') ||
    msg.includes('FORBIDDEN') ||
    msg.includes('UNAUTHORIZED_ROLE') ||
    msg.includes('UNAUTHORIZED_PURCHASER') ||
    msg.includes('PACKAGE_ROLE_DISALLOWED') ||
    msg.includes('UNAUTHORIZED_PROPERTY_ACCESS') ||
    msg.includes('UNAUTHORIZED_PAYER') ||
    msg.includes('UNAUTHORIZED_OWNER_CONSENT') ||
    msg.includes('UNAUTHORIZED_ADMIN') ||
    msg.includes('BUY_SELL_DISABLED')
  ) {
    return res.status(403).json({ error: 'FORBIDDEN', message: msg });
  }
  if (msg.includes('NOT_FOUND') || msg.includes('PACKAGE_NOT_FOUND') || msg.includes('ORDER_NOT_FOUND')) {
    return res.status(404).json({ error: 'NOT_FOUND', message: msg });
  }
  if (
    msg.includes('INVALID_') ||
    msg.includes('MANDATORY_') ||
    msg.includes('OWNER_CONSENT_') ||
    msg.includes('MISSING_') ||
    msg.includes('PACKAGE_INACTIVE') ||
    msg.includes('INELIGIBLE_') ||
    msg.includes('INACTIVE_') ||
    msg.includes('INSUFFICIENT_')
  ) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: msg });
  }
  if (msg.includes('CONFLICT') || msg.includes('CONCURRENCY')) {
    return res.status(409).json({ error: 'CONFLICT', message: msg });
  }
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
}

// ==========================================
// 1. WALLET & TRANSACTION HISTORY
// ==========================================
router.get('/wallet', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 50), 100);
    const result = await pointsEngine.getWalletWithHistory(req.user.id, limit, {
      actorUserId: req.user.id,
      actorRoles: req.user.roles,
    });
    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 2. POINTS PURCHASE PACKAGES (PUBLIC / AUTH)
// ==========================================
router.get('/packages', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const packages = await db
      .select()
      .from(pointsPurchasePackages)
      .where(eq(pointsPurchasePackages.isActive, true))
      .orderBy(pointsPurchasePackages.price);
    res.json(packages);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 3. CREATE PURCHASE ORDER (OWNER / AGENT ONLY)
// ==========================================
router.post('/purchase', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { packageId, paymentMethod, paymentReference, idempotencyKey } = req.body;
    if (!packageId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'packageId is required' });
    }

    const result = await pointsEngine.createPurchaseOrder({
      userId: req.user.id,
      userRoles: req.user.roles,
      packageId,
      paymentMethod,
      paymentReference,
      idempotencyKey,
      actorUserId: req.user.id,
    });

    res.status(201).json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 4. ADMIN: LIST PENDING PURCHASE ORDERS
// ==========================================
router.get('/admin/purchase-orders', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'PLATFORM_ADMIN'];
    const isAdmin = Array.isArray(req.user?.roles) && req.user.roles.some((r: string) => adminRoles.includes(r));
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient administrative privileges.' });
    }

    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined;
    let query = db.select().from(pointsPurchaseOrders);

    if (statusFilter) {
      query = query.where(eq(pointsPurchaseOrders.status, statusFilter)) as any;
    }

    const orders = await query.orderBy(desc(pointsPurchaseOrders.createdAt));
    res.json(orders);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 5. ADMIN: MANUAL CONFIRM PURCHASE ORDER
// ==========================================
router.post('/admin/purchase-orders/:id/confirm', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const adminRoles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'PLATFORM_ADMIN'];
    const isAdmin = Array.isArray(req.user?.roles) && req.user.roles.some((r: string) => adminRoles.includes(r));
    if (!isAdmin) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient administrative privileges.' });
    }

    const orderId = String(req.params.id);
    const { idempotencyKey } = req.body || {};

    const result = await pointsEngine.confirmPurchaseOrder({
      orderId,
      adminUserId: req.user.id,
      adminRoles: req.user.roles,
      idempotencyKey,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

export default router;
