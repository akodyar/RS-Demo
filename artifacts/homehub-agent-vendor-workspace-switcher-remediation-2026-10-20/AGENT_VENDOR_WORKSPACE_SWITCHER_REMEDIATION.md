# HomeHub — Agent & Vendor Workspace Switcher Integration & Remediation Report

**Date**: 2026-10-20  
**Domain**: Multi-Role Account Architecture & Operational Workspace Switching  
**Engineers**: Lead Full-Stack & Systems Engineering Agent  
**Status**: COMPLETE — VERIFIED VIA REGRESSION TESTS & OPTION C PLAYWRIGHT BROWSER AUTOMATION

---

## 1. Executive Summary

This engineering task resolves the Multi-Role operational gap where the **Agent** (`/agent`) and **Vendor** (`/vendor`) dashboards lacked authoritative workspace-switching entry points. Prior to this remediation, multi-role users holding Agent or Vendor credentials alongside Tenant, Owner, or Company memberships had no visual or technical means inside the Agent and Vendor dashboards to switch to their alternative authorized workspaces without manual URL navigation or re-authenticating.

By creating a modular, reusable `WorkspaceSwitcherModal` component, delegating `TenantWorkspaceSwitcherModal` directly to it, and integrating authoritative trigger controls in both dashboards, full Multi-Role operational parity has been achieved. The implementation preserves authoritative PostgreSQL validation, scoped JWT token exchange (`POST /api/auth/select-workspace`), BiDi text isolation (`<bdi>`), full RTL/LTR localization across Kurdish Sorani (`ku`), Arabic (`ar`), and English (`en`), accessible dialog semantics, and strict fail-closed authorization boundaries.

---

## 2. Confirmed Defect & Root Cause

### 2.1 The Discovered Defects
1. **Agent Workspace Layout Isolation**:
   - `src/components/Layout.tsx` explicitly suppresses the shared application header on the Agent route (`${isAgentWorkspace ? 'hidden' : ''}`). Consequently, any switcher controls attached to the shared navigation bar are completely invisible to an authenticated Agent.
   - `src/pages/AgentWorkspace.tsx` defined its own top bar and profile menu dropdown, but neither contained an entry point to trigger workspace switching.
   - `useAuth()` was consumed in `AgentWorkspace.tsx`, but only destructured `{ user, token, logout }`, ignoring `activeWorkspace`, `eligibleWorkspaces`, and `selectWorkspace`.

2. **Vendor Workspace Independent Structure**:
   - `src/pages/VendorWorkspace.tsx` uses custom `VendorHeader` and `VendorSidebar` components. Neither component exposed a workspace-switching trigger or modal state.
   - `useAuth()` was consumed only for `{ token, logout }`, lacking the authoritative switching pipeline.

3. **Tenant-Specific Hardcoding in Switcher UI**:
   - `src/components/tenant/TenantWorkspaceSwitcherModal.tsx` contained hardcoded strings such as "Stay on Tenant Portal", which would cause severe cognitive mismatch and localization defects if invoked from Agent or Vendor dashboards.

---

## 3. Architecture & Implementation Decisions

### 3.1 Architecture Invariants Preserved
1. **Authoritative Backend Authority**:
   - Workspace selection strictly calls the canonical `selectWorkspace(workspaceId)` method in `AuthProvider`, which sends `POST /api/auth/select-workspace` to the server.
   - Only server-validated eligible workspaces (`eligibleWorkspaces`) are selectable. Forged, arbitrary, or client-fabricated workspace IDs are rejected by the server with `403 INVALID_WORKSPACE_SELECTION`.
2. **Context Preservation on Failure**:
   - If the server rejects a switch or a network failure occurs, the existing JWT token, active role, and workspace context remain completely intact. No navigation occurs, and a localized recoverable error banner is displayed in `#tenant-workspace-switch-error`.
3. **Prevention of Duplicate Submissions**:
   - While a switch request is in flight (`isSwitching = true`), all interactive elements (close buttons, workspace cards, sign-out buttons) are disabled (`disabled`, `opacity-60`, `cursor-not-allowed`).
4. **Zero Mock Personas / Truthful Single-Workspace State**:
   - Single-workspace users see an explicit localized notice (`#tenant-no-alternative-workspaces-notice`) stating that only one eligible workspace exists for their account, with zero fake alternatives.
5. **Localization & RTL Standards**:
   - Centralized translations in `src/i18n/I18nProvider.tsx` were expanded with `workspace.switch_button`, `workspace.switch_button_title`, and `workspace.switch_failed` across Sorani Kurdish, Arabic, and English.
   - Mixed-direction organization names (e.g. English commercial names within Kurdish RTL text) are wrapped in `<bdi>` tags to eliminate bidirectional text bleed.
   - Modal dynamically computes role-appropriate stay buttons:
     * Agent: "مانەوە لە پۆرتالی ئەگێنت" (Kurdish) / "البقاء في بوابة الوكيل" (Arabic) / "Stay on Agent Portal" (English).
     * Vendor: "مانەوە لە پۆرتالی وەستا" (Kurdish) / "البقاء في بوابة المزود" (Arabic) / "Stay on Vendor Portal" (English).
     * Tenant: "مانەوە لە پۆرتالی کرێچی" (Kurdish) / "البقاء في بوابة المستأجر" (Arabic) / "Stay on Tenant Portal" (English).

