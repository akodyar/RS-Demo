/**
 * CRITICAL AUTHORITY MODEL & FOUNDATION DOMAIN TYPES
 * This defines the strict separation of roles, ownership, and management.
 */

// 1. Roles & Authority Enums
export enum UserRole {
  PROPERTY_OWNER = 'PROPERTY_OWNER',
  COMPANY = 'COMPANY',
  COMPANY_MEMBER = 'COMPANY_MEMBER',
  TENANT = 'TENANT',
  BUYER = 'BUYER',
  AGENT_BROKER = 'AGENT_BROKER',
  VENDOR = 'VENDOR',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
}

export enum CompanyRole {
  COMPANY_OWNER = 'COMPANY_OWNER',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  PROPERTY_MANAGER = 'PROPERTY_MANAGER',
  AGENT = 'AGENT',
  ACCOUNTANT = 'ACCOUNTANT',
  MAINTENANCE_MANAGER = 'MAINTENANCE_MANAGER',
  VIEWER = 'VIEWER',
}

export enum AuthorityStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  TERMINATED = 'TERMINATED',
}

export enum PropertyType {
  RESIDENTIAL_APARTMENT = 'RESIDENTIAL_APARTMENT',
  RESIDENTIAL_VILLA = 'RESIDENTIAL_VILLA',
  COMMERCIAL_OFFICE = 'COMMERCIAL_OFFICE',
  COMMERCIAL_SHOP = 'COMMERCIAL_SHOP',
  INDUSTRIAL_WAREHOUSE = 'INDUSTRIAL_WAREHOUSE',
  LAND = 'LAND',
  BUILDING = 'BUILDING',
}

export enum PropertyVerificationStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED'
}

export enum PropertyOperationalStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  AVAILABLE = 'AVAILABLE',
  LISTED_FOR_RENT = 'LISTED_FOR_RENT',
  LISTED_FOR_SALE = 'LISTED_FOR_SALE',
  OCCUPIED = 'OCCUPIED',
  UNDER_MANAGEMENT = 'UNDER_MANAGEMENT',
  MAINTENANCE = 'MAINTENANCE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED'
}

export enum TenantStatus {
  PROSPECT = 'PROSPECT',
  APPLICANT = 'APPLICANT',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  NOTICE_GIVEN = 'NOTICE_GIVEN',
  MOVED_OUT = 'MOVED_OUT',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED'
}

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  MORE_INFORMATION_REQUIRED = 'MORE_INFORMATION_REQUIRED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  EXPIRED = 'EXPIRED',
  CONVERTED_TO_LEASE = 'CONVERTED_TO_LEASE'
}

export enum LeaseStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  CANCELLED = 'CANCELLED'
}

export enum RentStatus {
  UPCOMING = 'UPCOMING',
  DUE = 'DUE',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  WAIVED = 'WAIVED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  RECORDED = 'RECORDED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum ListingType {
  FOR_RENT = 'FOR_RENT',
  FOR_SALE = 'FOR_SALE',
  RENT_TO_OWN = 'RENT_TO_OWN',
  OTHER = 'OTHER'
}

export enum ListingStatus {
  DRAFT = 'DRAFT',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
  PAUSED = 'PAUSED',
  UNDER_OFFER = 'UNDER_OFFER',
  SOLD = 'SOLD',
  RENTED = 'RENTED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}



export enum ViewingStatus {
  REQUESTED = 'REQUESTED',
  REVIEW = 'REVIEW',
  CONFIRMED = 'CONFIRMED',
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW'
}

export enum OfferStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  COUNTERED = 'COUNTERED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED'
}

export enum SalesContractStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  SIGNED = 'SIGNED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED'
}

export enum SalesTransactionStatus {
  INITIATED = 'INITIATED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  CONTRACT_PENDING = 'CONTRACT_PENDING',
  CONTRACTED = 'CONTRACTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  SETTLEMENT_PENDING = 'SETTLEMENT_PENDING',
  READY_FOR_CLOSING = 'READY_FOR_CLOSING',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED'
}

