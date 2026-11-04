import React from 'react';
import {
  Wrench,
  Calendar,
  FileText,
  DollarSign,
  Star,
  Plus,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { VendorDashboardData } from '../../types/vendor';

interface VendorHeroBannerProps {
  displayName: string;
  onNewQuote: () => void;
  onLogWork: () => void;
}

export const VendorHeroBanner: React.FC<VendorHeroBannerProps> = ({
  displayName,
  onNewQuote,
  onLogWork,
}) => {
  const { t, direction, language } = useI18n();
  const rawFirstName = displayName.split(' ')[0] || 'Omar';
  const firstName = (rawFirstName === 'Service' || rawFirstName === 'Vendor' || rawFirstName === 'Contractor')
    ? (language === 'ku' ? 'خزمەتگوزار' : language === 'ar' ? 'مزوّد الخدمة' : 'Service Provider')
    : rawFirstName;

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1528] via-[#0F223D] to-[#1E3A8A] text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl border border-slate-800">
      {/* Background glow effects */}
      <div className="absolute top-0 end-0 -mt-12 -me-12 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 start-1/4 -mb-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>{t('vendor.verified_contractor_badge', 'Verified Contractor Hub')}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
          <span>{t('vendor.greeting_prefix', 'Good morning')},</span>
          <span className="text-blue-400">{firstName}</span>
        </h1>

        <p className="text-sm text-blue-100 font-medium">
          {t('vendor.greeting_sub', 'Keep properties running smoothly across Erbil, Sulaymaniyah, and Duhok.')}
        </p>

        <p className="text-xs text-slate-400 pt-1">
          {t('vendor.motto', 'Quality service builds stronger communities • Skilled people. Stronger homes. Happier communities.')}
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-3 w-full sm:w-auto">
        <button
          type="button"
          data-testid="btn-vendor-new-quote"
          onClick={onNewQuote}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs shadow-md active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>{t('vendor.action_new_quote', '+ New Quote')}</span>
        </button>

        <button
          type="button"
          onClick={onLogWork}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#111b2e] hover:bg-[#17243a] text-slate-200 font-bold text-xs border border-slate-700 active:scale-[0.98] transition-all cursor-pointer min-h-[44px]"
        >
          <Wrench className="w-4 h-4 text-amber-400" />
          <span>{t('vendor.action_log_work', 'Log Work')}</span>
        </button>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* MIDDLE ROW: JOB ACTIVITY & SERVICE REQUEST OVERVIEW                       */
/* ========================================================================= */

interface JobActivityProps {
  jobActivity: VendorDashboardData['jobActivity'];
}

export const VendorJobActivityChart: React.FC<JobActivityProps> = ({ jobActivity }) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">
            {t('vendor.job_activity_title', 'Job Activity')}
          </h3>
          <p className="text-xs text-slate-400">{t('vendor.job_activity_sub', 'Inbound vs in-progress vs completed jobs')}</p>
        </div>
        <span className="text-xs text-slate-400 bg-[#080d19] border border-slate-800 px-2.5 py-1 rounded-lg font-bold">
          {jobActivity.period === 'Last 7 days' ? t('vendor.period_last_7_days', 'Last 7 days') : (jobActivity.period || t('vendor.period_last_7_days', 'Last 7 days'))}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300 mb-4 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span>{t('vendor.legend_new', 'New Requests')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
          <span>{t('vendor.legend_in_progress', 'In Progress')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span>{t('vendor.legend_completed', 'Completed')}</span>
        </div>
      </div>

      {/* Grouped Bar Visualizer */}
      <div className="h-48 flex items-end justify-between gap-2 pt-2">
        {jobActivity.days.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
            <div className="w-full flex items-end justify-center gap-1 h-36">
              <div
                style={{ height: `${Math.min(100, (item.newRequests / 25) * 100)}%` }}
                className="w-2 sm:w-2.5 bg-amber-400 rounded-t transition-all group-hover:brightness-110 shadow-sm"
                title={`New: ${item.newRequests}`}
              />
              <div
                style={{ height: `${Math.min(100, (item.inProgress / 25) * 100)}%` }}
                className="w-2 sm:w-2.5 bg-sky-400 rounded-t transition-all group-hover:brightness-110 shadow-sm"
                title={`In Progress: ${item.inProgress}`}
              />
              <div
                style={{ height: `${Math.min(100, (item.completed / 25) * 100)}%` }}
                className="w-2 sm:w-2.5 bg-emerald-400 rounded-t transition-all group-hover:brightness-110 shadow-sm"
                title={`Completed: ${item.completed}`}
              />
            </div>
            <span className="text-[11px] text-slate-400 font-bold">{t(`days.${item.day.toLowerCase()}`, item.day)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RequestOverviewProps {
  requestOverview: VendorDashboardData['requestOverview'];
}

export const VendorRequestOverviewDonut: React.FC<RequestOverviewProps> = ({ requestOverview }) => {
  const { t } = useI18n();
  const total = requestOverview.totalRequests || 48;

  const statuses = [
    { label: t('vendor.status_new', 'New'), count: requestOverview.new, color: 'bg-amber-400', ringColor: '#F5B900' },
    { label: t('vendor.status_assigned', 'Assigned'), count: requestOverview.assigned, color: 'bg-amber-600', ringColor: '#D97706' },
    { label: t('vendor.status_in_progress', 'In Progress'), count: requestOverview.inProgress, color: 'bg-emerald-400', ringColor: '#34D399' },
    { label: t('vendor.status_on_hold', 'On Hold'), count: requestOverview.onHold, color: 'bg-rose-400', ringColor: '#F87171' },
    { label: t('vendor.status_completed', 'Completed'), count: requestOverview.completed, color: 'bg-cyan-400', ringColor: '#22D3EE' },
  ];

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">
            {t('vendor.requests_overview_title', 'Service Request Overview')}
          </h3>
          <p className="text-xs text-slate-400">{t('vendor.requests_overview_sub', 'Distribution by lifecycle state')}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 my-auto">
        {/* Donut Chart Presentation with SVG */}
        <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
          <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#111b2e"
              strokeWidth="12"
            />
            {/* Segments */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#F5B900"
              strokeWidth="12"
              strokeDasharray={`${(requestOverview.new / total) * 251.2} 251.2`}
              strokeDashoffset="0"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#D97706"
              strokeWidth="12"
              strokeDasharray={`${(requestOverview.assigned / total) * 251.2} 251.2`}
              strokeDashoffset={`-${(requestOverview.new / total) * 251.2}`}
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#34D399"
              strokeWidth="12"
              strokeDasharray={`${(requestOverview.inProgress / total) * 251.2} 251.2`}
              strokeDashoffset={`-${((requestOverview.new + requestOverview.assigned) / total) * 251.2}`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-black text-white tracking-tight" dir="ltr">
              {total}
            </span>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              {t('vendor.total_requests', 'Total')}
            </span>
          </div>
        </div>

        {/* Status List Legend with Clear Spacing */}
        <div className="flex-1 w-full space-y-2 text-xs">
          {statuses.map((s, idx) => {
            const pct = Math.round((s.count / total) * 100) || 0;
            return (
              <div key={idx} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.color}`} />
                  <span className="text-slate-300 font-medium truncate">{s.label}</span>
                </div>
                <div className="text-end font-bold text-white shrink-0" dir="ltr">
                  <span>{s.count}</span>
                  <span className="text-slate-400 text-[11px] font-normal ms-1">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* THIRD ROW: QUICK ACTIONS, TODAY'S SCHEDULE, RECENT REQUESTS               */
/* ========================================================================= */

interface QuickActionsProps {
  onNewQuote: () => void;
  onLogWork: () => void;
  onCreateInvoice: () => void;
  onViewSchedule: () => void;
  onAddArea: () => void;
  onUpdateAvailability: () => void;
}

export const VendorQuickActionsGrid: React.FC<QuickActionsProps> = ({
  onNewQuote,
  onLogWork,
  onCreateInvoice,
  onViewSchedule,
  onAddArea,
  onUpdateAvailability,
}) => {
  const { t } = useI18n();

  const actions = [
    { title: t('vendor.qa_new_quote', 'New Quote'), icon: FileText, onClick: onNewQuote, color: 'text-amber-400 bg-[#111b2e] hover:bg-[#17243a] border-slate-800' },
    { title: t('vendor.qa_log_work', 'Log Work'), icon: Wrench, onClick: onLogWork, color: 'text-amber-400 bg-[#111b2e] hover:bg-[#17243a] border-slate-800' },
    { title: t('vendor.qa_invoice', 'Create Invoice'), icon: DollarSign, onClick: onCreateInvoice, color: 'text-emerald-400 bg-[#111b2e] hover:bg-[#17243a] border-slate-800' },
    { title: t('vendor.qa_schedule', 'View Schedule'), icon: Calendar, onClick: onViewSchedule, color: 'text-sky-400 bg-[#111b2e] hover:bg-[#17243a] border-slate-800' },
    { title: t('vendor.qa_add_area', 'Add Service Area'), icon: MapPin, onClick: onAddArea, color: 'text-amber-400 bg-[#111b2e] hover:bg-[#17243a] border-slate-800' },
    { title: t('vendor.qa_availability', 'Operating Hours'), icon: Clock, onClick: onUpdateAvailability, color: 'text-cyan-400 bg-[#111b2e] hover:bg-[#17243a] border-slate-800' },
  ];

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{t('vendor.quick_actions', 'Quick Actions')}</h3>
        <p className="text-xs text-slate-400">{t('vendor.quick_actions_sub', 'Frequent contractor operations')}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map((act, i) => {
          const Icon = act.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={act.onClick}
              className={`p-3.5 rounded-xl border ${act.color} text-center flex flex-col items-center justify-center gap-2 hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all active:scale-[0.98] cursor-pointer min-h-[44px]`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold leading-tight">{act.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface TodayScheduleProps {
  schedule: VendorDashboardData['todaySchedule'];
  onViewCalendar: () => void;
}

export const VendorTodaySchedule: React.FC<TodayScheduleProps> = ({ schedule, onViewCalendar }) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">{t('vendor.today_schedule_title', "Today's Schedule")}</h3>
          <p className="text-xs text-slate-400">{schedule.length} {t('vendor.events_today', 'appointments lined up')}</p>
        </div>
        <button
          type="button"
          onClick={onViewCalendar}
          className="text-xs text-amber-400 font-bold hover:underline cursor-pointer"
        >
          {t('vendor.view_calendar', 'View Calendar')}
        </button>
      </div>

      <div className="space-y-2.5">
        {schedule.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-xl bg-[#080d19] border border-slate-800 flex items-start justify-between gap-3 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap pt-0.5" dir="ltr">
                {item.time}
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">
                  {t(`job.${item.title.toLowerCase().replace(/ /g, '_')}`, item.title)}
                </h4>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span>{item.propertyLocation}</span>
                </p>
              </div>
            </div>

            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${
                item.status === 'IN_PROGRESS'
                  ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                  : item.status === 'MEETING'
                  ? 'bg-purple-950/80 text-purple-400 border border-purple-500/30'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {item.status === 'IN_PROGRESS'
                ? t('vendor.status_in_progress', 'In Progress')
                : item.status === 'MEETING'
                ? t('vendor.status_meeting', 'Meeting')
                : t('vendor.status_scheduled', 'Scheduled')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface RecentRequestsProps {
  requests: VendorDashboardData['recentRequests'];
  onViewAll: () => void;
}

export const VendorRecentRequests: React.FC<RecentRequestsProps> = ({ requests, onViewAll }) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">{t('vendor.recent_requests_title', 'Recent Service Requests')}</h3>
          <p className="text-xs text-slate-400">{t('vendor.recent_requests_sub', 'Inbound assigned work tickets')}</p>
        </div>
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-amber-400 font-bold hover:underline cursor-pointer"
        >
          {t('vendor.view_all', 'View All')}
        </button>
      </div>

      <div className="space-y-2.5">
        {requests.map((req) => (
          <div
            key={req.id}
            className="p-3 rounded-xl bg-[#080d19] border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="px-2 py-1 text-[10px] font-black bg-slate-800 text-amber-400 rounded-lg text-center whitespace-nowrap shrink-0 border border-slate-700"
                dir="ltr"
              >
                {req.srCode}
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-white truncate">
                  {t(`req.${req.title.toLowerCase().replace(/ /g, '_')}`, req.title)}
                </h4>
                <p className="text-[11px] text-slate-400 truncate">{req.location}</p>
              </div>
            </div>

            <div className="text-end shrink-0">
              <span
                className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                  req.status === 'NEW'
                    ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                    : req.status === 'ASSIGNED'
                    ? 'bg-sky-950/80 text-sky-400 border border-sky-500/30'
                    : 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {t(`vendor.status_${req.status.toLowerCase()}`, req.status)}
              </span>
              <p className="text-[10px] text-slate-500 mt-1" dir="ltr">
                {t(`time.${req.timeAgo.toLowerCase().replace(/ /g, '_')}`, req.timeAgo)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* FOURTH ROW: EARNINGS OVERVIEW, TOP CATEGORIES, CLIENT REVIEWS             */
/* ========================================================================= */

interface EarningsOverviewProps {
  earnings: VendorDashboardData['earningsOverview'];
}

export const VendorEarningsOverview: React.FC<EarningsOverviewProps> = ({ earnings }) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">{t('vendor.earnings_overview_title', 'Earnings Overview')}</h3>
          <p className="text-xs text-slate-400">{t('vendor.earnings_overview_sub', 'Cumulative revenue trajectory')}</p>
        </div>
        <span className="text-xs text-slate-400 bg-[#080d19] border border-slate-800 px-2 py-1 rounded-lg font-bold">
          {earnings.year || '2026'}
        </span>
      </div>

      <div className="h-44 flex items-end justify-between gap-3 pt-4">
        {earnings.months.map((item, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
            <div
              style={{ height: `${Math.min(100, (item.amount / 14000) * 100)}%` }}
              className="w-full bg-gradient-to-t from-amber-500 to-amber-400 rounded-t group-hover:brightness-110 transition-all shadow-md"
              title={`$${item.amount.toLocaleString()}`}
            />
            <span className="text-[10px] text-slate-400 font-bold">{t(`months.${item.month.toLowerCase()}`, item.month)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface TopCategoriesProps {
  categories: VendorDashboardData['topCategories'];
}

export const VendorTopCategories: React.FC<TopCategoriesProps> = ({ categories }) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{t('vendor.top_categories_title', 'Top Service Categories')}</h3>
        <p className="text-xs text-slate-400">{t('vendor.top_categories_sub', 'Job volume by trade specialization')}</p>
      </div>

      <div className="space-y-3 pt-1">
        {categories.map((cat, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">
                {t(`cat.${cat.category.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, cat.category)}
              </span>
              <span className="text-slate-400 font-extrabold" dir="ltr">
                {cat.percentage}% <span className="text-[10px] font-normal text-slate-500">({cat.jobCount} {t('vendor.jobs_word', 'jobs')})</span>
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                style={{ width: `${cat.percentage}%` }}
                className={`h-full rounded-full ${
                  i === 0
                    ? 'bg-amber-400'
                    : i === 1
                    ? 'bg-emerald-400'
                    : i === 2
                    ? 'bg-rose-400'
                    : i === 3
                    ? 'bg-sky-400'
                    : i === 4
                    ? 'bg-purple-400'
                    : 'bg-slate-500'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ReviewsAndMessagesProps {
  reviews: VendorDashboardData['clientReviews'];
  messages: VendorDashboardData['messages'];
  onViewReviews: () => void;
  onViewMessages: () => void;
}

export const VendorReviewsAndMessages: React.FC<ReviewsAndMessagesProps> = ({
  reviews,
  messages,
  onViewReviews,
  onViewMessages,
}) => {
  const { t } = useI18n();

  return (
    <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 shadow-xl flex flex-col justify-between space-y-4">
      {/* Client Reviews Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-white">{t('vendor.client_reviews_title', 'Client Reviews')}</h3>
          <button
            type="button"
            onClick={onViewReviews}
            className="text-xs text-amber-400 font-bold hover:underline cursor-pointer"
          >
            {t('vendor.view_all', 'View All')}
          </button>
        </div>

        <div className="flex items-center gap-4 my-2 p-3 bg-[#080d19] rounded-xl border border-slate-800">
          <div className="text-center shrink-0">
            <span className="text-3xl font-black text-white" dir="ltr">
              {reviews.averageRating.toFixed(1)}
            </span>
            <div className="flex items-center justify-center gap-0.5 text-amber-400 mt-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className="w-3 h-3 fill-amber-400 shrink-0" />
              ))}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">
              {reviews.reviewCount} {t('vendor.reviews_word', 'reviews')}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs italic text-slate-300 line-clamp-2">
              "{t('vendor.sample_review_comment', reviews.recentReviews[0]?.comment || 'Excellent service, highly professional!')}"
            </p>
            <p className="text-[11px] font-bold text-white mt-1 truncate">
              — {reviews.recentReviews[0]?.reviewerName || 'Client'}
              <span className="text-[10px] font-normal text-slate-500 ms-1">
                ({reviews.recentReviews[0]?.date || 'Recent'})
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Messages Snippet Section */}
      <div className="pt-2 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('vendor.recent_messages_title', 'Latest Client Messages')}</span>
          </h4>
          <button
            type="button"
            onClick={onViewMessages}
            className="text-[11px] text-amber-400 font-bold hover:underline cursor-pointer"
          >
            {t('vendor.inbox_link', 'Inbox')}
          </button>
        </div>

        <div className="space-y-1.5">
          {messages.slice(0, 2).map((msg) => (
            <div
              key={msg.id}
              className="p-2.5 rounded-lg bg-[#080d19] border border-slate-800 flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="font-bold text-white truncate">{msg.senderName}:</span>
                <span className="text-slate-300 truncate">{msg.messageSnippet}</span>
              </div>
              <span className="text-[10px] text-slate-500 shrink-0" dir="ltr">
                {msg.time}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
