# HomeHub — Cross-Domain Evidence & Verification Index
**Audit Date**: 2026-10-19  
**Audit Directory**: `artifacts/homehub-cross-domain-audit-2026-10-19/`  
**Scope**: Strictly Rental-Only Release (`FeatureFlags.BUY_SELL_ENABLED === false`)  

---

## 1. Verified Source Code & Schema References

The table below catalogs the authoritative implementation files, line numbers, and architectural responsibilities cross-referenced during this audit:

| Domain & Area | Implementation File | Key Symbols / Line References | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Database Schema** | [`src/db/schema.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/db/schema.ts) | Lines 7–1811 | Authoritative PostgreSQL tables, columns, foreign keys, and indexes. |
| **Types & Permissions** | [`src/types/index.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/types/index.ts) | Lines 7–260 | `UserRole`, `CompanyRole`, `Permission`, `LeaseStatus`, and `AuthorityStatus`. |
| **Owner Authority** | [`src/server/repositories/owner.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/owner.ts) | Lines 55–236 (`getAuthorizedPropertyAccess`, `verifyPropertyPermission`) | Resolves verified ownership and active management agreements. |
| **Company & Roles** | [`src/server/repositories/company.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/company.ts) | Lines 56–200, 850 (`getCompanyMembership`, spending limit checks) | Company onboarding, membership status, and spending limit enforcement. |
| **Lease & Overlaps** | [`src/server/repositories/leases.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/leases.ts) | Lines 129–196 (`assertNoPhysicalSpaceOverlap`) | Pessimistic parent row locking (`FOR UPDATE`) and bidirectional overlap prevention. |
| **Fee Calculation** | [`src/server/services/commission.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/services/commission.ts) | Lines 100–155 (`calculateFeesSync`) | Dynamic 3-Fee Model (Platform, Rent, Management) for the 3 operating models. |
| **Accounting Ledger** | [`src/server/services/finance.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/services/finance.ts) | Lines 80–220 (`postJournalEntry`, compensating reversals) | Double-entry journal lines ($\sum \text{Debits} = \sum \text{Credits}$) and reversals. |
| **Tenant Privacy** | [`src/server/services/storage-service.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/services/storage-service.ts) | Lines 70–160 (`authorizeDocumentAccess`) | Object-level document privacy, TAPU isolation, and empty metadata guard. |
| **Maintenance Ops** | [`src/server/repositories/maintenance.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/maintenance.ts) | Lines 7–155 (`createRequest`, `submitQuote`, `approveQuote`, `completeWorkOrder`) | Maintenance lifecycle, quote approvals, and inspection validation. |
| **Utility Billing** | [`src/server/repositories/utility-bills.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/utility-bills.ts) | Lines 53–120 (`createBill`, `payBill`) | Isolated utility invoicing with row locking (`FOR UPDATE`). |
| **Agent Portfolio** | [`src/server/repositories/agent.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/src/server/repositories/agent.ts) | Lines 211–300 (`getPropertyAssignments`, `assignProperty`) | Scoped property assignment and listing management. |

---

## 2. Test Execution Logs & Evidence Files

The tests below were executed live during this audit on `homehub_test`:

1. **`tests/company-lease-approval-bypass.test.ts`**:
   - Command: `npx tsx tests/company-lease-approval-bypass.test.ts`
   - Outcome: **8/8 PASS** (0 failed)
   - Evidence: Proves company property managers cannot bypass owner lease approvals, tenant cannot approve on owner's behalf, and concurrent approval races are serialized.
2. **`tests/tenant-document-privacy-audit.test.ts`**:
   - Command: `npx tsx tests/tenant-document-privacy-audit.test.ts`
   - Outcome: **32/32 PASS** (0 failed)
   - Evidence: Proves tenants cannot access owner TAPU/DEED, other tenant identity records, prior tenant leases in the same unit, or inspection reports with unclassified metadata.
3. **`tests/finding11-tenant-spending.test.ts`**:
   - Command: `npx tsx tests/finding11-tenant-spending.test.ts`
   - Outcome: **1/1 PASS** (0 failed)
   - Evidence: Proves quotes exceeding spending limits cannot be approved by tenants or unverified managers; mandatory owner sign-off enforced.

---

## 3. Real Browser Screenshot Evidence Index

Real PNG screenshots captured during browser verification in `artifacts/homehub-traceability-audit-2026-10-19/screenshots/` demonstrate the live UI state corresponding to our cross-domain scenarios:

| Evidence ID | Screenshot File Name | Role & View | Verified Cross-Domain Scenario |
| :--- | :--- | :--- | :--- |
| `TRACE-01` | [`TRACE-01_auth_valid_login.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-01_auth_valid_login.png) | `PROPERTY_OWNER` (`/owner`) | Scenarios `SCN-ID-01`, `SCN-PROP-01`: Owner login & multi-property dashboard. |
| `TRACE-03` | [`TRACE-03_auth_logout_gate.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-03_auth_logout_gate.png) | `ALL` (`/login`) | Scenario `SCN-ID-05`: Session invalidation & membership revocation gate. |
| `TRACE-04` | [`TRACE-04_rental_property_wizard.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-04_rental_property_wizard.png) | `PROPERTY_OWNER` (`/properties/add`) | Scenarios `SCN-PROP-01`, `SCN-PROP-02`: Rental-only property registration wizard. |
| `TRACE-06` | [`TRACE-06_rent_discovery_explorer.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-06_rent_discovery_explorer.png) | Public Visitor (`/rent`) | Scenarios `SCN-AGT-01`, `SCN-TEN-01`: Public rental marketplace & search filters. |
| `TRACE-07` | [`TRACE-07_lease_management_view.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-07_lease_management_view.png) | `PROPERTY_OWNER` (`/owner` Leases) | Scenarios `SCN-UNIT-01`, `SCN-UNIT-02`: Active lease management & unit allocation. |
| `TRACE-08` | [`TRACE-08_tenant_active_lease.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-08_tenant_active_lease.png) | `TENANT` (`/tenant`) | Scenarios `SCN-TEN-03`, `SCN-TEN-06`: Tenant workspace & isolated leased unit view. |
| `TRACE-09` | [`TRACE-09_lease_renewal_schedule.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-09_lease_renewal_schedule.png) | `PROPERTY_OWNER` (`/owner` Leases) | Scenario `SCN-TEN-04`: Lease renewal with preserved historical installments. |
| `TRACE-10` | [`TRACE-10_tenant_payment_modal.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-10_tenant_payment_modal.png) | `TENANT` (`/tenant` Pay) | Scenario `SCN-FIN-01`: Payment submission modal (`RECORDED` unconfirmed state). |
| `TRACE-11` | [`TRACE-11_owner_settlement_ledger.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-11_owner_settlement_ledger.png) | `PROPERTY_OWNER` (`/owner` Finance) | Scenarios `SCN-FIN-02`, `SCN-FIN-04`: Double-entry settlement ledger & compensating entries. |
| `TRACE-12` | [`TRACE-12_owner_earnings_3fee.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-12_owner_earnings_3fee.png) | `PROPERTY_OWNER` (`/owner` Earnings) | Scenarios `SCN-FEE-01`, `SCN-FEE-02`: Dynamic 3-Fee breakdown for operating models. |
| `TRACE-13` | [`TRACE-13_deposit_inspection_view.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-13_deposit_inspection_view.png) | `PROPERTY_OWNER` (`/owner` Deposits) | Scenarios `SCN-TEN-05`, `SCN-FEE-04`: Move-out inspection & custodial deposit reconciliation. |
| `TRACE-14` | [`TRACE-14_owner_companies_tab.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-14_owner_companies_tab.png) | `PROPERTY_OWNER` (`/owner` Companies) | Scenarios `SCN-PROP-03`, `SCN-MGMT-03`: Management agreement delegation tab. |
| `TRACE-15` | [`TRACE-15_owner_utility_bills.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-15_owner_utility_bills.png) | `PROPERTY_OWNER` (`/owner` Maintenance) | Scenarios `SCN-OPS-05`, `SCN-OPS-06`: Maintenance & isolated utility billing overview. |
| `TRACE-16` | [`TRACE-16_trilingual_switcher.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-16_trilingual_switcher.png) | `ALL` (Header Switcher) | Scenario `SCN-UI-01`: Trilingual RTL/LTR switcher (Kurdish, Arabic, English). |
| `TRACE-17` | [`TRACE-17_fail_closed_banner.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-17_fail_closed_banner.png) | System Gate (Global Banner) | Scenario `SCN-UI-02`: Fail-closed database security alert banner (HTTP 503). |
| `TRACE-18` | [`TRACE-18_admin_audit_stream.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-18_admin_audit_stream.png) | `PLATFORM_ADMIN` (`/workspace/admin`) | Scenario `SCN-UI-03`: Platform admin immutable audit log stream. |
| `TRACE-19` | [`TRACE-19_autopilot_eradicated.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-19_autopilot_eradicated.png) | `ALL` (`/workspace/autopilot`) | Scenario `SCN-UI-04`: Autonomous AI autopilot route eradication redirect. |
| `TRACE-20` | [`TRACE-20_buyer_workspace_deferred.png`](../homehub-traceability-audit-2026-10-19/screenshots/TRACE-20_buyer_workspace_deferred.png) | `BUYER` (`/buyer`) | Rental-Only Scope: Buyer workspace deferred route guard redirect. |
