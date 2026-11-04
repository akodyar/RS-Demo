import { LeaseStatus, RentStatus, PaymentStatus } from './index.js';

export interface TenantPropertySummary {
  id: string;
  name: string;
  unitId?: string;
  unitNumber: string;
  address: string;
  city: string;
  region: string;
  imageUrl?: string;
  photos?: string[];
  leaseId: string;
  leaseStatus: LeaseStatus | string;
  leaseStart: string;
  leaseEnd: string;
  monthlyRent: number;
  securityDeposit: number;
  durationMonths: number;
  currency: string;
  landlordName?: string;
  buildingRules?: string[];
  amenities?: string[];
}

export interface TenantRentDue {
  scheduleId?: string;
  leaseId?: string;
  propertyId?: string;
  amount: number;
  dueDate: string;
  daysRemaining: number;
  status: RentStatus | string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  isOverdue: boolean;
}

export interface TenantFinancialSummary {
  paidThisMonth: number;
  outstanding: number;
  overdue: number;
  currency: string;
  lastPaymentDate?: string;
}

export interface TenantQuickStats {
  openMaintenanceCount: number;
  unreadMessagesCount: number;
  upcomingEventsCount: number;
}

export interface TenantActivityItem {
  id: string;
  type: 'MAINTENANCE' | 'PAYMENT' | 'LEASE' | 'DOCUMENT' | 'MESSAGE' | 'INSPECTION';
  title: string;
  subtitle: string;
  timestamp: string;
  status: string;
  referenceNumber?: string;
  entityId?: string;
}

export interface TenantMaintenanceItem {
  id: string;
  referenceNumber: string;
  title: string;
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'REPORTED' | 'ASSIGNED' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  submittedDate: string;
  description: string;
  propertyName: string;
  unitNumber: string;
  vendorName?: string;
  scheduledDate?: string;
  latestUpdate?: string;
  images?: string[];
}

export interface TenantDocumentItem {
  id: string;
  title: string;
  documentType: string;
  fileType: string;
  sizeFormatted: string;
  date: string;
  fileUrl?: string;
  category: 'LEASE' | 'INSPECTION' | 'RULES' | 'RECEIPT' | 'PAYMENT' | 'OTHER';
}

export interface TenantConversationItem {
  id: string;
  title: string;
  participantName: string;
  participantRole: 'PROPERTY_MANAGEMENT' | 'PROPERTY_OWNER' | 'MAINTENANCE_TEAM' | 'SUPPORT';
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  avatarType: 'management' | 'owner' | 'maintenance' | 'support';
}

export interface TenantPaymentHistoryItem {
  id: string;
  paymentRecordId: string;
  period: string;
  amount: number;
  currency: string;
  paymentDate: string;
  status: PaymentStatus | string;
  referenceNumber: string;
  receiptNumber?: string;
  paymentMethod: string;
  hasReceipt: boolean;
}

export interface TenantUpcomingEvent {
  id: string;
  title: string;
  date: string;
  type: 'RENT_DUE' | 'INSPECTION' | 'MAINTENANCE_VISIT' | 'LEASE_RENEWAL' | 'BUILDING_EVENT';
  description: string;
}

export interface TenantSecurityDepositItem {
  id: string;
  leaseId: string;
  propertyId: string;
  propertyName: string;
  requiredAmount: number;
  recordedAmount: number;
  releasedAmount: number;
  currency: string;
  status: 'PENDING' | 'HELD' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'DEDUCTED' | string;
  createdAt?: string;
}

export interface TenantRentalApplicationItem {
  id: string;
  status: string;
  submittedAt: string | null;
  propertyName: string | null;
  propertyAddress: string | null;
}

export interface TenantDashboardData {
  user: {
    id: string;
    name: string;
    email: string;
    location?: string;
  };
  currentProperty: TenantPropertySummary | null;
  rentDue: TenantRentDue | null;
  securityDeposit?: TenantSecurityDepositItem | null;
  financialSummary: TenantFinancialSummary;
  quickStats: TenantQuickStats;
  recentActivity: TenantActivityItem[];
  myLease: TenantPropertySummary | null;
  paymentHistory: TenantPaymentHistoryItem[];
  maintenanceRequests: TenantMaintenanceItem[];
  documents: TenantDocumentItem[];
  conversations: TenantConversationItem[];
  upcomingEvents: TenantUpcomingEvent[];
  rentalApplications?: TenantRentalApplicationItem[];
}

export interface PayRentRequest {
  scheduleId?: string;
  propertyId: string;
  leaseId: string;
  amount: number;
  currency?: string;
  paymentMethod: 'FIB' | 'FASTPAY' | 'ZAINCASH' | 'BANK_TRANSFER' | 'CASH';
  referenceNumber?: string;
  allowConversion?: boolean;
}

export interface CreateTenantMaintenanceRequest {
  propertyId: string;
  unitId?: string;
  category: 'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'APPLIANCE' | 'STRUCTURAL' | 'SAFETY' | 'PEST_CONTROL' | 'OTHER';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  title: string;
  description: string;
  images?: string[];
}

export interface TenantLeaseRenewalRequest {
  leaseId: string;
  propertyId: string;
  proposedStartDate: string;
  proposedEndDate: string;
  proposedRentAmount?: number;
  tenantNotes?: string;
}

export interface TenantMoveOutRequest {
  leaseId: string;
  propertyId: string;
  requestedMoveOutDate: string;
  reason?: string;
  forwardingAddress?: string;
}

export interface TenantAIAssistRequest {
  query: string;
  contextType?: 'LEASE' | 'PAYMENT' | 'MAINTENANCE' | 'GENERAL';
}

export interface TenantAIAssistResponse {
  answer: string;
  type: 'FACT' | 'CALCULATION' | 'RECOMMENDATION' | 'DRAFT';
  humanApprovalRequired?: boolean;
  requiresConfirmation?: boolean;
  suggestedActions?: string[];
  disclaimer: string;
}
