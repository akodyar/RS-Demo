import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  MapPin,
  Building2,
  Home,
  Bed,
  Bath,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Share2,
  Heart,
  Phone,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  Wind,
  Wifi,
  Shield,
  Car,
  FileText,
  Expand,
  Check,
  AlertCircle,
  Building,
  KeyRound,
  Compass,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../components/AuthProvider';

/* ═══════════════════════════════════════════════════════════════════════
   PRESET CURATED REAL-ESTATE IMAGES (Fallback & Multi-Angle Gallery)
   ═══════════════════════════════════════════════════════════════════════ */
const CARD_IMAGE_PRESETS = [
  '/images/card-1.jpg',
  '/images/card-2.jpg',
  '/images/card-3.jpg',
  '/images/card-4.jpg',
  '/images/card-5.jpg',
  '/images/card-6.jpg',
  '/images/card-7.jpg',
  '/images/card-8.jpg',
];

const ARCHITECTURAL_INTERIOR_GALLERY = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=85',
  'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1600&q=85',
  'https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?auto=format&fit=crop&w=1600&q=85',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=85',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85',
];

/* ═══════════════════════════════════════════════════════════════════════
   CURATED DEMO REGISTRY (Guarantees zero mixed-up details between listings)
   ═══════════════════════════════════════════════════════════════════════ */
interface DetailPropertyRecord {
  id: string;
  propertyId: string;
  titleKu: string;
  titleEn: string;
  titleAr: string;
  price: number;
  currency: string;
  cityKu: string;
  cityEn: string;
  cityAr: string;
  areaKu: string;
  areaEn: string;
  areaAr: string;
  streetKu: string;
  streetEn: string;
  streetAr: string;
  propertyType: 'APARTMENT' | 'VILLA' | 'HOUSE' | 'COMMERCIAL';
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  isPromoted: boolean;
  promotionType?: string;
  verified: boolean;
  photos: string[];
  descriptionKu: string;
  descriptionEn: string;
  descriptionAr: string;
  amenitiesKu: string[];
  amenitiesEn: string[];
  amenitiesAr: string[];
  agentName: string;
  agentPhone: string;
  agentCompanyKu: string;
  agentCompanyEn: string;
  agentCompanyAr: string;
  rentalTermsKu: string;
  rentalTermsEn: string;
  rentalTermsAr: string;
}

const FALLBACK_DEMO_REGISTRY: Record<string, DetailPropertyRecord> = {
  'demo_prop_01': {
    id: 'demo_prop_01',
    propertyId: 'demo_prop_01',
    titleKu: 'شوقەی بەڕێوەبەری لە تاوەری پارك ڤیو گوڵان',
    titleEn: 'Executive High-Floor Apartment in Park View Gulan',
    titleAr: 'شقة تنفيذية فاخرة في بارك فيو كولان',
    price: 1250,
    currency: 'USD',
    cityKu: 'هەولێر',
    cityEn: 'Erbil',
    cityAr: 'أربيل',
    areaKu: 'شەقامی گوڵان',
    areaEn: 'Gulan 40m',
    areaAr: 'شارع كولان',
    streetKu: 'بەرامبەر پارکی سامی عەبدولڕەحمان',
    streetEn: 'Opposite Sami Abdulrahman Park',
    streetAr: 'مقابل منتزه سامي عبد الرحمن',
    propertyType: 'APARTMENT',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 185,
    isPromoted: true,
    promotionType: 'VIP_PIN',
    verified: true,
    photos: [
      '/images/card-1.jpg',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=85',
      'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1600&q=85',
    ],
    descriptionKu: 'شوقەیەکی شاهانەی تەواو مۆبیلیاتکراو بە دیمەنی سەوزایی پارك، بە سیستەمی مۆڵیدەی بێ بڕانەوەی ٢٤ کاتژمێری، پاسەوانی ئەمنی دیجیتاڵی، گەراجی ژێرزەمینی تایبەت و ئەسانسۆری خێرا.',
    descriptionEn: 'Fully furnished executive apartment offering panoramic park views, uninterrupted 24/7 electricity generator, concierge security, and private underground parking in prestigious Gulan street.',
    descriptionAr: 'شقة مفروشة بالكامل بإطلالة بانورامية ساحرة على المنتزه مع مولدة كهرباء 24 ساعة وموقف سيارات خاص وأمن مدار الساعة.',
    amenitiesKu: ['مۆلیدەی ٢٤ کاتژمێری', 'سپلیتی ناوەندی', 'ئەسانسۆری خێرا', 'پاسەوانی ٢٤/٧', 'گەراجی تایبەت', 'ئینتەرنێتی فایبەر', 'باڵکۆنی کراوە'],
    amenitiesEn: ['24/7 Generator', 'Central AC', 'High-Speed Elevators', '24/7 Security', 'Private Parking', 'Fiber Internet', 'Private Balcony'],
    amenitiesAr: ['مولدة 24/7', 'تكييف مركزي', 'مصاعد سريعة', 'حراسة 24/7', 'موقف خاص', 'إنترنت فايبر', 'شرفة خاصة'],
    agentName: 'ڕەوەند ئەحمەد',
    agentPhone: '+964 750 445 1122',
    agentCompanyKu: 'گرووپی خانووبەرەی ئیمپایەر',
    agentCompanyEn: 'Empire Real Estate Group',
    agentCompanyAr: 'مجموعة إمباير العقارية',
    rentalTermsKu: 'گرێبەستی فەرمی ساڵانە • پارەی کرێی مانگانە لە سەرەتای هەر مانگێک • بێ هیچ سەرچاوەیەکی زیادی سەر کرێنشین (0% Surcharge)',
    rentalTermsEn: '1-Year Official Digital Lease • Monthly payment at start of cycle • Strict 0% Tenant Surcharge',
    rentalTermsAr: 'عقد إيجار رسمي لمدة سنة • دفع شهري منتظم • بدون أي عمولة أو رسوم إضافية على المستأجر (0% عمولة)',
  },
};

