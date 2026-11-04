import React, { useState } from 'react';
import { Camera, MapPin, Coins, Globe, ChevronDown, Check } from 'lucide-react';
import { OnboardingHeader } from './OnboardingHeader';
import { ProgressIndicator } from './ProgressIndicator';
import { FormField, PhoneField, PrimaryCTA } from './FormControls';
import { useI18n } from '../../i18n/I18nProvider';

interface Screen7ProfileSetupProps {
  profileData: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    preferredLanguage: string;
    preferredCurrency: string;
    avatarUrl?: string;
    termsAccepted: boolean;
  };
  onUpdateProfile: (data: Partial<Screen7ProfileSetupProps['profileData']>) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const Screen7ProfileSetup: React.FC<Screen7ProfileSetupProps> = ({
  profileData,
  onUpdateProfile,
  onContinue,
  onBack,
}) => {
  const { direction, setLanguage, t } = useI18n();
  const [cityOpen, setCityOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const cities = ['هەولێر', 'سلێمانی', 'دهۆک', 'کەرکووک', 'بەغداد'];
  const currencies = [
    { code: 'IQD', label: 'دیناری عێراقی (IQD)' },
    { code: 'USD', label: 'دۆلاری ئەمریکی (USD)' },
  ];

  const handleLanguageChange = (langCode: 'ku' | 'ar' | 'en') => {
    onUpdateProfile({ preferredLanguage: langCode });
    setLanguage(langCode);
  };

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Header */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} showBack={true} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-10 flex flex-col justify-center">
        <div className="bg-[#0c1322] rounded-3xl sm:rounded-4xl p-6 sm:p-10 shadow-2xl border border-slate-800 space-y-6 text-white" dir={direction}>
          {/* 3-Step Stepper Header */}
          <div className="pb-2">
            <ProgressIndicator
              type="stepper"
              totalSteps={3}
              currentStep={3}
              labels={[t('onboard.step1', 'هەڵبژێرە'), t('onboard.step2', 'هەژمار'), t('onboard.step3', 'پرۆفایل')]}
            />
          </div>
        {/* Title & Subtitle */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {t('profile.setup.title', 'پڕۆفایلی خۆت تەواو بکە')}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1 leading-relaxed">
            {t('profile.setup.subtitle', 'ئەم زانیاریانە یارمەتیت دەدەن باشتر بتوانین خزمەتەکانمان پێشکەش بکەین.')}
          </p>
        </div>

        {/* Profile Avatar Upload Area */}
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#080d19] border border-slate-800">
          <div className="relative w-16 h-16 rounded-full bg-[#111b2e] border-2 border-amber-500/30 shadow-md flex items-center justify-center overflow-hidden shrink-0">
            {profileData.avatarUrl ? (
              <img
                src={profileData.avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-amber-400 font-black text-xl">
                {profileData.fullName.charAt(0) || 'ک'}
              </div>
            )}
            <label className="absolute inset-0 bg-black/40 hover:bg-black/50 transition-colors flex items-center justify-center cursor-pointer text-white">
              <Camera className="w-5 h-5 text-amber-300" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const fakeUrl = URL.createObjectURL(file);
                    onUpdateProfile({ avatarUrl: fakeUrl });
                  }
                }}
              />
            </label>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">{t('profile.avatar.title', 'وێنەی پرۆفایل')}</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('profile.avatar.desc', 'وێنەی خۆت زیاد بکە (هەڵبژاردەیی)')}
            </p>
          </div>
        </div>

        {/* Form Fields: 2-Column Desktop Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-start">
          {/* Full Name */}
          <FormField
            id="profile-fullname"
            label={t('onboarding.name.label', 'ناوی تەواو')}
            placeholder={t('onboarding.name.placeholder', 'بۆ نموونە: کاوان سابیر')}
            icon="user"
            value={profileData.fullName}
            onChange={(val) => onUpdateProfile({ fullName: val })}
          />

          {/* Email */}
          <FormField
            id="profile-email"
            type="email"
            label={t('onboarding.email.label', 'ئیمەیڵ')}
            placeholder="arian@example.com"
            icon="mail"
            value={profileData.email}
            onChange={(val) => onUpdateProfile({ email: val })}
            dir="ltr"
          />

          {/* Mobile Phone */}
          <PhoneField
            id="profile-phone"
            label={t('onboarding.phone.label', 'ژمارەی مۆبایل')}
            value={profileData.phone}
            onChange={(val) => onUpdateProfile({ phone: val })}
          />

          {/* Location / City Dropdown */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs sm:text-sm font-bold text-slate-300">
              {t('profile.city.label', 'شوێن (شار / ناوچە)')}
            </label>
            <button
              type="button"
              onClick={() => setCityOpen(!cityOpen)}
              className="w-full h-12 px-4 rounded-xl bg-[#080d19] border border-slate-800 text-white text-sm font-medium flex items-center justify-between hover:border-amber-500/40 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-400/80" />
                <span>{profileData.city || 'هەولێر'}</span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {cityOpen && (
              <div className="absolute top-full mt-1 inset-x-0 bg-[#0c1322] rounded-xl shadow-2xl border border-slate-800 py-1 z-30">
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ city });
                      setCityOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-start text-sm hover:bg-[#111b2e] hover:text-amber-300 transition-colors font-medium flex items-center justify-between text-slate-200"
                  >
                    <span>{city}</span>
                    {profileData.city === city && <Check className="w-4 h-4 text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preferred Language Pill Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs sm:text-sm font-bold text-slate-300">
              {t('profile.language.label', 'زمانی پەسەندکراو')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: 'ku', label: 'کوردی', flag: '☀️' },
                { code: 'ar', label: 'عربی', flag: '🇮🇶' },
                { code: 'en', label: 'English', flag: '🇬🇧' },
              ].map((lang) => {
                const isSelected = profileData.preferredLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code as any)}
                    className={`h-11 rounded-xl border flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/10 text-amber-300 shadow-xs ring-1 ring-amber-500/20'
                        : 'border-slate-800 bg-[#080d19] text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preferred Currency Dropdown */}
          <div className="space-y-1.5 relative">
            <label className="block text-xs sm:text-sm font-bold text-slate-300">
              {t('profile.currency.label', 'دراوی پەسەندکراو')}
            </label>
            <button
              type="button"
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="w-full h-12 px-4 rounded-xl bg-[#080d19] border border-slate-800 text-white text-sm font-medium flex items-center justify-between hover:border-amber-500/40 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400/80" />
                <span>
                  {currencies.find((c) => c.code === profileData.preferredCurrency)?.label ||
                    'دیناری عێراقی (IQD)'}
                </span>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
            {currencyOpen && (
              <div className="absolute top-full mt-1 inset-x-0 bg-[#0c1322] rounded-xl shadow-2xl border border-slate-800 py-1 z-30">
                {currencies.map((curr) => (
                  <button
                    key={curr.code}
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ preferredCurrency: curr.code });
                      setCurrencyOpen(false);
                    }}
                    className="w-full px-4 py-2.5 text-start text-sm hover:bg-[#111b2e] hover:text-amber-300 transition-colors font-medium flex items-center justify-between text-slate-200"
                  >
                    <span>{curr.label}</span>
                    {profileData.preferredCurrency === curr.code && (
                      <Check className="w-4 h-4 text-amber-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Terms Checkbox */}
          <div
            className="sm:col-span-2 flex items-start gap-3 cursor-pointer pt-2"
            onClick={() => onUpdateProfile({ termsAccepted: !profileData.termsAccepted })}
          >
            <div
              className={`w-5 h-5 mt-0.5 rounded-md flex items-center justify-center transition-all shrink-0 ${
                profileData.termsAccepted
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 border border-amber-500 text-slate-950'
                  : 'border-2 border-slate-700 bg-[#080d19]'
              }`}
            >
              {profileData.termsAccepted && <Check className="w-3.5 h-3.5 stroke-[3] text-slate-950" />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">
                {t('onboarding.consent.title', 'من مەرج و ڕێنمایەکان پەسەند دەکەم')}
              </p>
              <span className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline">
                {t('onboarding.consent.terms_link', 'بینینی مەرج و ڕێنمایەکان')}
              </span>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="pt-4">
          <PrimaryCTA id="profile-continue-btn" onClick={onContinue}>
            {t('common.continue', 'بەردەوام بە')}
          </PrimaryCTA>
        </div>
      </div>
    </div>
  </div>
);
};
