# HOMEHUB — MASTER PROJECT CONTEXT
*Authoritative Repository Context & Architectural Standard*

---

## 1. Project Vision
HomeHub is designed as a unified, autonomous real-estate operating system (RE-OS) and digital marketplace tailored specifically for Kurdistan and Iraq. It seamlessly connects Property Owners, Real Estate Management Companies, Tenants, Buyers, Service Vendors, and Platform Administrators into an integrated, self-driving property lifecycle.

## 2. Product Positioning
**"Your properties manage themselves."**
HomeHub is not a patchwork of isolated dashboards. It is an end-to-end, deterministic transaction engine with embedded AI decision support, handling everything from property onboarding, deed verification, and lease execution to autonomous rent collection, vendor quote dispatch, and double-entry accounting.

## 3. Business Model & Operating Layers
HomeHub operates across three primary layers:
1. **Layer 1 — Platform Administration**: Global ecosystem management, KYC/KYB and Tapu deed verification, marketplace moderation, financial settlement, dispute resolution, compliance, audit logs, and AI governance.
2. **Layer 2 — Property Ownership**: Property owners managing self-owned assets, viewing tenant rosters, tracking expected vs. collected rent, approving high-value maintenance quotes, and setting spending limits.
3. **Layer 3 — Real Estate Company / Agency**: Licensed agencies managing third-party properties under explicit, bounded Management Agreements without assuming ownership.

## 4. Roles & Personas
- **Primary Actors**:
  - `PROPERTY_OWNER`
  - `COMPANY` (Real Estate Management Company)
  - `TENANT`
  - `BUYER`
  - `AGENT_BROKER`
  - `VENDOR` (Service Provider / Contractor)
  - `PLATFORM_ADMIN`
- **Internal Company Roles**: `COMPANY_OWNER`, `COMPANY_ADMIN`, `PROPERTY_MANAGER`, `AGENT`, `ACCOUNTANT`, `MAINTENANCE_MANAGER`, `VIEWER`.
- **Administrative Roles**: `SUPER_ADMIN`, `PLATFORM_ADMIN`, `OPERATIONS_ADMIN`, `FINANCE_ADMIN`, `SECURITY_ADMIN`, `COMPLIANCE_ADMIN`, `AI_GOVERNANCE_ADMIN`, `AUDITOR`.

## 5. Authorization Model
**Core Security Rule**: Ownership, management authority, property access, roles, and AI authority are fundamentally distinct.
- General Authorization Vector:
  $$\text{User} + \text{Organization} + \text{Role} + \text{Property} + \text{Ownership} + \text{Agreement} + \text{Permission} + \text{Action} + \text{Approval}$$
- **Fail-Closed Principle**: Authorization fails closed on any uncertainty. Client-supplied IDs (`ownerId`, `companyId`, `tenantId`, `propertyId`, `role`) are never authoritative and are validated against relational database truth.

