import { db } from '../../db/index.js';
import {
  promotionCampaignRepository,
  PromotionCampaign,
  PromotionPackage,
  SearchRentalListingsParams,
  SearchRentalListingsResult,
} from '../repositories/promotion-campaign.js';
import { pointsEngine } from './points-engine.js';
import { auditService } from './audit.js';
import { ownershipRecords, type PointsTransaction } from '../../db/schema.js';
import { eq, and } from 'drizzle-orm';

export interface CreateDraftCampaignParams {
  listingId: string;
  packageId: string;
  actorUserId: string; // Server-derived from authenticated session
  actorRoles: string[]; // Server-derived from authenticated session
  payerUserId?: string; // Optional: defaults to actorUserId
}

export interface SubmitCampaignParams {
  campaignId: string;
  actorUserId: string; // Server-derived from authenticated session
  actorRoles: string[]; // Server-derived from authenticated session
  idempotencyKey?: string;
}

export interface SubmitCampaignResult {
  campaign: PromotionCampaign;
  reservation: PointsTransaction | null;
  idempotentReplay: boolean;
}

export interface GrantOwnerConsentParams {
  campaignId: string;
  actorUserId: string; // Server-derived from authenticated session
  actorRoles: string[]; // Server-derived from authenticated session
  notes?: string;
  evidence?: Record<string, any>;
  simulateAuditFailure?: boolean;
}

export interface DenyOwnerConsentParams {
  campaignId: string;
  actorUserId: string; // Server-derived from authenticated session
  actorRoles: string[]; // Server-derived from authenticated session
  reason: string;
  simulateAuditFailure?: boolean;
}

export interface ApproveCampaignParams {
  campaignId: string;
  adminUserId: string; // Server-derived from authenticated session
  adminRoles: string[]; // Server-derived from authenticated session
  notes?: string;
  simulateAuditFailure?: boolean;
}

export interface RejectCampaignParams {
  campaignId: string;
  adminUserId: string; // Server-derived from authenticated session
  adminRoles: string[]; // Server-derived from authenticated session
  reason: string;
  simulateAuditFailure?: boolean;
}

export interface ActivateCampaignParams {
  campaignId: string;
  actorUserId?: string; // Server-derived from authenticated session or 'SYSTEM'
  actorRoles?: string[]; // Server-derived from authenticated session
  startTime?: Date;
  idempotencyKey?: string;
  simulateAuditFailure?: boolean;
}

export interface ActivateCampaignResult {
  campaign: PromotionCampaign;
  spendTransaction: PointsTransaction | null;
  idempotentReplay: boolean;
}

export interface ExpireCampaignParams {
  campaignId: string;
  actorUserId?: string;
  actorRoles?: string[];
  asOf?: Date;
  force?: boolean;
  simulateAuditFailure?: boolean;
}

export interface ExpireCampaignResult {
  campaign: PromotionCampaign;
  idempotentReplay: boolean;
}

export interface ExpireDueCampaignsParams {
  asOf?: Date;
  actorUserId?: string;
  actorRoles?: string[];
  batchSize?: number;
}

export interface ExpireDueCampaignsResult {
  expiredCount: number;
  campaigns: PromotionCampaign[];
  failedCount?: number;
  failedCampaigns?: { campaignId: string; error: string }[];
}

export class PromotionCampaignService {
  /**
   * Lists all active, eligible promotion packages available for purchase.
   */
  async listEligiblePackages(): Promise<PromotionPackage[]> {
    return await promotionCampaignRepository.listActivePackages();
  }

