# HomeHub — Cross-Domain Relationship & Entity Map
**Audit Date**: 2026-10-19  
**Target Environment**: PostgreSQL Schema (`src/db/schema.ts`) & Type System (`src/types/index.ts`)  
**Scope**: Strictly Rental-Only Release (`FeatureFlags.BUY_SELL_ENABLED === false`)  
**Document Status**: Authoritative Architecture Record  

---

## 1. Core Entity & Foreign-Key Architecture

The diagram below maps how entities connect across the platform when a property is registered:

```
                            ┌────────────────────────┐
                            │      users (User)      │
                            └───────────┬────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌─────────────────────┐      ┌──────────────────────┐     ┌──────────────────────┐
│    organizations    │      │  ownership_records   │     │     lease_tenants    │
│    (Company/Vendor) │      │  (Sole/Co-ownership) │     │    (Primary/Co-ten)  │
└──────────┬──────────┘      └──────────┬───────────┘     └──────────┬───────────┘
           │                            │                            │
           ├─ organization_members      │                            │
           ├─ company_invitations       │                            │
           │                            ▼                            │
           │                 ┌──────────────────────┐                │
           └────────────────►│      properties      │◄───────────────┘
            (management_     └──────────┬───────────┘    (leases)
             agreements)                │
                                        ├─ units (Multi-unit dwelling)
                                        ├─ listings (Rental marketplace)
                                        ├─ rental_applications (Prospective tenants)
                                        ├─ leases (Contractual tenancy)
                                        ├─ rent_schedules (Payment installments)
                                        ├─ payment_records (Cash/Digital collections)
                                        ├─ commissions (Dynamic 3-Fee records)
                                        ├─ security_deposits (Custodial escrow)
                                        ├─ maintenance_requests (Issues reported)
                                        ├─ maintenance_quotes (Vendor proposals)
                                        ├─ work_orders (Approved repairs)
                                        ├─ inspections (Work/Move-out quality)
                                        ├─ maintenance_invoices (Vendor billing)
                                        ├─ utility_bills (Electricity/Water charges)
                                        ├─ documents (Tapu, deeds, IDs, contracts)
                                        ├─ journal_entries & ledger_lines (Double-entry)
                                        └─ audit_logs (Immutable activity trail)
```

---

## 2. Entity Specifications & Relationship Invariants

### 2.1 Identity, Users & Organizations
1. **`users`**:
   - `id`: UUID primary key.
   - `roles`: `jsonb` array of `UserRole` (`PROPERTY_OWNER`, `COMPANY`, `COMPANY_MEMBER`, `TENANT`, `BUYER`, `AGENT_BROKER`, `VENDOR`, `PLATFORM_ADMIN`). A user can possess multiple legitimate roles simultaneously (e.g. an Owner who is also a Tenant elsewhere).
   - `password_hash`: Native Argon2id hash.
   - `failed_login_attempts`: Brute-force counter.
   - `locked_until`: Brute-force lockout expiration timestamp.
   - `token_version`: Monotonically increasing counter; incremented upon logout or password reset to invalidate all existing JWTs.
2. **`organizations`**:
   - `id`: UUID primary key.
   - `type`: `COMPANY` or `VENDOR`.
   - `spending_limit_default`: Default spending threshold for maintenance without explicit owner sign-off.
   - `status`: `PENDING_VERIFICATION`, `VERIFIED`, `SUSPENDED`, `REJECTED`, `ARCHIVED`.
3. **`organization_members`**:
   - `organization_id`: Foreign key referencing `organizations.id`.
   - `user_id`: Foreign key referencing `users.id`.
   - `role`: `CompanyRole` (`COMPANY_OWNER`, `COMPANY_ADMIN`, `PROPERTY_MANAGER`, `AGENT`, `ACCOUNTANT`, `MAINTENANCE_MANAGER`, `VIEWER`).
   - `status`: `ACTIVE`, `SUSPENDED`, `REMOVED`.
   - `assigned_property_ids`: `jsonb` array of property IDs for granular portfolio delegation.
