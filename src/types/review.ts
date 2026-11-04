export type ReviewStatus = 'PUBLISHED' | 'HIDDEN' | 'FLAGGED';

export interface PropertyReview {
  id: string;
  propertyId: string;
  leaseId?: string | null;
  tenantId: string;
  rating: number; // 1 to 5
  cleanlinessRating?: number | null;
  maintenanceRating?: number | null;
  communicationRating?: number | null;
  locationRating?: number | null;
  title?: string | null;
  comment: string;
  status: ReviewStatus;
  moderationReason?: string | null;
  moderatedByUserId?: string | null;
  moderatedAt?: Date | string | null;
  ownerResponse?: string | null;
  ownerRespondedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  // Optional populated fields for display
  tenantName?: string;
  propertyName?: string;
}

export interface ReviewRatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface PropertyReviewAggregate {
  propertyId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: ReviewRatingDistribution;
  cleanlinessAverage?: number;
  maintenanceAverage?: number;
  communicationAverage?: number;
  locationAverage?: number;
}

export interface ReviewEligibilityResult {
  eligible: boolean;
  reason?: string;
  leaseId?: string;
  existingReview?: PropertyReview | null;
}

export interface CreatePropertyReviewInput {
  propertyId: string;
  rating: number;
  cleanlinessRating?: number;
  maintenanceRating?: number;
  communicationRating?: number;
  locationRating?: number;
  title?: string;
  comment: string;
}

export interface UpdatePropertyReviewInput {
  rating?: number;
  cleanlinessRating?: number;
  maintenanceRating?: number;
  communicationRating?: number;
  locationRating?: number;
  title?: string;
  comment?: string;
}

export interface RespondToReviewInput {
  response: string;
}

export interface ModerateReviewInput {
  status: 'PUBLISHED' | 'HIDDEN' | 'FLAGGED';
  reason?: string;
}

export interface FlagReviewInput {
  reason: string;
}

export interface VendorReviewEntity {
  id: string;
  vendorId: string;
  workOrderId: string;
  reviewerUserId: string;
  reviewerRole: 'OWNER' | 'TENANT' | 'COMPANY_MANAGER';
  rating: number;
  comment: string;
  vendorResponse?: string | null;
  respondedAt?: Date | string | null;
  createdAt: Date | string;
  reviewerName?: string;
  workOrderTitle?: string;
}
