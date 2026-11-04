import { db } from '../../db/index.js';
import {
  promotionPackages,
  promotionCampaigns,
  listings,
  properties,
  ownershipRecords,
  managementAgreements,
  agentPropertyAssignments,
  users,
} from '../../db/schema.js';
import { eq, and, sql, desc, or, inArray, lte, gt, isNull, asc } from 'drizzle-orm';

export interface PromotionPackage {
  id: string;
  type: string;
  name: string;
  placementScope: string[];
  durationDays: number;
  pointsCost: number;
  version: number;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PromotionCampaign {
  id: string;
  listingId: string;
  propertyId: string;
  requesterUserId: string;
  payerUserId: string;
  packageId: string;
  packageVersion: number;
  campaignType: string;
  placementScope: string[];
  pointsCost: number;
  durationDays: number;
  status: string;
  reservationTransactionId: string | null;
  spendTransactionId: string | null;
  startTime: Date | null;
  endTime: Date | null;
  moderatedByAdminId: string | null;
  moderationDecision: string | null;
  moderationReason: string | null;
  moderatedAt: Date | null;
  consentStatus: string;
  consentGrantedByUserId: string | null;
  consentGrantedAt: Date | null;
  consentEvidence: any | null;
  consentNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertCampaignData {
  listingId: string;
  propertyId: string;
  requesterUserId: string;
  payerUserId: string;
  packageId: string;
  packageVersion: number;
  campaignType: string;
  placementScope: string[];
  pointsCost: number;
  durationDays: number;
  status?: string;
  consentStatus?: string;
}

export class PromotionCampaignRepository {
  /**
   * Retrieves an active promotion package by its identifier.
   */
  async getPackageById(packageId: string, tx: any = db): Promise<PromotionPackage | null> {
    const [pkg] = await tx
      .select()
      .from(promotionPackages)
      .where(and(eq(promotionPackages.id, packageId), eq(promotionPackages.isActive, true)));
    return (pkg as PromotionPackage) || null;
  }

  /**
   * Retrieves all currently active promotion packages ordered by points cost.
   */
  async listActivePackages(tx: any = db): Promise<PromotionPackage[]> {
    const list = await tx
      .select()
      .from(promotionPackages)
      .where(eq(promotionPackages.isActive, true))
      .orderBy(promotionPackages.pointsCost);
    return list as PromotionPackage[];
  }

  /**
   * Creates a new promotion campaign record.
   */
  async createCampaign(data: InsertCampaignData, tx: any = db): Promise<PromotionCampaign> {
    const [created] = await tx
      .insert(promotionCampaigns)
      .values({
        listingId: data.listingId,
        propertyId: data.propertyId,
        requesterUserId: data.requesterUserId,
        payerUserId: data.payerUserId,
        packageId: data.packageId,
        packageVersion: data.packageVersion,
        campaignType: data.campaignType,
        placementScope: data.placementScope,
        pointsCost: data.pointsCost,
        durationDays: data.durationDays,
        status: data.status || 'DRAFT',
        consentStatus: data.consentStatus || 'NOT_REQUIRED',
      })
      .returning();
    return created as PromotionCampaign;
  }

  /**
   * Retrieves a campaign by its primary key UUID.
   */
  async getCampaignById(campaignId: string, tx: any = db): Promise<PromotionCampaign | null> {
    const [campaign] = await tx
      .select()
      .from(promotionCampaigns)
      .where(eq(promotionCampaigns.id, campaignId));
    return (campaign as PromotionCampaign) || null;
  }

  /**
   * Retrieves a campaign with a row-level pessimistic lock (FOR UPDATE).
   */
  async getCampaignForUpdate(campaignId: string, tx: any): Promise<PromotionCampaign | null> {
    const [campaign] = await tx
      .select()
      .from(promotionCampaigns)
      .where(eq(promotionCampaigns.id, campaignId))
      .for('update');
    return (campaign as PromotionCampaign) || null;
  }

  /**
   * Updates an existing campaign's fields.
   */
  async updateCampaign(
    campaignId: string,
    data: Partial<Omit<PromotionCampaign, 'id' | 'createdAt'>>,
    tx: any = db
  ): Promise<PromotionCampaign> {
    const [updated] = await tx
      .update(promotionCampaigns)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(promotionCampaigns.id, campaignId))
      .returning();
    return updated as PromotionCampaign;
  }

  /**
   * Finds all campaigns linked to a given listing.
   */
  async findByListingId(listingId: string, tx: any = db): Promise<PromotionCampaign[]> {
    const list = await tx
      .select()
      .from(promotionCampaigns)
      .where(eq(promotionCampaigns.listingId, listingId))
      .orderBy(desc(promotionCampaigns.createdAt));
    return list as PromotionCampaign[];
  }

  /**
   * Retrieves campaigns awaiting admin review/moderation.
   */
  async getModerationQueue(tx: any = db): Promise<PromotionCampaign[]> {
    const list = await tx
      .select()
      .from(promotionCampaigns)
      .where(eq(promotionCampaigns.status, 'SUBMITTED'))
      .orderBy(desc(promotionCampaigns.createdAt));
    return list as PromotionCampaign[];
  }

  /**
   * Retrieves listing details alongside associated property, ownership, and management records.
   */
  async getListingWithPropertyAndOwner(listingId: string, tx: any = db) {
    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, listingId));

