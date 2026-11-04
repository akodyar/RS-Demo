import { Permission, CompanyRole } from './index.js';

export type CompanyVerificationStatus = 
  | 'DRAFT'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'SUSPENDED'
  | 'REJECTED'
  | 'ARCHIVED';

export type ManagementAgreementStatus = 
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'TERMINATED';

export interface CompanyKPIs {
  managedProperties: number;
  activeTenants: number;
  monthlyRentManagedIqd: number;
  openMaintenance: number;
  activeListings: number;
  pendingApprovals: number;
}

export interface CompanyProfile {
  id: string;
  name: string;
  legalName?: string;
  registrationNumber?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    governorate?: string;
    country?: string;
  };
  serviceArea?: string;
  serviceCategories?: string[];
  teamSize?: string;
  spendingLimitDefault?: number;
  status: CompanyVerificationStatus;
  verified: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyMemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: CompanyRole | string;
  status: 'ACTIVE' | 'SUSPENDED' | 'REMOVED';
  assignedPropertyIds?: string[];
  createdAt?: string;
}

export interface CompanyInvitationItem {
  id: string;
  companyId: string;
  email: string;
  role: string;
  assignedPropertyIds?: string[];
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
  expiresAt?: string;
  createdAt?: string;
}

export interface CompanyPropertyItem {
  id: string;
  name: string;
  nameKurdish?: string;
  type: string;
  status: string;
  address?: any;
  ownerId: string;
  ownerName: string;
  ownerPhone?: string;
  ownerEmail?: string;
  managementAgreementId: string;
  managementAgreementStatus: ManagementAgreementStatus;
  grantedPermissions: (Permission | string)[];
  spendingLimit: number;
  managementFee?: number;
  unitsCount: number;
  occupiedUnitsCount: number;
  activeLeasesCount: number;
  openMaintenanceCount: number;
  monthlyRentIqd: number;
  isOwner: false; // Explicitly enforce Company is NOT owner
}

export interface CompanyManagementAgreementItem {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyType: string;
  ownerId: string;
  ownerName: string;
  ownerEmail?: string;
  ownerPhone?: string;
  companyId: string;
  companyName: string;
  status: ManagementAgreementStatus;
  startDate: string;
  endDate?: string;
  grantedPermissions: string[];
  spendingLimit: number;
  approvalRules?: {
    requireOwnerApprovalAboveAmount?: number;
    requireOwnerLeaseApproval?: boolean;
    requireOwnerListingApproval?: boolean;
  };
  createdAt?: string;
}

export interface CompanyTenantItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  propertyId: string;
  propertyName: string;
  unitNumber?: string;
  leaseId: string;
  leaseStatus: string;
  rentAmount: number;
  rentStatus: string;
  currency: string;
}

export interface CompanyLeaseItem {
  id: string;
  propertyId: string;
  propertyName: string;
  unitId?: string;
  unitNumber?: string;
  tenantId: string;
  tenantName: string;
  startDate: string;
  endDate: string;
  rentAmount: number;
  currency: string;
  depositAmount?: number;
  status: string;
  approvalRequired: boolean;
  isOwnerApproved: boolean;
}

export interface CompanyMaintenanceItem {
  id: string;
  propertyId: string;
  propertyName: string;
  unitId?: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: string;
  title: string;
  description: string;
  reportedBy: string;
  assignedVendorName?: string;
  budget?: number;
  quotesCount: number;
  createdAt: string;
}

export interface CompanyVendorItem {
  id: string;
  organizationId: string;
  name: string;
  categories: string[];
  status: string;
  phone?: string;
  email?: string;
}

export interface CompanyListingItem {
  id: string;
  propertyId: string;
  propertyName: string;
  type: 'FOR_RENT' | 'FOR_SALE';
  price: number;
  currency: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
  title: string;
  description?: string;
  listingAuthorityGranted: boolean;
  createdAt: string;
}

export interface CompanyApprovalItem {
  id: string;
  type: 'SPENDING_THRESHOLD' | 'LEASE_ACTIVATION' | 'MAINTENANCE_QUOTE' | 'LISTING_PUBLICATION' | 'MANAGEMENT_AGREEMENT';
  title: string;
  description: string;
  propertyId: string;
  propertyName: string;
  ownerId: string;
  ownerName: string;
  amount?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestedByRole: string;
  requiresOwnerDecision: boolean;
  createdAt: string;
}

export interface CompanyFinancialSummary {
  rentManagedTotalIqd: number;
  collectedRentIqd: number;
  pendingRentIqd: number;
  commissionsEarnedIqd: number;
  expensesApprovedIqd: number;
  platformCommissionIqd?: number;
  rentFeeIqd?: number;
  ownerSettlementPayableIqd?: number;
  sourceOfTruth: 'POSTGRESQL_DOUBLE_ENTRY_LEDGER';
  propertiesCount: number;
  reconciliationStatus: 'BALANCED' | 'PENDING_RECONCILIATION' | 'UNRECONCILED' | 'NO_DATA';
  currency?: string;
}

export interface CompanyReportItem {
  id: string;
  title: string;
  category: 'PORTFOLIO' | 'OCCUPANCY' | 'RENT_COLLECTION' | 'MAINTENANCE' | 'COMMISSIONS';
  period: string;
  generatedAt: string;
  data: any;
  historicalComparisonAvailable: boolean;
  notes?: string;
}

export interface CompanyAIRecommendation {
  id: string;
  category: 'PORTFOLIO_OPTIMIZATION' | 'LEASE_RENEWAL' | 'MAINTENANCE_EFFICIENCY' | 'RENTAL_PRICING';
  type: 'FACT' | 'CALCULATION' | 'ESTIMATE' | 'RECOMMENDATION' | 'DRAFT';
  headline: string;
  propertyId?: string;
  propertyName?: string;
  details: string;
  confidenceScore?: number;
  actionRequired: boolean;
  humanApprovalRequired: true;
  generatedAt: string;
}

export interface CompanyDashboardData {
  company: CompanyProfile;
  callerMember: {
    userId: string;
    role: CompanyRole | string;
    status: string;
  };
  kpis: CompanyKPIs;
  managedProperties: CompanyPropertyItem[];
  urgentAlerts: {
    id: string;
    level: 'INFO' | 'WARNING' | 'ALERT';
    title: string;
    message: string;
    link?: string;
  }[];
  recentActivities: {
    id: string;
    action: string;
    resourceType: string;
    resourceId: string;
    description: string;
    timestamp: string;
  }[];
  pendingApprovals: CompanyApprovalItem[];
  financialSummary: CompanyFinancialSummary;
  aiRecommendations: CompanyAIRecommendation[];
}
