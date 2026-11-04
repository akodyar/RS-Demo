import React from 'react';
import { Users, Building2, Home, Coins, ArrowUp, Activity } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface AdminMetricsRowProps {
  totalUsers: number;
  totalCompanies: number;
  totalProperties: number;
  totalRecords: number;
  usersChange?: string | null;
  companiesChange?: string | null;
  propertiesChange?: string | null;
  recordsChange?: string | null;
  isLoading?: boolean;
  onSelectMetric?: (metricKey: 'users' | 'companies' | 'properties' | 'records') => void;
}

export const AdminMetricsRow: React.FC<AdminMetricsRowProps> = ({
  totalUsers,
  totalCompanies,
  totalProperties,
  totalRecords,
  usersChange = null,
  companiesChange = null,
  propertiesChange = null,
  recordsChange = null,
  isLoading = false,
  onSelectMetric,
}) => {
  const { language, direction } = useI18n();

  const labels = {
    ku: {
      users: 'کۆی بەکارهێنەران',
      companies: 'کۆمپانیاکان',
      properties: 'موڵکەکان',
      records: 'چالاکییەکانی پلاتفۆرم',
      live: 'ڕاستەوخۆ',
    },
    ar: {
      users: 'إجمالي المستخدمين',
      companies: 'الشركات',
      properties: 'العقارات',
      records: 'نشاطات المنصة',
      live: 'مباشر',
    },
    en: {
      users: 'Total Users',
      companies: 'Companies',
      properties: 'Properties',
      records: 'Platform Activities',
      live: 'Live',
    },
  }[language] || {
    users: 'Total Users',
    companies: 'Companies',
    properties: 'Properties',
    records: 'Platform Activities',
    live: 'Live',
  };

  const metrics = [
    {
      key: 'users' as const,
      label: labels.users,
      value: totalUsers.toLocaleString(),
      change: usersChange,
      icon: Users,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border border-amber-500/20',
    },
    {
      key: 'companies' as const,
      label: labels.companies,
      value: totalCompanies.toLocaleString(),
      change: companiesChange,
      icon: Building2,
      iconColor: 'text-amber-300',
      iconBg: 'bg-amber-500/10 border border-amber-500/20',
    },
    {
      key: 'properties' as const,
      label: labels.properties,
      value: totalProperties.toLocaleString(),
      change: propertiesChange,
      icon: Home,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border border-emerald-500/20',
    },
    {
      key: 'records' as const,
      label: labels.records,
      value: totalRecords.toLocaleString(),
      change: recordsChange,
      icon: Coins,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border border-amber-500/20',
    },
  ];

  return (
    <div className="px-4 py-1" dir={direction}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {metrics.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectMetric?.(item.key)}
              className="bg-[#0c1322] hover:bg-[#111b2e] rounded-3xl p-3.5 sm:p-4 border border-slate-800 hover:border-amber-500/40 shadow-xl transition-all text-center flex flex-col items-center justify-center gap-1 group cursor-pointer"
            >
              {/* Icon in Rounded Circle */}
              <div
                className={`w-11 h-11 rounded-2xl ${item.iconBg} ${item.iconColor} flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs mb-0.5`}
              >
                <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </div>

              {/* Metric Number */}
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                {isLoading ? '...' : item.value}
              </span>

              {/* Subtitle Label */}
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 leading-tight">
                {item.label}
              </span>

              {/* Trend or Live status indicator */}
              {item.change ? (
                <div className="flex items-center gap-0.5 text-[11px] font-extrabold text-emerald-400 mt-0.5">
                  <ArrowUp className="w-3 h-3 stroke-[3]" />
                  <span>{item.change}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[10px] font-medium text-slate-500 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{labels.live}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
