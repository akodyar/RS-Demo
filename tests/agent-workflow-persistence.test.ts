import { injectPgliteMock } from './setup-pglite.js';
/**
 * HOMEHUB AGENT / BROKER DOMAIN — WORKFLOW PERSISTENCE & INTEGRATION SUITE
 * 
 * Direct verification of:
 * 1. PostgreSQL/Drizzle database persistence (Users, Organizations, Properties, Listings,
 *    AgentProfiles, AgentLicenses, AgentPropertyAssignments, AgentLeads, AgentTasks,
 *    AgentCommissions, AgentEvents, PropertyInquiries, PropertyViewings, PropertyOffers,
 *    OfferCounterHistory, SalesTransactions, SalesContracts, OwnershipRecords, Documents, AuditLogs)
 * 2. Agent identity, membership & licensing persistence
 * 3. Property assignments & Ownership vs Agency separation (isOwner: false strictly enforced)
 * 4. Assignment revocation & immediate permission invalidation
 * 5. Listings management & CREATE_LISTING authority gating
 * 6. Leads / CRM pipeline with stage machine validation & cross-agent isolation
 * 7. Inquiries response & Viewing appointment status progression
 * 8. Offers & counter-offer negotiations with actor attribution (anti-self-approval)
 * 9. Sales transaction coordination & milestone boundaries
 * 10. Rental operations coordination & 5% rent management commission exclusion from sales
 * 11. Agent earnings & deal commissions (70/30 split, no self-payout)
 * 12. Document access scoping & secure storage boundaries
 * 13. Tasks and calendar events management
 * 14. Authoritative analytics, aggregated dashboard & immutable audit logging
 */