  /**
   * Creates a promotion campaign in DRAFT status.
   * Enforces server-side authentication, rental-only invariants, listing/property eligibility,
   * package snapshotting, and owner-consent determination without touching points balances.
   */
  async createDraftCampaign(params: CreateDraftCampaignParams): Promise<PromotionCampaign> {
    const { listingId, packageId, actorUserId, actorRoles, payerUserId: rawPayerUserId } = params;

    // 1. Validate actor presence and role
    if (!actorUserId) {
      throw new Error('UNAUTHENTICATED: Actor user identity must be derived from trusted authentication.');
    }

    const permittedRoles = ['PROPERTY_OWNER', 'AGENT', 'AGENT_BROKER'];
    const hasPermittedRole = Array.isArray(actorRoles) && actorRoles.some((r) => permittedRoles.includes(r));
    if (!hasPermittedRole) {
      throw new Error('FORBIDDEN_ROLE: Only Property Owners and Agents may create promotion campaigns.');
    }

    // 2. Fetch and validate listing and property eligibility
    const context = await promotionCampaignRepository.getListingWithPropertyAndOwner(listingId);
    if (!context || !context.listing) {
      throw new Error(`LISTING_NOT_FOUND: Rental listing '${listingId}' does not exist.`);
    }

    const { listing, property, ownerships, agentAssignments } = context;

    // Strict Rental-Only invariant
    if (listing.type !== 'FOR_RENT') {
      throw new Error(
        `FORBIDDEN_SALE_LISTING: Promotion campaigns are strictly restricted to rental listings. Listing '${listingId}' has type '${listing.type}'. Buy/sell workflows remain disabled.`
      );
    }

    if (listing.status === 'ARCHIVED') {
      throw new Error(`INELIGIBLE_LISTING_STATUS: Cannot promote an archived listing '${listingId}'.`);
    }

    if (!property || (property.status !== 'ACTIVE' && property.status !== 'AVAILABLE')) {
      throw new Error(`INACTIVE_PROPERTY: Associated property '${listing.propertyId}' is not active or verified.`);
    }

    // 3. Verify property authority for actor
    const isOwner = ownerships.some((o: any) => o.ownerId === actorUserId);
    const isAssignedAgent = agentAssignments.some((a: any) => a.userId === actorUserId);
    const isListingPublisher = listing.publisherUserId === actorUserId;

    if (!isOwner && !isAssignedAgent && !isListingPublisher) {
      throw new Error(
        `UNAUTHORIZED_PROPERTY_ACCESS: Actor '${actorUserId}' is neither the verified owner nor an authorized managing agent for property '${property.id}'.`
      );
    }

    // 4. Fetch and snapshot active promotion package
    const pkg = await promotionCampaignRepository.getPackageById(packageId);
    if (!pkg) {
      throw new Error(`PACKAGE_NOT_FOUND: Promotion package '${packageId}' was not found or is inactive.`);
    }
    if (!pkg.isActive) {
      throw new Error(`PACKAGE_INACTIVE: Promotion package '${packageId}' is currently disabled.`);
    }

    // 5. Establish Payer and Owner Consent requirements
    const primaryOwner = ownerships.find((o: any) => o.status === 'VERIFIED') || ownerships[0];
    const verifiedOwnerId = primaryOwner?.ownerId || null;

    // Payer defaults to actorUserId if omitted
    const effectivePayerUserId = rawPayerUserId && rawPayerUserId.trim() !== '' ? rawPayerUserId : actorUserId;

    // Validate payerUserId: must be either actorUserId or the verified property owner
    if (effectivePayerUserId !== actorUserId) {
      if (!verifiedOwnerId || effectivePayerUserId !== verifiedOwnerId) {
        throw new Error(
          `UNAUTHORIZED_PAYER: Payer '${effectivePayerUserId}' is neither the authenticated requester nor the verified owner of property '${property.id}'. Arbitrary payer designation is prohibited.`
        );
      }
    }

    // If requester is not the verified property owner, consent is mandatory
    let consentStatus = 'NOT_REQUIRED';
    if (verifiedOwnerId && actorUserId !== verifiedOwnerId) {
      consentStatus = 'REQUESTED';
    }

    // 6. Persist DRAFT campaign with snapshotted package terms (0 points reserved)
    return await promotionCampaignRepository.createCampaign({
      listingId: listing.id,
      propertyId: property.id,
      requesterUserId: actorUserId,
      payerUserId: effectivePayerUserId,
      packageId: pkg.id,
      packageVersion: pkg.version,
      campaignType: pkg.type,
      placementScope: pkg.placementScope,
      pointsCost: pkg.pointsCost,
      durationDays: pkg.durationDays,
      status: 'DRAFT',
      consentStatus,
    });
  }

