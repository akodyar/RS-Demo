import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import {
  Building2,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  ShieldAlert,
  Loader2,
  Percent,
  LayoutDashboard,
  CreditCard,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { FinanceSettlementTab } from '../components/FinanceSettlementTab';
import { formatDate } from '../utils/formatters';

export const AccountantWorkspacePage: React.FC = () => {
  const { t, direction, language } = useI18n();
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Fee & Settlement Audit Tab State
  const [auditItems, setAuditItems] = useState<any[]>([]);
  const [auditSummary, setAuditSummary] = useState<any>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditStatusFilter, setAuditStatusFilter] = useState('ALL');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/financials/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Forbidden: Insufficient privileges for finance operations');
        if (res.status === 503) throw new Error('Finance service temporarily unavailable (Database not configured)');
        throw new Error('Failed to fetch financial data');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeeAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const queryParams = new URLSearchParams({
        page: String(auditPage),
        limit: '15',
      });
      if (auditStatusFilter !== 'ALL') queryParams.set('status', auditStatusFilter);
      if (auditSearch.trim()) queryParams.set('search', auditSearch.trim());

      const res = await fetch(`/api/financials/fee-audit?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 403) throw new Error('Forbidden: Insufficient privileges for finance operations');
        if (res.status === 503) throw new Error('Finance service temporarily unavailable (Database not configured)');
        throw new Error('Failed to fetch fee audit data');
      }

      const json = await res.json();
      if (Array.isArray(json.items)) {
        setAuditItems(json.items);
        setAuditSummary(json.summary);
        if (json.pagination) {
          setAuditTotalPages(json.pagination.totalPages || 1);
          setAuditTotalCount(json.pagination.total || json.items.length);
        }
      }
    } catch (err: any) {
      setAuditError(err.message);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditStatusFilter, auditSearch, token]);

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'fee-audit') {
      fetchFeeAudit();
    }
  }, [activeTab, fetchFeeAudit]);

  const tabs = [
    { id: 'dashboard', label: 'Financial Dashboard' },
    { id: 'fee-audit', label: 'وردبینی کرێ و شایستەکان (Fee & Settlement Audit)' },
    { id: 'ledger', label: 'General Ledger' },
    { id: 'receivables', label: 'Accounts Receivable' },
    { id: 'payables', label: 'Accounts Payable' },
    { id: 'settlements', label: 'Settlements & Payouts' },
  ];



  const getTabTitle = (tabId: string) => {
    switch (tabId) {
      case 'dashboard': return language === 'ku' ? 'داشبۆردی دارایی' : language === 'ar' ? 'لوحة المالية' : 'Financial Dashboard';
      case 'fee-audit': return language === 'ku' ? 'وردبینی کرێ و شایستەکان' : language === 'ar' ? 'تدقيق العمولات' : 'Fee Audit';
      case 'ledger': return language === 'ku' ? 'دەفتەری گشتی' : language === 'ar' ? 'دفتر الأستاذ' : 'General Ledger';
      case 'receivables': return language === 'ku' ? 'شایستە وەرگیراوەکان' : language === 'ar' ? 'المدينون' : 'Receivables';
      case 'payables': return language === 'ku' ? 'شایستە دراوەکان' : language === 'ar' ? 'الدائنون' : 'Payables';
      case 'settlements': return language === 'ku' ? 'تسویە و دابەشکردن' : language === 'ar' ? 'التسويات' : 'Settlements';
      default: return '';
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Accountant Workspace Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Finance Dashboard"
            aria-label="HomeHub Finance Dashboard"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Accountant Navigation"
          >
            {/* 1. Dashboard */}
            <button
              type="button"
              id="accountant-tab-dashboard"
              onClick={() => setActiveTab('dashboard')}
              title="Dashboard"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'dashboard' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <LayoutDashboard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'dashboard' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'داشبۆرد' : language === 'ar' ? 'اللوحة' : 'Dashboard'}
              </span>
            </button>

            {/* 2. Fee Audit */}
            <button
              type="button"
              id="accountant-tab-fee-audit"
              onClick={() => setActiveTab('fee-audit')}
              title="Fee Audit"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'fee-audit'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'fee-audit' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Percent className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'fee-audit' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'وردبینی' : language === 'ar' ? 'التدقيق' : 'Fee Audit'}
              </span>
            </button>

            {/* 3. Ledger */}
            <button
              type="button"
              id="accountant-tab-ledger"
              onClick={() => setActiveTab('ledger')}
              title="General Ledger"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'ledger'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'ledger' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'ledger' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'دەفتەر' : language === 'ar' ? 'الدفتر' : 'Ledger'}
              </span>
            </button>

            {/* 4. Receivables */}
            <button
              type="button"
              id="accountant-tab-receivables"
              onClick={() => setActiveTab('receivables')}
              title="Receivables"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'receivables'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'receivables' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <ArrowDownLeft className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'receivables' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'وەرگیراو' : language === 'ar' ? 'مدين' : 'Receivables'}
              </span>
            </button>

            {/* 5. Payables */}
            <button
              type="button"
              id="accountant-tab-payables"
              onClick={() => setActiveTab('payables')}
              title="Payables"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'payables'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'payables' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <ArrowUpRight className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'payables' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'دراوەکان' : language === 'ar' ? 'دائن' : 'Payables'}
              </span>
            </button>

            {/* 6. Settlements */}
            <button
              type="button"
              id="accountant-tab-settlements"
              onClick={() => setActiveTab('settlements')}
              title="Settlements"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'settlements'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'settlements' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CreditCard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'settlements' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'تسویە' : language === 'ar' ? 'التسوية' : 'Payouts'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Refresh Data */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'fee-audit') fetchFeeAudit();
              else fetchDashboard();
            }}
            disabled={loading || auditLoading}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Refresh Data"
            aria-label="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 text-slate-950 font-bold ${loading || auditLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Razor-Sharp Desktop & Mobile Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 lg:px-8 h-16 flex items-center justify-between gap-4 text-white">
          {/* Start: Mobile Brand Logo & Desktop Breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Mobile Brand Logo */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xs"
              >
                HH
              </button>
            </div>

            {/* Desktop Breadcrumbs & Active Title */}
            <div className="hidden md:flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {language === 'ku' ? 'شوێنی کاری دارایی و ژمێریاری' : language === 'ar' ? 'مساحة العمل المالية' : 'Finance Workspace'}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>

            {/* Live Financial KPI Pill */}
            {data?.metrics?.netIncome !== undefined && (
              <div className="hidden xl:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {language === 'ku' ? 'داهاتی سافی: ' : language === 'ar' ? 'صافي الدخل: ' : 'Net Income: '}
                  {Number(data.metrics.netIncome).toLocaleString()} IQD
                </span>
              </div>
            )}
          </div>

          {/* End Header Area */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (activeTab === 'fee-audit') fetchFeeAudit();
                else fetchDashboard();
              }}
              disabled={loading || auditLoading}
              className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition-colors cursor-pointer"
              title="نوێکردنەوە"
            >
              <RefreshCw className={`w-4 h-4 ${loading || auditLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Scroll (< md) */}
        <div className="md:hidden flex items-center gap-1 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 px-4 py-2.5 overflow-x-auto scrollbar-none sticky top-16 z-30 shadow-md">
          {tabs.map((tab) => (
            <button
              id={`accountant-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-[#0C1322] p-8 rounded-xl shadow-xl border border-slate-800 max-w-md mx-auto text-center my-4">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied / Unavailable</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-lg font-bold hover:brightness-110 transition cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}
        {/* ========================================================
            TAB 1: FINANCIAL DASHBOARD
           ======================================================== */}
        {activeTab === 'dashboard' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-[#0C1322] border border-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Revenue</h3>
                    <p className="text-2xl font-black text-white" dir="ltr">
                      {Number(data?.metrics?.totalRevenue || 0).toLocaleString()} IQD
                    </p>
                  </div>
                  <div className="bg-[#0C1322] border border-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-sm font-semibold text-slate-400 mb-2">Pending Receivables</h3>
                    <p className="text-2xl font-black text-amber-400" dir="ltr">
                      {Number(data?.metrics?.pendingReceivables || 0).toLocaleString()} IQD
                    </p>
                  </div>
                  <div className="bg-[#0C1322] border border-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-sm font-semibold text-slate-400 mb-2">Total Expenses</h3>
                    <p className="text-2xl font-black text-white" dir="ltr">
                      {Number(data?.metrics?.totalExpenses || 0).toLocaleString()} IQD
                    </p>
                  </div>
                  <div className="bg-[#0C1322] border border-slate-800 p-6 rounded-xl shadow-md">
                    <h3 className="text-sm font-semibold text-slate-400 mb-2">Net Income</h3>
                    <p className="text-2xl font-black text-emerald-400" dir="ltr">
                      {Number(data?.metrics?.netIncome || 0).toLocaleString()} IQD
                    </p>
                  </div>
                </div>

                {/* Recent Transactions Table */}
                <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md overflow-hidden">
                  <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Recent Payment Records</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-4">Date</th>
                          <th className="px-5 py-4">Reference</th>
                          <th className="px-5 py-4">Method</th>
                          <th className="px-5 py-4 text-right">Amount</th>
                          <th className="px-5 py-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {data?.recentTransactions?.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                              No recent transactions found.
                            </td>
                          </tr>
                        )}
                        {data?.recentTransactions?.map((txn: any) => (
                          <tr key={txn.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap text-slate-300">
                              {formatDate(txn.recordedDate || txn.date || txn.paymentDate || txn.createdAt, language)}
                            </td>
                            <td className="px-5 py-4 font-mono text-amber-400" dir="ltr">
                              {txn.referenceNumber || txn.id.substring(0, 8)}
                            </td>
                            <td className="px-5 py-4 text-slate-300">{txn.paymentMethod || 'BANK_TRANSFER'}</td>
                            <td className="px-5 py-4 font-medium text-right text-white" dir="ltr">
                              {Number(txn.amount).toLocaleString()} {txn.currency}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                  txn.status === 'CONFIRMED'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : txn.status === 'FAILED'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : txn.status === 'REVERSED'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {txn.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Journal Entries */}
                <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md overflow-hidden mt-6">
                  <div className="p-5 border-b border-slate-800">
                    <h2 className="text-lg font-bold text-white">Recent Journal Entries (Double-Entry)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead className="bg-slate-900/40 text-slate-400 font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-5 py-4">Date</th>
                          <th className="px-5 py-4">Description</th>
                          <th className="px-5 py-4">Status</th>
                          <th className="px-5 py-4">Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {data?.recentJournalEntries?.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                              No recent journal entries found.
                            </td>
                          </tr>
                        )}
                        {data?.recentJournalEntries?.map((je: any) => (
                          <tr key={je.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap text-slate-300">
                              {formatDate(je.date || je.recordedDate || je.createdAt, language)}
                            </td>
                            <td className="px-5 py-4 font-medium text-white">{je.description}</td>
                            <td className="px-5 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                {je.status}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-slate-400 font-mono" dir="ltr">
                              {je.referenceId || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ========================================================
            TAB 2: FEE & SETTLEMENT AUDIT (DEDICATED ACCOUNTANT VIEW)
           ======================================================== */}
        {activeTab === 'fee-audit' && (
          <div data-testid="accountant-fee-audit-view" className="space-y-6">
            {/* Header & Description */}
            <div className="bg-[#0C1322] p-5 rounded-2xl border border-slate-800 shadow-md space-y-1">
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Percent className="w-5 h-5 text-amber-400" />
                <span>وردبینی کرێ و شایستەکان (Authoritative Fee & Settlement Audit)</span>
              </h2>
              <p className="text-xs text-slate-400">
                پوختەی دارایی یاسایی بە جیاکردنەوەی هەرسێ ڕێژەکە (پلاتفۆڕم ٤٠١٠، کرێ ٤٠١١، بەڕێوەبردن ٤٠١٢) بەبێ ژماردنی دووبارە.
              </p>
            </div>

            {/* Audit Summary KPI Grid */}
            {auditSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-[#0C1322] border border-slate-800 p-4 rounded-xl shadow-md">
                  <span className="text-[11px] font-bold text-slate-400 block">کرێی وەرگیراوی پشتڕاستکراو</span>
                  <p className="text-lg font-black text-white mt-1 font-mono" dir="ltr">
                    {Number(auditSummary.totalCollectedRent || 0).toLocaleString()} IQD
                  </p>
                  <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">پشتڕاستکراو لە داتابەیس</span>
                </div>

                <div className="bg-[#0C1322] border border-slate-800 p-4 rounded-xl shadow-md">
                  <span className="text-[11px] font-bold text-slate-400 block">کرێی پلاتفۆڕم (٤٠١٠)</span>
                  <p className="text-lg font-black text-amber-400 mt-1 font-mono" dir="ltr">
                    {Number(auditSummary.totalPlatformFee || 0).toLocaleString()} IQD
                  </p>
                  <span className="text-[10px] text-amber-400/80 font-semibold block mt-0.5">داهاتی گشتی پلاتفۆڕم</span>
                </div>

                <div className="bg-[#0C1322] border border-slate-800 p-4 rounded-xl shadow-md">
                  <span className="text-[11px] font-bold text-slate-400 block">کرێی بەکرێدان و بەڕێوەبردن</span>
                  <p className="text-lg font-black text-purple-400 mt-1 font-mono" dir="ltr">
                    {(Number(auditSummary.totalRentFee || 0) + Number(auditSummary.totalManagementFee || 0)).toLocaleString()} IQD
                  </p>
                  <span className="text-[10px] text-purple-400 font-semibold block mt-0.5">٤٠١١ + ٤٠١٢</span>
                </div>

                <div className="bg-[#0C1322] border border-slate-800 p-4 rounded-xl shadow-md">
                  <span className="text-[11px] font-bold text-slate-400 block">کۆی بڕینەکان (Total Fees)</span>
                  <p className="text-lg font-black text-rose-400 mt-1 font-mono" dir="ltr">
                    {Number(auditSummary.totalDeductions || 0).toLocaleString()} IQD
                  </p>
                  <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">کۆی ٣ کرێیەکە</span>
                </div>

                <div className="bg-[#0C1322] border border-slate-800 p-4 rounded-xl shadow-md">
                  <span className="text-[11px] font-bold text-slate-400 block">پوختەی مافی خاوەن موڵک</span>
                  <p className="text-lg font-black text-emerald-400 mt-1 font-mono" dir="ltr">
                    {Number(auditSummary.totalOwnerNet || 0).toLocaleString()} IQD
                  </p>
                  <span className="text-[10px] text-emerald-400 font-semibold block mt-0.5">شایستەی خاوەن موڵک</span>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="bg-[#0C1322] p-3.5 rounded-2xl border border-slate-800 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="گەڕان بەپێی موڵک یان ژمارەی پسوولە..."
                  className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 font-bold shrink-0">دۆخی پارەدان:</span>
                <select
                  value={auditStatusFilter}
                  onChange={(e) => {
                    setAuditStatusFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="text-xs bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-bold cursor-pointer text-slate-200"
                >
                  <option value="ALL">هەموو دۆخەکان (All Statuses)</option>
                  <option value="CONFIRMED">پشتڕاستکراو (CONFIRMED)</option>
                  <option value="PENDING">چاوەڕوانکراو (PENDING)</option>
                  <option value="FAILED">شکستهێناو (FAILED)</option>
                  <option value="REVERSED">هەڵوەشێنراوە (REVERSED)</option>
                </select>
              </div>
            </div>

            {auditError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            {/* Authoritative Table */}
            <div className="bg-[#0C1322] border border-slate-800 rounded-2xl shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs text-slate-300">
                  <thead className="bg-slate-900/40 text-slate-400 font-bold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3.5 whitespace-nowrap">بەروار</th>
                      <th className="px-4 py-3.5">موڵک و پسوولە</th>
                      <th className="px-4 py-3.5">مۆدێلی کارکردن</th>
                      <th className="px-4 py-3.5 text-right">کرێی وەرگیراو</th>
                      <th className="px-4 py-3.5 text-right">پلاتفۆرم (٤٠١٠)</th>
                      <th className="px-4 py-3.5 text-right">کرێ (٤٠١١)</th>
                      <th className="px-4 py-3.5 text-right">بەڕێوەبردن (٤٠١٢)</th>
                      <th className="px-4 py-3.5 text-right">کۆی بڕینەکان</th>
                      <th className="px-4 py-3.5 text-right font-extrabold text-emerald-400">پوختەی خاوەن</th>
                      <th className="px-4 py-3.5 text-center">دۆخ و بنەما</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          <span>بارکردنی زانیارییەکانی وردبینی...</span>
                        </td>
                      </tr>
                    ) : auditItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                          هیچ تۆمارێکی پارەدان نەدۆزرایەوە.
                        </td>
                      </tr>
                    ) : (
                      auditItems.map((item) => (
                        <tr
                          key={item.id}
                          data-testid={`fee-audit-row-${item.id}`}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            item.isReversed ? 'bg-purple-950/20' : item.isPendingOrFailed ? 'bg-amber-950/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-400">
                            {item.paymentDate}
                          </td>
                          <td className="px-4 py-3">
                            <strong className="text-white block">{item.propertyName}</strong>
                            <span className="text-[10px] text-amber-400/90 font-mono">Ref: {item.referenceNumber}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700">
                              {item.operatingModel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-white" dir="ltr">
                            {item.status === 'CONFIRMED'
                              ? `${Number(item.collectedRent).toLocaleString()} ${item.currency}`
                              : '0 IQD'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-amber-400" dir="ltr">
                            {item.platformFeeAmount > 0
                              ? `${Number(item.platformFeeAmount).toLocaleString()}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-300" dir="ltr">
                            {item.rentFeeAmount > 0
                              ? `${Number(item.rentFeeAmount).toLocaleString()}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-purple-400" dir="ltr">
                            {item.managementFeeAmount > 0
                              ? `${Number(item.managementFeeAmount).toLocaleString()}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-400" dir="ltr">
                            {item.totalDeductions > 0
                              ? `${Number(item.totalDeductions).toLocaleString()}`
                              : '0'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-400" dir="ltr">
                            {item.status === 'CONFIRMED'
                              ? `${Number(item.ownerNetAmount).toLocaleString()} ${item.currency}`
                              : '0 IQD'}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                item.status === 'CONFIRMED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : item.status === 'REVERSED'
                                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                  : item.status === 'FAILED'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}
                            >
                              {item.status}
                            </span>
                            <span className="block text-[9px] text-slate-500 mt-0.5 font-mono">
                              {item.calculationBasis}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-3.5 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  پەڕەی <strong className="text-white font-bold">{auditPage}</strong> لە{' '}
                  <strong className="text-white font-bold">{auditTotalPages}</strong> (کۆی گشتی:{' '}
                  {auditTotalCount} تۆماری پارەدان)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={auditPage <= 1 || auditLoading}
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
                  >
                    پێشوو
                  </button>
                  <button
                    type="button"
                    disabled={auditPage >= auditTotalPages || auditLoading}
                    onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
                    className="px-3 py-1 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
                  >
                    دواتر
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            TAB 3: SETTLEMENTS & PAYOUTS
           ======================================================== */}
        {activeTab === 'settlements' && (
          <div className="bg-[#0C1322] border border-slate-800 rounded-xl shadow-md p-6">
            <FinanceSettlementTab />
          </div>
        )}
      </div>
      </div>
    </div>
  );
};