4. **`agent_profiles` & `agent_licenses`**:
   - `user_id`: Foreign key referencing `users.id`.
   - `agent_property_assignments`: Scoped property listing/viewing authorization assigned by owners or brokerages.

---

### 2.2 Property, Units & Legal Authority
1. **`properties`**:
   - `id`: UUID primary key.
   - `type`: `RESIDENTIAL_APARTMENT`, `RESIDENTIAL_VILLA`, `COMMERCIAL_OFFICE`, `COMMERCIAL_SHOP`, `BUILDING`, etc.
   - `status`: `DRAFT`, `PENDING_VERIFICATION`, `AVAILABLE`, `OCCUPIED`, `UNDER_MANAGEMENT`, `MAINTENANCE`, `ARCHIVED`.
   - `operating_model`: `FULLY_MANAGED`, `AGENT_LISTED_PLATFORM_MANAGED`, `AGENT_OPERATED`.
   - `rent_fee`: Agreed percentage or fixed fee from owner.
   - `management_fee`: Agreed percentage or fixed management fee.
   - `managed_by_agent_id`: References managing `organizations.id` (null = HomeHub platform).
   - `listed_by_agent_id`: References sourcing `organizations.id` (null = HomeHub platform).
2. **`units`**:
   - `property_id`: References `properties.id`.
   - `unit_number`: Identifier within property.
   - Constraint: `unique('units_property_unit_unique').on(property_id, unit_number)`.
   - `status`: `VACANT`, `OCCUPIED`, `MAINTENANCE`.
   - **Architectural Invariant**: A whole-property dwelling (e.g. standalone villa) uses `unit_id = null`. Multi-unit buildings explicitly populate `units`.
3. **`ownership_records`**:
   - `property_id`: References `properties.id`.
   - `owner_id`: References `users.id` (individual owner).
   - `company_id`: References `organizations.id` (corporate owner).
   - `ownership_percentage`: Decimal (up to 100.00). Supports sole ownership or fractional co-ownership.
   - `status`: `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`.
   - **Invariant**: Ownership defines ultimate legal title. Only verified owners can authorize management agreements or sell/archive property.
4. **`management_agreements`**:
   - `property_id`: References `properties.id`.
   - `company_id`: References `organizations.id` (property management firm).
   - `owner_id`: References `users.id` (authorizing owner).
   - `status`: `PENDING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED`, `TERMINATED`.
   - `spending_limit`: Specific contract spending threshold.
   - `granted_permissions`: `jsonb` array of `Permission` enums.
   - **Invariant**: Management authority is strictly derived from active, unexpired agreements. **Management does NOT confer ownership.**

---

### 2.3 Tenancy, Leases & Overlap Prevention
1. **`rental_applications`**:
   - `property_id`: References `properties.id`.
   - `unit_id`: References `units.id` (optional).
   - `applicant_user_id`: References `users.id`.
   - `status`: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `WITHDRAWN`, `CONVERTED_TO_LEASE`.
2. **`leases`**:
   - `property_id`: References `properties.id`.
   - `unit_id`: References `units.id` (nullable for whole-property lease).
   - `status`: `DRAFT`, `PENDING_APPROVAL`, `PENDING_SIGNATURE`, `ACTIVE`, `EXPIRING`, `EXPIRED`, `TERMINATED`, `CANCELLED`.
   - `rental_application_id`: References `rental_applications.id`.
   - `deposit_reconciliation_status`: `NOT_EVALUATED`, `NOT_APPLICABLE`, `UNRESOLVED`, `RECONCILED`.
   - **Pessimistic Locking & Overlap Invariant**: Universal creation/renewal acquires `SELECT FOR UPDATE` on parent `properties` row. Overlaps are rejected if `(unit_id = requested_unit OR unit_id IS NULL)` within date boundaries for any lease in `ACTIVE`, `PENDING_APPROVAL`, or `PENDING_SIGNATURE`.
