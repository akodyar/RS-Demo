import { db } from '../../db/index.js';
import {
  pointsWallets,
  pointsTransactions,
  pointsRewardRules,
  pointsRewardGrants,
  pointsPurchasePackages,
  pointsPurchaseOrders,
  auditLogs,
  type PointsWallet,
  type PointsTransaction,
  type PointsRewardRule,
  type PointsPurchasePackage,
  type PointsPurchaseOrder,
} from '../../db/schema.js';
import { eq, and, sql, desc, inArray } from 'drizzle-orm';
import { auditService } from './audit.js';

export interface WalletSummary {
  id: string;
  userId: string;
  earnedBalance: number;
  purchasedBalance: number;
  reservedEarnedBalance: number;
  reservedPurchasedBalance: number;
  availableEarned: number;
  availablePurchased: number;
  availableTotal: number;
  reservedTotal: number;
  totalBalance: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface GrantRewardParams {
  userId: string;
  userRoles: string[];
  ruleKey: string;
  referenceEventId: string;
  idempotencyKey?: string;
  notes?: string;
}

export interface WalletAccessContext {
  actorUserId?: string;
  actorRoles?: string[];
}

export interface CreatePurchaseOrderParams {
  userId: string;
  userRoles: string[];
  packageId: string;
  paymentMethod?: string;
  paymentReference?: string;
  idempotencyKey?: string;
  actorUserId?: string;
}

export interface ConfirmPurchaseOrderParams {
  orderId: string;
  adminUserId: string;
  adminRoles: string[];
  idempotencyKey?: string;
}

export interface ReservePointsParams {
  userId: string;
  amount: number;
  referenceId: string;
  referenceType?: string;
  idempotencyKey?: string;
  notes?: string;
  tx?: any;
}

export interface ReleasePointsParams {
  userId: string;
  referenceId: string;
  referenceType?: string;
  idempotencyKey?: string;
  notes?: string;
  tx?: any;
}

export interface SpendPointsParams {
  userId: string;
  referenceId: string;
  referenceType?: string;
  idempotencyKey?: string;
  notes?: string;
  tx?: any;
}

export interface AdminAdjustPointsParams {
  targetUserId: string;
  adminUserId: string;
  adminRoles: string[];
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  source: 'EARNED' | 'PURCHASED';
  reason: string;
  idempotencyKey?: string;
  ipAddress?: string;
}

export class PointsEngineService {
  /**
   * Derives available, reserved, and total balances from wallet primitive columns.
   */
  public summarizeWallet(wallet: PointsWallet): WalletSummary {
    const earned = wallet.earnedBalance;
    const purchased = wallet.purchasedBalance;
    const reservedEarned = wallet.reservedEarnedBalance;
    const reservedPurchased = wallet.reservedPurchasedBalance;

    const availableEarned = earned - reservedEarned;
    const availablePurchased = purchased - reservedPurchased;
    const availableTotal = availableEarned + availablePurchased;
    const reservedTotal = reservedEarned + reservedPurchased;
    const totalBalance = earned + purchased;

    return {
      id: wallet.id,
      userId: wallet.userId,
      earnedBalance: earned,
      purchasedBalance: purchased,
      reservedEarnedBalance: reservedEarned,
      reservedPurchasedBalance: reservedPurchased,
      availableEarned,
      availablePurchased,
      availableTotal,
      reservedTotal,
      totalBalance,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }

  /**
   * Helper to namespace idempotency keys by operation type so that
   * operation steps on the same entity (e.g. reservation vs spend vs release)
   * do not falsely collide with each other, while retries of the same operation
   * are cleanly deduplicated.
   */
  public formatIdempotencyKey(operation: string, key?: string): string | undefined {
    if (!key) return undefined;
    const trimmed = key.trim();
    if (!trimmed) return undefined;
    const prefix = `${operation.toUpperCase()}:`;
    if (trimmed.startsWith(prefix)) return trimmed;
    return `${prefix}${trimmed}`;
  }

  /**
   * Ensures a wallet row exists for the user and acquires an exclusive row-level lock (FOR UPDATE)
   * within an active transaction.
   */
  public async getAndLockWallet(userId: string, tx: any): Promise<PointsWallet> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('INVALID_USER_ID: User ID must be a non-empty string.');
    }

    // Upsert wallet if not already present
    await tx
      .insert(pointsWallets)
      .values({
        userId,
        earnedBalance: 0,
        purchasedBalance: 0,
        reservedEarnedBalance: 0,
        reservedPurchasedBalance: 0,
      })
      .onConflictDoNothing({ target: pointsWallets.userId });

    // Acquire row-level lock FOR UPDATE
    const [lockedWallet] = await tx
      .select()
      .from(pointsWallets)
      .where(eq(pointsWallets.userId, userId))
      .for('update');

    if (!lockedWallet) {
      throw new Error(`WALLET_LOCK_FAILED: Could not find or lock wallet for user ${userId}`);
    }

    return lockedWallet;
  }

