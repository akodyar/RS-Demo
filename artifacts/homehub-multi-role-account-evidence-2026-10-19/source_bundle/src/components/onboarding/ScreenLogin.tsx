import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { HomeHubLogo } from './HomeHubLogo';
import { LanguageSelector } from './LanguageSelector';
import { useI18n } from '../../i18n/I18nProvider';
import {
  FormField,
  PasswordField,
  PrimaryCTA,
  SocialAuthButtons,
} from './FormControls';

interface ScreenLoginProps {
  onLogin: (email: string, pass: string, role?: string) => Promise<void> | void;
  onGoToSignup: () => void;
  initialEmail?: string;
  errorMessage?: string | null;
}

export const ScreenLogin: React.FC<ScreenLoginProps> = ({
  onLogin,
  onGoToSignup,
  initialEmail = '',
  errorMessage,
}) => {
  const { t, direction } = useI18n();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError(t('login.error.email_required', 'تکایە ئیمەیڵەکەت بنووسە'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError(t('login.error.invalid_email', 'تکایە ئیمەیڵێکی دروست بنووسە'));
      return;
    }
    if (!password) {
      setLocalError(t('login.error.password_required', 'تکایە وشەی نهێنی بنووسە'));
      return;
    }

    setLocalError(null);
    setLocalNotice(null);
    setLoading(true);

    try {
      // Authoritative authentication: zero client-side role guessing.
      // Roles are authoritatively retrieved from PostgreSQL by the server.
      await onLogin(trimmedEmail, password);
    } catch (err: any) {
      setLocalError(err.message || t('login.error.generic', 'هەڵەیەک ڕوویدا لە کاتی چوونەژوورەوە'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPersona = (role: string, emailStr: string) => {
    setLocalError(null);
    setLocalNotice(null);
    setEmail(emailStr);
    setPassword('password123');
    onLogin(emailStr, 'password123', role);
  };

  const handleForgotPassword = () => {
    setLocalError(null);
    if (!email.trim()) {
      setLocalError(t('login.error.enter_email_for_reset', 'تکایە سەرەتا ئیمەیڵەکەت بنووسە بۆ ناردنی بەستەری نوێکردنەوەی وشەی نهێنی.'));
      return;
    }
    setLocalNotice(t('login.forgot_notice', 'ئەگەر ئەم ئیمەیڵە تۆمارکراو بێت لە سیستەم، بەستەری نوێکردنەوە دەنێردرێت.'));
  };

  const isDevEnvironment = import.meta.env?.MODE !== 'production' && !import.meta.env?.PROD;

  return (
    <div
      dir={direction}
      className={`flex-1 flex flex-col justify-between bg-slate-50 text-slate-900 min-h-screen w-full ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
    >
      {/* Top Header Region */}
      <header className="relative z-50 w-full max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between" dir={direction}>
        <HomeHubLogo size="md" />
        <LanguageSelector variant="light" />
      </header>

      {/* Main Content Area: Responsive Split Grid (max-w-7xl to fill desktop screens) */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Brand & Showcase Column (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0a4fa5] to-[#071933] text-white p-8 sm:p-10 rounded-3xl shadow-xl space-y-6 text-start">
            <HomeHubLogo size="md" light={true} />

            <div className="space-y-3 pt-2">
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-sky-200 border border-white/15">
                {t('login.showcase.welcome', 'بەخێربێیتەوە بۆ HomeHub')}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {t('login.showcase.title', 'پلاتفۆرمی پێشکەوتووی بەڕێوەبردن و دارایی خانووبەرە')}
              </h3>
              <p className="text-sm text-white/80 leading-relaxed">
                {t(
                  'login.showcase.desc',
                  'بە چوونەژوورەوەت دەتوانیت دەستت بگات بە داشبۆردی موڵکەکانت، ڕاپۆرتی داهات، داواکارییەکانی چاککردنەوە و دۆزینەوەی گرێبەستەکانت.'
                )}
              </p>
            </div>

            {/* Quick Demo Persona Switcher (isolated strictly to development/test environments) */}
            {isDevEnvironment && (
              <div className="pt-4 border-t border-white/15">
                <p className="text-xs font-bold text-sky-200 uppercase tracking-wider mb-2.5">
                  {t('login.quick_persona_title', 'چوونەژوورەوەی خێرا بە ڕۆڵ (تێست و پێداچوونەوە)')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    id="quick-login-owner"
                    title={t('role.owner', 'خاوەنی موڵک')}
                    onClick={() => handleQuickPersona('PROPERTY_OWNER', 'owner@homehub.iq')}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-semibold truncate text-center cursor-pointer transition-all"
                  >
                    {t('role.owner', 'خاوەنی موڵک')}
                  </button>
                  <button
                    type="button"
                    id="quick-login-company"
                    title={t('role.company', 'کۆمپانیا')}
                    onClick={() => handleQuickPersona('COMPANY_ADMIN', 'company@homehub.iq')}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-semibold truncate text-center cursor-pointer transition-all"
                  >
                    {t('role.company', 'کۆمپانیا')}
                  </button>
                  <button
                    type="button"
                    id="quick-login-tenant"
                    title={t('role.tenant', 'کرێنشین')}
                    onClick={() => handleQuickPersona('TENANT', 'tenant@homehub.iq')}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-semibold truncate text-center cursor-pointer transition-all"
                  >
                    {t('role.tenant', 'کرێنشین')}
                  </button>

                  <button
                    type="button"
                    id="quick-login-agent"
                    title={t('role.agent', 'ئەگێنت / برۆکەر')}
                    onClick={() => handleQuickPersona('AGENT', 'agent@homehub.iq')}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-semibold truncate text-center cursor-pointer transition-all"
                  >
                    {t('role.agent', 'ئەگێنت / برۆکەر')}
                  </button>
                  <button
                    type="button"
                    id="quick-login-vendor"
                    title={t('role.vendor', 'دابینکەر')}
                    onClick={() => handleQuickPersona('VENDOR', 'vendor@homehub.iq')}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-semibold truncate text-center cursor-pointer transition-all"
                  >
                    {t('role.vendor', 'دابینکەر')}
                  </button>
                  <button
                    type="button"
                    id="quick-login-admin"
                    title={t('role.admin', 'بەڕێوەبەر')}
                    onClick={() => handleQuickPersona('PLATFORM_ADMIN', 'admin@homehub.iq')}
                    className="py-2 px-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/15 text-white font-semibold truncate text-center cursor-pointer transition-all"
                  >
                    {t('role.admin', 'بەڕێوەبەر')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Login Form Card (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 rounded-3xl shadow-xl border border-slate-200/90 text-start">
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {t('login.title', 'چوونە ژوورەوە')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {t('login.subtitle', 'بۆ گەیشتن بە بەڕێوەبردن و تایبەتمەندییەکان، زانیارییەکانت بنووسە.')}
              </p>
            </div>

            {(errorMessage || localError) && (
              <div className="p-3 mb-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {localError || errorMessage}
              </div>
            )}

            {localNotice && (
              <div className="p-3 mb-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700 font-medium">
                {localNotice}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email / Phone Field */}
              <FormField
                id="login-email"
                label={t('login.email_or_phone', 'ئیمەیڵ یان ژمارەی مۆبایل')}
                placeholder={t('login.email_placeholder', 'name@example.com')}
                icon="mail"
                value={email}
                onChange={setEmail}
                dir="ltr"
              />

              {/* Password Field */}
              <div className="space-y-1">
                <PasswordField
                  id="login-password"
                  label={t('login.password', 'وشەی نهێنی')}
                  placeholder="••••••••"
                  value={password}
                  onChange={setPassword}
                />
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    {t('login.forgot_password', 'وشەی نهێنیت لەبیرکردووە؟')}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <PrimaryCTA id="login-submit-btn" type="submit" loading={loading}>
                  {t('login.submit_btn', 'چوونە ژوورەوە')}
                </PrimaryCTA>
              </div>
            </form>

            {/* Social Divider */}
            <div className="relative flex items-center justify-center my-5">
              <div className="w-full border-t border-slate-200" />
              <span className="absolute bg-white px-3 text-xs font-bold text-slate-400">
                {t('login.or_social', 'یان لەڕێگەی')}
              </span>
            </div>

            {/* Social Buttons */}
            <SocialAuthButtons
              onAppleClick={() => setLocalNotice(t('social.apple.notice', 'چوونەژوورەوە بە Apple بەردەست دەبێت لە ئەپی مۆبایل.'))}
              onGoogleClick={() => setLocalNotice(t('social.google.notice', 'چوونەژوورەوە بە Google پەیوەست دەکرێت لە وەشانەکانی داهاتوو.'))}
              onFacebookClick={() => setLocalNotice(t('social.fb.notice', 'چوونەژوورەوە بە Facebook لەژێر ئامادەکردندایە.'))}
            />

            {/* Bottom Actions */}
            <div className="text-center pt-4 border-t border-slate-100 mt-6 space-y-2">
              <button
                type="button"
                id="login-signup-link"
                onClick={onGoToSignup}
                className="text-xs sm:text-sm font-semibold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer block mx-auto"
              >
                {t('login.no_account', 'هەژمارت نییە؟')}{' '}
                <span className="text-blue-600 font-bold underline underline-offset-2">
                  {t('login.create_account', 'هەژمار دروست بکە')}
                </span>
              </button>

              <div>
                <Link
                  to="/admin"
                  className="text-[11px] sm:text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors inline-flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t('login.admin_portal_link', 'چوونەژوورەوەی ستاف و بەڕێوەبەر (Admin Portal)')}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
