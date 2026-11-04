import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { LogOut } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { HomeHubLogo } from './onboarding/HomeHubLogo';
import { useInfrastructure } from './InfrastructureProvider';
import { AlertTriangle } from 'lucide-react';

export const PropertyWizardLayout: React.FC = () => {
  const { t, language, setLanguage, direction } = useI18n();
  const infrastructure = useInfrastructure();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/welcome');
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-slate-100 ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {infrastructure.status !== 'READY' && infrastructure.status !== 'LOADING' && (
        <div className="bg-amber-500/90 text-slate-950 px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 border-b border-amber-400/30">
          <AlertTriangle className="w-4 h-4" />
          System running in Degraded Mode. External Provider / Database Not Configured: {infrastructure.database}.
        </div>
      )}
      
      {/* Option 4 Midnight Slate & Champagne Gold Minimal Header */}
      <header className="bg-[#0c1322]/95 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30 shadow-lg shadow-black/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2 group">
                <HomeHubLogo size="sm" showTagline={false} light={true} />
              </Link>
            </div>
            
            <div className="flex items-center gap-3">
              <select 
                className="bg-[#111b2e] border border-slate-700/80 hover:border-amber-500/40 rounded-xl py-1.5 px-3 text-xs sm:text-sm font-semibold focus:ring-1 focus:ring-amber-500/50 cursor-pointer text-slate-200 transition-colors"
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
              >
                <option value="ku" className="bg-[#0c1322] text-slate-200">کوردی سۆرانی</option>
                <option value="ar" className="bg-[#0c1322] text-slate-200">العربية</option>
                <option value="en" className="bg-[#0c1322] text-slate-200">English</option>
              </select>

              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign Out"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 bg-[#111b2e] hover:bg-rose-950/30 border border-slate-800 hover:border-rose-800/50 p-2 rounded-xl transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:inline font-medium">{t('action.sign_out', 'Sign Out')}</span>
                </button>
              ) : (
                <Link
                  to="/login"
                  className="px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-md shadow-amber-950/40 cursor-pointer"
                >
                  {t('auth.login.submit', 'Sign In')}
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout without Sidebar */}
      <main className="min-w-0 w-full flex-1">
        <Outlet />
      </main>
    </div>
  );
};
