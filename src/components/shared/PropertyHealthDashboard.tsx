import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { Building2, AlertTriangle, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

export interface PropertyHealth {
  propertyId: string;
  propertyName: string;
  propertyNameKurdish?: string;
  status: 'HEALTHY' | 'ATTENTION' | 'CRITICAL';
  financialVisible: boolean;
  outstandingAmountIqd: number;
  unpaidItemsCount: number;
  maintenanceIssuesCount: number;
  criticalIssuesCount: number;
  topIssue?: string;
  topIssueKurdish?: string;
  topIssueArabic?: string;
}

export const PropertyHealthDashboard: React.FC<{ role: 'OWNER' | 'AGENT' }> = ({ role }) => {
  const { t, language } = useI18n();
  const [healthData, setHealthData] = useState<PropertyHealth[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHealthData();
  }, [role]);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('auth_token') || (role === 'OWNER' ? 'dev-owner' : 'dev-agent');
      const endpoint = role === 'OWNER' ? '/api/owner/properties/health' : '/api/agent/properties/health';
      
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.status === 403 && token.startsWith('dev-register-')) {
        // Token is unsynced or corrupted, force re-login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('homehub_auth_token');
        localStorage.removeItem('homehub_auth_persona');
        window.location.href = '/onboarding';
        return;
      }
      
      if (!res.ok) {
        throw new Error(`Failed to load health data (HTTP ${res.status})`);
      }
      
      const data = await res.json();
      if (data.error === 'DATABASE_NOT_CONFIGURED') {
        throw new Error('Database connection unavailable (Fail-Closed).');
      }
      
      setHealthData(data);
    } catch (err: any) {
      setError(err.message || 'An error occurred loading property health.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-6 mb-6 animate-pulse">
        <div className="h-6 bg-slate-800/80 rounded-lg w-1/4 mb-6"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="h-24 bg-slate-800/40 rounded-xl border border-slate-800/60"></div>
          <div className="h-24 bg-slate-800/40 rounded-xl border border-slate-800/60"></div>
          <div className="h-24 bg-slate-800/40 rounded-xl border border-slate-800/60"></div>
          <div className="h-24 bg-slate-800/40 rounded-xl border border-slate-800/60"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-950/30 text-rose-300 rounded-2xl border border-rose-800/40 p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
          <span className="font-medium text-sm">{t('health.errorLoading', 'Error loading property health: ')} {error}</span>
        </div>
        <button onClick={fetchHealthData} className="p-2 hover:bg-rose-900/40 rounded-full transition-colors text-rose-300 cursor-pointer">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (!healthData || healthData.length === 0) {
    return (
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-8 mb-6 text-center">
        <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-bold text-white">{t('health.noProperties', 'No Accessible Properties')}</h3>
        <p className="text-xs text-slate-400 mt-1">{t('health.noPropertiesDesc', 'You currently have no properties assigned to your portfolio.')}</p>
      </div>
    );
  }

  const healthyCount = healthData.filter(h => h.status === 'HEALTHY').length;
  const attentionCount = healthData.filter(h => h.status === 'ATTENTION').length;
  const criticalCount = healthData.filter(h => h.status === 'CRITICAL').length;
  const totalOutstanding = healthData.reduce((acc, curr) => acc + (curr.financialVisible ? curr.outstandingAmountIqd : 0), 0);
  const financialVisibleOverall = healthData.some(h => h.financialVisible);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle2 className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {t('health.healthy', 'HEALTHY')}</span>;
      case 'ATTENTION':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"><AlertTriangle className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {t('health.attention', 'ATTENTION')}</span>;
      case 'CRITICAL':
        return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30"><AlertCircle className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {t('health.critical', 'CRITICAL')}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-white mb-4">{t('health.dashboardTitle', 'Property Portfolio Health')}</h2>
      
      {/* Top Level Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        <div className="bg-[#0c1322] rounded-2xl shadow-lg border border-slate-800/80 p-4 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('health.totalProperties', 'Total Properties')}</span>
          <span className="text-2xl font-black text-white">{healthData.length}</span>
        </div>
        <div className="bg-[#0c1322] rounded-2xl shadow-lg border border-emerald-500/30 p-4 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1 flex items-center"><CheckCircle2 className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('health.healthyCount', 'Healthy')}</span>
          <span className="text-2xl font-black text-emerald-400">{healthyCount}</span>
        </div>
        <div className="bg-[#0c1322] rounded-2xl shadow-lg border border-amber-500/30 p-4 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 mb-1 flex items-center"><AlertTriangle className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('health.attentionCount', 'Attention Needed')}</span>
          <span className="text-2xl font-black text-amber-400">{attentionCount}</span>
        </div>
        <div className="bg-[#0c1322] rounded-2xl shadow-lg border border-rose-500/30 p-4 flex flex-col justify-center">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-1 flex items-center"><AlertCircle className="w-4 h-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('health.criticalCount', 'Critical Issues')}</span>
          <span className="text-2xl font-black text-rose-400">{criticalCount}</span>
        </div>
        {financialVisibleOverall && (
          <div className="bg-[#0c1322] rounded-2xl shadow-lg border border-slate-800/80 p-4 flex flex-col justify-center col-span-2 md:col-span-4 xl:col-span-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{t('health.totalOutstanding', 'Total Outstanding')}</span>
            <span className="text-2xl font-black text-amber-400"><span dir="ltr">{totalOutstanding.toLocaleString()} IQD</span></span>
          </div>
        )}
      </div>

      {/* Property Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {healthData.map((prop) => (
          <div key={prop.propertyId} className="bg-[#0c1322] rounded-2xl shadow-xl border border-slate-800/80 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center hover:border-amber-500/40 transition-all">
            <div className="mb-4 sm:mb-0">
              <div className="flex items-center space-x-3 rtl:space-x-reverse mb-2">
                <h3 className="text-lg font-bold text-white">
                  {language === 'ku' && prop.propertyNameKurdish ? prop.propertyNameKurdish : prop.propertyName}
                </h3>
                {getStatusBadge(prop.status)}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                {language === 'ku' ? prop.topIssueKurdish : language === 'ar' ? prop.topIssueArabic : prop.topIssue}
              </div>
              
              <div className="flex flex-wrap gap-3 mt-3">
                {prop.financialVisible && prop.outstandingAmountIqd > 0 && (
                  <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                    {t('health.unpaidItems', 'Unpaid Items')}: {prop.unpaidItemsCount}
                  </span>
                )}
                {prop.maintenanceIssuesCount > 0 && (
                  <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    {t('health.maintenanceIssues', 'Maintenance')}: {prop.maintenanceIssuesCount}
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-left sm:text-right w-full sm:w-auto">
              {prop.financialVisible && (
                <div className="mb-2">
                  <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{t('health.outstanding', 'Outstanding')}</div>
                  <div className={`text-xl font-black ${prop.outstandingAmountIqd > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    <span dir="ltr">{prop.outstandingAmountIqd.toLocaleString()} IQD</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
