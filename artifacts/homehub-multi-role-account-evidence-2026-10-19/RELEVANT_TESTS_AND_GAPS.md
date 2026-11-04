# Relevant Tests & Test Gaps Audit

**Package**: `artifacts/homehub-multi-role-account-evidence-2026-10-19/`  
**Date**: 2026-10-19  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  
**Permitted Test Policy**: Authorized under AGENTS.md Rule 7 (Synthetic local tests against `homehub_test`, zero networkidle, bounded waits).

---

## 1. Executed Test Evidence

During this evidence preparation audit, two relevant test suites were physically executed against the local environment. Zero failures occurred:

### Suite 1: Registration Role Selection Enforcement
- **Command**: `npx tsx tests/role-selection-enforcement.test.tsx`
- **Execution Date**: 2026-10-19
- **Exit Code**: `0`
- **Total Assertions**: **56 PASSED / 0 FAILED**
- **Verified Behaviors**:
  * `TEST-1.1 – 1.7`: Clicking "Create an Account" from login initiates role selection (`Screen3Purpose`).
  * `TEST-2.1 – 2.3`: Cancelling and re-entering opens fresh role selection without stale selections.
  * `TEST-3.1 – 3.3`: Direct mounting of signup without selected role diverts to role selection.
  * `TEST-4.1 – 4.10`: All 4 canonical roles (`OWNER`, `TENANT`, `AGENT`, `VENDOR`) render with Kurdish titles and proper entity-type inputs.
  * `TEST-5.1 – 5.4`: Back navigation and return-to-login links operate correctly.
  * `TEST-6.1 – 6.11`: Sign-in form inputs and Quick Sign-in persona buttons remain intact.

### Suite 2: Native PostgreSQL Auth & Security Suite
- **Command**: `npx tsx tests/native-auth-security.test.ts`
- **Execution Date**: 2026-10-19
- **Exit Code**: `0`
- **Total Assertions**: **33 PASSED / 0 FAILED**
- **Verified Behaviors**:
  * `NAT-AUTH-01 – 04`: Argon2id password hashing and HS256 JWT claim signing/decoding.
  * `NAT-AUTH-05 – 07`: User registration stores Argon2id hash in PostgreSQL `users` table; password hash is stripped from API response.
  * `NAT-AUTH-08`: Duplicate email registration is rejected with HTTP 409 `EMAIL_ALREADY_EXISTS`.
  * `NAT-AUTH-09`: Client-claimed administrative role escalation is demoted to `TENANT`.
  * `NAT-AUTH-10 – 12`: Password credential verification; invalid passwords and unknown emails return HTTP 401.
  * `NAT-AUTH-13 – 15`: `GET /api/auth/me` verifies valid token; forged tokens rejected with HTTP 401.
  * `NAT-AUTH-16 – 17`: Suspended accounts (`isActive = false`) are rejected at login and on protected routes (HTTP 403).
  * `NAT-AUTH-18 – 20`: Password recovery token creation and anti-enumeration.
  * `NAT-AUTH-21 – 23`: Logout atomically bumps `token_version` in PostgreSQL; pre-logout token rejected with HTTP 401 `TOKEN_REVOKED`.
  * `NAT-AUTH-24 – 31`: Password reset invalidates old tokens via `token_version` increment and resets failed attempt counters.
  * `NAT-AUTH-32 – 34`: Anti-enumeration verification and clean database fixture teardown.

---

## 2. Inventory of Domain Authorization & Adversary Test Suites

The following additional test suites exist in the repository covering specific domain security boundaries:

| Test File | Covered Domain & Security Invariants | Permitted by AGENTS.md |
| :--- | :--- | :---: |
| `tests/owner-domain-idor-adversary.test.ts` | Owner property isolation; IDOR attacks trying to view or edit another owner's property | ✅ Yes |
| `tests/tenant-domain-adversary.test.ts` | Tenant lease bounds; prevents tenant from viewing or modifying unleased properties or units | ✅ Yes |
| `tests/agent-domain-adversary.test.ts` | Agent assignment isolation; ensures agent cannot access properties not in `agent_property_assignments` | ✅ Yes |
| `tests/vendor-domain-adversary.test.ts` | Vendor work order isolation; ensures vendor cannot access competing quotes or unassigned jobs | ✅ Yes |
| `tests/step14-f1-authorization.test.ts` | Financial authorization; ensures tenant cannot manipulate fees or view owner financial ledgers | ✅ Yes |

---

## 3. Critical Test Gaps for Multi-Role Implementation

The following automated tests are currently **MISSING** and must be created as part of the multi-role account implementation:

| Test Identifier | Required Test Specification | Current State | Risk Level |
| :--- | :--- | :---: | :---: |
| **GAP-TEST-01** | **Multi-Role Fresh Sign-In Prompt**: Verify that when an account with `roles: ['PROPERTY_OWNER', 'TENANT']` logs in, the response requires role selection and does not silently navigate to a default dashboard. | ❌ MISSING | **CRITICAL** |
| **GAP-TEST-02** | **Single-Role Auto-Navigation**: Verify that an account with exactly 1 role bypasses the role selection screen and lands directly on their dashboard. | ❌ MISSING | **HIGH** |
| **GAP-TEST-03** | **Add Role to Existing Account**: Verify that an authenticated user can add an additional role to their existing identity without receiving HTTP 409 or creating a duplicate user. | ❌ MISSING | **CRITICAL** |
| **GAP-TEST-04** | **Active Role Context Switching**: Verify that a user can switch their active working context (e.g. from Owner to Tenant) via an authorized endpoint and receive an updated session context. | ❌ MISSING | **HIGH** |
| **GAP-TEST-05** | **Revoked/Suspended Role Exclusion**: Verify that if a user's Agent license is `SUSPENDED` or company membership is `REMOVED`, that role is excluded from the post-login choice screen. | ❌ MISSING | **HIGH** |
| **GAP-TEST-06** | **Active Role Context Guard Enforcement**: Verify that an owner currently in Tenant context is denied access to mutating Owner routes unless they explicitly switch active context. | ❌ MISSING | **MEDIUM** |
| **GAP-TEST-07** | **Multi-Role Resource Permission Coexistence**: Verify that a user who owns Property A and rents Property B can successfully perform owner operations on Property A and tenant operations on Property B without permission collisions. | ❌ MISSING | **HIGH** |
