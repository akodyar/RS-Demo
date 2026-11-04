# Repository and Worktree Status

**Package**: `artifacts/homehub-multi-role-account-evidence-2026-10-19/`  
**Date**: 2026-10-19  
**Auditor**: Lead Full-Stack & Systems Engineering Agent  

---

## 1. Repository Root & Git Identifiers

- **Repository Root**: `C:/Users/zakar/Downloads/real-estate-ecosystem-platform (1)`
- **Current Branch**: `main`
- **HEAD Commit SHA**: `43175adaf6f04491e1d74e1f728a4561b7ede097`
- **Git Status Summary**:
  * Total modified/untracked entries: **657**
  * Staged changes (`^[MADRC]`): **291**
  * Unstaged modifications (`^.[MADRC]`): **182**
  * Untracked files (`^\?\?`): **302**

> [!IMPORTANT]
> **PRESERVED WORKTREE WARNING**:
> All 657 existing staged, unstaged, and untracked changes currently present in the worktree were strictly preserved. No `git checkout`, `git reset`, `git clean`, or destructive commands were executed. All prior working artifacts (including `I18nProvider.tsx` deduplication, Iraq location dropdowns in `AddPropertyPage.tsx`, and fee-policy card removal from `OwnerWorkspace.tsx`) remain 100% intact.

---

## 2. Applicable Engineering Directives (`AGENTS.md` & `Kaywan_Latest_Instructions.txt`)

The following invariants govern this repository and were rigorously maintained throughout this audit:

1. **PostgreSQL + Drizzle ORM is Authoritative**:
   - Zero mock database stores or JSON shadow databases for business/operational state.
   - Clean fail-closed responses (`503 DATABASE_NOT_CONFIGURED`) when the relational database is offline.
2. **Strict Separation of Ownership vs. Management**:
   - `ownership_records` alone defines property ownership (individual `owner_id` or corporate `company_id`).
   - `management_agreements` governs third-party company property management. Management does NOT imply ownership.
3. **Dynamic 3-Fee Financial Architecture**:
   - Hardcoded commission models are replaced by dynamically allocated 3-Fee Model (Platform Fee, Rent Fee, Management Fee) fetched from `financial_policies`.
   - Fees apply strictly to `CONFIRMED` rent payments and must never be applied to property sales.
4. **Localization & RTL Standards**:
   - Primary locale is Kurdish Sorani (`ku`) with strict RTL layout.
   - Full secondary support for Arabic (`ar`) RTL and English (`en`) LTR.
   - Numbers, phone numbers (`+964`), and technical codes must be wrapped in LTR isolation spans.
5. **Fail-Closed Authorization & AI Safety**:
   - Deterministic server-side authorization checks MUST precede any sensitive operation.
   - Client-claimed roles or query parameters must NEVER be trusted blindly.
6. **Zero-Obstacle Bounded Browser Testing (AGENTS.md Rule 7)**:
   - Zero-networkidle rule: tests must never wait for networkidle or indefinite readiness.
   - Bounded selector checks (5,000–10,000 ms max).
   - Only synthetic test accounts targeting `homehub_test` on `localhost:5432` are permitted.

---

## 3. Package Scripts & Permitted Diagnostic Commands

The following package scripts and test commands are available in `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test:role-selection": "tsx tests/role-selection-enforcement.test.tsx",
    "test:native-auth": "tsx tests/native-auth-security.test.ts",
    "test:owner-idor": "tsx tests/owner-domain-idor-adversary.test.ts",
    "test:tenant-adversary": "tsx tests/tenant-domain-adversary.test.ts",
    "test:agent-adversary": "tsx tests/agent-domain-adversary.test.ts",
    "test:vendor-adversary": "tsx tests/vendor-domain-adversary.test.ts"
  }
}
```

### Verified Diagnostic Runs
During this audit, the following non-destructive read-only verification commands were executed:
1. `npx tsx tests/role-selection-enforcement.test.tsx`:
   - Exit code: `0`
   - Result: **56 PASSED / 0 FAILED**
2. `npx tsx tests/native-auth-security.test.ts`:
   - Exit code: `0`
   - Result: **33 PASSED / 0 FAILED**

---

## 4. Current Runtime & Database Requirements

- **Runtime Engine**: Node.js v20.x or v22.x
- **Frontend Framework**: React 19.x, React Router DOM v7.x, Vite, TailwindCSS (Vanilla utility classes)
- **Backend Framework**: Express 4.x, TypeScript (via `tsx`)
- **Database Engine**: PostgreSQL 16 (Local instance: `localhost:5432`, DB Name: `homehub_test`)
- **ORM**: Drizzle ORM (`drizzle-orm/pg-core`)
- **Security & Cryptography**:
  * Password Hashing: Argon2id (`argon2` package, memoryCost: 19 MiB, timeCost: 2, parallelism: 1)
  * Session Tokens: JSON Web Tokens (`jsonwebtoken`, HS256, 7-day validity)
  * Session Invalidation: PostgreSQL atomic integer column `users.token_version`
