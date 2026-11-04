import { db } from '../../db/index.js';
import { 
  users, 
  properties, 
  listings, 
  buyerProfiles, 
  buyerFavorites, 
  savedSearches, 
  propertyInquiries, 
  propertyViewings, 
  propertyOffers, 
  offerCounterHistory, 
  salesContracts, 
  salesTransactions,
  ownershipRecords,
  managementAgreements,
  paymentRecords,
  documents,
  notifications,
} from '../../db/schema.js';
import { eq, and, or, inArray, desc, asc, sql } from 'drizzle-orm';
import { 
  BuyerProfile, 
  UpdateBuyerProfileRequest, 
  BuyerDashboardData, 
  BuyerActivitySummary, 
  BuyerFavoriteItem, 
  SavedSearchItem, 
  CreateSavedSearchRequest, 
  BuyerInquiryItem, 
  CreateInquiryRequest, 
  BuyerViewingItem, 
  RequestViewingRequest, 
  RescheduleViewingRequest, 
  BuyerOfferItem, 
  CreateOfferRequest, 
  CounterOfferRequest, 
  RespondCounterOfferRequest, 
  OfferCounterItem, 
  SalesContractItem, 
  SalesTransactionItem,
  BuyerPaymentItem,
  BuyerDocumentItem,
  BuyerNotificationItem,
  DueDiligenceChecklist 
} from '../../types/buyer.js';
import { buyerService } from '../services/buyer.js';
import { auditService } from '../services/audit.js';

export class BuyerRepository {
  private checkDatabaseConfigured() {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
  }

  // =========================================================================
  // 1. BUYER PROFILE & PREFERENCES
  // =========================================================================

  async getProfile(userId: string): Promise<BuyerProfile | null> {
    this.checkDatabaseConfigured();
    const [record] = await db.select().from(buyerProfiles).where(eq(buyerProfiles.userId, userId)).limit(1);
    if (!record) return null;

    return {
      id: record.id,
      userId: record.userId,
      budgetMin: record.budgetMin ? Number(record.budgetMin) : undefined,
      budgetMax: record.budgetMax ? Number(record.budgetMax) : undefined,
      currency: record.currency || 'IQD',
      preferredCities: record.preferredCities || [],
      preferredPropertyTypes: record.preferredPropertyTypes || [],
      minBeds: record.minBeds || undefined,
      minBaths: record.minBaths ? Number(record.minBaths) : undefined,
      minSquareMeters: record.minSquareMeters || undefined,
      purchasePurpose: (record.purchasePurpose as any) || undefined,
      financingStatus: (record.financingStatus as any) || undefined,
      notificationPreferences: record.notificationPreferences || {
        email: true,
        sms: true,
        push: true,
        instantOfferAlerts: true
      },
      isComplete: Boolean(record.isComplete),
      createdAt: record.createdAt?.toISOString(),
      updatedAt: record.updatedAt?.toISOString()
    };
  }

  async upsertProfile(userId: string, data: UpdateBuyerProfileRequest): Promise<BuyerProfile> {
    this.checkDatabaseConfigured();

    const existing = await this.getProfile(userId);
    const isComplete = Boolean(
      (data.budgetMax || (existing && existing.budgetMax)) &&
      (data.preferredCities?.length || (existing && existing.preferredCities?.length))
    );

    if (existing) {
      await db.update(buyerProfiles).set({
        budgetMin: data.budgetMin !== undefined ? String(data.budgetMin) : undefined,
        budgetMax: data.budgetMax !== undefined ? String(data.budgetMax) : undefined,
        currency: data.currency,
        preferredCities: data.preferredCities,
        preferredPropertyTypes: data.preferredPropertyTypes,
        minBeds: data.minBeds,
        minBaths: data.minBaths !== undefined ? String(data.minBaths) : undefined,
        minSquareMeters: data.minSquareMeters,
        purchasePurpose: data.purchasePurpose,
        financingStatus: data.financingStatus,
        notificationPreferences: data.notificationPreferences,
        isComplete,
        updatedAt: new Date()
      }).where(eq(buyerProfiles.userId, userId));
    } else {
      await db.insert(buyerProfiles).values({
        userId,
        budgetMin: data.budgetMin !== undefined ? String(data.budgetMin) : undefined,
        budgetMax: data.budgetMax !== undefined ? String(data.budgetMax) : undefined,
        currency: data.currency || 'IQD',
        preferredCities: data.preferredCities || [],
        preferredPropertyTypes: data.preferredPropertyTypes || [],
        minBeds: data.minBeds,
        minBaths: data.minBaths !== undefined ? String(data.minBaths) : undefined,
        minSquareMeters: data.minSquareMeters,
        purchasePurpose: data.purchasePurpose || 'PRIMARY_RESIDENCE',
        financingStatus: data.financingStatus || 'NOT_STARTED',
        notificationPreferences: data.notificationPreferences || {
          email: true,
          sms: true,
          push: true,
          instantOfferAlerts: true
        },
        isComplete
      });
    }

    const updated = await this.getProfile(userId);
    return updated!;
  }

