import { db } from '../../db/index.js';
import {
  propertyReviews,
  vendorReviews,
  vendorProfiles,
  properties,
  leases,
  leaseTenants,
  ownershipRecords,
  managementAgreements,
  workOrders,
  maintenanceRequests,
  users,
} from '../../db/schema.js';
import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import {
  PropertyReview,
  PropertyReviewAggregate,
  ReviewEligibilityResult,
  CreatePropertyReviewInput,
  UpdatePropertyReviewInput,
  VendorReviewEntity,
  ReviewStatus,
} from '../../types/review.js';

export class ReviewsRepository {
  private checkDatabaseConfigured() {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
  }

  // =========================================================================
  // 1. ELIGIBILITY VERIFICATION
  // =========================================================================

  async checkEligibility(propertyId: string, userId: string): Promise<ReviewEligibilityResult> {
    this.checkDatabaseConfigured();

    if (!propertyId || !userId) {
      return { eligible: false, reason: 'Property ID and User ID are required.' };
    }

    // Check if user has or had a qualifying lease on this property
    const qualifyingLeases = await db
      .select({
        leaseId: leases.id,
        propertyId: leases.propertyId,
        status: leases.status,
      })
      .from(leases)
      .innerJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
      .where(and(
        eq(leases.propertyId, propertyId),
        eq(leaseTenants.tenantId, userId),
        inArray(leases.status, ['ACTIVE', 'EXPIRING', 'COMPLETED', 'TERMINATED', 'EXPIRED'])
      ))
      .limit(1);

    if (qualifyingLeases.length === 0) {
      return {
        eligible: false,
        reason: 'NOT_QUALIFIED_TO_REVIEW: You must have an active or completed tenancy at this property to review it.',
      };
    }

    const qualifyingLease = qualifyingLeases[0];

    // Check if user already submitted a review for this property
    const [existingReview] = await db
      .select()
      .from(propertyReviews)
      .where(and(
        eq(propertyReviews.propertyId, propertyId),
        eq(propertyReviews.tenantId, userId)
      ))
      .limit(1);

    if (existingReview) {
      return {
        eligible: false,
        reason: 'REVIEW_ALREADY_EXISTS: You have already submitted a review for this property.',
        leaseId: qualifyingLease.leaseId,
        existingReview: {
          id: existingReview.id,
          propertyId: existingReview.propertyId,
          leaseId: existingReview.leaseId,
          tenantId: existingReview.tenantId,
          rating: existingReview.rating,
          cleanlinessRating: existingReview.cleanlinessRating,
          maintenanceRating: existingReview.maintenanceRating,
          communicationRating: existingReview.communicationRating,
          locationRating: existingReview.locationRating,
          title: existingReview.title,
          comment: existingReview.comment,
          status: existingReview.status as ReviewStatus,
          moderationReason: existingReview.moderationReason,
          ownerResponse: existingReview.ownerResponse,
          ownerRespondedAt: existingReview.ownerRespondedAt,
          createdAt: existingReview.createdAt,
          updatedAt: existingReview.updatedAt,
        },
      };
    }

    return {
      eligible: true,
      leaseId: qualifyingLease.leaseId,
    };
  }

  // =========================================================================
  // 2. CREATE PROPERTY REVIEW
  // =========================================================================

  async createPropertyReview(userId: string, input: CreatePropertyReviewInput): Promise<PropertyReview> {
    this.checkDatabaseConfigured();

    const { propertyId, rating, cleanlinessRating, maintenanceRating, communicationRating, locationRating, title, comment } = input;

    if (!propertyId) throw new Error('MISSING_PROPERTY_ID: Property ID is required.');
    
    // Rating validation: integer 1..5
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('INVALID_RATING: Rating must be an integer between 1 and 5.');
    }

    // Sub-ratings validation if provided
    const subRatings = [
      { name: 'cleanlinessRating', val: cleanlinessRating },
      { name: 'maintenanceRating', val: maintenanceRating },
      { name: 'communicationRating', val: communicationRating },
      { name: 'locationRating', val: locationRating },
    ];
    for (const sub of subRatings) {
      if (sub.val !== undefined && sub.val !== null) {
        if (typeof sub.val !== 'number' || !Number.isInteger(sub.val) || sub.val < 1 || sub.val > 5) {
          throw new Error(`INVALID_SUB_RATING: ${sub.name} must be an integer between 1 and 5.`);
        }
      }
    }

