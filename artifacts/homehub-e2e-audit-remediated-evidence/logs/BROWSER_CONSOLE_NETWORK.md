# Browser Console and Network Interaction Evidence

- **Console Errors Recorded**: 0 unhandled runtime errors during final test execution.
- **Network Invariants**:
  * `PATCH /api/admin/financial-policies/PLATFORM_FEE_RATE`: Returned HTTP 200 with updated value `0.035` and logged audit action.
  * `POST /api/admin/pricing-tiers`: Returned HTTP 201 with created tier ID and priority 8.
  * `PUT /api/properties/:id`: Updated property-level `rentFee` to `0.045` with HTTP 200.
  * `POST /api/properties`: Successfully registered property in `PENDING_VERIFICATION` with HTTP 201.
  * `GET /api/properties/eligible-agents`: Returned verified company list (`status = VERIFIED`).
  * `POST /api/properties/:id/management-preference`:
    - `SELF_MANAGED` -> HTTP 200 (`managementArrangementStatus: NOT_APPLICABLE`)
    - `HOMEHUB_MANAGED` -> HTTP 200 (`managementArrangementStatus: AWAITING_ONBOARDING`)
    - `AGENT_MANAGED` + verified company -> HTTP 200 (`managementArrangementStatus: AWAITING_AGREEMENT`)
    - `AGENT_MANAGED` + unverified company -> HTTP 400 Bad Request
    - `SELF_MANAGED` with active agreement -> HTTP 409 Conflict
  * `POST /api/admin/properties/:id/verify`:
    - Rejection without reason -> HTTP 400 Bad Request
    - Rejection with reason -> HTTP 200 with decision audit entry
    - Resubmit -> HTTP 200 (`PENDING_VERIFICATION`)
    - Approval -> HTTP 200 (`VERIFIED`, staged listing transitioned to `PUBLISHED`)
