# HomeHub — Multi-Role Active Workspace Context Remediation Report

**Date**: October 20, 2026  
**Lead Systems Engineer**: Lead Full-Stack & Systems Engineering Agent  
**Task Scope**: Active-Workspace Authorization Verification & Remediation for Agent, Vendor, and Company Domain Routers  
**Target Environment**: Isolated Local Test Database (`homehub_test` on `localhost:5432`)  
**Production Access**: None (Strictly prohibited and verified)  
**Browser Testing Protocol**: Option C (Project-Local Playwright v1.63.0)  

---

## 1. Initial Git & Working Tree Status

Before making any changes, the repository branch and working tree were inspected:
- **Active Git Branch**: `main`
- **Initial Working Tree Baseline**: Exactly 676 files in `git status --porcelain`.
- **Preservation Policy**: All pre-existing user modifications, untracked files, and deletions were preserved without resetting, cleaning, stashing, or reverting.

---

## 2. Source-Level Audit Findings & Defect Confirmation

Prior to code edits, the actual current implementations of `src/server/routes/agent.ts`, `src/server/routes/vendor.ts`, `src/server/routes/company.ts`, `src/server/routes/owner.ts`, `src/server/routes/tenant.ts`, and `src/server/middleware/auth.ts` were audited:

### A. Agent Router (`src/server/routes/agent.ts`)
- **Pre-Remediation State**: Mounted `requireAuth` followed by a custom middleware inspecting `req.user?.roles`. It checked whether any of `[AGENT_BROKER, COMPANY_MEMBER, PLATFORM_ADMIN, AGENT, ...]` were present in the static database roles array.
- **Defect Confirmed**: The router did **not** mount `requireActiveRole`. Consequently, a multi-role user who held `['TENANT', 'AGENT']` and was active in the `TENANT` workspace (`activeRole='TENANT'`) was permitted to invoke `GET /api/agent/dashboard` without switching workspaces.
- **Baseline Test Evidence**: In `task-1633`, `AG-ACT-01` failed with HTTP 200 OK (unauthorized tenant context returned agent dashboard payload).

### B. Vendor Router (`src/server/routes/vendor.ts`)
- **Pre-Remediation State**: Mounted `requireAuth` followed by a custom gatekeeper checking `req.user?.roles.some(role => [VENDOR, ...].includes(role))`.
- **Defect Confirmed**: The router did **not** mount `requireActiveRole`. A user with `['TENANT', 'VENDOR']` and active `TENANT` workspace was permitted to call `GET /api/vendor/work-orders` without establishing the active vendor workspace context.
- **Baseline Test Evidence**: In `task-1633`, `VN-ACT-01` failed with HTTP 200 OK (unauthorized tenant context returned vendor work orders).

### C. Company Router (`src/server/routes/company.ts`)
- **Pre-Remediation State**: Did not mount router-level middleware. Individual routes mounted `requireAuth, requireRole(ALLOWED_COMPANY_ROLES), requireDatabase`. `requireRole` checks only the static `user.roles` array.
- **Defect Confirmed**: A multi-role user holding `COMPANY_MEMBER` who was active in `TENANT` or personal `PROPERTY_OWNER` workspace was permitted to invoke company routes. Furthermore, assigned `VIEWER` members claiming `activeRole='COMPANY_ADMIN'` bypassed role containment, and neutral tokens (`activeRole=null`) were permitted through the middleware boundary.
- **Baseline Test Evidence**: In `task-1633`, `CO-ACT-01` and `CO-ACT-02` failed to fail closed at the middleware level, passing into the repository and throwing uncaught exceptions, while `CO-ACT-04` and `CO-ACT-05` returned HTTP 200 OK to unauthorized roles and mismatched workspaces.

---

## 3. Root Cause & Production Code Modifications

### Root Cause
When the FIND-01 security fix was initially implemented, `requireActiveRole` was attached to `ownerRouter` and `tenantRouter`, but was omitted from `agentRouter`, `vendorRouter`, and `companyRouter`. While resource-level authorization existed for individual items, the domain-level active workspace context was not enforced at the router boundary for these three domains.

### Files Modified & Exact Remediation Applied

1. **`src/server/routes/agent.ts`**:
   - Exported `ALLOWED_AGENT_WORKSPACE_ROLES`:
     ```typescript
     export const ALLOWED_AGENT_WORKSPACE_ROLES: (UserRole | string)[] = [
       UserRole.AGENT_BROKER,
       'AGENT',
       'AGENT_BROKER',
       UserRole.PLATFORM_ADMIN,
       'SUPER_ADMIN',
       'ADMIN',
     ];
     ```
   - Mounted `agentRouter.use(requireActiveRole(ALLOWED_AGENT_WORKSPACE_ROLES));` directly after `agentRouter.use(requireAuth);`.
   - Result: In-flight requests without active `AGENT` or `AGENT_BROKER` context fail closed with `403 INCORRECT_ACTIVE_ROLE_CONTEXT` (`WORKSPACE_CONTEXT_REQUIRED`). Platform Admin retains emergency oversight.

