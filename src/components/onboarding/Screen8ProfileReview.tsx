import React, { useState } from 'react';
import {
  Check,
  Edit2,
  Home,
  Bell,
  Globe,
  Coins,
  MapPin,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { OnboardingHeader } from './OnboardingHeader';
import { PrimaryCTA } from './FormControls';
import { ProgressIndicator } from './ProgressIndicator';
import { useI18n } from '../../i18n/I18nProvider';

interface Screen8ProfileReviewProps {
  roleInfo: {
    title: string;
    imageUrl: string;
  };
  userData: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    preferredLanguage: string;
    preferredCurrency: string;
  };
  onEditRole: () => void;
  onFinish: () => void;
  onBack: () => void;
}

export const Screen8ProfileReview: React.FC<Screen8ProfileReviewProps> = ({
  roleInfo,
  userData,
  onEditRole,
  onFinish,
  onBack,
}) => {
  const { t, direction } = useI18n();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} stepText={t('onboarding.step_6_of_6', 'قۆناغی ٦ لە ٦')} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-10 flex flex-col justify-center">
        <div className="bg-[#0c1322] rounded-3xl sm:rounded-4xl p-6 sm:p-10 shadow-2xl border border-slate-800 space-y-6 text-white" dir={direction}>
          {/* Visual Badge & Title */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-[#111b2e] border border-amber-500/30 mx-auto flex items-center justify-center relative shadow-lg">
              <Home className="w-8 h-8 text-amber-400" />
              <div className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xs ring-2 ring-[#0c1322]">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {t('profile.review.title', 'پێداچوونەوە بە زانیارییەکانت')}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                {t('profile.review.subtitle', 'تکایە پێداچوونەوە بە زانیارییەکانت بکە پێش چوونە ناو پلاتفۆڕم.')}
              </p>
            </div>
          </div>

          {/* Selected Role Card with Edit Action */}
          <div className="p-4 rounded-2xl bg-[#111b2e] border border-slate-800 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5">
              <img
                src={
                  roleInfo.imageUrl ||
                  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=200&q=80'
                }
                alt="Role"
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shadow-xs"
              />
              <div className="text-start">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
                  {t('profile.review.selected_role', 'ڕۆڵ هەڵبژێردراو')}
                </span>
                <h4 className="font-bold text-base text-white leading-tight">
                  {roleInfo.title || t('role.owner.title', 'خاوەنی موڵک')}
                </h4>
              </div>
            </div>

            <button
              type="button"
              id="edit-role-btn"
              onClick={onEditRole}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 bg-[#080d19] px-3.5 py-2 rounded-xl border border-slate-700/80 hover:border-amber-500/40 shadow-xs cursor-pointer transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t('common.edit', 'گۆڕانکاری')}</span>
            </button>
          </div>

          {/* Desktop 2-Column Review Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-start">
            {/* Personal Information Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('profile.review.personal_info', 'زانیارییەکانی کەسی')}
              </h3>
              <div className="p-4 rounded-2xl bg-[#080d19] border border-slate-800 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-4 h-4 text-amber-400/80" />
                    <span>{t('onboarding.name.label', 'ناوی تەواو')}</span>
                  </div>
                  <span className="font-bold text-white">
                    {userData.fullName || 'ئاریان محەمەد'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Mail className="w-4 h-4 text-amber-400/80" />
                    <span>{t('onboarding.email.label', 'ئیمەیڵ')}</span>
                  </div>
                  <span className="font-bold text-white font-mono" dir="ltr">
                    {userData.email || 'arian@example.com'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Phone className="w-4 h-4 text-amber-400/80" />
                    <span>{t('onboarding.phone.label', 'ژمارەی مۆبایل')}</span>
                  </div>
                  <span className="font-bold text-white font-mono" dir="ltr">
                    +964 {userData.phone || '770 123 4567'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <MapPin className="w-4 h-4 text-amber-400/80" />
                    <span>{t('profile.city.label', 'شار / ناوچە')}</span>
                  </div>
                  <span className="font-bold text-white">
                    {userData.city || 'هەولێر'}
                  </span>
                </div>
              </div>
            </div>

            {/* Language, Currency & Notification Section */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t('profile.review.preferences', 'زمان، دراو و ئاگادارییەکان')}
              </h3>
              <div className="p-4 rounded-2xl bg-[#080d19] border border-slate-800 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Globe className="w-4 h-4 text-amber-400/80" />
                    <span>{t('profile.language.platform', 'زمانی پلاتفۆرم')}</span>
                  </div>
                  <span className="font-bold text-white">
                    {userData.preferredLanguage === 'ku'
                      ? 'کوردی (سۆرانی)'
                      : userData.preferredLanguage === 'ar'
                      ? 'العربية'
                      : 'English'}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Coins className="w-4 h-4 text-amber-400/80" />
                    <span>{t('profile.currency.primary', 'دراوی سەرەکی')}</span>
                  </div>
                  <span className="font-bold text-white">
                    {userData.preferredCurrency === 'USD'
                      ? 'دۆلاری ئەمریکی ($)'
                      : 'دیناری عێراق (IQD)'}
                  </span>
                </div>

                <div
                  className="flex items-center justify-between py-1 cursor-pointer"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                >
                  <div className="flex items-center gap-2 text-slate-400">
                    <Bell className="w-4 h-4 text-amber-400/80" />
                    <span>{t('profile.review.notifications', 'ئاگادارکردنەوەکان')}</span>
                  </div>
                  <div
                    className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${
                      notificationsEnabled ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-slate-950 shadow-xs transition-transform ${
                        notificationsEnabled ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <div className="pt-4">
            <PrimaryCTA id="profile-review-finish-btn" onClick={onFinish}>
              {t('profile.review.finish_btn', 'تەواوکردن و چوونەژوورەوە')}
            </PrimaryCTA>
          </div>
        </div>
      </div>
    </div>
  );
};
