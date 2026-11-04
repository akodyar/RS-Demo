import React, { useState } from 'react';
import { OnboardingHeader } from './OnboardingHeader';
import { HomeHubLogo } from './HomeHubLogo';
import { useI18n } from '../../i18n/I18nProvider';
import {
  FormField,
  PhoneField,
  PasswordField,
  ConsentRow,
  PrimaryCTA,
  SocialAuthButtons,
} from './FormControls';

interface Screen4SignupProps {
  selectedRole?: any;
  formData: {
    fullName: string;
    companyName?: string;
    phone: string;
    email: string;
    password: string;
    confirmPassword: string;
    entityType: string;
    consentAccepted: boolean;
  };
  onUpdateFormData: (data: Partial<Screen4SignupProps['formData']>) => void;
  onSubmit: () => Promise<void> | void;
  onBack: () => void;
  onLoginClick: () => void;
  socialNotice?: string;
  onSocialNotice: (msg: string) => void;
}

export const Screen4Signup: React.FC<Screen4SignupProps> = ({
  selectedRole,
  formData,
  onUpdateFormData,
  onSubmit,
  onBack,
  onLoginClick,
  socialNotice,
  onSocialNotice,
}) => {
  const { t, direction } = useI18n();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateAndSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = t('error.fullName', 'تکایە ناوی تەواوت بنووسە');
    }
    if ((selectedRole?.roleKey === 'OWNER' || selectedRole?.roleKey === 'AGENT') && !formData.entityType) {
      newErrors.entityType = t('error.entityType', 'تکایە جۆری هەژمار هەڵبژێرە');
    }
    if (formData.entityType === 'COMPANY' && (!formData.companyName || !formData.companyName.trim())) {
      newErrors.companyName = t('error.companyName', 'تکایە ناوی کۆمپانیا بنووسە');
    }
    if (!formData.phone.trim()) {
      newErrors.phone = t('error.phone', 'تکایە ژمارەی مۆبایلت بنووسە');
    }
    if (!formData.email.trim()) {
      newErrors.email = t('auth.reg.error.email_required', 'تکایە ئیمەیڵەکەت بنووسە');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('auth.reg.error.invalid_email', 'ئیمەیڵەکە دروست نییە');
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = t('auth.reg.error.password_min', 'وشەی نهێنی دەبێت لانیکەم ٦ پیت بێت');
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.reg.error.password_mismatch', 'وشەی نهێنی هاوتا نییە');
    }
    if (!formData.consentAccepted) {
      newErrors.consent = t('auth.reg.error.consent_required', 'تکایە مەرج و ڕێنماییەکان پەسەند بکە');
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      setServerError(null);
      setLoading(true);
      try {
        await onSubmit();
      } catch (err: any) {
        setServerError(err.message || t('auth.reg.error.generic', 'هەڵەیەک ڕوویدا لە کاتی تۆمارکردن'));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} stepText={t('onboard.step.3', 'قۆناغی ۳ لە ۳')} />
      </div>

      {/* Main Content Area: Responsive Split Grid */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Brand & Value Showcase Column (5 cols) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0c1322] via-[#111b2e] to-[#0c1322] text-white p-8 sm:p-10 rounded-3xl shadow-2xl border border-amber-500/30 space-y-6 text-start" dir={direction}>
            <HomeHubLogo size="md" light={true} />

            <div className="space-y-3 pt-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/15 text-xs font-bold text-amber-300 border border-amber-500/30">
                {t('auth.reg.sidebar_badge', 'تۆمارکردنی ئاسان و پارێزراو')}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                {t('auth.reg.sidebar_title', 'بەشداربە لە گەورەترین تۆڕی خانووبەرە لە عێراق و کوردستان')}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {t('auth.reg.sidebar_desc', 'هەموو پرۆسەکانی موڵک لە یەک پێگەدا. دۆزینەوە، کرێ، و واژۆکردنی گرێبەستی یاسایی بە چەند کلیکێک.')}
              </p>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{t('auth.reg.sidebar_feat1', 'پارێزراوی تەواوی داتا بە ستانداردی جیهانی')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>{t('auth.reg.sidebar_feat2', 'پشتڕاستکردنەوەی ژمارە بە کورتەپەیامی خێرا')}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-300" />
                <span>{t('auth.reg.sidebar_feat3', 'پشتگیری بەردەوامی کڕیار و بەکارهێنەران')}</span>
              </div>
            </div>
          </div>

          {/* Form Card Column (7 cols) */}
          <div className="lg:col-span-7 bg-[#0c1322] p-6 sm:p-10 rounded-3xl shadow-2xl border border-slate-800/80 text-start text-white" dir={direction}>
            <div className="space-y-2 mb-6">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {t('onboard.reg.title', 'هەژماری نوێ دروست بکە')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                {t('onboard.reg.subtitle', 'زانیاری بنەڕەتییەکانت بنووسە بۆ دروستکردنی هەژمار و دەستپێکردن.')}
              </p>
            </div>

            {serverError && (
              <div id="signup-server-error" className="p-4 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-2">
                <p className="font-bold">{serverError}</p>
                {(serverError.includes('تۆمارکراوە') || serverError.toLowerCase().includes('already')) && (
                  <button
                    type="button"
                    onClick={onLoginClick}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition-colors shadow cursor-pointer"
                  >
                    <span>{t('auth.reg.go_to_login', 'ڕاستەوخۆ بچۆ پەڕەی چوونە ژوورەوە (Sign In)')}</span>
                    <span className="rtl:rotate-180">→</span>
                  </button>
                )}
              </div>
            )}

            {/* Input Fields */}
            <form onSubmit={validateAndSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Full Name */}
                <FormField
                  id="signup-fullname"
                  label={t('auth.reg.fullName', 'ناوی تەواو')}
                  placeholder={t('auth.reg.fullName_ph', 'بۆ نموونە: ئاریان محەمەد')}
                  icon="user"
                  value={formData.fullName}
                  onChange={(val) => onUpdateFormData({ fullName: val })}
                  error={errors.fullName}
                />

                {/* 2. Mobile Phone */}
                <PhoneField
                  id="signup-phone"
                  label={t('auth.reg.phone', 'ژمارەی مۆبایل')}
                  value={formData.phone}
                  onChange={(val) => onUpdateFormData({ phone: val })}
                  error={errors.phone}
                />
              </div>

              {(selectedRole?.roleKey === 'OWNER' || selectedRole?.roleKey === 'AGENT') && (
                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-bold text-slate-300">
                    {t('auth.reg.entityType', 'جۆری هەژمار (پێویستە)')}
                  </label>
                  <div className="flex gap-4">
                    <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${formData.entityType === 'INDIVIDUAL' ? 'bg-amber-500/10 border-amber-500/60 text-amber-300' : 'bg-[#080d19] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
                      <input 
                        type="radio" 
                        name="entityType" 
                        data-testid="entity-type-individual"
                        value="INDIVIDUAL" 
                        checked={formData.entityType === 'INDIVIDUAL'}
                        onChange={() => onUpdateFormData({ entityType: 'INDIVIDUAL' })}
                        className="accent-amber-400"
                      />
                      <span>{t('auth.reg.entityIndividual', 'تاکەکەس')}</span>
                    </label>
                    <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${formData.entityType === 'COMPANY' ? 'bg-amber-500/10 border-amber-500/60 text-amber-300' : 'bg-[#080d19] border-slate-800 text-slate-300 hover:border-slate-700'}`}>
                      <input 
                        type="radio" 
                        name="entityType" 
                        data-testid="entity-type-company"
                        value="COMPANY" 
                        checked={formData.entityType === 'COMPANY'}
                        onChange={() => onUpdateFormData({ entityType: 'COMPANY' })}
                        className="accent-amber-400"
                      />
                      <span>{t('auth.reg.entityCompany', 'کۆمپانیا')}</span>
                    </label>
                  </div>
                  {errors.entityType && <p className="text-rose-400 text-xs mt-1">{errors.entityType}</p>}
                </div>
              )}

              {formData.entityType === 'COMPANY' && (
                <FormField
                  id="signup-company"
                  label={t('auth.reg.companyName', 'ناوی کۆمپانیا (پێویستە)')}
                  placeholder={t('auth.reg.company_ph', 'بۆ نموونە: کۆمپانیای داهاتوو')}
                  icon="building"
                  value={formData.companyName || ''}
                  onChange={(val) => onUpdateFormData({ companyName: val })}
                  error={errors.companyName}
                />
              )}

              {/* 3. Email (Required) */}
              <FormField
                id="signup-email"
                type="email"
                label={t('auth.reg.email', 'ئیمەیڵ (پێویستە)')}
                placeholder="arian@example.com"
                icon="mail"
                value={formData.email}
                onChange={(val) => onUpdateFormData({ email: val })}
                error={errors.email}
                dir="ltr"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 4. Password */}
                <PasswordField
                  id="signup-password"
                  label={t('auth.reg.password', 'وشەی نهێنی')}
                  placeholder={t('auth.reg.password_ph', 'کەمتر لە ٦ پیت نەبێت')}
                  value={formData.password}
                  onChange={(val) => onUpdateFormData({ password: val })}
                  error={errors.password}
                />

                {/* 5. Confirm Password */}
                <PasswordField
                  id="signup-confirm-password"
                  label={t('auth.reg.confirmPassword', 'دووبارە وشەی نهێنی')}
                  placeholder={t('auth.reg.confirmPassword_ph', 'وشەی نهێنیت دووبارە بنووسە')}
                  value={formData.confirmPassword}
                  onChange={(val) => onUpdateFormData({ confirmPassword: val })}
                  error={errors.confirmPassword}
                />
              </div>

              {/* Consent Checkbox */}
              <div className="pt-1">
                <ConsentRow
                  checked={formData.consentAccepted}
                  onChange={(checked) => onUpdateFormData({ consentAccepted: checked })}
                />
                {errors.consent && (
                  <p className="text-xs text-rose-400 mt-1">{errors.consent}</p>
                )}
              </div>

              {/* Primary CTA */}
              <div className="pt-2">
                <PrimaryCTA id="signup-submit-btn" type="submit" loading={loading}>
                  {t('auth.reg.submit_btn', 'هەژمار دروست بکە')}
                </PrimaryCTA>
              </div>
            </form>

            {/* Social Sign In Divider */}
            <div className="relative flex items-center justify-center my-5">
              <div className="w-full border-t border-slate-800" />
              <span className="absolute bg-[#0c1322] px-3 text-xs font-bold text-slate-500">
                {t('auth.reg.or_social', 'یان لەڕێگەی')}
              </span>
            </div>

            {/* Social Buttons */}
            <SocialAuthButtons
              onAppleClick={() =>
                onSocialNotice(t('auth.reg.social_apple', 'چوونەژوورەوە بە Apple لە ژینگەی ناوخۆی پلاتفۆڕم ئامادەکراوە.'))
              }
              onGoogleClick={() =>
                onSocialNotice(t('auth.reg.social_google', 'چوونەژوورەوە بە Google لە ژینگەی ناوخۆی پلاتفۆڕم ئامادەکراوە.'))
              }
              onFacebookClick={() =>
                onSocialNotice(t('auth.reg.social_facebook', 'چوونەژوورەوە بە Facebook لە ژینگەی ناوخۆی پلاتفۆڕم ئامادەکراوە.'))
              }
            />

            {socialNotice && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 text-center font-medium mt-3">
                {socialNotice}
              </div>
            )}

            {/* Already have an account link */}
            <div className="text-center pt-4 border-t border-slate-800 mt-4">
              <button
                type="button"
                id="signup-login-link"
                onClick={onLoginClick}
                className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {t('auth.reg.already_account', 'هەژماری پێشتری هەیە؟')}{' '}
                <span className="text-amber-400 font-bold underline underline-offset-2 hover:text-amber-300">
                  {t('auth.reg.login_link', 'چوونەژوورەوە')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
