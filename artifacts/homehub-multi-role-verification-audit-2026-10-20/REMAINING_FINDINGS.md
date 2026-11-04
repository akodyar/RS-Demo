# Multi-Role Implementation — Remaining Findings Register

**Date**: 2026-10-20  
**Audit Type**: Independent Post-Implementation Verification  
**Policy**: Non-invasive audit (zero application code modifications made)  

---

## Findings Summary Matrix

| ID | Title | Severity | Impact Area | Status | Recommended Action |
| :---: | :--- | :---: | :--- | :---: | :--- |
| **FIND-01** | `requireActiveRole` defined but not attached to domain routes | **MEDIUM** | API Authorization Layer | OPEN | Wire `requireActiveRole` to router entry guards |
| **FIND-02** | Stale `organizationId` in JWT upon membership revocation without token bump | **MEDIUM** | Session Revocation | OPEN | Bump `tokenVersion` on member revocation |
| **FIND-03** | `requireActiveAgent` selectively applied to listing creation | **LOW** | Agent Operational Scope | OPEN | Add guard to secondary agent mutation endpoints |

---

## Detailed Findings & Forensics

### FIND-01 (MEDIUM): `requireActiveRole` Middleware Defined but Not Attached to Domain Route Routers

- **Source Reference**: [`src/server/middleware/auth.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/middleware/auth.ts#L517-L540)
- **Description**:
  The `requireActiveRole(allowedRoles)` middleware was successfully authored in `src/server/middleware/auth.ts`. It strictly verifies that `req.user.activeRole` matches one of the expected roles for the workspace. However, inspection of `src/server/routes/owner.ts`, `tenant.ts`, `agent.ts`, `vendor.ts`, and `company.ts` reveals that this middleware is not currently attached to the route handlers. Instead, the routes continue to rely on `requireRole` (which tests if the user has the role anywhere in their `user.roles` array) in combination with granular resource-level guards (`requirePropertyPermission`, `requireActiveLease`, etc.).
- **Security Assessment**:
  - **Resource-Level Security**: Uncompromised. An owner who is also a tenant cannot access properties they do not own or leases they are not party to, because `ownershipRecords` and `leaseTenants` are independently checked in PostgreSQL.
  - **Workspace Context Boundary**: Weakened. An authenticated multi-role user who explicitly selected the `TENANT` workspace can still make successful HTTP calls to `OWNER` endpoints using their current JWT, because their `roles` array contains `PROPERTY_OWNER`.
- **Recommended Smallest Next Action**:
  Attach `requireActiveRole` to the top of each domain router:
  - `ownerRouter.use(requireActiveRole(['PROPERTY_OWNER', 'COMPANY_ADMIN', 'COMPANY_MEMBER']));`
  - `tenantRouter.use(requireActiveRole(['TENANT']));`

---

### FIND-02 (MEDIUM): Organization Membership Revocation Does Not Invalidate Active JWT Without Token Version Increment

- **Source Reference**: [`src/server/middleware/auth.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/middleware/auth.ts#L433-L449), [`src/server/routes/auth.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/routes/auth.ts#L480-L490)
- **Description**:
  When a user selects a company workspace via `POST /api/auth/select-workspace`, the issued JWT embeds `organizationId`. In `requireAuth`, `req.user.organizationId` is populated directly from the decoded JWT claims if present (`decoded.organizationId`). If an organization admin subsequently updates the user's status in `organizationMembers` to `REVOKED` or `SUSPENDED`, the user cannot select that workspace again (as `resolveEligibleWorkspaces` filters by `ACTIVE`), but their existing, unexpired JWT (1-hour lifespan) continues to carry `req.user.organizationId`.
- **Security Assessment**:
  - **Property Mutation**: Mitigated by `requirePropertyPermission` (lines 610–615), which independently queries `organizationMembers` for `COMPANY_MEMBER` before authorizing property mutations.
  - **Company Read Views**: Unmitigated. If a company dashboard query reads `WHERE organization_id = req.user.organizationId` without checking live member status, the revoked member could view company data until token expiration.
- **Recommended Smallest Next Action**:
  In the organization membership update service/repository, whenever a member is suspended, revoked, or deleted, automatically increment `users.tokenVersion` for that user:
  ```sql
  UPDATE users SET token_version = token_version + 1 WHERE id = target_user_id;
  ```
  This immediately forces all active tokens for that user to fail with `401 TOKEN_REVOKED`.

---

### FIND-03 (LOW): `requireActiveAgent` Selectively Applied to Listing Creation

- **Source Reference**: [`src/server/routes/agent.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/routes/agent.ts#L206)
- **Description**:
  `requireActiveAgent` is placed on `POST /agent/listings`, returning `403 AGENT_VERIFICATION_REQUIRED` for agents in `PENDING_VERIFICATION` status. However, secondary endpoints such as `POST /agent/leads` or `POST /agent/tasks` do not have this middleware attached.
- **Security Assessment**:
  - Unverified agents have no assigned properties or active agreements, so cash collection and property mutations fail. However, creating local tasks or private leads is not explicitly blocked by status.
- **Recommended Smallest Next Action**:
  Apply `requireActiveAgent` to any remaining operational agent mutation endpoints where verified status is mandatory.
