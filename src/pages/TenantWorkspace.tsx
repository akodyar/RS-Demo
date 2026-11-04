import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth, EligibleWorkspace } from '../components/AuthProvider';
import { 
  TenantDashboardData, 
  PayRentRequest, 
  CreateTenantMaintenanceRequest, 
  TenantLeaseRenewalRequest, 
  TenantMoveOutRequest,
  TenantPaymentHistoryItem,
  TenantDocumentItem
} from '../types/tenant.js';
import { TenantHeader } from '../components/tenant/TenantHeader';
import { TenantCurrentHomeCard } from '../components/tenant/TenantCurrentHomeCard';
import { TenantRentDueCard } from '../components/tenant/TenantRentDueCard';
import { TenantRentSummaryGrid } from '../components/tenant/TenantRentSummaryGrid';
import { TenantQuickStatsRow } from '../components/tenant/TenantQuickStatsRow';
import { TenantQuickActionsGrid } from '../components/tenant/TenantQuickActionsGrid';
import { TenantRecentActivityList } from '../components/tenant/TenantRecentActivityList';
import { TenantDesktopSidebarWidgets } from '../components/tenant/TenantDesktopSidebarWidgets';
import { TenantBottomNav, TenantNavTab } from '../components/tenant/TenantBottomNav';
import { TenantLeaseView } from '../components/tenant/TenantLeaseView';
import { TenantPaymentsView } from '../components/tenant/TenantPaymentsView';
import { TenantMaintenanceView } from '../components/tenant/TenantMaintenanceView';
import { TenantDocumentsView } from '../components/tenant/TenantDocumentsView';
import { TenantMessagesView } from '../components/tenant/TenantMessagesView';
import { TenantUtilityBillsView } from '../components/tenant/TenantUtilityBillsView';
import { 
  PayRentModal, 
  RequestMaintenanceModal, 
  RenewLeaseModal, 
  MoveOutModal, 
  SearchModal, 
  NotificationsDrawer, 
  AIAssistantDrawer,
  TenantWorkspaceSwitcherModal
} from '../components/tenant/TenantModals';
import { useToast } from '../components/ui/Toast';
import {
  Home,
  CreditCard,
  Wrench,
  Sparkles, 
  FolderOpen, 
  MessageSquare, 
  User, 
  ShieldCheck, 
  Globe, 
  PhoneCall, 
  CheckCircle2, 
  ArrowRight,
  AlertTriangle,
  X,
  Users,
  LogOut,
  FileText,
  MapPin,
  Clock,
  Zap,
  Plus
} from 'lucide-react';

