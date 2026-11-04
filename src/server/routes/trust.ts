import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { trustVerificationRepository } from '../repositories/trust-verification.js';
import { verificationService } from '../services/verification.js';
import { riskEngine } from '../services/risk-engine.js';
import { complianceEngine } from '../services/compliance-engine.js';
import { disputeEngine } from '../services/dispute-engine.js';
import { auditService } from '../services/audit.js';
import { 
  VerificationState, 
  DisputeState, 
  DisputeCategory, 
  DisputeResolutionOutcome,
  DisputeEvidenceVisibility,
  TrustSubjectType, 
  VerificationType, 
  EvidenceType,
  TrustRiskLevel,
  RiskTargetType,
  ComplianceCaseStatus,
  ComplianceDecision
} from '../../types/trust-verification.js';

const router = Router();

const getParam = (val: string | string[] | undefined): string => {
  if (Array.isArray(val)) return val[0] || '';
  return val || '';
};

// ============================================================================
// STAGE 10: TRUST, VERIFICATION, RISK, COMPLIANCE & DISPUTES ROUTER
// ============================================================================

// ----------------------------------------------------------------------------
// 1. TRUST OVERVIEW & DASHBOARD
// ----------------------------------------------------------------------------
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured. Operational actions fail-closed.'
    });
  }

  try {
    const user = req.user!;
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);

    // Fetch verifications
    const verifications = await trustVerificationRepository.listVerificationRecords({
      organizationId: scope.hasGlobalAuthority ? undefined : user.organizationId,
      limit: 20
    });

    // Fetch disputes
    const userDisputes = await trustVerificationRepository.listDisputes({
      userId: scope.hasGlobalAuthority ? undefined : user.id,
      organizationId: scope.hasGlobalAuthority ? undefined : user.organizationId,
      limit: 20
    });

    // Fetch compliance cases
    const complianceCases = await trustVerificationRepository.listComplianceCases({
      organizationId: scope.hasGlobalAuthority ? undefined : user.organizationId,
      limit: 20
    });

    res.json({
      success: true,
      summary: {
        totalVerifications: verifications.length,
        pendingVerifications: verifications.filter(v => v.status === VerificationState.SUBMITTED || v.status === VerificationState.UNDER_REVIEW).length,
        activeDisputes: userDisputes.filter(d => d.status !== DisputeState.RESOLVED && d.status !== DisputeState.CLOSED).length,
        complianceCases: complianceCases.length,
        scope: {
          hasGlobalAuthority: scope.hasGlobalAuthority,
          accessiblePropertiesCount: scope.accessiblePropertyIds.length
        }
      },
      verifications,
      disputes: userDisputes,
      complianceCases
    });
  } catch (err: any) {
    res.status(500).json({ error: 'TRUST_DASHBOARD_ERROR', message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 2. VERIFICATIONS
// ----------------------------------------------------------------------------
router.post('/verifications', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured. Operational actions fail-closed.'
    });
  }

  try {
    const user = req.user!;
    const { subjectType, subjectId, verificationType, organizationId, propertyId, metadata, evidenceList } = req.body;

    if (!subjectType || !subjectId || !verificationType) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing subjectType, subjectId, or verificationType' });
    }

    // IDOR / Scoping checks
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);
    if (propertyId && !scope.hasGlobalAuthority && !scope.accessiblePropertyIds.includes(propertyId)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Unauthorized property verification request.' });
    }

    const record = await verificationService.submitVerification({
      subjectType: subjectType as TrustSubjectType,
      subjectId,
      verificationType: verificationType as VerificationType,
      organizationId: organizationId || user.organizationId,
      propertyId,
      ownerId: user.id,
      submittedBy: user.id,
      metadata,
      evidenceList
    });

    res.status(201).json({ success: true, verificationRecord: record });
  } catch (err: any) {
    res.status(400).json({ error: 'VERIFICATION_SUBMISSION_FAILED', message: err.message });
  }
});

router.get('/verifications', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);

    const { subjectType, status, limit, offset } = req.query;

    const records = await trustVerificationRepository.listVerificationRecords({
      subjectType: subjectType as TrustSubjectType,
      organizationId: scope.hasGlobalAuthority ? undefined : user.organizationId,
      status: status as string,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });

    res.json({ success: true, count: records.length, records });
  } catch (err: any) {
    res.status(500).json({ error: 'LIST_VERIFICATIONS_FAILED', message: err.message });
  }
});