export enum Permission {
  VIEW_PROPERTY = 'VIEW_PROPERTY',
  EDIT_PROPERTY = 'EDIT_PROPERTY',
  VIEW_OWNERSHIP = 'VIEW_OWNERSHIP',
  EDIT_OWNERSHIP = 'EDIT_OWNERSHIP',
  VIEW_DOCUMENTS = 'VIEW_DOCUMENTS',
  MANAGE_DOCUMENTS = 'MANAGE_DOCUMENTS',
  CREATE_LISTING = 'CREATE_LISTING',
  EDIT_LISTING = 'EDIT_LISTING',
  PUBLISH_LISTING = 'PUBLISH_LISTING',
  MANAGE_TENANTS = 'MANAGE_TENANTS',
  VIEW_MAINTENANCE = 'VIEW_MAINTENANCE',
  CREATE_MAINTENANCE = 'CREATE_MAINTENANCE',
  EDIT_MAINTENANCE = 'EDIT_MAINTENANCE',
  DELETE_MAINTENANCE = 'DELETE_MAINTENANCE',
  MANAGE_VIEWINGS = 'MANAGE_VIEWINGS',
  MANAGE_APPLICATIONS = 'MANAGE_APPLICATIONS',
  MANAGE_OFFERS = 'MANAGE_OFFERS',
  MANAGE_LEASES = 'MANAGE_LEASES',
  MANAGE_MAINTENANCE = 'MANAGE_MAINTENANCE',
  MANAGE_VENDORS = 'MANAGE_VENDORS',
  VIEW_FINANCIALS = 'VIEW_FINANCIALS',
  MANAGE_FINANCIALS = 'MANAGE_FINANCIALS',
  COLLECT_RENT = 'COLLECT_RENT',
  MANAGE_EXPENSES = 'MANAGE_EXPENSES',
  REQUEST_APPROVAL = 'REQUEST_APPROVAL',
  APPROVE_ACTION = 'APPROVE_ACTION',
  MANAGE_TEAM = 'MANAGE_TEAM',
  MANAGE_AUTOMATION = 'MANAGE_AUTOMATION',
  PERFORM_AUTONOMOUS_ACTIONS = 'PERFORM_AUTONOMOUS_ACTIONS',
}

// 2. Base Entities
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface User extends BaseEntity {
  email: string;
  phone?: string;
  roles: UserRole[]; // Users can have multiple roles (e.g. Owner AND Buyer)
  profileId: string;
  isActive: boolean;
}

export interface Organization extends BaseEntity {
  name: string;
  verified: boolean;
  type: UserRole.COMPANY | UserRole.VENDOR;
  adminUserId: string;
}

export interface CompanyMember extends BaseEntity {
  userId: string;
  companyId: string;
  companyRole: CompanyRole;
  isActive: boolean;
}

// 3. Property & Legal Entities
export interface Property extends BaseEntity {
  name: string;
  internalReferenceNumber?: string;
  type: PropertyType;
  address: Address;
  isActive: boolean;
  
  verificationStatus: PropertyVerificationStatus;
  operationalStatus: PropertyOperationalStatus;
  
  attributes: {
    sizeSqm?: number;
    bedrooms?: number;
    bathrooms?: number;
    parkingSpaces?: number;
    constructionYear?: number;
    condition?: string;
    amenities: string[];
    features: string[];
  };

  mediaIds: string[];
}

// Explicit Ownership Model: Owner != Manager
export interface OwnershipRecord extends BaseEntity {
  propertyId: string;
  ownerId: string; // The User ID of the owner
  sharePercentage: number;
  status: 'VERIFIED' | 'PENDING' | 'DISPUTED';
  documents: string[]; // Document IDs for proof of ownership
}

export interface Unit extends BaseEntity {
  propertyId: string;
  unitNumber: string;
  floor: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
  operationalStatus: PropertyOperationalStatus;
  attributes: {
    sizeSqm?: number;
    bedrooms?: number;
    bathrooms?: number;
  };
}

export interface Address {
  street: string;
  city: string;
  district?: string;
  state: string;
  country: string;
  postalCode: string;
  coordinates?: { lat: number; lng: number };
}

export enum DocumentCategory {
  OWNERSHIP_TITLE = 'OWNERSHIP_TITLE',
  PROPERTY_REGISTRATION = 'PROPERTY_REGISTRATION',
  IDENTIFICATION = 'IDENTIFICATION',
  LEASE = 'LEASE',
  MANAGEMENT_AGREEMENT = 'MANAGEMENT_AGREEMENT',
  MAINTENANCE = 'MAINTENANCE',
  INSPECTION = 'INSPECTION',
  INVOICE = 'INVOICE',
  OTHER = 'OTHER'
}

export interface PropertyDocument extends BaseEntity {
  propertyId: string;
  unitId?: string;
  uploadedByUserId: string;
  category: DocumentCategory;
  fileName: string;
  fileUrl: string;
  visibilityClass: 'PUBLIC' | 'PRIVATE_OWNER' | 'PRIVATE_COMPANY' | 'RESTRICTED';
  verificationStatus?: PropertyVerificationStatus;
}

export interface PropertyTask extends BaseEntity {
  propertyId: string;
  unitId?: string;
  title: string;
  description: string;
  creatorUserId: string;
  assigneeUserId?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string;
  attachmentIds: string[];
}



// 4. CRITICAL: Management Agreement (Separation of Ownership & Management)
export interface ManagementAgreement extends BaseEntity {
  ownerId: string;
  companyId: string;
  propertyId: string;
  status: AuthorityStatus;
  startDate: string;
  endDate?: string;
  
  // Explicit Authority Grants (Fail-Closed Architecture)
  grantedPermissions: Permission[];
  
  spendingLimits: {
    maxMaintenanceExpensePerOccurrence: number;
    currency: string;
  };
  
