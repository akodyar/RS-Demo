# HOMEHUB — SYSTEM SECURITY MODEL

## 1. Core Principles
1. **Never Trust Client Context**: Client requests claiming `ownerId`, `tenantId`, `role`, or `organizationId` are treated as unauthenticated suggestions. Authority must be resolved from verified credentials and relational joins.
2. **Fail-Closed by Design**: If credentials are missing, malformed, or if the database is unreachable, all access is denied with 401, 403, or 503.
3. **Multi-Dimensional Authorization**: Permissions are checked against User + Organization + Role + Property + Ownership + Management Agreement + Action.

## 2. Authentication Architecture (Native PostgreSQL + Drizzle + Express)
- **Authoritative Credential Store**: PostgreSQL `users` table storing Argon2id password hashes (`password_hash`), brute-force lockout counters (`failed_login_attempts`), and lockout expirations (`locked_until`).
- **Cryptographic Hashing Algorithm**: Argon2id with OWASP-recommended parameters:
  - Memory cost: 19 MiB (19,456 KiB)
  - Time cost: 2 iterations
  - Parallelism: 1 thread
- **Session Tokens**: Cryptographically signed JSON Web Tokens (JWT) using HMAC-SHA256, issued exclusively by the HomeHub backend upon successful server-side credential verification. Tokens carry `{ id, email, roles }` and expire after 7 days.
- **Fail-Closed Secret Enforcement**: `JWT_SECRET` (minimum 32 characters) is strictly mandatory in production. If missing or insecure, the server fails closed on startup.
- **Brute-Force & Lockout Defense**:
  - Consecutive failed logins increment `failed_login_attempts`.
  - Upon 5 consecutive failures, the account is locked for 15 minutes (`locked_until`).
  - Successful authentication resets the counter to 0.
- **Password Recovery Security**:
  - Secure random 256-bit hexadecimal reset tokens with 1-hour expiration.
  - Hashed with SHA-256 before storage in `password_reset_tokens`.
  - Single-use: invalidates immediately upon consumption.
  - Generic responses on `/api/auth/forgot-password` prevent account enumeration.
- **Mock Token Isolation**: Development tokens (`dev-*`) are strictly banned in production (`process.env.NODE_ENV === 'production'`) and rejected immediately by the authentication middleware with `MOCK_AUTH_FORBIDDEN_IN_PRODUCTION`.

## 3. Role-Based Access Control (RBAC)
- Top-level `UserRole`: `PROPERTY_OWNER`, `COMPANY`, `COMPANY_MEMBER`, `TENANT`, `BUYER`, `AGENT_BROKER`, `VENDOR`, `PLATFORM_ADMIN`.
- Sub-roles within companies (`CompanyRole`): `COMPANY_OWNER`, `COMPANY_ADMIN`, `PROPERTY_MANAGER`, `AGENT`, `ACCOUNTANT`, `MAINTENANCE_MANAGER`, `VIEWER`.
- Scoped Admin Roles: `SUPER_ADMIN`, `PLATFORM_ADMIN`, `OPERATIONS_ADMIN`, `FINANCE_ADMIN`, `SECURITY_ADMIN`, etc.

## 4. Insecure Direct Object Reference (IDOR) Defenses
- **Owner Scope**: Owners cannot view, edit, or access properties, leases, or financials of other owners. Verified through `ownershipRecords.ownerId === user.id`.
- **Tenant Scope**: Tenants cannot view leases, rent schedules, or maintenance tickets outside their signed leases (`leaseTenants.tenantId === user.id`).
- **Company Scope**: Companies cannot access properties without an active, unexpired, and unrevoked `managementAgreements` record with matching permissions.
- **Cross-Domain Isolation**: Endpoints verify that the referenced sub-entity (`unitId`, `leaseId`, `quoteId`) strictly belongs to the referenced `propertyId`.

## 5. Financial & Transaction Security
- Double-entry ledger invariant: Every transaction requires balanced journal entries ($\sum \text{Debits} = \sum \text{Credits}$).
- Direct modification of payment amounts, receipt numbers, or commission percentages by clients is impossible.
- Ledger lines and confirmed payment records are immutable; corrections require compensatory reversal transactions.

## 6. Document & Media Access Security
- Sensitive documents (`TAPU`, deeds, identity documents, tax records) require explicit permission verification.
- Document uploads enforce file type whitelisting and are linked to an authoritative `uploaderUserId` and `propertyId`.

## 7. AI Scoping & Prompt Injection Mitigation
- AI models receive strictly sanitized and scoped prompt contexts.
- User inputs embedded into AI prompts are isolated to prevent instruction overriding.
- AI cannot autonomously invoke mutating APIs; all recommended actions require a verified human user session and authoritative RBAC check.

## 8. Audit Trail Immutability
- All state-mutating requests trigger `auditService.logAction`.
- Audit logs record: actor ID, role, action, resource type, resource ID, before/after changes, and IP address.
- Audit records cannot be modified or deleted through application endpoints.