router.get('/verifications/:id', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const recordId = getParam(req.params.id);
    const record = await trustVerificationRepository.getVerificationRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Verification record not found.' });
    }

    // Authorization check
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);
    if (!scope.hasGlobalAuthority) {
      if (record.submittedBy !== user.id && record.organizationId !== user.organizationId) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Access to verification record denied.' });
      }
    }

    const evidence = await trustVerificationRepository.getEvidenceByRecordId(record.id);

    res.json({ success: true, record, evidence });
  } catch (err: any) {
    res.status(500).json({ error: 'GET_VERIFICATION_FAILED', message: err.message });
  }
});

router.post('/verifications/:id/review', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { targetStatus, reviewNotes, rejectionReason, validityDays } = req.body;

    if (!targetStatus) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing targetStatus' });
    }

    const recordId = getParam(req.params.id);
    const updated = await verificationService.reviewVerification({
      verificationRecordId: recordId,
      targetStatus: targetStatus as VerificationState,
      reviewerUserId: user.id,
      reviewerRoles: user.roles,
      reviewNotes,
      rejectionReason,
      validityDays
    });

    res.json({ success: true, record: updated });
  } catch (err: any) {
    const status = err.message.includes('CANNOT_SELF_APPROVE') || err.message.includes('UNAUTHORIZED') ? 403 : 400;
    res.status(status).json({ error: 'REVIEW_VERIFICATION_FAILED', message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 3. RISK ASSESSMENT & SIGNALS
// ----------------------------------------------------------------------------
router.get('/risk/:targetType/:targetId', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const targetType = getParam(req.params.targetType);
    const targetId = getParam(req.params.targetId);
    const assessment = await trustVerificationRepository.getLatestRiskAssessment(
      targetType as RiskTargetType, 
      targetId
    );

    const signals = await trustVerificationRepository.listActiveRiskSignals(
      targetType as RiskTargetType, 
      targetId
    );

    res.json({
      success: true,
      assessment: assessment || {
        targetType,
        targetId,
        score: 0,
        level: TrustRiskLevel.LOW,
        factors: [],
        status: 'UNASSESSED'
      },
      activeSignals: signals
    });
  } catch (err: any) {
    res.status(500).json({ error: 'GET_RISK_FAILED', message: err.message });
  }
});

router.post('/risk/:targetType/:targetId/assess', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const targetType = getParam(req.params.targetType);
    const targetId = getParam(req.params.targetId);
    const { organizationId, propertyId } = req.body;

    const assessment = await riskEngine.assessRisk({
      targetType: targetType as RiskTargetType,
      targetId,
      organizationId,
      propertyId,
      triggerActorId: user.id
    });

    res.json({ success: true, assessment });
  } catch (err: any) {
    res.status(500).json({ error: 'ASSESS_RISK_FAILED', message: err.message });
  }
});

router.post('/risk/signals', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { targetType, targetId, signalType, riskLevel, numericScore, description, source, evidenceRef, organizationId, propertyId } = req.body;

    if (!targetType || !targetId || !signalType || !description) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing required signal fields.' });
    }

    const signal = await trustVerificationRepository.createRiskSignal({
      targetType,
      targetId,
      signalType,
      riskLevel: riskLevel || TrustRiskLevel.MEDIUM,
      numericScore: numericScore ? Number(numericScore) : 25,
      description,
      source: source || 'USER_REPORT',
      evidenceRef,
      organizationId,
      propertyId
    });

    // Automatically re-evaluate risk after adding signal
    const assessment = await riskEngine.assessRisk({
      targetType,
      targetId,
      organizationId,
      propertyId,
      triggerActorId: user.id
    });

    res.status(201).json({ success: true, signal, updatedAssessment: assessment });
  } catch (err: any) {
    res.status(500).json({ error: 'CREATE_RISK_SIGNAL_FAILED', message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 4. COMPLIANCE RULES & CASES
// ----------------------------------------------------------------------------
router.get('/compliance/rules', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const { jurisdiction } = req.query;
    const rules = await trustVerificationRepository.listComplianceRules(jurisdiction as string);
    res.json({ success: true, rules });
  } catch (err: any) {
    res.status(500).json({ error: 'LIST_COMPLIANCE_RULES_FAILED', message: err.message });
  }
});

router.get('/compliance/cases', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);

    const { subjectType, status } = req.query;
    const cases = await trustVerificationRepository.listComplianceCases({
      subjectType: subjectType as TrustSubjectType,
      organizationId: scope.hasGlobalAuthority ? undefined : user.organizationId,
      status: status as string
    });

    res.json({ success: true, cases });
  } catch (err: any) {
    res.status(500).json({ error: 'LIST_COMPLIANCE_CASES_FAILED', message: err.message });
  }
});