  approvalRules: {
    requiresOwnerApprovalForLeases: boolean;
    requiresOwnerApprovalForMaintenanceOverLimit: boolean;
  };
  
  autonomousActionAuthority: {
    aiCanNegotiateLease: boolean;
    aiCanApproveMaintenance: boolean;
  };
  
  createdByUserId: string;
  auditTrailId: string;
}

// 5. Workflows & Transactions
export interface Approval extends BaseEntity {
  requestingUserId: string;
  approverUserId?: string;
  propertyId: string;
  organizationId?: string;
  action: string;
  amount?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  decisionTimestamp?: string;
  auditId: string;
}

export interface RentalApplication extends BaseEntity {
  propertyId: string;
  unitId?: string;
  applicantUserId: string;
  status: ApplicationStatus;
  submittedInformation: Record<string, any>;
  documentIds: string[];
  reviewerUserId?: string;
  reviewNotes?: string;
}

export type DepositReconciliationStatus = 'NOT_APPLICABLE' | 'NOT_EVALUATED' | 'UNRESOLVED' | 'RECONCILED';

export interface Lease extends BaseEntity {
  propertyId: string;
  unitId?: string;
  ownerId: string;
  managementCompanyId?: string;
  tenantId: string; // The User ID of the tenant
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  rentAmount: number;
  currency: string;
  paymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  securityDepositAmount: number;
  gracePeriodDays: number;
  contractDocumentId?: string;
  noticePeriodDays: number;
  depositReconciliationStatus?: DepositReconciliationStatus;
}

export interface OccupancyRecord extends BaseEntity {
  propertyId: string;
  unitId?: string;
  tenantId: string;
  leaseId: string;
  startDate: string;
  endDate?: string;
  status: 'ACTIVE' | 'CONCLUDED';
}

export interface RentObligation extends BaseEntity {
  leaseId: string;
  tenantId: string;
  propertyId: string;
  unitId?: string;
  amount: number;
  currency: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  status: RentStatus;
  amountPaid: number;
  remainingAmount: number;
}

export interface PaymentRecord extends BaseEntity {
  rentObligationId?: string; // Optional if paying deposit or other fees
  tenantId: string;
  propertyId: string;
  unitId?: string;
  ownerId: string;
  managementCompanyId?: string;
  amount: number;
  currency: string;
  paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE' | 'CREDIT_CARD';
  status: PaymentStatus;
  recordedByUserId: string;
  paymentDate: string;
  receiptId?: string;
  notes?: string;
}

export interface Receipt extends BaseEntity {
  paymentRecordId: string;
  receiptNumber: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  currency: string;
  paymentDate: string;
  issuedByUserId: string;
}

export interface SecurityDeposit extends BaseEntity {
  leaseId: string;
  tenantId: string;
  propertyId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'HELD' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'FORFEITED';
  deductions: { amount: number; reason: string }[];
}

export type MoveOutInspectionStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MoveOutInspectionItemCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'MISSING' | 'DIRTY';
export type DepositDeductionCategory = 'DAMAGE' | 'CLEANING' | 'KEY_REPLACEMENT' | 'UNPAID_UTILITIES' | 'OTHER';
export type DepositDeductionStatus = 'PROPOSED' | 'OWNER_APPROVED' | 'REJECTED' | 'DISPUTED' | 'SETTLED' | 'CANCELLED';

