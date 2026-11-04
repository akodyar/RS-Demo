import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building, 
  Home, 
  MapPin, 
  SlidersHorizontal, 
  Search, 
  Bell, 
  User, 
  Heart, 
  Eye, 
  FileText, 
  Calendar, 
  Handshake, 
  Bot, 
  Sparkles, 
  ChevronRight, 
  X, 
  Check, 
  AlertCircle, 
  ShieldAlert, 
  Clock, 
  Globe, 
  RefreshCw, 
  Compass, 
  FileCheck,
  Send,
  Building2,
  Map,
  BadgePercent,
  CreditCard,
  ShoppingBag,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Filter,
  DollarSign,
  LogOut
} from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { useToast } from '../components/ui/Toast';
import { useI18n } from '../i18n/I18nProvider';
import { 
  BuyerDashboardData, 
  BuyerOfferItem, 
  BuyerViewingItem, 
  BuyerInquiryItem,
  BuyerFavoriteItem,
  SalesContractItem,
  SalesTransactionItem,
  BuyerPaymentItem,
  BuyerDocumentItem,
  BuyerNotificationItem,
  DueDiligenceChecklist
} from '../types/buyer.js';
import { FeatureFlags } from '../utils/featureFlags.js';

export type BuyerTabType = 
  | 'overview' 
  | 'discovery' 
  | 'saved' 
  | 'inquiries' 
  | 'viewings' 
  | 'offers' 
  | 'transactions' 
  | 'contracts' 
  | 'payments' 
  | 'notifications' 
  | 'profile';

type Language = 'ku' | 'ar' | 'en';