router.post('/compliance/cases', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { ruleCode, subjectType, subjectId, organizationId, propertyId, severity, notes, deadlineDays } = req.body;

    if (!ruleCode || !subjectType || !subjectId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing ruleCode, subjectType, or subjectId' });
    }

    const compCase = await complianceEngine.createCase({
      ruleCode,
      subjectType,
      subjectId,
      organizationId: organizationId || user.organizationId,
      propertyId,
      severity,
      notes,
      deadlineDays,
      actorUserId: user.id
    });

    res.status(201).json({ success: true, complianceCase: compCase });
  } catch (err: any) {
    res.status(400).json({ error: 'CREATE_COMPLIANCE_CASE_FAILED', message: err.message });
  }
});

router.post('/compliance/cases/:id/review', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { status, decision, remediationAction, notes } = req.body;

    if (!status || !decision) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing status or decision' });
    }

    const caseId = getParam(req.params.id);
    const updated = await complianceEngine.reviewCase({
      caseId,
      status: status as ComplianceCaseStatus,
      decision: decision as ComplianceDecision,
      reviewerUserId: user.id,
      reviewerRoles: user.roles,
      remediationAction,
      notes
    });

    res.json({ success: true, complianceCase: updated });
  } catch (err: any) {
    const httpStatus = err.message.includes('UNAUTHORIZED') ? 403 : 400;
    res.status(httpStatus).json({ error: 'REVIEW_COMPLIANCE_CASE_FAILED', message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 5. DISPUTES
// ----------------------------------------------------------------------------
router.post('/disputes', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { title, category, description, respondentUserId, organizationId, propertyId, relatedEntityId, initialEvidence } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing title, category, or description.' });
    }

    const dispute = await disputeEngine.openDispute({
      title,
      category: category as DisputeCategory,
      description,
      initiatorUserId: user.id,
      respondentUserId,
      organizationId: organizationId || user.organizationId,
      propertyId,
      relatedEntityId,
      initialEvidence
    });

    res.status(201).json({ success: true, dispute });
  } catch (err: any) {
    res.status(400).json({ error: 'OPEN_DISPUTE_FAILED', message: err.message });
  }
});

router.get('/disputes', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);

    const { status, limit, offset } = req.query;

    const disputesList = await trustVerificationRepository.listDisputes({
      userId: scope.hasGlobalAuthority ? undefined : user.id,
      organizationId: scope.hasGlobalAuthority ? undefined : user.organizationId,
      status: status as string,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0
    });

    res.json({ success: true, count: disputesList.length, disputes: disputesList });
  } catch (err: any) {
    res.status(500).json({ error: 'LIST_DISPUTES_FAILED', message: err.message });
  }
});

router.get('/disputes/:id', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const disputeId = getParam(req.params.id);
    const dispute = await trustVerificationRepository.getDisputeById(disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dispute not found.' });
    }

    const parties = await trustVerificationRepository.getDisputeParties(dispute.id);
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);

    const isParty = parties.some(p => p.userId === user.id);
    if (!scope.hasGlobalAuthority && !isParty) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Access to dispute denied.' });
    }

    // Fetch evidence and apply party confidentiality filtering
    const allEvidence = await trustVerificationRepository.getDisputeEvidence(dispute.id, [
      DisputeEvidenceVisibility.PUBLIC_TO_PARTIES,
      DisputeEvidenceVisibility.PARTY_PRIVATE,
      DisputeEvidenceVisibility.INTERNAL_REVIEW,
      DisputeEvidenceVisibility.COMPLIANCE_PRIVATE,
      DisputeEvidenceVisibility.SECURITY_PRIVATE,
      DisputeEvidenceVisibility.AUDITOR_ONLY
    ]);

    const filteredEvidence = disputeEngine.filterEvidenceForCaller(allEvidence, user.id, user.roles);

    // Fetch events (include internal only if admin/compliance)
    const isInternalStaff = scope.hasGlobalAuthority || user.roles.some((r: string) => ['ADMIN', 'COMPLIANCE_ADMIN'].includes(r));
    const events = await trustVerificationRepository.getDisputeEvents(dispute.id, isInternalStaff);

    // Fetch appeals if any
    const appeals = await trustVerificationRepository.getDisputeAppeals(dispute.id);

    res.json({
      success: true,
      dispute,
      parties,
      evidence: filteredEvidence,
      events,
      appeals
    });
  } catch (err: any) {
    res.status(500).json({ error: 'GET_DISPUTE_FAILED', message: err.message });
  }
});

