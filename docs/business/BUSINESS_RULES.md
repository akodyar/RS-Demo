# HOMEHUB — CANONICAL BUSINESS RULES

## 1. Ownership Rules
- Ownership is authoritatively defined by `ownership_records`.
- An owner can hold 100% sole ownership or fractional co-ownership (`ownership_percentage`).
- Ownership status follows: `PENDING_VERIFICATION` $\rightarrow$ `VERIFIED` (or `REJECTED`).
- An owner retains ultimate authority to approve or revoke management agreements, list properties for sale/rent, and approve expenses exceeding spending limits.

## 2. Management Authority Rules
- Property management companies acquire authority solely via active `management_agreements`.
- Management authority is property-scoped, time-bounded (`startDate`, `endDate`), and permission-bounded.
- A management company has a `spendingLimitDefault` or agreement-specific `spending_limit`. Any maintenance or operational expenditure exceeding this threshold requires explicit Owner Approval.
- Management agreements can be in states: `PENDING`, `ACTIVE`, `SUSPENDED`, `REVOKED`, `TERMINATED`, `EXPIRED`.
- Terminating a management agreement immediately strips the company of operational permissions on that property.

## 3. Tenancy & Lease Rules
- Prospective tenants submit `rental_applications` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`).
- Once approved, a `lease` is generated (`DRAFT`, `PENDING_APPROVAL`, `PENDING_SIGNATURE`, `ACTIVE`, `EXPIRING`, `EXPIRED`, `TERMINATED`, `CANCELLED`).
- Each lease specifies `rentAmount`, `currency` (IQD/USD), `rentCycle` (monthly/annual), and `depositAmount`.
- A lease cannot be active without an identified physical rental space (either an explicit unit via `unit_id` for multi-unit properties, or `unit_id: null` representing an undivided whole-property dwelling such as a villa) and a primary tenant (`lease_tenants`).
- Physical-Space Reservation Rule: Leases in `ACTIVE`, `PENDING_APPROVAL`, and `PENDING_SIGNATURE` status hold an exclusive reservation on their physical rental space and block overlapping lease creation, activation, and renewal. Leases in `DRAFT` status remain non-blocking. Formally cancelled (`CANCELLED`) or terminated (`TERMINATED`) leases release their reservation immediately.
- Bidirectional Overlap Invariant: A whole-property lease (`unit_id: null`) claims the entire property envelope and strictly conflicts with any concurrent lease on that property, including all unit-level leases. A unit-level lease strictly conflicts with concurrent leases on that same unit as well as any concurrent whole-property lease.
- Universal Creation Enforcement: All lease creation pathways—standard marketplace lease creation (`leaseRepository.createLease`), direct owner lease creation (`ownerRepository.createLease`), and management company draft creation (`companyRepository.createLeaseDraft`)—mandate the same physical-space reservation check and parent-property pessimistic row-lock protocol (`properties` row locked `FOR UPDATE`). Direct owner and company creation preserve off-application workflows but strictly validate unit-to-property belonging and reject concurrent overlapping tenancies.
- Rental Application Reservation & Consumption Rule: An approved rental application is linked to a lease at draft creation time, establishing an exclusive reservation via `leases.rental_application_id` and the partial unique index `leases_rental_application_active_unique` that prevents concurrent or subsequent duplicate use. Upon lease activation, the linked application atomically transitions to `CONVERTED_TO_LEASE`. Formally cancelled drafts or owner-rejected company drafts release this reservation immediately without consuming the application.
- Primary-Applicant-Only Policy: For multi-tenant leases, only the primary tenant (`lease_tenants.is_primary = true`, corresponding to `tenantIds[0]`) is required to hold an approved rental application for the property. Secondary co-tenants and occupants do not require independent rental applications under current business rules. However, every assigned tenant must possess the `TENANT` role, exist in authoritative PostgreSQL records, and have no overlapping active or pending tenancies on the property during the lease term. Only the primary tenant's approved application is linked, reserved, and consumed by the lease.

## 4. Rent Collection & Schedules
- Generating an active lease automatically schedules rent installments in `rent_schedules`.
- Schedule statuses: `UPCOMING` $\rightarrow$ `DUE` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `PAID` (or `OVERDUE`, `WAIVED`).
- Schedule Balance Invariant: An unconfirmed payment submission (`RECORDED`) does NOT alter `rent_schedules.paid_amount` or transition schedule status. Authoritative schedule balances and statuses are updated strictly upon authorized payment confirmation (`CONFIRMED`).
- Partial payments increment `paid_amount` and keep the status as `PARTIALLY_PAID` until the full amount is satisfied upon confirmation.
- Overpayment & Pending Aggregate Protection: Unconfirmed pending claims (`RECORDED`) are evaluated against remaining balance under an exclusive row lock (`FOR UPDATE`) on the rent schedule to prevent aggregate overpayment or concurrent submission bypass.

## 5. Payments & Security Deposits
- Payment records (`payment_records`) track method, reference number, payer, amount, and receipt number.
- Payment statuses: `PENDING` $\rightarrow$ `RECORDED` $\rightarrow$ `CONFIRMED` (or `FAILED`, `CANCELLED`, `REFUNDED`).
- Unconfirmed claims with status `RECORDED` represent payment claims submitted by tenants awaiting verification. They do not constitute collected funds or reduce outstanding tenant rent obligations until confirmed.
- Security deposits (`security_deposits`) remain `HELD` during tenancy and can only transition to `PARTIALLY_REFUNDED`, `REFUNDED`, or `DEDUCTED` upon move-out inspection reconciliation.

## 6. Platform Commission Rules
- Centralized policy: Fees are dynamically calculated via the 3-Fee Model (Platform, Rent, Management) based on the property's `operating_model`.
- Triggered strictly upon `payment_records.status === 'CONFIRMED'`.
- Deducted from owner disbursement; never added as an unannounced surcharge to tenant rent.
- Rent and Management fees are strictly prohibited on property sales transactions.
- Reversal rule: If a confirmed payment is refunded, the associated commission records transition to `REVERSED` with compensatory ledger lines.

## 7. Marketplace & Listings
- Listing statuses: `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `PAUSED`, `UNDER_OFFER`, `SOLD`, `RENTED`, `ARCHIVED`.
- Only verified properties or properties with approved listing permissions can be published to the public marketplace.
- Duplicate listings for the same unit/property are flagged for Admin review.