2. **`src/server/routes/vendor.ts`**:
   - Exported `ALLOWED_VENDOR_WORKSPACE_ROLES`:
     ```typescript
     export const ALLOWED_VENDOR_WORKSPACE_ROLES: (UserRole | string)[] = [
       UserRole.VENDOR,
       'VENDOR',
       UserRole.PLATFORM_ADMIN,
       'SUPER_ADMIN',
       'ADMIN',
     ];
     ```
   - Mounted `vendorRouter.use(requireActiveRole(ALLOWED_VENDOR_WORKSPACE_ROLES));` directly after `vendorRouter.use(requireAuth);`.
   - Result: In-flight requests without active `VENDOR` context fail closed with `403 INCORRECT_ACTIVE_ROLE_CONTEXT`.

3. **`src/server/routes/company.ts`**:
   - Exported `ALLOWED_COMPANY_WORKSPACE_ROLES`:
     ```typescript
     export const ALLOWED_COMPANY_WORKSPACE_ROLES: (UserRole | string)[] = [
       UserRole.COMPANY,
       UserRole.COMPANY_MEMBER,
       'COMPANY_OWNER',
       'COMPANY_ADMIN',
       'PROPERTY_MANAGER',
       'ACCOUNTANT',
       'MAINTENANCE_MANAGER',
       'VIEWER',
       'AGENT',
       UserRole.PLATFORM_ADMIN,
       'SUPER_ADMIN',
       'ADMIN',
     ];
     ```
   - Mounted `router.use(requireAuth);` and `router.use((req, res, next) => { if (req.path === '/onboard') return next(); return requireActiveRole(ALLOWED_COMPANY_WORKSPACE_ROLES)(req, res, next); });`.
   - Result: All company operational endpoints (`/dashboard`, `/profile`, `/properties`, `/members`, `/approvals`, etc.) enforce active company workspace context, company binding (`company_${orgId}`), active membership, and role containment (`isCompanyRolePermitted`). `POST /api/company/onboard` is preserved for authenticated users creating an initial company organization.

4. **`src/server/middleware/auth.ts`**:
   - Updated `hasDirectRole` in `requireActiveRole` to provide complete bidirectional equivalence between `AGENT` and `AGENT_BROKER`:
     ```typescript
     (normalizedActive === 'AGENT_BROKER' && (userRoles.includes('AGENT') || userRoles.includes('BROKER'))) ||
     (normalizedActive === 'AGENT' && (userRoles.includes('AGENT_BROKER') || userRoles.includes('BROKER')))
     ```

5. **`tests/agent-vendor-active-role-guard.test.ts`** (New Test Suite):
   - Created a comprehensive 19-scenario integration test suite verifying fail-closed and authorized paths across all 3 routers with real database fixtures.

---

## 4. Security Behavior Comparison

| Vector / Scenario | Pre-Remediation Behavior | Post-Remediation Behavior |
| :--- | :--- | :--- |
| **Active `TENANT` calling `/api/agent/dashboard`** | **Vulnerable**: Permitted (HTTP 200 OK) | **Secured**: Blocked with `403 INCORRECT_ACTIVE_ROLE_CONTEXT` |
| **Neutral token calling `/api/agent/dashboard`** | **Vulnerable**: Permitted (HTTP 200 OK) | **Secured**: Blocked with `403 WORKSPACE_CONTEXT_REQUIRED` |
| **Active `TENANT` calling `/api/vendor/work-orders`** | **Vulnerable**: Permitted (HTTP 200 OK) | **Secured**: Blocked with `403 INCORRECT_ACTIVE_ROLE_CONTEXT` |
| **Neutral token calling `/api/vendor/work-orders`** | **Vulnerable**: Permitted (HTTP 200 OK) | **Secured**: Blocked with `403 WORKSPACE_CONTEXT_REQUIRED` |
| **Active `TENANT` calling `/api/company/dashboard`** | **Vulnerable**: Passed guard, uncaught 500 error | **Secured**: Blocked with `403 INCORRECT_ACTIVE_ROLE_CONTEXT` |
| **`VIEWER` asserting `COMPANY_ADMIN` on `/company`** | **Vulnerable**: Permitted (HTTP 200 OK) | **Secured**: Blocked with `403 FORBIDDEN_ACTIVE_ROLE_MISMATCH` |
| **Mismatched `workspaceId` on `/company/dashboard`** | **Vulnerable**: Permitted (HTTP 200 OK) | **Secured**: Blocked with `403 FORBIDDEN_ACTIVE_ROLE_MISMATCH` |
| **Platform Admin emergency oversight** | Maintained | Maintained across all 3 domains |
| **Company `/onboard` for new organizations** | Permitted with `requireAuth` | Permitted with `requireAuth` |

