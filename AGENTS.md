# AGENTS.md — HOMEHUB ENGINEERING AGENT GUIDELINES

## Project Identification
- **Project**: HomeHub (پلاتفۆرمی مۆدێرنی خانووبەرە)
- **Primary Agent Role**: Lead Full-Stack & Systems Engineering Agent
- **Core Directive**: Adhere strictly to the master architectural decisions, security boundaries, and domain roadmaps. Do NOT redesign the application or silently reopen closed domains.

## Critical Invariants & Rules
1. **PostgreSQL + Drizzle ORM is the Authoritative Backend**:
   - Never introduce Firebase Firestore or parallel JSON shadow stores for operational/business state.
   - Never fabricate mock database records when database is unconfigured; enforce clean fail-closed responses (`503 DATABASE_NOT_CONFIGURED`).
2. **Ownership vs. Management Separation**:
   - `ownership_records` alone defines ownership.
   - `management_agreements` governs company property management. Management does NOT imply ownership.
3. **Dynamic 3-Fee Financial Architecture**:
   - The obsolete hardcoded 5% commission model has been superseded by the dynamically allocated 3-Fee Model (Platform Fee, Rent Fee, Management Fee) fetched from `financial_policies`.
   - Fees apply solely to `CONFIRMED` rent payments and must never be applied to property sales or purchases.
   - Never pass fees as a tenant surcharge.
4. **AI Safety & Deterministic Authorization**:
   - AI assistants draft and recommend; deterministic application authorization checks always precede execution.
   - High-risk operations (transfers, contracts, lease terminations, spending above thresholds) strictly mandate human sign-off.
5. **Localization & RTL Standards (Strict UI & Chat Communication Mandate)**:
   - Native Kurdish Sorani (`ku`) with strict RTL layout is primary. Arabic (`ar`) RTL and English (`en`) LTR are fully supported.
   - **PERMANENT CHAT RULE**: Whenever responding or explaining in Kurdish Sorani (or Arabic) to the user, the agent MUST ALWAYS format and output strictly from right to left using `<div dir="rtl" style="text-align: right; direction: rtl;">...</div>`.
   - All numbers, enumeration, brackets, parentheses, and punctuation in Kurdish responses MUST follow RTL orientation without flipped brackets, inverted numbers, or misaligned punctuation.
   - Technical IDs, phone numbers (`+964`), code snippets, and LTR symbols inside Kurdish prose must be wrapped in appropriate LTR isolation spans (`<span dir="ltr">...</span>` or inline code backticks) to prevent bidirectional layout distortion.
   - In application UI, `dir="rtl"` is strictly applied to document root and containers whenever language is `ku` or `ar`.
6. **Engineering Workflow Discipline**:
   - One Domain $\rightarrow$ One Comprehensive Implementation $\rightarrow$ One Final Deep Closure Audit $\rightarrow$ Close $\rightarrow$ Next Domain.
   - Current Next Domain: **PRODUCTION DEPLOYMENT & LIVE CLOUD INFRASTRUCTURE (ALL 12 DOMAINS CLOSED)**.
7. **Authorized Browser Testing & Interaction Policy**:
   - Browser-based UI testing, automated verification, and interactive browser execution (writing into inputs, clicking buttons, submitting forms, triggering navigation) are fully authorized for local development, isolated test environments, and authorized staging environments.
   - **PERMANENT MANDATE: OPTION C (PROJECT-LOCAL PLAYWRIGHT)**:
     * Always select Option C: Use Project-Local Playwright instead of the IDE browser_subagent.
     * All browser tests, UI verifications, and screenshot captures must execute via the project's locally installed Playwright (`npx playwright test` or node scripts using `playwright` from `node_modules`).
     * Do NOT depend on or retry `browser_subagent` for routine browser testing or visual evidence capture. Always use Option C every time screenshots or browser tests are needed.
     * **Full User Approval & Autonomous Execution**: The user has explicitly, permanently authorized and approved Option C. The agent has standing, unblocked permission to execute project-local Playwright tests, UI interactions, and screenshot captures autonomously without stopping to ask for user permission or confirmation. Never claim inability to use a browser; use Option C directly.
   - The dedicated headless Playwright (or established browser-test frameworks) is explicitly authorized for real browser verification, dynamic UI interaction, typing/writing, and asynchronous workflow observation in authorized local and test environments.
   - **Zero-Obstacle & Bounded Readiness Standards**:
     * Agents and test runners must NEVER wait for `networkidle` or require every network request / background polling request to finish before inspecting or interacting with the page.
     * Agents must NEVER require the application to become completely idle before proceeding with inspection, typing, or clicking.
     * All navigations, page loads, and selector readiness checks must be bounded, fast, and resilient:
       - Use `waitUntil: 'domcontentloaded'` for page navigations.
       - Use bounded selector/element readiness checks (recommended 5,000–10,000 ms max).
       - Inspect DOM elements immediately once relevant UI containers are rendered.
     * Unbounded navigation waits, indefinite selector waits, and rigid networkidle requirements are strictly prohibited.
   - Verification hierarchy: Live browser-based UI verification with active DOM interaction is formally recognized and distinguished from API-only route tests, static source analysis, and unit test evidence.
   - Browser tests must use synthetic test accounts and data exclusively.
   - Tests must never access production databases (`homehub_production`) or use real payment gateways.
   - Browser tests must verify visible UI behavior and real application workflows rather than merely checking that pages exist.
   - Browser testing must preserve server-side authorization and financial invariants.
   - Test results must distinguish passed, failed, skipped, and unverified behavior.
   - Tests must never be reported as successful without actual execution evidence.
   - All existing restrictions unrelated to browser testing remain in full force.
   - For detailed procedures and patterns, see [`/docs/testing/BROWSER_TESTING_GUIDELINES.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/testing/BROWSER_TESTING_GUIDELINES.md).
8. **HomeHub Standard Port Mandate (localhost:3000)**:
   - Port `3000` (`http://localhost:3000`, `127.0.0.1:3000`) is exclusively and permanently reserved for the HomeHub project.
   - All development servers, APIs, browser test targets, and local services for HomeHub MUST bind to and run on port 3000.
   - Do NOT divert HomeHub to any other port (e.g. 3005) unless specifically and explicitly instructed by the user.

## Key Documentation Index
- Master Context: [`/docs/HOMEHUB_MASTER_CONTEXT.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/HOMEHUB_MASTER_CONTEXT.md)
- Domain Status: [`/docs/HOMEHUB_DOMAIN_STATUS.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/HOMEHUB_DOMAIN_STATUS.md)
- Architecture Decisions: [`/docs/architecture/DECISIONS.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/architecture/DECISIONS.md)
- Business Rules: [`/docs/business/BUSINESS_RULES.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/business/BUSINESS_RULES.md)
- Security Model: [`/docs/security/SECURITY_MODEL.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/security/SECURITY_MODEL.md)
- Financial Policy: [`/docs/finance/FINANCIAL_POLICY.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/finance/FINANCIAL_POLICY.md)
- AI Governance: [`/docs/ai/AI_GOVERNANCE.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/ai/AI_GOVERNANCE.md)
- Design System: [`/docs/design/HOMEHUB_DESIGN_SYSTEM.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/design/HOMEHUB_DESIGN_SYSTEM.md)
- Browser Testing Guidelines: [`/docs/testing/BROWSER_TESTING_GUIDELINES.md`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/docs/testing/BROWSER_TESTING_GUIDELINES.md)