    // Comment validation: 5 to 2000 chars
    if (!comment || typeof comment !== 'string' || comment.trim().length < 5) {
      throw new Error('INVALID_COMMENT: Comment must be at least 5 characters long.');
    }
    if (comment.trim().length > 2000) {
      throw new Error('COMMENT_TOO_LONG: Comment cannot exceed 2000 characters.');
    }

    if (title && (typeof title !== 'string' || title.trim().length > 120)) {
      throw new Error('TITLE_TOO_LONG: Title cannot exceed 120 characters.');
    }

    // Verify eligibility
    const eligibility = await this.checkEligibility(propertyId, userId);
    if (!eligibility.eligible) {
      if (eligibility.existingReview) {
        throw new Error('REVIEW_ALREADY_EXISTS: You have already submitted a review for this property.');
      }
      throw new Error(eligibility.reason || 'NOT_QUALIFIED_TO_REVIEW');
    }

    const [inserted] = await db
      .insert(propertyReviews)
      .values({
        propertyId,
        leaseId: eligibility.leaseId || null,
        tenantId: userId,
        rating,
        cleanlinessRating: cleanlinessRating || null,
        maintenanceRating: maintenanceRating || null,
        communicationRating: communicationRating || null,
        locationRating: locationRating || null,
        title: title ? title.trim() : null,
        comment: comment.trim(),
        status: 'PUBLISHED',
      })
      .returning();

    return {
      id: inserted.id,
      propertyId: inserted.propertyId,
      leaseId: inserted.leaseId,
      tenantId: inserted.tenantId,
      rating: inserted.rating,
      cleanlinessRating: inserted.cleanlinessRating,
      maintenanceRating: inserted.maintenanceRating,
      communicationRating: inserted.communicationRating,
      locationRating: inserted.locationRating,
      title: inserted.title,
      comment: inserted.comment,
      status: inserted.status as ReviewStatus,
      moderationReason: inserted.moderationReason,
      moderatedByUserId: inserted.moderatedByUserId,
      moderatedAt: inserted.moderatedAt,
      ownerResponse: inserted.ownerResponse,
      ownerRespondedAt: inserted.ownerRespondedAt,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  }

  // =========================================================================
  // 3. GET PROPERTY REVIEWS (PUBLIC & FILTERED)
  // =========================================================================

