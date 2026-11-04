import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { pool, db } from '../src/db/index';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

const jwtSecret = process.env.JWT_SECRET || 'homehub_native_jwt_auth_secret_dev_key_min32chars!';

interface SecurityVectorResult {
  vector: string;
  actorRole: string;
  targetEndpoint: string;
  expectedStatus: number;
  actualStatus: number;
  responseSnippet: string;
  passed: boolean;
}

async function runAdversarialAudit() {
  console.log('=== Running Cross-Domain Adversarial & Security Boundary Tests ===\n');

  const results: SecurityVectorResult[] = [];

  const runId = Date.now().toString(36);
  const ownerA = { id: `adv_owner_a_${runId}`, email: `owner_a_${runId}@homehub.iq`, roles: ['PROPERTY_OWNER'] };
  const ownerB = { id: `adv_owner_b_${runId}`, email: `owner_b_${runId}@homehub.iq`, roles: ['PROPERTY_OWNER'] };
  const tenantA = { id: `adv_tenant_a_${runId}`, email: `tenant_a_${runId}@homehub.iq`, roles: ['TENANT'] };
  const agentB = { id: `adv_agent_b_${runId}`, email: `agent_b_${runId}@homehub.iq`, roles: ['AGENT'] };

  await db.insert(schema.users).values([
    { id: ownerA.id, email: ownerA.email, firstName: 'AdvOwner', lastName: 'A', roles: ownerA.roles, isActive: true, createdAt: new Date() },
    { id: ownerB.id, email: ownerB.email, firstName: 'AdvOwner', lastName: 'B', roles: ownerB.roles, isActive: true, createdAt: new Date() },
    { id: tenantA.id, email: tenantA.email, firstName: 'AdvTenant', lastName: 'A', roles: tenantA.roles, isActive: true, createdAt: new Date() },
    { id: agentB.id, email: agentB.email, firstName: 'AdvAgent', lastName: 'B', roles: agentB.roles, isActive: true, createdAt: new Date() }
  ]).onConflictDoNothing();

  const propA = `prop_adv_a_${runId}`;
  await db.insert(schema.properties).values({
    id: propA,
    name: 'Owner A Protected Villa',
    type: 'RESIDENTIAL',
    currency: 'IQD',
    status: 'ACTIVE'
  }).onConflictDoNothing();

  await db.insert(schema.ownershipRecords).values({
    id: `own_adv_a_${runId}`,
    propertyId: propA,
    ownerId: ownerA.id,
    ownershipPercentage: '100',
    status: 'VERIFIED'
  }).onConflictDoNothing();

  const tokenOwnerB = jwt.sign({ id: ownerB.id, email: ownerB.email, roles: ownerB.roles, tokenVersion: 1 }, jwtSecret);
  const tokenTenantA = jwt.sign({ id: tenantA.id, email: tenantA.email, roles: tenantA.roles, tokenVersion: 1 }, jwtSecret);
  const tokenAgentB = jwt.sign({ id: agentB.id, email: agentB.email, roles: agentB.roles, tokenVersion: 1 }, jwtSecret);

  // Vector 1: Owner B attempts to access Owner A's Property
  try {
    const res1 = await fetch(`http://localhost:3000/api/properties/${propA}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenOwnerB}` }
    });
    const text1 = await res1.text();
    results.push({
      vector: 'Owner B accesses Owner A Property',
      actorRole: 'PROPERTY_OWNER (Unauthorized)',
      targetEndpoint: `GET /api/properties/${propA}`,
      expectedStatus: 403,
      actualStatus: res1.status,
      responseSnippet: text1.substring(0, 80),
      passed: res1.status === 403
    });
  } catch (err: any) {
    console.error('Vector 1 error:', err);
  }

  // Vector 2: Tenant A attempts to confirm rent payment
  const dummyPayId = `pay_dummy_${runId}`;
  try {
    const res2 = await fetch(`http://localhost:3000/api/financials/payments/${dummyPayId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenTenantA}` },
      body: JSON.stringify({ referenceNumber: 'TENANT-ATTEMPT-CONFIRM' })
    });
    const text2 = await res2.text();
    results.push({
      vector: 'Tenant attempts self-confirmation of payment',
      actorRole: 'TENANT (Self-Payer)',
      targetEndpoint: `POST /api/financials/payments/${dummyPayId}/confirm`,
      expectedStatus: 403,
      actualStatus: res2.status,
      responseSnippet: text2.substring(0, 80),
      passed: res2.status === 403
    });
  } catch (err: any) {
    console.error('Vector 2 error:', err);
  }

  // Vector 3: Standard Tenant attempts to access Admin Metrics
  try {
    const res3 = await fetch(`http://localhost:3000/api/admin/metrics`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenTenantA}` }
    });
    const text3 = await res3.text();
    results.push({
      vector: 'Standard user accesses Admin Metrics',
      actorRole: 'TENANT',
      targetEndpoint: 'GET /api/admin/metrics',
      expectedStatus: 403,
      actualStatus: res3.status,
      responseSnippet: text3.substring(0, 80),
      passed: res3.status === 403
    });
  } catch (err: any) {
    console.error('Vector 3 error:', err);
  }

  // Vector 4: Unassigned Agent B attempts to access Owner A's Property Leases
  try {
    const res4 = await fetch(`http://localhost:3000/api/properties/${propA}/leases`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenAgentB}` }
    });
    const text4 = await res4.text();
    results.push({
      vector: 'Unassigned Agent accesses Owner A Property Leases',
      actorRole: 'AGENT (Unassigned)',
      targetEndpoint: `GET /api/properties/${propA}/leases`,
      expectedStatus: 403,
      actualStatus: res4.status,
      responseSnippet: text4.substring(0, 80),
      passed: res4.status === 403
    });
  } catch (err: any) {
    console.error('Vector 4 error:', err);
  }

  // Vector 5: Tamper-free verification (Owner A property name unchanged)
  const [propCheck] = await db.select().from(schema.properties).where(eq(schema.properties.id, propA));
  const isTamperFree = propCheck.name === 'Owner A Protected Villa';
  console.log(`[DATABASE INTEGRITY] Property P name after attack: "${propCheck.name}" -> ${isTamperFree ? 'TAMPER-FREE (PASS)' : 'CORRUPTED (FAIL)'}`);

  console.log('\n--- Adversarial Vector Test Results ---');
  results.forEach((r, idx) => {
    console.log(`Vector ${idx + 1}: ${r.vector} | Role: ${r.actorRole} | Expected: ${r.expectedStatus} | Actual: ${r.actualStatus} | Passed: ${r.passed ? 'PASS' : 'FAIL'}`);
    console.log(`  Response: ${r.responseSnippet}`);
  });

  await pool.end();
}

runAdversarialAudit().catch(console.error);
