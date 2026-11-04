import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface OnboardingShellProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  bgDark?: boolean;
  currentScreenNumber?: number;
  onNavigateScreen?: (step: any) => void;
}

export const OnboardingShell: React.FC<OnboardingShellProps> = ({
  children,
  className = '',
  contentClassName = '',
  bgDark = false,
  currentScreenNumber,
  onNavigateScreen,
}) => {
  const { direction, t } = useI18n();

  return (
    <div
      dir={direction}
      className={`min-h-screen w-full flex flex-col relative transition-colors duration-200 ${
        bgDark
          ? 'bg-gradient-to-b from-[#070b14] via-[#0c1322] to-[#070b14] text-white'
          : 'bg-[#070b14] text-white'
      } ${className}`}
    >
      {/* Top Floating Control Bar for Screen Navigation (Desktop & Presentation) */}
      {Boolean(currentScreenNumber) && (
        <div className="sticky top-0 z-50 w-full px-4 py-2 pointer-events-none">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 pointer-events-auto">
            {/* Brand & Desktop Mode Badge */}
            <div className="flex items-center gap-2 bg-[#0c1322]/95 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full border border-amber-500/30 shadow-xl text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="hidden sm:inline font-black tracking-tight text-white">HomeHub</span>
              <span className="text-amber-300 text-[11px] font-bold">{t('admin.platform_modern', 'پلاتفۆرمی مۆدێرن')}</span>
            </div>

            {/* Screen Jump Buttons 1 to 9 */}
            {onNavigateScreen && (
              <div className="flex items-center gap-1 bg-[#0c1322]/95 text-white backdrop-blur-md px-2.5 py-1 rounded-full border border-amber-500/30 shadow-xl overflow-x-auto no-scrollbar">
                <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap pe-1">
                  {t('onboard.screen_label', 'شاشە:')}
                </span>
                {[
                  { num: 1, step: 'welcome', title: 'دەستپێک' },
                  { num: 2, step: 'purpose', title: 'مەبەست' },
                  { num: 3, step: 'signup', title: 'تۆمارکردن' },
                  { num: 4, step: 'profile_setup', title: 'پڕۆفایل' },
                  { num: 5, step: 'profile_review', title: 'پێداچوونەوە' },
                  { num: 6, step: 'success', title: 'سەرکەوتوو' },
                ].map((item) => (
                  <button
                    key={item.num}
                    type="button"
                    onClick={() => onNavigateScreen(item.step)}
                    title={item.title}
                    className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all flex items-center justify-center cursor-pointer ${
                      currentScreenNumber === item.num
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm scale-105'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {item.num}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Full-Screen Content Area */}
      <main className={`flex-1 flex flex-col w-full relative ${contentClassName}`}>
        {children}
      </main>
    </div>
  );
};