export interface LeaseMoveOutInspection extends BaseEntity {
  leaseId: string;
  moveOutRequestId?: string | null;
  propertyId: string;
  inspectorId: string;
  status: MoveOutInspectionStatus;
  hasMoveInBaseline: boolean;
  moveInBaselineReference?: string | null;
  generalNotes?: string | null;
  tenantPresent: boolean;
  tenantSignatureRef?: string | null;
  metadata?: Record<string, any> | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaseMoveOutInspectionItem extends BaseEntity {
  inspectionId: string;
  area: string;
  component: string;
  condition: MoveOutInspectionItemCondition;
  damageDescription?: string | null;
  isTenantCaused: boolean;
  estimatedRepairCost: number;
  currency: string;
  evidenceRefs?: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface SecurityDepositDeduction extends BaseEntity {
  depositId: string;
  leaseId: string;
  inspectionItemId?: string | null;
  amount: number;
  currency: string;
  category: DepositDeductionCategory;
  description: string;
  evidenceRefs?: string[] | null;
  proposedById: string;
  proposedAt: string;
  status: DepositDeductionStatus;
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  disputedAt?: string | null;
  disputeReason?: string | null;
  disputeDeadline?: string | null;
  tenantNotifiedAt?: string | null;
  noticeNotificationId?: string | null;
  noticeDeliveryId?: string | null;
  noticeDeliveryStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 9. Maintenance, Vendor & Property Operations Domain
export enum MaintenanceCategory {
  PLUMBING = 'PLUMBING',
  ELECTRICAL = 'ELECTRICAL',
  HVAC = 'HVAC',
  STRUCTURAL = 'STRUCTURAL',
  APPLIANCE = 'APPLIANCE',
  CLEANING = 'CLEANING',
  SECURITY = 'SECURITY',
  LANDSCAPING = 'LANDSCAPING',
  PEST_CONTROL = 'PEST_CONTROL',
  GENERAL_REPAIR = 'GENERAL_REPAIR',
  OTHER = 'OTHER'
}

export enum MaintenanceStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  TRIAGED = 'TRIAGED',
  ASSIGNED = 'ASSIGNED',
  QUOTE_REQUIRED = 'QUOTE_REQUIRED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  INSPECTION_REQUIRED = 'INSPECTION_REQUIRED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED'
}

export enum MaintenancePriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum VendorStatus {
  DRAFT = 'DRAFT',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REJECTED = 'REJECTED',
  ARCHIVED = 'ARCHIVED'
}

export enum QuoteStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WITHDRAWN = 'WITHDRAWN'
}

export enum WorkOrderStatus {
  DRAFT = 'DRAFT',
  APPROVED = 'APPROVED',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  CLOSED = 'CLOSED'
}

export interface MaintenanceRequest extends BaseEntity {
  propertyId: string;
  unitId?: string;
  reportedByUserId: string;
  assignedVendorId?: string;
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string;
  documentIds: string[];
}

export interface Vendor extends BaseEntity {
  organizationId: string; // The company or individual
  name: string;
  status: VendorStatus;
  categories: MaintenanceCategory[];
  coverageAreaIds: string[]; // e.g. District IDs
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED';
}

export interface MaintenanceQuote extends BaseEntity {
  maintenanceRequestId: string;
  vendorId: string;
  propertyId: string;
  unitId?: string;
  totalAmount: number;
  laborAmount: number;
  materialsAmount: number;
  currency: string;
  validUntil: string;
  status: QuoteStatus;
  notes?: string;
  documentIds: string[];
}

export interface WorkOrder extends BaseEntity {
  maintenanceRequestId: string;
  quoteId?: string; // If applicable
  vendorId: string;
  propertyId: string;
  unitId?: string;
  status: WorkOrderStatus;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  scopeOfWork: string;
  assignedTechnicianIds: string[];
}

export interface PreventiveMaintenancePlan extends BaseEntity {
  propertyId: string;
  assetId?: string; // e.g., HVAC unit
  category: MaintenanceCategory;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'BIANNUALLY' | 'YEARLY';
  nextDueDate: string;
  assignedVendorId?: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
}

// 6. Security & AI Audit
export interface AuditLog {
  id: string;
  timestamp: string;
  actorUserId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress?: string | string[];
}

export interface AIAction extends BaseEntity {
  recommendationId: string;
  proposedAction: string;
  authorityCheckPassed: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  approvedByUserId?: string; // Required for High/Critical
  executionStatus: 'PENDING' | 'EXECUTED' | 'FAILED' | 'REJECTED';
}

// 8. Financial & Accounting Domain
export enum AccountCategory {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  REVERSED = 'REVERSED'
}

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  POSTED = 'POSTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID'
}

export enum FinancialPeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export interface FinancialAccount extends BaseEntity {
  name: string;
  code: string;
  category: AccountCategory;
  currency: string;
  organizationId?: string;
  propertyId?: string; // Optional if account is property-specific
  currentBalance: number;
}

export interface JournalEntry extends BaseEntity {
  reference: string;
  description: string;
  status: JournalEntryStatus;
  postingDate: string;
  financialPeriodId: string;
  organizationId: string;
  propertyId?: string;
  sourceTransactionId?: string; // Link to Invoice, Payment, etc.
}

export interface JournalLine extends BaseEntity {
  journalEntryId: string;
  accountId: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  currency: string;
  propertyId?: string;
  unitId?: string;
}

export interface Expense extends BaseEntity {
  propertyId: string;
  unitId?: string;
  vendorId?: string;
  ownerId?: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  status: ExpenseStatus;
  invoiceReference?: string;
  documentIds: string[];
  approvedByUserId?: string;
}

export interface Invoice extends BaseEntity {
  issuerOrganizationId: string; // The entity issuing the invoice
  recipientId: string; // The tenant, buyer, owner, etc.
  propertyId?: string;
  unitId?: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: InvoiceStatus;
  documentIds: string[];
  relatedTransactionId?: string; // e.g. RentObligationId or SalesTransactionId
}

export interface Commission extends BaseEntity {
  sourceTransactionId: string;
  beneficiaryId: string; // Agent, Company, or Platform
  ruleReference: string;
  amount: number;
  currency: string;
  status: 'CALCULATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAYABLE' | 'PAID' | 'CANCELLED' | 'REVERSED';
  approvedByUserId?: string;
}

export interface FinancialPeriod extends BaseEntity {
  startDate: string;
  endDate: string;
  organizationId: string;
  status: FinancialPeriodStatus;
  closedByUserId?: string;
  closedDate?: string;
}


