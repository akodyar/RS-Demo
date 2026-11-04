# HomeHub — Permanent Invariant: Mandatory Project-Local Playwright (Option C)

## Core Directive
**Option C (Project-Local Playwright) is the permanent, mandatory, and fully approved standard for all browser testing, UI verification, and screenshot captures on the HomeHub platform.**

Under no circumstances should the IDE's `browser_subagent` be used or retried for testing or evidence collection. The project's locally installed Playwright (`playwright` in `node_modules`, v1.63.0) executes reliably, cleanly bypasses external CDN/sandbox obstacles, and produces verified evidence.

### Pre-Approved & Autonomous Authorization
- **Explicit User Approval**: The user has fully authorized and approved Option C. The agent has standing authorization to execute project-local Playwright browser commands, tests, and screenshot scripts at any time.
- **Zero Inquiries / No Confirmation Required**: The agent must NEVER hesitate, ask for confirmation, or state that it lacks browser capabilities. Always execute Option C directly.

---

## 1. Permanent Invariants
1. **Always Use Option C**:
   - All browser testing, UI inspection, interaction checks (typing, clicking, form submission), and screenshots MUST run through project-local Playwright.
   - Run tests using `npx playwright test` or dedicated TypeScript/Node scripts (e.g. `npx tsx scripts/...`).
   - Never call `browser_subagent`.

2. **Standard Screenshot Capture Flow**:
   - Launch chromium headless: `const browser = await chromium.launch({ headless: true });`
   - Use viewport `1280x800` (or target device specs).
   - Navigate with `waitUntil: 'domcontentloaded'` and allow adequate timeout for initial Vite module compilation (recommended 45,000 ms for initial route load in dev mode).
   - Use bounded selector waits (5,000–10,000 ms).
   - Capture screenshot via `page.screenshot({ path: localPath, fullPage: true })`.
   - Save to `screenshots/` and copy to the current conversation artifact directory so it can be immediately viewed and embedded in markdown outputs.

3. **Zero-Obstacle Execution**:
   - Never wait for `networkidle`.
   - Never wait for full idle state before inspecting or interacting with the DOM.
   - Always bound all timeouts and close browser, server, and DB pool cleanly in a `finally` block.

4. **MANDATORY `process.exit(0)` on Success** ⚠️:
   - Scripts that call `createApp()` start Vite dev middleware, which keeps Node's event loop alive indefinitely (HMR websockets, file watchers). `server.close()` and `closePool()` alone are NOT enough to let the process exit.
   - **Every standalone script MUST call `process.exit(0)` on the success path**, e.g.:
     ```typescript
     main()
       .then(() => process.exit(0))
       .catch((err) => { console.error(err); process.exit(1); });
     ```
   - This is the **#1 cause of "stuck" background tasks** that appear to run forever in the IDE even though work completed successfully.

5. **Reference Implementation**:
   - See [`scripts/test-take-screenshot.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/scripts/test-take-screenshot.ts) for standard screenshot capture.
   - See [`scripts/verify-multi-role-playwright.ts`](file:///c:/Users/zakar/Downloads/real-estate-ecosystem-platform%20%281%29/scripts/verify-multi-role-playwright.ts) for multi-step authenticated workflow testing.