  /**
   * Read-only or creation lookup for a user's wallet.
   */
  public async getOrCreateWallet(userId: string, tx?: any): Promise<WalletSummary> {
    const executor = tx || db;
    if (!userId || typeof userId !== 'string') {
      throw new Error('INVALID_USER_ID: User ID must be a non-empty string.');
    }

    const [existing] = await executor
      .select()
      .from(pointsWallets)
      .where(eq(pointsWallets.userId, userId));

    if (existing) {
      return this.summarizeWallet(existing);
    }

    // Insert new wallet
    const [created] = await executor
      .insert(pointsWallets)
      .values({
        userId,
        earnedBalance: 0,
        purchasedBalance: 0,
        reservedEarnedBalance: 0,
        reservedPurchasedBalance: 0,
      })
      .onConflictDoUpdate({
        target: pointsWallets.userId,
        set: { updatedAt: new Date() },
      })
      .returning();

    return this.summarizeWallet(created);
  }

  /**
   * Returns a user's wallet summary alongside recent ledger transaction records.
   * If actorContext is provided, verifies that the actor is either the wallet owner or an administrator.
   */
  public async getWalletWithHistory(
    userId: string,
    limit = 50,
    actorContext?: WalletAccessContext
  ): Promise<{ wallet: WalletSummary; transactions: PointsTransaction[] }> {
    if (actorContext?.actorUserId) {
      const { actorUserId, actorRoles } = actorContext;
      const isAdmin = Array.isArray(actorRoles) && (actorRoles.includes('ADMIN') || actorRoles.includes('SUPER_ADMIN'));
      if (actorUserId !== userId && !isAdmin) {
        throw new Error(`UNAUTHORIZED_ACCESS: Caller '${actorUserId}' is not authorized to access wallet of user '${userId}'.`);
      }
    }

    const wallet = await this.getOrCreateWallet(userId);
    const transactions = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.userId, userId))
      .orderBy(desc(pointsTransactions.createdAt))
      .limit(limit);

    return { wallet, transactions };
  }

  /**
   * Grants earned reward points based strictly on server-authoritative rules.
   * Client-invented amounts or roles are never accepted.
   */
  public async grantRewardPoints(params: GrantRewardParams): Promise<{
    wallet: WalletSummary;
    transaction: PointsTransaction;
    grant: any;
    idempotentReplay: boolean;
  }> {
    const { userId, userRoles, ruleKey, referenceEventId, idempotencyKey, notes } = params;

    if (!userId) throw new Error('INVALID_USER_ID: User ID is required.');
    if (!ruleKey) throw new Error('INVALID_RULE_KEY: Reward rule key is required.');
    if (!referenceEventId) throw new Error('INVALID_REFERENCE_EVENT_ID: Reference event ID is required.');

    const scopedIdempotencyKey = this.formatIdempotencyKey('REWARD', idempotencyKey || `${userId}:${ruleKey}:${referenceEventId}`);

    return await db.transaction(async (tx) => {
      // 1. Check idempotency in points_reward_grants first
      const [existingGrant] = await tx
        .select()
        .from(pointsRewardGrants)
        .where(
          and(
            eq(pointsRewardGrants.ruleKey, ruleKey),
            eq(pointsRewardGrants.userId, userId),
            eq(pointsRewardGrants.referenceEventId, referenceEventId)
          )
        );

      if (existingGrant) {
        const [existingTx] = await tx
          .select()
          .from(pointsTransactions)
          .where(eq(pointsTransactions.id, existingGrant.transactionId));
        const wallet = await this.getOrCreateWallet(userId, tx);
        return {
          wallet,
          transaction: existingTx,
          grant: existingGrant,
          idempotentReplay: true,
        };
      }

      // 2. Fetch authoritative rule from database
      const [rule] = await tx
        .select()
        .from(pointsRewardRules)
        .where(eq(pointsRewardRules.ruleKey, ruleKey));

      if (!rule) {
        throw new Error(`REWARD_RULE_NOT_FOUND: Active reward rule '${ruleKey}' not found.`);
      }
      if (!rule.isActive) {
        throw new Error(`REWARD_RULE_INACTIVE: Reward rule '${ruleKey}' is currently disabled.`);
      }

      // 3. Verify role eligibility
      if (rule.role !== 'ALL') {
        const hasRole = Array.isArray(userRoles) && userRoles.includes(rule.role);
        if (!hasRole) {
          throw new Error(`ROLE_NOT_ELIGIBLE: User lacks required role '${rule.role}' for rule '${ruleKey}'.`);
        }
      }

      // 4. Verify max grants per user
      const existingGrants = await tx
        .select()
        .from(pointsRewardGrants)
        .where(and(eq(pointsRewardGrants.ruleKey, ruleKey), eq(pointsRewardGrants.userId, userId)));

      if (existingGrants.length >= rule.maxGrantsPerUser) {
        throw new Error(
          `MAX_GRANTS_EXCEEDED: User has already received the maximum allowed grants (${rule.maxGrantsPerUser}) for rule '${ruleKey}'.`
        );
      }

      // 5. Lock wallet row FOR UPDATE
      const walletRow = await this.getAndLockWallet(userId, tx);
      const pointsAmount = rule.pointsAmount;

      const newEarnedBalance = walletRow.earnedBalance + pointsAmount;
      const newAvailableAfter = (newEarnedBalance - walletRow.reservedEarnedBalance) + (walletRow.purchasedBalance - walletRow.reservedPurchasedBalance);
      const newTotalAfter = newEarnedBalance + walletRow.purchasedBalance;

      // 6. Update wallet balance
      const [updatedWallet] = await tx
        .update(pointsWallets)
        .set({
          earnedBalance: newEarnedBalance,
          updatedAt: new Date(),
        })
        .where(eq(pointsWallets.id, walletRow.id))
        .returning();

      // 7. Append immutable ledger transaction
      const [txRecord] = await tx
        .insert(pointsTransactions)
        .values({
          walletId: walletRow.id,
          userId,
          type: 'EARNED_REWARD',
          sourceType: 'EARNED',
          amount: pointsAmount,
          earnedDelta: pointsAmount,
          purchasedDelta: 0,
          reservedEarnedDelta: 0,
          reservedPurchasedDelta: 0,
          availableBalanceAfter: newAvailableAfter,
          totalBalanceAfter: newTotalAfter,
          referenceType: 'REWARD_EVENT',
          referenceId: referenceEventId,
          idempotencyKey: scopedIdempotencyKey,
          notes: notes || `Reward points granted for rule: ${ruleKey}`,
        })
        .returning();

      // 8. Record reward grant registry entry
      const grantIdempotency = idempotencyKey || `${ruleKey}:${userId}:${referenceEventId}`;
      const [grantRecord] = await tx
        .insert(pointsRewardGrants)
        .values({
          ruleId: rule.id,
          ruleKey: rule.ruleKey,
          userId,
          transactionId: txRecord.id,
          referenceEventId,
          idempotencyKey: grantIdempotency,
        })
        .returning();

      return {
        wallet: this.summarizeWallet(updatedWallet),
        transaction: txRecord,
        grant: grantRecord,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Initiates a points purchase order.
   * Restricted strictly to PROPERTY_OWNER and AGENT roles.
   * Does NOT credit points until confirmed by authorized admin.
   */
  public async createPurchaseOrder(params: CreatePurchaseOrderParams): Promise<{
    order: PointsPurchaseOrder;
    idempotentReplay: boolean;
  }> {
    const { userId, userRoles, packageId, paymentMethod, paymentReference, idempotencyKey, actorUserId } = params;

    if (!userId) throw new Error('INVALID_USER_ID: User ID is required.');
    if (!packageId) throw new Error('INVALID_PACKAGE_ID: Package ID is required.');

    if (actorUserId && actorUserId !== userId) {
      throw new Error(`UNAUTHORIZED_PURCHASER: Cannot create purchase order for another user '${userId}'.`);
    }

    // Authoritative role check: Only Owners and Agents may purchase points
    const allowedRoles = ['PROPERTY_OWNER', 'AGENT', 'AGENT_BROKER'];
    const isAuthorized = Array.isArray(userRoles) && userRoles.some((r) => allowedRoles.includes(r));
    if (!isAuthorized) {
      throw new Error('UNAUTHORIZED_ROLE: Only property owners and verified agents are authorized to purchase points.');
    }

    return await db.transaction(async (tx) => {
      // Idempotency check on order
      if (idempotencyKey) {
        const [existing] = await tx
          .select()
          .from(pointsPurchaseOrders)
          .where(eq(pointsPurchaseOrders.idempotencyKey, idempotencyKey));
        if (existing) {
          return { order: existing, idempotentReplay: true };
        }
      }

      // Fetch package terms authoritatively
      const [pkg] = await tx
        .select()
        .from(pointsPurchasePackages)
        .where(eq(pointsPurchasePackages.id, packageId));

      if (!pkg) {
        throw new Error(`PACKAGE_NOT_FOUND: Points package '${packageId}' does not exist.`);
      }
      if (!pkg.isActive) {
        throw new Error(`PACKAGE_INACTIVE: Points package '${packageId}' is inactive.`);
      }

      // Verify role eligibility against package configuration
      const packageRoles = pkg.allowedRoles || ['PROPERTY_OWNER', 'AGENT'];
      const matchesPackageRoles = userRoles.some((r) => packageRoles.includes(r));
      if (!matchesPackageRoles) {
        throw new Error(`PACKAGE_ROLE_DISALLOWED: User roles do not meet criteria for package '${packageId}'.`);
      }

      const [order] = await tx
        .insert(pointsPurchaseOrders)
        .values({
          userId,
          packageId: pkg.id,
          points: pkg.points,
          price: pkg.price,
          currency: pkg.currency,
          status: 'PENDING',
          paymentMethod: paymentMethod || 'CASH',
          paymentReference: paymentReference || null,
          idempotencyKey: idempotencyKey || null,
        })
        .returning();

      return { order, idempotentReplay: false };
    });
  }

  /**
   * Confirms a pending purchase order after verified payment receipt.
   * Atomically credits purchased points and writes the ledger record.
   * Restricted strictly to administrators (SUPER_ADMIN, FINANCE_ADMIN, ADMIN).
   */
  public async confirmPurchaseOrder(params: ConfirmPurchaseOrderParams): Promise<{
    order: PointsPurchaseOrder;
    wallet: WalletSummary;
    transaction: PointsTransaction;
    idempotentReplay: boolean;
  }> {
    const { orderId, adminUserId, adminRoles, idempotencyKey } = params;

    if (!orderId) throw new Error('INVALID_ORDER_ID: Order ID is required.');
    if (!adminUserId) throw new Error('INVALID_ADMIN_ID: Admin User ID is required.');

    // Role check: Only Admins can confirm purchases
    const adminRoleSet = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'ADMIN'];
    const isAuthorizedAdmin = Array.isArray(adminRoles) && adminRoles.some((r) => adminRoleSet.includes(r));
    if (!isAuthorizedAdmin) {
      throw new Error('UNAUTHORIZED_ROLE: Administrative authorization required to confirm points purchase.');
    }

    const scopedIdempotencyKey = this.formatIdempotencyKey('PURCHASE_CONFIRM', idempotencyKey || orderId);

    return await db.transaction(async (tx) => {
      // 1. Lock the order row FOR UPDATE
      const [order] = await tx
        .select()
        .from(pointsPurchaseOrders)
        .where(eq(pointsPurchaseOrders.id, orderId))
        .for('update');

      if (!order) {
        throw new Error(`PURCHASE_ORDER_NOT_FOUND: Order '${orderId}' does not exist.`);
      }

      // If already confirmed, return idempotently
      if (order.status === 'CONFIRMED') {
        const [existingTx] = await tx
          .select()
          .from(pointsTransactions)
          .where(eq(pointsTransactions.id, order.transactionId as string));
        const wallet = await this.getOrCreateWallet(order.userId, tx);
        return {
          order,
          wallet,
          transaction: existingTx,
          idempotentReplay: true,
        };
      }

      if (order.status !== 'PENDING') {
        throw new Error(`INVALID_ORDER_STATUS: Cannot confirm purchase order in status '${order.status}'.`);
      }

      // 2. Lock the target user's wallet FOR UPDATE
      const walletRow = await this.getAndLockWallet(order.userId, tx);

      const pointsToAdd = order.points;
      const newPurchasedBalance = walletRow.purchasedBalance + pointsToAdd;
      const newAvailableAfter = (walletRow.earnedBalance - walletRow.reservedEarnedBalance) + (newPurchasedBalance - walletRow.reservedPurchasedBalance);
      const newTotalAfter = walletRow.earnedBalance + newPurchasedBalance;

      // 3. Update wallet purchased balance
      const [updatedWallet] = await tx
        .update(pointsWallets)
        .set({
          purchasedBalance: newPurchasedBalance,
          updatedAt: new Date(),
        })
        .where(eq(pointsWallets.id, walletRow.id))
        .returning();

      // 4. Record ledger transaction
      const [txRecord] = await tx
        .insert(pointsTransactions)
        .values({
          walletId: walletRow.id,
          userId: order.userId,
          type: 'PURCHASED',
          sourceType: 'PURCHASED',
          amount: pointsToAdd,
          earnedDelta: 0,
          purchasedDelta: pointsToAdd,
          reservedEarnedDelta: 0,
          reservedPurchasedDelta: 0,
          availableBalanceAfter: newAvailableAfter,
          totalBalanceAfter: newTotalAfter,
          referenceType: 'POINTS_PURCHASE',
          referenceId: order.id,
          idempotencyKey: scopedIdempotencyKey,
          notes: `Purchased points confirmed by admin ${adminUserId} for package ${order.packageId}`,
        })
        .returning();

      // 5. Update purchase order status
      const [confirmedOrder] = await tx
        .update(pointsPurchaseOrders)
        .set({
          status: 'CONFIRMED',
          confirmedByAdminId: adminUserId,
          confirmedAt: new Date(),
          transactionId: txRecord.id,
          updatedAt: new Date(),
        })
        .where(eq(pointsPurchaseOrders.id, order.id))
        .returning();

      // 6. Authoritative Audit Log
      await auditService.logAction({
        actorUserId: adminUserId,
        actorRole: adminRoles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN',
        action: 'POINTS_PURCHASE_CONFIRMED',
        resourceType: 'PointsPurchaseOrder',
        resourceId: order.id,
        changes: {
          orderId: order.id,
          targetUserId: order.userId,
          packageId: order.packageId,
          pointsCredited: pointsToAdd,
          price: order.price,
          currency: order.currency,
          transactionId: txRecord.id,
        },
        tx,
      });

      return {
        order: confirmedOrder,
        wallet: this.summarizeWallet(updatedWallet),
        transaction: txRecord,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Reserves points for an upcoming promotion or campaign.
   * Row-locks the wallet, allocates across earned balance first then purchased balance,
   * increments reserved balance columns without altering total balance, and appends a RESERVED transaction.
   */
  public async reservePoints(params: ReservePointsParams): Promise<{
    wallet: WalletSummary;
    transaction: PointsTransaction;
    idempotentReplay: boolean;
  }> {
    const { userId, amount, referenceId, referenceType, idempotencyKey, notes } = params;

    if (!userId) throw new Error('INVALID_USER_ID: User ID is required.');
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('INVALID_AMOUNT: Reservation amount must be a positive integer.');
    }
    if (!referenceId) throw new Error('INVALID_REFERENCE_ID: Reference ID is required.');

    const scopedIdempotencyKey = this.formatIdempotencyKey('RESERVE', idempotencyKey || `${referenceId}:reserve`);

    const runInTx = async (tx: any) => {
      // Check idempotency replay
      if (scopedIdempotencyKey) {
        const [existingTx] = await tx
          .select()
          .from(pointsTransactions)
          .where(eq(pointsTransactions.idempotencyKey, scopedIdempotencyKey));
        if (existingTx) {
          const wallet = await this.getOrCreateWallet(userId, tx);
          return { wallet, transaction: existingTx, idempotentReplay: true };
        }
      }

      // Check if this referenceId is already active in a reservation
      const [existingActiveReservation] = await tx
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userId),
            eq(pointsTransactions.referenceId, referenceId),
            eq(pointsTransactions.type, 'RESERVED')
          )
        );

      if (existingActiveReservation) {
        // Check if settled
        const settlements = await tx
          .select()
          .from(pointsTransactions)
          .where(
            and(
              eq(pointsTransactions.userId, userId),
              eq(pointsTransactions.referenceId, referenceId),
              inArray(pointsTransactions.type, ['RELEASED', 'SPENT'])
            )
          );
        if (settlements.length === 0) {
          // It's still active, return it idempotently
          const wallet = await this.getOrCreateWallet(userId, tx);
          return { wallet, transaction: existingActiveReservation, idempotentReplay: true };
        }
      }

      // Lock wallet FOR UPDATE
      const walletRow = await this.getAndLockWallet(userId, tx);

      const availableEarned = walletRow.earnedBalance - walletRow.reservedEarnedBalance;
      const availablePurchased = walletRow.purchasedBalance - walletRow.reservedPurchasedBalance;
      const availableTotal = availableEarned + availablePurchased;

      if (availableTotal < amount) {
        throw new Error(
          `INSUFFICIENT_AVAILABLE_POINTS: Requested ${amount} points, but only ${availableTotal} available (${availableEarned} earned, ${availablePurchased} purchased).`
        );
      }

      // Allocate earned points first, then purchased points
      const reservedEarnedDelta = Math.min(availableEarned, amount);
      const reservedPurchasedDelta = amount - reservedEarnedDelta;

      let sourceType = 'MIXED';
      if (reservedEarnedDelta > 0 && reservedPurchasedDelta === 0) {
        sourceType = 'EARNED';
      } else if (reservedPurchasedDelta > 0 && reservedEarnedDelta === 0) {
        sourceType = 'PURCHASED';
      }

      const newReservedEarned = walletRow.reservedEarnedBalance + reservedEarnedDelta;
      const newReservedPurchased = walletRow.reservedPurchasedBalance + reservedPurchasedDelta;

      // Available total reduces by amount; total balance remains unchanged
      const newAvailableAfter = availableTotal - amount;
      const totalBalanceAfter = walletRow.earnedBalance + walletRow.purchasedBalance;

      // Update wallet reserved columns
      const [updatedWallet] = await tx
        .update(pointsWallets)
        .set({
          reservedEarnedBalance: newReservedEarned,
          reservedPurchasedBalance: newReservedPurchased,
          updatedAt: new Date(),
        })
        .where(eq(pointsWallets.id, walletRow.id))
        .returning();

      // Record RESERVED transaction
      const [txRecord] = await tx
        .insert(pointsTransactions)
        .values({
          walletId: walletRow.id,
          userId,
          type: 'RESERVED',
          sourceType,
          amount,
          earnedDelta: 0,
          purchasedDelta: 0,
          reservedEarnedDelta,
          reservedPurchasedDelta,
          availableBalanceAfter: newAvailableAfter,
          totalBalanceAfter,
          referenceType: referenceType || 'PROMOTION_CAMPAIGN',
          referenceId,
          idempotencyKey: scopedIdempotencyKey,
          notes: notes || `Reserved ${amount} points (${reservedEarnedDelta} earned, ${reservedPurchasedDelta} purchased) for ${referenceId}`,
        })
        .returning();

      return {
        wallet: this.summarizeWallet(updatedWallet),
        transaction: txRecord,
        idempotentReplay: false,
      };
    };

    if (params.tx) {
      return await runInTx(params.tx);
    }
    return await db.transaction(runInTx);
  }

  /**
   * Releases an active points reservation, restoring the exact earned and purchased split
   * that was originally reserved.
   */
  public async releasePoints(params: ReleasePointsParams): Promise<{
    wallet: WalletSummary;
    transaction: PointsTransaction;
    idempotentReplay: boolean;
  }> {
    const { userId, referenceId, referenceType, idempotencyKey, notes } = params;

    if (!userId) throw new Error('INVALID_USER_ID: User ID is required.');
    if (!referenceId) throw new Error('INVALID_REFERENCE_ID: Reference ID is required.');

    const scopedIdempotencyKey = this.formatIdempotencyKey('RELEASE', idempotencyKey || `${referenceId}:release`);

    const runInTx = async (tx: any) => {
      // Check idempotency replay
      if (scopedIdempotencyKey) {
        const [existingTx] = await tx
          .select()
          .from(pointsTransactions)
          .where(eq(pointsTransactions.idempotencyKey, scopedIdempotencyKey));
        if (existingTx) {
          const wallet = await this.getOrCreateWallet(userId, tx);
          return { wallet, transaction: existingTx, idempotentReplay: true };
        }
      }

      // Find original reservation
      const [reservationTx] = await tx
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userId),
            eq(pointsTransactions.referenceId, referenceId),
            eq(pointsTransactions.type, 'RESERVED')
          )
        );

      if (!reservationTx) {
        throw new Error(`RESERVATION_NOT_FOUND: No active reservation found for reference '${referenceId}'.`);
      }

      // Verify not already settled
      const [alreadySettled] = await tx
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userId),
            eq(pointsTransactions.referenceId, referenceId),
            inArray(pointsTransactions.type, ['RELEASED', 'SPENT'])
          )
        );

      if (alreadySettled) {
        if (alreadySettled.type === 'RELEASED') {
          const wallet = await this.getOrCreateWallet(userId, tx);
          return { wallet, transaction: alreadySettled, idempotentReplay: true };
        }
        throw new Error(
          `RESERVATION_ALREADY_SETTLED: Reservation for '${referenceId}' was already settled via ${alreadySettled.type}.`
        );
      }

      // Lock wallet FOR UPDATE
      const walletRow = await this.getAndLockWallet(userId, tx);

      const restoreEarned = reservationTx.reservedEarnedDelta;
      const restorePurchased = reservationTx.reservedPurchasedDelta;

      if (walletRow.reservedEarnedBalance < restoreEarned || walletRow.reservedPurchasedBalance < restorePurchased) {
        throw new Error(
          `CORRUPTED_RESERVATION_STATE: Wallet reserved balances (${walletRow.reservedEarnedBalance} earned, ${walletRow.reservedPurchasedBalance} purchased) cannot cover restoration (${restoreEarned} earned, ${restorePurchased} purchased).`
        );
      }

      const newReservedEarned = walletRow.reservedEarnedBalance - restoreEarned;
      const newReservedPurchased = walletRow.reservedPurchasedBalance - restorePurchased;

      const newAvailableEarned = walletRow.earnedBalance - newReservedEarned;
      const newAvailablePurchased = walletRow.purchasedBalance - newReservedPurchased;
      const newAvailableAfter = newAvailableEarned + newAvailablePurchased;
      const totalBalanceAfter = walletRow.earnedBalance + walletRow.purchasedBalance;

      // Update wallet
      const [updatedWallet] = await tx
        .update(pointsWallets)
        .set({
          reservedEarnedBalance: newReservedEarned,
          reservedPurchasedBalance: newReservedPurchased,
          updatedAt: new Date(),
        })
        .where(eq(pointsWallets.id, walletRow.id))
        .returning();

      // Record RELEASED transaction
      const [txRecord] = await tx
        .insert(pointsTransactions)
        .values({
          walletId: walletRow.id,
          userId,
          type: 'RELEASED',
          sourceType: reservationTx.sourceType,
          amount: reservationTx.amount,
          earnedDelta: 0,
          purchasedDelta: 0,
          reservedEarnedDelta: -restoreEarned,
          reservedPurchasedDelta: -restorePurchased,
          availableBalanceAfter: newAvailableAfter,
          totalBalanceAfter,
          referenceType: referenceType || reservationTx.referenceType,
          referenceId,
          idempotencyKey: scopedIdempotencyKey,
          notes: notes || `Released reservation for ${referenceId} (${restoreEarned} earned, ${restorePurchased} purchased)`,
        })
        .returning();

      return {
        wallet: this.summarizeWallet(updatedWallet),
        transaction: txRecord,
        idempotentReplay: false,
      };
    };

    if (params.tx) {
      return await runInTx(params.tx);
    }
    return await db.transaction(runInTx);
  }

  /**
   * Spends an active reservation, atomically decrementing both the reserved balance
   * and the corresponding primary balance columns.
   */
  public async spendReservedPoints(params: SpendPointsParams): Promise<{
    wallet: WalletSummary;
    transaction: PointsTransaction;
    idempotentReplay: boolean;
  }> {
    const { userId, referenceId, referenceType, idempotencyKey, notes } = params;

    if (!userId) throw new Error('INVALID_USER_ID: User ID is required.');
    if (!referenceId) throw new Error('INVALID_REFERENCE_ID: Reference ID is required.');

    const scopedIdempotencyKey = this.formatIdempotencyKey('SPEND', idempotencyKey || `${referenceId}:spend`);

    const runInTx = async (tx: any) => {
      // Check idempotency replay
      if (scopedIdempotencyKey) {
        const [existingTx] = await tx
          .select()
          .from(pointsTransactions)
          .where(eq(pointsTransactions.idempotencyKey, scopedIdempotencyKey));
        if (existingTx) {
          const wallet = await this.getOrCreateWallet(userId, tx);
          return { wallet, transaction: existingTx, idempotentReplay: true };
        }
      }

      // Find original reservation
      const [reservationTx] = await tx
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userId),
            eq(pointsTransactions.referenceId, referenceId),
            eq(pointsTransactions.type, 'RESERVED')
          )
        );

      if (!reservationTx) {
        throw new Error(`RESERVATION_NOT_FOUND: No active reservation found for reference '${referenceId}'.`);
      }

      // Verify not already settled
      const [alreadySettled] = await tx
        .select()
        .from(pointsTransactions)
        .where(
          and(
            eq(pointsTransactions.userId, userId),
            eq(pointsTransactions.referenceId, referenceId),
            inArray(pointsTransactions.type, ['RELEASED', 'SPENT'])
          )
        );

      if (alreadySettled) {
        if (alreadySettled.type === 'SPENT') {
          const wallet = await this.getOrCreateWallet(userId, tx);
          return { wallet, transaction: alreadySettled, idempotentReplay: true };
        }
        throw new Error(
          `RESERVATION_ALREADY_SETTLED: Reservation for '${referenceId}' was already settled via ${alreadySettled.type}.`
        );
      }

      // Lock wallet FOR UPDATE
      const walletRow = await this.getAndLockWallet(userId, tx);

      const spendEarned = reservationTx.reservedEarnedDelta;
      const spendPurchased = reservationTx.reservedPurchasedDelta;

      if (
        walletRow.earnedBalance < spendEarned ||
        walletRow.reservedEarnedBalance < spendEarned ||
        walletRow.purchasedBalance < spendPurchased ||
        walletRow.reservedPurchasedBalance < spendPurchased
      ) {
        throw new Error('CORRUPTED_WALLET_STATE: Wallet balances insufficient to spend reservation.');
      }

      const newEarnedBalance = walletRow.earnedBalance - spendEarned;
      const newReservedEarned = walletRow.reservedEarnedBalance - spendEarned;
      const newPurchasedBalance = walletRow.purchasedBalance - spendPurchased;
      const newReservedPurchased = walletRow.reservedPurchasedBalance - spendPurchased;

      const newAvailableEarned = newEarnedBalance - newReservedEarned;
      const newAvailablePurchased = newPurchasedBalance - newReservedPurchased;
      const newAvailableAfter = newAvailableEarned + newAvailablePurchased;
      const totalBalanceAfter = newEarnedBalance + newPurchasedBalance;

      // Update wallet: atomically decrement both reserved and primary balances
      const [updatedWallet] = await tx
        .update(pointsWallets)
        .set({
          earnedBalance: newEarnedBalance,
          reservedEarnedBalance: newReservedEarned,
          purchasedBalance: newPurchasedBalance,
          reservedPurchasedBalance: newReservedPurchased,
          updatedAt: new Date(),
        })
        .where(eq(pointsWallets.id, walletRow.id))
        .returning();

      // Record SPENT transaction
      const [txRecord] = await tx
        .insert(pointsTransactions)
        .values({
          walletId: walletRow.id,
          userId,
          type: 'SPENT',
          sourceType: reservationTx.sourceType,
          amount: reservationTx.amount,
          earnedDelta: -spendEarned,
          purchasedDelta: -spendPurchased,
          reservedEarnedDelta: -spendEarned,
          reservedPurchasedDelta: -spendPurchased,
          availableBalanceAfter: newAvailableAfter,
          totalBalanceAfter,
          referenceType: referenceType || reservationTx.referenceType,
          referenceId,
          idempotencyKey: scopedIdempotencyKey,
          notes: notes || `Spent reserved points for ${referenceId} (${spendEarned} earned, ${spendPurchased} purchased)`,
        })
        .returning();

      return {
        wallet: this.summarizeWallet(updatedWallet),
        transaction: txRecord,
        idempotentReplay: false,
      };
    };

    if (params.tx) {
      return await runInTx(params.tx);
    }
    return await db.transaction(runInTx);
  }

  /**
   * Administrative point balance adjustment.
   * Mandates authorized administrative role, non-empty explicit reason,
   * atomic balance and ledger mutation, and fail-closed audit log persistence.
   */
  public async adminAdjustPoints(params: AdminAdjustPointsParams): Promise<{
    wallet: WalletSummary;
    transaction: PointsTransaction;
    idempotentReplay: boolean;
  }> {
    const { targetUserId, adminUserId, adminRoles, amount, direction, source, reason, idempotencyKey, ipAddress } = params;

    if (!targetUserId) throw new Error('INVALID_TARGET_USER_ID: Target User ID is required.');
    if (!adminUserId) throw new Error('INVALID_ADMIN_ID: Admin User ID is required.');

    // 1. Mandatory role authorization check
    const adminRoleSet = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'ADMIN'];
    const isAuthorizedAdmin = Array.isArray(adminRoles) && adminRoles.some((r) => adminRoleSet.includes(r));
    if (!isAuthorizedAdmin) {
      throw new Error('UNAUTHORIZED_ROLE: Administrative points adjustment requires an administrator role.');
    }

    // 2. Mandatory reason check
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      throw new Error('MANDATORY_REASON_REQUIRED: A detailed reason of at least 5 characters is required for administrative adjustments.');
    }

    // 3. Amount & direction validation
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('INVALID_AMOUNT: Adjustment amount must be a positive integer.');
    }
    if (!['CREDIT', 'DEBIT'].includes(direction)) {
      throw new Error(`INVALID_DIRECTION: Adjustment direction must be 'CREDIT' or 'DEBIT'.`);
    }
    if (!['EARNED', 'PURCHASED'].includes(source)) {
      throw new Error(`INVALID_SOURCE: Adjustment source must be 'EARNED' or 'PURCHASED'.`);
    }

    const scopedIdempotencyKey = this.formatIdempotencyKey('ADMIN_ADJUST', idempotencyKey);

    return await db.transaction(async (tx) => {
      // Idempotency check
      if (scopedIdempotencyKey) {
        const [existingTx] = await tx
          .select()
          .from(pointsTransactions)
          .where(eq(pointsTransactions.idempotencyKey, scopedIdempotencyKey));
        if (existingTx) {
          const wallet = await this.getOrCreateWallet(targetUserId, tx);
          return { wallet, transaction: existingTx, idempotentReplay: true };
        }
      }

      // Lock target wallet FOR UPDATE
      const walletRow = await this.getAndLockWallet(targetUserId, tx);

      let earnedDelta = 0;
      let purchasedDelta = 0;
      let newEarned = walletRow.earnedBalance;
      let newPurchased = walletRow.purchasedBalance;

      if (direction === 'CREDIT') {
        if (source === 'EARNED') {
          earnedDelta = amount;
          newEarned += amount;
        } else {
          purchasedDelta = amount;
          newPurchased += amount;
        }
      } else {
        // DEBIT
        if (source === 'EARNED') {
          const availEarned = walletRow.earnedBalance - walletRow.reservedEarnedBalance;
          if (availEarned < amount) {
            throw new Error(
              `INSUFFICIENT_AVAILABLE_EARNED_BALANCE: Cannot debit ${amount} earned points; user only has ${availEarned} available earned.`
            );
          }
          earnedDelta = -amount;
          newEarned -= amount;
        } else {
          const availPurchased = walletRow.purchasedBalance - walletRow.reservedPurchasedBalance;
          if (availPurchased < amount) {
            throw new Error(
              `INSUFFICIENT_AVAILABLE_PURCHASED_BALANCE: Cannot debit ${amount} purchased points; user only has ${availPurchased} available purchased.`
            );
          }
          purchasedDelta = -amount;
          newPurchased -= amount;
        }
      }

      const availableAfter = (newEarned - walletRow.reservedEarnedBalance) + (newPurchased - walletRow.reservedPurchasedBalance);
      const totalAfter = newEarned + newPurchased;

      // Update wallet
      const [updatedWallet] = await tx
        .update(pointsWallets)
        .set({
          earnedBalance: newEarned,
          purchasedBalance: newPurchased,
          updatedAt: new Date(),
        })
        .where(eq(pointsWallets.id, walletRow.id))
        .returning();

      // Append transaction
      const [txRecord] = await tx
        .insert(pointsTransactions)
        .values({
          walletId: walletRow.id,
          userId: targetUserId,
          type: 'ADMIN_ADJUSTMENT',
          sourceType: source,
          amount,
          earnedDelta,
          purchasedDelta,
          reservedEarnedDelta: 0,
          reservedPurchasedDelta: 0,
          availableBalanceAfter: availableAfter,
          totalBalanceAfter: totalAfter,
          referenceType: 'ADMIN_ADJUSTMENT',
          referenceId: adminUserId,
          idempotencyKey: scopedIdempotencyKey,
          notes: `[ADMIN ${direction} ${source}] ${reason.trim()}`,
        })
        .returning();

      // Record authoritative audit entry in the same transaction
      await auditService.logAction({
        actorUserId: adminUserId,
        actorRole: adminRoles.includes('SUPER_ADMIN') ? 'SUPER_ADMIN' : 'ADMIN',
        action: 'POINTS_ADMIN_ADJUSTMENT',
        resourceType: 'PointsWallet',
        resourceId: walletRow.id,
        changes: {
          targetUserId,
          direction,
          source,
          amount,
          reason: reason.trim(),
          earnedDelta,
          purchasedDelta,
          transactionId: txRecord.id,
        },
        ipAddress,
        tx,
      });

      return {
        wallet: this.summarizeWallet(updatedWallet),
        transaction: txRecord,
        idempotentReplay: false,
      };
    });
  }
}

export const pointsEngine = new PointsEngineService();
