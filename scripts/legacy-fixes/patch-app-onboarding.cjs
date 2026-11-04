const fs = require('fs');
let s = fs.readFileSync('src/App.tsx', 'utf8');
if (!s.includes('CompanyOnboardingPage')) {
  s = s.replace("import { TenantOnboardingPage } from './pages/TenantOnboarding';", "import { TenantOnboardingPage } from './pages/TenantOnboarding';\nimport { CompanyOnboardingPage } from './pages/CompanyOnboarding';");
  s = s.replace("<Route path=\"onboarding/tenant\" element={<TenantOnboardingPage />} />", "<Route path=\"onboarding/tenant\" element={<TenantOnboardingPage />} />\n            <Route path=\"onboarding/company\" element={<CompanyOnboardingPage />} />");
  fs.writeFileSync('src/App.tsx', s);
}
