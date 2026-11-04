
import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { FileText } from 'lucide-react';

export const PropertyPassportPage : React.FC = () => {
  const { t, direction } = useI18n();

  return (
    <div className={`p-6 max-w-7xl mx-auto flex flex-col gap-6 ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/20 border border-amber-500/30 p-2.5 rounded-lg shadow-sm text-amber-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white">{t('passport.title', 'Property Passport')}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{t('ui.feature_unavailable', 'This feature is currently unavailable or pending integration.')}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-12 text-center">
        <FileText className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">{t('ui.no_data', 'No Data Available')}</h3>
        <p className="text-slate-400 max-w-md mx-auto">{t('ui.module_not_configured', 'This module has not been fully configured with real data sources yet.')}</p>
      </div>
    </div>
  );
};
