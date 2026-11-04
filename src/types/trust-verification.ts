import { BaseEntity, UserRole } from './index.js';

// ============================================================================
// STAGE 10: TRUST / VERIFICATION / RISK / COMPLIANCE / DISPUTES
// ============================================================================

export type TrustSubjectType = 
  | 'USER' 
  | 'PROPERTY' 
  | 'COMPANY' 
  | 'AGENT' 
  | 'VENDOR' 
  | 'LISTING' 
  | 'LEASE' 
  | 'DOCUMENT';

export enum VerificationState {
  NOT_STARTED = 'NOT_STARTED',
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ADDITIONAL_INFORMATION_REQUIRED = 'ADDITIONAL_INFORMATION_REQUIRED',
  VERIFIED = 'VERIFIED',
  PARTIALLY_VERIFIED = 'PARTIALLY_VERIFIED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  SUSPENDED = 'SUSPENDED'
}

export type VerificationType =
  | 'IDENTITY_VERIFICATION'
  | 'PROPERTY_TAPU_DEED'
  | 'PROPERTY_ADDRESS_INSPECTION'
  | 'COMPANY_COMMERCIAL_REGISTRATION'
  | 'AGENT_BROKER_LICENSE'
  | 'VENDOR_BUSINESS_CREDENTIAL'
  | 'VENDOR_INSURANCE_CERTIFICATE'
  | 'LISTING_AUTHORITY_VERIFICATION'
  | 'LEASE_CONTRACT_VERIFICATION'
  | 'PAYMENT_BANK_ACCOUNT_VERIFICATION';

export type EvidenceType =
  | 'PASSPORT'
  | 'NATIONAL_ID'
  | 'RESIDENCY_CARD'
  | 'TAPU_DEED'
  | 'SURVEY_MAP'
  | 'COMMERCIAL_REGISTRATION'
  | 'TAX_COMPLIANCE_CERTIFICATE'
  | 'CHAMBER_OF_COMMERCE'
  | 'BROKER_LICENSE'
  | 'TRADE_LICENSE'
  | 'INSURANCE_POLICY'
  | 'LEASE_AGREEMENT'
  | 'BANK_STATEMENT'
  | 'UTILITY_BILL'
  | 'OTHER_EVIDENCE';

export enum EvidenceStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  SUSPECTED_TAMPERING = 'SUSPECTED_TAMPERING'
}

