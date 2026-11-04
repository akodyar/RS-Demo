import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  Building,
  ShieldCheck,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';

export interface PointsPurchasePackage {
  id: string;
  name: string;
  points: number;
  price: string | number;
  currency: string;
  isActive: boolean;
  allowedRoles?: string[];
  description?: string;
}

export interface PointsPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseSuccess?: () => void;
}

function getPackageLocalizedName(pkg: PointsPurchasePackage, lang: string): string {
  const pts = Number(pkg.points);
  const lowerName = (pkg.name || '').toLowerCase();
  if (lang === 'ku') {
    if (pts === 5000 || pkg.id === 'PKG_POINTS_5000' || lowerName.includes('enterprise')) {
      return 'پاکێجی کۆمپانیا (٥،٠٠٠ خاڵ)';
    }
    if (pts === 2500 || pkg.id === 'PKG_POINTS_2500' || lowerName.includes('pro')) {
      return 'پاکێجی پرۆفیشناڵ (٢،٥٠٠ خاڵ)';
    }
    if (pts === 1000 || pkg.id === 'PKG_POINTS_1000' || lowerName.includes('standard')) {
      return 'پاکێجی ستاندارد (١،٠٠٠ خاڵ)';
    }
    if (pts === 500 || pkg.id === 'PKG_POINTS_500' || lowerName.includes('starter')) {
      if (lowerName.includes('audit')) {
        return 'پاکێجی ئۆدیتی خاڵ (٥٠٠ خاڵ)';
      }
      return 'پاکێجی سەرەتایی (٥٠٠ خاڵ)';
    }
    return pkg.name
      .replace(/Starter Pack/gi, 'پاکێجی سەرەتایی')
      .replace(/Standard Pack/gi, 'پاکێجی ستاندارد')
      .replace(/Pro Pack/gi, 'پاکێجی پرۆفیشناڵ')
      .replace(/Enterprise Pack/gi, 'پاکێجی کۆمپانیا')
      .replace(/Pack/gi, 'پاکێجی')
      .replace(/Package/gi, 'پاکێجی')
      .replace(/Points/gi, 'خاڵ')
      .replace(/pts/gi, 'خاڵ');
  }
  if (lang === 'ar') {
    if (pts === 5000 || pkg.id === 'PKG_POINTS_5000' || lowerName.includes('enterprise')) {
      return 'باقة الشركات (5,000 نقطة)';
    }
    if (pts === 2500 || pkg.id === 'PKG_POINTS_2500' || lowerName.includes('pro')) {
      return 'الباقة الاحترافية (2,500 نقطة)';
    }
    if (pts === 1000 || pkg.id === 'PKG_POINTS_1000' || lowerName.includes('standard')) {
      return 'الباقة القياسية (1,000 نقطة)';
    }
    if (pts === 500 || pkg.id === 'PKG_POINTS_500' || lowerName.includes('starter')) {
      if (lowerName.includes('audit')) {
        return 'باقة تدقيق النقاط (500 نقطة)';
      }
      return 'الباقة الأساسية (500 نقطة)';
    }
    return pkg.name;
  }
  return pkg.name;
}

function getPackageLocalizedDescription(pkg: PointsPurchasePackage, lang: string): string | undefined {
  if (!pkg.description) return undefined;
  const lower = pkg.description.toLowerCase();
  if (lang === 'ku') {
    if (lower.includes('small listings') || lower.includes('single promotions') || pkg.id === 'PKG_POINTS_500') {
      return 'پاکێجی سەرەتایی خاڵ بۆ موڵکە بچووکەکان و سپۆنسەری تاکەکەسی';
    }
    if (lower.includes('regular property') || lower.includes('marketing campaigns') || pkg.id === 'PKG_POINTS_1000') {
      return 'پاکێجی ستاندارد بۆ کەمپینەکانی بەبازاڕکردنی ئاسایی موڵک';
    }
    if (lower.includes('active brokers') || lower.includes('property managers') || pkg.id === 'PKG_POINTS_2500') {
      return 'پاکێجی قەبارە گەورە بۆ بریکارە چالاکەکان و بەڕێوەبەرانی موڵک';
    }
    if (lower.includes('agency') || lower.includes('enterprise') || pkg.id === 'PKG_POINTS_5000') {
      return 'پاکێجی تەواو بۆ ئاژانس و کۆمپانیاکانی خانووبەرە';
    }
    return pkg.description;
  }
  if (lang === 'ar') {
    if (lower.includes('small listings') || pkg.id === 'PKG_POINTS_500') {
      return 'باقة نقاط أساسية للعقارات الصغيرة والإعلانات الفردية';
    }
    if (lower.includes('regular property') || pkg.id === 'PKG_POINTS_1000') {
      return 'باقة قياسية لحملات التسويق العقاري المنتظمة';
    }
    if (lower.includes('active brokers') || pkg.id === 'PKG_POINTS_2500') {
      return 'باقة متقدمة للوسطاء النشطين ومديري العقارات';
    }
    if (lower.includes('agency') || pkg.id === 'PKG_POINTS_5000') {
      return 'باقة متكاملة لوكالات وشركات العقارات';
    }
    return pkg.description;
  }
  return pkg.description;
}

