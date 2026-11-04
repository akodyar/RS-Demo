# HomeHub Screenshot Evidence Index (56 Artifacts)

### 1. Admin Fee Management (`screenshots/admin-fees/`) — 21 Artifacts
1. `01-admin-dashboard-hero.png`: Admin dashboard overview and quick actions.
2. `02-admin-settings-overview.png`: Admin Settings module showing global financial policies and platform fee rate input.
3. `03-platform-fee-negative-validation.png`: Real-time validation error for negative platform fee rate (-0.05).
4. `04-platform-fee-exceeds-max-validation.png`: Real-time validation error for rate exceeding 50% limit (0.85).
5. `05-platform-fee-overprecision-validation.png`: Real-time validation error for exceeding 4 decimal places (0.03555).
6. `06-platform-fee-empty-validation.png`: Real-time validation error for empty rate input.
7. `07-platform-fee-pending-mutation.png`: Pending mutation badge indicating uncommitted change (3.50%).
8. `08-platform-fee-save-success.png`: Successful server persistence notification for platform fee rate update.
9. `09-platform-fee-persisted-after-reload.png`: Verification that rate (0.035) survives full browser reload.
10. `10-admin-settings-toggles.png`: Maintenance mode and 2FA security policy toggles.
11. `11-fee-applicability-matrix.png`: Complete 3-fee applicability matrix for Models A, B, and C with financial safety notes.
12. `12-pricing-tiers-overview.png`: Tiered Pricing module listing existing portfolio tiers.
13. `13-pricing-tier-modal-empty.png`: Create New Tier modal in initial state.
14. `14-pricing-tier-validation-errors.png`: Required-field validation feedback on empty tier form submission.
15. `15-pricing-tier-filled-valid.png`: Valid tier configuration (Min: 15, Max: 100, Rent Fee: 3.5%, Mgmt Fee: 5.5%, Priority: 8).
16. `15b-pricing-tier-modal-dismissed-on-cancel.png`: Create Tier modal cleanly dismissed upon clicking Cancel, leaving baseline tiers untouched.
17. `16-pricing-tier-created-success.png`: Green success banner on successful tier creation.
18. `17-pricing-tier-grid-updated.png`: Updated pricing tier grid displaying the newly created tier.
19. `18-admin-properties-fee-breakdowns.png`: Admin Properties module showing individual property 3-fee breakdown cards.
20. `19-property-fee-modal-open.png`: Property-level fee editing modal.
21. `20-property-fee-saved-success.png`: Confirmation toast for property-specific fee update.

### 2. Property Verification Lifecycle (`screenshots/property-verification/`) — 21 Artifacts
1. `01-add-property-step0-type.png`: Step 0: Property type selection (Apartment selected).
2. `02-add-property-step1-basic-info.png`: Step 1: Basic property title and description.
3. `03-add-property-step2-location.png`: Step 2: City, governorate, and coordinates.
4. `04-add-property-step3-specifications.png`: Step 3: Area, bedroom, bathroom, and floor specifications.
5. `05-add-property-step4-amenities.png`: Step 4: Amenity selection chips.
6. `06-add-property-step5-photos.png`: Step 5: Photo presets and upload controls.
7. `07-add-property-step6-ownership.png`: Step 6: 100% individual ownership configuration.
8. `08-add-property-step7-management.png`: Step 7: Operations model and agreed property fee rates.
9. `09-add-property-step8-review.png`: Step 8: Final review and submission button.
10. `10-admin-filter-pending.png`: Admin Properties module filtered by PENDING_VERIFICATION.
11. `11-inspect-modal-pending.png`: Admin property inspection modal showing initial pending state.
12. `12-reject-missing-reason-error.png`: Mandatory rejection reason enforcement error.
13. `13-reject-reason-entered.png`: Admin enters official rejection rationale.
14. `14-reject-success-feedback.png`: Admin rejection feedback confirmation.
15. `15-admin-filter-rejected.png`: Admin Properties table filtered by REJECTED status.
16. `16-owner-workspace-rejected-banner.png`: Owner portfolio displaying rejection alert with admin reason.
17. `17-owner-workspace-resubmitted-pending.png`: Owner resubmits property; status returns to PENDING_VERIFICATION.
18. `18-inspect-modal-audit-history.png`: Admin inspection modal displaying auditable decision history trail.
19. `19-approve-success-feedback.png`: Admin approval success feedback.
20. `20-admin-filter-verified.png`: Admin Properties table filtered by VERIFIED status.
21. `21-owner-workspace-verified-property.png`: Owner portfolio displaying green VERIFIED badge.

### 3. Owner Management Choice (`screenshots/management-choice/`) — 11 Artifacts
1. `01-submission-confirmation-banner.png`: Post-creation banner with PENDING_VERIFICATION notice.
2. `02-three-management-options.png`: 3 dedicated management options (A: SELF, B: HOMEHUB, C: AGENT).
3. `03-agent-managed-selected-with-dropdown.png`: Option C selected with verified management company dropdown and legal warning.
4. `04-homehub-managed-selected.png`: Option B selected with AWAITING_ONBOARDING arrangement status.
5. `05-self-managed-selected.png`: Option A selected with NOT_APPLICABLE arrangement status.
6. `05a-self-managed-persisted-after-reload.png`: SELF_MANAGED choice and NOT_APPLICABLE status persist across full browser reload.
7. `05b-homehub-managed-persisted-after-reload.png`: HOMEHUB_MANAGED choice and AWAITING_ONBOARDING status persist across full browser reload.
8. `05c-agent-managed-persisted-after-reload.png`: AGENT_MANAGED choice, selected verified agent, and AWAITING_AGREEMENT persist across full browser reload.
9. `06-preference-saved-success.png`: Preference saved confirmation banner with next step guidance.
10. `07-owner-portfolio-pending-card.png`: Owner portfolio card showing pending status and management choice.
11. `08-active-agreement-conflict.png`: Conflict error banner when active agreement blocks switch to SELF_MANAGED.

### 4. Financial Regression & Operating Models (`screenshots/financial-regression/`) — 3 Artifacts
1. `01-model-a-fully-managed-fees.png`: Model A: FULLY_MANAGED with Platform, Rent, and Mgmt fees.
2. `02-model-b-alpm-null-rent-fee.png`: Model B: AGENT_LISTED_PLATFORM_MANAGED with strictly null rent fee.
3. `03-model-c-agent-operated-platform-only.png`: Model C: AGENT_OPERATED with only Platform Fee applying.