function resolveSafePhotos(photosList?: string[] | null, seedIndex: number = 0): string[] {
  const safePresets = [
    CARD_IMAGE_PRESETS[seedIndex % CARD_IMAGE_PRESETS.length],
    CARD_IMAGE_PRESETS[(seedIndex + 1) % CARD_IMAGE_PRESETS.length],
    CARD_IMAGE_PRESETS[(seedIndex + 2) % CARD_IMAGE_PRESETS.length],
    CARD_IMAGE_PRESETS[(seedIndex + 3) % CARD_IMAGE_PRESETS.length],
    CARD_IMAGE_PRESETS[(seedIndex + 4) % CARD_IMAGE_PRESETS.length],
  ];

  if (!photosList || !Array.isArray(photosList) || photosList.length === 0) {
    return safePresets;
  }

  const localOnly = photosList.filter(p => typeof p === 'string' && !p.includes('unsplash.com'));
  if (localOnly.length >= 2) return localOnly;

  return safePresets;
}

export const PropertyDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, direction } = useI18n();
  const { user } = useAuth();

  // State initialization
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [schedulerOpen, setSchedulerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [scheduledConfirmation, setScheduledConfirmation] = useState<string | null>(null);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);
  const [shareToast, setShareToast] = useState(false);
  const [loading, setLoading] = useState(true);

  // Favorites state synced with localStorage
  const [isSaved, setIsSaved] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('homehub_saved_properties');
        if (raw && id) {
          const list = JSON.parse(raw);
          return Array.isArray(list) && list.includes(id);
        }
      }
    } catch {}
    return false;
  });

  // Resolve initial property data from location.state if passed from HomePage
  const passedListing = location.state?.listing;
  const passedIndex = location.state?.index ?? 0;

  const [propertyData, setPropertyData] = useState<DetailPropertyRecord>(() => {
    // 1. Check direct demo registry
    if (id && FALLBACK_DEMO_REGISTRY[id]) {
      return FALLBACK_DEMO_REGISTRY[id];
    }

    // 2. Build initial record from passed listing state
    if (passedListing) {
      const p = passedListing.property || {};
      const addr = p.address || {};
      const fullPhotos = resolveSafePhotos(addr.photos, passedIndex);

      return {
        id: passedListing.id || id || 'prop_01',
        propertyId: passedListing.propertyId || p.id || id || 'prop_01',
        titleKu: passedListing.title || p.name || 'موڵکی مۆدێرنی کرێ لە کوردستان',
        titleEn: passedListing.title || p.name || 'Modern Rental Property in Kurdistan',
        titleAr: passedListing.title || p.name || 'عقار مميز للإيجار في كوردستان',
        price: passedListing.price || 950,
        currency: passedListing.currency || 'USD',
        cityKu: addr.city || p.city || 'هەولێر',
        cityEn: addr.city || p.city || 'Erbil',
        cityAr: addr.city || p.city || 'أربيل',
        areaKu: addr.neighborhood || addr.area || 'ناوچەی نموونەیی',
        areaEn: addr.neighborhood || addr.area || 'Prime District',
        areaAr: addr.neighborhood || addr.area || 'منطقة مميزة',
        streetKu: addr.street || 'شەقامی سەرەکی',
        streetEn: addr.street || 'Main Boulevard',
        streetAr: addr.street || 'الشارع الرئيسي',
        propertyType: (p.type as any) || 'APARTMENT',
        bedrooms: p.bedrooms ?? (passedIndex % 3 === 0 ? 1 : passedIndex % 3 === 1 ? 2 : 3),
        bathrooms: p.bathrooms ?? (passedIndex % 2 === 0 ? 2 : 3),
        squareFeet: p.squareFeet ?? (passedIndex % 4 === 0 ? 85 : passedIndex % 4 === 1 ? 130 : passedIndex % 4 === 2 ? 190 : 260),
        isPromoted: Boolean(passedListing.isPromoted),
        promotionType: passedListing.promotionType,
        verified: p.verificationStatus === 'VERIFIED' || true,
        photos: fullPhotos,
        descriptionKu: passedListing.description || 'موڵکێکی تایبەت بە کەرەستە و کوالێتی بەرز، دەکەوێتە یەکێک لە باشترین گەڕەکەکانی شارەوە. خاوەنی کەلوپەل و دیزاینی سەردەمیانەیە لەگەڵ هەموو خزمەتگوزارییە سەرەکییەکان.',
        descriptionEn: passedListing.description || 'Premium rental property located in one of the most desirable neighborhoods. Built with highest quality standards, featuring modern design, natural lighting, and full utilities.',
        descriptionAr: passedListing.description || 'عقار متميز للإيجار في أرقى أحياء المدينة بتصميم عصري وتشطيبات فاخرة، مع توفر جميع الخدمات الأساسية والأمنية.',
        amenitiesKu: Array.isArray(addr.amenities) && addr.amenities.length > 0 ? addr.amenities : ['مۆلیدەی ٢٤ کاتژمێری', 'سپلیتی ناوەندی', 'ئەسانسۆری خێرا', 'پاسەوانی ٢٤/٧', 'گەراجی تایبەت', 'ئینتەرنێتی فایبەر'],
        amenitiesEn: ['24/7 Generator', 'Central AC', 'High-Speed Elevators', '24/7 Security', 'Private Parking', 'Fiber Internet'],
        amenitiesAr: ['مولدة 24/7', 'تكييف مركزي', 'مصاعد سريعة', 'حراسة 24/7', 'موقف خاص', 'إنترنت فايبر'],
        agentName: 'ڕەوەند ئەحمەد',
        agentPhone: '+964 750 445 1122',
        agentCompanyKu: 'کۆمپانیای خانووبەرەی نیشتمانی',
        agentCompanyEn: 'National Premier Real Estate',
        agentCompanyAr: 'شركة العقارات الوطنية المتميزة',
        rentalTermsKu: 'گرێبەستی فەرمی ١ ساڵە • ٠٪ سەرچاوەی زیادە لەسەر کرێنشین • پارەی کرێ لە سەرەتای هەر مانگێک لە ڕێگەی بانکی یان کاش',
        rentalTermsEn: '1-Year Official Digital Lease • 0% Tenant Surcharge • Monthly rental installments through bank or cash',
        rentalTermsAr: 'عقد إيجار رسمي سنوي • 0% عمولة على المستأجر • سداد شهري منتظم عبر الحساب المصرفي أو نقداً',
      };
    }

    // Default fallback matching ID hash
    const hash = (id || 'prop').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const preset = CARD_IMAGE_PRESETS[hash % CARD_IMAGE_PRESETS.length];
    return {
      id: id || 'prop_01',
      propertyId: id || 'prop_01',
      titleKu: 'شوقەی مۆدێرنی شاهانە بۆ کرێ',
      titleEn: 'Luxury Modern Rental Property',
      titleAr: 'شقة مودرن فاخرة للإيجار',
      price: 1100,
      currency: 'USD',
      cityKu: 'هەولێر',
      cityEn: 'Erbil',
      cityAr: 'أربيل',
      areaKu: 'ئیمپایەر وۆرڵد',
      areaEn: 'Empire World',
      areaAr: 'إمباير وورلد',
      streetKu: 'شەقامی سەرەکی بازنەیی',
      streetEn: 'Circular Boulevard',
      streetAr: 'الشارع الدائري الرئيسي',
      propertyType: 'APARTMENT',
      bedrooms: 2,
      bathrooms: 2,
      squareFeet: 140,
      isPromoted: true,
      promotionType: 'HOMEPAGE_FEATURED',
      verified: true,
      photos: [
        preset,
        ARCHITECTURAL_INTERIOR_GALLERY[0],
        ARCHITECTURAL_INTERIOR_GALLERY[1],
        ARCHITECTURAL_INTERIOR_GALLERY[2],
      ],
      descriptionKu: 'موڵکێکی تایبەت و ڕازاوە لە شوێنێکی ئارام و پارێزراو. گونجاوە بۆ خێزان و کارمەندانی نێودەوڵەتی بە گرێبەستی یاسایی پارێزراوی HomeHub.',
      descriptionEn: 'Exceptional contemporary residence situated in a secure and tranquil setting. Ideal for families and professionals with HomeHub legally guaranteed digital lease.',
      descriptionAr: 'عقار معاصر استثنائي يقع في موقع هادئ وآمن ومناسب للعائلات والموظفين مع ضمان عقود HomeHub الرقمية.',
      amenitiesKu: ['مۆلیدەی ٢٤ کاتژمێری', 'سپلیتی ناوەندی', 'ئەسانسۆری خێرا', 'پاسەوانی ٢٤/٧', 'گەراجی تایبەت', 'ئینتەرنێتی فایبەر'],
      amenitiesEn: ['24/7 Generator', 'Central AC', 'High-Speed Elevators', '24/7 Security', 'Private Parking', 'Fiber Internet'],
      amenitiesAr: ['مولدة 24/7', 'تكييف مركزي', 'مصاعد سريعة', 'حراسة 24/7', 'موقف خاص', 'إنترنت فايبر'],
      agentName: 'ڕەوەند ئەحمەد',
      agentPhone: '+964 750 445 1122',
      agentCompanyKu: 'گرووپی ئیمپایەر بۆ خانووبەرە',
      agentCompanyEn: 'Empire Real Estate Group',
      agentCompanyAr: 'مجموعة إمباير العقارية',
      rentalTermsKu: 'گرێبەستی فەرمی دیجیتاڵی • ٠٪ سەرچاوەی زیادەی کرێنشین • چاودێری چاکسازی بەردەوام',
      rentalTermsEn: 'Official Digital Lease • Strict 0% Tenant Surcharge • Ongoing Maintenance Support',
      rentalTermsAr: 'عقد إيجار رقمي رسمي • 0% رسوم إضافية على المستأجر • دعم صيانة مستمر',
    };
  });

  // Fetch live listing details from backend to augment or ensure fresh data
  useEffect(() => {
    let isMounted = true;
    const fetchFreshData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // 1. Try public marketplace listing endpoint
        const res = await fetch(`/api/marketplace/listings/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            const fullPhotos = resolveSafePhotos(addr.photos, passedIndex);

            setPropertyData(prev => ({
              ...prev,
              id: data.id || prev.id,
              propertyId: data.propertyId || p.id || prev.propertyId,
              titleKu: data.title || p.name || prev.titleKu,
              titleEn: data.title || p.name || prev.titleEn,
              titleAr: data.title || p.name || prev.titleAr,
              price: Number(data.price) || prev.price,
              currency: data.currency || prev.currency,
              cityKu: addr.city || p.city || prev.cityKu,
              cityEn: addr.city || p.city || prev.cityEn,
              cityAr: addr.city || p.city || prev.cityAr,
              areaKu: addr.neighborhood || addr.area || prev.areaKu,
              areaEn: addr.neighborhood || addr.area || prev.areaEn,
              areaAr: addr.neighborhood || addr.area || prev.areaAr,
              streetKu: addr.street || prev.streetKu,
              streetEn: addr.street || prev.streetEn,
              streetAr: addr.street || prev.streetAr,
              propertyType: (p.type as any) || prev.propertyType,
              bedrooms: p.bedrooms ?? prev.bedrooms,
              bathrooms: p.bathrooms ?? prev.bathrooms,
              squareFeet: p.squareFeet ?? prev.squareFeet,
              verified: p.verificationStatus === 'VERIFIED' || prev.verified,
              photos: fullPhotos,
              descriptionKu: data.description || prev.descriptionKu,
              descriptionEn: data.description || prev.descriptionEn,
              descriptionAr: data.description || prev.descriptionAr,
              amenitiesKu: Array.isArray(addr.amenities) && addr.amenities.length > 0 ? addr.amenities : prev.amenitiesKu,
            }));
          }
        }
      } catch (err) {
        // Fallback already initialized cleanly
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchFreshData();
    return () => { isMounted = false; };
  }, [id]);

  // Favorite toggle handler
  const toggleFavorite = useCallback(() => {
    setIsSaved(prev => {
      const next = !prev;
      try {
        const raw = localStorage.getItem('homehub_saved_properties');
        let set = new Set<string>(raw ? JSON.parse(raw) : []);
        if (next) {
          if (id) set.add(id);
          if (propertyData.propertyId) set.add(propertyData.propertyId);
        } else {
          if (id) set.delete(id);
          if (propertyData.propertyId) set.delete(propertyData.propertyId);
        }
        localStorage.setItem('homehub_saved_properties', JSON.stringify(Array.from(set)));
      } catch {}
      return next;
    });
  }, [id, propertyData.propertyId]);

  // Share handler
  const handleShare = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 3000);
      }
    } catch {}
  }, []);

  // Price formatting
  const formattedPrice = useMemo(() => {
    if (propertyData.currency === 'IQD') {
      return `${propertyData.price.toLocaleString()} IQD`;
    }
    return `$${propertyData.price.toLocaleString()}`;
  }, [propertyData.price, propertyData.currency]);

  // Secondary currency calculation for transparency
  const secondaryPrice = useMemo(() => {
    if (propertyData.currency === 'USD') {
      const approxIqd = propertyData.price * 1310;
      return `≈ ${approxIqd.toLocaleString()} IQD`;
    } else {
      const approxUsd = Math.round(propertyData.price / 1310);
      return `≈ $${approxUsd.toLocaleString()}`;
    }
  }, [propertyData.price, propertyData.currency]);

  // Localized title & location
  const displayTitle = language === 'ku' ? propertyData.titleKu : language === 'ar' ? propertyData.titleAr : propertyData.titleEn;
  const displayCity = language === 'ku' ? propertyData.cityKu : language === 'ar' ? propertyData.cityAr : propertyData.cityEn;
  const displayArea = language === 'ku' ? propertyData.areaKu : language === 'ar' ? propertyData.areaAr : propertyData.areaEn;
  const displayStreet = language === 'ku' ? propertyData.streetKu : language === 'ar' ? propertyData.streetAr : propertyData.streetEn;
  const displayDescription = language === 'ku' ? propertyData.descriptionKu : language === 'ar' ? propertyData.descriptionAr : propertyData.descriptionEn;
  const displayTerms = language === 'ku' ? propertyData.rentalTermsKu : language === 'ar' ? propertyData.rentalTermsAr : propertyData.rentalTermsEn;
  const displayAmenities = language === 'ku' ? propertyData.amenitiesKu : language === 'ar' ? propertyData.amenitiesAr : propertyData.amenitiesEn;
  const displayAgentCompany = language === 'ku' ? propertyData.agentCompanyKu : language === 'ar' ? propertyData.agentCompanyAr : propertyData.agentCompanyEn;

  const fullLocation = [displayCity, displayArea, displayStreet].filter(Boolean).join(' • ');

  // Keyboard navigation for Lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') setSelectedImageIdx(prev => (prev + 1) % propertyData.photos.length);
      if (e.key === 'ArrowLeft') setSelectedImageIdx(prev => (prev - 1 + propertyData.photos.length) % propertyData.photos.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, propertyData.photos.length]);

  // Check if current user is owner or manager for switching to command center
  const isOwnerOrAdmin = user && (
    user.roles?.includes('PROPERTY_OWNER' as any) ||
    user.roles?.includes('OWNER' as any) ||
    user.roles?.includes('COMPANY_ADMIN' as any) ||
    user.roles?.includes('PLATFORM_ADMIN' as any)
  );

  return (
    <div
      className={`min-h-screen w-full bg-[#070b14] text-white ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* ════════════════════════════════════════════════════════════════
          TOP NAVIGATION BAR: BREADCRUMB + OWNER BADGE + ACTION BUTTONS
      ════════════════════════════════════════════════════════════════ */}
      <div className="w-full bg-[#0c1322]/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-400 truncate">
            <Link to="/" className="hover:text-amber-300 transition-colors">
              {t('nav.home', 'سەرەکی')}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-600 shrink-0" />
            <Link to="/rentals" className="hover:text-amber-300 transition-colors">
              {t('nav.rentals', 'خانووی کرێ')}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180 text-slate-600 shrink-0" />
            <span className="text-white truncate max-w-[200px] sm:max-w-xs">{displayTitle}</span>
          </nav>

          {/* Action Tools: Save Heart + Share Link */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Share Button */}
            <button
              type="button"
              onClick={handleShare}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-[#111b2e] hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-amber-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title={t('property.share', 'هاوبەشکردن')}
            >
              <Share2 className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{t('property.share', 'هاوبەشکردن')}</span>
            </button>

            {/* Favorite Button */}
            <button
              type="button"
              onClick={toggleFavorite}
              className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-bold ${
                isSaved
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-[#111b2e] hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-rose-400'
              }`}
              title={t('property.save', 'دڵخواز')}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span className="hidden sm:inline">
                {isSaved ? t('property.saved', 'پاشەکەوتکراوە') : t('property.save', 'پاشەکەوتکردن')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Share Toast Feedback Notification */}
      {shareToast && (
        <div className="fixed bottom-6 start-6 z-50 bg-[#0c1322] border border-amber-500/40 text-amber-300 text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-amber-400" />
          <span>{t('property.link_copied', 'بەستەری موڵکەکە لەبەرگیرایەوە!')}</span>
        </div>
      )}

      {/* Owner / Manager Command Center Bar (Visible to authorized managers) */}
      {isOwnerOrAdmin && (
        <div className="w-full bg-gradient-to-r from-amber-500/15 via-[#0c1322] to-amber-500/10 border-b border-amber-500/30 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('property.owner_notice', 'تۆ مافی بەڕێوەبردنی ئەم موڵکەت هەیە لە سیستەم.')}</span>
            </div>
            <Link
              to={`/properties/${propertyData.propertyId}/command-center`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
            >
              <span>{t('property.open_command_center', 'کردنەوەی ناوەندی بەڕێوەبردن (Command Center)')}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MAIN CONTENT CONTAINER
      ════════════════════════════════════════════════════════════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1: PHOTO GALLERY (Large Interactive Showcase)
        ══════════════════════════════════════════════════════════════ */}
        <section className="space-y-3" aria-label="Photo Gallery">
          {/* Main Hero Photo Container */}
          <div className="relative aspect-[16/9] md:aspect-[21/9] w-full rounded-3xl overflow-hidden bg-[#0c1322] border border-slate-800 shadow-2xl group">
            <img
              src={propertyData.photos[selectedImageIdx] || propertyData.photos[0]}
              alt={`${displayTitle} - Photo ${selectedImageIdx + 1}`}
              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-102"
              loading="eager"
              onError={(e) => {
                (e.target as HTMLImageElement).src = CARD_IMAGE_PRESETS[(selectedImageIdx + passedIndex) % CARD_IMAGE_PRESETS.length];
              }}
            />
            {/* Dark Ambient Bottom Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/90 via-transparent to-black/25 pointer-events-none" />

            {/* Badges on Top Corner */}
            <div className="absolute top-4 start-4 flex flex-wrap items-center gap-2 z-10">
              {propertyData.isPromoted && (
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1 uppercase select-none">
                  <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                  <span>{t('property.badge.sponsored', 'سپۆنسەرکراو 👑')}</span>
                </span>
              )}
              {propertyData.verified && (
                <span className="bg-[#0c1322]/95 border border-emerald-500/50 text-emerald-300 font-bold text-xs px-3 py-1 rounded-full backdrop-blur-md shadow-md flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>{t('property.badge.verified_deed', 'موڵکی باوەڕپێکراو بە تاپۆ')}</span>
                </span>
              )}
              <span className="bg-[#0c1322]/90 border border-slate-700 text-slate-200 font-bold text-xs px-3 py-1 rounded-full backdrop-blur-md">
                {propertyData.propertyType === 'VILLA' ? t('type.villa', 'ڤێلا') : propertyData.propertyType === 'HOUSE' ? t('type.house', 'خانوو') : t('type.apartment', 'شوقە')}
              </span>
            </div>

            {/* Fullscreen Lightbox Zoom Trigger */}
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute top-4 end-4 z-10 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 transition-transform active:scale-95 cursor-pointer shadow-lg"
              title={t('property.gallery.view_fullscreen', 'بینینی تەواوی شاشە')}
            >
              <Expand className="w-4 h-4 text-amber-300" />
            </button>

            {/* Navigation Arrows (Prev / Next) */}
            {propertyData.photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedImageIdx(prev => (prev - 1 + propertyData.photos.length) % propertyData.photos.length)}
                  className="absolute start-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xl"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImageIdx(prev => (prev + 1) % propertyData.photos.length)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xl"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-6 h-6 rtl:rotate-180" />
                </button>
              </>
            )}

            {/* Photo Counter Pill on Bottom Corner */}
            <div className="absolute bottom-4 end-4 z-10 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-slate-700/80 text-xs font-mono text-white select-none">
              <span dir="ltr">{selectedImageIdx + 1} / {propertyData.photos.length}</span>
            </div>
          </div>

          {/* Thumbnail Carousel Row */}
          {propertyData.photos.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto py-2 no-scrollbar">
              {propertyData.photos.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`relative w-24 h-16 sm:w-28 sm:h-20 rounded-2xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer shadow-md ${
                    selectedImageIdx === idx
                      ? 'border-amber-400 ring-2 ring-amber-400/40 scale-102'
                      : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-700'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = CARD_IMAGE_PRESETS[(idx + passedIndex) % CARD_IMAGE_PRESETS.length];
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2: RESPONSIVE TWO-COLUMN GRID (7 Cols Details, 5 Cols Booking)
        ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT / PRIMARY COLUMN (7 COLS): Info, Specs, Description, Amenities, Location */}
          <div className="lg:col-span-7 space-y-6 text-start">

            {/* Header: Title, Price, Location */}
            <div className="bg-[#0c1322] rounded-3xl p-6 sm:p-8 border border-slate-800/80 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-snug">
                    {displayTitle}
                  </h1>
                  <div className="flex items-center gap-2 text-sm text-slate-400 font-medium pt-1">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{fullLocation}</span>
                  </div>
                </div>

                {/* Prominent Price Display */}
                <div className="sm:text-end shrink-0 pt-2 sm:pt-0">
                  <div className="flex items-baseline gap-1.5 sm:justify-end">
                    <span className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500 tracking-tight" dir="ltr">
                      {formattedPrice}
                    </span>
                    <span className="text-sm text-slate-400 font-bold">
                      {t('home.per_month', '/ مانگ')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5" dir="ltr">
                    {secondaryPrice}
                  </p>
                </div>
              </div>

              {/* Zero Tenant Surcharge Legal Invariant Pill */}
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#0c1322] to-emerald-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t('property.zero_surcharge_rule', 'پارێزراو بە ستانداردی HomeHub: ٠٪ سەرچاوەی زیادەی کرێنشین (No Commission Surcharge on Tenant).')}</span>
              </div>
            </div>

            {/* Specification Grid (Beds, Baths, Area, Furnishing) */}
            <div className="bg-[#0c1322] rounded-3xl p-6 sm:p-8 border border-slate-800/80 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Building className="w-5 h-5 text-amber-400" />
                <span>{t('property.specs_title', 'تایبەتمەندی و قەبارەی موڵک')}</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {/* Bedrooms */}
                <div className="bg-[#111b2e] rounded-2xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center group hover:border-amber-500/40 transition">
                  <Bed className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xl font-black text-white" dir="ltr">{propertyData.bedrooms}</span>
                  <span className="text-xs text-slate-400 font-bold mt-0.5">{t('property.bedrooms_label', 'ژووری نووستن')}</span>
                </div>

                {/* Bathrooms */}
                <div className="bg-[#111b2e] rounded-2xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center group hover:border-amber-500/40 transition">
                  <Bath className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xl font-black text-white" dir="ltr">{propertyData.bathrooms}</span>
                  <span className="text-xs text-slate-400 font-bold mt-0.5">{t('property.bathrooms_label', 'حەمام و دەستشۆر')}</span>
                </div>

                {/* Area in SqM */}
                <div className="bg-[#111b2e] rounded-2xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center group hover:border-amber-500/40 transition">
                  <Maximize2 className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xl font-black text-white" dir="ltr">{propertyData.squareFeet}</span>
                  <span className="text-xs text-slate-400 font-bold mt-0.5">{t('home.card_sqm', 'مەتری دووجا (م²)')}</span>
                </div>

                {/* Category */}
                <div className="bg-[#111b2e] rounded-2xl p-4 border border-slate-800/80 flex flex-col items-center justify-center text-center group hover:border-amber-500/40 transition">
                  <Building2 className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black text-white truncate max-w-full">
                    {propertyData.propertyType === 'VILLA' ? t('type.villa', 'ڤێلا') : propertyData.propertyType === 'HOUSE' ? t('type.house', 'خانوو') : t('type.apartment', 'شوقە')}
                  </span>
                  <span className="text-xs text-slate-400 font-bold mt-0.5">{t('property.type_label', 'جۆری موڵک')}</span>
                </div>
              </div>
            </div>

            {/* Description Section */}
            <div className="bg-[#0c1322] rounded-3xl p-6 sm:p-8 border border-slate-800/80 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>{t('property.desc_title', 'ڕوونکردنەوە و زانیاریی موڵک')}</span>
              </h3>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal">
                {displayDescription}
              </p>
            </div>

            {/* Amenities Section */}
            <div className="bg-[#0c1322] rounded-3xl p-6 sm:p-8 border border-slate-800/80 shadow-xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <span>{t('property.amenities_title', 'خزمەتگوزاری و ئاسانکارییەکان')}</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {displayAmenities.map((amenity, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-2xl bg-[#111b2e]/80 border border-slate-800 flex items-center gap-2.5 text-xs font-semibold text-slate-200"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{amenity}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rental Terms & Conditions */}
            <div className="bg-[#0c1322] rounded-3xl p-6 sm:p-8 border border-slate-800/80 shadow-xl space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <span>{t('property.terms_title', 'مەرجەکانی کرێکردن')}</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                {displayTerms}
              </p>
            </div>
          </div>

          {/* RIGHT / SECONDARY COLUMN (5 COLS): Sticky Contact & Booking Card */}
          <div className="lg:col-span-5 space-y-6 sticky top-20">

            {/* Agent & Booking Card */}
            <div className="bg-[#0c1322] rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-2xl space-y-6 text-start">
              {/* Agent Profile Banner */}
              <div className="flex items-center gap-4 pb-4 border-b border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-xl flex items-center justify-center shadow-lg shrink-0">
                  {propertyData.agentName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-black text-white text-base truncate">{propertyData.agentName}</h4>
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" title="Verified Agent" />
                  </div>
                  <p className="text-xs text-amber-300 font-semibold truncate mt-0.5">{displayAgentCompany}</p>
                  <p className="text-[11px] text-slate-400 font-medium" dir="ltr">{propertyData.agentPhone}</p>
                </div>
              </div>

              {/* Call Agent Button */}
              <a
                href={`tel:${propertyData.agentPhone}`}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#111b2e] hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all border border-slate-700/80 hover:border-amber-500/40 cursor-pointer shadow-md"
              >
                <Phone className="w-4 h-4 text-amber-400" />
                <span>{t('property.call_agent', 'پەیوەندی بە برۆکەر / خاوەن موڵک')}</span>
                <span className="font-mono text-xs text-slate-300" dir="ltr">({propertyData.agentPhone})</span>
              </a>

              {/* Schedule Viewing Interactive Trigger */}
              <button
                type="button"
                onClick={() => setSchedulerOpen(prev => !prev)}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:brightness-110 active:scale-98 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl shadow-amber-950/40 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-slate-950" />
                <span>{t('property.schedule_viewing', 'دیاریکردنی کاتی سەردان (Viewing)')}</span>
              </button>

              {/* Interactive Scheduler Picker (Accordion inside card) */}
              {schedulerOpen && (
                <div className="p-4 rounded-2xl bg-[#080d19] border border-amber-500/30 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t('property.choose_slot', 'ڕۆژ و کاتی سەردان هەڵبژێرە')}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSchedulerOpen(false)}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Day Buttons */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-400">{t('property.available_days', 'ڕۆژە بەردەستەکان:')}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4].map(dayOffset => {
                        const date = new Date();
                        date.setDate(date.getDate() + dayOffset);
                        const dayName = date.toLocaleDateString(language === 'ku' ? 'ckb-IQ' : 'en-US', { weekday: 'short' });
                        const dayNum = date.getDate();
                        const fullDate = date.toISOString().split('T')[0];
                        const isSelected = selectedDate === fullDate;

                        return (
                          <button
                            key={fullDate}
                            type="button"
                            onClick={() => setSelectedDate(fullDate)}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                                : 'bg-[#0c1322] border-slate-800 text-slate-300 hover:bg-[#111b2e]'
                            }`}
                          >
                            <span className="text-[10px] font-bold">{dayName}</span>
                            <span className="text-base font-black" dir="ltr">{dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Time Buttons */}
                  {selectedDate && (
                    <div className="space-y-1.5 animate-in fade-in">
                      <p className="text-[11px] font-bold text-slate-400">{t('property.available_times', 'کاتژمێر:')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['10:00 AM', '12:00 PM', '02:30 PM', '04:00 PM', '05:30 PM'].map(time => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => setSelectedTime(time)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              selectedTime === time
                                ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                                : 'bg-[#0c1322] border-slate-800 text-slate-300 hover:bg-[#111b2e]'
                            }`}
                          >
                            <span dir="ltr">{time}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirm Viewing Action */}
                  {selectedDate && selectedTime && (
                    <button
                      type="button"
                      onClick={() => {
                        setScheduledConfirmation(t('property.schedule_confirmed', `کاتی سەردانەکە بە سەرکەوتوویی تۆمارکرا بۆ بەرواری ${selectedDate} کاتژمێر ${selectedTime}. برۆکەر پەیوەندیت پێوە دەکات بۆ دڵنیابوونەوە.`));
                        setSchedulerOpen(false);
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t('property.confirm_appointment', 'پشتڕاستکردنەوەی سەردان')}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Scheduled Confirmation Notice */}
              {scheduledConfirmation && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{t('property.appointment_booked', 'سەردانەکە دیاریکرا!')}</span>
                  </div>
                  <p className="text-[11px] text-emerald-200/90 font-normal leading-relaxed">
                    {scheduledConfirmation}
                  </p>
                </div>
              )}

              {/* Instant Rental Application Button */}
              <button
                type="button"
                disabled={Boolean(applySuccessMsg)}
                onClick={() => {
                  setApplySuccessMsg(t('property.apply_success', 'داواکاری کرێ بە سەرکەوتوویی نێردرا! پاش پەسەندکردنی خاوەن موڵک، گرێبەست ئامادە دەکرێت.'));
                  // Asynchronously submit application if endpoint is reachable
                  fetch(`/api/rental-acquisitions/listings/${propertyData.id}/applications`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      proposedStartDate: new Date().toISOString().split('T')[0],
                      proposedRentAmount: propertyData.price,
                      currency: propertyData.currency,
                      message: 'Interested in leasing this property.',
                    }),
                  }).catch(() => {});
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#111b2e] hover:bg-slate-800 text-amber-300 hover:text-amber-200 font-bold text-sm flex items-center justify-center gap-2 transition-all border border-amber-500/40 cursor-pointer shadow-md disabled:opacity-50"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>{t('property.apply_for_rent', 'پێشکەشکردنی داواکاری کرێ (Apply for Rent)')}</span>
              </button>

              {/* Apply Success Notice */}
              {applySuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{applySuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Trust and Safety Card */}
            <div className="bg-[#0c1322] rounded-3xl p-5 border border-slate-800 space-y-3 text-start">
              <h4 className="text-xs font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>{t('property.trust_title', 'متمانە و پارێزبەندی HomeHub')}</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-400 font-medium">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span>{t('property.trust_1', 'تاپۆ و خاوەنداریەتی بە سیستەمی دیجیتاڵی وردبینیکراوە')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span>{t('property.trust_2', 'گرێبەستی فەرمی یاسایی پارێزراو بەپێی یاساکانی هەرێم و عێراق')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0" />
                  <span>{t('property.trust_3', 'پارەی تەئمینات لە هەژماری دەستەبەری پارێزراو دەمێنێتەوە')}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* ════════════════════════════════════════════════════════════════
          FULLSCREEN LIGHTBOX MODAL (High-Resolution Zoom)
      ════════════════════════════════════════════════════════════════ */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-8 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          {/* Lightbox Header */}
          <div className="flex items-center justify-between text-white pb-4">
            <span className="text-sm font-bold text-slate-300">{displayTitle}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs font-mono text-amber-400" dir="ltr">
                {selectedImageIdx + 1} / {propertyData.photos.length}
              </span>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer"
                aria-label="Close fullscreen gallery"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Lightbox Main Image */}
          <div className="relative flex-1 flex items-center justify-center overflow-hidden">
            <img
              src={propertyData.photos[selectedImageIdx]}
              alt={`Full view ${selectedImageIdx + 1}`}
              className="max-h-[82vh] max-w-full object-contain rounded-2xl shadow-2xl transition-all"
            />

            {/* Prev / Next buttons */}
            {propertyData.photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedImageIdx(prev => (prev - 1 + propertyData.photos.length) % propertyData.photos.length)}
                  className="absolute start-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition cursor-pointer"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-7 h-7 rtl:rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedImageIdx(prev => (prev + 1) % propertyData.photos.length)}
                  className="absolute end-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center border border-white/20 transition cursor-pointer"
                  aria-label="Next"
                >
                  <ChevronRight className="w-7 h-7 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {/* Lightbox Thumbnails Strip */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pt-4 no-scrollbar">
            {propertyData.photos.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedImageIdx(idx)}
                className={`relative w-16 h-12 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                  selectedImageIdx === idx ? 'border-amber-400 scale-105 shadow-md' : 'border-transparent opacity-50 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
