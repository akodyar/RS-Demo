import test from 'node:test';
import assert from 'node:assert';
import { db } from '../src/db/index.js';
import { users, organizations, organizationMembers, properties, ownershipRecords, managementAgreements } from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { propertyRepository } from '../src/server/repositories/properties.js';

test('Property Creation Authorization Audit', async (t) => {
  const runId = 'pca_' + Date.now().toString(36) + '_';

  await t.test('Company User explicit companyId assignment', async () => {
    const userId = `${runId}user-comp-audit-1`;
    const orgId = `${runId}org-comp-audit-1`;
    
    await db.insert(users).values({ id: userId, firstName: 'C', lastName: 'U', email: `${userId}@c.com`, roles: ['COMPANY'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: orgId, name: 'C Org', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId, organizationId: orgId, role: 'ADMIN' }).onConflictDoNothing();

    // The user tries to create a property owned by their company explicitly
    try {
        const prop = await propertyRepository.createProperty(userId, ['COMPANY'], {
            name: 'Company Prop 1',
            type: 'LAND',
            address: { city: 'Erbil' },
            companyId: orgId // Explicitly assigning to their org
        });
        
        const ownership = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
        assert.strictEqual(ownership[0].companyId, orgId, 'Should assign ownership to the company');
    } catch (e: any) {
        assert.fail(`Should not throw error for self-assigning to own company. Error: ${e.message}`);
    }
  });

  await t.test('Agent User assigning to Owner without CRM connection', async () => {
    const agentId = `${runId}user-agent-audit-1`;
    const ownerId = `${runId}user-owner-audit-1`;
    const agentOrgId = `${runId}org-agent-audit-1`;
    
    await db.insert(users).values({ id: agentId, firstName: 'A', lastName: 'U', email: `${agentId}@a.com`, roles: ['AGENT_BROKER', 'COMPANY'] }).onConflictDoNothing();
    await db.insert(users).values({ id: ownerId, firstName: 'O', lastName: 'U', email: `${ownerId}@o.com`, roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: agentOrgId, name: 'A Org', type: 'AGENT' }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId: agentId, organizationId: agentOrgId, role: 'ADMIN' }).onConflictDoNothing();

    // Agent tries to create a property for Owner without a CRM connection
    await assert.rejects(
        async () => {
            await propertyRepository.createProperty(agentId, ['AGENT_BROKER', 'COMPANY'], {
                name: 'Agent Prop 1',
                type: 'LAND',
                address: { city: 'Erbil' },
                ownerId: ownerId 
            });
        },
        (err: any) => {
            return err.message.includes('FORBIDDEN: You do not have an established client relationship');
        }
    );
  });

  await t.test('1. Individual owner creates a property with a management assignment', async () => {
    const ownerId = `${runId}reg-owner-1`;
    const mgmtOrgId = `${runId}reg-mgmt-1`;

    await db.insert(users).values({ id: ownerId, firstName: 'Owner', lastName: 'One', email: `${ownerId}@example.com`, roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: mgmtOrgId, name: 'Mgmt Agency 1', type: 'COMPANY', status: 'ACTIVE', verified: true }).onConflictDoNothing();

    const prop = await propertyRepository.createProperty(ownerId, ['PROPERTY_OWNER'], {
      name: 'Owner Managed Prop 1',
      type: 'APARTMENT',
      address: { city: 'Erbil' },
      managedByAgentId: mgmtOrgId,
    });

    assert.ok(prop.id, 'Property should be created');

    const ownership = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    assert.strictEqual(ownership.length, 1);
    assert.strictEqual(ownership[0].ownerId, ownerId);
    assert.strictEqual(ownership[0].companyId, null);

    const agreements = await db.select().from(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
    assert.strictEqual(agreements.length, 0, 'No active management agreement is fabricated at creation without signed contract');
    assert.strictEqual(prop.managementPreference, 'AGENT_MANAGED');
    assert.strictEqual(prop.managedByAgentId, mgmtOrgId);
    assert.strictEqual(prop.managementArrangementStatus, 'AWAITING_AGREEMENT');
  });

  await t.test('2. Company creates a property without a management assignment', async () => {
    const userId = `${runId}reg-comp-2`;
    const orgId = `${runId}reg-comp-2`;

    await db.insert(users).values({ id: userId, firstName: 'Comp', lastName: 'User2', email: `${userId}@example.com`, roles: ['COMPANY'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: orgId, name: 'Holding Corp 2', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId, organizationId: orgId, role: 'ADMIN' }).onConflictDoNothing();

    const prop = await propertyRepository.createProperty(userId, ['COMPANY'], {
      name: 'Corporate Unmanaged Prop 2',
      type: 'COMMERCIAL',
      address: { city: 'Sulaymaniyah' },
      companyId: orgId,
    });

    assert.ok(prop.id, 'Property should be created');

    const ownership = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    assert.strictEqual(ownership.length, 1);
    assert.strictEqual(ownership[0].companyId, orgId);
    assert.strictEqual(ownership[0].ownerId, null);

    const agreements = await db.select().from(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
    assert.strictEqual(agreements.length, 0, 'No management agreement should be created');
  });

  await t.test('3. Company creates a property with a management assignment (supported model)', async () => {
    const userId = `${runId}reg-comp-3`;
    const compOrgId = `${runId}reg-comp-3`;
    const mgmtOrgId = `${runId}reg-mgmt-3`;

    await db.insert(users).values({ id: userId, firstName: 'Comp', lastName: 'User3', email: `${userId}@example.com`, roles: ['COMPANY'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: compOrgId, name: 'Owning Corp 3', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizations).values({ id: mgmtOrgId, name: 'Managing Firm 3', type: 'AGENT_COMPANY', status: 'ACTIVE', verified: true }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId, organizationId: compOrgId, role: 'ADMIN' }).onConflictDoNothing();

    const prop = await propertyRepository.createProperty(userId, ['COMPANY'], {
      name: 'Corporate Managed Prop 3',
      type: 'COMMERCIAL',
      address: { city: 'Erbil' },
      companyId: compOrgId,
      ownerId: userId,
      managedByAgentId: mgmtOrgId,
    });

    assert.ok(prop.id, 'Property should be created');

    const ownership = await db.select().from(ownershipRecords).where(eq(ownershipRecords.propertyId, prop.id));
    assert.strictEqual(ownership.length, 1);
    assert.strictEqual(ownership[0].companyId, compOrgId);
    assert.strictEqual(ownership[0].ownerId, userId);

    const agreements = await db.select().from(managementAgreements).where(eq(managementAgreements.propertyId, prop.id));
    assert.strictEqual(agreements.length, 0, 'No active management agreement is fabricated at creation');
    assert.strictEqual(prop.managedByAgentId, mgmtOrgId);
    assert.strictEqual(prop.managementArrangementStatus, 'AWAITING_AGREEMENT');
  });

  await t.test('4. Missing or invalid owner identity fails safely when required', async () => {
    const userId = `${runId}reg-comp-4`;
    const compOrgId = `${runId}reg-comp-4`;
    const mgmtOrgId = `${runId}reg-mgmt-4`;

    await db.insert(users).values({ id: userId, firstName: 'Comp', lastName: 'User4', email: `${userId}@example.com`, roles: ['COMPANY'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: compOrgId, name: 'Owning Corp 4', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizations).values({ id: mgmtOrgId, name: 'Managing Firm 4', type: 'COMPANY', status: 'ACTIVE', verified: true }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId, organizationId: compOrgId, role: 'ADMIN' }).onConflictDoNothing();

    // 4a. Invalid ownership percentage on managed company property
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(userId, ['COMPANY'], {
          name: 'Invalid Ownership Percentage Prop',
          type: 'COMMERCIAL',
          address: { city: 'Erbil' },
          companyId: compOrgId,
          ownershipPercentage: 120,
        });
      },
      (err: any) => {
        return err.message.includes('VALIDATION_ERROR: Ownership percentage must be a valid number between 0.01 and 100.');
      }
    );

    // 4b. Invalid owner identity on managed company property
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(userId, ['COMPANY'], {
          name: 'Invalid Owner Managed Prop',
          type: 'COMMERCIAL',
          address: { city: 'Erbil' },
          companyId: compOrgId,
          ownerId: 'non-existent-user-uuid-999',
          managedByAgentId: mgmtOrgId,
        });
      },
      (err: any) => {
        return err.message.includes('INVALID_OWNER: The specified owner user does not exist.');
      }
    );
  });

  await t.test('5. Invalid manager assignment is rejected', async () => {
    const ownerId = `${runId}reg-owner-5`;
    const vendorOrgId = `${runId}reg-vendor-5`;
    const agentUserId = `${runId}reg-agent-5`;
    const agentOrg1 = `${runId}reg-agent-5a`;
    const agentOrg2 = `${runId}reg-agent-5b`;

    await db.insert(users).values({ id: ownerId, firstName: 'Owner', lastName: 'Five', email: `${ownerId}@example.com`, roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(users).values({ id: agentUserId, firstName: 'Agent', lastName: 'Five', email: `${agentUserId}@example.com`, roles: ['AGENT_BROKER'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: vendorOrgId, name: 'Plumbing Vendor', type: 'VENDOR' }).onConflictDoNothing();
    await db.insert(organizations).values({ id: agentOrg1, name: 'Agent Brokerage A', type: 'AGENT_COMPANY', status: 'ACTIVE', verified: true }).onConflictDoNothing();
    await db.insert(organizations).values({ id: agentOrg2, name: 'Agent Brokerage B', type: 'AGENT_COMPANY', status: 'ACTIVE', verified: true }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId: agentUserId, organizationId: agentOrg1, role: 'ADMIN' }).onConflictDoNothing();

    // 5a. Non-existent manager organization
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(ownerId, ['PROPERTY_OWNER'], {
          name: 'Non Existent Manager Prop',
          type: 'APARTMENT',
          address: { city: 'Erbil' },
          managedByAgentId: 'non-existent-org-id-000',
        });
      },
      (err: any) => err.message.includes('INVALID_AGENT: The specified agent/company does not exist.')
    );

    // 5b. Manager organization has unauthorized type (VENDOR)
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(ownerId, ['PROPERTY_OWNER'], {
          name: 'Vendor Manager Prop',
          type: 'APARTMENT',
          address: { city: 'Erbil' },
          managedByAgentId: vendorOrgId,
        });
      },
      (err: any) => err.message.includes('INVALID_AGENT: The specified organization is not an authorized management agent.')
    );

    // 5c. Agent attempts to assign management to an organization they do not belong to
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(agentUserId, ['AGENT_BROKER'], {
          name: 'Agent Alien Org Prop',
          type: 'APARTMENT',
          address: { city: 'Erbil' },
          ownerId: agentUserId,
          managedByAgentId: agentOrg2,
        });
      },
      (err: any) => err.message.includes('FORBIDDEN: Agents can only assign management to their own organization.')
    );
  });

  await t.test('6. Failed management-agreement rolls back all related property writes', async () => {
    const userId = `${runId}reg-comp-6`;
    const compOrgId = `${runId}reg-comp-6`;
    const mgmtOrgId = `${runId}reg-mgmt-6`;
    const uniquePropName = `Rollback Test Property ${Date.now()}`;

    await db.insert(users).values({ id: userId, firstName: 'Comp', lastName: 'User6', email: `${userId}@example.com`, roles: ['COMPANY'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: compOrgId, name: 'Rollback Corp', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizations).values({ id: mgmtOrgId, name: 'Rollback Mgmt', type: 'COMPANY', status: 'ACTIVE', verified: true }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId, organizationId: compOrgId, role: 'ADMIN' }).onConflictDoNothing();

    await assert.rejects(
      async () => {
        // Invalid ownership percentage causes validation failure inside the transaction
        await propertyRepository.createProperty(userId, ['COMPANY'], {
          name: uniquePropName,
          type: 'LAND',
          address: { city: 'Duhok' },
          companyId: compOrgId,
          managedByAgentId: mgmtOrgId,
          ownershipPercentage: -5,
        });
      },
      (err: any) => err.message.includes('VALIDATION_ERROR: Ownership percentage must be a valid number between 0.01 and 100.')
    );

    // Verify atomicity: NO property was created with that name
    const propCheck = await db.select().from(properties).where(eq(properties.name, uniquePropName));
    assert.strictEqual(propCheck.length, 0, 'Property write must be completely rolled back');
  });

  await t.test('7. Existing agent/owner authorization rules remain intact', async () => {
    const ownerAId = 'user-reg-owner-7a';
    const ownerBId = 'user-reg-owner-7b';
    const compUser7 = 'user-reg-comp-7';
    const compOrg7 = 'org-reg-comp-7';
    const alienOrg = 'org-reg-alien-7';
    const strangerUser = 'user-reg-stranger-7';

    await db.insert(users).values({ id: ownerAId, firstName: 'A', lastName: 'O', email: 'oa@oa.com', roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(users).values({ id: ownerBId, firstName: 'B', lastName: 'O', email: 'ob@ob.com', roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(users).values({ id: compUser7, firstName: 'C', lastName: 'U', email: 'cu7@c.com', roles: ['COMPANY'] }).onConflictDoNothing();
    await db.insert(users).values({ id: strangerUser, firstName: 'S', lastName: 'U', email: 'su@s.com', roles: ['PROPERTY_OWNER'] }).onConflictDoNothing();
    await db.insert(organizations).values({ id: compOrg7, name: 'Comp 7', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizations).values({ id: alienOrg, name: 'Alien Org', type: 'COMPANY' }).onConflictDoNothing();
    await db.insert(organizationMembers).values({ userId: compUser7, organizationId: compOrg7, role: 'ADMIN' }).onConflictDoNothing();

    // 7a. Individual owner cannot assign property to another owner
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(ownerAId, ['PROPERTY_OWNER'], {
          name: 'Stolen Owner Prop',
          type: 'APARTMENT',
          address: { city: 'Erbil' },
          ownerId: ownerBId,
        });
      },
      (err: any) => err.message.includes('FORBIDDEN: Only Agents and Admins can assign properties to other owners.')
    );

    // 7b. Company user cannot assign property to a company they do not belong to
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(compUser7, ['COMPANY'], {
          name: 'Stolen Comp Prop',
          type: 'COMMERCIAL',
          address: { city: 'Erbil' },
          companyId: alienOrg,
        });
      },
      (err: any) => err.message.includes('FORBIDDEN: Only Agents and Admins can assign properties to other owners.')
    );

    // 7c. Company user cannot assign ownerId to a user who does not belong to the company
    await assert.rejects(
      async () => {
        await propertyRepository.createProperty(compUser7, ['COMPANY'], {
          name: 'Stranger Owner Comp Prop',
          type: 'COMMERCIAL',
          address: { city: 'Erbil' },
          companyId: compOrg7,
          ownerId: strangerUser,
        });
      },
      (err: any) => err.message.includes('FORBIDDEN: Only Agents and Admins can assign properties to other owners.')
    );
  });
});
