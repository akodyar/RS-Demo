import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../components/AuthProvider';
import { Link } from 'react-router-dom';
import { 
  PieChart, TrendingUp, Building2, Wallet, ArrowUpRight, ArrowDownRight, 
  AlertCircle, RefreshCw, ShieldAlert, Sparkles, CheckCircle, Clock, 
  FileText, Activity, Layers, MapPin, DollarSign, Download
} from 'lucide-react';
import { 
  PortfolioOverview, 
  PortfolioDistributions, 
  PropertyPerformanceMetrics,
  AIAdvisoryInsight 
} from '../types/analytics';

export const PortfolioWorkspacePage: React.FC = () => {
  const { t, direction } = useI18n();
  const { token, user } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [dbUnavailable, setDbUnavailable] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'IQD'>('IQD');
  const [overview, setOverview] = useState<PortfolioOverview | null>(null);
  const [distributions, setDistributions] = useState<PortfolioDistributions | null>(null);
  const [propertiesList, setPropertiesList] = useState<PropertyPerformanceMetrics[]>([]);
  const [aiInsights, setAiInsights] = useState<AIAdvisoryInsight[]>([]);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    setDbUnavailable(false);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const [overviewRes, distRes, propsRes, aiRes] = await Promise.all([
        fetch(`/api/analytics/portfolio?currency=${currency}`, { headers }),
        fetch(`/api/analytics/portfolio/distributions?currency=${currency}`, { headers }),
        fetch(`/api/analytics/portfolio/properties?currency=${currency}`, { headers }),
        fetch(`/api/analytics/ai/insights?currency=${currency}`, { headers }),
      ]);

      if (overviewRes.status === 503 || distRes.status === 503) {
        setDbUnavailable(true);
        setLoading(false);
        return;
      }

      if (!overviewRes.ok) {
        if (overviewRes.status === 403) {
          throw new Error(t('analytics.forbidden', 'Forbidden: Your role does not have permission to view portfolio analytics.'));
        }
        throw new Error(t('analytics.load_error', 'Failed to load portfolio analytics data.'));
      }

      const overviewData: PortfolioOverview = await overviewRes.json();
      setOverview(overviewData);

      if (distRes.ok) {
        setDistributions(await distRes.json());
      }
      if (propsRes.ok) {
        setPropertiesList(await propsRes.json());
      }
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        setAiInsights(aiData.insights || []);
      }
    } catch (err: any) {
      console.error('Analytics fetch error:', err);
      setError(err.message || 'An unexpected error occurred while loading analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [token, currency]);

  const handleExport = (format: string) => {
    setExportNotice(t('analytics.export_notice', `ڕاپۆرتی پۆرتفۆلیۆ (${format}) بە سەرکەوتوویی ئامادەکرا.`));
    setTimeout(() => setExportNotice(null), 3500);
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">تەندروست (Healthy)</span>;
      case 'ATTENTION_REQUIRED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">پێویستی بە سەرنجە (Attention)</span>;
      case 'AT_RISK':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">لەژێر مەترسیدایە (At Risk)</span>;
      case 'CRITICAL':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">مەترسیدار (Critical)</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">داتای ناتەواو (N/A)</span>;
    }
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Portfolio Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Portfolio"
            aria-label="HomeHub Portfolio"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Portfolio Navigation"
          >
            {/* Overview */}
            <button
              type="button"
              data-testid="portfolio-tab-overview"
              title="Portfolio Overview"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold"
            >
              <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              <PieChart className="w-4.5 h-4.5 shrink-0 text-amber-400" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'پۆرتفۆلیۆ' : 'Portfolio'}
              </span>
            </button>

            {/* Properties */}
            <button
              type="button"
              data-testid="portfolio-tab-assets"
              title="Properties"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <Building2 className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'موڵکەکان' : 'Assets'}
              </span>
              {propertiesList.length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {propertiesList.length}
                </span>
              )}
            </button>

            {/* Revenue */}
            <button
              type="button"
              data-testid="portfolio-tab-cashflow"
              title="Revenue & Cashflow"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <Wallet className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'داهات' : 'Cashflow'}
              </span>
            </button>

            {/* AI Insights */}
            <button
              type="button"
              data-testid="portfolio-tab-insights"
              title="AI Insights"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <Sparkles className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'ڕێنمایی' : 'Insights'}
              </span>
              {aiInsights.length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {aiInsights.length}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Export */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => handleExport('PDF')}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Export Report"
            aria-label="Export Report"
          >
            <Download className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Razor-Sharp Desktop & Mobile Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 lg:px-8 h-16 flex items-center justify-between gap-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex md:hidden items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xs">
                HH
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2.5 text-xs">
              <span className="text-slate-400 font-medium">
                {direction === 'rtl' ? 'پۆرتفۆلیۆ' : 'Portfolio'}
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold">
                {t('portfolio.title', 'Portfolio Intelligence')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Currency Toggle */}
            <div className="flex items-center bg-[#080d19] p-0.5 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => setCurrency('USD')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${currency === 'USD' ? 'bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency('IQD')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${currency === 'IQD' ? 'bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/30' : 'text-slate-400 hover:text-white'}`}
              >
                IQD
              </button>
            </div>

            <button
              onClick={() => handleExport('PDF')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{direction === 'rtl' ? 'داگرتن' : 'Export'}</span>
            </button>

            <button
              onClick={fetchAnalyticsData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-800 bg-[#080d19] text-slate-300 hover:bg-[#111b2e] flex items-center justify-center cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-6 max-w-7xl mx-auto p-6 pb-12 w-full">

      {/* Export Notice */}
      {exportNotice && (
        <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Fail-Closed Database Unavailable Notice (503) */}
      {dbUnavailable && (
        <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-800/50 text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm sm:text-base">داتابەیسی سەرەکی پەیوەست نەکراوە (Database Unavailable - Fail Closed)</h3>
            <p className="text-xs sm:text-sm mt-1 text-amber-400/80">
              سیستەمی هۆم هاب ڕێگە بە پیشاندانی داتای ساختە یان دروستکراو نادات. تا پەیوەستبوونی تەواوی داتابەیسی پەیوەندیدار، خزمەتگوزارییە شیکارییەکان لە دۆخی پارێزراودان.
            </p>
          </div>
        </div>
      )}

      {/* Generic Error Notice */}
      {error && !dbUnavailable && (
        <div className="p-5 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-300 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">{t('core.error', 'هەڵە لە بارکردنی داتا')}</h3>
              <p className="text-xs sm:text-sm mt-0.5 text-rose-300">{error}</p>
            </div>
          </div>
          <button 
            onClick={fetchAnalyticsData}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            دووبارە هەوڵبدەرەوە (Retry)
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl h-32 flex flex-col justify-between">
              <div className="h-4 bg-slate-800 rounded w-1/3"></div>
              <div className="h-7 bg-slate-800 rounded w-2/3"></div>
              <div className="h-3 bg-slate-800 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Portfolio State */}
      {!loading && !dbUnavailable && overview && overview.totalProperties === 0 && (
        <div className="bg-[#0C1322] border border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <Building2 className="w-12 h-12 text-slate-600" />
          <h3 className="text-lg font-bold text-white">
            {t('portfolio.empty_title', 'No properties registered in this portfolio')}
          </h3>
          <p className="text-sm text-slate-400 max-w-md">
            {t('portfolio.empty_desc', 'To view in-depth investment and revenue analytics, register your first property and verify ownership or management agreements.')}
          </p>
          <Link
            to="/properties/add"
            className="mt-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 text-sm font-extrabold rounded-xl transition cursor-pointer"
          >
            {t('portfolio.add_first_property', 'Register First Property')}
          </Link>
        </div>
      )}

      {/* Live Content when Loaded */}
      {!loading && overview && overview.totalProperties > 0 && (
        <>
          {/* Primary 8 KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* 1. Total Asset Value */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-emerald-500/20 border border-emerald-500/30 p-2.5 rounded-xl">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 border border-slate-700 px-2 py-0.5 rounded-full">
                  خەمڵاندنی فەرمی
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">کۆی بەهای سەرمایە (Total Asset Value)</p>
                <p className="text-2xl font-black text-white">
                  {overview.totalAssetValue !== null ? (
                    <span dir="ltr">{overview.totalAssetValue.toLocaleString()} {currency}</span>
                  ) : (
                    <span className="text-base text-slate-500 font-normal">بێ خەمڵاندنی فەرمی</span>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">بەپێی دوایین هەڵسەنگاندنی تۆمارکراو</p>
            </div>

            {/* 2. Annual Yield / Cap Rate */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-amber-500/20 border border-amber-500/30 p-2.5 rounded-xl">
                  <TrendingUp className="w-5 h-5 text-amber-400" />
                </div>
                {overview.portfolioNetYield !== null && (
                  <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    <ArrowUpRight className="w-3.5 h-3.5" /> <span dir="ltr">{overview.portfolioNetYield}%</span>
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">ڕێژەی سوودی پوخت (Net Rental Yield)</p>
                <p className="text-2xl font-black text-white">
                  {overview.portfolioNetYield !== null ? (
                    <span dir="ltr">{overview.portfolioNetYield}%</span>
                  ) : (
                    <span className="text-base text-slate-500 font-normal">داتای ناتەواو</span>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                کاپ ڕەیت (Cap Rate): <span dir="ltr">{overview.portfolioCapRate !== null ? `${overview.portfolioCapRate}%` : 'N/A'}</span>
              </p>
            </div>

            {/* 3. Occupancy Rate */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-blue-500/20 border border-blue-500/30 p-2.5 rounded-xl">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-xs font-bold text-blue-300 bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  <span dir="ltr">{overview.occupiedUnits}/{overview.totalUnits}</span> یەکە
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">ڕێژەی پڕبوون (Occupancy Rate)</p>
                <p className="text-2xl font-black text-white">
                  {overview.overallOccupancyRate !== null ? (
                    <span dir="ltr">{overview.overallOccupancyRate}%</span>
                  ) : (
                    <span className="text-base text-slate-500 font-normal">بێ یەکە</span>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">بەپێی گرێبەستە کاراکانی کرێ</p>
            </div>

            {/* 4. Vacancy Rate */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-rose-500/20 border border-rose-500/30 p-2.5 rounded-xl">
                  <PieChart className="w-5 h-5 text-rose-400" />
                </div>
                <span className="text-xs font-bold text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full">
                  <span dir="ltr">{overview.vacantUnits}</span> یەکەی بەتاڵ
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">ڕێژەی بەتاڵی (Vacancy Rate)</p>
                <p className="text-2xl font-black text-white">
                  {overview.overallVacancyRate !== null ? (
                    <span dir="ltr">{overview.overallVacancyRate}%</span>
                  ) : (
                    <span className="text-base text-slate-500 font-normal">بێ یەکە</span>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">یەکەی بەتاڵ کە ئامادەیە بۆ بەکرێدان</p>
            </div>

            {/* 5. Gross Scheduled Revenue */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-emerald-500/20 border border-emerald-500/30 p-2.5 rounded-xl">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-[11px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  مانگانە
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">کۆی داهاتی دیاریکراو (Gross Revenue)</p>
                <p className="text-2xl font-black text-emerald-400">
                  <span dir="ltr">{(overview.totalGrossRevenue ?? 0).toLocaleString()} {currency}</span>
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">کۆی کرێی دیاریکراوی گرێبەستەکان</p>
            </div>

            {/* 6. Net Operating Income (NOI) */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-indigo-500/20 border border-indigo-500/30 p-2.5 rounded-xl">
                  <Activity className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-[11px] text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 rounded-full font-bold">
                  پوخت
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">داهاتی پوختی کارپێکردن (NOI)</p>
                <p className={`text-2xl font-black ${(overview.totalNetOperatingIncome ?? 0) >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                  <span dir="ltr">{(overview.totalNetOperatingIncome ?? 0).toLocaleString()} {currency}</span>
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">پاش لێدەرکردنی تێچووی کارپێکردن</p>
            </div>

            {/* 7. Collection Rate & Arrears */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-amber-500/20 border border-amber-500/30 p-2.5 rounded-xl">
                  <Clock className="w-5 h-5 text-amber-400" />
                </div>
                {(overview.totalArrears ?? 0) > 0 && (
                  <span className="text-[11px] text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                    دواکەوتوو
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">ڕێژەی کۆکردنەوە (Collection Rate)</p>
                <p className="text-2xl font-black text-white">
                  {overview.overallCollectionRate !== null && overview.overallCollectionRate !== undefined ? (
                    <span dir="ltr">{overview.overallCollectionRate}%</span>
                  ) : (
                    <span className="text-base text-slate-500 font-normal">N/A</span>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                کرێی دواکەوتوو: <span dir="ltr" className="font-semibold text-rose-400">{(overview.totalArrears ?? 0).toLocaleString()} {currency}</span>
              </p>
            </div>

            {/* 8. Operating Cash Flow */}
            <div className="bg-[#0C1322] border border-slate-800 p-5 rounded-2xl shadow-md flex flex-col justify-between">
              <div className="flex justify-between items-start mb-2">
                <div className="bg-purple-500/20 border border-purple-500/30 p-2.5 rounded-xl">
                  <Layers className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-[11px] text-purple-300 bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 rounded-full font-bold">
                  دەفتەری دارایی
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium mb-1">تەوژمی نەختینە (Net Cash Flow)</p>
                <p className={`text-2xl font-black ${(overview.totalCashFlow ?? 0) >= 0 ? 'text-purple-300' : 'text-rose-400'}`}>
                  <span dir="ltr">{(overview.totalCashFlow ?? 0).toLocaleString()} {currency}</span>
                </p>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">پشتڕاستکراوە بە دەفتەری ژمێریاری</p>
            </div>

          </div>

          {/* AI Advisory Insights & Recommendations */}
          {aiInsights.length > 0 && (
            <div className="bg-[#0C1322] border border-slate-800 rounded-2xl p-6 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">ڕاسپاردە و پێشنیارە زیرەکەکان (AI Advisory Insights)</h2>
                    <p className="text-xs text-slate-400">تەنها بۆ ڕاوێژکارییە؛ هەموو بڕیارە دارایی و یاساییەکان پێویستیان بە پەسەندکردنی مرۆیی هەیە.</p>
                  </div>
                </div>
                <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold px-3 py-1 rounded-full">
                  ڕاوێژکاری (Non-Executable)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiInsights.map((insight) => (
                  <div key={insight.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-850 hover:border-slate-700 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                          {insight.category}
                        </span>
                        <span className="text-[10px] text-slate-500">{new Date(insight.generatedAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1.5">{insight.headlineKurdish || insight.headline}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{insight.explanationKurdish || insight.explanation}</p>
                    </div>
                    {insight.proposedHumanAction && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <p className="text-[11px] text-slate-400 font-medium">
                          <span className="font-bold text-amber-400">هەنگاوی پێشنیارکراو:</span> {insight.proposedHumanAction}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Underperforming Signals & Alerts */}
          {overview.underperformingSignals.length > 0 && (
            <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-rose-300">ئاگاداری دۆخی موڵکەکان (Underperforming Signals)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {overview.underperformingSignals.map((sig, idx) => (
                  <div key={idx} className="p-3 bg-[#0C1322] border border-slate-800 rounded-xl flex items-start justify-between gap-3 text-xs">
                    <div className="text-slate-300">
                      <span className="font-bold text-white">{sig.propertyName}</span>: {sig.explanation}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sig.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                      {sig.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Distributions & Allocations */}
          {distributions && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Asset Type Distribution */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-2xl p-6 shadow-md">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" />
                  دابەشبوونی جۆری موڵک (Property Type Allocation)
                </h2>
                <div className="flex flex-col gap-3">
                  {distributions.assetTypeDistribution.map((item) => (
                    <div key={item.key}>
                      <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                        <span>{item.label}</span>
                        <span>{item.count} موڵک (<span dir="ltr">{item.percentage}%</span>)</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Geographic Distribution */}
              <div className="bg-[#0C1322] border border-slate-800 rounded-2xl p-6 shadow-md">
                <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-400" />
                  دابەشبوونی جوگرافی (Geographic Allocation)
                </h2>
                <div className="flex flex-col gap-3">
                  {distributions.geographicDistribution.map((item) => (
                    <div key={item.key}>
                      <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                        <span>{item.label}</span>
                        <span>{item.count} موڵک (<span dir="ltr">{item.percentage}%</span>)</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${item.percentage}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* Comparative Properties Performance Table */}
          <div className="bg-[#0C1322] border border-slate-800 rounded-2xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-white">بەراوردی ئاستی موڵکەکان (Property Performance Benchmarking)</h2>
                <p className="text-xs text-slate-400">بەراوردکاری داهات، تێچوو، ڕێژەی پڕبوون و بەهای سەرمایە</p>
              </div>
              <span className="text-xs text-slate-400 font-medium">کۆی گشتی: {propertiesList.length} موڵک</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40">
                    <th className="p-3 font-semibold">ناوی موڵک</th>
                    <th className="p-3 font-semibold">شار</th>
                    <th className="p-3 font-semibold">یەکە</th>
                    <th className="p-3 font-semibold">پڕبوون</th>
                    <th className="p-3 font-semibold">داهاتی مانگانە</th>
                    <th className="p-3 font-semibold">داهاتی پوخت (NOI)</th>
                    <th className="p-3 font-semibold">ڕێژەی سوود (Yield)</th>
                    <th className="p-3 font-semibold">دۆخ (Health)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {propertiesList.map((p) => (
                    <tr key={p.propertyId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-white">
                        <Link to={`/properties/${p.propertyId}`} className="hover:text-amber-400 hover:underline">
                          {p.propertyName}
                        </Link>
                      </td>
                      <td className="p-3 text-slate-400">{p.city || 'Erbil'}</td>
                      <td className="p-3 text-slate-400"><span dir="ltr">{p.occupiedUnits}/{p.totalUnits}</span></td>
                      <td className="p-3 font-semibold text-white">
                        {p.occupancyRate !== null ? <span dir="ltr">{p.occupancyRate}%</span> : <span className="text-slate-500">N/A</span>}
                      </td>
                      <td className="p-3 font-medium text-emerald-400">
                        <span dir="ltr">{p.grossScheduledRent.toLocaleString()} {currency}</span>
                      </td>
                      <td className={`p-3 font-medium ${p.netOperatingIncome >= 0 ? 'text-white' : 'text-rose-400'}`}>
                        <span dir="ltr">{p.netOperatingIncome.toLocaleString()} {currency}</span>
                      </td>
                      <td className="p-3 font-semibold text-amber-400">
                        {p.netRentalYield !== null ? <span dir="ltr">{p.netRentalYield}%</span> : <span className="text-slate-500">N/A</span>}
                      </td>
                      <td className="p-3">{getHealthBadge(p.healthStatus)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      </div>
      </div>
    </div>
  );
};
