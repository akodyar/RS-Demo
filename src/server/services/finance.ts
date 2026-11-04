import { db } from '../../db/index.js';
import { 
  paymentRecords, commissions, financialPolicies, journalEntries, 
  refundRecords, reversalRecords, ledgerLines, securityDeposits, 
  salesTransactions, maintenanceInvoices, accountsPayable, accountsReceivable,
  bankReconciliations, bankStatements, chartOfAccounts, securityDepositDeductions, ownerSettlements,
  managementAgreements, ownershipRecords
} from '../../db/schema.js';
import { financeRepository } from '../repositories/finance.js';
import { auditService } from './audit.js';
import { eq, and, sum, sql, desc, inArray } from 'drizzle-orm';
import crypto from 'crypto';
export class FinanceService {
  /**
   * Generic Accounts Receivable Payment Helper (Dr 1010 Cash / Cr 1200 AR).
   *
   * IMPORTANT ARCHITECTURAL NOTICE:
   * DO NOT USE for HomeHub custodial rental payment confirmation.
   * Custodial rent collections follow the canonical 3-fee clearing model:
   * 1. Cash Receipt: Dr 1010 Operating Cash / Cr 4000 Gross Rent Clearing
   * 2. Fee Allocation: Dr 4000 Gross Rent Clearing / Cr 4010, 4011, 4012, 2010
   * Handled atomically in commissionService.postCommissionForPayment().
   * Calling this helper for rental payments would erroneously credit 1200 AR
   * and cause duplicate cash recognition.
   */
  async recordPayment(
    propertyId: string,
    payerId: string,
    amount: number,
    currency: string = 'IQD',
    method: string,
    reference: string,
    options?: { rentScheduleId?: string; leaseId?: string }
  ) {
    if (options?.leaseId || options?.rentScheduleId) {
      throw new Error(
        'FORBIDDEN_CUSTODIAL_RENT_PAYMENT: recordPayment() is restricted to non-custodial AR payments. Custodial rental payments must follow the two-step RECORDED -> CONFIRMED workflow via leaseRepository and commissionService.'
      );
    }

    const idempotencyKey = crypto.createHash('sha256').update(`payment_${reference}_${amount}_${payerId}`).digest('hex');

    return await db.transaction(async (tx) => {
      const existing = await tx.select().from(paymentRecords).where(eq(paymentRecords.idempotencyKey, idempotencyKey));
      if (existing.length > 0) return existing[0];

      const [payment] = await tx.insert(paymentRecords).values({
        propertyId,
        payerId,
        amount: amount.toString(),
        currency,
        paymentMethod: method,
        referenceNumber: reference,
        status: 'CONFIRMED',
        recordedDate: new Date().toISOString(),
        idempotencyKey,
        leaseId: options?.leaseId,
        rentScheduleId: options?.rentScheduleId
      }).returning();

      await financeRepository.postJournalEntry(propertyId, `Payment received - Ref ${reference}`, [
        { accountId: '1010', debit: amount, credit: 0, currency }, 
        { accountId: '1200', debit: 0, credit: amount, currency }
      ], {
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        currency,
        idempotencyKey: `je_${idempotencyKey}`
      });

      return payment;
    });
  }

  async fetchFinancialPolicy(policyType: string, testDefaultRate?: number): Promise<number> {
    // In production, test defaults are strictly forbidden to ensure DB policy authority
    if (process.env.NODE_ENV === 'production') {
      testDefaultRate = undefined;
    }

    if (!Boolean(process.env.SQL_HOST || process.env.DATABASE_URL)) {
      if (testDefaultRate !== undefined && process.env.NODE_ENV !== 'production') {
        return testDefaultRate;
      }
      const err: any = new Error('DATABASE_NOT_CONFIGURED');
      err.status = 503;
      err.code = 'DATABASE_NOT_CONFIGURED';
      throw err;
    }

    try {
      const policies = await db.select().from(financialPolicies)
        .where(eq(financialPolicies.policyType, policyType))
        .limit(1);

      if (policies.length > 0 && policies[0].active) {
        return parseFloat(policies[0].policyValue);
      }
      if (testDefaultRate !== undefined && process.env.NODE_ENV !== 'production') {
        return testDefaultRate;
      }
      throw new Error(`Financial policy ${policyType} not found in database or inactive`);
    } catch (error: any) {
      const isConnRefused = 
        error.code === 'ECONNREFUSED' || 
        error.message?.includes('ECONNREFUSED') || 
        error.cause?.code === 'ECONNREFUSED' ||
        String(error.cause || '').includes('ECONNREFUSED') ||
        String(error || '').includes('ECONNREFUSED');

      if (isConnRefused) {
        if (testDefaultRate !== undefined && process.env.NODE_ENV !== 'production') {
          return testDefaultRate;
        }
        const err: any = new Error('DATABASE_NOT_CONFIGURED');
        err.status = 503;
        err.code = 'DATABASE_NOT_CONFIGURED';
        throw err;
      }
      throw error;
    }
  }

