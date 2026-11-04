import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, MapPin, ChevronRight, AlertCircle, RefreshCw, Bed, Bath } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';

interface PlacementItem {
  campaignId: string;
  campaignType: string;
  placementScope: string[];
  startTime: string;
  endTime: string;
  isPromoted: boolean;
  listing: {
    id: string;
    propertyId: string;
    price: number;
    currency: string;
    title: string;
    description: string | null;
    imageUrl?: string | null;
  };
  property: {
    id: string;
    name: string;
    type: string;
    city?: string | null;
    address?: any;
    bedrooms?: number | null;
    bathrooms?: number | null;
    squareFeet?: number | null;
    imageUrl?: string | null;
    verificationStatus: string;
  };
}

interface PlacementsResponse {
  placement: string;
  count: number;
  items: PlacementItem[];
}

function parsePropertyPhotos(address: any, fallbackImageUrl?: string | null): string[] {
  if (address) {
    let parsed: any = address;
    if (typeof address === 'string') {
      try {
        parsed = JSON.parse(address);
      } catch {
        parsed = null;
      }
    }
    if (parsed && Array.isArray(parsed.photos) && parsed.photos.length > 0) {
      return parsed.photos;
    }
  }
  if (fallbackImageUrl) return [fallbackImageUrl];
  return ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'];
}

function parsePropertyCity(address: any, fallbackCity?: string | null): string {
  if (address) {
    let parsed: any = address;
    if (typeof address === 'string') {
      try {
        parsed = JSON.parse(address);
      } catch {
        parsed = null;
      }
    }
    if (parsed && parsed.city) return parsed.city;
  }
  return fallbackCity || 'Erbil';
}

