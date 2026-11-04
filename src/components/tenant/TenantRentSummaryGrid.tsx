import React from 'react';
import { CheckCircle2, Clock, AlertOctagon } from 'lucide-react';
import { TenantFinancialSummary } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantRentSummaryGridProps {
  summary: TenantFinancialSummary;
}

export const TenantRentSummaryGrid: React.FC<TenantRentSummaryGridProps> = ({ summary }) => {
  const { t } = useI18n();

  return (
    <div id="tenant-rent-summary-grid" className="grid grid-cols-3 gap-3 sm:gap-4">
      {/* Paid This Month */}
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-3.5 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-emerald-400 mb-1">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 truncate">
            {t('tenant.paidThisMonth', 'Paid This Month')}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-black text-white tracking-tight" dir="ltr">
          {(summary?.paidThisMonth ?? 0).toLocaleString()}
          <span className="text-[10px] sm:text-xs font-bold text-amber-400/90 ms-1 uppercase">
            {summary?.currency || 'IQD'}
          </span>
        </p>
      </div>

      {/* Outstanding */}
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-3.5 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-blue-400 mb-1">
          <Clock className="w-4 h-4 shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 truncate">
            {t('tenant.outstanding', 'Outstanding')}
          </span>
        </div>
        <p className="text-lg sm:text-xl font-black text-white tracking-tight" dir="ltr">
          {(summary?.outstanding ?? 0).toLocaleString()}
          <span className="text-[10px] sm:text-xs font-bold text-amber-400/90 ms-1 uppercase">
            {summary?.currency || 'IQD'}
          </span>
        </p>
      </div>

      {/* Overdue */}
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-3.5 sm:p-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-rose-400 mb-1">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 truncate">
            {t('tenant.overdueLabel', 'Overdue')}
          </span>
        </div>
        <p className={`text-lg sm:text-xl font-black tracking-tight ${
          (summary?.overdue ?? 0) > 0 ? 'text-rose-400' : 'text-white'
        }`} dir="ltr">
          {(summary?.overdue ?? 0).toLocaleString()}
          <span className="text-[10px] sm:text-xs font-bold text-amber-400/90 ms-1 uppercase">
            {summary?.currency || 'IQD'}
          </span>
        </p>
      </div>
    </div>
  );
};
