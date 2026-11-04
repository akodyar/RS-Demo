# HomeHub Discovered Defect Log & Remediation Record

### Defect 1: Missing UI Icon Import in AddPropertyPage.tsx
- **Severity**: HIGH
- **Component**: `src/pages/AddPropertyPage.tsx` line 546
- **Reproduction**: Navigate to Add Property submission confirmation view (`showManagementChoice && createdProperty`).
- **Symptom**: Runtime React crash with `ReferenceError: Clock is not defined`.
- **Root Cause**: The `Clock` icon from `lucide-react` was rendered inside the `PENDING_VERIFICATION` alert badge without being included in the lucide-react import list.
- **Fix**: Added `Clock` to the `lucide-react` import list in `src/pages/AddPropertyPage.tsx`.
- **Regression Test**: Verified in Playwright E2E Domain 2.2 and visual inspection of `01-submission-confirmation-banner.png`.

### Defect 2: Missing Request Body Aliases in Management Preference Route
- **Severity**: MEDIUM
- **Component**: `src/server/routes/properties.ts` line 113
- **Reproduction**: Submit management preference with payload key `preference` instead of `managementPreference` or `managingAgentId` instead of `agentCompanyId`.
- **Symptom**: Returned HTTP 400 `VALIDATION_ERROR: managementPreference is required`.
- **Root Cause**: The route handler strictly looked for `req.body.managementPreference` without defensive aliasing.
- **Fix**: Added fallback alias extraction:
  `const managementPreference = req.body.managementPreference || req.body.preference;`
  `const agentCompanyId = req.body.agentCompanyId || req.body.managingAgentId || req.body.agentId;`
- **Regression Test**: Validated in `tests/property-verification-and-owner-management-choice.test.ts` and E2E suite.

### Defect 3: Missing Test IDs on Critical Admin Navigation and Action Controls
- **Severity**: LOW / TESTABILITY
- **Component**: `src/components/admin/AdminQuickActions.tsx`, `AdminPropertiesModule.tsx`, `AdminSettingsModule.tsx`, `PlatformAdminWorkspace.tsx`
- **Reproduction**: Automated browser runner was unable to deterministically target quick actions and back buttons across locales.
- **Fix**: Added `data-testid="admin-quick-action-${act.key}"`, `data-testid="admin-properties-back-btn"`, `data-testid="admin-settings-back-btn"`, and `data-testid="admin-pricing-back-btn"`.
- **Regression Test**: E2E test runs cleanly across RTL Kurdish, Arabic, and English.

### Defect 4: Cascading Foreign Key Order in Test Teardown
- **Severity**: MEDIUM
- **Component**: `tests/e2e/homehub-admin-fees-and-property-verification.spec.ts` and `tests/e2e/fees-and-pricing.spec.ts`
- **Reproduction**: Deleting test properties caused foreign key constraint violations on dependent `notifications` and `verificationRecords`.
- **Fix**: Added ordered cascade deletion of dependent records prior to deleting test properties in `afterAll` / `afterEach` teardowns.
- **Regression Test**: E2E tests clean up 100% of generated test records without residual database artifacts.
