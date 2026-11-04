import { AdminRoleType } from './index';

export type AdminRole = AdminRoleType;

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'PROPERTY_OWNER' | 'COMPANY' | 'TENANT' | 'BUYER' | 'AGENT_BROKER' | 'VENDOR' | 'PLATFORM_ADMIN';
  adminRole?: AdminRole;
  status: 'active' | 'pending' | 'suspended' | 'deleted' | 'unverified';
  statusKurdish: string;
  verified: boolean;
  city: string;
  propertiesCount: number;
  lastActive: string;
  createdAt: string;
  permissions: string[];
}

export interface AdminCompanyRecord {
  id: string;
  name: string;
  tradeNameKurdish: string;
  city: string;
  licenseNumber: string;
  status: 'verified' | 'pending' | 'suspended' | 'rejected';
  agentCount: number;
  managedPropertiesCount: number;
  spendingLimitIqd: number;
  approvalRequiredAboveIqd: number;
  agreementExpiry: string;
  riskScore: 'LOW' | 'MEDIUM' | 'HIGH';
  contactPerson: string;
  phone: string;
}

export interface AdminPropertyRecord {
  id: string;
  title: string;
  titleKurdish: string;
  type: string;
  city: string;
  priceUsd: number;
  priceIqd: number;
  ownerName: string;
  ownerId: string;
  managingAgencyName?: string;
  managingAgencyId?: string;
  tapuNumber: string;
  tapuStatus: 'DRAFT' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  dateSubmitted: string;
  unitsCount: number;
  isOccupied: boolean;
  operatingModel?: string | null;
  rentFee?: number | null;
  managementFee?: number | null;
  platformFee?: number | null;
  currency?: string;
  address?: any;
  verificationStatus?: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  rejectionReason?: string | null;
  managementPreference?: 'SELF_MANAGED' | 'HOMEHUB_MANAGED' | 'AGENT_MANAGED';
  managementArrangementStatus?: 'NOT_APPLICABLE' | 'AWAITING_ONBOARDING' | 'AWAITING_AGREEMENT' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED';
  photos?: string[];
  documents?: any[];
  verifiedAt?: string | null;
  verifiedBy?: string | null;
}

export interface AdminMarketplaceListing {
  id: string;
  title: string;
  propertyType: string;
  city: string;
  listingType: 'FOR_RENT' | 'FOR_SALE';
  price: number;
  currency: 'USD' | 'IQD';
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'PAUSED' | 'UNDER_OFFER' | 'SOLD' | 'RENTED' | 'REJECTED';
  viewingsCount: number;
  offersCount: number;
  agentName: string;
  createdAt: string;
}

export interface AdminVerificationItem {
  id: string;
  subjectType: 'USER_KYC' | 'COMPANY_LICENSE' | 'PROPERTY_TAPU' | 'SALES_CONTRACT';
  title: string;
  requesterName: string;
  documentType: string;
  documentNumber: string;
  dateSubmitted: string;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NEEDS_INFO';
  evidenceUrl?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface AdminFinanceSummary {
  totalGmvIqd: number;
  escrowBalanceIqd: number;
  platformCommissionIqd: number;
  pendingReceivablesIqd: number;
  pendingPayablesIqd: number;
  totalTransactionsCount: number;
  exchangeRateUsdToIqd: number;
}

export interface AdminLedgerEntry {
  id: string;
  date: string;
  referenceNumber: string;
  description: string;
  accountDebit: string;
  accountCredit: string;
  amountIqd: number;
  status: 'RECORDED' | 'CONFIRMED' | 'SETTLED' | 'FAILED' | 'REVERSED';
  propertyId?: string;
}

export interface AdminMaintenanceOrder {
  id: string;
  ticketNumber: string;
  title: string;
  propertyTitle: string;
  urgency: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assignedVendorName?: string;
  estimatedCostIqd: number;
  createdAt: string;
}

export interface AdminSecurityEvent {
  id: string;
  type: 'FAILED_LOGIN_SPIKE' | 'ROLE_ELEVATION' | 'UNAUTHORIZED_TAPU_ATTEMPT' | 'RATE_LIMIT_HIT' | 'SESSION_ANOMALY';
  severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'HIGH';
  description: string;
  actor: string;
  ipAddress: string;
  timestamp: string;
  resolved: boolean;
  status?: 'ACTIVE' | 'RESOLVED' | 'BLOCKED' | 'MITIGATED';
  eventType?: string;
  sourceIp?: string;
  userTarget?: string;
}

export interface AdminAiGovernanceItem {
  id: string;
  featureName: string;
  autonomyLevel: 'ASSIST_ONLY' | 'RECOMMEND' | 'PREPARE_ACTION' | 'REQUIRE_APPROVAL' | 'LIMITED_AUTONOMY' | 'CONTROLLED_AUTONOMY';
  status: 'ACTIVE' | 'AUDIT_ONLY' | 'PAUSED';
  recommendationsCount: number;
  humanOverrideCount: number;
  safetyInterventionsCount: number;
  lastEvaluated: string;
  feature?: string;
  confidenceScore?: number;
  promptSummary?: string;
  aiOutputSummary?: string;
  timestamp?: string;
}

export interface AdminDisputeTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  partyA: string;
  partyB: string;
  relatedProperty: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'WAITING_FOR_INFO' | 'RESOLUTION_PROPOSED' | 'RESOLVED' | 'CLOSED' | 'UNDER_INVESTIGATION';
  createdAt: string;
  lastUpdated: string;
  title?: string;
  claimantName?: string;
  respondentName?: string;
  reason?: string;
  resolution?: string;
}

export interface AdminAuditLogItem {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  previousState?: string;
  newState?: string;
  reason?: string;
  correlationId?: string;
  details?: string;
  ipAddress?: string;
  actorName?: string;
  targetEntity?: string;
  targetId?: string;
}