---

## 5. Verification Commands, Exit Codes, and Evidence

All tests executed against the isolated local test database (`homehub_test`) and completed with **exit code 0**:

1. **Focused Active Workspace Guard Suite**:
   - `npx tsx tests/agent-vendor-active-role-guard.test.ts`
   - Exit Code: `0` (19 passed, 0 failed, duration: ~3.8s)
2. **Multi-Role Account Integrity Regression Suite**:
   - `npx tsx tests/multi-role-account-integrity.test.ts`
   - Exit Code: `0` (48 passed, 0 failed, duration: ~5.6s)
3. **Owner/Tenant Route Guard Regression Suite**:
   - `npx tsx tests/find01-active-workspace-guard.test.ts`
   - Exit Code: `0` (14 passed, 0 failed, duration: ~3.8s)
4. **Company Authority & Session Revocation Suite**:
   - `npx tsx tests/company-workspace-authority-remediation.test.ts`
   - Exit Code: `0` (16 passed, 0 failed, duration: ~4.9s)
5. **Native Authentication Security Suite**:
   - `npx tsx tests/native-auth-security.test.ts`
   - Exit Code: `0` (33 passed, 0 failed, duration: ~4.2s)
6. **Multi-Role UI Localization Suite**:
   - `npx tsx tests/multi-role-ui.test.tsx`
   - Exit Code: `0` (20 passed, 0 failed, duration: ~2.8s)
7. **Onboarding & Role Selection Enforcement Suite**:
   - `npx tsx tests/role-selection-enforcement.test.tsx`
   - Exit Code: `0` (56 passed, 0 failed, duration: ~3.1s)
8. **Frontend Production Build**:
   - `npx vite build`
   - Exit Code: `0` (2804 modules transformed, built in 22.84s)

**Total automated assertions verified in this task: 206 passed, 0 failed.**

---

## 6. Browser and Visual Testing Status

- **Status**: **Explicitly NOT RUN for this task**.
- **Reason**: The remediation consists entirely of server-side middleware router guards (`requireActiveRole`) on API endpoints (`/api/agent/*`, `/api/vendor/*`, `/api/company/*`). HTTP-level integration tests with full database fixtures (`tests/agent-vendor-active-role-guard.test.ts`) provide the authoritative proof for API route rejection and admission.
- **Existing Genuine UI Evidence**: Full visual evidence for multi-role workspace selection and company workspace authority is captured and preserved in `screenshots/multi_role_audit/*.png` (6 files) and `screenshots/company_auth/*.png` (5 files) via Project-Local Playwright (Option C).

---

## 7. Working Tree Integrity

- **Pre-execution tracked files modified**: Only the authorized files (`src/server/routes/agent.ts`, `src/server/routes/vendor.ts`, `src/server/routes/company.ts`, `src/server/middleware/auth.ts`, and the new test `tests/agent-vendor-active-role-guard.test.ts`).
- **Pre-existing unstaged/untracked files**: Exactly preserved; zero files reset, cleaned, or stashed.
- **Production Status**: Zero connections, writes, or deployments to production.

---

## 8. Remaining Multi-Role Backlog (Documented Follow-Ups)

As mandated by Section 6 of the instructions, the following issues are documented for subsequent scheduled tasks:

1. **Tenant Dashboard Switcher Defect**: `TenantWorkspacePage.tsx:955-961` mounts `SwitchAccountModal` switching mock personas ("Ahmed Farhad", "Salar Aziz") via `setDevPersona` instead of calling `selectWorkspace()`.
2. **Agent and Vendor In-Dashboard Switchers**: `AgentWorkspace.tsx` and `VendorWorkspacePage.tsx` lack an in-dashboard workspace switcher, and `Layout.tsx:37` hides the header on `/agent`.
3. **Owner Profile Switcher E2E Test**: `OwnerWorkspacePage.tsx:1058-1084` implements workspace switching via profile dropdown, but requires dedicated Playwright click verification.
4. **BiDi Text Isolation**: Company titles with mixed Latin and Arabic/Kurdish characters in `ScreenSelectWorkspace.tsx` should be wrapped in `<bdi>` or `<span dir="ltr">`.
5. **Edge Enrollment Branches**: Automated tests for company entity self-enrollment (`entityType='COMPANY'`), duplicate role enrollment deduplication, and invalid role string rejection.

---

## 9. Conclusion & Single Recommended Next Step

With active-workspace guards now active on `ownerRouter`, `tenantRouter`, `agentRouter`, `vendorRouter`, and `companyRouter`, **all five HomeHub domain routers enforce authoritative server-side active workspace context**.

**Recommended Next Step**:
Proceed to resolve the frontend switcher defect in the Tenant Workspace: replace the development `SwitchAccountModal` in `src/pages/TenantWorkspacePage.tsx` with an authoritative workspace switcher that fetches `eligibleWorkspaces` and invokes `selectWorkspace()`.
