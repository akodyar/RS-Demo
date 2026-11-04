# HOMEHUB — CANONICAL FINANCIAL POLICY & COMMISSION MODEL

## 1. General Principles
- **Relational Source of Truth**: All financial balances, receivables, payables, and transactions are stored in PostgreSQL under strict double-entry accounting rules (`journal_entries` and `ledger_lines`).
- **Balanced Books Invariant**: For every posted transaction:
  $$\sum \text{Debits} = \sum \text{Credits}$$
- **Immutability**: Posted financial records cannot be updated or deleted. Corrections are executed via reversing journal entries (`REVERSED`).

## 2. Platform 3-Fee Model Policy
The HomeHub platform utilizes a dynamic 3-fee model to support varying property management scenarios. 

The three authorized fees are:
1. **Platform Fee**: A global, system-wide percentage fee charged for usage of the HomeHub platform. Driven by the `PLATFORM_FEE_RATE` record in `financial_policies`.
2. **Rent Fee**: A property-specific percentage fee for securing the tenant and executing the lease. Stored in `properties.rent_fee`.
3. **Management Fee**: A property-specific percentage fee for ongoing property operations and maintenance. Stored in `properties.management_fee`.

### Operating Model Entitlement
Fee collection by HomeHub is determined by the property's assigned `operatingModel`:
- **FULLY_MANAGED**: HomeHub acts as both listing agent and property manager. HomeHub collects **Rent Fee + Management Fee**. (The Platform Fee is implicitly included in these services).
- **AGENT_LISTED_PLATFORM_MANAGED**: An external agent acquires the tenant; HomeHub handles ongoing operations. HomeHub collects **Management Fee** only.
- **AGENT_OPERATED**: An external agency handles all listing and property operations. HomeHub collects the **Platform Fee** only for system usage.

### Qualifying Invariants:
1. **Confirmed Rent Only**: Fees are calculated and triggered **strictly** upon `payment_records.status === 'CONFIRMED'`.
2. **Dynamic Configuration**: No fee rate may be hardcoded into the business logic. All rates must resolve from the database state at runtime.
3. **Exclusions**:
   - Security deposits are strictly excluded.
   - Pending, failed, or cancelled payments generate zero commission.
   - Maintenance invoices and vendor disbursements are excluded.
   - Property sales, purchase offers, and acquisition transactions are strictly excluded.
4. **No Tenant Surcharge**: All fees (Platform, Rent, Management) are operational expenses borne by the property owner. They must **never** be added as a silent surcharge onto the tenant's contractual monthly rent.
5. **Idempotency**: Exactly one set of fee records is created per confirmed rent payment record. Duplicate requests return the existing records without duplicate posting.
6. **Reversibility**: If a confirmed rent payment is refunded, the associated fee records transition to `REVERSED` with automated compensatory credit/debit ledger entries.

## 3. Security Deposit Accounting
- Security deposits (`security_deposits`) are designated as custodial liabilities.
- Deposits are held in trust until formal move-out inspection and dispute clearance.
- Deposits can never be commingled with operating revenue or platform commissions.

## 4. Sales Transaction Policy Boundary
- Property sales transactions (under the Buyer & Marketplace domains) operate under an independent fee schedule and escrow workflow.
- Under no circumstances may the rent management fee formulas be reused or applied to property purchase prices. Any future brokerage or escrow fee must be introduced as an explicit, separate policy.
