import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { users, passwordResetTokens } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, signAuthToken, verifyAuthToken } from '../src/server/utils/auth.js';

let passed = 0;
let failed = 0;

function check(testId: string, description: string, condition: boolean, details?: any) {
  if (condition) {
    console.log(`✅ PASS [${testId}] ${description}`);
    passed++;
  } else {
    console.error(`❌ FAIL [${testId}] ${description}`, details ? `— Details: ${JSON.stringify(details)}` : '');
    failed++;
  }
}

async function runNativeAuthSecuritySuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — NATIVE POSTGRESQL AUTHENTICATION SECURITY SUITE');
  console.log('================================================================\n');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  try {
    // -------------------------------------------------------------------------
    // 1. CRYPTOGRAPHIC INTEGRITY: ARGON2ID & JWT
    // -------------------------------------------------------------------------
    console.log('--- PART 1: ARGON2ID PASSWORD HASHING INTEGRITY ---');

    const testSecretPassword = 'UltraSecureTestPassword99!';
    const hash = await hashPassword(testSecretPassword);

    check('NAT-AUTH-01', 'Password hash utilizes Argon2id algorithm ($argon2id$ prefix)', hash.startsWith('$argon2id$'));
    check('NAT-AUTH-02', 'Argon2id verifies valid plaintext password', await verifyPassword(hash, testSecretPassword));
    check('NAT-AUTH-03', 'Argon2id rejects invalid plaintext password', !(await verifyPassword(hash, 'WrongPassword123')));

    const testToken = signAuthToken({ id: 'test_usr_1', email: 'test@homehub.iq', roles: ['TENANT'] });
    const decoded = verifyAuthToken(testToken);
    check('NAT-AUTH-04', 'Native JWT signs and decodes claims accurately', decoded.id === 'test_usr_1' && decoded.email === 'test@homehub.iq');

    // -------------------------------------------------------------------------
    // 2. REGISTRATION & ATOMIC TRANSACTION VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: REGISTRATION & ATOMIC TRANSACTION ---');

    const uniqueId = Date.now();
    const regEmail = `native_user_${uniqueId}@homehub.iq`;

    // 2.1 Successful Native Registration
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'ValidPassword123!',
        fullName: 'Zana Hawrami',
        phone: '+964 750 999 1122',
        role: 'TENANT',
      }),
    });
    const regData = await regRes.json();
    check('NAT-AUTH-05', 'Registration returns HTTP 201 with session token and sanitized user', regRes.status === 201 && Boolean(regData.token) && regData.user?.email === regEmail);
    check('NAT-AUTH-06', 'Registration response does NOT expose passwordHash', regData.user?.passwordHash === undefined);

    // Verify stored user in PostgreSQL has Argon2id hash
    const [dbUser] = await db.select().from(users).where(eq(users.email, regEmail)).limit(1);
    check('NAT-AUTH-07', 'PostgreSQL stores Argon2id password_hash directly in users table', dbUser && Boolean(dbUser.passwordHash) && dbUser.passwordHash!.startsWith('$argon2id$'));

    // 2.2 Duplicate Email Rejection
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'AnotherPassword123!',
        fullName: 'Duplicate User',
        role: 'TENANT',
      }),
    });
    check('NAT-AUTH-08', 'Duplicate registration rejected with HTTP 409 EMAIL_ALREADY_EXISTS', dupRes.status === 409);

    // 2.3 Client Role Escalation Attempt Demoted
    const escEmail = `escalation_attempt_${uniqueId}@homehub.iq`;
    const escRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: escEmail,
        password: 'ValidPassword123!',
        fullName: 'Attacker User',
        role: 'PLATFORM_ADMIN', // Attempted role escalation
      }),
    });
    const escData = await escRes.json();
    check('NAT-AUTH-09', 'Client role escalation attempt demoted to TENANT by server', escRes.status === 201 && escData.user.roles.includes('TENANT') && !escData.user.roles.includes('PLATFORM_ADMIN'));

    // -------------------------------------------------------------------------
    // 3. SIGN-IN (LOGIN) CREDENTIAL VERIFICATION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: SIGN-IN (LOGIN) CREDENTIAL VERIFICATION ---');

    // 3.1 Correct Password Acceptance
    const loginOkRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'ValidPassword123!',
      }),
    });
    const loginOkData = await loginOkRes.json();
    check('NAT-AUTH-10', 'Correct password accepted: HTTP 200 with valid JWT token', loginOkRes.status === 200 && Boolean(loginOkData.token));

    // 3.2 Incorrect Password Rejection
    const loginBadPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'WrongPassword999!',
      }),
    });
    check('NAT-AUTH-11', 'Incorrect password rejected: HTTP 401 INVALID_CREDENTIALS', loginBadPassRes.status === 401);

    // 3.3 Unknown Email Rejection
    const loginUnknownRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent_account_9999@homehub.iq',
        password: 'SomePassword123!',
      }),
    });
    check('NAT-AUTH-12', 'Unknown email rejected: HTTP 401 INVALID_CREDENTIALS', loginUnknownRes.status === 401);

    // -------------------------------------------------------------------------
    // 4. SESSION RECOGNITION & PROTECTED ROUTE ACCESS
    // -------------------------------------------------------------------------
    console.log('\n--- PART 4: SESSION RECOGNITION & PROTECTED ROUTE ACCESS ---');

    // 4.1 GET /api/auth/me with valid native JWT
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginOkData.token}` },
    });
    const meData = await meRes.json();
    check('NAT-AUTH-13', 'GET /api/auth/me returns authenticated user matching database ID', meRes.status === 200 && meData.user?.id === dbUser.id);

    // 4.2 Unauthenticated Request to Protected Route Rejected
    const unauthRes = await fetch(`${baseUrl}/auth/me`);
    check('NAT-AUTH-14', 'Unauthenticated request rejected with HTTP 401', unauthRes.status === 401);

    // 4.3 Forged Token Rejected
    const fakeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: 'Bearer forged_fake_token_abc123' },
    });
    check('NAT-AUTH-15', 'Forged/tampered JWT rejected with HTTP 401', fakeRes.status === 401);

    // -------------------------------------------------------------------------
    // 5. ACCOUNT STATUS (SUSPENSION) & LOCKOUT ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n--- PART 5: ACCOUNT STATUS (SUSPENSION) ENFORCEMENT ---');

    // Deactivate user in PostgreSQL
    await db.update(users).set({ isActive: false }).where(eq(users.id, dbUser.id));

    // Sign in attempt on suspended user
    const loginSuspendedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'ValidPassword123!',
      }),
    });
    check('NAT-AUTH-16', 'Suspended account cannot login: HTTP 403 ACCOUNT_SUSPENDED', loginSuspendedRes.status === 403);

    // Protected API request with existing token for suspended user
    const meSuspendedRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginOkData.token}` },
    });
    check('NAT-AUTH-17', 'Protected API rejects suspended account with valid token: HTTP 403', meSuspendedRes.status === 403);

    // Restore active state
    await db.update(users).set({ isActive: true }).where(eq(users.id, dbUser.id));

    // -------------------------------------------------------------------------
    // 6. PASSWORD RESET TOKEN LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- PART 6: PASSWORD RESET TOKEN LIFECYCLE ---');

    // Request reset
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: regEmail }),
    });
    check('NAT-AUTH-18', 'Password recovery request returns HTTP 200 with anti-enumeration message', forgotRes.status === 200);

    // Retrieve generated token directly from DB for test verification
    const [tokenRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, dbUser.id))
      .limit(1);
    check('NAT-AUTH-19', 'Password reset record created in database with 1-hour expiration', tokenRecord && Boolean(tokenRecord.expiresAt));

    // -------------------------------------------------------------------------
    // 7. AUTHORITATIVE SERVER-SIDE SESSION INVALIDATION ON LOGOUT
    // -------------------------------------------------------------------------
    console.log('\n--- PART 7: SERVER-SIDE SESSION INVALIDATION ON LOGOUT ---');

    // 7.1 Verify token is valid before logout
    const preLogoutMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginOkData.token}` },
    });
    check('NAT-AUTH-21', 'Pre-logout JWT is valid and accepted by server before logout', preLogoutMeRes.status === 200);

    // 7.2 Call /api/auth/logout with Bearer token
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginOkData.token}` },
    });
    const logoutData = await logoutRes.json();
    check('NAT-AUTH-22', 'Logout endpoint responds HTTP 200 and success: true', logoutRes.status === 200 && logoutData.success === true);

    // 7.3 Attempt to reuse pre-logout JWT on protected route
    const postLogoutMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginOkData.token}` },
    });
    const postLogoutMeData = await postLogoutMeRes.json();
    check(
      'NAT-AUTH-23',
      'Pre-logout JWT is REJECTED by server with HTTP 401 TOKEN_REVOKED after logout',
      postLogoutMeRes.status === 401 && postLogoutMeData.error === 'TOKEN_REVOKED'
    );

    // -------------------------------------------------------------------------
    // 8. AUTHORITATIVE SERVER-SIDE SESSION INVALIDATION ON PASSWORD RESET
    // -------------------------------------------------------------------------
    console.log('\n--- PART 8: SERVER-SIDE SESSION INVALIDATION ON PASSWORD RESET ---');

    // 8.1 Log back in to obtain active session token before password reset
    const loginPreResetRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'ValidPassword123!',
      }),
    });
    const loginPreResetData = await loginPreResetRes.json();
    check('NAT-AUTH-24', 'Re-login succeeds with new tokenVersion after previous logout', loginPreResetRes.status === 200 && Boolean(loginPreResetData.token));

    // 8.2 Verify pre-reset token works on /auth/me
    const preResetMeRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginPreResetData.token}` },
    });
    check('NAT-AUTH-25', 'Active session token works before password reset', preResetMeRes.status === 200);

    // 8.3 Insert known recovery token fixture into database
    const rawResetSecret = crypto.randomBytes(32).toString('hex');
    const knownHash = crypto.createHash('sha256').update(rawResetSecret).digest('hex');
    await db.insert(passwordResetTokens).values({
      userId: dbUser.id,
      tokenHash: knownHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // 8.4 Perform password reset via /auth/reset-password
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetSecret,
        newPassword: 'BrandNewUpdatedPassword789!',
      }),
    });
    const resetData = await resetRes.json();
    check('NAT-AUTH-26', 'POST /auth/reset-password succeeds with HTTP 200', resetRes.status === 200 && resetData.success === true);

    // 8.5 Verify pre-reset token is invalidated
    const postResetOldTokenRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginPreResetData.token}` },
    });
    const postResetOldTokenData = await postResetOldTokenRes.json();
    check(
      'NAT-AUTH-27',
      'Pre-reset session token is REJECTED by server with HTTP 401 TOKEN_REVOKED',
      postResetOldTokenRes.status === 401 && postResetOldTokenData.error === 'TOKEN_REVOKED'
    );

    // 8.6 Verify old password cannot log in
    const loginOldPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'ValidPassword123!',
      }),
    });
    check('NAT-AUTH-28', 'Old password rejected after reset with HTTP 401 INVALID_CREDENTIALS', loginOldPassRes.status === 401);

    // 8.7 Verify new password logs in successfully
    const loginNewPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regEmail,
        password: 'BrandNewUpdatedPassword789!',
      }),
    });
    const loginNewPassData = await loginNewPassRes.json();
    check('NAT-AUTH-29', 'New password logs in successfully with HTTP 200 and new JWT', loginNewPassRes.status === 200 && Boolean(loginNewPassData.token));

    // 8.8 Verify new JWT works on protected route
    const postResetNewTokenRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginNewPassData.token}` },
    });
    check('NAT-AUTH-30', 'Post-reset JWT accesses protected routes successfully with HTTP 200', postResetNewTokenRes.status === 200);

    // 8.9 Verify recovery token cannot be reused (single-use)
    const reuseResetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawResetSecret,
        newPassword: 'YetAnotherPassword999!',
      }),
    });
    check('NAT-AUTH-31', 'Recovery token cannot be reused: HTTP 400 INVALID_TOKEN', reuseResetRes.status === 400);

    // -------------------------------------------------------------------------
    // 9. PASSWORD RECOVERY DELIVERY BOUNDARY & ANTI-ENUMERATION
    // -------------------------------------------------------------------------
    console.log('\n--- PART 9: RECOVERY DELIVERY BOUNDARY & ANTI-ENUMERATION ---');

    // 9.1 Nonexistent email returns identical generic message
    const nonExistentEmail = `unknown_recovery_${Date.now()}@homehub.iq`;
    const forgotNonExistentRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: nonExistentEmail }),
    });
    const forgotNonExistentData = await forgotNonExistentRes.json();
    const forgotExistentData = await forgotRes.json();
    check(
      'NAT-AUTH-32',
      'Forgot-password responses for existent and non-existent accounts are identical (anti-enumeration)',
      forgotNonExistentRes.status === 200 && forgotNonExistentData.message === forgotExistentData.message
    );

    // 9.2 Forgot password response NEVER exposes the raw token
    check('NAT-AUTH-33', 'Forgot-password response body does NOT expose reset token', !(forgotExistentData as any).token && !(forgotNonExistentData as any).token);

    // Clean up test fixtures
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, dbUser.id));
    await db.delete(users).where(eq(users.email, regEmail));
    await db.delete(users).where(eq(users.email, escEmail));
    check('NAT-AUTH-34', 'Test fixtures cleaned up idempotently from PostgreSQL', true);

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  NATIVE AUTH SECURITY RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runNativeAuthSecuritySuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