---

## 4. Exact Files Modified & Created

| File | Status | Description |
| :--- | :--- | :--- |
| `src/components/common/WorkspaceSwitcherModal.tsx` | Created | Unified, accessible, multi-role workspace switcher component with BiDi isolation, role-aware stay labels, loading states, and backward-compatible IDs. |
| `src/components/tenant/TenantWorkspaceSwitcherModal.tsx` | Modified | Refactored into a thin wrapper delegating directly to `WorkspaceSwitcherModal` to ensure 100% backward compatibility with existing Tenant test suites. |
| `src/pages/AgentWorkspace.tsx` | Modified | Added quick switcher button (`#agent-header-switch-workspace-btn`), profile dropdown entry (`#agent-switch-workspace-btn`), switcher modal state, and authoritative selection handler. |
| `src/components/vendor/VendorHeader.tsx` | Modified | Added `onOpenWorkspaceSwitcher` prop and quick switcher trigger button (`#vendor-switch-workspace-btn`). |
| `src/components/vendor/VendorSidebar.tsx` | Modified | Added `onOpenWorkspaceSwitcher` prop and sidebar trigger button (`#vendor-sidebar-switch-workspace-btn`). |
| `src/pages/VendorWorkspace.tsx` | Modified | Wired `useAuth()` active workspaces, switcher modal state, and passed callbacks to `VendorHeader` and `VendorSidebar`. |
| `src/i18n/I18nProvider.tsx` | Modified | Registered centralized translation keys for `workspace.switch_button`, `workspace.switch_button_title`, and `workspace.switch_failed` across `en`, `ar`, and `ku`. |
| `tests/agent-vendor-workspace-switcher.test.tsx` | Created | 23-test regression suite covering Agent and Vendor entry points, single-workspace notices, BiDi tags, RTL/LTR styling, duplicate submission blocking, and real PostgreSQL integration. |
| `scripts/verify-agent-vendor-switcher-playwright.ts` | Created | Option C Playwright browser verification script testing live end-to-end multi-role and single-role scenarios against local PostgreSQL `homehub_test`. |

---

## 5. Verification Results

### 5.1 Unit & Backend Integration Regression Tests
- **Agent & Vendor Suite** (`tests/agent-vendor-workspace-switcher.test.tsx`):
  * **Result**: **23 PASSED / 0 FAILED** (Exit Code: 0)
- **Tenant Regression Suite** (`tests/tenant-workspace-switcher.test.tsx`):
  * **Result**: **20 PASSED / 0 FAILED** (Exit Code: 0)

### 5.2 Build & Type-Check Verification
- **Command**: `npx vite build`
- **Result**: Built successfully in 50.21s with **0 errors** (Exit Code: 0).
- **Bundle output**: `dist/index.html` (1.42 kB), `dist/assets/index.css` (186.74 kB), `dist/assets/index.js` (3,321.64 kB).

### 5.3 Option C Project-Local Playwright Browser Verification
- **Execution Script**: `scripts/verify-agent-vendor-switcher-playwright.ts`
- **Scenarios Verified**:
  1. Multi-role Agent login -> enters `/agent` -> opens modal -> captures `01-agent-switcher-modal-open.png`.
  2. Multi-role Agent selects Tenant workspace -> server issues scoped JWT -> navigates to `/tenant` -> captures `02-agent-switched-to-tenant.png`.
  3. Multi-role Vendor login -> enters `/vendor` -> opens modal -> captures `03-vendor-switcher-modal-open.png`.
  4. Multi-role Vendor selects Tenant workspace -> server issues scoped JWT -> navigates to `/tenant` -> captures `04-vendor-switched-to-tenant.png`.
  5. Single-role Agent login -> opens switcher -> verifies `#tenant-no-alternative-workspaces-notice` and zero fake alternatives -> captures `05-agent-single-workspace-no-alternatives.png`.
  6. Single-role Vendor login -> opens switcher -> verifies `#tenant-no-alternative-workspaces-notice` and zero fake alternatives -> captures `06-vendor-single-workspace-no-alternatives.png`.

---

## 6. Remaining Risks & Recommendations

1. **Owner Workspace E2E Integration**:
   - The Owner dashboard currently supports multi-role accounts via onboarding selection. While the backend authoritatively supports switching to and from Owner workspaces, Owner dashboard in-session switcher button verification should be addressed in the designated follow-up task.
2. **Session Expiry Handling**:
   - If a user's session token expires while viewing the switcher modal, the modal displays the localized network/authentication error and allows the user to click Sign Out safely.
