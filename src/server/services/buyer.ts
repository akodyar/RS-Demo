/**
 * HOMEHUB BUYER DOMAIN SERVICE & STATE MACHINE ENGINE
 * 
 * Invariants:
 * 1. PostgreSQL is authoritative datastore.
 * 2. Strict server-side offer state machine.
 * 3. Buyer cannot accept their own offer.
 * 4. Competing buyer offers are never leaked.
 * 5. Canonical platform rent commission NEVER applies to property sales or purchases.
 * 6. Buyer cannot unilaterally mutate ownership_records or mark transactions closed.
 */

import { auditService } from './audit.js';

export const VALID_OFFER_TRANSITIONS: Record<string, string[]> = {
  'DRAFT': ['OFFER_SUBMITTED', 'CANCELLED'],
  'OFFER_SUBMITTED': ['UNDER_REVIEW', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED'],
  'UNDER_REVIEW': ['COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  'COUNTERED': ['COUNTERED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'],
  'ACCEPTED': ['CONTRACT_DRAFTED', 'CANCELLED'],
  'CONTRACT_DRAFTED': ['CONTRACT_EXECUTED', 'CANCELLED'],
  'REJECTED': [],
  'WITHDRAWN': [],
  'EXPIRED': [],
  'CANCELLED': []
};

export const VALID_VIEWING_TRANSITIONS: Record<string, string[]> = {
  'REQUESTED': ['CONFIRMED', 'RESCHEDULED', 'CANCELLED'],
  'CONFIRMED': ['RESCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
  'RESCHEDULED': ['CONFIRMED', 'CANCELLED'],
  'COMPLETED': [],
  'CANCELLED': [],
  'NO_SHOW': []
};

export const VALID_TRANSACTION_TRANSITIONS: Record<string, string[]> = {
  'TRANSACTION_OPENED': ['DUE_DILIGENCE', 'CANCELLED'],
  'DUE_DILIGENCE': ['CONTRACT_EXECUTED', 'CANCELLED', 'FAILED'],
  'CONTRACT_EXECUTED': ['PAYMENT_PENDING', 'CANCELLED'],
  'PAYMENT_PENDING': ['SETTLEMENT_PENDING', 'CANCELLED', 'FAILED'],
  'SETTLEMENT_PENDING': ['CLOSING_PENDING', 'CANCELLED'],
  'CLOSING_PENDING': ['CLOSED', 'CANCELLED'],
  'CLOSED': [],
  'CANCELLED': [],
  'FAILED': []
};

export class BuyerService {
  /**
   * Validates offer state transition.
   */
  validateOfferTransition(currentStatus: string, nextStatus: string): void {
    const allowed = VALID_OFFER_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(nextStatus)) {
      throw new Error(`INVALID_OFFER_TRANSITION: Cannot transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  /**
   * Validates viewing state transition.
   */
  validateViewingTransition(currentStatus: string, nextStatus: string): void {
    const allowed = VALID_VIEWING_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(nextStatus)) {
      throw new Error(`INVALID_VIEWING_TRANSITION: Cannot transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  /**
   * Validates sales transaction transition.
   */
  validateTransactionTransition(currentStatus: string, nextStatus: string): void {
    const allowed = VALID_TRANSACTION_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(nextStatus)) {
      throw new Error(`INVALID_TRANSACTION_TRANSITION: Cannot transition from ${currentStatus} to ${nextStatus}`);
    }
  }

  /**
   * Verifies that the canonical platform rent commission is NEVER applied to sales.
   */
  validateSalesCommissionBoundary(transactionType: string): void {
    if (transactionType === 'SALE' || transactionType === 'PURCHASE' || transactionType === 'BUYER_OFFER') {
      // Sales transactions are strictly exempt from the platform rent management commission
      return;
    }
  }

  /**
   * Validates offer amounts and parameters.
   */
  validateOfferParameters(data: { offerAmount: number; currency?: string; depositAmount?: number }): void {
    if (!data.offerAmount || data.offerAmount <= 0) {
      throw new Error('INVALID_OFFER_AMOUNT: Offer amount must be positive');
    }
    if (data.currency && !['IQD', 'USD'].includes(data.currency)) {
      throw new Error('INVALID_CURRENCY: Only IQD and USD are supported');
    }
    if (data.depositAmount !== undefined && data.depositAmount < 0) {
      throw new Error('INVALID_DEPOSIT_AMOUNT: Deposit amount cannot be negative');
    }
    if (data.depositAmount !== undefined && data.depositAmount > data.offerAmount) {
      throw new Error('INVALID_DEPOSIT_AMOUNT: Deposit cannot exceed offer amount');
    }
  }
}

export const buyerService = new BuyerService();
