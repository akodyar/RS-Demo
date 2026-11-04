# HomeHub — Property Verification & Owner Management Choice Evidence Package

## Package Overview
- **Domain**: Property Verification Lifecycle & Owner Management Choice Workflow
- **Date**: 2026-10-21
- **Lead Full-Stack & Systems Engineering Agent**
- **Target Environment**: Local PostgreSQL (`homehub_test`) on port 5432 / Local Express + Vite
- **Final Verdict**: **COMPLETE** (38/38 Passing Tests, Zero Production Access)

## Core Capabilities Delivered
1. **Server-Enforced Property Verification Default**:
   - Every newly created property defaults to `PENDING_VERIFICATION` in database and server responses.
   - Associated rental listings default to `PENDING_REVIEW` (never auto-published).
   - Direct publishing bypasses and client-side status forging are blocked (HTTP 400).
   - Marketplace search, listing details, company listings, viewing requests, and rental applications fail closed (`verificationStatus === 'VERIFIED'`).

2. **Decoupled 3-Concept Architecture**:
   - **Verification Status**: `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`.
   - **Owner Management Preference**: `SELF_MANAGED`, `HOMEHUB_MANAGED`, `AGENT_MANAGED`.
   - **Management Arrangement Status**: `NOT_APPLICABLE`, `AWAITING_ONBOARDING`, `AWAITING_AGREEMENT`, `ACTIVE`, `SUSPENDED`, `TERMINATED`.

3. **Admin Verification & Inspection Module**:
   - Admin UI in `AdminPropertiesModule.tsx` with status filter tabs, badges, and full Inspection Modal.
   - Server-side mutation guards (`requireMutationPermission`) prevent `READ_ONLY_ADMIN` and `AUDITOR` mutations.
   - Approvals atomically mark property `VERIFIED`, `status = 'ACTIVE'`, publish staged listings, and update ownership records.
   - Rejections require non-empty reasons, mark property `REJECTED`, demote listings to `DRAFT`, and notify the owner.
   - Chronological audit history endpoint (`GET /api/admin/properties/:id/verification-history`) returns reviewer email, name, decision, and reasons.

4. **Safe Material Update Re-Review Policy**:
   - Material updates to core attributes (city, street, tapuNumber, squareFeet, ownerId) on verified properties reset status to `PENDING_VERIFICATION`, unpublish active listings to `PENDING_REVIEW`, and notify the owner.
   - Owner resubmission resets property to `PENDING_VERIFICATION` and stages listings back to `PENDING_REVIEW` for admin review.

5. **Dedicated Owner Management Choice Workflow**:
   - Post-creation Step 4 in `AddPropertyPage.tsx` guides owners through choices A, B, and C.
   - Partner eligibility validation for `AGENT_MANAGED` ensures target organization exists and is verified.
   - Contractual protection blocks switching to `SELF_MANAGED` with HTTP 409 Conflict if an active agreement exists.

6. **Kurdish Sorani RTL & Arabic RTL Support**:
   - Full localized UI, status badges, and decision banners across all languages.

7. **Deferred Financial Defect Intact**:
   - Payment-reversal versus lease-renewal defect was preserved and left untouched.
