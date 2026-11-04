import { db } from '../../db/index.js';
import { leases, rentSchedules, securityDeposits } from '../../db/schema.js';
import { eq, and, lt } from 'drizzle-orm';
import { auditService } from './audit.js';
import { computeDepositReconciliationStatus } from '../repositories/leases.js';
import { promotionCampaignService } from './promotion-campaign.js';

/**
 * Background Cron Service for HomeHub
 * Handles time-based state transitions that must occur automatically
 * without user interaction.
 */
class CronService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Run every 12 hours in production, but let's make it configurable
  start(intervalMs: number = 1000 * 60 * 60 * 12) {
    if (this.timer) {
      clearInterval(this.timer);
    }
    
    console.log(`[CronService] Starting background jobs (interval: ${intervalMs}ms)`);
    
    // Run immediately once
    this.runJobs().catch(e => console.error('[CronService] Error in initial run:', e));
    
    // Then schedule
    this.timer = setInterval(() => {
      this.runJobs().catch(e => console.error('[CronService] Error in scheduled run:', e));
    }, intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[CronService] Stopped');
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  async runJobs(asOf: Date = new Date()) {
    if (this.isRunning) {
      console.log('[CronService] Job execution already in progress. Skipping overlapping run.');
      return { skipped: true, promotionResult: null };
    }
    this.isRunning = true;
    
    try {
      console.log('[CronService] Running background jobs...');
      const nowIso = asOf.toISOString();

      await this.processOverdueRents(nowIso);
      await this.processExpiredLeases(nowIso);
      const promotionResult = await this.processExpiredPromotionCampaigns(asOf);

      return {
        skipped: false,
        promotionResult,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Transition UPCOMING schedules to OVERDUE if the dueDate has passed.
   */
  private async processOverdueRents(nowIso: string) {
    try {
      const result = await db.update(rentSchedules)
        .set({ status: 'OVERDUE' })
        .where(
          and(
            eq(rentSchedules.status, 'UPCOMING'),
            lt(rentSchedules.dueDate, nowIso)
          )
        )
        .returning({ id: rentSchedules.id, leaseId: rentSchedules.leaseId });
        
      if (result.length > 0) {
        console.log(`[CronService] Marked ${result.length} rent schedules as OVERDUE.`);
        // Note: For a true prod system, we would also log individual audit events here.
      }
    } catch (e) {
      console.error('[CronService] Error processing overdue rents:', e);
    }
  }

  /**
   * Transition ACTIVE leases to EXPIRED if the endDate has passed.
   * Atomically evaluates and persists explicit deposit reconciliation status under P01.
   */
  public async processExpiredLeases(nowIso: string) {
    try {
      const expiredLeases = await db.select({
        id: leases.id,
        depositAmount: leases.depositAmount
      })
      .from(leases)
      .where(
        and(
          eq(leases.status, 'ACTIVE'),
          lt(leases.endDate, nowIso)
        )
      );

      if (expiredLeases.length === 0) return;

      console.log(`[CronService] Processing ${expiredLeases.length} expiring leases...`);

      for (const l of expiredLeases) {
        await db.transaction(async (tx) => {
          const leaseDeposits = await tx.select().from(securityDeposits).where(eq(securityDeposits.leaseId, l.id));
          const depositRequired = parseFloat(l.depositAmount || '0');
          const { reconciliationStatus, unresolvedReason } = computeDepositReconciliationStatus(depositRequired, leaseDeposits);

          await tx.update(leases)
            .set({
              status: 'EXPIRED',
              depositReconciliationStatus: reconciliationStatus
            })
            .where(eq(leases.id, l.id));

          await auditService.logAction({
            actorUserId: 'SYSTEM',
            actorRole: 'ADMIN',
            action: 'LEASE_EXPIRED',
            resourceType: 'Lease',
            resourceId: l.id,
            changes: {
              status: 'EXPIRED',
              depositReconciliationStatus: reconciliationStatus,
              ...(unresolvedReason ? { unresolvedReason } : {})
            },
            tx
          });
        });
      }

      console.log(`[CronService] Marked ${expiredLeases.length} leases as EXPIRED with explicit deposit reconciliation.`);
    } catch (e) {
      console.error('[CronService] Error processing expired leases:', e);
    }
  }

  /**
   * Transition ACTIVE promotion campaigns to EXPIRED if their approved duration (endTime) has passed.
   * Leverages promotionCampaignService.expireDueCampaigns() with per-campaign error isolation.
   */
  public async processExpiredPromotionCampaigns(asOf: Date = new Date()) {
    try {
      const result = await promotionCampaignService.expireDueCampaigns({
        asOf,
        actorUserId: 'SYSTEM',
        actorRoles: ['ADMIN'],
      });

      if (result.expiredCount > 0) {
        console.log(`[CronService] Expired ${result.expiredCount} promotion campaigns.`);
      }
      if (result.failedCount && result.failedCount > 0) {
        console.error(
          `[CronService] Failed to expire ${result.failedCount} promotion campaigns:`,
          result.failedCampaigns
        );
      }

      return result;
    } catch (e) {
      console.error('[CronService] Error processing expired promotion campaigns:', e);
      throw e;
    }
  }
}

export const cronService = new CronService();
