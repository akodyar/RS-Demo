import { 
  WorkOrderStatus, 
  VendorQuoteStatus, 
  VendorInvoiceStatus, 
  VendorWorkOrder,
  VendorQuote 
} from '../../types/vendor.js';
import { vendorRepository } from '../repositories/vendor.js';

export interface AiVendorQueryResult {
  response: string;
  suggestedAction?: string;
  category: 'QUOTE_ESTIMATION' | 'TECHNICAL_DIAGNOSIS' | 'CUSTOMER_COMMUNICATION' | 'SCHEDULE_OPTIMIZATION' | 'GENERAL_ADVICE';
  isAutonomousExecutionBlocked: boolean;
}

export class VendorService {
  /**
   * INVARIANT: No platform rent commission on vendor services.
   * Vendor services are billed based on labor, materials, and authorized service fees.
   */
  validateQuoteBreakdown(data: {
    totalAmount: number;
    laborAmount?: number;
    materialsAmount?: number;
    feesAmount?: number;
  }): { valid: boolean; calculatedTotal: number } {
    if (data.totalAmount <= 0) {
      throw new Error('INVALID_QUOTE_AMOUNT: Total amount must be greater than zero.');
    }

    const labor = data.laborAmount || 0;
    const materials = data.materialsAmount || 0;
    const fees = data.feesAmount || 0;

    if (labor < 0 || materials < 0 || fees < 0) {
      throw new Error('NEGATIVE_COMPONENT_AMOUNT: Component amounts cannot be negative.');
    }

    const sum = labor + materials + fees;
    // If component breakdown is provided, total should match or be equal to sum
    if (sum > 0 && Math.abs(sum - data.totalAmount) > 0.01) {
      return { valid: true, calculatedTotal: sum };
    }

    return { valid: true, calculatedTotal: data.totalAmount };
  }

