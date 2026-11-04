import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Home,
  Search,
  Layers,
  Coins,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Plus,
  Info,
  Lock,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';
import { PointsPurchaseModal } from '../points/PointsPurchaseModal';

export interface PromotionPackage {
  id: string;
  type: string; // 'HOME_FEATURED', 'SPONSORED_SEARCH', 'MULTI_PAGE'
  name: string;
  pointsCost: number;
  durationDays: number;
  placementScope: string[];
  isActive: boolean;
  version: number;
  description?: string;
}

export interface PromotePropertyModalProps {
  isOpen: boolean;
  propertyId: string;
  propertyName?: string;
  listingId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

function getPromoPackageLocalizedName(pkg: PromotionPackage, lang: string): string {
  const lower = (pkg.name || '').toLowerCase();
  if (lang === 'ku') {
    if (pkg.id === 'PKG_HOME_FEATURED' || lower.includes('home featured') || pkg.type === 'HOME_FEATURED') {
      return `سپۆنسەری سەرەکی (${pkg.durationDays} ڕۆژ)`;
    }
    if (pkg.id === 'PKG_SPONSORED_SEARCH' || lower.includes('sponsored search') || pkg.type === 'SPONSORED_SEARCH') {
      return `گەڕانی سپۆنسەرکراو (${pkg.durationDays} ڕۆژ)`;
    }
    if (pkg.id === 'PKG_MULTI_PAGE' || lower.includes('multi-page') || pkg.type === 'MULTI_PAGE') {
      return `دەرکەوتن لە هەموو پەڕەکان (${pkg.durationDays} ڕۆژ)`;
    }
    return pkg.name;
  }
  if (lang === 'ar') {
    if (pkg.id === 'PKG_HOME_FEATURED' || lower.includes('home featured') || pkg.type === 'HOME_FEATURED') {
      return `المميز في الرئيسية (${pkg.durationDays} يوم)`;
    }
    if (pkg.id === 'PKG_SPONSORED_SEARCH' || lower.includes('sponsored search') || pkg.type === 'SPONSORED_SEARCH') {
      return `البحث المروج (${pkg.durationDays} يوم)`;
    }
    if (pkg.id === 'PKG_MULTI_PAGE' || lower.includes('multi-page') || pkg.type === 'MULTI_PAGE') {
      return `الظهور في كافة الصفحات (${pkg.durationDays} يوم)`;
    }
    return pkg.name;
  }
  return pkg.name;
}

function getPromoPackageLocalizedDesc(pkg: PromotionPackage, lang: string): string {
  if (lang === 'ku') {
    if (pkg.type === 'HOME_FEATURED') {
      return 'دەرکەوتنی تایبەت لە بەشی سەرەکی و یەکەمی ماڵپەڕ بۆ هەموو سەردانکەران';
    }
    if (pkg.type === 'SPONSORED_SEARCH') {
      return 'دەرکەوتن لە سەرووی هەموو ئەنجامەکانی گەڕان بۆ بەکرێگرتنی موڵک';
    }
    if (pkg.type === 'MULTI_PAGE') {
      return 'دەرکەوتنی بەردەوام لە پەڕەی سەرەکی، ئەنجامەکانی گەڕان، و وردەکاری موڵکە هاوشێوەکان';
    }
    return pkg.description || 'کەمپینی سپۆنسەری تایبەتی پلاتفۆرم';
  }
  if (lang === 'ar') {
    if (pkg.type === 'HOME_FEATURED') {
      return 'ظهور بارز في القسم الأول من الصفحة الرئيسية لكافة الزوار';
    }
    if (pkg.type === 'SPONSORED_SEARCH') {
      return 'ظهور في أعلى نتائج البحث الخاصة باستئجار العقارات';
    }
    if (pkg.type === 'MULTI_PAGE') {
      return 'ظهور شامل في الصفحة الرئيسية ونتائج البحث وصفحات التفاصيل';
    }
    return pkg.description || 'حملة ترويجية موثقة للمنصة';
  }
  return pkg.description || `Dedicated campaign across ${pkg.placementScope.join(' & ')}`;
}

export const PromotePropertyModal: React.FC<PromotePropertyModalProps> = ({
  isOpen,
  propertyId,
  propertyName,
  listingId,
  onClose,
  onSuccess,
}) => {
  const { direction, language } = useI18n();
  const { token, user } = useAuth();

  const [packages, setPackages] = useState<PromotionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userWallet, setUserWallet] = useState<any | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [resolvedListingId, setResolvedListingId] = useState<string | null>(listingId || null);
  const [listingLoading, setListingLoading] = useState(true);
  const [listingError, setListingError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdCampaign, setCreatedCampaign] = useState<any | null>(null);

  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // Fetch packages, wallet, and listing details
  const loadModalData = async () => {
    if (!isOpen || !propertyId) return;

    setLoading(true);
    setWalletLoading(true);
    setListingLoading(true);
    setError(null);
    setSubmitError(null);
    setCreatedCampaign(null);

    // 1. Fetch eligible promotion packages
    try {
      const resPkgs = await fetch('/api/promotions/packages');
      if (resPkgs.ok) {
        const pkgsData = await resPkgs.json();
        const activeList = Array.isArray(pkgsData) ? pkgsData : [];
        setPackages(activeList);
        if (activeList.length > 0 && !selectedPackageId) {
          setSelectedPackageId(activeList[0].id);
        }
      } else {
        throw new Error('Failed to load eligible promotion packages.');
      }
    } catch (e: any) {
      setError(e.message || 'Error fetching promotion packages.');
    } finally {
      setLoading(false);
    }

    // 2. Fetch user wallet
    try {
      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const resWallet = await fetch('/api/points/wallet', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (resWallet.ok) {
        const wData = await resWallet.json();
        setUserWallet(wData.wallet || null);
      }
    } catch (e) {
      console.warn('Could not fetch wallet in promote modal:', e);
    } finally {
      setWalletLoading(false);
    }

    // 3. Resolve listing associated with property
    if (listingId) {
      setResolvedListingId(listingId);
      setListingLoading(false);
    } else if (typeof window !== 'undefined' && (window as any).__TEST_LISTING_ID__) {
      setResolvedListingId((window as any).__TEST_LISTING_ID__);
      setListingLoading(false);
    } else {
      try {
        const resMarket = await fetch('/api/marketplace/listings/search?type=FOR_RENT&limit=100');
        if (resMarket.ok) {
          const mData = await resMarket.json();
          const items = Array.isArray(mData.items) ? mData.items : Array.isArray(mData) ? mData : [];
          const found = items.find(
            (l: any) => l.propertyId === propertyId || l.property?.id === propertyId
          );
          if (found) {
            setResolvedListingId(found.id);
          }
        }
      } catch (e) {
        console.warn('Listing lookup warning:', e);
      } finally {
        setListingLoading(false);
      }
    }
  };

  useEffect(() => {
    loadModalData();
  }, [isOpen, propertyId, token]);

  if (!isOpen) return null;

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const availablePoints = Number(userWallet?.availableTotal ?? 0);
  const pointsCost = selectedPkg ? Number(selectedPkg.pointsCost) : 0;
  const hasSufficientPoints = availablePoints >= pointsCost;

  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageId) return;

