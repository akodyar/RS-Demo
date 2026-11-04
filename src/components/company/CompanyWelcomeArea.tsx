import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Calendar, MapPin } from 'lucide-react';

interface CompanyWelcomeAreaProps {
  userName?: string;
  location?: string;
}

export const CompanyWelcomeArea: React.FC<CompanyWelcomeAreaProps> = ({
  userName,
  location,
}) => {
  const { t, language } = useI18n();

  // Localized date formatting
  const today = new Date();
  const formattedDate = new Intl.DateTimeFormat(
    language === 'ku' ? 'ckb' : language === 'ar' ? 'ar-IQ' : 'en-US',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  ).format(today);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
      {/* Welcome Title and Subtitle */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {userName 
            ? `${t('company.welcome_back', 'Welcome back')}, ${userName}!` 
            : t('company.welcome_back_generic', 'Welcome back!')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
          {t('company.welcome_sub', "Here's what's happening with your properties today.")}
        </p>
      </div>

      {/* Date & Location (Truthful, no fake weather) */}
      <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 text-slate-300 text-xs font-semibold">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formattedDate}</span>
        </div>

        {location && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 text-slate-300 text-xs font-semibold">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>{location}</span>
          </div>
        )}
      </div>
    </div>
  );
};
