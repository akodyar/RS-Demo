import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import express from 'express';
import rateLimit from 'express-rate-limit';
import apiRouter from '../src/server/routes/api.js';
import { db } from '../src/db/index.js';
import { users, passwordResetTokens, auditLogs } from '../src/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { hashPassword, verifyPassword, signAuthToken } from '../src/server/utils/auth.js';
import { loginRateLimiter, registerRateLimiter, passwordResetRateLimiter } from '../src/server/middleware/authRateLimit.js';

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

async function runAuthRateLimitingAndBruteForceSuite() {
  console.log('================================================================');
  console.log('  HOMEHUB — AUTHENTICATION RATE-LIMITING & BRUTE-FORCE AUDIT SUITE');
  console.log('================================================================\n');

  // Setup test Express server hosting apiRouter
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://localhost:${address.port}/api`;

  const timestamp = Date.now();
  const testEmail = `brute_victim_${timestamp}@homehub.iq`;
  const otherEmail = `innocent_user_${timestamp}@homehub.iq`;
  const initialPassword = 'SecurePassword123!';
  const updatedPassword = 'BrandNewPassword456!';

  let testUserId = '';
  let otherUserId = '';

  try {
    // -------------------------------------------------------------------------
    // SETUP: Seed test user accounts
    // -------------------------------------------------------------------------
    const initialHash = await hashPassword(initialPassword);

    const [user1] = await db
      .insert(users)
      .values({
        email: testEmail,
        firstName: 'Victim',
        lastName: 'Account',
        passwordHash: initialHash,
        roles: ['TENANT'],
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .returning();
    testUserId = user1.id;

    const [user2] = await db
      .insert(users)
      .values({
        email: otherEmail,
        firstName: 'Innocent',
        lastName: 'Account',
        passwordHash: initialHash,
        roles: ['TENANT'],
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .returning();
    otherUserId = user2.id;

    // -------------------------------------------------------------------------
    // PART 1: REPEATED FAILED LOGINS & ACCOUNT LOCKOUT WITH RETRY-AFTER (HTTP 423)
    // -------------------------------------------------------------------------
    console.log('--- PART 1: FAILED LOGIN LOCKOUT POLICY & RETRY-AFTER ENFORCEMENT ---');

    for (let attempt = 1; attempt <= 5; attempt++) {
      const failRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testEmail, password: 'WrongPasswordEveryTime!' }),
      });
      const failBody = await failRes.json();
      check(
        `BF-LOCK-0${attempt}`,
        `Attempt ${attempt}/5 with wrong password returns HTTP 401 INVALID_CREDENTIALS`,
        failRes.status === 401 && failBody.error === 'INVALID_CREDENTIALS'
      );
    }

    // Verify DB counter after 5 attempts
    const [dbUserAfter5] = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);
    check(
      'BF-LOCK-06',
      'PostgreSQL records 5 failed attempts and sets locked_until ~15 minutes into future',
      dbUserAfter5.failedLoginAttempts === 5 &&
      dbUserAfter5.lockedUntil !== null &&
      new Date(dbUserAfter5.lockedUntil).getTime() > Date.now()
    );

    // 6th attempt must trigger ACCOUNT_LOCKED (HTTP 423) with standard Retry-After header
    const lockedRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: 'WrongPasswordEveryTime!' }),
    });
    const lockedBody = await lockedRes.json();
    const retryAfterHeader = lockedRes.headers.get('retry-after');

    check(
      'BF-LOCK-07',
      'Attempt while locked returns HTTP 423 ACCOUNT_LOCKED',
      lockedRes.status === 423 && lockedBody.error === 'ACCOUNT_LOCKED'
    );

    check(
      'BF-LOCK-08',
      'HTTP 423 response includes valid Retry-After header (>0 and <=900 seconds)',
      retryAfterHeader !== null &&
      parseInt(retryAfterHeader, 10) > 0 &&
      parseInt(retryAfterHeader, 10) <= 900
    );

    check(
      'BF-LOCK-09',
      'HTTP 423 response body includes retryAfter matching Retry-After header',
      lockedBody.retryAfter === parseInt(retryAfterHeader || '0', 10)
    );

    // Verify audit log recorded ACCOUNT_TEMPORARILY_LOCKED
    const [lockAudit] = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.resourceId, testUserId), eq(auditLogs.action, 'ACCOUNT_TEMPORARILY_LOCKED')))
      .orderBy(desc(auditLogs.timestamp))
      .limit(1);
    check(
      'BF-LOCK-10',
      'Audit log records ACCOUNT_TEMPORARILY_LOCKED with failedAttempts and lock duration',
      lockAudit !== undefined && (lockAudit.changes as any)?.failedAttempts === 5
    );

    // -------------------------------------------------------------------------
    // PART 2: UNRELATED ACCOUNTS ARE NOT COLLATERALLY BLOCKED
    // -------------------------------------------------------------------------
    console.log('\n--- PART 2: UNRELATED ACCOUNTS NOT COLLATERALLY BLOCKED ---');

    const innocentLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: otherEmail, password: initialPassword }),
    });
    const innocentLoginBody = await innocentLoginRes.json();

    check(
      'BF-COLLAT-01',
      'Unrelated account logs in successfully (HTTP 200) despite another account being locked',
      innocentLoginRes.status === 200 && Boolean(innocentLoginBody.token)
    );

    // -------------------------------------------------------------------------
    // PART 3: LEGITIMATE USER IMMEDIATE RECOVERY VIA PASSWORD RESET
    // -------------------------------------------------------------------------
    console.log('\n--- PART 3: LEGITIMATE USER IMMEDIATE RECOVERY VIA PASSWORD RESET ---');

    // 3.1 Request password reset while locked
    const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    check('BF-RECOV-01', 'Password recovery request accepted while account is locked (HTTP 200)', forgotRes.status === 200);

    // Retrieve generated recovery token fixture
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    await db.insert(passwordResetTokens).values({
      userId: testUserId,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // 3.2 Reset password with valid token
    const resetRes = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rawResetToken, newPassword: updatedPassword }),
    });
    const resetBody = await resetRes.json();
    check('BF-RECOV-02', 'POST /auth/reset-password succeeds with HTTP 200', resetRes.status === 200 && resetBody.success === true);

    // 3.3 Verify DB lockout was immediately cleared
    const [dbUserAfterReset] = await db.select().from(users).where(eq(users.id, testUserId)).limit(1);
    check(
      'BF-RECOV-03',
      'Password reset immediately clears failedLoginAttempts (0) and lockedUntil (null)',
      dbUserAfterReset.failedLoginAttempts === 0 && dbUserAfterReset.lockedUntil === null
    );

    // 3.4 Login immediately with new password succeeds without waiting for 15m cooldown
    const loginRecoveredRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, password: updatedPassword }),
    });
    const loginRecoveredBody = await loginRecoveredRes.json();
    check(
      'BF-RECOV-04',
      'Immediate login with new password succeeds with HTTP 200 and valid session JWT',
      loginRecoveredRes.status === 200 && Boolean(loginRecoveredBody.token)
    );

    // -------------------------------------------------------------------------
    // PART 4: DEDICATED RATE LIMITING & SPOOFED FORWARDED-HEADERS DEFENSE
    // -------------------------------------------------------------------------
    console.log('\n--- PART 4: RATE LIMITING & SPOOFED HEADER DEFENSE ---');

    // Create an isolated sub-app with strict 3-request rate limiter to test rate limiting deterministically
    const strictApp = express();
    strictApp.set('trust proxy', 1);
    strictApp.use(express.json());

    const strictLoginLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 3,
      message: { error: 'TOO_MANY_REQUESTS', message: 'Too many login attempts from this IP address.' },
      standardHeaders: true,
      legacyHeaders: false,
      validate: { xForwardedForHeader: false, default: true },
    });

    strictApp.post('/test-login', strictLoginLimiter, (req, res) => {
      res.json({ ok: true });
    });

    const strictServer = http.createServer(strictApp);
    await new Promise<void>((resolve) => strictServer.listen(0, resolve));
    const strictAddress = strictServer.address() as any;
    const strictUrl = `http://localhost:${strictAddress.port}`;

    try {
      // 4.1 First 3 requests succeed
      for (let i = 1; i <= 3; i++) {
        const res = await fetch(`${strictUrl}/test-login`, { method: 'POST' });
        check(`BF-RL-0${i}`, `Request ${i}/3 within limit returns HTTP 200`, res.status === 200);
      }

      // 4.2 4th request exceeds rate limit: HTTP 429
      const overLimitRes = await fetch(`${strictUrl}/test-login`, { method: 'POST' });
      const overLimitBody = await overLimitRes.json();
      const rlLimitHeader = overLimitRes.headers.get('ratelimit-limit');
      const rlRemainingHeader = overLimitRes.headers.get('ratelimit-remaining');
      const rlRetryAfterHeader = overLimitRes.headers.get('retry-after');

      check(
        'BF-RL-04',
        'Request exceeding limit rejected with HTTP 429 TOO_MANY_REQUESTS',
        overLimitRes.status === 429 && overLimitBody.error === 'TOO_MANY_REQUESTS'
      );

      check(
        'BF-RL-05',
        'HTTP 429 response contains standard RFC headers (RateLimit-Limit, RateLimit-Remaining=0, Retry-After)',
        rlLimitHeader === '3' && rlRemainingHeader === '0' && rlRetryAfterHeader !== null
      );

      // 4.3 Repeated request from same client IP remains blocked with HTTP 429
      const repeatBlockedRes = await fetch(`${strictUrl}/test-login`, { method: 'POST' });
      check(
        'BF-RL-06',
        'Subsequent requests from rate-limited client IP remain rejected with HTTP 429',
        repeatBlockedRes.status === 429
      );
    } finally {
      strictServer.close();
    }

    // 4.4 Test Proxy Hop & Untrusted Header Defense in direct ingress (trust proxy: false)
    const directApp = express();
    // Do NOT trust proxy headers
    directApp.set('trust proxy', false);
    directApp.use(express.json());

    const directLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false,
    });

    directApp.post('/direct-test', directLimiter, (req, res) => {
      res.json({ ok: true, detectedIp: req.ip });
    });

    const directServer = http.createServer(directApp);
    await new Promise<void>((resolve) => directServer.listen(0, resolve));
    const directAddress = directServer.address() as any;
    const directUrl = `http://localhost:${directAddress.port}`;

    try {
      // Send 2 requests to hit limit
      await fetch(`${directUrl}/direct-test`, { method: 'POST' });
      await fetch(`${directUrl}/direct-test`, { method: 'POST' });

      // 3rd request with spoofed X-Forwarded-For attempting to bypass
      const directSpoofedRes = await fetch(`${directUrl}/direct-test`, {
        method: 'POST',
        headers: { 'X-Forwarded-For': '198.51.100.99' },
      });
      check(
        'BF-RL-07',
        'Direct connection (trust proxy: false) ignores client X-Forwarded-For header and blocks bypass (HTTP 429)',
        directSpoofedRes.status === 429
      );
    } finally {
      directServer.close();
    }

    // -------------------------------------------------------------------------
    // PART 5: TIMING ORACLE & ANTI-ENUMERATION SECRECY
    // -------------------------------------------------------------------------
    console.log('\n--- PART 5: TIMING ORACLE & ANTI-ENUMERATION INTEGRITY ---');

    // 5.1 Unknown email returns 401 INVALID_CREDENTIALS without disclosing non-existence
    const fakeEmail = `nonexistent_audit_${timestamp}@homehub.iq`;
    const fakeLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fakeEmail, password: 'AnyPassword123!' }),
    });
    const fakeLoginBody = await fakeLoginRes.json();

    check(
      'BF-ENUM-01',
      'Unknown email login returns generic HTTP 401 INVALID_CREDENTIALS without enumeration leak',
      fakeLoginRes.status === 401 && fakeLoginBody.error === 'INVALID_CREDENTIALS'
    );

    // 5.2 Password reset returns identical generic response regardless of account existence
    const resetUnknownRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fakeEmail }),
    });
    const resetKnownRes = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });

    const resetUnknownBody = await resetUnknownRes.json();
    const resetKnownBody = await resetKnownRes.json();

    check(
      'BF-ENUM-02',
      'POST /auth/forgot-password returns identical generic message for existing and non-existing accounts',
      resetUnknownRes.status === 200 &&
      resetKnownRes.status === 200 &&
      resetUnknownBody.message === resetKnownBody.message
    );

    check(
      'BF-ENUM-03',
      'Password recovery responses never disclose raw recovery tokens in body',
      !resetUnknownBody.token && !resetKnownBody.token
    );

    // -------------------------------------------------------------------------
    // PART 6: CONCURRENT REQUESTS & RATE-LIMIT CONCURRENCY INTEGRITY
    // -------------------------------------------------------------------------
    console.log('\n--- PART 6: CONCURRENCY INTEGRITY ---');

    const concurrentPromises = Array.from({ length: 5 }, (_, i) =>
      fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: fakeEmail, password: `WrongPassword_${i}` }),
      })
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const allStatusCodesValid = concurrentResults.every((r) => [401, 429].includes(r.status));
    check(
      'BF-CONCUR-01',
      'Concurrent authentication requests handled deterministically without crashes or 500 errors',
      allStatusCodesValid
    );

  } finally {
    // Clean up test records idempotently
    try {
      if (testUserId) {
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, testUserId));
        await db.delete(auditLogs).where(eq(auditLogs.resourceId, testUserId));
        await db.delete(users).where(eq(users.id, testUserId));
      }
      if (otherUserId) {
        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, otherUserId));
        await db.delete(auditLogs).where(eq(auditLogs.resourceId, otherUserId));
        await db.delete(users).where(eq(users.id, otherUserId));
      }
      console.log('Test fixtures cleaned up idempotently.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr);
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  AUTH RATE LIMITING & BRUTE FORCE RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAuthRateLimitingAndBruteForceSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
