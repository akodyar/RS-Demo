# Open Design Decisions — Multi-Role Account Architecture

**Package**: `artifacts/homehub-multi-role-account-evidence-2026-10-19/`  
**Date**: 2026-10-19  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  
**Purpose**: Document precise architectural trade-offs that cannot be unilaterally resolved from existing documentation and require product owner sign-off.

---

## Decision 1: Active Role Session Storage Mechanics

### Context
When a user with multiple roles chooses an active role (or switches roles), where should the `activeRole` state be authoritatively stored?

### Options
- **Option 1A: Stateless JWT Claim (Recommended)**
  * **Mechanism**: On login selection or `/api/auth/roles/switch`, the server signs and returns a refreshed JWT containing `{ id, email, roles, activeRole: 'TENANT', tokenVersion }`.
  * **Pros**: 100% consistent with existing HomeHub stateless JWT architecture (`src/server/utils/auth.ts`); zero extra database writes on role switches; independent tabs can operate in different roles if desired.
  * **Cons**: Switching roles requires issuing a refreshed token and updating client `localStorage`.
- **Option 1B: PostgreSQL Column `users.active_role`**
  * **Mechanism**: Add `active_role` column to `users` table; update it on every switch.
  * **Pros**: Centralized across all devices; querying `GET /api/auth/me` always reflects the single active database role.
  * **Cons**: Incurs a PostgreSQL write on every role toggle; causes race conditions if the user opens Owner dashboard in Tab 1 and Tenant dashboard in Tab 2.

---

## Decision 2: Professional Role Eligibility Timing (Agent & Vendor)

### Context
When an existing user with an Owner or Tenant account adds an Agent or Vendor role, both roles require professional licensing in Kurdistan/Iraq (`agent_licenses`, `vendor_licenses`).

### Options
- **Option 2A: Accessible in `PENDING_VERIFICATION` State (Recommended)**
  * **Mechanism**: The user can immediately switch to their Agent/Vendor workspace to complete their professional biography, upload licenses, and set service areas. Operational privileges (publishing listings, taking work orders) are disabled by server guards until verified.
  * **Pros**: Streamlined user onboarding; users can prepare their profile without administrative delay.
  * **Cons**: Post-login role selection screen displays roles that are not yet fully active for production business.
- **Option 2B: Hidden from Role Selection until Administrator Approval**
  * **Mechanism**: The role is only displayed on the post-login choice screen once `agent_profiles.status === 'ACTIVE'` or `vendor_licenses.status === 'APPROVED'`.
  * **Pros**: Eliminates user confusion regarding unverified status.
  * **Cons**: Requires a separate "Application Status" tracking UI outside the main dashboard.

---

## Decision 3: Individual Property Owner vs. Management Company Principal

### Context
In HomeHub's architecture (`AGENTS.md` Rule 2), an individual can own private properties (`ownership_records.ownerId = userId`) while simultaneously serving as an employee or admin of a corporate property management company (`organization_members.userId = userId`, `organizations.id = companyId`).

### Options
- **Option 3A: Disaggregated Selector Choices (Recommended)**
  * **Mechanism**: Present distinct options in the role selector:
    1. *خاوەنی موڵک (سەربەخۆ)* — Personal Property Owner (Personal Portfolio)
    2. *بەڕێوەبەری کۆمپانیا (Zagros Real Estate)* — Corporate Management Company Workspace
  * **Pros**: Clean mental model; eliminates ambiguity regarding whether an action is performed on behalf of oneself or a corporate employer.
  * **Cons**: Requires mapping company memberships dynamically during the role discovery phase.
- **Option 3B: Unified "Owner / Manager" Entry with Internal Workspace Switcher**
  * **Mechanism**: Single entry "خاوەنی موڵک / بەڕێوەبەر"; inside `/owner`, an organization switcher toggles between Personal and Company modes.
  * **Pros**: Fewer top-level choices on the post-login screen.
  * **Cons**: Blurs the strict boundary between ownership and third-party management mandated by `AGENTS.md`.

---

## Decision 4: Cross-Role Communication & Notification Isolation

### Context
When a multi-role user receives an urgent tenant maintenance alert while actively working in their Property Owner workspace:

### Options
- **Option 4A: Global Aggregated Notifications with Role Badges (Recommended)**
  * **Mechanism**: The top notification bell displays all alerts for this identity, tagged with clear role badges (`[کرێنشین]`, `[خاوەن موڵک]`). Clicking a notification prompts an automatic workspace switch.
  * **Pros**: Zero missed critical alerts (e.g., water leaks or rent due dates) regardless of which workspace is currently active.
  * **Cons**: Requires notification items to carry an explicit `targetRole` attribute.
- **Option 4B: Strict Workspace Notification Partitioning**
  * **Mechanism**: Only notifications pertaining to the currently active role are displayed in the bell dropdown.
  * **Pros**: Pure workspace separation.
  * **Cons**: High risk of tenant missing time-sensitive alerts while spending long periods in owner or vendor mode.
