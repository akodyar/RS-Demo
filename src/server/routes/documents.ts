import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth } from '../middleware/auth.js';
import { DocumentStatus, Permission } from '../../types/index.js';
import { auditService } from '../services/audit.js';
import { db } from '../../db/index.js';
import { documents } from '../../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { ownerRepository } from '../repositories/owner.js';

const router = Router();



// ==========================================
// DOCUMENTS
// ==========================================

router.get('/', requireAuth, requireDatabase, async (req, res) => {
  
  try {
    const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
    const docs = await ownerRepository.getScopedDocuments(req.user!, propertyId);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload', requireAuth, requireDatabase, async (req, res) => {
  
  try {
    const { title, category, propertyId, fileUrl } = req.body;
    if (!title || !propertyId) {
      return res.status(400).json({ error: 'title and propertyId are required' });
    }

    const hasPerm = await ownerRepository.verifyPropertyPermission(req.user!, propertyId, Permission.MANAGE_DOCUMENTS);
    if (!hasPerm) {
      return res.status(403).json({ error: 'Forbidden: You lack authority to upload documents for this property.' });
    }

    const [doc] = await db
      .insert(documents)
      .values({
        propertyId,
        uploaderUserId: req.user!.id,
        title,
        documentType: category || 'GENERAL',
        verificationState: 'PENDING',
        fileUrl,
      })
      .returning();

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'DOCUMENT_UPLOADED',
      resourceType: 'Document',
      resourceId: doc.id,
      changes: { title, category, propertyId, status: DocumentStatus.UPLOADED },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(doc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