3. **`lease_tenants`**:
   - `lease_id`: References `leases.id`.
   - `tenant_id`: References `users.id`.
   - `is_primary`: Boolean. Only the primary tenant consumes the linked rental application.

---

### 2.4 Financials, Collections & Double-Entry Accounting
1. **`rent_schedules`**:
   - `lease_id`: References `leases.id`.
   - `property_id`: References `properties.id`.
   - `tenant_id`: References `users.id`.
   - `amount`: Scheduled installment.
   - `paid_amount`: Amount satisfied strictly by confirmed payments.
   - `status`: `UPCOMING`, `DUE`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `WAIVED`, `CANCELLED`.
   - **Balance Invariant**: `status = 'RECORDED'` payments do NOT increment `paid_amount` or transition status. Only `status = 'CONFIRMED'` modifies schedule balances.
2. **`payment_records`**:
   - `property_id`: References `properties.id`.
   - `lease_id`: References `leases.id`.
   - `rent_schedule_id`: References `rent_schedules.id`.
   - `payer_id`: References `users.id`.
   - `collector_id`: References `users.id` (agent or platform staff).
   - `confirmed_by_user_id`: References `users.id`.
   - `status`: `PENDING`, `RECORDED`, `CONFIRMED`, `FAILED`, `CANCELLED`, `REFUNDED`.
3. **`commissions`**:
   - `payment_record_id`: References `payment_records.id`.
   - `commission_type`: `PLATFORM_FEE`, `RENT_FEE`, `MANAGEMENT_FEE`.
   - `rate` & `commission_amount`: Calculated dynamically against confirmed collected rent only.
   - `status`: `POSTED`, `REVERSED`.
4. **`journal_entries` & `ledger_lines`**:
   - `reference_type`: e.g. `PAYMENT`, `PAYMENT_REVERSAL`, `SECURITY_DEPOSIT`.
   - `reference_id`: Points to triggering business record.
   - Invariant: Balanced entries where $\sum \text{Debits} = \sum \text{Credits}$. Reversals post compensating lines referencing `reversal_of_payment_id`.
5. **`security_deposits`**:
   - Held in custodial escrow (`status = 'HELD'`).
   - Deductions require itemized move-out inspections (`security_deposit_deductions`) and tenant dispute resolution.

---

### 2.5 Maintenance, Vendors & Utility Operations
1. **`maintenance_requests`**:
   - `property_id`: References `properties.id`.
   - `unit_id`: References `units.id`.
   - `reporter_user_id`: References `users.id`.
   - `assigned_vendor_id`: References `organizations.id`.
   - `status`: `REPORTED`, `QUOTE_RECEIVED`, `WORK_ORDER_CREATED`, `COMPLETED`.
2. **`maintenance_quotes` & `work_orders`**:
   - `quote_id`: References `maintenance_quotes.id`.
   - `spending_limit` check: Quotes exceeding property limit require explicit owner decision.
3. **`utility_bills` & `utility_payments`**:
   - Isolated billing records (`property_id`, `unit_id`, `tenant_id`, `lease_id`).
   - Row-level lock (`FOR UPDATE`) on payment. Never conflated with rent or treated as commission-generating income.

---

## 3. Ambiguous, Unverified or Deferred Relationships

1. **Sales & Buyer Escrow (Deferred)**:
   - `buyer_profiles`, `property_offers`, `sales_contracts`, and `sales_transactions` exist in schema from earlier drafts but are **intentionally deactivated** under the Rental-Only release.
2. **Multi-Owner Split Disbursements (Requires Business Policy)**:
   - `ownership_records` supports fractional ownership percentages (e.g. 60%/40%).
   - Current financial settlement logic credits net disbursement to the primary verified owner account. Split multi-party disbursements require a formal business decision.