  /**
   * Submits a DRAFT campaign for review and reserves points atomically from the payer's wallet.
   * Runs in a PostgreSQL transaction, serializes on campaign and wallet row locks, enforces
   * payer authorization, and adheres strictly to trigger 0030 append-only protections.
   */
  async submitCampaign(params: SubmitCampaignParams): Promise<SubmitCampaignResult> {
    const { campaignId, actorUserId, actorRoles, idempotencyKey } = params;

    if (!actorUserId) {
      throw new Error('UNAUTHENTICATED: Actor user identity must be derived from trusted authentication.');
    }

    return await db.transaction(async (tx) => {
      // 1. Lock campaign row FOR UPDATE to serialize submission
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      // 2. Idempotency check: if already SUBMITTED with a reservation, return idempotent replay
      if (campaign.status === 'SUBMITTED' && campaign.reservationTransactionId) {
        return {
          campaign,
          reservation: null,
          idempotentReplay: true,
        };
      }

      // 3. Owner consent denial invariant: a campaign with denied owner consent must not be submitted
      if (campaign.consentStatus === 'REJECTED') {
        throw new Error(
          `OWNER_CONSENT_DENIED: Cannot submit campaign because property owner consent was denied.`
        );
      }

      // 4. State transition invariant: only DRAFT campaigns may be submitted
      if (campaign.status !== 'DRAFT') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot submit campaign in status '${campaign.status}'. Only DRAFT campaigns can be submitted.`
        );
      }

      // 5. Payer Authorization Guard
      // Preserve requester vs. payer separation: points can only be reserved if authorized by the designated payer
      const isPayer = actorUserId === campaign.payerUserId;
      if (!isPayer) {
        throw new Error(
          `UNAUTHORIZED_PAYER: Actor '${actorUserId}' is not the designated payer ('${campaign.payerUserId}'). Points can only be reserved by the designated payer.`
        );
      }

      // 5. Re-verify listing and property eligibility at submission time
      const context = await promotionCampaignRepository.getListingWithPropertyAndOwner(campaign.listingId, tx);
      if (!context || !context.listing) {
        throw new Error(`LISTING_NOT_FOUND: Associated listing '${campaign.listingId}' no longer exists.`);
      }
      if (context.listing.type !== 'FOR_RENT') {
        throw new Error(`FORBIDDEN_SALE_LISTING: Listing '${campaign.listingId}' is not for rent.`);
      }
      if (context.listing.status === 'ARCHIVED') {
        throw new Error(`INELIGIBLE_LISTING_STATUS: Listing '${campaign.listingId}' is archived.`);
      }

      // 6. Atomically reserve points from the payer's wallet via the points engine
      // Passes the current transaction tx to guarantee atomic rollback if campaign update fails
      const reservationIdempotency = idempotencyKey || `campaign-reserve-${campaign.id}`;
      const reservationResult = await pointsEngine.reservePoints({
        userId: campaign.payerUserId,
        amount: campaign.pointsCost,
        referenceId: campaign.id,
        referenceType: 'PROMOTION_CAMPAIGN',
        idempotencyKey: reservationIdempotency,
        notes: `Promotion campaign reservation for ${campaign.placementScope.join(',')} (${campaign.durationDays}d)`,
        tx,
      });

      // 7. Transition status to SUBMITTED and record reservationTransactionId
      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          status: 'SUBMITTED',
          reservationTransactionId: reservationResult.transaction.id,
        },
        tx
      );

      return {
        campaign: updatedCampaign,
        reservation: reservationResult.transaction as any,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Grants property-owner consent for a promotion campaign.
   * Strictly verifies that the authenticated caller is the verified owner of the property.
   */
  async grantOwnerConsent(params: GrantOwnerConsentParams): Promise<{
    campaign: PromotionCampaign;
    idempotentReplay: boolean;
    message?: string;
  }> {
    const { campaignId, actorUserId, actorRoles, notes, evidence, simulateAuditFailure } = params;

    if (!actorUserId) {
      throw new Error('UNAUTHENTICATED: Actor identity required.');
    }

    return await db.transaction(async (tx) => {
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      // 1. Verify actor is the verified owner of the property
      const [ownership] = await tx
        .select()
        .from(ownershipRecords)
        .where(
          and(
            eq(ownershipRecords.propertyId, campaign.propertyId),
            eq(ownershipRecords.ownerId, actorUserId),
            eq(ownershipRecords.status, 'VERIFIED')
          )
        );

      if (!ownership) {
        throw new Error(
          `UNAUTHORIZED_OWNER_CONSENT: Only the verified property owner can grant promotion consent.`
        );
      }

      // 2. State and idempotency checks
      if (campaign.status !== 'DRAFT' && campaign.status !== 'SUBMITTED') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot grant consent for campaign in status '${campaign.status}'. Only DRAFT or SUBMITTED campaigns can have consent granted.`
        );
      }

      if (campaign.consentStatus === 'NOT_REQUIRED') {
        return {
          campaign,
          idempotentReplay: true,
          message: 'Owner consent is not required for this campaign.',
        };
      }

      if (campaign.consentStatus === 'GRANTED') {
        return {
          campaign,
          idempotentReplay: true,
        };
      }

      if (campaign.consentStatus !== 'REQUESTED') {
        throw new Error(
          `INVALID_CONSENT_STATE: Cannot grant consent for campaign in consent status '${campaign.consentStatus}'.`
        );
      }

      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          consentStatus: 'GRANTED',
          consentGrantedByUserId: actorUserId,
          consentGrantedAt: new Date(),
          consentNotes: notes || null,
          consentEvidence: evidence || null,
        },
        tx
      );

      if (simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Atomicity rollback test for owner consent');
      }

      await auditService.logAction({
        actorUserId,
        actorRole: 'PROPERTY_OWNER',
        action: 'PROMOTION_CONSENT_GRANTED',
        resourceType: 'PromotionCampaign',
        resourceId: campaign.id,
        changes: { consentStatus: 'GRANTED', previousConsentStatus: campaign.consentStatus },
        tx,
      });

      return {
        campaign: updatedCampaign,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Denies property-owner consent for a promotion campaign.
   * Strictly verifies that the authenticated caller is the verified owner of the property.
   * If points were already reserved, releases them atomically back to the payer.
   */
  async denyOwnerConsent(params: DenyOwnerConsentParams): Promise<{
    campaign: PromotionCampaign;
    idempotentReplay: boolean;
  }> {
    const { campaignId, actorUserId, actorRoles, reason, simulateAuditFailure } = params;

    if (!actorUserId) {
      throw new Error('UNAUTHENTICATED: Actor identity required.');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      throw new Error('MANDATORY_REASON_REQUIRED: A non-empty reason is required to deny owner consent.');
    }

    return await db.transaction(async (tx) => {
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      // 1. Verify actor is the verified owner of the property
      const [ownership] = await tx
        .select()
        .from(ownershipRecords)
        .where(
          and(
            eq(ownershipRecords.propertyId, campaign.propertyId),
            eq(ownershipRecords.ownerId, actorUserId),
            eq(ownershipRecords.status, 'VERIFIED')
          )
        );

      if (!ownership) {
        throw new Error(
          `UNAUTHORIZED_OWNER_CONSENT: Only the verified property owner can deny promotion consent.`
        );
      }

      // 2. State and idempotency checks
      if (campaign.consentStatus === 'REJECTED') {
        return {
          campaign,
          idempotentReplay: true,
        };
      }

      if (campaign.status !== 'DRAFT' && campaign.status !== 'SUBMITTED') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot deny consent for campaign in status '${campaign.status}'. Only DRAFT or SUBMITTED campaigns can have consent denied.`
        );
      }

      // If points were already reserved, release them back to payer
      if (campaign.reservationTransactionId) {
        await pointsEngine.releasePoints({
          userId: campaign.payerUserId,
          referenceId: campaign.id,
          referenceType: 'PROMOTION_CAMPAIGN',
          idempotencyKey: `campaign-release-${campaign.id}`,
          notes: `Reservation released due to owner consent denial: ${reason.trim()}`,
          tx,
        });
      }

      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          consentStatus: 'REJECTED',
          consentNotes: reason.trim(),
          status: ['DRAFT', 'SUBMITTED'].includes(campaign.status) ? 'CANCELLED' : campaign.status,
        },
        tx
      );

      if (simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Atomicity rollback test for consent denial');
      }

      await auditService.logAction({
        actorUserId,
        actorRole: 'PROPERTY_OWNER',
        action: 'PROMOTION_CONSENT_DENIED',
        resourceType: 'PromotionCampaign',
        resourceId: campaign.id,
        changes: { consentStatus: 'REJECTED', reason: reason.trim() },
        tx,
      });

      return {
        campaign: updatedCampaign,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Approves a submitted promotion campaign by an administrator.
   * Verifies admin role, checks that owner consent is GRANTED (or NOT_REQUIRED),
   * and transitions campaign status to APPROVED.
   */
  async approveCampaign(params: ApproveCampaignParams): Promise<{
    campaign: PromotionCampaign;
    idempotentReplay: boolean;
  }> {
    const { campaignId, adminUserId, adminRoles, notes, simulateAuditFailure } = params;

    if (!adminUserId) {
      throw new Error('UNAUTHENTICATED: Admin identity required.');
    }

    const isAdmin = Array.isArray(adminRoles) && (adminRoles.includes('ADMIN') || adminRoles.includes('SUPER_ADMIN'));
    if (!isAdmin) {
      throw new Error('UNAUTHORIZED_ADMIN: Campaign approval requires an administrator role.');
    }

    return await db.transaction(async (tx) => {
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      if (campaign.status === 'APPROVED') {
        return {
          campaign,
          idempotentReplay: true,
        };
      }

      if (campaign.status !== 'SUBMITTED') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot approve campaign in status '${campaign.status}'. Only SUBMITTED campaigns can be approved.`
        );
      }

      // Enforce owner consent requirement
      if (campaign.consentStatus === 'REJECTED') {
        throw new Error(
          `OWNER_CONSENT_DENIED: Cannot approve campaign because property owner consent was denied.`
        );
      }

      if (campaign.consentStatus !== 'GRANTED' && campaign.consentStatus !== 'NOT_REQUIRED') {
        throw new Error(
          `OWNER_CONSENT_REQUIRED: Cannot approve campaign without verified property owner consent (current consent status: ${campaign.consentStatus}).`
        );
      }

      // Enforce active points reservation
      if (!campaign.reservationTransactionId) {
        throw new Error('MISSING_RESERVATION: Cannot approve campaign without an active points reservation.');
      }

      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          status: 'APPROVED',
          moderatedByAdminId: adminUserId,
          moderationDecision: 'APPROVED',
          moderationReason: notes || null,
          moderatedAt: new Date(),
        },
        tx
      );

      if (simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Atomicity rollback test for campaign approval');
      }

      await auditService.logAction({
        actorUserId: adminUserId,
        actorRole: adminRoles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN',
        action: 'PROMOTION_CAMPAIGN_APPROVED',
        resourceType: 'PromotionCampaign',
        resourceId: campaign.id,
        changes: { status: 'APPROVED', moderatedBy: adminUserId },
        tx,
      });

      return {
        campaign: updatedCampaign,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Rejects a submitted promotion campaign by an administrator.
   * Requires a non-empty reason, transitions campaign status to REJECTED,
   * and atomically releases reserved points back to the payer's wallet.
   */
  async rejectCampaign(params: RejectCampaignParams): Promise<{
    campaign: PromotionCampaign;
    idempotentReplay: boolean;
  }> {
    const { campaignId, adminUserId, adminRoles, reason, simulateAuditFailure } = params;

    if (!adminUserId) {
      throw new Error('UNAUTHENTICATED: Admin identity required.');
    }

    const isAdmin = Array.isArray(adminRoles) && (adminRoles.includes('ADMIN') || adminRoles.includes('SUPER_ADMIN'));
    if (!isAdmin) {
      throw new Error('UNAUTHORIZED_ADMIN: Campaign rejection requires an administrator role.');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new Error('MANDATORY_REASON_REQUIRED: A meaningful rejection reason of at least 5 characters is required.');
    }

    return await db.transaction(async (tx) => {
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      if (campaign.status === 'REJECTED') {
        return {
          campaign,
          idempotentReplay: true,
        };
      }

      if (campaign.status !== 'SUBMITTED' && campaign.status !== 'DRAFT') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot reject campaign in status '${campaign.status}'. Only SUBMITTED or DRAFT campaigns can be rejected.`
        );
      }

      // If points were reserved, atomically release them back to payer's wallet
      if (campaign.reservationTransactionId) {
        await pointsEngine.releasePoints({
          userId: campaign.payerUserId,
          referenceId: campaign.id,
          referenceType: 'PROMOTION_CAMPAIGN',
          idempotencyKey: `campaign-release-${campaign.id}`,
          notes: `Reservation released upon campaign rejection: ${reason.trim()}`,
          tx,
        });
      }

      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          status: 'REJECTED',
          moderatedByAdminId: adminUserId,
          moderationDecision: 'REJECTED',
          moderationReason: reason.trim(),
          moderatedAt: new Date(),
        },
        tx
      );

      if (simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Atomicity rollback test for campaign rejection');
      }

      await auditService.logAction({
        actorUserId: adminUserId,
        actorRole: adminRoles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN',
        action: 'PROMOTION_CAMPAIGN_REJECTED',
        resourceType: 'PromotionCampaign',
        resourceId: campaign.id,
        changes: { status: 'REJECTED', reason: reason.trim(), moderatedBy: adminUserId },
        tx,
      });

      return {
        campaign: updatedCampaign,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Retrieves campaigns awaiting admin review/moderation.
   */
  async getModerationQueue(
    adminUserId: string,
    adminRoles: string[]
  ): Promise<PromotionCampaign[]> {
    if (!adminUserId) {
      throw new Error('UNAUTHENTICATED: Admin identity required.');
    }
    const isAdmin = Array.isArray(adminRoles) && (adminRoles.includes('ADMIN') || adminRoles.includes('SUPER_ADMIN'));
    if (!isAdmin) {
      throw new Error('UNAUTHORIZED_ADMIN: Access to the promotion moderation queue requires an administrator role.');
    }
    return await promotionCampaignRepository.getModerationQueue();
  }

  /**
   * Retrieves a campaign by its identifier with access control.
   */
  async getCampaign(
    campaignId: string,
    actorUserId: string,
    actorRoles: string[]
  ): Promise<PromotionCampaign> {
    const campaign = await promotionCampaignRepository.getCampaignById(campaignId);
    if (!campaign) {
      throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
    }

    const isAdmin = Array.isArray(actorRoles) && (actorRoles.includes('ADMIN') || actorRoles.includes('SUPER_ADMIN'));
    const isParticipant = actorUserId === campaign.requesterUserId || actorUserId === campaign.payerUserId;
    const isOwner = await promotionCampaignRepository.isVerifiedOwnerOfProperty(campaign.propertyId, actorUserId);

    if (!isAdmin && !isParticipant && !isOwner) {
      throw new Error(`UNAUTHORIZED_ACCESS: Caller '${actorUserId}' does not have permission to view campaign '${campaignId}'.`);
    }

    return campaign;
  }

  /**
   * Activates an approved promotion campaign.
   * - Verifies campaign is in APPROVED status.
   * - Verifies property-owner consent is GRANTED (or NOT_REQUIRED) and not REJECTED.
   * - Verifies active points reservation exists.
   * - Validates caller authorization when actor credentials are provided.
   * - Calculates activation time window strictly using the snapshotted durationDays from the campaign record.
   * - Atomically spends the reserved points from the payer's wallet via pointsEngine.spendReservedPoints.
   * - Transitions status to ACTIVE, saves startTime, endTime, and spendTransactionId.
   * - Safe against duplicate and concurrent activations (FOR UPDATE row lock, idempotent replay).
   * - Records PROMOTION_CAMPAIGN_ACTIVATED audit log within the same transaction.
   */
  async activateCampaign(params: ActivateCampaignParams): Promise<ActivateCampaignResult> {
    const { campaignId, actorUserId, actorRoles, startTime, idempotencyKey, simulateAuditFailure } = params;

    return await db.transaction(async (tx) => {
      // 1. Pessimistic row-level lock FOR UPDATE
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      // 2. Idempotency replay check
      if (campaign.status === 'ACTIVE') {
        return {
          campaign,
          spendTransaction: null,
          idempotentReplay: true,
        };
      }

      // 3. State verification: only APPROVED campaigns can be activated
      if (campaign.status !== 'APPROVED') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot activate campaign in status '${campaign.status}'. Only APPROVED campaigns can be activated.`
        );
      }

      // 4. Strict owner consent check
      if (campaign.consentStatus === 'REJECTED') {
        throw new Error(
          'OWNER_CONSENT_DENIED: Cannot activate campaign because property owner consent was denied.'
        );
      }

      if (campaign.consentStatus !== 'GRANTED' && campaign.consentStatus !== 'NOT_REQUIRED') {
        throw new Error(
          `OWNER_CONSENT_REQUIRED: Cannot activate campaign without verified property owner consent (current consent status: ${campaign.consentStatus}).`
        );
      }

      // 5. Reservation existence check
      if (!campaign.reservationTransactionId) {
        throw new Error('MISSING_RESERVATION: Cannot activate campaign without an active points reservation.');
      }

      // 6. Actor authorization (if actor credentials provided)
      if (actorUserId && actorUserId !== 'SYSTEM') {
        const isAdmin = Array.isArray(actorRoles) && (actorRoles.includes('ADMIN') || actorRoles.includes('SUPER_ADMIN'));
        const isParticipant = actorUserId === campaign.requesterUserId || actorUserId === campaign.payerUserId;
        if (!isAdmin && !isParticipant) {
          throw new Error(
            `UNAUTHORIZED_ACCESS: Actor '${actorUserId}' is not authorized to activate campaign '${campaign.id}'.`
          );
        }
      }

      // 7. Calculate time window strictly from the stored campaign snapshot
      const actualStartTime = startTime instanceof Date ? startTime : (startTime ? new Date(startTime) : new Date());
      const actualEndTime = new Date(actualStartTime.getTime() + campaign.durationDays * 24 * 60 * 60 * 1000);

      // 8. Atomically spend reserved points from payer's wallet via pointsEngine
      const spendIdempotency = idempotencyKey || `campaign-spend-${campaign.id}`;
      const spendResult = await pointsEngine.spendReservedPoints({
        userId: campaign.payerUserId,
        referenceId: campaign.id,
        referenceType: 'PROMOTION_CAMPAIGN',
        idempotencyKey: spendIdempotency,
        notes: `Promotion activation spend for ${campaign.placementScope.join(',')} (${campaign.durationDays}d)`,
        tx,
      });

      // 9. Transition status to ACTIVE with start/end time and spendTransactionId
      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          status: 'ACTIVE',
          startTime: actualStartTime,
          endTime: actualEndTime,
          spendTransactionId: spendResult.transaction.id,
        },
        tx
      );

      // 10. Audit failure simulation for rollback testing
      if (simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Atomicity rollback test for campaign activation');
      }

      // 11. Authoritative audit log
      const effectiveActorId = actorUserId || 'SYSTEM';
      const effectiveRole = actorRoles?.includes('SUPER_ADMIN')
        ? 'SUPER_ADMIN'
        : actorRoles?.includes('ADMIN')
        ? 'ADMIN'
        : actorUserId === campaign.requesterUserId
        ? 'AGENT'
        : 'SYSTEM';

      await auditService.logAction({
        actorUserId: effectiveActorId,
        actorRole: effectiveRole,
        action: 'PROMOTION_CAMPAIGN_ACTIVATED',
        resourceType: 'PromotionCampaign',
        resourceId: campaign.id,
        changes: {
          status: 'ACTIVE',
          startTime: actualStartTime.toISOString(),
          endTime: actualEndTime.toISOString(),
          spendTransactionId: spendResult.transaction.id,
          pointsSpent: campaign.pointsCost,
          durationDays: campaign.durationDays,
        },
        tx,
      });

      return {
        campaign: updatedCampaign,
        spendTransaction: spendResult.transaction as any,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Expires an active promotion campaign whose approved duration has ended.
   * - Validates that campaign is in ACTIVE status.
   * - Validates that current time has reached or passed endTime (unless force = true).
   * - Leaves points transactions untouched (points were spent at activation, no refund on natural expiry).
   * - Transitions status to EXPIRED.
   * - Idempotent on repeat invocations.
   * - Emits PROMOTION_CAMPAIGN_EXPIRED audit log within the same transaction.
   */
  async expireCampaign(params: ExpireCampaignParams): Promise<ExpireCampaignResult> {
    const { campaignId, actorUserId, actorRoles, asOf, force, simulateAuditFailure } = params;

    return await db.transaction(async (tx) => {
      // 1. Pessimistic row-level lock FOR UPDATE
      const campaign = await promotionCampaignRepository.getCampaignForUpdate(campaignId, tx);
      if (!campaign) {
        throw new Error(`CAMPAIGN_NOT_FOUND: Promotion campaign '${campaignId}' not found.`);
      }

      // 2. Idempotency replay check
      if (campaign.status === 'EXPIRED') {
        return {
          campaign,
          idempotentReplay: true,
        };
      }

      // 3. State verification: only ACTIVE campaigns can expire
      if (campaign.status !== 'ACTIVE') {
        throw new Error(
          `INVALID_CAMPAIGN_STATE: Cannot expire campaign in status '${campaign.status}'. Only ACTIVE campaigns can be expired.`
        );
      }

      if (!campaign.endTime) {
        throw new Error(
          `CORRUPTED_CAMPAIGN_STATE: Active campaign '${campaign.id}' has no endTime defined.`
        );
      }

      // 4. Boundary check: must be at or after endTime unless explicitly forced by admin
      if (force && actorUserId && actorUserId !== 'SYSTEM') {
        const isAdmin = Array.isArray(actorRoles) && (actorRoles.includes('ADMIN') || actorRoles.includes('SUPER_ADMIN'));
        if (!isAdmin) {
          throw new Error('UNAUTHORIZED_ADMIN: Forcing early campaign expiration requires an administrator role.');
        }
      }

      const effectiveNow = asOf || new Date();
      if (effectiveNow.getTime() < campaign.endTime.getTime() && !force) {
        throw new Error(
          `CAMPAIGN_NOT_EXPIRED: Campaign '${campaign.id}' end time '${campaign.endTime.toISOString()}' has not passed yet as of '${effectiveNow.toISOString()}'.`
        );
      }

      // 5. Update campaign status to EXPIRED
      const updatedCampaign = await promotionCampaignRepository.updateCampaign(
        campaign.id,
        {
          status: 'EXPIRED',
        },
        tx
      );

      // 6. Audit failure simulation for rollback testing
      if (simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Atomicity rollback test for campaign expiry');
      }

      // 7. Authoritative audit log
      const effectiveActorId = actorUserId || 'SYSTEM';
      const effectiveRole = actorRoles?.includes('SUPER_ADMIN')
        ? 'SUPER_ADMIN'
        : actorRoles?.includes('ADMIN')
        ? 'ADMIN'
        : 'SYSTEM';

      await auditService.logAction({
        actorUserId: effectiveActorId,
        actorRole: effectiveRole,
        action: 'PROMOTION_CAMPAIGN_EXPIRED',
        resourceType: 'PromotionCampaign',
        resourceId: campaign.id,
        changes: {
          status: 'EXPIRED',
          previousStatus: 'ACTIVE',
          expiredAt: effectiveNow.toISOString(),
          endTime: campaign.endTime.toISOString(),
        },
        tx,
      });

      return {
        campaign: updatedCampaign,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Sweeps and expires all active campaigns whose approved end time has passed.
   * Runs each expiry in its own safe transaction, providing resilience.
   * Isolates failures so that one campaign's error does not block other due campaigns.
   */
  async expireDueCampaigns(params: ExpireDueCampaignsParams = {}): Promise<ExpireDueCampaignsResult> {
    const { asOf = new Date(), actorUserId, actorRoles, batchSize = 50 } = params;

    const dueList = await promotionCampaignRepository.findDueActiveCampaigns(asOf, batchSize);
    const expiredCampaigns: PromotionCampaign[] = [];
    const failedCampaigns: { campaignId: string; error: string }[] = [];

    for (const c of dueList) {
      try {
        const res = await this.expireCampaign({
          campaignId: c.id,
          asOf,
          actorUserId,
          actorRoles,
        });
        expiredCampaigns.push(res.campaign);
      } catch (err: any) {
        console.error(`[PromotionCampaignService] Error expiring due campaign '${c.id}':`, err?.message || err);
        failedCampaigns.push({
          campaignId: c.id,
          error: err?.message || String(err),
        });
      }
    }

    return {
      expiredCount: expiredCampaigns.length,
      campaigns: expiredCampaigns,
      failedCount: failedCampaigns.length,
      failedCampaigns,
    };
  }

  /**
   * Search marketplace rental listings with promotion ranking boost.
   */
  async searchRentalListings(params: SearchRentalListingsParams): Promise<SearchRentalListingsResult> {
    return await promotionCampaignRepository.searchRentalListings(params);
  }
}

export const promotionCampaignService = new PromotionCampaignService();
