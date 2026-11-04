import http from 'node:http';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db, pool } from '../src/db/index.js';
import {
  users,
  organizations,
  organizationMembers,
  agentProfiles,
  vendorProfiles,
  auditLogs,
} from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { hashPassword } from '../src/server/utils/auth.js';
import { assertSafeDatabaseConfig } from '../tests/safe-test-env.js';
import fs from 'node:fs';
import path from 'node:path';

assertSafeDatabaseConfig();

async function main() {
  const outputDir = path.resolve(process.cwd(), 'artifacts/multi-role-enrollment-final-audit/database-evidence');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('Capturing real PostgreSQL database scenario evidence...');

  // Setup local express server on dynamic port
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  const runId = Date.now();
  const testPassword = 'Password123!Safe';
  const passwordHash = await hashPassword(testPassword);

  const testUserEmail = `audit_evidence_user_${runId}@homehub.iq`;

  // 1. BEFORE STATE: Insert initial tenant user
  console.log('1. Inserting initial tenant user...');
  const [initialUser] = await db.insert(users).values({
    email: testUserEmail,
    firstName: 'AuditEvidence',
    lastName: 'Tester',
    passwordHash,
    roles: ['TENANT'],
    isActive: true,
    tokenVersion: 1,
  }).returning();

  const userBefore = await pool.query('SELECT id, email, first_name, last_name, roles, is_active FROM users WHERE id = $1', [initialUser.id]);
  fs.writeFileSync(path.join(outputDir, '01-user-state-before-enrollment.json'), JSON.stringify(userBefore.rows, null, 2));

  // Login to get token
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testUserEmail, password: testPassword }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  // 2. CONCURRENT ENROLLMENT SCENARIO
  console.log('2. Executing concurrent enrollment requests...');
  const enrollStartTime = new Date().toISOString();
  const concurrentPromises = [
    fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'INDIVIDUAL' }),
    }),
    fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: 'VENDOR' }),
    }),
    fetch(`${baseUrl}/auth/roles/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'INDIVIDUAL' }),
    }),
  ];

  const concurrentResults = await Promise.all(concurrentPromises);
  const concurrentStatuses = concurrentResults.map((r) => r.status);
  const concurrentPayloads = await Promise.all(concurrentResults.map((r) => r.json()));

  fs.writeFileSync(path.join(outputDir, '02-concurrent-enrollment-responses.json'), JSON.stringify({
    timestamp: enrollStartTime,
    statuses: concurrentStatuses,
    payloads: concurrentPayloads,
  }, null, 2));

  // 3. AFTER CONCURRENT ENROLLMENT: Database state
  const userAfterConcurrent = await pool.query('SELECT id, email, first_name, last_name, roles, updated_at FROM users WHERE id = $1', [initialUser.id]);
  const agentProfileAfter = await pool.query('SELECT id, user_id, display_name, office_name, status, availability_status, is_public FROM agent_profiles WHERE user_id = $1', [initialUser.id]);
  const vendorProfileAfter = await pool.query('SELECT id, user_id, business_name, status, verification_status FROM vendor_profiles WHERE user_id = $1', [initialUser.id]);

  fs.writeFileSync(path.join(outputDir, '03-user-state-after-concurrent-enrollment.json'), JSON.stringify(userAfterConcurrent.rows, null, 2));
  fs.writeFileSync(path.join(outputDir, '04-profiles-after-enrollment.json'), JSON.stringify({
    agentProfiles: agentProfileAfter.rows,
    vendorProfiles: vendorProfileAfter.rows,
  }, null, 2));

  // 4. COMPANY ENROLLMENT & IDEMPOTENT RETRIES
  console.log('4. Executing Agent Company enrollment with duplicate retries...');
  const agentCompName = `Audit Realty Corp ${runId}`;
  const ownerCompName = `Audit Holdings Group ${runId}`;

  // Initial Agent Company enrollment
  const agentCompRes1 = await fetch(`${baseUrl}/auth/roles/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'COMPANY', companyName: agentCompName }),
  });
  const agentCompData1 = await agentCompRes1.json();

  // Retry 1
  const agentCompRes2 = await fetch(`${baseUrl}/auth/roles/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: 'AGENT_BROKER', entityType: 'COMPANY', companyName: agentCompName }),
  });
  const agentCompData2 = await agentCompRes2.json();

  // Initial Owner Company enrollment
  const ownerCompRes1 = await fetch(`${baseUrl}/auth/roles/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'COMPANY', companyName: ownerCompName }),
  });
  const ownerCompData1 = await ownerCompRes1.json();

  // Retry 2
  const ownerCompRes2 = await fetch(`${baseUrl}/auth/roles/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ role: 'PROPERTY_OWNER', entityType: 'COMPANY', companyName: ownerCompName }),
  });
  const ownerCompData2 = await ownerCompRes2.json();

  fs.writeFileSync(path.join(outputDir, '05-company-enrollment-retries.json'), JSON.stringify({
    agentCompanyEnrollment: {
      attempt1: { status: agentCompRes1.status, body: agentCompData1 },
      attempt2_retry: { status: agentCompRes2.status, body: agentCompData2 },
    },
    ownerCompanyEnrollment: {
      attempt1: { status: ownerCompRes1.status, body: ownerCompData1 },
      attempt2_retry: { status: ownerCompRes2.status, body: ownerCompData2 },
    },
  }, null, 2));

  // 5. DATABASE STATE FOR ORGANIZATIONS AND MEMBERSHIPS
  const orgsInDb = await pool.query(`
    SELECT o.id as org_id, o.name as org_name, o.type as org_type, o.status as org_status, o.verified,
           m.id as member_id, m.role as member_role, m.status as member_status
    FROM organization_members m
    JOIN organizations o ON m.organization_id = o.id
    WHERE m.user_id = $1
    ORDER BY o.created_at;
  `, [initialUser.id]);

  fs.writeFileSync(path.join(outputDir, '06-database-organizations-and-memberships.json'), JSON.stringify(orgsInDb.rows, null, 2));

  // 6. AUDIT LOG RECORDS FOR USER ACTIONS
  const auditRecords = await pool.query(`
    SELECT id, actor_user_id, actor_role, action, resource_type, resource_id, changes, timestamp
    FROM audit_logs
    WHERE actor_user_id = $1
    ORDER BY timestamp;
  `, [initialUser.id]);

  fs.writeFileSync(path.join(outputDir, '07-audit-log-records.json'), JSON.stringify(auditRecords.rows, null, 2));

  // 7. ELIGIBLE WORKSPACES OUTPUT FROM BACKEND
  const workspacesRes = await fetch(`${baseUrl}/auth/workspaces`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const workspacesData = await workspacesRes.json();
  fs.writeFileSync(path.join(outputDir, '08-resolved-eligible-workspaces.json'), JSON.stringify(workspacesData, null, 2));

  // 8. CLEANUP SYNTHETIC TEST USER AND CREATED ROWS
  console.log('8. Cleaning up synthetic test records from database...');
  await db.delete(vendorProfiles).where(eq(vendorProfiles.userId, initialUser.id));
  await db.delete(agentProfiles).where(eq(agentProfiles.userId, initialUser.id));
  const orgMems = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, initialUser.id));
  for (const m of orgMems) {
    await db.delete(organizationMembers).where(eq(organizationMembers.id, m.id));
    await db.delete(organizations).where(eq(organizations.id, m.organizationId));
  }
  await db.delete(auditLogs).where(eq(auditLogs.actorUserId, initialUser.id));
  await db.delete(users).where(eq(users.id, initialUser.id));

  server.close();
  console.log('Database evidence capture complete. Files written to:', outputDir);
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during database evidence capture:', err);
  process.exit(1);
});