export const HomeFeaturedProperties: React.FC = () => {
  const { language, direction } = useI18n();
  const [items, setItems] = useState<PlacementItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getLoc = useCallback(
    (ku: string, en: string, ar: string) => {
      if (language === 'ku') return ku || en;
      if (language === 'ar') return ar || en;
      return en;
    },
    [language]
  );

  const fetchPlacements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/promotions/placements/HOMEPAGE');
      if (!res.ok) {
        throw new Error(`HTTP_${res.status}: Failed to fetch featured properties`);
      }
      const data: PlacementsResponse = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setError(err?.message || 'Network error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  // Loading skeleton
  if (loading) {
    return (
      <section
        className="w-full bg-slate-50/80 py-10 border-t border-slate-200/60 text-start"
        data-testid="home-featured-loading"
        dir={direction}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="h-6 w-48 bg-slate-200 rounded-full animate-pulse" />
          <div className="h-10 w-80 bg-slate-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-4 shadow-2xs">
                <div className="aspect-[16/10] bg-slate-200 rounded-2xl animate-pulse" />
                <div className="h-5 w-3/4 bg-slate-200 rounded animate-pulse" />
                <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <section
        className="w-full bg-slate-50 py-8 border-t border-slate-200/60 text-start"
        data-testid="home-featured-error"
        dir={direction}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>
                {getLoc(
                  'نەتوانرا موڵکە سپۆنسەرکراوەکانی لاپەڕەی سەرەکی باربکرێت.',
                  'Unable to load featured properties on the homepage.',
                  'تعذر تحميل العقارات المميزة في الصفحة الرئيسية.'
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={fetchPlacements}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold rounded-xl cursor-pointer transition-all shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{getLoc('دووبارە هەوڵبدەرەوە', 'Retry', 'إعادة المحاولة')}</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  // Graceful empty collapse: if no eligible active campaigns exist, hide completely with zero fake data
  if (items.length === 0) {
    return null;
  }

  return (
    <section
      className="w-full bg-gradient-to-b from-white via-slate-50 to-slate-50 py-12 border-t border-slate-200/70 text-start"
      data-testid="home-featured-properties"
      dir={direction}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header with Prominent Sponsorship Demarcation */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-black shadow-2xs mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span data-testid="sponsored-header-badge">
                {getLoc('موڵکی هەڵبژێردراو و سپۆنسەرکراو', 'Featured & Sponsored Properties', 'عقارات مميزة وممولة')}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {getLoc('باشترین موڵکەکانی ئێستا بۆ کرێ', 'Top Featured Rental Properties', 'أبرز عقارات الإيجار المميزة')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl font-normal leading-relaxed">
              {getLoc(
                'ئەم موڵکانە لەلایەن خاوەن موڵک و برۆکەرە پەسەندکراوەکانەوە سپۆنسەر کراون و بە تەواوی لەلایەن هۆمهابەوە پشتڕاستکراونەتەوە.',
                'These verified properties are sponsored by trusted owners and brokers under HomeHub certification standards.',
                'عقارات إيجار موثقة ممولة من الملاك والوسطاء المعتمدين وفق أعلى معايير هومهاب.'
              )}
            </p>
          </div>

          <Link
            to="/rentals"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
          >
            <span>{getLoc('هەموو موڵکەکان ببینە', 'View All Rentals', 'عرض جميع الإيجارات')}</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${direction === 'rtl' ? 'rotate-180' : ''}`} />
          </Link>
        </div>

        {/* Featured Properties Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const photos = parsePropertyPhotos(item.property?.address, item.listing?.imageUrl || item.property?.imageUrl);
            const city = parsePropertyCity(item.property?.address, item.property?.city);
            const price = Number(item.listing?.price) || 0;
            const currency = item.listing?.currency || 'IQD';
            const priceDisplay =
              currency === 'IQD'
                ? `${price.toLocaleString()} IQD`
                : `$${price.toLocaleString()}`;

            return (
              <Link
                key={item.campaignId}
                to={`/rentals?propertyId=${item.property.id}`}
                data-testid="home-featured-card"
                className="group bg-white rounded-3xl border border-slate-200/80 hover:border-blue-300 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col justify-between cursor-pointer"
              >
                {/* Image Header with Prominent Badges */}
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  <img
                    src={photos[0]}
                    alt={item.listing?.title || item.property?.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
                    }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent" />

                  {/* Top Badges */}
                  <div
                    className={`absolute top-3.5 flex items-center gap-2 ${
                      direction === 'rtl' ? 'right-3.5' : 'left-3.5'
                    }`}
                  >
                    {/* Clear Sponsored Demarcation Badge */}
                    <span
                      data-testid="sponsored-badge"
                      className="bg-amber-500 text-white font-black px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 shadow-md"
                    >
                      <Sparkles className="w-3 h-3 fill-white" />
                      <span>{getLoc('سپۆنسەرکراو', 'Sponsored', 'مُموَّل')}</span>
                    </span>

                    {/* Verified Deed Badge */}
                    <span className="bg-white/95 text-slate-800 backdrop-blur-xs px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-xs border border-slate-200/40">
                      <Shield className="w-3 h-3 text-blue-600 fill-blue-600" />
                      <span>{getLoc('پشتڕاستکراو', 'Verified', 'موثق')}</span>
                    </span>
                  </div>

                  {/* Price Tag Over Image */}
                  <div
                    className={`absolute bottom-3.5 text-white ${
                      direction === 'rtl' ? 'right-3.5 text-right' : 'left-3.5 text-left'
                    }`}
                  >
                    <p className="text-xl font-black tracking-tight drop-shadow-md flex items-baseline gap-1.5">
                      <span dir="ltr">{priceDisplay}</span>
                      <span className="text-xs font-normal text-slate-200">
                        {getLoc('/ مانگ', '/ mo', '/ شهر')}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-5 sm:p-6 space-y-4 text-start">
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {item.listing?.title || item.property?.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{city}</span>
                    </p>
                  </div>

                  {/* Property Specs */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Bed className="w-3.5 h-3.5 text-slate-400" />
                        <span dir="ltr">{item.property?.bedrooms || 3}</span>
                        <span>{getLoc('ژوور', 'Beds', 'غرف')}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5 text-slate-400" />
                        <span dir="ltr">{item.property?.bathrooms || 2}</span>
                        <span>{getLoc('حەمام', 'Baths', 'حمامات')}</span>
                      </span>
                    </div>

                    <span className="text-blue-600 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>{getLoc('بینین', 'View', 'عرض')}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${direction === 'rtl' ? 'rotate-180 group-hover:-translate-x-1' : ''}`} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};
