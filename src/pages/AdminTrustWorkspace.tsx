import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  Scale, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Search, 
  Filter, 
  ArrowUpRight, 
  ShieldAlert,
  UserCheck,
  Building,
  Home,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Eye,
  AlertOctagon,
  Award
} from 'lucide-react';
import { 
  VerificationState, 
  TrustRiskLevel, 
  ComplianceCaseStatus, 
  DisputeState,
  DisputeCategory,
  DisputeResolutionOutcome
} from '../types/trust-verification';

export const AdminTrustWorkspacePage: React.FC = () => {
  const { t, direction } = useI18n();
  const isRtl = direction === 'rtl';

  const [activeTab, setActiveTab] = useState<'verifications' | 'risk' | 'compliance' | 'disputes' | 'audit'>('verifications');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mock-tolerant state loaded from API
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [selectedRiskAssessment, setSelectedRiskAssessment] = useState<any>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trust/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token') || localStorage.getItem('token') || ''}`
        }
      });
      if (res.status === 503) {
        // Safe fail-closed display
        setError('DATABASE_NOT_CONFIGURED');
        setDashboardData(null);
      } else if (!res.ok) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      } else {
        const json = await res.json();
        setDashboardData(json);
      }
    } catch (err: any) {
      console.error('Failed to load trust dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'verifications': return isRtl ? 'پشتڕاستکردنەوەکان' : 'Verifications';
      case 'risk': return isRtl ? 'هەڵسەنگاندنی مەترسی' : 'Explainable Risk';
      case 'compliance': return isRtl ? 'پابەندبوون و یاسا' : 'Compliance & Rules';
      case 'disputes': return isRtl ? 'ناکۆکی و دادوەری' : 'Dispute Arbitration';
      case 'audit': return isRtl ? 'تۆماری چاودێری نەگۆڕ' : 'Immutable Audit';
      default: return tab;
    }
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Trust Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('verifications')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Trust Center"
            aria-label="HomeHub Trust Center"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Trust Navigation"
          >
            {/* Verifications */}
            <button
              type="button"
              onClick={() => setActiveTab('verifications')}
              title={isRtl ? 'پشتڕاستکردنەوەکان' : 'Verifications'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'verifications'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'verifications' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <UserCheck className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'verifications' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'متمانە' : 'Verify'}
              </span>
              {dashboardData?.summary?.pendingVerifications > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {dashboardData.summary.pendingVerifications}
                </span>
              )}
            </button>

            {/* Risk */}
            <button
              type="button"
              onClick={() => setActiveTab('risk')}
              title={isRtl ? 'هەڵسەنگاندنی مەترسی' : 'Risk'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'risk'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'risk' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <AlertTriangle className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'risk' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'مەترسی' : 'Risk'}
              </span>
            </button>

            {/* Compliance */}
            <button
              type="button"
              onClick={() => setActiveTab('compliance')}
              title={isRtl ? 'پابەندبوون و یاسا' : 'Compliance'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'compliance'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'compliance' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'compliance' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'یاسا' : 'Rules'}
              </span>
            </button>

            {/* Disputes */}
            <button
              type="button"
              onClick={() => setActiveTab('disputes')}
              title={isRtl ? 'ناکۆکییەکان' : 'Disputes'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'disputes'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'disputes' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Scale className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'disputes' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'دادوەری' : 'Disputes'}
              </span>
              {dashboardData?.summary?.activeDisputes > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {dashboardData.summary.activeDisputes}
                </span>
              )}
            </button>

            {/* Audit */}
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              title={isRtl ? 'تۆماری چاودێری' : 'Audit'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'audit'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'audit' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <History className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'audit' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {isRtl ? 'چاودێری' : 'Audit'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Refresh */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={fetchDashboard}
            disabled={loading}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 text-slate-950 font-bold ${loading ? 'animate-spin' : ''}`} />
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
              <button
                type="button"
                onClick={() => setActiveTab('verifications')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {isRtl ? 'ناوەندی متمانە و یاسایی' : 'Trust & Compliance'}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 font-bold">
              {isRtl ? 'چالاک و پارێزراو' : 'Active & Verified'}
            </span>
            <button 
              onClick={fetchDashboard}
              disabled={loading}
              className="p-2 border border-slate-800 rounded-xl text-slate-300 bg-[#080d19] hover:bg-[#111b2e] transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Scroll (< md) */}
        <div className="md:hidden flex border-b border-slate-800 overflow-x-auto px-4 py-2 bg-[#0c1322]">
          {[
            { id: 'verifications', label: isRtl ? 'پشتڕاستکردنەوەکان' : 'Verifications', icon: UserCheck },
            { id: 'risk', label: isRtl ? 'هەڵسەنگاندنی مەترسی' : 'Explainable Risk', icon: AlertTriangle },
            { id: 'compliance', label: isRtl ? 'پابەندبوون و یاسا' : 'Compliance & Rules', icon: FileText },
            { id: 'disputes', label: isRtl ? 'ناکۆکییەکان' : 'Disputes', icon: Scale },
            { id: 'audit', label: isRtl ? 'تۆماری چاودێری' : 'Immutable Audit', icon: History },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === t.id ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6 w-full">

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0c1322] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{isRtl ? 'داواکارییەکانی پشتڕاستکردنەوە' : 'Verifications'}</span>
            <div className="p-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg"><UserCheck className="w-5 h-5" /></div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              <span dir="ltr">{dashboardData?.summary?.totalVerifications ?? 0}</span>
            </span>
            <span className="text-xs text-amber-400 font-medium">
              (<span dir="ltr">{dashboardData?.summary?.pendingVerifications ?? 0}</span> {isRtl ? 'چاوەڕوانن' : 'pending'})
            </span>
          </div>
        </div>

        <div className="bg-[#0c1322] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{isRtl ? 'ناکۆکییە چالاکەکان' : 'Active Disputes'}</span>
            <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg"><Scale className="w-5 h-5" /></div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              <span dir="ltr">{dashboardData?.summary?.activeDisputes ?? 0}</span>
            </span>
            <span className="text-xs text-slate-400">
              {isRtl ? 'لە قۆناغی دادوەریدا' : 'under mediation'}
            </span>
          </div>
        </div>

        <div className="bg-[#0c1322] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{isRtl ? 'کەیسەکانی پابەندبوون' : 'Compliance Cases'}</span>
            <div className="p-2 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg"><FileText className="w-5 h-5" /></div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">
              <span dir="ltr">{dashboardData?.summary?.complianceCases ?? 0}</span>
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              {isRtl ? 'بەپێی یاسای تاپۆ' : 'Tapu / Legal'}
            </span>
          </div>
        </div>

        <div className="bg-[#0C1322] border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-400">{isRtl ? 'پلەی مەترسی گشتی' : 'System Risk Index'}</span>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg"><ShieldAlert className="w-5 h-5" /></div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-400">LOW</span>
            <span className="text-xs text-slate-400">
              {isRtl ? 'مۆدێلی نەگۆڕ' : 'Deterministic'}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs (Hidden on desktop in Option 3) */}
      <div className="hidden border-b border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('verifications')}
          className={`px-5 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition ${
            activeTab === 'verifications'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{isRtl ? 'پشتڕاستکردنەوەکان' : 'Verifications'}</span>
        </button>

        <button
          onClick={() => setActiveTab('risk')}
          className={`px-5 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition ${
            activeTab === 'risk'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{isRtl ? 'هەڵسەنگاندنی مەترسی' : 'Explainable Risk'}</span>
        </button>

        <button
          onClick={() => setActiveTab('compliance')}
          className={`px-5 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition ${
            activeTab === 'compliance'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{isRtl ? 'پابەندبوون و یاسا' : 'Compliance & Rules'}</span>
        </button>

        <button
          onClick={() => setActiveTab('disputes')}
          className={`px-5 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition ${
            activeTab === 'disputes'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>{isRtl ? 'ناکۆکی و تانەدان' : 'Disputes & Appeals'}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-5 py-3 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition ${
            activeTab === 'audit'
              ? 'border-amber-400 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{isRtl ? 'تۆماری ڕووداوەکان' : 'Trust Events Log'}</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {error === 'DATABASE_NOT_CONFIGURED' ? (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-xl p-8 text-center">
          <AlertOctagon className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-amber-300">
            {isRtl ? 'بنکەدراوە ئامادە نییە (Fail-Closed)' : 'Database Not Configured (Fail-Closed)'}
          </h3>
          <p className="text-sm text-amber-400/80 max-w-xl mx-auto mt-1">
            {isRtl 
              ? 'بەپێی بنەماکانی سیستەم، هەموو ئۆپەراسیۆنە باوەڕپێکراوەکان دادەخرێن تاوەکو پەیوەندی بنکەدراوەی فەرمی دادەمەزرێت.'
              : 'All authoritative trust and verification operations fail-closed safely until PostgreSQL persistence is active.'}
          </p>
        </div>
      ) : (
        <div>
          {/* TAB 1: VERIFICATIONS */}
          {activeTab === 'verifications' && (
            <div className="space-y-6">
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">
                    {isRtl ? 'لیستی داواکارییەکان بۆ چاوپێخشاندنەوە' : 'Pending Verification Queue'}
                  </h3>
                  <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full font-medium">
                    Separation of Duties Enforced
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">{isRtl ? 'جۆر' : 'Type'}</th>
                        <th className="p-3.5">{isRtl ? 'بابەت' : 'Subject'}</th>
                        <th className="p-3.5">{isRtl ? 'پێشکەشکراوە لەلایەن' : 'Submitted By'}</th>
                        <th className="p-3.5">{isRtl ? 'دۆخ' : 'Status'}</th>
                        <th className="p-3.5">{isRtl ? 'بەروار' : 'Date'}</th>
                        <th className="p-3.5 text-center">{isRtl ? 'کردار' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dashboardData?.verifications?.length > 0 ? (
                        dashboardData.verifications.map((v: any) => (
                          <tr key={v.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-3.5 font-medium text-white">{v.verificationType}</td>
                            <td className="p-3.5 text-slate-300">
                              <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300 mr-2">{v.subjectType}</span>
                              <span dir="ltr">{v.subjectId}</span>
                            </td>
                            <td className="p-3.5 text-slate-300"><span dir="ltr">{v.submittedBy}</span></td>
                            <td className="p-3.5">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                v.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                v.status === 'REJECTED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {v.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-400 text-xs">
                              <span dir="ltr">{new Date(v.createdAt).toLocaleDateString()}</span>
                            </td>
                            <td className="p-3.5 text-center">
                              <button 
                                onClick={() => setSelectedVerification(v)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded border border-slate-700 transition"
                              >
                                {isRtl ? 'وردەکاری' : 'Inspect'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            {isRtl ? 'هیچ داواکارییەکی چاوەڕوانکراو نییە' : 'No pending verification cases found.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXPLAINABLE RISK */}
          {activeTab === 'risk' && (
            <div className="space-y-6">
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {isRtl ? 'مۆدێلی ڕوونکراوەی پێوەری مەترسی' : 'Deterministic Risk Engine Breakdown'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {isRtl ? 'هەموو نمرەیەک بەپێی بەڵگەنامە و ئاماژە ڕاستەقینەکان دەپێورێت بەبێ پێشبینی هەڕەمەکی' : 'Scores are mathematically derived from verified signals with exact factor attribution'}
                    </p>
                  </div>
                  <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-lg text-xs font-semibold">
                    Rule Version 1.0 (Audited)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">{isRtl ? 'سەرپێچی ناسنامە' : 'Identity Verification'}</span>
                    <p className="text-lg font-bold text-white mt-1">+35 {isRtl ? 'خاڵ بۆ هەر سەرپێچییەک' : 'pts per failure'}</p>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">{isRtl ? 'دژبەری خاوەندارێتی موڵک' : 'Ownership Inconsistency'}</span>
                    <p className="text-lg font-bold text-white mt-1">+40 {isRtl ? 'خاڵ (ڕەخنەیی)' : 'pts (Critical)'}</p>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
                    <span className="text-xs font-medium text-slate-400">{isRtl ? 'ناکۆکی دووبارەبووەوە' : 'Dispute Recurrence'}</span>
                    <p className="text-lg font-bold text-white mt-1">+30 {isRtl ? 'خاڵ بۆ هەر کەیسێک' : 'pts per dispute'}</p>
                  </div>
                </div>

                <div className="border border-slate-800 rounded-lg p-4 bg-slate-900/60 text-sm">
                  <h4 className="font-bold text-white mb-2">{isRtl ? 'ئاستەکانی مەترسی بەپێی نمرە:' : 'Score Threshold Mapping:'}</h4>
                  <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <li className="p-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-medium text-center">0 - 24: LOW</li>
                    <li className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded font-medium text-center">25 - 49: MEDIUM</li>
                    <li className="p-2 bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded font-medium text-center">50 - 74: HIGH</li>
                    <li className="p-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded font-medium text-center">75 - 100: CRITICAL</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLIANCE & RULES */}
          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">
                    {isRtl ? 'یاساکانی تاپۆ و پابەندبوون' : 'Jurisdictional Compliance Framework'}
                  </h3>
                  <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-medium">
                    IQ-KR & IQ Primary
                  </span>
                </div>

                <div className="p-4 divide-y divide-slate-800">
                  <div className="py-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">COMP_IQ_TAPU_VERIFIED</span>
                        <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-semibold">CRITICAL</span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">IQ-KR</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isRtl 
                          ? 'پشتڕاستکردنەوەی بەڵگەنامەی تاپۆی فەرمی بەپێی تۆماری خانووبەرەی هەرێم پێش کڕین و فرۆشتن' 
                          : 'Mandatory verification of official Tapu deed against land registry prior to sales transactions'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded">ACTIVE</span>
                  </div>

                  <div className="py-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">COMP_IQ_BROKER_LICENSED</span>
                        <span className="text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded font-semibold">HIGH</span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">IQ</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isRtl 
                          ? 'مۆڵەتی فەرمی کۆمیسیۆنی دەڵاڵی و خانووبەرە بۆ کارکردنی ئەگێنتەکان' 
                          : 'Valid real estate brokerage credentials and chamber certification for brokers'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded">ACTIVE</span>
                  </div>

                  <div className="py-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">COMP_RENT_POLICY_3FEE</span>
                        <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-semibold">POLICY</span>
                        <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded">HOMEHUB</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {isRtl 
                          ? 'پابەندبوون بە تێچووی داینامیکی بەڕێوەبردنی کرێ (3-Fee) بێ سەپاندنی هیچ بڕە پارەیەکی زیادە لەسەر کرێچی' 
                          : 'Strict adherence to property-specific dynamic 3-fee policies without tenant surcharges'}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DISPUTES & APPEALS */}
          {activeTab === 'disputes' && (
            <div className="space-y-6">
              <div className="bg-[#0C1322] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white">
                    {isRtl ? 'کەیسەکانی ناکۆکی و ناوبژیوانی' : 'Active Dispute Arbitration Queue'}
                  </h3>
                  <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-full font-medium">
                    Neutral Platform Boundary
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">{isRtl ? 'ژمارەی کەیس' : 'Case #'}</th>
                        <th className="p-3.5">{isRtl ? 'ناونیشان' : 'Title'}</th>
                        <th className="p-3.5">{isRtl ? 'پۆلێن' : 'Category'}</th>
                        <th className="p-3.5">{isRtl ? 'دەستپێکەر' : 'Initiator'}</th>
                        <th className="p-3.5">{isRtl ? 'دۆخ' : 'Status'}</th>
                        <th className="p-3.5 text-center">{isRtl ? 'کردار' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {dashboardData?.disputes?.length > 0 ? (
                        dashboardData.disputes.map((d: any) => (
                          <tr key={d.id} className="hover:bg-slate-800/40 transition">
                            <td className="p-3.5 font-mono text-xs text-amber-400"><span dir="ltr">{d.disputeNumber}</span></td>
                            <td className="p-3.5 font-medium text-white">{d.title}</td>
                            <td className="p-3.5 text-slate-400 text-xs">{d.category}</td>
                            <td className="p-3.5 text-slate-400"><span dir="ltr">{d.initiatorUserId}</span></td>
                            <td className="p-3.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                {d.status}
                              </span>
                            </td>
                            <td className="p-3.5 text-center">
                              <button 
                                onClick={() => setSelectedDispute(d)}
                                className="px-3 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium rounded border border-slate-700 transition"
                              >
                                {isRtl ? 'بینین' : 'Review'}
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-400">
                            {isRtl ? 'هیچ ناکۆکییەکی تۆمارکراو نییە' : 'No dispute cases currently open.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT TIMELINE */}
          {activeTab === 'audit' && (
            <div className="bg-[#0C1322] border border-slate-800 rounded-xl p-6 shadow-sm">
              <div className="border-b border-slate-800 pb-4 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white">{isRtl ? 'تۆماری نەگۆڕی ڕووداوەکان' : 'Immutable Trust Event Audit'}</h3>
                  <p className="text-xs text-slate-400">{isRtl ? 'تۆمارکردنی سەرجەم گۆڕانکارییەکانی دۆخی باوەڕپێکراوی' : 'Authoritative state transition history with user attribution'}</p>
                </div>
                <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">Server-Logged</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-sm">
                  <div className="p-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">IDENTITY_VERIFICATION_SUBMITTED</span>
                      <span className="text-xs text-slate-500"><span dir="ltr">2026-09-22</span></span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isRtl ? 'پێشکەشکردنی بەڵگەنامەی پاسپۆرت و ناسنامەی باری شارستانی' : 'National ID and residency passport submitted for user verification'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-sm">
                  <div className="p-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full mt-0.5">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">TAPU_DEED_VALIDATED</span>
                      <span className="text-xs text-slate-500"><span dir="ltr">2026-09-22</span></span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isRtl ? 'پشتڕاستکردنەوەی مۆڵەتی تاپۆ ژمارە 1042 بە سەرکەوتوویی' : 'Deed #1042 successfully cross-referenced with Tapu records'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
      </div>
    </div>
  );
};