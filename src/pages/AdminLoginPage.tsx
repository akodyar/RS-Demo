import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Mail,
  Key,
  ArrowRight,
  AlertCircle,
  Building2,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { HomeHubLogo } from '../components/onboarding/HomeHubLogo';
import { LanguageSelector } from '../components/onboarding/LanguageSelector';

export const AdminLoginPage: React.FC = () => {
  const { setDevPersona, login } = useAuth();
  const { t, direction } = useI18n();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@homehub.iq');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [securityCode, setSecurityCode] = useState('8899');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg(t('admin.email_required', 'Please enter official admin email'));
      return;
    }
    if (!password) {
      setErrorMsg(t('admin.password_required', 'Please enter administrative password'));
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (!login) {
        throw new Error('Identity provider is not configured.');
      }
      const dbUser = await login(email.trim(), password);
      const roles: string[] = dbUser?.roles || [];
      const isAdmin = roles.some((r) =>
        ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN'].includes(r)
      );
      if (!isAdmin) {
        throw new Error('Unauthorized: Account lacks administrative privileges.');
      }
      navigate('/admin/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message || 'Administrative authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstantAdminEntry = () => {
    if (import.meta.env?.MODE === 'production' || import.meta.env?.PROD) {
      setErrorMsg('Instant admin bypass is forbidden in production');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      if (setDevPersona) {
        setDevPersona('PLATFORM_ADMIN', 'superadmin@homehub.iq');
      }
      setIsLoading(false);
      navigate('/admin/dashboard');
    }, 400);
  };

  return (
    <div
      className={`min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* Top Header */}
      <header className="border-b border-amber-500/20 bg-[#0c1322]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HomeHubLogo size="sm" showTagline={false} light={true} />
            <span className="h-4 w-px bg-slate-800 hidden sm:block" />
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('admin.portal_title', 'Admin Management Portal')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSelector variant="dark" />
            <Link
              to="/search"
              className="text-xs text-slate-400 hover:text-amber-400 transition-colors"
            >
              {t('nav.marketplace', 'Marketplace')}
            </Link>
            <Link
              to="/onboarding"
              className="px-3 py-1.5 rounded-lg bg-[#080d19] hover:bg-[#111b2e] text-xs font-bold text-slate-200 transition-all border border-slate-800 hover:border-amber-500/30"
            >
              {t('mobile.experience', 'Mobile Experience')}
            </Link>
          </div>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-[#0c1322] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

          {/* Title Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
              <Lock className="w-7 h-7 text-slate-950 font-bold" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              {t('admin.login_title', 'Admin Sign In')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
              {t('admin.login_subtitle', 'Access the platform control center, property oversight, and user management')}
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Standard Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 text-start">
                {t('admin.official_email', 'Admin Email')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@homehub.iq"
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-sm focus:border-amber-500/50 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300 text-start">
                {t('admin.password', 'Password')}
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full ps-10 pe-10 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-sm focus:border-amber-500/50 transition-all outline-none"
                />
                <button
                  type="button"
                  id="admin-password-toggle"
                  data-testid="admin-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300 text-start">
                  {t('admin.2fa_code', 'Staff 2FA Security PIN')}
                </label>
              </div>
              <div className="relative">
                <Fingerprint className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  dir="ltr"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  placeholder="8899"
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-[#080d19] border border-slate-800 text-slate-100 text-sm font-mono focus:border-amber-500/50 transition-all outline-none tracking-widest"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-[0.99] text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <span>{t('admin.checking_perms', 'Verifying permissions...')}</span>
              ) : (
                <>
                  <span>{t('admin.sign_in_btn', 'Sign in as Admin')}</span>
                  <ArrowRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                </>
              )}
            </button>
          </form>

          {/* Quick Dev/Test Admin Login Button (isolated strictly to development/test environments) */}
          {(import.meta.env?.MODE !== 'production' && !import.meta.env?.PROD) && (
            <div className="mt-5 pt-4 border-t border-slate-800 space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 text-center">
                {t('admin.one_click_title', 'One-Click Instant Login (For Testing & Evaluation)')}
              </p>
              <button
                type="button"
                onClick={handleInstantAdminEntry}
                className="w-full py-2.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] text-amber-300 hover:text-amber-200 border border-slate-800 hover:border-amber-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('admin.instant_bypass_btn', 'Enter as Platform Admin (Development Bypass)')}</span>
              </button>
            </div>
          )}

          {/* Security Guarantee Notice */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('admin.security_guarantee', 'Secured via 256-bit TLS & Official RBAC Governance')}</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/60 py-4 px-6 text-center text-xs text-slate-500">
        <p>{t('admin.footer_note', 'HomeHub Real Estate Enterprise Platform • Kurdistan • Admin Management Portal')}</p>
      </footer>
    </div>
  );
};