export interface Inquiry extends BaseEntity {
  listingId: string;
  propertyId: string;
  buyerOrTenantUserId: string;
  inquiryType: string;
  message: string;
  status: LeadStatus;
  assignedAgentUserId?: string;
}

export interface Viewing extends BaseEntity {
  inquiryId?: string;
  listingId: string;
  propertyId: string;
  buyerOrTenantUserId: string;
  agentUserId?: string;
  scheduledAt: string;
  locationInstructions?: string;
  status: ViewingStatus;
}

export interface Offer extends BaseEntity {
  listingId: string;
  propertyId: string;
  buyerUserId: string;
  sellerId: string; // the owner
  offerAmount: number;
  currency: string;
  proposedTerms: string;
  expirationDate: string;
  status: OfferStatus;
}

export interface SalesContract extends BaseEntity {
  propertyId: string;
  offerId: string;
  buyerUserId: string;
  sellerUserId: string;
  agreedPrice: number;
  currency: string;
  terms: string;
  status: SalesContractStatus;
  documentIds: string[];
}

export interface SalesTransaction extends BaseEntity {
  contractId: string;
  propertyId: string;
  buyerUserId: string;
  sellerUserId: string;
  transactionAmount: number;
  currency: string;
  status: SalesTransactionStatus;
  settlementDate?: string;
}

// 10. Property Intelligence, Portfolio & Investment Analytics Domain
export enum PropertyHealthStatus {
  HEALTHY = 'HEALTHY',
  ATTENTION_REQUIRED = 'ATTENTION_REQUIRED',
  AT_RISK = 'AT_RISK',
  CRITICAL = 'CRITICAL',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA'
}

export enum AIRecommendationStatus {
  NEW = 'NEW',
  VIEWED = 'VIEWED',
  ACCEPTED = 'ACCEPTED',
  DISMISSED = 'DISMISSED',
  EXPIRED = 'EXPIRED'
}

export interface Portfolio extends BaseEntity {
  ownerUserId: string;
  name: string;
  currency: string;
  description?: string;
}

export interface PortfolioProperty extends BaseEntity {
  portfolioId: string;
  propertyId: string;
  acquisitionDate?: string;
  acquisitionPrice?: number;
}

export interface PropertyValuation extends BaseEntity {
  propertyId: string;
  valuationDate: string;
  estimatedValue: number;
  currency: string;
  method: 'MANUAL' | 'PROFESSIONAL' | 'EXTERNAL' | 'PLATFORM_MODEL' | 'UNVERIFIED';
  source: string;
  confidenceIndicator: 'LOW' | 'MEDIUM' | 'HIGH';
  reviewerUserId?: string;
  documentIds?: string[];
  status: 'DRAFT' | 'FINAL';
}

export interface AIRecommendation extends BaseEntity {
  propertyId?: string;
  portfolioId?: string;
  recommendationType: 'MAINTENANCE' | 'FINANCIAL' | 'LEASING' | 'PORTFOLIO_OPTIMIZATION' | 'RISK';
  explanation: string;
  supportingMetrics: Record<string, any>;
  dataSources: string[];
  confidenceIndicator: 'LOW' | 'MEDIUM' | 'HIGH';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: AIRecommendationStatus;
  userResponseDate?: string;
  proposedAction?: string;
}

export interface PortfolioGoal extends BaseEntity {
  portfolioId: string;
  goalType: 'TARGET_OCCUPANCY' | 'TARGET_INCOME' | 'EXPENSE_LIMIT' | 'YIELD_TARGET' | 'GROWTH';
  targetValue: number;
  currency?: string;
  deadlineDate?: string;
  status: 'ACTIVE' | 'ACHIEVED' | 'MISSED' | 'CANCELLED';
}

export interface PortfolioAlert extends BaseEntity {
  portfolioId?: string;
  propertyId?: string;
  alertType: 'LEASE_EXPIRING' | 'RENT_OVERDUE' | 'HIGH_VACANCY' | 'MAINTENANCE_OVERDUE' | 'EXPENSE_THRESHOLD';
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED' | 'DISMISSED';
}

// 12. Trust, Verification, Risk, Compliance & Dispute Domain
export enum VerificationStatus {
  NOT_STARTED = 'NOT_STARTED',
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  MORE_INFORMATION_REQUIRED = 'MORE_INFORMATION_REQUIRED',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED'
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  LIMITED = 'LIMITED',
  SUSPENDED = 'SUSPENDED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  BANNED = 'BANNED',
  DEACTIVATED = 'DEACTIVATED'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN'
}

export enum DisputeStatus {
  OPENED = 'OPENED',
  TRIAGED = 'TRIAGED',
  EVIDENCE_REQUESTED = 'EVIDENCE_REQUESTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  DECISION_PENDING = 'DECISION_PENDING',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
  CANCELLED = 'CANCELLED',
  APPEALED = 'APPEALED',
  CLOSED = 'CLOSED'
}

