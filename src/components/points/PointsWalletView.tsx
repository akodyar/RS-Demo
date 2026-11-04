import React, { useState, useEffect } from 'react';
import {
  Coins,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ShieldCheck,
  Plus,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Lock,
  Layers,
  Tag,
  CreditCard,
  Gift,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';
import { PointsPurchaseModal } from './PointsPurchaseModal';

export interface WalletSummary {
  id: string;
  userId: string;
  earnedBalance: number;
  purchasedBalance: number;
  reservedEarnedBalance: number;
  reservedPurchasedBalance: number;
  availableEarned: number;
  availablePurchased: number;
  availableTotal: number;
  reservedTotal: number;
  totalBalance: number;
}

export interface PointsTransaction {
  id: string;
  walletId: string;
  userId: string;
  type: string;
  sourceType: string;
  amount: number;
  earnedDelta: number;
  purchasedDelta: number;
  reservedEarnedDelta: number;
  reservedPurchasedDelta: number;
  availableBalanceAfter: number;
  totalBalanceAfter: number;
  referenceType: string;
  referenceId: string;
  notes?: string | null;
  createdAt: string;
}

export const PointsWalletView: React.FC = () => {
  const { direction, language } = useI18n();
  const { token, user } = useAuth();

  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  const fetchWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const res = await fetch('/api/points/wallet', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to fetch points wallet.');
      }
      const data = await res.json();
      setWallet(data.wallet || null);
      setTransactions(Array.isArray(data.transactions) ? data.transactions : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [token]);

  const filteredTransactions = transactions.filter((tx) => {
    if (filter === 'ALL') return true;
    if (filter === 'EARNED') return tx.sourceType === 'EARNED' || tx.type.includes('EARNED') || tx.type.includes('REWARD');
    if (filter === 'PURCHASED') return tx.sourceType === 'PURCHASED' || tx.type.includes('PURCHASE');
    if (filter === 'RESERVED') return tx.type.includes('RESERVE');
    if (filter === 'SPENT') return tx.type.includes('SPENT');
    return true;
  });

  const formatTxTypeLabel = (type: string) => {
    const map: Record<string, { ku: string; ar: string; en: string }> = {
      EARNED_REWARD: { ku: 'پاداشتی بەدەستهاتوو', ar: 'مكافأة مكتسبة', en: 'Reward Earned' },
      POINTS_PURCHASED: { ku: 'خاڵی کڕدراو', ar: 'نقاط مشتراة', en: 'Points Purchased' },
      POINTS_RESERVED: { ku: 'خاڵی پارێزراو', ar: 'نقاط محجوزة', en: 'Points Reserved' },
      POINTS_RELEASED: { ku: 'گەڕاندنەوەی خاڵ', ar: 'إلغاء حجز النقاط', en: 'Points Released' },
      POINTS_SPENT: { ku: 'خاڵی بەکارهاتوو', ar: 'نقاط مستهلكة', en: 'Points Spent' },
      ADMIN_CREDIT: { ku: 'زیادکردنی کارگێڕی', ar: 'إيداع إداري', en: 'Admin Credit' },
      ADMIN_DEBIT: { ku: 'کەمکردنەوەی کارگێڕی', ar: 'خصم إداري', en: 'Admin Debit' },
    };
    const item = map[type];
    if (item) return item[language] || item.en;
    return type.replace(/_/g, ' ');
  };

  const formatTxDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(language === 'ku' ? 'ckb-IQ' : language === 'ar' ? 'ar-IQ' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6" dir={direction} data-testid="points-wallet-view">
      {/* 1. Header & Actions */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center shadow-2xs">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>
                {language === 'ku'
                  ? 'جزدانی خاڵ و پاداشتەکان'
                  : language === 'ar'
                  ? 'محفظة النقاط والمكافآت'
                  : 'Points & Rewards Wallet'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                {language === 'ku' ? 'خاڵەکانی هۆمهەب' : language === 'ar' ? 'نقاط المنصة' : 'HomeHub Points'}
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'ku'
                ? 'بەڕێوەبردنی باڵانسی خاڵی کڕدراو، پاداشتی پەیداکراو، و خەرجی ڕیکلامی موڵک'
                : language === 'ar'
                ? 'إدارة رصيد النقاط المشتراة والمكافآت المكتسبة وتكاليف ترويج العقارات'
                : 'Manage your purchased points, earned rewards, and property promotion balance'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchWallet}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            data-testid="purchase-points-btn"
            onClick={() => setIsPurchaseModalOpen(true)}
            className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>
              {language === 'ku'
                ? 'کڕینی خاڵ'
                : language === 'ar'
                ? 'شراء نقاط'
                : 'Purchase Points'}
            </span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchWallet}
            className="text-xs font-bold underline hover:no-underline cursor-pointer"
          >
            {language === 'ku' ? 'دووبارە هەوڵبدەرەوە' : language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      )}

      {/* 2. Wallet Balance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Usable Balance */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between opacity-90 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">
                {language === 'ku'
                  ? 'کۆی باڵانسی بەردەست'
                  : language === 'ar'
                  ? 'إجمالي الرصيد المتاح'
                  : 'Total Usable Balance'}
              </span>
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="text-3xl font-black mt-2 tracking-tight" dir="ltr" data-testid="wallet-available-total">
              {loading ? '...' : (wallet?.availableTotal ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] opacity-80 mt-1">
              {language === 'ku' ? 'خاڵی بەردەست بۆ سپۆنسەری موڵک' : language === 'ar' ? 'نقاط متاحة لترويج العقارات' : 'Available for property promotions'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] font-medium">
            <span>{language === 'ku' ? 'کۆی گشتی باڵانس:' : language === 'ar' ? 'الرصيد الإجمالي:' : 'Total balance:'}</span>
            <span dir="ltr" className="font-bold">
              {(wallet?.totalBalance ?? 0).toLocaleString()} {language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}
            </span>
          </div>
        </div>

        {/* Card 2: Purchased Points Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">
                {language === 'ku'
                  ? 'خاڵی کڕدراو'
                  : language === 'ar'
                  ? 'النقاط المشتراة'
                  : 'Purchased Points'}
              </span>
              <CreditCard className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2" dir="ltr" data-testid="wallet-purchased-balance">
              {loading ? '...' : (wallet?.availablePurchased ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {language === 'ku'
                ? `لە کۆی ${(wallet?.purchasedBalance ?? 0).toLocaleString()} کڕدراو`
                : language === 'ar'
                ? `من أصل ${(wallet?.purchasedBalance ?? 0).toLocaleString()} تم شراؤها`
                : `From ${(wallet?.purchasedBalance ?? 0).toLocaleString()} purchased`}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{language === 'ku' ? 'پارێزراو بۆ داواکاری:' : language === 'ar' ? 'محجوز للطلبات:' : 'Reserved in active bids:'}</span>
            <span dir="ltr" className="font-bold text-amber-600">
              {(wallet?.reservedPurchasedBalance ?? 0).toLocaleString()} {language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}
            </span>
          </div>
        </div>

        {/* Card 3: Earned Rewards Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">
                {language === 'ku'
                  ? 'پاداشتی پەیداکراو'
                  : language === 'ar'
                  ? 'المكافآت المكتسبة'
                  : 'Earned Rewards'}
              </span>
              <Gift className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2" dir="ltr" data-testid="wallet-earned-balance">
              {loading ? '...' : (wallet?.availableEarned ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {language === 'ku'
                ? `لە کۆی ${(wallet?.earnedBalance ?? 0).toLocaleString()} بەدەستهاتوو`
                : language === 'ar'
                ? `من أصل ${(wallet?.earnedBalance ?? 0).toLocaleString()} تم اكتسابها`
                : `From ${(wallet?.earnedBalance ?? 0).toLocaleString()} earned`}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{language === 'ku' ? 'پارێزراوی پاداشت:' : language === 'ar' ? 'محجوز من المكافأة:' : 'Reserved rewards:'}</span>
            <span dir="ltr" className="font-bold text-amber-600">
              {(wallet?.reservedEarnedBalance ?? 0).toLocaleString()} {language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}
            </span>
          </div>
        </div>

        {/* Card 4: Reserved for Campaigns */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">
                {language === 'ku'
                  ? 'خاڵی پارێزراو'
                  : language === 'ar'
                  ? 'النقاط المحجوزة'
                  : 'Reserved Points'}
              </span>
              <Lock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-amber-600 mt-2" dir="ltr" data-testid="wallet-reserved-total">
              {loading ? '...' : (wallet?.reservedTotal ?? 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {language === 'ku'
                ? 'پارێزراو بۆ کەمپینی چاوەڕوانی پەسەندکردن'
                : language === 'ar'
                ? 'محجوز لحملات في انتظار الموافقة'
                : 'Locked for campaigns awaiting approval'}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>{language === 'ku' ? 'دۆخ:' : language === 'ar' ? 'الحالة:' : 'Status:'}</span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
              {language === 'ku' ? 'پارێزراوی ئۆتۆماتیکی' : language === 'ar' ? 'حجز تلقائي آمن' : 'Atomic Protection'}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Rewards Earning Guide & Rules */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-900">
              {language === 'ku'
                ? 'چۆن خاڵی پاداشت بەدەستبهێنم؟'
                : language === 'ar'
                ? 'كيف تكسب نقاط المكافآت؟'
                : 'How to earn reward points?'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              {language === 'ku'
                ? 'پاداشت دەبەخشرێت لەگەڵ چالاکییەکانی وەک تۆمارکردنی یەکەمین موڵک، پشتڕاستکردنەوەی هەژمار، یاخود پێدانی ڕێکی کرێ. خاڵە پەیداکراوەکان هاوتای خاڵی کڕدراون بۆ ڕیکلامی موڵکەکانت.'
                : language === 'ar'
                ? 'تُمنح المكافآت مع الأنشطة الرسمية مثل إدراج العقار الأول وتوثيق الحساب ودفع الإيجار المنتظم. تعمل نقاط المكافآت كمعادل للنقاط المشتراة لترويج عقاراتك.'
                : 'Reward points are granted for verified platform milestones, such as initial property listings and verified profiles. Earned points function identically to purchased points for advertising.'}
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-white px-3 py-1.5 rounded-xl border border-blue-100 shadow-2xs">
          <ShieldCheck className="w-4 h-4" />
          <span>
            {language === 'ku' ? 'میکانیزمی فەرمی' : language === 'ar' ? 'نظام موثق' : 'Server Authoritative'}
          </span>
        </div>
      </div>

      {/* 4. Ledger Transaction History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Header & Filter Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              {language === 'ku'
                ? 'تۆماری مێژووی خاڵەکان (Ledger)'
                : language === 'ar'
                ? 'سجل المعاملات والعمليات'
                : 'Points Ledger History'}
            </h3>
            <p className="text-[11px] text-slate-500">
              {language === 'ku'
                ? 'تۆماری تەواو و پارێزراوی هەموو هاتن و چوونەکانی خاڵ'
                : language === 'ar'
                ? 'سجل غير قابل للتعديل لكافة حركات وإيداعات النقاط'
                : 'Immutable record of all points credits, debits, reservations, and releases'}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: language === 'ku' ? 'هەموو' : language === 'ar' ? 'الكل' : 'All' },
              { id: 'PURCHASED', label: language === 'ku' ? 'کڕدراو' : language === 'ar' ? 'مشتراة' : 'Purchased' },
              { id: 'EARNED', label: language === 'ku' ? 'پاداشت' : language === 'ar' ? 'مكافأة' : 'Rewards' },
              { id: 'RESERVED', label: language === 'ku' ? 'پارێزراو' : language === 'ar' ? 'محجوزة' : 'Reserved' },
              { id: 'SPENT', label: language === 'ku' ? 'خەرجکراو' : language === 'ar' ? 'مستهلكة' : 'Spent' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                data-testid={`tx-filter-${f.id.toLowerCase()}`}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                  filter === f.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table / List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
            <p className="text-xs">
              {language === 'ku' ? 'مێژووی خاڵەکان باردەکرێت...' : language === 'ar' ? 'جاري تحميل المعاملات...' : 'Loading transaction ledger...'}
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2" data-testid="no-transactions-placeholder">
            <Clock className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-semibold text-xs text-slate-700">
              {language === 'ku'
                ? 'هیچ تۆمارێکی خاڵ نەدۆزرایەوە'
                : language === 'ar'
                ? 'لا توجد معاملات نقاط مطابقة'
                : 'No points transactions found.'}
            </p>
            <p className="text-[11px] text-slate-400">
              {language === 'ku'
                ? 'خاڵی کڕدراو یاخود پاداشتەکان لێرەدا دەردەکەون.'
                : language === 'ar'
                ? 'ستظهر النقاط المشتراة أو المكافآت الممنوحة هنا.'
                : 'Purchased points and earned rewards will be tracked here.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const isCredit = (tx.earnedDelta > 0 || tx.purchasedDelta > 0) && tx.amount > 0;
              const isDebit = tx.amount > 0 && (tx.type.includes('SPENT') || tx.type.includes('DEBIT'));
              const isReserved = tx.type.includes('RESERVE');

              return (
                <div
                  key={tx.id}
                  data-testid={`tx-row-${tx.id}`}
                  className="p-4 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit
                          ? 'bg-emerald-100 text-emerald-700'
                          : isReserved
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : isReserved ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{formatTxTypeLabel(tx.type)}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            tx.sourceType === 'EARNED'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {tx.sourceType === 'EARNED'
                            ? (language === 'ku' ? 'پاداشت' : language === 'ar' ? 'مكافأة' : 'EARNED')
                            : tx.sourceType === 'PURCHASED'
                            ? (language === 'ku' ? 'کڕدراو' : language === 'ar' ? 'مشتراة' : 'PURCHASED')
                            : (language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقاط' : tx.sourceType || 'POINTS')}
                        </span>
                      </div>
                      {tx.notes && <p className="text-[11px] text-slate-500 mt-0.5">{tx.notes}</p>}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span>{formatTxDate(tx.createdAt)}</span>
                        {tx.referenceId && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Ref: {tx.referenceId.slice(0, 8)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-end shrink-0 sm:self-center">
                    <div
                      className={`text-sm font-black ${
                        isCredit
                          ? 'text-emerald-600'
                          : isReserved
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}
                      dir="ltr"
                    >
                      {isCredit ? '+' : isDebit ? '-' : ''}
                      {Number(tx.amount).toLocaleString()} pts
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5" dir="ltr">
                      Bal after: {Number(tx.availableBalanceAfter).toLocaleString()} pts
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Points Purchase Modal Integration */}
      <PointsPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseSuccess={() => {
          fetchWallet();
        }}
      />
    </div>
  );
};
