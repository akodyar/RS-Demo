import { db } from '../../db/index.js';
import { 
  listings, 
  propertyInquiries, 
  propertyViewings, 
  rentalApplications,
  properties,
  ownershipRecords,
  managementAgreements
} from '../../db/schema.js';
import { eq, and, or } from 'drizzle-orm';
import { auditService } from '../services/audit.js';

export const rentalAcquisitionRepository = {
  /**
   * Create a new rental listing for a property
   */
  async createListing(user: any, data: { propertyId: string; title: string; description?: string; price: number; currency?: string; companyId?: string }) {
    const userId = user.id;
    // 1. Authorization: check if user owns the property or has management agreement
    const isOwner = await db.query.ownershipRecords.findFirst({
      where: and(
        eq(ownershipRecords.propertyId, data.propertyId),
        eq(ownershipRecords.ownerId, userId),
        eq(ownershipRecords.status, 'VERIFIED')
      )
    });

    if (!isOwner && !data.companyId) {
      throw new Error("Unauthorized: User must be verified owner to create a listing.");
    }

    // Check management agreement if companyId is provided
    if (!isOwner && data.companyId) {
      const isPlatformAdmin = user.roles?.some((r: any) => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));
      if (!isPlatformAdmin && user.organizationId !== data.companyId) {
        throw new Error("Unauthorized: User does not belong to the specified management company.");
      }

      const activeManagement = await db.query.managementAgreements.findFirst({
        where: and(
          eq(managementAgreements.propertyId, data.propertyId),
          eq(managementAgreements.companyId, data.companyId),
          eq(managementAgreements.status, 'ACTIVE')
        )
      });
      if (!activeManagement) {
        throw new Error("Unauthorized: No active management agreement found for this property.");
      }
    }

    const newListing = await db.transaction(async (tx) => {
      const [listing] = await tx.insert(listings).values({
        propertyId: data.propertyId,
        publisherUserId: userId,
        publisherCompanyId: data.companyId,
        type: 'FOR_RENT',
        price: data.price.toString(),
        currency: data.currency || 'USD',
        title: data.title,
        description: data.description,
        status: 'DRAFT'
      }).returning();

      await auditService.logAction({
        actorUserId: userId,
        actorRole: data.companyId ? 'AGENT' : 'OWNER',
        action: 'LISTING_CREATED',
        resourceType: 'Listing',
        resourceId: listing.id,
        changes: { status: 'DRAFT', propertyId: data.propertyId }
      });

      return listing;
    });

    return newListing;
  },

  /**
   * Update the status of a listing (e.g. Publish)
   */
  async updateListingStatus(userId: string, listingId: string, status: string) {
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId)
    });

    if (!listing) throw new Error("Listing not found.");

    // Simple auth check: only publisher can update for now (in a real app, owners and managers would also be able to)
    if (listing.publisherUserId !== userId) {
        // Allow if user is owner
        const isOwner = await db.query.ownershipRecords.findFirst({
            where: and(
              eq(ownershipRecords.propertyId, listing.propertyId),
              eq(ownershipRecords.ownerId, userId),
              eq(ownershipRecords.status, 'VERIFIED')
            )
          });
        if (!isOwner) {
            throw new Error("Unauthorized: Cannot update listing status.");
        }
    }

    // State machine check
    const validTransitions: Record<string, string[]> = {
      'DRAFT': ['PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED'],
      'PENDING_REVIEW': ['PUBLISHED', 'REJECTED'],
      'PUBLISHED': ['PAUSED', 'CLOSED', 'ARCHIVED'],
      'PAUSED': ['PUBLISHED', 'CLOSED', 'ARCHIVED'],
      'CLOSED': [],
      'ARCHIVED': []
    };

    if (!validTransitions[listing.status!].includes(status)) {
      throw new Error(`Invalid state transition from ${listing.status} to ${status}`);
    }

    if (status === 'PUBLISHED') {
      const prop = await db.query.properties.findFirst({
        where: eq(properties.id, listing.propertyId)
      });
      if (!prop || (prop.verificationStatus !== 'VERIFIED' && prop.status !== 'VERIFIED')) {
        throw new Error("Cannot publish listing for an unverified property. Admin verification is required.");
      }
    }

    const updated = await db.transaction(async (tx) => {
      const [updatedListing] = await tx.update(listings)
        .set({ status, updatedAt: new Date() })
        .where(eq(listings.id, listingId))
        .returning();

      await auditService.logAction({
        actorUserId: userId,
        actorRole: 'SYSTEM',
        action: 'LISTING_STATUS_UPDATED',
        resourceType: 'Listing',
        resourceId: listingId,
        changes: { oldStatus: listing.status, newStatus: status }
      });

      return updatedListing;
    });

    return updated;
  },

  /**
   * Submit an inquiry for a listing
   */
  async createInquiry(buyerId: string, listingId: string, message: string) {
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId)
    });

    if (!listing || listing.status !== 'PUBLISHED') {
      throw new Error("Listing is not active or does not exist.");
    }

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, listing.propertyId)
    });
    if (!prop || (prop.verificationStatus !== 'VERIFIED' && prop.status !== 'VERIFIED')) {
      throw new Error("Property is not verified. Rental inquiries are not permitted.");
    }

    // Idempotency: prevent exact duplicate messages from the same buyer on the same listing
    const existing = await db.query.propertyInquiries.findFirst({
      where: and(
        eq(propertyInquiries.buyerId, buyerId),
        eq(propertyInquiries.listingId, listingId),
        eq(propertyInquiries.message, message)
      )
    });

    if (existing) {
      return existing; // idempotent return
    }

    const newInquiry = await db.transaction(async (tx) => {
      const [inquiry] = await tx.insert(propertyInquiries).values({
        buyerId,
        propertyId: listing.propertyId,
        listingId,
        message,
        recipientUserId: listing.publisherUserId,
        recipientCompanyId: listing.publisherCompanyId,
        status: 'PENDING'
      }).returning();

      await auditService.logAction({
        actorUserId: buyerId,
        actorRole: 'TENANT',
        action: 'INQUIRY_CREATED',
        resourceType: 'PropertyInquiry',
        resourceId: inquiry.id,
        changes: { listingId }
      });

      return inquiry;
    });

    return newInquiry;
  },

  /**
   * Schedule a viewing
   */
  async scheduleViewing(buyerId: string, listingId: string, scheduledAt: Date) {
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId)
    });

    if (!listing || listing.status !== 'PUBLISHED') {
      throw new Error("Listing is not active.");
    }

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, listing.propertyId)
    });
    if (!prop || (prop.verificationStatus !== 'VERIFIED' && prop.status !== 'VERIFIED')) {
      throw new Error("Property is not verified. Rental viewings are not permitted.");
    }

    const newViewing = await db.transaction(async (tx) => {
      const [viewing] = await tx.insert(propertyViewings).values({
        buyerId,
        propertyId: listing.propertyId,
        listingId,
        scheduledAt,
        status: 'REQUESTED'
      }).returning();

      await auditService.logAction({
        actorUserId: buyerId,
        actorRole: 'TENANT',
        action: 'VIEWING_REQUESTED',
        resourceType: 'PropertyViewing',
        resourceId: viewing.id,
        changes: { scheduledAt }
      });

      return viewing;
    });

    return newViewing;
  },

  /**
   * Submit a rental application
   */
  async submitApplication(applicantId: string, listingId: string, data: { monthlyIncome?: number; notes?: string; preferredMoveInDate?: string; employmentStatus?: string }) {
    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId)
    });

    if (!listing || listing.status !== 'PUBLISHED') {
      throw new Error("Listing is not active.");
    }
    if (listing.type !== 'FOR_RENT') {
      throw new Error("Listing is not available for rent.");
    }

    const prop = await db.query.properties.findFirst({
      where: eq(properties.id, listing.propertyId)
    });
    if (!prop || (prop.verificationStatus !== 'VERIFIED' && prop.status !== 'VERIFIED')) {
      throw new Error("Property is not verified. Rental applications are not permitted.");
    }

    // Check duplicate active applications
    const existingActive = await db.query.rentalApplications.findFirst({
      where: and(
        eq(rentalApplications.applicantUserId, applicantId),
        eq(rentalApplications.propertyId, listing.propertyId),
        or(
          eq(rentalApplications.status, 'SUBMITTED'),
          eq(rentalApplications.status, 'UNDER_REVIEW'),
          eq(rentalApplications.status, 'MORE_INFORMATION_REQUIRED'),
          eq(rentalApplications.status, 'APPROVED')
        )
      )
    });

    if (existingActive) {
      throw new Error("You already have an active application for this property.");
    }

    try {
      const newApp = await db.transaction(async (tx) => {
        const [application] = await tx.insert(rentalApplications).values({
          applicantUserId: applicantId,
          propertyId: listing.propertyId,
          monthlyIncome: data.monthlyIncome !== undefined && data.monthlyIncome !== null ? data.monthlyIncome.toString() : null,
          notes: data.notes || null,
          preferredMoveInDate: data.preferredMoveInDate || null,
          employmentStatus: data.employmentStatus || null,
          status: 'SUBMITTED'
        }).returning();

        await auditService.logAction({
          actorUserId: applicantId,
          actorRole: 'TENANT',
          action: 'APPLICATION_SUBMITTED',
          resourceType: 'RentalApplication',
          resourceId: application.id,
          changes: { listingId }
        });

        return application;
      });

      return newApp;
    } catch (err: any) {
      const isDuplicateActiveApp =
        (err.code === '23505' || err.cause?.code === '23505') &&
        (err.constraint?.includes('rental_applications_active_unique') ||
         err.cause?.constraint?.includes('rental_applications_active_unique') ||
         err.message?.includes('rental_applications_active_unique') ||
         err.cause?.message?.includes('rental_applications_active_unique') ||
         err.cause?.detail?.includes('rental_applications_active_unique'));
      if (isDuplicateActiveApp) {
        throw new Error("You already have an active application for this property.");
      }
      throw err;
    }
  },

  /**
   * Review application
   */
  async reviewApplication(reviewer: any, applicationId: string, decision: 'APPROVED' | 'REJECTED' | 'UNDER_REVIEW') {
    const reviewerId = reviewer.id;
    const application = await db.query.rentalApplications.findFirst({
      where: eq(rentalApplications.id, applicationId)
    });

    if (!application) {
      throw new Error("Application not found.");
    }

    const isPlatformAdmin = reviewer.roles?.some((r: any) => ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));

    // Verify reviewer authorization (must be owner or managing company or admin)
    const isOwner = await db.query.ownershipRecords.findFirst({
      where: and(
        eq(ownershipRecords.propertyId, application.propertyId),
        eq(ownershipRecords.ownerId, reviewerId),
        eq(ownershipRecords.status, 'VERIFIED')
      )
    });

    let isManager = false;
    if (reviewer.organizationId) {
      const activeManagement = await db.query.managementAgreements.findFirst({
        where: and(
          eq(managementAgreements.propertyId, application.propertyId),
          eq(managementAgreements.companyId, reviewer.organizationId),
          eq(managementAgreements.status, 'ACTIVE')
        )
      });
      if (activeManagement && (activeManagement.grantedPermissions?.includes('TENANT_MANAGE') || activeManagement.grantedPermissions?.includes('LEASE_MANAGE'))) {
        isManager = true;
      }
    }

    if (!isPlatformAdmin && !isOwner && !isManager) {
      throw new Error("Unauthorized: Only verified owner or authorized managing company can review applications.");
    }

    if (application.applicantUserId === reviewerId) {
        throw new Error("Cannot review your own application.");
    }

    // State machine check
    const validTransitions: Record<string, string[]> = {
      'SUBMITTED': ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      'UNDER_REVIEW': ['APPROVED', 'REJECTED'],
      'MORE_INFORMATION_REQUIRED': ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      'APPROVED': ['CONVERTED_TO_LEASE'],
      'CONVERTED_TO_LEASE': [],
      'REJECTED': [],
      'WITHDRAWN': [],
      'EXPIRED': []
    };

    if (!validTransitions[application.status!].includes(decision)) {
      throw new Error(`Invalid application state transition from ${application.status} to ${decision}`);
    }

    const updated = await db.transaction(async (tx) => {
      const [updatedApp] = await tx.update(rentalApplications)
        .set({ 
            status: decision, 
            reviewedAt: decision !== 'UNDER_REVIEW' ? new Date() : undefined,
            updatedAt: new Date()
        })
        .where(eq(rentalApplications.id, applicationId))
        .returning();

      await auditService.logAction({
        actorUserId: reviewerId,
        actorRole: 'OWNER',
        action: `APPLICATION_${decision}`,
        resourceType: 'RentalApplication',
        resourceId: applicationId,
        changes: {}
      });

      return updatedApp;
    });

    return updated;
  }
};
