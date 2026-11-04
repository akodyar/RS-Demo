import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requirePropertyPermission } from '../middleware/auth.js';
import { Permission, ListingStatus, ListingType, OfferStatus } from '../../types/index.js';
import { auditService } from '../services/audit.js';
import { db } from '../../db/index.js';
import { listings, properties } from '../../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { ownerRepository } from '../repositories/owner.js';
import { FeatureFlags } from '../../utils/featureFlags.js';
import { ownershipRecords } from '../../db/schema.js';
import { promotionCampaignService } from '../services/promotion-campaign.js';

const router = Router();



// ==========================================
// MARKETPLACE LISTINGS
// ==========================================

// Create Listing (Requires Listing Authority)
router.post('/listings', requireAuth, requireDatabase, async (req, res) => {
  
  try {
    const { propertyId, type, price, currency, title, description } = req.body;
    if (!propertyId || !type || !price || !title) {
      return res.status(400).json({ error: 'propertyId, type, price, and title are required' });
    }

    if (type === 'FOR_SALE' && !FeatureFlags.BUY_SELL_ENABLED) {
      return res.status(403).json({ error: 'BUY_SELL_DISABLED', message: 'Buying and selling functionality is currently disabled.' });
    }

    const listing = await ownerRepository.listPropertyOnMarketplace(req.user!, {
      propertyId,
      type,
      price: Number(price),
      currency,
      title,
      description,
    });

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'CREATE_LISTING',
      resourceType: 'Listing',
      resourceId: listing.id,
      changes: { propertyId, type, price, status: ListingStatus.DRAFT },
      ipAddress: (req.ip || '') as string,
    });

    res.status(201).json(listing);
  } catch (err: any) {
    if (err.message?.includes('AUTHORITY_REQUIRED')) {
      return res.status(403).json({ error: 'Forbidden: ' + err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Search Listings (Publicly available Discovery foundation with strict server-side domain separation and promotion boost)
router.get('/listings/search', async (req, res) => {
  try {
    const { type, propertyType, minPrice, maxPrice, limit = 20, offset = 0, asOf, placement } = req.query;
    
    // STRICT DOMAIN SEPARATION: Require explicit, valid listing type
    const normalizedType = typeof type === 'string' ? type.toUpperCase() : null;
    if (normalizedType !== 'FOR_SALE' && normalizedType !== 'SALE' && normalizedType !== 'FOR_RENT' && normalizedType !== 'RENT') {
      return res.status(400).json({ error: 'STRICT_DOMAIN_SEPARATION: You must explicitly query for SALE or RENT domains.' });
    }

    if ((normalizedType === 'FOR_SALE' || normalizedType === 'SALE') && !FeatureFlags.BUY_SELL_ENABLED) {
      return res.status(403).json({ error: 'BUY_SELL_DISABLED', message: 'Buying and selling functionality is currently disabled.' });
    }

    const effectiveAsOf = typeof asOf === 'string' && !isNaN(new Date(asOf).getTime()) ? new Date(asOf) : new Date();
    const effectivePlacement = typeof placement === 'string' ? placement : 'SEARCH';

    const result = await promotionCampaignService.searchRentalListings({
      type: normalizedType === 'SALE' ? 'FOR_SALE' : normalizedType === 'RENT' ? 'FOR_RENT' : normalizedType,
      propertyType: typeof propertyType === 'string' ? propertyType : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
      asOf: effectiveAsOf,
      placement: effectivePlacement,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Listing Details by ID
router.get('/listings/:id', async (req, res) => {
  
  try {
    const [record] = await db
      .select({
        listing: listings,
        property: properties,
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(eq(listings.id, req.params.id))
      .limit(1);

    if (!record) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (record.listing.status !== 'PUBLISHED' || (record.property.verificationStatus !== 'VERIFIED' && record.property.status !== 'VERIFIED')) {
      const user = (req as any).user;
      const isAdmin = user?.roles?.some((r: string) => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PROPERTY_ADMIN', 'ADMIN'].includes(r));
      const isOwner = user?.id ? await db.query.ownershipRecords.findFirst({
        where: and(
          eq(ownershipRecords.propertyId, record.property.id),
          eq(ownershipRecords.ownerId, user.id)
        )
      }) : null;
      if (!isAdmin && !isOwner) {
        return res.status(404).json({ error: 'Listing not found' });
      }
    }

    res.json({
      ...record.listing,
      price: Number(record.listing.price),
      property: record.property
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Public Company Profile
router.get('/companies/:id', async (req, res) => {
  try {
    const { organizations } = await import('../../db/schema.js');
    const [org] = await db.select().from(organizations).where(eq(organizations.id, req.params.id)).limit(1);
    
    if (!org) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(org);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Listings by Company (Strict Domain Separation Supported via ?type=SALE|RENT)
router.get('/companies/:id/listings', async (req, res) => {
  try {
    const { type, limit = 20, offset = 0 } = req.query;
    
    const pageLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const pageOffset = Math.max(0, Number(offset) || 0);

    const conditions = [
      eq(listings.publisherCompanyId, req.params.id),
      eq(listings.status, 'PUBLISHED'),
      eq(properties.verificationStatus, 'VERIFIED')
    ];

    if (type && typeof type === 'string') {
      const normalizedType = type.toUpperCase();
      if (normalizedType === 'SALE' || normalizedType === 'FOR_SALE') {
        if (!FeatureFlags.BUY_SELL_ENABLED) {
          return res.status(403).json({ error: 'BUY_SELL_DISABLED', message: 'Buying and selling functionality is currently disabled.' });
        }
        conditions.push(eq(listings.type, 'FOR_SALE'));
      } else if (normalizedType === 'RENT' || normalizedType === 'FOR_RENT') {
        conditions.push(eq(listings.type, 'FOR_RENT'));
      }
    }

    let query = db
      .select({
        listing: listings,
        property: properties,
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(and(...conditions))
      .orderBy(desc(listings.createdAt))
      .limit(pageLimit)
      .offset(pageOffset);

    const results = await query;

    res.json({
      items: results.map(r => ({
        ...r.listing,
        price: Number(r.listing.price),
        property: r.property
      })),
      total: results.length,
      limit: pageLimit,
      offset: pageOffset
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
