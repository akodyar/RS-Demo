import React from 'react';
import {
  MapPin,
  Key,
  Home,
  Building2,
  Wrench,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { OnboardingHeader } from './OnboardingHeader';
import { useI18n } from '../../i18n/I18nProvider';

interface Screen2CapabilitiesProps {
  onContinue: () => void;
  onBack: () => void;
}

export const Screen2Capabilities: React.FC<Screen2CapabilitiesProps> = ({
  onContinue,
  onBack,
}) => {
  const { direction, t } = useI18n();

  return (
    <div className={`flex-1 flex flex-col justify-between bg-[#070b14] text-white min-h-screen w-full select-none ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Top Header: Back Link on Left, Step ("2/4") on Right */}
      <div className="w-full max-w-7xl mx-auto">
        <OnboardingHeader onBack={onBack} stepText={t('onboard.step.2', 'قۆناغی ۲ لە ٤')} />
      </div>

      {/* Main Content Area: Spacious 2-Column Desktop Grid */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 lg:px-12 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Text & Features Column */}
          <div className="lg:col-span-6 space-y-6 text-start" dir={direction}>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{t('onboard.cap.badge', 'پلاتفۆرمی هەمەلایەنەی خانووبەرە')}</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                {t('onboard.cap.title_1', 'هەر کردارێک')}
                <br />
                <span className="text-amber-400">{t('onboard.cap.title_2', 'بۆ موڵک پێویستت بێت')}</span>
              </h2>
              <p className="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">
                {t('onboard.cap.desc', 'کرێ، بەڕێوەبردن و خزمەتگوزاری چاککردنەوە، هەمووی بە یەک سیستم و لە ژێر یەک چەتر بەڕێوەببە.')}
              </p>
            </div>

            {/* AI Capability Card: Option 4 Dark Luxury Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#0c1322] via-[#111b2e] to-[#0c1322] border border-amber-500/30 flex items-start gap-4 shadow-xl">
              <div className="shrink-0 text-amber-300 mt-1 p-2 rounded-xl bg-amber-500/15 border border-amber-500/30">
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 2L11.8 7.2L17 9L11.8 10.8L10 16L8.2 10.8L3 9L8.2 7.2L10 2Z"
                    fill="#fbbf24"
                  />
                  <path
                    d="M17.5 13L18.4 15.6L21 16.5L18.4 17.4L17.5 20L16.6 17.4L14 16.5L16.6 15.6L17.5 13Z"
                    fill="#fbbf24"
                  />
                  <circle cx="18.5" cy="5.5" r="1.5" fill="#fbbf24" />
                </svg>
              </div>

              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                  {t('onboard.cap.ai_title', 'کارکردن سادەتر دەکەین بە زیرەکی دەستکرد')}
                </h4>
                <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
                  {t('onboard.cap.ai_desc', 'سیستەمی هۆشمەندی HomeHub بە پشتبەستن بە AI شیکاری نرخی بازاڕ، گرێبەستی یاسایی و خەمڵاندنی موڵکت بۆ دەکات.')}
                </p>
              </div>
            </div>
          </div>

          {/* Central Visual Showcase Column */}
          <div className="lg:col-span-6 flex items-center justify-center">
            <div className="relative w-full max-w-[420px] h-[340px] sm:h-[380px] flex items-center justify-center my-2">
              {/* Concentric aura circles in background */}
              <div className="absolute w-80 h-80 rounded-full border border-slate-800 -z-0" />
              <div className="absolute w-64 h-64 rounded-full border border-amber-500/10 -z-0" />
              <div className="absolute w-44 h-44 rounded-full bg-amber-500/5 blur-xl -z-0" />

              {/* Central Illustrated Card with luxury villa */}
              <div className="relative z-10 w-[200px] sm:w-[220px] h-[280px] sm:h-[300px] rounded-[36px] bg-[#0c1322] border-4 border-slate-700/80 shadow-2xl overflow-hidden flex flex-col items-center pt-2">
                <div className="w-12 h-1 bg-slate-700 rounded-full mb-2 shrink-0" />
                <div className="w-[180px] sm:w-[200px] h-[245px] sm:h-[265px] rounded-[24px] overflow-hidden relative bg-[#080d19] flex flex-col items-center">
                  <div className="absolute top-2 z-20 flex flex-col items-center drop-shadow-md">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center text-slate-950 shadow-md">
                      <div className="w-3 h-3 rounded-full bg-slate-950" />
                    </div>
                    <div className="w-1.5 h-2 bg-amber-500 -mt-0.5 rounded-b-xs" />
                  </div>
                  <img
                    src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=85"
                    alt="Luxury Modern Villa Architecture"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-center pt-6 scale-110 opacity-90"
                  />
                </div>
              </div>

              {/* 3 Floating Capability Badges */}
              {/* 1. کرێ (Rent) */}
              <div className="absolute top-4 left-0 sm:-left-4 z-20 bg-[#0c1322]/95 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 hover:scale-105 transition-transform backdrop-blur-md">
                <Home className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                <span className="text-xs sm:text-sm font-bold text-white">{t('core.rent', 'کرێ')}</span>
              </div>

              {/* 4. خزمەتگوزاری (Services) */}
              <div className="absolute top-40 -right-2 sm:-right-8 z-20 bg-[#0c1322]/95 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 hover:scale-105 transition-transform backdrop-blur-md">
                <Wrench className="w-5 h-5 text-amber-300 fill-amber-300/20 -rotate-45" />
                <span className="text-xs sm:text-sm font-bold text-white">{t('core.services', 'خزمەتگوزاری')}</span>
              </div>

              {/* 5. بەڕێوەبردن (Management) */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 bg-[#0c1322]/95 border border-slate-700/80 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2.5 hover:scale-105 transition-transform backdrop-blur-md">
                <BarChart3 className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
                <span className="text-xs sm:text-sm font-bold text-white">{t('core.rent_management', 'بەڕێوەبردنی کرێ')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Area */}
      <div className="w-full max-w-md mx-auto px-6 pb-8 pt-4 space-y-4">
        {/* Primary CTA Button: Champagne Gold VIP gradient button */}
        <button
          type="button"
          id="capabilities-continue-btn"
          onClick={onContinue}
          className="w-full h-14 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 active:scale-[0.99] text-slate-950 font-black text-base rounded-full shadow-xl shadow-amber-950/40 flex items-center justify-between px-8 transition-all duration-200 cursor-pointer"
        >
          <div className="w-5" />
          <span className="text-[17px] tracking-wide font-black text-slate-950">{t('action.continue', 'بەردەوام بە')}</span>
          <ArrowRight className={`w-5 h-5 text-slate-950 stroke-[2.8] shrink-0 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
        </button>

        {/* Secondary Action: "{t('action.back', 'پەڕەی پێشوو')}" */}
        <div className="text-center">
          <button
            type="button"
            id="capabilities-prev-btn"
            onClick={onBack}
            className="text-xs sm:text-sm font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
          >
            پەڕەی پێشوو
          </button>
        </div>

        {/* 4 Pagination Dots: Second dot active amber */}
        <div className="flex items-center justify-center gap-2 pt-1 pb-1">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 ring-2 ring-amber-500/30 shadow-xs" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700/60" />
        </div>
      </div>
    </div>
  );
};

