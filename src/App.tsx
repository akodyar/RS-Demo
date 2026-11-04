import React from 'react';
import { Routes, Route, Link, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PropertyWizardLayout } from './components/PropertyWizardLayout';
import { useI18n } from './i18n/I18nProvider';
import { InfrastructureProvider } from './components/InfrastructureProvider';
import { AuthProvider } from './components/AuthProvider';
import { RequireAuth } from './components/RequireAuth';

import { FeatureFlags } from './utils/featureFlags.js';

// Suspense Loader for On-Demand Workspaces
const WorkspaceLoader: React.FC = () => {
  const { language } = useI18n();
  const loadingText = language === 'ku'
    ? 'کردنەوەی شوێنی کار...'
    : language === 'ar'
    ? 'جاري تحميل مساحة العمل...'
    : 'Loading workspace...';

  return (
    <div data-testid="workspace-loader" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-14 h-14 mb-4">
        <div className="absolute inset-0 rounded-full border-2 border-amber-500/20 animate-ping" />
        <div className="w-14 h-14 rounded-full border-3 border-t-amber-400 border-r-amber-500/40 border-b-transparent border-l-transparent animate-spin" />
      </div>
      <div className="flex items-center gap-2" dir={language === 'en' ? 'ltr' : 'rtl'}>
        <span className="text-amber-400 font-bold tracking-wider text-xs uppercase">HomeHub</span>
        <span className="text-slate-600 text-xs">•</span>
        <span className="text-slate-400 text-xs font-medium">{loadingText}</span>
      </div>
    </div>
  );
};

// Code-Split Workspaces & Pages (Dynamic Imports)
const PropertyCommandCenter = React.lazy(() => import('./pages/PropertyCommandCenter').then(m => ({ default: m.PropertyCommandCenter })));
const PropertyDetailPage = React.lazy(() => import('./pages/PropertyDetailPage').then(m => ({ default: m.PropertyDetailPage })));
const TenantWorkspacePage = React.lazy(() => import('./pages/TenantWorkspace').then(m => ({ default: m.TenantWorkspacePage })));
const BuyerWorkspacePage = React.lazy(() => import('./pages/BuyerWorkspace').then(m => ({ default: m.BuyerWorkspacePage })));
const AccountantWorkspacePage = React.lazy(() => import('./pages/AccountantWorkspace').then(m => ({ default: m.AccountantWorkspacePage })));
const VendorWorkspacePage = React.lazy(() => import('./pages/VendorWorkspace').then(m => ({ default: m.VendorWorkspacePage })));
const OwnerWorkspacePage = React.lazy(() => import('./pages/OwnerWorkspace').then(m => ({ default: m.OwnerWorkspacePage })));
const AdminTrustWorkspacePage = React.lazy(() => import('./pages/AdminTrustWorkspace').then(m => ({ default: m.AdminTrustWorkspacePage })));
const CompanyWorkspacePage = React.lazy(() => import('./pages/CompanyWorkspace').then(m => ({ default: m.CompanyWorkspacePage })));
const CompanyCRMWorkspacePage = React.lazy(() => import('./pages/CompanyCRMWorkspace').then(m => ({ default: m.CompanyCRMWorkspacePage })));
const PropertyPassportPage = React.lazy(() => import('./pages/PropertyPassport').then(m => ({ default: m.PropertyPassportPage })));
const PlatformAdminWorkspacePage = React.lazy(() => import('./pages/PlatformAdminWorkspace').then(m => ({ default: m.PlatformAdminWorkspacePage })));
const IntegrationsAdminWorkspacePage = React.lazy(() => import('./pages/IntegrationsAdminWorkspace').then(m => ({ default: m.IntegrationsAdminWorkspacePage })));
const CompanyIntelligenceWorkspacePage = React.lazy(() => import('./pages/CompanyIntelligenceWorkspace').then(m => ({ default: m.CompanyIntelligenceWorkspacePage })));
const MarketplacePage = React.lazy(() => import('./pages/MarketplacePage').then(m => ({ default: m.MarketplacePage })));
const PortfolioWorkspacePage = React.lazy(() => import('./pages/PortfolioWorkspacePage').then(m => ({ default: m.PortfolioWorkspacePage })));
const MaintenanceWorkspacePage = React.lazy(() => import('./pages/MaintenanceWorkspacePage').then(m => ({ default: m.MaintenanceWorkspacePage })));
const AgentWorkspace = React.lazy(() => import('./pages/AgentWorkspace').then(m => ({ default: m.AgentWorkspace })));

