# HomeHub — Open Business & Product Decisions
**Audit Date**: 2026-10-19  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  
**Scope**: Strictly Rental-Only Release (`FeatureFlags.BUY_SELL_ENABLED === false`)  
**Status**: Pending Stakeholder Review  

> [!IMPORTANT]
> The engineering team does not unilaterally invent legal, financial, or business policies. The items below represent genuine business decisions identified during our cross-domain audit that require formal executive sign-off. Safe interim behaviors are currently enforced in production-grade code.

---

## Decision 1: Co-Ownership Fractional Payout Distribution Protocol

### 1. Context & Evidence
- In `src/db/schema.ts`, `ownership_records` supports fractional co-ownership via `ownership_percentage` (e.g. Owner A owns 60.00%, Owner B owns 40.00%).
- In `src/server/repositories/owner.ts:91-100`, both co-owners are recognized as legitimate property owners and can view property dashboards, documents, and financial overviews.
- In `src/server/services/finance.ts`, net disbursements on confirmed rent collections are credited to a single owner financial ledger account associated with the primary verified owner on file.

### 2. Specific Decision Required
When rent is confirmed and net earnings are disbursed for a co-owned property:
- **Option A (Proportional Direct Split)**: Should the settlement service automatically split net owner disbursement into multiple ledger lines and bank transfers corresponding exactly to each co-owner's `ownership_percentage`?
- **Option B (Designated Managing Owner Account)**: Should 100% of the net rent be disbursed to a single designated "Managing Co-Owner" who is legally responsible for external offline distribution?

### 3. Safe Interim Behavior
Until formal executive sign-off, HomeHub executes **Option B**: net proceeds are credited to the primary verified owner on record, while financial summaries display the full gross and net earnings transparently to all verified co-owners.

---

## Decision 2: Mid-Lease Property Title Transfer & Rent Proration Protocol

### 1. Context & Evidence
- Leases (`leases` table) are linked to `property_id`. Active leases generate monthly installments in `rent_schedules`.
- In `src/server/services/commission.ts`, commissions and owner disbursements record `owner_id` at the time of payment confirmation.
- If legal ownership of a property changes hands externally during an active 1-year lease, `ownership_records` can be updated to link the new owner.

### 2. Specific Decision Required
If title transfers in the middle of a billing cycle (e.g. on the 15th of the month when rent is due on the 1st):
- **Option A (Automated Mid-Month Proration)**: Should the system automatically prorate the active month's rent installment between the former owner and new owner based on the exact title transfer date?
- **Option B (Whole-Cycle Cutoff)**: Should the former owner receive the full current month's collection, with the new owner receiving all rent collections starting from the subsequent calendar period?
- **Option C (Escrow Hold for Manual Settlement)**: Should mid-cycle collections be held in escrow until both former and new owners submit a joint settlement agreement?

### 3. Safe Interim Behavior
Under the Rental-Only release, Buy/Sell and title sales workflows are **strictly disabled/deferred**. If ownership records are updated manually by a platform admin, HomeHub applies **Option B**: collections confirmed prior to the update belong to the prior owner; collections confirmed after the update belong to the new verified owner.

---

## Decision 3: Co-Tenant Rental Application & Background Screening Policy

### 1. Context & Evidence
- In `src/server/repositories/leases.ts:199-220`, multi-tenant leases are supported via `lease_tenants`.
- `leases.rental_application_id` holds a unique constraint ensuring that only one approved rental application is linked and consumed per lease.
- In `docs/business/BUSINESS_RULES.md:25`, the current rule states: *"For multi-tenant leases, only the primary tenant (lease_tenants.is_primary = true) is required to hold an approved rental application for the property."*

### 2. Specific Decision Required
Should adult co-tenants, room-mates, and co-signers be mandated to undergo independent rental application submission and background verification, or should the primary applicant retain sole legal application responsibility?
- **Option A (Primary-Only)**: Maintain current policy where only the primary applicant requires an approved application; secondary co-tenants are verified users on the lease contract.
- **Option B (Universal Co-Tenant Applications)**: Require every listed tenant on the lease to submit, pass, and consume an independent rental application.

### 3. Safe Interim Behavior
HomeHub enforces **Option A** as codified in Canonical Business Rules: secondary occupants must have valid `users` accounts with the `TENANT` role and zero active lease collisions, but do not require separate rental application records.

---

## Decision 4: In-Tenancy Tenant-Caused Damage Billing Workflow

### 1. Context & Evidence
- When damage occurs at move-out, `security_deposit_deductions` itemizes repair costs against custodial escrow via `lease_move_out_inspections`.
- However, if a tenant causes repairable damage during active tenancy (e.g. broken window or plumbing clog in month 3), the vendor invoice is currently billed to the property/owner.
- Owners often desire to recharge the active tenant immediately rather than depleting security deposits or waiting until move-out.

### 2. Specific Decision Required
How should tenant-caused maintenance damage during active tenancy be billed to the tenant?
- **Option A (Ad-Hoc Incident / Utility Bill)**: Allow property managers to issue an official `utility_bills` incident charge marked `category = 'TENANT_DAMAGE'` payable in the tenant workspace.
- **Option B (Move-Out Only Deduction)**: Restrict all tenant damage recovery exclusively to move-out deposit reconciliation.

### 3. Safe Interim Behavior
HomeHub currently prevents maintenance invoices from automatically turning into tenant charges or modifying rent schedules. If an owner and tenant agree on mid-lease reimbursement, it is billed through an explicit utility billing record (`utility_bills`) with a separate audit trail.