router.post('/disputes/:id/transition', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { targetStatus, resolutionOutcome, resolutionNotes, externalLegalRequired } = req.body;

    if (!targetStatus) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing targetStatus' });
    }

    const disputeId = getParam(req.params.id);
    const updated = await disputeEngine.transitionStatus({
      disputeId,
      targetStatus: targetStatus as DisputeState,
      resolutionOutcome: resolutionOutcome as DisputeResolutionOutcome,
      actorUserId: user.id,
      actorRole: user.roles[0] || 'USER',
      actorRoles: user.roles,
      resolutionNotes,
      externalLegalRequired
    });

    res.json({ success: true, dispute: updated });
  } catch (err: any) {
    const httpStatus = err.message.includes('FORBIDDEN') || err.message.includes('UNAUTHORIZED') ? 403 : 400;
    res.status(httpStatus).json({ error: 'TRANSITION_DISPUTE_FAILED', message: err.message });
  }
});

router.post('/disputes/:id/evidence', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { title, description, documentRef, visibility } = req.body;

    if (!title || !documentRef) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing title or documentRef' });
    }

    const disputeId = getParam(req.params.id);
    const dispute = await trustVerificationRepository.getDisputeById(disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Dispute not found.' });
    }

    const parties = await trustVerificationRepository.getDisputeParties(dispute.id);
    const isParty = parties.some(p => p.userId === user.id);
    const scope = await trustVerificationRepository.resolveUserPropertyScope(user.id, user.roles, user.organizationId);

    if (!isParty && !scope.hasGlobalAuthority) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only dispute parties or staff may submit evidence.' });
    }

    const checksum = disputeEngine.computeChecksum(documentRef + title + user.id);
    const evidence = await trustVerificationRepository.addDisputeEvidence({
      disputeId: dispute.id,
      submittedBy: user.id,
      title,
      description,
      documentRef,
      checksumSha256: checksum,
      visibility: (visibility as DisputeEvidenceVisibility) || DisputeEvidenceVisibility.PUBLIC_TO_PARTIES
    });

    // Record evidence submitted event
    await trustVerificationRepository.addDisputeEvent({
      disputeId: dispute.id,
      actorUserId: user.id,
      actorRole: user.roles[0] || 'USER',
      eventType: 'EVIDENCE_SUBMITTED',
      visibility: visibility === DisputeEvidenceVisibility.PUBLIC_TO_PARTIES ? 'PUBLIC_TO_PARTIES' : 'INTERNAL_ONLY',
      details: { title, evidenceId: evidence.id }
    });

    res.status(201).json({ success: true, evidence });
  } catch (err: any) {
    res.status(500).json({ error: 'ADD_EVIDENCE_FAILED', message: err.message });
  }
});

router.post('/disputes/:id/appeal', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const user = req.user!;
    const { appealReason } = req.body;

    if (!appealReason) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Missing appealReason' });
    }

    const disputeId = getParam(req.params.id);
    const appeal = await disputeEngine.fileAppeal({
      disputeId,
      appellantUserId: user.id,
      appealReason
    });

    res.status(201).json({ success: true, appeal });
  } catch (err: any) {
    const httpStatus = err.message.includes('UNAUTHORIZED') ? 403 : 400;
    res.status(httpStatus).json({ error: 'FILE_APPEAL_FAILED', message: err.message });
  }
});

// ----------------------------------------------------------------------------
// 6. TRUST EVENTS AUDIT LOG
// ----------------------------------------------------------------------------
router.get('/events/:entityType/:entityId', requireAuth, async (req: Request, res: Response) => {
  if (!trustVerificationRepository.isConfigured()) {
    return res.status(503).json({
      error: 'DATABASE_NOT_CONFIGURED',
      message: 'Trust database is unconfigured.'
    });
  }

  try {
    const entityType = getParam(req.params.entityType);
    const entityId = getParam(req.params.entityId);
    const { limit } = req.query;

    const events = await trustVerificationRepository.listTrustEvents(
      entityType, 
      entityId, 
      limit ? Number(limit) : 50
    );

    res.json({ success: true, count: events.length, events });
  } catch (err: any) {
    res.status(500).json({ error: 'LIST_TRUST_EVENTS_FAILED', message: err.message });
  }
});

export default router;

