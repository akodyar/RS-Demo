import React from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { 
  Wrench, FileText, UserPlus, CheckCircle2, Wallet, 
  ChevronRight, AlertCircle, Clock 
} from 'lucide-react';

export interface ActivityItem {
  id: string;
  type: 'MAINTENANCE' | 'LEASE' | 'TENANT' | 'APPROVAL' | 'PAYMENT';
  title: string;
  subtitle: string;
  timeAgo: string;
  timestamp?: string;
  status?: string;
  details?: string;
  amountIqd?: number;
}

interface CompanyRecentActivityProps {
  activities?: ActivityItem[];
  onSelectActivity: (activity: ActivityItem) => void;
  onViewAllActivity: () => void;
}

export const CompanyRecentActivity: React.FC<CompanyRecentActivityProps> = ({
  activities = [],
  onSelectActivity,
  onViewAllActivity,
}) => {
  const { t, direction } = useI18n();

  const items = activities || [];

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'MAINTENANCE':
        return { icon: Wrench, bg: 'bg-emerald-50 text-emerald-600 border border-emerald-100' };
      case 'LEASE':
        return { icon: FileText, bg: 'bg-blue-50 text-blue-600 border border-blue-100' };
      case 'TENANT':
        return { icon: UserPlus, bg: 'bg-purple-50 text-purple-600 border border-purple-100' };
      case 'APPROVAL':
        return { icon: CheckCircle2, bg: 'bg-amber-50 text-amber-600 border border-amber-100' };
      case 'PAYMENT':
        return { icon: Wallet, bg: 'bg-teal-50 text-teal-600 border border-teal-100' };
      default:
        return { icon: AlertCircle, bg: 'bg-slate-50 text-slate-600 border border-slate-100' };
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">
          {t('company.recent_activity', 'Recent Activity')}
        </h2>
        {items.length > 0 && (
          <button
            onClick={onViewAllActivity}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer py-1"
          >
            <span>{t('company.view_all', 'View All')}</span>
            <ChevronRight className={`w-3.5 h-3.5 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Activity List or Honest Empty State */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-500 shadow-xs">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs sm:text-sm font-semibold text-slate-700">
            {t('company.no_recent_activity', 'No recent activity recorded')}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {t('company.activity_will_appear', 'Operational events, lease updates, and ledger transactions will appear here.')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {items.map(item => {
            const { icon: Icon, bg } = getActivityIcon(item.type);
            return (
              <button
                key={item.id}
                onClick={() => onSelectActivity(item)}
                className="w-full p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors text-left rtl:text-right cursor-pointer group"
              >
                {/* Icon & Details */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${bg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* TimeAgo & Chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    {item.timeAgo}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