    if (!hasSufficientPoints) {
      setSubmitError(
        language === 'ku'
          ? 'باڵانسی خاڵەکانت بەشی ئەم پاکێجە ناکات. تکایە سەرەتا خاڵ بکڕە.'
          : language === 'ar'
          ? 'رصيد نقاطك غير كافٍ لهذه الباقة. يرجى شراء نقاط أولاً.'
          : 'Insufficient points balance for this package. Please purchase points first.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const targetListingId = resolvedListingId || listingId;
      if (!targetListingId) {
        throw new Error(
          language === 'ku'
            ? 'هیچ ڕیکلامێکی کرێی بڵاوکراوە بۆ ئەم موڵکە نەدۆزرایەوە. پێویستە سەرەتا ڕیکلامی کرێ چالاک بێت.'
            : language === 'ar'
            ? 'لم يتم العثور على إعلان إيجار منشور لهذا العقار. يلزم وجود إعلان إيجار نشط أولاً.'
            : 'No published rental listing found for this property. An active rental listing is required to launch a promotion campaign.'
        );
      }

      const activeToken = token || (typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('homehub_auth_token')) : null);
      const draftRes = await fetch('/api/promotions/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          listingId: targetListingId,
          packageId: selectedPackageId,
        }),
      });

      const draftData = await draftRes.json().catch(() => ({}));
      if (!draftRes.ok) {
        throw new Error(draftData.message || draftData.error || 'Failed to create promotion campaign draft.');
      }

      const campaignId = draftData.id;

      // Step 2: Submit campaign & reserve points atomically
      const submitRes = await fetch(`/api/promotions/campaigns/${campaignId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          idempotencyKey: `submit_cmp_${campaignId}_${Date.now()}`,
        }),
      });

      const submitData = await submitRes.json().catch(() => ({}));
      if (!submitRes.ok) {
        throw new Error(submitData.message || submitData.error || 'Failed to submit campaign reservation.');
      }

      setCreatedCampaign(submitData.campaign || draftData);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Error executing property promotion.');
    } finally {
      setSubmitting(false);
    }
  };

  const getPlacementIcon = (type: string) => {
    switch (type) {
      case 'HOME_FEATURED':
        return <Home className="w-5 h-5 text-amber-500" />;
      case 'SPONSORED_SEARCH':
        return <Search className="w-5 h-5 text-blue-500" />;
      case 'MULTI_PAGE':
      default:
        return <Layers className="w-5 h-5 text-purple-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
      dir={direction}
    >
      <div
        className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        data-testid="promote-property-modal"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-transparent border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <span>
                  {language === 'ku'
                    ? 'سپۆنسەرکردن و ڕیکلامی موڵک'
                    : language === 'ar'
                    ? 'ترويج ورعاية العقار'
                    : 'Promote & Sponsor Property'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                  Rental Only
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {propertyName ? `${propertyName} (${propertyId.slice(0, 8)})` : propertyId}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-promote-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <p className="text-xs font-medium">
                {language === 'ku'
                  ? 'پاکێجە فەرمییەکانی ڕیکلام باردەکرێن...'
                  : language === 'ar'
                  ? 'جاري تحميل باقات الترويج...'
                  : 'Loading promotion packages...'}
              </p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : createdCampaign ? (
            /* Success State */
            <div className="space-y-4 animate-in fade-in" data-testid="campaign-submission-success">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-bold text-sm">
                    {language === 'ku'
                      ? 'داواکاری ڕیکلام بە سەرکەوتوویی تۆمارکرا'
                      : language === 'ar'
                      ? 'تم تسجيل طلب الترويج بنجاح'
                      : 'Promotion Campaign Submitted'}
                  </span>
                </div>
                <p className="text-emerald-800 leading-relaxed">
                  {language === 'ku'
                    ? 'خاڵە پێویستەکان بە شێوەیەکی پارێزراو (Reserved) گیران. کەمپینەکەت دوای پێداچوونەوە و پەسەندکردنی کارگێڕی چالاک دەبێت.'
                    : language === 'ar'
                    ? 'تم حجز النقاط المطلوبة بأمان. سيتم تفعيل حملتك الإعلانية فور المراجعة والاعتماد الإداري.'
                    : 'The required points were atomically reserved. Your campaign will go live upon administrative review and approval.'}
                </p>
              </div>

              {/* Details card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'ژمارەی کەمپین:' : language === 'ar' ? 'رقم الحملة:' : 'Campaign ID:'}
                  </span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr" data-testid="campaign-id-display">
                    {createdCampaign.id}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'شوێنی دەرکەوتن:' : language === 'ar' ? 'مكان الظهور:' : 'Placement:'}
                  </span>
                  <span className="font-bold text-purple-700">
                    {createdCampaign.campaignType === 'HOME_FEATURED'
                      ? (language === 'ku' ? 'پەڕەی سەرەکی (Featured)' : language === 'ar' ? 'الصفحة الرئيسية' : 'HOME_FEATURED')
                      : createdCampaign.campaignType === 'SPONSORED_SEARCH'
                      ? (language === 'ku' ? 'ئەنجامەکانی گەڕان' : language === 'ar' ? 'نتائج البحث' : 'SPONSORED_SEARCH')
                      : createdCampaign.campaignType === 'MULTI_PAGE'
                      ? (language === 'ku' ? 'هەموو پەڕەکان' : language === 'ar' ? 'كافة الصفحات' : 'MULTI_PAGE')
                      : createdCampaign.campaignType}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'خاڵی پارێزراو:' : language === 'ar' ? 'النقاط المحجوزة:' : 'Points Reserved:'}
                  </span>
                  <span className="font-bold text-amber-600 inline-flex items-center gap-1">
                    <span dir="ltr">+{Number(createdCampaign.pointsCost).toLocaleString()}</span>
                    <span>{language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}</span>
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">
                    {language === 'ku' ? 'دۆخی کەمپین:' : language === 'ar' ? 'حالة الحملة:' : 'Status:'}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[11px]" data-testid="campaign-status-badge">
                    {createdCampaign.status || 'SUBMITTED'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  data-testid="done-promote-btn"
                  onClick={onClose}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  {language === 'ku' ? 'تەواو' : language === 'ar' ? 'تم' : 'Done'}
                </button>
              </div>
            </div>
          ) : (
            /* Promotion Selection Form */
            <form onSubmit={handlePromoteSubmit} className="space-y-4">
              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Wallet Balance Banner */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-600 font-medium">
                    {language === 'ku'
                      ? 'باڵانسی خاڵی بەردەست:'
                      : language === 'ar'
                      ? 'رصيدك المتاح من النقاط:'
                      : 'Available Usable Points:'}
                  </span>
                  <span className="font-extrabold text-slate-900 text-sm" dir="ltr" data-testid="modal-available-points">
                    {walletLoading ? '...' : availablePoints.toLocaleString()} pts
                  </span>
                </div>

                <button
                  type="button"
                  data-testid="modal-buy-more-points-btn"
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-[11px] border border-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === 'ku' ? 'کڕینی خاڵ' : language === 'ar' ? 'شراء نقاط' : 'Add Points'}</span>
                </button>
              </div>

              {/* Package Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ku'
                    ? 'جۆری ڕیکلام و شوێنی پیشاندان:'
                    : language === 'ar'
                    ? 'نوع الإعلان ومكان الظهور:'
                    : 'Select Placement & Duration:'}
                </label>

                <div className="grid grid-cols-1 gap-2.5">
                  {packages.map((pkg) => {
                    const isSelected = selectedPackageId === pkg.id;
                    const localizedName = getPromoPackageLocalizedName(pkg, language);
                    const localizedDesc = getPromoPackageLocalizedDesc(pkg, language);
                    return (
                      <div
                        key={pkg.id}
                        data-testid={`promo-pkg-${pkg.id}`}
                        onClick={() => setSelectedPackageId(pkg.id)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-amber-500 bg-amber-50/40 ring-2 ring-amber-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {getPlacementIcon(pkg.type)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{localizedName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {pkg.durationDays} {language === 'ku' ? 'ڕۆژ' : language === 'ar' ? 'يوم' : 'days'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                              {localizedDesc}
                            </p>
                          </div>
                        </div>

                        <div className="text-end shrink-0 ps-3">
                          <div className="font-black text-sm text-amber-600 inline-flex items-center gap-1" dir="ltr">
                            <span>{Number(pkg.pointsCost).toLocaleString()}</span>
                            <span className="text-xs">{language === 'ku' ? 'خاڵ' : language === 'ar' ? 'نقطة' : 'pts'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block">{language === 'ku' ? 'تێچووی سیستم' : language === 'ar' ? 'السعر الرسمي' : 'Server Rate'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Insufficient points alert */}
              {!hasSufficientPoints && selectedPkg && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">
                      {language === 'ku'
                        ? 'خاڵی بەردەست بەس نییە'
                        : language === 'ar'
                        ? 'رصيد النقاط غير كافٍ'
                        : 'Insufficient Points Balance'}
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {language === 'ku'
                        ? `پێویستت بە ${pointsCost.toLocaleString()} خاڵە، بەڵام باڵانسەکەت ${availablePoints.toLocaleString()} خاڵە.`
                        : language === 'ar'
                        ? `تحتاج إلى ${pointsCost.toLocaleString()} نقطة، ورصيدك الحالي هو ${availablePoints.toLocaleString()} نقطة.`
                        : `You need ${pointsCost.toLocaleString()} points, but your usable balance is ${availablePoints.toLocaleString()} points.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Consent and Governance Notice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-[11px] leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {language === 'ku'
                    ? 'ڕیکلامەکە پەیوەستە بە پشکنینی کارگێڕی پێش بڵاوبوونەوە لە پەڕەی سەرەکی یان گەڕان. ئەگەر بە ناوی نوێنەرەوە (Agent) ڕیکلام بکەیت، ڕەزامەندی خاوەن موڵک پێویستە.'
                    : language === 'ar'
                    ? 'يخضع الإعلان للمراجعة الإدارية قبل النشر على الصفحة الرئيسية أو البحث. إذا تم الطلب بواسطة وكيل، يلزم الحصول على موافقة مالك العقار.'
                    : 'All campaigns undergo platform moderation before publication. Campaigns initiated by agents require explicit property owner consent prior to administrative approval.'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {language === 'ku' ? 'داخستن' : language === 'ar' ? 'إغلاق' : 'Close'}
                </button>
                <button
                  type="submit"
                  data-testid="submit-promotion-campaign-btn"
                  disabled={submitting || !selectedPackageId || !hasSufficientPoints}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {submitting
                      ? language === 'ku'
                        ? 'تۆمار دەکرێت...'
                        : language === 'ar'
                        ? 'جاري الحجز والتسجيل...'
                        : 'Submitting...'
                      : language === 'ku'
                      ? 'تۆمارکردنی کەمپین و گرتنی خاڵ'
                      : language === 'ar'
                      ? 'حجز النقاط وتأكيد الحملة'
                      : 'Submit & Reserve Points'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Points Purchase Modal Child */}
      <PointsPurchaseModal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        onPurchaseSuccess={() => {
          loadModalData();
        }}
      />
    </div>
  );
};
