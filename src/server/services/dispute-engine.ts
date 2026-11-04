import crypto from 'crypto';
import { 
  DisputeState, 
  DisputeCategory, 
  DisputeResolutionOutcome, 
  DisputeEvidenceVisibility 
} from '../../types/trust-verification.js';
import { trustVerificationRepository } from '../repositories/trust-verification.js';
import { auditService } from './audit.js';

export const VALID_DISPUTE_TRANSITIONS: Record<DisputeState, DisputeState[]> = {
  [DisputeState.OPEN]: [
    DisputeState.TRIAGED, 
    DisputeState.UNDER_REVIEW, 
    DisputeState.WAITING_FOR_PARTY, 
    DisputeState.CLOSED
  ],
  [DisputeState.TRIAGED]: [
    DisputeState.UNDER_REVIEW, 
    DisputeState.EVIDENCE_REQUESTED, 
    DisputeState.MEDIATION, 
    DisputeState.CLOSED
  ],
  [DisputeState.UNDER_REVIEW]: [
    DisputeState.EVIDENCE_REQUESTED, 
    DisputeState.MEDIATION, 
    DisputeState.DECISION_PENDING, 
    DisputeState.ESCALATED, 
    DisputeState.RESOLVED
  ],
  [DisputeState.WAITING_FOR_PARTY]: [
    DisputeState.UNDER_REVIEW, 
    DisputeState.EVIDENCE_REQUESTED, 
    DisputeState.ESCALATED
  ],
  [DisputeState.EVIDENCE_REQUESTED]: [
    DisputeState.UNDER_REVIEW, 
    DisputeState.WAITING_FOR_PARTY, 
    DisputeState.ESCALATED
  ],
  [DisputeState.MEDIATION]: [
    DisputeState.DECISION_PENDING, 
    DisputeState.ESCALATED, 
    DisputeState.RESOLVED
  ],
  [DisputeState.DECISION_PENDING]: [
    DisputeState.RESOLVED, 
    DisputeState.ESCALATED
  ],
  [DisputeState.RESOLVED]: [
    DisputeState.APPEALED, 
    DisputeState.CLOSED
  ],
  [DisputeState.APPEALED]: [
    DisputeState.UNDER_REVIEW, 
    DisputeState.RESOLVED, 
    DisputeState.ESCALATED
  ],
  [DisputeState.ESCALATED]: [
    DisputeState.UNDER_REVIEW, 
    DisputeState.RESOLVED, 
    DisputeState.CLOSED
  ],
  [DisputeState.CLOSED]: [
    DisputeState.REOPENED
  ],
  [DisputeState.REOPENED]: [
    DisputeState.UNDER_REVIEW, 
    DisputeState.TRIAGED
  ]
};

