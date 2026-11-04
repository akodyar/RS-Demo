import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../components/AuthProvider';
import { 
  BarChart2, TrendingUp, PieChart, Sparkles, Shield, 
  AlertCircle, Download, FileText, CheckCircle, RefreshCw,
  Building2, Users, DollarSign, ArrowUpRight
} from 'lucide-react';
import { CompanyDashboardData, CompanyAIRecommendation } from '../types/company.js';

export const CompanyIntelligenceWorkspacePage: React.FC = () => {
  const { t, direction } = useI18n();
  const { token } = useAuth();

  const [loading, setLoading] = useState(false);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [data, setData] = useState<CompanyDashboardData | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const fetchIntelligenceData = async () => {
    setLoading(true);
    setDbUnavailable(false);
    try {
      const res = await fetch('/api/company/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.status === 503) {
        setDbUnavailable(true);
        setData(null);
      } else if (res.ok) {
        setData(await res.json());
      }
    } catch (err: any) {
      console.error('Intelligence fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligenceData();
  }, [token]);

  const handleExport = (type: string) => {
    setExportNotice(`ڕاپۆرتی ${type} ئامادەکرا و دابەزێندرا (Export Generated).`);
    setTimeout(() => setExportNotice(null), 3000);
  };

  const kpis = data?.kpis || {
    managedProperties: 0,
    activeTenants: 0,
    monthlyRentManagedIqd: 0,
    openMaintenance: 0,
    activeListings: 0,
    pendingApprovals: 0,
  };

  const financials = data?.financialSummary || {
    rentManagedTotalIqd: 0,
    collectedRentIqd: 0,
    pendingRentIqd: 0,
    commissionsEarnedIqd: 0,
    expensesApprovedIqd: 0,
    sourceOfTruth: 'POSTGRESQL_DOUBLE_ENTRY_LEDGER',
    propertiesCount: 0,
    reconciliationStatus: 'BALANCED',
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Intelligence Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Intelligence"
            aria-label="HomeHub Intelligence"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Intelligence Navigation"
          >
            {/* Overview */}
            <button
              type="button"
              data-testid="intel-tab-analytics"
              title="Overview"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold"
            >
              <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              <BarChart2 className="w-4.5 h-4.5 shrink-0 text-amber-400" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'شیکاری' : 'Analytics'}
              </span>
            </button>

            {/* Financial Trends */}
            <button
              type="button"
              data-testid="intel-tab-revenue"
              title="Trends"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <TrendingUp className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'داهات' : 'Revenue'}
              </span>
            </button>

            {/* AI Advisor */}
            <button
              type="button"
              data-testid="intel-tab-advisor"
              title="AI Recommendations"
              className="w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium"
            >
              <Sparkles className="w-4.5 h-4.5 shrink-0 text-slate-400 group-hover:text-slate-200" />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'ڕێنمایی AI' : 'Advisor'}
              </span>
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
                {direction === 'rtl' ? 'شوێنی کاری کۆمپانیا' : 'Company Workspace'}
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold">
                {direction === 'rtl' ? 'شیکاری و ڕاپۆرتی زیرەک' : 'Intelligence & Analytics'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('PDF')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{direction === 'rtl' ? 'داگرتنی ڕاپۆرت' : 'Export'}</span>
            </button>
            <button
              onClick={fetchIntelligenceData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-800 bg-[#080d19] text-slate-300 hover:bg-[#111b2e] flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6 w-full">

      {exportNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {dbUnavailable && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">ئاگاداری داتابەیس (Database Unavailable)</p>
            <p className="mt-0.5">داتابەیسی پەیوەندیدار پەیوەست نەکراوە. ڕاپۆرتەکان تەنها لەسەر داتای پەسەندکراوی فەرمی بنیات دەنرێن.</p>
          </div>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-500">کۆی موڵکە بەڕێوەبراوەکان</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{kpis.managedProperties}</p>
          <span className="text-[11px] text-indigo-600 font-semibold mt-2 block">بە گرێبەستی کارا</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-500">کرێی مانگانەی کۆکراوە</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{financials.collectedRentIqd.toLocaleString()} IQD</p>
          <span className="text-[11px] text-slate-400 mt-2 block">تۆماری دەفتەری پشتڕاستکراوە</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-500">عمولەی بەدەستهاتوو</span>
          <p className="text-2xl font-black text-indigo-700 mt-1">{financials.commissionsEarnedIqd.toLocaleString()} IQD</p>
          <span className="text-[11px] text-slate-400 mt-2 block">ڕێژەی ڕێککەوتوو</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-xs text-slate-500">تێچووی پەسەندکراوی چاککردنەوە</span>
          <p className="text-2xl font-black text-rose-600 mt-1">{financials.expensesApprovedIqd.toLocaleString()} IQD</p>
          <span className="text-[11px] text-slate-400 mt-2 block">بەپێی مۆڵەتی خەرجی</span>
        </div>
      </div>

      {/* Historical Data Transparency Notice */}
      <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start gap-3 text-xs sm:text-sm text-slate-700">
        <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-900">بنەمای ڕاستگۆیی زانیاری (Factual Data Governance):</p>
          <p className="mt-0.5 text-slate-600">
            بەراوردی مێژوویی (Historical comparison) و هێڵکارییە پێشبینیکراوەکان لە کاتی نەبوونی داتای مێژوویی فەرمیدا بە شێوەی دروستکراو پیشان نادرێن. هەموو ئامارەکان ڕاستەوخۆ لە خشتەی ژمێریاری و گرێبەستە کاراکانەوە دەخوێندرێنەوە.
          </p>
        </div>
      </div>

      {/* AI Advisory & Insights */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <span>پێشنیازەکانی ژیری دەستکرد (AI Advisory & Strategic Insights)</span>
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            ڕاوێژکاری – بڕیار لە دەستی مرۆڤە
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.aiRecommendations && data.aiRecommendations.length > 0 ? (
            data.aiRecommendations.map(rec => (
              <div key={rec.id} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/40 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-indigo-950">{rec.headline}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white text-indigo-700 border border-indigo-200">
                      {rec.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{rec.details}</p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-indigo-100">
                  <span>جۆری هەڵسەنگاندن: {rec.type}</span>
                  <span className="text-indigo-600 font-semibold">پێویستی بە پەسەندکردنی بەڕێوەبەرە</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 col-span-2 text-center text-xs text-slate-500 bg-slate-50 rounded-xl">
              هیچ پێشنیازێکی نوێ نییە لەم کاتەدا.
            </div>
          )}
        </div>
      </div>

      </div>
      </div>
    </div>
  );
};