  async refundPayment(paymentId: string, processedByUserId: string, reason: string) {
    return await db.transaction(async (tx) => {
      const payments = await tx.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId));
      if (payments.length === 0) throw new Error("Payment not found");
      const payment = payments[0];
      
      if (payment.status === 'REFUNDED') throw new Error("Payment already refunded");
      if (payment.status !== 'CONFIRMED') throw new Error("Can only refund confirmed payments");

      // Check if this was a custodial rental payment (has commissions or leaseId or rentScheduleId)
      const relatedCommissions = await tx.select().from(commissions).where(eq(commissions.paymentRecordId, paymentId));
      if (relatedCommissions.length > 0 || payment.leaseId || payment.rentScheduleId) {
        const { commissionService } = await import('./commission.js');
        const commRev = await commissionService.reverseCommissionForPayment(
          payment.id,
          reason,
          processedByUserId,
          'FINANCE_ADMIN',
          tx
        );
        
        await tx.update(paymentRecords).set({ status: 'REFUNDED' }).where(eq(paymentRecords.id, paymentId));

        let reversalJe: any = null;
        if (commRev?.reversalJournalEntryId) {
          const [found] = await tx.select().from(journalEntries)
            .where(eq(journalEntries.id, commRev.reversalJournalEntryId))
            .limit(1);
          reversalJe = found;
        }

        return reversalJe || { id: commRev?.reversalJournalEntryId, status: 'POSTED' };
      }

      const amount = parseFloat(payment.amount);
      const idempotencyKey = crypto.createHash('sha256').update(`refund_${paymentId}`).digest('hex');

      // Compensating Journal Entry
      const entry = await financeRepository.postJournalEntry(payment.propertyId, `Refund for Payment ${payment.referenceNumber} - ${reason}`, [
        { accountId: '1200', debit: amount, credit: 0 }, // AR goes back up
        { accountId: '1010', debit: 0, credit: amount }  // Cash goes down
      ], {
        referenceType: 'REFUND',
        referenceId: payment.id,
        idempotencyKey: `je_${idempotencyKey}`
      });

      // Insert refund record
      await tx.insert(refundRecords).values({
        originalPaymentId: payment.id,
        amount: amount.toString(),
        currency: payment.currency || 'USD',
        reason,
        compensatingJournalId: entry.id,
        processedBy: processedByUserId,
        idempotencyKey
      });

      // Update payment status
      await tx.update(paymentRecords).set({ status: 'REFUNDED' }).where(eq(paymentRecords.id, paymentId));

      return entry;
    });
  }

  async collectSecurityDeposit(depositId: string, amount: number) {
    return await db.transaction(async (tx) => {
      const deposits = await tx.select().from(securityDeposits)
        .where(eq(securityDeposits.id, depositId))
        .limit(1)
        .for('update');
      if (deposits.length === 0) throw new Error("Deposit not found");
      const deposit = deposits[0];

      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be a positive finite number");
      
      const currentlyRecorded = parseFloat(deposit.recordedAmount || '0');
      const newRecorded = currentlyRecorded + amount;
      
      const requiredAmount = parseFloat(deposit.requiredAmount);
      const status = newRecorded >= requiredAmount ? 'HELD' : 'PARTIALLY_COLLECTED';

      const [updatedDeposit] = await tx.update(securityDeposits)
        .set({ recordedAmount: newRecorded.toString(), status })
        .where(eq(securityDeposits.id, depositId))
        .returning();

      const depositCurrency = deposit.currency || 'IQD';

      // Journal entry: Cash increases, Liability increases
      await financeRepository.postJournalEntry(deposit.propertyId, `Security Deposit Collected - Lease ${deposit.leaseId}`, [
        { accountId: '1010', debit: amount, credit: 0, currency: depositCurrency }, // Cash
        { accountId: '2100', debit: 0, credit: amount, currency: depositCurrency }  // Security Deposit Liability
      ], {
        referenceType: 'SECURITY_DEPOSIT', referenceId: deposit.id, currency: depositCurrency
      });
      return updatedDeposit;
    });
  }

  async releaseSecurityDeposit(
    depositId: string,
    releaseAmount: number,
    actorContext?: {
      actorUserId?: string;
      actorRole?: string;
      ipAddress?: string;
      simulateAuditFailure?: boolean;
    }
  ) {
    if (!Number.isFinite(releaseAmount) || releaseAmount <= 0) {
      throw new Error("Release amount must be a positive finite number");
    }

    return await db.transaction(async (tx) => {
      // 1. Authoritative pessimistic row-level lock
      const deposits = await tx.select().from(securityDeposits)
        .where(eq(securityDeposits.id, depositId))
        .limit(1)
        .for('update');

      if (deposits.length === 0) throw new Error("Deposit not found");
      const deposit = deposits[0];
      const depositCurrency = deposit.currency || 'IQD';
      
      const recordedAmount = parseFloat(deposit.recordedAmount || '0');
      const currentlyReleased = parseFloat(deposit.releasedAmount || '0');
      const heldAmount = recordedAmount - currentlyReleased;

      if (heldAmount <= 0 || (deposit.status !== 'HELD' && deposit.status !== 'PARTIALLY_REFUNDED')) {
        throw new Error("Cannot release more than currently held amount");
      }

      if (releaseAmount > heldAmount) {
        throw new Error("Cannot release more than currently held amount");
      }

      // 2. Query active deduction reservations and disputes under the same lock
      const existingDeductions = await tx.select().from(securityDepositDeductions)
        .where(eq(securityDepositDeductions.depositId, depositId));

      const hasActiveDispute = existingDeductions.some((d: any) => d.status === 'DISPUTED');
      if (hasActiveDispute) {
        throw new Error(
          'Cannot release security deposit: active deduction disputes are pending resolution. The deposit must remain held until all disputes are resolved.'
        );
      }

      const activeReservations = existingDeductions.filter((d: any) =>
        ['PROPOSED', 'OWNER_APPROVED', 'DISPUTED', 'SETTLED'].includes(d.status)
      );

      const totalReserved = activeReservations.reduce(
        (sum: number, d: any) => sum + parseFloat(d.amount || '0'),
        0
      );
      const availableReleasable = heldAmount - totalReserved;

      if (releaseAmount > availableReleasable) {
        throw new Error(
          `Cannot release deposit: requested amount (${releaseAmount}) exceeds available balance (${availableReleasable}) after deducting active reservations (${totalReserved})`
        );
      }

      // 3. Atomically update releasedAmount and status
      const newReleased = currentlyReleased + releaseAmount;
      const status = newReleased >= recordedAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      const [updatedDeposit] = await tx.update(securityDeposits)
        .set({ releasedAmount: newReleased.toString(), status })
        .where(eq(securityDeposits.id, depositId))
        .returning();

      // 4. Journal entry: Liability decreases, Cash decreases
      await financeRepository.postJournalEntry(deposit.propertyId, `Security Deposit Released - Lease ${deposit.leaseId}`, [
        { accountId: '2100', debit: releaseAmount, credit: 0, currency: depositCurrency }, // Security Deposit Liability
        { accountId: '1010', debit: 0, credit: releaseAmount, currency: depositCurrency }  // Cash
      ], {
        referenceType: 'SECURITY_DEPOSIT_RELEASE', referenceId: deposit.id, currency: depositCurrency
      });

      // 5. Test hook for atomic transaction rollback
      if (actorContext?.simulateAuditFailure) {
        throw new Error('SIMULATED_AUDIT_FAILURE: Testing atomic rollback on deposit release');
      }

      // 6. Authoritative audit log inside transaction
      await auditService.logAction({
        actorUserId: actorContext?.actorUserId || 'system',
        actorRole: actorContext?.actorRole || 'SYSTEM',
        action: 'SECURITY_DEPOSIT_RELEASED',
        resourceType: 'SECURITY_DEPOSIT',
        resourceId: deposit.id,
        changes: {
          leaseId: deposit.leaseId,
          propertyId: deposit.propertyId,
          releaseAmount: releaseAmount.toString(),
          previousReleasedAmount: currentlyReleased.toString(),
          newReleasedAmount: newReleased.toString(),
          previousStatus: deposit.status,
          newStatus: status,
          currency: depositCurrency,
          totalReserved: totalReserved.toString(),
          availableReleasable: availableReleasable.toString(),
        },
        ipAddress: actorContext?.ipAddress,
        tx,
      });

      return updatedDeposit;
    });
  }

  /**
   * Applies a damage/repair deduction against held security deposit funds.
   * Decreases custodial deposit liability (Dr 2100) and increases owner payable liability (Cr 2010).
   * Cash remains in operating asset (Account 1010) until disbursed to owner or contractor.
   */
  async applyDepositDeduction(
    depositId: string,
    deductionAmount: number,
    reason: string,
    actorContext?: {
      actorUserId?: string;
      actorRole?: string;
      ipAddress?: string;
      idempotencyKey?: string;
    }
  ) {
    if (!Number.isFinite(deductionAmount) || deductionAmount <= 0) {
      throw new Error("Deduction amount must be a positive finite number");
    }

    return await db.transaction(async (tx) => {
      // 1. Check idempotency: If this deduction was already processed under this idempotencyKey, return existing state
      if (actorContext?.idempotencyKey) {
        const [existingJe] = await tx.select().from(journalEntries)
          .where(eq(journalEntries.idempotencyKey, actorContext.idempotencyKey));
        if (existingJe) {
          const [currentDeposit] = await tx.select().from(securityDeposits)
            .where(eq(securityDeposits.id, depositId));
          return { deposit: currentDeposit, journalEntry: existingJe };
        }
      }

      // 2. Pessimistic row-level lock on deposit to prevent concurrent overdraw races
      const deposits = await tx.select().from(securityDeposits)
        .where(eq(securityDeposits.id, depositId))
        .limit(1)
        .for('update');

      if (deposits.length === 0) throw new Error("Deposit not found");
      const deposit = deposits[0];
      const depositCurrency = deposit.currency || 'IQD';

      const recordedAmount = parseFloat(deposit.recordedAmount || '0');
      const currentlyReleased = parseFloat(deposit.releasedAmount || '0');
      const heldAmount = recordedAmount - currentlyReleased;

      if (deductionAmount > heldAmount) {
        throw new Error("Deduction amount cannot exceed remaining held deposit balance");
      }

      // Update deposit releasedAmount and status
      const newReleased = currentlyReleased + deductionAmount;
      const status = newReleased >= recordedAmount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      const [updatedDeposit] = await tx.update(securityDeposits)
        .set({ releasedAmount: newReleased.toString(), status })
        .where(eq(securityDeposits.id, depositId))
        .returning();

      // Journal entry: Dr 2100 (Deposit Liability), Cr 2010 (Owner Net Payable)
      const entry = await financeRepository.postJournalEntry(
        deposit.propertyId,
        `Security Deposit Deduction - Lease ${deposit.leaseId}: ${reason}`,
        [
          { accountId: '2100', debit: deductionAmount, credit: 0, currency: depositCurrency },
          { accountId: '2010', debit: 0, credit: deductionAmount, currency: depositCurrency }
        ],
        {
          referenceType: 'SECURITY_DEPOSIT_DEDUCTION',
          referenceId: deposit.id,
          currency: depositCurrency,
          idempotencyKey: actorContext?.idempotencyKey
        }
      );

      // Audit log entry
      await auditService.logAction({
        actorUserId: actorContext?.actorUserId || 'system',
        actorRole: actorContext?.actorRole || 'SYSTEM',
        action: 'SECURITY_DEPOSIT_DEDUCTED',
        resourceType: 'SECURITY_DEPOSIT',
        resourceId: deposit.id,
        changes: {
          leaseId: deposit.leaseId,
          propertyId: deposit.propertyId,
          deductionAmount: deductionAmount.toString(),
          reason,
          currency: depositCurrency,
          previousReleasedAmount: currentlyReleased.toString(),
          newReleasedAmount: newReleased.toString(),
          newStatus: status,
        },
        ipAddress: actorContext?.ipAddress,
        tx,
      });

      return { deposit: updatedDeposit, journalEntry: entry };
    });
  }

  async processVendorInvoice(propertyId: string, vendorId: string, invoiceId: string, amount: number, options?: { deductFromOwnerSettlement?: boolean }) {
    return await db.transaction(async (tx) => {
      const [ap] = await tx.insert(accountsPayable).values({
        propertyId, creditorOrganizationId: vendorId, sourceType: 'VENDOR_INVOICE',
        sourceId: invoiceId, amount: amount.toString(), dueDate: new Date().toISOString()
      }).returning();

      // Journal entry: Expense increases (Dr 5000), Trade AP increases (Cr 2000)
      await financeRepository.postJournalEntry(propertyId, `Vendor Invoice ${invoiceId}`, [
        { accountId: '5000', debit: amount, credit: 0 }, // Operating Expense
        { accountId: '2000', debit: 0, credit: amount }  // Trade Accounts Payable
      ], { referenceType: 'VENDOR_INVOICE', referenceId: invoiceId });

      if (options?.deductFromOwnerSettlement) {
        // If owner absorbs maintenance cost:
        // Dr 2010 Owner Net Entitlement Payable (decreases HomeHub's liability owed to owner)
        // Cr 5000 Operating Expense (offsets expense from company's own P&L)
        await financeRepository.postJournalEntry(propertyId, `Deduct Vendor Invoice from Owner Settlement ${invoiceId}`, [
          { accountId: '2010', debit: amount, credit: 0 },
          { accountId: '5000', debit: 0, credit: amount }
        ], { referenceType: 'OWNER_EXPENSE_DEDUCTION', referenceId: invoiceId });

        // Update active owner settlement for this property
        const [settlement] = await tx.select().from(ownerSettlements)
          .where(and(eq(ownerSettlements.propertyId, propertyId), eq(ownerSettlements.status, 'AVAILABLE')))
          .limit(1);

        if (settlement) {
          const currentExp = Number(settlement.totalExpensesIqd || 0);
          const currentNet = Number(settlement.netPayableIqd || 0);
          const newExp = currentExp + amount;
          const newNet = Math.max(0, currentNet - amount);

          await tx.update(ownerSettlements)
            .set({
              totalExpensesIqd: newExp.toString(),
              netPayableIqd: newNet.toString(),
              updatedAt: new Date()
            })
            .where(eq(ownerSettlements.id, settlement.id));
        }
      }

      return ap;
    });
  }

  /**
   * Settles a vendor invoice from operating cash.
   * Decreases Trade Accounts Payable (Dr 2000) and decreases Operating Cash (Cr 1010).
   * Updates accountsPayable status to SETTLED (or PARTIAL) and records the settled amount.
   */
  async settleVendorInvoice(invoiceId: string, options?: { paymentRef?: string; paidAmount?: number }) {
    return await db.transaction(async (tx) => {
      const [ap] = await tx.select().from(accountsPayable)
        .where(and(eq(accountsPayable.sourceType, 'VENDOR_INVOICE'), eq(accountsPayable.sourceId, invoiceId)))
        .limit(1);

      if (!ap) {
        throw new Error(`ACCOUNTS_PAYABLE_NOT_FOUND: Record not found for vendor invoice ${invoiceId}`);
      }

      if (ap.status === 'SETTLED') {
        return { ap, alreadySettled: true };
      }

      const invoiceAmount = Number(ap.amount);
      const currentSettled = Number(ap.settledAmount || 0);
      const amountToSettle = options?.paidAmount ?? (invoiceAmount - currentSettled);

      if (isNaN(amountToSettle) || amountToSettle <= 0) {
        throw new Error(`INVALID_SETTLEMENT_AMOUNT: Must be greater than 0, received ${amountToSettle}`);
      }

      const newSettled = currentSettled + amountToSettle;
      if (newSettled > invoiceAmount + 0.001) {
        throw new Error(`EXCESSIVE_SETTLEMENT_AMOUNT: Total settled ${newSettled} exceeds invoice amount ${invoiceAmount}`);
      }

      const isFullySettled = newSettled >= invoiceAmount - 0.001;

      // Journal entry: Dr 2000 (Trade AP), Cr 1010 (Operating Cash)
      const je = await financeRepository.postJournalEntry(
        ap.propertyId || 'GLOBAL',
        `Vendor Invoice Settlement ${invoiceId}${options?.paymentRef ? ` - Ref ${options.paymentRef}` : ''}`,
        [
          { accountId: '2000', debit: amountToSettle, credit: 0, currency: ap.currency },
          { accountId: '1010', debit: 0, credit: amountToSettle, currency: ap.currency }
        ],
        {
          referenceType: 'AP_SETTLEMENT',
          referenceId: invoiceId,
          idempotencyKey: `JE_AP_SETTLE_${invoiceId}_${newSettled}`,
          currency: ap.currency
        }
      );

      const [updatedAp] = await tx.update(accountsPayable)
        .set({
          status: isFullySettled ? 'SETTLED' : 'PARTIAL',
          settledAmount: newSettled.toString(),
        })
        .where(eq(accountsPayable.id, ap.id))
        .returning();

      return { ap: updatedAp, journalEntry: je, alreadySettled: false };
    });
  }

  // Statements & Diagnostic Reporting
  async getCompanyPropertyIds(companyId: string): Promise<string[]> {
    const [managedAgreementsList, companyOwnerships] = await Promise.all([
      db.select({ propertyId: managementAgreements.propertyId })
        .from(managementAgreements)
        .where(and(eq(managementAgreements.companyId, companyId), eq(managementAgreements.status, 'ACTIVE'))),
      db.select({ propertyId: ownershipRecords.propertyId })
        .from(ownershipRecords)
        .where(eq(ownershipRecords.companyId, companyId))
    ]);
    return Array.from(new Set([
      ...managedAgreementsList.map(a => a.propertyId),
      ...companyOwnerships.map(o => o.propertyId)
    ]));
  }

  private async buildPropertyScopeCondition(propertyId?: string, companyId?: string) {
    if (propertyId) {
      return eq(journalEntries.propertyId, propertyId);
    }
    if (companyId) {
      const companyPropertyIds = await this.getCompanyPropertyIds(companyId);
      if (companyPropertyIds.length === 0) {
        return sql`1 = 0`;
      }
      return inArray(journalEntries.propertyId, companyPropertyIds);
    }
    return null;
  }

  async getUnmappedLedgerAccounts(propertyId?: string, companyId?: string): Promise<Array<{
    accountId: string;
    totalDebit: number;
    totalCredit: number;
    lineCount: number;
  }>> {
    const conditions = [sql`${chartOfAccounts.code} IS NULL`];
    const scopeCond = await this.buildPropertyScopeCondition(propertyId, companyId);
    if (scopeCond) {
      conditions.push(scopeCond);
    }

    const unmappedRows = await db.select({
      accountId: ledgerLines.accountId,
      totalDebit: sql<number>`SUM(CAST(${ledgerLines.debit} AS NUMERIC))`,
      totalCredit: sql<number>`SUM(CAST(${ledgerLines.credit} AS NUMERIC))`,
      lineCount: sql<number>`COUNT(*)::int`
    }).from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .leftJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
      .where(and(...conditions))
      .groupBy(ledgerLines.accountId);

    return unmappedRows.map(r => ({
      accountId: r.accountId,
      totalDebit: Number(r.totalDebit || 0),
      totalCredit: Number(r.totalCredit || 0),
      lineCount: Number(r.lineCount || 0)
    }));
  }

  async getProfitAndLoss(propertyId?: string, companyIdOrOptions?: string | { failClosed?: boolean }, options?: { failClosed?: boolean }) {
    const companyId = typeof companyIdOrOptions === 'string' ? companyIdOrOptions : undefined;
    const effectiveOptions = typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null ? companyIdOrOptions : options;

    const unmappedAccounts = await this.getUnmappedLedgerAccounts(propertyId, companyId);
    if (effectiveOptions?.failClosed && unmappedAccounts.length > 0) {
      const codes = unmappedAccounts.map(u => u.accountId).join(', ');
      throw new Error(`UNMAPPED_LEDGER_ACCOUNTS: Financial report cannot be generated because ledger lines reference unmapped account code(s): ${codes}`);
    }

    const conditions = [inArray(chartOfAccounts.accountType, ['REVENUE', 'EXPENSE'])];
    const scopeCond = await this.buildPropertyScopeCondition(propertyId, companyId);
    if (scopeCond) {
      conditions.push(scopeCond);
    }
    
    const results = await db.select({
      account: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.accountType,
      balance: sql<number>`SUM(CAST(${ledgerLines.credit} AS NUMERIC)) - SUM(CAST(${ledgerLines.debit} AS NUMERIC))`
    }).from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
      .where(and(...conditions))
      .groupBy(chartOfAccounts.code, chartOfAccounts.name, chartOfAccounts.accountType);
    
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const r of results) {
      if (r.type === 'REVENUE') totalRevenue += Number(r.balance);
      else if (r.type === 'EXPENSE') totalExpense += Math.abs(Number(r.balance));
    }

    const unmappedCodes = unmappedAccounts.map(u => u.accountId);
    const hasUnmapped = unmappedAccounts.length > 0;

    return {
      revenue: results.filter(r => r.type === 'REVENUE'),
      expenses: results.filter(r => r.type === 'EXPENSE'),
      totalRevenue,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
      isComplete: !hasUnmapped,
      hasUnmappedAccounts: hasUnmapped,
      unmappedAccounts,
      unmappedAccountCodes: unmappedCodes,
      warning: hasUnmapped
        ? `INCOMPLETE_REPORT: Ledger lines reference unmapped account code(s) (${unmappedCodes.join(', ')}). Report totals exclude unmapped accounts.`
        : undefined
    };
  }

  async getBalanceSheet(propertyId?: string, companyIdOrOptions?: string | { failClosed?: boolean }, options?: { failClosed?: boolean }) {
    const companyId = typeof companyIdOrOptions === 'string' ? companyIdOrOptions : undefined;
    const effectiveOptions = typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null ? companyIdOrOptions : options;

    const unmappedAccounts = await this.getUnmappedLedgerAccounts(propertyId, companyId);
    if (effectiveOptions?.failClosed && unmappedAccounts.length > 0) {
      const codes = unmappedAccounts.map(u => u.accountId).join(', ');
      throw new Error(`UNMAPPED_LEDGER_ACCOUNTS: Balance Sheet cannot be generated because ledger lines reference unmapped account code(s): ${codes}`);
    }

    const conditions = [inArray(chartOfAccounts.accountType, ['ASSET', 'LIABILITY', 'EQUITY'])];
    const scopeCond = await this.buildPropertyScopeCondition(propertyId, companyId);
    if (scopeCond) {
      conditions.push(scopeCond);
    }
    
    const results = await db.select({
      account: chartOfAccounts.code,
      name: chartOfAccounts.name,
      type: chartOfAccounts.accountType,
      balance: sql<number>`SUM(CAST(${ledgerLines.debit} AS NUMERIC)) - SUM(CAST(${ledgerLines.credit} AS NUMERIC))`
    }).from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
      .where(and(...conditions))
      .groupBy(chartOfAccounts.code, chartOfAccounts.name, chartOfAccounts.accountType);

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const r of results) {
      if (r.type === 'ASSET') totalAssets += Number(r.balance);
      else if (r.type === 'LIABILITY') totalLiabilities += Math.abs(Number(r.balance));
      else if (r.type === 'EQUITY') totalEquity += Math.abs(Number(r.balance));
    }

    const pnl = await this.getProfitAndLoss(propertyId, companyId, effectiveOptions);

    const unmappedCodes = unmappedAccounts.map(u => u.accountId);
    const hasUnmapped = unmappedAccounts.length > 0;

    return {
      assets: results.filter(r => r.type === 'ASSET'),
      liabilities: results.filter(r => r.type === 'LIABILITY'),
      equity: results.filter(r => r.type === 'EQUITY'),
      totalAssets,
      totalLiabilities,
      totalEquity: totalEquity + pnl.netIncome,
      isComplete: !hasUnmapped,
      hasUnmappedAccounts: hasUnmapped,
      unmappedAccounts,
      unmappedAccountCodes: unmappedCodes,
      warning: hasUnmapped
        ? `INCOMPLETE_REPORT: Ledger lines reference unmapped account code(s) (${unmappedCodes.join(', ')}). Balance Sheet totals exclude unmapped accounts.`
        : undefined
    };
  }

  async getTrialBalance(propertyId?: string, companyIdOrOptions?: string | { failClosed?: boolean }, options?: { failClosed?: boolean }) {
    const companyId = typeof companyIdOrOptions === 'string' ? companyIdOrOptions : undefined;
    const effectiveOptions = typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null ? companyIdOrOptions : options;

    const unmappedAccounts = await this.getUnmappedLedgerAccounts(propertyId, companyId);
    if (effectiveOptions?.failClosed && unmappedAccounts.length > 0) {
      const codes = unmappedAccounts.map(u => u.accountId).join(', ');
      throw new Error(`UNMAPPED_LEDGER_ACCOUNTS: Trial Balance cannot be generated because ledger lines reference unmapped account code(s): ${codes}`);
    }

    const conditions = [];
    const scopeCond = await this.buildPropertyScopeCondition(propertyId, companyId);
    if (scopeCond) {
      conditions.push(scopeCond);
    }

    const results = await db.select({
      account: ledgerLines.accountId,
      name: chartOfAccounts.name,
      debit: sql<number>`SUM(CAST(${ledgerLines.debit} AS NUMERIC))`,
      credit: sql<number>`SUM(CAST(${ledgerLines.credit} AS NUMERIC))`
    }).from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .leftJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(ledgerLines.accountId, chartOfAccounts.name);

    const unmappedCodes = unmappedAccounts.map(u => u.accountId);
    const hasUnmapped = unmappedAccounts.length > 0;

    Object.assign(results, {
      isComplete: !hasUnmapped,
      hasUnmappedAccounts: hasUnmapped,
      unmappedAccounts,
      unmappedAccountCodes: unmappedCodes,
      warning: hasUnmapped
        ? `INCOMPLETE_MAPPING: Trial Balance contains ${unmappedAccounts.length} unmapped account code(s) (${unmappedCodes.join(', ')}).`
        : undefined
    });

    return results;
  }

  async getGeneralLedger(propertyId?: string, companyIdOrOptions?: string | { failClosed?: boolean }, options?: { failClosed?: boolean }) {
    const companyId = typeof companyIdOrOptions === 'string' ? companyIdOrOptions : undefined;
    const effectiveOptions = typeof companyIdOrOptions === 'object' && companyIdOrOptions !== null ? companyIdOrOptions : options;

    const unmappedAccounts = await this.getUnmappedLedgerAccounts(propertyId, companyId);
    if (effectiveOptions?.failClosed && unmappedAccounts.length > 0) {
      const codes = unmappedAccounts.map(u => u.accountId).join(', ');
      throw new Error(`UNMAPPED_LEDGER_ACCOUNTS: General Ledger cannot be generated because ledger lines reference unmapped account code(s): ${codes}`);
    }

    const conditions = [];
    const scopeCond = await this.buildPropertyScopeCondition(propertyId, companyId);
    if (scopeCond) {
      conditions.push(scopeCond);
    }

    const results = await db.select({
      date: journalEntries.date,
      description: journalEntries.description,
      account: ledgerLines.accountId,
      accountName: chartOfAccounts.name,
      debit: ledgerLines.debit,
      credit: ledgerLines.credit
    }).from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .leftJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(journalEntries.date));

    const unmappedCodes = unmappedAccounts.map(u => u.accountId);
    const hasUnmapped = unmappedAccounts.length > 0;

    Object.assign(results, {
      isComplete: !hasUnmapped,
      hasUnmappedAccounts: hasUnmapped,
      unmappedAccounts,
      unmappedAccountCodes: unmappedCodes,
      warning: hasUnmapped
        ? `INCOMPLETE_MAPPING: General Ledger contains unmapped account code(s) (${unmappedCodes.join(', ')}).`
        : undefined
    });

    return results;
  }

  classifyCashFlowActivity(referenceType?: string | null): 'OPERATING' | 'INVESTING' | 'FINANCING' {
    const ref = (referenceType || '').toUpperCase();
    if (
      ref.includes('SALE') ||
      ref.includes('PURCHASE') ||
      ref.includes('CAPITAL') ||
      ref.includes('INVEST') ||
      ref.includes('DISPOSAL') ||
      ref === 'PROPERTY_SALE' ||
      ref === 'PROPERTY_PURCHASE'
    ) {
      return 'INVESTING';
    }
    if (
      ref.includes('EQUITY') ||
      ref.includes('DEPOSIT') ||
      ref.includes('SECURITY_DEPOSIT') ||
      ref.includes('FINANC') ||
      ref.includes('LOAN') ||
      ref.includes('MORTGAGE') ||
      ref.includes('DISTRIBUTION') ||
      ref.includes('DIVIDEND') ||
      ref === 'CAPITAL_CONTRIBUTION'
    ) {
      return 'FINANCING';
    }
    return 'OPERATING';
  }

  async getCashFlow(propertyId?: string, companyId?: string) {
    const conditions = [inArray(ledgerLines.accountId, ['1010', '1020'])];
    const scopeCond = await this.buildPropertyScopeCondition(propertyId, companyId);
    if (scopeCond) {
      conditions.push(scopeCond);
    }

    const cashMovements = await db.select({
      account: chartOfAccounts.code,
      name: chartOfAccounts.name,
      referenceType: journalEntries.referenceType,
      debit: sql<number>`SUM(CAST(${ledgerLines.debit} AS NUMERIC))`,
      credit: sql<number>`SUM(CAST(${ledgerLines.credit} AS NUMERIC))`
    }).from(ledgerLines)
      .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
      .where(and(...conditions))
      .groupBy(chartOfAccounts.code, chartOfAccounts.name, journalEntries.referenceType);

    let operatingInflows = 0;
    let operatingOutflows = 0;
    let investingInflows = 0;
    let investingOutflows = 0;
    let financingInflows = 0;
    let financingOutflows = 0;

    const cashAccountsMap = new Map<string, { account: string; name: string; inflows: number; outflows: number; net: number }>();

    for (const mov of cashMovements) {
      const inflow = Number(mov.debit || 0);
      const outflow = Number(mov.credit || 0);
      const category = this.classifyCashFlowActivity(mov.referenceType);

      if (category === 'OPERATING') {
        operatingInflows += inflow;
        operatingOutflows += outflow;
      } else if (category === 'INVESTING') {
        investingInflows += inflow;
        investingOutflows += outflow;
      } else if (category === 'FINANCING') {
        financingInflows += inflow;
        financingOutflows += outflow;
      }

      const existingAcc = cashAccountsMap.get(mov.account) || {
        account: mov.account,
        name: mov.name,
        inflows: 0,
        outflows: 0,
        net: 0
      };
      existingAcc.inflows += inflow;
      existingAcc.outflows += outflow;
      existingAcc.net = existingAcc.inflows - existingAcc.outflows;
      cashAccountsMap.set(mov.account, existingAcc);
    }

    const netOperatingCashFlow = operatingInflows - operatingOutflows;
    const netInvestingCashFlow = investingInflows - investingOutflows;
    const netFinancingCashFlow = financingInflows - financingOutflows;
    const netCashFlow = netOperatingCashFlow + netInvestingCashFlow + netFinancingCashFlow;

    return {
      operatingInflows,
      operatingOutflows,
      netOperatingCashFlow,
      investingInflows,
      investingOutflows,
      netInvestingCashFlow,
      financingInflows,
      financingOutflows,
      netFinancingCashFlow,
      totalInflows: operatingInflows + investingInflows + financingInflows,
      totalOutflows: operatingOutflows + investingOutflows + financingOutflows,
      netCashFlow,
      cashAccounts: Array.from(cashAccountsMap.values())
    };
  }

  async reverseJournalEntry(journalEntryId: string, userId: string, reason: string, idempotencyKey?: string) {
    return await db.transaction(async (tx) => {
      // 1. Fetch original journal entry
      const [original] = await tx.select().from(journalEntries).where(eq(journalEntries.id, journalEntryId)).limit(1);
      if (!original) {
        throw new Error(`Journal entry ${journalEntryId} not found`);
      }

      // 2. Check idempotency / existing reversal
      if (idempotencyKey) {
        const [existingByReq] = await tx.select().from(reversalRecords).where(eq(reversalRecords.idempotencyKey, idempotencyKey)).limit(1);
        if (existingByReq) {
          const [compEntry] = await tx.select().from(journalEntries).where(eq(journalEntries.id, existingByReq.reversalJournalId)).limit(1);
          return { reversalRecord: existingByReq, compensatingJournalEntry: compEntry, alreadyReversed: true };
        }
      }

      const [existingForEntry] = await tx.select().from(reversalRecords).where(eq(reversalRecords.originalJournalId, journalEntryId)).limit(1);
      if (existingForEntry) {
        const [compEntry] = await tx.select().from(journalEntries).where(eq(journalEntries.id, existingForEntry.reversalJournalId)).limit(1);
        return { reversalRecord: existingForEntry, compensatingJournalEntry: compEntry, alreadyReversed: true };
      }

      // 3. Fetch original ledger lines
      const lines = await tx.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, journalEntryId));
      if (lines.length === 0) {
        throw new Error(`Cannot reverse journal entry without ledger lines`);
      }

      // 4. Construct balanced compensating lines (swap debits and credits)
      const compensatingLines = lines.map(line => ({
        accountId: line.accountId,
        debit: Number(line.credit || 0),
        credit: Number(line.debit || 0)
      }));

      // 5. Post compensating journal entry (historical original remains immutable)
      const compensatingEntry = await financeRepository.postJournalEntry(
        original.propertyId,
        `Reversal of JE ${journalEntryId}: ${reason}`,
        compensatingLines,
        {
          referenceType: 'REVERSAL',
          referenceId: journalEntryId,
          idempotencyKey: idempotencyKey ? `comp_${idempotencyKey}` : undefined
        }
      );

      // 6. Record reversal in reversalRecords table
      const [reversalRecord] = await tx.insert(reversalRecords).values({
        originalJournalId: journalEntryId,
        reversalJournalId: compensatingEntry.id,
        reason,
        processedBy: userId,
        idempotencyKey: idempotencyKey || null
      }).returning();

      return { reversalRecord, compensatingJournalEntry: compensatingEntry, alreadyReversed: false };
    });
  }

  async reconcileBankTransaction(
    bankStatementId: string,
    journalEntryId: string,
    matchedAmount: number,
    userId: string,
    bankTransactionId?: string
  ) {
    return await db.transaction(async (tx) => {
      // 1. Verify Bank statement exists
      const [statement] = await tx.select().from(bankStatements).where(eq(bankStatements.id, bankStatementId)).limit(1);
      if (!statement) {
        const err: any = new Error(`Bank statement ${bankStatementId} not found`);
        err.status = 404;
        throw err;
      }

      // 2. Check if already reconciled
      const existing = await tx.select().from(bankReconciliations).where(
        and(
          eq(bankReconciliations.bankStatementId, bankStatementId),
          eq(bankReconciliations.journalEntryId, journalEntryId)
        )
      ).limit(1);

      if (existing.length > 0) {
        const err: any = new Error('Transaction or journal entry is already reconciled');
        err.status = 409;
        err.code = 'ALREADY_RECONCILED';
        throw err;
      }

      // 3. Fetch candidate journal entry and lines
      const [entry] = await tx.select().from(journalEntries).where(eq(journalEntries.id, journalEntryId)).limit(1);
      if (!entry) {
        const err: any = new Error(`Journal entry ${journalEntryId} not found`);
        err.status = 404;
        throw err;
      }

      // 4. Find cash line (1010 or 1020)
      const lines = await tx.select().from(ledgerLines).where(eq(ledgerLines.journalEntryId, journalEntryId));
      const cashLines = lines.filter(l => l.accountId === '1010' || l.accountId === '1020');
      if (cashLines.length === 0) {
        const err: any = new Error(`Target journal entry ${journalEntryId} does not contain an authoritative cash account (1010/1020)`);
        err.status = 422;
        err.code = 'NO_CASH_ACCOUNT';
        throw err;
      }

      const journalCashAmount = cashLines.reduce((acc, l) => acc + Math.max(Number(l.debit || 0), Number(l.credit || 0)), 0);

      if (Math.abs(journalCashAmount - matchedAmount) > 0.001) {
        const err: any = new Error(`Reconciliation amount mismatch: bank amount ${matchedAmount} does not equal journal cash amount ${journalCashAmount}`);
        err.status = 422;
        err.code = 'AMOUNT_MISMATCH';
        throw err;
      }

      const [rec] = await tx.insert(bankReconciliations).values({
        bankStatementId,
        bankTransactionId: bankTransactionId || null,
        journalEntryId,
        matchedAmount: matchedAmount.toString(),
        matchedBy: userId,
        status: 'MATCHED'
      }).returning();

      return rec;
    });
  }
}

export const financeService = new FinanceService();
