/**
 * HOMEHUB FEE CALCULATION ENGINE
 * 
 * Business Rules:
 * HomeHub has exactly 3 fee types — all paid by the property OWNER:
 *   1. Platform Fee — global admin-configurable percentage from financial_policies
 *   2. Rent Fee — property-specific agreed value from properties.rent_fee
 *   3. Management Fee — property-specific agreed value from properties.management_fee
 *
 * Fee entitlement is determined by the property's operating model:
 *   - FULLY_MANAGED: HomeHub receives Rent Fee + Management Fee
 *   - AGENT_LISTED_PLATFORM_MANAGED: HomeHub receives Management Fee only
 *   - AGENT_OPERATED: HomeHub receives Platform Fee only
 *
 * All fees are calculated against ACTUAL CONFIRMED COLLECTED RENT only.
 * Never against: scheduled, pending, failed, cancelled, or security deposits.
 *
 * Invariants:
 *   1. Platform Fee Rate comes from DB financial_policies — never hardcoded
 *   2. Rent Fee and Management Fee come from the property record — never defaulted
 *   3. Double-entry ledger integration preserved
 *   4. Idempotency enforced via idempotency keys
 *   5. Reversals use compensating entries — never destructive deletion
 *   6. Client can never supply or override fee rates or amounts
 */
import { db } from '../../db/index.js';
import { commissions, paymentRecords, journalEntries, ledgerLines, properties, leases, users, organizations, organizationMembers, auditLogs, ownerSettlements, ownershipRecords } from '../../db/schema.js';
import { eq, and, or, desc } from 'drizzle-orm';
import { auditService } from './audit.js';
import { financeService } from './finance.js';

export const COMMISSION_POLICY_VERSION = 'v2.0';

export type OperatingModel = 'FULLY_MANAGED' | 'AGENT_LISTED_PLATFORM_MANAGED' | 'AGENT_OPERATED';

export interface FeeCalculationResult {
  baseAmount: number;
  platformFeeRate: number;
  platformFeeAmount: number;
  rentFeeRate: number | null;
  rentFeeAmount: number;
  managementFeeRate: number | null;
  managementFeeAmount: number;
  totalFeeAmount: number;
  ownerNetAmount: number;
  operatingModel: OperatingModel | null;
  currency: string;
  policyVersion: string;
}

export class CommissionService {

  /**
   * Calculates all applicable fees for a confirmed rent collection.
   * Fee entitlement is determined by the property's operating model.
   * Fees are only calculated on the amount actually collected.
   */
  async calculatePropertyFees(
    baseAmount: number,
    propertyId: string,
    currency: string = 'IQD',
  ): Promise<FeeCalculationResult> {
    if (baseAmount < 0) {
      throw new Error('Base rent amount cannot be negative');
    }

    // 1. Fetch property to get operating model and property-specific fees
    const [property] = await db.select().from(properties)
      .where(eq(properties.id, propertyId)).limit(1);

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    const operatingModel = (property.operatingModel as OperatingModel) || null;

    // 2. Fetch global platform fee rate from DB — no hardcoded fallback in production
    const platformFeeRate = await financeService.fetchFinancialPolicy('PLATFORM_FEE_RATE');

    // 3. Property-specific fee rates (null means not agreed / not applicable)
    const rentFeeRate = (property.rentFee !== null && property.rentFee !== undefined && String(property.rentFee).trim() !== '') 
      ? parseFloat(property.rentFee) 
      : null;
    const managementFeeRate = (property.managementFee !== null && property.managementFee !== undefined && String(property.managementFee).trim() !== '') 
      ? parseFloat(property.managementFee) 
      : null;

    // 4. Calculate amounts based on operating model entitlement
    return CommissionService.calculateFeesSync(
      baseAmount,
      platformFeeRate,
      operatingModel,
      rentFeeRate,
      managementFeeRate,
      currency
    );
  }

