import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Calendar,
  MapPin,
  Building2,
  Home,
  DollarSign,
  Filter,
  Eye,
  Phone,
  MessageSquare,
  Heart,
  Share2,
  Sparkles,
  SlidersHorizontal,
  X,
  CheckCircle2,
  Star,
  Wrench,
  UserCheck,
  Bed,
  Bath,
  Maximize2,
  Compass,
  ArrowRight,
  Shield,
  ExternalLink,
  Map as MapIcon,
  Grid,
  Globe,
  ChevronLeft,
  ChevronRight,
  Scale,
  Trash2,
  ArrowRightLeft,
  FileText,
  Tag,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useI18n, SupportedLanguage } from '../i18n/I18nProvider';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { FeatureFlags } from '../utils/featureFlags.js';
import { SponsoredRentalPlacements } from '../components/promotions/SponsoredRentalPlacements';

// Fix Leaflet's default icon paths in React
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// Comprehensive data model for properties, services, and agencies with full trilingual support
interface PropertyItem {
  id: string;
  type: 'sale' | 'rent';
  category: 'apartment' | 'villa' | 'commercial' | 'land';
  titleKu: string;
  titleEn: string;
  titleAr: string;
  cityKu: string;
  cityEn: string;
  cityAr: string;
  areaKu: string;
  areaEn: string;
  areaAr: string;
  priceUsd: number;
  priceIqd: string;
  period?: 'month' | 'year';
  bedrooms: number;
  bathrooms: number;
  sizeM2: number;
  verified: boolean;
  featured?: boolean;
  isPromoted?: boolean;
  promotionType?: string | null;
  imageUrl: string;
  additionalImages?: string[];
  descriptionKu: string;
  descriptionEn: string;
  descriptionAr: string;
  amenitiesKu: string[];
  amenitiesEn: string[];
  amenitiesAr: string[];
  amenities: string[];
  agentName: string;
  agentPhone: string;
  agentCompany: string;
}

interface ServiceProviderItem {
  id: string;
  nameKu: string;
  nameEn: string;
  nameAr: string;
  serviceKu: string;
  serviceEn: string;
  serviceAr: string;
  cityKu: string;
  cityEn: string;
  cityAr: string;
  rating: number;
  reviewsCount: number;
  phone: string;
  verified: boolean;
  avatarUrl: string;
  experienceYears: number;
}

interface AgencyItem {
  id: string;
  nameKu: string;
  nameEn: string;
  nameAr: string;
  cityKu: string;
  cityEn: string;
  cityAr: string;
  locationKu: string;
  locationEn: string;
  locationAr: string;
  activeListings: number;
  phone: string;
  verified: boolean;
  logoUrl: string;
}

// Curated verified properties across Kurdistan with full English, Kurdish, and Arabic metadata
const PROPERTIES_DATA: PropertyItem[] = [
  {
    id: 'prop-1',
    type: 'sale',
    category: 'villa',
    titleEn: 'Luxury Modern Villa in Dream City',
    titleKu: 'ڤێلای مۆدێرنی شاهانە لە دریم سیتی',
    titleAr: 'فيلا مودرن فاخرة في دريم سيتي',
    cityEn: 'Erbil',
    cityKu: 'هەولێر',
    cityAr: 'أربيل',
    areaEn: 'Dream City',
    areaKu: 'دریم سیتی',
    areaAr: 'دريم سيتي',
    priceUsd: 420000,
    priceIqd: '546,000,000 IQD',
    bedrooms: 5,
    bathrooms: 4,
    sizeM2: 320,
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    descriptionEn: 'Exceptional standalone villa featuring private landscaped garden, smart home automation, and Italian marble finishes with verified official title deed.',
    descriptionKu: 'ڤێلای جیاوازی سەربەخۆ بە باخچەی تایبەت، سیستەمی هۆشمەندی تەواو و مەڕمەڕی ئیتاڵی بە تاپۆی فەرمی پشتڕاستکراوەوە.',
    descriptionAr: 'فيلا مستقلة استثنائية مع حديقة خاصة ونظام المنزل الذكي وتشطيبات رخام إيطالي مع طابو رسمي موثق.',
    amenitiesEn: ['24/7 Security', 'Private Parking', 'Smart Home', 'Power Generator'],
    amenitiesKu: ['پاسەوانی ٢٤/٧', 'گەراجی تایبەت', 'ماڵی هۆشمەند', 'مۆلیدەی بەردەوام'],
    amenitiesAr: ['حراسة 24/7', 'كراج خاص', 'منزل ذكي', 'مولدة كهرباء مستمرة'],
    amenities: ['24/7 Security', 'Private Parking', 'Smart Home', 'Power Generator'],
    agentName: 'Rawa Azad',
    agentPhone: '+964 750 445 1122',
    agentCompany: 'Empire Real Estate Group',
  },
  {
    id: 'prop-2',
    type: 'rent',
    category: 'apartment',
    titleEn: 'Executive High-Floor Apartment in Empire World',
    titleKu: 'شوقەی بەڕێوەبەری لە نهۆمی باڵای ئیمپایەر وۆرڵد',
    titleAr: 'شقة تنفيذية فاخرة في الطوابق العليا بإمباير وورلد',
    cityEn: 'Erbil',
    cityKu: 'هەولێر',
    cityAr: 'أربيل',
    areaEn: 'Empire World',
    areaKu: 'ئیمپایەر وۆرڵد',
    areaAr: 'إمباير وورلد',
    priceUsd: 1600,
    priceIqd: '2,080,000 IQD',
    period: 'month',
    bedrooms: 3,
    bathrooms: 2,
    sizeM2: 185,
    verified: true,
    featured: true,
    imageUrl: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
    descriptionEn: 'Fully furnished luxury apartment offering panoramic city views, underground parking, and premier 24/7 concierge security.',
    descriptionKu: 'شوقەی کەلوپەل تەواوی شاهانە بە دیمەنی پانۆرامایی شار، گەراجی ژێرزەمین و پاسەوانی ٢٤/٧ی تایبەت.',
    descriptionAr: 'شقة مفروشة بالكامل بإطلالة بانورامية رائعة على المدينة مع كراج سفلي وخدمة استقبال وأمن على مدار الساعة.',
    amenitiesEn: ['High-Speed Elevators', 'Gym & Fitness', 'Underground Parking', '24/7 Concierge'],
    amenitiesKu: ['ئەسانسۆری خێرا', 'هۆڵی وەرزش', 'گەراجی ژێرزەمین', 'پاسەوانی ٢٤/٧'],
    amenitiesAr: ['مصاعد سريعة', 'نادي رياضي', 'موقف تحت الأرض', 'خدمة استقبال 24/7'],
    amenities: ['High-Speed Elevators', 'Gym & Fitness', 'Underground Parking', '24/7 Concierge'],
    agentName: 'Zanyar Soran',
    agentPhone: '+964 750 912 8844',
    agentCompany: 'Kurdistan Premier Living',
  },
  {
    id: 'prop-3',
    type: 'sale',
    category: 'apartment',
    titleEn: 'Contemporary Family Home in Sarchinar',
    titleKu: 'خانووی مۆدێرنی خێزانی لە سەرچنار',
    titleAr: 'منزل عائلي معاصر في سرجنار',
    cityEn: 'Sulaymaniyah',
    cityKu: 'سلێمانی',
    cityAr: 'السليمانية',
    areaEn: 'Sarchinar',
    areaKu: 'سەرچنار',
    areaAr: 'سرجنار',
    priceUsd: 195000,
    priceIqd: '253,500,000 IQD',
    bedrooms: 4,
    bathrooms: 3,
    sizeM2: 220,
    verified: true,
    imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
    descriptionEn: 'Spacious two-story residence with modern architectural layout, close to prime amenities and scenic surroundings with verified title.',
    descriptionKu: 'خانووی فراوانی دوو نهۆمی بە دیزاینی تەلارسازی مۆدێرن، نزیک لە هەموو خزمەتگوزارییە سەرەکییەکان بە تاپۆی مسۆگەر.',
    descriptionAr: 'منزل واسع من طابقين بتصميم معماري حديث بالقرب من كافة الخدمات والمرافق الحيوية مع طابو رسمي موثق.',
    amenitiesEn: ['Balcony with View', 'Dedicated Garage', 'Solar Heating', 'Near Parks'],
    amenitiesKu: ['باڵکۆن بە دیمەنی سەرنجڕاکێش', 'گەراجی تایبەت', 'گەرمکەری ڕۆژ', 'نزیک باخچە'],
    amenitiesAr: ['شرفة بإطلالة', 'كراج خاص', 'طاقة شمسية', 'قريب من المتنزهات'],
    amenities: ['Balcony with View', 'Dedicated Garage', 'Solar Heating', 'Near Parks'],
    agentName: 'Hana Kamal',
    agentPhone: '+964 770 334 5566',
    agentCompany: 'Goyzha Property Consultants',
  },
  {
    id: 'prop-4',
    type: 'sale',
    category: 'villa',
    titleEn: 'Panoramic Mountain View Villa in Duhok',
    titleKu: 'ڤێلای شاهانە بە دیمەنی چیایی لە دهۆک',
    titleAr: 'فيلا فاخرة بإطلالة جبلية في دهوك',
    cityEn: 'Duhok',
    cityKu: 'دهۆک',
    cityAr: 'دهوك',
    areaEn: 'Masik',
    areaKu: 'ماسیک',
    areaAr: 'ماسيك',
    priceUsd: 350000,
    priceIqd: '455,000,000 IQD',
    bedrooms: 4,
    bathrooms: 3,
    sizeM2: 280,
    verified: true,
    imageUrl: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
    descriptionEn: 'Stunning mountain-view villa with landscaped terrace, premium central heating, and official verified Tapu registration.',
    descriptionKu: 'ڤێلای سەرنجڕاکێش بە باڵکۆنی گەورە و دیمەنی چیا، سیستەمی بویلەری پێشکەوتوو و تاپۆی فەرمی دەوڵەت.',
    descriptionAr: 'فيلا رائعة بإطلالة جبلية خلابة مع شرفة واسعة ومنظومة تدفئة متطورة وطابو رسمي موثق.',
    amenitiesEn: ['Mountain View', 'Private Garden', 'Central Heating', '24/7 Security'],
    amenitiesKu: ['دیمەنی چیا', 'باخچەی تایبەت', 'سیستەمی گەرمکەر', 'پاسەوانی ٢٤/٧'],
    amenitiesAr: ['إطلالة جبلية', 'حديقة خاصة', 'تدفئة مركزية', 'أمن وحراسة'],
    amenities: ['Mountain View', 'Private Garden', 'Central Heating', '24/7 Security'],
    agentName: 'Diyar Barzani',
    agentPhone: '+964 750 678 9012',
    agentCompany: 'Duhok Elite Properties',
  },
  {
    id: 'prop-5',
    type: 'sale',
    category: 'villa',
    titleEn: 'Modern Duplex Villa in Italian Village 1',
    titleKu: 'ڤێلای دوپڵێکسی مۆدێرن لە گوندی ئیتاڵی ١',
    titleAr: 'فيلا دوبلكس حديثة في القرية الإيطالية 1',
    cityEn: 'Erbil',
    cityKu: 'هەولێر',
    cityAr: 'أربيل',
    areaEn: 'Italian Village 1',
    areaKu: 'گوندی ئیتاڵی ١',
    areaAr: 'القرية الإيطالية 1',
    priceUsd: 265000,
    priceIqd: '344,500,000 IQD',
    bedrooms: 4,
    bathrooms: 3,
    sizeM2: 200,
    verified: true,
    imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    descriptionEn: 'Well-maintained modern duplex in a gated master-planned community with round-the-clock security and peaceful surroundings.',
    descriptionKu: 'ڤێلای مۆدێرنی دوپڵێکس لە کۆمەڵگەیەکی ئارام و پاسەوانیکراوی بەردەوام بە هەموو پێداویستییە مۆدێرنەکانەوە.',
    descriptionAr: 'فيلا دوبلكس حديثة في مجمع سكني مغلق وآمن مع حراسة مستمرة وخدمات متكاملة.',
    amenitiesEn: ['Gated Community', 'Kids Playground', 'Backup Generator', 'Carport'],
    amenitiesKu: ['کۆمەڵگەی پاسەوانیکراو', 'یاریگای منداڵان', 'مۆلیدەی گەڕەک', 'گەراجی داپۆشراو'],
    amenitiesAr: ['مجمع مغلق', 'منطقة ألعاب أطفال', 'مولدة كهرباء', 'موقف مظلل'],
    amenities: ['Gated Community', 'Kids Playground', 'Backup Generator', 'Carport'],
    agentName: 'Sarmad Jalal',
    agentPhone: '+964 750 332 1199',
    agentCompany: 'Shahana Real Estate',
  },
  {
    id: 'prop-6',
    type: 'rent',
    category: 'apartment',
    titleEn: 'Chic Furnished Studio in Downtown Sulaymaniyah',
    titleKu: 'ستۆدیۆی شیکی کەلوپەلدار لە ناوەندی شاری سلێمانی',
    titleAr: 'استوديو أنيق ومفروش في وسط مدينة السليمانية',
    cityEn: 'Sulaymaniyah',
    cityKu: 'سلێمانی',
    cityAr: 'السليمانية',
    areaEn: 'Salim Street',
    areaKu: 'شەقامی سەالم',
    areaAr: 'شارع سالم',
    priceUsd: 650,
    priceIqd: '845,000 IQD',
    period: 'month',
    bedrooms: 1,
    bathrooms: 1,
    sizeM2: 75,
    verified: true,
    imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
    descriptionEn: 'Stylish and cozy studio apartment ideal for professionals, within walking distance of cafes, markets, and transit.',
    descriptionKu: 'شوقەی ستۆدیۆی قەشەنگ و کەلوپەلدار گونجاو بۆ کارمەندان، نزیک لە بازاڕ، کافێ و هەموو هۆکارەکانی گواستنەوە.',
    descriptionAr: 'استوديو عصري وأنيق ومفروش بالكامل ومناسب للمهنيين، على مقربة من الأسواق والمقاهي ووسائل النقل.',
    amenitiesEn: ['Fully Furnished', 'High-Speed Wi-Fi', 'AC & Heating', 'Elevator'],
    amenitiesKu: ['کەلوپەلی تەواو', 'ئینتەرنێتی خێرا', 'سپلیت و گەرمکەر', 'ئەسانسۆر'],
    amenitiesAr: ['مفروش بالكامل', 'إنترنت سريع', 'تكييف وتدفئة', 'مصعد'],
    amenities: ['Fully Furnished', 'High-Speed Wi-Fi', 'AC & Heating', 'Elevator'],
    agentName: 'Lina Sherzad',
    agentPhone: '+964 770 120 4488',
    agentCompany: 'HomeHub Verified Services',
  },
];

