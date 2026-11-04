import test from 'node:test';
import assert from 'node:assert';
import { db, pool } from '../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  listings,
  promotionPackages,
  promotionCampaigns,
  pointsWallets,
  pointsTransactions,
  pointsRewardRules,
  pointsRewardGrants,
} from '../src/db/schema.js';
import { eq, and, sql, desc } from 'drizzle-orm';
import { promotionCampaignService } from '../src/server/services/promotion-campaign.js';
import { promotionCampaignRepository } from '../src/server/repositories/promotion-campaign.js';
import { pointsEngine } from '../src/server/services/points-engine.js';
import { assertSafeDatabaseConfig } from './safe-test-env.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';
process.env.SQL_DB_NAME = process.env.SQL_DB_NAME || 'homehub_test';
assertSafeDatabaseConfig();

test('Promotion Campaign Service Foundation & Points Reservation Suite (homehub_test)', async (t) => {
  const runId = 'p3_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const ownerId = `usr_own_${runId}`;
  const agentId = `usr_agt_${runId}`;
  const tenantId = `usr_tnt_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const strangerId = `usr_str_${runId}`;
  const splitPayerId = `usr_spt_${runId}`;

  const propRentalId = `prop_rent_${runId}`;
  const propSaleId = `prop_sale_${runId}`;
  const propInactiveId = `prop_inact_${runId}`;
  const propSplitRentalId = `prop_spt_${runId}`;

  const listingRentalId = `list_rent_${runId}`;
  const listingSaleId = `list_sale_${runId}`;
  const listingInactiveId = `list_inact_${runId}`;
  const listingSplitRentalId = `list_spt_${runId}`;

  const createdCampaignIds: string[] = [];

  t.before(async () => {
    // 1. Verify connection to authorized test database
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    assert.strictEqual(activeDb, 'homehub_test', 'Must connect to homehub_test');

    // 2. Insert synthetic user identities
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'P3', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: agentId, email: `${agentId}@test.iq`, firstName: 'Agent', lastName: 'P3', roles: ['AGENT'], isActive: true },
      { id: tenantId, email: `${tenantId}@test.iq`, firstName: 'Tenant', lastName: 'P3', roles: ['TENANT'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'P3', roles: ['ADMIN', 'SUPER_ADMIN'], isActive: true },
      { id: strangerId, email: `${strangerId}@test.iq`, firstName: 'Stranger', lastName: 'P3', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: splitPayerId, email: `${splitPayerId}@test.iq`, firstName: 'SplitPayer', lastName: 'P3', roles: ['PROPERTY_OWNER'], isActive: true },
    ]);

    // 3. Insert properties
    await db.insert(properties).values([
      { id: propRentalId, name: `Rental Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
      { id: propSaleId, name: `Sale Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
      { id: propInactiveId, name: `Inactive Property ${runId}`, type: 'RESIDENTIAL', status: 'PENDING_VERIFICATION', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
      { id: propSplitRentalId, name: `Split Rental Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
    ]);

    // 4. Insert ownership records
    await db.insert(ownershipRecords).values([
      { id: `own_rent_${runId}`, propertyId: propRentalId, ownerId: ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_sale_${runId}`, propertyId: propSaleId, ownerId: ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_inact_${runId}`, propertyId: propInactiveId, ownerId: ownerId, ownershipPercentage: '100.00', status: 'PENDING' },
      { id: `own_split_${runId}`, propertyId: propSplitRentalId, ownerId: splitPayerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // 5. Insert listings
    await db.insert(listings).values([
      {
        id: listingRentalId,
        propertyId: propRentalId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1200000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Valid Rental Listing ${runId}`,
      },
      {
        id: listingSaleId,
        propertyId: propSaleId,
        publisherUserId: ownerId,
        type: 'FOR_SALE',
        price: '300000000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Invalid Sale Listing ${runId}`,
      },
      {
        id: listingInactiveId,
        propertyId: propInactiveId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1000000',
        currency: 'IQD',
        status: 'DRAFT',
        title: `Inactive Property Rental ${runId}`,
      },
      {
        id: listingSplitRentalId,
        propertyId: propSplitRentalId,
        publisherUserId: splitPayerId,
        type: 'FOR_RENT',
        price: '900000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Split Rental Listing ${runId}`,
      },
    ]);
  });

  t.after(async () => {
    // Cleanup synthetic test records
    for (const cId of createdCampaignIds) {
      await db.delete(promotionCampaigns).where(eq(promotionCampaigns.id, cId)).catch(() => {});
    }
    await db.delete(listings).where(eq(listings.propertyId, propRentalId)).catch(() => {});
    await db.delete(listings).where(eq(listings.propertyId, propSaleId)).catch(() => {});
    await db.delete(listings).where(eq(listings.propertyId, propInactiveId)).catch(() => {});
    await db.delete(listings).where(eq(listings.propertyId, propSplitRentalId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propRentalId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propSaleId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propInactiveId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propSplitRentalId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propRentalId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propSaleId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propInactiveId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propSplitRentalId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, ownerId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, agentId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, splitPayerId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, ownerId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, agentId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, splitPayerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, ownerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, agentId)).catch(() => {});
    await db.delete(users).where(eq(users.id, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
    await db.delete(users).where(eq(users.id, strangerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, splitPayerId)).catch(() => {});
  });

  // --------------------------------------------------------------------------
  // TEST 1: Package listing & validation
  // --------------------------------------------------------------------------
  await t.test('1. Eligible active packages can be queried and snapshotted', async () => {
    const packages = await promotionCampaignService.listEligiblePackages();
    assert.ok(packages.length >= 3, 'Should list at least 3 active promotion packages');
    const featured = packages.find((p) => p.type === 'HOME_FEATURED' || p.id === 'PKG_HOME_FEATURED_7D');
    assert.ok(featured, 'HOME_FEATURED package must exist');
    assert.strictEqual(featured!.durationDays, 7, 'Duration must be 7 days');
    assert.strictEqual(featured!.pointsCost, 600, 'Cost must be 600 points');
    assert.strictEqual(featured!.isActive, true, 'Must be active');
    assert.deepStrictEqual(featured!.placementScope, ['HOMEPAGE']);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Strict Rental-Only Invariant Enforcement
  // --------------------------------------------------------------------------
  await t.test('2. Rejects promotion draft for non-rental (FOR_SALE) listing', async () => {
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId: listingSaleId,
          packageId: 'PKG_HOME_FEATURED_7D',
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /FORBIDDEN_SALE_LISTING/);
        assert.match(err.message, /Buy\/sell workflows remain disabled/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 3: Unauthorized Roles Rejected
  // --------------------------------------------------------------------------
  await t.test('3. Rejects promotion draft creation by unauthorized roles (e.g. TENANT)', async () => {
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId: listingRentalId,
          packageId: 'PKG_HOME_FEATURED_7D',
          actorUserId: tenantId,
          actorRoles: ['TENANT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /FORBIDDEN_ROLE/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 4: Unauthorized Property Access Rejected
  // --------------------------------------------------------------------------
  await t.test('4. Rejects owner attempting to promote a property they do not own', async () => {
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId: listingRentalId,
          packageId: 'PKG_HOME_FEATURED_7D',
          actorUserId: strangerId,
          actorRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_PROPERTY_ACCESS/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 5: Successful DRAFT Campaign Creation Without Points Reservation
  // --------------------------------------------------------------------------
  let draftCampaign: any = null;
  await t.test('5. Authorized owner creates DRAFT campaign with snapshotted package; 0 points reserved', async () => {
    // Check initial owner wallet state
    const walletBefore = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(walletBefore.reservedTotal, 0, 'Reserved balance must initially be 0');

    draftCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_HOME_FEATURED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    createdCampaignIds.push(draftCampaign.id);

    assert.ok(draftCampaign.id, 'Campaign ID must be generated');
    assert.strictEqual(draftCampaign.status, 'DRAFT', 'Status must be DRAFT');
    assert.strictEqual(draftCampaign.packageId, 'PKG_HOME_FEATURED_7D');
    assert.strictEqual(draftCampaign.pointsCost, 600, 'Must snapshot 600 points');
    assert.strictEqual(draftCampaign.durationDays, 7, 'Must snapshot 7 days');
    assert.strictEqual(draftCampaign.campaignType, 'HOME_FEATURED');
    assert.deepStrictEqual(draftCampaign.placementScope, ['HOMEPAGE']);
    assert.strictEqual(draftCampaign.requesterUserId, ownerId);
    assert.strictEqual(draftCampaign.payerUserId, ownerId);
    assert.strictEqual(draftCampaign.consentStatus, 'NOT_REQUIRED', 'Owner request has NOT_REQUIRED consent');
    assert.strictEqual(draftCampaign.reservationTransactionId, null, 'Must have 0 reservation tx in DRAFT');

    // Confirm wallet balance remained completely untouched
    const walletAfter = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(walletAfter.reservedTotal, 0, 'Wallet reserved points must remain 0 after DRAFT creation');
  });

  // --------------------------------------------------------------------------
  // TEST 6: Owner Consent Determination for Non-Owner (Agent) Requester
  // --------------------------------------------------------------------------
  await t.test('6. Agent requesting campaign for owner property sets consentStatus to REQUESTED', async () => {
    // Give agent publisher rights on this rental listing for testing
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));

    const agentCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: ownerId, // Agent designates owner as payer
    });

    createdCampaignIds.push(agentCampaign.id);

    assert.strictEqual(agentCampaign.status, 'DRAFT');
    assert.strictEqual(agentCampaign.requesterUserId, agentId);
    assert.strictEqual(agentCampaign.payerUserId, ownerId);
    assert.strictEqual(agentCampaign.consentStatus, 'REQUESTED', 'Agent request must require owner consent');

    // Reset publisher to owner
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));
  });

  // --------------------------------------------------------------------------
  // TEST 7: Insufficient Available Points Rejection on Submission
  // --------------------------------------------------------------------------
  await t.test('7. Submission fails and rolls back atomically when payer has insufficient points', async () => {
    // Owner wallet has 0 points currently
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.ok(wallet.availableTotal < draftCampaign.pointsCost, 'Wallet should have < 600 points');

    await assert.rejects(
      async () => {
        await promotionCampaignService.submitCampaign({
          campaignId: draftCampaign.id,
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INSUFFICIENT_AVAILABLE_POINTS/);
        return true;
      }
    );

    // Verify campaign status remained DRAFT and no reservation occurred
    const [persisted] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, draftCampaign.id));
    assert.strictEqual(persisted.status, 'DRAFT', 'Campaign status must remain DRAFT on failure');
    assert.strictEqual(persisted.reservationTransactionId, null, 'Reservation transaction ID must remain null');
  });

  // --------------------------------------------------------------------------
  // TEST 8: Requester vs Payer Separation & Payer Authorization Guard
  // --------------------------------------------------------------------------
  await t.test('8. Rejects submission by non-payer attempting to charge designated payer points', async () => {
    // Fund owner's wallet with points
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'EARNED',
      reason: 'Fund owner wallet for promotion test',
    });

    // Create a draft where agent is requester and owner is payer
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: ownerId,
    });
    createdCampaignIds.push(agentDraft.id);
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));

    // Agent attempts to submit and reserve Owner's points without Owner authorization
    await assert.rejects(
      async () => {
        await promotionCampaignService.submitCampaign({
          campaignId: agentDraft.id,
          actorUserId: agentId, // Not the payer!
          actorRoles: ['AGENT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_PAYER/);
        return true;
      }
    );

    // Verify Owner's points were NOT reserved
    const ownerWallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(ownerWallet.reservedTotal, 0, 'Owner points must NOT be reserved by third-party request');
  });

  // --------------------------------------------------------------------------
  // TEST 9: Successful Campaign Submission and Atomic Points Reservation
  // --------------------------------------------------------------------------
  let submittedResult: any = null;
  await t.test('9. Authorized payer submits campaign: points reserved, status transitions to SUBMITTED', async () => {
    // Payer is ownerId, owner has 1000 points available, cost is 600 points
    submittedResult = await promotionCampaignService.submitCampaign({
      campaignId: draftCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    assert.strictEqual(submittedResult.idempotentReplay, false, 'Initial submission is not a replay');
    assert.strictEqual(submittedResult.campaign.status, 'SUBMITTED', 'Status must transition to SUBMITTED');
    assert.ok(submittedResult.campaign.reservationTransactionId, 'Must have reservation transaction ID');

    // Verify wallet balance: total balance remains 1000, reserved increases to 600, available drops to 400
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(wallet.totalBalance, 1000, 'Total balance remains unchanged during reservation');
    assert.strictEqual(wallet.reservedTotal, 600, 'Reserved total must be 600');
    assert.strictEqual(wallet.availableTotal, 400, 'Available total must be 400 (1000 - 600)');

    // Verify points_transactions row
    const [tx] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, submittedResult.campaign.reservationTransactionId));
    assert.ok(tx, 'Ledger transaction must exist');
    assert.strictEqual(tx.type, 'RESERVED');
    assert.strictEqual(tx.amount, 600);
    assert.strictEqual(tx.referenceType, 'PROMOTION_CAMPAIGN');
    assert.strictEqual(tx.referenceId, draftCampaign.id);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Idempotent Submission Handling
  // --------------------------------------------------------------------------
  await t.test('10. Repeated submission is idempotent and does not double-reserve points', async () => {
    const replayResult = await promotionCampaignService.submitCampaign({
      campaignId: draftCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    assert.strictEqual(replayResult.idempotentReplay, true, 'Second submission must return idempotentReplay: true');
    assert.strictEqual(replayResult.campaign.status, 'SUBMITTED');

    // Confirm wallet balances are still exactly 600 reserved and 400 available (NO double-reservation)
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(wallet.reservedTotal, 600, 'Reserved total must remain 600 without double-reservation');
    assert.strictEqual(wallet.availableTotal, 400, 'Available total must remain 400');
  });

  // --------------------------------------------------------------------------
  // TEST 11: Trigger 0030 Append-Only Ledger Compliance
  // --------------------------------------------------------------------------
  await t.test('11. Trigger 0030: Direct UPDATE or DELETE on points_transactions fails closed', async () => {
    const txId = submittedResult.campaign.reservationTransactionId;
    assert.ok(txId, 'Transaction ID must exist');

    // Attempt direct UPDATE on points_transactions
    await assert.rejects(
      async () => {
        await pool.query('UPDATE points_transactions SET notes = $1 WHERE id = $2', ['malicious mutation', txId]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000', 'PostgreSQL error code must be 55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );

    // Attempt direct DELETE on points_transactions
    await assert.rejects(
      async () => {
        await pool.query('DELETE FROM points_transactions WHERE id = $1', [txId]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000', 'PostgreSQL error code must be 55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 12: Separation of Concerns (Zero Fee or Lease Contamination)
  // --------------------------------------------------------------------------
  await t.test('12. Promotions and points operations produce 0 rent schedules, leases, or fee ledger entries', async () => {
    // Check commissions / ledgerLines
    const feeRecords = await (db as any).execute(
      sql`SELECT count(*) as cnt FROM commissions WHERE payment_record_id = ${draftCampaign.id}`
    );
    const count = Number(feeRecords.rows?.[0]?.cnt || 0);
    assert.strictEqual(count, 0, 'No commissions or 3-fee records must be generated for campaigns');
  });

  // --------------------------------------------------------------------------
  // TEST 13: Owner Can Grant Consent Only For Their Own Property
  // --------------------------------------------------------------------------
  let agentCampaignForConsent: any = null;
  await t.test('13. Owner can grant consent only for their own property', async () => {
    // Fund agent wallet with points
    await pointsEngine.adminAdjustPoints({
      targetUserId: agentId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund agent wallet for consent tests',
    });

    // Temporarily make agent the publisher to create a draft for rental listing
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));

    agentCampaignForConsent = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: agentId,
    });
    createdCampaignIds.push(agentCampaignForConsent.id);

    // Reset publisher
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));

    assert.strictEqual(agentCampaignForConsent.consentStatus, 'REQUESTED');

    // Attempt grant consent by stranger (owner of different property)
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: agentCampaignForConsent.id,
          actorUserId: strangerId,
          actorRoles: ['PROPERTY_OWNER'],
          notes: 'Stranger trying to grant consent',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_OWNER_CONSENT/);
        return true;
      }
    );

    // Attempt grant consent by non-owner agent (requester)
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: agentCampaignForConsent.id,
          actorUserId: agentId,
          actorRoles: ['AGENT'],
          notes: 'Agent trying to grant consent for owner',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_OWNER_CONSENT/);
        return true;
      }
    );

    // Valid owner grants consent
    const consentResult = await promotionCampaignService.grantOwnerConsent({
      campaignId: agentCampaignForConsent.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      notes: 'Owner approves agent promotion request',
    });

    assert.strictEqual(consentResult.idempotentReplay, false);
    assert.strictEqual(consentResult.campaign.consentStatus, 'GRANTED');
    assert.strictEqual(consentResult.campaign.consentGrantedByUserId, ownerId);
    assert.ok(consentResult.campaign.consentGrantedAt);
    assert.strictEqual(consentResult.campaign.consentNotes, 'Owner approves agent promotion request');

    // Repeated call is idempotent
    const replayResult = await promotionCampaignService.grantOwnerConsent({
      campaignId: agentCampaignForConsent.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      notes: 'Repeat consent attempt',
    });

    assert.strictEqual(replayResult.idempotentReplay, true);
    assert.strictEqual(replayResult.campaign.consentStatus, 'GRANTED');
  });

  // --------------------------------------------------------------------------
  // TEST 14: Non-Owner Requester or Agent Cannot Grant Consent for Owner
  // --------------------------------------------------------------------------
  await t.test('14. Non-owner requester or agent cannot grant consent for the owner', async () => {
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));
    const pendingCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: agentId,
    });
    createdCampaignIds.push(pendingCampaign.id);
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));

    assert.strictEqual(pendingCampaign.consentStatus, 'REQUESTED');

    // Requester agent attempts grant
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: pendingCampaign.id,
          actorUserId: agentId,
          actorRoles: ['AGENT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_OWNER_CONSENT/);
        return true;
      }
    );

    // Tenant attempts grant
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: pendingCampaign.id,
          actorUserId: tenantId,
          actorRoles: ['TENANT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_OWNER_CONSENT/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 15: Admin Approval Blocked When Required Consent Missing
  // --------------------------------------------------------------------------
  let submittedPendingConsentCampaign: any = null;
  await t.test('15. Admin approval is rejected when required consent is missing', async () => {
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));
    const draftNeedsConsent = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: agentId,
    });
    createdCampaignIds.push(draftNeedsConsent.id);
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));

    assert.strictEqual(draftNeedsConsent.consentStatus, 'REQUESTED');

    // Agent submits campaign; points reserved
    const submitResult = await promotionCampaignService.submitCampaign({
      campaignId: draftNeedsConsent.id,
      actorUserId: agentId,
      actorRoles: ['AGENT'],
    });

    submittedPendingConsentCampaign = submitResult.campaign;
    assert.strictEqual(submittedPendingConsentCampaign.status, 'SUBMITTED');
    assert.strictEqual(submittedPendingConsentCampaign.consentStatus, 'REQUESTED');
    assert.ok(submittedPendingConsentCampaign.reservationTransactionId);

    // Admin attempts to approve while consent is still REQUESTED
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: submittedPendingConsentCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /OWNER_CONSENT_REQUIRED/);
        return true;
      }
    );

    // Confirm campaign remains in SUBMITTED state
    const [c] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, submittedPendingConsentCampaign.id));
    assert.strictEqual(c.status, 'SUBMITTED');
  });

  // --------------------------------------------------------------------------
  // TEST 16: Owner Can Deny Consent, Cancelling Campaign and Releasing Points
  // --------------------------------------------------------------------------
  await t.test('16. Owner can deny consent; campaign cannot proceed to approval and reserved points are released', async () => {
    const campaignId = submittedPendingConsentCampaign.id;

    // Check agent wallet reserved balance before denial
    const walletBefore = await pointsEngine.getOrCreateWallet(agentId);
    assert.ok(walletBefore.reservedTotal >= 300, 'Agent points must currently be reserved');

    // Non-owner stranger attempts to deny consent
    await assert.rejects(
      async () => {
        await promotionCampaignService.denyOwnerConsent({
          campaignId,
          actorUserId: strangerId,
          actorRoles: ['PROPERTY_OWNER'],
          reason: 'I do not want this',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_OWNER_CONSENT/);
        return true;
      }
    );

    // Denial requires meaningful reason
    await assert.rejects(
      async () => {
        await promotionCampaignService.denyOwnerConsent({
          campaignId,
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
          reason: '  ',
        });
      },
      (err: any) => {
        assert.match(err.message, /MANDATORY_REASON_REQUIRED/);
        return true;
      }
    );

    // Verified owner denies consent
    const denyResult = await promotionCampaignService.denyOwnerConsent({
      campaignId,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      reason: 'Property is undergoing maintenance, no promotions allowed',
    });

    assert.strictEqual(denyResult.idempotentReplay, false);
    assert.strictEqual(denyResult.campaign.consentStatus, 'REJECTED');
    assert.strictEqual(denyResult.campaign.status, 'CANCELLED');
    assert.strictEqual(denyResult.campaign.consentNotes, 'Property is undergoing maintenance, no promotions allowed');

    // Verify points were released back to agent wallet
    const walletAfter = await pointsEngine.getOrCreateWallet(agentId);
    assert.strictEqual(walletAfter.reservedTotal, walletBefore.reservedTotal - 500);
    assert.strictEqual(walletAfter.availableTotal, walletBefore.availableTotal + 500);

    // Repeated denial is idempotent and does not double-release
    const replayDeny = await promotionCampaignService.denyOwnerConsent({
      campaignId,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      reason: 'Property is undergoing maintenance, no promotions allowed',
    });
    assert.strictEqual(replayDeny.idempotentReplay, true);

    const walletAfterReplay = await pointsEngine.getOrCreateWallet(agentId);
    assert.strictEqual(walletAfterReplay.availableTotal, walletAfter.availableTotal, 'No double-release of points on repeat denial');

    // Admin attempts to approve cancelled campaign: must fail
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 17: Non-Admin Approval and Rejection Attempts Are Denied
  // --------------------------------------------------------------------------
  await t.test('17. Non-admin approval and rejection attempts are denied', async () => {
    // Unauthenticated caller
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: submittedResult.campaign.id,
          adminUserId: '',
          adminRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHENTICATED/);
        return true;
      }
    );

    // Property Owner caller
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: submittedResult.campaign.id,
          adminUserId: ownerId,
          adminRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );

    // Agent caller
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: submittedResult.campaign.id,
          adminUserId: agentId,
          adminRoles: ['AGENT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );

    // Tenant caller
    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: submittedResult.campaign.id,
          adminUserId: tenantId,
          adminRoles: ['TENANT'],
          reason: 'Tenants cannot moderate',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );

    // Owner attempting rejection
    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: submittedResult.campaign.id,
          adminUserId: ownerId,
          adminRoles: ['PROPERTY_OWNER'],
          reason: 'Owner cannot administer rejection',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 18: Valid Admin Approval Records Decision and Actor
  // --------------------------------------------------------------------------
  await t.test('18. Valid admin approval records moderation decision and actor without premature activation', async () => {
    // Approve submittedResult.campaign (owner requested, consent NOT_REQUIRED, points reserved)
    const approveResult = await promotionCampaignService.approveCampaign({
      campaignId: submittedResult.campaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      notes: 'Listing details and images conform to quality guidelines',
    });

    assert.strictEqual(approveResult.idempotentReplay, false);
    assert.strictEqual(approveResult.campaign.status, 'APPROVED');
    assert.strictEqual(approveResult.campaign.moderatedByAdminId, adminId);
    assert.strictEqual(approveResult.campaign.moderationDecision, 'APPROVED');
    assert.strictEqual(approveResult.campaign.moderationReason, 'Listing details and images conform to quality guidelines');
    assert.ok(approveResult.campaign.moderatedAt);

    // Reserved points MUST remain safely RESERVED (not prematurely spent)
    const wallet = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(wallet.reservedTotal, 600, 'Points remain reserved upon approval; not spent yet');
    assert.strictEqual(approveResult.campaign.spendTransactionId, null, 'No spend transaction on approval');

    // Repeated approval is idempotent
    const replayApprove = await promotionCampaignService.approveCampaign({
      campaignId: submittedResult.campaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      notes: 'Second approval attempt',
    });

    assert.strictEqual(replayApprove.idempotentReplay, true);
    assert.strictEqual(replayApprove.campaign.status, 'APPROVED');
  });

  // --------------------------------------------------------------------------
  // TEST 19: Rejection Requires a Meaningful Reason
  // --------------------------------------------------------------------------
  await t.test('19. Rejection requires a meaningful, non-empty moderation reason (>= 5 chars)', async () => {
    // Top up owner wallet so owner has sufficient available balance
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'EARNED',
      reason: 'Fund owner wallet for rejection reason test',
    });

    const testCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(testCampaign.id);

    await promotionCampaignService.submitCampaign({
      campaignId: testCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    // Empty reason
    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: testCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
          reason: '',
        });
      },
      (err: any) => {
        assert.match(err.message, /MANDATORY_REASON_REQUIRED/);
        return true;
      }
    );

    // Whitespace only
    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: testCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
          reason: '   ',
        });
      },
      (err: any) => {
        assert.match(err.message, /MANDATORY_REASON_REQUIRED/);
        return true;
      }
    );

    // Under 5 chars
    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: testCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
          reason: 'bad',
        });
      },
      (err: any) => {
        assert.match(err.message, /MANDATORY_REASON_REQUIRED/);
        return true;
      }
    );

    // Campaign must remain SUBMITTED
    const [c] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, testCampaign.id));
    assert.strictEqual(c.status, 'SUBMITTED');
  });

  // --------------------------------------------------------------------------
  // TEST 20: Rejection Releases Points and Preserves Earned vs Purchased Split
  // --------------------------------------------------------------------------
  let rejectedCampaignWithSplit: any = null;
  let splitReleaseTxId: string = '';
  await t.test('20. Rejection releases reserved points to original payer and preserves earned-versus-purchased split', async () => {
    // Setup split wallet: 200 EARNED + 500 PURCHASED = 700 total points
    await pointsEngine.adminAdjustPoints({
      targetUserId: splitPayerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 200,
      direction: 'CREDIT',
      source: 'EARNED',
      reason: 'Fund split payer earned points',
    });

    await pointsEngine.adminAdjustPoints({
      targetUserId: splitPayerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 500,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund split payer purchased points',
    });

    const initialWallet = await pointsEngine.getOrCreateWallet(splitPayerId);
    assert.strictEqual(initialWallet.earnedBalance, 200);
    assert.strictEqual(initialWallet.purchasedBalance, 500);
    assert.strictEqual(initialWallet.availableTotal, 700);

    // Create draft campaign for PKG_SPONSORED_SEARCH_7D (cost: 500 points)
    const splitCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingSplitRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: splitPayerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(splitCampaign.id);

    // Submit campaign: points allocated 200 EARNED + 300 PURCHASED = 500
    const submitResult = await promotionCampaignService.submitCampaign({
      campaignId: splitCampaign.id,
      actorUserId: splitPayerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    assert.strictEqual(submitResult.campaign.status, 'SUBMITTED');

    // Inspect reservation transaction
    const [resTx] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, submitResult.campaign.reservationTransactionId!));
    assert.strictEqual(resTx.type, 'RESERVED');
    assert.strictEqual(resTx.sourceType, 'MIXED');
    assert.strictEqual(resTx.reservedEarnedDelta, 200, 'All 200 earned points reserved first');
    assert.strictEqual(resTx.reservedPurchasedDelta, 300, 'Remaining 300 points reserved from purchased');

    const walletDuringRes = await pointsEngine.getOrCreateWallet(splitPayerId);
    assert.strictEqual(walletDuringRes.reservedEarnedBalance, 200);
    assert.strictEqual(walletDuringRes.reservedPurchasedBalance, 300);
    assert.strictEqual(walletDuringRes.availableTotal, 200);

    // Admin rejects campaign
    const rejectResult = await promotionCampaignService.rejectCampaign({
      campaignId: splitCampaign.id,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      reason: 'Title contains misleading marketing claims',
    });

    rejectedCampaignWithSplit = rejectResult.campaign;
    assert.strictEqual(rejectResult.idempotentReplay, false);
    assert.strictEqual(rejectedCampaignWithSplit.status, 'REJECTED');
    assert.strictEqual(rejectedCampaignWithSplit.moderatedByAdminId, adminId);
    assert.strictEqual(rejectedCampaignWithSplit.moderationDecision, 'REJECTED');
    assert.strictEqual(rejectedCampaignWithSplit.moderationReason, 'Title contains misleading marketing claims');
    assert.ok(rejectedCampaignWithSplit.moderatedAt);

    // Query RELEASED points_transaction
    const [releaseTx] = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.referenceId, splitCampaign.id),
          eq(pointsTransactions.type, 'RELEASED')
        )
      );

    assert.ok(releaseTx, 'RELEASED ledger transaction must exist');
    splitReleaseTxId = releaseTx.id;
    assert.strictEqual(releaseTx.amount, 500);
    assert.strictEqual(releaseTx.sourceType, 'MIXED');
    assert.strictEqual(releaseTx.reservedEarnedDelta, -200, 'Must release exact -200 earned reserved delta');
    assert.strictEqual(releaseTx.reservedPurchasedDelta, -300, 'Must release exact -300 purchased reserved delta');
    assert.strictEqual(releaseTx.earnedDelta, 0, 'No net change to earned balance');
    assert.strictEqual(releaseTx.purchasedDelta, 0, 'No net change to purchased balance');
    assert.strictEqual(releaseTx.totalBalanceAfter, 700);
    assert.strictEqual(releaseTx.availableBalanceAfter, 700);

    // Check wallet balances restored byte-for-byte
    const walletAfterRelease = await pointsEngine.getOrCreateWallet(splitPayerId);
    assert.strictEqual(walletAfterRelease.reservedEarnedBalance, 0);
    assert.strictEqual(walletAfterRelease.reservedPurchasedBalance, 0);
    assert.strictEqual(walletAfterRelease.earnedBalance, 200, 'Original 200 earned balance restored');
    assert.strictEqual(walletAfterRelease.purchasedBalance, 500, 'Original 500 purchased balance restored');
    assert.strictEqual(walletAfterRelease.availableTotal, 700);
    assert.strictEqual(walletAfterRelease.totalBalance, 700);
  });

  // --------------------------------------------------------------------------
  // TEST 21: Idempotent Rejection Cannot Double-Release Points
  // --------------------------------------------------------------------------
  await t.test('21. Repeated rejection is idempotent and cannot double-release points', async () => {
    const replayReject = await promotionCampaignService.rejectCampaign({
      campaignId: rejectedCampaignWithSplit.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      reason: 'Repeat rejection attempt',
    });

    assert.strictEqual(replayReject.idempotentReplay, true);
    assert.strictEqual(replayReject.campaign.status, 'REJECTED');

    // Confirm only 1 RELEASED transaction exists in the entire ledger
    const releaseTxs = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.referenceId, rejectedCampaignWithSplit.id),
          eq(pointsTransactions.type, 'RELEASED')
        )
      );

    assert.strictEqual(releaseTxs.length, 1, 'Exactly one RELEASED ledger transaction must exist');

    // Confirm wallet balances remain 700 available and 0 reserved
    const wallet = await pointsEngine.getOrCreateWallet(splitPayerId);
    assert.strictEqual(wallet.availableTotal, 700);
    assert.strictEqual(wallet.reservedTotal, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 22: Moderation Queue Query
  // --------------------------------------------------------------------------
  await t.test('22. Moderation queue query returns pending submitted campaigns to admin only', async () => {
    // Non-admin callers denied
    await assert.rejects(
      async () => {
        await promotionCampaignService.getModerationQueue(tenantId, ['TENANT']);
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await promotionCampaignService.getModerationQueue(ownerId, ['PROPERTY_OWNER']);
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );

    // Admin query
    const queue = await promotionCampaignService.getModerationQueue(adminId, ['ADMIN']);
    assert.ok(Array.isArray(queue));
    for (const c of queue) {
      assert.strictEqual(c.status, 'SUBMITTED', 'Queue must only contain SUBMITTED campaigns');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 23: Transactional Atomicity on Audit Failure
  // --------------------------------------------------------------------------
  await t.test('23. Transactional atomicity: failed audit writes roll back status and points release together', async () => {
    // Top up owner wallet for atomicity test
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'EARNED',
      reason: 'Fund owner wallet for atomicity test',
    });

    // 1. Rollback on rejection
    const rollbackCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(rollbackCampaign.id);

    await promotionCampaignService.submitCampaign({
      campaignId: rollbackCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    const ownerWalletBefore = await pointsEngine.getOrCreateWallet(ownerId);

    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: rollbackCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
          reason: 'Violates terms and conditions',
          simulateAuditFailure: true,
        });
      },
      (err: any) => {
        assert.match(err.message, /SIMULATED_AUDIT_FAILURE/);
        return true;
      }
    );

    // Confirm campaign status is STILL SUBMITTED
    const [cAfterRollback] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, rollbackCampaign.id));
    assert.strictEqual(cAfterRollback.status, 'SUBMITTED', 'Campaign must remain SUBMITTED after rollback');
    assert.strictEqual(cAfterRollback.moderationDecision, null);

    // Confirm points remain RESERVED (NOT released)
    const ownerWalletAfter = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(ownerWalletAfter.reservedTotal, ownerWalletBefore.reservedTotal);

    // 0 RELEASED transactions for this campaign
    const releasedList = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.referenceId, rollbackCampaign.id),
          eq(pointsTransactions.type, 'RELEASED')
        )
      );
    assert.strictEqual(releasedList.length, 0, 'No RELEASED transaction persisted after rollback');

    // 2. Rollback on approval
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: rollbackCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
          simulateAuditFailure: true,
        });
      },
      (err: any) => {
        assert.match(err.message, /SIMULATED_AUDIT_FAILURE/);
        return true;
      }
    );

    const [cAfterApproveRollback] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, rollbackCampaign.id));
    assert.strictEqual(cAfterApproveRollback.status, 'SUBMITTED', 'Status must remain SUBMITTED after approval rollback');

    // 3. Rollback on consent grant
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));
    const draftConsentRollback = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: agentId,
    });
    createdCampaignIds.push(draftConsentRollback.id);
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));

    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: draftConsentRollback.id,
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
          simulateAuditFailure: true,
        });
      },
      (err: any) => {
        assert.match(err.message, /SIMULATED_AUDIT_FAILURE/);
        return true;
      }
    );

    const [cConsentAfterRollback] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, draftConsentRollback.id));
    assert.strictEqual(cConsentAfterRollback.consentStatus, 'REQUESTED', 'Consent status must remain REQUESTED after rollback');
  });

  // --------------------------------------------------------------------------
  // TEST 24: Trigger 0030: Released Points Transactions Append-Only Compliance
  // --------------------------------------------------------------------------
  await t.test('24. Trigger 0030: Released points ledger transactions are strictly append-only', async () => {
    assert.ok(splitReleaseTxId, 'Must have a RELEASED transaction ID from test 20');

    // Attempt direct UPDATE on RELEASED transaction
    await assert.rejects(
      async () => {
        await pool.query('UPDATE points_transactions SET notes = $1 WHERE id = $2', ['tamper notes', splitReleaseTxId]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000', 'PostgreSQL error code must be 55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );

    // Attempt direct DELETE on RELEASED transaction
    await assert.rejects(
      async () => {
        await pool.query('DELETE FROM points_transactions WHERE id = $1', [splitReleaseTxId]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000', 'PostgreSQL error code must be 55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 25: Rewards & 3-Fee Model Isolation
  // --------------------------------------------------------------------------
  await t.test('25. Rewards system, 3-fee financial model, and lease accounting remain completely unaffected', async () => {
    // 1. Verify points_reward_rules table remains intact and functional
    const rules = await db.select().from(pointsRewardRules);
    assert.ok(rules.length >= 3, 'Reward rules must exist and remain configured');

    // 2. Perform an earned reward grant to confirm reward engine operationality
    const rewardResult = await pointsEngine.grantRewardPoints({
      userId: ownerId,
      userRoles: ['PROPERTY_OWNER'],
      ruleKey: 'OWNER_FIRST_LISTING',
      referenceEventId: `evt_reward_test_${runId}`,
      notes: 'Regression test: Rewards engine remains completely intact',
    });

    assert.strictEqual(rewardResult.wallet.earnedBalance > 0, true);
    assert.strictEqual(rewardResult.transaction.sourceType, 'EARNED');

    // 3. Confirm 0 contamination with leases, rent payments, commissions, or 3-fee records
    const commissionsCheck = await (db as any).execute(
      sql`SELECT count(*) as cnt FROM commissions WHERE payment_record_id IN (${sql.join(
        createdCampaignIds.length > 0 ? createdCampaignIds.map((id) => sql`${id}`) : [sql`'none'`],
        sql`, `
      )})`
    );
    const commCount = Number(commissionsCheck.rows?.[0]?.cnt || 0);
    assert.strictEqual(commCount, 0, 'Zero commissions generated across all campaigns');

    const leasesCheck = await (db as any).execute(
      sql`SELECT count(*) as cnt FROM leases WHERE property_id IN (${propRentalId}, ${propSplitRentalId})`
    );
    const leaseCount = Number(leasesCheck.rows?.[0]?.cnt || 0);
    assert.strictEqual(leaseCount, 0, 'Zero leases generated across campaign tests');
  });

  // --------------------------------------------------------------------------
  // TEST 26: Owner Denies Consent While Campaign Is DRAFT
  // --------------------------------------------------------------------------
  let draftDeniedCampaign: any = null;
  await t.test('26. Owner denies consent while campaign is DRAFT: status becomes CANCELLED with 0 points reserved or released', async () => {
    await db.update(listings).set({ publisherUserId: agentId }).where(eq(listings.id, listingRentalId));
    draftDeniedCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: agentId,
      actorRoles: ['AGENT'],
      payerUserId: agentId,
    });
    createdCampaignIds.push(draftDeniedCampaign.id);
    await db.update(listings).set({ publisherUserId: ownerId }).where(eq(listings.id, listingRentalId));

    assert.strictEqual(draftDeniedCampaign.status, 'DRAFT');
    assert.strictEqual(draftDeniedCampaign.consentStatus, 'REQUESTED');
    assert.strictEqual(draftDeniedCampaign.reservationTransactionId, null);

    const agentWalletBefore = await pointsEngine.getOrCreateWallet(agentId);

    // Verified owner denies consent while still in DRAFT
    const denyResult = await promotionCampaignService.denyOwnerConsent({
      campaignId: draftDeniedCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      reason: 'Photos violate property quality standards',
    });

    assert.strictEqual(denyResult.idempotentReplay, false);
    assert.strictEqual(denyResult.campaign.consentStatus, 'REJECTED');
    assert.strictEqual(denyResult.campaign.status, 'CANCELLED');
    assert.strictEqual(denyResult.campaign.consentNotes, 'Photos violate property quality standards');

    // Confirm wallet balances remain completely unchanged (0 debited, 0 credited, 0 reserved)
    const agentWalletAfter = await pointsEngine.getOrCreateWallet(agentId);
    assert.strictEqual(agentWalletAfter.reservedTotal, agentWalletBefore.reservedTotal);
    assert.strictEqual(agentWalletAfter.availableTotal, agentWalletBefore.availableTotal);
    assert.strictEqual(agentWalletAfter.totalBalance, agentWalletBefore.totalBalance);

    // Confirm 0 ledger entries were created for this campaign
    const txCount = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.referenceId, draftDeniedCampaign.id));
    assert.strictEqual(txCount.length, 0, 'No points_transactions rows must exist for unreserved draft denial');

    // Idempotent repeat denial
    const replayResult = await promotionCampaignService.denyOwnerConsent({
      campaignId: draftDeniedCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      reason: 'Photos violate property quality standards',
    });
    assert.strictEqual(replayResult.idempotentReplay, true);
    assert.strictEqual(replayResult.campaign.consentStatus, 'REJECTED');
  });

  // --------------------------------------------------------------------------
  // TEST 27: Submitting Campaign With Denied Owner Consent Fails Before Reserving Points
  // --------------------------------------------------------------------------
  await t.test('27. Submitting a campaign with denied owner consent fails before reserving or debiting points', async () => {
    const agentWalletBefore = await pointsEngine.getOrCreateWallet(agentId);

    await assert.rejects(
      async () => {
        await promotionCampaignService.submitCampaign({
          campaignId: draftDeniedCampaign.id,
          actorUserId: agentId,
          actorRoles: ['AGENT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /OWNER_CONSENT_DENIED/);
        return true;
      }
    );

    // Confirm agent wallet balances remained 100% untouched
    const agentWalletAfter = await pointsEngine.getOrCreateWallet(agentId);
    assert.strictEqual(agentWalletAfter.reservedTotal, agentWalletBefore.reservedTotal);
    assert.strictEqual(agentWalletAfter.availableTotal, agentWalletBefore.availableTotal);
    assert.strictEqual(agentWalletAfter.totalBalance, agentWalletBefore.totalBalance);

    // Confirm campaign remains in CANCELLED status with null reservation ID
    const [c] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, draftDeniedCampaign.id));
    assert.strictEqual(c.status, 'CANCELLED');
    assert.strictEqual(c.consentStatus, 'REJECTED');
    assert.strictEqual(c.reservationTransactionId, null);
  });

  // --------------------------------------------------------------------------
  // TEST 28: Admin Approval Is Blocked When Owner Consent Is Denied
  // --------------------------------------------------------------------------
  await t.test('28. Admin approval cannot bypass rejected owner consent', async () => {
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: draftDeniedCampaign.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE|OWNER_CONSENT_DENIED/);
        return true;
      }
    );

    // Owner cannot grant consent after denial (denial is terminal)
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: draftDeniedCampaign.id,
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
          notes: 'Attempting to re-grant after denial',
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE|INVALID_CONSENT_STATE/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TEST 29: Rejecting DRAFT Campaign With No Reservation Touches No Points
  // --------------------------------------------------------------------------
  let draftRejectedCampaign: any = null;
  await t.test('29. Rejecting a DRAFT campaign with no reservation updates status atomically without phantom releases or balance changes', async () => {
    // Create clean DRAFT campaign
    draftRejectedCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draftRejectedCampaign.id);

    assert.strictEqual(draftRejectedCampaign.status, 'DRAFT');
    assert.strictEqual(draftRejectedCampaign.reservationTransactionId, null);

    const ownerWalletBefore = await pointsEngine.getOrCreateWallet(ownerId);

    // Admin rejects DRAFT campaign
    const rejectResult = await promotionCampaignService.rejectCampaign({
      campaignId: draftRejectedCampaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      reason: 'Draft listing description contains external commercial links',
    });

    assert.strictEqual(rejectResult.idempotentReplay, false);
    assert.strictEqual(rejectResult.campaign.status, 'REJECTED');
    assert.strictEqual(rejectResult.campaign.moderatedByAdminId, adminId);
    assert.strictEqual(rejectResult.campaign.moderationDecision, 'REJECTED');
    assert.strictEqual(rejectResult.campaign.moderationReason, 'Draft listing description contains external commercial links');
    assert.ok(rejectResult.campaign.moderatedAt);

    // Confirm wallet balances are 100% untouched
    const ownerWalletAfter = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(ownerWalletAfter.reservedTotal, ownerWalletBefore.reservedTotal);
    assert.strictEqual(ownerWalletAfter.availableTotal, ownerWalletBefore.availableTotal);
    assert.strictEqual(ownerWalletAfter.totalBalance, ownerWalletBefore.totalBalance);

    // Confirm ZERO points_transactions rows exist for this campaign
    const txRows = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.referenceId, draftRejectedCampaign.id));
    assert.strictEqual(txRows.length, 0, 'No points_transactions records must be created for unreserved draft rejection');

    // Repeated rejection is idempotent and creates 0 ledger records
    const replayReject = await promotionCampaignService.rejectCampaign({
      campaignId: draftRejectedCampaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      reason: 'Draft listing description contains external commercial links',
    });
    assert.strictEqual(replayReject.idempotentReplay, true);
    assert.strictEqual(replayReject.campaign.status, 'REJECTED');

    const txRowsAfterReplay = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.referenceId, draftRejectedCampaign.id));
    assert.strictEqual(txRowsAfterReplay.length, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 30: Unreserved DRAFT Rejection Rollback on Audit Failure
  // --------------------------------------------------------------------------
  await t.test('30. Failed audit write on unreserved DRAFT rejection rolls back campaign status cleanly', async () => {
    const draftRollback = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draftRollback.id);

    assert.strictEqual(draftRollback.status, 'DRAFT');

    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: draftRollback.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
          reason: 'Non-compliant listing terms',
          simulateAuditFailure: true,
        });
      },
      (err: any) => {
        assert.match(err.message, /SIMULATED_AUDIT_FAILURE/);
        return true;
      }
    );

    // Confirm status rolled back to DRAFT
    const [persisted] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, draftRollback.id));
    assert.strictEqual(persisted.status, 'DRAFT');
    assert.strictEqual(persisted.moderatedByAdminId, null);
    assert.strictEqual(persisted.moderationDecision, null);
  });

  // --------------------------------------------------------------------------
  // TEST 31: Activation Blocked Before Approval or Required Consent
  // --------------------------------------------------------------------------
  await t.test('31. Activation blocked before approval or required consent', async () => {
    // Top up owner wallet so submission is possible
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund owner wallet for activation tests',
    });

    // 1. DRAFT campaign cannot be activated
    const draftCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draftCampaign.id);

    await assert.rejects(
      async () => {
        await promotionCampaignService.activateCampaign({
          campaignId: draftCampaign.id,
          actorUserId: adminId,
          actorRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE.*Only APPROVED campaigns/);
        return true;
      }
    );

    // 2. SUBMITTED (unapproved) campaign cannot be activated
    const submittedCampaign = await promotionCampaignService.submitCampaign({
      campaignId: draftCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await assert.rejects(
      async () => {
        await promotionCampaignService.activateCampaign({
          campaignId: submittedCampaign.campaign.id,
          actorUserId: adminId,
          actorRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE.*Only APPROVED campaigns/);
        return true;
      }
    );

    // 3. Campaign with denied consent cannot be activated
    await assert.rejects(
      async () => {
        await promotionCampaignService.activateCampaign({
          campaignId: draftDeniedCampaign.id,
          actorUserId: adminId,
          actorRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE|OWNER_CONSENT_DENIED/);
        return true;
      }
    );

    // 4. Unauthorized non-participant non-admin cannot activate
    // First approve submittedCampaign so it is in APPROVED status
    await promotionCampaignService.approveCampaign({
      campaignId: submittedCampaign.campaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      notes: 'Approved for auth check test',
    });

    await assert.rejects(
      async () => {
        await promotionCampaignService.activateCampaign({
          campaignId: submittedCampaign.campaign.id,
          actorUserId: strangerId,
          actorRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ACCESS/);
        return true;
      }
    );

    // Verify 0 SPENT transactions were created for this campaign
    const spendTxs = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.referenceId, submittedCampaign.campaign.id),
          eq(pointsTransactions.type, 'SPENT')
        )
      );
    assert.strictEqual(spendTxs.length, 0, 'No points spent while activation is blocked');
  });

  // --------------------------------------------------------------------------
  // TEST 32: Successful Activation with Approved Duration and Snapshotted Terms
  // --------------------------------------------------------------------------
  let activatedCampaign: any = null;
  let activationStartTime: Date;
  let activationEndTime: Date;
  await t.test('32. Successful activation with the approved duration and stored snapshot terms', async () => {
    // Create new campaign
    const campaignToActivate = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(campaignToActivate.id);

    await promotionCampaignService.submitCampaign({
      campaignId: campaignToActivate.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await promotionCampaignService.approveCampaign({
      campaignId: campaignToActivate.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
      notes: 'Approved for activation test',
    });

    // Mutate the original promotion_packages table to simulate package modification after approval
    // Should NOT affect the existing approved campaign!
    await db
      .update(promotionPackages)
      .set({ durationDays: 30, pointsCost: 9999, isActive: false })
      .where(eq(promotionPackages.id, 'PKG_SPONSORED_SEARCH_7D'));

    try {
      activationStartTime = new Date('2026-11-01T12:00:00Z');
      const actResult = await promotionCampaignService.activateCampaign({
        campaignId: campaignToActivate.id,
        actorUserId: ownerId,
        actorRoles: ['PROPERTY_OWNER'],
        startTime: activationStartTime,
      });

      assert.strictEqual(actResult.idempotentReplay, false);
      assert.strictEqual(actResult.campaign.status, 'ACTIVE');
      assert.ok(actResult.campaign.spendTransactionId, 'spendTransactionId must be recorded');
      assert.strictEqual(actResult.spendTransaction?.type, 'SPENT');

      // Verify that activation used stored snapshot duration (7 days), NOT 30 days!
      const expectedEnd = new Date(activationStartTime.getTime() + 7 * 24 * 60 * 60 * 1000);
      activationEndTime = expectedEnd;
      assert.strictEqual(
        new Date(actResult.campaign.startTime!).toISOString(),
        activationStartTime.toISOString()
      );
      assert.strictEqual(
        new Date(actResult.campaign.endTime!).toISOString(),
        expectedEnd.toISOString(),
        'Duration must be exactly 7 days from snapshot, not 30 days from mutated package'
      );

      // Verify spend amount matches snapshotted pointsCost (500), not 9999
      assert.strictEqual(actResult.spendTransaction?.amount, 500);

      activatedCampaign = actResult.campaign;
    } finally {
      // Restore package table
      await db
        .update(promotionPackages)
        .set({ durationDays: 7, pointsCost: 500, isActive: true })
        .where(eq(promotionPackages.id, 'PKG_SPONSORED_SEARCH_7D'));
    }
  });

  // --------------------------------------------------------------------------
  // TEST 33: Duplicate and Concurrent Activation Attempts
  // --------------------------------------------------------------------------
  await t.test('33. Duplicate and concurrent activation attempts are idempotent and prevent double-spending', async () => {
    // 1. Sequential duplicate activation replay
    const replayResult = await promotionCampaignService.activateCampaign({
      campaignId: activatedCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    assert.strictEqual(replayResult.idempotentReplay, true);
    assert.strictEqual(replayResult.campaign.status, 'ACTIVE');
    assert.strictEqual(replayResult.spendTransaction, null);

    // 2. Concurrent activation attempts
    const concurrentCampaign = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(concurrentCampaign.id);

    await promotionCampaignService.submitCampaign({
      campaignId: concurrentCampaign.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await promotionCampaignService.approveCampaign({
      campaignId: concurrentCampaign.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });

    const [res1, res2] = await Promise.all([
      promotionCampaignService.activateCampaign({
        campaignId: concurrentCampaign.id,
        actorUserId: ownerId,
        actorRoles: ['PROPERTY_OWNER'],
      }),
      promotionCampaignService.activateCampaign({
        campaignId: concurrentCampaign.id,
        actorUserId: ownerId,
        actorRoles: ['PROPERTY_OWNER'],
      }),
    ]);

    // Exactly one call should be original and one should be idempotent replay
    const originalCount = (res1.idempotentReplay ? 0 : 1) + (res2.idempotentReplay ? 0 : 1);
    const replayCount = (res1.idempotentReplay ? 1 : 0) + (res2.idempotentReplay ? 1 : 0);
    assert.strictEqual(originalCount, 1, 'Exactly one concurrent execution must perform original activation');
    assert.strictEqual(replayCount, 1, 'Exactly one concurrent execution must be an idempotent replay');

    // Confirm in DB that exactly ONE SPENT transaction was created
    const spendTxs = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.referenceId, concurrentCampaign.id),
          eq(pointsTransactions.type, 'SPENT')
        )
      );
    assert.strictEqual(spendTxs.length, 1, 'Only one SPENT points transaction allowed across concurrent activations');
  });

  // --------------------------------------------------------------------------
  // TEST 34: Expiry at the Correct Boundary
  // --------------------------------------------------------------------------
  await t.test('34. Expiry at the correct boundary is enforced; premature expiry rejected', async () => {
    // Attempt premature expiry before endTime has passed (1 second before endTime)
    const prematureAsOf = new Date(activationEndTime.getTime() - 1000);
    await assert.rejects(
      async () => {
        await promotionCampaignService.expireCampaign({
          campaignId: activatedCampaign.id,
          asOf: prematureAsOf,
        });
      },
      (err: any) => {
        assert.match(err.message, /CAMPAIGN_NOT_EXPIRED/);
        return true;
      }
    );

    // Verify campaign is still ACTIVE in DB
    const [stillActive] = await db
      .select()
      .from(promotionCampaigns)
      .where(eq(promotionCampaigns.id, activatedCampaign.id));
    assert.strictEqual(stillActive.status, 'ACTIVE');

    // Perform legitimate expiry exactly at endTime
    const expireResult = await promotionCampaignService.expireCampaign({
      campaignId: activatedCampaign.id,
      asOf: activationEndTime,
    });

    assert.strictEqual(expireResult.idempotentReplay, false);
    assert.strictEqual(expireResult.campaign.status, 'EXPIRED');

    // Verify campaign is now EXPIRED in DB
    const [nowExpired] = await db
      .select()
      .from(promotionCampaigns)
      .where(eq(promotionCampaigns.id, activatedCampaign.id));
    assert.strictEqual(nowExpired.status, 'EXPIRED');

    // Verify no refund or points ledger writes occurred during expiry
    const postExpiryTxs = await db
      .select()
      .from(pointsTransactions)
      .where(
        and(
          eq(pointsTransactions.referenceId, activatedCampaign.id),
          eq(pointsTransactions.type, 'RELEASED')
        )
      );
    assert.strictEqual(postExpiryTxs.length, 0, 'No points refunded on natural expiry');
  });

  // --------------------------------------------------------------------------
  // TEST 35: Repeated Expiry Runs and Batch Sweeper
  // --------------------------------------------------------------------------
  await t.test('35. Repeated expiry runs and batch sweepers are idempotent and operate on due campaigns only', async () => {
    // Top up owner wallet so submission is possible for all 3 campaigns (3 * 500 = 1500)
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 2000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund owner wallet for sweep test',
    });

    // 1. Re-expiring an already expired campaign returns idempotent replay
    const repeatExpire = await promotionCampaignService.expireCampaign({
      campaignId: activatedCampaign.id,
      asOf: new Date(activationEndTime.getTime() + 100000),
    });
    assert.strictEqual(repeatExpire.idempotentReplay, true);
    assert.strictEqual(repeatExpire.campaign.status, 'EXPIRED');

    // 2. Set up multiple active campaigns: two past-due and one future
    const pastCamp1 = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    const pastCamp2 = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    const futureCamp = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(pastCamp1.id, pastCamp2.id, futureCamp.id);

    // Submit & approve all three
    for (const c of [pastCamp1, pastCamp2, futureCamp]) {
      await promotionCampaignService.submitCampaign({ campaignId: c.id, actorUserId: ownerId, actorRoles: ['PROPERTY_OWNER'] });
      await promotionCampaignService.approveCampaign({ campaignId: c.id, adminUserId: adminId, adminRoles: ['ADMIN'] });
    }

    // Activate with past dates for pastCamp1 & pastCamp2 (duration 7 days)
    await promotionCampaignService.activateCampaign({
      campaignId: pastCamp1.id,
      startTime: new Date('2026-09-01T00:00:00Z'), // ends 2026-09-08
    });
    await promotionCampaignService.activateCampaign({
      campaignId: pastCamp2.id,
      startTime: new Date('2026-09-10T00:00:00Z'), // ends 2026-09-17
    });
    // Activate futureCamp with future dates
    await promotionCampaignService.activateCampaign({
      campaignId: futureCamp.id,
      startTime: new Date('2026-11-01T00:00:00Z'), // ends 2026-11-08
    });

    // Run sweep as of 2026-10-01 (should expire pastCamp1 & pastCamp2, but NOT futureCamp)
    const sweep1 = await promotionCampaignService.expireDueCampaigns({ asOf: new Date('2026-10-01T00:00:00Z') });
    assert.strictEqual(sweep1.expiredCount, 2);
    const expiredIds = sweep1.campaigns.map((c) => c.id);
    assert.ok(expiredIds.includes(pastCamp1.id));
    assert.ok(expiredIds.includes(pastCamp2.id));
    assert.ok(!expiredIds.includes(futureCamp.id));

    // Confirm futureCamp remains ACTIVE
    const [futureCheck] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, futureCamp.id));
    assert.strictEqual(futureCheck.status, 'ACTIVE');

    // Run sweep again as of 2026-10-01: should expire 0
    const sweep2 = await promotionCampaignService.expireDueCampaigns({ asOf: new Date('2026-10-01T00:00:00Z') });
    assert.strictEqual(sweep2.expiredCount, 0);
  });

  // --------------------------------------------------------------------------
  // TEST 36: Transaction Rollback on Failure
  // --------------------------------------------------------------------------
  await t.test('36. Transaction rollback on failure preserves state and points atomically', async () => {
    // Top up owner wallet so submission is possible
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund owner wallet for rollback test',
    });

    const rollbackCamp = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(rollbackCamp.id);

    await promotionCampaignService.submitCampaign({
      campaignId: rollbackCamp.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    await promotionCampaignService.approveCampaign({
      campaignId: rollbackCamp.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });

    const ownerWalletBefore = await pointsEngine.getOrCreateWallet(ownerId);

    // Activate with simulated audit failure
    await assert.rejects(
      async () => {
        await promotionCampaignService.activateCampaign({
          campaignId: rollbackCamp.id,
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
          simulateAuditFailure: true,
        });
      },
      (err: any) => {
        assert.match(err.message, /SIMULATED_AUDIT_FAILURE/);
        return true;
      }
    );

    // Verify campaign status rolled back to APPROVED
    const [cAfterFailedAct] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, rollbackCamp.id));
    assert.strictEqual(cAfterFailedAct.status, 'APPROVED');
    assert.strictEqual(cAfterFailedAct.spendTransactionId, null);
    assert.strictEqual(cAfterFailedAct.startTime, null);

    // Verify wallet reserved balances rolled back
    const ownerWalletAfterFailedAct = await pointsEngine.getOrCreateWallet(ownerId);
    assert.strictEqual(ownerWalletAfterFailedAct.reservedTotal, ownerWalletBefore.reservedTotal);
    assert.strictEqual(ownerWalletAfterFailedAct.totalBalance, ownerWalletBefore.totalBalance);

    // Activate cleanly now
    await promotionCampaignService.activateCampaign({
      campaignId: rollbackCamp.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    // Try expiring with simulated audit failure
    await assert.rejects(
      async () => {
        await promotionCampaignService.expireCampaign({
          campaignId: rollbackCamp.id,
          force: true,
          simulateAuditFailure: true,
        });
      },
      (err: any) => {
        assert.match(err.message, /SIMULATED_AUDIT_FAILURE/);
        return true;
      }
    );

    // Verify campaign status rolled back to ACTIVE
    const [cAfterFailedExp] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, rollbackCamp.id));
    assert.strictEqual(cAfterFailedExp.status, 'ACTIVE');
  });

  // --------------------------------------------------------------------------
  // TEST 37: Points Source Attribution and No Duplicate Spending
  // --------------------------------------------------------------------------
  await t.test('37. Points source attribution and no duplicate spending across activation and expiry', async () => {
    const dedicatedUserId = `usr_attr_${runId}`;
    const dedicatedPropId = `prop_attr_${runId}`;
    const dedicatedListId = `list_attr_${runId}`;

    await db.insert(users).values({
      id: dedicatedUserId,
      email: `${dedicatedUserId}@test.iq`,
      firstName: 'Attribution',
      lastName: 'Tester',
      roles: ['PROPERTY_OWNER'],
      isActive: true,
    });
    await db.insert(properties).values({
      id: dedicatedPropId,
      name: `Attribution Property ${runId}`,
      type: 'RESIDENTIAL',
      status: 'ACTIVE',
      currency: 'IQD',
      operatingModel: 'AGENT_OPERATED',
    });
    await db.insert(ownershipRecords).values({
      id: `own_attr_${runId}`,
      propertyId: dedicatedPropId,
      ownerId: dedicatedUserId,
      ownershipPercentage: '100.00',
      status: 'VERIFIED',
    });
    await db.insert(listings).values({
      id: dedicatedListId,
      propertyId: dedicatedPropId,
      publisherUserId: dedicatedUserId,
      type: 'FOR_RENT',
      price: '1000000',
      currency: 'IQD',
      status: 'PUBLISHED',
      title: `Attribution Listing ${runId}`,
    });

    // Fund wallet: 200 EARNED + 400 PURCHASED = 600 total
    await pointsEngine.adminAdjustPoints({
      targetUserId: dedicatedUserId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 200,
      direction: 'CREDIT',
      source: 'EARNED',
      reason: 'Fund earned points for attribution test',
    });
    await pointsEngine.adminAdjustPoints({
      targetUserId: dedicatedUserId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 400,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund purchased points for attribution test',
    });

    const initialWallet = await pointsEngine.getOrCreateWallet(dedicatedUserId);
    assert.strictEqual(initialWallet.earnedBalance, 200);
    assert.strictEqual(initialWallet.purchasedBalance, 400);
    assert.strictEqual(initialWallet.totalBalance, 600);
    assert.strictEqual(initialWallet.availableTotal, 600);

    // Create, submit, and approve campaign for 500 points (PKG_SPONSORED_SEARCH_7D)
    const attrCamp = await promotionCampaignService.createDraftCampaign({
      listingId: dedicatedListId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: dedicatedUserId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(attrCamp.id);

    await promotionCampaignService.submitCampaign({
      campaignId: attrCamp.id,
      actorUserId: dedicatedUserId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    // During reservation: 200 earned + 300 purchased reserved
    const resWallet = await pointsEngine.getOrCreateWallet(dedicatedUserId);
    assert.strictEqual(resWallet.reservedEarnedBalance, 200);
    assert.strictEqual(resWallet.reservedPurchasedBalance, 300);
    assert.strictEqual(resWallet.reservedTotal, 500);
    assert.strictEqual(resWallet.availableTotal, 100);
    assert.strictEqual(resWallet.totalBalance, 600);

    await promotionCampaignService.approveCampaign({
      campaignId: attrCamp.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });

    // Activate campaign: points must be SPENT proportionally (200 earned, 300 purchased)
    const actResult = await promotionCampaignService.activateCampaign({
      campaignId: attrCamp.id,
      actorUserId: dedicatedUserId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    const postActWallet = await pointsEngine.getOrCreateWallet(dedicatedUserId);
    assert.strictEqual(postActWallet.earnedBalance, 0, 'Earned balance reduced by 200 to 0');
    assert.strictEqual(postActWallet.reservedEarnedBalance, 0, 'Reserved earned reduced to 0');
    assert.strictEqual(postActWallet.purchasedBalance, 100, 'Purchased balance reduced by 300 to 100');
    assert.strictEqual(postActWallet.reservedPurchasedBalance, 0, 'Reserved purchased reduced to 0');
    assert.strictEqual(postActWallet.totalBalance, 100);
    assert.strictEqual(postActWallet.availableTotal, 100);

    // Inspect the SPENT transaction in the append-only ledger
    const [spentTx] = await db
      .select()
      .from(pointsTransactions)
      .where(eq(pointsTransactions.id, actResult.campaign.spendTransactionId!));

    assert.strictEqual(spentTx.type, 'SPENT');
    assert.strictEqual(spentTx.amount, 500);
    assert.strictEqual(spentTx.sourceType, 'MIXED');
    assert.strictEqual(spentTx.earnedDelta, -200);
    assert.strictEqual(spentTx.purchasedDelta, -300);
    assert.strictEqual(spentTx.reservedEarnedDelta, -200);
    assert.strictEqual(spentTx.reservedPurchasedDelta, -300);
    assert.strictEqual(spentTx.availableBalanceAfter, 100);
    assert.strictEqual(spentTx.totalBalanceAfter, 100);

    // Trigger 0030 append-only immutability test on this SPENT transaction using direct pg pool
    await assert.rejects(
      async () => {
        await pool.query('UPDATE points_transactions SET notes = $1 WHERE id = $2', ['malicious', spentTx.id]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await pool.query('DELETE FROM points_transactions WHERE id = $1', [spentTx.id]);
      },
      (err: any) => {
        assert.strictEqual(err.code, '55000');
        assert.match(err.message, /POINTS_TRANSACTIONS_APPEND_ONLY/);
        return true;
      }
    );

    // Expire campaign and verify wallet balances remain identical
    await promotionCampaignService.expireCampaign({
      campaignId: attrCamp.id,
      force: true,
    });

    const postExpWallet = await pointsEngine.getOrCreateWallet(dedicatedUserId);
    assert.strictEqual(postExpWallet.earnedBalance, 0);
    assert.strictEqual(postExpWallet.purchasedBalance, 100);
    assert.strictEqual(postExpWallet.totalBalance, 100);
    assert.strictEqual(postExpWallet.availableTotal, 100);
  });

  // --------------------------------------------------------------------------
  // TEST 38: Financial Isolation — No Changes to Rewards, Rent, Leases, Payments, Deposits, Fees
  // --------------------------------------------------------------------------
  await t.test('38. Financial isolation: no changes to rewards, rent, leases, payments, deposits, or fees across full lifecycle', async () => {
    // Top up owner wallet so submission is possible
    await pointsEngine.adminAdjustPoints({
      targetUserId: ownerId,
      adminUserId: adminId,
      adminRoles: ['SUPER_ADMIN'],
      amount: 1000,
      direction: 'CREDIT',
      source: 'PURCHASED',
      reason: 'Fund owner wallet for financial isolation test',
    });

    // Snapshot table counts using pool.query
    const getCounts = async () => {
      const leases = await pool.query('SELECT count(*)::int as c FROM leases');
      const schedules = await pool.query('SELECT count(*)::int as c FROM rent_schedules');
      const payments = await pool.query('SELECT count(*)::int as c FROM payment_records');
      const deposits = await pool.query('SELECT count(*)::int as c FROM security_deposits');
      const commissions = await pool.query('SELECT count(*)::int as c FROM commissions');
      const rewardRules = await pool.query('SELECT count(*)::int as c FROM points_reward_rules');
      const rewardGrants = await pool.query('SELECT count(*)::int as c FROM points_reward_grants');
      return {
        leases: Number(leases.rows[0].c),
        schedules: Number(schedules.rows[0].c),
        payments: Number(payments.rows[0].c),
        deposits: Number(deposits.rows[0].c),
        commissions: Number(commissions.rows[0].c),
        rewardRules: Number(rewardRules.rows[0].c),
        rewardGrants: Number(rewardGrants.rows[0].c),
      };
    };

    const before = await getCounts();

    // Run complete campaign lifecycle: Draft -> Submit -> Approve -> Activate -> Expire
    const isoCamp = await promotionCampaignService.createDraftCampaign({
      listingId: listingRentalId,
      packageId: 'PKG_SPONSORED_SEARCH_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(isoCamp.id);

    await promotionCampaignService.submitCampaign({ campaignId: isoCamp.id, actorUserId: ownerId, actorRoles: ['PROPERTY_OWNER'] });
    await promotionCampaignService.approveCampaign({ campaignId: isoCamp.id, adminUserId: adminId, adminRoles: ['ADMIN'] });
    await promotionCampaignService.activateCampaign({ campaignId: isoCamp.id, actorUserId: ownerId, actorRoles: ['PROPERTY_OWNER'] });
    await promotionCampaignService.expireCampaign({ campaignId: isoCamp.id, force: true });

    const after = await getCounts();

    assert.strictEqual(after.leases, before.leases, 'Leases table row count must remain unchanged');
    assert.strictEqual(after.schedules, before.schedules, 'Rent schedules table row count must remain unchanged');
    assert.strictEqual(after.payments, before.payments, 'Payment records table row count must remain unchanged');
    assert.strictEqual(after.deposits, before.deposits, 'Security deposits table row count must remain unchanged');
    assert.strictEqual(after.commissions, before.commissions, 'Commissions table row count must remain unchanged');
    assert.strictEqual(after.rewardRules, before.rewardRules, 'Reward rules table row count must remain unchanged');
    assert.strictEqual(after.rewardGrants, before.rewardGrants, 'Reward grants table row count must remain unchanged');
  });
});

