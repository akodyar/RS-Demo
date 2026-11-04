import React from 'react';
import {
  Search,
  Heart,
  Calendar,
  Home,
  Check,
} from 'lucide-react';
import { HomeHubLogo } from './HomeHubLogo';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSelector } from './LanguageSelector';
import { PrimaryCTA, SecondaryAction } from './FormControls';
import { BenefitCard } from './OnboardingCards';

interface Screen9SuccessProps {
  roleKey: string;
  onEnterApp: () => void;
  onLater?: () => void;
  onActionClick?: (actionId: string) => void;
}

export const Screen9Success: React.FC<Screen9SuccessProps> = ({
  roleKey,
  onEnterApp,
  onLater,
  onActionClick,
}) => {
  const { t, direction } = useI18n();
  const actions = [
    {
      id: 'search',
      title: t('onboard.success.search_title', 'گەڕان بەدوای موڵک'),
      desc: t('onboard.success.search_desc', 'موڵکەکانی بەکرێ دۆزەوە'),
      icon: <Search className="w-5 h-5 text-amber-400" />,
      iconBg: 'bg-[#080d19]',
      iconColor: 'text-amber-400',
    },
    {
      id: 'favorites',
      title: t('onboard.success.fav_title', 'پاشەکەوتی موڵکە دڵخوازەکان'),
      desc: t('onboard.success.fav_desc', 'موڵکە دڵخوازەکانت پاشەکەوت بکە'),
      icon: <Heart className="w-5 h-5 text-rose-400" />,
      iconBg: 'bg-[#080d19]',
      iconColor: 'text-rose-400',
    },
    {
      id: 'tour',
      title: t('onboard.success.tour_title', 'داواکاری سەردان'),
      desc: t('onboard.success.tour_desc', 'بۆ سەردیکردنی موڵک داواکاری بکە'),
      icon: <Calendar className="w-5 h-5 text-sky-400" />,
      iconBg: 'bg-[#080d19]',
      iconColor: 'text-sky-400',
    },
    {
      id: 'manage',
      title: t('onboard.success.manage_title', 'بەڕێوەبردنی موڵک'),
      desc: t('onboard.success.manage_desc', 'موڵکەکەت زیاد بکە و بەڕێوەی بەر'),
      icon: <Home className="w-5 h-5 text-emerald-400" />,
      iconBg: 'bg-[#080d19]',
      iconColor: 'text-emerald-400',
    },
  ];

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full relative overflow-hidden ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Decorative Warm Glows in Background */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-12 start-8 w-2 h-4 rounded-full bg-emerald-400/30 rotate-45" />
        <div className="absolute top-20 end-10 w-3 h-3 rounded-full bg-amber-400/40" />
        <div className="absolute top-28 start-20 w-2.5 h-5 rounded-full bg-amber-500/30 -rotate-12" />
        <div className="absolute top-16 end-28 w-2 h-4 rounded-full bg-purple-400/30 rotate-12" />
      </div>

      {/* Top Header Region */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between" dir={direction}>
        <HomeHubLogo size="md" light={true} />
        <LanguageSelector variant="transparent" />
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-10 flex flex-col justify-center">
        <div className="bg-[#0c1322] rounded-3xl sm:rounded-4xl p-6 sm:p-10 shadow-2xl border border-slate-800 text-center space-y-6 text-white" dir={direction}>
          {/* Central Visual: Modern Luxury Villa + Checkmark Badge */}
          <div className="relative w-full max-w-md h-44 mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-slate-800">
            <img
              src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80"
              alt="Welcome Home"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0c1322] via-transparent to-transparent" />

            {/* Glowing Green Success Checkmark Badge */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center shadow-xl ring-4 ring-[#0c1322] animate-in zoom-in-50 duration-300">
              <Check className="w-9 h-9 stroke-[3.5]" />
            </div>
          </div>

          {/* Headlines */}
          <div className="space-y-2 pt-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{t('onboard.success.badge', 'پیرۆزە!')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {t('onboard.success.title', 'هەژمارەکەت بە سەرکەوتوویی دروستکرا')}
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              {t('onboard.success.desc', 'سوپاس بۆ پەیوەستبوون بە HomeHub. ئێستا ئامادەیت بۆ دەستپێکردن، بەڕێوەبردن، دۆزینەوەی موڵک، یان بەکارهێنانی خزمەتگوزارییەکان.')}
            </p>
          </div>

          {/* Action Choices Grid ("چی دەتوانیت بکەیت؟") */}
          <div className="w-full space-y-3 pt-2 text-start">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider text-center sm:text-start">
              {t('onboard.success.what_next', 'چی دەتوانیت بکەیت؟ (هەنگاوەکانی سەرەتا)')}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {actions.map((act) => (
                <BenefitCard
                  key={act.id}
                  id={`success-action-${act.id}`}
                  iconBg={act.iconBg}
                  iconColor={act.iconColor}
                  icon={act.icon}
                  title={act.title}
                  desc={act.desc}
                  onClick={() => onActionClick && onActionClick(act.id)}
                />
              ))}
            </div>
          </div>

          {/* Bottom Action Area */}
          <div className="pt-4 max-w-md mx-auto w-full space-y-3">
            <PrimaryCTA id="success-start-btn" onClick={onEnterApp}>
              {(roleKey === 'TENANT' || roleKey === 'BUYER' || roleKey === 'GUEST') ? t('onboard.success.btn_home', 'چوون بۆ پەڕەی سەرەکی') : t('onboard.success.btn_dashboard', 'چوون بۆ داشبۆردی موڵکەکان')}
            </PrimaryCTA>
            {onLater && (
              <div className="text-center">
                <SecondaryAction
                  id="success-later-btn"
                  onClick={onLater}
                  variant="link"
                  className="text-xs sm:text-sm text-slate-400 hover:text-amber-400"
                >
                  {t('onboard.success.btn_later', 'دواتر دەکەم')}
                </SecondaryAction>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