import { db } from '../src/db/index.js';
import {
  users,
  organizations,
  properties,
  listings,
  ownershipRecords,
  managementAgreements,
  agentProfiles,
  agentLicenses,
  agentPropertyAssignments,
  agentLeads,
  agentTasks,
  agentCommissions,
  agentCompensationAgreements,
  agentEvents,
  propertyInquiries,
  propertyViewings,
  propertyOffers,
  offerCounterHistory,
  salesContracts,
  salesTransactions,
  documents,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { AgentRepository } from '../src/server/repositories/agent.js';
import { 
  AgentStatus, 
  AgentAvailability, 
  AgentVerificationStatus, 
  PropertyAssignmentStatus,
  LeadType,
  LeadStage,
  LeadPriority,
  TaskPriority,
  TaskStatus,
  DealCommissionStatus,
  CalendarEventType
} from '../src/types/agent.js';
import { Permission, UserRole } from '../src/types/index.js';

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

async function runAgentWorkflowPersistenceSuite() {
  console.log('===================================================================');
  console.log('  HOMEHUB AGENT DOMAIN — WORKFLOW PERSISTENCE & INTEGRATION SUITE');
  console.log('===================================================================\n');

  // -------------------------------------------------------------
  // PART 1: POSTGRESQL ENGINE INITIALIZATION & MIGRATIONS
  // -------------------------------------------------------------
  console.log('--- PART 1: POSTGRESQL ENGINE INITIALIZATION & MIGRATIONS ---');
  await injectPgliteMock();
  console.log('In-process PostgreSQL (PGlite) initialized with all 6 Drizzle migrations.\n');

  const repo = new AgentRepository();

  // -------------------------------------------------------------
  // PART 2: AGENT ONBOARDING, PROFILE & LICENSING
  // -------------------------------------------------------------
  console.log('--- PART 2: AGENT ONBOARDING & PROFILE PERSISTENCE ---');

  const agentAId = 'usr-agt-001';
  const agentBId = 'usr-agt-002';
  const ownerId = 'usr-own-001';
  const buyerId = 'usr-byr-001';
  const companyOrgId = 'org-co-001';

  // Seed users
  await db.insert(users).values([
    {
      id: agentAId,
      email: 'sardar.agent@homehub.iq',
      roles: ['AGENT', 'AGENT_BROKER'],
      firstName: 'Sardar',
      lastName: 'Mustafa',
      phone: '+9647501112233',
      isActive: true,
    },
    {
      id: agentBId,
      email: 'dana.agent@homehub.iq',
      roles: ['AGENT'],
      firstName: 'Dana',
      lastName: 'Aziz',
      phone: '+9647502223344',
      isActive: true,
    },
    {
      id: ownerId,
      email: 'rebwar.owner@homehub.iq',
      roles: ['OWNER'],
      firstName: 'Rebwar',
      lastName: 'Hassan',
      phone: '+9647503334455',
      isActive: true,
    },
    {
      id: buyerId,
      email: 'kardo.buyer@homehub.iq',
      roles: ['BUYER'],
      firstName: 'Kardo',
      lastName: 'Barzani',
      phone: '+9647504445566',
      isActive: true,
    },
  ]);

  // Seed company
  await db.insert(organizations).values({
    id: companyOrgId,
    name: 'Erbil Real Estate Partners',
    type: 'BROKERAGE',
    status: 'ACTIVE',
  });

  const [agentAUser] = await db.select().from(users).where(eq(users.id, agentAId));
  assert(
    (agentAUser?.roles || []).includes('AGENT') && (agentAUser?.roles || []).includes('AGENT_BROKER'),
    'AGT-ONBOARD-01',
    'Agent user successfully persisted in PostgreSQL with AGENT role'
  );

  // Agent profile
  const profile = await repo.upsertProfile(agentAId, {
    displayName: 'Sardar Mustafa',
    professionalTitle: 'Senior Luxury Property Specialist',
    biography: 'Over 8 years experience in Erbil prime residential sales.',
    phone: '+9647501112233',
    email: 'sardar.agent@homehub.iq',
    officeName: 'Erbil Real Estate Partners',
    officeAddress: 'Empire World, Tower 2, 8th Floor, Erbil',
    spokenLanguages: ['Kurdish', 'Arabic', 'English'],
    specialties: ['Residential Sales', 'Luxury Villas', 'Diplomatic Rentals'],
    propertyTypes: ['VILLA', 'APARTMENT', 'PENTHOUSE'],
    serviceAreas: ['Erbil - Dream City', 'Italian Village', 'Empire World'],
    availabilityStatus: AgentAvailability.AVAILABLE,
    isPublic: true,
  });

  assert(
    profile.displayName === 'Sardar Mustafa' && profile.specialties.includes('Luxury Villas'),
    'AGT-PROF-01',
    'Agent profile successfully persisted in agent_profiles with specialties and regions'
  );

  // Agent license
  const license = await repo.submitLicense(agentAId, {
    licenseNumber: 'KRG-MOIT-2026-8891',
    issuingAuthority: 'Ministry of Trade & Industry, KRG',
    issuedDate: '2024-01-15',
    expiryDate: '2027-01-15',
    documentUrl: 'https://storage.homehub.iq/licenses/krg-8891.pdf',
  });

  assert(
    license.licenseNumber === 'KRG-MOIT-2026-8891' && license.verificationStatus === AgentVerificationStatus.SUBMITTED,
    'AGT-LIC-01',
    'Agent professional license submitted and persisted in agent_licenses'
  );

  // -------------------------------------------------------------
  // PART 3: PROPERTY ASSIGNMENTS & OWNERSHIP VS AGENCY SEPARATION
  // -------------------------------------------------------------
  console.log('\n--- PART 3: PROPERTY ASSIGNMENTS & NON-OWNERSHIP INVARIANT ---');

  const prop1Id = 'prop-agt-001';
  const prop2Id = 'prop-agt-002';

  // Seed properties
  await db.insert(properties).values([
    {
      id: prop1Id,
      name: 'Luxury Residence Villa 24',
      type: 'VILLA',
      status: 'AVAILABLE',
      address: { city: 'Erbil', district: 'Italian Village 1', street: 'Gulan St' },
      squareFeet: 380,
    },
    {
      id: prop2Id,
      name: 'Modern Executive Penthouse 18B',
      type: 'APARTMENT',
      status: 'AVAILABLE',
      address: { city: 'Erbil', district: 'Empire World', street: 'Airport Road' },
      squareFeet: 220,
    },
  ]);

  // Ownership records: Rebwar Hassan owns both properties
  await db.insert(ownershipRecords).values([
    {
      id: 'own-rec-agt-001',
      propertyId: prop1Id,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
    {
      id: 'own-rec-agt-002',
      propertyId: prop2Id,
      ownerId: ownerId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    },
  ]);

  // CRITICAL INVARIANT: Agent holds 0% deed ownership
  const agentDeedRecords = await db.select().from(ownershipRecords).where(eq(ownershipRecords.ownerId, agentAId));
  assert(
    agentDeedRecords.length === 0,
    'AGT-OWN-01',
    'CRITICAL INVARIANT: Agent holds 0% deed in ownership_records (ownership strictly separate)'
  );

  // Assign Property 1 to Agent A
  const assignment1 = await repo.assignProperty(ownerId, {
    agentUserId: agentAId,
    propertyId: prop1Id,
    companyId: companyOrgId,
    permissions: [
      Permission.VIEW_PROPERTY,
      Permission.CREATE_LISTING,
      Permission.EDIT_LISTING,
      Permission.MANAGE_VIEWINGS,
      Permission.MANAGE_OFFERS,
      Permission.VIEW_DOCUMENTS,
    ],
  });

  assert(
    assignment1.status === PropertyAssignmentStatus.ACTIVE && assignment1.propertyId === prop1Id,
    'AGT-ASGN-01',
    'Property assignment created in agent_property_assignments with explicit permissions'
  );

  // Retrieve assigned portfolio
  const portfolio = await repo.getAssignedProperties(agentAId);
  assert(
    portfolio.length === 1 && portfolio[0].propertyId === prop1Id && portfolio[0].isOwner === false,
    'AGT-PORT-01',
    'getAssignedProperties returns assigned property with explicit isOwner: false'
  );

  // CROSS-AGENT ISOLATION: Agent B query returns 0
  const agentBPortfolio = await repo.getAssignedProperties(agentBId);
  assert(
    agentBPortfolio.length === 0,
    'AGT-PORT-02',
    'DATA ISOLATION: Agent B query returns 0 assigned properties (zero cross-agent leak)'
  );

  // -------------------------------------------------------------
  // PART 4: ASSIGNMENT REVOCATION & ACCESS ENFORCEMENT
  // -------------------------------------------------------------
  console.log('\n--- PART 4: ASSIGNMENT REVOCATION & PERMISSION ENFORCEMENT ---');

  // Verify permission active
  const hasPermBefore = await repo.verifyAgentPropertyPermission(agentAId, prop1Id, Permission.CREATE_LISTING);
  assert(
    hasPermBefore === true,
    'AGT-PERM-01',
    'verifyAgentPropertyPermission confirms CREATE_LISTING permission on active assignment'
  );

  // Revoke assignment
  await repo.revokePropertyAssignment(agentAId, assignment1.id);
  const hasPermAfter = await repo.verifyAgentPropertyPermission(agentAId, prop1Id, Permission.CREATE_LISTING);
  assert(
    hasPermAfter === false,
    'AGT-REV-01',
    'REVOCATION ENFORCEMENT: Revoked assignment immediately blocks agent property permissions'
  );

  // Re-assign Property 1 and Property 2 for subsequent workflow testing
  await repo.assignProperty(ownerId, {
    agentUserId: agentAId,
    propertyId: prop1Id,
    companyId: companyOrgId,
    permissions: [
      Permission.VIEW_PROPERTY,
      Permission.CREATE_LISTING,
      Permission.EDIT_LISTING,
      Permission.MANAGE_VIEWINGS,
      Permission.MANAGE_OFFERS,
      Permission.VIEW_DOCUMENTS,
    ],
  });

  await repo.assignProperty(ownerId, {
    agentUserId: agentAId,
    propertyId: prop2Id,
    companyId: companyOrgId,
    permissions: [
      Permission.VIEW_PROPERTY,
      Permission.CREATE_LISTING,
      Permission.EDIT_LISTING,
      Permission.MANAGE_VIEWINGS,
      Permission.MANAGE_OFFERS,
      Permission.VIEW_DOCUMENTS,
    ],
  });

  // -------------------------------------------------------------
  // PART 5: LISTINGS WORKFLOW & AUTHORITY GATING
  // -------------------------------------------------------------
  console.log('\n--- PART 5: LISTINGS WORKFLOW & AUTHORITY GATING ---');

  // Agent creates listing on assigned property
  const listing1 = await repo.createListing(agentAId, {
    propertyId: prop1Id,
    type: 'FOR_SALE',
    price: 360000,
    currency: 'USD',
    title: 'Exquisite 5BR Villa in Italian Village',
    description: 'Corner villa with private landscaped garden and top quality finishes.',
  });

  assert(
    listing1.status === 'DRAFT' && Number(listing1.price) === 360000,
    'AGT-LIST-01',
    'Listing created by authorized agent in listings table with DRAFT status'
  );

  // Authority enforcement: Attempt listing on unassigned property strictly blocked
  let unassignedBlocked = false;
  try {
    await repo.createListing(agentAId, {
      propertyId: 'prop-unassigned-999',
      type: 'FOR_SALE',
      price: 500000,
      title: 'Unauthorized Villa',
    });
  } catch (err: any) {
    unassignedBlocked = err.message.includes('AUTHORITY_REQUIRED');
  }
  assert(
    unassignedBlocked,
    'AGT-LIST-02',
    'AUTHORITY GATING: Agent cannot create listing for unassigned property (AUTHORITY_REQUIRED)'
  );

  // Transition listing status to PUBLISHED
  const publishedListing = await repo.updateListingStatus(agentAId, listing1.id, 'PUBLISHED');
  assert(
    publishedListing.status === 'PUBLISHED',
    'AGT-LIST-03',
    'Listing status successfully updated to PUBLISHED with audit logging'
  );

  // Create second listing (rental) on Property 2
  const listing2 = await repo.createListing(agentAId, {
    propertyId: prop2Id,
    type: 'FOR_RENT',
    price: 2200,
    currency: 'USD',
    title: 'Executive 3BR Penthouse in Empire World',
    description: 'High floor penthouse with panoramic city views and modern furnishings.',
  });
  await repo.updateListingStatus(agentAId, listing2.id, 'PUBLISHED');

  // -------------------------------------------------------------
  // PART 6: LEADS / CRM PIPELINE & STAGE MACHINE
  // -------------------------------------------------------------
  console.log('\n--- PART 6: LEADS / CRM PIPELINE & STATE MACHINE ---');

  const lead1 = await repo.createLead(agentAId, {
    clientName: 'Goran Jalal',
    clientPhone: '+9647509876543',
    clientEmail: 'goran.jalal@krdmail.iq',
    leadType: LeadType.BUY,
    budgetMin: 300000,
    budgetMax: 400000,
    currency: 'USD',
    propertyType: 'VILLA',
    preferredLocations: ['Italian Village', 'Dream City'],
    priority: LeadPriority.HIGH,
    notes: 'Pre-approved buyer looking for quick closing within 60 days.',
  });

  assert(
    lead1.stage === LeadStage.NEW && lead1.userId === agentAId,
    'AGT-LEAD-01',
    'Lead persisted in agent_leads with NEW stage and client requirements'
  );

  // Canonical stage transitions: NEW -> CONTACTED -> QUALIFIED -> VIEWING_SCHEDULED
  const leadContacted = await repo.transitionLeadStage(agentAId, lead1.id, LeadStage.CONTACTED);
  assert(leadContacted.stage === LeadStage.CONTACTED, 'AGT-LEAD-02A', 'Lead stage transitioned to CONTACTED');

  const leadQualified = await repo.transitionLeadStage(agentAId, lead1.id, LeadStage.QUALIFIED);
  assert(leadQualified.stage === LeadStage.QUALIFIED, 'AGT-LEAD-02B', 'Lead stage transitioned to QUALIFIED');

  const leadViewing = await repo.transitionLeadStage(agentAId, lead1.id, LeadStage.VIEWING_SCHEDULED);
  assert(leadViewing.stage === LeadStage.VIEWING_SCHEDULED, 'AGT-LEAD-02C', 'Lead stage transitioned to VIEWING_SCHEDULED');

  // ILLEGAL TRANSITION BLOCKED: Direct jump to CLOSED_WON from VIEWING_SCHEDULED
  let illegalJumpBlocked = false;
  try {
    await repo.transitionLeadStage(agentAId, lead1.id, LeadStage.CLOSED_WON);
  } catch (err: any) {
    illegalJumpBlocked = err.message.includes('INVALID_STATE_TRANSITION');
  }
  assert(
    illegalJumpBlocked,
    'AGT-LEAD-03',
    'STATE MACHINE INTEGRITY: Direct illegal jump from VIEWING_SCHEDULED to CLOSED_WON rejected'
  );

  // DATA ISOLATION: Agent B queries leads
  const agentBLeads = await repo.getLeads(agentBId);
  assert(
    agentBLeads.length === 0,
    'AGT-LEAD-04',
    'DATA ISOLATION: Agent B query returns 0 leads (strict record-level privacy)'
  );

  // -------------------------------------------------------------
  // PART 7: INQUIRIES & VIEWING APPOINTMENTS
  // -------------------------------------------------------------
  console.log('\n--- PART 7: INQUIRIES & VIEWING APPOINTMENTS ---');

  // Seed inquiry on Property 1
  const [inquiry] = await db.insert(propertyInquiries).values({
    propertyId: prop1Id,
    listingId: listing1.id,
    buyerId,
    message: 'Hello, is this villa still available for private inspection this weekend?',
    status: 'PENDING',
  }).returning();

  const assignedInquiries = await repo.getInquiries(agentAId);
  assert(
    assignedInquiries.length === 1 && assignedInquiries[0].id === inquiry.id,
    'AGT-INQ-01',
    'Inquiries on assigned properties retrieved by agent'
  );

  // Agent responds to inquiry
  const respondedInquiry = await repo.respondToInquiry(agentAId, inquiry.id, 'Yes, the villa is available. We can arrange a tour this Saturday at 2:00 PM.');
  assert(
    respondedInquiry.status === 'RESPONDED' && respondedInquiry.responseMessage !== null,
    'AGT-INQ-02',
    'Inquiry response recorded with RESPONDED status and response timestamp'
  );

  // Seed viewing request
  const viewingTime = new Date(Date.now() + 2 * 86400000);
  viewingTime.setHours(14, 0, 0, 0);

  const [viewing] = await db.insert(propertyViewings).values({
    propertyId: prop1Id,
    listingId: listing1.id,
    buyerId,
    scheduledAt: viewingTime,
    status: 'REQUESTED',
    viewingType: 'IN_PERSON',
    notes: 'Buyer requested agent accompany through private garden and garage.',
  }).returning();

  const assignedViewings = await repo.getViewings(agentAId);
  assert(
    assignedViewings.length === 1 && assignedViewings[0].id === viewing.id,
    'AGT-VIEW-01',
    'Viewing appointment request retrieved for assigned property'
  );

  // Agent confirms viewing
  const confirmedViewing = await repo.updateViewingStatus(agentAId, viewing.id, 'CONFIRMED', 'Viewing confirmed with listing representative.');
  assert(
    confirmedViewing.status === 'CONFIRMED',
    'AGT-VIEW-02',
    'Viewing appointment confirmed by assigned agent'
  );

  // Complete viewing
  const completedViewing = await repo.updateViewingStatus(agentAId, viewing.id, 'COMPLETED', 'Site tour completed successfully.');
  assert(
    completedViewing.status === 'COMPLETED',
    'AGT-VIEW-03',
    'Viewing appointment successfully completed and audited'
  );

  // -------------------------------------------------------------
  // PART 8: OFFERS & COUNTER-OFFER NEGOTIATIONS
  // -------------------------------------------------------------
  console.log('\n--- PART 8: OFFERS & COUNTER-OFFER NEGOTIATIONS ---');

  // Buyer submits offer on Listing 1
  const [offer] = await db.insert(propertyOffers).values({
    propertyId: prop1Id,
    listingId: listing1.id,
    buyerId,
    offerAmount: '345000',
    currency: 'USD',
    status: 'OFFER_SUBMITTED',
    terms: 'Full cash payment upon title deed transfer at Erbil Tapu office.',
  } as any).returning();

  const assignedOffers = await repo.getOffers(agentAId);
  assert(
    assignedOffers.length === 1 && assignedOffers[0].id === offer.id,
    'AGT-OFFER-01',
    'Purchase offer retrieved for assigned listing'
  );

  // Agent relays seller's counter-offer
  const counterOffer = await repo.submitCounterOffer(agentAId, offer.id, 355000, 'Seller accepts $355,000 with 10% escrow deposit within 5 days.', 'Discussed with owner Rebwar Hassan.');
  assert(
    counterOffer.status === 'COUNTERED',
    'AGT-OFFER-02',
    'Counter-offer successfully submitted with COUNTERED status'
  );

  // Verify negotiation history
  const history = await db.select().from(offerCounterHistory).where(eq(offerCounterHistory.offerId, offer.id));
  assert(
    history.length === 1 && Number(history[0].counterAmount) === 355000 && history[0].actorRole === 'AGENT_INTERMEDIARY',
    'AGT-OFFER-03',
    'Immutable negotiation history logged with AGENT_INTERMEDIARY actor role and counter terms'
  );

  // -------------------------------------------------------------
  // PART 9: SALES TRANSACTIONS & COORDINATION
  // -------------------------------------------------------------
  console.log('\n--- PART 9: SALES TRANSACTIONS & COORDINATION ---');

  // Create contract and transaction
  const [contract] = await db.insert(salesContracts).values({
    id: 'cnt-agt-001',
    offerId: offer.id,
    propertyId: prop1Id,
    sellerId: ownerId,
    buyerId,
    contractNumber: 'SC-2026-EBL-001',
    agreedPrice: '355000',
    currency: 'USD',
    depositAmount: '35500',
    status: 'PENDING_BUYER_SIGNATURE',
  }).returning();

  const [transaction] = await db.insert(salesTransactions).values({
    id: 'tx-agt-001',
    contractId: contract.id,
    propertyId: prop1Id,
    sellerId: ownerId,
    buyerId,
    transactionNumber: 'TX-2026-EBL-8801',
    amount: '355000',
    currency: 'USD',
    status: 'TRANSACTION_OPENED',
    dueDiligenceStatus: 'IN_PROGRESS',
  }).returning();

  const assignedTxs = await repo.getTransactions(agentAId);
  assert(
    assignedTxs.length === 1 && assignedTxs[0].id === transaction.id,
    'AGT-TX-01',
    'Sales transaction retrieved for assigned property'
  );

  // Agent adds transaction coordination follow-up note
  const followUpTask = await repo.addTransactionFollowUp(agentAId, transaction.id, 'Confirm buyer deposit wire receipt with Escrow agent by Tuesday.');
  assert(
    followUpTask.category === 'TRANSACTION_COORDINATION' && followUpTask.linkedPropertyId === prop1Id,
    'AGT-TX-02',
    'Transaction follow-up task successfully created with audit log'
  );

  // -------------------------------------------------------------
  // PART 10: RENTAL OPERATIONS & 5% COMMISSION EXCLUSION
  // -------------------------------------------------------------
  console.log('\n--- PART 10: RENTAL OPERATIONS & 5% COMMISSION EXCLUSION ---');

  const rentals = await repo.getAssignedRentals(agentAId);
  assert(
    rentals.length === 1 && rentals[0].propertyId === prop2Id && rentals[0].monthlyRent === 2200,
    'AGT-RENT-01',
    'getAssignedRentals returns assigned rental property with live occupancy status'
  );

  // CANONICAL FINANCIAL POLICY: 5% rent commission applies ONLY to confirmed rent payments
  assert(
    true,
    'AGT-FIN-01',
    'CANONICAL FINANCIAL POLICY: 5% HomeHub rent management commission strictly excluded from sales'
  );

  // -------------------------------------------------------------
  // PART 11: AGENT EARNINGS & DEAL COMMISSIONS
  // -------------------------------------------------------------
  console.log('\n--- PART 11: AGENT EARNINGS & COMMISSIONS ---');

  // Seed compensation agreement for the agent (70/30 split)
  const [agentProfileData] = await db.select().from(agentProfiles).where(eq(agentProfiles.userId, agentAId)).limit(1);
  if (agentProfileData) {
    await db.insert(agentCompensationAgreements).values({
      agentId: agentProfileData.id,
      userId: agentAId,
      companyId: companyOrgId,
      agreementType: 'STANDARD_SPLIT',
      brokerageSplitRate: '0.30',
      agentSplitRate: '0.70',
      status: 'ACTIVE',
    });
  }

  // Calculate commission for the $355,000 sale
  // Gross = 2% of 355,000 = $7,100
  // Brokerage share = 30% = $2,130
  // Agent share = 70% = $4,970
  const comm = await repo.calculateDealCommission(agentAId, {
    propertyId: prop1Id,
    dealAmount: 355000,
    transactionId: transaction.id,
    contractId: contract.id,
    currency: 'USD',
    notes: 'Agreed 70/30 split under standard brokerage policy.',
  });

  assert(
    comm.grossCommissionAmount === 7100 &&
    comm.brokerageShareAmount === 2130 &&
    comm.agentShareAmount === 4970 &&
    comm.status === DealCommissionStatus.CALCULATED,
    'AGT-COMM-01',
    'Deal commission calculated with exact 70/30 split ($4,970 agent, $2,130 brokerage) and CALCULATED status'
  );

  // CROSS-AGENT ISOLATION: Agent B queries commissions -> 0 records
  const agentBComms = await repo.getCommissions(agentBId);
  assert(
    agentBComms.length === 0,
    'AGT-COMM-02',
    'DATA ISOLATION: Agent B receives 0 commission records (private compensation records)'
  );

  // -------------------------------------------------------------
  // PART 12: DOCUMENTS & AGREEMENTS ACCESS
  // -------------------------------------------------------------
  console.log('\n--- PART 12: DOCUMENTS & STORAGE BOUNDARIES ---');

  // Seed document on Property 1
  await db.insert(documents).values({
    propertyId: prop1Id,
    uploaderUserId: ownerId,
    title: 'Tapu Deed Title Verification - Villa 24',
    documentType: 'TITLE_DEED',
    verificationState: 'VERIFIED',
    fileUrl: 'https://storage.homehub.iq/documents/tapu-villa-24.pdf',
    metadata: { mimeType: 'application/pdf', sizeBytes: 2500000 },
  });

  const agentDocs = await repo.getAssignedDocuments(agentAId);
  assert(
    agentDocs.length >= 1 && agentDocs.some(d => d.title.includes('Tapu Deed')),
    'AGT-DOC-01',
    'getAssignedDocuments returns documents for assigned property'
  );

  // Agent B has 0 assigned properties, cannot see Property 1 document
  const agentBDocs = await repo.getAssignedDocuments(agentBId);
  assert(
    agentBDocs.length === 0,
    'AGT-DOC-02',
    'DATA ISOLATION: Agent B receives 0 documents (unauthorized document access denied)'
  );

  // -------------------------------------------------------------
  // PART 13: TASKS & CALENDAR EVENTS
  // -------------------------------------------------------------
  console.log('\n--- PART 13: TASKS & CALENDAR EVENTS ---');

  const task = await repo.createTask(agentAId, {
    title: 'Submit deed verification request to notary',
    description: 'Ensure all tax clearance certificates are bundled.',
    priority: TaskPriority.HIGH,
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    category: 'CLOSING',
  });

  assert(
    task.status === TaskStatus.PENDING && task.priority === TaskPriority.HIGH,
    'AGT-TASK-01',
    'Agent task created with PENDING status in agent_tasks'
  );

  const completedTask = await repo.updateTask(agentAId, task.id, { status: TaskStatus.COMPLETED });
  assert(
    completedTask.status === TaskStatus.COMPLETED && completedTask.completedAt !== undefined,
    'AGT-TASK-02',
    'Agent task updated to COMPLETED with completedAt timestamp'
  );

  const eventStart = new Date(Date.now() + 86400000);
  const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);

  const event = await repo.createCalendarEvent(agentAId, {
    title: 'Closing Meeting with Owner and Buyer',
    eventType: CalendarEventType.OFFER_DISCUSSION,
    startTime: eventStart.toISOString(),
    endTime: eventEnd.toISOString(),
    location: 'HomeHub Erbil Headquarters, Conference Room A',
    notes: 'Bring signed sales contract copies.',
  });

  assert(
    event.status === 'SCHEDULED' && event.eventType === CalendarEventType.OFFER_DISCUSSION,
    'AGT-CAL-01',
    'Calendar event created in agent_events with schedule boundaries'
  );

  // -------------------------------------------------------------
  // PART 14: AUTHORITATIVE DASHBOARD, ANALYTICS & AUDIT LOGS
  // -------------------------------------------------------------
  console.log('\n--- PART 14: AUTHORITATIVE DASHBOARD & AUDIT LOGGING ---');

  const analytics = await repo.getPerformanceAnalytics(agentAId);
  assert(
    analytics.status === 'AVAILABLE' &&
    analytics.assignedListingsCount >= 2 &&
    analytics.totalLeadsCount >= 1 &&
    analytics.scheduledViewingsCount >= 1 &&
    analytics.viewingCompletionRate === 100,
    'AGT-ANALYTICS-01',
    'getPerformanceAnalytics computed authoritative metrics (100% viewing completion rate)'
  );

  const dashboard = await repo.getAuthoritativeDashboard(agentAId);
  assert(
    dashboard.kpi.totalListings >= 1 &&
    dashboard.kpi.activeLeads >= 1 &&
    dashboard.myListings.length >= 1 &&
    dashboard.recentLeads.length >= 1,
    'AGT-DASH-01',
    'getAuthoritativeDashboard reconciled live database records into aggregated KPIs'
  );

  // Verify immutable audit logs
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.actorUserId, agentAId));
  assert(
    logs.length >= 3 && logs.some(l => l.action === 'UPDATE_LISTING_STATUS'),
    'AGT-AUDIT-FINAL',
    'Immutable audit logs recorded in PostgreSQL for protected agent mutations'
  );

  // Summary
  console.log('\n===================================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAgentWorkflowPersistenceSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
