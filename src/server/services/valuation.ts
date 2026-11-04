import { analyticsRepository } from '../repositories/analytics.js';
import { auditService } from './audit.js';
import { db } from '../../db/index.js';
import { properties } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { 
  ValuationMethod, 
  ValuationStatus, 
  ValuationConfidence, 
  PropertyValuationItem 
} from '../../types/analytics.js';

export interface CreateValuationInput {
  propertyId: string;
  valuationDate: string; // 'YYYY-MM-DD'
  estimatedValue: number;
  currency?: string;
  method: ValuationMethod;
  source: string;
  confidenceIndicator?: ValuationConfidence;
  documentUrl?: string;
  notes?: string;
  status?: ValuationStatus;
}

export class ValuationService {
  /**
   * Convert area from square feet to square meters:
   * 1 square meter = 10.76391042 square feet
   */
  static SQFT_PER_SQM = 10.76391042;

  /**
   * Calculate price per square foot and price per square meter
   */
  calculatePricePerArea(value: number, squareFeet?: number | null) {
    if (!squareFeet || squareFeet <= 0 || value <= 0) {
      return { pricePerSqFoot: null, pricePerSqMeter: null };
    }
    const pricePerSqFoot = Math.round((value / squareFeet) * 100) / 100;
    const squareMeters = squareFeet / ValuationService.SQFT_PER_SQM;
    const pricePerSqMeter = Math.round((value / squareMeters) * 100) / 100;

    return { pricePerSqFoot, pricePerSqMeter };
  }

  /**
   * Create a new valuation with strict authorization checks
   */
  async createValuation(
    user: { id: string; organizationId?: string; roles: string[] },
    input: CreateValuationInput
  ): Promise<PropertyValuationItem> {
    const scope = await analyticsRepository.resolveUserPropertyScope(user, input.propertyId);
    if (!scope.propertyIds.includes(input.propertyId)) {
      const err: any = new Error('AUTHORITY_REQUIRED: Access denied for specified property');
      err.status = 403;
      throw err;
    }

    // Role Guard: Only Owner, Company, and Platform Admin can record valuations
    const isAuthorizedRole = scope.isPlatformAdmin || scope.isOwner || scope.isCompany;
    if (!isAuthorizedRole) {
      const err: any = new Error('FORBIDDEN: Insufficient role authority to record property valuation');
      err.status = 403;
      throw err;
    }

    // Validation: estimatedValue must be a positive number
    if (!input.estimatedValue || input.estimatedValue <= 0) {
      const err: any = new Error('VALIDATION_ERROR: estimatedValue must be a positive number');
      err.status = 400;
      throw err;
    }

    if (!input.valuationDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.valuationDate)) {
      const err: any = new Error('VALIDATION_ERROR: valuationDate must be in YYYY-MM-DD format');
      err.status = 400;
      throw err;
    }

    // AI Safety Rule: AI_ADVISORY can never be marked as AUTHORITATIVE_DEED or directly FINAL without human review
    let effectiveStatus = input.status || 'FINAL';
    if (input.method === 'AI_ADVISORY') {
      effectiveStatus = 'DRAFT'; // AI valuations start as advisory drafts
    }

    // Supersede previous FINAL valuation if creating a new FINAL valuation
    if (effectiveStatus === 'FINAL') {
      const existingValuations = await analyticsRepository.getValuationHistory(input.propertyId);
      const activeFinal = existingValuations.find(v => v.status === 'FINAL');
      if (activeFinal) {
        await analyticsRepository.supersedeValuation(activeFinal.id);
      }
    }

    const inserted = await analyticsRepository.insertValuation({
      propertyId: input.propertyId,
      valuationDate: input.valuationDate,
      estimatedValue: String(input.estimatedValue),
      currency: input.currency || 'USD',
      method: input.method,
      source: input.source,
      confidenceIndicator: input.confidenceIndicator || 'MEDIUM',
      reviewerUserId: user.id,
      documentUrl: input.documentUrl || null,
      notes: input.notes || null,
      status: effectiveStatus,
    });

    // Fetch property area for price/area calculation
    const [prop] = await db.select({ squareFeet: properties.squareFeet }).from(properties).where(eq(properties.id, input.propertyId)).limit(1);
    const { pricePerSqFoot, pricePerSqMeter } = this.calculatePricePerArea(Number(inserted.estimatedValue), prop?.squareFeet);

    await auditService.logAction({
      actorUserId: user.id,
      actorRole: user.roles[0] as string,
      action: 'RECORD_PROPERTY_VALUATION',
      resourceType: 'PropertyValuation',
      resourceId: inserted.id,
      changes: {
        propertyId: input.propertyId,
        estimatedValue: input.estimatedValue,
        currency: input.currency || 'USD',
        method: input.method,
        status: effectiveStatus
      },
      ipAddress: '127.0.0.1'
    });

    return {
      id: inserted.id,
      propertyId: inserted.propertyId,
      valuationDate: inserted.valuationDate,
      estimatedValue: Number(inserted.estimatedValue),
      currency: inserted.currency,
      method: inserted.method as ValuationMethod,
      source: inserted.source,
      confidenceIndicator: inserted.confidenceIndicator as ValuationConfidence,
      reviewerUserId: inserted.reviewerUserId,
      documentUrl: inserted.documentUrl,
      notes: inserted.notes,
      status: inserted.status as ValuationStatus,
      pricePerSqFoot,
      pricePerSqMeter,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  }

  /**
   * Get valuation history for an authorized property
   */
  async getValuationHistory(
    user: { id: string; organizationId?: string; roles: string[] },
    propertyId: string
  ): Promise<PropertyValuationItem[]> {
    const scope = await analyticsRepository.resolveUserPropertyScope(user, propertyId);
    if (!scope.propertyIds.includes(propertyId)) {
      const err: any = new Error('AUTHORITY_REQUIRED: Access denied for specified property');
      err.status = 403;
      throw err;
    }

    const [prop] = await db.select({ squareFeet: properties.squareFeet }).from(properties).where(eq(properties.id, propertyId)).limit(1);
    const records = await analyticsRepository.getValuationHistory(propertyId);

    return records.map(r => {
      const val = Number(r.estimatedValue);
      const { pricePerSqFoot, pricePerSqMeter } = this.calculatePricePerArea(val, prop?.squareFeet);
      return {
        id: r.id,
        propertyId: r.propertyId,
        valuationDate: r.valuationDate,
        estimatedValue: val,
        currency: r.currency,
        method: r.method as ValuationMethod,
        source: r.source,
        confidenceIndicator: r.confidenceIndicator as ValuationConfidence,
        reviewerUserId: r.reviewerUserId,
        documentUrl: r.documentUrl,
        notes: r.notes,
        status: r.status as ValuationStatus,
        pricePerSqFoot,
        pricePerSqMeter,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      };
    });
  }

  /**
   * Get the latest FINAL valuation for a property
   */
  async getLatestValuation(
    user: { id: string; organizationId?: string; roles: string[] },
    propertyId: string
  ): Promise<PropertyValuationItem | null> {
    const history = await this.getValuationHistory(user, propertyId);
    const latest = history.find(h => h.status === 'FINAL') || history[0] || null;
    return latest;
  }
}

export const valuationService = new ValuationService();