const SERVICE_PROVIDERS_DATA: ServiceProviderItem[] = [
  {
    id: 'srv-1',
    nameKu: 'وەستا ئەحمەد کارەباچی',
    nameEn: 'Master Ahmed Electrical Services',
    nameAr: 'الأسطى أحمد للأعمال الكهربائية',
    serviceKu: 'دامەزراندن و چاکسازی کارەبای ماڵان و بینا',
    serviceEn: 'Residential & commercial electrical installation, lighting & wiring',
    serviceAr: 'تركيب وصيانة كهرباء المنازل والمباني والإنارة والتأسيس',
    cityKu: 'هەولێر',
    cityEn: 'Erbil',
    cityAr: 'أربيل',
    rating: 4.9,
    reviewsCount: 142,
    phone: '+964 750 812 3456',
    verified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=200&q=80',
    experienceYears: 12,
  },
  {
    id: 'srv-2',
    nameKu: 'تیمی پڕۆفیشناڵی سپلیت و فێنککەرەوە',
    nameEn: 'Pro HVAC & AC Cooling Team',
    nameAr: 'فريق صيانة أجهزة التكييف والتبريد',
    serviceKu: 'پاککردنەوە و گاز تێکردن و چاکسازی سپلیت',
    serviceEn: 'AC cleaning, gas recharge, compressor & cooling repair',
    serviceAr: 'تنظيف وشحن غاز وصيانة أجهزة السبلت والتبريد',
    cityKu: 'هەولێر و سلێمانی',
    cityEn: 'Erbil & Sulaymaniyah',
    cityAr: 'أربيل والسليمانية',
    rating: 4.8,
    reviewsCount: 98,
    phone: '+964 750 994 1122',
    verified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=200&q=80',
    experienceYears: 8,
  },
  {
    id: 'srv-3',
    nameKu: 'وەستا کامەران بۆریوان',
    nameEn: 'Master Kamaran Plumbing & Heating',
    nameAr: 'الأسطى كامران للسباكة والتدفئة',
    serviceKu: 'تەئسیساتی ئاو، ئاوەڕۆ و سیستەمی بویلەر',
    serviceEn: 'Water supply, drainage piping & central heating boiler maintenance',
    serviceAr: 'تأسيسات المياه والصرف الصحي وصيانة منظومات السخانات والتدفئة',
    cityKu: 'سلێمانی',
    cityEn: 'Sulaymaniyah',
    cityAr: 'السليمانية',
    rating: 4.9,
    reviewsCount: 84,
    phone: '+964 770 432 7788',
    verified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    experienceYears: 15,
  },
  {
    id: 'srv-4',
    nameKu: 'ستۆدیۆی هۆم دیکۆر بۆ دیزاینی ناوەوە',
    nameEn: 'Home Decor Modern Interior Studio',
    nameAr: 'استوديو هوم ديكور للتصميم الداخلي الحديث',
    serviceKu: 'دیزاینی 3D، بەردی مەڕمەڕ، گەچ و بۆیاخی سەردەمیانە',
    serviceEn: '3D architectural interior design, Italian marble, gypsum & luxury painting',
    serviceAr: 'تصميم داخلي ثلاثي الأبعاد، رخام، جبس، وتشطيبات ديكور فاخرة',
    cityKu: 'هەولێر',
    cityEn: 'Erbil',
    cityAr: 'أربيل',
    rating: 5.0,
    reviewsCount: 65,
    phone: '+964 750 223 9900',
    verified: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    experienceYears: 9,
  },
];

const AGENCIES_DATA: AgencyItem[] = [
  {
    id: 'agn-1',
    nameKu: 'کۆمپانیای شاهانە بۆ خانوبەرە',
    nameEn: 'Shahana Real Estate Group',
    nameAr: 'شركة شاهانة للمقاولات والعقارات',
    cityKu: 'هەولێر',
    cityEn: 'Erbil',
    cityAr: 'أربيل',
    locationKu: 'شەقامی 100 مەتری، تەنیشت فامیلی مۆڵ',
    locationEn: '100m Ring Road, Next to Family Mall',
    locationAr: 'شارع 100 متري، بجانب فاميلي مول',
    activeListings: 184,
    phone: '+964 750 445 8899',
    verified: true,
    logoUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'agn-2',
    nameKu: 'ئیمپایەر پراپەرتیز نێودەوڵەتی',
    nameEn: 'Empire Properties International',
    nameAr: 'إمباير بروبرتيز العالمية للاستثمار العقاري',
    cityKu: 'هەولێر',
    cityEn: 'Erbil',
    cityAr: 'أربيل',
    locationKu: 'ئیمپایەر وۆرڵد، تاوەری ڕۆیاڵ',
    locationEn: 'Empire World, Royal Tower, Floor 8',
    locationAr: 'إمباير وورلد، البرج الملكي، الطابق 8',
    activeListings: 240,
    phone: '+964 750 123 4567',
    verified: true,
    logoUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'agn-3',
    nameKu: 'کۆمپانیای گۆیژە بۆ خانووبەرە',
    nameEn: 'Goyzha Premier Real Estate',
    nameAr: 'شركة گویژة المتميزة للعقارات',
    cityKu: 'سلێمانی',
    cityEn: 'Sulaymaniyah',
    cityAr: 'السليمانية',
    locationKu: 'شەقامی بازنەیی مەولەوی',
    locationEn: 'Mawlawi Circular Blvd, Downtown',
    locationAr: 'شارع مولوي الدائري، وسط المدينة',
    activeListings: 115,
    phone: '+964 770 987 6543',
    verified: true,
    logoUrl: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=200&q=80',
  },
];

// Helper to choose localized text based on active language
const getLoc = (lang: SupportedLanguage, ku: string, en?: string, ar?: string): string => {
  if (lang === 'en' && en) return en;
  if (lang === 'ar' && ar) return ar;
  if (lang === 'ku' && ku) return ku;
  return en || ku || ar || '';
};