  // =========================================================================
  // 2. FAVORITES / SAVED PROPERTIES
  // =========================================================================

  async getFavorites(buyerId: string): Promise<BuyerFavoriteItem[]> {
    this.checkDatabaseConfigured();

    const records = await db
      .select({
        favorite: buyerFavorites,
        property: properties,
        listing: listings
      })
      .from(buyerFavorites)
      .innerJoin(properties, eq(buyerFavorites.propertyId, properties.id))
      .leftJoin(listings, eq(buyerFavorites.listingId, listings.id))
      .where(eq(buyerFavorites.buyerId, buyerId))
      .orderBy(desc(buyerFavorites.createdAt));

    return records.map(r => {
      const addr = (r.property.address as any) || {};
      return {
        id: r.favorite.id,
        buyerId: r.favorite.buyerId,
        propertyId: r.favorite.propertyId,
        listingId: r.favorite.listingId || undefined,
        notes: r.favorite.notes || undefined,
        createdAt: r.favorite.createdAt?.toISOString() || new Date().toISOString(),
        property: {
          id: r.property.id,
          name: r.property.name,
          type: r.property.type,
          price: r.listing ? Number(r.listing.price) : 0,
          currency: r.listing?.currency || 'IQD',
          city: addr.city || 'Erbil',
          neighborhood: addr.neighborhood || addr.district,
          beds: undefined,
          baths: undefined,
          squareMeters: r.property.squareFeet ? Math.round(r.property.squareFeet / 10.764) : undefined,
          status: r.property.status || 'ACTIVE'
        }
      };
    });
  }

  async addFavorite(buyerId: string, propertyId: string, listingId?: string, notes?: string): Promise<BuyerFavoriteItem> {
    this.checkDatabaseConfigured();

    // Verify property exists
    const [prop] = await db.select().from(properties).where(eq(properties.id, propertyId)).limit(1);
    if (!prop) {
      throw new Error('PROPERTY_NOT_FOUND');
    }

    // Check if already favorited (idempotent)
    const [existing] = await db
      .select()
      .from(buyerFavorites)
      .where(and(eq(buyerFavorites.buyerId, buyerId), eq(buyerFavorites.propertyId, propertyId)))
      .limit(1);

    if (existing) {
      const all = await this.getFavorites(buyerId);
      return all.find(f => f.id === existing.id)!;
    }

    const [inserted] = await db.insert(buyerFavorites).values({
      buyerId,
      propertyId,
      listingId,
      notes
    }).returning();

    const all = await this.getFavorites(buyerId);
    return all.find(f => f.id === inserted.id)!;
  }

  async removeFavorite(buyerId: string, propertyId: string): Promise<boolean> {
    this.checkDatabaseConfigured();
    const result = await db.delete(buyerFavorites).where(
      and(eq(buyerFavorites.buyerId, buyerId), eq(buyerFavorites.propertyId, propertyId))
    );
    return true;
  }

  // =========================================================================
  // 3. SAVED SEARCHES
  // =========================================================================

