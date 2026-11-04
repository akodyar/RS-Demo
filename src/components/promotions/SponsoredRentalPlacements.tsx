import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, MapPin, AlertCircle, RefreshCw, Bed, Bath, ArrowUpRight } from 'lucide-react';
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

interface SponsoredRentalPlacementsProps {
  onSelectProperty?: (prop: any) => void;
  className?: string;
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

export const SponsoredRentalPlacements: React.FC<SponsoredRentalPlacementsProps> = ({
  onSelectProperty,
  className = '',
}) => {
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
      const res = await fetch('/api/promotions/placements/SEARCH');
      if (!res.ok) {
        throw new Error(`HTTP_${res.status}: Failed to fetch sponsored search placements`);
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
      <div
        className={`w-full bg-[#0c1322] border border-amber-500/20 rounded-3xl p-5 space-y-4 text-start ${className}`}
        data-testid="sponsored-rental-loading"
        dir={direction}
      >
        <div className="flex items-center gap-2">
          <div className="h-5 w-24 bg-slate-800 rounded-full animate-pulse" />
          <div className="h-5 w-48 bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#080d19] rounded-2xl border border-slate-800 p-3 space-y-3">
              <div className="aspect-[16/10] bg-slate-800/60 rounded-xl animate-pulse" />
              <div className="h-4 w-3/4 bg-slate-800/80 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-800/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <div
        className={`w-full bg-rose-950/40 border border-rose-500/40 text-rose-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-start ${className}`}
        data-testid="sponsored-rental-error"
        dir={direction}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            {getLoc(
              'نەتوانرا ئەنجامە سپۆنسەرکراوەکانی گەڕان باربکرێت.',
              'Unable to load sponsored search placements.',
              'تعذر تحميل نتائج البحث الممولة.'
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={fetchPlacements}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold rounded-xl cursor-pointer transition-all shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{getLoc('دووبارە هەوڵبدەرەوە', 'Retry', 'إعادة المحاولة')}</span>
        </button>
      </div>
    );
  }

  // Graceful empty collapse: if no eligible active campaigns exist, hide completely with zero fake data
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full bg-[#0c1322] border border-amber-500/30 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4 text-start ${className}`}
      data-testid="sponsored-rental-placements"
      dir={direction}
    >
      {/* Header with Prominent Demarcation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2">
          <span
            data-testid="sponsored-header-badge"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-[11px] font-black shadow-md shadow-amber-500/20"
          >
            <Sparkles className="w-3 h-3 fill-slate-950" />
            <span>{getLoc('سپۆنسەرکراو', 'Sponsored', 'مُموَّل')}</span>
          </span>
          <h3 className="text-sm sm:text-base font-black text-white">
            {getLoc('موڵکە سپۆنسەرکراوەکانی گەڕانی کرێ', 'Sponsored Rental Placements', 'إعلانات الإيجار الممولة')}
          </h3>
        </div>

        <p className="text-[11px] text-amber-300/80 font-medium">
          {getLoc(
            'موڵکی پشتڕاستکراوی پەسەندکراو لە کەمپەینە چالاکەکانی هۆمهاب',
            'Certified properties active in approved sponsorship campaigns',
            'عقارات موثقة ضمن حملات الرعاية النشطة في هومهاب'
          )}
        </p>
      </div>

      {/* Sponsored Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const photos = parsePropertyPhotos(item.property?.address, item.listing?.imageUrl || item.property?.imageUrl);
          const city = parsePropertyCity(item.property?.address, item.property?.city);
          const price = Number(item.listing?.price) || 0;
          const currency = item.listing?.currency || 'IQD';
          const priceDisplay =
            currency === 'IQD'
              ? `${price.toLocaleString()} IQD`
              : `$${price.toLocaleString()}`;

          const cardClick = (e: React.MouseEvent) => {
            if (onSelectProperty) {
              e.preventDefault();
              // Construct a property object compatible with SearchExplorerPage modal
              onSelectProperty({
                id: item.property.id,
                listingId: item.listing.id,
                titleKu: item.listing?.title || item.property?.name,
                titleEn: item.listing?.title || item.property?.name,
                titleAr: item.listing?.title || item.property?.name,
                cityKu: city,
                cityEn: city,
                cityAr: city,
                areaKu: city,
                areaEn: city,
                areaAr: city,
                priceUsd: currency === 'USD' ? price : Math.round(price / 1310),
                priceIqd: `${price.toLocaleString()} IQD`,
                currency,
                period: 'month',
                bedrooms: item.property?.bedrooms || 3,
                bathrooms: item.property?.bathrooms || 2,
                sizeM2: item.property?.squareFeet ? Math.round(item.property.squareFeet / 10.764) : 150,
                verified: true,
                featured: true,
                isPromoted: true,
                promotionType: item.campaignType,
                imageUrl: photos[0],
                additionalImages: photos,
                descriptionKu: item.listing?.description || 'موڵکی کرێی سپۆنسەرکراو لە هۆمهاب',
                descriptionEn: item.listing?.description || 'Sponsored rental property on HomeHub platform',
                descriptionAr: item.listing?.description || 'عقار إيجار ممول وموثق على منصة هومهاب',
                amenities: ['24/7 Security', 'Garage', 'Generator'],
                amenitiesKu: ['پاسەوانی ٢٤/٧', 'گەراج', 'مۆلیدە'],
                amenitiesEn: ['24/7 Security', 'Garage', 'Generator'],
                amenitiesAr: ['حراسة 24/7', 'كراج', 'مولدة'],
                agentName: 'HomeHub Verified Broker',
                agentPhone: '+964 750 123 4567',
                agentCompany: 'HomeHub Official Network',
              });
            }
          };

          return (
            <Link
              key={item.campaignId}
              to={`/rentals?propertyId=${item.property.id}`}
              onClick={cardClick}
              data-testid="sponsored-placement-card"
              className="group bg-[#080d19] rounded-2xl border border-amber-500/30 hover:border-amber-400 shadow-lg hover:shadow-amber-500/10 transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer"
            >
              {/* Image Header with Prominent Badges */}
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
                <img
                  src={photos[0]}
                  alt={item.listing?.title || item.property?.name}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
                  }}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#080d19] via-transparent to-transparent opacity-90" />

                {/* Top Badges */}
                <div
                  className={`absolute top-2.5 flex items-center gap-1.5 ${
                    direction === 'rtl' ? 'right-2.5' : 'left-2.5'
                  }`}
                >
                  <span
                    data-testid="sponsored-badge"
                    className="bg-amber-500 text-slate-950 font-black px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 shadow-md shadow-amber-500/20"
                  >
                    <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                    <span>{getLoc('سپۆنسەرکراو', 'Sponsored', 'مُموَّل')}</span>
                  </span>

                  <span className="bg-[#0c1322]/90 text-amber-300 backdrop-blur-md px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm border border-amber-500/30">
                    <Shield className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                    <span>{getLoc('پشتڕاستکراو', 'Verified', 'موثق')}</span>
                  </span>
                </div>

                {/* Price Tag Over Image */}
                <div
                  className={`absolute bottom-2.5 text-white ${
                    direction === 'rtl' ? 'right-2.5 text-right' : 'left-2.5 text-left'
                  }`}
                >
                  <p className="text-base sm:text-lg font-black tracking-tight drop-shadow-md flex items-baseline gap-1">
                    <span dir="ltr" className="text-amber-400 font-black">{priceDisplay}</span>
                    <span className="text-[10px] font-normal text-slate-300">
                      {getLoc('/ مانگ', '/ mo', '/ شهر')}
                    </span>
                  </p>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-3.5 space-y-2.5 text-start">
                <div>
                  <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {item.listing?.title || item.property?.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-amber-500/70 shrink-0" />
                    <span>{city}</span>
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-400">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <Bed className="w-3 h-3 text-slate-500" />
                      <span dir="ltr">{item.property?.bedrooms || 3}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Bath className="w-3 h-3 text-slate-500" />
                      <span dir="ltr">{item.property?.bathrooms || 2}</span>
                    </span>
                  </div>

                  <span className="text-amber-400 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <span>{getLoc('وردەکاری', 'Details', 'تفاصيل')}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