const getCityName = (cityKey: string, lang: SupportedLanguage): string => {
  const c = cityKey.toLowerCase();
  if (c.includes('erbil') || c.includes('هەولێر') || c.includes('أربيل')) {
    return lang === 'en' ? 'Erbil' : lang === 'ar' ? 'أربيل' : 'هەولێر';
  }
  if (c.includes('sulaymaniyah') || c.includes('سلێمانی') || c.includes('السليمانية')) {
    return lang === 'en' ? 'Sulaymaniyah' : lang === 'ar' ? 'السليمانية' : 'سلێمانی';
  }
  if (c.includes('duhok') || c.includes('دهۆک') || c.includes('دهوك')) {
    return lang === 'en' ? 'Duhok' : lang === 'ar' ? 'دهوك' : 'دهۆک';
  }
  if (c.includes('kirkuk') || c.includes('کەرکووک') || c.includes('كركوك')) {
    return lang === 'en' ? 'Kirkuk' : lang === 'ar' ? 'كركوك' : 'کەرکووک';
  }
  return cityKey;
};

const getNeighborhoodData = (id: string, t: any) => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const getScore = (offset: number) => 5 + ((hash + offset) % 6); // Score between 5 and 10
  
  return [
    { subject: t('marketplace.insights.schools', 'Schools'), A: getScore(1), fullMark: 10 },
    { subject: t('marketplace.insights.safety', 'Safety'), A: getScore(2), fullMark: 10 },
    { subject: t('marketplace.insights.transport', 'Transport'), A: getScore(3), fullMark: 10 },
    { subject: t('marketplace.insights.shopping', 'Shopping'), A: getScore(4), fullMark: 10 },
    { subject: t('marketplace.insights.quietness', 'Quietness'), A: getScore(5), fullMark: 10 },
  ];
};

const formatIqdDisplay = (usdPrice: number, lang: SupportedLanguage): string => {
  const iqd = Math.round(usdPrice * 1300);
  const formatted = iqd.toLocaleString();
  if (lang === 'en') return `${formatted} IQD`;
  return `${formatted} د.ع`;
};

const getSocialProof = (id: string) => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const viewers = (hash % 6) + 1; // 1 to 6 people
  const isHot = hash % 3 === 0; // Every 3rd property is "hot"
  const hoursAgo = (hash % 48) + 1; // 1 to 48 hours ago
  return { viewers, isHot, hoursAgo };
};

const getPropertyCoords = (prop: PropertyItem): [number, number] => {
  // Deterministic pseudo-random offset based on ID length & characters
  const hash = prop.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const offsetLat = (hash % 100) * 0.0005 - 0.025;
  const offsetLng = ((hash * 7) % 100) * 0.0005 - 0.025;
  
  const c = prop.cityEn.toLowerCase();
  if (c === 'erbil') return [36.1901 + offsetLat, 44.0090 + offsetLng];
  if (c === 'sulaymaniyah') return [35.5558 + offsetLat, 45.4351 + offsetLng];
  if (c === 'duhok') return [36.8679 + offsetLat, 42.9489 + offsetLng];
  return [36.1901 + offsetLat, 44.0090 + offsetLng]; // Default Erbil
};

interface SearchExplorerPageProps {
  defaultDomain?: 'all' | 'sale' | 'rent';
  domainMode?: 'all' | 'rent-only' | 'sale-only';
}

