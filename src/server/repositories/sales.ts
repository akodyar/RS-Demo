import { db } from '../../db/index.js';
import { 
  propertyOffers, 
  offerCounterHistory, 
  salesContracts, 
  salesTransactions,
  ownershipRecords,
  listings,
  properties
} from '../../db/schema.js';
import { eq, and, desc, or } from 'drizzle-orm';
import { auditService } from '../services/audit.js';

export const salesRepository = {
  /**
   * Submit an offer for a property
   */
  async submitOffer(buyerId: string, listingId: string, amount: number, conditions: string[] = []) {
    if (amount <= 0) throw new Error("Offer amount must be positive.");

    const listing = await db.query.listings.findFirst({
      where: eq(listings.id, listingId)
    });

    if (!listing || listing.status !== 'PUBLISHED' || listing.type !== 'FOR_SALE') {
      throw new Error("Listing is not available for sale.");
    }

    if (listing.publisherUserId === buyerId) {
      throw new Error("Cannot make an offer on your own listing.");
    }

    // Check idempotency/duplicate
    const existingActiveOffer = await db.query.propertyOffers.findFirst({
      where: and(
        eq(propertyOffers.buyerId, buyerId),
        eq(propertyOffers.listingId, listingId),
        eq(propertyOffers.status, 'OFFER_SUBMITTED')
      )
    });

    if (existingActiveOffer) {
      throw new Error("You already have an active offer for this listing.");
    }

    const newOffer = await db.transaction(async (tx) => {
      const [offer] = await tx.insert(propertyOffers).values({
        buyerId,
        propertyId: listing.propertyId,
        listingId,
        offerAmount: amount.toString(),
        conditions,
        status: 'OFFER_SUBMITTED',
        sellerUserId: listing.publisherUserId,
        sellerCompanyId: listing.publisherCompanyId
      }).returning();

      await auditService.logAction({
        actorUserId: buyerId,
        actorRole: 'BUYER',
        action: 'OFFER_SUBMITTED',
        resourceType: 'PropertyOffer',
        resourceId: offer.id,
        changes: { amount, listingId }
      });

      return offer;
    });

    return newOffer;
  },

  /**
   * Counter an offer
   */
  async counterOffer(userId: string, role: 'SELLER_OWNER' | 'SELLER_COMPANY' | 'BUYER', offerId: string, counterAmount: number) {
    if (counterAmount <= 0) throw new Error("Counter amount must be positive.");

    const offer = await db.query.propertyOffers.findFirst({
      where: eq(propertyOffers.id, offerId)
    });

    if (!offer) throw new Error("Offer not found.");

    // Validate authority (simplified)
    if (role === 'BUYER' && offer.buyerId !== userId) {
      throw new Error("Unauthorized: Only the buyer can counter as BUYER.");
    }
    if (role !== 'BUYER' && offer.sellerUserId !== userId) {
      throw new Error("Unauthorized: Only the seller can counter as SELLER.");
    }

    // State machine
    if (offer.status !== 'OFFER_SUBMITTED' && offer.status !== 'COUNTERED') {
      throw new Error(`Cannot counter an offer in status: ${offer.status}`);
    }

    const result = await db.transaction(async (tx) => {
      const [counter] = await tx.insert(offerCounterHistory).values({
        offerId,
        actorId: userId,
        actorRole: role,
        counterAmount: counterAmount.toString(),
        status: 'COUNTERED'
      }).returning();

      await tx.update(propertyOffers)
        .set({ status: 'COUNTERED', updatedAt: new Date() })
        .where(eq(propertyOffers.id, offerId));

      await auditService.logAction({
        actorUserId: userId,
        actorRole: role,
        action: 'OFFER_COUNTERED',
        resourceType: 'OfferCounterHistory',
        resourceId: counter.id,
        changes: { offerId, amount: counterAmount }
      });

      return counter;
    });

    return result;
  },

  /**
   * Accept an offer
   */
  async acceptOffer(sellerId: string, offerId: string) {
    const offer = await db.query.propertyOffers.findFirst({
      where: eq(propertyOffers.id, offerId)
    });

    if (!offer) throw new Error("Offer not found.");

    // Only seller or authorized company can accept. Buyer cannot force acceptance.
    const isOwner = await db.query.ownershipRecords.findFirst({
      where: and(
        eq(ownershipRecords.propertyId, offer.propertyId),
        eq(ownershipRecords.ownerId, sellerId),
        eq(ownershipRecords.status, 'VERIFIED')
      )
    });

    if (!isOwner) {
      throw new Error("Unauthorized: Only the verified owner can accept an offer.");
    }

    // State machine
    if (offer.status !== 'OFFER_SUBMITTED' && offer.status !== 'COUNTERED') {
      throw new Error(`Cannot accept an offer in status: ${offer.status}`);
    }

    const updatedOffer = await db.transaction(async (tx) => {
      // Concurrency lock: transition listing status to prevent parallel acceptances
      const [lockedListing] = await tx.update(listings)
        .set({ status: 'PENDING_SALE', updatedAt: new Date() })
        .where(and(
           eq(listings.id, offer.listingId!),
           eq(listings.status, 'PUBLISHED')
        ))
        .returning();

      if (!lockedListing) {
        throw new Error("Listing is no longer published, another offer may have already been accepted.");
      }

      const [accepted] = await tx.update(propertyOffers)
        .set({ status: 'ACCEPTED', updatedAt: new Date() })
        .where(and(
           eq(propertyOffers.id, offerId),
           or(eq(propertyOffers.status, 'OFFER_SUBMITTED'), eq(propertyOffers.status, 'COUNTERED'))
        ))
        .returning();
        
      if (!accepted) {
        throw new Error("Offer could not be accepted. State may have changed.");
      }

      // Automatically reject other pending offers for this listing
      await tx.update(propertyOffers)
        .set({ status: 'REJECTED', updatedAt: new Date(), rejectionReason: 'Another offer was accepted' })
        .where(and(
          eq(propertyOffers.listingId, offer.listingId!),
          eq(propertyOffers.status, 'OFFER_SUBMITTED')
        ));

      await auditService.logAction({
        actorUserId: sellerId,
        actorRole: 'OWNER',
        action: 'OFFER_ACCEPTED',
        resourceType: 'PropertyOffer',
        resourceId: offerId,
        changes: {}
      });

      return accepted;
    });

    return updatedOffer;
  },

  /**
   * Generate Sales Contract
   */
  async generateContract(userId: string, offerId: string) {
    const offer = await db.query.propertyOffers.findFirst({
      where: eq(propertyOffers.id, offerId)
    });

    if (!offer || offer.status !== 'ACCEPTED') {
      throw new Error("Only an ACCEPTED offer can generate a contract.");
    }

    // Authorization: User must be seller, buyer, or verified owner of property
    const isOwner = await db.query.ownershipRecords.findFirst({
      where: and(
        eq(ownershipRecords.propertyId, offer.propertyId),
        eq(ownershipRecords.ownerId, userId),
        eq(ownershipRecords.status, 'VERIFIED')
      )
    });

    if (!isOwner && offer.sellerUserId !== userId && offer.buyerId !== userId) {
      throw new Error("Unauthorized: Only seller, buyer, or verified owner can generate the contract.");
    }

    const contractRef = `CONTRACT_${Date.now()}_${offer.id.substring(0,6)}`;

    const newContract = await db.transaction(async (tx) => {
      const [contract] = await tx.insert(salesContracts).values({
        offerId,
        propertyId: offer.propertyId,
        listingId: offer.listingId,
        buyerId: offer.buyerId,
        sellerId: offer.sellerUserId!,
        contractNumber: contractRef,
        agreedPrice: offer.offerAmount,
        currency: offer.currency,
        status: 'DRAFTED'
      }).returning();

      await auditService.logAction({
        actorUserId: userId,
        actorRole: 'SYSTEM',
        action: 'CONTRACT_GENERATED',
        resourceType: 'SalesContract',
        resourceId: contract.id,
        changes: { offerId }
      });

      return contract;
    });

    return newContract;
  },

  /**
   * Initiate Transaction
   */
  async initiateTransaction(userId: string, contractId: string) {
    const contract = await db.query.salesContracts.findFirst({
      where: eq(salesContracts.id, contractId)
    });

    if (!contract || (contract.status !== 'DRAFTED' && contract.status !== 'EXECUTED')) {
      throw new Error("Contract is not in a valid state to initiate a transaction.");
    }

    if (contract.buyerId !== userId && contract.sellerId !== userId) {
      throw new Error("Unauthorized: Only buyer or seller can initiate transaction.");
    }

    const txRef = `TX_SALE_${Date.now()}`;

    const newTx = await db.transaction(async (tx) => {
      const [transaction] = await tx.insert(salesTransactions).values({
        contractId,
        propertyId: contract.propertyId,
        buyerId: contract.buyerId,
        sellerId: contract.sellerId,
        transactionNumber: txRef,
        amount: contract.agreedPrice,
        currency: contract.currency,
        status: 'TRANSACTION_OPENED'
      }).returning();

      await tx.update(salesContracts)
        .set({ status: 'EXECUTED', updatedAt: new Date() })
        .where(eq(salesContracts.id, contractId));

      await auditService.logAction({
        actorUserId: userId,
        actorRole: 'SYSTEM',
        action: 'TRANSACTION_CREATED',
        resourceType: 'SalesTransaction',
        resourceId: transaction.id,
        changes: { contractId }
      });

      return transaction;
    });

    return newTx;
  },

  /**
   * Process Settlement
   */
  async processSettlement(userId: string, transactionId: string) {
    const transaction = await db.query.salesTransactions.findFirst({
      where: eq(salesTransactions.id, transactionId)
    });

    if (!transaction || transaction.status !== 'TRANSACTION_OPENED') {
      throw new Error("Invalid transaction state for settlement.");
    }

    if (transaction.buyerId !== userId && transaction.sellerId !== userId) {
      throw new Error("Unauthorized: Only transaction parties can process settlement.");
    }

    // In reality this would interact with FinanceService
    const updatedTx = await db.transaction(async (tx) => {
      const [settled] = await tx.update(salesTransactions)
        .set({ status: 'SETTLEMENT_PENDING', updatedAt: new Date() })
        .where(eq(salesTransactions.id, transactionId))
        .returning();

      await auditService.logAction({
        actorUserId: userId,
        actorRole: 'SYSTEM',
        action: 'TRANSACTION_SETTLED',
        resourceType: 'SalesTransaction',
        resourceId: transactionId,
        changes: {}
      });

      return settled;
    });

    return updatedTx;
  },

  /**
   * Complete Closing & Ownership Transfer
   */
  async completeClosing(userId: string, transactionId: string) {
    const transaction = await db.query.salesTransactions.findFirst({
      where: eq(salesTransactions.id, transactionId)
    });

    if (!transaction || transaction.status !== 'SETTLEMENT_PENDING') {
      throw new Error("Transaction must be SETTLEMENT_PENDING to close.");
    }

    // Only verified seller owner can close transaction and transfer ownership
    const isOwner = await db.query.ownershipRecords.findFirst({
      where: and(
        eq(ownershipRecords.propertyId, transaction.propertyId),
        eq(ownershipRecords.ownerId, userId),
        eq(ownershipRecords.status, 'VERIFIED')
      )
    });

    if (!isOwner && transaction.sellerId !== userId) {
      throw new Error("Unauthorized: Only verified seller owner can complete closing.");
    }

    // Transfer ownership
    const updatedTx = await db.transaction(async (tx) => {
      // 1. Mark transaction closed with atomic check
      const [closedTx] = await tx.update(salesTransactions)
        .set({ status: 'CLOSED', closedAt: new Date(), updatedAt: new Date() })
        .where(and(
           eq(salesTransactions.id, transactionId),
           eq(salesTransactions.status, 'SETTLEMENT_PENDING')
        ))
        .returning();
        
      if (!closedTx) {
         throw new Error("Transaction is already closed or not pending settlement.");
      }

      // 2. Invalidate previous ownership
      await tx.update(ownershipRecords)
        .set({ status: 'TRANSFERRED' })
        .where(and(
          eq(ownershipRecords.propertyId, transaction.propertyId),
          eq(ownershipRecords.ownerId, transaction.sellerId),
          eq(ownershipRecords.status, 'VERIFIED')
        ));

      // 3. Insert new ownership
      await tx.insert(ownershipRecords).values({
        propertyId: transaction.propertyId,
        ownerId: transaction.buyerId,
        ownershipPercentage: '100',
        acquiredDate: new Date().toISOString(),
        status: 'VERIFIED'
      });

      await auditService.logAction({
        actorUserId: userId,
        actorRole: 'SYSTEM',
        action: 'OWNERSHIP_TRANSFERRED',
        resourceType: 'Property',
        resourceId: transaction.propertyId,
        changes: { from: transaction.sellerId, to: transaction.buyerId }
      });

      return closedTx;
    });

    return updatedTx;
  }
};
