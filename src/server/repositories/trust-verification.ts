import { db } from '../../db/index.js';
import { 
  verificationRecords, 
  verificationEvidence, 
  riskSignals, 
  riskAssessments, 
  complianceRules, 
  complianceCases, 
  disputes, 
  disputeParties, 
  disputeEvidence, 
  disputeEvents, 
  disputeAppeals, 
  trustEvents,
  ownershipRecords,
  managementAgreements
} from '../../db/schema.js';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { 
  VerificationState, 
  DisputeState, 
  DisputeResolutionOutcome,
  DisputeEvidenceVisibility,
  TrustSubjectType,
  VerificationType,
  EvidenceType,
  EvidenceStatus,
  TrustRiskLevel,
  RiskTargetType,
  RiskSignalType,
  ComplianceCaseStatus,
  ComplianceDecision,
  DisputeCategory
} from '../../types/trust-verification.js';

export class TrustVerificationRepository {
  isConfigured(): boolean {
    return Boolean(process.env.DATABASE_URL || (process.env.SQL_HOST && process.env.SQL_DB_NAME));
  }

  // --------------------------------------------------------------------------
  // USER PROPERTY & ORGANIZATION SCOPE RESOLUTION
  // --------------------------------------------------------------------------
  async resolveUserPropertyScope(userId: string, roles: string[], organizationId?: string): Promise<{
    hasGlobalAuthority: boolean;
    ownedPropertyIds: string[];
    managedPropertyIds: string[];
    accessiblePropertyIds: string[];
  }> {
    if (!this.isConfigured()) {
      return {
        hasGlobalAuthority: false,
        ownedPropertyIds: [],
        managedPropertyIds: [],
        accessiblePropertyIds: []
      };
    }

    const hasGlobal = roles.some(r => [
      'SUPER_ADMIN', 
      'PLATFORM_ADMIN', 
      'ADMIN', 
      'COMPLIANCE_ADMIN', 
      'VERIFICATION_ADMIN', 
      'AUDITOR'
    ].includes(r));

    if (hasGlobal) {
      return {
        hasGlobalAuthority: true,
        ownedPropertyIds: [],
        managedPropertyIds: [],
        accessiblePropertyIds: []
      };
    }

    let ownedIds: string[] = [];
    let managedIds: string[] = [];

    try {
      // 1. Authoritative ownership from ownership_records (must be VERIFIED)
      const owned = await db.select({ propertyId: ownershipRecords.propertyId })
        .from(ownershipRecords)
        .where(and(
          eq(ownershipRecords.ownerId, userId),
          eq(ownershipRecords.status, 'VERIFIED')
        ));
      ownedIds = owned.map(o => o.propertyId);

      // 2. Active management agreements for the company
      if (organizationId && roles.some(r => ['COMPANY', 'COMPANY_MEMBER', 'COMPANY_ADMIN'].includes(r))) {
        const managed = await db.select({ propertyId: managementAgreements.propertyId })
          .from(managementAgreements)
          .where(and(
            eq(managementAgreements.companyId, organizationId),
            eq(managementAgreements.status, 'ACTIVE')
          ));
        managedIds = managed.map(m => m.propertyId);
      }
    } catch (err) {
      // Unreachable or offline database fails closed safely
      ownedIds = [];
      managedIds = [];
    }

    const accessible = Array.from(new Set([...ownedIds, ...managedIds]));

    return {
      hasGlobalAuthority: false,
      ownedPropertyIds: ownedIds,
      managedPropertyIds: managedIds,
      accessiblePropertyIds: accessible
    };
  }