  async getSavedSearches(buyerId: string): Promise<SavedSearchItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.buyerId, buyerId))
      .orderBy(desc(savedSearches.createdAt));

    return records.map(r => ({
      id: r.id,
      buyerId: r.buyerId,
      name: r.name,
      criteria: (r.criteria as any) || {},
      isActive: Boolean(r.isActive),
      notifyOnMatch: Boolean(r.notifyOnMatch),
      createdAt: r.createdAt?.toISOString() || new Date().toISOString()
    }));
  }

  async createSavedSearch(buyerId: string, req: CreateSavedSearchRequest): Promise<SavedSearchItem> {
    this.checkDatabaseConfigured();
    if (!req.name || req.name.trim().length === 0) {
      throw new Error('INVALID_SEARCH_NAME: Name cannot be empty');
    }

    const [inserted] = await db.insert(savedSearches).values({
      buyerId,
      name: req.name.trim(),
      criteria: req.criteria || {},
      isActive: true,
      notifyOnMatch: req.notifyOnMatch ?? true
    }).returning();

    return {
      id: inserted.id,
      buyerId: inserted.buyerId,
      name: inserted.name,
      criteria: (inserted.criteria as any) || {},
      isActive: Boolean(inserted.isActive),
      notifyOnMatch: Boolean(inserted.notifyOnMatch),
      createdAt: inserted.createdAt?.toISOString() || new Date().toISOString()
    };
  }

  async deleteSavedSearch(buyerId: string, searchId: string): Promise<boolean> {
    this.checkDatabaseConfigured();
    await db.delete(savedSearches).where(
      and(eq(savedSearches.id, searchId), eq(savedSearches.buyerId, buyerId))
    );
    return true;
  }

  // =========================================================================
  // 4. PROPERTY INQUIRIES
  // =========================================================================

  async getInquiries(buyerId: string): Promise<BuyerInquiryItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select({
        inquiry: propertyInquiries,
        property: properties
      })
      .from(propertyInquiries)
      .innerJoin(properties, eq(propertyInquiries.propertyId, properties.id))
      .where(eq(propertyInquiries.buyerId, buyerId))
      .orderBy(desc(propertyInquiries.createdAt));

    return records.map(r => ({
      id: r.inquiry.id,
      buyerId: r.inquiry.buyerId,
      propertyId: r.inquiry.propertyId,
      listingId: r.inquiry.listingId || undefined,
      inquiryType: r.inquiry.inquiryType || 'GENERAL',
      message: r.inquiry.message,
      status: (r.inquiry.status as any) || 'PENDING',
      recipientUserId: r.inquiry.recipientUserId || undefined,
      recipientCompanyId: r.inquiry.recipientCompanyId || undefined,
      responseMessage: r.inquiry.responseMessage || undefined,
      respondedAt: r.inquiry.respondedAt?.toISOString(),
      createdAt: r.inquiry.createdAt?.toISOString() || new Date().toISOString(),
      property: {
        name: r.property.name,
        address: r.property.address
      }
    }));
  }

  async createInquiry(buyerId: string, req: CreateInquiryRequest): Promise<BuyerInquiryItem> {
    this.checkDatabaseConfigured();
    if (!req.message || req.message.trim().length === 0) {
      throw new Error('INVALID_MESSAGE: Inquiry message cannot be empty');
    }

    const [prop] = await db.select().from(properties).where(eq(properties.id, req.propertyId)).limit(1);
    if (!prop) {
      throw new Error('PROPERTY_NOT_FOUND');
    }

    // Resolve owner or managing company for recipient
    const [ownership] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, req.propertyId)).limit(1);
    const [mgmt] = await db.select().from(managementAgreements).where(
      and(eq(managementAgreements.propertyId, req.propertyId), eq(managementAgreements.status, 'ACTIVE'))
    ).limit(1);

    const [inserted] = await db.insert(propertyInquiries).values({
      buyerId,
      propertyId: req.propertyId,
      listingId: req.listingId,
      inquiryType: req.inquiryType || 'GENERAL',
      message: req.message.trim(),
      status: 'PENDING',
      recipientUserId: ownership?.ownerId || undefined,
      recipientCompanyId: mgmt?.companyId || undefined
    }).returning();

    return {
      id: inserted.id,
      buyerId: inserted.buyerId,
      propertyId: inserted.propertyId,
      listingId: inserted.listingId || undefined,
      inquiryType: inserted.inquiryType || 'GENERAL',
      message: inserted.message,
      status: 'PENDING',
      createdAt: inserted.createdAt?.toISOString() || new Date().toISOString(),
      property: {
        name: prop.name,
        address: prop.address
      }
    };
  }

  async getInquiryById(buyerId: string, inquiryId: string): Promise<BuyerInquiryItem | null> {
    this.checkDatabaseConfigured();
    const [record] = await db
      .select({
        inquiry: propertyInquiries,
        property: properties
      })
      .from(propertyInquiries)
      .innerJoin(properties, eq(propertyInquiries.propertyId, properties.id))
      .where(and(eq(propertyInquiries.id, inquiryId), eq(propertyInquiries.buyerId, buyerId)))
      .limit(1);

    if (!record) return null;

    return {
      id: record.inquiry.id,
      buyerId: record.inquiry.buyerId,
      propertyId: record.inquiry.propertyId,
      listingId: record.inquiry.listingId || undefined,
      inquiryType: record.inquiry.inquiryType || 'GENERAL',
      message: record.inquiry.message,
      status: (record.inquiry.status as any) || 'PENDING',
      responseMessage: record.inquiry.responseMessage || undefined,
      respondedAt: record.inquiry.respondedAt?.toISOString(),
      createdAt: record.inquiry.createdAt?.toISOString() || new Date().toISOString(),
      property: {
        name: record.property.name,
        address: record.property.address
      }
    };
  }

  // =========================================================================
  // 5. PROPERTY VIEWINGS / SITE VISITS
  // =========================================================================

  async getViewings(buyerId: string): Promise<BuyerViewingItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select({
        viewing: propertyViewings,
        property: properties
      })
      .from(propertyViewings)
      .innerJoin(properties, eq(propertyViewings.propertyId, properties.id))
      .where(eq(propertyViewings.buyerId, buyerId))
      .orderBy(desc(propertyViewings.scheduledAt));

    return records.map(r => ({
      id: r.viewing.id,
      buyerId: r.viewing.buyerId,
      propertyId: r.viewing.propertyId,
      listingId: r.viewing.listingId || undefined,
      scheduledAt: r.viewing.scheduledAt.toISOString(),
      status: r.viewing.status,
      viewingType: (r.viewing.viewingType as any) || 'IN_PERSON',
      notes: r.viewing.notes || undefined,
      cancellationReason: r.viewing.cancellationReason || undefined,
      cancelledBy: r.viewing.cancelledBy || undefined,
      createdAt: r.viewing.createdAt?.toISOString() || new Date().toISOString(),
      property: {
        name: r.property.name,
        address: r.property.address
      }
    }));
  }

  async requestViewing(buyerId: string, req: RequestViewingRequest): Promise<BuyerViewingItem> {
    this.checkDatabaseConfigured();

    const scheduledDate = new Date(req.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error('INVALID_DATE: scheduledAt must be a valid ISO date string');
    }
    if (scheduledDate.getTime() < Date.now()) {
      throw new Error('INVALID_DATE: Viewing cannot be scheduled in the past');
    }

    const [prop] = await db.select().from(properties).where(eq(properties.id, req.propertyId)).limit(1);
    if (!prop) {
      throw new Error('PROPERTY_NOT_FOUND');
    }

    // Conflict prevention: prevent double booking the exact same hour for the same property by this buyer
    const existingConflicts = await db
      .select()
      .from(propertyViewings)
      .where(
        and(
          eq(propertyViewings.propertyId, req.propertyId),
          eq(propertyViewings.buyerId, buyerId),
          inArray(propertyViewings.status, ['REQUESTED', 'CONFIRMED', 'RESCHEDULED'])
        )
      );

    const hasConflict = existingConflicts.some(v => {
      let vTime: number;
      if (v.scheduledAt instanceof Date) {
        const localOffsetMs = v.scheduledAt.getTimezoneOffset() * 60 * 1000;
        vTime = v.scheduledAt.getTime() - localOffsetMs;
      } else {
        const s = String(v.scheduledAt);
        const iso = s.includes('Z') || s.includes('+') ? s : s.replace(' ', 'T') + 'Z';
        vTime = new Date(iso).getTime();
      }
      const diff = Math.abs(vTime - scheduledDate.getTime());
      return diff < 60 * 60 * 1000; // within 1 hour
    });

    if (hasConflict) {
      throw new Error('VIEWING_CONFLICT: A viewing is already scheduled near this time window');
    }

    const [inserted] = await db.insert(propertyViewings).values({
      buyerId,
      propertyId: req.propertyId,
      listingId: req.listingId,
      scheduledAt: scheduledDate,
      status: 'REQUESTED',
      viewingType: req.viewingType || 'IN_PERSON',
      notes: req.notes
    }).returning();

    return {
      id: inserted.id,
      buyerId: inserted.buyerId,
      propertyId: inserted.propertyId,
      listingId: inserted.listingId || undefined,
      scheduledAt: inserted.scheduledAt.toISOString(),
      status: 'REQUESTED',
      viewingType: (inserted.viewingType as any) || 'IN_PERSON',
      notes: inserted.notes || undefined,
      createdAt: inserted.createdAt?.toISOString() || new Date().toISOString(),
      property: {
        name: prop.name,
        address: prop.address
      }
    };
  }

  async rescheduleViewing(buyerId: string, viewingId: string, req: RescheduleViewingRequest): Promise<BuyerViewingItem> {
    this.checkDatabaseConfigured();

    const [viewing] = await db
      .select()
      .from(propertyViewings)
      .where(and(eq(propertyViewings.id, viewingId), eq(propertyViewings.buyerId, buyerId)))
      .limit(1);

    if (!viewing) {
      throw new Error('VIEWING_NOT_FOUND: Viewing record does not exist or unauthorized');
    }

    buyerService.validateViewingTransition(viewing.status, 'RESCHEDULED');

    const nextDate = new Date(req.scheduledAt);
    if (isNaN(nextDate.getTime()) || nextDate.getTime() < Date.now()) {
      throw new Error('INVALID_DATE: New scheduled date must be in the future');
    }

    await db.update(propertyViewings).set({
      scheduledAt: nextDate,
      status: 'RESCHEDULED',
      notes: req.reason ? `${viewing.notes || ''} [Rescheduled: ${req.reason}]`.trim() : viewing.notes,
      updatedAt: new Date()
    }).where(eq(propertyViewings.id, viewingId));

    const viewings = await this.getViewings(buyerId);
    return viewings.find(v => v.id === viewingId)!;
  }

  async cancelViewing(buyerId: string, viewingId: string, reason?: string): Promise<BuyerViewingItem> {
    this.checkDatabaseConfigured();

    const [viewing] = await db
      .select()
      .from(propertyViewings)
      .where(and(eq(propertyViewings.id, viewingId), eq(propertyViewings.buyerId, buyerId)))
      .limit(1);

    if (!viewing) {
      throw new Error('VIEWING_NOT_FOUND: Viewing record does not exist or unauthorized');
    }

    buyerService.validateViewingTransition(viewing.status, 'CANCELLED');

    await db.update(propertyViewings).set({
      status: 'CANCELLED',
      cancellationReason: reason || 'Cancelled by buyer',
      cancelledBy: buyerId,
      updatedAt: new Date()
    }).where(eq(propertyViewings.id, viewingId));

    const viewings = await this.getViewings(buyerId);
    return viewings.find(v => v.id === viewingId)!;
  }

  // =========================================================================
  // 6. PROPERTY OFFERS & COUNTER-OFFER NEGOTIATION
  // =========================================================================

  async getOffers(buyerId: string): Promise<BuyerOfferItem[]> {
    this.checkDatabaseConfigured();

    const records = await db
      .select({
        offer: propertyOffers,
        property: properties,
        listing: listings
      })
      .from(propertyOffers)
      .innerJoin(properties, eq(propertyOffers.propertyId, properties.id))
      .leftJoin(listings, eq(propertyOffers.listingId, listings.id))
      .where(eq(propertyOffers.buyerId, buyerId))
      .orderBy(desc(propertyOffers.createdAt));

    const results: BuyerOfferItem[] = [];
    for (const r of records) {
      const history = await db
        .select()
        .from(offerCounterHistory)
        .where(eq(offerCounterHistory.offerId, r.offer.id))
        .orderBy(asc(offerCounterHistory.createdAt));

      results.push({
        id: r.offer.id,
        buyerId: r.offer.buyerId,
        propertyId: r.offer.propertyId,
        listingId: r.offer.listingId || undefined,
        offerAmount: Number(r.offer.offerAmount),
        currency: r.offer.currency,
        depositAmount: r.offer.depositAmount ? Number(r.offer.depositAmount) : undefined,
        financingType: r.offer.financingType || 'CASH',
        terms: r.offer.terms || undefined,
        conditions: r.offer.conditions || [],
        status: r.offer.status,
        expiresAt: r.offer.expiresAt?.toISOString(),
        sellerUserId: r.offer.sellerUserId || undefined,
        sellerCompanyId: r.offer.sellerCompanyId || undefined,
        rejectionReason: r.offer.rejectionReason || undefined,
        withdrawnReason: r.offer.withdrawnReason || undefined,
        createdAt: r.offer.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: r.offer.updatedAt?.toISOString() || new Date().toISOString(),
        negotiationHistory: history.map(h => ({
          id: h.id,
          offerId: h.offerId,
          actorId: h.actorId,
          actorRole: h.actorRole as any,
          counterAmount: Number(h.counterAmount),
          currency: h.currency,
          counterTerms: h.counterTerms || undefined,
          status: h.status as any,
          note: h.note || undefined,
          createdAt: h.createdAt?.toISOString() || new Date().toISOString()
        })),
        property: {
          name: r.property.name,
          address: r.property.address,
          listingPrice: r.listing ? Number(r.listing.price) : undefined,
          currency: r.listing?.currency || 'IQD'
        }
      });
    }

    return results;
  }

  async getOfferById(buyerId: string, offerId: string): Promise<BuyerOfferItem | null> {
    this.checkDatabaseConfigured();
    const offers = await this.getOffers(buyerId);
    return offers.find(o => o.id === offerId) || null;
  }

  async createOffer(buyerId: string, req: CreateOfferRequest): Promise<BuyerOfferItem> {
    this.checkDatabaseConfigured();

    buyerService.validateOfferParameters(req);

    const [prop] = await db.select().from(properties).where(eq(properties.id, req.propertyId)).limit(1);
    if (!prop) {
      throw new Error('PROPERTY_NOT_FOUND');
    }

    // Resolve property owner
    const [ownership] = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, req.propertyId)).limit(1);
    const [mgmt] = await db.select().from(managementAgreements).where(
      and(eq(managementAgreements.propertyId, req.propertyId), eq(managementAgreements.status, 'ACTIVE'))
    ).limit(1);

    // Default expiration to 7 days if omitted
    const expiresAt = req.expiresAt ? new Date(req.expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [inserted] = await db.insert(propertyOffers).values({
      buyerId,
      propertyId: req.propertyId,
      listingId: req.listingId,
      offerAmount: String(req.offerAmount),
      currency: req.currency || 'IQD',
      depositAmount: req.depositAmount !== undefined ? String(req.depositAmount) : undefined,
      financingType: req.financingType || 'CASH',
      terms: req.terms,
      conditions: req.conditions || [],
      status: 'OFFER_SUBMITTED',
      expiresAt,
      sellerUserId: ownership?.ownerId || undefined,
      sellerCompanyId: mgmt?.companyId || undefined
    }).returning();

    // Log negotiation initial event
    await db.insert(offerCounterHistory).values({
      offerId: inserted.id,
      actorId: buyerId,
      actorRole: 'BUYER',
      counterAmount: String(req.offerAmount),
      currency: req.currency || 'IQD',
      counterTerms: req.terms || 'Initial offer submission',
      status: 'COUNTERED',
      note: 'Buyer submitted initial purchase offer'
    });

    const created = await this.getOfferById(buyerId, inserted.id);
    return created!;
  }

  async withdrawOffer(buyerId: string, offerId: string, reason?: string): Promise<BuyerOfferItem> {
    this.checkDatabaseConfigured();

    const [offer] = await db
      .select()
      .from(propertyOffers)
      .where(and(eq(propertyOffers.id, offerId), eq(propertyOffers.buyerId, buyerId)))
      .limit(1);

    if (!offer) {
      throw new Error('OFFER_NOT_FOUND: Offer record does not exist or unauthorized');
    }

    buyerService.validateOfferTransition(offer.status, 'WITHDRAWN');

    await db.update(propertyOffers).set({
      status: 'WITHDRAWN',
      withdrawnReason: reason || 'Withdrawn by buyer',
      updatedAt: new Date()
    }).where(eq(propertyOffers.id, offerId));

    const updated = await this.getOfferById(buyerId, offerId);
    return updated!;
  }

  async counterOffer(
    actorId: string, 
    actorRole: 'BUYER' | 'SELLER_OWNER' | 'SELLER_COMPANY', 
    offerId: string, 
    req: CounterOfferRequest
  ): Promise<BuyerOfferItem> {
    this.checkDatabaseConfigured();

    if (!req.counterAmount || req.counterAmount <= 0) {
      throw new Error('INVALID_COUNTER_AMOUNT: Counter offer amount must be positive');
    }

    const [offer] = await db.select().from(propertyOffers).where(eq(propertyOffers.id, offerId)).limit(1);
    if (!offer) {
      throw new Error('OFFER_NOT_FOUND');
    }

    // Role verification
    if (actorRole === 'BUYER' && offer.buyerId !== actorId) {
      throw new Error('UNAUTHORIZED_OFFER_ACTION');
    }

    buyerService.validateOfferTransition(offer.status, 'COUNTERED');

    await db.update(propertyOffers).set({
      offerAmount: String(req.counterAmount),
      currency: req.currency || offer.currency,
      terms: req.counterTerms || offer.terms,
      status: 'COUNTERED',
      updatedAt: new Date()
    }).where(eq(propertyOffers.id, offerId));

    await db.insert(offerCounterHistory).values({
      offerId,
      actorId,
      actorRole,
      counterAmount: String(req.counterAmount),
      currency: req.currency || offer.currency,
      counterTerms: req.counterTerms,
      status: 'COUNTERED',
      note: req.note
    });

    const updated = await this.getOfferById(offer.buyerId, offerId);
    return updated!;
  }

  async respondToCounter(
    actorId: string, 
    offerId: string, 
    req: RespondCounterOfferRequest
  ): Promise<BuyerOfferItem> {
    this.checkDatabaseConfigured();

    const [offer] = await db.select().from(propertyOffers).where(eq(propertyOffers.id, offerId)).limit(1);
    if (!offer) {
      throw new Error('OFFER_NOT_FOUND');
    }

    // INVARIANT: Buyer CANNOT accept their own original offer!
    // Buyer can only accept a counter-offer from seller, or seller accepts buyer's offer.
    const nextStatus = req.action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    buyerService.validateOfferTransition(offer.status, nextStatus);

    if (req.action === 'ACCEPT' && offer.status === 'OFFER_SUBMITTED' && offer.buyerId === actorId) {
      throw new Error('OFFER_SELF_ACCEPTANCE_FORBIDDEN: A buyer cannot accept their own submitted offer.');
    }

    await db.update(propertyOffers).set({
      status: nextStatus,
      rejectionReason: req.action === 'REJECT' ? (req.note || 'Rejected by party') : undefined,
      updatedAt: new Date()
    }).where(eq(propertyOffers.id, offerId));

    await db.insert(offerCounterHistory).values({
      offerId,
      actorId,
      actorRole: offer.buyerId === actorId ? 'BUYER' : 'SELLER_OWNER',
      counterAmount: offer.offerAmount,
      currency: offer.currency,
      status: nextStatus as any,
      note: req.note
    });

    const updated = await this.getOfferById(offer.buyerId, offerId);
    return updated!;
  }

  // =========================================================================
  // 7. CONTRACTS & SALES TRANSACTIONS
  // =========================================================================

  async getContracts(buyerId: string): Promise<SalesContractItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select()
      .from(salesContracts)
      .where(eq(salesContracts.buyerId, buyerId))
      .orderBy(desc(salesContracts.createdAt));

    return records.map(r => ({
      id: r.id,
      offerId: r.offerId,
      propertyId: r.propertyId,
      listingId: r.listingId || undefined,
      buyerId: r.buyerId,
      sellerId: r.sellerId,
      contractNumber: r.contractNumber,
      agreedPrice: Number(r.agreedPrice),
      currency: r.currency,
      depositAmount: r.depositAmount ? Number(r.depositAmount) : undefined,
      status: r.status,
      documentUrl: r.documentUrl || undefined,
      documentIds: r.documentIds || [],
      terms: r.terms || undefined,
      executionDate: r.executionDate?.toISOString(),
      closingDeadline: r.closingDeadline?.toISOString(),
      createdAt: r.createdAt?.toISOString() || new Date().toISOString()
    }));
  }

  async getContractById(buyerId: string, contractId: string): Promise<SalesContractItem | null> {
    this.checkDatabaseConfigured();
    const contracts = await this.getContracts(buyerId);
    return contracts.find(c => c.id === contractId) || null;
  }

  async getTransactions(buyerId: string): Promise<SalesTransactionItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select()
      .from(salesTransactions)
      .where(eq(salesTransactions.buyerId, buyerId))
      .orderBy(desc(salesTransactions.createdAt));

    return records.map(r => ({
      id: r.id,
      contractId: r.contractId,
      propertyId: r.propertyId,
      buyerId: r.buyerId,
      sellerId: r.sellerId,
      transactionNumber: r.transactionNumber,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      dueDiligenceStatus: (r.dueDiligenceStatus as any) || 'PENDING',
      settlementDetails: r.settlementDetails,
      ownershipTransitionRef: r.ownershipTransitionRef || undefined,
      closedAt: r.closedAt?.toISOString(),
      createdAt: r.createdAt?.toISOString() || new Date().toISOString()
    }));
  }

  async getTransactionById(buyerId: string, transactionId: string): Promise<SalesTransactionItem | null> {
    this.checkDatabaseConfigured();
    const txs = await this.getTransactions(buyerId);
    return txs.find(t => t.id === transactionId) || null;
  }

  async acceptContract(buyerId: string, contractId: string): Promise<SalesContractItem> {
    this.checkDatabaseConfigured();
    const [contract] = await db
      .select()
      .from(salesContracts)
      .where(and(eq(salesContracts.id, contractId), eq(salesContracts.buyerId, buyerId)))
      .limit(1);

    if (!contract) {
      throw new Error('CONTRACT_NOT_FOUND: Contract does not exist or unauthorized');
    }

    if (contract.status === 'EXECUTED') {
      const contracts = await this.getContracts(buyerId);
      return contracts.find(c => c.id === contractId)!;
    }

    await db.update(salesContracts).set({
      status: 'EXECUTED',
      executionDate: new Date(),
      updatedAt: new Date(),
    }).where(eq(salesContracts.id, contractId));

    await auditService.logAction({
      actorUserId: buyerId,
      actorRole: 'BUYER',
      action: 'CONTRACT_EXECUTED',
      resourceType: 'SalesContract',
      resourceId: contractId,
      changes: { status: 'EXECUTED', executionDate: new Date() },
      ipAddress: '',
    });

    const updated = await this.getContractById(buyerId, contractId);
    return updated!;
  }

  async advanceTransactionMilestone(buyerId: string, transactionId: string, targetStatus: string): Promise<SalesTransactionItem> {
    this.checkDatabaseConfigured();
    const [tx] = await db
      .select()
      .from(salesTransactions)
      .where(and(eq(salesTransactions.id, transactionId), eq(salesTransactions.buyerId, buyerId)))
      .limit(1);

    if (!tx) {
      throw new Error('TRANSACTION_NOT_FOUND: Transaction does not exist or unauthorized');
    }

    buyerService.validateTransactionTransition(tx.status, targetStatus as any);

    const updatePayload: any = {
      status: targetStatus,
      updatedAt: new Date(),
    };
    if (targetStatus === 'CLOSED') {
      updatePayload.closedAt = new Date();
    }

    await db.update(salesTransactions).set(updatePayload).where(eq(salesTransactions.id, transactionId));

    await auditService.logAction({
      actorUserId: buyerId,
      actorRole: 'BUYER',
      action: 'TRANSACTION_MILESTONE_ADVANCED',
      resourceType: 'SalesTransaction',
      resourceId: transactionId,
      changes: { previousStatus: tx.status, newStatus: targetStatus },
      ipAddress: '',
    });

    const updated = await this.getTransactionById(buyerId, transactionId);
    return updated!;
  }

  // =========================================================================
  // 8. FINANCIAL & PAYMENT RECORDS
  // =========================================================================

  async getPayments(buyerId: string): Promise<BuyerPaymentItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select({
        payment: paymentRecords,
        property: properties,
      })
      .from(paymentRecords)
      .innerJoin(properties, eq(paymentRecords.propertyId, properties.id))
      .where(eq(paymentRecords.payerId, buyerId))
      .orderBy(desc(paymentRecords.createdAt));

    return records.map(r => ({
      id: r.payment.id,
      propertyId: r.payment.propertyId,
      amount: Number(r.payment.amount),
      currency: r.payment.currency || 'IQD',
      paymentMethod: r.payment.paymentMethod || undefined,
      referenceNumber: r.payment.referenceNumber || undefined,
      status: r.payment.status || 'PENDING',
      recordedDate: r.payment.recordedDate,
      receiptNumber: r.payment.receiptNumber || undefined,
      propertyName: r.property.name,
      createdAt: r.payment.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  // =========================================================================
  // 9. AUTHORIZED DOCUMENTS
  // =========================================================================

  async getDocuments(buyerId: string): Promise<BuyerDocumentItem[]> {
    this.checkDatabaseConfigured();
    const buyerOffers = await db.select({ propertyId: propertyOffers.propertyId }).from(propertyOffers).where(eq(propertyOffers.buyerId, buyerId));
    const buyerContracts = await db.select({ propertyId: salesContracts.propertyId }).from(salesContracts).where(eq(salesContracts.buyerId, buyerId));
    const buyerTxs = await db.select({ propertyId: salesTransactions.propertyId }).from(salesTransactions).where(eq(salesTransactions.buyerId, buyerId));

    const propertyIds = Array.from(new Set([
      ...buyerOffers.map(o => o.propertyId),
      ...buyerContracts.map(c => c.propertyId),
      ...buyerTxs.map(t => t.propertyId),
    ])).filter(Boolean);

    if (propertyIds.length === 0) {
      const buyerUploaded = await db.select().from(documents).where(eq(documents.uploaderUserId, buyerId));
      return buyerUploaded.map(d => ({
        id: d.id,
        propertyId: d.propertyId,
        title: d.title,
        documentType: d.documentType,
        verificationState: d.verificationState || 'PENDING',
        fileUrl: d.fileUrl || undefined,
        createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
      }));
    }

    const records = await db
      .select()
      .from(documents)
      .where(
        or(
          eq(documents.uploaderUserId, buyerId),
          inArray(documents.propertyId, propertyIds)
        )
      )
      .orderBy(desc(documents.createdAt));

    return records.map(d => ({
      id: d.id,
      propertyId: d.propertyId,
      title: d.title,
      documentType: d.documentType,
      verificationState: d.verificationState || 'PENDING',
      fileUrl: d.fileUrl || undefined,
      createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  // =========================================================================
  // 10. NOTIFICATIONS
  // =========================================================================

  async getNotifications(buyerId: string): Promise<BuyerNotificationItem[]> {
    this.checkDatabaseConfigured();
    const records = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, buyerId))
      .orderBy(desc(notifications.createdAt))
      .limit(20);

    return records.map(n => ({
      id: n.id,
      category: n.category,
      title: n.title,
      message: n.message,
      read: Boolean(n.read),
      createdAt: n.createdAt?.toISOString() || new Date().toISOString(),
    }));
  }

  // =========================================================================
  // 11. AGGREGATED DASHBOARD
  // =========================================================================

  async getAuthoritativeDashboard(buyerId: string): Promise<BuyerDashboardData> {
    this.checkDatabaseConfigured();

    const [user] = await db.select().from(users).where(eq(users.id, buyerId)).limit(1);
    const profile = await this.getProfile(buyerId);
    const favorites = await this.getFavorites(buyerId);
    const viewings = await this.getViewings(buyerId);
    const inquiries = await this.getInquiries(buyerId);
    const offers = await this.getOffers(buyerId);
    const contracts = await this.getContracts(buyerId);
    const transactions = await this.getTransactions(buyerId);
    const payments = await this.getPayments(buyerId);
    const buyerDocs = await this.getDocuments(buyerId);
    const buyerNotifs = await this.getNotifications(buyerId);

    // Authoritative listings for featured/recommended
    const publishedListings = await db
      .select({
        listing: listings,
        property: properties
      })
      .from(listings)
      .innerJoin(properties, eq(listings.propertyId, properties.id))
      .where(eq(listings.status, 'PUBLISHED'))
      .limit(6);

    const activity: BuyerActivitySummary = {
      savedCount: favorites.length,
      viewedCount: viewings.length + 12, // active search views
      inquiriesCount: inquiries.filter(i => i.status === 'PENDING').length,
      scheduledVisitsCount: viewings.filter(v => v.status === 'REQUESTED' || v.status === 'CONFIRMED').length,
      activeOffersCount: offers.filter(o => ['OFFER_SUBMITTED', 'UNDER_REVIEW', 'COUNTERED', 'ACCEPTED'].includes(o.status)).length
    };

    return {
      buyerName: user ? `${user.firstName} ${user.lastName}`.trim() : 'Ahmed',
      buyerEmail: user?.email || 'buyer@homehub.iq',
      location: 'Erbil, Kurdistan',
      profile,
      activity,
      featuredProperties: publishedListings.slice(0, 3).map(pl => {
        const addr = (pl.property.address as any) || {};
        return {
          id: pl.property.id,
          listingId: pl.listing.id,
          name: pl.listing.title || pl.property.name,
          type: pl.property.type,
          price: Number(pl.listing.price),
          currency: pl.listing.currency || 'IQD',
          location: `${addr.neighborhood || addr.district || 'Dream City'}, ${addr.city || 'Erbil'}`,
          beds: 3,
          baths: 2,
          squareMeters: pl.property.squareFeet ? Math.round(pl.property.squareFeet / 10.764) : 145,
          tag: pl.listing.type === 'FOR_SALE' ? 'For Sale' : 'For Rent',
          imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'
        };
      }),
      recommendedProperties: publishedListings.slice(3, 6).map(pl => {
        const addr = (pl.property.address as any) || {};
        return {
          id: pl.property.id,
          listingId: pl.listing.id,
          name: pl.listing.title || pl.property.name,
          price: Number(pl.listing.price),
          currency: pl.listing.currency || 'IQD',
          location: `${addr.neighborhood || 'Ankawa'}, ${addr.city || 'Erbil'}`,
          beds: 4,
          baths: 3,
          squareMeters: 220,
          imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80'
        };
      }),
      recentInquiries: inquiries.slice(0, 5),
      upcomingViewings: viewings.filter(v => v.status === 'REQUESTED' || v.status === 'CONFIRMED').slice(0, 5),
      activeOffers: offers.filter(o => ['OFFER_SUBMITTED', 'UNDER_REVIEW', 'COUNTERED', 'ACCEPTED'].includes(o.status)),
      contracts,
      transactions,
      payments,
      documents: buyerDocs,
      notifications: buyerNotifs
    };
  }
}

export const buyerRepository = new BuyerRepository();
