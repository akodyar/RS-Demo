import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireDatabase } from '../middleware/dbGuard.js';
import { promotionCampaignService } from '../services/promotion-campaign.js';
import { db } from '../../db/index.js';
import { promotionCampaigns, listings, properties, ownershipRecords } from '../../db/schema.js';
import { eq, and, sql, desc, lte, gt } from 'drizzle-orm';

const router = Router();

function handleRouteError(res: Response, err: any) {
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
  if (msg.includes('NOT_FOUND') || msg.includes('CAMPAIGN_NOT_FOUND') || msg.includes('PACKAGE_NOT_FOUND') || msg.includes('LISTING_NOT_FOUND')) {
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
// 1. ELIGIBLE PROMOTION PACKAGES (PUBLIC / AUTH)
// ==========================================
router.get('/packages', requireDatabase, async (_req: Request, res: Response) => {
  try {
    const packages = await promotionCampaignService.listEligiblePackages();
    res.json(packages);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 2. DEDICATED ADVERTISING PLACEMENTS (PUBLIC)
// Dedicated advertising placement query for Home Featured ('HOMEPAGE')
// and Sponsored Search ('SEARCH').
// ==========================================
router.get('/placements/:scope', requireDatabase, async (req: Request, res: Response) => {
  try {
    const rawScope = String(req.params.scope || '').toUpperCase();
    if (rawScope !== 'HOMEPAGE' && rawScope !== 'SEARCH') {
      return res.status(400).json({
        error: 'INVALID_PLACEMENT_SCOPE',
        message: "Placement scope must be strictly 'HOMEPAGE' or 'SEARCH'.",
      });
    }

    const effectiveAsOf = new Date();
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 50);

    const placementCondition = rawScope === 'HOMEPAGE'
      ? sql`(${promotionCampaigns.campaignType} IN ('HOME_FEATURED', 'MULTI_PAGE') OR ${promotionCampaigns.placementScope}::text LIKE '%"HOMEPAGE"%')`
      : sql`(${promotionCampaigns.campaignType} IN ('SPONSORED_SEARCH', 'MULTI_PAGE') OR ${promotionCampaigns.placementScope}::text LIKE '%"SEARCH"%')`;

    // Strictly fetch published listings of verified properties backed by verified ownership
    // with an active campaign within its valid start/end window.
    const rows = await db
      .select({
        campaign: promotionCampaigns,
        listing: listings,
        property: properties,
      })
      .from(promotionCampaigns)
      .innerJoin(listings, eq(promotionCampaigns.listingId, listings.id))
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(
        and(
          eq(promotionCampaigns.status, 'ACTIVE'),
          lte(promotionCampaigns.startTime, effectiveAsOf),
          gt(promotionCampaigns.endTime, effectiveAsOf),
          placementCondition,
          eq(listings.status, 'PUBLISHED'),
          eq(properties.verificationStatus, 'VERIFIED'),
          sql`EXISTS (
            SELECT 1 FROM ownership_records
            WHERE ownership_records.property_id = ${properties.id}
              AND ownership_records.status = 'VERIFIED'
          )`
        )
      )
      .orderBy(desc(promotionCampaigns.startTime))
      .limit(limit);

    const items = rows.map((r) => ({
      campaignId: r.campaign.id,
      campaignType: r.campaign.campaignType,
      placementScope: r.campaign.placementScope,
      startTime: r.campaign.startTime,
      endTime: r.campaign.endTime,
      isPromoted: true,
      listing: {
        ...r.listing,
        price: Number(r.listing.price),
      },
      property: r.property,
    }));

    res.json({
      placement: rawScope,
      count: items.length,
      items,
    });
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 3. CREATE DRAFT CAMPAIGN
// ==========================================
router.post('/campaigns', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { listingId, packageId, payerUserId } = req.body;
    if (!listingId || !packageId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'listingId and packageId are required' });
    }

    const campaign = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId,
      actorUserId: req.user.id,
      actorRoles: req.user.roles,
      payerUserId,
    });

    res.status(201).json(campaign);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 4. GET CAMPAIGN BY ID
// ==========================================
router.get('/campaigns/:id', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const campaign = await promotionCampaignService.getCampaign(
      String(req.params.id),
      req.user.id,
      req.user.roles
    );
    res.json(campaign);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 5. SUBMIT CAMPAIGN & RESERVE POINTS
// ==========================================
router.post('/campaigns/:id/submit', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { idempotencyKey } = req.body || {};
    const result = await promotionCampaignService.submitCampaign({
      campaignId: String(req.params.id),
      actorUserId: req.user.id,
      actorRoles: req.user.roles,
      idempotencyKey,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 6. GRANT PROPERTY OWNER CONSENT
// ==========================================
router.post('/campaigns/:id/consent/grant', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { notes, evidence } = req.body || {};
    const result = await promotionCampaignService.grantOwnerConsent({
      campaignId: String(req.params.id),
      actorUserId: req.user.id,
      actorRoles: req.user.roles,
      notes,
      evidence,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 7. DENY PROPERTY OWNER CONSENT
// ==========================================
router.post('/campaigns/:id/consent/deny', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'A non-empty reason is required.' });
    }

    const result = await promotionCampaignService.denyOwnerConsent({
      campaignId: String(req.params.id),
      actorUserId: req.user.id,
      actorRoles: req.user.roles,
      reason,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 8. ADMIN: MODERATION QUEUE
// ==========================================
router.get('/admin/moderation-queue', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const queue = await promotionCampaignService.getModerationQueue(
      req.user.id,
      req.user.roles
    );
    res.json(queue);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 9. ADMIN: APPROVE CAMPAIGN
// ==========================================
router.post('/admin/campaigns/:id/approve', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { notes } = req.body || {};
    const result = await promotionCampaignService.approveCampaign({
      campaignId: String(req.params.id),
      adminUserId: req.user.id,
      adminRoles: req.user.roles,
      notes,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 10. ADMIN: REJECT CAMPAIGN
// ==========================================
router.post('/admin/campaigns/:id/reject', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body || {};
    if (!reason) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'A non-empty reason is required.' });
    }

    const result = await promotionCampaignService.rejectCampaign({
      campaignId: String(req.params.id),
      adminUserId: req.user.id,
      adminRoles: req.user.roles,
      reason,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

// ==========================================
// 11. ACTIVATE CAMPAIGN
// ==========================================
router.post('/campaigns/:id/activate', requireAuth, requireDatabase, async (req: Request, res: Response) => {
  try {
    const { startTime, idempotencyKey } = req.body || {};
    const result = await promotionCampaignService.activateCampaign({
      campaignId: String(req.params.id),
      actorUserId: req.user.id,
      actorRoles: req.user.roles,
      startTime: startTime ? new Date(startTime) : undefined,
      idempotencyKey,
    });

    res.json(result);
  } catch (err: any) {
    handleRouteError(res, err);
  }
});

export default router;
