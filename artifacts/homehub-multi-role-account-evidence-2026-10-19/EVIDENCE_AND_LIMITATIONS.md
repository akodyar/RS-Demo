# Evidence & Limitations Audit — Behavior Analysis

**Package**: `artifacts/homehub-multi-role-account-evidence-2026-10-19/`  
**Date**: 2026-10-19  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  
**Environment**: Local PostgreSQL (`homehub_test` on `localhost:5432`) / Node.js 20+ / React 19  

---

## 1. Evaluation of the 13 Required Behavioral Cases

Each mandatory product scenario has been rigorously evaluated against active repository code, database schema, and test execution results:

| # | Behavioral Scenario | Classification | Authoritative Evidence & Source Citation |
| :-: | :--- | :---: | :--- |
| **1** | **Account has only Owner role $\rightarrow$ direct Owner dashboard** | **VERIFIED** | `src/components/onboarding/OnboardingWorkflow.tsx:168-170` evaluates `userRole = dbUser.roles[0]`; lines 111–116 map `OWNER`/`PROPERTY_OWNER` to `/owner`. |
| **2** | **Account has only Tenant role $\rightarrow$ direct Tenant dashboard** | **VERIFIED** | `OnboardingWorkflow.tsx:117-118` maps `userRole = 'TENANT'` directly to `/tenant`. Single-role tenant navigates immediately without friction. |
| **3** | **Account has Owner and Tenant roles $\rightarrow$ show role-selection screen after every fresh sign-in** | **UNSUPPORTED** | **Critical Architectural Gap**: `OnboardingWorkflow.tsx:168` hardcodes `dbUser.roles[0]`. If a user has `['PROPERTY_OWNER', 'TENANT']`, it silently navigates to `/owner`. No role selection screen is shown on post-login. |
| **4** | **Account has all four roles $\rightarrow$ show all four eligible choices** | **UNSUPPORTED** | Same as Case 3: Fresh login possesses no selection step for authenticated users. The 4-role selection screen exists only during initial unauthenticated signup (`Screen3Purpose.tsx`). |
| **5** | **Account has a role that is revoked, suspended, or expired $\rightarrow$ do not offer it** | **PARTIAL** | Server routes independently reject suspended agents or vendors (`agentRouter.use`, `vendorRouter.use`), but `users.roles` string array and the UI do not dynamically filter out suspended roles before presenting choices. |
| **6** | **User tampers with active role in request $\rightarrow$ server authorization still denies access** | **VERIFIED** | `src/server/middleware/auth.ts:514-697` (`requirePropertyPermission`) queries PostgreSQL tables `ownership_records`, `management_agreements`, `lease_tenants`, `agent_property_assignments`, and `work_orders`. Client-forged role claims fail relational checks. |
| **7** | **User has Owner role for Prop A and Tenant role for Prop B $\rightarrow$ preserve correct permissions** | **VERIFIED** | `requirePropertyPermission` independently validates Scenario 1 (ownership for Prop A) and Scenario 3 (active lease for Prop B). Repositories (`properties.ts` and `tenant.ts`) isolate data by resource foreign keys. |
| **8** | **Agent authorized for Owner A's listing attempts Owner B's property $\rightarrow$ deny access** | **VERIFIED** | `agentRepository.getAssignedProperties` (`src/server/repositories/agent.ts:1273-1285`) strictly enforces `agent_property_assignments.userId = userId AND status = 'ACTIVE'`. Foreign properties return HTTP 403/404. |
| **9** | **Vendor has Job A but attempts to access Vendor B's Job $\rightarrow$ deny access** | **VERIFIED** | `vendorRepository.getWorkOrders` (`src/server/repositories/vendor.ts:297-304`) filters work orders strictly to `vendorUserId = userId OR assignedTechnicianId = userId OR vendorId = profile.id`. Foreign work orders return HTTP 404/403. |
| **10** | **Existing user registers/selects another role $\rightarrow$ no duplicate identity or security weakening** | **UNSUPPORTED** | **Critical Architectural Gap**: `src/server/routes/auth.ts:79-82, 127` rejects existing emails with HTTP 409 `EMAIL_ALREADY_EXISTS`. There is zero API to enroll an existing account into a second role. Users are currently forced to create duplicate accounts with alternate emails. |
| **11** | **User logs out and another user signs in on same browser $\rightarrow$ zero role/identity leakage** | **PARTIAL** | `AuthProvider.tsx:413-432` removes tokens and persona from `localStorage` and resets React state. However, unmanaged browser caches or tabs remaining open without reload could retain stale view state if not guarded by unified unmounting. |
| **12** | **Org membership changes or session revoked $\rightarrow$ enforce authoritative current permissions** | **VERIFIED** | `src/server/middleware/auth.ts:452-463` checks `tokenVersion` against `users.token_version` on every request. Logout/password reset bumps version, returning HTTP 401 `TOKEN_REVOKED` (verified by `NAT-AUTH-23`). Org membership checks `organization_members.status = 'ACTIVE'` live. |
| **13** | **Role-selection screen localized correctly in Sorani/Arabic RTL and English LTR** | **VERIFIED** | `Screen3Purpose.tsx:80-84` and `Screen6RoleConfirmation.tsx:88-98` use `useI18n()` with `dir={direction}` and font classes (`font-arabic` vs `font-sans`). Kurdish translations verified by `tests/role-selection-enforcement.test.tsx` (56/56 passed). |

