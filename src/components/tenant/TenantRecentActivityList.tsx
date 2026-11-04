import React from 'react';
import { Wrench, CreditCard, FileText, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { TenantActivityItem } from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';

interface TenantRecentActivityListProps {
  activities: TenantActivityItem[];
  onViewAll: () => void;
  onSelectActivity?: (activity: TenantActivityItem) => void;
}

export const TenantRecentActivityList: React.FC<TenantRecentActivityListProps> = ({
  activities,
  onViewAll,
  onSelectActivity,
}) => {
  const { t } = useI18n();

  const displayActivities: TenantActivityItem[] = activities;

  return (
    <div id="tenant-recent-activity-section" className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-white tracking-tight">
          {t('tenant.recentActivity', 'Recent Activity')}
        </h3>
        <button
          id="recent-activity-view-all"
          type="button"
          onClick={onViewAll}
          className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
        >
          <span>{t('tenant.viewAll', 'View All')}</span>
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
        </button>
      </div>

      <div className="space-y-2">
        {displayActivities.map((act) => {
          const isPending = act.status.toLowerCase().includes('pending') || act.status.toLowerCase().includes('reported');
          const isCompleted = act.status.toLowerCase().includes('completed') || act.status.toLowerCase().includes('confirmed') || act.status.toLowerCase().includes('paid');

          const displayTitle = act.type === 'MAINTENANCE' || act.title.toLowerCase().includes('maintenance')
            ? t('tenant.maintenance_request', 'Maintenance Request')
            : act.type === 'PAYMENT' || act.title.toLowerCase().includes('payment')
            ? t('tenant.rentPayment', 'Rent Payment')
            : act.title;

          const displaySubtitle = act.subtitle.includes('Kitchen Sink')
            ? `${t('tenant.catPlumbing', 'Plumbing')} - ${t('tenant.kitchenSink', 'Kitchen Sink')}`
            : act.subtitle.includes('April') || act.subtitle.includes('Rent')
            ? `${t('tenant.monthApril', 'April')} - 350,000 IQD`
            : act.subtitle;

          const displayStatus = isPending
            ? t('tenant.prioPending', 'Pending')
            : isCompleted
            ? t('tenant.confirmed', 'Completed')
            : act.status;

          return (
            <div
              key={act.id}
              onClick={() => onSelectActivity && onSelectActivity(act)}
              className="bg-[#0c1322] rounded-2xl border border-slate-800 p-4 flex items-center justify-between gap-3 shadow-sm hover:border-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  act.type === 'MAINTENANCE' 
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                    : act.type === 'PAYMENT'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}>
                  {act.type === 'MAINTENANCE' ? (
                    <Wrench className="w-5 h-5" />
                  ) : act.type === 'PAYMENT' ? (
                    <CreditCard className="w-5 h-5" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-extrabold text-white leading-tight">
                    {displayTitle}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {displaySubtitle}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isPending
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                    : isCompleted
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}>
                  {isPending ? (
                    <Clock className="w-3 h-3" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  {displayStatus}
                </span>
                <span className="text-[10px] text-slate-500 font-medium" dir="ltr">
                  {act.timestamp}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
