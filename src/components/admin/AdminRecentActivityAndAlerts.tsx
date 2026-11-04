import React from 'react';
import {
  Plus,
  UserCheck,
  Home,
  Wrench,
  FileText,
  Building2,
  AlertCircle,
  Coins,
  ChevronRight,
  ChevronLeft,
  Clock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

export interface ActivityItem {
  id: string;
  title: string;
  entity: string;
  targetId?: string;
  time: string;
  module: string;
  details?: string;
}

export interface PendingApprovalsData {
  propertyVerifications: number;
  companyVerifications: number;
  newListings: number;
  userVerifications: number;
  financialApprovals: number;
  disputeCases: number;
  promotionCampaigns?: number;
}

interface AdminRecentActivityAndAlertsProps {
  activities?: ActivityItem[];
  pendingApprovals?: PendingApprovalsData;
  isLoading?: boolean;
  onViewAllActivity?: () => void;
  onViewAllAlerts?: () => void;
  onSelectAction?: (moduleKey: string, filter?: string) => void;
}

export const AdminRecentActivityAndAlerts: React.FC<AdminRecentActivityAndAlertsProps> = ({
  activities = [],
  pendingApprovals,
  isLoading = false,
  onViewAllActivity,
  onViewAllAlerts,
  onSelectAction,
}) => {
  const { language, direction } = useI18n();

  const t = {
    ku: {
      recentActivity: 'چالاکییەکانی ئەم دوایییە',
      pendingApprovals: 'ڕەزامەندییە چاوەڕوانکراوەکان',
      viewAll: 'بینینی هەموو',
      noActivities: 'هیچ تۆمارێکی نوێی چالاکی لە سیستەمدا بەردەست نییە',
      approvals: {
        prop: 'پشکنینی بەڵگەنامەی تاپۆ',
        propSub: 'پێداچوونەوەی ناوخۆیی بەڵگەنامەی موڵک',
        comp: 'مۆڵەتی کۆمپانیاکان',
        compSub: 'پشکنینی تۆماری بازرگانی کۆمپانیا',
        market: 'ڕیکلامە نوێیەکان',
        marketSub: 'پێداچوونەوە و ڕەزامەندی بڵاوکردنەوە',
        user: 'سەلماندنی بەکارهێنەر',
        userSub: 'پشکنینی بەڵگەنامە و ناسنامە',
        fin: 'تۆماری دارایی ناوخۆیی',
        finSub: 'پەسەندکردنی تۆماری دارایی پلاتفۆڕم',
        dispute: 'کەیسەکانی ناکۆکی',
        disputeSub: 'چارەسەری ناوخۆیی نێوان لایەنەکان',
      },
      upToDate: 'تەواوکراو',
      loading: 'بارکردنی داتا...',
    },
    ar: {
      recentActivity: 'النشاطات الأخيرة',
      pendingApprovals: 'الموافقات المعلقة',
      viewAll: 'عرض الكل',
      noActivities: 'لا توجد سجلات نشاط حديثة في النظام',
      approvals: {
        prop: 'تدقيق وثائق الطابو',
        propSub: 'مراجعة داخلية لوثائق الملكية',
        comp: 'تراخيص الشركات',
        compSub: 'تدقيق السجل التجاري للشركات',
        market: 'الإعلانات الجديدة',
        marketSub: 'مراجعة واعتماد النشر',
        user: 'توثيق المستخدمين',
        userSub: 'تدقيق الهوية والوثائق',
        fin: 'القيود المالية الداخلية',
        finSub: 'اعتماد القيود المحاسبية للمنصة',
        dispute: 'قضايا النزاعات',
        disputeSub: 'التسوية الداخلية بين الأطراف',
      },
      upToDate: 'مكتمل',
      loading: 'جاري تحميل البيانات...',
    },
    en: {
      recentActivity: 'Recent Activity',
      pendingApprovals: 'Pending Approvals',
      viewAll: 'View All',
      noActivities: 'No recent activity records available in the system',
      approvals: {
        prop: 'Property Deed Review',
        propSub: 'Internal documentation check (Not Gov Registry)',
        comp: 'Company Licenses',
        compSub: 'Brokerage commercial license check',
        market: 'New Listings',
        marketSub: 'Awaiting moderation & publish',
        user: 'User Verifications',
        userSub: 'Identity document review',
        fin: 'Internal Financial Records',
        finSub: 'Internal platform ledger entries',
        dispute: 'Dispute Cases',
        disputeSub: 'Internal platform mediation',
      },
      upToDate: 'Up to date',
      loading: 'Loading data...',
    },
  }[language] || {
    recentActivity: 'Recent Activity',
    pendingApprovals: 'Pending Approvals',
    viewAll: 'View All',
    noActivities: 'No recent activity records available in the system',
    approvals: {
      prop: 'Property Deed Review',
      propSub: 'Internal documentation check (Not Gov Registry)',
      comp: 'Company Licenses',
      compSub: 'Brokerage commercial license check',
      market: 'New Listings',
      marketSub: 'Awaiting moderation & publish',
      user: 'User Verifications',
      userSub: 'Identity document review',
      fin: 'Internal Financial Records',
      finSub: 'Internal platform ledger entries',
      dispute: 'Dispute Cases',
      disputeSub: 'Internal platform mediation',
    },
    upToDate: 'Up to date',
    loading: 'Loading data...',
  };

  const approvalList = [
    {
      key: 'propertyVerifications',
      count: pendingApprovals?.propertyVerifications ?? 0,
      title: t.approvals.prop,
      sub: t.approvals.propSub,
      module: 'properties',
      icon: Home,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      key: 'companyVerifications',
      count: pendingApprovals?.companyVerifications ?? 0,
      title: t.approvals.comp,
      sub: t.approvals.compSub,
      module: 'companies',
      icon: Building2,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      key: 'newListings',
      count: pendingApprovals?.newListings ?? 0,
      title: t.approvals.market,
      sub: t.approvals.marketSub,
      module: 'marketplace',
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      key: 'userVerifications',
      count: pendingApprovals?.userVerifications ?? 0,
      title: t.approvals.user,
      sub: t.approvals.userSub,
      module: 'verification',
      icon: UserCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      key: 'financialApprovals',
      count: pendingApprovals?.financialApprovals ?? 0,
      title: t.approvals.fin,
      sub: t.approvals.finSub,
      module: 'finance',
      icon: Coins,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      key: 'disputeCases',
      count: pendingApprovals?.disputeCases ?? 0,
      title: t.approvals.dispute,
      sub: t.approvals.disputeSub,
      module: 'messages',
      icon: AlertCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
    {
      key: 'promotionCampaigns',
      count: pendingApprovals?.promotionCampaigns ?? 0,
      title: language === 'ku' ? 'کەمپین و ڕیکلامەکان' : language === 'ar' ? 'حملات الترويج والرعاية' : 'Promotion Campaigns',
      sub: language === 'ku' ? 'پێداچوونەوەی کەمپین و داواکاری خاڵ' : language === 'ar' ? 'مراجعة حملات الرعاية وطلبات النقاط' : 'Sponsorship & Points Moderation',
      module: 'promotions',
      icon: Sparkles,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
  ];

  const ChevronIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="px-4 py-2" dir={direction}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* =========================================
            CARD 1: RECENT ACTIVITY (REAL AUDIT LOGS)
           ========================================= */}
        <div className="bg-[#0c1322] rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl transition-all flex flex-col justify-between">
          <div>
            {/* Header with Title & View All */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {t.recentActivity}
              </h3>
              {onViewAllActivity && (
                <button
                  type="button"
                  onClick={onViewAllActivity}
                  className="flex items-center gap-0.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer group"
                >
                  <span>{t.viewAll}</span>
                  <ChevronIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Activities List */}
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                {t.loading}
              </div>
            ) : activities.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center text-slate-500">
                <FileText className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-xs font-medium">{t.noActivities}</p>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-3.5">
                {activities.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectAction?.(item.module || 'audit', item.id)}
                    className="flex items-start gap-3 p-1.5 rounded-2xl hover:bg-[#111b2e] transition-colors cursor-pointer group"
                  >
                    {/* Activity Icon Container */}
                    <div className="w-8 h-8 rounded-xl bg-[#080d19] text-amber-400 border border-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-200 leading-snug group-hover:text-amber-400 transition-colors truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                        {item.entity} {item.details ? `• ${item.details}` : ''}
                      </p>
                    </div>

                    {/* Time pill */}
                    <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap pt-1">
                      {item.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* =========================================
            CARD 2: PENDING APPROVALS (REAL COUNTERS)
           ========================================= */}
        <div className="bg-[#0c1322] rounded-3xl p-4 sm:p-5 border border-slate-800 shadow-xl transition-all flex flex-col justify-between">
          <div>
            {/* Header with Title & View All */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                {t.pendingApprovals}
              </h3>
              {onViewAllAlerts && (
                <button
                  type="button"
                  onClick={onViewAllAlerts}
                  className="flex items-center gap-0.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer group"
                >
                  <span>{t.viewAll}</span>
                  <ChevronIcon className="w-3.5 h-3.5 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>

            {/* Approvals List */}
            {isLoading ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                {t.loading}
              </div>
            ) : (
              <div className="space-y-2.5 sm:space-y-3">
                {approvalList.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.key}
                      onClick={() => onSelectAction?.(item.module)}
                      className="flex items-center justify-between p-2 rounded-2xl hover:bg-[#111b2e] border border-transparent hover:border-slate-800 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Icon Container */}
                        <div
                          className={`w-8 h-8 rounded-xl ${item.bg} ${item.color} flex items-center justify-center shrink-0 shadow-2xs`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        {/* Title and Subtitle */}
                        <div className="truncate">
                          <p className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-amber-400 transition-colors truncate">
                            {item.title}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate">
                            {item.sub}
                          </p>
                        </div>
                      </div>

                      {/* Real Counter Badge */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-black transition-colors ${
                            item.count > 0
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-[#080d19] text-slate-500 border border-slate-800'
                          }`}
                        >
                          {item.count}
                        </span>
                        <ChevronIcon className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
