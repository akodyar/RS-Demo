# Browser Testing & Interaction Guidelines — HomeHub Platform

## 1. Scope & Purpose
This document provides authoritative guidelines for browser-based testing, UI verification, and screenshot captures within the HomeHub platform repository. It defines execution patterns that ensure fast, reliable, and unblocked browser-based verification without hanging or failing due to unnecessary wait states.

### Mandatory Method: Option C (Project-Local Playwright)
- **Always use Option C (Project-Local Playwright)**: Since the project's own Playwright (v1.63.0) works reliably, all browser tests, UI verifications, and screenshot captures must be executed via `npx playwright test` or custom node/tsx scripts using the project's Playwright installation (`node_modules`) — bypassing the IDE's `browser_subagent` entirely.
- **Option C is the mandatory actionable path** every time you need to check the browser and take screenshots.
- **Pre-Approved & Autonomous**: Option C execution is explicitly approved by the user. The agent is authorized to run Playwright browser tests, scripts, and screenshot captures autonomously without stopping to ask for user permission or confirmation.
- Do NOT depend on or retry `browser_subagent` for routine browser testing or visual evidence capture.

---

## 2. Full Authorization for Browser Testing & Interaction
- **Interactive Verification**: Option C (Project-Local Playwright test suites and custom scripts) is fully and unconditionally authorized to launch browsers, navigate local routes, write into input fields, select options, click buttons, submit forms, capture screenshots, and observe asynchronous UI transitions in local and test environments.
- **Scope & Targets**:
  - Permitted on local development (`http://localhost:3000`), local test databases (`homehub_test`), and authorized staging environments.
  - Strictly prohibited against production databases (`homehub_production`) and real payment gateways.
  - Use synthetic personas and deterministic test accounts exclusively.

---

## 3. Strict Prohibitions: Anti-Patterns That Block Testing

### ❌ NEVER Wait for `networkidle`
- Applications frequently have background polling, telemetry, analytics, long-lived connections, or font/image streaming. Waiting for `networkidle` or `waitForLoadState('networkidle')` will often cause the browser runner to hang indefinitely or time out.
- **Rule**: `waitUntil: 'networkidle'` and `waitForLoadState('networkidle')` are strictly forbidden in all browser scripts and test specifications.

### ❌ NEVER Require the Application to Become Completely Idle
- Modern reactive SPAs (React + Vite) maintain active event loops, background queries, and periodic re-evaluations.
- Requiring total application idleness before inspecting the DOM or proceeding with the next action blocks the agent and causes test timeouts.
- **Rule**: Inspect and interact with the page immediately as soon as the target DOM container or locator is rendered.

### ❌ NEVER Use Unbounded Waits or Timeouts
- Unbounded waits (`timeout: 0` or excessively large 30,000–60,000 ms waits) mask underlying issues and lead to hung test runners.
- **Rule**: All navigation, selector, and action timeouts must be bounded (recommended 5,000–10,000 ms max).

---

## 4. Required & Recommended Patterns

### ✅ Page Navigation
Always navigate using `waitUntil: 'domcontentloaded'`:
```typescript
// Correct:
await page.goto('http://localhost:3000/onboarding', { waitUntil: 'domcontentloaded', timeout: 10000 });

// Incorrect (DO NOT USE):
// await page.goto('http://localhost:3000/onboarding', { waitUntil: 'networkidle' });
```

### ✅ Element Interaction & Writing in the Browser
Target specific elements with bounded locator visibility checks:
```typescript
// Writing / typing into form inputs:
const emailInput = page.locator('#signup-email');
await expect(emailInput).toBeVisible({ timeout: 10000 });
await emailInput.fill('user@homehub.iq');

// Clicking interactive elements:
const submitBtn = page.locator('#signup-submit-btn');
await expect(submitBtn).toBeEnabled({ timeout: 5000 });
await submitBtn.click();
```

### ✅ DOM Inspection
Read the DOM, evaluate text, or take screenshots as soon as the target element or view container is visible:
```typescript
const dashboardCard = page.locator('#tenant-current-home-card');
await expect(dashboardCard).toBeVisible({ timeout: 10000 });

// Immediately inspect or screenshot
const content = await page.content();
await page.screenshot({ path: 'test-results/tenant-dashboard.png' });
```

---

## 5. Playwright Configuration Standards
- In `playwright.config.ts`, ensure `actionTimeout` is bounded (e.g. 10,000 ms) and `navigationTimeout` is bounded (e.g. 15,000 ms).
- Maintain test timeout limits that fail fast rather than hanging indefinitely.
- Preserve the database safety gate ensuring tests target `homehub_test` and never `homehub_production`.

---

## 6. Summary Checklist
- [x] Browser testing & interaction authorized.
- [x] Writing into inputs & clicking controls authorized.
- [x] `networkidle` requirements eliminated.
- [x] Complete idleness requirements eliminated.
- [x] Unbounded timeouts removed; all waits bounded and fast.
- [x] Production safety invariants strictly preserved.
