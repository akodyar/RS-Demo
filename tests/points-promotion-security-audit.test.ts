import test from 'node:test';
import assert from 'node:assert';
import { db, pool } from '../src/db/index.js';
import {
  users,
  properties,
  ownershipRecords,
  agentPropertyAssignments,
  listings,
  promotionPackages,
  promotionCampaigns,
  pointsWallets,
  pointsTransactions,
  pointsRewardRules,
  pointsRewardGrants,
  pointsPurchasePackages,
  pointsPurchaseOrders,
} from '../src/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { promotionCampaignService } from '../src/server/services/promotion-campaign.js';
import { promotionCampaignRepository } from '../src/server/repositories/promotion-campaign.js';
import { pointsEngine } from '../src/server/services/points-engine.js';
import { assertSafeDatabaseConfig } from './safe-test-env.js';

process.env.SQL_HOST = process.env.SQL_HOST || 'localhost';
process.env.SQL_DB_NAME = process.env.SQL_DB_NAME || 'homehub_test';
assertSafeDatabaseConfig();

test('Points & Promotion Campaign Comprehensive Security & Authorization Audit Suite (homehub_test)', async (t) => {
  const runId = 'sec_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

  // User identities
  const ownerId = `usr_own_${runId}`;
  const assignedAgentId = `usr_agt_${runId}`;
  const unassignedAgentId = `usr_unagt_${runId}`;
  const tenantId = `usr_tnt_${runId}`;
  const vendorId = `usr_vnd_${runId}`;
  const adminId = `usr_adm_${runId}`;
  const strangerOwnerId = `usr_str_${runId}`;
  const arbitraryVictimId = `usr_vic_${runId}`;

  // Property & listing identities
  const propId = `prop_sec_${runId}`;
  const unmanagedPropId = `prop_unm_${runId}`;
  const listingId = `list_sec_${runId}`;
  const unmanagedListingId = `list_unm_${runId}`;

  const createdCampaignIds: string[] = [];

  t.before(async () => {
    // 1. Verify connection to authorized test database
    const connCheck = await (db as any).execute(sql`SELECT current_database() as db_name`);
    const activeDb = connCheck.rows?.[0]?.db_name || (connCheck as any)[0]?.db_name;
    assert.strictEqual(activeDb, 'homehub_test', 'Must execute against homehub_test exclusively');

    // 2. Insert synthetic user identities
    await db.insert(users).values([
      { id: ownerId, email: `${ownerId}@test.iq`, firstName: 'Owner', lastName: 'Security', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: assignedAgentId, email: `${assignedAgentId}@test.iq`, firstName: 'Assigned', lastName: 'Agent', roles: ['AGENT'], isActive: true },
      { id: unassignedAgentId, email: `${unassignedAgentId}@test.iq`, firstName: 'Unassigned', lastName: 'Agent', roles: ['AGENT'], isActive: true },
      { id: tenantId, email: `${tenantId}@test.iq`, firstName: 'Tenant', lastName: 'Security', roles: ['TENANT'], isActive: true },
      { id: vendorId, email: `${vendorId}@test.iq`, firstName: 'Vendor', lastName: 'Security', roles: ['VENDOR'], isActive: true },
      { id: adminId, email: `${adminId}@test.iq`, firstName: 'Admin', lastName: 'Security', roles: ['ADMIN'], isActive: true },
      { id: strangerOwnerId, email: `${strangerOwnerId}@test.iq`, firstName: 'Stranger', lastName: 'Owner', roles: ['PROPERTY_OWNER'], isActive: true },
      { id: arbitraryVictimId, email: `${arbitraryVictimId}@test.iq`, firstName: 'Victim', lastName: 'Security', roles: ['PROPERTY_OWNER'], isActive: true },
    ]);

    // 3. Insert properties
    await db.insert(properties).values([
      { id: propId, name: `Security Test Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', verificationStatus: 'VERIFIED', currency: 'IQD', operatingModel: 'AGENT_OPERATED' },
      { id: unmanagedPropId, name: `Unmanaged Property ${runId}`, type: 'RESIDENTIAL', status: 'ACTIVE', verificationStatus: 'VERIFIED', currency: 'IQD', operatingModel: 'DIRECT_BY_OWNER' },
    ]);

    // 4. Insert ownership records
    await db.insert(ownershipRecords).values([
      { id: `own_${propId}`, propertyId: propId, ownerId: ownerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
      { id: `own_${unmanagedPropId}`, propertyId: unmanagedPropId, ownerId: strangerOwnerId, ownershipPercentage: '100.00', status: 'VERIFIED' },
    ]);

    // 5. Insert agent property assignment
    await db.insert(agentPropertyAssignments).values([
      {
        id: `asgn_${runId}`,
        propertyId: propId,
        userId: assignedAgentId,
        assignedBy: ownerId,
        permissions: ['MARKETPLACE_LISTING', 'PROMOTION_MANAGEMENT'],
        status: 'ACTIVE',
      },
    ]);

    // 6. Insert listings
    await db.insert(listings).values([
      {
        id: listingId,
        propertyId: propId,
        publisherUserId: ownerId,
        type: 'FOR_RENT',
        price: '1500000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Security Rental Listing ${runId}`,
      },
      {
        id: unmanagedListingId,
        propertyId: unmanagedPropId,
        publisherUserId: strangerOwnerId,
        type: 'FOR_RENT',
        price: '1200000',
        currency: 'IQD',
        status: 'PUBLISHED',
        title: `Unmanaged Rental Listing ${runId}`,
      },
    ]);

    // 7. Ensure test packages exist
    await db.insert(promotionPackages).values([
      {
        id: 'PKG_AUDIT_SPONSORED_7D',
        type: 'SPONSORED_SEARCH',
        name: 'Sponsored Search 7D Audit',
        pointsCost: 50,
        durationDays: 7,
        placementScope: ['SEARCH'],
        isActive: true,
        version: 1,
      },
    ]).onConflictDoNothing();

    await db.insert(pointsPurchasePackages).values([
      {
        id: 'PKG_AUDIT_POINTS_500',
        name: '500 Points Audit Package',
        points: 500,
        price: '50000',
        currency: 'IQD',
        isActive: true,
        allowedRoles: ['PROPERTY_OWNER', 'AGENT'],
      },
    ]).onConflictDoNothing();

    await db.insert(pointsRewardRules).values([
      {
        id: `rule_audit_${runId}`,
        ruleKey: `AUDIT_REWARD_${runId}`,
        role: 'TENANT',
        pointsAmount: 25,
        maxGrantsPerUser: 1,
        isActive: true,
        description: 'Audit reward rule',
      },
    ]).onConflictDoNothing();
  });

  t.after(async () => {
    // Cleanup synthetic test records
    for (const cId of createdCampaignIds) {
      await db.delete(promotionCampaigns).where(eq(promotionCampaigns.id, cId)).catch(() => {});
    }
    await db.delete(pointsRewardGrants).where(eq(pointsRewardGrants.userId, tenantId)).catch(() => {});
    await db.delete(pointsRewardRules).where(eq(pointsRewardRules.ruleKey, `AUDIT_REWARD_${runId}`)).catch(() => {});
    await db.delete(pointsPurchaseOrders).where(eq(pointsPurchaseOrders.userId, ownerId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, ownerId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, arbitraryVictimId)).catch(() => {});
    await db.delete(pointsTransactions).where(eq(pointsTransactions.userId, tenantId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, ownerId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, arbitraryVictimId)).catch(() => {});
    await db.delete(pointsWallets).where(eq(pointsWallets.userId, tenantId)).catch(() => {});
    await db.delete(listings).where(eq(listings.id, listingId)).catch(() => {});
    await db.delete(listings).where(eq(listings.id, unmanagedListingId)).catch(() => {});
    await db.delete(agentPropertyAssignments).where(eq(agentPropertyAssignments.propertyId, propId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, propId)).catch(() => {});
    await db.delete(ownershipRecords).where(eq(ownershipRecords.propertyId, unmanagedPropId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, propId)).catch(() => {});
    await db.delete(properties).where(eq(properties.id, unmanagedPropId)).catch(() => {});
    await db.delete(users).where(eq(users.id, ownerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, assignedAgentId)).catch(() => {});
    await db.delete(users).where(eq(users.id, unassignedAgentId)).catch(() => {});
    await db.delete(users).where(eq(users.id, tenantId)).catch(() => {});
    await db.delete(users).where(eq(users.id, vendorId)).catch(() => {});
    await db.delete(users).where(eq(users.id, adminId)).catch(() => {});
    await db.delete(users).where(eq(users.id, strangerOwnerId)).catch(() => {});
    await db.delete(users).where(eq(users.id, arbitraryVictimId)).catch(() => {});
    await pool.end().catch(() => {});
  });

  // --------------------------------------------------------------------------
  // TARGET 1: Owner authorization boundaries
  // --------------------------------------------------------------------------
  await t.test('1. Owner can create draft for own property, but is rejected for properties they do not own', async () => {
    // Positive: owner creates draft for own property
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);
    assert.strictEqual(draft.requesterUserId, ownerId);
    assert.strictEqual(draft.payerUserId, ownerId);
    assert.strictEqual(draft.consentStatus, 'NOT_REQUIRED');

    // Negative: owner attempts to create draft for stranger's property
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId: unmanagedListingId,
          packageId: 'PKG_AUDIT_SPONSORED_7D',
          actorUserId: ownerId,
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
  // TARGET 2: Agent authorization boundaries
  // --------------------------------------------------------------------------
  await t.test('2. Assigned agent can create draft, while unassigned agent is rejected', async () => {
    // Positive: assigned agent creates draft
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });
    createdCampaignIds.push(agentDraft.id);
    assert.strictEqual(agentDraft.requesterUserId, assignedAgentId);
    assert.strictEqual(agentDraft.consentStatus, 'REQUESTED'); // Agent promoting requires owner consent

    // Negative: unassigned agent attempts to create draft on property they do not manage
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId: unmanagedListingId,
          packageId: 'PKG_AUDIT_SPONSORED_7D',
          actorUserId: unassignedAgentId,
          actorRoles: ['AGENT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_PROPERTY_ACCESS/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 3: Tenant and Vendor cannot purchase points
  // --------------------------------------------------------------------------
  await t.test('3. Tenant and Vendor users are strictly prohibited from purchasing points', async () => {
    await assert.rejects(
      async () => {
        await pointsEngine.createPurchaseOrder({
          userId: tenantId,
          userRoles: ['TENANT'],
          packageId: 'PKG_AUDIT_POINTS_500',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ROLE/);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await pointsEngine.createPurchaseOrder({
          userId: vendorId,
          userRoles: ['VENDOR'],
          packageId: 'PKG_AUDIT_POINTS_500',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ROLE/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 4: Admin-only approval and rejection
  // --------------------------------------------------------------------------
  await t.test('4. Non-admin callers cannot approve or reject campaigns', async () => {
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    // Non-admin attempts to approve
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: draft.id,
          adminUserId: ownerId,
          adminRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );

    // Non-admin attempts to reject
    await assert.rejects(
      async () => {
        await promotionCampaignService.rejectCampaign({
          campaignId: draft.id,
          adminUserId: assignedAgentId,
          adminRoles: ['AGENT'],
          reason: 'Unauthorized rejection attempt',
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 5: Admin authority does not implicitly authorize spending other's points
  // --------------------------------------------------------------------------
  await t.test('5. Administrator cannot call submitCampaign to reserve points from another user wallet', async () => {
    // Fund owner wallet with 100 points
    await db.insert(pointsWallets).values({
      userId: ownerId,
      earnedBalance: 100,
      purchasedBalance: 0,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).onConflictDoUpdate({
      target: pointsWallets.userId,
      set: { earnedBalance: 100 },
    });

    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);
    assert.strictEqual(draft.payerUserId, ownerId);

    // Admin attempts to submit on behalf of owner to trigger reservation
    await assert.rejects(
      async () => {
        await promotionCampaignService.submitCampaign({
          campaignId: draft.id,
          actorUserId: adminId,
          actorRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_PAYER/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 6: Prohibit arbitrary payer designation
  // --------------------------------------------------------------------------
  await t.test('6. Requester cannot designate an arbitrary unrelated user as payer', async () => {
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId,
          packageId: 'PKG_AUDIT_SPONSORED_7D',
          actorUserId: assignedAgentId,
          actorRoles: ['AGENT'],
          payerUserId: arbitraryVictimId, // Victim is neither requester nor property owner
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_PAYER/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 7: Owner consent identity derivation and forgery protection
  // --------------------------------------------------------------------------
  await t.test('7. Owner consent strictly verifies authenticated actor and rejects unrelated callers', async () => {
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });
    createdCampaignIds.push(agentDraft.id);

    // Stranger attempts to grant consent
    await assert.rejects(
      async () => {
        await promotionCampaignService.grantOwnerConsent({
          campaignId: agentDraft.id,
          actorUserId: strangerOwnerId,
          actorRoles: ['PROPERTY_OWNER'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_OWNER_CONSENT/);
        return true;
      }
    );

    // Positive: verified property owner grants consent
    const consentResult = await promotionCampaignService.grantOwnerConsent({
      campaignId: agentDraft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    assert.strictEqual(consentResult.campaign.consentStatus, 'GRANTED');
    assert.strictEqual(consentResult.campaign.consentGrantedByUserId, ownerId);
  });

  // --------------------------------------------------------------------------
  // TARGET 8: Missing or rejected consent blocks approval and activation
  // --------------------------------------------------------------------------
  await t.test('8. Missing or rejected owner consent blocks campaign approval and activation', async () => {
    // Fund assigned agent wallet
    await db.insert(pointsWallets).values({
      userId: assignedAgentId,
      earnedBalance: 100,
      purchasedBalance: 0,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).onConflictDoUpdate({
      target: pointsWallets.userId,
      set: { earnedBalance: 100 },
    });

    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });
    createdCampaignIds.push(agentDraft.id);

    // Submit campaign (reservation succeeds, consent remains REQUESTED)
    await promotionCampaignService.submitCampaign({
      campaignId: agentDraft.id,
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });

    // Admin attempts to approve while consent is REQUESTED
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: agentDraft.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /OWNER_CONSENT_REQUIRED/);
        return true;
      }
    );

    // Owner denies consent
    await promotionCampaignService.denyOwnerConsent({
      campaignId: agentDraft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
      reason: 'Promotions not authorized for this listing',
    });

    // Admin attempts to approve after consent DENIED/REJECTED
    await assert.rejects(
      async () => {
        await promotionCampaignService.approveCampaign({
          campaignId: agentDraft.id,
          adminUserId: adminId,
          adminRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /INVALID_CAMPAIGN_STATE|OWNER_CONSENT_DENIED/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 9: Repeated submission idempotency (no double-reserve)
  // --------------------------------------------------------------------------
  await t.test('9. Repeated submission of a campaign does not double-reserve points', async () => {
    // Reset owner wallet
    await db.update(pointsWallets).set({
      earnedBalance: 100,
      purchasedBalance: 0,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).where(eq(pointsWallets.userId, ownerId));

    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    const firstSubmit = await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    assert.strictEqual(firstSubmit.idempotentReplay, false);

    // Second submit on the same campaign
    const secondSubmit = await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    assert.strictEqual(secondSubmit.idempotentReplay, true);

    // Verify wallet: reserved is exactly 50, not 100
    const [wallet] = await db.select().from(pointsWallets).where(eq(pointsWallets.userId, ownerId));
    assert.strictEqual(wallet.reservedEarnedBalance, 50);
  });

  // --------------------------------------------------------------------------
  // TARGET 10: Repeated approval/rejection idempotency
  // --------------------------------------------------------------------------
  await t.test('10. Repeated approval does not duplicate financial effects', async () => {
    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    const app1 = await promotionCampaignService.approveCampaign({
      campaignId: draft.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });
    assert.strictEqual(app1.idempotentReplay, false);

    const app2 = await promotionCampaignService.approveCampaign({
      campaignId: draft.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });
    assert.strictEqual(app2.idempotentReplay, true);
  });

  // --------------------------------------------------------------------------
  // TARGET 11: Concurrency and balance overspend protection
  // --------------------------------------------------------------------------
  await t.test('11. Concurrent reservation requests cannot overspend available balance', async () => {
    // Set wallet to exactly 50 points
    await db.update(pointsWallets).set({
      earnedBalance: 50,
      purchasedBalance: 0,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).where(eq(pointsWallets.userId, ownerId));

    const draftA = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draftA.id);

    const draftB = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draftB.id);

    // Launch concurrent submissions: one must succeed and one must fail with INSUFFICIENT_AVAILABLE_POINTS
    const results = await Promise.allSettled([
      promotionCampaignService.submitCampaign({ campaignId: draftA.id, actorUserId: ownerId, actorRoles: ['PROPERTY_OWNER'] }),
      promotionCampaignService.submitCampaign({ campaignId: draftB.id, actorUserId: ownerId, actorRoles: ['PROPERTY_OWNER'] }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    assert.strictEqual(fulfilled.length, 1, 'Exactly one concurrent reservation must succeed');
    assert.strictEqual(rejected.length, 1, 'Exactly one concurrent reservation must fail');
    const errorMsg = (rejected[0] as PromiseRejectedResult).reason?.message || '';
    assert.match(errorMsg, /INSUFFICIENT_AVAILABLE_POINTS/);

    const [wallet] = await db.select().from(pointsWallets).where(eq(pointsWallets.userId, ownerId));
    assert.strictEqual(wallet.reservedEarnedBalance, 50);
  });

  // --------------------------------------------------------------------------
  // TARGET 12: Campaign transaction rollback atomicity
  // --------------------------------------------------------------------------
  await t.test('12. Failed campaign activation cleanly rolls back spent points', async () => {
    // Reset owner wallet with 50 points
    await db.update(pointsWallets).set({
      earnedBalance: 50,
      purchasedBalance: 0,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).where(eq(pointsWallets.userId, ownerId));

    const draft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });
    createdCampaignIds.push(draft.id);

    await promotionCampaignService.submitCampaign({
      campaignId: draft.id,
      actorUserId: ownerId,
      actorRoles: ['PROPERTY_OWNER'],
    });

    await promotionCampaignService.approveCampaign({
      campaignId: draft.id,
      adminUserId: adminId,
      adminRoles: ['ADMIN'],
    });

    // Attempt activation with simulated failure
    await assert.rejects(
      async () => {
        await promotionCampaignService.activateCampaign({
          campaignId: draft.id,
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

    // Verify campaign status is still APPROVED and wallet reserved balance is still 50 (not spent)
    const [c] = await db.select().from(promotionCampaigns).where(eq(promotionCampaigns.id, draft.id));
    assert.strictEqual(c.status, 'APPROVED');
    assert.strictEqual(c.spendTransactionId, null);

    const [wallet] = await db.select().from(pointsWallets).where(eq(pointsWallets.userId, ownerId));
    assert.strictEqual(wallet.reservedEarnedBalance, 50);
    assert.strictEqual(wallet.earnedBalance, 50);
  });

  // --------------------------------------------------------------------------
  // TARGET 13: Marketplace ranking excludes ineligible / non-active campaigns
  // --------------------------------------------------------------------------
  await t.test('13. Non-active or rejected campaigns receive zero promotion boost in marketplace search', async () => {
    const searchRes = await promotionCampaignService.searchRentalListings({
      type: 'FOR_RENT',
      placement: 'SEARCH',
    });

    // None of our unactivated campaigns should have isPromoted = true
    const ourListing = searchRes.items.find((item) => item.id === listingId);
    assert.ok(ourListing);
    assert.strictEqual(ourListing.isPromoted, false);
    assert.strictEqual(ourListing.promotionType, null);
  });

  // --------------------------------------------------------------------------
  // TARGET 14: Corrupted campaign state (missing endTime) fails closed
  // --------------------------------------------------------------------------
  await t.test('14. Corrupted active campaign with missing endTime is isolated by expiry processing', async () => {
    const [corruptCampaign] = await db.insert(promotionCampaigns).values({
      listingId,
      propertyId: propId,
      requesterUserId: ownerId,
      payerUserId: ownerId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      packageVersion: 1,
      campaignType: 'SPONSORED_SEARCH',
      placementScope: ['SEARCH'],
      pointsCost: 50,
      durationDays: 7,
      status: 'ACTIVE',
      startTime: new Date(Date.now() - 10 * 86400000),
      endTime: null, // Corrupted: missing endTime
      consentStatus: 'NOT_REQUIRED',
    }).returning();
    createdCampaignIds.push(corruptCampaign.id);

    // Expiry sweep should isolate corrupted campaign without crashing
    const sweepResult = await promotionCampaignService.expireDueCampaigns({ asOf: new Date() });
    assert.ok(sweepResult.failedCount > 0);
    const failureRecord = sweepResult.failedCampaigns.find((f) => f.campaignId === corruptCampaign.id);
    assert.ok(failureRecord);
    assert.match(failureRecord.error, /CORRUPTED_CAMPAIGN_STATE/);
  });

  // --------------------------------------------------------------------------
  // TARGET 15: Reward grant idempotency
  // --------------------------------------------------------------------------
  await t.test('15. Duplicate reward-event processing cannot create duplicate grants', async () => {
    const refEventId = `evt_rent_pay_${runId}`;

    const firstGrant = await pointsEngine.grantRewardPoints({
      userId: tenantId,
      userRoles: ['TENANT'],
      ruleKey: `AUDIT_REWARD_${runId}`,
      referenceEventId: refEventId,
    });
    assert.strictEqual(firstGrant.idempotentReplay, false);
    assert.strictEqual(firstGrant.wallet.earnedBalance, 25);

    // Replay same reward event
    const secondGrant = await pointsEngine.grantRewardPoints({
      userId: tenantId,
      userRoles: ['TENANT'],
      ruleKey: `AUDIT_REWARD_${runId}`,
      referenceEventId: refEventId,
    });
    assert.strictEqual(secondGrant.idempotentReplay, true);
    assert.strictEqual(secondGrant.wallet.earnedBalance, 25); // Balance did NOT double to 50
  });

  // --------------------------------------------------------------------------
  // TARGET 16: Earned-vs-purchased attribution and spending order
  // --------------------------------------------------------------------------
  await t.test('16. Points reservation and spend consumes earned points first, then purchased', async () => {
    // Fund owner wallet with 20 earned and 40 purchased (total 60)
    await db.update(pointsWallets).set({
      earnedBalance: 20,
      purchasedBalance: 40,
      reservedEarnedBalance: 0,
      reservedPurchasedBalance: 0,
    }).where(eq(pointsWallets.userId, ownerId));

    // Reserve 30 points: should allocate 20 earned + 10 purchased
    const reservation = await pointsEngine.reservePoints({
      userId: ownerId,
      amount: 30,
      referenceId: `ref_order_${runId}`,
      referenceType: 'PROMOTION_CAMPAIGN',
    });

    assert.strictEqual(reservation.transaction.reservedEarnedDelta, 20);
    assert.strictEqual(reservation.transaction.reservedPurchasedDelta, 10);
    assert.strictEqual(reservation.wallet.reservedEarnedBalance, 20);
    assert.strictEqual(reservation.wallet.reservedPurchasedBalance, 10);

    // Release reservation
    const release = await pointsEngine.releasePoints({
      userId: ownerId,
      referenceId: `ref_order_${runId}`,
      referenceType: 'PROMOTION_CAMPAIGN',
    });
    assert.strictEqual(release.wallet.reservedEarnedBalance, 0);
    assert.strictEqual(release.wallet.reservedPurchasedBalance, 0);
  });

  // --------------------------------------------------------------------------
  // TARGET 17: IDOR Protection on Points Wallet & Purchase Order
  // --------------------------------------------------------------------------
  await t.test('17. User cannot read or mutate another user wallet or purchase order through identifier substitution', async () => {
    // Tenant attempts to read Owner wallet history
    await assert.rejects(
      async () => {
        await pointsEngine.getWalletWithHistory(ownerId, 50, {
          actorUserId: tenantId,
          actorRoles: ['TENANT'],
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ACCESS/);
        return true;
      }
    );

    // Tenant attempts to create purchase order in another user's name
    await assert.rejects(
      async () => {
        await pointsEngine.createPurchaseOrder({
          userId: ownerId,
          userRoles: ['PROPERTY_OWNER'],
          packageId: 'PKG_AUDIT_POINTS_500',
          actorUserId: tenantId,
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_PURCHASER/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 18: Property Owner can inspect campaign created by managing agent
  // --------------------------------------------------------------------------
  await t.test('18. Verified property owner can view campaign created by managing agent', async () => {
    const agentDraft = await promotionCampaignService.createDraftCampaign({
      listingId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      actorUserId: assignedAgentId,
      actorRoles: ['AGENT'],
    });
    createdCampaignIds.push(agentDraft.id);

    // Property owner views campaign
    const viewed = await promotionCampaignService.getCampaign(agentDraft.id, ownerId, ['PROPERTY_OWNER']);
    assert.strictEqual(viewed.id, agentDraft.id);

    // Stranger attempts to view campaign
    await assert.rejects(
      async () => {
        await promotionCampaignService.getCampaign(agentDraft.id, strangerOwnerId, ['PROPERTY_OWNER']);
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ACCESS/);
        return true;
      }
    );
  });

  // --------------------------------------------------------------------------
  // TARGET 19: Append-only points ledger trigger 0030
  // --------------------------------------------------------------------------
  await t.test('19. Append-only ledger trigger 0030 rejects UPDATE and DELETE on points_transactions with SQLSTATE 55000', async () => {
    // Find a transaction
    const [tx] = await db.select().from(pointsTransactions).limit(1);
    if (tx) {
      // Attempt UPDATE
      await assert.rejects(
        async () => {
          await db.execute(sql`UPDATE points_transactions SET notes = 'Tampered' WHERE id = ${tx.id}`);
        },
        (err: any) => {
          const msg = String(err?.cause?.message || err?.message || err);
          assert.match(msg, /POINTS_TRANSACTIONS_APPEND_ONLY/);
          return true;
        }
      );

      // Attempt DELETE
      await assert.rejects(
        async () => {
          await db.execute(sql`DELETE FROM points_transactions WHERE id = ${tx.id}`);
        },
        (err: any) => {
          const msg = String(err?.cause?.message || err?.message || err);
          assert.match(msg, /POINTS_TRANSACTIONS_APPEND_ONLY/);
          return true;
        }
      );
    }
  });

  // --------------------------------------------------------------------------
  // TARGET 20: Admin draft creation restricted and forced expiry authorization
  // --------------------------------------------------------------------------
  await t.test('20. Pure Admin cannot create draft campaign and non-admin cannot force early expiry', async () => {
    // Pure Admin creates draft
    await assert.rejects(
      async () => {
        await promotionCampaignService.createDraftCampaign({
          listingId,
          packageId: 'PKG_AUDIT_SPONSORED_7D',
          actorUserId: adminId,
          actorRoles: ['ADMIN'],
        });
      },
      (err: any) => {
        assert.match(err.message, /FORBIDDEN_ROLE/);
        return true;
      }
    );

    // Non-admin attempts to force early expiry of active campaign
    const [activeCampaign] = await db.insert(promotionCampaigns).values({
      listingId,
      propertyId: propId,
      requesterUserId: ownerId,
      payerUserId: ownerId,
      packageId: 'PKG_AUDIT_SPONSORED_7D',
      packageVersion: 1,
      campaignType: 'SPONSORED_SEARCH',
      placementScope: ['SEARCH'],
      pointsCost: 50,
      durationDays: 7,
      status: 'ACTIVE',
      startTime: new Date(),
      endTime: new Date(Date.now() + 5 * 86400000), // In future
      consentStatus: 'NOT_REQUIRED',
    }).returning();
    createdCampaignIds.push(activeCampaign.id);

    await assert.rejects(
      async () => {
        await promotionCampaignService.expireCampaign({
          campaignId: activeCampaign.id,
          actorUserId: ownerId,
          actorRoles: ['PROPERTY_OWNER'],
          force: true, // Non-admin attempting forced early termination
        });
      },
      (err: any) => {
        assert.match(err.message, /UNAUTHORIZED_ADMIN/);
        return true;
      }
    );
  });
});
