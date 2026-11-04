import { 
  TrustRiskLevel, 
  RiskTargetType, 
  RiskFactor, 
  RiskSignalItem,
  RiskSignalType
} from '../../types/trust-verification.js';
import { trustVerificationRepository } from '../repositories/trust-verification.js';
import { auditService } from './audit.js';

export class RiskEngine {
  /**
   * Deterministically evaluates the risk score based on active signals and platform evidence
   */
  calculateRiskFromSignals(signals: any[]): {
    score: number;
    level: TrustRiskLevel;
    factors: RiskFactor[];
    contributingSignalIds: string[];
  } {
    let rawScore = 0;
    const factors: RiskFactor[] = [];
    const contributingSignalIds: string[] = [];

    // Weight table for signals
    const weightMap: Record<string, { weight: number; baseImpact: number }> = {
      IDENTITY_VERIFICATION_FAILURE: { weight: 1.5, baseImpact: 35 },
      OWNERSHIP_INCONSISTENCY: { weight: 1.8, baseImpact: 40 },
      EXPIRED_CREDENTIALS: { weight: 1.0, baseImpact: 15 },
      SUSPICIOUS_LISTING_PATTERN: { weight: 1.2, baseImpact: 25 },
      REPEATED_DISPUTES: { weight: 1.4, baseImpact: 30 },
      PAYMENT_ANOMALY: { weight: 1.6, baseImpact: 35 },
      UNUSUAL_TRANSACTION_BEHAVIOR: { weight: 1.5, baseImpact: 30 },
      MANAGEMENT_AUTHORIZATION_ANOMALY: { weight: 1.7, baseImpact: 40 },
      VENDOR_CREDENTIAL_SUSPENDED: { weight: 1.3, baseImpact: 25 },
      VERIFICATION_REVERSAL: { weight: 1.5, baseImpact: 30 },
      DUPLICATE_IDENTITY_SUSPECTED: { weight: 1.8, baseImpact: 45 },
      INCONSISTENT_PROPERTY_INFO: { weight: 1.2, baseImpact: 20 }
    };

    for (const sig of signals) {
      if (sig.status !== 'ACTIVE') continue;

      const config = weightMap[sig.signalType] || { weight: 1.0, baseImpact: 15 };
      const impactScore = Math.min(Math.round(config.baseImpact * config.weight), 50);

      rawScore += impactScore;
      contributingSignalIds.push(sig.id);

      factors.push({
        factor: sig.signalType,
        weight: config.weight,
        impactScore,
        reason: sig.description,
        signalId: sig.id,
        evidenceRef: sig.evidenceRef || undefined
      });
    }

    // Clamp score to 0 - 100 range
    const finalScore = Math.min(Math.max(rawScore, 0), 100);

    // Map numeric score to deterministic Risk Level
    let level: TrustRiskLevel = TrustRiskLevel.LOW;
    if (finalScore >= 75) {
      level = TrustRiskLevel.CRITICAL;
    } else if (finalScore >= 50) {
      level = TrustRiskLevel.HIGH;
    } else if (finalScore >= 25) {
      level = TrustRiskLevel.MEDIUM;
    }

    return {
      score: finalScore,
      level,
      factors,
      contributingSignalIds
    };
  }

  /**
   * Evaluates or recalculates risk assessment for an entity and persists the record
   */
  async assessRisk(params: {
    targetType: RiskTargetType;
    targetId: string;
    organizationId?: string;
    propertyId?: string;
    triggerActorId?: string;
  }) {
    if (!trustVerificationRepository.isConfigured()) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // 1. Fetch current active signals
    const activeSignals = await trustVerificationRepository.listActiveRiskSignals(params.targetType, params.targetId);

    // 2. Fetch previous assessment to track level changes
    const previous = await trustVerificationRepository.getLatestRiskAssessment(params.targetType, params.targetId);

    // 3. Compute deterministic score
    const computation = this.calculateRiskFromSignals(activeSignals);

    // 4. Persist assessment
    const assessment = await trustVerificationRepository.saveRiskAssessment({
      targetType: params.targetType,
      targetId: params.targetId,
      score: computation.score,
      level: computation.level,
      factors: computation.factors,
      contributingSignalIds: computation.contributingSignalIds,
      ruleVersion: '1.0',
      organizationId: params.organizationId,
      propertyId: params.propertyId
    });

    // 5. Track state changes in Trust Events & Audit if level changed
    const prevLevel = previous?.level || 'LOW';
    if (prevLevel !== computation.level) {
      await trustVerificationRepository.recordTrustEvent({
        eventType: computation.score > (Number(previous?.score) || 0) ? 'RISK_LEVEL_RAISED' : 'RISK_LEVEL_REDUCED',
        entityType: params.targetType,
        entityId: params.targetId,
        actorUserId: params.triggerActorId,
        fromState: prevLevel,
        toState: computation.level,
        reason: `Risk level changed from ${prevLevel} to ${computation.level} (Score: ${computation.score})`,
        organizationId: params.organizationId,
        propertyId: params.propertyId
      });

      await auditService.logAction({
        actorUserId: params.triggerActorId || 'SYSTEM_RISK_ENGINE',
        actorRole: 'SYSTEM',
        action: 'RISK_LEVEL_CHANGED',
        resourceType: params.targetType,
        resourceId: params.targetId,
        changes: { previousLevel: prevLevel, newLevel: computation.level, score: computation.score }
      });
    }

    return assessment;
  }
}

export const riskEngine = new RiskEngine();
