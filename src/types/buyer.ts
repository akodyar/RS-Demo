import { 
  ViewingStatus, 
  OfferStatus, 
  SalesContractStatus, 
  SalesTransactionStatus,
  PropertyType 
} from './index.js';

export interface BuyerProfile {
  id: string;
  userId: string;
  budgetMin?: number;
  budgetMax?: number;
  currency: string;
  preferredCities?: string[];
  preferredPropertyTypes?: string[];
  minBeds?: number;
  minBaths?: number;
  minSquareMeters?: number;
  purchasePurpose?: 'PRIMARY_RESIDENCE' | 'INVESTMENT' | 'VACATION_HOME' | 'COMMERCIAL';
  financingStatus?: 'CASH_READY' | 'PRE_APPROVED' | 'MORTGAGE_SEEKING' | 'NOT_STARTED';
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    instantOfferAlerts: boolean;
  };
  isComplete: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateBuyerProfileRequest {
  budgetMin?: number;
  budgetMax?: number;
  currency?: string;
  preferredCities?: string[];
  preferredPropertyTypes?: string[];
  minBeds?: number;
  minBaths?: number;
  minSquareMeters?: number;
  purchasePurpose?: 'PRIMARY_RESIDENCE' | 'INVESTMENT' | 'VACATION_HOME' | 'COMMERCIAL';
  financingStatus?: 'CASH_READY' | 'PRE_APPROVED' | 'MORTGAGE_SEEKING' | 'NOT_STARTED';
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
    instantOfferAlerts: boolean;
  };
}

export interface BuyerActivitySummary {
  savedCount: number;
  viewedCount: number;
  inquiriesCount: number;
  scheduledVisitsCount: number;
  activeOffersCount: number;
}

export interface BuyerFavoriteItem {
  id: string;
  buyerId: string;
  propertyId: string;
  listingId?: string;
  notes?: string;
  createdAt: string;
  property: {
    id: string;
    name: string;
    type: string;
    price: number;
    currency: string;
    city: string;
    neighborhood?: string;
    beds?: number;
    baths?: number;
    squareMeters?: number;
    imageUrl?: string;
    status: string;
  };
}

export interface SavedSearchItem {
  id: string;
  buyerId: string;
  name: string;
  criteria: {
    city?: string;
    neighborhood?: string;
    propertyType?: string;
    listingType?: string; // FOR_SALE, FOR_RENT
    minPrice?: number;
    maxPrice?: number;
    minBeds?: number;
    minBaths?: number;
    minArea?: number;
    maxArea?: number;
  };
  isActive: boolean;
  notifyOnMatch: boolean;
  createdAt: string;
}

export interface CreateSavedSearchRequest {
  name: string;
  criteria: SavedSearchItem['criteria'];
  notifyOnMatch?: boolean;
}

export interface BuyerInquiryItem {
  id: string;
  buyerId: string;
  propertyId: string;
  listingId?: string;
  inquiryType: string;
  message: string;
  status: 'PENDING' | 'RESPONDED' | 'CLOSED';
  recipientUserId?: string;
  recipientCompanyId?: string;
  responseMessage?: string;
  respondedAt?: string;
  createdAt: string;
  property?: {
    name: string;
    address?: any;
    price?: number;
    currency?: string;
  };
}

export interface CreateInquiryRequest {
  propertyId: string;
  listingId?: string;
  inquiryType?: string;
  message: string;
}

export interface BuyerViewingItem {
  id: string;
  buyerId: string;
  propertyId: string;
  listingId?: string;
  scheduledAt: string;
  status: ViewingStatus | string;
  viewingType: 'IN_PERSON' | 'VIRTUAL_TOUR';
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  organizerUserId?: string;
  organizerCompanyId?: string;
  feedback?: string;
  createdAt: string;
  property?: {
    name: string;
    address?: any;
    price?: number;
    currency?: string;
  };
}

export interface RequestViewingRequest {
  propertyId: string;
  listingId?: string;
  scheduledAt: string;
  viewingType?: 'IN_PERSON' | 'VIRTUAL_TOUR';
  notes?: string;
}

export interface RescheduleViewingRequest {
  scheduledAt: string;
  reason?: string;
}