## 8. Buyer Operations, Offers & Sales Transactions
- Buyers submit purchase offers (`offers`) detailing proposed purchase price, earnest money, and contingencies.
- Offer lifecycle: `SUBMITTED` $\rightarrow$ `UNDER_REVIEW` $\rightarrow$ `ACCEPTED`, `REJECTED`, or `COUNTERED`.
- Counter-offers supersede prior offers.
- Acceptance triggers sales contract drafting (`contracts`) and transaction escrow tracking (`transactions`).
- Legal title transfer (Tapu) update is finalized in closing. *Policy Note: If formal government API integration is unavailable, mark as `PENDING_EXTERNAL_VERIFICATION` rather than simulating legal registry transfer.*

## 9. Maintenance & Work Orders
- Issue lifecycle: `REPORTED` $\rightarrow$ `TRIAGED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `QUOTED` $\rightarrow$ `APPROVED` $\rightarrow$ `SCHEDULED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `INSPECTED` $\rightarrow$ `COMPLETED` $\rightarrow$ `INVOICED`.
- Work orders above property spending limits require owner decision before execution.
- Work orders cannot be closed without inspection findings (`inspections`).

## 10. Approvals Engine
- Approvals cover: Financial expenditures exceeding spending limits, maintenance quotes, lease renewals, and AI-recommended actions.
- Approvers must possess verified authority over the specific property.
- Decisions are strictly binary: `APPROVED` or `REJECTED`, accompanied by mandatory timestamped notes.

## 11. Audit Logging
- Every mutating business action triggers an immutable log entry in `audit_logs`.
- Logs record: `actorUserId`, `actorRole`, `action`, `resourceType`, `resourceId`, `changes`, and `ipAddress`.
- Audit logs cannot be updated or deleted via API.
