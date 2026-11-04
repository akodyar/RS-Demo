import { db } from '../../db/index.js';
import { journalEntries, ledgerLines, chartOfAccounts, financialPeriods } from '../../db/schema.js';
import { eq, inArray, and, sql } from 'drizzle-orm';

export class FinanceRepository {
  async postJournalEntry(
    propertyId: string, 
    description: string, 
    lines: { accountId: string, debit: number, credit: number, currency?: string }[],
    options?: { referenceType?: string; referenceId?: string; idempotencyKey?: string; currency?: string }
  ) {
    const entryCurrency = options?.currency || lines[0]?.currency || 'IQD';

    // Validate double entry
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) throw new Error("Negative amounts not allowed");
      if (line.debit > 0 && line.credit > 0) throw new Error("Line cannot have both debit and credit");
      totalDebit += line.debit;
      totalCredit += line.credit;
    }

    // Must balance
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Journal entry does not balance: Debits ${totalDebit} != Credits ${totalCredit}`);
    }

    try {
      // Use database transaction for atomicity
      return await db.transaction(async (tx) => {
        // Validate Financial Period
        const currentDate = new Date().toISOString().split('T')[0];
        const closedPeriods = await tx.select()
          .from(financialPeriods)
          .where(
            and(
              eq(financialPeriods.status, 'CLOSED'),
              sql`${financialPeriods.startDate} <= ${currentDate}`,
              sql`${financialPeriods.endDate} >= ${currentDate}`
            )
          );
        
        if (closedPeriods.length > 0) {
          throw new Error(`Cannot post into a closed financial period: ${closedPeriods[0].periodName}`);
        }

        // Validate Idempotency Key
        if (options?.idempotencyKey) {
          const existing = await tx.select().from(journalEntries).where(eq(journalEntries.idempotencyKey, options.idempotencyKey));
          if (existing.length > 0) {
            return existing[0]; // Return the existing entry if idempotency key matches
          }
        }

        // Validate Chart of Accounts
        const accountIds = lines.map(l => l.accountId);
        if (accountIds.length > 0) {
          const validAccounts = await tx.select({ code: chartOfAccounts.code }).from(chartOfAccounts).where(inArray(chartOfAccounts.code, accountIds));
          const validCodes = validAccounts.map(a => a.code);
          const invalidAccounts = accountIds.filter(id => !validCodes.includes(id));
          if (invalidAccounts.length > 0) {
            // For now, if the accounts are not found, we might want to let it pass if they are hardcoded fallback strings, 
            // but strict mode requires them to exist. We'll throw an error.
            throw new Error(`Invalid account codes provided: ${invalidAccounts.join(', ')}`);
          }
        }

        const [entry] = await tx.insert(journalEntries).values({
          propertyId,
          description,
          date: new Date().toISOString(),
          referenceType: options?.referenceType,
          referenceId: options?.referenceId,
          idempotencyKey: options?.idempotencyKey,
          status: 'POSTED'
        }).returning();

        const insertLines = lines.map(line => ({
          journalEntryId: entry.id,
          accountId: line.accountId,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
          currency: line.currency || entryCurrency,
        }));

        await tx.insert(ledgerLines).values(insertLines);

        return entry;
      });
    } catch (error: any) {
      const isConnRefused = 
        error.code === 'ECONNREFUSED' || 
        error.message?.includes('ECONNREFUSED') || 
        error.cause?.code === 'ECONNREFUSED' ||
        String(error.cause || '').includes('ECONNREFUSED') ||
        String(error || '').includes('ECONNREFUSED');

      if (isConnRefused) {
        const err: any = new Error('DATABASE_NOT_CONFIGURED');
        err.status = 503;
        err.code = 'DATABASE_NOT_CONFIGURED';
        throw err;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.error("Financial posting failed:", error);
      }
      throw error;
    }
  }

  async getJournalEntries(propertyId: string) {
    try {
      return await db.select().from(journalEntries).where(eq(journalEntries.propertyId, propertyId));
    } catch (error: any) {
      const isConnRefused = 
        error.code === 'ECONNREFUSED' || 
        error.message?.includes('ECONNREFUSED') || 
        error.cause?.code === 'ECONNREFUSED' ||
        String(error.cause || '').includes('ECONNREFUSED') ||
        String(error || '').includes('ECONNREFUSED');

      if (isConnRefused) {
        const err: any = new Error('DATABASE_NOT_CONFIGURED');
        err.status = 503;
        err.code = 'DATABASE_NOT_CONFIGURED';
        throw err;
      }
      throw error;
    }
  }
}

export const financeRepository = new FinanceRepository();
