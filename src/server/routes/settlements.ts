import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { UserRole } from '../../types/index.js';
import { db } from '../../db/index.js';
import { ownerSettlements, payoutRequests, ledgerLines, journalEntries } from '../../db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { requireDatabase } from '../middleware/dbGuard.js';
import { financeRepository } from '../repositories/finance.js';
import { auditService } from '../services/audit.js';

export const settlementRouter = Router();
settlementRouter.use(requireDatabase);

// Get available settlements for owner
settlementRouter.get('/owner/settlements', requireAuth, requireRole([UserRole.PROPERTY_OWNER]), async (req: any, res: any) => {
  try {
    const records = await db.select().from(ownerSettlements).where(eq(ownerSettlements.ownerId, req.user.id));
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Request payout for a settlement
settlementRouter.post('/owner/settlements/:id/payout', requireAuth, requireRole([UserRole.PROPERTY_OWNER]), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { amountIqd, bankAccountNumber, bankName, iban } = req.body;
    
    // Check if settlement belongs to owner and is AVAILABLE
    const [settlement] = await db.select().from(ownerSettlements).where(and(
      eq(ownerSettlements.id, id),
      eq(ownerSettlements.ownerId, req.user.id)
    )).limit(1);

    if (!settlement) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    if (settlement.status !== 'AVAILABLE') {
      return res.status(400).json({ error: 'Settlement is not available for payout' });
    }

    const requestedAmount = amountIqd !== undefined && amountIqd !== null ? Number(amountIqd) : Number(settlement.netPayableIqd);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Payout amount must be greater than zero.' });
    }

    if (requestedAmount > Number(settlement.netPayableIqd)) {
      return res.status(400).json({ error: 'AMOUNT_EXCEEDS_SETTLEMENT', message: 'Requested payout amount exceeds available settlement balance.' });
    }

    // Create payout request
    const [payout] = await db.insert(payoutRequests).values({
      settlementId: id,
      ownerId: req.user.id,
      amountIqd: requestedAmount.toString(),
      bankAccountNumber,
      bankName,
      iban,
      status: 'REQUESTED',
      requestedByUserId: req.user.id,
    }).returning();

    // Update settlement status
    await db.update(ownerSettlements).set({ 
      status: 'REQUESTED',
      updatedAt: new Date(),
    }).where(eq(ownerSettlements.id, id));

    res.json(payout);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Finance Admin: Get all payout requests
settlementRouter.get('/finance/payouts', requireAuth, requireRole([UserRole.PLATFORM_ADMIN, 'finance_admin']), async (req: any, res: any) => {
  try {
    const records = await db.select().from(payoutRequests);
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Finance Admin: Approve/Process Payout
settlementRouter.post('/finance/payouts/:id/process', requireAuth, requireRole([UserRole.PLATFORM_ADMIN, 'finance_admin']), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status, externalTransactionReference, failureReason } = req.body; // e.g. COMPLETED, FAILED

    const [payout] = await db.select().from(payoutRequests).where(eq(payoutRequests.id, id)).limit(1);
    if (!payout) return res.status(404).json({ error: 'Payout not found' });

    if (payout.status === 'COMPLETED') {
      return res.status(400).json({ error: 'PAYOUT_ALREADY_COMPLETED', message: 'This payout has already been completed.' });
    }

    if (status === 'COMPLETED') {
      if (!externalTransactionReference) {
        return res.status(400).json({ error: 'External confirmation reference is mandatory for COMPLETED payouts' });
      }

      const payoutAmount = Number(payout.amountIqd);
      if (isNaN(payoutAmount) || payoutAmount <= 0) {
        return res.status(400).json({ error: 'INVALID_AMOUNT', message: 'Payout amount must be positive.' });
      }

      const [settlement] = await db.select().from(ownerSettlements).where(eq(ownerSettlements.id, payout.settlementId)).limit(1);

      // Defect C-03 Remediation: Cross-verify Account 2010 (Owner Net Payable) ledger balance
      if (settlement?.propertyId) {
        const [liabilityResult] = await db.select({
          totalCredit: sql<string>`COALESCE(SUM(CAST(${ledgerLines.credit} AS NUMERIC)), 0)`,
          totalDebit: sql<string>`COALESCE(SUM(CAST(${ledgerLines.debit} AS NUMERIC)), 0)`,
        }).from(ledgerLines)
          .innerJoin(journalEntries, eq(ledgerLines.journalEntryId, journalEntries.id))
          .where(and(
            eq(ledgerLines.accountId, '2010'),
            eq(journalEntries.propertyId, settlement.propertyId)
          ));

        const availableLiabilityBalance = Number(liabilityResult?.totalCredit || 0) - Number(liabilityResult?.totalDebit || 0);

        if (payoutAmount > availableLiabilityBalance + 0.001) {
          return res.status(400).json({
            error: 'INSUFFICIENT_PAYABLE_BALANCE',
            message: `Account 2010 payable balance (${availableLiabilityBalance} IQD) is insufficient for requested payout of ${payoutAmount} IQD.`,
          });
        }
      }

      // Post General Ledger Journal Entry:
      // Dr 2010 Owner Net Entitlement Payable (decreases liability owed to owner)
      // Cr 1010 Operating Cash / Bank (decreases company operating cash balance)
      const journalEntry = await financeRepository.postJournalEntry(
        settlement?.propertyId || 'GLOBAL',
        `Owner Payout Processed - Settlement ${payout.settlementId} - Ref ${externalTransactionReference}`,
        [
          { accountId: '2010', debit: payoutAmount, credit: 0, currency: 'IQD' },
          { accountId: '1010', debit: 0, credit: payoutAmount, currency: 'IQD' },
        ],
        {
          referenceType: 'PAYOUT',
          referenceId: payout.id,
          idempotencyKey: `JE_PAYOUT_${payout.id}`,
          currency: 'IQD',
        }
      );

      await db.update(payoutRequests).set({
        status: 'COMPLETED',
        externalTransactionReference,
        failureReason: null,
        approvedByUserId: req.user.id,
        updatedAt: new Date(),
      }).where(eq(payoutRequests.id, id));

      // Also update settlement
      await db.update(ownerSettlements).set({ 
        status: 'PAID',
        journalEntryId: journalEntry.id,
        updatedAt: new Date(),
      }).where(eq(ownerSettlements.id, payout.settlementId));

      // Audit trail
      await auditService.logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role || (req.user.roles && req.user.roles[0]) || 'PLATFORM_ADMIN',
        action: 'PAYOUT_PROCESSED',
        resourceType: 'PayoutRequest',
        resourceId: payout.id,
        changes: {
          status: 'COMPLETED',
          amountIqd: payout.amountIqd,
          settlementId: payout.settlementId,
          externalTransactionReference,
          journalEntryId: journalEntry.id,
        },
      });

      return res.json({ success: true, status: 'COMPLETED', journalEntryId: journalEntry.id });
    }

    if (status === 'FAILED') {
      await db.update(payoutRequests).set({
        status: 'FAILED',
        failureReason: failureReason || 'Transaction failed',
        approvedByUserId: req.user.id,
        updatedAt: new Date(),
      }).where(eq(payoutRequests.id, id));

      // Revert settlement to AVAILABLE so owner can re-request
      await db.update(ownerSettlements).set({ 
        status: 'AVAILABLE',
        updatedAt: new Date(),
      }).where(eq(ownerSettlements.id, payout.settlementId));

      await auditService.logAction({
        actorUserId: req.user.id,
        actorRole: req.user.role || (req.user.roles && req.user.roles[0]) || 'PLATFORM_ADMIN',
        action: 'PAYOUT_FAILED',
        resourceType: 'PayoutRequest',
        resourceId: payout.id,
        changes: {
          status: 'FAILED',
          failureReason,
        },
      });

      return res.json({ success: true, status: 'FAILED' });
    }

    // Intermediate states (e.g., PROCESSING, APPROVED)
    await db.update(payoutRequests).set({
      status,
      approvedByUserId: req.user.id,
      updatedAt: new Date(),
    }).where(eq(payoutRequests.id, id));

    await db.update(ownerSettlements).set({ 
      status,
      updatedAt: new Date(),
    }).where(eq(ownerSettlements.id, payout.settlementId));

    res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
