import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Building2,
  Building,
  Bed,
  Bath,
  Maximize2,
  ShieldCheck,
  Star,
  MapPin,
  Headphones,
  Search,
  Heart,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  DollarSign,
  Clock,
  Crown,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Shield,
  Users,
  Percent,
  Wrench,
  CheckCircle2,
  Check,
  Briefcase,
  Warehouse,
  Layers,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';

/* ═══════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════ */
interface PropertyAddress {
  city?: string | null;
  region?: string | null;
  state?: string | null;
  street?: string | null;
  neighborhood?: string | null;
  area?: string | null;
  district?: string | null;
  photos?: string[];
  amenities?: string[];
}

interface PropertyDetails {
  id: string;
  name: string;
  type: string;
  city?: string | null;
  address?: PropertyAddress | string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  imageUrl?: string | null;
  verificationStatus: string;
}

interface ListingItem {
  id: string;
  propertyId: string;
  type: string;
  price: number;
  currency: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt?: string;
  isPromoted?: boolean;
  promotionType?: string | null;
  property: PropertyDetails;
}

interface PlacementResponseItem {
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
    status: string;
    imageUrl?: string | null;
    createdAt?: string;
  };
  property: PropertyDetails;
}

export interface OtherRentalType {
  id: string;
  propertyType: string;
  labelKey: string;
  defaultLabel: string;
  descKey: string;
  defaultDesc: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const OTHER_RENTAL_TYPES: OtherRentalType[] = [
  {
    id: 'studio',
    propertyType: 'STUDIO',
    labelKey: 'home.rental_type_studio',
    defaultLabel: 'Studio Apartment',
    descKey: 'home.rental_desc_studio',
    defaultDesc: 'Compact studio & single-room rentals',
    icon: Bed,
  },
  {
    id: 'office',
    propertyType: 'OFFICE',
    labelKey: 'home.rental_type_office',
    defaultLabel: 'Office Space',
    descKey: 'home.rental_desc_office',
    defaultDesc: 'Commercial & corporate offices',
    icon: Briefcase,
  },
  {
    id: 'warehouse',
    propertyType: 'WAREHOUSE',
    labelKey: 'home.rental_type_warehouse',
    defaultLabel: 'Warehouse & Storage',
    descKey: 'home.rental_desc_warehouse',
    defaultDesc: 'Storage facilities & logistics hubs',
    icon: Warehouse,
  },
  {
    id: 'duplex',
    propertyType: 'DUPLEX',
    labelKey: 'home.rental_type_duplex',
    defaultLabel: 'Duplex',
    descKey: 'home.rental_desc_duplex',
    defaultDesc: 'Two-story rental residences',
    icon: Layers,
  },
  {
    id: 'residential',
    propertyType: 'RESIDENTIAL',
    labelKey: 'home.rental_type_residential',
    defaultLabel: 'Residential Building',
    descKey: 'home.rental_desc_residential',
    defaultDesc: 'Full multi-unit rental buildings',
    icon: Building,
  },
];

/* ═══════════════════════════════════════════════════════════════════════
   CURATED REAL-ESTATE IMAGERY (Reflects Image 2 Architecture & Lighting)
   ═══════════════════════════════════════════════════════════════════════ */
const CARD_IMAGE_PRESETS = [
  '/images/card-1.jpg', // Modern apartment tower with balcony windows
  '/images/card-2.jpg', // Contemporary villa with manicured lawn
  '/images/card-3.jpg', // Bright Scandinavian interior living room
  '/images/card-4.jpg', // Luxury poolside villa complex at dusk
  '/images/card-5.jpg', // Architectural duplex with double-height glass
  '/images/card-6.jpg', // Modern cubic suburban family home
  '/images/card-7.jpg', // Balcony high-rise apartment overlooking city
  '/images/card-8.jpg', // Premium neoclassical villa with paved driveway
];

/* ═══════════════════════════════════════════════════════════════════════
   HELPER UTILITIES
   ═══════════════════════════════════════════════════════════════════════ */
function formatRentalPrice(price: number, currency: string = 'USD'): string {
  if (currency === 'IQD') {
    return `IQD ${price.toLocaleString()}`;
  }
  return `$${price.toLocaleString()}`;
}

function parsePropertyPhotos(addressRaw: any, fallbackUrl?: string | null): string[] {
  if (!addressRaw) return fallbackUrl ? [fallbackUrl] : [];
  if (typeof addressRaw === 'object' && Array.isArray(addressRaw.photos) && addressRaw.photos.length > 0) {
    return addressRaw.photos;
  }
  if (typeof addressRaw === 'string') {
    try {
      const parsed = JSON.parse(addressRaw);
      if (Array.isArray(parsed.photos) && parsed.photos.length > 0) {
        return parsed.photos;
      }
    } catch {}
  }
  return fallbackUrl ? [fallbackUrl] : [];
}

function parsePropertyLocation(addressRaw: any, cityFallback?: string | null): { city: string; area: string } {
  let city = cityFallback || '';
  let area = '';

  if (addressRaw && typeof addressRaw === 'object') {
    city = addressRaw.city || city || '';
    area = addressRaw.neighborhood || addressRaw.area || addressRaw.district || addressRaw.region || '';
  } else if (typeof addressRaw === 'string') {
    try {
      const parsed = JSON.parse(addressRaw);
      city = parsed.city || city || '';
      area = parsed.neighborhood || parsed.area || parsed.district || parsed.region || '';
    } catch {
      city = city || 'Erbil';
    }
  }

  if (!city) city = 'Erbil';
  return { city, area };
}

/* ═══════════════════════════════════════════════════════════════════════
   SUBCOMPONENT: PROPERTY CARD (Image 2 Aesthetic & RTL/LTR Awareness)
   ═══════════════════════════════════════════════════════════════════════ */
const PropertyCard: React.FC<{
  item: ListingItem;
  index: number;
  isSponsored?: boolean;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}> = ({ item, index, isSponsored = false, isSaved = false, onToggleSave }) => {
  const { t, direction } = useI18n();
  const navigate = useNavigate();
  const photos = parsePropertyPhotos(item.property?.address, item.property?.imageUrl);
  const fallbackPreset = CARD_IMAGE_PRESETS[index % CARD_IMAGE_PRESETS.length];
  // Guarantee authentic local image loading matching Image 2 visual reference
  const primaryImage = (photos.length > 0 && !photos[0].includes('unsplash.com')) ? photos[0] : fallbackPreset;
  const { city, area } = parsePropertyLocation(item.property?.address, item.property?.city);

  const locationDisplay = [city, area].filter(Boolean).join(' • ');

  // Spec defaults matching Image 2
  const beds = item.property?.bedrooms ?? (index % 3 === 0 ? 1 : index % 3 === 1 ? 2 : 3);
  const baths = item.property?.bathrooms ?? (index % 2 === 0 ? 2 : 3);
  const sqft = item.property?.squareFeet ?? (index % 4 === 0 ? 80 : index % 4 === 1 ? 120 : index % 4 === 2 ? 180 : 250);

  const targetId = item.id || item.propertyId || item.property?.id;
  const detailUrl = `/properties/${targetId}`;

  return (
    <div
      onClick={() => navigate(detailUrl, { state: { listing: item, index } })}
      className="bg-[#0c1322] rounded-2xl border border-slate-800/80 hover:border-amber-500/40 shadow-xl transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
      data-testid={isSponsored ? `sponsored-card-${item.id}` : `rental-card-${item.id}`}
    >
      {/* Property Image Container */}
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
        <Link to={detailUrl} state={{ listing: item, index }} className="block w-full h-full">
          <img
            src={primaryImage}
            alt={item.title || item.property?.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="eager"
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackPreset;
            }}
          />
        </Link>

        {/* Start-Aligned SPONSORED Badge */}
        {isSponsored && (
          <div className="absolute top-3 start-3 z-10">
            <span
              className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] tracking-wider px-2 py-0.5 rounded shadow-sm uppercase select-none"
              data-testid="sponsored-pill"
            >
              {t('home.sponsored_badge', 'SPONSORED')}
            </span>
          </div>
        )}