export class DisputeEngine {
  computeChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Opens a new dispute case
   */
  async openDispute(params: {
    title: string;
    category: DisputeCategory;
    description: string;
    initiatorUserId: string;
    respondentUserId?: string;
    organizationId?: string;
    propertyId?: string;
    relatedEntityId?: string;
    initialEvidence?: Array<{
      title: string;
      description?: string;
      documentRef: string;
      visibility?: DisputeEvidenceVisibility;
    }>;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const disputeNumber = `DSP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const dispute = await trustVerificationRepository.createDispute({
      disputeNumber,
      title: params.title,
      category: params.category,
      description: params.description,
      initiatorUserId: params.initiatorUserId,
      respondentUserId: params.respondentUserId,
      organizationId: params.organizationId,
      propertyId: params.propertyId,
      relatedEntityId: params.relatedEntityId
    });

    // Record opening event
    await trustVerificationRepository.addDisputeEvent({
      disputeId: dispute.id,
      actorUserId: params.initiatorUserId,
      actorRole: 'INITIATOR',
      eventType: 'DISPUTE_OPENED',
      visibility: 'PUBLIC_TO_PARTIES',
      toStatus: DisputeState.OPEN,
      details: { title: params.title, category: params.category }
    });

    // Save initial evidence if provided
    if (params.initialEvidence && params.initialEvidence.length > 0) {
      for (const ev of params.initialEvidence) {
        const checksum = this.computeChecksum(ev.documentRef + ev.title + params.initiatorUserId);
        await trustVerificationRepository.addDisputeEvidence({
          disputeId: dispute.id,
          submittedBy: params.initiatorUserId,
          title: ev.title,
          description: ev.description,
          documentRef: ev.documentRef,
          checksumSha256: checksum,
          visibility: ev.visibility || DisputeEvidenceVisibility.PUBLIC_TO_PARTIES
        });
      }
    }

    // Record trust and audit events
    await trustVerificationRepository.recordTrustEvent({
      eventType: 'DISPUTE_OPENED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      actorUserId: params.initiatorUserId,
      fromState: 'NONE',
      toState: DisputeState.OPEN,
      reason: `Dispute opened: ${params.title}`,
      organizationId: params.organizationId,
      propertyId: params.propertyId
    });

    await auditService.logAction({
      actorUserId: params.initiatorUserId,
      actorRole: 'USER',
      action: 'OPEN_DISPUTE',
      resourceType: 'Dispute',
      resourceId: dispute.id,
      changes: { disputeNumber, category: params.category }
    });

    return dispute;
  }

  /**
   * Transitions dispute status and records audit events
   */
  async transitionStatus(params: {
    disputeId: string;
    targetStatus: DisputeState;
    resolutionOutcome?: DisputeResolutionOutcome;
    actorUserId: string;
    actorRole: string;
    actorRoles: string[];
    resolutionNotes?: string;
    externalLegalRequired?: boolean;
    details?: Record<string, any>;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const dispute = await trustVerificationRepository.getDisputeById(params.disputeId);
    if (!dispute) {
      throw new Error('DISPUTE_NOT_FOUND');
    }

    const currentStatus = dispute.status as DisputeState;
    const allowed = VALID_DISPUTE_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(params.targetStatus)) {
      throw new Error(`ILLEGAL_DISPUTE_TRANSITION: Cannot transition dispute from ${currentStatus} to ${params.targetStatus}.`);
    }

    // Role check: Only authorized reviewers/admins can resolve, escalate, or dismiss disputes
    const isAdminOrReviewer = params.actorRoles.some(r => [
      'SUPER_ADMIN', 
      'PLATFORM_ADMIN', 
      'ADMIN', 
      'COMPLIANCE_ADMIN'
    ].includes(r));

    const isParty = dispute.initiatorUserId === params.actorUserId || dispute.respondentUserId === params.actorUserId;

    if (!isAdminOrReviewer && !isParty) {
      throw new Error('UNAUTHORIZED_DISPUTE_ACCESS: User is not a party or reviewer for this dispute.');
    }

    if ([DisputeState.RESOLVED, DisputeState.CLOSED, DisputeState.DECISION_PENDING].includes(params.targetStatus) && !isAdminOrReviewer) {
      throw new Error('FORBIDDEN_DISPUTE_RESOLUTION: Only compliance officers or platform admins can resolve disputes.');
    }

    const updated = await trustVerificationRepository.updateDisputeStatus(
      dispute.id,
      params.targetStatus,
      params.resolutionOutcome || (dispute.resolutionOutcome as DisputeResolutionOutcome),
      params.actorUserId,
      params.resolutionNotes,
      params.externalLegalRequired ?? dispute.externalLegalReviewRequired
    );

    await trustVerificationRepository.addDisputeEvent({
      disputeId: dispute.id,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      eventType: `STATUS_TRANSITION_${params.targetStatus}`,
      visibility: 'PUBLIC_TO_PARTIES',
      fromStatus: currentStatus,
      toStatus: params.targetStatus,
      details: params.details || { notes: params.resolutionNotes }
    });

    await trustVerificationRepository.recordTrustEvent({
      eventType: `DISPUTE_${params.targetStatus}`,
      entityType: 'DISPUTE',
      entityId: dispute.id,
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      fromState: currentStatus,
      toState: params.targetStatus,
      reason: params.resolutionNotes || `Dispute state moved to ${params.targetStatus}`,
      organizationId: dispute.organizationId || undefined,
      propertyId: dispute.propertyId || undefined
    });

    await auditService.logAction({
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: `DISPUTE_TRANSITION_${params.targetStatus}`,
      resourceType: 'Dispute',
      resourceId: dispute.id,
      changes: { fromStatus: currentStatus, toStatus: params.targetStatus, outcome: params.resolutionOutcome }
    });

    return updated;
  }

  /**
   * Files an appeal against a resolved dispute with conflict of interest protection
   */
  async fileAppeal(params: {
    disputeId: string;
    appellantUserId: string;
    appealReason: string;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const dispute = await trustVerificationRepository.getDisputeById(params.disputeId);
    if (!dispute) {
      throw new Error('DISPUTE_NOT_FOUND');
    }

    if (dispute.status !== DisputeState.RESOLVED) {
      throw new Error('DISPUTE_NOT_RESOLVED: Appeals can only be filed against RESOLVED disputes.');
    }

    // Appellant must be a party to the dispute
    const parties = await trustVerificationRepository.getDisputeParties(dispute.id);
    const isParty = parties.some(p => p.userId === params.appellantUserId);
    if (!isParty) {
      throw new Error('UNAUTHORIZED_APPELLANT: User is not a recognized party to this dispute.');
    }

    const appeal = await trustVerificationRepository.createDisputeAppeal({
      disputeId: dispute.id,
      appellantUserId: params.appellantUserId,
      originalResolutionOutcome: dispute.resolutionOutcome as DisputeResolutionOutcome,
      appealReason: params.appealReason
    });

    // Update dispute state to APPEALED
    await trustVerificationRepository.updateDisputeStatus(
      dispute.id,
      DisputeState.APPEALED,
      dispute.resolutionOutcome as DisputeResolutionOutcome,
      undefined,
      `Appeal filed: ${params.appealReason}`
    );

    await trustVerificationRepository.addDisputeEvent({
      disputeId: dispute.id,
      actorUserId: params.appellantUserId,
      actorRole: 'APPELLANT',
      eventType: 'APPEAL_FILED',
      visibility: 'PUBLIC_TO_PARTIES',
      fromStatus: DisputeState.RESOLVED,
      toStatus: DisputeState.APPEALED,
      details: { appealId: appeal.id, reason: params.appealReason }
    });

    await trustVerificationRepository.recordTrustEvent({
      eventType: 'DISPUTE_APPEALED',
      entityType: 'DISPUTE',
      entityId: dispute.id,
      actorUserId: params.appellantUserId,
      fromState: DisputeState.RESOLVED,
      toState: DisputeState.APPEALED,
      reason: params.appealReason
    });

    await auditService.logAction({
      actorUserId: params.appellantUserId,
      actorRole: 'USER',
      action: 'FILE_DISPUTE_APPEAL',
      resourceType: 'DisputeAppeal',
      resourceId: appeal.id,
      changes: { disputeId: dispute.id, reason: params.appealReason }
    });

    return appeal;
  }

  /**
   * Filters evidence based on party access bounds to guarantee confidentiality
   */
  filterEvidenceForCaller(
    evidenceList: any[], 
    callerUserId: string, 
    callerRoles: string[]
  ): any[] {
    const isComplianceOrAdmin = callerRoles.some(r => [
      'SUPER_ADMIN', 
      'PLATFORM_ADMIN', 
      'ADMIN', 
      'COMPLIANCE_ADMIN'
    ].includes(r));

    const isAuditor = callerRoles.includes('AUDITOR');

    return evidenceList.filter(ev => {
      // 1. Admins and compliance officers can see internal, party private, and public evidence
      if (isComplianceOrAdmin) return true;

      // 2. Auditors can view everything except security private if restricted
      if (isAuditor) return ev.visibility !== DisputeEvidenceVisibility.SECURITY_PRIVATE;

      // 3. Regular parties
      if (ev.visibility === DisputeEvidenceVisibility.PUBLIC_TO_PARTIES) {
        return true;
      }
      if (ev.visibility === DisputeEvidenceVisibility.PARTY_PRIVATE) {
        // Party can only see their OWN party private documents!
        return ev.submittedBy === callerUserId;
      }

      // Hide INTERNAL_REVIEW, COMPLIANCE_PRIVATE, SECURITY_PRIVATE, AUDITOR_ONLY from regular parties
      return false;
    });
  }
}

export const disputeEngine = new DisputeEngine();
