import { Permission, PropertyType } from './index.js';

export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}

export enum AgentAvailability {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  AWAY = 'AWAY',
  ON_LEAVE = 'ON_LEAVE',
}

export enum AgentVerificationStatus {
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

export enum PropertyAssignmentStatus {
  ACTIVE = 'ACTIVE',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum LeadType {
  BUY = 'BUY',
  RENT = 'RENT',
  SELL = 'SELL',
  INVEST = 'INVEST',
  OWNER = 'OWNER',
  TENANT = 'TENANT',
}

export enum LeadStage {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  VIEWING_SCHEDULED = 'VIEWING_SCHEDULED',
  OFFER_MADE = 'OFFER_MADE',
  NEGOTIATING = 'NEGOTIATING',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export enum LeadPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum DealCommissionStatus {
  CALCULATED = 'CALCULATED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  PAYABLE = 'PAYABLE',
  DISBURSED = 'DISBURSED',
  DISPUTED = 'DISPUTED',
  REVERSED = 'REVERSED',
  CANCELLED = 'CANCELLED',
}

export enum CalendarEventType {
  VIEWING = 'VIEWING',
  CLIENT_MEETING = 'CLIENT_MEETING',
  OFFER_DISCUSSION = 'OFFER_DISCUSSION',
  TEAM_MEETING = 'TEAM_MEETING',
  INSPECTION = 'INSPECTION',
}

export interface AgentProfile {
  id: string;
  userId: string;
  displayName: string;
  professionalTitle: string;
  biography?: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  officeName?: string;
  officeAddress?: string;
  spokenLanguages: string[];
  specialties: string[];
  propertyTypes: string[];
  serviceAreas: string[];
  availabilityStatus: AgentAvailability;
  workingHours?: Record<string, string>;
  status: AgentStatus;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentLicense {
  id: string;
  agentId: string;
  userId: string;
  licenseNumber: string;
  issuingAuthority: string;
  issuedDate?: string;
  expiryDate?: string;
  documentUrl?: string;
  verificationStatus: AgentVerificationStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentPropertyAssignment {
  id: string;
  agentId?: string;
  userId: string;
  propertyId: string;
  companyId?: string;
  assignedBy: string;
  permissions: Permission[] | string[];
  status: PropertyAssignmentStatus;
  effectiveDate?: string;
  expiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentLead {
  id: string;
  agentId?: string;
  userId: string;
  companyId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  leadType: LeadType;
  stage: LeadStage;
  budgetMin?: number;
  budgetMax?: number;
  currency: string;
  preferredLocations?: string[];
  propertyType?: string;
  notes?: string;
  nextFollowUp?: string;
  priority: LeadPriority;
  source: string;
  linkedBuyerId?: string;
  linkedPropertyId?: string;
  linkedListingId?: string;
  linkedInquiryId?: string;
  linkedViewingId?: string;
  linkedOfferId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentTask {
  id: string;
  agentId?: string;
  userId: string;
  companyId?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  status: TaskStatus;
  category: string;
  linkedLeadId?: string;
  linkedPropertyId?: string;
  linkedViewingId?: string;
  linkedOfferId?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentCommission {
  id: string;
  agentId?: string;
  userId: string;
  companyId?: string;
  transactionId?: string;
  contractId?: string;
  propertyId?: string;
  listingId?: string;
  dealAmount: number;
  dealType: 'SALE' | 'LEASE_ACQUISITION';
  commissionBasis: 'PERCENTAGE' | 'FIXED_FEE';
  grossCommissionRate?: number;
  grossCommissionAmount: number;
  brokerageSplitRate?: number;
  brokerageShareAmount: number;
  agentShareAmount: number;
  currency: string;
  status: DealCommissionStatus;
  approvedBy?: string;
  approvedAt?: string;
  disbursedAt?: string;
  paymentReference?: string;
  journalEntryId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentCalendarEvent {
  id: string;
  userId: string;
  title: string;
  eventType: CalendarEventType;
  startTime: string;
  endTime: string;
  location?: string;
  meetingLink?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  linkedLeadId?: string;
  linkedViewingId?: string;
  linkedPropertyId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentDashboardData {
  kpi: {
    totalListings: number;
    listingsDeltaMonth: number;
    activeLeads: number;
    leadsDeltaWeek: number;
    scheduledViewingsToday: number;
    activeOffers: number;
    offersDeltaNew: number;
    closedDealsThisYear: number;
    totalCommissionEarned: number;
    commissionCurrency: string;
  };
  propertyPerformance: {
    period: string; // '7d' | '30d' | '90d'
    totalViews: number;
    totalInquiries: number;
    totalViewings: number;
    totalOffers: number;
    timeline: {
      date: string;
      views: number;
      inquiries: number;
    }[];
  };
  recentLeads: {
    id: string;
    clientName: string;
    leadType: LeadType;
    summary: string;
    stage: LeadStage;
    timeAgo: string;
    priority: LeadPriority;
  }[];
  todaySchedule: {
    id: string;
    time: string;
    type: CalendarEventType;
    title: string;
    subtitle: string;
    actionType: 'VIEW' | 'MEET' | 'JOIN';
    actionTarget?: string;
  }[];
  myListings: {
    id: string;
    propertyId: string;
    title: string;
    location: string;
    price: number;
    currency: string;
    status: string;
    beds: number;
    baths: number;
    areaSqm: number;
    imageUrl: string;
  }[];
  aiAssistant: {
    greeting: string;
    suggestedPrompts: string[];
    insightSnippet?: string;
  };
  marketInsights: {
    city: string;
    averageSalePricePerSqm: number;
    averageSalePriceChange: number;
    averageRentPricePerSqm: number;
    averageRentPriceChange: number;
    activeListingsCount: number;
    activeListingsChange: number;
    marketDemand: 'LOW' | 'MEDIUM' | 'HIGH';
    marketDemandChange: number;
    isAuthoritative: boolean;
  };
}

export interface AgentAssignedPropertyItem {
  id: string; // Assignment ID
  propertyId: string;
  title: string;
  propertyType: string;
  city: string;
  address: any;
  status: string;
  isOwner: boolean; // strictly false
  assignmentStatus: PropertyAssignmentStatus;
  permissions: string[];
  assignedBy: string;
  companyId?: string;
  effectiveDate?: string;
  expiryDate?: string;
  ownerName?: string;
  createdAt?: string;
}

export interface AgentRentalItem {
  propertyId: string;
  listingId?: string;
  title: string;
  location: string;
  monthlyRent: number;
  currency: string;
  status: string;
  assignedPermissions: string[];
  activeInquiriesCount: number;
  activeViewingsCount: number;
  currentLeaseId?: string;
  occupancyStatus: 'VACANT' | 'OCCUPIED' | 'PENDING_TURNOVER';
}

export interface AgentDocumentItem {
  id: string;
  title: string;
  category: string;
  propertyId?: string;
  propertyName?: string;
  fileType: string;
  fileSize: number;
  status: string;
  downloadUrl?: string;
  createdAt: string;
}

export interface AgentAnalyticsData {
  assignedListingsCount: number;
  totalLeadsCount: number;
  leadsByStage: Record<string, number>;
  leadConversionRate: number;
  scheduledViewingsCount: number;
  completedViewingsCount: number;
  viewingCompletionRate: number;
  activeOffersCount: number;
  closedDealsCount: number;
  totalCommissionsEarned: number;
  currency: string;
  status: 'AVAILABLE' | 'INSUFFICIENT_DATA';
}

