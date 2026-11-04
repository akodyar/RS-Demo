# HOMEHUB ARCHITECTURE DECISION RECORDS (ADR)

## ADR-001: Authoritative Relational Backend Database
- **Status**: Accepted & Invariant
- **Decision**: PostgreSQL paired with Drizzle ORM is the sole authoritative backend datastore.
- **Rationale**: Real estate platforms require strict referential integrity, relational join structures (properties $\leftrightarrow$ units $\leftrightarrow$ leases $\leftrightarrow$ rent schedules), ACID transactions for financial ledger posting, and exact double-entry constraints.
- **Consequences**: No parallel JSON shadow storage, document stores, or client-side storage can act as source of truth.

## ADR-002: Rejection of Firebase / Document Datastore for Business State
- **Status**: Superseded by ADR-011
- **Decision**: Firebase Firestore / Realtime Database is rejected as a datastore. Previously, Firebase was temporarily retained solely for phone OTP authentication token verification under ADR-002. Following the user's explicit removal of the phone OTP flow, Firebase Authentication has been completely decommissioned and superseded by Native PostgreSQL Authentication (ADR-011).
- **Rationale**: Document datastores introduce data fragmentation, lack ACID double-entry enforcement, and complicate cross-tenant authorization boundaries.

## ADR-003: Strict Decoupling of Ownership and Management Authority
- **Status**: Accepted & Invariant
- **Decision**: Property ownership (`ownership_records`) is distinct from property management authority (`management_agreements`).
- **Rationale**: A real estate company manages assets on behalf of clients. Granting management rights must never confer ownership rights. Management authority is bounded by dates, spending limits, and explicit permissions.

## ADR-004: Server-Side Fail-Closed Authorization
- **Status**: Accepted & Invariant
- **Decision**: Authorization must be enforced strictly server-side and must fail closed.
- **Rationale**: Client-provided identity tokens or body claims (`ownerId`, `tenantId`, `role`) are untrusted. In the absence of a verified database connection or affirmative permission check, the server returns 503 or 401/403.

## ADR-005: AI Governance & Deterministic Policy Primacy
- **Status**: Accepted & Invariant
- **Decision**: Generative AI tools (Gemini API) function exclusively in advisory, triage, and draft-generation capacities. AI output cannot override deterministic application authorization.
- **Rationale**: AI cannot be allowed to autonomously transfer funds, execute binding title transfers, or alter lease parameters without explicit human authorization.

## ADR-006: Dynamic 3-Fee Financial Architecture
- **Status**: Accepted & Invariant
- **Decision**: The platform charges fees dynamically (Platform Fee, Rent Fee, Management Fee) based on `financial_policies` solely on confirmed rent payments collected through the platform. The obsolete hardcoded 5% rule has been superseded.
- **Rationale**: Applies only when funds are genuinely collected. Excludes security deposits, maintenance fees, and failed/pending payments.

## ADR-007: Strict Exclusion of Rent Fees from Property Sales
- **Status**: Accepted & Invariant
- **Decision**: Rent and Management fees must never be applied to property sales or buyer transactions.
- **Rationale**: Capital sales transactions follow distinct brokerage and platform listing fee schedules.

## ADR-008: Deferred Production Infrastructure Provisioning
- **Status**: Accepted
- **Decision**: Live cloud PostgreSQL hosting and external production gateway provisioning are deferred to an infrastructure phase.
- **Rationale**: Allows complete, air-tight application logic and adversarial security testing to be finalized prior to live cloud billing and credential configuration.

## ADR-009: Domain Freeze & Boundary Integrity
- **Status**: Accepted
- **Decision**: Closed domains (Admin, Owner, Company, Tenant) are frozen and must not be casually reopened or refactored.
- **Rationale**: Prevents regression in verified security matrices. Changes to closed domains are permitted only when an objective cross-domain bug fix requires it.

## ADR-010: Phased One-Domain Implementation Workflow
- **Status**: Accepted
- **Decision**: Development proceeds strictly: One Domain $\rightarrow$ One Comprehensive Implementation $\rightarrow$ One Final Deep Closure Audit $\rightarrow$ Close $\rightarrow$ Next Domain.
- **Rationale**: Eliminates repetitive audit-remediation micro-cycles and guarantees robust, cohesive feature delivery.

## ADR-011: Native PostgreSQL Backend Authentication (Option B)
- **Status**: Accepted & Invariant
- **Decision**: HomeHub operates exclusively on Native PostgreSQL Backend Authentication using Express, Drizzle ORM, Argon2id password hashing, and HMAC-SHA256 JWT session tokens. Firebase Authentication (client SDK and admin token verification) is completely removed.
- **Rationale**:
  1. The phone OTP token verification flow (ADR-002) was explicitly removed by user instruction.
  2. Firebase was unconfigured in deployment and introduced unnecessary third-party operational dependencies and latency.
  3. PostgreSQL is the authoritative single source of truth for identities, roles, credentials, and sessions.
  4. Argon2id provides state-of-the-art password security resistant to GPU/ASIC brute-force attacks.
- **Consequences**:
  - Migration `0018_native_auth_support.sql` adds `password_hash`, `failed_login_attempts`, `locked_until` to `users`, and creates `password_reset_tokens`.
  - Client-side `firebase` package uninstalled.
  - Server verifies passwords using Argon2id (OWASP: 19 MiB memory, 2 iterations, 1 parallelism).
  - Server issues signed JWTs verified by `requireAuth` middleware.
  - Rate limiting, brute-force lockout (5 attempts -> 15 min lock), and single-use password recovery tokens enforced.
  - Production fail-closed validation requires `JWT_SECRET` (min 32 characters).
