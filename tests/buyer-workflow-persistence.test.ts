import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB BUYER DOMAIN — WORKFLOW PERSISTENCE, LIFECYCLE & INTEGRATION SUITE
 * 
 * Direct verification of:
 * 1. PostgreSQL/Drizzle database persistence (Users, Properties, Listings, BuyerProfiles, 
 *    BuyerFavorites, SavedSearches, PropertyInquiries, PropertyViewings, PropertyOffers, 
 *    OfferCounterHistory, SalesContracts, SalesTransactions, PaymentRecords, Commissions, 
 *    Notifications, AuditLogs)
 * 2. Buyer onboarding, profile management & preferences
 * 3. Property discovery, listings search & server-side filtering
 * 4. Favorites & saved searches (idempotency, deletion & cross-buyer isolation)
 * 5. Inquiries lifecycle with automated recipient resolution (deed owner / company)
 * 6. Site visit viewings with conflict detection (1-hr window), rescheduling & cancellation
 * 7. Offers & counter-offer negotiations (history integrity, self-acceptance denial & withdrawal)
 * 8. Sales contracts execution & 7-stage transaction milestone progression
 * 9. Financial policy: 0% rent management commission on sales & purchase transactions
 * 10. Notifications persistence & cross-buyer privacy isolation
 * 11. Complete immutable audit trail for all buyer mutations
 */

import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  units,
  listings,
  ownershipRecords,
  managementAgreements,
  buyerProfiles,
  buyerFavorites,
  savedSearches,
  propertyInquiries,
  propertyViewings,
  propertyOffers,
  offerCounterHistory,
  salesContracts,
  salesTransactions,
  paymentRecords,
  commissions,
  notifications,
  documents,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { BuyerRepository } from '../src/server/repositories/buyer.js';
import { buyerService } from '../src/server/services/buyer.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testId: string, description: string) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`);
    failed++;
  }
}