export interface VerificationEvidenceItem {
  id: string;
  verificationRecordId: string;
  evidenceType: EvidenceType;
  title: string;
  documentRef: string;
  checksumSha256: string;
  status: EvidenceStatus;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface VerificationRecordItem {
  id: string;
  subjectType: TrustSubjectType;
  subjectId: string;
  verificationType: VerificationType;
  status: VerificationState;
  organizationId?: string;
  propertyId?: string;
  ownerId?: string;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
  evidenceCount?: number;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// RISK ENGINE TYPES
// ----------------------------------------------------------------------------

export enum TrustRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export type RiskTargetType =
  | 'USER'
  | 'COMPANY'
  | 'PROPERTY'
  | 'LISTING'
  | 'TRANSACTION'
  | 'PAYMENT'
  | 'DOCUMENT';

export type RiskSignalType =
  | 'IDENTITY_VERIFICATION_FAILURE'
  | 'OWNERSHIP_INCONSISTENCY'
  | 'EXPIRED_CREDENTIALS'
  | 'SUSPICIOUS_LISTING_PATTERN'
  | 'REPEATED_DISPUTES'
  | 'PAYMENT_ANOMALY'
  | 'UNUSUAL_TRANSACTION_BEHAVIOR'
  | 'MANAGEMENT_AUTHORIZATION_ANOMALY'
  | 'VENDOR_CREDENTIAL_SUSPENDED'
  | 'VERIFICATION_REVERSAL'
  | 'DUPLICATE_IDENTITY_SUSPECTED'
  | 'INCONSISTENT_PROPERTY_INFO';

export interface RiskFactor {
  factor: string;
  weight: number;
  impactScore: number;
  reason: string;
  signalId?: string;
  evidenceRef?: string;
}

export interface RiskAssessmentItem {
  id: string;
  targetType: RiskTargetType;
  targetId: string;
  score: number; // 0 to 100
  level: TrustRiskLevel;
  factors: RiskFactor[];
  contributingSignalIds: string[];
  ruleVersion: string;
  calculatedAt: string;
  expiresAt?: string;
  status: 'CURRENT' | 'SUPERSEDED' | 'OVERRIDDEN';
  reviewedBy?: string;
  reviewNotes?: string;
  organizationId?: string;
  propertyId?: string;
}

export interface RiskSignalItem {
  id: string;
  targetType: RiskTargetType;
  targetId: string;
  signalType: RiskSignalType;
  riskLevel: TrustRiskLevel;
  numericScore: number;
  description: string;
  source: 'SYSTEM' | 'DETERMINISTIC_RULE' | 'USER_REPORT' | 'AI_ADVISORY';
  status: 'ACTIVE' | 'REVIEWED' | 'DISMISSED' | 'RESOLVED';
  evidenceRef?: string;
  organizationId?: string;
  propertyId?: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// COMPLIANCE TYPES
// ----------------------------------------------------------------------------

export type ComplianceCategory =
  | 'SYSTEM_POLICY'
  | 'CONFIGURED_BUSINESS_RULE'
  | 'EXTERNAL_LEGAL_REQUIREMENT'
  | 'ADVISORY_INFORMATION';

export enum ComplianceCaseStatus {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
  ESCALATED = 'ESCALATED',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED'
}

export enum ComplianceDecision {
  PENDING = 'PENDING',
  CLEAR = 'CLEAR',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  RESTRICTED = 'RESTRICTED',
  BLOCKED = 'BLOCKED'
}

export interface ComplianceRuleItem {
  id: string;
  code: string;
  name: string;
  category: ComplianceCategory;
  jurisdiction: string;
  severity: TrustRiskLevel;
  description: string;
  applicability: {
    entityTypes: TrustSubjectType[];
    conditions?: Record<string, any>;
  };
  requiredEvidenceTypes: EvidenceType[];
  active: boolean;
  effectiveDate?: string;
  expirationDate?: string;
  remediation?: string;
}

export interface ComplianceCaseItem {
  id: string;
  ruleId: string;
  ruleCode?: string;
  ruleName?: string;
  subjectType: TrustSubjectType;
  subjectId: string;
  organizationId?: string;
  propertyId?: string;
  severity: TrustRiskLevel;
  status: ComplianceCaseStatus;
  decision: ComplianceDecision;
  assignedReviewerId?: string;
  remediationAction?: string;
  deadline?: string;
  notes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// DISPUTE MANAGEMENT TYPES
// ----------------------------------------------------------------------------

export enum DisputeState {
  OPEN = 'OPEN',
  TRIAGED = 'TRIAGED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  WAITING_FOR_PARTY = 'WAITING_FOR_PARTY',
  EVIDENCE_REQUESTED = 'EVIDENCE_REQUESTED',
  MEDIATION = 'MEDIATION',
  DECISION_PENDING = 'DECISION_PENDING',
  RESOLVED = 'RESOLVED',
  APPEALED = 'APPEALED',
  ESCALATED = 'ESCALATED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED'
}

export enum DisputeCategory {
  OWNERSHIP_LISTING = 'OWNERSHIP_LISTING',
  TENANT_LANDLORD = 'TENANT_LANDLORD',
  BUYER_SELLER = 'BUYER_SELLER',
  COMPANY_OWNER = 'COMPANY_OWNER',
  VENDOR_SERVICE = 'VENDOR_SERVICE',
  PAYMENT_COMMISSION = 'PAYMENT_COMMISSION',
  CONTRACT_LEASE = 'CONTRACT_LEASE',
  PROPERTY_INFO = 'PROPERTY_INFO',
  VERIFICATION_DISPUTE = 'VERIFICATION_DISPUTE',
  OTHER = 'OTHER'
}

export enum DisputeResolutionOutcome {
  PENDING = 'PENDING',
  DISMISSED = 'DISMISSED',
  MUTUAL_AGREEMENT = 'MUTUAL_AGREEMENT',
  UPHELD_CLAIMANT = 'UPHELD_CLAIMANT',
  UPHELD_RESPONDENT = 'UPHELD_RESPONDENT',
  EXTERNAL_LEGAL_REVIEW_REQUIRED = 'EXTERNAL_LEGAL_REVIEW_REQUIRED'
}

export enum DisputeEvidenceVisibility {
  PUBLIC_TO_PARTIES = 'PUBLIC_TO_PARTIES',
  PARTY_PRIVATE = 'PARTY_PRIVATE',
  INTERNAL_REVIEW = 'INTERNAL_REVIEW',
  COMPLIANCE_PRIVATE = 'COMPLIANCE_PRIVATE',
  SECURITY_PRIVATE = 'SECURITY_PRIVATE',
  AUDITOR_ONLY = 'AUDITOR_ONLY'
}

export interface DisputePartyItem {
  id: string;
  disputeId: string;
  userId: string;
  role: 'INITIATOR' | 'RESPONDENT' | 'INTERESTED_PARTY' | 'MEDIATOR' | 'LEGAL_REPRESENTATIVE';
  organizationId?: string;
  status: 'ACTIVE' | 'NOTIFIED' | 'RESPONDED' | 'DEFAULTED';
  joinedAt: string;
}

export interface DisputeEvidenceItem {
  id: string;
  disputeId: string;
  submittedBy: string;
  title: string;
  description?: string;
  documentRef: string;
  checksumSha256: string;
  visibility: DisputeEvidenceVisibility;
  status: 'ACTIVE' | 'WITHDRAWN' | 'CHALLENGED' | 'STRICKEN';
  submittedAt: string;
  reviewNotes?: string;
}

export interface DisputeEventItem {
  id: string;
  disputeId: string;
  actorUserId?: string;
  actorRole: string;
  eventType: string;
  visibility: 'PUBLIC_TO_PARTIES' | 'INTERNAL_ONLY';
  fromStatus?: string;
  toStatus?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface DisputeAppealItem {
  id: string;
  disputeId: string;
  appellantUserId: string;
  originalResolutionOutcome: DisputeResolutionOutcome;
  appealReason: string;
  status: 'FILED' | 'UNDER_REVIEW' | 'UPHELD' | 'OVERTURNED' | 'DISMISSED';
  assignedAppealsOfficerId?: string;
  appealDecisionNotes?: string;
  filedAt: string;
  decidedAt?: string;
}

export interface DisputeItem {
  id: string;
  disputeNumber: string;
  title: string;
  category: DisputeCategory;
  description: string;
  status: DisputeState;
  resolutionOutcome: DisputeResolutionOutcome;
  initiatorUserId: string;
  respondentUserId?: string;
  organizationId?: string;
  propertyId?: string;
  relatedEntityId?: string;
  assignedReviewerId?: string;
  externalLegalReviewRequired: boolean;
  resolutionNotes?: string;
  resolvedAt?: string;
  closedAt?: string;
  parties?: DisputePartyItem[];
  evidence?: DisputeEvidenceItem[];
  events?: DisputeEventItem[];
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// TRUST EVENT AUDIT LOG
// ----------------------------------------------------------------------------

export interface TrustEventItem {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorUserId?: string;
  actorRole?: string;
  fromState?: string;
  toState?: string;
  reason?: string;
  evidenceRef?: string;
  correlationId?: string;
  organizationId?: string;
  propertyId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}