  /**
   * Synchronous core calculation engine. Pure function.
   * Can be reused safely in list iterations to avoid N+1 DB queries.
   */
  static calculateFeesSync(
    baseAmount: number,
    platformFeeRate: number,
    operatingModel: OperatingModel | null,
    rentFeeRateInput: number | null,
    managementFeeRateInput: number | null,
    currency: string = 'IQD'
  ): FeeCalculationResult {
    let platformFeeAmount = 0;
    let rentFeeAmount = 0;
    let managementFeeAmount = 0;

    let effectiveRentFeeRate: number | null = null;
    let effectiveManagementFeeRate: number | null = null;

    const roundFee = (amt: number, curr: string) => 
      curr === 'USD' ? Math.round(amt * 100) / 100 : Math.round(amt);

    // Platform Fee applies universally across all 3 operating models
    platformFeeAmount = roundFee(baseAmount * platformFeeRate, currency);

    switch (operatingModel) {
      case 'FULLY_MANAGED':
        // Both Rent Fee and Management Fee apply if agreed
        if (rentFeeRateInput !== null && rentFeeRateInput !== undefined) {
          effectiveRentFeeRate = rentFeeRateInput;
          rentFeeAmount = roundFee(baseAmount * rentFeeRateInput, currency);
        }
        if (managementFeeRateInput !== null && managementFeeRateInput !== undefined) {
          effectiveManagementFeeRate = managementFeeRateInput;
          managementFeeAmount = roundFee(baseAmount * managementFeeRateInput, currency);
        }
        break;

      case 'AGENT_LISTED_PLATFORM_MANAGED':
        // Rent Fee does NOT apply (waived/inapplicable); Management Fee applies if agreed
        effectiveRentFeeRate = null;
        rentFeeAmount = 0;
        if (managementFeeRateInput !== null && managementFeeRateInput !== undefined) {
          effectiveManagementFeeRate = managementFeeRateInput;
          managementFeeAmount = roundFee(baseAmount * managementFeeRateInput, currency);
        }
        break;

      case 'AGENT_OPERATED':
      default:
        // Neither Rent Fee nor Management Fee applies; only Platform Fee applies
        effectiveRentFeeRate = null;
        rentFeeAmount = 0;
        effectiveManagementFeeRate = null;
        managementFeeAmount = 0;
        break;
    }

    const totalFeeAmount = platformFeeAmount + rentFeeAmount + managementFeeAmount;
    const ownerNetAmount = baseAmount - totalFeeAmount;

    return {
      baseAmount,
      platformFeeRate,
      platformFeeAmount,
      rentFeeRate: effectiveRentFeeRate,
      rentFeeAmount,
      managementFeeRate: effectiveManagementFeeRate,
      managementFeeAmount,
      totalFeeAmount,
      ownerNetAmount,
      operatingModel,
      currency,
      policyVersion: COMMISSION_POLICY_VERSION,
    };
  }


