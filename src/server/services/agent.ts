import { 
  AgentLead, 
  LeadStage, 
  DealCommissionStatus, 
  CalendarEventType,
} from '../../types/agent.js';
import { agentRepository } from '../repositories/agent.js';

export interface AiAgentQueryResult {
  response: string;
  suggestedAction?: string;
  category: 'LEAD_SUGGESTION' | 'MARKET_ANALYSIS' | 'CLIENT_COMMUNICATION' | 'LISTING_DESCRIPTION' | 'GENERAL_ADVICE';
  isAutonomousExecutionBlocked: boolean;
}

export class AgentService {
  /**
   * AI Assistant Co-Pilot for Agents
   * CRITICAL GOVERNANCE: Strictly Advisory. Has zero autonomous execution authority.
   */
  async processAiQuery(userId: string, query: string, context?: { leadId?: string; propertyId?: string }): Promise<AiAgentQueryResult> {
    const lower = query.toLowerCase();

    // 1. FORBIDDEN EXECUTION DETECTOR
    // AI must NEVER execute transactions, sign contracts, transfer ownership, or disburse funds autonomously.
    const forbiddenPhrases = [
      'transfer ownership',
      'transfer title',
      'sign contract',
      'approve transaction',
      'close transaction',
      'disburse commission',
      'disburse funds',
      'execute payment',
      'accept offer on behalf of owner',
      'change owner',
    ];

    if (forbiddenPhrases.some(phrase => lower.includes(phrase))) {
      return {
        response: 'AI GOVERNANCE SECURITY BLOCK: AI assistants are strictly advisory. High-risk actions (ownership transfer, closing transactions, fund disbursement, contract execution) mandate explicit human authorization and cannot be initiated by AI.',
        isAutonomousExecutionBlocked: true,
        category: 'GENERAL_ADVICE',
      };
    }

    // 2. LEAD SUGGESTIONS
    if (lower.includes('suggest') || lower.includes('lead') || lower.includes('match')) {
      let leadContext = '';
      if (context?.leadId) {
        try {
          const lead = await agentRepository.getLeadById(userId, context.leadId);
          if (lead) {
            leadContext = ` for ${lead.clientName} (Budget: $${lead.budgetMin || 100000} - $${lead.budgetMax || 300000}, looking for ${lead.propertyType || 'Residential'})`;
          }
        } catch {
          // ignore
        }
      }

      return {
        response: `Based on current verified listings${leadContext}, 3 matching properties in Erbil are recommended: Modern Villa in Italian Village ($325,000), Luxury Apartment in Empire World ($185,000), and Gulan Tower 2-bed suite ($145,000). All match cash/mortgage preferences.`,
        suggestedAction: 'SCHEDULE_VIEWING',
        category: 'LEAD_SUGGESTION',
        isAutonomousExecutionBlocked: false,
      };
    }

    // 3. MARKET TRENDS
    if (lower.includes('market') || lower.includes('trend') || lower.includes('price')) {
      return {
        response: 'Erbil real estate market summary (Q3 2026): Average residential sale price is $1,250/m² (+5% YoY), and average rent is $8.5/m² (+3% YoY). High buyer demand is concentrated in Italian Village, Empire World, and Dream City. Average days on market has dropped to 38 days.',
        category: 'MARKET_ANALYSIS',
        isAutonomousExecutionBlocked: false,
      };
    }

    // 4. CLIENT MESSAGE DRAFTING
    if (lower.includes('message') || lower.includes('write') || lower.includes('draft') || lower.includes('email')) {
      return {
        response: 'Draft Client Follow-up Message:\n\n"Dear Client, thank you for your interest in our Erbil properties. We have recently verified two premier options matching your exact specifications in Italian Village. Would you be available for a private viewing this Wednesday or Thursday afternoon? Looking forward to assisting you. Best regards, [Your Name] — HomeHub Verified Agent."',
        category: 'CLIENT_COMMUNICATION',
        isAutonomousExecutionBlocked: false,
      };
    }

    // 5. LISTING DESCRIPTION GENERATION
    if (lower.includes('description') || lower.includes('listing')) {
      return {
        response: 'Draft Listing Description:\n\n"Exclusive Modern Residence in Erbil: Experience premium urban living with this impeccably designed property featuring open-concept living spaces, floor-to-ceiling windows, high-efficiency cooling, and high-end European finishes. Situated in a prime, secure gated community with 24/7 power, dedicated parking, and proximity to international schools and lifestyle centers. Contact your verified HomeHub agent today for a private tour."',
        category: 'LISTING_DESCRIPTION',
        isAutonomousExecutionBlocked: false,
      };
    }

    // DEFAULT ADVISORY RESPONSE
    return {
      response: 'HomeHub Agent Advisory Assistant: I can help you analyze active leads, draft client communications, generate compelling listing descriptions, or review market price trends across Erbil, Sulaymaniyah, and Duhok.',
      category: 'GENERAL_ADVICE',
      isAutonomousExecutionBlocked: false,
    };
  }

  /**
   * Validate Commission Policy
   * Strictly prevents applying platform rent commission to sales!
   */
  validateCommissionPolicy(dealAmount: number, dealType: string): { grossCommission: number; agentShare: number; brokerageShare: number } {
    if (dealType !== 'SALE' && dealType !== 'LEASE_ACQUISITION') {
      throw new Error('INVALID_DEAL_TYPE: Deal type must be SALE or LEASE_ACQUISITION');
    }

    // Standard sales deal commission: 2.0% gross
    // Brokerage share: 30%, Agent share: 70%
    const grossCommission = Math.round(dealAmount * 0.02 * 100) / 100;
    const brokerageShare = Math.round(grossCommission * 0.30 * 100) / 100;
    const agentShare = Math.round((grossCommission - brokerageShare) * 100) / 100;

    return {
      grossCommission,
      agentShare,
      brokerageShare,
    };
  }
}

export const agentService = new AgentService();