  // --------------------------------------------------------------------------
  // VERIFICATION RECORDS
  // --------------------------------------------------------------------------
  async createVerificationRecord(data: {
    subjectType: TrustSubjectType;
    subjectId: string;
    verificationType: VerificationType;
    organizationId?: string;
    propertyId?: string;
    ownerId?: string;
    submittedBy: string;
    metadata?: Record<string, any>;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [record] = await db.insert(verificationRecords).values({
      subjectType: data.subjectType,
      subjectId: data.subjectId,
      verificationType: data.verificationType,
      status: VerificationState.SUBMITTED,
      organizationId: data.organizationId,
      propertyId: data.propertyId,
      ownerId: data.ownerId,
      submittedBy: data.submittedBy,
      submittedAt: new Date(),
      metadata: data.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    return record;
  }

  async getVerificationRecordById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [record] = await db.select().from(verificationRecords).where(eq(verificationRecords.id, id));
    return record || null;
  }

  async listVerificationRecords(filters: {
    subjectType?: TrustSubjectType;
    subjectId?: string;
    organizationId?: string;
    propertyId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const conditions: any[] = [];
    if (filters.subjectType) conditions.push(eq(verificationRecords.subjectType, filters.subjectType));
    if (filters.subjectId) conditions.push(eq(verificationRecords.subjectId, filters.subjectId));
    if (filters.organizationId) conditions.push(eq(verificationRecords.organizationId, filters.organizationId));
    if (filters.propertyId) conditions.push(eq(verificationRecords.propertyId, filters.propertyId));
    if (filters.status) conditions.push(eq(verificationRecords.status, filters.status));

    const query = db.select().from(verificationRecords);
    if (conditions.length > 0) {
      return await query.where(and(...conditions))
        .orderBy(desc(verificationRecords.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0);
    }

    return await query
      .orderBy(desc(verificationRecords.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  async updateVerificationStatus(
    id: string, 
    status: VerificationState, 
    reviewerId: string, 
    reviewNotes?: string, 
    rejectionReason?: string, 
    expiresAt?: Date
  ) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [updated] = await db.update(verificationRecords)
      .set({
        status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        rejectionReason: rejectionReason || null,
        expiresAt: expiresAt || null,
        updatedAt: new Date()
      })
      .where(eq(verificationRecords.id, id))
      .returning();

    return updated || null;
  }

  // --------------------------------------------------------------------------
  // VERIFICATION EVIDENCE
  // --------------------------------------------------------------------------
  async addVerificationEvidence(data: {
    verificationRecordId: string;
    evidenceType: EvidenceType;
    title: string;
    documentRef: string;
    checksumSha256: string;
    submittedBy: string;
    notes?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [evidence] = await db.insert(verificationEvidence).values({
      verificationRecordId: data.verificationRecordId,
      evidenceType: data.evidenceType,
      title: data.title,
      documentRef: data.documentRef,
      checksumSha256: data.checksumSha256,
      status: EvidenceStatus.PENDING,
      submittedBy: data.submittedBy,
      submittedAt: new Date(),
      notes: data.notes || null,
      createdAt: new Date()
    }).returning();

    return evidence;
  }

  async getEvidenceByRecordId(verificationRecordId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return await db.select().from(verificationEvidence)
      .where(eq(verificationEvidence.verificationRecordId, verificationRecordId))
      .orderBy(desc(verificationEvidence.createdAt));
  }

  // --------------------------------------------------------------------------
  // RISK SIGNALS & ASSESSMENTS
  // --------------------------------------------------------------------------
  async createRiskSignal(data: {
    targetType: RiskTargetType;
    targetId: string;
    signalType: RiskSignalType;
    riskLevel: TrustRiskLevel;
    numericScore: number;
    description: string;
    source: string;
    evidenceRef?: string;
    organizationId?: string;
    propertyId?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [signal] = await db.insert(riskSignals).values({
      targetType: data.targetType,
      targetId: data.targetId,
      signalType: data.signalType,
      riskLevel: data.riskLevel,
      numericScore: String(data.numericScore),
      description: data.description,
      source: data.source,
      status: 'ACTIVE',
      evidenceRef: data.evidenceRef || null,
      organizationId: data.organizationId || null,
      propertyId: data.propertyId || null,
      createdAt: new Date()
    }).returning();

    return signal;
  }

  async listActiveRiskSignals(targetType: RiskTargetType, targetId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return await db.select().from(riskSignals)
      .where(and(
        eq(riskSignals.targetType, targetType),
        eq(riskSignals.targetId, targetId),
        eq(riskSignals.status, 'ACTIVE')
      ))
      .orderBy(desc(riskSignals.createdAt));
  }

  async saveRiskAssessment(data: {
    targetType: RiskTargetType;
    targetId: string;
    score: number;
    level: TrustRiskLevel;
    factors: any[];
    contributingSignalIds: string[];
    ruleVersion?: string;
    expiresAt?: Date;
    reviewedBy?: string;
    reviewNotes?: string;
    organizationId?: string;
    propertyId?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    // Supersede any existing CURRENT assessments for this target
    await db.update(riskAssessments)
      .set({ status: 'SUPERSEDED' })
      .where(and(
        eq(riskAssessments.targetType, data.targetType),
        eq(riskAssessments.targetId, data.targetId),
        eq(riskAssessments.status, 'CURRENT')
      ));

    const [assessment] = await db.insert(riskAssessments).values({
      targetType: data.targetType,
      targetId: data.targetId,
      score: String(data.score),
      level: data.level,
      factors: data.factors,
      contributingSignalIds: data.contributingSignalIds,
      ruleVersion: data.ruleVersion || '1.0',
      calculatedAt: new Date(),
      expiresAt: data.expiresAt || null,
      status: 'CURRENT',
      reviewedBy: data.reviewedBy || null,
      reviewNotes: data.reviewNotes || null,
      organizationId: data.organizationId || null,
      propertyId: data.propertyId || null,
      createdAt: new Date()
    }).returning();

    return assessment;
  }

  async getLatestRiskAssessment(targetType: RiskTargetType, targetId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [assessment] = await db.select().from(riskAssessments)
      .where(and(
        eq(riskAssessments.targetType, targetType),
        eq(riskAssessments.targetId, targetId),
        eq(riskAssessments.status, 'CURRENT')
      ))
      .orderBy(desc(riskAssessments.calculatedAt))
      .limit(1);

    return assessment || null;
  }

  // --------------------------------------------------------------------------
  // COMPLIANCE RULES & CASES
  // --------------------------------------------------------------------------
  async listComplianceRules(jurisdiction?: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    if (jurisdiction) {
      return await db.select().from(complianceRules).where(and(
        eq(complianceRules.active, true), 
        eq(complianceRules.jurisdiction, jurisdiction)
      ));
    }
    return await db.select().from(complianceRules).where(eq(complianceRules.active, true));
  }

  async getComplianceRuleByCode(code: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [rule] = await db.select().from(complianceRules).where(eq(complianceRules.code, code));
    return rule || null;
  }

  async createComplianceCase(data: {
    ruleId: string;
    subjectType: TrustSubjectType;
    subjectId: string;
    organizationId?: string;
    propertyId?: string;
    severity: TrustRiskLevel;
    notes?: string;
    deadline?: Date;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [compCase] = await db.insert(complianceCases).values({
      ruleId: data.ruleId,
      subjectType: data.subjectType,
      subjectId: data.subjectId,
      organizationId: data.organizationId || null,
      propertyId: data.propertyId || null,
      severity: data.severity,
      status: ComplianceCaseStatus.OPEN,
      decision: ComplianceDecision.PENDING,
      notes: data.notes || null,
      deadline: data.deadline || null,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    return compCase;
  }

  async getComplianceCaseById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [compCase] = await db.select().from(complianceCases).where(eq(complianceCases.id, id));
    return compCase || null;
  }

  async listComplianceCases(filters: {
    subjectType?: TrustSubjectType;
    subjectId?: string;
    organizationId?: string;
    propertyId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const conditions: any[] = [];
    if (filters.subjectType) conditions.push(eq(complianceCases.subjectType, filters.subjectType));
    if (filters.subjectId) conditions.push(eq(complianceCases.subjectId, filters.subjectId));
    if (filters.organizationId) conditions.push(eq(complianceCases.organizationId, filters.organizationId));
    if (filters.propertyId) conditions.push(eq(complianceCases.propertyId, filters.propertyId));
    if (filters.status) conditions.push(eq(complianceCases.status, filters.status));

    const query = db.select().from(complianceCases);
    if (conditions.length > 0) {
      return await query.where(and(...conditions))
        .orderBy(desc(complianceCases.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0);
    }

    return await query
      .orderBy(desc(complianceCases.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  async updateComplianceCaseStatus(
    id: string, 
    status: ComplianceCaseStatus, 
    decision: ComplianceDecision, 
    resolvedBy?: string, 
    remediationAction?: string, 
    notes?: string
  ) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [updated] = await db.update(complianceCases)
      .set({
        status,
        decision,
        resolvedBy: resolvedBy || null,
        resolvedAt: ['RESOLVED', 'CLOSED'].includes(status) ? new Date() : null,
        remediationAction: remediationAction || null,
        notes: notes || null,
        updatedAt: new Date()
      })
      .where(eq(complianceCases.id, id))
      .returning();

    return updated || null;
  }

  // --------------------------------------------------------------------------
  // DISPUTES
  // --------------------------------------------------------------------------
  async createDispute(data: {
    disputeNumber: string;
    title: string;
    category: DisputeCategory;
    description: string;
    initiatorUserId: string;
    respondentUserId?: string;
    organizationId?: string;
    propertyId?: string;
    relatedEntityId?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [dispute] = await db.insert(disputes).values({
      disputeNumber: data.disputeNumber,
      title: data.title,
      category: data.category,
      description: data.description,
      status: DisputeState.OPEN,
      resolutionOutcome: DisputeResolutionOutcome.PENDING,
      initiatorUserId: data.initiatorUserId,
      respondentUserId: data.respondentUserId || null,
      organizationId: data.organizationId || null,
      propertyId: data.propertyId || null,
      relatedEntityId: data.relatedEntityId || null,
      externalLegalReviewRequired: false,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    // Automatically add initiator as party
    await db.insert(disputeParties).values({
      disputeId: dispute.id,
      userId: data.initiatorUserId,
      role: 'INITIATOR',
      organizationId: data.organizationId || null,
      status: 'ACTIVE',
      joinedAt: new Date()
    });

    // If respondent user specified, add respondent as party
    if (data.respondentUserId) {
      await db.insert(disputeParties).values({
        disputeId: dispute.id,
        userId: data.respondentUserId,
        role: 'RESPONDENT',
        status: 'NOTIFIED',
        joinedAt: new Date()
      });
    }

    return dispute;
  }

  async getDisputeById(id: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [dispute] = await db.select().from(disputes).where(eq(disputes.id, id));
    return dispute || null;
  }

  async listDisputes(filters: {
    userId?: string;
    organizationId?: string;
    propertyId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const conditions: any[] = [];
    if (filters.organizationId) conditions.push(eq(disputes.organizationId, filters.organizationId));
    if (filters.propertyId) conditions.push(eq(disputes.propertyId, filters.propertyId));
    if (filters.status) conditions.push(eq(disputes.status, filters.status));

    // If filtering by user, user can be initiator, respondent, or party
    if (filters.userId) {
      const userParties = await db.select({ disputeId: disputeParties.disputeId })
        .from(disputeParties)
        .where(eq(disputeParties.userId, filters.userId));
      
      const disputeIds = userParties.map(p => p.disputeId);
      if (disputeIds.length === 0) return [];

      conditions.push(inArray(disputes.id, disputeIds));
    }

    const query = db.select().from(disputes);
    if (conditions.length > 0) {
      return await query.where(and(...conditions))
        .orderBy(desc(disputes.createdAt))
        .limit(filters.limit || 50)
        .offset(filters.offset || 0);
    }

    return await query
      .orderBy(desc(disputes.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  async updateDisputeStatus(
    id: string, 
    status: DisputeState, 
    resolutionOutcome: DisputeResolutionOutcome, 
    assignedReviewerId?: string, 
    resolutionNotes?: string, 
    externalLegalRequired = false
  ) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');

    const [updated] = await db.update(disputes)
      .set({
        status,
        resolutionOutcome,
        assignedReviewerId: assignedReviewerId || null,
        resolutionNotes: resolutionNotes || null,
        externalLegalReviewRequired: externalLegalRequired,
        resolvedAt: [DisputeState.RESOLVED, DisputeState.CLOSED].includes(status) ? new Date() : null,
        closedAt: status === DisputeState.CLOSED ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(disputes.id, id))
      .returning();

    return updated || null;
  }

  async addDisputeParty(data: {
    disputeId: string;
    userId: string;
    role: string;
    organizationId?: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [party] = await db.insert(disputeParties).values({
      disputeId: data.disputeId,
      userId: data.userId,
      role: data.role,
      organizationId: data.organizationId || null,
      status: 'ACTIVE',
      joinedAt: new Date()
    }).returning();
    return party;
  }

  async getDisputeParties(disputeId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return await db.select().from(disputeParties)
      .where(eq(disputeParties.disputeId, disputeId));
  }

  async addDisputeEvidence(data: {
    disputeId: string;
    submittedBy: string;
    title: string;
    description?: string;
    documentRef: string;
    checksumSha256: string;
    visibility: DisputeEvidenceVisibility;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [evidence] = await db.insert(disputeEvidence).values({
      disputeId: data.disputeId,
      submittedBy: data.submittedBy,
      title: data.title,
      description: data.description || null,
      documentRef: data.documentRef,
      checksumSha256: data.checksumSha256,
      visibility: data.visibility,
      status: 'ACTIVE',
      submittedAt: new Date()
    }).returning();
    return evidence;
  }

  async getDisputeEvidence(disputeId: string, allowedVisibilities: DisputeEvidenceVisibility[]) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return await db.select().from(disputeEvidence)
      .where(and(
        eq(disputeEvidence.disputeId, disputeId),
        inArray(disputeEvidence.visibility, allowedVisibilities)
      ))
      .orderBy(desc(disputeEvidence.submittedAt));
  }

  async addDisputeEvent(data: {
    disputeId: string;
    actorUserId?: string;
    actorRole: string;
    eventType: string;
    visibility: 'PUBLIC_TO_PARTIES' | 'INTERNAL_ONLY';
    fromStatus?: string;
    toStatus?: string;
    details?: Record<string, any>;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [event] = await db.insert(disputeEvents).values({
      disputeId: data.disputeId,
      actorUserId: data.actorUserId || null,
      actorRole: data.actorRole,
      eventType: data.eventType,
      visibility: data.visibility,
      fromStatus: data.fromStatus || null,
      toStatus: data.toStatus || null,
      details: data.details || {},
      timestamp: new Date()
    }).returning();
    return event;
  }

  async getDisputeEvents(disputeId: string, includeInternal = false) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const conditions = [eq(disputeEvents.disputeId, disputeId)];
    if (!includeInternal) {
      conditions.push(eq(disputeEvents.visibility, 'PUBLIC_TO_PARTIES'));
    }
    return await db.select().from(disputeEvents)
      .where(and(...conditions))
      .orderBy(desc(disputeEvents.timestamp));
  }

  async createDisputeAppeal(data: {
    disputeId: string;
    appellantUserId: string;
    originalResolutionOutcome: DisputeResolutionOutcome;
    appealReason: string;
  }) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    const [appeal] = await db.insert(disputeAppeals).values({
      disputeId: data.disputeId,
      appellantUserId: data.appellantUserId,
      originalResolutionOutcome: data.originalResolutionOutcome,
      appealReason: data.appealReason,
      status: 'FILED',
      filedAt: new Date()
    }).returning();
    return appeal;
  }

  async getDisputeAppeals(disputeId: string) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return await db.select().from(disputeAppeals)
      .where(eq(disputeAppeals.disputeId, disputeId))
      .orderBy(desc(disputeAppeals.filedAt));
  }

  // --------------------------------------------------------------------------
  // TRUST EVENTS & AUDIT LOG
  // --------------------------------------------------------------------------
  async recordTrustEvent(data: {
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
  }) {
    if (!this.isConfigured()) return null;

    try {
      const [event] = await db.insert(trustEvents).values({
        eventType: data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        actorUserId: data.actorUserId || null,
        actorRole: data.actorRole || null,
        fromState: data.fromState || null,
        toState: data.toState || null,
        reason: data.reason || null,
        evidenceRef: data.evidenceRef || null,
        correlationId: data.correlationId || null,
        organizationId: data.organizationId || null,
        propertyId: data.propertyId || null,
        metadata: data.metadata || {},
        timestamp: new Date()
      }).returning();
      return event;
    } catch (err: any) {
      console.error('[TRUST_EVENT_INSERT_FAILED]:', err?.message || err);
      return null;
    }
  }

  async listTrustEvents(entityType: string, entityId: string, limit = 50) {
    if (!this.isConfigured()) throw new Error('DATABASE_NOT_CONFIGURED');
    return await db.select().from(trustEvents)
      .where(and(
        eq(trustEvents.entityType, entityType),
        eq(trustEvents.entityId, entityId)
      ))
      .orderBy(desc(trustEvents.timestamp))
      .limit(limit);
  }
}

export const trustVerificationRepository = new TrustVerificationRepository();