---

## 2. Record of Executed Commands & Exit Codes

All diagnostic commands were executed synchronously or via background tasks without altering application source code:

```powershell
# 1. Directory Existence Check
Test-Path 'artifacts/homehub-multi-role-account-evidence-2026-10-19'
# Exit Code: 0 | Output: False (confirmed fresh destination)

# 2. Kaywan Instructions Inspection
view_file Kaywan_Latest_Instructions.txt (Lines 1-100)
# Exit Code: 0 | Output: Verified fail-closed database least-privilege status

# 3. Role Selection Enforcement Test Suite
npx tsx tests/role-selection-enforcement.test.tsx
# Exit Code: 0 | Output: 56 PASSED / 0 FAILED (Test ID: task-7849)

# 4. Native PostgreSQL Authentication Security Suite
npx tsx tests/native-auth-security.test.ts
# Exit Code: 0 | Output: 33 PASSED / 0 FAILED (Test ID: task-7862)

# 5. Git Worktree Verification
git rev-parse --show-toplevel; git rev-parse --abbrev-ref HEAD; git rev-parse HEAD
# Exit Code: 0 | Output: main | 43175adaf6f04491e1d74e1f728a4561b7ede097

# 6. Git Status Change Counts
node -e "git status counts"
# Exit Code: 0 | Output: {"total":657,"staged":291,"unstaged":182,"untracked":302}

# 7. Checksum Computation & Verification
node -e "SHA-256 verification of 12 source bundle files"
# Exit Code: 0 | Output: All SHA-256 hashes match: true
```

---

## 3. Limitations & Unavailable Evidence

1. **Production Isolation**:
   - Zero tests were run against `homehub_production`. All database queries, transactions, and tests ran exclusively against local `homehub_test` on `localhost:5432`.
2. **Third-Party External Services**:
   - Live SMS OTP delivery (Zain, Fastlink, Korek) was not tested with live cellular networks; the application enforces clean fail-closed provider adapters (`EmailProviderAdapter` / `SmsProviderAdapter`).
3. **Rental-Only Scope Preservation**:
   - In accordance with `AGENTS.md` and `Kaywan_Latest_Instructions.txt`, Buy/Sell features (`buyerProfiles`, `salesContracts`, `propertyOffers`) were not verified or enabled, preserving the stable rental release boundary.