export interface VerificationCase extends BaseEntity {
  subjectType: 'USER' | 'OWNER' | 'COMPANY' | 'AGENT' | 'VENDOR' | 'PROPERTY' | 'DOCUMENT' | 'LISTING';
  subjectId: string;
  verificationType: string;
  status: VerificationStatus;
  evidenceDocumentIds: string[];
  reviewerUserId?: string;
  expiryDate?: string;
  rejectionReason?: string;
}

export interface RiskSignal extends BaseEntity {
  targetType: 'USER' | 'COMPANY' | 'PROPERTY' | 'LISTING' | 'TRANSACTION' | 'PAYMENT' | 'DOCUMENT';
  targetId: string;
  signalType: string; // e.g. 'MULTIPLE_FAILED_LOGINS', 'EXPENSE_ANOMALY'
  description: string;
  riskLevel: RiskLevel;
  source: 'SYSTEM' | 'AI' | 'USER_REPORT';
  status: 'ACTIVE' | 'REVIEWED' | 'DISMISSED';
}

export interface Dispute extends BaseEntity {
  relatedTransactionId?: string; // e.g. LeaseId, PaymentId, WorkOrderId
  initiatorUserId: string;
  respondentUserId?: string;
  category: string;
  description: string;
  evidenceDocumentIds: string[];
  status: DisputeStatus;
  assignedReviewerId?: string;
  resolutionNotes?: string;
}

// 13. Communications, Notifications, CRM & Relationship Management Domain
export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  CLOSED = 'CLOSED',
  RESTRICTED = 'RESTRICTED'
}

export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  AUTOMATED_NOTIFICATION = 'AUTOMATED_NOTIFICATION',
  AI_DRAFT = 'AI_DRAFT'
}



export interface Conversation extends BaseEntity {
  contextType: 'PROPERTY' | 'RENTAL' | 'LEASE' | 'MAINTENANCE' | 'LISTING' | 'LEAD' | 'VIEWING' | 'OFFER' | 'CONTRACT' | 'TRANSACTION' | 'DISPUTE' | 'GENERAL_SUPPORT';
  contextId?: string; // ID of the specific resource
  status: ConversationStatus;
  title?: string;
}

export interface ConversationParticipant extends BaseEntity {
  conversationId: string;
  userId: string;
  role: 'OWNER' | 'COMPANY' | 'AGENT' | 'TENANT' | 'BUYER' | 'VENDOR' | 'ADMIN';
  joinedAt: string;
}

export interface Message extends BaseEntity {
  conversationId: string;
  senderUserId?: string; // Optional for system/AI messages
  content: string;
  messageType: MessageType;
  attachmentDocumentIds?: string[];
  replyToMessageId?: string;
  isRead: boolean;
}

export interface Contact extends BaseEntity {
  ownerUserId?: string; // User who owns this CRM record (Agent, Company)
  companyId?: string;
  contactUserId?: string; // If the contact is a registered user
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  contactType: 'BUYER' | 'TENANT' | 'OWNER' | 'VENDOR' | 'AGENT' | 'COMPANY' | 'PROSPECT';
  notes?: string;
}

export interface Lead extends BaseEntity {
  contactId: string;
  assignedToUserId?: string;
  companyId?: string;
  listingId?: string;
  propertyId?: string;
  status: LeadStatus;
  source: string;
  notes?: string;
}

export interface FollowUp extends BaseEntity {
  leadId?: string;
  contactId?: string;
  assignedUserId: string;
  dueDate: string;
  title: string;
  notes?: string;
  status: 'PENDING' | 'DUE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
}

export interface Notification extends BaseEntity {
  userId: string;
  type: string;
  title: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'CREATED' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  relatedResourceId?: string;
  relatedResourceType?: string;
}

// 14. Documents, Contracts, E-Signature, Property Passport Domain

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  ARCHIVED = 'ARCHIVED',
  REVOKED = 'REVOKED',
  DELETED = 'DELETED'
}

export enum ContractStatus {
  DRAFT = 'DRAFT',
  UNDER_REVIEW = 'UNDER_REVIEW',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  PENDING_SIGNATURE = 'PENDING_SIGNATURE',
  PARTIALLY_SIGNED = 'PARTIALLY_SIGNED',
  SIGNED = 'SIGNED',
  ACTIVE = 'ACTIVE',
  EXPIRING = 'EXPIRING',
  EXPIRED = 'EXPIRED',
  TERMINATED = 'TERMINATED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED'
}

export interface Document extends BaseEntity {
  uploadedByUserId: string;
  propertyId?: string;
  category: 'PROPERTY_DOCUMENT' | 'OWNERSHIP_DOCUMENT' | 'IDENTITY_DOCUMENT' | 'MANAGEMENT_AGREEMENT' | 'LISTING_DOCUMENT' | 'LEASE_DOCUMENT' | 'CONTRACT' | 'INVOICE' | 'RECEIPT' | 'MAINTENANCE_DOCUMENT' | 'INSPECTION_REPORT' | 'WARRANTY' | 'OTHER';
  documentType: string;
  title: string;
  description?: string;
  fileReference: string; // secure storage key/path
  mimeType: string;
  sizeBytes: number;
  currentVersion: number;
  status: DocumentStatus;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
}

