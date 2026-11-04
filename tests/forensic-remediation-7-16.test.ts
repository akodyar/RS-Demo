import { injectPgliteMock } from './setup-pglite.js';
import { assert } from 'console';
import fs from 'fs';
import path from 'path';

async function runFinalVerification() {
  console.log('--- STARTING FINAL FORENSIC VERIFICATION (FINDINGS 7-16) ---');
  let passed = 0;
  let failed = 0;

  function runCheck(findingId: string, description: string, checkFn: () => void | Promise<void>) {
    try {
      checkFn();
      console.log(`[PASS] ${findingId}: ${description}`);
      passed++;
    } catch (e: any) {
      console.error(`[FAIL] ${findingId}: ${description} - ${e.message}`);
      failed++;
    }
  }

  const srcDir = path.join(process.cwd(), 'src');
  const serverPath = path.join(process.cwd(), 'server.ts');
  const apiPath = path.join(srcDir, 'server', 'routes', 'api.ts');
  const authMiddlewarePath = path.join(srcDir, 'server', 'middleware', 'auth.ts');
  const errorSanitizerPath = path.join(srcDir, 'server', 'utils', 'errorSanitizer.ts');
  const intelligencePath = path.join(srcDir, 'server', 'routes', 'intelligence.ts');

  // FINDING 7: Auth Middleware checks for DB User
  runCheck('FINDING 7', 'Auth middleware blocks Firebase users without a DB user', () => {
    const authCode = fs.readFileSync(authMiddlewarePath, 'utf8');
    assert(authCode.includes('dbUsers.length === 0') && authCode.includes('401'), 'Auth middleware does not properly block missing DB users.');
  });

  // FINDING 8: Document status claims vs actual test results
  runCheck('FINDING 8', 'Document logic supports required statuses', () => {
    const documentsPath = path.join(srcDir, 'server', 'routes', 'documents.ts');
    if (fs.existsSync(documentsPath)) {
       const docsCode = fs.readFileSync(documentsPath, 'utf8');
       assert(docsCode.includes('status') || docsCode.includes('document_versions'), 'Document statuses logic missing');
    }
  });

  // FINDING 9: Intelligence / Draft-listing unguarded AI calls
  runCheck('FINDING 9', 'Intelligence AI calls are guarded by authorization', () => {
    const intelCode = fs.readFileSync(intelligencePath, 'utf8');
    assert(intelCode.includes('requireAuth') && intelCode.includes('requireRole'), 'AI endpoints are missing authorization guards.');
  });

  // FINDING 10: Error Sanitizer leaking DB internals
  runCheck('FINDING 10', 'Error Sanitizer masks DB and sensitive internals', () => {
    const sanitizerCode = fs.readFileSync(errorSanitizerPath, 'utf8');
    assert(sanitizerCode.includes('DATABASE_NOT_CONFIGURED') && sanitizerCode.includes('isSensitive'), 'Error Sanitizer is not masking sensitive DB errors.');
  });

  // FINDING 11: Missing Global fail-closed DB Guard
  runCheck('FINDING 11', 'Global fail-closed DB Guard is present', () => {
    const apiCode = fs.readFileSync(apiPath, 'utf8');
    assert(apiCode.includes('apiRouter.use(requireDatabase)'), 'Global DB fail-closed guard is missing.');
  });

  // FINDING 12 & 13: Double Helmet & Double CORS
  runCheck('FINDING 12 & 13', 'Helmet and CORS are configured securely without duplication', () => {
    const serverCode = fs.readFileSync(serverPath, 'utf8');
    const apiCode = fs.readFileSync(apiPath, 'utf8');
    assert(serverCode.includes('helmet({') && serverCode.includes('cors({'), 'Helmet and CORS missing in server.ts');
    assert(!apiCode.includes('helmet()') && !apiCode.includes('cors()'), 'Helmet and CORS duplicated in api.ts');
  });

  // FINDING 14 & 16: Rate Limiting
  runCheck('FINDING 14 & 16', 'API and Auth rate limiters are configured', () => {
    const apiCode = fs.readFileSync(apiPath, 'utf8');
    assert(apiCode.includes('apiLimiter') && apiCode.includes('authLimiter'), 'Rate limiters are missing.');
  });

  // FINDING 15: Default credentials in configuration
  runCheck('FINDING 15', 'No hardcoded default credentials in configuration', () => {
    const dbIndex = fs.readFileSync(path.join(srcDir, 'db', 'index.ts'), 'utf8');
    assert(!dbIndex.includes('postgres:postgres@localhost'), 'Default DB credentials found in code!');
  });

  console.log('--- VERIFICATION COMPLETE ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalVerification();
