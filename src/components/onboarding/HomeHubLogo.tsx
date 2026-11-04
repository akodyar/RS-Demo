import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';

interface HomeHubLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  light?: boolean;
  className?: string;
}

export const HomeHubLogo: React.FC<HomeHubLogoProps> = ({
  size = 'md',
  showTagline = true,
  light = false,
  className = '',
}) => {
  const { t, direction } = useI18n();

  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
  };

  const titleSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const taglineSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`} dir="ltr">
      {/* 3D-effect House Badge */}
      <div
        className={`${iconSizes[size]} relative shrink-0 rounded-2xl bg-gradient-to-b from-[#1a73e8] to-[#00b494] p-[2px] shadow-lg flex items-center justify-center`}
      >
        <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center relative overflow-hidden p-1 shadow-inner">
          <svg
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            {/* Gable Roof in Royal Blue */}
            <path
              d="M20 4L4 16H36L20 4Z"
              fill="#0066fe"
            />
            {/* House body */}
            <path
              d="M7 16V34C7 35.1 7.9 36 9 36H31C32.1 36 33 35.1 33 34V16H7Z"
              fill="#eef4ff"
            />
            {/* 4 Green Windows in 2x2 grid */}
            <rect x="11" y="19" width="7" height="7" rx="1.5" fill="#00c9a7" />
            <rect x="22" y="19" width="7" height="7" rx="1.5" fill="#00c9a7" />
            <rect x="11" y="27.5" width="7" height="7" rx="1.5" fill="#00c9a7" />
            <rect x="22" y="27.5" width="7" height="7" rx="1.5" fill="#00c9a7" />
          </svg>
        </div>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col text-left">
        <span
          className={`font-black tracking-tight leading-none ${light ? 'text-white' : 'text-slate-900'} ${titleSizes[size]}`}
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          HomeHub
        </span>
        {showTagline && (
          <span
            className={`font-medium mt-1 leading-none ${light ? 'text-white/90' : 'text-slate-500'} ${taglineSizes[size]}`}
            dir={direction}
          >
            {t('brand.tagline', 'ماڵی باشتر، ژیانی باشتر')}
          </span>
        )}
      </div>
    </div>
  );
};