  /**
   * Posts fee entries for a confirmed rent payment record.
   * Enforces idempotency, payment confirmation status, and balanced ledger lines.
   */
  async postCommissionForPayment(
    paymentRecordId: string,
    callerUserId: string,
    callerRole: string = 'SYSTEM'
  ) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    // 1. Fetch payment record
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, paymentRecordId)).limit(1);
    if (!payment) {
      throw new Error(`Payment record ${paymentRecordId} not found`);
    }

    // 2. Only CONFIRMED payments generate fee entries
    if (payment.status !== 'CONFIRMED') {
      throw new Error(`Cannot post fees for non-confirmed payment status: ${payment.status}`);
    }

    // 3. Idempotency check
    const existingCommissions = await db.select().from(commissions).where(eq(commissions.paymentRecordId, paymentRecordId)).limit(1);
    if (existingCommissions.length > 0) {
      return {
        commission: existingCommissions[0],
        alreadyPosted: true,
        calculation: null,
      };
    }

    const baseAmount = Number(payment.amount);
    const currency = payment.currency || 'IQD';

    // 4. Calculate fees using the property's operating model
    const calc = await this.calculatePropertyFees(baseAmount, payment.propertyId, currency);

    // Fetch lease context
    let ownerId: string | null = null;
    let companyId: string | null = null;
    let unitId: string | null = null;

    if (payment.leaseId) {
      const [lease] = await db.select().from(leases).where(eq(leases.id, payment.leaseId)).limit(1);
      if (lease) {
        unitId = lease.unitId;
      }
    }

    // Resolve owner and management company from ownership records and properties
    const [ownership] = await db.select().from(ownershipRecords)
      .where(eq(ownershipRecords.propertyId, payment.propertyId))
      .limit(1);

    if (ownership) {
      ownerId = ownership.ownerId;
      companyId = ownership.companyId;
    }

    if (!ownerId && companyId) {
      const [compOwner] = await db.select({ userId: organizationMembers.userId })
        .from(organizationMembers)
        .where(and(
          eq(organizationMembers.organizationId, companyId),
          or(eq(organizationMembers.role, 'COMPANY_OWNER'), eq(organizationMembers.role, 'COMPANY_ADMIN')),
          eq(organizationMembers.status, 'ACTIVE')
        ))
        .limit(1);
      if (compOwner) {
        ownerId = compOwner.userId;
      }
    }

    if (!ownerId) {
      const [prop] = await db.select().from(properties).where(eq(properties.id, payment.propertyId)).limit(1);
      if (prop && (prop as any).ownerId) {
        ownerId = (prop as any).ownerId;
      }
    }

    // 5. Execute in atomic transaction with row-locking and idempotency defense
    try {
      return await db.transaction(async (tx) => {
        // Lock payment record to serialize concurrent confirmation calls
        await tx.select({ id: paymentRecords.id }).from(paymentRecords)
          .where(eq(paymentRecords.id, paymentRecordId))
          .limit(1)
          .for('update');

        const inTxExisting = await tx.select().from(commissions)
          .where(eq(commissions.paymentRecordId, paymentRecordId))
          .limit(1);
        if (inTxExisting.length > 0) {
          return {
            commission: inTxExisting[0],
            alreadyPosted: true,
            calculation: null,
          };
        }

        // Journal entry for fee allocation
        const [journalEntry] = await tx.insert(journalEntries).values({
          propertyId: payment.propertyId,
          description: `HomeHub Fee Allocation for Payment ${paymentRecordId}`,
          date: new Date().toISOString(),
          referenceType: 'PAYMENT_RECORD',
          referenceId: paymentRecordId,
          status: 'POSTED',
          idempotencyKey: `JE_COMMISSION_${paymentRecordId}`,
        }).returning();

      // Debit: Clear generic rent revenue
      const ledgerEntries: any[] = [{
        journalEntryId: journalEntry.id,
        accountId: '4000', // Property Rent Revenue
        debit: calc.baseAmount.toString(),
        credit: '0',
        currency: calc.currency,
      }];

      // Credit: Platform Fee Revenue
      if (calc.platformFeeAmount > 0) {
        ledgerEntries.push({
          journalEntryId: journalEntry.id,
          accountId: '4010', // HomeHub Platform Fee Revenue
          debit: '0',
          credit: calc.platformFeeAmount.toString(),
          currency: calc.currency,
        });
      }

      // Credit: Rent Fee Revenue
      if (calc.rentFeeAmount > 0) {
        ledgerEntries.push({
          journalEntryId: journalEntry.id,
          accountId: '4011', // HomeHub Rent Fee Revenue
          debit: '0',
          credit: calc.rentFeeAmount.toString(),
          currency: calc.currency,
        });
      }

      // Credit: Management Fee Revenue
      if (calc.managementFeeAmount > 0) {
        ledgerEntries.push({
          journalEntryId: journalEntry.id,
          accountId: '4012', // HomeHub Management Fee Revenue
          debit: '0',
          credit: calc.managementFeeAmount.toString(),
          currency: calc.currency,
        });
      }

      // Credit: Owner Net Payable
      ledgerEntries.push({
        journalEntryId: journalEntry.id,
        accountId: '2010', // Owner Net Entitlement Payable
        debit: '0',
        credit: calc.ownerNetAmount.toString(),
        currency: calc.currency,
      });

      await tx.insert(ledgerLines).values(ledgerEntries);

      // Custodial Cash Receipt Journal Entry (Dr 1010 Operating Cash / Cr 4000 Gross Rent Clearing)
      const cashReceiptKey = `JE_CASH_RECEIPT_${paymentRecordId}`;
      const existingCashJe = await tx.select().from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, cashReceiptKey))
        .limit(1);

      if (existingCashJe.length === 0) {
        const [cashJournalEntry] = await tx.insert(journalEntries).values({
          propertyId: payment.propertyId,
          description: `Custodial Rent Collection for Payment ${paymentRecordId}`,
          date: new Date().toISOString(),
          referenceType: 'PAYMENT_RECORD',
          referenceId: paymentRecordId,
          status: 'POSTED',
          idempotencyKey: cashReceiptKey,
        }).returning();

        await tx.insert(ledgerLines).values([
          {
            journalEntryId: cashJournalEntry.id,
            accountId: '1010', // Operating Cash / Bank
            debit: calc.baseAmount.toString(),
            credit: '0',
            currency: calc.currency,
          },
          {
            journalEntryId: cashJournalEntry.id,
            accountId: '4000', // Gross Rent Clearing
            debit: '0',
            credit: calc.baseAmount.toString(),
            currency: calc.currency,
          },
        ]);
      }

      // Insert commission record (using totalFeeAmount as commissionAmount for ledger compatibility)
      const [newCommission] = await tx.insert(commissions).values({
        paymentRecordId,
        propertyId: payment.propertyId,
        unitId,
        leaseId: payment.leaseId,
        tenantId: payment.payerId,
        ownerId,
        companyId,
        commissionType: 'PLATFORM_FEES',
        rate: calc.platformFeeRate.toString(),
        baseAmount: calc.baseAmount.toString(),
        commissionAmount: calc.totalFeeAmount.toString(),
        currency: calc.currency,
        status: 'POSTED',
        policyVersion: calc.policyVersion,
        journalEntryId: journalEntry.id,
        idempotencyKey: `COMMISSION_${paymentRecordId}`,
        confirmedAt: new Date(),
      }).returning();

      // Audit trail
      await auditService.logAction({
        actorUserId: callerUserId,
        actorRole: callerRole,
        action: 'HOMEHUB_FEES_POSTED',
        resourceType: 'Commission',
        resourceId: newCommission.id,
        changes: {
          paymentRecordId,
          baseAmount: calc.baseAmount,
          platformFeeRate: calc.platformFeeRate,
          platformFeeAmount: calc.platformFeeAmount,
          rentFeeRate: calc.rentFeeRate,
          rentFeeAmount: calc.rentFeeAmount,
          managementFeeRate: calc.managementFeeRate,
          managementFeeAmount: calc.managementFeeAmount,
          totalFeeAmount: calc.totalFeeAmount,
          ownerNetAmount: calc.ownerNetAmount,
          operatingModel: calc.operatingModel,
          currency: calc.currency,
          journalEntryId: journalEntry.id,
        },
      });

      // Automated Owner Settlement creation for confirmed rent payment
      if (ownerId && calc.ownerNetAmount > 0) {
        const existingSettlement = await tx.select().from(ownerSettlements)
          .where(eq(ownerSettlements.journalEntryId, journalEntry.id))
          .limit(1);

        if (existingSettlement.length === 0) {
          const recDate = payment.recordedDate ? new Date(payment.recordedDate) : new Date();
          const periodStart = isNaN(recDate.getTime()) ? new Date() : recDate;

          await tx.insert(ownerSettlements).values({
            ownerId,
            propertyId: payment.propertyId,
            companyId,
            periodStartDate: periodStart,
            periodEndDate: new Date(),
            totalCollectedIqd: calc.baseAmount.toString(),
            platformCommissionIqd: calc.platformFeeAmount.toString(),
            companyCommissionIqd: Math.max(0, calc.totalFeeAmount - calc.platformFeeAmount).toString(),
            totalExpensesIqd: '0',
            netPayableIqd: calc.ownerNetAmount.toString(),
            status: 'AVAILABLE',
            journalEntryId: journalEntry.id,
          });
        }
      }

      return {
        commission: newCommission,
        alreadyPosted: false,
        calculation: calc,
      };
    });
    } catch (error: any) {
      if (
        error?.code === '23505' ||
        error?.cause?.code === '23505' ||
        String(error?.message).includes('unique constraint')
      ) {
        const [existing] = await db.select().from(commissions)
          .where(eq(commissions.paymentRecordId, paymentRecordId))
          .limit(1);
        if (existing) {
          return {
            commission: existing,
            alreadyPosted: true,
            calculation: null,
          };
        }
      }
      throw error;
    }
  }

  /**
   * Reverses fee entries when a payment is refunded or cancelled.
   * Creates balanced reversal ledger entries.
   * Supports an optional transaction executor (tx) to execute atomically within an outer transaction.
   */
  async reverseCommissionForPayment(
    paymentRecordId: string,
    reason: string,
    callerUserId: string,
    callerRole: string = 'SYSTEM',
    tx?: any
  ) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const runOperations = async (executor: any) => {
      const [commission] = await executor.select().from(commissions).where(eq(commissions.paymentRecordId, paymentRecordId)).limit(1);
      if (!commission) {
        throw new Error(`No commission found for payment ${paymentRecordId}`);
      }

      if (commission.status === 'REVERSED') {
        return { commission, alreadyReversed: true, reversalJournalEntryId: undefined };
      }

      // Fetch original journal lines to create exact compensating entries
      const originalLines = commission.journalEntryId
        ? await executor.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, commission.journalEntryId))
        : [];

      // Prepare compensating entries
      let compensatingLines: Array<{
        journalEntryId: string;
        accountId: string;
        debit: string;
        credit: string;
        currency: string;
      }> = [];

      const currency = commission.currency || 'IQD';
      const baseAmount = Number(commission.baseAmount);
      const feeAmount = Number(commission.commissionAmount);
      const ownerNet = baseAmount - feeAmount;

      if (originalLines.length > 0) {
        // Path 1: Original ledger lines exist - swap debit and credit exactly
        compensatingLines = originalLines.map((line: any) => ({
          journalEntryId: '',
          accountId: line.accountId,
          debit: line.credit || '0',
          credit: line.debit || '0',
          currency: line.currency || currency,
        }));
      } else {
        // Fallback Path: Original ledger lines are missing.
        // Step A: Attempt exact recovery from authoritative audit trail.
        const [auditRecord] = await executor.select().from(auditLogs)
          .where(and(
            eq(auditLogs.action, 'HOMEHUB_FEES_POSTED'),
            eq(auditLogs.resourceType, 'Commission'),
            eq(auditLogs.resourceId, commission.id)
          ))
          .orderBy(desc(auditLogs.timestamp))
          .limit(1);

        const auditChanges = (auditRecord?.changes as Record<string, any>) || null;
        const hasValidAuditBreakdown = auditChanges &&
          typeof auditChanges.platformFeeAmount === 'number' &&
          typeof auditChanges.rentFeeAmount === 'number' &&
          typeof auditChanges.managementFeeAmount === 'number';

        if (hasValidAuditBreakdown) {
          const pFee = Number(auditChanges.platformFeeAmount);
          const rFee = Number(auditChanges.rentFeeAmount);
          const mFee = Number(auditChanges.managementFeeAmount);
          const net = typeof auditChanges.ownerNetAmount === 'number'
            ? Number(auditChanges.ownerNetAmount)
            : ownerNet;

          compensatingLines.push({ journalEntryId: '', accountId: '4000', debit: '0', credit: baseAmount.toString(), currency });
          if (pFee > 0) {
            compensatingLines.push({ journalEntryId: '', accountId: '4010', debit: pFee.toString(), credit: '0', currency });
          }
          if (rFee > 0) {
            compensatingLines.push({ journalEntryId: '', accountId: '4011', debit: rFee.toString(), credit: '0', currency });
          }
          if (mFee > 0) {
            compensatingLines.push({ journalEntryId: '', accountId: '4012', debit: mFee.toString(), credit: '0', currency });
          }
          if (net > 0) {
            compensatingLines.push({ journalEntryId: '', accountId: '2010', debit: net.toString(), credit: '0', currency });
          }
        } else {
          // Step B: Audit log is missing or incomplete (e.g. legacy payments without audit trail or corrupted records).
          // Deterministically inspect property operating model without fabricating current policy rates.
          const [property] = await executor.select().from(properties)
            .where(eq(properties.id, commission.propertyId))
            .limit(1);

          const operatingModel = property?.operatingModel as OperatingModel | undefined;

          if (feeAmount === 0) {
            // No fees were charged
            compensatingLines.push({ journalEntryId: '', accountId: '4000', debit: '0', credit: baseAmount.toString(), currency });
            if (baseAmount > 0) {
              compensatingLines.push({ journalEntryId: '', accountId: '2010', debit: baseAmount.toString(), credit: '0', currency });
            }
          } else if (operatingModel === 'AGENT_OPERATED') {
            // AGENT_OPERATED: Platform Fee ONLY. Rent Fee and Management Fee are 0 by architectural definition.
            compensatingLines.push({ journalEntryId: '', accountId: '4000', debit: '0', credit: baseAmount.toString(), currency });
            compensatingLines.push({ journalEntryId: '', accountId: '4010', debit: feeAmount.toString(), credit: '0', currency });
            if (ownerNet > 0) {
              compensatingLines.push({ journalEntryId: '', accountId: '2010', debit: ownerNet.toString(), credit: '0', currency });
            }
          } else if (operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') {
            // AGENT_LISTED_PLATFORM_MANAGED: Platform Fee + Management Fee. Rent Fee is 0 by architectural definition.
            // Platform fee rate is retrieved from historical commission.rate stored at transaction time.
            const roundFee = (amt: number, curr: string) =>
              curr === 'USD' ? Math.round(amt * 100) / 100 : Math.round(amt);

            const platformRate = parseFloat(commission.rate);
            if (!isNaN(platformRate) && platformRate >= 0) {
              const platformFee = roundFee(baseAmount * platformRate, currency);
              const mgmtFee = feeAmount - platformFee;

              if (mgmtFee >= 0) {
                compensatingLines.push({ journalEntryId: '', accountId: '4000', debit: '0', credit: baseAmount.toString(), currency });
                if (platformFee > 0) {
                  compensatingLines.push({ journalEntryId: '', accountId: '4010', debit: platformFee.toString(), credit: '0', currency });
                }
                if (mgmtFee > 0) {
                  compensatingLines.push({ journalEntryId: '', accountId: '4012', debit: mgmtFee.toString(), credit: '0', currency });
                }
                if (ownerNet > 0) {
                  compensatingLines.push({ journalEntryId: '', accountId: '2010', debit: ownerNet.toString(), credit: '0', currency });
                }
              } else {
                throw new Error(
                  `HISTORICAL_FEE_BREAKDOWN_UNRECOVERABLE: Commission ${commission.id} has total fee amount ${feeAmount} less than computed platform fee ${platformFee}. Manual accounting reconciliation required.`
                );
              }
            } else {
              throw new Error(
                `HISTORICAL_FEE_BREAKDOWN_UNRECOVERABLE: Commission ${commission.id} has invalid recorded platform fee rate '${commission.rate}'. Manual accounting reconciliation required.`
              );
            }
          } else if (operatingModel === 'FULLY_MANAGED') {
            // FULLY_MANAGED: Platform Fee, Rent Fee, and Management Fee may all apply.
            const roundFee = (amt: number, curr: string) =>
              curr === 'USD' ? Math.round(amt * 100) / 100 : Math.round(amt);

            const platformRate = parseFloat(commission.rate);
            const platformFee = !isNaN(platformRate) ? roundFee(baseAmount * platformRate, currency) : 0;

            if (feeAmount === platformFee) {
              // Only platform fee was charged (rentFee and mgmtFee were 0)
              compensatingLines.push({ journalEntryId: '', accountId: '4000', debit: '0', credit: baseAmount.toString(), currency });
              compensatingLines.push({ journalEntryId: '', accountId: '4010', debit: feeAmount.toString(), credit: '0', currency });
              if (ownerNet > 0) {
                compensatingLines.push({ journalEntryId: '', accountId: '2010', debit: ownerNet.toString(), credit: '0', currency });
              }
            } else {
              // Ambiguous multi-fee allocation: original ledger lines and audit log are missing.
              // To prevent fabricating fee allocation from current policy rates or rewriting historical economics, fail safely.
              throw new Error(
                `HISTORICAL_FEE_BREAKDOWN_UNRECOVERABLE: Original ledger lines and audit breakdown missing for commission ${commission.id}. For FULLY_MANAGED properties with multiple fee components (${feeAmount} total vs ${platformFee} platform fee), manual accounting reconciliation or ledger backfill is required to prevent incorrect revenue allocation.`
              );
            }
          } else {
            // Unknown or missing operating model with non-zero fee
            throw new Error(
              `HISTORICAL_FEE_BREAKDOWN_UNRECOVERABLE: Missing original ledger lines, audit breakdown, and valid operating model for commission ${commission.id}. Manual accounting reconciliation required.`
            );
          }
        }
      }

      // Verify debit/credit balance before writing
      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of compensatingLines) {
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
          `REVERSAL_LEDGER_UNBALANCED: Compensating entries do not balance for commission ${commission.id}. Debits: ${totalDebit}, Credits: ${totalCredit}`
        );
      }

      const [reversalEntry] = await executor.insert(journalEntries).values({
        propertyId: commission.propertyId,
        description: `Fee Reversal for Payment ${paymentRecordId}: ${reason}`,
        date: new Date().toISOString(),
        referenceType: 'FEE_REVERSAL',
        referenceId: commission.id,
        status: 'POSTED',
        idempotencyKey: `JE_REVERSAL_${commission.id}`,
      }).returning();

      const finalLines = compensatingLines.map((line) => ({
        ...line,
        journalEntryId: reversalEntry.id,
      }));
      await executor.insert(ledgerLines).values(finalLines);

      // Compensating Reversal for Custodial Cash Receipt if originally posted
      const cashRevKey = `JE_CASH_RECEIPT_REV_${paymentRecordId}`;
      const existingCashRev = await executor.select().from(journalEntries)
        .where(eq(journalEntries.idempotencyKey, cashRevKey))
        .limit(1);

      if (existingCashRev.length === 0) {
        const originalCashJe = await executor.select().from(journalEntries)
          .where(eq(journalEntries.idempotencyKey, `JE_CASH_RECEIPT_${paymentRecordId}`))
          .limit(1);

        if (originalCashJe.length > 0) {
          const [cashRevEntry] = await executor.insert(journalEntries).values({
            propertyId: commission.propertyId,
            description: `Custodial Rent Collection Reversal for Payment ${paymentRecordId}: ${reason}`,
            date: new Date().toISOString(),
            referenceType: 'PAYMENT_REVERSAL',
            referenceId: paymentRecordId,
            status: 'POSTED',
            idempotencyKey: cashRevKey,
          }).returning();

          await executor.insert(ledgerLines).values([
            {
              journalEntryId: cashRevEntry.id,
              accountId: '1010', // Operating Cash / Bank (Credit to reverse cash receipt)
              debit: '0',
              credit: baseAmount.toString(),
              currency,
            },
            {
              journalEntryId: cashRevEntry.id,
              accountId: '4000', // Gross Rent Clearing (Debit to reverse clearing credit)
              debit: baseAmount.toString(),
              credit: '0',
              currency,
            },
          ]);
        }
      }

      const [updatedCommission] = await executor.update(commissions)
        .set({ status: 'REVERSED', reversedAt: new Date() })
        .where(eq(commissions.id, commission.id))
        .returning();

      // Synchronize linked owner settlement to CANCELLED to prevent invalid payouts for reversed payments
      if (commission.journalEntryId) {
        await executor.update(ownerSettlements)
          .set({ status: 'CANCELLED', updatedAt: new Date() })
          .where(and(
            eq(ownerSettlements.journalEntryId, commission.journalEntryId),
            eq(ownerSettlements.status, 'AVAILABLE')
          ));
      }

      await auditService.logAction({
        actorUserId: callerUserId,
        actorRole: callerRole,
        action: 'HOMEHUB_FEES_REVERSED',
        resourceType: 'Commission',
        resourceId: commission.id,
        changes: {
          paymentRecordId,
          commissionAmount: commission.commissionAmount,
          reason,
          reversalJournalEntryId: reversalEntry.id,
        },
        tx: executor,
      });

      return { commission: updatedCommission, alreadyReversed: false, reversalJournalEntryId: reversalEntry.id };
    };

    if (tx) {
      return await runOperations(tx);
    } else {
      return await db.transaction(async (innerTx) => {
        return await runOperations(innerTx);
      });
    }
  }

  /**
   * Retrieves fee/commission records for platform reporting.
   */
  async getCommissionSummary(filters?: { propertyId?: string; ownerId?: string; companyId?: string }) {
    if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }

    const conditions = [];
    if (filters?.propertyId) conditions.push(eq(commissions.propertyId, filters.propertyId));
    if (filters?.ownerId) conditions.push(eq(commissions.ownerId, filters.ownerId));
    if (filters?.companyId) conditions.push(eq(commissions.companyId, filters.companyId));

    const records = await db.select().from(commissions).where(conditions.length > 0 ? and(...conditions) : undefined);
    let totalConfirmedRent = 0;
    let totalFees = 0;
    let totalReversedFees = 0;

    for (const rec of records) {
      if (rec.status === 'POSTED') {
        totalConfirmedRent += Number(rec.baseAmount);
        totalFees += Number(rec.commissionAmount);
      } else if (rec.status === 'REVERSED') {
        totalReversedFees += Number(rec.commissionAmount);
      }
    }

    return {
      totalConfirmedRent,
      totalHomeHubFees: totalFees,
      totalReversedFees,
      netPlatformFees: totalFees - totalReversedFees,
      currency: 'IQD',
      recordsCount: records.length,
    };
  }
}

export const commissionService = new CommissionService();