export const BuyerWorkspace: React.FC = () => {
  const { showToast } = useToast();
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const { language, setLanguage, direction } = useI18n();
  const lang: Language = (language === 'ar' || language === 'en') ? language : 'ku';
  const setLang = (newLang: Language) => setLanguage(newLang);
  const [activeTab, setActiveTab] = useState<BuyerTabType>('overview');
  const [dashboardData, setDashboardData] = useState<BuyerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  const handleLogout = async () => {
    await logout();
    navigate('/');
  };
  
  // Search & Filter state for Discovery tab
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [minPriceFilter, setMinPriceFilter] = useState('');
  const [maxPriceFilter, setMaxPriceFilter] = useState('');
  const [discoveryListings, setDiscoveryListings] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  // Modals
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [showDueDiligenceModal, setShowDueDiligenceModal] = useState(false);
  const [showAIAdvisorModal, setShowAIAdvisorModal] = useState(false);
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);

  // Form states
  const [viewingDate, setViewingDate] = useState('');
  const [viewingNotes, setViewingNotes] = useState('');
  const [offerAmount, setOfferAmount] = useState('');
  const [offerTerms, setOfferTerms] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [counterOfferId, setCounterOfferId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterTerms, setCounterTerms] = useState('');

  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isRTL = lang === 'ku' || lang === 'ar';

  const t = {
    ku: {
      appName: 'HomeHub',
      tagline: 'پلاتفۆرمی مۆدێرنی کڕینی خانووبەرە',
      greetingMorning: 'بەیانیت باش',
      findNextHome: 'با ماڵی داهاتووت بدۆزینەوە 🏠',
      locationDefault: 'هەولێر، کوردستان',
      searchPlaceholder: 'گەڕان بەدوای موڵک، ناوچە، یان وشەی سەرەکی...',
      nav: {
        overview: 'دەستپێک',
        discovery: 'گەڕان بەدوای موڵک',
        saved: 'دڵخوازەکان',
        inquiries: 'پرسیارەکان',
        viewings: 'سەردانەکان',
        offers: 'پێشنیارەکان',
        transactions: 'مامەڵەکان',
        contracts: 'گرێبەستەکان',
        payments: 'پارەدانەکان',
        notifications: 'ئاگادارییەکان',
        profile: 'پڕۆفایل'
      },
      categories: {
        all: 'هەموو',
        apartments: 'شوقەکان',
        villas: 'ڤێلاکان',
        houses: 'خانووەکان',
        land: 'زەوی',
        commercial: 'بازرگانی'
      },
      featuredProperties: 'موڵکە دیارەکان',
      viewAll: 'بینینی هەموو',
      myActivity: 'چالاکییەکانی من',
      activitySaved: 'دڵخوازکراو',
      activityViewed: 'بینراو',
      activityInquiries: 'پرسیارەکان',
      activityVisits: 'سەردانەکان',
      activityOffers: 'پێشنیارەکان',
      propertiesLabel: 'موڵک',
      activeLabel: 'چالاک',
      scheduledLabel: 'دیاریکراو',
      inProgressLabel: 'لە قۆناغی کاردا',
      aiAssistantTitle: 'یاریدەدەری زیرەکی دەستکرد',
      aiAssistantDesc: 'پێشنیاری تایبەتکراوی زیرەکی دەستکرد وەربگرە',
      recommendedForYou: 'پێشنیارکراو بۆ تۆ',
      forSale: 'بۆ فرۆشتن',
      forRent: 'بۆ کرێ',
      makeOffer: 'پێشکەشکردنی پێشنیار',
      requestViewing: 'داواکردنی سەردان',
      sendInquiry: 'ناردنی پرسیار',
      dueDiligence: 'پشکنینی تاپۆ و یاسایی',
      dbNotConfigured: 'سیستەمی داتابەیسی PostgreSQL پەیوەست نەکراوە (Fail-Closed). تکایە هێڵی پەیوەندی داتابەیس چالاک بکە.',
      retry: 'دووبارە هەوڵبدەرەوە',
      loadingText: 'بارکردنی زانیارییەکانی کڕیار...',
      noItems: 'هیچ بڕگەیەک نەدۆزرایەوە',
      currency: 'د.ع',
      commissionNotice: 'سیاسەتی دارایی: هیچ ڕێژەیەکی کرێ ناخرێتە سەر کڕینی موڵک یان پێشنیاری کڕیار.',
      verifiedDeed: 'سەلمێنراوی تاپۆ',
      milestones: {
        opened: 'دەستپێکردنی مامەڵە',
        dueDiligence: 'پشکنینی یاسایی',
        contract: 'واژۆی گرێبەست',
        payment: 'قۆناغی پارەدان',
        settlement: 'پاکتاوکردن',
        closing: 'ڕادەستکردن',
        closed: 'کۆتاییهاتوو'
      }
    },
    ar: {
      appName: 'HomeHub',
      tagline: 'منصة عقارية متكاملة للمشترين',
      greetingMorning: 'صباح الخير',
      findNextHome: 'دعنا نجد منزلك القادم 🏠',
      locationDefault: 'أربيل، كردستان',
      searchPlaceholder: 'ابحث عن عقارات، مناطق، أو كلمات رئيسية...',
      nav: {
        overview: 'نظرة عامة',
        discovery: 'استكشاف العقارات',
        saved: 'المحفوظات',
        inquiries: 'الاستفسارات',
        viewings: 'الزيارات',
        offers: 'العروض',
        transactions: 'المعاملات',
        contracts: 'العقود',
        payments: 'المدفوعات',
        notifications: 'الإشعارات',
        profile: 'الملف الشخصي'
      },
      categories: {
        all: 'الكل',
        apartments: 'شقق',
        villas: 'فلل',
        houses: 'منازل',
        land: 'أراضي',
        commercial: 'تجاري'
      },
      featuredProperties: 'العقارات المميزة',
      viewAll: 'عرض الكل',
      myActivity: 'نشاطي',
      activitySaved: 'المحفوظات',
      activityViewed: 'المشاهدات',
      activityInquiries: 'الاستفسارات',
      activityVisits: 'الزيارات',
      activityOffers: 'العروض',
      propertiesLabel: 'عقار',
      activeLabel: 'نشط',
      scheduledLabel: 'مجدول',
      inProgressLabel: 'قيد التنفيذ',
      aiAssistantTitle: 'المساعد العقاري الذكي',
      aiAssistantDesc: 'احصل على توصيات عقارية مخصصة',
      recommendedForYou: 'موصى به لك',
      forSale: 'للبيع',
      forRent: 'للإيجار',
      makeOffer: 'تقديم عرض',
      requestViewing: 'طلب معاينة',
      sendInquiry: 'إرسال استفسار',
      dueDiligence: 'الفحص القانوني وسند الملكية',
      dbNotConfigured: 'قاعدة بيانات PostgreSQL غير متصلة (Fail-Closed). يرجى تكوين الاتصال بقاعدة البيانات.',
      retry: 'إعادة المحاولة',
      loadingText: 'جاري تحميل بيانات المشتري...',
      noItems: 'لا توجد عناصر',
      currency: 'د.ع',
      commissionNotice: 'السياسة المالية: لا تنطبق عمولة الإيجار على معاملات الشراء أو عروض المشتري.',
      verifiedDeed: 'سند ملكية موثق',
      milestones: {
        opened: 'بدء المعاملة',
        dueDiligence: 'الفحص القانوني',
        contract: 'توقيع العقد',
        payment: 'مرحلة الدفع',
        settlement: 'التسوية المالية',
        closing: 'الإغلاق النهائي',
        closed: 'مكتمل'
      }
    },
    en: {
      appName: 'HomeHub',
      tagline: 'Autonomous Real Estate Ecosystem',
      greetingMorning: 'Good morning',
      findNextHome: "Let's find your next home 🏠",
      locationDefault: 'Erbil, Kurdistan',
      searchPlaceholder: 'Search properties, areas, or keywords...',
      nav: {
        overview: 'Overview',
        discovery: 'Property Discovery',
        saved: 'Saved',
        inquiries: 'Inquiries',
        viewings: 'Viewings',
        offers: 'Offers',
        transactions: 'Transactions',
        contracts: 'Contracts',
        payments: 'Payments',
        notifications: 'Notifications',
        profile: 'Profile'
      },
      categories: {
        all: 'All',
        apartments: 'Apartments',
        villas: 'Villas',
        houses: 'Houses',
        land: 'Land',
        commercial: 'Commercial'
      },
      featuredProperties: 'Featured Properties',
      viewAll: 'View All',
      myActivity: 'My Activity',
      activitySaved: 'Saved',
      activityViewed: 'Viewed',
      activityInquiries: 'Inquiries',
      activityVisits: 'Site Visits',
      activityOffers: 'Offers',
      propertiesLabel: 'properties',
      activeLabel: 'active',
      scheduledLabel: 'scheduled',
      inProgressLabel: 'in progress',
      aiAssistantTitle: 'AI Property Assistant',
      aiAssistantDesc: 'Get personalized property recommendations',
      recommendedForYou: 'Recommended for You',
      forSale: 'For Sale',
      forRent: 'For Rent',
      makeOffer: 'Make Offer',
      requestViewing: 'Request Viewing',
      sendInquiry: 'Send Inquiry',
      dueDiligence: 'Legal & Title Deed Inspection',
      dbNotConfigured: 'PostgreSQL database is unconfigured (Fail-Closed enforced). Please configure SQL credentials.',
      retry: 'Retry',
      loadingText: 'Loading buyer workspace...',
      noItems: 'No items found',
      currency: 'IQD',
      commissionNotice: 'Financial Policy: Rent management fees are strictly excluded from property purchases and buyer offers.',
      verifiedDeed: 'Verified Title Deed',
      milestones: {
        opened: 'Transaction Opened',
        dueDiligence: 'Due Diligence',
        contract: 'Contract Execution',
        payment: 'Payment Milestones',
        settlement: 'Settlement',
        closing: 'Closing',
        closed: 'Completed'
      }
    }
  }[lang];

  const getAuthHeaders = () => {
    return {
      'Authorization': token ? `Bearer ${token}` : 'Bearer dev-buyer',
      'Content-Type': 'application/json'
    };
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/buyer/dashboard', {
        headers: getAuthHeaders()
      });
      if (res.status === 503) {
        setError('DATABASE_NOT_CONFIGURED');
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP_${res.status}`);
      }
      const data = await res.json();
      setDashboardData(data);
    } catch (err: any) {
      setError(err.message || 'FAILED_TO_LOAD');
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoveryListings = async () => {
    setDiscoveryLoading(true);
    try {
      let url = '/api/marketplace/listings/search?limit=30';
      if (selectedCategory !== 'all') {
        url += `&propertyType=${encodeURIComponent(selectedCategory)}`;
      }
      if (minPriceFilter) {
        url += `&minPrice=${encodeURIComponent(minPriceFilter)}`;
      }
      if (maxPriceFilter) {
        url += `&maxPrice=${encodeURIComponent(maxPriceFilter)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDiscoveryListings(data.items || []);
      }
    } catch {
      // Fallback cleanly
    } finally {
      setDiscoveryLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'discovery') {
      fetchDiscoveryListings();
    }
  }, [activeTab, selectedCategory, minPriceFilter, maxPriceFilter]);

  // Viewing Submission
  const handleRequestViewingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty || !viewingDate) return;

    setActionLoading(true);
    setActionSuccessMsg(null);
    try {
      const res = await fetch('/api/buyer/viewings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          propertyId: selectedProperty.id || selectedProperty.propertyId,
          listingId: selectedProperty.listingId,
          scheduledAt: new Date(viewingDate).toISOString(),
          viewingType: 'IN_PERSON',
          notes: viewingNotes
        })
      });

      if (res.status === 503) {
        showToast(t.dbNotConfigured, 'info');
        return;
      }

      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || 'Failed to request viewing', 'error');
        return;
      }

      setActionSuccessMsg('سەردانەکە بە سەرکەوتوویی داواکرا! چاوەڕوانی پشتڕاستکردنەوەبە.');
      setTimeout(() => {
        setShowViewingModal(false);
        setActionSuccessMsg(null);
        fetchDashboard();
      }, 1500);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Offer Submission
  const handleMakeOfferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty || !offerAmount) return;

    setActionLoading(true);
    setActionSuccessMsg(null);
    try {
      const res = await fetch('/api/buyer/offers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          propertyId: selectedProperty.id || selectedProperty.propertyId,
          listingId: selectedProperty.listingId,
          offerAmount: Number(offerAmount),
          currency: 'IQD',
          terms: offerTerms
        })
      });

      if (res.status === 503) {
        showToast(t.dbNotConfigured, 'info');
        return;
      }

      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || 'Failed to submit offer', 'error');
        return;
      }

      setActionSuccessMsg('پێشنیاری کڕین بە سەرکەوتوویی تۆمارکرا!');
      setTimeout(() => {
        setShowOfferModal(false);
        setActionSuccessMsg(null);
        fetchDashboard();
      }, 1500);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Inquiry Submission
  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProperty || !inquiryMessage) return;

    setActionLoading(true);
    setActionSuccessMsg(null);
    try {
      const res = await fetch('/api/buyer/inquiries', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          propertyId: selectedProperty.id || selectedProperty.propertyId,
          listingId: selectedProperty.listingId,
          message: inquiryMessage
        })
      });

      if (res.status === 503) {
        showToast(t.dbNotConfigured, 'info');
        return;
      }

      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || 'Failed to submit inquiry', 'error');
        return;
      }

      setActionSuccessMsg('پرسیارەکەت بە سەرکەوتوویی نێردرا!');
      setTimeout(() => {
        setShowInquiryModal(false);
        setActionSuccessMsg(null);
        setInquiryMessage('');
        fetchDashboard();
      }, 1500);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (propertyId: string, listingId?: string) => {
    const isFav = dashboardData?.activity.savedCount && dashboardData.featuredProperties.some(p => p.id === propertyId);
    try {
      if (isFav) {
        await fetch(`/api/buyer/favorites/${propertyId}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      } else {
        await fetch('/api/buyer/favorites', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ propertyId, listingId })
        });
      }
      fetchDashboard();
    } catch {
      // safe fallback
    }
  };

  // Cancel Viewing
  const handleCancelViewing = async (viewingId: string) => {
    if (!confirm('ئایا دڵنیایت لە هەڵوەشاندنەوەی ئەم سەردانە؟')) return;
    try {
      const res = await fetch(`/api/buyer/viewings/${viewingId}/cancel`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'Cancelled by buyer from workspace' })
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Withdraw Offer
  const handleWithdrawOffer = async (offerId: string) => {
    if (!confirm('ئایا دڵنیایت لە کشانەوەی ئەم پێشنیارە؟')) return;
    try {
      const res = await fetch(`/api/buyer/offers/${offerId}/withdraw`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason: 'Withdrawn by buyer' })
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Respond to Counter-Offer (Accept or Reject)
  const handleRespondCounter = async (offerId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      const res = await fetch(`/api/buyer/offers/${offerId}/respond`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, note: `Buyer responded with ${action}` })
      });
      if (res.ok) {
        fetchDashboard();
      } else {
        const d = await res.json();
        showToast(d.error || 'Failed to respond', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const buyerName = dashboardData?.buyerName || (user?.displayName || ((user as any)?.firstName ? `${(user as any).firstName} ${(user as any).lastName}`.trim() : 'Buyer'));
  // Activity KPI stats
  const activity = dashboardData?.activity || {
    savedCount: 0,
    viewedCount: 0,
    inquiriesCount: 0,
    scheduledVisitsCount: 0,
    activeOffersCount: 0
  };

  const getTabTitle = (tab: BuyerTabType) => {
    switch (tab) {
      case 'overview': return t.nav.overview;
      case 'discovery': return t.nav.discovery;
      case 'saved': return t.nav.saved;
      case 'inquiries': return t.nav.inquiries;
      case 'viewings': return t.nav.viewings;
      case 'offers': return t.nav.offers;
      case 'transactions': return t.nav.transactions;
      case 'contracts': return t.nav.contracts;
      case 'payments': return t.nav.payments;
      case 'notifications': return t.nav.notifications;
      case 'profile': return t.nav.profile;
      default: return '';
    }
  };

  return (
    <div 
      dir={direction} 
      className={`min-h-screen bg-[#070b14] text-white flex flex-col lg:flex-row ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden lg:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Buyer Workspace Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Buyer Dashboard"
            aria-label="HomeHub Buyer Dashboard"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Buyer Navigation"
          >
            {/* 1. Overview */}
            <button
              type="button"
              data-testid="buyer-tab-overview"
              onClick={() => setActiveTab('overview')}
              title={t.nav.overview}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'overview'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'overview' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Home className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'overview' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t.nav.overview}
              </span>
            </button>

            {/* 2. Discovery */}
            <button
              type="button"
              data-testid="buyer-tab-discovery"
              onClick={() => setActiveTab('discovery')}
              title={t.nav.discovery}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'discovery'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'discovery' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Search className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'discovery' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'گەڕان' : lang === 'ar' ? 'بحث' : 'Search'}
              </span>
            </button>

            {/* 3. Saved */}
            <button
              type="button"
              data-testid="buyer-tab-saved"
              onClick={() => setActiveTab('saved')}
              title={t.nav.saved}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'saved'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'saved' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Heart className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'saved' ? 'text-rose-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t.nav.saved}
              </span>
              {activity.savedCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {activity.savedCount}
                </span>
              )}
            </button>

            {/* 4. Inquiries */}
            <button
              type="button"
              data-testid="buyer-tab-inquiries"
              onClick={() => setActiveTab('inquiries')}
              title={t.nav.inquiries}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'inquiries'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'inquiries' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'inquiries' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'پرسیار' : lang === 'ar' ? 'استفسار' : 'Inquiries'}
              </span>
            </button>

            {/* 5. Viewings */}
            <button
              type="button"
              data-testid="buyer-tab-viewings"
              onClick={() => setActiveTab('viewings')}
              title={t.nav.viewings}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'viewings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'viewings' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Calendar className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'viewings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'سەردان' : lang === 'ar' ? 'معاينة' : 'Visits'}
              </span>
              {activity.scheduledVisitsCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {activity.scheduledVisitsCount}
                </span>
              )}
            </button>

            {/* 6. Offers */}
            <button
              type="button"
              data-testid="buyer-tab-offers"
              onClick={() => setActiveTab('offers')}
              title={t.nav.offers}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'offers'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'offers' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Handshake className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'offers' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'پێشنیار' : lang === 'ar' ? 'العروض' : 'Offers'}
              </span>
              {activity.activeOffersCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {activity.activeOffersCount}
                </span>
              )}
            </button>

            {/* 7. Transactions */}
            <button
              type="button"
              onClick={() => setActiveTab('transactions')}
              title={t.nav.transactions}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'transactions'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'transactions' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <ShoppingBag className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'transactions' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'مامەڵە' : lang === 'ar' ? 'الصفقات' : 'Deals'}
              </span>
            </button>

            {/* 8. Contracts */}
            <button
              type="button"
              onClick={() => setActiveTab('contracts')}
              title={t.nav.contracts}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'contracts'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'contracts' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileCheck className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'contracts' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'گرێبەست' : lang === 'ar' ? 'العقود' : 'Contracts'}
              </span>
            </button>

            {/* 9. Payments */}
            <button
              type="button"
              onClick={() => setActiveTab('payments')}
              title={t.nav.payments}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'payments'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'payments' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CreditCard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'payments' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'پارەدان' : lang === 'ar' ? 'الدفع' : 'Payments'}
              </span>
            </button>

            {/* 10. Profile */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              title={t.nav.profile}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'profile'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'profile' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <User className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'profile' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {lang === 'ku' ? 'پڕۆفایل' : lang === 'ar' ? 'الملف' : 'Profile'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: AI Advisor Modal */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setShowAIAdvisorModal(true)}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={t.aiAssistantTitle}
            aria-label={t.aiAssistantTitle}
          >
            <Sparkles className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Mobile Bar + Main Content)          */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 pb-20">
        {/* Minimal Razor-Sharp Desktop & Mobile Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 lg:px-8 h-16 flex items-center justify-between gap-4 text-white">
          {/* Start: Mobile Brand Logo & Desktop Breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Mobile Brand Logo */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg p-1"
                aria-label="HomeHub Buyer Dashboard"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xs">
                  HH
                </div>
                <span className="font-bold text-sm tracking-tight text-white">{t.appName}</span>
              </button>
            </div>

            {/* Desktop Breadcrumbs & Active Title */}
            <div className="hidden lg:flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {lang === 'ku' ? 'شوێنی کاری کڕیار' : lang === 'ar' ? 'مساحة عمل المشتري' : 'Buyer Workspace'}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>

            {/* Live KPI Pill */}
            {activity.activeOffersCount > 0 && (
              <div className="hidden xl:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {lang === 'ku'
                    ? `${activity.activeOffersCount} پێشنیاری چالاک`
                    : lang === 'ar'
                    ? `${activity.activeOffersCount} عروض نشطة`
                    : `${activity.activeOffersCount} Active Offers`}
                </span>
              </div>
            )}
          </div>

          {/* End Header Area: Actions + Language + Notifications + Profile */}
          <div className="flex items-center gap-2.5">
            {/* AI Assistant Quick Pill on Desktop */}
            <button 
              type="button"
              onClick={() => setShowAIAdvisorModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-bold transition-colors border border-amber-500/30 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.aiAssistantTitle}</span>
            </button>

            {/* Language Switcher */}
            <div className="flex items-center bg-[#080d19] border border-slate-800 rounded-xl p-1 text-xs font-semibold">
              <button 
                onClick={() => setLang('ku')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${lang === 'ku' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'}`}
              >
                کوردی
              </button>
              <button 
                onClick={() => setLang('ar')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${lang === 'ar' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'}`}
              >
                عربي
              </button>
              <button 
                onClick={() => setLang('en')}
                className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${lang === 'en' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400'}`}
              >
                EN
              </button>
            </div>

            {/* Notifications Button */}
            <button 
              onClick={() => setActiveTab('notifications')}
              className="relative p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500"
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {dashboardData?.notifications && dashboardData.notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-[#0c1322]" />
              )}
            </button>

            {/* Profile Avatar Pill */}
            <div 
              onClick={() => setActiveTab('profile')}
              className="relative cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 shadow-xs flex items-center justify-center font-bold text-xs">
                {buyerName.charAt(0)}
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0c1322]" />
            </div>
          </div>
        </header>

        {/* Mobile Navigation Scroll (< lg) */}
        <div className="lg:hidden flex items-center gap-1 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 px-4 py-2.5 overflow-x-auto scrollbar-none sticky top-16 z-30 shadow-md">
          {[
            { id: 'overview', label: t.nav.overview, icon: Home },
            { id: 'discovery', label: t.nav.discovery, icon: Search },
            { id: 'saved', label: t.nav.saved, icon: Heart },
            { id: 'inquiries', label: t.nav.inquiries, icon: FileText },
            { id: 'viewings', label: t.nav.viewings, icon: Calendar },
            { id: 'offers', label: t.nav.offers, icon: Handshake },
            { id: 'transactions', label: t.nav.transactions, icon: ShoppingBag },
            { id: 'contracts', label: t.nav.contracts, icon: FileCheck },
            { id: 'payments', label: t.nav.payments, icon: CreditCard },
            { id: 'notifications', label: t.nav.notifications, icon: Bell },
            { id: 'profile', label: t.nav.profile, icon: User },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as BuyerTabType)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  active ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!FeatureFlags.BUY_SELL_ENABLED ? (
          <div className="p-8 text-center bg-[#0c1322] border border-amber-500/20 rounded-2xl flex flex-col items-center justify-center text-slate-100 my-6 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
              <ShieldAlert className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-2xl font-black text-slate-100 mb-2">
              {lang === 'ku' ? 'کڕین و فرۆشتن لەکارخراوە' : lang === 'ar' ? 'تم تعطيل البيع والشراء' : 'Buying & Selling is Disabled'}
            </h2>
            <p className="text-sm text-slate-400 max-w-md">
              {lang === 'ku' ? 'تایبەتمەندی کڕین و فرۆشتن لە ئێستادا لە سەرانسەری سیستەمی HomeHub ناچالاک کراوە.' :
               lang === 'ar' ? 'ميزة البيع والشراء معطلة حالياً عبر نظام HomeHub بالكامل.' :
               'The buying and selling feature is currently disabled globally across the HomeHub system.'}
            </p>
          </div>
        ) : (
          <>
        {/* Fail-Closed Database Banner if unavailable */}
        {error === 'DATABASE_NOT_CONFIGURED' && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 shadow-xs">
            <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-bold text-amber-900">دۆخی ئاگاداری: PostgreSQL بەردەست نییە (Fail-Closed)</p>
              <p className="text-amber-800 text-xs mt-1 leading-relaxed">{t.dbNotConfigured}</p>
              <button 
                onClick={fetchDashboard}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-200/80 px-3 py-1.5 rounded-lg hover:bg-amber-200 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t.retry}
              </button>
            </div>
          </div>
        )}

        {/* Financial Policy & Commission Disclaimer */}
        <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-2xl flex items-center justify-between text-xs text-blue-950">
          <div className="flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{t.commissionNotice}</span>
          </div>
          <span className="font-mono text-[11px] text-blue-800 bg-white px-2 py-0.5 rounded-md border border-blue-100">
            0% Sales Comm.
          </span>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Personalized Welcome Card */}
            <section className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">
                  {t.greetingMorning}, <span className="text-blue-600">{buyerName}</span>
                </h1>
                <p className="text-xs text-neutral-500 mt-0.5">{t.findNextHome}</p>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200/80 rounded-full text-xs font-semibold text-neutral-700 shadow-xs">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>{t.locationDefault}</span>
              </div>
            </section>

            {/* My Activity 5-Card Grid */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-neutral-900">{t.myActivity}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {/* 1. Saved */}
                <button 
                  onClick={() => setActiveTab('saved')}
                  className="p-3.5 rounded-2xl bg-white border border-neutral-100 shadow-xs flex flex-col items-center text-center hover:border-red-200 transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mb-1.5">
                    <Heart className="w-4 h-4 fill-red-500" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">{t.activitySaved}</span>
                  <span className="text-base font-extrabold text-neutral-900 mt-0.5">{activity.savedCount}</span>
                  <span className="text-[10px] text-neutral-400">{t.propertiesLabel}</span>
                </button>

                {/* 2. Viewed */}
                <div className="p-3.5 rounded-2xl bg-white border border-neutral-100 shadow-xs flex flex-col items-center text-center">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-1.5">
                    <Eye className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">{t.activityViewed}</span>
                  <span className="text-base font-extrabold text-neutral-900 mt-0.5">{activity.viewedCount}</span>
                  <span className="text-[10px] text-neutral-400">{t.propertiesLabel}</span>
                </div>

                {/* 3. Inquiries */}
                <button 
                  onClick={() => setActiveTab('inquiries')}
                  className="p-3.5 rounded-2xl bg-white border border-neutral-100 shadow-xs flex flex-col items-center text-center hover:border-purple-200 transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-1.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">{t.activityInquiries}</span>
                  <span className="text-base font-extrabold text-neutral-900 mt-0.5">{activity.inquiriesCount}</span>
                  <span className="text-[10px] text-neutral-400">{t.activeLabel}</span>
                </button>

                {/* 4. Site Visits */}
                <button 
                  onClick={() => setActiveTab('viewings')}
                  className="p-3.5 rounded-2xl bg-white border border-neutral-100 shadow-xs flex flex-col items-center text-center hover:border-emerald-200 transition-all cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">{t.activityVisits}</span>
                  <span className="text-base font-extrabold text-neutral-900 mt-0.5">{activity.scheduledVisitsCount}</span>
                  <span className="text-[10px] text-neutral-400">{t.scheduledLabel}</span>
                </button>

                {/* 5. Offers */}
                <button 
                  onClick={() => setActiveTab('offers')}
                  className="p-3.5 rounded-2xl bg-white border border-neutral-100 shadow-xs flex flex-col items-center text-center hover:border-amber-200 transition-all cursor-pointer col-span-2 sm:col-span-1"
                >
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-1.5">
                    <Handshake className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-neutral-500">{t.activityOffers}</span>
                  <span className="text-base font-extrabold text-neutral-900 mt-0.5">{activity.activeOffersCount}</span>
                  <span className="text-[10px] text-neutral-400">{t.inProgressLabel}</span>
                </button>
              </div>
            </section>

            {/* Featured Properties Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-neutral-900">{t.featuredProperties}</h2>
                <button 
                  onClick={() => setActiveTab('discovery')}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>{t.viewAll}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(dashboardData?.featuredProperties && dashboardData.featuredProperties.length > 0) ? (
                  dashboardData.featuredProperties.map((prop: any) => (
                    <div 
                      key={prop.id}
                      className="bg-white rounded-3xl border border-neutral-100 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                    >
                      <div className="relative h-44 bg-neutral-100 overflow-hidden">
                        <img 
                          src={prop.imageUrl} 
                          alt={prop.name}
                          className="w-full h-full object-cover" 
                        />
                        <span className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                          {t.forSale}
                        </span>
                        <button 
                          onClick={() => handleToggleFavorite(prop.id, prop.listingId)}
                          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-xs flex items-center justify-center text-neutral-700 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Heart className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <h3 className="font-bold text-sm text-neutral-900 truncate">{prop.name}</h3>
                          <p className="text-blue-600 font-extrabold text-sm mt-0.5">
                            <span dir="ltr">{prop.price.toLocaleString()}</span> {t.currency}
                          </p>
                          <p className="text-neutral-400 text-xs flex items-center gap-1 mt-1 truncate">
                            <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                            <span className="truncate">{prop.location}</span>
                          </p>
                        </div>

                        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
                          <span>🛏️ {prop.beds} beds</span>
                          <span>🚿 {prop.baths} baths</span>
                          <span>📐 <span dir="ltr">{prop.squareMeters}</span> m²</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button 
                            onClick={() => {
                              setSelectedProperty(prop);
                              setShowViewingModal(true);
                            }}
                            className="w-full py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors text-center cursor-pointer"
                          >
                            {t.requestViewing}
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedProperty(prop);
                              setShowOfferModal(true);
                            }}
                            className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors text-center shadow-xs cursor-pointer"
                          >
                            {t.makeOffer}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 p-8 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                    {t.noItems}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* TAB 2: PROPERTY DISCOVERY */}
        {activeTab === 'discovery' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{t.nav.discovery}</h1>
                <p className="text-xs text-neutral-500">فلتەرکردن و دۆزینەوەی هەموو موڵکە بەردەستەکانی فرۆشتن لە کوردستان</p>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-3xl border border-neutral-200/80 shadow-xs space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="relative">
                  <Search className={`w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-3' : 'left-3'}`} />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.searchPlaceholder}
                    className={`w-full h-11 bg-neutral-50 border border-neutral-200 rounded-xl text-xs text-neutral-800 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                  />
                </div>

                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-11 bg-neutral-50 border border-neutral-200 rounded-xl text-xs px-3 text-neutral-800"
                >
                  <option value="all">هەموو جۆرەکانی موڵک</option>
                  <option value="apartment">شوقە</option>
                  <option value="villa">ڤێلا</option>
                  <option value="house">خانوو</option>
                  <option value="commercial">بازرگانی</option>
                </select>

                <input 
                  type="number" 
                  value={minPriceFilter}
                  onChange={(e) => setMinPriceFilter(e.target.value)}
                  placeholder="کەمترین نرخ (IQD)"
                  className="h-11 bg-neutral-50 border border-neutral-200 rounded-xl text-xs px-3 text-neutral-800"
                />

                <input 
                  type="number" 
                  value={maxPriceFilter}
                  onChange={(e) => setMaxPriceFilter(e.target.value)}
                  placeholder="زۆرترین نرخ (IQD)"
                  className="h-11 bg-neutral-50 border border-neutral-200 rounded-xl text-xs px-3 text-neutral-800"
                />
              </div>
            </div>

            {/* Discovery Listings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {discoveryLoading ? (
                <div className="col-span-3 p-12 text-center text-neutral-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  {t.loadingText}
                </div>
              ) : discoveryListings.length > 0 ? (
                discoveryListings.map((item: any) => (
                  <div key={item.id} className="bg-white rounded-3xl border border-neutral-100 shadow-xs overflow-hidden flex flex-col">
                    <div className="h-40 bg-neutral-100 relative">
                      <img 
                        src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80" 
                        alt={item.title} 
                        className="w-full h-full object-cover" 
                      />
                      <span className="absolute top-3 left-3 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        {item.type}
                      </span>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900 truncate">{item.title}</h4>
                        <p className="text-blue-600 font-extrabold text-sm">
                          <span dir="ltr">{Number(item.price).toLocaleString()}</span> {item.currency}
                        </p>
                        <p className="text-neutral-400 text-xs mt-1 truncate">{item.property?.name}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-1 pt-2">
                        <button 
                          onClick={() => {
                            setSelectedProperty({ ...item.property, listingId: item.id, price: item.price });
                            setShowViewingModal(true);
                          }}
                          className="py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold text-center cursor-pointer"
                        >
                          سەردان
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProperty({ ...item.property, listingId: item.id, price: item.price });
                            setShowInquiryModal(true);
                          }}
                          className="py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-[11px] font-bold text-center cursor-pointer"
                        >
                          پرسیار
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedProperty({ ...item.property, listingId: item.id, price: item.price });
                            setShowOfferModal(true);
                          }}
                          className="py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold text-center cursor-pointer"
                        >
                          پێشنیار
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ موڵکێک لە دۆخی گەڕاندا نەدۆزرایەوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SAVED PROPERTIES */}
        {activeTab === 'saved' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.saved}</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dashboardData?.featuredProperties && dashboardData.featuredProperties.length > 0 ? (
                dashboardData.featuredProperties.map((fav: any) => (
                  <div key={fav.id} className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-xs flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-neutral-100 overflow-hidden shrink-0">
                        <img src={fav.imageUrl} alt={fav.name} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900">{fav.name}</h4>
                        <p className="text-blue-600 font-extrabold text-xs mt-0.5">
                          <span dir="ltr">{fav.price.toLocaleString()}</span> {t.currency}
                        </p>
                        <p className="text-neutral-400 text-[11px]">{fav.location}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleToggleFavorite(fav.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ موڵکێکی دڵخوازکراو تۆمار نەکراوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: INQUIRIES */}
        {activeTab === 'inquiries' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.inquiries}</h1>
            <div className="space-y-3">
              {dashboardData?.recentInquiries && dashboardData.recentInquiries.length > 0 ? (
                dashboardData.recentInquiries.map((inq: BuyerInquiryItem) => (
                  <div key={inq.id} className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-neutral-900">{inq.property?.name || 'Inquiry'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        inq.status === 'RESPONDED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {inq.status}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl">{inq.message}</p>
                    {inq.responseMessage && (
                      <div className="text-xs text-blue-900 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                        <span className="font-bold block mb-1">وەڵامی خاوەن موڵک / نووسینگە:</span>
                        {inq.responseMessage}
                      </div>
                    )}
                    <span className="text-[10px] text-neutral-400 block" dir="ltr">{inq.createdAt}</span>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ پرسیارێک تۆمار نەکراوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: VIEWINGS */}
        {activeTab === 'viewings' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.viewings}</h1>
            <div className="space-y-3">
              {dashboardData?.upcomingViewings && dashboardData.upcomingViewings.length > 0 ? (
                dashboardData.upcomingViewings.map((v: BuyerViewingItem) => (
                  <div key={v.id} className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-xs flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-neutral-900">{v.property?.name || 'Property'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          v.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' :
                          v.status === 'CANCELLED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {v.status}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span dir="ltr">{new Date(v.scheduledAt).toLocaleString()}</span>
                      </p>
                      {v.notes && <p className="text-xs text-neutral-400 mt-0.5">{v.notes}</p>}
                    </div>

                    {v.status !== 'CANCELLED' && v.status !== 'COMPLETED' && (
                      <button 
                        onClick={() => handleCancelViewing(v.id)}
                        className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 cursor-pointer"
                      >
                        هەڵوەشاندنەوە
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ سەردانێکی مەیدانی دیارینەکراوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: OFFERS & NEGOTIATION */}
        {activeTab === 'offers' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.offers}</h1>
            <div className="space-y-4">
              {dashboardData?.activeOffers && dashboardData.activeOffers.length > 0 ? (
                dashboardData.activeOffers.map((o: BuyerOfferItem) => (
                  <div key={o.id} className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-neutral-900">{o.property?.name || 'Offer'}</h4>
                        <p className="text-blue-600 font-extrabold text-sm mt-0.5">
                          بڕی پێشنیارکراو: <span dir="ltr">{o.offerAmount.toLocaleString()}</span> {o.currency}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        o.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' :
                        o.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                        o.status === 'COUNTERED' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {o.status}
                      </span>
                    </div>

                    {o.terms && (
                      <p className="text-xs text-neutral-600 bg-neutral-50 p-2.5 rounded-xl">
                        مەرجەکان: {o.terms}
                      </p>
                    )}

                    {/* Negotiation History */}
                    {o.negotiationHistory && o.negotiationHistory.length > 0 && (
                      <div className="border-t border-neutral-100 pt-2 space-y-1.5">
                        <span className="text-[11px] font-bold text-neutral-500 block">مێژووی دانوستان:</span>
                        {o.negotiationHistory.map((h) => (
                          <div key={h.id} className="text-xs flex items-center justify-between text-neutral-700 bg-neutral-50/50 p-2 rounded-lg">
                            <span>{h.actorRole === 'BUYER' ? 'کڕیار' : 'خاوەن موڵک'}: <span dir="ltr">{h.counterAmount.toLocaleString()}</span> {h.currency}</span>
                            <span className="text-[10px] text-neutral-400">{h.status}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
                      {o.status === 'COUNTERED' && (
                        <>
                          <button 
                            onClick={() => handleRespondCounter(o.id, 'ACCEPT')}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                          >
                            پەسەندکردنی پێشنیاری بەرامبەر
                          </button>
                          <button 
                            onClick={() => handleRespondCounter(o.id, 'REJECT')}
                            className="px-3.5 py-1.5 rounded-xl bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 cursor-pointer"
                          >
                            ڕەتکردنەوە
                          </button>
                        </>
                      )}
                      {['OFFER_SUBMITTED', 'UNDER_REVIEW'].includes(o.status) && (
                        <button 
                          onClick={() => handleWithdrawOffer(o.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-bold hover:bg-neutral-200 cursor-pointer"
                        >
                          کشانەوەی پێشنیار
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ پێشنیارێکی کڕین لە ئێستادا تۆمار نەکراوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: TRANSACTIONS & MILESTONES */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.transactions}</h1>
            <div className="space-y-4">
              {dashboardData?.transactions && dashboardData.transactions.length > 0 ? (
                dashboardData.transactions.map((tx: SalesTransactionItem) => (
                  <div key={tx.id} className="bg-white p-5 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-mono text-neutral-400 block">{tx.transactionNumber}</span>
                        <h4 className="font-bold text-base text-neutral-900">
                          بڕی مامەڵە: <span dir="ltr">{tx.amount.toLocaleString()}</span> {tx.currency}
                        </h4>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700">
                        {tx.status}
                      </span>
                    </div>

                    {/* Milestone Progress Stepper */}
                    <div className="bg-neutral-50 p-3 rounded-2xl border border-neutral-100">
                      <span className="text-xs font-bold text-neutral-700 mb-2 block">قۆناغەکانی کڕین و تاپۆ:</span>
                      <div className="grid grid-cols-3 sm:grid-cols-7 gap-1 text-center">
                        {[
                          { key: 'TRANSACTION_OPENED', label: t.milestones.opened },
                          { key: 'DUE_DILIGENCE', label: t.milestones.dueDiligence },
                          { key: 'CONTRACT_EXECUTED', label: t.milestones.contract },
                          { key: 'PAYMENT_PENDING', label: t.milestones.payment },
                          { key: 'SETTLEMENT_PENDING', label: t.milestones.settlement },
                          { key: 'CLOSING_PENDING', label: t.milestones.closing },
                          { key: 'CLOSED', label: t.milestones.closed },
                        ].map((m, idx) => (
                          <div key={m.key} className="p-1.5 rounded-lg bg-white border border-neutral-100 text-[10px]">
                            <span className="font-bold block truncate">{m.label}</span>
                            <span className={`text-[9px] ${tx.status === m.key ? 'text-blue-600 font-extrabold' : 'text-neutral-400'}`}>
                              {idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ مامەڵەیەکی چالاکی کڕین لە پڕۆسەدا نییە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 8: CONTRACTS & DUE DILIGENCE */}
        {activeTab === 'contracts' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.contracts}</h1>
            <div className="space-y-4">
              {/* Due Diligence Checklist Card */}
              <div className="p-5 rounded-3xl bg-linear-to-br from-blue-900 to-indigo-950 text-white shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm">پشکنینی یاسایی و دڵنیابوونەوەی تاپۆ (Tapu Verification)</h3>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    سیستەمی دادوەری
                  </span>
                </div>
                <p className="text-xs text-blue-100 leading-relaxed">
                  هەموو گرێبەستەکانی کڕین بە پشکنینی ژمارەی تۆماری تاپۆ و بێبەریبوونی موڵک لە هەر بارمتە و قەرزێک دەبەسترێنەوە.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div className="bg-white/10 p-2 rounded-xl text-center">
                    <span className="text-emerald-400 font-bold block">✓ تاپۆی سەلمێنراو</span>
                  </div>
                  <div className="bg-white/10 p-2 rounded-xl text-center">
                    <span className="text-emerald-400 font-bold block">✓ بێ قەرز و باج</span>
                  </div>
                  <div className="bg-white/10 p-2 rounded-xl text-center">
                    <span className="text-emerald-400 font-bold block">✓ پشکنینی ئەندازیاری</span>
                  </div>
                  <div className="bg-white/10 p-2 rounded-xl text-center">
                    <span className="text-emerald-400 font-bold block">✓ گرێبەستی فەرمی</span>
                  </div>
                </div>
              </div>

              {/* Contracts List */}
              {dashboardData?.contracts && dashboardData.contracts.length > 0 ? (
                dashboardData.contracts.map((c: SalesContractItem) => (
                  <div key={c.id} className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono text-neutral-400 block">{c.contractNumber}</span>
                      <h4 className="font-bold text-sm text-neutral-900 mt-0.5">
                        نرخی ڕێککەوتوو: <span dir="ltr">{c.agreedPrice.toLocaleString()}</span> {c.currency}
                      </h4>
                      <p className="text-xs text-neutral-500 mt-0.5">دۆخ: {c.status}</p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-neutral-100 text-neutral-700">
                      {c.status}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ گرێبەستێکی کڕین تۆمار نەکراوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 9: PAYMENTS & FINANCIALS */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.payments}</h1>
            <div className="space-y-3">
              {dashboardData?.payments && dashboardData.payments.length > 0 ? (
                dashboardData.payments.map((p: BuyerPaymentItem) => (
                  <div key={p.id} className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-neutral-900">{p.propertyName || 'Property Payment'}</span>
                      <p className="text-blue-600 font-extrabold text-sm mt-0.5">
                        <span dir="ltr">{p.amount.toLocaleString()}</span> {p.currency}
                      </p>
                      <span className="text-[11px] text-neutral-400 block mt-0.5">بەروار: {p.recordedDate}</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        p.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.status}
                      </span>
                      {p.receiptNumber && (
                        <span className="text-[10px] text-neutral-400 font-mono block mt-1">
                          پسوڵە: {p.receiptNumber}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ پسوڵەیەکی پارەدان تۆمار نەکراوە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 10: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.notifications}</h1>
            <div className="space-y-3">
              {dashboardData?.notifications && dashboardData.notifications.length > 0 ? (
                dashboardData.notifications.map((n: BuyerNotificationItem) => (
                  <div key={n.id} className="bg-white p-4 rounded-3xl border border-neutral-100 shadow-xs flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-xs text-neutral-900">{n.title}</h4>
                        <span className="text-[10px] text-neutral-400" dir="ltr">{n.createdAt}</span>
                      </div>
                      <p className="text-xs text-neutral-600 mt-1">{n.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center bg-white rounded-3xl border border-neutral-100 text-neutral-400 text-xs">
                  هیچ ئاگادارییەکی نوێ نییە.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 11: PROFILE & PREFERENCES */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-neutral-900">{t.nav.profile}</h1>
            <div className="bg-white p-6 rounded-3xl border border-neutral-100 shadow-xs space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl">
                  {buyerName.charAt(0)}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-base text-neutral-900">{buyerName}</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{dashboardData?.buyerEmail}</p>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1">
                    <CheckCircle2 className="w-3 h-3" /> کڕیاری سەلمێنراو (Verified Buyer)
                  </span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>چوونەدەرەوە</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-neutral-100 text-xs">
                <div>
                  <label className="text-neutral-500 block mb-1">شارە پەسەندکراوەکان:</label>
                  <p className="font-bold text-neutral-800">هەولێر، سلێمانی، دهۆک</p>
                </div>
                <div>
                  <label className="text-neutral-500 block mb-1">دۆخی دارایی:</label>
                  <p className="font-bold text-neutral-800">ئامادە بۆ پارەی نەقد (Cash Ready)</p>
                </div>
                <div>
                  <label className="text-neutral-500 block mb-1">جۆری موڵکی مەبەست:</label>
                  <p className="font-bold text-neutral-800">شوقە، ڤێلا، بازرگانی</p>
                </div>
                <div>
                  <label className="text-neutral-500 block mb-1">سیاسەتی کرێ:</label>
                  <p className="font-bold text-emerald-700">بێبەری لە ڕێژەی کۆمسیۆنی کرێ</p>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>

      {/* MODAL 1: Request Viewing */}
      {showViewingModal && selectedProperty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900">{t.requestViewing}</h3>
              <button 
                onClick={() => setShowViewingModal(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs">
              <p className="font-bold text-neutral-800">{selectedProperty.name || selectedProperty.title}</p>
              <p className="text-neutral-500 mt-0.5">{selectedProperty.location}</p>
            </div>

            {actionSuccessMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-semibold text-center">
                {actionSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleRequestViewingSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">بەروار و کات</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={viewingDate}
                    onChange={(e) => setViewingDate(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">تێبینییەکان</label>
                  <textarea 
                    rows={2}
                    value={viewingNotes}
                    onChange={(e) => setViewingNotes(e.target.value)}
                    placeholder="هەر تێبینییەکی تایبەت بۆ خاوەن موڵک بنووسە..."
                    className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {actionLoading ? 'جێبەجێکردن...' : 'ناردنی داواکاری سەردان'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: Make Purchase Offer */}
      {showOfferModal && selectedProperty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900">{t.makeOffer}</h3>
              <button 
                onClick={() => setShowOfferModal(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs">
              <p className="font-bold text-neutral-800">{selectedProperty.name || selectedProperty.title}</p>
              <p className="text-neutral-500 mt-0.5">نرخی داواکراو: <span dir="ltr">{Number(selectedProperty.price || 0).toLocaleString()}</span> IQD</p>
            </div>

            {actionSuccessMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-semibold text-center">
                {actionSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleMakeOfferSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">بڕی پێشنیارکراو (دیناری عێراقی)</label>
                  <input 
                    type="number" 
                    required
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="بڕی پارە بە دینار..."
                    className="w-full h-11 px-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">مەرجە پێشنیارکراوەکان</label>
                  <textarea 
                    rows={2}
                    value={offerTerms}
                    onChange={(e) => setOfferTerms(e.target.value)}
                    placeholder="مەرجی شێوازی پارەدان، ماوەی ڕادەستکردن، یان چۆنیەتی تاپۆ..."
                    className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800"
                  />
                </div>

                <div className="p-2.5 bg-blue-50/60 rounded-xl text-[11px] text-blue-900 flex items-center gap-2">
                  <BadgePercent className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>پێشنیاری کڕین پەیوەستە بە پەسەندکردنی خاوەن موڵک و ڕێژەی %٥ تەنها بۆ کرێیە.</span>
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {actionLoading ? 'جێبەجێکردن...' : 'تۆمارکردنی پێشنیاری کڕین'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: Send Inquiry */}
      {showInquiryModal && selectedProperty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-neutral-900">{t.sendInquiry}</h3>
              <button 
                onClick={() => setShowInquiryModal(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-100 text-xs">
              <p className="font-bold text-neutral-800">{selectedProperty.name || selectedProperty.title}</p>
            </div>

            {actionSuccessMsg ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-semibold text-center">
                {actionSuccessMsg}
              </div>
            ) : (
              <form onSubmit={handleInquirySubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">پەیام یان پرسیار</label>
                  <textarea 
                    rows={3}
                    required
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    placeholder="هەر پرسیارێکت لەسەر ئەم موڵکە هەیە لێرە بینوسە..."
                    className="w-full p-3 bg-white border border-neutral-200 rounded-xl text-xs text-neutral-800"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={actionLoading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                >
                  {actionLoading ? 'ناردن...' : 'ناردنی پرسیار'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 4: AI Property Advisor */}
      {showAIAdvisorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-base text-neutral-900">{t.aiAssistantTitle}</h3>
              </div>
              <button 
                onClick={() => setShowAIAdvisorModal(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs space-y-2">
              <p className="font-bold text-blue-950">تێڕوانینی ژیری دەستکرد بۆ بازاڕی هەولێر:</p>
              <p className="text-blue-900 leading-relaxed">
                بەپێی بودجە و پەسەندکارییەکانت لە ناوچەکانی (Dream City و Italian Village)، بەهای موڵکەکان بە ڕێژەی %٤.٢ لە ٦ مانگی ڕابردوودا بەرزبوونەوەی تۆمارکردووە. باشترین هەڵبژاردن بۆت شوقەیەکی ٣ ژوورییە.
              </p>
              <p className="text-[10px] text-blue-700 pt-1 border-t border-blue-200/60">
                ⚠️ ئەم پێشنیارانە بۆ ڕێنماییە و بە بڕیاری مرۆڤ پەسەند دەکرێت.
              </p>
            </div>

            <button 
              onClick={() => setShowAIAdvisorModal(false)}
              className="w-full h-11 bg-neutral-900 hover:bg-black text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              داخستن
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export const BuyerWorkspacePage = BuyerWorkspace;
export default BuyerWorkspace;
