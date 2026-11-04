import { Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Middleware to enforce ADMIN role
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user?.roles.includes('ADMIN') && !req.user?.roles.includes('SUPER_ADMIN') && !req.user?.roles.includes('PLATFORM_ADMIN')) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ==========================================
// EXTERNAL INTEGRATIONS ADMIN
// ==========================================

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  // Returns integration configuration safely without secrets
  res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });
});
router.get('/webhooks', requireAuth, requireAdmin, async (req, res) => {
  // Returns recent webhook events
  res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });
});
export default router;
