import { Router } from 'express';
import { requireDatabase } from '../middleware/dbGuard.js';
import { requireAuth, requirePropertyPermission } from '../middleware/auth.js';
import { Permission, UserRole, JournalEntryStatus, ExpenseStatus } from '../../types/index.js';
import { auditService } from '../services/audit.js';
import { financeRepository } from '../repositories/finance.js';
import { financeService } from '../services/finance.js';
import { commissionService, CommissionService } from '../services/commission.js';
import { db } from '../../db/index.js';
import { 
  chartOfAccounts, 
  journalEntries, 
  ledgerLines, 
  paymentRecords, 
  commissions, 
  accountsReceivable, 
  accountsPayable,
  financialPolicies,
  financialPeriods,
  taxRates,
  exchangeRates,
  bankAccounts,
  bankStatements,
  bankReconciliations,
  managementAgreements,
  ownershipRecords,
  properties,
  leases,
  rentSchedules,
  ownerSettlements
} from '../../db/schema.js';
import { eq, desc, and, sum, sql, or, ilike, inArray } from 'drizzle-orm';

const router = Router();

export const isAuthorizedForFinance = (user: any): boolean => {
  if (!user || !user.roles) return false;
  const financeRoles = [
    'FINANCE_ADMIN',
    'PLATFORM_ADMIN',
    'SUPER_ADMIN',
    UserRole.PLATFORM_ADMIN,
    UserRole.COMPANY,
    'COMPANY_ADMIN',
    'ACCOUNTANT'
  ];
  return user.roles.some((r: any) => financeRoles.includes(r));
};



router.use(async (req, res, next) => {
  await requireAuth(req, res, () => {
    if (!isAuthorizedForFinance(req.user)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges for finance operations' });
    }
    const isCompany = req.user.roles?.some((r: any) => [UserRole.COMPANY, 'COMPANY_ADMIN', 'COMPANY_MEMBER', 'ACCOUNTANT'].includes(r));
    if (isCompany && req.query.companyId && req.query.companyId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access financial statements of another company' });
    }
        next();
  });
});

export function handleFinanceError(res: any, error: any) {
  const isDbUnavail = 
    error.status === 503 || 
    error.code === 'ECONNREFUSED' || 
    error.message?.includes('ECONNREFUSED') || 
    error.message?.includes('DATABASE_NOT_CONFIGURED') || 
    error.cause?.code === 'ECONNREFUSED' ||
    String(error.cause || '').includes('ECONNREFUSED') ||
    String(error || '').includes('ECONNREFUSED');

  if (isDbUnavail) {
    return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED', message: 'Database connection unavailable' });
  }
  return res.status(500).json({ error: error.message || 'Internal Server Error' });
}

// ==========================================
// FINANCE DASHBOARD & KPI
// ==========================================

