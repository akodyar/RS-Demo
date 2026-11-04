import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth } from '../middleware/auth.js';
import { db } from '../../db/index.js';
import { salesContracts, properties, propertyOffers } from '../../db/schema.js';
import { eq, or, and, desc } from 'drizzle-orm';
import { auditService } from '../services/audit.js';

const router = Router();



// List user's contracts (as buyer or seller)
router.get('/', requireAuth, requireDatabase, async (req, res) => {
  
  try {
    const userId = req.user!.id;
    const records = await db
      .select({
        contract: salesContracts,
        property: properties
      })
      .from(salesContracts)
      .innerJoin(properties, eq(salesContracts.propertyId, properties.id))
      .where(or(eq(salesContracts.buyerId, userId), eq(salesContracts.sellerId, userId)))
      .orderBy(desc(salesContracts.createdAt));

    res.json(records.map(r => ({
      ...r.contract,
      agreedPrice: Number(r.contract.agreedPrice),
      depositAmount: r.contract.depositAmount ? Number(r.contract.depositAmount) : undefined,
      propertyName: r.property.name
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get contract details by ID with IDOR protection
router.get('/:id', requireAuth, requireDatabase, async (req, res) => {
  
  try {
    const userId = req.user!.id;
    const contractId = String(req.params.id);
    const [record] = await db
      .select({
        contract: salesContracts,
        property: properties
      })
      .from(salesContracts)
      .innerJoin(properties, eq(salesContracts.propertyId, properties.id))
      .where(
        and(
          eq(salesContracts.id, contractId),
          or(eq(salesContracts.buyerId, userId), eq(salesContracts.sellerId, userId))
        )
      )
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Contract not found or access unauthorized' });
    }

    res.json({
      ...record.contract,
      agreedPrice: Number(record.contract.agreedPrice),
      depositAmount: record.contract.depositAmount ? Number(record.contract.depositAmount) : undefined,
      propertyName: record.property.name,
      propertyAddress: record.property.address
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
