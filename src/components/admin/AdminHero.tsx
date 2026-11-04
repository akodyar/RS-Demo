import React from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface AdminHeroProps {
  adminName?: string;
  criticalIssuesCount?: number;
  onViewIssues?: () => void;
}

export const AdminHero: React.FC<AdminHeroProps> = ({
  adminName,
  criticalIssuesCount = 3,
  onViewIssues,
}) => {
  const { language, direction } = useI18n();

  const content = {
    ku: {
      welcome: 'بەخێربێیتەوە،',
      headline: 'پلاتفۆرم لە دەستی ئەمین دایە',
      desc: 'چاودێری، بەڕێوەبردن و گەشەپێدانی تەواوی ژینگەی هۆم‌هەب.',
      issuesAlert: `${criticalIssuesCount} بابەتی هەستیار پێویستیان بە بڕیارە`,
      allGood: 'هەموو سیستەمەکان لە دۆخی ئاساییدان',
    },
    ar: {
      welcome: 'مرحباً بعودتك،',
      headline: 'المنصة في أيدٍ أمينة',
      desc: 'مراقبة وإدارة وتنمية المنظومة الشاملة لمنصة هوم هاب.',
      issuesAlert: `${criticalIssuesCount} حالات حرجة تتطلب اتخاذ القرار`,
      allGood: 'جميع الأنظمة تعمل بكفاءة تامة',
    },
    en: {
      welcome: 'Welcome back,',
      headline: 'Platform in Safe Hands',
      desc: 'Monitor, manage and grow the entire HomeHub ecosystem.',
      issuesAlert: `${criticalIssuesCount} critical items require admin attention`,
      allGood: 'All systems operational and secure',
    },
  }[language] || {
    welcome: 'Welcome back,',
    headline: 'Platform in Safe Hands',
    desc: 'Monitor, manage and grow the entire HomeHub ecosystem.',
    issuesAlert: `${criticalIssuesCount} critical items require admin attention`,
    allGood: 'All systems operational and secure',
  };

  return (
    <div
      className="relative overflow-hidden rounded-3xl mx-4 my-3 shadow-lg border border-slate-200/50 bg-slate-900"
      dir={direction}
    >
      {/* Background Architectural Real-Estate Building */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80')`,
        }}
      />

      {/* Corporate Building Signage Overlay matching reference image */}
      <div
        className={`absolute top-4 ${
          direction === 'rtl' ? 'left-6 sm:left-10' : 'right-6 sm:right-10'
        } z-10 hidden xs:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 backdrop-blur-md shadow-md border border-white/60`}
      >
        <div className="w-4 h-4 rounded-xs bg-emerald-500 flex items-center justify-center text-white">
          <div className="grid grid-cols-2 gap-0.5 w-2.5 h-2.5">
            <div className="bg-white rounded-3xs" />
            <div className="bg-white rounded-3xs" />
            <div className="bg-white rounded-3xs" />
            <div className="bg-white rounded-3xs" />
          </div>
        </div>
        <span className="text-[11px] font-black text-slate-900 tracking-tight">HomeHub</span>
      </div>

      {/* Dark Gradient Overlay for optimal legibility and contrast */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/92 via-slate-950/78 to-blue-950/45" />

      {/* Content Container */}
      <div className="relative z-10 px-5 py-6 sm:py-8 flex flex-col justify-center min-h-[170px] sm:min-h-[190px]">
        <div className="max-w-md space-y-1.5">
          {/* Welcome greeting */}
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-semibold text-slate-300">
              {content.welcome}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Headline matching reference image exactly */}
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {content.headline}
          </h1>

          {/* Subtitle / Operational message */}
          <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-sm pt-0.5">
            {content.desc}
          </p>

          {/* Live Operational Status Indicator */}
          <div className="pt-2">
            {criticalIssuesCount > 0 ? (
              <button
                type="button"
                onClick={onViewIssues}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 backdrop-blur-md border border-rose-400/40 text-rose-200 hover:bg-rose-500/30 text-[11px] font-bold cursor-pointer transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{content.issuesAlert}</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-400/40 text-emerald-200 text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{content.allGood}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
