import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { HomeHubLogo } from './HomeHubLogo';
import { LanguageSelector } from './LanguageSelector';
import { useI18n } from '../../i18n/I18nProvider';
import { FeatureFlags } from '../../utils/featureFlags';

interface Screen1WelcomeProps {
  onStart: () => void;
  onLoginClick: () => void;
  onSelectCategory?: (category: string) => void;
}

export const Screen1Welcome: React.FC<Screen1WelcomeProps> = ({
  onStart,
  onLoginClick,
  onSelectCategory,
}) => {
  const { direction, t } = useI18n();

  const categories = [
    {
      id: 'rent',
      label: t('core.rent', 'کرێ'),
      labelEn: 'Rent',
      icon: (
        <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M17.5 4C13.91 4 11 6.91 11 10.5C11 11.54 11.25 12.52 11.68 13.39L4.41 20.66C4.15 20.92 4 21.28 4 21.65V23C4 23.55 4.45 24 5 24H7.5C7.78 24 8.04 23.89 8.23 23.7L9.5 22.43V21H11.5C11.78 21 12.04 20.89 12.23 20.7L13.5 19.43V18H15.5C15.78 18 16.04 17.89 16.23 17.7L17.11 16.82C17.98 17.25 18.96 17.5 20 17.5C23.59 17.5 26.5 14.59 26.5 11C26.5 7.41 23.59 4 20 4H17.5ZM19.5 13C18.4 13 17.5 12.1 17.5 11C17.5 9.9 18.4 9 19.5 9C20.6 9 21.5 9.9 21.5 11C21.5 12.1 20.6 13 19.5 13Z"
            fill="#10b981"
            transform="rotate(-15 14 14)"
          />
        </svg>
      ),
    },
    {
      id: 'rent-management',
      label: t('core.rent_management', 'بەڕێوەبردنی کرێ'),
      labelEn: 'Rent Management',
      icon: (
        <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none">
          <path
            d="M14 2L4 7V13C4 18.5 8.2 23.7 14 25C19.8 23.7 24 18.5 24 13V7L14 2ZM12 18L7 13L8.4 11.6L12 15.2L19.6 7.6L21 9L12 18Z"
            fill="#38bdf8"
          />
        </svg>
      ),
    },
    {
      id: 'services',
      label: t('core.services', 'خزمەتگوزاری'),
      labelEn: 'Services',
      icon: (
        <svg viewBox="0 0 28 28" className="w-7 h-7" fill="none">
          <path
            d="M22.8 8.8C23.3 7.3 23 5.5 21.8 4.3C20.3 2.8 17.9 2.5 16.2 3.8L18.8 6.4L17.2 8L14.6 5.4C13.3 7.1 13.6 9.5 15.1 11C16.3 12.2 18.1 12.5 19.6 12L23.8 16.2C24.3 16.7 25 16.7 25.4 16.2C25.8 15.8 25.8 15.1 25.4 14.7L22.8 8.8Z"
            fill="#f59e0b"
            transform="rotate(-15 14 14)"
          />
          <path
            d="M16 12L5 23C4.2 23.8 3.2 23.8 2.5 23C1.8 22.3 1.8 21.2 2.5 20.5L13.5 9.5"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
            transform="rotate(-15 14 14)"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className={`flex-1 flex flex-col justify-between relative overflow-hidden min-h-screen w-full bg-[#070b14] text-white ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Background Architectural Luxury Glass Villa with Pool at Dusk */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85"
          alt="Modern Luxury Villa at Dusk"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-[center_30%]"
        />
        {/* Option 4 Midnight Slate Atmospheric Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#070b14]/95 via-[#0c1322]/85 to-[#070b14]/98" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#070b14]/90 via-[#0c1322]/60 to-transparent" />
        {/* Subtle VIP Champagne Gold Ambient Glow */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-500/10 blur-[130px] rounded-full pointer-events-none" />
      </div>

      {/* Top Desktop Navigation Bar: Brand Logo + Value Pills + Language Selector */}
      <header
        className="relative z-50 w-full max-w-7xl mx-auto px-6 lg:px-12 pt-4 sm:pt-6 pb-2 flex items-center justify-between"
      >
        {/* HomeHub 3D Logo (Icon on left, "HomeHub" on right, tagline underneath) */}
        <HomeHubLogo size="md" light={true} />

        {/* Desktop Highlights & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden md:flex items-center gap-2 bg-[#0c1322]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/80 text-xs text-amber-200/90 font-medium">
            <span>{t('onboard.platform_region', 'پلاتفۆرمی یەکگرتووی هەرێمی کوردستان و عێراق')}</span>
          </div>

          {/* Translucent Midnight Slate Language Selector Pill */}
          <LanguageSelector variant="transparent" />

          {/* Direct Login Button */}
          <button
            type="button"
            onClick={onLoginClick}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0c1322]/90 hover:bg-[#111b2e] text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 hover:border-amber-500/40 backdrop-blur-md cursor-pointer shadow-md"
          >
            {t('auth.login.link', 'چوونە ژوورەوە')}
          </button>
        </div>
      </header>

      {/* Hero Section: Centered / Expansive on Desktop */}
      <div
        className="relative z-20 max-w-7xl mx-auto w-full px-6 lg:px-12 py-8 sm:py-12 flex-1 flex flex-col justify-center items-start text-start"
      >
        <div className="max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 backdrop-blur-md text-xs font-bold text-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{t('onboard.welcome.subtitle', 'نەوەی نوێی بەڕێوەبردنی موڵک')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.18] drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] whitespace-pre-line">
            {t('auth.hero.title', 'هەموو ڕێگاکان\nبۆ موڵک لە یەک شوێن')}
          </h1>

          <p className="text-base sm:text-lg lg:text-xl text-slate-300 font-medium leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
            {t('auth.hero.subtitle', 'پلاتفۆڕمێکی مۆدێرن بۆ کرێ، بەڕێوەبردنی موڵک و خزمەتگوزاری بە بەرزترین ستانداردی نێودەوڵەتی.')}
          </p>

          <div className="hidden sm:flex items-center gap-6 pt-2 text-xs text-slate-300 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{t('onboard.feature.verified', 'موڵکی پشتڕاستکراو و باوەڕپێکراو')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>{t('onboard.feature.legal', 'گرێبەستی یاسایی و دیجیتاڵی')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              <span>{t('onboard.feature.financial', 'چاودێری و ڕاپۆرتی دارایی ورد')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Card Section across full screen (max-w-7xl aligned with header) */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 sm:pb-12">
        <div className="bg-[#0c1322]/95 backdrop-blur-2xl text-white rounded-3xl sm:rounded-4xl p-5 sm:p-8 shadow-[0_25px_60px_rgba(0,0,0,0.7)] border border-slate-800 space-y-5">
          {/* 3 Category Quick-Action Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-center">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                id={`category-${cat.id}`}
                onClick={() => (onSelectCategory ? onSelectCategory(cat.id) : onStart())}
                className="flex flex-col items-center group cursor-pointer p-3 sm:p-4 rounded-2xl bg-[#111b2e]/70 hover:bg-[#111b2e] border border-slate-800/90 hover:border-amber-500/40 transition-all duration-200 active:scale-95 shadow-sm"
              >
                {/* Rounded Square Dark Surface Tile */}
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#080d19] border border-slate-700/80 group-hover:border-amber-500/60 flex items-center justify-center shadow-md group-hover:shadow-amber-500/10 group-hover:scale-105 transition-all duration-200"
                >
                  {cat.icon}
                </div>
                {/* Category Label */}
                <span className="text-sm sm:text-base font-bold text-slate-200 group-hover:text-amber-300 tracking-tight mt-2 block transition-colors">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>

          {/* Primary CTA Button: Champagne Gold VIP gradient button */}
          <div className="pt-1">
            <button
              type="button"
              id="welcome-start-btn"
              onClick={onStart}
              className="w-full h-14 sm:h-16 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.99] text-slate-950 font-black text-base sm:text-lg rounded-full shadow-xl shadow-amber-950/40 flex items-center justify-between px-8 transition-all duration-200 cursor-pointer"
            >
              <div className="w-5" /> {/* Optical balance spacer */}
              <span className="tracking-wide font-black text-slate-950 text-base sm:text-lg">{t('action.get_started', 'دەستپێ بکە')}</span>
              <ArrowRight className={`w-6 h-6 text-slate-950 stroke-[2.8] shrink-0 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Secondary Sign-In Link & Admin Portal */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 border-t border-slate-800 text-center sm:text-start">
            <button
              type="button"
              id="welcome-signin-link"
              onClick={onLoginClick}
              className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {t('auth.login.has_account', 'هەژماری هەیە؟')}{' '}
              <span className="text-amber-400 font-bold hover:text-amber-300">{t('auth.login.link', 'چوونە ژوورەوە')}</span>
            </button>

            <div>
              <Link
                to="/admin"
                className="text-[11px] sm:text-xs font-semibold text-slate-500 hover:text-amber-400 transition-colors inline-flex items-center gap-1.5"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('auth.admin_portal', 'دەروازەی ستاف و بەڕێوەبەر (Admin Portal)')}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