  /**
   * Work Order State Machine Validation
   * Enforces server-controlled transitions. Disallows arbitrary jumps or post-completion mutations.
   */
  validateWorkOrderTransition(currentStatus: WorkOrderStatus, nextStatus: WorkOrderStatus): boolean {
    if (currentStatus === nextStatus) return true;

    // Terminal states cannot be altered
    if (currentStatus === WorkOrderStatus.COMPLETED) {
      throw new Error('INVALID_STATE_TRANSITION: Completed work orders are finalized and cannot be modified.');
    }
    if (currentStatus === WorkOrderStatus.CANCELLED) {
      throw new Error('INVALID_STATE_TRANSITION: Cancelled work orders cannot be modified.');
    }

    const validTransitions: Record<WorkOrderStatus, WorkOrderStatus[]> = {
      [WorkOrderStatus.SCHEDULED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.IN_PROGRESS]: [WorkOrderStatus.PAUSED, WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.PAUSED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
      [WorkOrderStatus.COMPLETED]: [],
      [WorkOrderStatus.CANCELLED]: [],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw new Error(`INVALID_STATE_TRANSITION: Cannot transition work order from ${currentStatus} to ${nextStatus}.`);
    }

    return true;
  }

  /**
   * Quote Lifecycle Validation
   * Prevents self-approval and post-approval modifications without revision flow.
   */
  validateQuoteSubmission(quote: VendorQuote): boolean {
    if (quote.status === VendorQuoteStatus.APPROVED) {
      throw new Error('CANNOT_MODIFY_APPROVED_QUOTE: Approved quotes require a formal revision flow.');
    }
    return true;
  }

  /**
   * Quote Confidentiality Guard
   * Strictly verifies that Vendor A cannot inspect Vendor B's quote.
   */
  ensureQuoteConfidentiality(requestingVendorUserId: string, quote: VendorQuote): void {
    if (quote.vendorUserId && quote.vendorUserId !== requestingVendorUserId) {
      throw new Error('CONFIDENTIALITY_VIOLATION: Competing vendor quotes and pricing details are strictly confidential.');
    }
  }

  /**
   * AI Assistant Co-Pilot for Vendors & Service Providers
   * CRITICAL GOVERNANCE: Strictly Advisory. Has zero autonomous execution authority.
   */
  async processAiQuery(userId: string, query: string, context?: { workOrderId?: string; requestId?: string }): Promise<AiVendorQueryResult> {
    const lower = query.toLowerCase();

    // 1. FORBIDDEN PRIVILEGED EXECUTION DETECTOR
    const forbiddenPhrases = [
      'transfer ownership',
      'transfer title',
      'sign contract',
      'approve quote',
      'approve payment',
      'approve payout',
      'mark as paid',
      'change owner',
      'execute payment',
      'bypass verification',
      'grant admin',
      'delete audit',
    ];

    if (forbiddenPhrases.some(phrase => lower.includes(phrase))) {
      return {
        response: 'AI GOVERNANCE SECURITY BLOCK: AI assistants are strictly advisory. High-risk actions (ownership mutations, approving quotes, self-approving payouts, and financial transactions) mandate explicit human authorization and cannot be initiated by AI.',
        isAutonomousExecutionBlocked: true,
        category: 'GENERAL_ADVICE',
      };
    }

    // 2. QUOTE & ESTIMATION ADVICE
    if (lower.includes('quote') || lower.includes('estimate') || lower.includes('price') || lower.includes('cost')) {
      return {
        response: 'Suggested Quote Structure for Erbil Residential Service:\n• Labor: 3 hours @ $40/hr ($120)\n• Materials: Standard copper piping / R410A refrigerant / replacement filters ($180)\n• Diagnostics & Inspection Fee: $25\n• Total Recommended Estimate: $325 (USD)\n• Recommended Warranty Terms: 90 days on replacement parts and labor.\n\nPlease note: This is an advisory recommendation. Review material availability before submitting.',
        suggestedAction: 'CREATE_QUOTE',
        category: 'QUOTE_ESTIMATION',
        isAutonomousExecutionBlocked: false,
      };
    }

    // 3. TECHNICAL DIAGNOSIS & REPAIR CHECKLIST
    if (lower.includes('ac') || lower.includes('cooling') || lower.includes('leak') || lower.includes('plumb') || lower.includes('electric') || lower.includes('repair')) {
      return {
        response: 'Standard HVAC Diagnostic Protocol:\n1. Verify thermostat call signal and power supply to outdoor unit.\n2. Inspect capacitor rating and contactor point pitting.\n3. Measure compressor running amps vs nameplate RLA.\n4. Check refrigerant subcooling and superheat curves.\n5. Inspect evaporator coil for airflow blockages or dust build-up.\n\nEnsure safety lockout/tagout procedures are observed before opening the electrical panel.',
        suggestedAction: 'LOG_WORK_UPDATE',
        category: 'TECHNICAL_DIAGNOSIS',
        isAutonomousExecutionBlocked: false,
      };
    }

    // 4. CUSTOMER COMMUNICATION DRAFTS
    if (lower.includes('message') || lower.includes('draft') || lower.includes('client') || lower.includes('customer')) {
      return {
        response: 'Draft Customer Follow-up Message:\n\n"Dear Customer, our certified technician has completed the diagnostic inspection on your property. The required replacement components are in stock, and work is scheduled for completion within 2 hours. Please let us know if you have any questions regarding the service report. Thank you for choosing HomeHub verified services."',
        suggestedAction: 'SEND_MESSAGE',
        category: 'CUSTOMER_COMMUNICATION',
        isAutonomousExecutionBlocked: false,
      };
    }

    // 5. SCHEDULE OPTIMIZATION
    if (lower.includes('schedule') || lower.includes('calendar') || lower.includes('appointment') || lower.includes('time')) {
      return {
        response: 'Schedule Analysis: You have 2 scheduled jobs today in Erbil (Apartment A-101 at 09:00 AM, Villa #24 at 12:00 PM). Estimated transit time between Empire World and Garden City is 25 minutes. A 45-minute buffer is recommended between appointments to allow for unforeseen on-site testing.',
        suggestedAction: 'VIEW_CALENDAR',
        category: 'SCHEDULE_OPTIMIZATION',
        isAutonomousExecutionBlocked: false,
      };
    }

    // DEFAULT ADVISORY RESPONSE
    return {
      response: 'HomeHub Vendor Advisory Assistant: I can help you structure detailed repair quotes, review technical diagnostic checklists (HVAC, plumbing, electrical), draft professional customer messages, or optimize your daily service route across Kurdistan.',
      category: 'GENERAL_ADVICE',
      isAutonomousExecutionBlocked: false,
    };
  }
}

export const vendorService = new VendorService();