export const TenantWorkspacePage: React.FC = () => {
  const { showToast } = useToast();
  const { t, direction, language, setLanguage } = useI18n();
  const { token, user, logout, activeWorkspace, eligibleWorkspaces, selectWorkspace } = useAuth();
  const navigate = useNavigate();

  // Navigation tab state
  const [currentTab, setCurrentTab] = useState<TenantNavTab>('home');

  // Modal & Drawer states
  const [payRentModalOpen, setPayRentModalOpen] = useState(false);
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false);
  const [renewLeaseModalOpen, setRenewLeaseModalOpen] = useState(false);
  const [moveOutModalOpen, setMoveOutModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [switchWorkspaceModalOpen, setSwitchWorkspaceModalOpen] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceSwitchError, setWorkspaceSwitchError] = useState<string | null>(null);
  const [receiptModalItem, setReceiptModalItem] = useState<TenantPaymentHistoryItem | null>(null);

  // Sub-view inside 'more' tab
  const [moreSubView, setMoreSubView] = useState<'menu' | 'documents' | 'messages' | 'utility_bills'>('menu');

  // Loading and database states
  const [loading, setLoading] = useState(false);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<TenantDashboardData | null>(null);
  const [hasActiveLease, setHasActiveLease] = useState<boolean | null>(null);
  const [tenantNotifications, setTenantNotifications] = useState<any[]>([]);
  const [onboardingData, setOnboardingData] = useState<{
    applications: any[];
    pendingLeases: any[];
  } | null>(null);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);

  const fetchOnboardingData = async () => {
    try {
      setLoadingOnboarding(true);
      const res = await fetch('/api/tenant/onboarding-status', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOnboardingData(data);
      }
    } catch (e) {
      console.warn('Failed to load onboarding status:', e);
    } finally {
      setLoadingOnboarding(false);
    }
  };

  // Fetch real authoritative tenant data
  const fetchDashboard = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/tenant/dashboard', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.status === 503) {
        setDbUnavailable(true);
        setDashboardData(null);
        setHasActiveLease(null);
      } else if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setHasActiveLease(true);
        setDbUnavailable(false);
      } else {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 && err.error === 'NO_ACTIVE_LEASE') {
          setHasActiveLease(false);
          await fetchOnboardingData();
        } else {
          setErrorMessage(err.message || 'Failed to load tenant workspace.');
        }
      }

      // Authoritative communications notifications fetch
      try {
        const notifRes = await fetch('/api/communications/notifications', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });
        if (notifRes.ok) {
          const notifs = await notifRes.json();
          if (Array.isArray(notifs)) {
            setTenantNotifications(notifs);
          }
        }
      } catch (e) {
        // Non-blocking notifications retrieval
      }
    } catch (err: any) {
      console.warn('Network error loading tenant dashboard:', err);
      setErrorMessage(err.message || 'Network error connecting to tenant service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  // Time of day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('tenant.goodMorning', 'Good morning');
    if (hour < 18) return t('tenant.goodAfternoon', 'Good afternoon');
    return t('tenant.goodEvening', 'Good evening');
  };

  // API handlers
  const handleConfirmPayRent = async (payload: PayRentRequest) => {
    try {
      const res = await fetch('/api/tenant/payments/pay-rent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchDashboard();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Payment processing failed.', 'error');
      }
    } catch (e: any) {
      console.warn('Payment API call error:', e);
    }
  };

  const handleCreateMaintenance = async (payload: CreateTenantMaintenanceRequest) => {
    try {
      const res = await fetch('/api/tenant/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchDashboard();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to submit maintenance request.', 'error');
      }
    } catch (e: any) {
      console.warn('Maintenance API call error:', e);
    }
  };

  const handleRenewLease = async (payload: TenantLeaseRenewalRequest) => {
    const res = await fetch('/api/tenant/lease/renew', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await fetchDashboard();
    } else {
      const err = await res.json().catch(() => ({}));
      const message = err.message || err.error || 'Failed to submit renewal request.';
      throw new Error(message);
    }
  };

  const handleMoveOut = async (payload: TenantMoveOutRequest) => {
    try {
      const res = await fetch('/api/tenant/lease/move-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await fetchDashboard();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to submit move-out request.', 'error');
      }
    } catch (e: any) {
      console.warn('Move-out API error:', e);
    }
  };

  const handleAcceptLease = async (leaseId: string) => {
    try {
      const res = await fetch(`/api/tenant/lease/${leaseId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        await fetchDashboard();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to accept lease.', 'error');
      }
    } catch (e: any) {
      console.warn('Accept lease API error:', e);
    }
  };

  const handleAskAI = async (query: string) => {
    try {
      const res = await fetch('/api/tenant/ai/assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Fallback
    }

    const q = query.toLowerCase();
    if (q.includes('rent') || q.includes('due') || q.includes('کرێ') || q.includes('إيجار')) {
      const rentAmt = dashboardData?.rentDue?.amount?.toLocaleString() || '0';
      const rentCurr = dashboardData?.rentDue?.currency || 'IQD';
      const rentDueStr = dashboardData?.rentDue?.dueDate || 'N/A';
      return {
        answer: language === 'ku'
          ? `کرێیەکەت بە بڕی ${rentAmt} ${rentCurr} لە بەرواری ${rentDueStr} شایستەی پارەدانە. بارکۆدی FIB QR و جزدانی فاستپەی بەردەستن بۆ پارەدانی دەستبەجێ بەبێ هیچ تێچوویەکی زیادە. هۆم‌هەب بە ڕێژەی ستانداردی ٥٪ کۆمیسیۆنی بەڕێوەبردن لە کرێی خاوەن موڵک دەبڕێت.`
          : language === 'ar'
          ? `إيجارك بمبلغ ${rentAmt} ${rentCurr} مستحق في تاريخ ${rentDueStr}. يدعم المصرف العراقي الأول (FIB) ومحفظة فاست باي تسوية فورية بدون أي رسوم إضافية على المستأجر. تقتطع هومهب عمولة الإدارة من المالك عند التحصيل.`
          : `Your rent of ${rentAmt} ${rentCurr} is due on ${rentDueStr}. FIB QR and FastPay are supported for zero-fee instant settlement. HomeHub charges the agreed management fee on confirmed collections from the landlord.`,
        type: 'CALCULATION',
        disclaimer: language === 'ku'
          ? 'ئەم هەژمارکردنە فەرمییە بەپێی خشتەی گرێبەستی چالاکەکەتە.'
          : language === 'ar'
          ? 'حساب رسمي معتمد استناداً إلى جدول عقد الإيجار النشط.'
          : 'Authoritative calculation based on your active lease schedule.',
      };
    }
    if (q.includes('rule') || q.includes('quiet') || q.includes('بێدەنگی') || q.includes('هدوء') || q.includes('ڕێسا')) {
      return {
        answer: language === 'ku'
          ? 'کاتەکانی بێدەنگیی باڵەخانە لە نێوان ١١:٠٠ی شەو بۆ ٧:٠٠ی بەیانییە. شوێنی وەستانی ئۆتۆمبێل لە ژێرزەمین بەپێی خشتەی گرێبەست بۆ یەکەکەت دیاریکراوە.'
          : language === 'ar'
          ? 'ساعات الهدوء في البناية من 11:00 مساءً حتى 7:00 صباحاً. موقف السيارات السفلي محجوز حسب جدول العقد.'
          : 'Building quiet hours are 11:00 PM to 7:00 AM. Underground parking space is reserved according to your lease schedule.',
        type: 'FACT',
        disclaimer: language === 'ku'
          ? 'وەرگیراو لە پەیڕەوی فەرمیی بەڕێوەبردنی باڵەخانە.'
          : language === 'ar'
          ? 'مستند إلى اللائحة الرسمية لإدارة البناية.'
          : 'Derived from official building management bylaws.',
      };
    }
    return {
      answer: language === 'ku'
        ? 'دۆخی گرێبەستی کرێداری و تۆمارەکانت لە پۆرتالەکەتدا بەردەستن. دەتوانیت لە هەر کاتێکدا داواکاریی چاککردنەوە پێشکەش بکەیت، پسوولەی باوەڕپێکراو ببینی یان کرێی مانگانە بە شێوەی ئۆنلاین بدەیت.'
        : language === 'ar'
        ? 'حالة عقد الإيجار وسجلاتك متاحة في بوابتك. يمكنك تقديم طلبات الصيانة، الاطلاع على الإيصالات المعتمدة، أو دفع الإيجار إلكترونياً في أي وقت.'
        : 'Your lease agreement status and records are available in your portal. You can submit maintenance requests, view verified receipts, or pay rent online at any time.',
      type: 'FACT',
      disclaimer: language === 'ku'
        ? 'ڕێنمایی ڕاوێژکاری سنووردار بە هەژماری کرێداریی تۆ.'
        : language === 'ar'
        ? 'إرشادات استشارية مبنية بدقة على حساب المستأجر الخاص بك.'
        : 'Advisory guidance based strictly on your tenant account.',
    };
  };

  // Auth & Session handlers
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSelectWorkspace = async (target: EligibleWorkspace) => {
    if (target.workspaceId === activeWorkspace?.workspaceId) {
      setSwitchWorkspaceModalOpen(false);
      return;
    }
    setIsSwitchingWorkspace(true);
    setWorkspaceSwitchError(null);
    try {
      const selected = await selectWorkspace(target.workspaceId);
      setSwitchWorkspaceModalOpen(false);
      const destination = selected?.destination || target.destination || '/tenant';
      if (destination === '/tenant') {
        await fetchDashboard();
      } else {
        navigate(destination);
      }
    } catch (err: any) {
      const msg = err.message || t('workspace.switch_failed', 'Failed to switch workspace.');
      setWorkspaceSwitchError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };

  // Helper to derive clean monolingual name without foreign language character bleed
  const getCleanDisplayName = (rawName: string | undefined): string => {
    if (!rawName) return language === 'ku' ? 'کرێچی' : language === 'ar' ? 'مستأجر' : 'Tenant';

    // 1. If name is a composite bilingual string like "بەڕێوەبەری سەرەکی پلاتفۆرم (Dev Super Admin)"
    const match = rawName.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      const partKurdish = match[1].trim();
      const partEnglish = match[2].trim().replace(/^Dev\s+/i, '');
      if (language === 'en') {
        return partEnglish.includes('Admin') ? 'Platform Super Admin' : partEnglish;
      } else if (language === 'ku') {
        return partKurdish;
      } else {
        // Arabic
        if (partEnglish.toLowerCase().includes('admin') || partKurdish.includes('بەڕێوەبەر')) {
          return 'المشرف العام للمنصة';
        }
        if (partEnglish.toLowerCase().includes('tenant') || partKurdish.includes('کرێچی')) {
          return 'مستأجر';
        }
        if (partEnglish.toLowerCase().includes('owner') || partKurdish.includes('خاوەن')) {
          return 'مالك العقار';
        }
        return partEnglish;
      }
    }

    // 2. Exact role title conversions
    const lower = rawName.toLowerCase();
    if (lower.includes('super admin')) {
      return language === 'ku' ? 'بەڕێوەبەری سەرەکی پلاتفۆرم' : language === 'ar' ? 'المشرف العام للمنصة' : 'Platform Super Admin';
    }
    if (lower.includes('platform admin') || lower === 'admin') {
      return language === 'ku' ? 'بەڕێوەبەری پلاتفۆرم' : language === 'ar' ? 'مدير المنصة' : 'Platform Admin';
    }
    if (lower === 'tenant' || lower === 'dev tenant') {
      return language === 'ku' ? 'کرێچی' : language === 'ar' ? 'مستأجر' : 'Tenant';
    }
    if (lower === 'property owner' || lower === 'dev owner') {
      return language === 'ku' ? 'خاوەنی موڵک' : language === 'ar' ? 'مالك العقار' : 'Property Owner';
    }
    if (rawName === 'Ahmed Farhad') {
      return language === 'ku' ? 'ئەحمەد فەرهاد' : language === 'ar' ? 'أحمد فرهاد' : 'Ahmed Farhad';
    }
    if (rawName === 'Salar Aziz') {
      return language === 'ku' ? 'سالار عەزیز' : language === 'ar' ? 'سالار عزيز' : 'Salar Aziz';
    }
    if (rawName === 'Karwan Sleman') {
      return language === 'ku' ? 'کاروان سلێمان' : language === 'ar' ? 'كاروان سليمان' : 'Karwan Sleman';
    }
    if (rawName === 'Zagros Real Estate') {
      return language === 'ku' ? 'کۆمپانیای خانووبەرەی زاگرۆس' : language === 'ar' ? 'شركة زاغروس العقارية' : 'Zagros Real Estate';
    }

    return rawName;
  };

  const getCleanInitials = (nameStr: string): string => {
    if (!nameStr) return language === 'en' ? 'T' : 'ک';
    const trimmed = nameStr.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return trimmed.slice(0, Math.min(2, trimmed.length)).toUpperCase();
  };

  // Localized presentation helpers & safe derived state
  const rawUserName = dashboardData?.user?.name || (user as any)?.displayName || (user as any)?.name || (user?.email ? user.email.split('@')[0] : 'Tenant');
  const localizedUserName = getCleanDisplayName(rawUserName);
  const userInitials = getCleanInitials(localizedUserName);
  const localizedRole = t('tenant.tenantRole', 'Tenant');

  const displayUser = {
    id: dashboardData?.user?.id || (user as any)?.uid || (user as any)?.id || 'tenant',
    name: rawUserName,
    localizedName: localizedUserName,
    initials: userInitials,
    localizedRole,
    email: dashboardData?.user?.email || user?.email || '',
    location: dashboardData?.user?.location || '',
  };

  const displayProperty = dashboardData?.currentProperty ? {
    ...dashboardData.currentProperty,
    name: dashboardData.currentProperty.name,
    unitNumber: dashboardData.currentProperty.unitNumber,
    address: dashboardData.currentProperty.address,
    city: dashboardData.currentProperty.city,
    region: dashboardData.currentProperty.region,
    landlordName: dashboardData.currentProperty.landlordName,
    amenities: dashboardData.currentProperty.amenities || [],
    buildingRules: dashboardData.currentProperty.buildingRules || [],
  } : null;

  const displayRentDue = dashboardData?.rentDue || null;
  const financialSummary = dashboardData?.financialSummary || {
    paidThisMonth: 0,
    outstanding: 0,
    overdue: 0,
    currency: 'IQD',
  };
  const quickStats = dashboardData?.quickStats || {
    openMaintenanceCount: 0,
    unreadMessagesCount: 0,
    upcomingEventsCount: 0,
  };
  const paymentHistory = dashboardData?.paymentHistory || [];
  const maintenanceRequests = dashboardData?.maintenanceRequests || [];
  const documents = dashboardData?.documents || [];
  const conversations = dashboardData?.conversations || [];
  const recentActivity = dashboardData?.recentActivity || [];

  const getTabTitle = (tab: TenantNavTab) => {
    switch (tab) {
      case 'home': return t('tenant.home', 'Home');
      case 'lease': return t('tenant.myLease', 'My Lease');
      case 'payments': return t('tenant.payments', 'Payments');
      case 'maintenance': return t('tenant.maintenance', 'Maintenance');
      case 'more': return t('tenant.more', 'More');
      default: return '';
    }
  };

  return (
    <div 
      className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row pb-20 sm:pb-12 ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Tenant Workspace Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => {
              setCurrentTab('home');
              setMoreSubView('menu');
            }}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Tenant Portal"
            aria-label="HomeHub Tenant Portal"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Tenant Navigation"
          >
            {/* 1. Home */}
            <button
              type="button"
              id="tenant-desktop-nav-home"
              data-testid="tenant-nav-home"
              onClick={() => {
                setCurrentTab('home');
                setMoreSubView('menu');
              }}
              title={t('tenant.home', 'Home')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                currentTab === 'home'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {currentTab === 'home' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Home className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${currentTab === 'home' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('tenant.home', 'Home')}
              </span>
            </button>

            {/* 2. My Lease */}
            <button
              type="button"
              id="tenant-desktop-nav-lease"
              data-testid="tenant-nav-lease"
              onClick={() => {
                setCurrentTab('lease');
                setMoreSubView('menu');
              }}
              title={t('tenant.myLease', 'My Lease')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                currentTab === 'lease'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {currentTab === 'lease' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${currentTab === 'lease' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'گرێبەست' : language === 'ar' ? 'العقد' : 'Lease'}
              </span>
            </button>

            {/* 3. Payments */}
            <button
              type="button"
              id="tenant-desktop-nav-payments"
              data-testid="tenant-nav-payments"
              onClick={() => {
                setCurrentTab('payments');
                setMoreSubView('menu');
              }}
              title={t('tenant.payments', 'Payments')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                currentTab === 'payments'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {currentTab === 'payments' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CreditCard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${currentTab === 'payments' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'پارەدان' : language === 'ar' ? 'المدفوعات' : 'Payments'}
              </span>
              {financialSummary.overdue > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  !
                </span>
              )}
            </button>

            {/* 4. Maintenance */}
            <button
              type="button"
              id="tenant-desktop-nav-maintenance"
              data-testid="tenant-nav-maintenance"
              onClick={() => {
                setCurrentTab('maintenance');
                setMoreSubView('menu');
              }}
              title={t('tenant.maintenance', 'Maintenance')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                currentTab === 'maintenance'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {currentTab === 'maintenance' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wrench className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${currentTab === 'maintenance' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'چاکسازی' : language === 'ar' ? 'الصيانة' : 'Repairs'}
              </span>
              {quickStats.openMaintenanceCount > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {quickStats.openMaintenanceCount}
                </span>
              )}
            </button>

            {/* 5. More */}
            <button
              type="button"
              id="tenant-desktop-nav-more"
              data-testid="tenant-nav-more"
              onClick={() => {
                setCurrentTab('more');
                setMoreSubView('menu');
              }}
              title={t('tenant.more', 'More')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                currentTab === 'more'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {currentTab === 'more' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <User className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${currentTab === 'more' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('tenant.more', 'More')}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Quick Pay Rent */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setPayRentModalOpen(true)}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={language === 'ku' ? 'پارەدانی کرێ' : language === 'ar' ? 'دفع الإيجار' : 'Pay Rent'}
            aria-label="Pay Rent"
          >
            <CreditCard className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
      {/* 1. Header */}
      {hasActiveLease !== false && (
        <TenantHeader
          userName={displayUser.localizedName}
          userEmail={displayUser.email}
          userRole={displayUser.localizedRole}
          propertyName={displayProperty?.name}
          unitNumber={displayProperty?.unitNumber}
          activeTabTitle={getTabTitle(currentTab)}
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setMoreSubView('menu');
          }}
          unreadNotificationsCount={tenantNotifications.filter((n: any) => !n.isRead && !n.read && n.status !== 'read').length || dashboardData?.upcomingEvents?.length || 0}
          openMaintenanceCount={quickStats.openMaintenanceCount}
          onOpenSearch={() => setSearchModalOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenProfile={() => setCurrentTab('more')}
          onLogout={handleLogout}
          onSwitchPersona={() => {
            setWorkspaceSwitchError(null);
            setSwitchWorkspaceModalOpen(true);
          }}
        />
      )}

      {/* Main Container: max-w-7xl (matches other domain workspaces) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Notice of External Integrations & Fail-Closed State */}
        {dbUnavailable && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-2.5 shadow-md">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">{t('tenant.dbUnavailableTitle', 'Database Service Notice')}</p>
              <p className="mt-0.5">
                {t('tenant.dbUnavailableDesc', 'PostgreSQL database is currently disconnected. System is operating in fail-closed mode.')}
              </p>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center justify-between shadow-md">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {hasActiveLease === false ? (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* PENDING LEASE OFFERS AWAITING SIGNATURE */}
            {onboardingData?.pendingLeases && onboardingData.pendingLeases.length > 0 && (
              <div className="space-y-4">
                {onboardingData.pendingLeases.map((lease) => (
                  <div 
                    key={lease.id} 
                    className="bg-[#0c1322] rounded-3xl border border-amber-500/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {language === 'ku' ? 'ئۆفەری گرێبەست — چاوەڕوانی واژووە' : language === 'ar' ? 'عرض عقد — بانتظار توقيعك' : 'Lease Offer Awaiting Signature'}
                            </span>
                          </div>
                          <h2 className="text-xl sm:text-2xl font-black text-white">{lease.propertyName}</h2>
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-500" />
                            <span>{lease.propertyAddress}</span>
                            {lease.unitNumber && <span className="text-slate-500">• {lease.unitNumber}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="text-left rtl:text-right sm:text-right rtl:sm:text-left bg-[#080d19] p-3.5 rounded-2xl border border-slate-800 shrink-0">
                        <p className="text-xs text-slate-400 font-medium">
                          {language === 'ku' ? 'کرێی مانگانە' : language === 'ar' ? 'الإيجار الشهري' : 'Monthly Rent'}
                        </p>
                        <p className="text-xl font-black text-amber-400 mt-0.5">
                          <bdi dir="ltr">{lease.monthlyRent.toLocaleString()}</bdi>{' '}
                          <span className="text-xs font-bold text-slate-400">{lease.currency}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-5 border-b border-slate-800/80 text-xs">
                      <div>
                        <p className="text-slate-500">{language === 'ku' ? 'خاوەن موڵک / بەڕێوەبەر' : language === 'ar' ? 'المالك / الإدارة' : 'Landlord / Manager'}</p>
                        <p className="text-slate-200 font-bold mt-0.5">{lease.landlordName}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">{language === 'ku' ? 'بارمتە (تەئمینات)' : language === 'ar' ? 'مبلغ التأمين' : 'Security Deposit'}</p>
                        <p className="text-slate-200 font-bold mt-0.5">
                          <bdi dir="ltr">{lease.depositAmount.toLocaleString()}</bdi> {lease.currency}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500">{language === 'ku' ? 'دەستپێکی گرێبەست' : language === 'ar' ? 'تاريخ البدء' : 'Start Date'}</p>
                        <p className="text-slate-200 font-bold mt-0.5"><bdi dir="ltr">{lease.startDate}</bdi></p>
                      </div>
                      <div>
                        <p className="text-slate-500">{language === 'ku' ? 'کۆتایی گرێبەست' : language === 'ar' ? 'تاريخ الانتهاء' : 'End Date'}</p>
                        <p className="text-slate-200 font-bold mt-0.5"><bdi dir="ltr">{lease.endDate}</bdi></p>
                      </div>
                    </div>

                    <div className="pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs text-slate-400">
                        {language === 'ku' 
                          ? 'بە واژووکردنی ئەم گرێبەستە، نیشتەجێبوونەکەت ڕاستەوخۆ چالاک دەبێت و دەتوانیت کرێ بدەیت و داوای چاککردنەوە بکەیت.' 
                          : language === 'ar' 
                          ? 'بقبول هذا العقد وتوقيعه، سيتم تفعيل إقامتك فوراً وستتمكن من سداد الإيجار وطلب الصيانة.' 
                          : 'Signing this agreement immediately activates your tenancy, unlocking rent payments and maintenance requests.'}
                      </p>

                      <button
                        id={`btn-accept-lease-${lease.id}`}
                        type="button"
                        onClick={() => handleAcceptLease(lease.id)}
                        className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-full transition-all shadow-lg shadow-amber-500/20 cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>{language === 'ku' ? 'واژووکردن و چالاککردنی گرێبەست' : language === 'ar' ? 'قبول وتوقيع العقد' : 'Review & Sign Lease'}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RENTAL APPLICATIONS */}
            {onboardingData?.applications && onboardingData.applications.length > 0 && (
              <div className="bg-[#0c1322] rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-amber-400" />
                    <h3 className="text-lg font-black text-white">
                      {language === 'ku' ? 'داواکارییەکانی بەکرێگرتنی من' : language === 'ar' ? 'طلبات الإيجار المقدمة' : 'My Rental Applications'}
                    </h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-amber-300 border border-slate-700">
                    {onboardingData.applications.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {onboardingData.applications.map((app) => (
                    <div key={app.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-white text-sm">{app.propertyName || 'Apartment Application'}</p>
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>{app.propertyAddress}</span>
                        </p>
                        {app.submittedAt && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {language === 'ku' ? 'نێردراوە لە: ' : language === 'ar' ? 'تاريخ التقديم: ' : 'Submitted: '}
                            <bdi dir="ltr">{new Date(app.submittedAt).toLocaleDateString()}</bdi>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                          app.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          app.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                          app.status === 'UNDER_REVIEW' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                          'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}>
                          {app.status === 'APPROVED' ? <CheckCircle2 className="w-3 h-3" /> :
                           app.status === 'REJECTED' ? <X className="w-3 h-3" /> :
                           app.status === 'UNDER_REVIEW' ? <Clock className="w-3 h-3" /> :
                           <FileText className="w-3 h-3" />}
                          {app.status === 'APPROVED' ? (language === 'ku' ? 'پەسەندکرا' : language === 'ar' ? 'تمت الموافقة' : 'Approved') :
                           app.status === 'REJECTED' ? (language === 'ku' ? 'ڕەتکرایەوە' : language === 'ar' ? 'مرفوض' : 'Rejected') :
                           app.status === 'UNDER_REVIEW' ? (language === 'ku' ? 'لەژێر پێداچوونەوەدایە' : language === 'ar' ? 'قيد المراجعة' : 'Under Review') :
                           (language === 'ku' ? 'نێردراوە' : language === 'ar' ? 'تم التقديم' : 'Submitted')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DEFAULT GUIDANCE / BROWSE PROPERTIES */}
            {(!onboardingData?.pendingLeases || onboardingData.pendingLeases.length === 0) && (
              <div className="bg-[#0c1322] rounded-3xl border border-amber-500/30 p-8 text-center mt-6 shadow-2xl">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-4">
                  <Globe className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">
                  {language === 'ku' ? 'هیچ گرێبەستێکی چالاکت نییە' : language === 'ar' ? 'لا يوجد لديك عقد إيجار نشط' : 'No Active Lease Found'}
                </h2>
                <p className="text-slate-400 mb-8 max-w-md mx-auto">
                  {language === 'ku' 
                    ? 'ئێوە لە ئێستادا کرێچییەکی تۆمارکراون لە هۆم‌هەب، بەڵام هیچ گرێبەستێکی کرێی چالاک یان پشتڕاستکراوە بە ناوەکەتانەوە نییە.' 
                    : language === 'ar' 
                    ? 'أنت مسجل كمستأجر، ولكن لا توجد عقود إيجار نشطة مرتبطة بحسابك حالياً.' 
                    : 'You are registered as a tenant, but there are currently no active leases associated with your account.'}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    id="btn-no-lease-switch-workspace"
                    type="button"
                    onClick={() => {
                      setWorkspaceSwitchError(null);
                      setSwitchWorkspaceModalOpen(true);
                    }}
                    className="px-6 py-3 bg-[#080d19] hover:bg-[#111b2e] text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-full font-bold transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-md"
                  >
                    <Users className="w-4 h-4 text-amber-400" />
                    <span>{t('workspace.select.badge', 'شوێنی کارەکان')}</span>
                  </button>
                  <button
                    onClick={() => navigate('/rent')}
                    className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-full transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                  >
                    {language === 'ku' ? 'گەڕان بۆ موڵکەکان' : language === 'ar' ? 'تصفح العقارات المتاحة' : 'Browse Available Properties'}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-6 py-3 bg-[#080d19] hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 rounded-full font-bold transition-all border border-slate-800 cursor-pointer"
                  >
                    {language === 'ku' ? 'چوونە دەرەوە' : language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                  </button>
                </div>
              </div>
            )}

            {/* Actions row when pending leases or applications exist */}
            {(Boolean(onboardingData?.pendingLeases?.length) || Boolean(onboardingData?.applications?.length)) && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                <button
                  onClick={() => navigate('/rent')}
                  className="px-6 py-2.5 bg-[#080d19] hover:bg-[#111b2e] text-amber-300 border border-slate-800 hover:border-amber-500/40 rounded-full font-bold transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm"
                >
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>{language === 'ku' ? 'گەڕان بۆ موڵکی تر' : language === 'ar' ? 'تصفح المزيد من العقارات' : 'Browse More Properties'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceSwitchError(null);
                    setSwitchWorkspaceModalOpen(true);
                  }}
                  className="px-6 py-2.5 bg-[#080d19] hover:bg-[#111b2e] text-slate-300 border border-slate-800 rounded-full font-bold transition-all inline-flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                >
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>{t('workspace.select.badge', 'شوێنی کارەکان')}</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-2.5 bg-[#080d19] hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 rounded-full font-bold transition-all border border-slate-800 cursor-pointer text-xs sm:text-sm"
                >
                  {language === 'ku' ? 'چوونە دەرەوە' : language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                </button>
              </div>
            )}
          </div>
        ) : hasActiveLease === true ? (
          <div className="max-w-4xl mx-auto space-y-6 min-w-0">
            {/* Welcome Greeting Banner (Visible on Home tab) */}
            {currentTab === 'home' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    {getGreeting()}, {displayUser.localizedName}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5">
                    {t('tenant.subgreeting', "Here's what's happening with your home")}
                  </p>
                </div>

                <button
                  id="btn-trigger-ai-assistant"
                  type="button"
                  onClick={() => setAiAssistantOpen(true)}
                  className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-[#080d19] hover:bg-[#111b2e] text-amber-300 text-xs font-bold transition-colors border border-slate-800 hover:border-amber-500/40 cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('tenant.askAI', 'Ask Rental Assistant')}</span>
                </button>
              </div>
            )}

            {/* TAB 1: HOME */}
            {currentTab === 'home' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                {/* Current Home Card */}
                <TenantCurrentHomeCard
                  property={displayProperty}
                  onNavigateTab={(tab) => {
                    if (tab === 'lease') setCurrentTab('lease');
                    else if (tab === 'payments') setCurrentTab('payments');
                    else if (tab === 'maintenance') setCurrentTab('maintenance');
                    else if (tab === 'messages') {
                      setCurrentTab('more');
                      setMoreSubView('messages');
                    }
                  }}
                  onPayRent={() => setPayRentModalOpen(true)}
                />

                {/* Rent Due Card */}
                <TenantRentDueCard
                  rentDue={displayRentDue}
                  onPayRent={() => setPayRentModalOpen(true)}
                />

                {/* Rent Summary 3-Card Grid */}
                <TenantRentSummaryGrid
                  summary={financialSummary}
                />

                {/* Quick Stats 3-Item Row */}
                <TenantQuickStatsRow
                  quickStats={quickStats}
                  onNavigateTab={(tab) => {
                    if (tab === 'maintenance') setCurrentTab('maintenance');
                    else if (tab === 'payments') setCurrentTab('payments');
                    else if (tab === 'messages') {
                      setCurrentTab('more');
                      setMoreSubView('messages');
                    }
                  }}
                />

                {/* Quick Actions 8-Grid */}
                <TenantQuickActionsGrid
                  onPayRent={() => setPayRentModalOpen(true)}
                  onRequestMaintenance={() => setMaintenanceModalOpen(true)}
                  onViewLease={() => setCurrentTab('lease')}
                  onOpenDocuments={() => {
                    setCurrentTab('more');
                    setMoreSubView('documents');
                  }}
                  onOpenMessages={() => {
                    setCurrentTab('more');
                    setMoreSubView('messages');
                  }}
                  onOpenUtilityBills={() => {
                    setCurrentTab('more');
                    setMoreSubView('utility_bills');
                  }}
                  onReportIssue={() => setMaintenanceModalOpen(true)}
                  onRenewLease={() => setRenewLeaseModalOpen(true)}
                  onMoveOut={() => setMoveOutModalOpen(true)}
                />

                {/* Rental Applications */}
                {dashboardData?.rentalApplications && dashboardData.rentalApplications.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-6">
                    <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" />
                        {t('tenant.dashboard.my_applications', 'My Rental Applications')}
                      </h3>
                      <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full text-xs">
                        {dashboardData.rentalApplications.length}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {dashboardData.rentalApplications.map((app) => (
                        <div key={app.id} className="p-4 sm:p-6 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="font-bold text-slate-900">{app.propertyName}</p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              {typeof app.propertyAddress === 'object' && app.propertyAddress !== null
                                ? ((app.propertyAddress as any).street || (app.propertyAddress as any).city || 'Address not provided')
                                : String(app.propertyAddress || '')}
                            </p>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6">

                            <div>
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                                app.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                app.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                app.status === 'UNDER_REVIEW' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {app.status === 'APPROVED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                                 app.status === 'REJECTED' ? <X className="w-3.5 h-3.5" /> :
                                 app.status === 'UNDER_REVIEW' ? <Clock className="w-3.5 h-3.5" /> :
                                 <FileText className="w-3.5 h-3.5" />}
                                {app.status.replace('_', ' ')}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Activity Section */}
                <TenantRecentActivityList
                  activities={recentActivity}
                  onViewAll={() => setCurrentTab('payments')}
                />

                {/* Home Operational Widgets (Maintenance, Deposit, AI, Contact) */}
                <div className="pt-2">
                  <TenantDesktopSidebarWidgets
                    activeMaintenance={maintenanceRequests[0] || null}
                    onRequestMaintenance={() => setMaintenanceModalOpen(true)}
                    onViewAllMaintenance={() => setCurrentTab('maintenance')}
                    onAskAI={handleAskAI}
                    securityDeposit={dashboardData?.securityDeposit}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: MY LEASE */}
            {currentTab === 'lease' && (
              <div className="animate-in fade-in duration-200">
                <TenantLeaseView
                  lease={displayProperty}
                  onRenewLease={() => setRenewLeaseModalOpen(true)}
                  onMoveOut={() => setMoveOutModalOpen(true)}
                  onAcceptLease={() => handleAcceptLease(displayProperty!.leaseId)}
                />
              </div>
            )}

        {/* ========================================================= */}
        {/* TAB 3: PAYMENTS                                           */}
        {/* ========================================================= */}
        {currentTab === 'payments' && (
          <div className="animate-in fade-in duration-200">
            <TenantPaymentsView
              rentDue={displayRentDue}
              summary={financialSummary}
              paymentHistory={paymentHistory}
              onPayRent={() => setPayRentModalOpen(true)}
              onViewReceipt={(p) => setReceiptModalItem(p)}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: MAINTENANCE                                        */}
        {/* ========================================================= */}
        {currentTab === 'maintenance' && (
          <div className="animate-in fade-in duration-200">
            <TenantMaintenanceView
              requests={maintenanceRequests}
              onRequestNew={() => setMaintenanceModalOpen(true)}
            />
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: MORE (Profile, Documents, Messages, AI, Settings)  */}
        {/* ========================================================= */}
        {currentTab === 'more' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {moreSubView === 'documents' ? (
              <div>
                <button
                  type="button"
                  onClick={() => setMoreSubView('menu')}
                  className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-1 cursor-pointer"
                >
                  <span className="rtl:rotate-180">←</span> {t('tenant.backToMore', 'Back to More Options')}
                </button>
                <TenantDocumentsView documents={documents} />
              </div>
            ) : moreSubView === 'messages' ? (
              <div>
                <button
                  type="button"
                  onClick={() => setMoreSubView('menu')}
                  className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-1 cursor-pointer"
                >
                  <span className="rtl:rotate-180">←</span> {t('tenant.backToMore', 'Back to More Options')}
                </button>
                <TenantMessagesView conversations={conversations} />
              </div>
            ) : moreSubView === 'utility_bills' ? (
              <div>
                <button
                  type="button"
                  onClick={() => setMoreSubView('menu')}
                  className="text-xs font-bold text-blue-600 mb-3 flex items-center gap-1 cursor-pointer"
                >
                  <span className="rtl:rotate-180">←</span> {t('tenant.backToMore', 'Back to More Options')}
                </button>
                <TenantUtilityBillsView />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="bg-[#0c1322] rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center text-xl font-black shadow-xs shrink-0">
                      {displayUser.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-black text-white">
                          {displayUser.localizedName}
                        </h2>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                          {displayUser.localizedRole}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{displayUser.email}</p>
                      {displayUser.location && <p className="text-xs text-slate-500 mt-0.5">{displayUser.location}</p>}
                    </div>
                  </div>

                  {/* Account Actions */}
                  <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <button
                      id="btn-more-switch-account"
                      type="button"
                      onClick={() => {
                        setWorkspaceSwitchError(null);
                        setSwitchWorkspaceModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#080d19] hover:bg-[#111b2e] text-amber-300 text-xs font-bold transition-colors border border-slate-800 hover:border-amber-500/40 cursor-pointer shadow-2xs"
                    >
                      <Users className="w-4 h-4 text-amber-400" />
                      <span>{t('workspace.select.badge', 'Switch Workspace')}</span>
                    </button>
                    <button
                      id="btn-more-sign-out"
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-colors border border-rose-500/30 cursor-pointer shadow-2xs"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>{t('action.sign_out', 'Sign Out')}</span>
                    </button>
                  </div>
                </div>

                {/* More Hub Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMoreSubView('documents')}
                    className="p-4 bg-[#0c1322] rounded-2xl border border-slate-800 text-start flex items-center gap-3 hover:border-amber-500/40 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{t('tenant.documentVault', 'Document Vault')}</h4>
                      <p className="text-xs text-slate-400">{t('tenant.documentVaultDesc', 'Lease contracts, inspection sheets, receipts')}</p>
                    </div>
                  </button>

                  <button
                    id="btn-more-messages"
                    type="button"
                    onClick={() => setMoreSubView('messages')}
                    className="p-4 bg-[#0c1322] rounded-2xl border border-slate-800 text-start flex items-center gap-3 hover:border-amber-500/40 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{t('tenant.messagesAndSupport', 'Messages & Support')}</h4>
                      <p className="text-xs text-slate-400">{t('tenant.messagesSubtitle', 'Owner, management & maintenance dispatch')}</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAiAssistantOpen(true)}
                    className="p-4 bg-[#0c1322] rounded-2xl border border-slate-800 text-start flex items-center gap-3 hover:border-amber-500/40 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{t('tenant.rentalAssistant', 'Rental Assistant (AI)')}</h4>
                      <p className="text-xs text-slate-400">{t('tenant.aiAssistantDesc', 'Instant answers about lease rules & rent')}</p>
                    </div>
                  </button>

                  <button
                    id="btn-more-utility-bills"
                    type="button"
                    onClick={() => setMoreSubView('utility_bills')}
                    className="p-4 bg-[#0c1322] rounded-2xl border border-slate-800 text-start flex items-center gap-3 hover:border-amber-500/40 transition-all cursor-pointer shadow-xs"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-white">{t('tenant.utilityBills', 'Utility Bills')}</h4>
                      <p className="text-xs text-slate-400">
                        {language === 'ku' ? 'پسوڵەکانی کارەبا، ئاو و خزمەتگوزاری تر' : language === 'ar' ? 'فواتير الكهرباء والماء والخدمات' : 'Electricity, water & service charges'}
                      </p>
                    </div>
                  </button>

                  <div className="p-4 bg-[#0c1322] rounded-2xl border border-slate-800 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 text-amber-400 border border-slate-700 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-white">{t('tenant.language', 'Language')}</h4>
                        <p className="text-xs text-slate-400">
                          {language === 'ku' ? 'کوردی سۆرانی' : language === 'ar' ? 'العربية' : 'English'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" dir="ltr">
                      {(['ku', 'ar', 'en'] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setLanguage(lang)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            language === lang ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {lang.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Emergency Contact */}
                <div className="bg-[#0c1322] rounded-2xl border border-amber-500/30 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                      <PhoneCall className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold text-amber-300">{t('tenant.emergencyHotlineTitle', '24/7 Building Emergency Hotline')}</h4>
                      <p className="text-xs text-slate-400">{t('tenant.emergencyHotlineDesc', 'Immediate dispatch for water floods or electrical faults')}</p>
                    </div>
                  </div>
                  <a
                    href="tel:+9647500000000"
                    dir="ltr"
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 text-xs font-bold hover:from-amber-500 hover:to-amber-600 transition-all cursor-pointer shadow-sm"
                  >
                    {t('tenant.callHotline', 'Call Hotline')}
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ) : loading ? (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
      </div>
    ) : (
      <div className="max-w-md mx-auto my-12 p-8 bg-[#0c1322] border border-slate-800 rounded-3xl text-center shadow-xl">
        <h3 className="text-lg font-bold text-white mb-2">{t('common.no_data', 'No Lease Records')}</h3>
        <p className="text-xs text-slate-400 mb-6">{t('tenant.noLeaseDesc', 'Please contact support or browse available properties.')}</p>
        <button onClick={() => navigate('/rent')} className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer">
          {t('common.browse_properties', 'Browse Properties')}
        </button>
      </div>
    )}
    </main>

      {/* 2. Interactive Modals and Drawers */}
      <PayRentModal
        isOpen={payRentModalOpen}
        onClose={() => setPayRentModalOpen(false)}
        rentDue={displayRentDue}
        property={displayProperty}
        onConfirmPayment={handleConfirmPayRent}
      />

      <RequestMaintenanceModal
        isOpen={maintenanceModalOpen}
        onClose={() => setMaintenanceModalOpen(false)}
        property={displayProperty}
        onSubmit={handleCreateMaintenance}
      />

      <RenewLeaseModal
        isOpen={renewLeaseModalOpen}
        onClose={() => setRenewLeaseModalOpen(false)}
        property={displayProperty}
        onSubmit={handleRenewLease}
      />

      <MoveOutModal
        isOpen={moveOutModalOpen}
        onClose={() => setMoveOutModalOpen(false)}
        property={displayProperty}
        onSubmit={handleMoveOut}
      />

      <SearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onNavigate={(view) => setCurrentTab(view)}
      />

      <NotificationsDrawer
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={tenantNotifications}
      />

      <AIAssistantDrawer
        isOpen={aiAssistantOpen}
        onClose={() => setAiAssistantOpen(false)}
        onAskAI={handleAskAI}
      />

      <TenantWorkspaceSwitcherModal
        isOpen={switchWorkspaceModalOpen}
        onClose={() => {
          if (!isSwitchingWorkspace) {
            setSwitchWorkspaceModalOpen(false);
            setWorkspaceSwitchError(null);
          }
        }}
        workspaces={eligibleWorkspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onLogout={handleLogout}
        isSwitching={isSwitchingWorkspace}
        error={workspaceSwitchError}
        onClearError={() => setWorkspaceSwitchError(null)}
      />

      {/* Official Receipt Viewer Modal */}
      {receiptModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  {t('tenant.viewOfficialReceipt', 'HomeHub Verified Receipt')}
                </span>
                <h3 className="text-base font-black text-slate-900" dir="ltr">
                  {receiptModalItem.receiptNumber || receiptModalItem.referenceNumber}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalItem(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">{t('tenant.period', 'Period')}</span>
                <span className="font-bold text-slate-900">{receiptModalItem.period}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">{t('tenant.paidOn', 'Payment Date')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{receiptModalItem.paymentDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">{t('tenant.paymentMethod', 'Payment Method')}</span>
                <span className="font-bold text-slate-900">{receiptModalItem.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">{t('tenant.grossRentPaid', 'Amount Paid')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{receiptModalItem.amount.toLocaleString()} {receiptModalItem.currency}</span>
              </div>
              <div className="flex justify-between py-1 text-emerald-700 font-bold">
                <span>{t('tenant.verificationStatus', 'Verification Status')}</span>
                <span dir="ltr">{t('tenant.ledgerConfirmed', 'LEDGER_CONFIRMED')}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                showToast(`Downloaded PDF receipt ${receiptModalItem.receiptNumber || receiptModalItem.referenceNumber}`, 'info');
                setReceiptModalItem(null);
              }}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('tenant.downloadPdf', 'Download PDF')}
            </button>
          </div>
        </div>
      )}

      {/* 3. Bottom Sticky Navigation */}
      {hasActiveLease !== false && (
        <TenantBottomNav
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            setMoreSubView('menu');
          }}
          openMaintenanceCount={quickStats.openMaintenanceCount}
        />
      )}
      </div>
    </div>
  );
};
