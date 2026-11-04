import { 
  ComplianceCaseStatus, 
  ComplianceDecision, 
  TrustSubjectType, 
  TrustRiskLevel 
} from '../../types/trust-verification.js';
import { trustVerificationRepository } from '../repositories/trust-verification.js';
import { auditService } from './audit.js';

const VALID_COMPLIANCE_TRANSITIONS: Record<ComplianceCaseStatus, ComplianceCaseStatus[]> = {
  [ComplianceCaseStatus.OPEN]: [ComplianceCaseStatus.TRIAGED, ComplianceCaseStatus.UNDER_REVIEW, ComplianceCaseStatus.CLOSED],
  [ComplianceCaseStatus.TRIAGED]: [ComplianceCaseStatus.UNDER_REVIEW, ComplianceCaseStatus.ACTION_REQUIRED, ComplianceCaseStatus.CLOSED],
  [ComplianceCaseStatus.UNDER_REVIEW]: [ComplianceCaseStatus.ACTION_REQUIRED, ComplianceCaseStatus.ESCALATED, ComplianceCaseStatus.RESOLVED, ComplianceCaseStatus.CLOSED],
  [ComplianceCaseStatus.ACTION_REQUIRED]: [ComplianceCaseStatus.UNDER_REVIEW, ComplianceCaseStatus.ESCALATED, ComplianceCaseStatus.RESOLVED],
  [ComplianceCaseStatus.ESCALATED]: [ComplianceCaseStatus.UNDER_REVIEW, ComplianceCaseStatus.RESOLVED, ComplianceCaseStatus.CLOSED],
  [ComplianceCaseStatus.RESOLVED]: [ComplianceCaseStatus.CLOSED, ComplianceCaseStatus.REOPENED],
  [ComplianceCaseStatus.CLOSED]: [ComplianceCaseStatus.REOPENED],
  [ComplianceCaseStatus.REOPENED]: [ComplianceCaseStatus.UNDER_REVIEW, ComplianceCaseStatus.TRIAGED]
};

export class ComplianceEngine {
  /**
   * Evaluates rules against an entity and creates compliance cases if violations or review requirements are detected
   */
  async createCase(params: {
    ruleCode: string;
    subjectType: TrustSubjectType;
    subjectId: string;
    organizationId?: string;
    propertyId?: string;
    severity?: TrustRiskLevel;
    notes?: string;
    deadlineDays?: number;
    actorUserId?: string;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const rule = await trustVerificationRepository.getComplianceRuleByCode(params.ruleCode);
    if (!rule) {
      throw new Error(`COMPLIANCE_RULE_NOT_FOUND: Rule with code ${params.ruleCode} does not exist.`);
    }

    let deadline: Date | undefined;
    if (params.deadlineDays && params.deadlineDays > 0) {
      deadline = new Date(Date.now() + params.deadlineDays * 24 * 60 * 60 * 1000);
    }

    const compCase = await trustVerificationRepository.createComplianceCase({
      ruleId: rule.id,
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      severity: params.severity || (rule.severity as TrustRiskLevel) || TrustRiskLevel.MEDIUM,
      notes: params.notes,
      deadline
    });

    await trustVerificationRepository.recordTrustEvent({
      eventType: 'COMPLIANCE_CASE_OPENED',
      entityType: params.subjectType,
      entityId: params.subjectId,
      actorUserId: params.actorUserId,
      fromState: 'NONE',
      toState: ComplianceCaseStatus.OPEN,
      reason: `Compliance case opened for rule ${rule.code}: ${rule.name}`,
      organizationId: params.organizationId,
      propertyId: params.propertyId
    });

    await auditService.logAction({
      actorUserId: params.actorUserId || 'SYSTEM',
      actorRole: 'COMPLIANCE_SYSTEM',
      action: 'OPEN_COMPLIANCE_CASE',
      resourceType: 'ComplianceCase',
      resourceId: compCase.id,
      changes: { ruleCode: rule.code, status: ComplianceCaseStatus.OPEN }
    });

    return compCase;
  }

  /**
   * Reviews and decides on a compliance case with strict state machine and role validation
   */
  async reviewCase(params: {
    caseId: string;
    status: ComplianceCaseStatus;
    decision: ComplianceDecision;
    reviewerUserId: string;
    reviewerRoles: string[];
    remediationAction?: string;
    notes?: string;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // Role check
    const isAuthorized = params.reviewerRoles.some(r => [
      'SUPER_ADMIN', 
      'PLATFORM_ADMIN', 
      'ADMIN', 
      'COMPLIANCE_ADMIN'
    ].includes(r));

    if (!isAuthorized) {
      throw new Error('UNAUTHORIZED_COMPLIANCE_REVIEWER: Role not authorized to review compliance cases.');
    }

    const compCase = await trustVerificationRepository.getComplianceCaseById(params.caseId);
    if (!compCase) {
      throw new Error('COMPLIANCE_CASE_NOT_FOUND');
    }

    const currentStatus = compCase.status as ComplianceCaseStatus;
    const allowed = VALID_COMPLIANCE_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(params.status)) {
      throw new Error(`ILLEGAL_COMPLIANCE_TRANSITION: Cannot transition from ${currentStatus} to ${params.status}.`);
    }

    const updated = await trustVerificationRepository.updateComplianceCaseStatus(
      compCase.id,
      params.status,
      params.decision,
      params.reviewerUserId,
      params.remediationAction,
      params.notes
    );

    await trustVerificationRepository.recordTrustEvent({
      eventType: `COMPLIANCE_${params.status}`,
      entityType: compCase.subjectType,
      entityId: compCase.subjectId,
      actorUserId: params.reviewerUserId,
      actorRole: params.reviewerRoles[0] || 'COMPLIANCE_ADMIN',
      fromState: currentStatus,
      toState: params.status,
      reason: params.notes || `Compliance decision: ${params.decision}`,
      organizationId: compCase.organizationId || undefined,
      propertyId: compCase.propertyId || undefined
    });

    await auditService.logAction({
      actorUserId: params.reviewerUserId,
      actorRole: params.reviewerRoles[0] || 'COMPLIANCE_ADMIN',
      action: `REVIEW_COMPLIANCE_${params.status}`,
      resourceType: 'ComplianceCase',
      resourceId: compCase.id,
      changes: { fromStatus: currentStatus, toStatus: params.status, decision: params.decision }
    });

    return updated;
  }
}

export const complianceEngine = new ComplianceEngine();
