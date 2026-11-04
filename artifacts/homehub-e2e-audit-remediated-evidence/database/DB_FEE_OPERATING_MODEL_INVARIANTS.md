# Database Reconciliation & Operating Model Fee Invariants

### 1. Authoritative 3-Fee Model Verification
| Operating Model | Platform Fee | Rent Fee | Management Fee | Invariant Status |
|---|---|---|---|---|
| **Model A: FULLY_MANAGED** | 3.0% (universal) | 4.0% (property-specific) | 6.0% (property-specific) | PASS: All three fees apply |
| **Model B: AGENT_LISTED_PLATFORM_MANAGED** | 3.0% (universal) | **NULL** (strictly does not apply) | 4.0% (property-specific) | PASS: Rent fee strictly null |
| **Model C: AGENT_OPERATED** | 3.0% (universal) | **NULL** (strictly does not apply) | **NULL** (strictly does not apply) | PASS: Only platform fee applies |

### 2. Preference vs Operating Model Separation
- Changing `managementPreference` from `HOMEHUB_MANAGED` to `SELF_MANAGED` or `AGENT_MANAGED` never alters `operatingModel`.
- `managementArrangementStatus` transitions deterministically:
  * `SELF_MANAGED` -> `NOT_APPLICABLE`
  * `HOMEHUB_MANAGED` -> `AWAITING_ONBOARDING`
  * `AGENT_MANAGED` -> `AWAITING_AGREEMENT`
- Active `managementAgreements` enforce contractual integrity and block unauthorized preference changes (HTTP 409 Conflict).

### 3. Database State Verification & Safe Test-Data Sanitization
- **Global Platform Fee (`PLATFORM_FEE_RATE`)**:
  * Original Baseline: `0.03` (3.0%).
  * Test Mutation: `0.035` (3.5%).
  * Final Restored Status: Restored to canonical `0.03` (3.0%). Verified via SQL: `policy_value = '0.03'`.
- **Pricing Tiers (`pricing_tiers`)**:
  * Baseline Tiers: `Tier A` (min 0, max 1, rent 5%, mgmt 10%, priority 10) and `Tier B` (min 2, max null, rent 3%, mgmt 8%, priority 11).
  * Test Mutation: Created `E2E Platinum Tier` (min 15, max 100, rent 3.5%, mgmt 5.5%, priority 8).
  * Final Restored Status: Test tier deleted; exactly 2 baseline tiers (`Tier A`, `Tier B`) remain in database.
- **Property-Level Rent Fee (`properties.rent_fee`)**:
  * Test Mutation: `0.045` on temporary test property.
  * Final Restored Status: Temporary property deleted during test teardown. No production or baseline properties altered.
- **System Settings & Toggles**:
  * `maintenanceMode`: `false` (active and accepting requests).
  * `twoFactorEnforced`: `true` (enforced for administrative roles).
- **Test Property Records**:
  * All 5 transient audit properties safely deleted with foreign key cascade (`notifications`, `verification_records`, `ownership_records`, `listings`).
  * Residual audit properties from this session: Exactly 0.
  * Retained domain fixtures: 69 historical domain fixtures from prior closed test runs preserved untouched.
