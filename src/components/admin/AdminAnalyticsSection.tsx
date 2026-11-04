import React, { useState } from 'react';
import { ArrowUpRight, TrendingUp, Info } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface UserCompositionItem {
  label?: string;
  roleKey?: string;
  count?: number;
  percent: number;
  color?: string;
}

export interface GrowthDataPoint {
  month: string;
  val: number;
  x: number;
  y: number;
}

interface AdminAnalyticsSectionProps {
  totalUsers: number;
  monthlyGrowthPercent?: number | null;
  growthHistory?: GrowthDataPoint[] | null;
  compositionData?: UserCompositionItem[];
  onOpenUserGrowth?: () => void;
  onFilterUserRole?: (roleKey: string) => void;
}

export const AdminAnalyticsSection: React.FC<AdminAnalyticsSectionProps> = ({
  totalUsers,
  monthlyGrowthPercent = null,
  growthHistory = null,
  compositionData = [],
  onOpenUserGrowth,
  onFilterUserRole,
}) => {
  const { language, direction } = useI18n();
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

  const t = {
    ku: {
      userGrowth: 'گەشەی بەکارهێنەران',
      totalUsers: 'کۆی بەکارهێنەران',
      vsLastMonth: 'بەراورد بە مانگی ڕابردوو',
      noHistoricalData: 'داتای مێژوویی مانگانە بەردەست نییە',
      historicalNote: 'بەراوردی مانگانە پێویستی بە داتای دەورەی ڕابردووە',
      userDistribution: 'دابەشبوونی بەکارهێنەران',
      usersLabel: 'بەکارهێنەر',
      noComposition: 'هیچ داتایەکی دابەشبوون بەردەست نییە',
      roles: {
        PROPERTY_OWNER: 'خاوەن موڵک',
        COMPANY: 'کۆمپانیاکان',
        TENANT: 'کرێچییەکان',
        BUYER: 'کڕیاران',
        AGENT: 'برۆکەرەکان',
        VENDOR: 'دابینکەران',
        STAFF: 'کارمەندان',
        OTHER: 'هیتر',
      },
    },
    ar: {
      userGrowth: 'نمو المستخدمين',
      totalUsers: 'إجمالي المستخدمين',
      vsLastMonth: 'مقارنة بالشهر السابق',
      noHistoricalData: 'البيانات التاريخية الشهرية غير متوفرة',
      historicalNote: 'المقارنة الشهرية تتطلب اكتمال الدورة الزمنية السابقة',
      userDistribution: 'توزيع المستخدمين',
      usersLabel: 'مستخدم',
      noComposition: 'لا توجد بيانات توزيع متوفرة حالياً',
      roles: {
        PROPERTY_OWNER: 'ملاك العقارات',
        COMPANY: 'الشركات',
        TENANT: 'المستأجرين',
        BUYER: 'المشترين',
        AGENT: 'الوسطاء',
        VENDOR: 'مزودي الخدمات',
        STAFF: 'فريق العمل',
        OTHER: 'أخرى',
      },
    },
    en: {
      userGrowth: 'User Growth',
      totalUsers: 'Total Users',
      vsLastMonth: 'vs last month',
      noHistoricalData: 'Historical growth data unavailable',
      historicalNote: 'Comparative analysis requires historical baseline data',
      userDistribution: 'User Distribution',
      usersLabel: 'Users',
      noComposition: 'No distribution data available yet',
      roles: {
        PROPERTY_OWNER: 'Property Owners',
        COMPANY: 'Companies',
        TENANT: 'Tenants',
        BUYER: 'Buyers',
        AGENT: 'Agents',
        VENDOR: 'Vendors',
        STAFF: 'Staff',
        OTHER: 'Others',
      },
    },
  }[language] || {
    userGrowth: 'User Growth',
    totalUsers: 'Total Users',
    vsLastMonth: 'vs last month',
    noHistoricalData: 'Historical growth data unavailable',
    historicalNote: 'Comparative analysis requires historical baseline data',
    userDistribution: 'User Distribution',
    usersLabel: 'Users',
    noComposition: 'No distribution data available yet',
    roles: {
      PROPERTY_OWNER: 'Property Owners',
      COMPANY: 'Companies',
      TENANT: 'Tenants',
      BUYER: 'Buyers',
      AGENT: 'Agents',
      VENDOR: 'Vendors',
      STAFF: 'Staff',
      OTHER: 'Others',
    },
  };

  // Map composition data with translated labels
  const distribution = (compositionData.length > 0
    ? compositionData
    : []
  ).map((item) => {
    const roleKey = item.roleKey || 'OTHER';
    const label =
      t.roles[roleKey as keyof typeof t.roles] || item.label || roleKey;
    return {
      ...item,
      label,
      color: item.color || '#64748b',
    };
  });

  // SVG Donut Calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  return (
    <div className="px-4 py-2" dir={direction}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* =========================================
            CARD 1: USER GROWTH (HONEST HISTORICAL STATE)
           ========================================= */}
        <div className="bg-[#0c1322] rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl transition-all flex flex-col justify-between">
          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {t.userGrowth}
              </h3>
              {onOpenUserGrowth && (
                <button
                  type="button"
                  onClick={onOpenUserGrowth}
                  className="w-7 h-7 rounded-full bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  aria-label={t.userGrowth}
                >
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Metric & Trend Pill */}
            <div className="flex items-baseline gap-2.5 mb-2">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight font-mono">
                {totalUsers.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-semibold">{t.totalUsers}</span>
              {monthlyGrowthPercent !== null ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-black">
                  <span>+{monthlyGrowthPercent}%</span>
                  <span className="text-[10px] font-normal text-emerald-400 hidden xs:inline">
                    {t.vsLastMonth}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#080d19] border border-slate-800 text-slate-400 text-[11px] font-bold">
                  <span>{t.noHistoricalData}</span>
                </div>
              )}
            </div>

            {/* Line Chart or Honest Notice */}
            {growthHistory && growthHistory.length > 1 ? (
              <div className="relative pt-2">
                <svg
                  className="w-full h-36 overflow-visible select-none"
                  viewBox="0 0 300 135"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="growthAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d4af37" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#d4af37" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  <line x1="20" y1="20" x2="290" y2="20" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="20" y1="55" x2="290" y2="55" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="20" y1="90" x2="290" y2="90" stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
                  <line x1="20" y1="120" x2="290" y2="120" stroke="#334155" strokeWidth="1" />

                  {growthHistory.map((pt, i) => (
                    <g key={pt.month}>
                      <circle cx={pt.x} cy={pt.y} r="3" fill="#f59e0b" />
                      <text x={pt.x} y="132" textAnchor="middle" className="text-[9px] fill-slate-400 font-bold">
                        {pt.month}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            ) : (
              <div className="h-32 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-4 text-center mt-3 bg-[#080d19]/60">
                <Info className="w-5 h-5 text-amber-400 mb-1" />
                <p className="text-xs font-bold text-slate-300">{t.noHistoricalData}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">{t.historicalNote}</p>
              </div>
            )}
          </div>
        </div>

        {/* =========================================
            CARD 2: USER DISTRIBUTION (AUTHORITATIVE DERIVED)
           ========================================= */}
        <div className="bg-[#0c1322] rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl transition-all flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {t.userDistribution}
              </h3>
            </div>

            {distribution.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-medium">
                {t.noComposition}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 pt-1">
                {/* Donut Chart SVG */}
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#1e293b"
                      strokeWidth="11"
                    />

                    {distribution.map((item, idx) => {
                      const strokeDasharray = `${(item.percent / 100) * circumference} ${circumference}`;
                      const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                      accumulatedPercent += item.percent;

                      const isHovered = hoveredSlice === idx;

                      return (
                        <circle
                          key={item.roleKey || idx}
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke={item.color}
                          strokeWidth={isHovered ? 13 : 11}
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                          className="transition-all duration-300 cursor-pointer"
                          onMouseEnter={() => setHoveredSlice(idx)}
                          onMouseLeave={() => setHoveredSlice(null)}
                          onClick={() => item.roleKey && onFilterUserRole?.(item.roleKey)}
                        />
                      );
                    })}
                  </svg>

                  {/* Centered Donut Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                    <span className="text-lg font-black text-white leading-none font-mono">
                      {hoveredSlice !== null
                        ? `${distribution[hoveredSlice]?.percent}%`
                        : totalUsers.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate max-w-[70px]">
                      {hoveredSlice !== null ? distribution[hoveredSlice]?.label : t.usersLabel}
                    </span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 w-full text-xs">
                  {distribution.map((item, idx) => (
                    <div
                      key={item.roleKey || idx}
                      onClick={() => item.roleKey && onFilterUserRole?.(item.roleKey)}
                      onMouseEnter={() => setHoveredSlice(idx)}
                      onMouseLeave={() => setHoveredSlice(null)}
                      className={`flex items-center justify-between p-1 rounded-lg transition-colors cursor-pointer ${
                        hoveredSlice === idx ? 'bg-[#080d19] border border-slate-700 font-bold' : 'hover:bg-[#111b2e]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[11px] text-slate-300 truncate">{item.label}</span>
                      </div>
                      <span className="text-[11px] font-bold text-white font-mono shrink-0 ml-1">
                        {item.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
