import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { auditService } from '../services/audit';

const router = Router();

// ==========================================
// PROPERTY PASSPORT & DIGITAL RECORD
// ==========================================

router.get('/:propertyId', requireAuth, async (req, res) => {
  const { propertyId } = req.params;

  // Audit that the user accessed this sensitive read-model
  await auditService.logAction({
    actorUserId: req.user!.id,
    actorRole: req.user!.roles[0] as string,
    action: 'PROPERTY_PASSPORT_ACCESSED',
    resourceType: 'PropertyPassport',
    resourceId: propertyId as string,
    changes: {},
    ipAddress: (req.ip || "") as string
  });

  // Mock aggregated payload representing the Property Passport
  res.status(501).json({ error: "NOT_IMPLEMENTED", message: "Database NOT_CONFIGURED" });
});

export default router;
