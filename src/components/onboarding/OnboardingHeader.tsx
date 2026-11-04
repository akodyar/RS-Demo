import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSelector } from './LanguageSelector';

interface OnboardingHeaderProps {
  onBack?: () => void;
  stepText?: string;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  className?: string;
}

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({
  onBack,
  stepText,
  showBack = true,
  rightAction,
  className = '',
}) => {
  const { direction, language } = useI18n();

  const backLabel = language === 'ku' ? 'گەڕانەوە' : language === 'ar' ? 'رجوع' : 'Back';
  const BackIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;

  return (
    <div
      className={`w-full flex items-center justify-between py-3 px-6 z-20 shrink-0 ${className}`}
      dir={direction}
    >
      {/* Back Button */}
      {showBack && onBack ? (
        <button
          type="button"
          id="onboarding-back-btn"
          onClick={onBack}
          className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 active:scale-95 transition-all text-sm font-bold group cursor-pointer"
        >
          <BackIcon className="w-5 h-5 text-amber-400 group-hover:-translate-x-0.5 transition-transform stroke-[2.5]" />
          <span>{backLabel}</span>
        </button>
      ) : (
        <div className="w-12" />
      )}

      {/* Step Counter & Language Selector on Opposite Side */}
      <div className="flex items-center gap-3">
        {stepText && (
          <span className="text-xs sm:text-sm font-semibold text-slate-400 tracking-wider">
            {stepText}
          </span>
        )}
        <LanguageSelector variant="transparent" />
        {rightAction}
      </div>
    </div>
  );
};