export interface DocumentVersion extends BaseEntity {
  documentId: string;
  versionNumber: number;
  uploadedByUserId: string;
  fileReference: string;
  changeReason?: string;
  hashChecksum?: string;
}

export interface DocumentShare extends BaseEntity {
  documentId: string;
  sharedByUserId: string;
  sharedWithUserId?: string;
  sharedWithCompanyId?: string;
  permissionLevel: 'VIEW' | 'DOWNLOAD';
  purpose?: string;
  expiresAt?: string;
  revokedAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

export interface Contract extends BaseEntity {
  title: string;
  contextType: 'MANAGEMENT_AGREEMENT' | 'LEASE' | 'SALES_AGREEMENT' | 'VENDOR_AGREEMENT' | 'OTHER';
  propertyId?: string;
  status: ContractStatus;
  currentVersion: number;
  createdByUserId: string;
  effectiveDate?: string;
  expiryDate?: string;
}

export interface ContractParty extends BaseEntity {
  contractId: string;
  partyType: 'OWNER' | 'COMPANY' | 'TENANT' | 'BUYER' | 'VENDOR' | 'OTHER';
  userId?: string;
  companyId?: string;
  signatureState: 'NOT_STARTED' | 'REQUESTED' | 'VIEWED' | 'SIGNED' | 'DECLINED';
  signedAt?: string;
}



// 16. Intelligence, Optimization & AI Recommendations

export enum IntelligenceDataType {
  OBSERVED_FACT = 'OBSERVED_FACT',
  CALCULATED_METRIC = 'CALCULATED_METRIC',
  ESTIMATE = 'ESTIMATE',
  FORECAST = 'FORECAST',
  AI_INTERPRETATION = 'AI_INTERPRETATION',
  RECOMMENDATION = 'RECOMMENDATION',
  SIMULATION = 'SIMULATION'
}

export interface SearchPreference extends BaseEntity {
  userId: string;
  targetLocations: string[];
  minPrice?: number;
  maxPrice?: number;
  propertyTypes: string[];
  minBedrooms?: number;
  minBathrooms?: number;
  intent: 'BUY' | 'RENT' | 'INVEST';
}

export interface MatchResult extends BaseEntity {
  propertyId: string;
  userId: string;
  matchScore: number; // 0-100
  matchedFactors: string[];
  unmetPreferences: string[];
  explanation: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ListingQualityAssessment extends BaseEntity {
  listingId: string;
  score: number; // 0-100
  status: 'COMPLETE' | 'NEEDS_IMPROVEMENT' | 'INSUFFICIENT_DATA';
  missingElements: string[];
  recommendations: string[];
}

export interface PricingAnalysis extends BaseEntity {
  propertyId: string;
  listingId?: string;
  currentPrice?: number;
  estimatedRangeMin?: number;
  estimatedRangeMax?: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT_DATA';
  comparableCount: number;
  method: string;
  currency: string;
}

export interface VacancyRiskAssessment extends BaseEntity {
  propertyId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  factors: string[];
  daysVacant: number;
}

export interface Recommendation extends BaseEntity {
  targetUserId: string;
  targetPropertyId?: string;
  type: 'PRICING' | 'MAINTENANCE' | 'LISTING_QUALITY' | 'LEAD_FOLLOWUP' | 'VACANCY_REDUCTION' | 'RENEWAL' | 'PORTFOLIO_OPTIMIZATION';
  title: string;
  description: string;
  evidence: string[];
  status: 'GENERATED' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED' | 'DISMISSED' | 'EXPIRED' | 'EXECUTED' | 'FAILED';
  actionData?: Record<string, any>; // Used if recommendation leads to a Controlled Optimization Action
}

export interface DataQualityIssue extends BaseEntity {
  entityType: 'Property' | 'Listing' | 'Lease' | 'User' | 'Company';
  entityId: string;
  issueType: 'MISSING_DATA' | 'STALE_DATA' | 'INCONSISTENCY' | 'POSSIBLE_DUPLICATE';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolved: boolean;
}
export interface PropertyPassport {
  property: Property;
  ownership: OwnershipRecord[];
  activeManagement?: ManagementAuthorization;
  timeline: PropertyTimelineEvent[];
  documents: Document[];
  contracts: Contract[];
  activeLeases: Lease[];
  verificationStatus: string;
}

// 15. Platform Admin, Governance, Security & Audit Core

export enum AdminRoleType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  PLATFORM_ADMIN = 'PLATFORM_ADMIN',
  OPERATIONS_ADMIN = 'OPERATIONS_ADMIN',
  PROPERTY_ADMIN = 'PROPERTY_ADMIN',
  MARKETPLACE_ADMIN = 'MARKETPLACE_ADMIN',
  VERIFICATION_ADMIN = 'VERIFICATION_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  COMPLIANCE_ADMIN = 'COMPLIANCE_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
  SECURITY_ADMIN = 'SECURITY_ADMIN',
  AI_GOVERNANCE_ADMIN = 'AI_GOVERNANCE_ADMIN',
  AUDITOR = 'AUDITOR',
  READ_ONLY_ADMIN = 'READ_ONLY_ADMIN'
}

export enum SecuritySeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface PlatformPolicy extends BaseEntity {
  name: string;
  type: 'ACCESS_POLICY' | 'APPROVAL_POLICY' | 'FINANCIAL_POLICY' | 'LISTING_POLICY' | 'VERIFICATION_POLICY' | 'DOCUMENT_POLICY' | 'CONTRACT_POLICY' | 'MAINTENANCE_POLICY' | 'NOTIFICATION_POLICY' | 'AI_POLICY' | 'AUTOMATION_POLICY' | 'RISK_POLICY' | 'PRIVACY_POLICY' | 'RETENTION_POLICY' | 'SECURITY_POLICY' | 'COMMISSION_POLICY';
  description: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  version: number;
  configuration: Record<string, any>;
  effectiveDate?: string;
  createdByUserId: string;
}

export interface FeatureFlag extends BaseEntity {
  key: string;
  name: string;
  description: string;
  type: 'GLOBAL' | 'ROLE_BASED' | 'ORGANIZATION_BASED' | 'ENVIRONMENT_BASED' | 'PERCENTAGE_ROLLOUT';
  isEnabled: boolean;
  configuration?: Record<string, any>;
  updatedByUserId: string;
}

export interface SystemSetting extends BaseEntity {
  category: 'GENERAL' | 'LOCALIZATION' | 'SECURITY' | 'FINANCE' | 'AI' | 'MARKETPLACE' | 'COMPLIANCE' | 'INTEGRATIONS';
  key: string;
  value: any;
  type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  description?: string;
  updatedByUserId: string;
}

export interface SecurityEvent extends BaseEntity {
  eventType: 'FAILED_LOGIN' | 'SUSPICIOUS_ACCESS' | 'PERMISSION_CHANGED' | 'ROLE_CHANGED' | 'DOCUMENT_ACCESSED' | 'SENSITIVE_DATA_ACCESSED' | 'UNUSUAL_ADMIN_ACTION' | 'AI_SECURITY_EVENT' | 'AUTHORIZATION_FAILURE' | 'OTHER';
  severity: SecuritySeverity;
  actorUserId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedByUserId?: string;
}

export interface Integration extends BaseEntity {
  providerName: string;
  capability: 'PAYMENT' | 'SMS' | 'EMAIL' | 'MAPS' | 'ESIGNATURE' | 'STORAGE' | 'OCR' | 'IDENTITY' | 'ANALYTICS';
  status: 'ACTIVE' | 'DISABLED' | 'ERROR' | 'NOT_CONFIGURED';
  health: 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
  lastSyncAt?: string;
  configurationRef?: string;
}

export interface IntegrationWebhookEvent extends BaseEntity {
  integrationId: string;
  providerName: string;
  eventType: string;
  providerEventId: string;
  signatureValid: boolean;
  processingStatus: 'RECEIVED' | 'VALIDATING' | 'VALID' | 'INVALID' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
  payloadRef?: string; // Reference to secure storage of the payload, never raw sensitive data in db
  retryCount: number;
  processedAt?: string;
  failureReason?: string;
  relatedResourceId?: string;
}

export interface IntegrationUsage extends BaseEntity {
  integrationId: string;
  capability: string;
  operation: string;
  organizationId?: string;
  userId?: string;
  requestCount: number;
  estimatedCostUsd?: number;
  periodStart: string;
  periodEnd: string;
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  VIEWING_REQUESTED = 'VIEWING_REQUESTED',
  NEGOTIATING = 'NEGOTIATING',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
  CLOSED = 'CLOSED'
}

export interface PropertyTimelineEvent extends BaseEntity {
  propertyId: string;
  actorUserId: string;
  actorRole: string;
  eventType: string; // e.g., 'STATUS_CHANGED', 'DOCUMENT_UPLOADED'
  description: string;
  metadata?: Record<string, any>;
}

export interface ManagementAuthorization extends BaseEntity {
  propertyId: string;
  companyId: string;
  authorizedByUserId: string; // The owner who authorized this
  permissions: Permission[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'PENDING';
  effectiveDate: string;
  expirationDate?: string;
  spendingLimit?: {
    amount: number;
    currency: string;
    period: 'PER_INCIDENT' | 'MONTHLY' | 'YEARLY';
  };
  approvalRequirements?: {
    requireOwnerApprovalAbove?: number;
    requireApprovalForCategories?: MaintenanceCategory[];
  };
}

export * from './buyer.js';
export * from './agent.js';
export * from './vendor.js';
export * from './analytics.js';
export * from './trust-verification.js';
export * from './communications-crm.js';

