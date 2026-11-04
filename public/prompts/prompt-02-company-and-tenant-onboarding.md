# Prompt 2: Specialized Company & Tenant Onboarding Flows

- **Sequence**: #2 of 6
- **Phase**: Onboarding & Registration Workflows
- **Timestamp**: 2026-09-18 Turn 2
- **Filename**: `prompt-02-company-and-tenant-onboarding.md`

---

## 📝 User Prompt

```text
Implement dedicated onboarding flows for:
1. Real Estate Companies: Agency registration, commercial license verification, office branch details, agent team invitations, and initial portfolio batch upload.
2. Tenants: Digital lease acceptance, security deposit receipt confirmation, emergency contact setup, and direct maintenance request initiation.
3. Add routing and navigation for /onboarding/tenant, /onboarding/company, and /tenant/maintenance/new.
```

---

## 🛠️ Implemented Outcome

- Created TenantOnboardingPage and CompanyOnboardingPage with multi-step interactive wizard validation.
- Added TenantMaintenanceRequest component for submitting photos, urgency levels, and category selection.
- Linked new routes with role-based navigation guards and breadcrumbs.
