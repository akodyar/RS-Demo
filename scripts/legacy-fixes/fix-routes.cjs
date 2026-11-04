const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');

if (!s.includes('TenantMaintenanceRequest')) {
  s = s.replace(
    "import { TenantOnboardingPage } from './pages/TenantOnboarding';",
    "import { TenantOnboardingPage } from './pages/TenantOnboarding';\nimport { TenantMaintenanceRequest } from './pages/TenantMaintenanceRequest';"
  );
  s = s.replace(
    "<Route path=\"onboarding/tenant\" element={<TenantOnboardingPage />} />",
    "<Route path=\"onboarding/tenant\" element={<TenantOnboardingPage />} />\n            <Route path=\"tenant/maintenance/new\" element={<TenantMaintenanceRequest />} />"
  );
  fs.writeFileSync('src/App.tsx', s);
}
