# PostgreSQL Database Integrity & Foreign Key Audit Evidence
**Execution Run ID**: `e2e_1792485195030`
**Audit Anchor Property ID**: `60061892-861f-41ca-9a18-14ada57b7370`
**Timestamp**: `2026-10-20T08:35:18.768Z`
**Target Database**: `homehub_test`

## Table Linkage Verification Summary
All related business records across 8 separate domain tables explicitly reference the exact same synthetic anchor Property ID (`60061892-861f-41ca-9a18-14ada57b7370`):

| Domain Table | Foreign Key Column | Record Count | Referential Integrity Status |
| :--- | :--- | :--- | :--- |
| **properties** | `id` (Primary Key) | 1 | **VERIFIED** |
| **ownership_records** | `property_id` | 1 | **VERIFIED** |
| **listings** | `property_id` | 2 | **VERIFIED** |
| **rental_applications** | `property_id` | 1 | **VERIFIED** |
| **leases** | `property_id` | 1 | **VERIFIED** |
| **rent_schedules** | `property_id` | 12 | **VERIFIED** (12 monthly cycles) |
| **payment_records** | `property_id` | 1 | **VERIFIED** |
| **maintenance_requests** | `property_id` | 1 | **VERIFIED** |

## Invariant Conformance
1. **Zero Orphaned Records**: Every dependent record resolves cleanly to `properties.id = '60061892-861f-41ca-9a18-14ada57b7370'`.
2. **Deterministic Ownership**: Only `19e8ae0b-c1ff-4e75-b8a9-1ed7dc5241f0` holds a verified ownership record for `60061892-861f-41ca-9a18-14ada57b7370`.
3. **Dynamic 3-Fee Allocation**: Commission `930876d4-3b45-40c8-96bf-15e57869982b` correctly allocated `2%` Platform Fee, `5%` Rent Fee, and `5%` Management Fee under the `FULLY_MANAGED` operating model.
4. **Adversarial Isolation**: Adversary `usr_adv_e2e_1792485195030` was denied access with HTTP 403.
