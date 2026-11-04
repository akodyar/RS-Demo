import React from 'react';
import {
  Wrench,
  Calendar,
  FileText,
  CheckCircle2,
  DollarSign,
  Star,
  TrendingUp,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface VendorKpiData {
  activeWorkOrders: number;
  workOrdersDelta: number;
  scheduledToday: number;
  scheduledDelta: number;
  pendingQuotes: number;
  pendingQuotesDelta: number;
  completedThisMonth: number;
  completedDelta: number;
  totalEarningsThisMonth: number;
  earningsDelta: number;
  averageRating: number;
  ratingDelta: number;
  currency: string;
}

interface VendorKpiGridProps {
  kpi: VendorKpiData;
  onCardClick?: (section: string) => void;
}

export const VendorKpiGrid: React.FC<VendorKpiGridProps> = ({ kpi, onCardClick }) => {
  const { t } = useI18n();

  const cards = [
    {
      id: 'work-orders',
      title: t('vendor.kpi_active_orders', 'Active Work Orders'),
      value: kpi.activeWorkOrders,
      delta: `↑ ${kpi.workOrdersDelta}%`,
      deltaPositive: true,
      icon: Wrench,
      iconBg: 'bg-amber-400/10 text-amber-400 border border-amber-500/20',
    },
    {
      id: 'schedule',
      title: t('vendor.kpi_scheduled_today', 'Scheduled Today'),
      value: kpi.scheduledToday,
      delta: `↑ ${kpi.scheduledDelta}%`,
      deltaPositive: true,
      icon: Calendar,
      iconBg: 'bg-sky-950/80 text-sky-400 border border-sky-500/30',
    },
    {
      id: 'quotes',
      title: t('vendor.kpi_pending_quotes', 'Pending Quotes'),
      value: kpi.pendingQuotes,
      delta: `↑ ${kpi.pendingQuotesDelta}%`,
      deltaPositive: true,
      icon: FileText,
      iconBg: 'bg-amber-950/80 text-amber-400 border border-amber-500/30',
    },
    {
      id: 'completed',
      title: t('vendor.kpi_completed_month', 'Completed (Month)'),
      value: kpi.completedThisMonth,
      delta: `↑ ${kpi.completedDelta}%`,
      deltaPositive: true,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30',
    },
    {
      id: 'earnings',
      title: t('vendor.kpi_total_earnings', 'Total Earnings'),
      value: `${kpi.totalEarningsThisMonth.toLocaleString()} IQD`,
      delta: `↑ ${kpi.earningsDelta}%`,
      deltaPositive: true,
      icon: DollarSign,
      iconBg: 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30',
    },
    {
      id: 'reviews',
      title: t('vendor.kpi_average_rating', 'Average Rating'),
      value: kpi.averageRating.toFixed(1),
      delta: `+${kpi.ratingDelta} ${t('vendor.rating_word', 'rating')}`,
      deltaPositive: true,
      icon: Star,
      iconBg: 'bg-amber-400/10 text-amber-400 fill-amber-400 border border-amber-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
      {cards.map((c) => {
        const IconComponent = c.icon;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onCardClick?.(c.id)}
            className="p-4 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all text-start flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-400 leading-snug line-clamp-2 min-h-[2rem] group-hover:text-amber-400 transition-colors">
                {c.title}
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${c.iconBg}`}
              >
                <IconComponent className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3">
              <span className="text-2xl font-black text-white tracking-tight block">
                <span dir="ltr">{c.value}</span>
              </span>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 mt-1">
                <span dir="ltr">{c.delta}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};
