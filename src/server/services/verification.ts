import crypto from 'crypto';
import { 
  VerificationState, 
  VerificationType, 
  TrustSubjectType, 
  EvidenceType,
  EvidenceStatus
} from '../../types/trust-verification.js';
import { trustVerificationRepository } from '../repositories/trust-verification.js';
import { auditService } from './audit.js';

// Strict State Transition Matrix for Verification
export const VALID_VERIFICATION_TRANSITIONS: Record<VerificationState, VerificationState[]> = {
  [VerificationState.NOT_STARTED]: [VerificationState.SUBMITTED],
  [VerificationState.SUBMITTED]: [VerificationState.UNDER_REVIEW, VerificationState.REJECTED],
  [VerificationState.UNDER_REVIEW]: [
    VerificationState.ADDITIONAL_INFORMATION_REQUIRED,
    VerificationState.VERIFIED,
    VerificationState.PARTIALLY_VERIFIED,
    VerificationState.REJECTED
  ],
  [VerificationState.ADDITIONAL_INFORMATION_REQUIRED]: [
    VerificationState.SUBMITTED,
    VerificationState.REJECTED
  ],
  [VerificationState.VERIFIED]: [
    VerificationState.EXPIRED,
    VerificationState.REVOKED,
    VerificationState.SUSPENDED
  ],
  [VerificationState.PARTIALLY_VERIFIED]: [
    VerificationState.UNDER_REVIEW,
    VerificationState.EXPIRED,
    VerificationState.REVOKED
  ],
  [VerificationState.SUSPENDED]: [
    VerificationState.UNDER_REVIEW,
    VerificationState.REVOKED,
    VerificationState.VERIFIED
  ],
  [VerificationState.EXPIRED]: [VerificationState.SUBMITTED],
  [VerificationState.REJECTED]: [VerificationState.SUBMITTED],
  [VerificationState.REVOKED]: [VerificationState.SUBMITTED]
};

export class VerificationService {
  /**
   * Generates SHA-256 integrity hash for an evidence payload/document reference
   */
  computeChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Submits a new verification request with fail-closed validation
   */
  async submitVerification(params: {
    subjectType: TrustSubjectType;
    subjectId: string;
    verificationType: VerificationType;
    organizationId?: string;
    propertyId?: string;
    ownerId?: string;
    submittedBy: string;
    metadata?: Record<string, any>;
    evidenceList?: Array<{
      evidenceType: EvidenceType;
      title: string;
      documentRef: string;
      notes?: string;
    }>;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // Input sanitization and safety
    if (!params.subjectType || !params.subjectId || !params.verificationType) {
      throw new Error('INVALID_VERIFICATION_PARAMS: Missing required fields.');
    }

    const record = await trustVerificationRepository.createVerificationRecord({
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      verificationType: params.verificationType,
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      ownerId: params.ownerId,
      submittedBy: params.submittedBy,
      metadata: params.metadata
    });

    // Add associated evidence if provided
    if (params.evidenceList && params.evidenceList.length > 0) {
      for (const ev of params.evidenceList) {
        const checksum = this.computeChecksum(ev.documentRef + ev.title + params.submittedBy);
        await trustVerificationRepository.addVerificationEvidence({
          verificationRecordId: record.id,
          evidenceType: ev.evidenceType,
          title: ev.title,
          documentRef: ev.documentRef,
          checksumSha256: checksum,
          submittedBy: params.submittedBy,
          notes: ev.notes
        });
      }
    }

    // Log trust and audit events
    await trustVerificationRepository.recordTrustEvent({
      eventType: 'VERIFICATION_SUBMITTED',
      entityType: params.subjectType,
      entityId: params.subjectId,
      actorUserId: params.submittedBy,
      fromState: VerificationState.NOT_STARTED,
      toState: VerificationState.SUBMITTED,
      reason: `Verification submitted for ${params.verificationType}`,
      organizationId: params.organizationId,
      propertyId: params.propertyId
    });

    await auditService.logAction({
      actorUserId: params.submittedBy,
      actorRole: 'USER',
      action: 'SUBMIT_VERIFICATION',
      resourceType: 'VerificationRecord',
      resourceId: record.id,
      changes: { subjectType: params.subjectType, subjectId: params.subjectId, status: VerificationState.SUBMITTED }
    });

    return record;
  }

  /**
   * Reviews a verification record enforcing Separation of Duties and State Machine integrity
   */
  async reviewVerification(params: {
    verificationRecordId: string;
    targetStatus: VerificationState;
    reviewerUserId: string;
    reviewerRoles: string[];
    reviewNotes?: string;
    rejectionReason?: string;
    validityDays?: number;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // 1. Reviewer role authorization (fail fast before record lookup)
    const isAuthorizedReviewer = params.reviewerRoles.some(r => [
      'SUPER_ADMIN', 
      'PLATFORM_ADMIN', 
      'ADMIN', 
      'COMPLIANCE_ADMIN', 
      'VERIFICATION_ADMIN'
    ].includes(r));

    if (!isAuthorizedReviewer) {
      throw new Error('UNAUTHORIZED_REVIEWER_ROLE: Reviewer lacks compliance/verification authority.');
    }

    const record = await trustVerificationRepository.getVerificationRecordById(params.verificationRecordId);
    if (!record) {
      throw new Error('VERIFICATION_RECORD_NOT_FOUND');
    }

    // 2. Separation of Duties: Submitter CANNOT approve or review their own verification!
    if (record.submittedBy === params.reviewerUserId) {
      throw new Error('CANNOT_SELF_APPROVE: Submitter is strictly prohibited from reviewing their own verification.');
    }

    // 3. State machine validation
    const currentStatus = record.status as VerificationState;
    const allowedTargets = VALID_VERIFICATION_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(params.targetStatus)) {
      throw new Error(`ILLEGAL_STATE_TRANSITION: Cannot transition from ${currentStatus} to ${params.targetStatus}.`);
    }

    // Expiry calculation if VERIFIED
    let expiresAt: Date | undefined;
    if (params.targetStatus === VerificationState.VERIFIED && params.validityDays && params.validityDays > 0) {
      expiresAt = new Date(Date.now() + params.validityDays * 24 * 60 * 60 * 1000);
    }

    const updated = await trustVerificationRepository.updateVerificationStatus(
      record.id,
      params.targetStatus,
      params.reviewerUserId,
      params.reviewNotes,
      params.rejectionReason,
      expiresAt
    );

    // Record trust event
    await trustVerificationRepository.recordTrustEvent({
      eventType: `VERIFICATION_${params.targetStatus}`,
      entityType: record.subjectType,
      entityId: record.subjectId,
      actorUserId: params.reviewerUserId,
      actorRole: params.reviewerRoles[0] || 'ADMIN',
      fromState: currentStatus,
      toState: params.targetStatus,
      reason: params.reviewNotes || params.rejectionReason || `Status updated to ${params.targetStatus}`,
      organizationId: record.organizationId || undefined,
      propertyId: record.propertyId || undefined
    });

    await auditService.logAction({
      actorUserId: params.reviewerUserId,
      actorRole: params.reviewerRoles[0] || 'ADMIN',
      action: `REVIEW_VERIFICATION_${params.targetStatus}`,
      resourceType: 'VerificationRecord',
      resourceId: record.id,
      changes: { fromStatus: currentStatus, toStatus: params.targetStatus }
    });

    return updated;
  }
}

export const verificationService = new VerificationService();