  async getPropertyReviews(
    propertyId: string,
    options: { page?: number; limit?: number; includeHidden?: boolean } = {}
  ): Promise<{ reviews: PropertyReview[]; total: number; page: number; limit: number }> {
    this.checkDatabaseConfigured();

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;

    const baseWhere = options.includeHidden
      ? eq(propertyReviews.propertyId, propertyId)
      : and(
          eq(propertyReviews.propertyId, propertyId),
          eq(propertyReviews.status, 'PUBLISHED')
        );

    const records = await db
      .select({
        review: propertyReviews,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(propertyReviews)
      .innerJoin(users, eq(propertyReviews.tenantId, users.id))
      .where(baseWhere)
      .orderBy(desc(propertyReviews.createdAt))
      .limit(limit)
      .offset(offset);

    // Total count query
    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(propertyReviews)
      .where(baseWhere);

    const total = Number(countResult?.count || 0);

    const reviews: PropertyReview[] = records.map(r => {
      // Privacy-safe tenant name: "Ahmad K." or "Verified Tenant"
      const first = r.user.firstName || '';
      const lastInitial = r.user.lastName ? `${r.user.lastName.charAt(0)}.` : '';
      const tenantName = (first || lastInitial) ? `${first} ${lastInitial}`.trim() : 'Verified Tenant';

      return {
        id: r.review.id,
        propertyId: r.review.propertyId,
        leaseId: r.review.leaseId,
        tenantId: r.review.tenantId,
        rating: r.review.rating,
        cleanlinessRating: r.review.cleanlinessRating,
        maintenanceRating: r.review.maintenanceRating,
        communicationRating: r.review.communicationRating,
        locationRating: r.review.locationRating,
        title: r.review.title,
        comment: r.review.comment,
        status: r.review.status as ReviewStatus,
        moderationReason: r.review.moderationReason,
        moderatedByUserId: r.review.moderatedByUserId,
        moderatedAt: r.review.moderatedAt,
        ownerResponse: r.review.ownerResponse,
        ownerRespondedAt: r.review.ownerRespondedAt,
        createdAt: r.review.createdAt,
        updatedAt: r.review.updatedAt,
        tenantName,
      };
    });

    return { reviews, total, page, limit };
  }

  // =========================================================================
  // 4. AGGREGATE RATINGS (PUBLISHED REVIEWS ONLY)
  // =========================================================================

  async getPropertyReviewAggregate(propertyId: string): Promise<PropertyReviewAggregate> {
    this.checkDatabaseConfigured();

    const publishedReviews = await db
      .select({
        rating: propertyReviews.rating,
        cleanliness: propertyReviews.cleanlinessRating,
        maintenance: propertyReviews.maintenanceRating,
        communication: propertyReviews.communicationRating,
        location: propertyReviews.locationRating,
      })
      .from(propertyReviews)
      .where(and(
        eq(propertyReviews.propertyId, propertyId),
        eq(propertyReviews.status, 'PUBLISHED')
      ));

    const totalReviews = publishedReviews.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    if (totalReviews === 0) {
      return {
        propertyId,
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution,
      };
    }

    let sumRating = 0;
    let sumClean = 0, countClean = 0;
    let sumMaint = 0, countMaint = 0;
    let sumComm = 0, countComm = 0;
    let sumLoc = 0, countLoc = 0;

    for (const r of publishedReviews) {
      sumRating += r.rating;
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }
      if (r.cleanliness) { sumClean += r.cleanliness; countClean++; }
      if (r.maintenance) { sumMaint += r.maintenance; countMaint++; }
      if (r.communication) { sumComm += r.communication; countComm++; }
      if (r.location) { sumLoc += r.location; countLoc++; }
    }

    const averageRating = Number((sumRating / totalReviews).toFixed(1));

    return {
      propertyId,
      averageRating,
      totalReviews,
      ratingDistribution,
      cleanlinessAverage: countClean > 0 ? Number((sumClean / countClean).toFixed(1)) : undefined,
      maintenanceAverage: countMaint > 0 ? Number((sumMaint / countMaint).toFixed(1)) : undefined,
      communicationAverage: countComm > 0 ? Number((sumComm / countComm).toFixed(1)) : undefined,
      locationAverage: countLoc > 0 ? Number((sumLoc / countLoc).toFixed(1)) : undefined,
    };
  }

  // =========================================================================
  // 5. UPDATE PROPERTY REVIEW (AUTHOR ONLY)
  // =========================================================================

  async updatePropertyReview(reviewId: string, userId: string, input: UpdatePropertyReviewInput): Promise<PropertyReview> {
    this.checkDatabaseConfigured();

    const [existing] = await db
      .select()
      .from(propertyReviews)
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    if (!existing) throw new Error('REVIEW_NOT_FOUND: Review does not exist.');
    if (existing.tenantId !== userId) {
      throw new Error('FORBIDDEN: You can only edit your own reviews.');
    }

    const updates: any = { updatedAt: new Date() };

    if (input.rating !== undefined) {
      if (typeof input.rating !== 'number' || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new Error('INVALID_RATING: Rating must be an integer between 1 and 5.');
      }
      updates.rating = input.rating;
    }

    if (input.comment !== undefined) {
      if (typeof input.comment !== 'string' || input.comment.trim().length < 5) {
        throw new Error('INVALID_COMMENT: Comment must be at least 5 characters long.');
      }
      if (input.comment.trim().length > 2000) {
        throw new Error('COMMENT_TOO_LONG: Comment cannot exceed 2000 characters.');
      }
      updates.comment = input.comment.trim();
    }

    if (input.title !== undefined) {
      if (input.title && input.title.trim().length > 120) {
        throw new Error('TITLE_TOO_LONG: Title cannot exceed 120 characters.');
      }
      updates.title = input.title ? input.title.trim() : null;
    }

    const subRatings = [
      { key: 'cleanlinessRating', val: input.cleanlinessRating },
      { key: 'maintenanceRating', val: input.maintenanceRating },
      { key: 'communicationRating', val: input.communicationRating },
      { key: 'locationRating', val: input.locationRating },
    ];
    for (const sub of subRatings) {
      if (sub.val !== undefined) {
        if (sub.val !== null && (typeof sub.val !== 'number' || !Number.isInteger(sub.val) || sub.val < 1 || sub.val > 5)) {
          throw new Error(`INVALID_SUB_RATING: ${sub.key} must be an integer between 1 and 5.`);
        }
        updates[sub.key] = sub.val;
      }
    }

    const [updated] = await db
      .update(propertyReviews)
      .set(updates)
      .where(eq(propertyReviews.id, reviewId))
      .returning();

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      leaseId: updated.leaseId,
      tenantId: updated.tenantId,
      rating: updated.rating,
      cleanlinessRating: updated.cleanlinessRating,
      maintenanceRating: updated.maintenanceRating,
      communicationRating: updated.communicationRating,
      locationRating: updated.locationRating,
      title: updated.title,
      comment: updated.comment,
      status: updated.status as ReviewStatus,
      moderationReason: updated.moderationReason,
      moderatedByUserId: updated.moderatedByUserId,
      moderatedAt: updated.moderatedAt,
      ownerResponse: updated.ownerResponse,
      ownerRespondedAt: updated.ownerRespondedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // 6. DELETE PROPERTY REVIEW (AUTHOR OR ADMIN)
  // =========================================================================

  async deletePropertyReview(reviewId: string, user: { id: string; roles: string[] }): Promise<{ success: boolean; id: string }> {
    this.checkDatabaseConfigured();

    const [existing] = await db
      .select()
      .from(propertyReviews)
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    if (!existing) throw new Error('REVIEW_NOT_FOUND: Review does not exist.');

    const isAuthor = existing.tenantId === user.id;
    const isAdmin = (user.roles || []).some(r => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(r));

    if (!isAuthor && !isAdmin) {
      throw new Error('FORBIDDEN: You are not authorized to delete this review.');
    }

    await db.delete(propertyReviews).where(eq(propertyReviews.id, reviewId));
    return { success: true, id: reviewId };
  }

  // =========================================================================
  // 7. RESPOND TO PROPERTY REVIEW (OWNER OR MANAGING COMPANY)
  // =========================================================================

  async respondToPropertyReview(
    reviewId: string,
    user: { id: string; roles: string[]; organizationId?: string },
    responseText: string
  ): Promise<PropertyReview> {
    this.checkDatabaseConfigured();

    const [existing] = await db
      .select()
      .from(propertyReviews)
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    if (!existing) throw new Error('REVIEW_NOT_FOUND: Review does not exist.');

    // Authorization: Owner, Managing Company, or Platform Admin
    const isAdmin = (user.roles || []).some(r => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(r));
    let isAuthorized = isAdmin;

    if (!isAuthorized) {
      // Check verified ownership
      const [ownerRecord] = await db
        .select()
        .from(ownershipRecords)
        .where(and(
          eq(ownershipRecords.propertyId, existing.propertyId),
          user.organizationId
            ? eq(ownershipRecords.companyId, user.organizationId)
            : eq(ownershipRecords.ownerId, user.id),
          eq(ownershipRecords.status, 'VERIFIED')
        ))
        .limit(1);

      if (ownerRecord) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && user.organizationId) {
      // Check active management agreement
      const [agreement] = await db
        .select()
        .from(managementAgreements)
        .where(and(
          eq(managementAgreements.propertyId, existing.propertyId),
          eq(managementAgreements.companyId, user.organizationId),
          eq(managementAgreements.status, 'ACTIVE')
        ))
        .limit(1);

      if (agreement) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error('FORBIDDEN: Only the verified property owner or authorized management company can respond to reviews.');
    }

    if (!responseText || typeof responseText !== 'string' || responseText.trim().length < 2) {
      throw new Error('INVALID_RESPONSE: Response text is required and must be at least 2 characters.');
    }
    if (responseText.trim().length > 2000) {
      throw new Error('RESPONSE_TOO_LONG: Response cannot exceed 2000 characters.');
    }

    const [updated] = await db
      .update(propertyReviews)
      .set({
        ownerResponse: responseText.trim(),
        ownerRespondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(propertyReviews.id, reviewId))
      .returning();

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      leaseId: updated.leaseId,
      tenantId: updated.tenantId,
      rating: updated.rating,
      cleanlinessRating: updated.cleanlinessRating,
      maintenanceRating: updated.maintenanceRating,
      communicationRating: updated.communicationRating,
      locationRating: updated.locationRating,
      title: updated.title,
      comment: updated.comment,
      status: updated.status as ReviewStatus,
      moderationReason: updated.moderationReason,
      moderatedByUserId: updated.moderatedByUserId,
      moderatedAt: updated.moderatedAt,
      ownerResponse: updated.ownerResponse,
      ownerRespondedAt: updated.ownerRespondedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // 8. MODERATE REVIEW (PLATFORM ADMIN ONLY)
  // =========================================================================

  async moderatePropertyReview(
    reviewId: string,
    adminUser: { id: string; roles: string[] },
    status: ReviewStatus,
    reason?: string
  ): Promise<PropertyReview> {
    this.checkDatabaseConfigured();

    const isAdmin = (adminUser.roles || []).some(r => ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(r));
    if (!isAdmin) {
      throw new Error('FORBIDDEN: Only platform administrators can moderate reviews.');
    }

    if (!['PUBLISHED', 'HIDDEN', 'FLAGGED'].includes(status)) {
      throw new Error('INVALID_STATUS: Moderation status must be PUBLISHED, HIDDEN, or FLAGGED.');
    }

    const [existing] = await db
      .select()
      .from(propertyReviews)
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    if (!existing) throw new Error('REVIEW_NOT_FOUND: Review does not exist.');

    const [updated] = await db
      .update(propertyReviews)
      .set({
        status,
        moderationReason: reason ? reason.trim() : null,
        moderatedByUserId: adminUser.id,
        moderatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(propertyReviews.id, reviewId))
      .returning();

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      leaseId: updated.leaseId,
      tenantId: updated.tenantId,
      rating: updated.rating,
      cleanlinessRating: updated.cleanlinessRating,
      maintenanceRating: updated.maintenanceRating,
      communicationRating: updated.communicationRating,
      locationRating: updated.locationRating,
      title: updated.title,
      comment: updated.comment,
      status: updated.status as ReviewStatus,
      moderationReason: updated.moderationReason,
      moderatedByUserId: updated.moderatedByUserId,
      moderatedAt: updated.moderatedAt,
      ownerResponse: updated.ownerResponse,
      ownerRespondedAt: updated.ownerRespondedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // 9. FLAG REVIEW (COMMUNITY REPORTING)
  // =========================================================================

  async flagPropertyReview(reviewId: string, reporterUserId: string, reason: string): Promise<PropertyReview> {
    this.checkDatabaseConfigured();

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new Error('INVALID_REASON: Reason for reporting must be at least 5 characters.');
    }

    const [existing] = await db
      .select()
      .from(propertyReviews)
      .where(eq(propertyReviews.id, reviewId))
      .limit(1);

    if (!existing) throw new Error('REVIEW_NOT_FOUND: Review does not exist.');

    const [updated] = await db
      .update(propertyReviews)
      .set({
        status: 'FLAGGED',
        moderationReason: `Reported by user ${reporterUserId}: ${reason.trim()}`,
        updatedAt: new Date(),
      })
      .where(eq(propertyReviews.id, reviewId))
      .returning();

    return {
      id: updated.id,
      propertyId: updated.propertyId,
      leaseId: updated.leaseId,
      tenantId: updated.tenantId,
      rating: updated.rating,
      cleanlinessRating: updated.cleanlinessRating,
      maintenanceRating: updated.maintenanceRating,
      communicationRating: updated.communicationRating,
      locationRating: updated.locationRating,
      title: updated.title,
      comment: updated.comment,
      status: updated.status as ReviewStatus,
      moderationReason: updated.moderationReason,
      moderatedByUserId: updated.moderatedByUserId,
      moderatedAt: updated.moderatedAt,
      ownerResponse: updated.ownerResponse,
      ownerRespondedAt: updated.ownerRespondedAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  // =========================================================================
  // 10. VENDOR REVIEW SUBMISSION (CLIENT TO VENDOR UPON COMPLETED WORK ORDER)
  // =========================================================================

  async createVendorReview(
    reviewerUserId: string,
    reviewerRole: 'OWNER' | 'TENANT' | 'COMPANY_MANAGER',
    input: { workOrderId: string; rating: number; comment: string }
  ): Promise<VendorReviewEntity> {
    this.checkDatabaseConfigured();

    const { workOrderId, rating, comment } = input;

    if (!workOrderId) throw new Error('MISSING_WORK_ORDER_ID: Work order ID is required.');
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error('INVALID_RATING: Rating must be an integer between 1 and 5.');
    }
    if (!comment || typeof comment !== 'string' || comment.trim().length < 5) {
      throw new Error('INVALID_COMMENT: Comment must be at least 5 characters long.');
    }
    if (comment.trim().length > 2000) {
      throw new Error('COMMENT_TOO_LONG: Comment cannot exceed 2000 characters.');
    }

    // 1. Verify work order exists and is COMPLETED
    const [wo] = await db
      .select({
        workOrder: workOrders,
        req: maintenanceRequests,
      })
      .from(workOrders)
      .innerJoin(maintenanceRequests, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
      .where(eq(workOrders.id, workOrderId))
      .limit(1);

    if (!wo) throw new Error('WORK_ORDER_NOT_FOUND: Work order does not exist.');
    if (wo.workOrder.status !== 'COMPLETED') {
      throw new Error('WORK_ORDER_NOT_COMPLETED: Reviews can only be submitted for completed work orders.');
    }

    // 2. Verify reviewer authorization/qualification for this work order
    if (reviewerRole === 'TENANT') {
      const isDirectRequester = wo.req.reporterUserId === reviewerUserId;
      if (!isDirectRequester) {
        // Also check if user has/had a qualifying lease for this property
        const [leaseTenant] = await db
          .select({ leaseId: leases.id })
          .from(leases)
          .innerJoin(leaseTenants, eq(leases.id, leaseTenants.leaseId))
          .where(and(
            eq(leases.propertyId, wo.req.propertyId),
            eq(leaseTenants.tenantId, reviewerUserId),
            inArray(leases.status, ['ACTIVE', 'EXPIRING', 'COMPLETED', 'TERMINATED', 'EXPIRED'])
          ))
          .limit(1);

        if (!leaseTenant) {
          throw new Error('NOT_QUALIFIED_TO_REVIEW: You are not authorized to review this work order. Only the requesting tenant or a qualifying tenant on the lease may review it.');
        }
      }
    } else if (reviewerRole === 'OWNER') {
      const [ownership] = await db
        .select({ id: ownershipRecords.id })
        .from(ownershipRecords)
        .where(and(
          eq(ownershipRecords.propertyId, wo.req.propertyId),
          eq(ownershipRecords.ownerId, reviewerUserId)
        ))
        .limit(1);

      if (!ownership) {
        throw new Error('NOT_QUALIFIED_TO_REVIEW: Only verified property owners may submit owner reviews for work orders.');
      }
    }

    // 3. Resolve vendor profile
    let targetVendorId = wo.workOrder.vendorId;
    if (!targetVendorId && wo.workOrder.vendorUserId) {
      const [vProf] = await db
        .select()
        .from(vendorProfiles)
        .where(eq(vendorProfiles.userId, wo.workOrder.vendorUserId))
        .limit(1);
      if (vProf) targetVendorId = vProf.id;
    }

    if (!targetVendorId) {
      throw new Error('VENDOR_NOT_FOUND: No vendor profile linked to this work order.');
    }

    // 4. Check anti-stuffing / uniqueness constraint
    const [existing] = await db
      .select()
      .from(vendorReviews)
      .where(and(
        eq(vendorReviews.workOrderId, workOrderId),
        eq(vendorReviews.reviewerUserId, reviewerUserId)
      ))
      .limit(1);

    if (existing) {
      throw new Error('REVIEW_ALREADY_EXISTS: You have already reviewed this work order.');
    }

    // 4. Insert vendor review
    const [inserted] = await db
      .insert(vendorReviews)
      .values({
        vendorId: targetVendorId,
        workOrderId,
        reviewerUserId,
        reviewerRole,
        rating,
        comment: comment.trim(),
      })
      .returning();

    // 5. Update vendor profile average rating and count
    const allVendorReviews = await db
      .select({ rating: vendorReviews.rating })
      .from(vendorReviews)
      .where(eq(vendorReviews.vendorId, targetVendorId));

    const totalVReviews = allVendorReviews.length;
    const avgVRating = totalVReviews > 0
      ? (allVendorReviews.reduce((sum, r) => sum + r.rating, 0) / totalVReviews).toFixed(2)
      : '5.00';

    await db
      .update(vendorProfiles)
      .set({
        rating: avgVRating,
        reviewCount: totalVReviews,
        updatedAt: new Date(),
      })
      .where(eq(vendorProfiles.id, targetVendorId));

    return {
      id: inserted.id,
      vendorId: inserted.vendorId,
      workOrderId: inserted.workOrderId,
      reviewerUserId: inserted.reviewerUserId,
      reviewerRole: inserted.reviewerRole as any,
      rating: inserted.rating,
      comment: inserted.comment,
      vendorResponse: inserted.vendorResponse,
      respondedAt: inserted.respondedAt,
      createdAt: inserted.createdAt || new Date(),
    };
  }

  // =========================================================================
  // 11. GET VENDOR REVIEWS (PUBLIC VIEW)
  // =========================================================================

  async getVendorPublicReviews(vendorId: string): Promise<{ reviews: VendorReviewEntity[]; averageRating: number; totalReviews: number }> {
    this.checkDatabaseConfigured();

    let targetProfileId = vendorId;
    const [prof] = await db
      .select({ id: vendorProfiles.id })
      .from(vendorProfiles)
      .where(or(
        eq(vendorProfiles.id, vendorId),
        eq(vendorProfiles.userId, vendorId)
      ))
      .limit(1);
    if (prof) {
      targetProfileId = prof.id;
    }

    const records = await db
      .select({
        rev: vendorReviews,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(vendorReviews)
      .innerJoin(users, eq(vendorReviews.reviewerUserId, users.id))
      .where(eq(vendorReviews.vendorId, targetProfileId))
      .orderBy(desc(vendorReviews.createdAt));

    const totalReviews = records.length;
    const averageRating = totalReviews > 0
      ? Number((records.reduce((sum, r) => sum + r.rev.rating, 0) / totalReviews).toFixed(1))
      : 5.0;

    const reviews: VendorReviewEntity[] = records.map(r => {
      const first = r.user.firstName || '';
      const lastInitial = r.user.lastName ? `${r.user.lastName.charAt(0)}.` : '';
      const reviewerName = (first || lastInitial) ? `${first} ${lastInitial}`.trim() : 'Client';

      return {
        id: r.rev.id,
        vendorId: r.rev.vendorId,
        workOrderId: r.rev.workOrderId,
        reviewerUserId: r.rev.reviewerUserId,
        reviewerRole: r.rev.reviewerRole as any,
        rating: r.rev.rating,
        comment: r.rev.comment,
        vendorResponse: r.rev.vendorResponse,
        respondedAt: r.rev.respondedAt,
        createdAt: r.rev.createdAt || new Date(),
        reviewerName,
      };
    });

    return { reviews, averageRating, totalReviews };
  }
}

export const reviewsRepository = new ReviewsRepository();
export const reviewRepository = reviewsRepository;
