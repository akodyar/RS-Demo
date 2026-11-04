import React from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { AlertTriangle, ServerCrash } from 'lucide-react';

interface IntegrationFallbackProps {
  providerName: string;
  capability: string;
  message?: string;
}

export const IntegrationFallback: React.FC<IntegrationFallbackProps> = ({ providerName, capability, message }) => {
  const { t } = useI18n();

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 text-center max-w-md mx-auto my-6">
      <div className="flex justify-center mb-3">
        <div className="bg-orange-100 p-3 rounded-full text-orange-600">
          <ServerCrash className="w-8 h-8" />
        </div>
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">{providerName} {t('integration.unavailable')}</h3>
      <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-3">Capability: {capability}</p>
      <p className="text-sm text-slate-600 mb-4">
        {message || t('integration.fallback_message')}
      </p>
      <div className="bg-orange-100/50 p-3 rounded-lg border border-orange-200 text-xs text-orange-800 text-left flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Operations dependent on this provider have been safely paused. No data has been lost or fabricated.</span>
      </div>
    </div>
  );
};