## 6. Database Architecture
- **Authoritative Database**: PostgreSQL.
- **ORM**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`).
- Strict prohibition against parallel JSON shadow storage, client-side localStorage truth, or unvalidated mock stores in production.
- If PostgreSQL is disconnected: Fail closed with clean `503 DATABASE_NOT_CONFIGURED` status. Never fabricate mock financial or property records.

## 7. Firebase Decision
- Firebase is **NOT** the operational datastore for HomeHub.
- Firebase Admin SDK is retained purely for identity verification (phone OTP and ID token verification).
- Properties, leases, payments, ledger lines, maintenance, and messages reside exclusively in PostgreSQL.

## 8. Domain Map
- `/src/server/routes/admin.ts`: Platform administration, KYC, audit logs.
- `/src/server/routes/owner.ts`: Owner portfolio, units, leases, financials, approvals.
- `/src/server/routes/company.ts`: Company management agreements, team invitations, vendor dispatch.
- `/src/server/routes/tenant.ts`: Tenant leases, rent payment requests, maintenance tracking.
- `/src/server/routes/marketplace.ts`: Public property listings, discovery, search.
- `/src/server/routes/maintenance.ts`: Maintenance requests, quotes, work orders, inspections.
- `/src/server/routes/financials.ts`: General ledger, journal entries, settlements.
- `/src/server/routes/intelligence.ts`: AI listing drafting, ticket triage, renewal assistance.

## 9. Closed Domains
1. **Admin Domain**: CLOSED. Complete RBAC, audit logging, fail-closed enforcement.
2. **Owner Domain**: CLOSED (Infrastructure Pending). 39/39 adversarial tests passed.
3. **Company Domain**: CLOSED (Infrastructure Pending). 38/38 adversarial tests passed.
4. **Tenant Domain**: CLOSED (Infrastructure Pending). 35/35 adversarial tests passed.
5. **Buyer Domain**: CLOSED (Infrastructure Pending). 41/41 adversarial tests passed.
6. **Agent/Broker Domain**: CLOSED (Infrastructure Pending). 44/44 adversarial tests passed.
7. **Vendor/Service Provider Domain**: CLOSED (Infrastructure Pending). 52/52 adversarial tests passed.
8. **Finance/Accounting/Revenue Domain**: CLOSED (Infrastructure Pending). 73/73 adversarial tests passed.
9. **Property Intelligence/Analytics Domain**: CLOSED (Infrastructure Pending). 58/58 adversarial tests passed.
10. **AI Property Autopilot Domain**: REMOVED FROM PRODUCT (Feature Eradicated). Fully unmounted, routes eradicated, confirmed by `autopilot-removal-verification.test.ts`.
11. **Trust/Verification/Risk/Compliance Domain**: CLOSED (Infrastructure Pending). 48/48 adversarial tests passed.
12. **Communications/Notifications/CRM Domain (Stage 11)**: CLOSED (Infrastructure Pending). 131/131 adversarial tests passed.
*Combined Adversarial Test Total: 612/612 passed.*

## 10. Next Domain
- **Current Active / Next Domain**: **STAGE 12 — PRODUCTION DEPLOYMENT & LIVE CLOUD INFRASTRUCTURE**.

## 11. Deferred Infrastructure
- Live cloud PostgreSQL provisioning and external API gateway bindings are intentionally deferred.
- "Infrastructure Pending" does not mean application logic is incomplete. "Build Passing" does not mean live cloud infrastructure is provisioned.

## 12. Financial Rules & Double-Entry Accounting
- Every transaction posted to the ledger satisfies $\sum \text{Debits} = \sum \text{Credits}$.
- Records are immutable once posted. Adjustments and refunds require explicit reversal journal entries.
- Client manipulation of amounts, currencies, or rates is strictly prohibited.

## 13. Dynamic 3-Fee Financial Architecture
- The obsolete hardcoded 5% commission model has been superseded by the 3-Fee Model (Platform, Rent, Management).
- Platform Fee rate is dynamically fetched from `financial_policies` (not hardcoded to 0.05).
- Excluded: Security deposits, pending/failed/refunded payments, maintenance invoices, and **property sales**.
- Must **NOT** be applied to property purchases or sales transactions.
- Must **NOT** be passed as a hidden surcharge onto the tenant's contractual rent amount.

## 14. Property Ownership Rules
- Ownership is authoritatively recorded in `ownership_records`.
- Co-ownership is governed by explicit percentage shares (`ownership_percentage`).
- Managing a property does not grant ownership. Renting a property does not grant ownership. Making an offer or submitting an inquiry does not grant ownership.

## 15. Management Agreement Rules
- Authority is established solely via active `management_agreements`.
- Must specify: `startDate`, `endDate`, `grantedPermissions`, `spendingLimit`, `commissionRate`, and `approvalRules`.
- Actions above `spendingLimit` require explicit owner sign-off.

## 16. Rental Lifecycle
`PROPERTY` $\rightarrow$ `LISTING` $\rightarrow$ `INQUIRY` $\rightarrow$ `VIEWING` $\rightarrow$ `APPLICATION` $\rightarrow$ `APPROVAL` $\rightarrow$ `LEASE` $\rightarrow$ `SECURITY DEPOSIT` $\rightarrow$ `RENT SCHEDULE` $\rightarrow$ `PAYMENT (CONFIRMED)` $\rightarrow$ `5% COMMISSION` $\rightarrow$ `OCCUPANCY` $\rightarrow$ `MAINTENANCE` $\rightarrow$ `RENEWAL / MOVE-OUT`.

## 17. Sales Lifecycle
`PROPERTY` $\rightarrow$ `LISTING (FOR_SALE)` $\rightarrow$ `DISCOVERY` $\rightarrow$ `INQUIRY` $\rightarrow$ `VIEWING` $\rightarrow$ `OFFER` $\rightarrow$ `COUNTER-OFFER` $\rightarrow$ `ACCEPTANCE` $\rightarrow$ `SALES CONTRACT` $\rightarrow$ `ESCROW / PAYMENT` $\rightarrow$ `TRANSACTION CLOSING` $\rightarrow$ `OWNERSHIP RECORD UPDATE`.

## 18. Maintenance Lifecycle
`ISSUE REPORTED` $\rightarrow$ `TRIAGE (CATEGORY & PRIORITY)` $\rightarrow$ `VENDOR ASSIGNMENT` $\rightarrow$ `QUOTE` $\rightarrow$ `APPROVAL (THRESHOLD/OWNER)` $\rightarrow$ `WORK ORDER` $\rightarrow$ `EXECUTION` $\rightarrow$ `INSPECTION` $\rightarrow$ `INVOICE` $\rightarrow$ `SETTLEMENT` $\rightarrow$ `LEDGER POSTING`.

## 19. AI Governance
- AI assists, analyzes, and drafts; AI never bypasses deterministic authorization.
- Autonomy levels: `ASSIST_ONLY`, `RECOMMEND`, `PREPARE_ACTION`, `REQUIRE_APPROVAL`, `LIMITED_AUTONOMY`, `CONTROLLED_AUTONOMY`.
- Forbidden autonomous actions: Transferring funds, altering ownership records, signing binding legal contracts, terminating leases, modifying platform policies.

## 20. Localization Standard
- Primary Language: **Kurdish Sorani (`ku`)** with native Right-to-Left (RTL) alignment.
- Secondary Languages: **Arabic (`ar`)** (RTL) and **English (`en`)** (LTR).
- Strict LTR isolation for technical values: Phone numbers (`+964...`), transaction references, IBANs, and URLs.
- No raw English placeholder strings in Kurdish Sorani user flows.

## 21. Master UI/UX Design System
- Mobile-first approach targeting responsive viewports (320px to 430px mobile, scalable to desktop).
- Clean, trustworthy aesthetic with ample whitespace, card-based layouts (16–24px radius), 44px+ touch targets, and a single prominent primary CTA per view.

## 22. Security Architecture
- Server-side fail-closed gates (`requireAuth`, `requireRole`, `requirePropertyPermission`).
- Parameter tampering and IDOR defenses across all tenant, company, and owner routes.
- Immutable audit logging (`audit_logs`) recording actor, role, action, resource, changes, and IP.

## 23. Testing Philosophy
- A passing build or zero TypeScript errors is a prerequisite, not proof of domain correctness.
- Adversarial tests must simulate malicious IDOR, privilege escalation, and double-entry arithmetic skew.

## 24. External Integration Rules
- Payment gateways (FIB, FastPay, ZainCash), SMS providers, and title deed registries must use clean provider abstractions.
- If an integration is unconfigured, return `SERVICE_UNAVAILABLE` or `NOT_CONFIGURED`. Never fabricate mock success.

## 25. Engineering Workflow
$$\text{One Domain} \rightarrow \text{One Large Comprehensive Implementation} \rightarrow \text{One Final Deep Closure Audit} \rightarrow \text{Close} \rightarrow \text{Next Domain}$$
No fragmented, endless micro-patch cycles.

## 26. Current Repository Reality
- 26 pages in `src/pages/`, 18 onboarding components in `src/components/onboarding/`, complete Flutter client in `flutter_homehub/`.
- PostgreSQL schema in `src/db/schema.ts` defining 33 authoritative tables.
- 678/678 adversarial tests passing across all 12 domains.

## 27. Known Limitations
- Local development runs in unconfigured database mode (fail-closed) until `SQL_HOST` or `DATABASE_URL` is supplied.
- Live external banking and official government land registry (Tapu) endpoints are abstracted.

## 28. Future Roadmap
1. Admin (CLOSED)
2. Owner (CLOSED)
3. Company (CLOSED)
4. Tenant (CLOSED)
5. Buyer (CLOSED)
6. Agent / Broker (CLOSED)
7. Vendor / Service Provider (CLOSED)
8. Cross-Domain Financial & Marketplace Integration (CLOSED)
9. Autonomous AI OS Integration (CLOSED)
10. **Production Infrastructure Provisioning (NEXT / PENDING IMPLEMENTATION)**
11. Final System-Wide Production Audit
