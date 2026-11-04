# HomeHub End-to-End Control-by-Control Browser Test Checklist

| ID | Domain / Workflow | Control / Action | Expected Result | Actual Result | Screenshot Reference | Status |
|---|---|---|---|---|---|---|
| C01 | Admin Dashboard | Quick Action "Settings" Button | Navigates to Admin Settings Module | Admin Settings Module rendered with policy fields | admin-fees/01-admin-dashboard-hero.png, 02-admin-settings-overview.png | PASS |
| C02 | Admin Fee Settings | Platform Fee Input: Negative value (-0.05) | Rejects with "Rate cannot be negative" | Validation error visible below input | admin-fees/03-platform-fee-negative-validation.png | PASS |
| C03 | Admin Fee Settings | Platform Fee Input: Exceeding 50% (0.85) | Rejects with "Rate cannot exceed 50%" | Validation error visible below input | admin-fees/04-platform-fee-exceeds-max-validation.png | PASS |
| C04 | Admin Fee Settings | Platform Fee Input: 5 decimal places (0.03555) | Rejects with "Rate precision cannot exceed 4 decimal places" | Validation error visible below input | admin-fees/05-platform-fee-overprecision-validation.png | PASS |
| C05 | Admin Fee Settings | Platform Fee Input: Empty string | Rejects with "Platform fee rate is required" | Validation error visible below input | admin-fees/06-platform-fee-empty-validation.png | PASS |
| C06 | Admin Fee Settings | Platform Fee Input: Valid rate 0.035 | Shows pending badge "(Pending: 3.50%)" | Pending badge displayed dynamically | admin-fees/07-platform-fee-pending-mutation.png | PASS |
| C07 | Admin Fee Settings | Save Settings Button (`admin-save-settings-btn`) | Submits PATCH to server, persists 0.035 to DB | Green banner displayed; DB verified | admin-fees/08-platform-fee-save-success.png | PASS |
| C08 | Admin Fee Settings | Page Reload | Persists 0.035 rate in browser | Input retains 0.035 value | admin-fees/09-platform-fee-persisted-after-reload.png | PASS |
| C09 | Admin Fee Settings | Security & Policy Checkboxes | Toggles maintenance mode and 2FA policies | Checkboxes toggle state smoothly | admin-fees/10-admin-settings-toggles.png | PASS |
| C10 | Admin Fee Settings | 3-Fee Applicability Matrix | Displays full table for Models A, B, and C with invariants | Clear 3-row matrix rendered in Kurdish RTL | admin-fees/11-fee-applicability-matrix.png | PASS |
| C11 | Admin Navigation | Bottom Nav "More" + "Tiered Pricing" | Navigates to Tiered Pricing Module | Pricing Tiers grid rendered | admin-fees/12-pricing-tiers-overview.png | PASS |
| C12 | Tiered Pricing | "Create New Tier" Button | Opens Create Tier modal | Modal rendered with inputs | admin-fees/13-pricing-tier-modal-empty.png | PASS |
| C13 | Tiered Pricing | Modal Submit with empty fields | Highlights required inputs with errors | Field error messages displayed | admin-fees/14-pricing-tier-validation-errors.png | PASS |
| C14 | Tiered Pricing | Inputs: Name, Min/Max props, Rent/Mgmt fees, Priority | Valid data accepted into state | Values correctly bound | admin-fees/15-pricing-tier-filled-valid.png | PASS |
| C15 | Tiered Pricing | Modal "Cancel" Button | Dismisses modal without saving | Modal cleanly dismissed from DOM; baseline tiers preserved | admin-fees/15b-pricing-tier-modal-dismissed-on-cancel.png | PASS |
| C16 | Tiered Pricing | Modal "Save Tier" Button | Submits POST /api/admin/pricing-tiers | Green success banner; new tier in grid | admin-fees/16-pricing-tier-created-success.png, 17-pricing-tier-grid-updated.png | PASS |
| C17 | Admin Properties | Properties Module Navigation | Displays property cards with 3-fee badges | Property list rendered with Rent & Mgmt fees | admin-fees/18-admin-properties-fee-breakdowns.png | PASS |
| C18 | Admin Properties | "Edit Fees" Button on Property Card | Opens Property Fee Modal | Modal opens with rent/mgmt fee inputs | admin-fees/19-property-fee-modal-open.png | PASS |
| C19 | Admin Properties | Save Property Fees Button | Updates property fees in DB | Success toast displayed; DB updated to 0.045 | admin-fees/20-property-fee-saved-success.png | PASS |
| C20 | Add Property | Step 0: Type Selection (Apartment) | Selects type card, enables Next | Card selected with active border | property-verification/01-add-property-step0-type.png | PASS |
| C21 | Add Property | Step 1: Basic Info (Name, Description) | Accepts property title and text | Name input populated | property-verification/02-add-property-step1-basic-info.png | PASS |
| C22 | Add Property | Step 2: Location (City, Governorate) | Selects Erbil, sets coordinates | Location fields populated | property-verification/03-add-property-step2-location.png | PASS |
| C23 | Add Property | Step 3: Specifications (Area, Rooms) | Accepts bedrooms, bathrooms, floor | Number fields populated | property-verification/04-add-property-step3-specifications.png | PASS |
| C24 | Add Property | Step 4: Amenities (AC, Generator, CCTV) | Selects amenity chips | Badges toggled active | property-verification/05-add-property-step4-amenities.png | PASS |
| C25 | Add Property | Step 5: Photos (Upload / Preset) | Attaches photos | Photos attached to list | property-verification/06-add-property-step5-photos.png | PASS |
| C26 | Add Property | Step 6: Ownership (100% Individual) | Sets ownership percentage | 100% selected | property-verification/07-add-property-step6-ownership.png | PASS |
| C27 | Add Property | Step 7: Operations & Agreed Fees | Selects FULLY_MANAGED, rent 0.04, mgmt 0.06 | Operating model & fees populated | property-verification/08-add-property-step7-management.png | PASS |
| C28 | Add Property | Step 8: Review & Submit Button | Submits POST /api/properties | Created in DB as PENDING_VERIFICATION | property-verification/09-add-property-step8-review.png | PASS |
| C29 | Management Choice | Post-Submission Confirmation Banner | Informs owner of PENDING_VERIFICATION status | Green confirmation and warning badge rendered | management-choice/01-submission-confirmation-banner.png | PASS |
| C30 | Management Choice | 3 Management Options (A, B, C) | Renders cards for SELF, HOMEHUB, AGENT | All three radio cards visible | management-choice/02-three-management-options.png | PASS |
| C31 | Management Choice | Option C (AGENT_MANAGED) Click | Expands verified company select dropdown | Dropdown shows verified agents only | management-choice/03-agent-managed-selected-with-dropdown.png | PASS |
| C32 | Management Choice | Option B (HOMEHUB_MANAGED) Click | Sets choice to HOMEHUB, shows onboarding note | Arrangement status AWAITING_ONBOARDING | management-choice/04-homehub-managed-selected.png | PASS |
| C33 | Management Choice | Option A (SELF_MANAGED) Click | Sets choice to SELF, shows direct control note | Arrangement status NOT_APPLICABLE | management-choice/05-self-managed-selected.png | PASS |
| C34 | Management Choice | Save Preference & Persistence Reload | Saves preference and reloads page to verify persistence | Selection, status, and eligible agents persist across reloads | management-choice/05a-self-managed-persisted-after-reload.png, 05b-homehub-managed-persisted-after-reload.png, 05c-agent-managed-persisted-after-reload.png, 06-preference-saved-success.png | PASS |
| C35 | Management Choice | Unverified Agent Negative Test | Submits AGENT_MANAGED with unverified agent | Server returns HTTP 400 Bad Request | verified via API request | PASS |
| C36 | Management Choice | Owner Portfolio Navigation | Shows newly registered property with PENDING badge | Card visible with PENDING_VERIFICATION | management-choice/07-owner-portfolio-pending-card.png | PASS |
| C37 | Management Choice | Active Agreement Conflict Guard | Blocks switch to SELF_MANAGED when agreement exists | Red conflict banner with HTTP 409 error | management-choice/08-active-agreement-conflict.png | PASS |
| C38 | Property Verification | Admin Verification Status Filter: PENDING | Filters table to pending properties | Only pending properties shown | property-verification/10-admin-filter-pending.png | PASS |
| C39 | Property Verification | "Inspect" Button on Pending Property | Opens Property Verification & Decision modal | Modal displays property details & history | property-verification/11-inspect-modal-pending.png | PASS |
| C40 | Property Verification | Reject Button without Reason | Rejects with "Please provide a rejection reason" | Kurdish error banner visible | property-verification/12-reject-missing-reason-error.png | PASS |
| C41 | Property Verification | Rejection Reason Textarea | Accepts official rejection rationale | Reason entered into textarea | property-verification/13-reject-reason-entered.png | PASS |
| C42 | Property Verification | Confirm Reject Button | Updates status to REJECTED, records audit | Green feedback "Property Rejected" | property-verification/14-reject-success-feedback.png | PASS |
| C43 | Property Verification | Admin Filter: REJECTED | Displays rejected property with red badge | Filter shows rejected record | property-verification/15-admin-filter-rejected.png | PASS |
| C44 | Property Verification | Owner Workspace Rejection Banner | Displays red banner with admin reason | Owner sees reason & Resubmit button | property-verification/16-owner-workspace-rejected-banner.png | PASS |
| C45 | Property Verification | Owner "Resubmit" Button | Resets status to PENDING_VERIFICATION | Status reset in DB and UI | property-verification/17-owner-workspace-resubmitted-pending.png | PASS |
| C46 | Property Verification | Admin Inspect Resubmitted Property | Shows full auditable history with rejection trail | Audit trail displays prior rejection & reason | property-verification/18-inspect-modal-audit-history.png | PASS |
| C47 | Property Verification | Admin "Approve" Button | Approves property, publishes staged listing | Green feedback "Property Approved" | property-verification/19-approve-success-feedback.png | PASS |
| C48 | Property Verification | Admin Filter: VERIFIED | Displays approved property with green badge | Filter shows verified record | property-verification/20-admin-filter-verified.png | PASS |
| C49 | Property Verification | Owner Workspace Verified Card | Displays green VERIFIED badge on property | Property marked verified in owner portfolio | property-verification/21-owner-workspace-verified-property.png | PASS |
| C50 | Financial Regression | Model A (FULLY_MANAGED) Invariant Check | Verifies Platform, Rent, and Mgmt fees apply | Rent 4%, Mgmt 6% preserved; operatingModel intact | financial-regression/01-model-a-fully-managed-fees.png | PASS |
| C51 | Financial Regression | Model B (ALPM) Invariant Check | Verifies Rent Fee remains null, Mgmt fee applies | Rent Fee is null, Mgmt 4% preserved | financial-regression/02-model-b-alpm-null-rent-fee.png | PASS |
| C52 | Financial Regression | Model C (AGENT_OPERATED) Invariant Check | Verifies only Platform Fee applies; others null | Rent & Mgmt fees null; operatingModel intact | financial-regression/03-model-c-agent-operated-platform-only.png | PASS |