router.get('/dashboard', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view finance dashboard' });
  }

  try {
    const userRoles = req.user.roles || [];
    const isPlatformAdmin = userRoles.some((r: string) => ['FINANCE_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));
    const userOrgId = req.user.organizationId;

    let entries: any[] = [];
    let payments: any[] = [];
    let pnl: any = { totalRevenue: 0, totalExpense: 0, netIncome: 0 };
    let pendingReceivables = 0;

    if (isPlatformAdmin) {
      const [entriesRes, paymentsRes] = await Promise.all([
        db.select().from(journalEntries).orderBy(desc(journalEntries.createdAt)).limit(10),
        db.select().from(paymentRecords).orderBy(desc(paymentRecords.createdAt)).limit(10),
      ]);
      entries = entriesRes;
      payments = paymentsRes;
      pnl = await financeService.getProfitAndLoss();

      const receivablesResult = await db.select({
        balance: sql<number>`SUM(CAST(${ledgerLines.debit} AS NUMERIC)) - SUM(CAST(${ledgerLines.credit} AS NUMERIC))`
      }).from(ledgerLines)
        .innerJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
        .where(eq(chartOfAccounts.code, '1200')); // Accounts Receivable

      pendingReceivables = Number(receivablesResult[0]?.balance || 0);
    } else if (userOrgId) {
      const companyPropertyIds = await financeService.getCompanyPropertyIds(userOrgId);
      if (companyPropertyIds.length > 0) {
        const [entriesRes, paymentsRes] = await Promise.all([
          db.select().from(journalEntries)
            .where(inArray(journalEntries.propertyId, companyPropertyIds))
            .orderBy(desc(journalEntries.createdAt))
            .limit(10),
          db.select().from(paymentRecords)
            .where(inArray(paymentRecords.propertyId, companyPropertyIds))
            .orderBy(desc(paymentRecords.createdAt))
            .limit(10),
        ]);
        entries = entriesRes;
        payments = paymentsRes;
        pnl = await financeService.getProfitAndLoss(undefined, userOrgId);

        const receivablesResult = await db.select({
          balance: sql<number>`SUM(CAST(${ledgerLines.debit} AS NUMERIC)) - SUM(CAST(${ledgerLines.credit} AS NUMERIC))`
        }).from(ledgerLines)
          .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
          .innerJoin(chartOfAccounts, eq(ledgerLines.accountId, chartOfAccounts.code))
          .where(and(
            eq(chartOfAccounts.code, '1200'),
            inArray(journalEntries.propertyId, companyPropertyIds)
          ));

        pendingReceivables = Number(receivablesResult[0]?.balance || 0);
      }
    }

    res.json({
      metrics: {
        totalRevenue: pnl.totalRevenue.toString(),
        pendingReceivables: pendingReceivables.toString(),
        totalExpenses: pnl.totalExpense.toString(),
        netIncome: pnl.netIncome.toString()
      },
      recentTransactions: payments,
      recentJournalEntries: entries
    });
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// CHART OF ACCOUNTS
// ==========================================

router.get('/accounts', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view chart of accounts' });
  }

  try {
    const accounts = await db.select().from(chartOfAccounts).orderBy(chartOfAccounts.code);
    res.json(accounts);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// DOUBLE-ENTRY ACCOUNTING
// ==========================================

// Get Journal Entries
router.get('/journal-entries/:propertyId', requireAuth, requireDatabase, requirePropertyPermission(Permission.VIEW_FINANCIALS), async (req, res) => {
  try {
    const { propertyId } = req.params;
    const entries = await financeRepository.getJournalEntries(propertyId as string);
    res.json(entries);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// Post Journal Entry
router.post('/journal-entries', requireAuth, requireDatabase, requirePropertyPermission(Permission.MANAGE_FINANCIALS), async (req, res) => {
  const { propertyId, lines, description, idempotencyKey } = req.body;
  
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "Lines array is required" });
  }

  // Map to the correct format expected by the repo
  const repoLines = lines.map((line: any) => ({
    accountId: line.accountId,
    debit: Number(line.debit) || 0,
    credit: Number(line.credit) || 0
  }));

  try {
    const entry = await financeRepository.postJournalEntry(
      propertyId, 
      description, 
      repoLines,
      { idempotencyKey }
    );
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'POST_JOURNAL_ENTRY',
      resourceType: 'JournalEntry',
      resourceId: entry.id as string,
      changes: { propertyId, description, status: JournalEntryStatus.POSTED },
      ipAddress: (req.ip || "") as string
    });

    res.json(entry);
  } catch (error: any) {
    const isDbUnavail = error.status === 503 || error.code === 'ECONNREFUSED' || error.message?.includes('DATABASE_NOT_CONFIGURED');
    if (isDbUnavail) {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// EXPENSE MANAGEMENT
// ==========================================

router.post('/expenses', requireAuth, requireDatabase, requirePropertyPermission(Permission.MANAGE_EXPENSES), async (req, res) => {
  const { propertyId, amount, category, description, idempotencyKey, deductFromOwner } = req.body;
  
  try {
    const entry = await financeRepository.postJournalEntry(propertyId, `Expense: ${description}`, [
      { accountId: '5000', debit: Number(amount), credit: 0 }, // Operating Expense
      { accountId: '2000', debit: 0, credit: Number(amount) }  // Trade Accounts Payable
    ], {
      idempotencyKey
    });

    if (deductFromOwner) {
      await financeRepository.postJournalEntry(propertyId, `Deduct Expense from Owner: ${description}`, [
        { accountId: '2010', debit: Number(amount), credit: 0 }, // Reduces Owner Net Payable
        { accountId: '5000', debit: 0, credit: Number(amount) }  // Offsets Operating Expense
      ], {
        idempotencyKey: idempotencyKey ? `${idempotencyKey}_OWNER_DEDUCT` : undefined
      });

      await db.transaction(async (tx) => {
        const [settlement] = await tx.select().from(ownerSettlements)
          .where(and(eq(ownerSettlements.propertyId, propertyId), eq(ownerSettlements.status, 'AVAILABLE')))
          .limit(1)
          .for('update');

        if (settlement) {
          const currentExp = Number(settlement.totalExpensesIqd || 0);
          const currentNet = Number(settlement.netPayableIqd || 0);
          const newExp = currentExp + Number(amount);
          const newNet = Math.max(0, currentNet - Number(amount));

          await tx.update(ownerSettlements)
            .set({
              totalExpensesIqd: newExp.toString(),
              netPayableIqd: newNet.toString(),
              updatedAt: new Date()
            })
            .where(eq(ownerSettlements.id, settlement.id));
        }
      });
    }

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'SUBMIT_EXPENSE',
      resourceType: 'Expense',
      resourceId: entry.id as string,
      changes: { propertyId, amount, category, status: ExpenseStatus.SUBMITTED },
      ipAddress: (req.ip || "") as string
    });

    res.json({ message: "Expense posted successfully", journalEntry: entry });
  } catch (error: any) {
    const isDbUnavail = error.status === 503 || error.code === 'ECONNREFUSED' || error.message?.includes('DATABASE_NOT_CONFIGURED');
    if (isDbUnavail) {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: error.message });
  }
});

// ==========================================
// REFUNDS & REVERSALS
// ==========================================

router.post('/refunds', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to process refunds' });
  }
  const { paymentId, reason } = req.body;
  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId is required' });
  }
  try {
    const entry = await financeService.refundPayment(paymentId, req.user!.id, reason);
    
    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'PROCESS_REFUND',
      resourceType: 'Payment',
      resourceId: paymentId,
      changes: { status: 'REFUNDED', reason },
      ipAddress: (req.ip || "") as string
    });

    res.json({ message: "Refund processed successfully", journalEntry: entry });
  } catch (error: any) {
    const isDbUnavail = error.status === 503 || error.code === 'ECONNREFUSED' || error.message?.includes('DATABASE_NOT_CONFIGURED');
    if (isDbUnavail) {
      return res.status(503).json({ error: 'DATABASE_NOT_CONFIGURED' });
    }
    res.status(400).json({ error: error.message });
  }
});