export const PointsPurchaseModal: React.FC<PointsPurchaseModalProps> = ({
  isOpen,
  onClose,
  onPurchaseSuccess,
}) => {
  const { direction, language } = useI18n();
  const { token, user } = useAuth();

  const [packages, setPackages] = useState<PointsPurchasePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCreatedOrder(null);
      setSubmitError(null);
      return;
    }

    const fetchPackages = async () => {
      if (packages.length === 0) {
        setLoading(true);
      }
      setFetchError(null);
      try {
        const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
        const res = await fetch('/api/points/packages', {
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to load points packages.');
        }
        const data = await res.json();
        const activePackages: PointsPurchasePackage[] = Array.isArray(data) ? data : [];
        setPackages(activePackages);
        if (activePackages.length > 0) {
          setSelectedPackageId(activePackages[0].id);
        }
      } catch (err: any) {
        setFetchError(err.message || 'Failed to load points packages.');
      } finally {
        setLoading(false);
      }
    };

    fetchPackages();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId) {
      setSubmitError(
        language === 'ku'
          ? 'تکایە پاکێجێکی خاڵ هەڵبژێرە.'
          : language === 'ar'
          ? 'يرجى اختيار باقة نقاط.'
          : 'Please select a points package.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null) || 'dev-owner';
      const idempotencyKey = `po_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch('/api/points/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          packageId: selectedPackageId,
          paymentMethod,
          paymentReference: paymentReference.trim() || undefined,
          idempotencyKey,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to initiate purchase order.');
      }

      setCreatedOrder(data.order);
      if (onPurchaseSuccess) {
        onPurchaseSuccess();
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to process purchase order.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      dir={direction}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        data-testid="points-purchase-modal"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {language === 'ku'
                  ? 'کڕینی خاڵی پلاتفۆرم'
                  : language === 'ar'
                  ? 'شراء نقاط المنصة'
                  : 'Purchase Platform Points'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'ku'
                  ? 'خاڵ بۆ ڕیکلامی تایبەت و سپۆنسەری موڵکەکان بەکاربهێنە'
                  : language === 'ar'
                  ? 'استخدم النقاط للإعلانات المميزة ورعاية العقارات'
                  : 'Use points for dedicated property promotions and sponsorships'}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-purchase-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs font-medium">
                {language === 'ku'
                  ? 'پاکێجە فەرمییەکان باردەکرێن...'
                  : language === 'ar'
                  ? 'جاري تحميل الباقات الرسمية...'
                  : 'Loading official packages...'}
              </p>
            </div>
          ) : fetchError ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {language === 'ku'
                    ? 'هەڵە لە بارکردنی پاکێجەکان'
                    : language === 'ar'
                    ? 'خطأ في تحميل الباقات'
                    : 'Error loading packages'}
                </p>
                <p className="mt-0.5">{fetchError}</p>
              </div>
            </div>
          ) : createdOrder ? (
            /* Order Created / Confirmation State */
            <div className="space-y-4 animate-in fade-in" data-testid="purchase-order-success">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm">
                    {language === 'ku'
                      ? 'داواکاری کڕین بە سەرکەوتوویی تۆمارکرا'
                      : language === 'ar'
                      ? 'تم تسجيل طلب الشراء بنجاح'
                      : 'Purchase Order Created Successfully'}
                  </span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  {language === 'ku'
                    ? 'داواکارییەکەت لە دۆخی چاوەڕوانی (PENDING) دایە تا پشتڕاستکردنەوەی وەرگرتنی پارە لەلایەن بەڕێوەبەرایەتی پلاتفۆرمەوە.'
                    : language === 'ar'
                    ? 'طلبك في حالة انتظار (PENDING) حتى يتم تأكيد استلام الدفعة بواسطة إدارة المنصة.'
                    : 'Your order is currently PENDING manual payment confirmation by the platform finance administration.'}
                </p>
              </div>

              {/* Order Reference Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'ژمارەی داواکاری:' : language === 'ar' ? 'رقم الطلب:' : 'Order ID:'}
                  </span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr" data-testid="order-id-display">
                    {createdOrder.id}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'خاڵەکان:' : language === 'ar' ? 'النقاط:' : 'Points:'}
                  </span>
                  <span className="font-bold text-amber-600 inline-flex items-center gap-1">
                    <span dir="ltr">+{Number(createdOrder.points).toLocaleString()}</span>
                    <span>{language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'بڕی پێویست:' : language === 'ar' ? 'المبلغ المطلوب:' : 'Amount Due:'}
                  </span>
                  <span className="font-bold text-slate-900 inline-flex items-center gap-1" dir="ltr">
                    <span>{Number(createdOrder.price).toLocaleString()}</span>
                    <span>{language === 'ku' ? 'د.ع' : language === 'ar' ? 'د.ع' : createdOrder.currency}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'دۆخی داواکاری:' : language === 'ar' ? 'حالة الطلب:' : 'Status:'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[11px]" data-testid="order-status-badge">
                    {createdOrder.status === 'PENDING'
                      ? (language === 'ku' ? 'لە چاوەڕوانیدا (PENDING)' : language === 'ar' ? 'قيد الانتظار (PENDING)' : 'PENDING')
                      : (createdOrder.status || 'PENDING')}
                  </span>
                </div>
              </div>

              {/* Manual Confirmation Instructions */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    {language === 'ku'
                      ? 'ڕێنمایی گواستنەوەی پارە'
                      : language === 'ar'
                      ? 'تعليمات التحويل المالي'
                      : 'Payment Instructions'}
                  </span>
                </div>
                <p className="text-blue-800 leading-relaxed">
                  {language === 'ku'
                    ? 'تکایە بڕی دیاریکراو بنێرە بە بەکارهێنانی ژمارەی داواکارییەکە وەک سەرچاوە (Reference). دوای پەسەندکردنی دارایی لەلایەن بەڕێوەبەرەوە، باڵانسی خاڵە کڕدراوەکانت ڕاستەوخۆ نوێ دەکرێتەوە.'
                    : language === 'ar'
                    ? 'يرجى تحويل المبلغ مع إرفاق رقم الطلب كمرجع. سيتم إضافة النقاط تلقائياً فور اعتماد الدفعة من قبل الإدارة المالية.'
                    : 'Please submit your transfer quoting your Order ID as the reference. Points will be automatically credited upon administrative verification.'}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="done-purchase-btn"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {language === 'ku' ? 'تەواو' : language === 'ar' ? 'تم' : 'Done'}
                </button>
              </div>
            </div>
          ) : packages.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs space-y-2">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="font-semibold text-slate-700">
                {language === 'ku'
                  ? 'لە ئێستادا هیچ پاکێجێکی کڕینی خاڵ چالاک نییە'
                  : language === 'ar'
                  ? 'لا توجد باقات شراء نقاط مفعلة حالياً'
                  : 'No points purchase packages are currently active.'}
              </p>
              <p className="text-slate-400 text-[11px]">
                {language === 'ku'
                  ? 'تکایە دواتر سەردانی بکەرەوە یاخود پەیوەندی بە بەڕێوەبەرایەتییەوە بکە.'
                  : language === 'ar'
                  ? 'يرجى المحاولة لاحقاً أو التواصل مع الإدارة.'
                  : 'Please check back later or contact platform administration.'}
              </p>
            </div>
          ) : (
            /* Purchase Package Selection & Submission Form */
            <form onSubmit={handleCreateOrder} className="space-y-4">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Package Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ku'
                    ? 'پاکێجی خاڵ هەڵبژێرە:'
                    : language === 'ar'
                    ? 'اختر باقة النقاط:'
                    : 'Select Points Package:'}
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {packages.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id;
                    const localizedName = getPackageLocalizedName(pkg, language);
                    const localizedDesc = getPackageLocalizedDescription(pkg, language);
                    return (
                      <div
                        key={pkg.id}
                        data-testid={`package-option-${pkg.id}`}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-xs ${
                              isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <Coins className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{localizedName}</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 inline-flex items-center gap-0.5"
                              >
                                <span dir="ltr">+{Number(pkg.points).toLocaleString()}</span>
                                <span>{language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}</span>
                              </span>
                            </div>
                            {localizedDesc && (
                              <p className="text-[11px] text-slate-500 mt-0.5">{localizedDesc}</p>
                            )}
                          </div>
                        </div>

                        <div className="text-end shrink-0">
                          <span className="font-extrabold text-sm text-slate-900 inline-flex items-center gap-1" dir="ltr">
                            <span>{Number(pkg.price).toLocaleString()}</span>
                            <span>{language === 'ku' ? 'د.ع' : language === 'ar' ? 'د.ع' : pkg.currency}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ku'
                    ? 'شێوازی پارەدان:'
                    : language === 'ar'
                    ? 'طريقة الدفع:'
                    : 'Payment Method:'}
                </label>
                <select
                  data-testid="payment-method-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="BANK_TRANSFER">
                    {language === 'ku' ? 'حەواڵەی بانکی (Bank Transfer)' : language === 'ar' ? 'تحويل مصرفي (Bank Transfer)' : 'Bank Transfer'}
                  </option>
                  <option value="FIB">
                    {language === 'ku' ? 'بانکی یەکەمی عێراقی (First Iraqi Bank - FIB)' : language === 'ar' ? 'المصرف العراقي الأول (FIB)' : 'First Iraqi Bank (FIB)'}
                  </option>
                  <option value="FASTPAY">
                    {language === 'ku' ? 'فاستپەی (FastPay)' : language === 'ar' ? 'فاست باي (FastPay)' : 'FastPay'}
                  </option>
                  <option value="ZAINCASH">
                    {language === 'ku' ? 'زەین کاش (ZainCash)' : language === 'ar' ? 'زين كاش (ZainCash)' : 'ZainCash'}
                  </option>
                  <option value="CASH">
                    {language === 'ku' ? 'پارەدانی کاش / دەستەودەست (Cash Deposit)' : language === 'ar' ? 'إيداع نقدي (Cash Deposit)' : 'Cash Deposit'}
                  </option>
                </select>
              </div>

              {/* Optional Payment Reference */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ku'
                    ? 'ژمارەی پسوولە یاخود سەرچاوەی حەواڵە (ئارەزوومەندانە):'
                    : language === 'ar'
                    ? 'رقم الوصل أو المرجع المالي (اختياري):'
                    : 'Payment Reference / Transaction ID (Optional):'}
                </label>
                <input
                  type="text"
                  data-testid="payment-reference-input"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder={
                    language === 'ku'
                      ? 'نموونە: FIB-TX-892109 یاخود پسوولەی کاش #104'
                      : language === 'ar'
                      ? 'مثال: FIB-TX-892109 أو إيصال النقد #104'
                      : 'e.g., FIB-TX-892109 or Cash Receipt #104'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Informational Policy Note */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {language === 'ku'
                    ? 'خاڵە کڕدراوەکان تەنها دوای پشتڕاستکردنەوەی دارایی فەرمی بەردەست دەبن. خاڵەکان ناگەڕێنرێنەوە و تەنها لەناو پلاتفۆرمی هۆمهەب بەکاردەهێنرێن.'
                    : language === 'ar'
                    ? 'تصبح النقاط المشتراة متاحة فقط بعد التأكيد المالي الرسمي. النقاط غير قابلة للاسترداد وتستخدم حصرياً داخل المنصة.'
                    : 'Purchased points become available exclusively upon verified administrative payment receipt. Points are non-refundable and strictly dedicated to HomeHub platform promotions.'}
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  data-testid="submit-purchase-order-btn"
                  disabled={submitting || !selectedPackageId}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {submitting
                      ? language === 'ku'
                        ? 'تۆمار دەکرێت...'
                        : language === 'ar'
                        ? 'جاري التسجيل...'
                        : 'Creating Order...'
                      : language === 'ku'
                      ? 'تۆمارکردنی داواکاریی کڕین'
                      : language === 'ar'
                      ? 'تسجيل طلب الشراء'
                      : 'Create Purchase Order'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