export const SearchExplorerPage: React.FC<SearchExplorerPageProps> = ({ defaultDomain = 'all', domainMode = 'all' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, language, direction, setLanguage } = useI18n();

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const initialTab = domainMode === 'rent-only' ? 'rent' : domainMode === 'sale-only' ? 'sale' : (defaultDomain === 'sale' && !FeatureFlags.BUY_SELL_ENABLED) ? 'all' : defaultDomain;
  const [activeTab, setActiveTab] = useState<'all' | 'sale' | 'rent' | 'apartments' | 'villas' | 'services' | 'agencies'>(initialTab);

  useEffect(() => {
    if (domainMode === 'rent-only') {
      setActiveTab('rent');
    } else if (domainMode === 'sale-only') {
      setActiveTab('sale');
    } else if (defaultDomain) {
      setActiveTab((defaultDomain === 'sale' && !FeatureFlags.BUY_SELL_ENABLED) ? 'all' : defaultDomain);
    }
  }, [defaultDomain, domainMode]);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [bedroomsFilter, setBedroomsFilter] = useState<number | 'all'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [showFiltersModal, setShowFiltersModal] = useState<boolean>(false);

  // Sync incoming search query parameters (from Homepage search bar)
  useEffect(() => {
    const q = searchParams.get('q');
    const propertyType = searchParams.get('propertyType');
    const priceRange = searchParams.get('priceRange');
    const beds = searchParams.get('bedrooms');

    if (q) setSearchQuery(q);

    if (propertyType && propertyType !== 'all') {
      const lower = propertyType.toLowerCase();
      if (lower.includes('apartment')) {
        setSelectedCategory('apartment');
        setActiveTab('apartments');
      } else if (lower.includes('villa')) {
        setSelectedCategory('villa');
        setActiveTab('villas');
      } else {
        setActiveTab(domainMode === 'rent-only' ? 'rent' : 'all');
        if (lower.includes('warehouse') || lower.includes('storage') || lower.includes('industrial')) setSelectedCategory('warehouse');
        else if (lower.includes('house') || lower.includes('single_family')) setSelectedCategory('house');
        else if (lower.includes('commercial')) setSelectedCategory('commercial');
        else if (lower.includes('studio')) setSelectedCategory('studio');
        else if (lower.includes('office')) setSelectedCategory('office');
        else if (lower.includes('duplex')) setSelectedCategory('duplex');
        else if (lower.includes('residential') || lower.includes('building')) setSelectedCategory('residential');
        else setSelectedCategory('all');
      }
    } else {
      setSelectedCategory('all');
      setActiveTab(domainMode === 'rent-only' ? 'rent' : 'all');
    }

    if (priceRange && priceRange !== 'all') {
      if (priceRange === 'under-500') {
        setMinPrice('');
        setMaxPrice('500');
      } else if (priceRange === '500-1000') {
        setMinPrice('500');
        setMaxPrice('1000');
      } else if (priceRange === '1000-2000') {
        setMinPrice('1000');
        setMaxPrice('2000');
      } else if (priceRange === '2000-plus') {
        setMinPrice('2000');
        setMaxPrice('');
      }
    }

    if (beds && beds !== 'all') {
      const num = parseInt(beds, 10);
      if (!isNaN(num)) {
        setBedroomsFilter(num);
      }
    }
  }, [searchParams]);

  // Favorites in localStorage for guests
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('homehub_guest_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Selected item modal for in-depth inspection
  const [selectedProperty, setSelectedProperty] = useState<PropertyItem | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState<number>(0);
  const [contactSuccessMsg, setContactSuccessMsg] = useState<string | null>(null);
  const [applySuccessMsg, setApplySuccessMsg] = useState<string | null>(null);
  const [showScheduler, setShowScheduler] = useState<boolean>(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  
  // Property Comparison
  const [compareList, setCompareList] = useState<PropertyItem[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);

  const toggleCompare = (prop: PropertyItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompareList(prev => {
      const exists = prev.find(p => p.id === prop.id);
      if (exists) return prev.filter(p => p.id !== prop.id);
      if (prev.length >= 3) return prev; // Max 3 items
      return [...prev, prop];
    });
  };

  // AI Search Assistant
  const [aiSearchMode, setAiSearchMode] = useState<boolean>(false);
  const [isAiSearching, setIsAiSearching] = useState<boolean>(false);

  const handleAiSearch = (query: string) => {
    if (!query.trim()) return;
    setIsAiSearching(true);
    
    // Simulate AI thinking and applying filters
    setTimeout(() => {
      const q = query.toLowerCase();
      
      // Reset filters first
      setActiveTab('all');
      setSelectedCategory('all');
      setBedroomsFilter('all');
      setSelectedCity('all');
      setMaxPrice('');
      setSearchQuery('');
      
      if (q.includes('rent') || q.includes('month')) {
        setActiveTab('rent');
      } else if (q.includes('buy') || q.includes('sale')) {
        setActiveTab('sale');
      }
      
      if (q.includes('villa') || q.includes('house')) {
        setSelectedCategory('villas');
      } else if (q.includes('apartment') || q.includes('flat')) {
        setSelectedCategory('apartments');
      }
      
      if (q.includes('erbil')) {
        setSelectedCity('Erbil');
      } else if (q.includes('sulaymaniyah') || q.includes('سلێمانی')) {
        setSelectedCity('Sulaymaniyah');
      } else if (q.includes('duhok')) {
        setSelectedCity('Duhok');
      }
      
      const bedMatch = q.match(/(\d+)\s*(?:bed|bedroom)/);
      if (bedMatch && bedMatch[1]) {
        setBedroomsFilter(Math.min(4, parseInt(bedMatch[1], 10)));
      }
      
      const priceMatch = q.match(/(?:under|<|\$)\s*(\d+)/) || q.match(/(\d+)\s*(?:\$|usd|dollar)/);
      if (priceMatch && priceMatch[1]) {
        setMaxPrice(priceMatch[1]);
      }
      
      // Pass remaining keywords to standard search
      const extras = [];
      if (q.includes('garage')) extras.push('garage');
      if (q.includes('pool')) extras.push('pool');
      if (extras.length > 0) setSearchQuery(extras.join(' '));
      
      setIsAiSearching(false);
    }, 1200);
  };

  const [liveProperties, setLiveProperties] = useState<PropertyItem[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPromises = [];
    
    if (domainMode !== 'sale-only') {
      fetchPromises.push(
        fetch('/api/marketplace/listings/search?type=RENT&limit=100').then(r => {
          if (!r.ok) throw new Error(`HTTP_${r.status}`);
          return r.json();
        })
      );
    }

    if (FeatureFlags.BUY_SELL_ENABLED && domainMode !== 'rent-only') {
      fetchPromises.push(
        fetch('/api/marketplace/listings/search?type=SALE').then(r => {
          if (!r.ok) throw new Error(`HTTP_${r.status}`);
          return r.json();
        })
      );
    }

    Promise.all(fetchPromises)
      .then((results) => {
        const rentData = domainMode === 'sale-only' ? { items: [] } : results[0];
        const saleData = (FeatureFlags.BUY_SELL_ENABLED && domainMode !== 'rent-only') ? results[domainMode === 'sale-only' ? 0 : 1] : { items: [] };
        const allItems = [...(saleData?.items || []), ...(rentData?.items || [])];
        if (allItems.length > 0) {
          const parseAddr = (addr: any) => {
            if (!addr) return {};
            if (typeof addr === 'object') return addr;
            try { return JSON.parse(addr); } catch { return { city: 'Erbil', street: String(addr) }; }
          };

          const mapped: PropertyItem[] = allItems.map((item: any) => {
            const addrObj = parseAddr(item.property?.address);
            const rawCity = addrObj.city || (typeof item.property?.address === 'string' && item.property.address.includes('city=') ? (item.property.address.match(/city=([^;@}]+)/)?.[1] || 'Erbil') : 'Erbil');
            const rawArea = addrObj.neighborhood || addrObj.street || 'City Center';
            const price = Number(item.price) || 0;
            const isIqd = item.currency === 'IQD' || price > 50000;
            const priceUsd = isIqd ? Math.round(price / 1300) : price;
            const isRent = item.type === 'FOR_RENT' || item.type === 'RENT' || item.listingType === 'FOR_RENT' || item.listingType === 'RENT';
            const photos = Array.isArray(addrObj.photos) && addrObj.photos.length > 0
              ? addrObj.photos
              : (item.imageUrl ? [item.imageUrl] : ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80']);
            const amens = Array.isArray(addrObj.amenities) && addrObj.amenities.length > 0
              ? addrObj.amenities
              : ['24/7 Security', 'Garage', 'Generator'];

            return {
              id: item.id || item.property?.id,
              type: isRent ? 'rent' : 'sale',
              category: (() => {
                const pt = (item.property?.type || '').toLowerCase();
                if (pt.includes('villa')) return 'villa';
                if (pt.includes('warehouse') || pt.includes('storage') || pt.includes('industrial')) return 'warehouse';
                if (pt.includes('house') || pt.includes('single_family')) return 'house';
                if (pt.includes('studio')) return 'studio';
                if (pt.includes('office')) return 'office';
                if (pt.includes('duplex')) return 'duplex';
                if (pt.includes('commercial')) return 'commercial';
                if (pt.includes('residential') || pt.includes('building')) return 'residential';
                return 'apartment';
              })(),
              titleKu: item.titleKu || item.title || item.property?.name || 'موڵکی شایستە',
              titleEn: item.titleEn || item.title || item.property?.name || 'Verified Property',
              titleAr: item.titleAr || item.title || item.property?.name || 'عقار موثق',
              cityKu: getCityName(rawCity, 'ku'),
              cityEn: getCityName(rawCity, 'en'),
              cityAr: getCityName(rawCity, 'ar'),
              areaKu: rawArea,
              areaEn: rawArea,
              areaAr: rawArea,
              priceUsd: priceUsd > 0 ? priceUsd : (isRent ? 1200 : 200000),
              priceIqd: isIqd ? `${price.toLocaleString()} IQD` : `${(priceUsd * 1300).toLocaleString()} IQD`,
              period: isRent ? 'month' : undefined,
              bedrooms: Number(addrObj.bedrooms) || Number(item.property?.bedrooms) || 3,
              bathrooms: Number(addrObj.bathrooms) || Number(item.property?.bathrooms) || 2,
              sizeM2: item.property?.squareFeet ? Math.round(item.property.squareFeet / 10.764) : 150,
              verified: true,
              featured: true,
              isPromoted: Boolean(item.isPromoted),
              promotionType: item.promotionType || null,
              imageUrl: photos[0],
              additionalImages: photos,
              descriptionKu: item.descriptionKu || item.description || 'موڵکی کرێی پشتڕاستکراو لە پلاتفۆرمی هۆمهاب',
              descriptionEn: item.descriptionEn || item.description || 'Verified property listing on HomeHub platform',
              descriptionAr: item.descriptionAr || item.description || 'عقار موثق على منصة هومهب',
              amenities: amens,
              amenitiesKu: amens,
              amenitiesEn: amens,
              amenitiesAr: amens,
              agentName: item.agentName || 'HomeHub Verified Broker',
              agentPhone: item.agentPhone || '+964 750 123 4567',
              agentCompany: item.agentCompany || 'HomeHub Official Network',
            };
          });
          setLiveProperties(mapped);
        } else {
          setLiveProperties([]);
        }
      })
      .catch((err) => {
        setApiError(err.message);
        setLiveProperties([]);
      });
  }, []);

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
      localStorage.setItem('homehub_guest_favorites', JSON.stringify(next));
      return next;
    });
  };

  // Calculated Counts for Tab Pills
  const saleCount = useMemo(() => liveProperties.filter((p) => p.type === 'sale').length, [liveProperties]);
  const rentCount = useMemo(() => liveProperties.filter((p) => p.type === 'rent').length, [liveProperties]);
  const aptCount = useMemo(() => liveProperties.filter((p) => p.category === 'apartment').length, [liveProperties]);
  const villaCount = useMemo(() => liveProperties.filter((p) => p.category === 'villa').length, [liveProperties]);
  const allCount = useMemo(() => liveProperties.length + SERVICE_PROVIDERS_DATA.length + AGENCIES_DATA.length, [liveProperties]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    // Strict domain isolation: Services and Agencies tabs must NEVER show properties
    if (activeTab === 'services' || activeTab === 'agencies') return [];

    return liveProperties.filter((item) => {
      // Strict domain filter based on domainMode
      if (domainMode === 'rent-only' && item.type !== 'rent') return false;
      if (domainMode === 'sale-only' && item.type !== 'sale') return false;

      // Tab filter
      if (activeTab === 'sale' && item.type !== 'sale') return false;
      if (activeTab === 'rent' && item.type !== 'rent') return false;

      // Category filter (via dedicated tabs or filter modal)
      if (activeTab === 'apartments' && item.category !== 'apartment') return false;
      if (activeTab === 'villas' && item.category !== 'villa') return false;
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'commercial') {
          // Parent-category aggregation: Commercial includes commercial, office, warehouse
          if (item.category !== 'commercial' && item.category !== 'office' && item.category !== 'warehouse') return false;
        } else {
          // Specific child subtype or residential category
          if (item.category !== selectedCategory) return false;
        }
      }

      // City filter (checks across localized city representations)
      if (selectedCity !== 'all') {
        const sel = selectedCity.toLowerCase();
        const cEn = (item.cityEn || '').toLowerCase();
        const cKu = (item.cityKu || '').toLowerCase();
        const cAr = (item.cityAr || '').toLowerCase();
        const matches =
          cEn.includes(sel) ||
          cKu.includes(sel) ||
          cAr.includes(sel) ||
          (sel === 'erbil' && (cKu.includes('هەولێر') || cAr.includes('أربيل'))) ||
          (sel === 'sulaymaniyah' && (cKu.includes('سلێمانی') || cAr.includes('السليمانية'))) ||
          (sel === 'duhok' && (cKu.includes('دهۆک') || cAr.includes('دهوك'))) ||
          (sel === 'kirkuk' && (cKu.includes('کەرکووک') || cAr.includes('كركوك')));
        if (!matches) return false;
      }

      // Bedrooms
      if (bedroomsFilter !== 'all' && item.bedrooms < (bedroomsFilter as number)) return false;

      // Verified
      if (verifiedOnly && !item.verified) return false;

      // Price range
      if (minPrice && item.priceUsd < Number(minPrice)) return false;
      if (maxPrice && item.priceUsd > Number(maxPrice)) return false;

      // Search Query across all multilingual fields
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle =
          (item.titleKu && item.titleKu.toLowerCase().includes(query)) ||
          (item.titleEn && item.titleEn.toLowerCase().includes(query)) ||
          (item.titleAr && item.titleAr.toLowerCase().includes(query));
        const matchesArea =
          (item.areaKu && item.areaKu.toLowerCase().includes(query)) ||
          (item.areaEn && item.areaEn.toLowerCase().includes(query)) ||
          (item.areaAr && item.areaAr.toLowerCase().includes(query)) ||
          (item.cityKu && item.cityKu.toLowerCase().includes(query)) ||
          (item.cityEn && item.cityEn.toLowerCase().includes(query)) ||
          (item.cityAr && item.cityAr.toLowerCase().includes(query));
        const matchesDesc =
          (item.descriptionKu && item.descriptionKu.toLowerCase().includes(query)) ||
          (item.descriptionEn && item.descriptionEn.toLowerCase().includes(query)) ||
          (item.descriptionAr && item.descriptionAr.toLowerCase().includes(query));
        const allAmenities = [
          ...(item.amenities || []),
          ...(item.amenitiesEn || []),
          ...(item.amenitiesKu || []),
          ...(item.amenitiesAr || []),
        ];
        const matchesAmenities = allAmenities.some((a) => a.toLowerCase().includes(query));
        if (!matchesTitle && !matchesArea && !matchesDesc && !matchesAmenities) return false;
      }

      return true;
    });
  }, [liveProperties, activeTab, selectedCategory, selectedCity, bedroomsFilter, verifiedOnly, minPrice, maxPrice, searchQuery]);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'promoted'>('newest');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 9;

  const sortedProperties = useMemo(() => {
    const list = [...filteredProperties];
    switch (sortBy) {
      case 'price_asc':
        return list.sort((a, b) => a.priceUsd - b.priceUsd);
      case 'price_desc':
        return list.sort((a, b) => b.priceUsd - a.priceUsd);
      case 'promoted':
        return list.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0));
      case 'newest':
      default:
        return list.sort((a, b) => (b.isPromoted ? 1 : 0) - (a.isPromoted ? 1 : 0));
    }
  }, [filteredProperties, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedCity, minPrice, maxPrice, bedroomsFilter, sortBy, activeTab]);

  const totalPages = Math.max(1, Math.ceil(sortedProperties.length / pageSize));
  const paginatedProperties = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedProperties.slice(start, start + pageSize);
  }, [sortedProperties, currentPage, pageSize]);

  // Filter Services: Only show on 'services' tab or 'all' tab without property category filter
  const filteredServices = useMemo(() => {
    if (domainMode !== 'all' || (activeTab !== 'services' && (activeTab !== 'all' || selectedCategory !== 'all'))) return [];
    return SERVICE_PROVIDERS_DATA.filter((item) => {
      if (selectedCity !== 'all') {
        const sel = selectedCity.toLowerCase();
        const cEn = item.cityEn.toLowerCase();
        const cKu = item.cityKu.toLowerCase();
        const cAr = item.cityAr.toLowerCase();
        const matches =
          cEn.includes(sel) ||
          cKu.includes(sel) ||
          cAr.includes(sel) ||
          (sel === 'erbil' && (cKu.includes('هەولێر') || cAr.includes('أربيل'))) ||
          (sel === 'sulaymaniyah' && (cKu.includes('سلێمانی') || cAr.includes('السليمانية'))) ||
          (sel === 'duhok' && (cKu.includes('دهۆک') || cAr.includes('دهوك'))) ||
          (sel === 'kirkuk' && (cKu.includes('کەرکووک') || cAr.includes('كركوك')));
        if (!matches) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          item.nameKu.toLowerCase().includes(query) ||
          item.nameEn.toLowerCase().includes(query) ||
          item.nameAr.toLowerCase().includes(query) ||
          item.serviceKu.toLowerCase().includes(query) ||
          item.serviceEn.toLowerCase().includes(query) ||
          item.serviceAr.toLowerCase().includes(query) ||
          item.cityKu.toLowerCase().includes(query) ||
          item.cityEn.toLowerCase().includes(query) ||
          item.cityAr.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [activeTab, selectedCategory, selectedCity, searchQuery]);

  // Filter Agencies: Only show on 'agencies' tab or 'all' tab without property category filter
  const filteredAgencies = useMemo(() => {
    if (domainMode !== 'all' || (activeTab !== 'agencies' && (activeTab !== 'all' || selectedCategory !== 'all'))) return [];
    return AGENCIES_DATA.filter((item) => {
      if (selectedCity !== 'all') {
        const sel = selectedCity.toLowerCase();
        const cEn = item.cityEn.toLowerCase();
        const cKu = item.cityKu.toLowerCase();
        const cAr = item.cityAr.toLowerCase();
        const matches =
          cEn.includes(sel) ||
          cKu.includes(sel) ||
          cAr.includes(sel) ||
          (sel === 'erbil' && (cKu.includes('هەولێر') || cAr.includes('أربيل'))) ||
          (sel === 'sulaymaniyah' && (cKu.includes('سلێمانی') || cAr.includes('السليمانية'))) ||
          (sel === 'duhok' && (cKu.includes('دهۆک') || cAr.includes('دهوك'))) ||
          (sel === 'kirkuk' && (cKu.includes('کەرکووک') || cAr.includes('كركوك')));
        if (!matches) return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return (
          item.nameKu.toLowerCase().includes(query) ||
          item.nameEn.toLowerCase().includes(query) ||
          item.nameAr.toLowerCase().includes(query) ||
          item.locationKu.toLowerCase().includes(query) ||
          item.locationEn.toLowerCase().includes(query) ||
          item.locationAr.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [activeTab, selectedCategory, selectedCity, searchQuery]);

  const totalResultsCount =
    filteredProperties.length +
    filteredServices.length +
    filteredAgencies.length;

  const getPropertiesSectionTitle = () => {
    if (activeTab === 'apartments' || selectedCategory === 'apartment') return `${t('marketplace.tab.apartments')} (${filteredProperties.length})`;
    if (activeTab === 'villas' || selectedCategory === 'villa') return `${t('marketplace.tab.villas')} (${filteredProperties.length})`;
    if (activeTab === 'sale') return `${t('marketplace.tab.for_sale')} (${filteredProperties.length})`;
    if (activeTab === 'rent') return `${t('marketplace.tab.for_rent')} (${filteredProperties.length})`;
    return `${t('marketplace.tab.apartments')} & ${t('marketplace.tab.villas')} (${filteredProperties.length})`;
  };

  return (
    <div
      id="search-explorer-root"
      className={`min-h-screen bg-[#070b14] text-[#f7f9fc] pb-20 ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* 1. Top Guest Mode Status Banner */}
      <div className="bg-gradient-to-r from-[#0c1322] via-[#111b2e] to-[#0c1322] text-white px-4 py-3 border-b border-amber-500/20 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span className="font-bold text-white text-xs sm:text-sm">
              {t('marketplace.banner.guest_active')}
            </span>
            <span className="text-slate-400 text-xs hidden md:inline">
              {t('marketplace.banner.guest_desc')}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Direct Language Switcher for Guest Mode */}
            <div className="flex items-center gap-1.5 bg-[#080d19]/90 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="bg-transparent text-white font-bold text-xs cursor-pointer outline-none border-none pr-1"
                aria-label="Language selection"
              >
                <option value="en" className="bg-[#0c1322] text-slate-100 font-sans">English</option>
                <option value="ku" className="bg-[#0c1322] text-slate-100 font-arabic">کوردی سۆرانی</option>
                <option value="ar" className="bg-[#0c1322] text-slate-100 font-arabic">العربية</option>
              </select>
            </div>

            <Link
              to="/onboarding"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors border border-white/20"
            >
              {t('marketplace.banner.onboarding_guide')}
            </Link>
            <Link
              to="/onboarding/signup"
              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs font-black transition-all shadow-md"
            >
              {t('marketplace.banner.create_account')}
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Main Search & Navigation Header */}
      <div className="bg-[#0c1322]/95 border-b border-amber-500/30 sticky top-0 z-20 shadow-xl backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
          {/* Top Row: Search Input & Action Buttons */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                className={`w-5 h-5 absolute top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
                  direction === 'rtl' ? 'right-3.5' : 'left-3.5'
                } ${aiSearchMode ? 'text-amber-400' : 'text-slate-400'}`}
              />
              <input
                id="search-explorer-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiSearchMode) {
                    handleAiSearch(searchQuery);
                  }
                }}
                disabled={isAiSearching}
                placeholder={aiSearchMode ? t('marketplace.ai_search.placeholder', "Try '3-bedroom villa in Erbil under $1500'") : t('marketplace.search_placeholder')}
                className={`w-full py-3 rounded-xl border transition-all outline-none text-sm font-medium ${
                  direction === 'rtl' ? 'pr-11 pl-20' : 'pl-11 pr-20'
                } ${
                  aiSearchMode
                    ? 'bg-[#111b2e] border-amber-500/50 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20 text-white placeholder:text-slate-400'
                    : 'bg-[#080d19]/90 border-slate-800 focus:bg-[#0c1322] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-white placeholder:text-slate-500'
                } ${isAiSearching ? 'opacity-70 cursor-not-allowed' : ''}`}
              />
              
              {/* AI Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  setAiSearchMode(!aiSearchMode);
                  if (aiSearchMode) {
                    setSearchQuery('');
                  }
                }}
                className={`absolute top-1/2 -translate-y-1/2 p-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                  direction === 'rtl' ? 'left-10' : 'right-10'
                } ${aiSearchMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:bg-slate-800'}`}
                title={t('marketplace.ai_search.toggle', 'Toggle AI Search')}
              >
                <Sparkles className="w-4 h-4" />
              </button>

              {/* Clear or Loading Spinner */}
              {isAiSearching ? (
                <div className={`absolute top-1/2 -translate-y-1/2 ${direction === 'rtl' ? 'left-3.5' : 'right-3.5'}`}>
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer ${
                    direction === 'rtl' ? 'left-3.5' : 'right-3.5'
                  }`}
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFiltersModal(true)}
              className="px-4 py-3 rounded-xl border border-slate-800 bg-[#080d19] hover:bg-[#111b2e] text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">{t('marketplace.filters_btn')}</span>
              {(selectedCity !== 'all' || selectedCategory !== 'all' || bedroomsFilter !== 'all' || verifiedOnly) && (
                <span className="w-2 h-2 rounded-full bg-amber-400" />
              )}
            </button>

            {/* View Mode Toggle: Grid vs Map */}
            <div className="hidden sm:flex border border-slate-800 rounded-xl overflow-hidden p-1 bg-[#080d19] shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#111b2e] text-amber-400 shadow-sm font-bold border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('marketplace.view_grid')}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'map' ? 'bg-[#111b2e] text-amber-400 shadow-sm font-bold border border-amber-500/30' : 'text-slate-400 hover:text-slate-200'
                }`}
                title={t('marketplace.view_map')}
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs font-bold">
            {domainMode === 'all' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('all');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'all' && selectedCategory === 'all'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
                }`}
              >
                {t('marketplace.tab.all')} ({allCount})
              </button>
            )}

            {FeatureFlags.BUY_SELL_ENABLED && domainMode !== 'rent-only' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('sale');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'sale'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
                }`}
              >
                {t('marketplace.tab.for_sale')} ({saleCount})
              </button>
            )}

            {domainMode !== 'sale-only' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('rent');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'rent'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
                }`}
              >
                {t('marketplace.tab.for_rent')} ({rentCount})
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveTab('apartments');
                setSelectedCategory('apartment');
              }}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'apartments' || (activeTab === 'all' && selectedCategory === 'apartment')
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
              }`}
            >
              {t('marketplace.tab.apartments')} ({aptCount})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('villas');
                setSelectedCategory('villa');
              }}
              className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'villas' || (activeTab === 'all' && selectedCategory === 'villa')
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
              }`}
            >
              {t('marketplace.tab.villas')} ({villaCount})
            </button>

            {domainMode !== 'rent-only' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('services');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'services'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
                }`}
              >
                {t('marketplace.tab.services')} ({SERVICE_PROVIDERS_DATA.length})
              </button>
            )}

            {domainMode !== 'rent-only' && (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('agencies');
                  setSelectedCategory('all');
                }}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'agencies'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'bg-[#080d19] text-slate-400 hover:text-slate-200 hover:bg-[#111b2e] border border-slate-800'
                }`}
              >
                {t('marketplace.tab.agencies')} ({AGENCIES_DATA.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Results Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Results Count, Sort Selector & Active Filters Summary */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-300 bg-[#0c1322] p-3.5 rounded-2xl border border-slate-800/80 shadow-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-black text-white text-base">{totalResultsCount}</span>
            <span className="text-slate-400">{t('marketplace.results_found')}</span>
            {searchQuery && (
              <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold text-xs">
                {t('marketplace.searching_for')} "{searchQuery}"
              </span>
            )}
            {(searchQuery || selectedCategory !== 'all' || selectedCity !== 'all' || minPrice || maxPrice || bedroomsFilter !== 'all') && (
              <button
                type="button"
                data-testid="clear-all-filters-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setSelectedCity('all');
                  setMinPrice('');
                  setMaxPrice('');
                  setBedroomsFilter('all');
                  setVerifiedOnly(false);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-bold text-xs hover:bg-rose-500/30 transition-colors cursor-pointer flex items-center gap-1 border border-rose-500/40"
              >
                <X className="w-3 h-3" />
                <span>{t('marketplace.filter.reset_all')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-400 whitespace-nowrap">{t('marketplace.sort.label')}</span>
              <select
                data-testid="sort-by-select"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 text-slate-200 text-xs font-bold rounded-xl px-2.5 py-1.5 cursor-pointer outline-none focus:border-amber-500/50 transition-colors"
                aria-label={t('marketplace.sort.label')}
              >
                <option value="newest" className="bg-[#0c1322] text-slate-200">{t('marketplace.sort.newest')}</option>
                <option value="price_asc" className="bg-[#0c1322] text-slate-200">{t('marketplace.sort.price_asc')}</option>
                <option value="price_desc" className="bg-[#0c1322] text-slate-200">{t('marketplace.sort.price_desc')}</option>
                <option value="promoted" className="bg-[#0c1322] text-slate-200">{t('marketplace.sort.promoted')}</option>
              </select>
            </div>

            {favorites.length > 0 && (
              <span className="bg-rose-500/20 text-rose-300 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 border border-rose-500/40">
                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                <span>{favorites.length} {t('marketplace.saved_favorites')}</span>
              </span>
            )}
            <span className="text-slate-400 hidden sm:inline">
              {t('marketplace.city_label')} {selectedCity === 'all' ? t('marketplace.all_cities') : getCityName(selectedCity, language)}
            </span>
          </div>
        </div>

        {/* INTERACTIVE MAP VIEW */}
        {viewMode === 'map' && filteredProperties.length > 0 && (
          <div className="bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 shadow-sm h-[500px] relative z-0">
            <MapContainer 
              center={getPropertyCoords(filteredProperties[0])} 
              zoom={12} 
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {filteredProperties.map((prop) => {
                const title = getLoc(language, prop.titleKu, prop.titleEn, prop.titleAr);
                const area = getLoc(language, prop.areaKu, prop.areaEn, prop.areaAr);
                
                return (
                  <Marker key={prop.id} position={getPropertyCoords(prop)}>
                    <Popup className="homehub-map-popup">
                      <div className="w-[200px]">
                        <img 
                          src={prop.imageUrl} 
                          alt={title} 
                          className="w-full h-[120px] object-cover rounded-t-lg mb-2"
                        />
                        <div className="p-2 pt-0 text-left rtl:text-right">
                          <p className="font-bold text-slate-900 text-sm line-clamp-2 leading-tight mb-1">{title}</p>
                          <p className="text-blue-600 font-black mb-1">{prop.priceUsd.toLocaleString()} USD</p>
                          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {area}
                          </p>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedProperty(prop);
                            }}
                            className="w-full px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            {t('marketplace.action.view_details', 'View Details')}
                          </button>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}

        {apiError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <span>{t('marketplace.db_unavailable', `Database warning: ${apiError}`).replace('{error}', apiError)}</span>
          </div>
        )}

        {/* DEDICATED ADVERTISING PLACEMENT: SPONSORED RENTAL PLACEMENTS */}
        {domainMode !== 'sale-only' && (activeTab === 'all' || activeTab === 'rent' || activeTab === 'apartments' || activeTab === 'villas') && (
          <SponsoredRentalPlacements
            className="mb-4"
            onSelectProperty={(prop) => setSelectedProperty(prop)}
          />
        )}

        {/* PROPERTIES SECTION */}
        {filteredProperties.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                <Home className="w-5 h-5 text-amber-400" />
                <span>
                  {getPropertiesSectionTitle()}
                </span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {paginatedProperties.map((prop) => {
                const isFav = favorites.includes(prop.id);
                const title = getLoc(language, prop.titleKu, prop.titleEn, prop.titleAr);
                const area = getLoc(language, prop.areaKu, prop.areaEn, prop.areaAr);
                const desc = getLoc(language, prop.descriptionKu, prop.descriptionEn, prop.descriptionAr);
                const periodText = prop.period === 'month' ? t('marketplace.card.per_month') : prop.period === 'year' ? t('marketplace.card.per_year') : '';
                const socialProof = getSocialProof(prop.id);

                return (
                  <div
                    key={prop.id}
                    onClick={() => setSelectedProperty(prop)}
                    className="bg-[#0c1322] rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl hover:shadow-2xl hover:border-amber-500/40 transition-all duration-200 cursor-pointer flex flex-col group"
                  >
                    {/* Image Header */}
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
                      <img
                        src={prop.imageUrl || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80'}
                        alt={title}
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80';
                        }}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />

                      {/* Top Badges */}
                      <div
                        className={`absolute top-3 flex items-center gap-1.5 ${
                          direction === 'rtl' ? 'right-3' : 'left-3'
                        }`}
                      >
                        {prop.isPromoted && (
                          <span
                            data-testid="sponsored-badge"
                            className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 shadow-md"
                          >
                            <Sparkles className="w-3 h-3 fill-slate-950" />
                            <span>{t('marketplace.badge.sponsored')}</span>
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-xs ${
                            prop.type === 'sale'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md'
                          }`}
                        >
                          {prop.type === 'sale' ? t('marketplace.badge.for_sale') : t('marketplace.badge.for_rent')}
                        </span>
                        {prop.verified && (
                          <span className="bg-[#0c1322]/90 text-slate-200 border border-amber-500/30 backdrop-blur-xs px-2 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 shadow-xs">
                            <Shield className="w-3 h-3 text-amber-400 fill-amber-400" />
                            <span>{t('marketplace.badge.verified_deed')}</span>
                          </span>
                        )}
                      </div>

                      {/* Wishlist Heart Toggle */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(prop.id, e)}
                        className={`absolute top-3 p-2 rounded-full backdrop-blur-xs transition-transform active:scale-90 cursor-pointer ${
                          direction === 'rtl' ? 'left-3' : 'right-3'
                        } ${
                          isFav
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm'
                            : 'bg-slate-900/60 text-white hover:bg-slate-900/90'
                        }`}
                        title={t('marketplace.card.favorites')}
                        aria-label={t('marketplace.card.favorites')}
                      >
                        <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500' : ''}`} />
                      </button>

                      {/* Compare Toggle */}
                      <button
                        type="button"
                        onClick={(e) => toggleCompare(prop, e)}
                        className={`absolute top-12 p-2 rounded-full backdrop-blur-xs transition-transform active:scale-90 cursor-pointer ${
                          direction === 'rtl' ? 'left-3' : 'right-3'
                        } ${
                          compareList.some(p => p.id === prop.id)
                            ? 'bg-amber-500 text-slate-950 shadow-sm'
                            : 'bg-slate-900/60 text-white hover:bg-slate-900/90'
                        }`}
                        title={t('marketplace.comparison.compare_property', 'Compare Property')}
                      >
                        <Scale className="w-4 h-4" />
                      </button>

                      {/* Price Tag Over Image */}
                      <div
                        className={`absolute bottom-3 text-white ${
                          direction === 'rtl' ? 'right-3 text-right' : 'left-3 text-left'
                        }`}
                      >
                        <p className="text-xl font-black text-amber-400 drop-shadow-md">
                          ${prop.priceUsd.toLocaleString()}
                          {periodText && (
                            <span className="text-xs font-medium text-slate-300"> {periodText}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-300 drop-shadow-sm font-mono">
                          {formatIqdDisplay(prop.priceUsd, language)}
                        </p>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1.5">
                        {socialProof.isHot && (
                          <div className="flex items-center gap-1.5 mb-1">
                             <span className="text-amber-400 text-xs animate-pulse">🔥</span>
                             <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                               {socialProof.viewers} {t('marketplace.social.viewing', 'people viewing this')}
                             </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="line-clamp-1">{area}</span>
                        </div>
                        <h4 className="font-bold text-white text-base leading-snug group-hover:text-amber-400 transition-colors line-clamp-1">
                          {title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {desc}
                        </p>
                      </div>

                      {/* Specs Row */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-slate-300 text-xs">
                        {prop.bedrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {prop.bedrooms} {t('marketplace.specs.rooms')}
                            </span>
                          </span>
                        )}
                        {prop.bathrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bath className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {prop.bathrooms} {t('marketplace.specs.baths')}
                            </span>
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {prop.sizeM2} {t('marketplace.specs.sqm')}
                          </span>
                        </span>
                      </div>

                      {/* Agent / Contact Footer */}
                      <div className="pt-2 flex items-center justify-between text-xs">
                        <span className="text-slate-400 truncate">{prop.agentCompany}</span>
                        <span className="text-amber-400 font-bold flex items-center gap-1 group-hover:underline">
                          <span>{t('marketplace.card.view_details')}</span>
                          <ArrowRight className={`w-3 h-3 ${direction === 'rtl' ? 'rotate-180' : ''}`} />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PAGINATION CONTROLS */}
            {totalPages > 1 && (
              <div
                className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-800 text-slate-400"
                data-testid="pagination-controls"
              >
                <div className="text-xs text-slate-400 font-bold" data-testid="pagination-info">
                  {t('marketplace.pagination.page_of')
                    .replace('{current}', String(currentPage))
                    .replace('{total}', String(totalPages))}
                  <span className="mx-2 text-slate-600">|</span>
                  <span>{sortedProperties.length} {t('marketplace.results_found')}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    data-testid="pagination-prev-btn"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 bg-[#0c1322] text-slate-200 font-bold text-xs hover:bg-[#111b2e] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
                  >
                    {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    <span>{t('marketplace.pagination.prev')}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        data-testid={`pagination-page-${pageNum}`}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md'
                            : 'bg-[#0c1322] border border-slate-800 text-slate-300 hover:bg-[#111b2e]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    data-testid="pagination-next-btn"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-xl border border-slate-800 bg-[#0c1322] text-slate-200 font-bold text-xs hover:bg-[#111b2e] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>{t('marketplace.pagination.next')}</span>
                    {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : !apiError && (activeTab === 'sale' || activeTab === 'rent' || activeTab === 'apartments' || activeTab === 'villas' || (activeTab === 'all' && selectedCategory !== 'all')) && totalResultsCount > 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-2">
            <p className="font-bold text-slate-800 text-sm">{t('marketplace.no_properties_title')}</p>
            <p className="text-xs text-slate-500">{t('marketplace.no_properties_desc')}</p>
          </div>
        ) : null}

        {/* SERVICE PROVIDERS */}
        {(activeTab === 'all' || activeTab === 'services') && filteredServices.length > 0 && (
          <div className={`space-y-3 ${filteredProperties.length > 0 ? 'pt-6 border-t border-slate-200' : ''}`}>
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              <span>
                {t('marketplace.services.title')} ({filteredServices.length})
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredServices.map((srv) => {
                const srvName = getLoc(language, srv.nameKu, srv.nameEn, srv.nameAr);
                const srvService = getLoc(language, srv.serviceKu, srv.serviceEn, srv.serviceAr);
                const srvCity = getCityName(srv.cityEn, language);

                return (
                  <div
                    key={srv.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-amber-400 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={srv.avatarUrl}
                          alt={srvName}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100"
                        />
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <h4 className="font-bold text-sm text-slate-900">{srvName}</h4>
                            {srv.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600" />}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-amber-600 font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{srv.rating}</span>
                            <span className="text-slate-400 font-normal">
                              ({srv.reviewsCount} {t('marketplace.services.reviews', 'reviews')})
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {srvService}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {t('marketplace.city_label', 'City:')} {srvCity}
                        </span>
                        <span>
                          {srv.experienceYears} {t('marketplace.services.years_exp', 'years exp')}
                        </span>
                      </div>
                    </div>

                    <a
                      href={`tel:${srv.phone}`}
                      className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-amber-700" />
                      <span>
                        {t('marketplace.services.direct_call')} <span dir="ltr">({srv.phone})</span>
                      </span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* REAL ESTATE AGENCIES */}
        {(activeTab === 'all' || activeTab === 'agencies') && filteredAgencies.length > 0 && (
          <div className={`space-y-3 ${(filteredProperties.length > 0 || filteredServices.length > 0) ? 'pt-6 border-t border-slate-200' : ''}`}>
            <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>
                {t('marketplace.agencies.title')} ({filteredAgencies.length})
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {filteredAgencies.map((agency) => {
                const agencyName = getLoc(language, agency.nameKu, agency.nameEn, agency.nameAr);
                const agencyLoc = getLoc(language, agency.locationKu, agency.locationEn, agency.locationAr);

                return (
                  <div
                    key={agency.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-indigo-400 transition-all flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={agency.logoUrl}
                        alt={agencyName}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-sm text-slate-900">{agencyName}</h4>
                          {agency.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 fill-blue-600 shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500">{agencyLoc}</p>
                        <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                          {agency.activeListings} {t('marketplace.agencies.active_properties')}
                        </span>
                      </div>
                    </div>

                    <a
                      href={`tel:${agency.phone}`}
                      className="w-full py-2 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-indigo-700" />
                      <span>{t('marketplace.agencies.contact_office')}</span>
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {totalResultsCount === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto">
            <Search className="w-12 h-12 text-slate-300 mx-auto" />
            <h4 className="font-bold text-base text-slate-800">{t('marketplace.empty.title')}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t('marketplace.empty.desc')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab(domainMode === 'rent-only' ? 'rent' : domainMode === 'sale-only' ? 'sale' : 'all');
                setSelectedCategory('all');
                setSelectedCity('all');
                setMinPrice('');
                setMaxPrice('');
                setBedroomsFilter('all');
                setVerifiedOnly(false);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              {t('marketplace.empty.clear_filters')}
            </button>
          </div>
        )}
      </div>

      {/* 4. MODAL: Property In-Depth Inspection */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[#0c1322] rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-amber-500/30 text-start space-y-5 p-6 relative text-white">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setSelectedProperty(null);
                setContactSuccessMsg(null);
                setShowScheduler(false);
                setSelectedDate('');
                setSelectedTime('');
              }}
              className={`absolute top-4 p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer z-10 ${
                direction === 'rtl' ? 'left-4' : 'right-4'
              }`}
              aria-label="Close details"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Image & Gallery */}
            {(() => {
              const galleryImages = (selectedProperty.additionalImages && selectedProperty.additionalImages.length > 0)
                ? selectedProperty.additionalImages
                : [selectedProperty.imageUrl];
              const activeImg = galleryImages[selectedImageIdx] || selectedProperty.imageUrl;

              return (
                <div className="space-y-2">
                  <div className="rounded-2xl overflow-hidden aspect-[16/10] relative bg-slate-950 group">
                    <img
                      src={activeImg}
                      alt={getLoc(language, selectedProperty.titleKu, selectedProperty.titleEn, selectedProperty.titleAr)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className={`absolute top-3 flex gap-2 ${
                        direction === 'rtl' ? 'right-3' : 'left-3'
                      }`}
                    >
                      <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 backdrop-blur-md font-bold text-xs shadow-xs">
                        {selectedProperty.type === 'sale' ? t('marketplace.badge.for_sale') : t('marketplace.badge.for_rent')}
                      </span>
                      {selectedProperty.verified && (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 backdrop-blur-md font-bold text-xs shadow-xs flex items-center gap-1">
                          <Shield className="w-3.5 h-3.5" />
                          <span>{t('marketplace.modal.verified_deed')}</span>
                        </span>
                      )}
                    </div>

                    {galleryImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageIdx((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
                          }}
                          className="absolute start-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-950 text-white flex items-center justify-center backdrop-blur-xs transition-transform hover:scale-105 cursor-pointer"
                        >
                          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImageIdx((prev) => (prev + 1) % galleryImages.length);
                          }}
                          className="absolute end-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-950/80 hover:bg-slate-950 text-white flex items-center justify-center backdrop-blur-xs transition-transform hover:scale-105 cursor-pointer"
                        >
                          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                        </button>
                        <span className="absolute bottom-3 end-3 px-2 py-0.5 rounded-md bg-slate-950/80 text-white text-[11px] font-mono backdrop-blur-xs">
                          {selectedImageIdx + 1} / {galleryImages.length}
                        </span>
                      </>
                    )}
                  </div>

                  {galleryImages.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto py-1">
                      {galleryImages.map((imgUrl, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedImageIdx(i)}
                          className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                            selectedImageIdx === i ? 'border-amber-400 scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={imgUrl} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Social Proof & Urgency */}
            {(() => {
              const sp = getSocialProof(selectedProperty.id);
              if (!sp.isHot) return null;
              return (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
                      <span className="text-amber-400 text-sm">🔥</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-300">{t('marketplace.social_proof.rare_find', 'Rare Find! Highly Demanded')}</p>
                      <p className="text-xs text-slate-300 font-medium">
                        {sp.viewers} {t('marketplace.social_proof.viewing', 'people are viewing this right now. Listed')} {sp.hoursAgo} {t('marketplace.social_proof.hours_ago', 'hours ago.')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Title & Price Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {getLoc(language, selectedProperty.cityKu, selectedProperty.cityEn, selectedProperty.cityAr)} •{' '}
                  {getLoc(language, selectedProperty.areaKu, selectedProperty.areaEn, selectedProperty.areaAr)}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {getLoc(language, selectedProperty.titleKu, selectedProperty.titleEn, selectedProperty.titleAr)}
              </h3>
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-2xl font-black text-amber-400">
                  ${selectedProperty.priceUsd.toLocaleString()}
                  {selectedProperty.period && (
                    <span className="text-sm font-medium text-slate-400">
                      {' '}
                      {selectedProperty.period === 'month'
                        ? t('marketplace.card.per_month')
                        : t('marketplace.card.per_year')}
                    </span>
                  )}
                </span>
                <span className="text-sm font-bold text-slate-400 font-mono">
                  {formatIqdDisplay(selectedProperty.priceUsd, language)}
                </span>
              </div>
            </div>

            {/* Specifications Matrix */}
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#080d19] border border-slate-800 text-center">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{t('marketplace.modal.bedrooms_label')}</p>
                <p className="text-base font-black text-white mt-0.5">
                  {selectedProperty.bedrooms} {t('marketplace.specs.rooms')}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{t('marketplace.modal.bathrooms_label')}</p>
                <p className="text-base font-black text-white mt-0.5">
                  {selectedProperty.bathrooms} {t('marketplace.specs.baths')}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{t('marketplace.modal.total_area')}</p>
                <p className="text-base font-black text-white mt-0.5">
                  {selectedProperty.sizeM2} {t('marketplace.specs.sqm')}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-sm text-white">{t('marketplace.modal.full_description')}</h4>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {getLoc(
                  language,
                  selectedProperty.descriptionKu,
                  selectedProperty.descriptionEn,
                  selectedProperty.descriptionAr
                )}
              </p>
            </div>

            {/* Amenities Badges */}
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-white">{t('marketplace.modal.amenities_features')}</h4>
              <div className="flex flex-wrap gap-2">
                {(language === 'en' && selectedProperty.amenitiesEn?.length
                  ? selectedProperty.amenitiesEn
                  : language === 'ar' && selectedProperty.amenitiesAr?.length
                  ? selectedProperty.amenitiesAr
                  : selectedProperty.amenitiesKu || selectedProperty.amenities
                ).map((item, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-lg bg-[#080d19] text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Neighborhood Insights (Radar Chart) */}
            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-sm text-white flex items-center gap-2">
                <MapIcon className="w-4 h-4 text-amber-400" />
                {t('marketplace.insights.neighborhood', 'Neighborhood Insights')}
              </h4>
              <div className="bg-[#080d19] border border-slate-800 rounded-2xl p-4 h-64 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getNeighborhoodData(selectedProperty.id, t)}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Agent Direct Contact Bar */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#080d19] via-[#0c1322] to-[#111b2e] border border-amber-500/30 text-white space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">{t('marketplace.modal.contact_officer')}</p>
                  <p className="font-black text-base text-white">{selectedProperty.agentName}</p>
                  <p className="text-xs text-amber-300/80">{selectedProperty.agentCompany}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavorite(selectedProperty.id)}
                  className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                  title={t('marketplace.modal.save_favorite')}
                  aria-label={t('marketplace.modal.save_favorite')}
                >
                  <Heart
                    className={`w-5 h-5 ${
                      favorites.includes(selectedProperty.id) ? 'fill-rose-500 text-rose-500' : ''
                    }`}
                  />
                </button>
              </div>

              {contactSuccessMsg && !showScheduler && (
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                  {contactSuccessMsg}
                </div>
              )}

              {applySuccessMsg && (
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/40 mt-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
                  {applySuccessMsg}
                </div>
              )}

              {showScheduler ? (
                <div className="bg-[#080d19] p-4 rounded-xl border border-slate-800 mt-2 space-y-4 animate-in slide-in-from-bottom-2 fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-white text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      {t('marketplace.scheduler.select_datetime', 'Select Date & Time')}
                    </h4>
                    <button 
                      onClick={() => setShowScheduler(false)}
                      className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Dates (Next 4 days) */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('marketplace.scheduler.available_days', 'Available Days')}</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                      {[1, 2, 3, 4].map(dayOffset => {
                        const date = new Date();
                        date.setDate(date.getDate() + dayOffset);
                        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                        const dayNum = date.getDate();
                        const fullDate = date.toISOString().split('T')[0];
                        
                        return (
                          <button
                            key={fullDate}
                            onClick={() => { setSelectedDate(fullDate); setSelectedTime(''); }}
                            className={`min-w-[60px] p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                              selectedDate === fullDate 
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500 border-amber-400 text-slate-950 font-black shadow-lg' 
                                : 'bg-[#0c1322] border-slate-800 text-slate-300 hover:bg-[#111b2e]'
                            }`}
                          >
                            <span className="text-[10px] font-bold">{dayName}</span>
                            <span className="text-lg font-black">{dayNum}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Times (Only show if date is selected) */}
                  {selectedDate && (
                    <div className="space-y-2 animate-in fade-in">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('marketplace.scheduler.available_times', 'Available Times')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'].map(time => (
                          <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              selectedTime === time
                                ? 'bg-amber-400 border-amber-400 text-slate-950'
                                : 'bg-[#0c1322] border-slate-800 text-slate-300 hover:bg-[#111b2e]'
                            }`}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDate && selectedTime && (
                    <button
                      onClick={() => {
                        setShowScheduler(false);
                        setContactSuccessMsg(t('marketplace.scheduler.success', `Viewing scheduled for ${selectedDate} at ${selectedTime}. The agent will confirm shortly.`));
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-sm rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {t('marketplace.scheduler.confirm_viewing', 'Confirm Viewing')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <a
                    href={`tel:${selectedProperty.agentPhone}`}
                    className="flex-1 min-w-[140px] py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/20"
                  >
                    <Phone className="w-4 h-4 text-amber-400" />
                    <span>
                      {t('marketplace.modal.call_agent')} <span dir="ltr">({selectedProperty.agentPhone})</span>
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setShowScheduler(true)}
                    className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-white/20 whitespace-nowrap"
                  >
                    <Calendar className="w-4 h-4 text-amber-400" />
                    <span>{t('marketplace.scheduler.schedule_viewing', 'Schedule Viewing')}</span>
                  </button>
                  
                  {selectedProperty.type === 'rent' && (
                    <button
                      type="button"
                      disabled={!!applySuccessMsg}
                      onClick={() => {
                        setApplySuccessMsg(t('marketplace.actions.apply_success', 'Rental application submitted successfully! Check your tenant workspace.'));
                        
                        setTimeout(() => {
                           fetch(`/api/rental-acquisitions/listings/${selectedProperty.id}/applications`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                preferredMoveInDate: new Date().toISOString().split('T')[0],
                                notes: 'I am very interested in renting this property.'
                              })
                           }).catch(err => console.error('Application failed:', err));
                        }, 100);
                      }}
                      className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                    >
                      {applySuccessMsg ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                      <span>{t('marketplace.actions.apply_for_rent', 'Apply for Rent')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL: Advanced Filters */}
      {showFiltersModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0c1322] rounded-3xl max-w-lg w-full p-6 text-start space-y-5 shadow-2xl border border-amber-500/30 relative text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-lg text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                <span>{t('marketplace.filters.advanced_title')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                aria-label="Close filters"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* City Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">{t('marketplace.filters.city_label')}</label>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-800 bg-[#080d19] text-xs sm:text-sm font-semibold text-white outline-none focus:border-amber-500/50"
              >
                <option value="all" className="bg-[#0c1322] text-slate-200">{t('marketplace.filters.all_cities')}</option>
                <option value="Erbil" className="bg-[#0c1322] text-slate-200">{t('marketplace.city.erbil')}</option>
                <option value="Sulaymaniyah" className="bg-[#0c1322] text-slate-200">{t('marketplace.city.sulaymaniyah')}</option>
                <option value="Duhok" className="bg-[#0c1322] text-slate-200">{t('marketplace.city.duhok')}</option>
                <option value="Kirkuk" className="bg-[#0c1322] text-slate-200">{t('marketplace.city.kirkuk')}</option>
              </select>
            </div>

            {/* Bedrooms Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">{t('marketplace.filters.bedrooms_num')}</label>
              <div className="grid grid-cols-5 gap-2">
                {(['all', 1, 2, 3, 4] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBedroomsFilter(b)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      bedroomsFilter === b
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black border-amber-400 shadow-md'
                        : 'bg-[#080d19] text-slate-300 border-slate-800 hover:bg-[#111b2e]'
                    }`}
                  >
                    {b === 'all' ? t('marketplace.filters.any') : `${b}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">{t('marketplace.filters.price_range_usd')}</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder={t('marketplace.filters.min_price')}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-800 text-xs bg-[#080d19] text-white font-medium outline-none focus:border-amber-500/50 placeholder:text-slate-500"
                />
                <input
                  type="number"
                  placeholder={t('marketplace.filters.max_price')}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-800 text-xs bg-[#080d19] text-white font-medium outline-none focus:border-amber-500/50 placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Verified Only Toggle */}
            <label className="flex items-center gap-3 p-3 rounded-xl bg-[#080d19] border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-200">
                {t('marketplace.filters.verified_deed_only')}
              </span>
            </label>

            {/* Apply / Reset Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setSelectedCity('all');
                  setBedroomsFilter('all');
                  setMinPrice('');
                  setMaxPrice('');
                  setVerifiedOnly(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 cursor-pointer"
              >
                {t('marketplace.filters.reset')}
              </button>
              <button
                type="button"
                onClick={() => setShowFiltersModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs shadow-md cursor-pointer"
              >
                {t('marketplace.filters.apply')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FLOATING COMPARE BAR */}
      {compareList.length > 0 && !showComparisonModal && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-lg bg-[#0c1322]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-amber-500/30 p-3 flex items-center justify-between animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Scale className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                {compareList.length} {t('marketplace.comparison.selected', 'Selected')}
              </p>
              <p className="text-[10px] text-slate-400">{t('marketplace.comparison.max', 'Select up to 3 properties to compare')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCompareList([])}
              className="p-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
              title={t('marketplace.comparison.clear_all', 'Clear all')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowComparisonModal(true)}
              disabled={compareList.length < 2}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                compareList.length >= 2 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black shadow-md'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {t('marketplace.comparison.compare_now', 'Compare Now')}
            </button>
          </div>
        </div>
      )}

      {/* 7. COMPARISON MODAL */}
      {showComparisonModal && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0c1322] rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl border border-amber-500/30 relative text-white animate-in zoom-in-95">
            {/* Header */}
            <div className="sticky top-0 bg-[#0c1322]/95 backdrop-blur-md z-10 border-b border-slate-800 p-4 sm:p-6 flex items-center justify-between">
              <h3 className="font-black text-xl text-white flex items-center gap-2">
                <ArrowRightLeft className="w-6 h-6 text-amber-400" />
                <span>{t('marketplace.comparison.title', 'Property Comparison')}</span>
              </h3>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comparison Grid */}
            <div className="p-4 sm:p-6 overflow-x-auto">
              <table className="w-full text-start border-collapse">
                <thead>
                  <tr>
                    <th className="w-32 p-3 text-start text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                      {t('marketplace.comparison.features', 'Features')}
                    </th>
                    {compareList.map(prop => (
                      <th key={prop.id} className="p-3 border-b border-slate-800 min-w-[200px] w-1/3 align-top">
                        <div className="relative">
                          <button
                            onClick={() => setCompareList(prev => prev.filter(p => p.id !== prop.id))}
                            className="absolute top-2 right-2 p-1.5 bg-slate-900/90 text-rose-400 rounded-full shadow-sm hover:bg-rose-500 hover:text-white transition-colors z-10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <img 
                            src={prop.imageUrl} 
                            alt="Property" 
                            className="w-full h-32 object-cover rounded-xl mb-3" 
                          />
                          <p className="text-sm font-bold text-white line-clamp-2 leading-snug">
                            {getLoc(language, prop.titleKu, prop.titleEn, prop.titleAr)}
                          </p>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {/* Price */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800">{t('marketplace.comparison.price', 'Price')}</td>
                    {compareList.map(prop => (
                      <td key={prop.id} className="p-3 font-black text-amber-400 border-b border-slate-800">
                        ${prop.priceUsd.toLocaleString()} 
                        <span className="text-xs text-slate-400 font-normal">
                          {prop.period ? (prop.period === 'month' ? '/mo' : '/yr') : ''}
                        </span>
                      </td>
                    ))}
                  </tr>
                  {/* Location */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800">{t('marketplace.comparison.location', 'Location')}</td>
                    {compareList.map(prop => (
                      <td key={prop.id} className="p-3 text-slate-200 font-medium border-b border-slate-800">
                        {getLoc(language, prop.cityKu, prop.cityEn, prop.cityAr)} • {getLoc(language, prop.areaKu, prop.areaEn, prop.areaAr)}
                      </td>
                    ))}
                  </tr>
                  {/* Type */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800">{t('marketplace.filters.property_type', 'Type')}</td>
                    {compareList.map(prop => (
                      <td key={prop.id} className="p-3 text-slate-200 font-medium border-b border-slate-800 capitalize">
                        {prop.category}
                      </td>
                    ))}
                  </tr>
                  {/* Bedrooms */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800">{t('marketplace.modal.bedrooms_label', 'Bedrooms')}</td>
                    {compareList.map(prop => (
                      <td key={prop.id} className="p-3 text-slate-200 font-medium border-b border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Bed className="w-4 h-4 text-slate-400" />
                          {prop.bedrooms}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {/* Bathrooms */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800">{t('marketplace.modal.bathrooms_label', 'Bathrooms')}</td>
                    {compareList.map(prop => (
                      <td key={prop.id} className="p-3 text-slate-200 font-medium border-b border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Bath className="w-4 h-4 text-slate-400" />
                          {prop.bathrooms}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {/* Area (sqm) */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800">{t('marketplace.modal.area_label', 'Area')}</td>
                    {compareList.map(prop => (
                      <td key={prop.id} className="p-3 text-slate-200 font-medium border-b border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <Maximize2 className="w-4 h-4 text-slate-400" />
                          {prop.sizeM2} {t('marketplace.specs.sqm')}
                        </div>
                      </td>
                    ))}
                  </tr>
                  {/* Amenities */}
                  <tr className="hover:bg-[#111b2e]/60 transition-colors">
                    <td className="p-3 font-semibold text-slate-400 border-b border-slate-800 align-top">{t('marketplace.modal.amenities_features', 'Amenities')}</td>
                    {compareList.map(prop => {
                      const amens = (language === 'en' && prop.amenitiesEn?.length)
                        ? prop.amenitiesEn
                        : (language === 'ar' && prop.amenitiesAr?.length)
                        ? prop.amenitiesAr
                        : prop.amenitiesKu || prop.amenities || [];
                        
                      return (
                        <td key={prop.id} className="p-3 text-slate-200 border-b border-slate-800 align-top">
                          <ul className="space-y-1.5">
                            {amens.slice(0, 5).map((a: string, i: number) => (
                              <li key={i} className="flex items-start gap-1.5 text-[11px] font-medium bg-[#080d19] border border-slate-800 px-2 py-1 rounded-md text-amber-300">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                                <span>{a}</span>
                              </li>
                            ))}
                            {amens.length > 5 && (
                              <li className="text-[10px] text-slate-400 font-bold px-1">+{amens.length - 5} {t('marketplace.comparison.more', 'more')}</li>
                            )}
                          </ul>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              {compareList.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-slate-400 font-medium">{t('marketplace.comparison.empty', 'No properties selected for comparison.')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