router.post('/reversals', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to reverse journal entries' });
  }
  const { journalEntryId, reason, idempotencyKey } = req.body;
  if (!journalEntryId || !reason) {
    return res.status(400).json({ error: 'journalEntryId and reason are required' });
  }

  try {
    const result = await financeService.reverseJournalEntry(journalEntryId, req.user!.id, reason, idempotencyKey);

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'REVERSE_JOURNAL_ENTRY',
      resourceType: 'JournalEntry',
      resourceId: journalEntryId,
      changes: { reason, compensatingJournalEntryId: result.compensatingJournalEntry?.id, reversalRecordId: result.reversalRecord?.id },
      ipAddress: (req.ip || "") as string
    });

    res.json({ message: "Journal entry reversed successfully", ...result });
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// FINANCIAL STATEMENTS
// ==========================================

export async function authorizeStatementAccess(
  req: any, 
  res: any
): Promise<{ authorized: boolean; effectivePropertyId?: string; effectiveCompanyId?: string }> {
  if (!isAuthorizedForFinance(req.user)) {
    res.status(403).json({ error: 'Forbidden: Insufficient privileges to view financial statements' });
    return { authorized: false };
  }

  const userRoles: string[] = req.user.roles || [];
  const isPlatformFinance = userRoles.some(r => ['FINANCE_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r));
  const isCompany = userRoles.some(r => [UserRole.COMPANY, 'COMPANY_ADMIN', 'COMPANY_MEMBER', 'ACCOUNTANT'].includes(r));

  const requestedPropertyId = req.query.propertyId as string | undefined;
  const requestedCompanyId = req.query.companyId as string | undefined;

  // Platform finance has global access
  if (isPlatformFinance) {
    return { authorized: true, effectivePropertyId: requestedPropertyId, effectiveCompanyId: requestedCompanyId };
  }

  // Company authorization
  if (isCompany) {
    const userOrgId = req.user.organizationId;
    // Cross-company isolation: Company A cannot access Company B statements
    if (requestedCompanyId && requestedCompanyId !== userOrgId) {
      res.status(403).json({ error: 'Forbidden: Cannot access financial statements of another company' });
      return { authorized: false };
    }

    if (requestedPropertyId) {
      try {
        const agreements = await db.select().from(managementAgreements).where(and(
          eq(managementAgreements.companyId, userOrgId),
          eq(managementAgreements.propertyId, requestedPropertyId),
          eq(managementAgreements.status, 'ACTIVE')
        )).limit(1);

        if (agreements.length === 0) {
          res.status(403).json({ error: 'Forbidden: Company does not have an active authorized management agreement for this property' });
          return { authorized: false };
        }
      } catch (err: any) {
        handleFinanceError(res, err);
        return { authorized: false };
      }
    }

    return { authorized: true, effectivePropertyId: requestedPropertyId, effectiveCompanyId: userOrgId };
  }

  return { authorized: true, effectivePropertyId: requestedPropertyId, effectiveCompanyId: requestedCompanyId };
}

router.get('/statements/pnl', requireAuth, requireDatabase, async (req, res) => {
  const auth = await authorizeStatementAccess(req, res);
  if (!auth.authorized) return;

  try {
    const failClosed = req.query.failClosed === 'true';
    const pnl = await financeService.getProfitAndLoss(auth.effectivePropertyId, auth.effectiveCompanyId, { failClosed });
    if (pnl.hasUnmappedAccounts) {
      res.setHeader('X-Report-Warning', pnl.warning || 'INCOMPLETE_REPORT');
    }
    res.json(pnl);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/statements/balance-sheet', requireAuth, requireDatabase, async (req, res) => {
  const auth = await authorizeStatementAccess(req, res);
  if (!auth.authorized) return;

  try {
    const failClosed = req.query.failClosed === 'true';
    const data = await financeService.getBalanceSheet(auth.effectivePropertyId, auth.effectiveCompanyId, { failClosed });
    if (data.hasUnmappedAccounts) {
      res.setHeader('X-Report-Warning', data.warning || 'INCOMPLETE_REPORT');
    }
    res.json(data);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/statements/trial-balance', requireAuth, requireDatabase, async (req, res) => {
  const auth = await authorizeStatementAccess(req, res);
  if (!auth.authorized) return;

  try {
    const failClosed = req.query.failClosed === 'true';
    const data = await financeService.getTrialBalance(auth.effectivePropertyId, auth.effectiveCompanyId, { failClosed });
    if ((data as any).hasUnmappedAccounts) {
      res.setHeader('X-Report-Warning', (data as any).warning || 'INCOMPLETE_MAPPING');
    }
    res.json(data);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/statements/general-ledger', requireAuth, requireDatabase, async (req, res) => {
  const auth = await authorizeStatementAccess(req, res);
  if (!auth.authorized) return;

  try {
    const failClosed = req.query.failClosed === 'true';
    const data = await financeService.getGeneralLedger(auth.effectivePropertyId, auth.effectiveCompanyId, { failClosed });
    if ((data as any).hasUnmappedAccounts) {
      res.setHeader('X-Report-Warning', (data as any).warning || 'INCOMPLETE_MAPPING');
    }
    res.json(data);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/statements/cash-flow', requireAuth, requireDatabase, async (req, res) => {
  const auth = await authorizeStatementAccess(req, res);
  if (!auth.authorized) return;

  try {
    const data = await financeService.getCashFlow(auth.effectivePropertyId, auth.effectiveCompanyId);
    res.json(data);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// AR & AP
// ==========================================

router.get('/ar', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view accounts receivable' });
  }
  try {
    const receivables = await db.select().from(accountsReceivable).orderBy(desc(accountsReceivable.dueDate));
    res.json(receivables);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/ap', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view accounts payable' });
  }
  try {
    const payables = await db.select().from(accountsPayable).orderBy(desc(accountsPayable.dueDate));
    res.json(payables);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// PERIODS & POLICIES
// ==========================================

router.get('/periods', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view financial periods' });
  }
  try {
    const periods = await db.select().from(financialPeriods).orderBy(desc(financialPeriods.startDate));
    res.json(periods);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/policies', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view financial policies' });
  }
  try {
    const policies = await db.select().from(financialPolicies);
    res.json(policies);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// TAX & EXCHANGE RATES
// ==========================================

router.get('/tax-rates', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view tax rates' });
  }
  try {
    const taxes = await db.select().from(taxRates);
    res.json(taxes);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.get('/exchange-rates', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view exchange rates' });
  }
  try {
    const rates = await db.select().from(exchangeRates).orderBy(desc(exchangeRates.date));
    res.json(rates);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// BANK RECONCILIATION
// ==========================================

router.get('/reconciliation', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view bank reconciliations' });
  }
  try {
    const reconciliations = await db.select().from(bankReconciliations).orderBy(desc(bankReconciliations.createdAt));
    res.json(reconciliations);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

router.post('/reconciliation', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges to perform bank reconciliation' });
  }
  const { bankStatementId, journalEntryId, matchedAmount, bankTransactionId } = req.body;
  if (!bankStatementId || !journalEntryId || matchedAmount === undefined) {
    return res.status(400).json({ error: 'Missing required fields: bankStatementId, journalEntryId, matchedAmount' });
  }

  try {
    const rec = await financeService.reconcileBankTransaction(
      bankStatementId,
      journalEntryId,
      Number(matchedAmount),
      req.user!.id,
      bankTransactionId
    );

    await auditService.logAction({
      actorUserId: req.user!.id,
      actorRole: req.user!.roles[0] as string,
      action: 'RECONCILE_BANK_TRANSACTION',
      resourceType: 'BankReconciliation',
      resourceId: rec.id,
      changes: { bankStatementId, journalEntryId, matchedAmount },
      ipAddress: (req.ip || "") as string
    });

    res.json(rec);
  } catch (error: any) {
    if (error.status && error.status !== 500) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    handleFinanceError(res, error);
  }
});

// ==========================================
// COMMISSION SUMMARY
// ==========================================

router.get('/commissions/summary', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges for finance operations' });
  }

  const { propertyId, ownerId, companyId } = req.query as { propertyId?: string; ownerId?: string; companyId?: string };

  const isPlatformAdmin = req.user.roles?.some((r: any) => 
    ['FINANCE_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN', UserRole.PLATFORM_ADMIN].includes(r)
  );

  const isCompany = req.user.roles?.some((r: any) => 
    [UserRole.COMPANY, 'COMPANY_ADMIN', 'COMPANY_MEMBER', 'ACCOUNTANT'].includes(r)
  );

  // If company, force companyId scope or reject cross-company queries
  if (isCompany && !isPlatformAdmin) {
    if (companyId && companyId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Forbidden: Cannot access commission summary of another company' });
    }
  }

  const effectiveCompanyId = !isPlatformAdmin && isCompany ? req.user.organizationId : companyId;

  try {
    const summary = await commissionService.getCommissionSummary({
      propertyId,
      ownerId,
      companyId: effectiveCompanyId,
    });
    res.json(summary);
  } catch (error: any) {
    handleFinanceError(res, error);
  }
});

// ==========================================
// FEE & SETTLEMENT AUDIT (ACCOUNTANT VIEW)
// ==========================================

router.get('/fee-audit', requireAuth, requireDatabase, async (req, res) => {
  if (!isAuthorizedForFinance(req.user)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges for finance operations' });
  }

  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '25'), 10) || 25));
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : 'ALL';
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId.trim() : '';

    // Resolve active global platform fee
    let globalPlatformFeeRate = 0.05;
    try {
      const [feePolicy] = await db.select().from(financialPolicies)
        .where(eq(financialPolicies.policyType, 'PLATFORM_FEE_RATE'))
        .limit(1);
      if (feePolicy) {
        globalPlatformFeeRate = parseFloat(feePolicy.policyValue) || 0.05;
      }
    } catch (e) {
      console.warn('Failed to resolve PLATFORM_FEE_RATE, using fallback 0.05');
    }

    // Build query conditions
    const conditions: any[] = [];

    if (propertyId) {
      conditions.push(eq(paymentRecords.propertyId, propertyId));
    }

    if (statusFilter && statusFilter !== 'ALL') {
      conditions.push(eq(paymentRecords.status, statusFilter));
    }

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(properties.name, pattern),
          ilike(paymentRecords.id, pattern),
          ilike(paymentRecords.paymentMethod, pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Count total matching payments
    const [countRes] = await db.select({ count: sql<number>`count(*)` })
      .from(paymentRecords)
      .leftJoin(properties, eq(paymentRecords.propertyId, properties.id))
      .where(whereClause);

    const totalCount = Number(countRes?.count || 0);

    // Fetch paginated payment rows joined with property and rentSchedule
    const rows = await db.select({
      payment: paymentRecords,
      property: properties,
      schedule: rentSchedules,
    }).from(paymentRecords)
      .leftJoin(properties, eq(paymentRecords.propertyId, properties.id))
      .leftJoin(rentSchedules, eq(paymentRecords.rentScheduleId, rentSchedules.id))
      .where(whereClause)
      .orderBy(desc(paymentRecords.recordedDate), desc(paymentRecords.createdAt), desc(paymentRecords.id))
      .limit(limit)
      .offset((page - 1) * limit);

    // Fetch posted commissions for payments in this page to preserve historical accounting entries
    const paymentIds = rows.map(r => r.payment.id);
    const postedCommissionsMap = new Map<string, { commission: any; ledgerLines: any[] }>();
    if (paymentIds.length > 0) {
      const commRows = await db.select().from(commissions)
        .where(inArray(commissions.paymentRecordId, paymentIds));

      const jeIds = commRows.map(c => c.journalEntryId).filter((id): id is string => Boolean(id));
      const linesByJe = new Map<string, any[]>();
      if (jeIds.length > 0) {
        const lines = await db.select().from(ledgerLines)
          .where(inArray(ledgerLines.journalEntryId, jeIds));
        for (const l of lines) {
          if (!linesByJe.has(l.journalEntryId)) linesByJe.set(l.journalEntryId, []);
          linesByJe.get(l.journalEntryId)!.push(l);
        }
      }

      for (const c of commRows) {
        postedCommissionsMap.set(c.paymentRecordId, {
          commission: c,
          ledgerLines: c.journalEntryId ? (linesByJe.get(c.journalEntryId) || []) : []
        });
      }
    }

    // Process each row into authoritative audit item
    const items = rows.map(r => {
      const p = r.payment;
      const prop = r.property || ({} as any);
      const isConfirmed = p.status === 'CONFIRMED';
      const isReversed = p.status === 'REVERSED' || p.status === 'REFUNDED';
      const isPendingOrFailed = p.status === 'PENDING' || p.status === 'FAILED';

      const model = prop.operatingModel || 'FULLY_MANAGED';
      const currency = p.currency || 'IQD';
      const postedData = postedCommissionsMap.get(p.id);

      let collectedRent = 0;
      let platformFeeAmount = 0;
      let rentFeeAmount = 0;
      let managementFeeAmount = 0;
      let totalDeductions = 0;
      let ownerNetAmount = 0;
      let calculationBasis: 'POSTED_LEDGER' | 'CALCULATED_CONFIRMED' | 'NON_COLLECTED' = 'NON_COLLECTED';
      let platformFeeRate: number | null = null;
      let rentFeeRate: number | null = null;
      let managementFeeRate: number | null = null;

      if (isConfirmed) {
        collectedRent = Number(p.amount);

        if (postedData && postedData.ledgerLines.length > 0) {
          // Authoritative historical posted ledger lines (accounts 4010, 4011, 4012)
          calculationBasis = 'POSTED_LEDGER';
          const line4010 = postedData.ledgerLines.find(l => l.accountId === '4010');
          const line4011 = postedData.ledgerLines.find(l => l.accountId === '4011');
          const line4012 = postedData.ledgerLines.find(l => l.accountId === '4012');

          platformFeeAmount = line4010 ? Number(line4010.credit || 0) : 0;
          rentFeeAmount = line4011 ? Number(line4011.credit || 0) : 0;
          managementFeeAmount = line4012 ? Number(line4012.credit || 0) : 0;
          totalDeductions = platformFeeAmount + rentFeeAmount + managementFeeAmount;
          ownerNetAmount = collectedRent - totalDeductions;

          platformFeeRate = postedData.commission.rate ? Number(postedData.commission.rate) : globalPlatformFeeRate;
          rentFeeRate = prop.rentFee !== null && prop.rentFee !== undefined && prop.rentFee !== '' ? Number(prop.rentFee) : null;
          managementFeeRate = prop.managementFee !== null && prop.managementFee !== undefined && prop.managementFee !== '' ? Number(prop.managementFee) : null;
        } else {
          // Calculate dynamically using canonical CommissionService
          calculationBasis = 'CALCULATED_CONFIRMED';
          const calc = CommissionService.calculateFeesSync(
            collectedRent,
            globalPlatformFeeRate,
            model,
            prop.rentFee !== null && prop.rentFee !== undefined && prop.rentFee !== '' ? Number(prop.rentFee) : null,
            prop.managementFee !== null && prop.managementFee !== undefined && prop.managementFee !== '' ? Number(prop.managementFee) : null,
            currency
          );
          platformFeeAmount = calc.platformFeeAmount;
          rentFeeAmount = calc.rentFeeAmount;
          managementFeeAmount = calc.managementFeeAmount;
          totalDeductions = calc.totalFeeAmount;
          ownerNetAmount = calc.ownerNetAmount;
          platformFeeRate = calc.platformFeeRate;
          rentFeeRate = calc.rentFeeRate;
          managementFeeRate = calc.managementFeeRate;
        }
      } else if (isReversed) {
        calculationBasis = 'NON_COLLECTED';
        collectedRent = 0;
        platformFeeAmount = 0;
        rentFeeAmount = 0;
        managementFeeAmount = 0;
        totalDeductions = 0;
        ownerNetAmount = 0;
      } else {
        // Pending or Failed
        calculationBasis = 'NON_COLLECTED';
        collectedRent = 0;
        platformFeeAmount = 0;
        rentFeeAmount = 0;
        managementFeeAmount = 0;
        totalDeductions = 0;
        ownerNetAmount = 0;
      }

      return {
        id: p.id,
        paymentDate: p.recordedDate || (p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '2026-01-01'),
        referenceNumber: p.id.substring(0, 8),
        paymentMethod: p.paymentMethod || 'BANK_TRANSFER',
        rawAmount: Number(p.amount),
        status: p.status,
        propertyId: prop.id || p.propertyId,
        propertyName: prop.name || 'Property',
        operatingModel: model,
        collectedRent,
        platformFeeRate,
        platformFeeAmount,
        rentFeeRate,
        rentFeeAmount,
        managementFeeRate,
        managementFeeAmount,
        totalDeductions,
        ownerNetAmount,
        currency,
        calculationBasis,
        isReversed,
        isPendingOrFailed,
      };
    });

    const summary = items.reduce((acc, it) => {
      acc.totalCollectedRent += it.collectedRent;
      acc.totalPlatformFee += it.platformFeeAmount;
      acc.totalRentFee += it.rentFeeAmount;
      acc.totalManagementFee += it.managementFeeAmount;
      acc.totalDeductions += it.totalDeductions;
      acc.totalOwnerNet += it.ownerNetAmount;
      return acc;
    }, {
      totalCollectedRent: 0,
      totalPlatformFee: 0,
      totalRentFee: 0,
      totalManagementFee: 0,
      totalDeductions: 0,
      totalOwnerNet: 0,
      currency: 'IQD'
    });

    res.json({
      status: 'ok',
      items,
      summary,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1
      }
    });
  } catch (error: any) {
    console.error('Fee audit query error:', error);
    handleFinanceError(res, error);
  }
});

export default router;