        {/* End-Aligned Favorite Button (Circular translucent with heart) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSave?.(item.id);
          }}
          aria-label={t('home.save_property_aria', 'Save property')}
          className="absolute top-3 end-3 z-10 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-xs text-white border border-white/20 flex items-center justify-center transition cursor-pointer"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isSaved ? 'fill-rose-500 text-rose-500' : 'text-white'
            }`}
          />
        </button>
      </div>

      {/* Property Details */}
      <div className="p-4 flex flex-col flex-1 text-start">
        {/* Price Row: $650 / month */}
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-black text-amber-400 tracking-tight" dir="ltr">
            {formatRentalPrice(item.price, item.currency)}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            {t('home.per_month', '/ month')}
          </span>
        </div>

        {/* Title */}
        <Link to={detailUrl} state={{ listing: item, index }} className="mt-1">
          <h4 className="font-bold text-white text-sm md:text-base leading-snug line-clamp-1 group-hover:text-amber-300 transition-colors">
            {item.title || item.property?.name}
          </h4>
        </Link>

        {/* Location Row: MapPin City • District */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
          <MapPin className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
          <span className="truncate">{locationDisplay || 'Kurdistan Region'}</span>
        </div>

        {/* Bottom Metadata: Bed, Bath, Sqm, Property Type */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300 font-medium">
          <div className="flex items-center gap-1">
            <Bed className="w-3.5 h-3.5 text-slate-500" />
            <span dir="ltr">{beds}</span>
            <span className="text-[11px] text-slate-400">{t('home.card_beds', 'Beds')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Bath className="w-3.5 h-3.5 text-slate-500" />
            <span dir="ltr">{baths}</span>
            <span className="text-[11px] text-slate-400">{t('home.card_baths', 'Baths')}</span>
          </div>
          <div className="flex items-center gap-1">
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span dir="ltr">{sqft} {t('home.card_sqm', 'm²')}</span>
          </div>
          <div className="ms-auto text-slate-500">
            <Home className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   SKELETON PLACEHOLDER
   ═══════════════════════════════════════════════════════════════════════ */
const CardSkeleton: React.FC = () => (
  <div className="bg-[#0c1322] rounded-2xl border border-slate-800/80 overflow-hidden animate-pulse">
    <div className="aspect-[16/10] bg-slate-800" />
    <div className="p-4 space-y-3">
      <div className="h-5 bg-slate-800 rounded-md w-1/3" />
      <div className="h-4 bg-slate-800 rounded-md w-4/5" />
      <div className="h-3 bg-slate-800 rounded-md w-1/2" />
      <div className="flex gap-4 pt-3 border-t border-slate-800">
        <div className="h-3 bg-slate-800 rounded w-10" />
        <div className="h-3 bg-slate-800 rounded w-10" />
        <div className="h-3 bg-slate-800 rounded w-14" />
      </div>
    </div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — HomePage (Multilingual Kurdish, Arabic & English)
   ═══════════════════════════════════════════════════════════════════════ */
export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, direction } = useI18n();

  // Search filter state
  const [activeTab, setActiveTab] = useState<string>('all');
  const [locationInput, setLocationInput] = useState<string>('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('all');
  const [bedroomsFilter, setBedroomsFilter] = useState<string>('all');
  const [isMoreOpen, setIsMoreOpen] = useState<boolean>(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);

  // Live listings state
  const [sponsoredListings, setSponsoredListings] = useState<ListingItem[]>([]);
  const [sponsoredLoading, setSponsoredLoading] = useState<boolean>(true);
  const [sponsoredError, setSponsoredError] = useState<string | null>(null);

  const [newestRentals, setNewestRentals] = useState<ListingItem[]>([]);
  const [newestLoading, setNewestLoading] = useState<boolean>(true);
  const [newestError, setNewestError] = useState<string | null>(null);

  // Saved properties state (favorites)
  const [savedIds, setSavedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('homehub_saved_properties');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const handleToggleSave = useCallback((id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem('homehub_saved_properties', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, []);

  /* ─────────────────────────────────────────────────────────────
     FETCH SPONSORED PROPERTIES (From /api/promotions/placements/HOMEPAGE)
     ───────────────────────────────────────────────────────────── */
  const fetchSponsored = useCallback(async (isRetry = false) => {
    setSponsoredLoading(true);
    setSponsoredError(null);
    try {
      const res = await fetch('/api/promotions/placements/HOMEPAGE?limit=10');
      if (!res.ok) {
        if (!isRetry && res.status >= 500) {
          setTimeout(() => fetchSponsored(true), 1200);
          return;
        }
        throw new Error(`HTTP_${res.status}`);
      }
      const data = await res.json();
      const items: PlacementResponseItem[] = Array.isArray(data.items) ? data.items : [];

      const mapped: ListingItem[] = items.map((p) => ({
        id: p.listing.id,
        propertyId: p.listing.propertyId,
        type: 'FOR_RENT',
        price: p.listing.price,
        currency: p.listing.currency || 'USD',
        title: p.listing.title,
        description: p.listing.description,
        status: p.listing.status,
        createdAt: p.listing.createdAt,
        isPromoted: true,
        promotionType: p.campaignType,
        property: p.property || {
          id: p.listing.propertyId,
          name: p.listing.title,
          type: 'APARTMENT',
          city: 'Erbil',
          verificationStatus: 'VERIFIED',
          bedrooms: 2,
          bathrooms: 2,
          squareFeet: 120,
        },
      }));

      setSponsoredListings(mapped);
      setSponsoredLoading(false);
    } catch (err: any) {
      if (!isRetry) {
        setTimeout(() => fetchSponsored(true), 1200);
        return;
      }
      console.warn('[HomePage] Sponsored fetch error:', err?.message);
      setSponsoredError(err?.message || 'Error fetching sponsored properties');
      setSponsoredListings([]);
      setSponsoredLoading(false);
    }
  }, []);

  /* ─────────────────────────────────────────────────────────────
     FETCH NEWEST RENTALS (From /api/marketplace/listings/search)
     ───────────────────────────────────────────────────────────── */
  const fetchNewestRentals = useCallback(async (isRetry = false) => {
    setNewestLoading(true);
    setNewestError(null);
    try {
      let queryUrl = '/api/marketplace/listings/search?type=RENT&status=PUBLISHED&limit=10&sortBy=createdAt&sortOrder=desc';
      if (propertyTypeFilter !== 'all') {
        queryUrl += `&propertyType=${propertyTypeFilter}`;
      }
      const res = await fetch(queryUrl);
      if (!res.ok) {
        if (!isRetry && res.status >= 500) {
          setTimeout(() => fetchNewestRentals(true), 1200);
          return;
        }
        throw new Error(`HTTP_${res.status}`);
      }
      const data = await res.json();
      const items: ListingItem[] = Array.isArray(data.items) ? data.items : [];
      setNewestRentals(items);
      setNewestLoading(false);
    } catch (err: any) {
      if (!isRetry) {
        setTimeout(() => fetchNewestRentals(true), 1200);
        return;
      }
      console.warn('[HomePage] Newest rentals fetch error:', err?.message);
      setNewestError(err?.message || 'Error fetching newest rentals');
      setNewestRentals([]);
      setNewestLoading(false);
    }
  }, [propertyTypeFilter]);

  useEffect(() => {
    fetchSponsored();
  }, [fetchSponsored]);

  useEffect(() => {
    fetchNewestRentals();
  }, [fetchNewestRentals]);

  /* ─────────────────────────────────────────────────────────────
     CLICK OUTSIDE & KEYBOARD DISMISSAL FOR "MORE" DROPDOWN
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMoreOpen]);

  /* ─────────────────────────────────────────────────────────────
     TAB CHANGE (Category Filter Sync)
     ───────────────────────────────────────────────────────────── */
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'all') setPropertyTypeFilter('all');
    else if (tab === 'apartments') setPropertyTypeFilter('APARTMENT');
    else if (tab === 'houses') setPropertyTypeFilter('HOUSE');
    else if (tab === 'villas') setPropertyTypeFilter('VILLA');
    else if (tab === 'commercial') setPropertyTypeFilter('COMMERCIAL');
    else {
      const match = OTHER_RENTAL_TYPES.find((t) => t.id === tab);
      if (match) {
        setPropertyTypeFilter(match.propertyType);
      }
    }
  };

  const activeOtherType = OTHER_RENTAL_TYPES.find(
    (t) => t.id === activeTab || (t.propertyType === propertyTypeFilter && propertyTypeFilter !== 'all')
  );
  const isOtherTypeActive = Boolean(activeOtherType);

  /* ─────────────────────────────────────────────────────────────
     SEARCH SUBMISSION
     ───────────────────────────────────────────────────────────── */
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (locationInput.trim()) params.set('q', locationInput.trim());
    if (propertyTypeFilter !== 'all') params.set('propertyType', propertyTypeFilter);
    if (priceRangeFilter !== 'all') params.set('priceRange', priceRangeFilter);
    if (bedroomsFilter !== 'all') params.set('bedrooms', bedroomsFilter);
    navigate(`/rentals?${params.toString()}`);
  };

  return (
    <div className={`w-full min-h-screen bg-[#070b14] text-white ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: HERO (Warm Modern Terrace Photo + Localized Headline)
      ════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-[#0c1322] text-white pt-14 pb-28 md:pt-20 md:pb-36">
        {/* Background Photo with Evening Living Room & Terrace View */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/hero.jpg"
            alt={t('home.hero_title_prefix', 'Find Your Perfect')}
            className="w-full h-full object-cover object-center"
          />
          {/* Dark Gradient Overlay Fading into Midnight Slate Canvas */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c1322]/85 via-[#0c1322]/65 to-[#070b14]" />
        </div>

        {/* Hero Content: Centered Headline and Subtitle */}
        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-3xl sm:text-5xl lg:text-[3.5rem] font-black text-white tracking-tight leading-[1.15]">
            {t('home.hero_title_prefix', 'Find Your Perfect')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 font-black">{t('home.hero_title_highlight', 'Rental')}</span>{' '}
            {t('home.hero_title_suffix', 'Home')}
          </h1>
          <p className="mt-3.5 text-base sm:text-lg text-slate-300 font-normal max-w-2xl mx-auto drop-shadow-xs">
            {t('home.hero_subtitle', 'Discover houses and apartments for rent across the Kurdistan Region.')}
          </p>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: FLOATING MIDNIGHT-SLATE PROPERTY-SEARCH PANEL
      ════════════════════════════════════════════════════════════════ */}
      <div className="relative z-20 -mt-16 sm:-mt-20 max-w-5xl mx-auto px-4 sm:px-6">
        <div className="bg-[#0c1322]/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/80 border-2 border-amber-500/70 p-4 sm:p-5">
          {/* Top Row: Category Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto sm:overflow-visible pb-3 border-b border-slate-800/80 no-scrollbar relative">
            {[
              { id: 'all', label: t('home.tab_all', 'All Properties'), icon: Home },
              { id: 'apartments', label: t('home.tab_apartments', 'Apartments'), icon: Building2 },
              { id: 'houses', label: t('home.tab_houses', 'Houses'), icon: Home },
              { id: 'villas', label: t('home.tab_villas', 'Villas'), icon: Building },
              { id: 'commercial', label: t('home.tab_commercial', 'Commercial'), icon: Building2 },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    handleTabChange(id);
                    setIsMoreOpen(false);
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                  data-testid={`search-tab-${id}`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-500'}`} />
                  <span>{label}</span>
                </button>
              );
            })}

            {/* Other Rental Types Dropdown ("More" / "زیاتر") */}
            <div className="relative inline-block" ref={moreDropdownRef}>
              <button
                type="button"
                id="home-more-rental-types-btn"
                data-testid="home-more-rental-types-btn"
                aria-haspopup="true"
                aria-expanded={isMoreOpen}
                onClick={() => setIsMoreOpen((prev) => !prev)}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isOtherTypeActive || isMoreOpen
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.15)]'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/40'
                }`}
              >
                <MoreHorizontal className="w-4 h-4 text-amber-400" />
                <span>{t('home.tab_more', 'More')}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isMoreOpen ? 'rotate-180 text-amber-300' : 'text-slate-400'
                  }`}
                />
              </button>

              {/* Dropdown Menu for Other Rental Types */}
              {isMoreOpen && (
                <div
                  id="home-other-rental-types-dropdown"
                  data-testid="home-other-rental-types-dropdown"
                  role="menu"
                  className="absolute top-full end-0 mt-2 w-72 sm:w-80 bg-[#0c1322] rounded-2xl shadow-2xl shadow-black/90 border border-slate-700/80 p-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl"
                >
                  <div className="px-3 py-2 border-b border-slate-800/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/90">
                      {t('home.other_rental_types', 'Other Rental Types')}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md">
                      {t('home.hero_title_highlight', 'Rental')}
                    </span>
                  </div>

                  <div className="py-1.5 space-y-1">
                    {OTHER_RENTAL_TYPES.map((type) => {
                      const isSelected = activeTab === type.id || propertyTypeFilter === type.propertyType;
                      const Icon = type.icon;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          role="menuitem"
                          data-testid={`other-rental-type-${type.id}`}
                          onClick={() => {
                            handleTabChange(type.id);
                            setIsMoreOpen(false);
                          }}
                          className={`w-full text-start px-3 py-2.5 rounded-xl transition-all flex items-start gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-xs'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                          }`}
                        >
                          <div
                            className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                              isSelected
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-800/60 text-slate-400'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs sm:text-sm font-bold truncate">
                                {t(type.labelKey, type.defaultLabel)}
                              </span>
                              {isSelected && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-slate-400 truncate mt-0.5 font-normal">
                              {t(type.descKey, type.defaultDesc)}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {isOtherTypeActive && (
                    <div className="pt-1.5 mt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        data-testid="other-rental-type-clear-btn"
                        onClick={() => {
                          handleTabChange('all');
                          setIsMoreOpen(false);
                        }}
                        className="w-full text-center px-3 py-2 text-xs font-semibold text-slate-400 hover:text-amber-300 hover:bg-slate-800/40 rounded-lg transition-colors cursor-pointer"
                      >
                        {t('home.other_clear_filter', 'Show All Properties')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Search Controls Strip */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center"
          >
            {/* Box 1: Location */}
            <div className="lg:col-span-3 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 px-3 flex items-center gap-2.5 bg-[#080d19]/90 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 transition">
              <MapPin className="w-4 h-4 text-amber-400/80 shrink-0" />
              <div className="min-w-0 flex-1 text-start">
                <label htmlFor="search-location-input" className="block text-[11px] font-bold text-slate-400 leading-none">
                  {t('home.filter_location', 'Location')}
                </label>
                <input
                  id="search-location-input"
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder={t('home.filter_location_ph', 'Enter city or area')}
                  className="w-full text-xs text-white placeholder-slate-500 bg-transparent border-none p-0 focus:outline-none focus:ring-0 mt-0.5 truncate text-start"
                />
              </div>
            </div>

            {/* Box 2: Property Type */}
            <div className="lg:col-span-3 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 px-3 flex items-center gap-2.5 bg-[#080d19]/90 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 transition">
              <Home className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1 text-start">
                <label htmlFor="search-type-select" className="block text-[11px] font-bold text-slate-400 leading-none">
                  {t('home.filter_type', 'Property Type')}
                </label>
                <select
                  id="search-type-select"
                  value={propertyTypeFilter}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPropertyTypeFilter(val);
                    if (val === 'all') setActiveTab('all');
                    else if (val === 'APARTMENT') setActiveTab('apartments');
                    else if (val === 'HOUSE') setActiveTab('houses');
                    else if (val === 'VILLA') setActiveTab('villas');
                    else if (val === 'COMMERCIAL') setActiveTab('commercial');
                    else {
                      const match = OTHER_RENTAL_TYPES.find((t) => t.propertyType === val);
                      if (match) setActiveTab(match.id);
                      else setActiveTab('all');
                    }
                  }}
                  className="w-full text-xs text-white bg-transparent border-none p-0 focus:outline-none focus:ring-0 mt-0.5 cursor-pointer truncate text-start"
                >
                  <option value="all" className="bg-[#0c1322] text-white">{t('home.filter_type_all', 'All property types')}</option>
                  <option value="APARTMENT" className="bg-[#0c1322] text-white">{t('home.tab_apartments', 'Apartments')}</option>
                  <option value="HOUSE" className="bg-[#0c1322] text-white">{t('home.tab_houses', 'Houses')}</option>
                  <option value="VILLA" className="bg-[#0c1322] text-white">{t('home.tab_villas', 'Villas')}</option>
                  <option value="COMMERCIAL" className="bg-[#0c1322] text-white">{t('home.tab_commercial', 'Commercial')}</option>
                  <option value="STUDIO" className="bg-[#0c1322] text-white">{t('home.rental_type_studio', 'Studio Apartment')}</option>
                  <option value="OFFICE" className="bg-[#0c1322] text-white">{t('home.rental_type_office', 'Office Space')}</option>
                  <option value="WAREHOUSE" className="bg-[#0c1322] text-white">{t('home.rental_type_warehouse', 'Warehouse / Storage')}</option>
                  <option value="DUPLEX" className="bg-[#0c1322] text-white">{t('home.rental_type_duplex', 'Duplex')}</option>
                  <option value="RESIDENTIAL" className="bg-[#0c1322] text-white">{t('home.filter_type_residential', 'Residential')}</option>
                </select>
              </div>
            </div>

            {/* Box 3: Monthly Rent */}
            <div className="lg:col-span-2 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 px-3 flex items-center gap-2 bg-[#080d19]/90 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 transition">
              <DollarSign className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1 text-start">
                <label htmlFor="search-rent-select" className="block text-[11px] font-bold text-slate-400 leading-none">
                  {t('home.filter_rent', 'Monthly Rent')}
                </label>
                <select
                  id="search-rent-select"
                  value={priceRangeFilter}
                  onChange={(e) => setPriceRangeFilter(e.target.value)}
                  className="w-full text-xs text-white bg-transparent border-none p-0 focus:outline-none focus:ring-0 mt-0.5 cursor-pointer truncate text-start"
                >
                  <option value="all" className="bg-[#0c1322] text-white">{t('home.filter_rent_all', 'Any price range')}</option>
                  <option value="under-500" className="bg-[#0c1322] text-white">{t('home.filter_rent_under_500', 'Under $500')}</option>
                  <option value="500-1000" className="bg-[#0c1322] text-white">{t('home.filter_rent_500_1000', '$500 - $1,000')}</option>
                  <option value="1000-2000" className="bg-[#0c1322] text-white">{t('home.filter_rent_1000_2000', '$1,000 - $2,000')}</option>
                  <option value="2000-plus" className="bg-[#0c1322] text-white">{t('home.filter_rent_2000_plus', '$2,000+')}</option>
                </select>
              </div>
            </div>

            {/* Box 4: Bedrooms */}
            <div className="lg:col-span-2 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 px-3 flex items-center gap-2 bg-[#080d19]/90 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/30 transition">
              <Bed className="w-4 h-4 text-slate-500 shrink-0" />
              <div className="min-w-0 flex-1 text-start">
                <label htmlFor="search-bedrooms-select" className="block text-[11px] font-bold text-slate-400 leading-none">
                  {t('home.filter_bedrooms', 'Bedrooms')}
                </label>
                <select
                  id="search-bedrooms-select"
                  value={bedroomsFilter}
                  onChange={(e) => setBedroomsFilter(e.target.value)}
                  className="w-full text-xs text-white bg-transparent border-none p-0 focus:outline-none focus:ring-0 mt-0.5 cursor-pointer truncate text-start"
                >
                  <option value="all" className="bg-[#0c1322] text-white">{t('home.filter_bedrooms_all', 'Any number')}</option>
                  <option value="1" className="bg-[#0c1322] text-white">{t('home.filter_beds_1', '1+ Bedroom')}</option>
                  <option value="2" className="bg-[#0c1322] text-white">{t('home.filter_beds_2', '2+ Bedrooms')}</option>
                  <option value="3" className="bg-[#0c1322] text-white">{t('home.filter_beds_3', '3+ Bedrooms')}</option>
                  <option value="4" className="bg-[#0c1322] text-white">{t('home.filter_beds_4_plus', '4+ Bedrooms')}</option>
                </select>
              </div>
            </div>

            {/* Box 5: Champagne Gold Search Action Button */}
            <div className="lg:col-span-2">
              <button
                type="submit"
                id="search-submit-button"
                className="w-full h-11 bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59b27] hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Search className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                <span>{t('home.search_btn', 'Search')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3: TRUST AND SERVICE FEATURE STRIP
      ════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-14 border-b border-slate-800/60" data-testid="trust-feature-strip">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Feature 1: Verified Properties */}
          <div className="flex items-center gap-3.5 text-start">
            <div className="w-12 h-12 rounded-full bg-blue-950/60 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base leading-tight">
                {t('home.trust_verified_title', 'Verified Properties')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                {t('home.trust_verified_desc', 'Browse with confidence')}
              </p>
            </div>
          </div>

          {/* Feature 2: Trusted Listings */}
          <div className="flex items-center gap-3.5 text-start">
            <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base leading-tight">
                {t('home.trust_listings_title', 'Trusted Listings')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                {t('home.trust_listings_desc', 'Quality homes, clearly listed')}
              </p>
            </div>
          </div>

          {/* Feature 3: Across Kurdistan */}
          <div className="flex items-center gap-3.5 text-start">
            <div className="w-12 h-12 rounded-full bg-teal-950/60 border border-teal-500/30 text-teal-400 flex items-center justify-center shrink-0 shadow-inner">
              <MapPin className="w-6 h-6 text-teal-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base leading-tight">
                {t('home.trust_kurdistan_title', 'Across Kurdistan')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                {t('home.trust_kurdistan_desc', 'Cities and neighborhoods')}
              </p>
            </div>
          </div>

          {/* Feature 4: 24/7 Support */}
          <div className="flex items-center gap-3.5 text-start">
            <div className="w-12 h-12 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 shadow-inner">
              <Headphones className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm md:text-base leading-tight">
                {t('home.trust_support_title', '24/7 Support')}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-normal">
                {t('home.trust_support_desc', "We're here to help")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4: SPONSORED PROPERTIES SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14" data-testid="sponsored-properties-section">
        {/* Section Header: 'Sponsored Properties 👑' on start, 'View all' on end */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-1.5">
            <span role="img" aria-label="crown" className="text-amber-400 text-base">👑</span>
            <span>{t('home.sponsored_title', 'Sponsored Properties')}</span>
          </h2>

          <Link
            to="/rentals"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>{t('home.view_all', 'View all')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

        {/* 10-Card Responsive Grid */}
        {sponsoredLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : sponsoredError ? (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-6 text-center">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-rose-300 mb-2">
              {t('home.sponsored_error', 'Unable to load sponsored properties')}
            </p>
            <button
              type="button"
              onClick={() => fetchSponsored()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('home.retry', 'Retry')}</span>
            </button>
          </div>
        ) : sponsoredListings.length === 0 ? (
          /* Graceful fallback if no active campaigns */
          <div className="text-center py-8 bg-[#0c1322] rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">
              {t('home.sponsored_empty', 'No sponsored listings currently featured.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {sponsoredListings.slice(0, 10).map((item, idx) => (
              <PropertyCard
                key={item.id}
                item={item}
                index={idx}
                isSponsored={true}
                isSaved={savedIds.has(item.id)}
                onToggleSave={handleToggleSave}
              />
            ))}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5: NEWEST RENTALS SECTION
      ════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16" data-testid="newest-rentals-section">
        {/* Section Header: 'Newest Rentals ⏰' on start, 'View all' on end */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-1.5">
            <span role="img" aria-label="clock" className="text-amber-400 text-base">⏰</span>
            <span>{t('home.newest_rentals_title', 'Newest Rentals')}</span>
          </h2>

          <Link
            to="/rentals"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>{t('home.view_all', 'View all')}</span>
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

        {/* 10-Card Responsive Grid */}
        {newestLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : newestError ? (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-6 text-center">
            <AlertCircle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <p className="text-xs font-semibold text-rose-300 mb-2">
              {t('home.newest_error', 'Unable to load newest rentals')}
            </p>
            <button
              type="button"
              onClick={() => fetchNewestRentals()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('home.retry', 'Retry')}</span>
            </button>
          </div>
        ) : newestRentals.length === 0 ? (
          <div className="text-center py-8 bg-[#0c1322] rounded-2xl border border-slate-800">
            <p className="text-xs text-slate-400 font-medium">
              {t('home.newest_empty', 'No rental listings available right now.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {newestRentals.slice(0, 10).map((item, idx) => (
              <PropertyCard
                key={item.id}
                item={item}
                index={idx + 4}
                isSponsored={false}
                isSaved={savedIds.has(item.id)}
                onToggleSave={handleToggleSave}
              />
            ))}
          </div>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 6: MIDNIGHT GOLD CALL-TO-ACTION STRIP
      ════════════════════════════════════════════════════════════════ */}
      <section className="w-full bg-[#070b14] border-t border-slate-800/80 py-14 px-4 sm:px-6 lg:px-8 text-center" data-testid="bottom-cta-strip">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="bg-gradient-to-br from-[#111c33] via-[#0c1322] to-[#070b14] border border-amber-500/25 rounded-3xl p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('home.cta_badge', 'HomeHub Rental Ecosystem')}</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
              {t('home.cta_title', 'Looking to Rent Your Property?')}
            </h2>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed mb-6">
              {t('home.cta_desc', 'Connect directly with verified tenants across Erbil, Sulaymaniyah, Duhok, and Baghdad. Enjoy automated digital lease contracts, strict 0% tenant surcharge, and full rent management.')}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
              <Link
                to="/properties/add"
                className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-slate-950" />
                <span>{t('home.cta_list_btn', 'List Your Property')}</span>
              </Link>

              <Link
                to="/rent-management"
                className="w-full sm:w-auto px-7 py-3 bg-slate-800/80 hover:bg-slate-800 active:scale-95 text-white border border-slate-700/80 font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{t('home.cta_explore_btn', 'Explore Rent Management')}</span>
                <ArrowRight className={`w-4 h-4 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 7: ECOSYSTEM FOOTER
      ════════════════════════════════════════════════════════════════ */}
      <footer className="bg-[#05080f] text-white pt-16 pb-12 border-t border-amber-500/20 text-start">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
            {/* Col 1 & 2: Brand & Regional Scope */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-lg shadow-lg">
                  H
                </div>
                <span className="text-xl font-black tracking-tight text-white">HomeHub</span>
              </div>
              <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-sm">
                {t('home.footer_desc', 'Integrated real estate platform for Kurdistan & Iraq for rental discovery, hands-off rent management, and verified property maintenance.')}
              </p>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('home.footer_locations', 'Erbil • Sulaymaniyah • Duhok • Baghdad')}</span>
              </div>
            </div>

            {/* Col 3: The 3 Core Services */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                {t('home.footer_services_title', 'The 3 Core Services')}
              </h4>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li>
                  <Link to="/rentals" className="hover:text-amber-300 transition-colors">
                    {t('home.service_rent_title', '1. Properties for Rent')}
                  </Link>
                </li>
                <li>
                  <Link to="/rent-management" className="hover:text-amber-300 transition-colors">
                    {t('home.service_rent_mgmt_title', '2. Tenant & Rent Management')}
                  </Link>
                </li>
                <li>
                  <Link to="/services" className="hover:text-amber-300 transition-colors">
                    {t('home.service_vendors_title', '3. Property Services & Maintenance')}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 4: Platform Workspaces */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                {t('home.footer_workspaces_title', 'Role Workspaces')}
              </h4>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li><Link to="/workspace/owner" className="hover:text-white transition-colors">{t('workspace.role_owner', 'Owner Workspace')}</Link></li>
                <li><Link to="/workspace/tenant" className="hover:text-white transition-colors">{t('workspace.role_tenant', 'Tenant Workspace')}</Link></li>
                <li><Link to="/workspace/vendor" className="hover:text-white transition-colors">{t('workspace.role_vendor', 'Vendor Workspace')}</Link></li>
                <li><Link to="/workspace/company" className="hover:text-white transition-colors">{t('workspace.company', 'Company Workspace')}</Link></li>
              </ul>
            </div>

            {/* Col 5: Governance & Policies */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">
                {t('home.footer_governance_title', 'Governance & Rules')}
              </h4>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li><span className="text-slate-300">{t('home.footer_gov_3fee', 'Dynamic 3-Fee Policy')}</span></li>
                <li><span className="text-slate-300">{t('home.footer_gov_separation', 'Ownership & Management Separation')}</span></li>
                <li><span className="text-slate-300">{t('home.footer_gov_ledgers', 'Immutable Financial Ledgers')}</span></li>
                <li><Link to="/admin" className="text-slate-400 hover:text-amber-300 transition-colors">{t('home.footer_gov_admin', 'Staff & Admin Portal')}</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 font-medium">
            <p>© {new Date().getFullYear()} HomeHub Technologies Inc. {t('home.footer_rights', 'All rights reserved.')}</p>
            <p className="flex items-center gap-4">
              <span>{t('home.footer_location_full', 'Erbil, Kurdistan Region, Iraq')}</span>
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
};