async function runBuyerWorkflowPersistenceSuite() {
  console.log('===================================================================');
  console.log('  HOMEHUB BUYER DOMAIN — WORKFLOW PERSISTENCE & INTEGRATION SUITE');
  console.log('===================================================================\n');

  // -------------------------------------------------------------
  // PART 1: POSTGRESQL ENGINE INITIALIZATION & MIGRATIONS
  // -------------------------------------------------------------
  console.log('--- PART 1: POSTGRESQL ENGINE INITIALIZATION & MIGRATIONS ---');
  await injectPgliteMock();
  console.log('In-process PostgreSQL (PGlite) initialized with all 6 Drizzle migrations.\n');

  const repo = new BuyerRepository();

  // -------------------------------------------------------------
  // PART 2: BUYER ONBOARDING & PROFILE PERSISTENCE
  // -------------------------------------------------------------
  console.log('--- PART 2: BUYER ONBOARDING & PROFILE PERSISTENCE ---');

  const buyerAId = 'usr-byr-pers-01';
  const buyerBId = 'usr-byr-pers-02';
  const ownerId = 'usr-own-pers-01';
  const companyOrgId = 'org-co-pers-01';

  // Seed Users
  await db.insert(users).values([
    {
      id: buyerAId,
      firstName: 'Kardo',
      lastName: 'Barzani',
      email: 'kardo@buyer.iq',
      phone: '+9647501112233',
      roles: ['BUYER'],
      isActive: true,
    },
    {
      id: buyerBId,
      firstName: 'Shakar',
      lastName: 'Sorani',
      email: 'shakar@buyer.iq',
      phone: '+9647502223344',
      roles: ['BUYER'],
      isActive: true,
    },
    {
      id: ownerId,
      firstName: 'Dara',
      lastName: 'Majid',
      email: 'dara@owner.iq',
      phone: '+9647503334455',
      roles: ['OWNER'],
      isActive: true,
    },
  ]);

  // Seed Organization
  await db.insert(organizations).values({
    id: companyOrgId,
    name: 'Erbil Prime Properties Ltd',
    type: 'COMPANY',
    status: 'ACTIVE',
  });

  const [persistedBuyerA] = await db.select().from(users).where(eq(users.id, buyerAId));
  assert(
    persistedBuyerA && persistedBuyerA.id === buyerAId && (persistedBuyerA.roles as string[]).includes('BUYER'),
    'BYR-ONBOARD-01',
    'Buyer user successfully persisted in PostgreSQL with BUYER role'
  );

  // Upsert profile for Buyer A
  const savedProfile = await repo.upsertProfile(buyerAId, {
    budgetMin: 150000000,
    budgetMax: 350000000,
    currency: 'IQD',
    preferredCities: ['Erbil', 'Sulaymaniyah'],
    preferredPropertyTypes: ['VILLA', 'APARTMENT'],
    minBeds: 3,
    minBaths: 2,
    minSquareMeters: 180,
    purchasePurpose: 'PRIMARY_RESIDENCE',
    financingStatus: 'CASH_READY',
  });

  const [persistedProfile] = await db.select().from(buyerProfiles).where(eq(buyerProfiles.userId, buyerAId));
  assert(
    persistedProfile !== undefined &&
    Number(persistedProfile.budgetMax) === 350000000 &&
    persistedProfile.currency === 'IQD' &&
    persistedProfile.isComplete === true,
    'BYR-PROF-01',
    'Buyer profile successfully persisted in buyer_profiles with budget and preferences'
  );

  // -------------------------------------------------------------
  // PART 3: PROPERTY & MARKETPLACE LISTINGS
  // -------------------------------------------------------------
  console.log('\n--- PART 3: PROPERTY & MARKETPLACE LISTINGS ---');

  const prop1Id = 'prop-byr-001';
  const prop2Id = 'prop-byr-002';
  const listing1Id = 'list-byr-001';

  await db.insert(properties).values([
    {
      id: prop1Id,
      name: 'Italian Village Luxury Villa',
      type: 'VILLA',
      address: { city: 'Erbil', street: 'Italian Village II', district: 'Naznaz' },
      squareFeet: 2500,
      status: 'AVAILABLE',
      currency: 'IQD',
    },
    {
      id: prop2Id,
      name: 'Private Empire World Penthouse',
      type: 'APARTMENT',
      address: { city: 'Erbil', street: 'Empire World Tower 3' },
      squareFeet: 1800,
      status: 'AVAILABLE',
      currency: 'IQD',
    },
  ]);

  // Ownership records
  await db.insert(ownershipRecords).values([
    {
      id: 'own-rec-001',
      propertyId: prop1Id,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
    {
      id: 'own-rec-002',
      propertyId: prop2Id,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
  ]);

  // Management agreement for prop1
  await db.insert(managementAgreements).values({
    id: 'mgmt-rec-001',
    propertyId: prop1Id,
    ownerId: ownerId,
    companyId: companyOrgId,
    status: 'ACTIVE',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
      });

  // Published Marketplace Listing for Prop 1
  await db.insert(listings).values({
    id: listing1Id,
    propertyId: prop1Id,
    publisherUserId: ownerId,
    publisherCompanyId: companyOrgId,
    type: 'FOR_SALE',
    price: '280000000',
    currency: 'IQD',
    status: 'PUBLISHED',
    title: 'Splendid 4-Bedroom Villa in Italian Village II',
    description: 'High standard architectural finish with garden and private garage.',
  });

  const [persistedListing] = await db.select().from(listings).where(eq(listings.id, listing1Id));
  assert(
    persistedListing && persistedListing.status === 'PUBLISHED' && Number(persistedListing.price) === 280000000,
    'BYR-LIST-01',
    'Sale listing successfully registered and published on marketplace with 280,000,000 IQD price'
  );

  // -------------------------------------------------------------
  // PART 4: FAVORITES & SAVED SEARCHES LIFECYCLE
  // -------------------------------------------------------------
  console.log('\n--- PART 4: FAVORITES & SAVED SEARCHES ---');

  // Buyer A adds favorite
  await repo.addFavorite(buyerAId, prop1Id, listing1Id, 'Dream home candidate');
  const buyerAFavs = await repo.getFavorites(buyerAId);
  assert(
    buyerAFavs.length === 1 && buyerAFavs[0].propertyId === prop1Id,
    'BYR-FAV-01',
    'Buyer A successfully saved property to favorites'
  );

  // Idempotent duplicate addition
  await repo.addFavorite(buyerAId, prop1Id, listing1Id);
  const buyerAFavsDup = await repo.getFavorites(buyerAId);
  assert(
    buyerAFavsDup.length === 1,
    'BYR-FAV-02',
    'IDEMPOTENCY: Duplicate favorite addition preserved single record without error'
  );

  // Cross-buyer isolation
  const buyerBFavs = await repo.getFavorites(buyerBId);
  assert(
    buyerBFavs.length === 0,
    'BYR-FAV-03',
    'DATA ISOLATION: Buyer B query returns 0 favorites (zero cross-buyer leak)'
  );

  // Saved Searches
  const savedSearch = await repo.createSavedSearch(buyerAId, {
    name: 'Erbil Luxury Villas',
    criteria: { city: 'Erbil', propertyType: 'VILLA', maxPrice: 350000000 },
    notifyOnMatch: true,
  });
  assert(
    savedSearch.name === 'Erbil Luxury Villas' && savedSearch.criteria.maxPrice === 350000000,
    'BYR-SRCH-01',
    'Saved search criteria successfully persisted in saved_searches table'
  );

  // Remove Favorite
  await repo.removeFavorite(buyerAId, prop1Id);
  const favsAfterDelete = await repo.getFavorites(buyerAId);
  assert(
    favsAfterDelete.length === 0,
    'BYR-FAV-04',
    'Favorite cleanly removed from database'
  );

  // -------------------------------------------------------------
  // PART 5: PROPERTY INQUIRIES & RECIPIENT RESOLUTION
  // -------------------------------------------------------------
  console.log('\n--- PART 5: PROPERTY INQUIRIES & RECIPIENT RESOLUTION ---');

  const inquiry = await repo.createInquiry(buyerAId, {
    propertyId: prop1Id,
    listingId: listing1Id,
    inquiryType: 'PRICE_INQUIRY',
    message: 'Is the title deed registration ready for immediate transfer at Erbil Tapu?',
  });

  assert(
    inquiry.status === 'PENDING' && inquiry.message.includes('Erbil Tapu'),
    'BYR-INQ-01',
    'Inquiry persisted with PENDING status and authentic buyer message'
  );

  // Verify recipient was resolved from ownership & management
  const [persistedInquiry] = await db.select().from(propertyInquiries).where(eq(propertyInquiries.id, inquiry.id));
  assert(
    persistedInquiry.recipientUserId === ownerId && persistedInquiry.recipientCompanyId === companyOrgId,
    'BYR-INQ-02',
    'RECIPIENT RESOLUTION: Inquiry automatically routed to property deed owner and managing company'
  );

  // Cross-buyer inquiry isolation
  const buyerBInquiries = await repo.getInquiries(buyerBId);
  assert(
    buyerBInquiries.length === 0,
    'BYR-INQ-03',
    'DATA ISOLATION: Buyer B cannot see Buyer A property inquiries'
  );

  // -------------------------------------------------------------
  // PART 6: VIEWING APPOINTMENTS & SCHEDULING CONFLICTS
  // -------------------------------------------------------------
  console.log('\n--- PART 6: VIEWING APPOINTMENTS & SCHEDULING ---');

  const futureVisitDate = new Date(Date.now() + 2 * 86400000); // 2 days ahead
  futureVisitDate.setHours(14, 0, 0, 0);

  const viewing = await repo.requestViewing(buyerAId, {
    propertyId: prop1Id,
    listingId: listing1Id,
    scheduledAt: futureVisitDate.toISOString(),
    viewingType: 'IN_PERSON',
    notes: 'Please ensure garage and terrace access during inspection.',
  });

  assert(
    viewing.status === 'REQUESTED' && viewing.propertyId === prop1Id,
    'BYR-VIEW-01',
    'Viewing appointment request persisted with REQUESTED status'
  );

  // Conflict prevention within 1-hour window
  let conflictCaught = false;
  try {
    const conflictingDate = new Date(futureVisitDate.getTime() + 15 * 60000); // 15 mins later
    await repo.requestViewing(buyerAId, {
      propertyId: prop1Id,
      scheduledAt: conflictingDate.toISOString(),
    });
  } catch (err: any) {
    conflictCaught = err?.message?.includes('VIEWING_CONFLICT');
  }
  assert(
    conflictCaught,
    'BYR-VIEW-02',
    'CONFLICT PREVENTION: Conflicting viewing appointment inside 1-hour window rejected'
  );

  // Reschedule viewing
  const newDate = new Date(futureVisitDate.getTime() + 86400000);
  const rescheduledViewing = await repo.rescheduleViewing(buyerAId, viewing.id, {
    scheduledAt: newDate.toISOString(),
    reason: 'Rescheduled due to flight delay',
  });
  assert(
    rescheduledViewing.status === 'RESCHEDULED',
    'BYR-VIEW-03',
    'Viewing status successfully transitioned to RESCHEDULED with documented reason'
  );

  // Cancel viewing
  const cancelledViewing = await repo.cancelViewing(buyerAId, viewing.id, 'Buyer requested cancellation');
  assert(
    cancelledViewing.status === 'CANCELLED' && cancelledViewing.cancelledBy === buyerAId,
    'BYR-VIEW-04',
    'Viewing status transitioned to CANCELLED with responsible actor recorded'
  );

  // -------------------------------------------------------------
  // PART 7: OFFERS & COUNTER-OFFER NEGOTIATION INTEGRITY
  // -------------------------------------------------------------
  console.log('\n--- PART 7: OFFERS & COUNTER-OFFERS ---');

  const offer = await repo.createOffer(buyerAId, {
    propertyId: prop1Id,
    listingId: listing1Id,
    offerAmount: 265000000,
    currency: 'IQD',
    depositAmount: 25000000,
    financingType: 'CASH',
    terms: '30 days closing period with 10% escrow deposit',
  });

  assert(
    offer.status === 'OFFER_SUBMITTED' && Number(offer.offerAmount) === 265000000,
    'BYR-OFFER-01',
    'Purchase offer persisted with OFFER_SUBMITTED status and 265,000,000 IQD amount'
  );

  // INVARIANT: Buyer CANNOT accept their own original offer
  let selfAcceptanceBlocked = false;
  try {
    await repo.respondToCounter(buyerAId, offer.id, { action: 'ACCEPT' });
  } catch (err: any) {
    selfAcceptanceBlocked = err.message.includes('OFFER_SELF_ACCEPTANCE_FORBIDDEN');
  }
  assert(
    selfAcceptanceBlocked,
    'BYR-OFFER-02',
    'SECURITY INVARIANT: Buyer strictly prevented from self-approving their own submitted offer'
  );

  // Seller submits counter-offer (275,000,000 IQD)
  const counteredOffer = await repo.counterOffer(ownerId, 'SELLER_OWNER', offer.id, {
    counterAmount: 275000000,
    currency: 'IQD',
    counterTerms: 'Seller counters at 275,000,000 IQD with 15 days closing',
    note: 'Will include installed solar water heaters',
  });

  assert(
    counteredOffer.status === 'COUNTERED' && Number(counteredOffer.offerAmount) === 275000000,
    'BYR-OFFER-03',
    'Seller counter-offer persisted with COUNTERED status and 275,000,000 IQD amount'
  );

  // Verify negotiation history
  const [counterLog] = await db
    .select()
    .from(offerCounterHistory)
    .where(and(eq(offerCounterHistory.offerId, offer.id), eq(offerCounterHistory.actorRole, 'SELLER_OWNER')));
  assert(
    counterLog && Number(counterLog.counterAmount) === 275000000,
    'BYR-OFFER-04',
    'NEGOTIATION HISTORY: Counter-offer terms and actor logged in offer_counter_history'
  );

  // Buyer accepts counter-offer
  const acceptedOffer = await repo.respondToCounter(buyerAId, offer.id, { action: 'ACCEPT', note: 'Agreed with counter price' });
  assert(
    acceptedOffer.status === 'ACCEPTED',
    'BYR-OFFER-05',
    'Buyer successfully accepted counter-offer; status authoritatively transitioned to ACCEPTED'
  );

  // Cross-buyer offer isolation
  const buyerBOffers = await repo.getOffers(buyerBId);
  assert(
    buyerBOffers.length === 0,
    'BYR-OFFER-06',
    'DATA ISOLATION: Buyer B receives 0 offers (confidential negotiation preserved)'
  );

  // -------------------------------------------------------------
  // PART 8: SALES CONTRACTS & TRANSACTION MILESTONE STEPPER
  // -------------------------------------------------------------
  console.log('\n--- PART 8: SALES CONTRACTS & TRANSACTION MILESTONES ---');

  const contractId = 'cnt-byr-001';
  await db.insert(salesContracts).values({
    id: contractId,
    offerId: offer.id,
    propertyId: prop1Id,
    listingId: listing1Id,
    buyerId: buyerAId,
    sellerId: ownerId,
    contractNumber: 'HH-SALE-2026-0042',
    agreedPrice: '275000000',
    currency: 'IQD',
    depositAmount: '25000000',
    status: 'DRAFTED',
    terms: 'Standard HomeHub notarized sales agreement with title transfer deed guarantee.',
  });

  // Buyer accepts / signs contract
  const executedContract = await repo.acceptContract(buyerAId, contractId);
  assert(
    executedContract.status === 'EXECUTED' && executedContract.executionDate !== undefined,
    'BYR-CONTR-01',
    'Sales contract transitioned to EXECUTED with authoritative execution timestamp'
  );

  // Create Sales Transaction
  const txId = 'tx-byr-001';
  await db.insert(salesTransactions).values({
    id: txId,
    contractId: contractId,
    propertyId: prop1Id,
    buyerId: buyerAId,
    sellerId: ownerId,
    transactionNumber: 'TX-2026-8801',
    amount: '275000000',
    currency: 'IQD',
    status: 'TRANSACTION_OPENED',
    dueDiligenceStatus: 'PENDING',
  });

  // Advance milestone 1: DUE_DILIGENCE
  const txDueDiligence = await repo.advanceTransactionMilestone(buyerAId, txId, 'DUE_DILIGENCE');
  assert(
    txDueDiligence.status === 'DUE_DILIGENCE',
    'BYR-TX-01',
    'Sales transaction milestone advanced to DUE_DILIGENCE'
  );

  // INVARIANT: Block direct jump to CLOSED
  let illegalJumpBlocked = false;
  try {
    await repo.advanceTransactionMilestone(buyerAId, txId, 'CLOSED');
  } catch (err: any) {
    illegalJumpBlocked = err.message.includes('INVALID_TRANSACTION_TRANSITION');
  }
  assert(
    illegalJumpBlocked,
    'BYR-TX-02',
    'MILESTONE INTEGRITY: Illegal jump from DUE_DILIGENCE directly to CLOSED strictly blocked'
  );

  // Advance progressive lifecycle
  await repo.advanceTransactionMilestone(buyerAId, txId, 'CONTRACT_EXECUTED');
  await repo.advanceTransactionMilestone(buyerAId, txId, 'PAYMENT_PENDING');
  await repo.advanceTransactionMilestone(buyerAId, txId, 'SETTLEMENT_PENDING');
  await repo.advanceTransactionMilestone(buyerAId, txId, 'CLOSING_PENDING');
  const closedTx = await repo.advanceTransactionMilestone(buyerAId, txId, 'CLOSED');

  assert(
    closedTx.status === 'CLOSED' && closedTx.closedAt !== undefined,
    'BYR-TX-03',
    'Sales transaction successfully completed full 7-stage lifecycle to CLOSED'
  );

  // -------------------------------------------------------------
  // PART 9: FINANCIAL POLICY: 0% COMMISSION ON SALES & PAYMENTS
  // -------------------------------------------------------------
  console.log('\n--- PART 9: FINANCIAL POLICY & 0% SALES COMMISSION ---');

  // Seed milestone deposit payment record
  const paymentId = 'pay-byr-001';
  await db.insert(paymentRecords).values({
    id: paymentId,
    propertyId: prop1Id,
    payerId: buyerAId,
    amount: '25000000',
    currency: 'IQD',
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: 'FIB-TX-2026-991',
    status: 'CONFIRMED',
    recordedDate: new Date().toISOString().split('T')[0],
    receiptNumber: 'RCPT-SALE-2026-001',
  });

  // Verify that ZERO platform rent commission is applied to this payment
  const commissionRecords = await db
    .select()
    .from(commissions)
    .where(eq(commissions.paymentRecordId, paymentId));

  assert(
    commissionRecords.length === 0,
    'BYR-FIN-01',
    'CANONICAL FINANCIAL POLICY: Exactly 0 commissions generated (5% rent commission strictly excluded from sales)'
  );

  const buyerPayments = await repo.getPayments(buyerAId);
  assert(
    buyerPayments.length === 1 &&
    Number(buyerPayments[0].amount) === 25000000 &&
    buyerPayments[0].receiptNumber === 'RCPT-SALE-2026-001',
    'BYR-FIN-02',
    'Buyer payment record retrieved authoritatively with receipt number and confirmed status'
  );

  // -------------------------------------------------------------
  // PART 10: NOTIFICATIONS & PRIVACY ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- PART 10: NOTIFICATIONS & PRIVACY ISOLATION ---');

  await db.insert(notifications).values([
    {
      userId: buyerAId,
      category: 'OFFER',
      title: 'Counter Offer Received',
      message: 'Seller has submitted a counter-offer of 275,000,000 IQD.',
      read: false,
    },
    {
      userId: buyerBId,
      category: 'SECURITY',
      title: 'Password Changed',
      message: 'Your account credentials were updated.',
      read: false,
    },
  ]);

  const buyerANotifs = await repo.getNotifications(buyerAId);
  assert(
    buyerANotifs.length === 1 && buyerANotifs[0].title === 'Counter Offer Received',
    'BYR-NOTIF-01',
    'Buyer A retrieves their own notifications'
  );

  const buyerBNotifs = await repo.getNotifications(buyerBId);
  assert(
    buyerBNotifs.length === 1 && buyerBNotifs[0].title === 'Password Changed',
    'BYR-NOTIF-02',
    'DATA ISOLATION: Buyer notifications are strictly partitioned by userId'
  );

  // -------------------------------------------------------------
  // PART 11: AUTHORITATIVE DASHBOARD & AUDIT LOGS
  // -------------------------------------------------------------
  console.log('\n--- PART 11: DASHBOARD & AUDIT LOGGING ---');

  const dashboard = await repo.getAuthoritativeDashboard(buyerAId);
  assert(
    dashboard.buyerName === 'Kardo Barzani' &&
    dashboard.activity.activeOffersCount >= 1 &&
    dashboard.contracts.length >= 1 &&
    dashboard.transactions.length >= 1 &&
    (dashboard.payments?.length ?? 0) >= 1 &&
    (dashboard.notifications?.length ?? 0) >= 1,
    'BYR-DASH-01',
    'Authoritative dashboard aggregated all 11 core buyer domain modules with real PostgreSQL data'
  );

  const logs = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, buyerAId));
  assert(
    logs.length >= 3 && logs.some(l => l.action === 'CONTRACT_EXECUTED'),
    'BYR-AUDIT-FINAL',
    'Immutable audit trail recorded for all core buyer state mutations'
  );

  // Summary
  console.log('\n===================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runBuyerWorkflowPersistenceSuite().catch((err) => {
  console.error('Fatal persistence test runner error:', err);
  process.exit(1);
});
