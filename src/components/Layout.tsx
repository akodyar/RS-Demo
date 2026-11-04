import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { Building2, LayoutDashboard, Globe, AlertTriangle, LogOut, PlusCircle } from 'lucide-react';
import { useInfrastructure } from './InfrastructureProvider';
import { useAuth } from './AuthProvider';
import { HomeHubLogo } from './onboarding/HomeHubLogo';
import { FeatureFlags } from '../utils/featureFlags.js';

export const Layout: React.FC = () => {
  const { t, language, setLanguage, direction } = useI18n();
  const infrastructure = useInfrastructure();
  const { user, logout, activeWorkspace, eligibleWorkspaces, selectWorkspace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isWorkspace = location.pathname.startsWith('/workspace');
  const isVendorWorkspace = location.pathname.startsWith('/workspace/vendor');
  const isOwnerWorkspace = location.pathname.startsWith('/workspace/owner') || location.pathname === '/owner';
  const isAgentWorkspace = location.pathname.startsWith('/workspace/agent') || location.pathname === '/agent';
  const isHomePage = location.pathname === '/';

  const handleLogout = async () => {
    await logout();
    navigate('/welcome');
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-[#f7f9fc] ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {infrastructure.status !== 'READY' && infrastructure.status !== 'LOADING' && (
        <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          System running in Degraded Mode. External Provider / Database Not Configured: {infrastructure.database}.
        </div>
      )}
      {/* Mobile-first Header (Public / Marketplace routes only; suppressed inside Option 3 role workspaces) */}
      {!isOwnerWorkspace && !isWorkspace && !isAgentWorkspace && !isVendorWorkspace && (
        <header className={`bg-[#0c1322] border-b border-amber-500/30 sticky top-0 z-30 shadow-lg shadow-black/40 ${isAgentWorkspace ? 'hidden' : ''}`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2">
                  <HomeHubLogo size="sm" showTagline={false} light={true} />
                </Link>

                {/* Public Real-Estate Navigation for Core Services */}
                <nav className="hidden lg:flex items-center gap-1 text-xs sm:text-sm font-bold">
                  <Link
                    to="/"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      isHomePage
                        ? 'text-amber-300 font-bold relative after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-amber-500 after:shadow-[0_0_8px_rgba(251,191,36,0.8)]'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    {t('nav.home', 'سەرەتا')}
                  </Link>
                  {FeatureFlags.BUY_SELL_ENABLED && (
                    <Link
                      to="/sale"
                      className={`px-3 py-1.5 rounded-lg transition-colors ${
                        location.pathname === '/sale'
                          ? 'text-amber-300 font-bold relative after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-amber-500'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                      }`}
                    >
                      {t('home.nav_sale', 'موڵک بۆ فرۆشتن')}
                    </Link>
                  )}
                  <Link
                    to="/rentals"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      location.pathname === '/rentals' || location.pathname === '/rent'
                        ? 'text-amber-300 font-bold relative after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-amber-500'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    {t('home.nav_rent', 'موڵک بۆ كرێ')}
                  </Link>
                  <Link
                    to="/rent-management"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      location.pathname === '/rent-management'
                        ? 'text-amber-300 font-bold relative after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-amber-500'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    {t('home.nav_rent_management', 'بەڕێوەبردنی کرێ')}
                  </Link>
                  <Link
                    to="/services"
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      location.pathname === '/services'
                        ? 'text-amber-300 font-bold relative after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-amber-500'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
                    }`}
                  >
                    {t('home.nav_services', 'سێرڤس و خزمەتگوزاری')}
                  </Link>
                  <Link
                    to="/properties/add"
                    className="px-3.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('property.add_new', 'Add Property')}</span>
                  </Link>
                </nav>
              </div>
              
              <div className="flex items-center gap-3">
                <select 
                  className="bg-[#161f33] border border-slate-700/80 text-slate-200 rounded-lg py-1.5 px-3 text-xs sm:text-sm font-semibold focus:ring-1 focus:ring-amber-500/50 cursor-pointer hover:border-slate-600 transition-colors"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                >
                  <option value="ku" className="bg-[#0c1322] text-slate-200">کوردی سۆرانی</option>
                  <option value="ar" className="bg-[#0c1322] text-slate-200">العربية</option>
                  <option value="en" className="bg-[#0c1322] text-slate-200">English</option>
                </select>

                {user && eligibleWorkspaces && eligibleWorkspaces.length > 1 && (
                  <select
                    id="layout-workspace-switcher"
                    aria-label="Switch Workspace"
                    className="bg-[#161f33] border border-slate-700/80 text-amber-200 rounded-lg py-1.5 px-2.5 text-xs font-semibold focus:ring-1 focus:ring-amber-500/50 cursor-pointer max-w-[160px] truncate"
                    value={activeWorkspace?.workspaceId || ''}
                    onChange={async (e) => {
                      const selected = await selectWorkspace(e.target.value);
                      if (selected?.destination) {
                        navigate(selected.destination);
                      }
                    }}
                  >
                    {eligibleWorkspaces.map((ws) => (
                      <option key={ws.workspaceId} value={ws.workspaceId} className="bg-[#0c1322] text-slate-200">
                        {ws.label || ws.title}
                      </option>
                    ))}
                  </select>
                )}

                {user ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    title="Sign Out"
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 bg-slate-800/60 hover:bg-red-950/40 p-2 rounded-lg transition-colors cursor-pointer border border-slate-700/60"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline font-medium">{t('action.sign_out', 'Sign Out')}</span>
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm transition-all shadow-md shadow-amber-950/40 border border-amber-400/40 cursor-pointer"
                  >
                    {t('auth.login.submit', 'Sign In')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Main Layout Grid */}
      {isWorkspace || isOwnerWorkspace || isVendorWorkspace || isAgentWorkspace || isHomePage || location.pathname.startsWith('/tenant') || location.pathname.startsWith('/properties') || location.pathname === '/rent' || location.pathname === '/rentals' || location.pathname === '/rent-management' || location.pathname === '/services' || location.pathname === '/sale' || location.pathname === '/marketplace' || location.pathname === '/search' || location.pathname === '/explore' ? (
        <main className="min-w-0 w-full flex-1">
          <Outlet />
        </main>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row gap-6">
          
          {/* Navigation Sidebar */}
          <aside className="hidden md:block w-64 shrink-0">
            <nav className="flex flex-col gap-2">
              <Link to="/" className="flex items-center gap-3 px-4 py-2 rounded-xl bg-amber-500/15 text-amber-300 font-bold border border-amber-500/40 hover:bg-amber-500/25 transition-colors">
                <LayoutDashboard className="w-5 h-5 text-amber-400" />
                {t('nav.dashboard')}
              </Link>
              <Link to="/properties" className="flex items-center gap-3 px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
                <Building2 className="w-5 h-5 text-slate-400" />
                {t('nav.properties')}
              </Link>
              <Link 
                to="/properties/add" 
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${
                  location.pathname === '/properties/add' 
                    ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/40' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <span>{t('property.add_new', 'Add Property')}</span>
              </Link>
              <Link 
                to="/rentals" 
                className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${
                  location.pathname === '/rentals' || location.pathname === '/rent'
                    ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/40' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Globe className="w-5 h-5 text-amber-400" />
                <span>{t('nav.marketplace', 'Marketplace')}</span>
              </Link>
              
              <div className="mt-8 pt-4 border-t border-slate-800">
                <p className="px-4 text-xs font-semibold text-amber-400/80 uppercase tracking-wider mb-2">{t('core.workspace', 'Workspace')}</p>
                <div className="flex flex-col gap-1 text-sm">
                  <Link to="/workspace/owner" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.owner')}</Link>
                  <Link to="/workspace/company" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.company')}</Link>
                  <Link to="/workspace/tenant" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.tenant')}</Link>
                  {FeatureFlags.BUY_SELL_ENABLED && (
                    <Link to="/workspace/buyer" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.buyer')}</Link>
                  )}
                  <Link to="/workspace/agent" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('agent.agent_broker', 'Agent / Broker')}</Link>
                  <Link to="/workspace/accountant" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.accountant')}</Link>
                  <Link to="/workspace/vendor" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.vendor', 'Service Vendor')}</Link>
                  <Link to="/workspace/maintenance" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('maintenance.title')}</Link>
                  <Link to="/workspace/portfolio" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('portfolio.title')}</Link>
                  <Link to="/workspace/admin" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('admin.trust_disputes', 'Trust & Disputes')}</Link>
                  <Link to="/workspace/platform-admin" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('role.platform_admin')}</Link>
                  <Link to="/workspace/integrations" className="px-4 py-1.5 rounded-lg text-slate-300 hover:text-amber-300 hover:bg-slate-800/40 transition-colors">{t('integration.title')}</Link>
                </div>
              </div>
            </nav>
          </aside>

          {/* Dynamic Route Content */}
          <main className={`flex-1 min-w-0 ${isWorkspace ? '' : 'bg-[#0c1322] rounded-2xl shadow-xl border border-slate-800 p-6 min-h-[60vh] text-white'}`}>
            <Outlet />
          </main>
        </div>
      )}
    </div>
  );
};