const AddPropertyPage = React.lazy(() => import('./pages/AddPropertyPage').then(m => ({ default: m.AddPropertyPage })));
const TenantOnboardingPage = React.lazy(() => import('./pages/TenantOnboarding').then(m => ({ default: m.TenantOnboardingPage })));
const CompanyOnboardingPage = React.lazy(() => import('./pages/CompanyOnboarding').then(m => ({ default: m.CompanyOnboardingPage })));
const TenantMaintenanceRequest = React.lazy(() => import('./pages/TenantMaintenanceRequest').then(m => ({ default: m.TenantMaintenanceRequest })));
const OnboardingWorkflow = React.lazy(() => import('./components/onboarding/OnboardingWorkflow').then(m => ({ default: m.OnboardingWorkflow })));
const PromptsPage = React.lazy(() => import('./pages/PromptsPage').then(m => ({ default: m.PromptsPage })));
const SearchExplorerPage = React.lazy(() => import('./pages/SearchExplorerPage').then(m => ({ default: m.SearchExplorerPage })));
const AdminLoginPage = React.lazy(() => import('./pages/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const HomePage = React.lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const RentalsPage = React.lazy(() => import('./pages/RentalsPage').then(m => ({ default: m.RentalsPage })));
const RentManagementPage = React.lazy(() => import('./pages/RentManagementPage').then(m => ({ default: m.RentManagementPage })));
const ServicesPage = React.lazy(() => import('./pages/ServicesPage').then(m => ({ default: m.ServicesPage })));
const CompanyProfilePage = React.lazy(() => import('./pages/CompanyProfilePage').then(m => ({ default: m.CompanyProfilePage })));

const Dashboard = () => {
  const { t } = useI18n();
  return (
    <div className="p-4 text-white">
      <h1 className="text-2xl font-bold mb-4 text-amber-300">{t('nav.dashboard')}</h1>
      <p className="text-slate-300">Welcome to the Real Estate Platform. Select a role workspace on the left.</p>
    </div>
  );
};

const Properties = () => {
  const { t } = useI18n();
  return (
    <div className="p-6 space-y-4 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('nav.properties', 'Properties')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('property.portfolio', 'Property Portfolio & Management')}</p>
        </div>
        <Link 
          to="/properties/add" 
          className="px-4 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 rounded-xl font-extrabold text-sm transition-all shadow-md shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
        >
          <span>{t('property.add_new', 'Add New Property')}</span>
        </Link>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <InfrastructureProvider>
      <AuthProvider>
        <React.Suspense fallback={<WorkspaceLoader />}>
          <Routes>
            {/* Property Creation Wizard (Isolated Layout) */}
            <Route element={<RequireAuth><PropertyWizardLayout /></RequireAuth>}>
              <Route path="properties/add" element={<AddPropertyPage />} />
            </Route>

            {/* Main Home Page & Discovery Marketplace (Open to all with Layout) */}
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="rentals" element={<RentalsPage />} />
              <Route path="rent-management" element={<RentManagementPage />} />
              <Route path="services" element={<ServicesPage />} />
              <Route path="marketplace" element={<MarketplacePage />} />
              <Route path="rent" element={<SearchExplorerPage domainMode="rent-only" />} />
              <Route path="sale" element={FeatureFlags.BUY_SELL_ENABLED ? <SearchExplorerPage domainMode="sale-only" /> : <Navigate to="/rentals" replace />} />
              <Route path="search" element={<SearchExplorerPage />} />
              <Route path="explore" element={<SearchExplorerPage />} />
              <Route path="properties" element={<Properties />} />
              <Route path="properties/:id" element={<PropertyDetailPage />} />
              <Route path="properties/:id/command-center" element={<PropertyCommandCenter />} />
              <Route path="properties/:id/manage" element={<PropertyCommandCenter />} />
              <Route path="rentals/:id" element={<PropertyDetailPage />} />
            </Route>

            {/* Onboarding & Authentication Flows */}
            <Route path="/welcome" element={<OnboardingWorkflow initialStep="welcome" />} />
            <Route path="/onboarding" element={<OnboardingWorkflow initialStep="welcome" />} />
            <Route path="/login" element={<OnboardingWorkflow initialStep="login" />} />
            <Route path="/loging" element={<Navigate to="/login" replace />} />
            <Route path="/signin" element={<Navigate to="/login" replace />} />
            <Route path="/auth" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<Navigate to="/onboarding/purpose" replace />} />
            <Route path="/signup" element={<Navigate to="/onboarding/purpose" replace />} />
            <Route path="/onboarding/capabilities" element={<Navigate to="/onboarding/purpose" replace />} />
            <Route path="/onboarding/purpose" element={<OnboardingWorkflow initialStep="purpose" />} />
            <Route path="/onboarding/signup" element={<OnboardingWorkflow initialStep="signup" />} />
            <Route path="/onboarding/verification" element={<OnboardingWorkflow initialStep="verification" />} />
            <Route path="/onboarding/verify" element={<OnboardingWorkflow initialStep="verification" />} />
            <Route path="/onboarding/role" element={<OnboardingWorkflow initialStep="role_confirm" />} />
            <Route path="/onboarding/profile" element={<OnboardingWorkflow initialStep="profile_setup" />} />
            <Route path="/onboarding/review" element={<OnboardingWorkflow initialStep="profile_review" />} />
            <Route path="/onboarding/success" element={<OnboardingWorkflow initialStep="success" />} />
            <Route path="/prompts" element={<PromptsPage />} />
            <Route path="/company/:id" element={<CompanyProfilePage />} />
            <Route path="/admin" element={<AdminLoginPage />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin/dashboard" element={<RequireAuth><PlatformAdminWorkspacePage /></RequireAuth>} />
            <Route path="/admin/control-center" element={<RequireAuth><PlatformAdminWorkspacePage /></RequireAuth>} />
            <Route path="/buyer" element={<RequireAuth><BuyerWorkspacePage /></RequireAuth>} />
            <Route path="/buyer/*" element={<RequireAuth><BuyerWorkspacePage /></RequireAuth>} />
            <Route path="/workspace/buyer" element={<RequireAuth><BuyerWorkspacePage /></RequireAuth>} />
            <Route path="/tenant" element={<RequireAuth><TenantWorkspacePage /></RequireAuth>} />
            <Route path="/tenant/*" element={<RequireAuth><TenantWorkspacePage /></RequireAuth>} />
            <Route path="/owner" element={<RequireAuth><OwnerWorkspacePage /></RequireAuth>} />
            <Route path="/owner/*" element={<RequireAuth><OwnerWorkspacePage /></RequireAuth>} />
            <Route path="/agent" element={<RequireAuth><AgentWorkspace /></RequireAuth>} />
            <Route path="/agent/*" element={<RequireAuth><AgentWorkspace /></RequireAuth>} />
            <Route path="/company" element={<RequireAuth><CompanyWorkspacePage /></RequireAuth>} />
            <Route path="/company/members" element={<RequireAuth><CompanyWorkspacePage /></RequireAuth>} />
            <Route path="/company/crm" element={<RequireAuth><CompanyCRMWorkspacePage /></RequireAuth>} />
            <Route path="/workspace/company/crm" element={<RequireAuth><CompanyCRMWorkspacePage /></RequireAuth>} />
            <Route path="/company/intelligence" element={<RequireAuth><CompanyIntelligenceWorkspacePage /></RequireAuth>} />
            <Route path="/accountant" element={<RequireAuth><AccountantWorkspacePage /></RequireAuth>} />
            <Route path="/workspace/accountant" element={<RequireAuth><AccountantWorkspacePage /></RequireAuth>} />
            <Route path="/admin/finances" element={<RequireAuth><AccountantWorkspacePage /></RequireAuth>} />
            <Route path="/admin/fees" element={<RequireAuth><PlatformAdminWorkspacePage /></RequireAuth>} />
            <Route path="/admin/operating-models" element={<RequireAuth><PlatformAdminWorkspacePage /></RequireAuth>} />
            <Route path="/admin/pricing-tiers" element={<RequireAuth><PlatformAdminWorkspacePage /></RequireAuth>} />
            <Route path="/vendor" element={<RequireAuth><VendorWorkspacePage /></RequireAuth>} />
            <Route path="/vendor/*" element={<RequireAuth><VendorWorkspacePage /></RequireAuth>} />
            {/* Authenticated Application & Role Workspaces */}
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="onboarding/tenant" element={<TenantOnboardingPage />} />
              <Route path="onboarding/company" element={<CompanyOnboardingPage />} />
              <Route path="tenant/maintenance/new" element={<TenantMaintenanceRequest />} />
              <Route path="tenant/maintenance-request" element={<TenantMaintenanceRequest />} />
              <Route path="tenant/maintenance" element={<TenantMaintenanceRequest />} />
              
              <Route path="workspace/owner" element={<OwnerWorkspacePage />} />
              <Route path="workspace/company" element={<Navigate to="/company" replace />} />
              <Route path="workspace/company/crm" element={<CompanyCRMWorkspacePage />} />
              <Route path="workspace/company/intelligence" element={<CompanyIntelligenceWorkspacePage />} />
              <Route path="workspace/passport" element={<PropertyPassportPage />} />
              <Route path="workspace/tenant" element={<TenantWorkspacePage />} />
              <Route path="workspace/buyer" element={<BuyerWorkspacePage />} />
              <Route path="workspace/agent" element={<AgentWorkspace />} />
              <Route path="workspace/broker" element={<Navigate to="/workspace/agent" replace />} />
              <Route path="workspace/accountant" element={<AccountantWorkspacePage />} />
              <Route path="workspace/vendor" element={<VendorWorkspacePage />} />
              <Route path="workspace/maintenance" element={<MaintenanceWorkspacePage />} />
              <Route path="workspace/portfolio" element={<PortfolioWorkspacePage />} />
              <Route path="workspace/autopilot" element={<Navigate to="/" replace />} />
              <Route path="workspace/admin" element={<AdminTrustWorkspacePage />} />
              <Route path="workspace/platform-admin" element={<PlatformAdminWorkspacePage />} />
              <Route path="workspace/integrations" element={<IntegrationsAdminWorkspacePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </InfrastructureProvider>
  );
}
