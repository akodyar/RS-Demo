# HOMEHUB — AI GOVERNANCE & AUTONOMOUS SAFETY POLICY

## 1. Vision & Role of AI in HomeHub
Artificial Intelligence in HomeHub functions as a high-efficiency cognitive assistant, triaging complex events, generating localized marketing copy, and preparing optimal operational actions. However, **AI is never an unconstrained authority**. Deterministic application security, role-based access control, and human approval always take precedence.

## 2. Autonomy Levels
HomeHub defines six explicit autonomy tiers:
1. `ASSIST_ONLY`: Generates drafts, answers general inquiries, explains property stats (e.g. drafting listing descriptions in Kurdish/Arabic).
2. `RECOMMEND`: Analyzes data and highlights insights (e.g. "Rent in Dream City has risen 4%; consider adjusting renewal terms").
3. `PREPARE_ACTION`: Generates a fully populated, valid payload for an operation (e.g. drafting a lease renewal document) but stops prior to submission.
4. `REQUIRE_APPROVAL`: Actions above low-risk thresholds must be approved by an authorized human before execution.
5. `LIMITED_AUTONOMY`: Executes low-risk, idempotent background actions (e.g. sending scheduled payment reminders, tagging maintenance ticket categories).
6. `CONTROLLED_AUTONOMY`: Bounded actions permitted only within pre-authorized owner spending limits and policy limits.

## 2.1 Action Classification Tiers & Execution Boundaries
HomeHub establishes a rigid three-tier operational classification model:
- **Class A (Advisory / Non-Executable)**: Purely informational analysis and recommendations (e.g. portfolio anomaly advisories, valuation insights, market analysis, communication drafts). **Class A actions NEVER execute operational mutations or external side effects under any circumstance** and cannot accept approval transitions (`ADVISORY_CANNOT_EXECUTE`, `ADVISORY_CANNOT_APPROVE`).
- **Class B (Pre-Approved Low-Risk Automation)**: Operational automation permitted ONLY within strict policy limits, authorized property scopes, spending caps (e.g. max 500 USD), and quiet hours (e.g. drafting maintenance tickets, sending scheduled rent reminders).
- **Class C (High-Risk Actions)**: Operations with legal, financial, or property consequences (e.g. ownership proposals, contract modifications, lease renewals, lease terminations, financial disbursements). **Class C strictly mandates authorized human sign-off; autonomous AI execution is strictly prohibited**.

## 3. Forbidden Autonomous Actions
The AI engine is **strictly prohibited** from performing the following actions autonomously without explicit human sign-off:
- Initiating or executing financial payments, bank transfers, or refunds.
- Transferring property ownership or modifying `ownership_records`.
- Signing or executing legally binding contracts or leases.
- Approving maintenance expenses that exceed the property's configured spending limit.
- Evicting tenants, terminating active leases, or changing rent amounts unilaterally.
- Granting or modifying user roles, organization memberships, or system permissions.
- Overriding verification states (`TAPU`, identity, KYB).

## 4. Operational Safety Controls
- **Prompt Injection Defense**: User inputs are treated as untrusted data strings. System instructions and persona boundaries are enforced via structured schemas and system prompts.
- **Context Isolation**: Prompts receive strictly scoped context. A tenant's prompt cannot access other tenants' payment histories or owner portfolio metrics.
- **Action Preview & Dry-Run**: When proposing an automated action, the AI must provide a human-readable summary of the exact changes and financial consequences.
- **Audit Logging**: Every AI-generated action, recommendation, or triage decision is tagged with `aiGenerated: true` and logged in `audit_logs`.
- **Emergency Kill Switch**: The Platform Admin retains an immediate kill switch (`aiEnabled: false` or setting autonomy to `ASSIST_ONLY`) to disable autonomous execution across the entire ecosystem or within specific domains.