    if (!listing) return null;

    const [property] = await tx
      .select()
      .from(properties)
      .where(eq(properties.id, listing.propertyId));

    if (!property) return null;

    const ownerships = await tx
      .select()
      .from(ownershipRecords)
      .where(eq(ownershipRecords.propertyId, property.id));

    const activeAgreements = await tx
      .select()
      .from(managementAgreements)
      .where(
        and(
          eq(managementAgreements.propertyId, property.id),
          eq(managementAgreements.status, 'ACTIVE')
        )
      );

    const agentAssignments = await tx
      .select()
      .from(agentPropertyAssignments)
      .where(
        and(
          eq(agentPropertyAssignments.propertyId, property.id),
          eq(agentPropertyAssignments.status, 'ACTIVE')
        )
      );

    return {
      listing,
      property,
      ownerships,
      activeAgreements,
      agentAssignments,
    };
  }

  /**
   * Checks whether a user is a verified owner of a given property.
   */
  async isVerifiedOwnerOfProperty(propertyId: string, userId: string, tx: any = db): Promise<boolean> {
    const [record] = await tx
      .select({ id: ownershipRecords.id })
      .from(ownershipRecords)
      .where(
        and(
          eq(ownershipRecords.propertyId, propertyId),
          eq(ownershipRecords.ownerId, userId),
          eq(ownershipRecords.status, 'VERIFIED')
        )
      )
      .limit(1);
    return Boolean(record);
  }

  /**
   * Retrieves active campaigns whose approved duration has expired (endTime <= asOf).
   */
  async findDueActiveCampaigns(asOf: Date = new Date(), limit = 50, tx: any = db): Promise<PromotionCampaign[]> {
    const list = await tx
      .select()
      .from(promotionCampaigns)
      .where(
        and(
          eq(promotionCampaigns.status, 'ACTIVE'),
          or(
            lte(promotionCampaigns.endTime, asOf),
            isNull(promotionCampaigns.endTime)
          )
        )
      )
      .orderBy(promotionCampaigns.endTime)
      .limit(limit);
    return list as PromotionCampaign[];
  }

  /**
   * Retrieves currently active campaigns for a listing (status = 'ACTIVE' and startTime <= asOf and endTime > asOf).
   */
  async listActiveCampaignsForListing(listingId: string, asOf: Date = new Date(), tx: any = db): Promise<PromotionCampaign[]> {
    const list = await tx
      .select()
      .from(promotionCampaigns)
      .where(
        and(
          eq(promotionCampaigns.listingId, listingId),
          eq(promotionCampaigns.status, 'ACTIVE'),
          lte(promotionCampaigns.startTime, asOf),
          gt(promotionCampaigns.endTime, asOf)
        )
      )
      .orderBy(desc(promotionCampaigns.createdAt));
    return list as PromotionCampaign[];
  }

  /**
   * Search marketplace listings with promotion ranking boost.
   * - Only campaigns with status = 'ACTIVE' and startTime <= asOf < endTime boost ranking.
   * - Respects placement scope: 'SEARCH' (SPONSORED_SEARCH, MULTI_PAGE) vs 'HOMEPAGE' (HOME_FEATURED, MULTI_PAGE).
   * - Prevents duplicate rows via subquery deduplication and EXISTS verification check.
   * - Preserves deterministic ordering: boosted listings first, then createdAt DESC, id ASC.
   * - Preserves all listing, property verification, and search filters.
   */
  async searchRentalListings(params: SearchRentalListingsParams, tx: any = db): Promise<SearchRentalListingsResult> {
    const {
      type,
      propertyType,
      minPrice,
      maxPrice,
      limit = 20,
      offset = 0,
      asOf = new Date(),
      placement = 'SEARCH',
    } = params;

    const effectiveAsOf = asOf instanceof Date && !isNaN(asOf.getTime()) ? asOf : new Date();
    const effectivePlacement = (placement || 'SEARCH').toUpperCase();

    // 1. Placement condition for active campaigns
    const placementCondition = effectivePlacement === 'HOMEPAGE'
      ? sql`(${promotionCampaigns.campaignType} IN ('HOME_FEATURED', 'MULTI_PAGE') OR ${promotionCampaigns.placementScope}::text LIKE '%"HOMEPAGE"%')`
      : sql`(${promotionCampaigns.campaignType} IN ('SPONSORED_SEARCH', 'MULTI_PAGE') OR ${promotionCampaigns.placementScope}::text LIKE '%"SEARCH"%')`;

    // 2. Active promotion campaigns deduplicated subquery
    // Only ACTIVE campaigns strictly within startTime <= asOf < endTime
    const activePromosSubquery = tx
      .select({
        listingId: promotionCampaigns.listingId,
        campaignType: sql<string>`MIN(${promotionCampaigns.campaignType})`.as('active_campaign_type'),
      })
      .from(promotionCampaigns)
      .where(
        and(
          eq(promotionCampaigns.status, 'ACTIVE'),
          lte(promotionCampaigns.startTime, effectiveAsOf),
          gt(promotionCampaigns.endTime, effectiveAsOf),
          placementCondition
        )
      )
      .groupBy(promotionCampaigns.listingId)
      .as('active_promos');

    // 3. Search conditions
    const conditions = [
      eq(listings.status, 'PUBLISHED'),
      eq(properties.verificationStatus, 'VERIFIED'),
    ];

    if (type) {
      const normalizedType = type.toUpperCase() === 'RENT' || type.toUpperCase() === 'FOR_RENT' ? 'FOR_RENT' : type.toUpperCase() === 'SALE' || type.toUpperCase() === 'FOR_SALE' ? 'FOR_SALE' : type;
      conditions.push(eq(listings.type, normalizedType));
    }

    if (minPrice != null && !isNaN(minPrice)) {
      conditions.push(sql`CAST(${listings.price} AS NUMERIC) >= ${minPrice}`);
    }
    if (maxPrice != null && !isNaN(maxPrice)) {
      conditions.push(sql`CAST(${listings.price} AS NUMERIC) <= ${maxPrice}`);
    }
    if (propertyType && propertyType.trim().length > 0) {
      const ptClean = propertyType.trim().toUpperCase();
      if (ptClean === 'HOUSE') {
        // Exclude WAREHOUSE from HOUSE queries and include SINGLE_FAMILY
        conditions.push(sql`(LOWER(${properties.type}) LIKE '%house%' AND LOWER(${properties.type}) NOT LIKE '%warehouse%') OR LOWER(${properties.type}) = 'single_family'`);
      } else if (ptClean === 'COMMERCIAL') {
        // Parent-category aggregation: Commercial includes generic commercial, offices, warehouses, and industrial facilities
        conditions.push(sql`(LOWER(${properties.type}) LIKE '%commercial%' OR LOWER(${properties.type}) LIKE '%office%' OR LOWER(${properties.type}) LIKE '%warehouse%' OR LOWER(${properties.type}) LIKE '%industrial%')`);
      } else if (ptClean === 'OFFICE') {
        // Specific child subtype: Office & corporate spaces
        conditions.push(sql`LOWER(${properties.type}) LIKE '%office%'`);
      } else if (ptClean === 'WAREHOUSE') {
        // Specific child subtype: Warehouse, storage, industrial hubs
        conditions.push(sql`(LOWER(${properties.type}) LIKE '%warehouse%' OR LOWER(${properties.type}) LIKE '%storage%' OR LOWER(${properties.type}) LIKE '%industrial%')`);
      } else if (ptClean === 'STUDIO') {
        conditions.push(sql`LOWER(${properties.type}) LIKE '%studio%'`);
      } else if (ptClean === 'DUPLEX') {
        conditions.push(sql`LOWER(${properties.type}) LIKE '%duplex%'`);
      } else if (ptClean === 'RESIDENTIAL') {
        conditions.push(sql`(LOWER(${properties.type}) = 'residential' OR LOWER(${properties.type}) = 'building')`);
      } else {
        conditions.push(sql`LOWER(${properties.type}) LIKE ${'%' + propertyType.trim().toLowerCase() + '%'}`);
      }
    }

    // Verified ownership existence condition to avoid duplicate rows from multiple ownership records
    const verifiedOwnerCondition = sql`EXISTS (
      SELECT 1 FROM ownership_records
      WHERE ownership_records.property_id = ${properties.id}
        AND ownership_records.status = 'VERIFIED'
    )`;

    const pageLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const pageOffset = Math.max(0, Number(offset) || 0);

    // 4. Execute search query with promotion ranking boost
    const rows = await tx
      .select({
        listing: listings,
        property: properties,
        activeCampaignType: activePromosSubquery.campaignType,
        isPromoted: sql<boolean>`CASE WHEN ${activePromosSubquery.listingId} IS NOT NULL THEN true ELSE false END`.as('is_promoted'),
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .leftJoin(activePromosSubquery, eq(listings.id, activePromosSubquery.listingId))
      .where(and(...conditions, verifiedOwnerCondition))
      .orderBy(
        desc(sql`CASE WHEN ${activePromosSubquery.listingId} IS NOT NULL THEN 1 ELSE 0 END`),
        desc(listings.createdAt),
        asc(listings.id)
      )
      .limit(pageLimit)
      .offset(pageOffset);

    // 5. Total count query over the same conditions
    const [totalRow] = await tx
      .select({
        total: sql<number>`count(*)::int`,
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(and(...conditions, verifiedOwnerCondition));

    const items: SearchRentalListingsItem[] = rows.map((r: any) => ({
      ...r.listing,
      price: Number(r.listing.price),
      property: r.property,
      isPromoted: Boolean(r.isPromoted),
      promotionType: r.activeCampaignType || null,
    }));

    return {
      items,
      total: totalRow?.total || 0,
      limit: pageLimit,
      offset: pageOffset,
    };
  }
}

export interface SearchRentalListingsParams {
  type?: string | null;
  propertyType?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  limit?: number;
  offset?: number;
  asOf?: Date;
  placement?: string; // 'SEARCH' | 'HOMEPAGE'
}

export interface SearchRentalListingsItem {
  id: string;
  propertyId: string;
  publisherUserId: string;
  publisherCompanyId: string | null;
  type: string;
  price: number;
  currency: string;
  status: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  property: any;
  isPromoted: boolean;
  promotionType: string | null;
}

export interface SearchRentalListingsResult {
  items: SearchRentalListingsItem[];
  total: number;
  limit: number;
  offset: number;
}

export const promotionCampaignRepository = new PromotionCampaignRepository();