export interface OfferCounterItem {
  id: string;
  offerId: string;
  actorId: string;
  actorRole: 'BUYER' | 'SELLER_OWNER' | 'SELLER_COMPANY';
  counterAmount: number;
  currency: string;
  counterTerms?: string;
  status: 'COUNTERED' | 'ACCEPTED' | 'REJECTED';
  note?: string;
  createdAt: string;
}

export interface BuyerOfferItem {
  id: string;
  buyerId: string;
  propertyId: string;
  listingId?: string;
  offerAmount: number;
  currency: string;
  depositAmount?: number;
  financingType?: string;
  terms?: string;
  conditions?: string[];
  status: OfferStatus | string;
  expiresAt?: string;
  sellerUserId?: string;
  sellerCompanyId?: string;
  rejectionReason?: string;
  withdrawnReason?: string;
  createdAt: string;
  updatedAt: string;
  negotiationHistory?: OfferCounterItem[];
  property?: {
    name: string;
    address?: any;
    listingPrice?: number;
    currency?: string;
  };
}

export interface CreateOfferRequest {
  propertyId: string;
  listingId?: string;
  offerAmount: number;
  currency?: string;
  depositAmount?: number;
  financingType?: string;
  terms?: string;
  conditions?: string[];
  expiresAt?: string;
}

export interface CounterOfferRequest {
  counterAmount: number;
  currency?: string;
  counterTerms?: string;
  note?: string;
}

export interface RespondCounterOfferRequest {
  action: 'ACCEPT' | 'REJECT';
  note?: string;
}

export interface SalesContractItem {
  id: string;
  offerId: string;
  propertyId: string;
  listingId?: string;
  buyerId: string;
  sellerId: string;
  contractNumber: string;
  agreedPrice: number;
  currency: string;
  depositAmount?: number;
  status: SalesContractStatus | string;
  documentUrl?: string;
  documentIds?: string[];
  terms?: string;
  executionDate?: string;
  closingDeadline?: string;
  createdAt: string;
}

export interface SalesTransactionItem {
  id: string;
  contractId: string;
  propertyId: string;
  buyerId: string;
  sellerId: string;
  transactionNumber: string;
  amount: number;
  currency: string;
  status: SalesTransactionStatus | string;
  dueDiligenceStatus: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED';
  settlementDetails?: any;
  ownershipTransitionRef?: string;
  closedAt?: string;
  createdAt: string;
}

export interface DueDiligenceChecklist {
  tapuVerificationStatus: 'VERIFIED' | 'PENDING' | 'NOT_CONNECTED';
  ownershipVerified: boolean;
  deedRegistryNumber?: string;
  encumbrancesFree: boolean;
  zoningApproved: boolean;
  structuralInspectionStatus: 'PENDING' | 'PASSED' | 'FAILED';
  taxClearanceCertificate: boolean;
  buyerChecklistComplete: boolean;
}

export interface BuyerPaymentItem {
  id: string;
  propertyId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  referenceNumber?: string;
  status: string;
  recordedDate: string;
  receiptNumber?: string;
  propertyName?: string;
  createdAt?: string;
}

export interface BuyerDocumentItem {
  id: string;
  propertyId: string;
  title: string;
  documentType: string;
  verificationState: string;
  fileUrl?: string;
  createdAt?: string;
}

export interface BuyerNotificationItem {
  id: string;
  category: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface BuyerDashboardData {
  buyerName: string;
  buyerEmail: string;
  location: string;
  profile: BuyerProfile | null;
  activity: BuyerActivitySummary;
  featuredProperties: any[];
  recommendedProperties: any[];
  recentInquiries: BuyerInquiryItem[];
  upcomingViewings: BuyerViewingItem[];
  activeOffers: BuyerOfferItem[];
  contracts: SalesContractItem[];
  transactions: SalesTransactionItem[];
  payments?: BuyerPaymentItem[];
  documents?: BuyerDocumentItem[];
  notifications?: BuyerNotificationItem[];
}

export interface BuyerAIAssistResponse {
  recommendations: Array<{
    propertyId: string;
    name: string;
    matchScore: number;
    reasonKu: string;
    reasonEn: string;
    price: number;
    currency: string;
  }>;
  insightsKu: string;
  insightsEn: string;
  disclaimerKu: string;
  disclaimerEn: string;
}
