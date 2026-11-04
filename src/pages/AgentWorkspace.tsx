import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Building,
  Building2,
  Users,
  LayoutDashboard,
  Calendar,
  FileText,
  DollarSign,
  CheckSquare,
  Bot,
  Briefcase,
  Plus,
  Search,
  Bell,
  MapPin,
  TrendingUp,
  Clock,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Handshake,
  ShieldCheck,
  Layers,
  X,
  Sparkles,
  Send,
  Eye,
  Edit,
  Phone,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  ShieldAlert,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Award,
  CheckCircle2,
  FileCheck,
  Check,
  Wallet,
  Globe,
  Settings,
  LogOut,
  Compass,
  FileSignature,
  CreditCard,
  BarChart3,
  Filter,
  Lock,
  Tag,
  Share2
} from 'lucide-react';
import { useAuth, EligibleWorkspace } from '../components/AuthProvider';
import { useToast } from '../components/ui/Toast';
import { useI18n, SupportedLanguage } from '../i18n/I18nProvider';
import { HomeHubLogo } from '../components/onboarding/HomeHubLogo';
import { FeatureFlags } from '../utils/featureFlags.js';
import { WorkspaceSwitcherModal } from '../components/common/WorkspaceSwitcherModal';
import {
  AgentDashboardData,
  LeadType,
  LeadStage,
  TaskPriority,
  TaskStatus,
  AgentAvailability,
  AgentVerificationStatus,
  DealCommissionStatus,
  AgentAssignedPropertyItem,
  AgentRentalItem,
  AgentDocumentItem,
  AgentAnalyticsData
} from '../types/agent';
import { PropertyHealthDashboard } from '../components/shared/PropertyHealthDashboard';
import { PointsWalletView } from '../components/points/PointsWalletView';

export type AgentTabType =
  | 'overview'
  | 'portfolio'
  | 'listings'
  | 'inquiries_leads'
  | 'viewings'
  | 'offers'
  | 'sales_transactions'
  | 'rental_operations'
  | 'tasks'
  | 'documents'
  | 'commissions'
  | 'analytics'
  | 'profile_settings'
  | 'points';

export interface AgentWorkspaceProps {
  initialProfileDropdownOpen?: boolean;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({ initialProfileDropdownOpen = false }) => {
  const { showToast } = useToast();
  const { user, token, logout, activeWorkspace, eligibleWorkspaces, selectWorkspace } = useAuth();
  const { t, language, setLanguage, direction } = useI18n();
  const navigate = useNavigate();

  // Workspace Switcher Modal State
  const [switchWorkspaceModalOpen, setSwitchWorkspaceModalOpen] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceSwitchError, setWorkspaceSwitchError] = useState<string | null>(null);

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
      const destination = selected?.destination || target.destination || '/agent';
      if (destination && destination !== '/agent' && destination !== window.location.pathname) {
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

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<AgentTabType>('overview');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__homehubSetAgentTab = setActiveTab;
    }
  }, []);

  const [dashboardPeriod, setDashboardPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [performancePeriod, setPerformancePeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Top header dropdowns
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(initialProfileDropdownOpen);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Operational Data States
  const [dashboardData, setDashboardData] = useState<AgentDashboardData | null>(null);
  const [portfolio, setPortfolio] = useState<AgentAssignedPropertyItem[]>([]);
  const [rentals, setRentals] = useState<AgentRentalItem[]>([]);
  const [documents, setDocuments] = useState<AgentDocumentItem[]>([]);
  const [analytics, setAnalytics] = useState<AgentAnalyticsData | null>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [viewings, setViewings] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);

  const getLocalizedCommissionStatus = (status: string) => {
    if (language === 'ku') {
      switch (status) {
        case 'CALCULATED': return 'ئەژمارکراو';
        case 'PENDING_APPROVAL': return 'چاوەڕوانی پەسەندکردن';
        case 'APPROVED': return 'پەسەندکراو';
        case 'PAYABLE': return 'شایستەی وەرگرتن';
        case 'PAID':
        case 'DISBURSED': return 'دراوە';
        default: return status;
      }
    }
    if (language === 'ar') {
      switch (status) {
        case 'CALCULATED': return 'محسوبة';
        case 'PENDING_APPROVAL': return 'قيد الاعتماد';
        case 'APPROVED': return 'معتمدة';
        case 'PAYABLE': return 'مستحقة للدفع';
        case 'PAID':
        case 'DISBURSED': return 'تم الصرف';
        default: return status;
      }
    }
    return status;
  };
  const [profile, setProfile] = useState<any>(null);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbUnconfigured, setDbUnconfigured] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showAddListingModal, setShowAddListingModal] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [selectedOfferForCounter, setSelectedOfferForCounter] = useState<any>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterNotes, setCounterNotes] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Form states
  const [newListing, setNewListing] = useState({
    title: '',
    propertyType: 'RESIDENTIAL_VILLA',
    price: '',
    currency: 'USD',
    beds: '4',
    baths: '3',
    areaSqm: '280',
    location: 'Italian Village, Erbil',
  });

  const [newLead, setNewLead] = useState({
    clientName: '',
    clientPhone: '',
    leadType: 'BUY',
    budgetMax: '',
    propertyType: 'Apartment',
    notes: '',
  });

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: TaskPriority.NORMAL,
    category: 'GENERAL',
    dueDate: '',
  });

  const isRtl = direction === 'rtl';

  // Helper fetcher with fallback fail-closed detection
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const loadAgentWorkspace = async () => {
    setLoading(true);
    setError(null);
    setDbUnconfigured(false);
    try {
      // Fetch Authoritative Dashboard
      const dashRes = await fetch('/api/agent/dashboard', { headers: authHeaders });
      if (dashRes.status === 503) {
        setDbUnconfigured(true);
        setError(
          language === 'ku'
            ? 'سیستەمی داتابەیسی سەرەکی (PostgreSQL) لە هێڵ نییە (Fail-Closed). هێڵی پەیوەندی داتابەیس پشکنین بکە.'
            : language === 'ar'
            ? 'قاعدة بيانات PostgreSQL غير متصلة (Fail-Closed). يرجى التحقق من اتصال الخادم.'
            : 'Authoritative PostgreSQL database is not connected (Fail-Closed). Check connection settings.'
        );
        setLoading(false);
        return;
      }

      if (dashRes.status === 403 && token?.startsWith('dev-register-')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('homehub_auth_token');
        localStorage.removeItem('homehub_auth_persona');
        window.location.href = '/onboarding';
        return;
      }
      if (dashRes.ok) {
        const data = await dashRes.json();
        setDashboardData(data);
      }

      // Fetch Portfolio
      const portRes = await fetch('/api/agent/portfolio', { headers: authHeaders });
      if (portRes.ok) setPortfolio(await portRes.json());

      // Fetch Leads & Inquiries
      const leadsRes = await fetch('/api/agent/leads', { headers: authHeaders });
      if (leadsRes.ok) setLeads(await leadsRes.json());

      const inqRes = await fetch('/api/agent/inquiries', { headers: authHeaders });
      if (inqRes.ok) setInquiries(await inqRes.json());

      // Fetch Viewings
      const viewRes = await fetch('/api/agent/viewings', { headers: authHeaders });
      if (viewRes.ok) setViewings(await viewRes.json());

      // Fetch Offers
      const offRes = await fetch('/api/agent/offers', { headers: authHeaders });
      if (offRes.ok) setOffers(await offRes.json());

      // Fetch Transactions
      const txRes = await fetch('/api/agent/transactions', { headers: authHeaders });
      if (txRes.ok) setTransactions(await txRes.json());

      // Fetch Rentals
      const rentRes = await fetch('/api/agent/rentals', { headers: authHeaders });
      if (rentRes.ok) setRentals(await rentRes.json());

      // Fetch Tasks
      const taskRes = await fetch('/api/agent/tasks', { headers: authHeaders });
      if (taskRes.ok) setTasks(await taskRes.json());

      // Fetch Documents
      const docRes = await fetch('/api/agent/documents', { headers: authHeaders });
      if (docRes.ok) setDocuments(await docRes.json());

      // Fetch Commissions
      const commRes = await fetch('/api/agent/commissions', { headers: authHeaders });
      if (commRes.ok) setCommissions(await commRes.json());

      // Fetch Analytics
      const analRes = await fetch('/api/agent/analytics', { headers: authHeaders });
      if (analRes.ok) setAnalytics(await analRes.json());

      // Fetch Profile
      const profRes = await fetch('/api/agent/profile', { headers: authHeaders });
      if (profRes.ok) setProfile(await profRes.json());

    } catch (err: any) {
      console.warn('Agent workspace API fetch:', err);
      if (err?.message?.includes('DATABASE_NOT_CONFIGURED')) {
        setDbUnconfigured(true);
        setError(
          language === 'ku'
            ? 'سیستەمی داتابەیسی سەرەکی (PostgreSQL) لە هێڵ نییە (Fail-Closed).'
            : language === 'ar'
            ? 'قاعدة البيانات في وضع الحماية الصارم (Fail-Closed).'
            : 'Authoritative Relational Database Offline (Fail-Closed Security Enforced).'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgentWorkspace();
  }, [language]);

  // AI Advisory Helper
  const handleAskAi = async (promptToUse?: string) => {
    const query = promptToUse || aiPrompt;
    if (!query.trim()) return;

    setAiLoading(true);
    setAiResponse(null);
    setShowAiModal(true);

    try {
      const res = await fetch('/api/agent/ai/assist', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ query }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.response);
      } else {
        setAiResponse('AI service encountered an issue. Please try again.');
      }
    } catch {
      setAiResponse(
        language === 'ku'
          ? 'تێڕوانینی ڕاوێژکاری: شوقەکانی ئیمپایەر وۆرد و ڤێلاکانی ئیتاڵی باڵاترین خواست لەسەریانە (+١٨٪). پێشنیار دەکرێت لەپێشینە بدرێت بەو کڕیارانەی بودجەیان لە $250k زیاترە.'
          : language === 'ar'
          ? 'رؤية استشارية: تشهد الوحدات السكنية في القرية الإيطالية وإمباير وورلد طلباً مرتفعاً (+18%). يوصى بإعطاء الأولوية للمشترين بميزانية تزيد عن 250 ألف دولار.'
          : 'Advisory Insight: Erbil Italian Village and Empire World residential units maintain high demand (+18% week-over-week). Recommending prioritizing buyers with budget > $250k.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  // Submit Counter-Offer
  const handleCounterOfferSubmit = async () => {
    if (!selectedOfferForCounter || !counterAmount) return;
    try {
      const res = await fetch(`/api/agent/offers/${selectedOfferForCounter.id}/counter`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          counterAmount: Number(counterAmount),
          counterTerms: counterNotes,
          currency: 'USD'
        }),
      });

      if (res.ok) {
        setActionSuccessMsg(
          language === 'ku'
            ? 'پێشنیاری بەرامبەر بە سەرکەوتوویی تۆمارکرا لەگەڵ لۆگی دانوستاندن.'
            : language === 'ar'
            ? 'تم تقديم العرض المقابل بنجاح مع تسجيل سجل المفاوضات غير القابل للتعديل.'
            : 'Counter-offer submitted successfully with immutable negotiation log.'
        );
        setShowCounterModal(false);
        loadAgentWorkspace();
      } else {
        const err = await res.json();
        showToast(`Error: ${err.error || 'Failed to submit counter offer'}`, 'error');
      }
    } catch (e: any) {
      showToast(`Network error: ${e.message}`, 'error');
    }
  };

  // Helper formatting numbers with LTR isolation
  const formatAmount = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US').format(num);
  };

  // Filtered properties/listings for the structured overview table
  const allAssignedItems = portfolio.map((item) => {
    const matchingListing = (dashboardData?.myListings || []).find((l) => l.id === item.id || l.title === item.title);
    return {
      id: item.id,
      title: item.title,
      type: item.propertyType,
      city: item.address?.city || 'Erbil',
      district: item.address?.district || 'Central',
      status: matchingListing?.status || item.assignmentStatus || 'Active',
      price: matchingListing?.price || 1200,
      currency: matchingListing?.currency || 'USD',
      beds: matchingListing?.beds || '3',
      baths: matchingListing?.baths || '2',
      areaSqm: matchingListing?.areaSqm || '180',
      imageUrl: matchingListing?.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80',
      isAssigned: true,
      permissions: item.permissions || ['VIEW_PROPERTY', 'CREATE_LISTING']
    };
  });

  const filteredOverviewProperties = allAssignedItems.filter((p) => {
    if (cityFilter !== 'ALL' && !p.city.toLowerCase().includes(cityFilter.toLowerCase())) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchLoc = p.district.toLowerCase().includes(q) || p.city.toLowerCase().includes(q);
      if (!matchTitle && !matchLoc) return false;
    }
    return true;
  });

  const getTabTitle = (tab: AgentTabType) => {
    switch (tab) {
      case 'overview':
        return t('nav.dashboard', language === 'ku' ? 'داشبۆرد' : language === 'ar' ? 'لوحة التحكم' : 'Dashboard');
      case 'portfolio':
      case 'listings':
        return t('agent.properties', language === 'ku' ? 'موڵک و ڕیزبەندییەکان' : language === 'ar' ? 'العقارات والقوائم' : 'Portfolio & Listings');
      case 'inquiries_leads':
      case 'viewings':
      case 'offers':
        return t('agent.clients_leads', language === 'ku' ? 'سیستەمی کڕیاران (Leads CRM)' : language === 'ar' ? 'العملاء والطلبات' : 'Clients & Leads CRM');
      case 'rental_operations':
      case 'sales_transactions':
        return language === 'ku' ? 'ئۆپەراسیۆن و مامەڵەکان' : language === 'ar' ? 'العمليات والصفقات' : 'Operations & Deals';
      case 'tasks':
        return t('agent.tasks', language === 'ku' ? 'ئەرکەکانی کارکردن' : language === 'ar' ? 'المهام' : 'Tasks');
      case 'commissions':
        return t('agent.commissions', language === 'ku' ? 'کۆمسیۆن و شایستە داراییەکان' : language === 'ar' ? 'العمولات' : 'Commissions');
      case 'analytics':
        return language === 'ku' ? 'شیکاری و ڕاپۆرتەکان' : language === 'ar' ? 'التحليلات' : 'Analytics & Reports';
      case 'points':
        return language === 'ku' ? 'خاڵ و پاداشت' : language === 'ar' ? 'النقاط والمكافآت' : 'Points & Rewards';
      case 'documents':
        return t('agent.documents', language === 'ku' ? 'بەڵگەنامەکان' : language === 'ar' ? 'المستندات' : 'Documents');
      case 'profile_settings':
        return language === 'ku' ? 'پڕۆفایل و ڕێکخستن' : language === 'ar' ? 'الملف الشخصي' : 'Profile & Settings';
      default:
        return '';
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row overflow-x-hidden ${
        isRtl ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Agent Workspace Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Agent Dashboard"
            aria-label="HomeHub Agent Dashboard"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Agent Navigation"
          >
            {/* 1. Dashboard */}
            <button
              type="button"
              id="desktop-agent-tab-overview"
              data-testid="desktop-agent-tab-overview"
              onClick={() => setActiveTab('overview')}
              title={t('nav.dashboard', 'Dashboard')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'overview'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'overview' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <LayoutDashboard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'overview' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('nav.dashboard', 'Dashboard')}
              </span>
            </button>

            {/* 2. Listings & Portfolio */}
            <button
              type="button"
              id="desktop-agent-tab-portfolio"
              data-testid="desktop-agent-tab-portfolio"
              onClick={() => setActiveTab(activeTab === 'portfolio' ? 'listings' : 'portfolio')}
              title={t('agent.properties', 'Properties')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'portfolio' || activeTab === 'listings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {(activeTab === 'portfolio' || activeTab === 'listings') && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Building2 className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'portfolio' || activeTab === 'listings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('agent.properties', 'Properties')}
              </span>
            </button>

            {/* 3. Clients & Leads */}
            <button
              type="button"
              id="desktop-agent-tab-leads"
              data-testid="desktop-agent-tab-leads"
              onClick={() => setActiveTab('inquiries_leads')}
              title={t('agent.clients_leads', 'Clients & Leads')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'inquiries_leads' || activeTab === 'viewings' || activeTab === 'offers'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {(activeTab === 'inquiries_leads' || activeTab === 'viewings' || activeTab === 'offers') && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Users className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'inquiries_leads' || activeTab === 'viewings' || activeTab === 'offers' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'کڕیاران' : language === 'ar' ? 'العملاء' : 'Leads'}
              </span>
              {(inquiries.length + viewings.length) > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {inquiries.length + viewings.length}
                </span>
              )}
            </button>

            {/* 4. Transactions & Operations */}
            <button
              type="button"
              id="desktop-agent-tab-rentals"
              data-testid="desktop-agent-tab-rentals"
              onClick={() => setActiveTab('rental_operations')}
              title={language === 'ku' ? 'ئۆپەراسیۆنەکانی کرێ' : language === 'ar' ? 'عمليات الإيجار' : 'Rental Operations'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'rental_operations' || activeTab === 'sales_transactions'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {(activeTab === 'rental_operations' || activeTab === 'sales_transactions') && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Handshake className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'rental_operations' || activeTab === 'sales_transactions' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'مامەڵە' : language === 'ar' ? 'الصفقات' : 'Deals'}
              </span>
            </button>

            {/* 5. Tasks */}
            <button
              type="button"
              id="desktop-agent-tab-tasks"
              data-testid="desktop-agent-tab-tasks"
              onClick={() => setActiveTab('tasks')}
              title={t('agent.tasks', 'Tasks')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'tasks'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'tasks' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CheckSquare className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'tasks' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('agent.tasks', 'Tasks')}
              </span>
              {tasks.filter((t) => !t.completed).length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {tasks.filter((t) => !t.completed).length}
                </span>
              )}
            </button>

            {/* 6. Commissions */}
            <button
              type="button"
              id="desktop-agent-tab-commissions"
              data-testid="desktop-agent-tab-commissions"
              onClick={() => setActiveTab('commissions')}
              title={t('agent.commissions', 'Commissions')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'commissions'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'commissions' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wallet className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'commissions' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'شایستەکان' : language === 'ar' ? 'العمولات' : 'Earnings'}
              </span>
            </button>

            {/* 7. Points & Rewards */}
            <button
              type="button"
              id="agent-nav-points"
              data-testid="agent-nav-points"
              onClick={() => setActiveTab('points')}
              title={language === 'ku' ? 'خاڵ و پاداشت' : language === 'ar' ? 'النقاط والمكافآت' : 'Points & Rewards'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'points'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'points' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Sparkles className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'points' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'خاڵەکان' : language === 'ar' ? 'النقاط' : 'Rewards'}
              </span>
            </button>

            {/* 8. Analytics */}
            <button
              type="button"
              id="agent-nav-analytics"
              data-testid="agent-nav-analytics"
              onClick={() => setActiveTab('analytics')}
              title={language === 'ku' ? 'شیکاری و ڕاپۆرتەکان' : language === 'ar' ? 'التحليلات' : 'Analytics & Reports'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'analytics'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'analytics' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <TrendingUp className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'analytics' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'شیکاری' : language === 'ar' ? 'التحليلات' : 'Analytics'}
              </span>
            </button>

            {/* 9. Documents */}
            <button
              type="button"
              id="agent-nav-documents"
              data-testid="agent-nav-documents"
              onClick={() => setActiveTab('documents')}
              title={t('agent.documents', 'Documents')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'documents'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'documents' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileCheck className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'documents' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'بەڵگەنامە' : language === 'ar' ? 'المستندات' : 'Docs'}
              </span>
            </button>

            {/* 10. Settings */}
            <button
              type="button"
              id="agent-nav-settings"
              data-testid="agent-nav-settings"
              onClick={() => setActiveTab('profile_settings')}
              title={language === 'ku' ? 'پڕۆفایل و ڕێکخستن' : language === 'ar' ? 'الملف الشخصي' : 'Profile & Settings'}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'profile_settings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'profile_settings' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Settings className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'profile_settings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕێکخستن' : language === 'ar' ? 'الإعدادات' : 'Settings'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Quick Add Property or Task */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/properties/add')}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={language === 'ku' ? 'زیادکردنی موڵک' : language === 'ar' ? 'إضافة عقار جديد' : 'Add Property'}
            aria-label="Add Property"
          >
            <Plus className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Alerts + Main Content)              */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Minimal Razor-Sharp Desktop & Mobile Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-3 sm:px-4 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Start: Mobile Brand Logo & Desktop Breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Mobile Brand Logo */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="flex items-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg p-1"
                aria-label="HomeHub Agent Dashboard"
              >
                <HomeHubLogo size="sm" showTagline={false} light={true} />
              </button>
            </div>

            {/* Desktop Breadcrumbs & Active Title */}
            <div className="hidden md:flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {language === 'ku' ? 'شوێنی کاری بریکار و نێوەندگیر' : language === 'ar' ? 'مساحة عمل الوكيل' : 'Agent Workspace'}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>

            {/* Live Agent KPI Pill */}
            {portfolio.length > 0 && (
              <div className="hidden xl:flex items-center gap-2 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs px-3 py-1.5 rounded-xl font-bold">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  {language === 'ku'
                    ? `${portfolio.length} موڵکی چالاک`
                    : language === 'ar'
                    ? `${portfolio.length} عقار نشط`
                    : `${portfolio.length} Active Listings`}
                </span>
              </div>
            )}
          </div>

          {/* End Header Area: Actions + Language + Notifications + Workspace Switcher + Profile */}
          <div className="flex items-center gap-2.5">
            {/* Quick Action Button on Desktop */}
            <button
              type="button"
              onClick={() => setShowAddTaskModal(true)}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === 'ku' ? 'ئەرکی نوێ' : language === 'ar' ? 'مهمة جديدة' : 'New Task'}</span>
            </button>

            {/* Language Switcher */}
            <div
              className="flex items-center gap-1.5 bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors"
              role="group"
              aria-label="Language Selector"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="bg-transparent border-none text-xs font-semibold text-slate-300 cursor-pointer focus:ring-0 p-0 pr-1"
                aria-label="Select language"
              >
                <option value="en" className="bg-[#0c1322] text-white">English</option>
                <option value="ku" className="bg-[#0c1322] text-white">کوردی سۆرانی</option>
                <option value="ar" className="bg-[#0c1322] text-white">العربية</option>
              </select>
            </div>

            {/* Refresh Data Button */}
            <button
              onClick={loadAgentWorkspace}
              title={language === 'ku' ? 'نوێکردنەوەی داتا' : language === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="agent-notification-bell-btn"
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label={t('owner.notifications', 'Notifications')}
              >
                <Bell className="w-4.5 h-4.5" />
                {((inquiries.length || 0) + (viewings.length || 0)) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black tracking-tight flex items-center justify-center border-2 border-[#0c1322] shadow-xs">
                    {(inquiries.length || 0) + (viewings.length || 0)}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Drawer */}
              {notificationsOpen && (
                <div id="agent-notifications-dropdown" className="absolute top-12 ltr:right-0 rtl:left-0 w-80 max-w-[90vw] bg-[#0c1322] border border-amber-500/30 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 text-white">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="font-bold text-sm text-white">
                      {t('owner.notifications', 'Notifications')}
                    </h3>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                    >
                      {language === 'ku' ? 'داخستن' : language === 'ar' ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                  <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
                    <div className="p-2.5 rounded-xl bg-[#080d19] border border-slate-800">
                      <p className="text-xs font-bold text-amber-400">
                        {language === 'ku'
                          ? 'داواکاری سەردانی نوێ هاتوە'
                          : language === 'ar'
                          ? 'طلب معاينة عقار جديد'
                          : 'New Property Viewing Request'}
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {language === 'ku'
                          ? 'کڕیار داوای بینینی ڤێلای ئیتاڵی ڤیلەیجی کردووە.'
                          : language === 'ar'
                          ? 'عميل يطلب موعد لمعاينة فيلا في القرية الإيطالية.'
                          : 'Prospective buyer requested tour for Italian Village Villa.'}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">10m ago</span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#080d19] border border-emerald-500/30">
                      <p className="text-xs font-bold text-emerald-400">
                        {language === 'ku'
                          ? 'ڕەزامەندی ڕاسپاردنی موڵک'
                          : language === 'ar'
                          ? 'تم تأكيد تفويض العقار'
                          : 'Property Agency Assignment Confirmed'}
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {language === 'ku'
                          ? 'دەسەڵاتی نوێنەرایەتی Zagros Heights پەسەندکراوە.'
                          : language === 'ar'
                          ? 'تم تفعيل صلاحية الوساطة لمجمع زاكروس هايتس.'
                          : 'Agency authorization active for Zagros Heights Apartments.'}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">1h ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Workspace Switcher Quick Header Button */}
            <button
              id="agent-header-switch-workspace-btn"
              type="button"
              onClick={() => setSwitchWorkspaceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
              title={t('workspace.switch_button_title', 'گۆڕینی شوێنی کار')}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">
                {t('workspace.switch_button', 'گۆڕینی شوێنی کار')}
              </span>
            </button>

            {/* Agent Profile Dropdown Menu */}
            <div className="relative">
              <button
                id="agent-profile-btn"
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer min-h-[40px] focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-expanded={profileDropdownOpen}
                aria-label="Agent profile menu"
              >
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center font-bold text-xs">
                  {profile?.displayName ? profile.displayName.substring(0, 2).toUpperCase() : 'AG'}
                </div>
                <div className="text-left rtl:text-right hidden sm:block">
                  <div className="text-xs font-bold text-white leading-tight">
                    {profile?.displayName || user?.displayName || user?.email || 'Sardar Mustafa'}
                  </div>
                  <div className="text-[10px] text-amber-400/90 font-medium">
                    {t('agent.agent_broker', 'Licensed Agent / Broker')}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute top-12 ltr:right-0 rtl:left-0 w-60 bg-[#0c1322] border border-amber-500/30 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-white">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-xs font-bold text-white">
                      {profile?.displayName || user?.displayName || 'Sardar Mustafa'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user?.email || 'agent@homehub.iq'}
                    </p>
                    <span className="inline-block px-2 py-0.5 mt-1 bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[9px] rounded-full">
                      {profile?.verificationStatus || 'VERIFIED LICENSE'}
                    </span>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('listings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-amber-400" />
                      {t('agent.my_listings', 'My Listings')}
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('inquiries_leads');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-amber-400" />
                      {t('agent.clients_leads', 'Clients & Leads')}
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('commissions');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Wallet className="w-4 h-4 text-amber-400" />
                      {t('agent.commissions', 'Commissions')}
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('profile_settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-amber-400" />
                      {language === 'ku' ? 'پڕۆفایل و ڕێکخستنەکان' : language === 'ar' ? 'الملف الشخصي والإعدادات' : 'Profile & Settings'}
                    </button>
                    <button
                      id="agent-switch-workspace-btn"
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setSwitchWorkspaceModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/10 rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Users className="w-4 h-4 text-amber-400" />
                      {t('workspace.switch_button', 'گۆڕینی شوێنی کار')}
                    </button>
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      onClick={async () => {
                        setProfileDropdownOpen(false);
                        await logout();
                        navigate('/');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      {t('action.sign_out', 'Sign Out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

      {/* Mobile Tab Navigation Bar (Screen < md) */}
      <div className="md:hidden bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 px-4 py-2.5 overflow-x-auto flex items-center gap-1.5 scrollbar-none sticky top-16 z-30 shadow-md">
        {[
          { id: 'overview', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
          { id: 'portfolio', label: t('agent.properties', 'Portfolio'), icon: Layers },
          { id: 'listings', label: t('agent.my_listings', 'Listings'), icon: Building2 },
          { id: 'inquiries_leads', label: t('agent.leads', 'Leads CRM'), icon: Users },
          { id: 'viewings', label: t('agent.viewing_schedule', 'Viewings'), icon: Calendar },
          { id: 'offers', label: language === 'ku' ? 'پێشنیارەکان' : language === 'ar' ? 'العروض' : 'Offers', icon: Handshake },
          { id: 'rental_operations', label: language === 'ku' ? 'ئۆپەراسیۆنی کرێ' : language === 'ar' ? 'عمليات الإيجار' : 'Rentals', icon: FileText },
          ...(FeatureFlags.BUY_SELL_ENABLED ? [{ id: 'sales_transactions', label: language === 'ku' ? 'مامەڵەی فرۆشتن' : language === 'ar' ? 'صفقات البيع' : 'Sales Deals', icon: Award }] : []),
          { id: 'tasks', label: t('agent.tasks', 'Tasks'), icon: CheckSquare },
          { id: 'documents', label: t('agent.documents', 'Documents'), icon: FileCheck },
          { id: 'commissions', label: t('agent.commissions', 'Commissions'), icon: Wallet },
          { id: 'analytics', label: language === 'ku' ? 'شیکاری' : language === 'ar' ? 'التحليلات' : 'Analytics', icon: BarChart3 },
          { id: 'points', label: language === 'ku' ? 'خاڵ و پاداشت' : language === 'ar' ? 'النقاط والمكافآت' : 'Points & Rewards', icon: Sparkles },
          { id: 'profile_settings', label: language === 'ku' ? 'پڕۆفایل' : language === 'ar' ? 'الملف الشخصي' : 'Profile', icon: Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`mobile-agent-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as AgentTabType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-sm'
                  : 'bg-[#080d19] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. FAIL-CLOSED BANNER & ACTION NOTIFICATIONS                               */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-4">
        {/* Action Success Alert */}
        {actionSuccessMsg && (
          <div className="mb-4 p-3.5 rounded-lg bg-zinc-100 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-2.5 text-xs font-medium animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-black shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button onClick={() => setActionSuccessMsg(null)} className="p-1 hover:text-emerald-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Fail-Closed Status Alert */}
        {error && (
          <div className="p-3.5 rounded-lg border bg-zinc-100/90 border-amber-200 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-black shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  {language === 'ku'
                    ? 'سێرڤەری سەرەکی لە دۆخی پارێزراودایە (Fail-Closed Enforcement)'
                    : language === 'ar'
                    ? 'قاعدة البيانات في وضع الحماية الصارم (Fail-Closed Enforcement)'
                    : 'Authoritative Relational Database Offline (Fail-Closed Security Enforced)'}
                </span>
                <span className="text-[11px] text-amber-800 mt-0.5 block">
                  {error}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                type="button"
                onClick={loadAgentWorkspace}
                className="px-3 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold rounded-lg cursor-pointer text-[11px] transition-colors"
              >
                {language === 'ku' ? 'دووبارە پەیوەندی بکەوە' : language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE VIEWPORT                                                */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 space-y-8">

        {/* ======================================================================= */}
        {/* TAB 1: OVERVIEW (DASHBOARD)                                            */}
        {/* ======================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Header Greeting & Date/Period Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    {t('nav.dashboard', 'Dashboard')}
                  </h1>
                  <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-full font-bold text-[10px]">
                    {t('agent.agent_broker', 'Licensed Agent / Broker')}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-normal">
                  {language === 'ku'
                    ? `بەخێربێیتەوە ${profile?.displayName || 'نێوەندگیر'}! لێرەدا کورتەیەک لە موڵکە ڕاسپێردراوەکان، کڕیاران و ئەنجامی مامەڵەکان دەبینیت.`
                    : language === 'ar'
                    ? `مرحباً بعودتك ${profile?.displayName || 'الوكيل'}! إليك نظرة عامة على العقارات الموكلة، العملاء والصفقات.`
                    : `Welcome back, ${profile?.displayName || 'Agent'}! Here is an overview of your assigned properties, leads, and deal pipeline.`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    value={dashboardPeriod}
                    onChange={(e) => setDashboardPeriod(e.target.value as any)}
                    className="bg-[#0c1322] border border-slate-800 text-slate-200 font-medium text-xs rounded-xl py-2 px-3 pl-8 rtl:pr-8 rtl:pl-3 shadow-2xs cursor-pointer focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="month">{language === 'ku' ? 'ئەم مانگە' : language === 'ar' ? 'هذا الشهر' : 'This Month'}</option>
                    <option value="quarter">{language === 'ku' ? 'ئەم وەرزە' : language === 'ar' ? 'هذا الربع' : 'This Quarter'}</option>
                    <option value="year">{language === 'ku' ? 'ئەمساڵ' : language === 'ar' ? 'هذه السنة' : 'This Year'}</option>
                  </select>
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute top-2.5 ltr:left-2.5 rtl:right-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Health Dashboard Component */}
            <PropertyHealthDashboard role="AGENT" />

            {/* 4-Column Primary Desktop KPI Cards matching Owner Workspace layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* KPI 1: Total Listings */}
              <button
                type="button"
                onClick={() => setActiveTab('listings')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-13 h-13 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Home className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('agent.kpi.total_listings', 'Total Listings')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5 leading-tight">
                    {dashboardData?.kpi.totalListings ?? portfolio.length}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {portfolio.length > 0
                        ? `${portfolio.length} ${language === 'ku' ? 'موڵکی سپێردراو' : language === 'ar' ? 'عقار مخصص' : 'assigned properties'}`
                        : (language === 'ku' ? '+١ لە مانگی ڕابردووەوە' : language === 'ar' ? '+١ من الشهر الماضي' : '+1 from last month')}
                    </span>
                  </div>
                </div>
              </button>

              {/* KPI 2: Active Pipeline Leads */}
              <button
                type="button"
                onClick={() => setActiveTab('inquiries_leads')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-13 h-13 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('agent.kpi.active_leads', 'Active Pipeline Leads')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5 leading-tight">
                    {dashboardData?.kpi.activeLeads ?? leads.length}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{language === 'ku' ? '+٢ نوێ ئەم هەفتەیە' : language === 'ar' ? '+٢ هذا الأسبوع' : '+2 new this week'}</span>
                  </div>
                </div>
              </button>

              {/* KPI 3: Scheduled Viewings */}
              <button
                type="button"
                onClick={() => setActiveTab('viewings')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-13 h-13 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('agent.kpi.scheduled_viewings', 'Scheduled Viewings')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5 leading-tight">
                    {dashboardData?.kpi.scheduledViewingsToday ?? viewings.length}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 mt-1">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{language === 'ku' ? 'بە نۆرەی ١ کاتژمێری' : language === 'ar' ? 'مع فاصل زمني ساعة' : '1h buffer enforced'}</span>
                  </div>
                </div>
              </button>

              {/* KPI 4: Total Commission Earnings */}
              <button
                type="button"
                onClick={() => setActiveTab('commissions')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4 group"
              >
                <div className="w-13 h-13 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('agent.kpi.total_commission', 'Commissions Earned')}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-amber-400 block mt-0.5 leading-tight truncate">
                    <span dir="ltr">{formatAmount(dashboardData?.kpi.totalCommissionEarned || 0)} IQD</span>
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1">
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{language === 'ku' ? '٧٠٪ بریکار / ٣٠٪ نووسینگە' : language === 'ar' ? '٧٠٪ للوكيل / ٣٠٪ للمكتب' : '70% Agent / 30% Brokerage'}</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Quick Actions (6 Dedicated Action Cards matching Owner Workspace) */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">
                    {t('owner.quick_actions', 'Quick Actions')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'ku'
                      ? 'کردارە خێراکان بۆ بەڕێوەبردنی موڵک، کڕیاران و سەردانەکان'
                      : language === 'ar'
                      ? 'مهام شائعة لإدارة العقارات، العملاء والزيارات'
                      : 'Common tasks to manage assigned properties, leads, and viewings'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddListingModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-amber-500 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('agent.add_new_listing', '+ Add New Listing')}</span>
                </button>
              </div>

              {/* 6 Clean Action Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. Assigned Portfolio */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Layers className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('agent.tabs.portfolio', 'Assigned Portfolio')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'موڵکە ڕاسپێردراوەکان (0٪ تاپۆ)' : language === 'ar' ? 'العقارات الموكلة (0% طابو)' : 'Assigned properties (0% deed agency)'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('portfolio')}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'ku' ? 'بەڕێوەبردن' : language === 'ar' ? 'إدارة' : 'Manage'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 2. Listings */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('agent.tabs.listings', 'Listings')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'خستنەڕووی بازاڕگەری و نرخ' : language === 'ar' ? 'عروض التسويق والأسعار' : 'Marketing listings & pricing'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('listings')}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'ku' ? 'بەڕێوەبردن' : language === 'ar' ? 'إدارة' : 'Manage'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 3. Leads CRM */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('agent.tabs.leads', 'Leads CRM')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'کڕیارەکان و قۆناغەکانی پێشنیار' : language === 'ar' ? 'متابعة العملاء والمراحل' : 'Pipeline leads & client stages'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('inquiries_leads')}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'ku' ? 'بەدواداچوون' : language === 'ar' ? 'تتبع' : 'Track'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 4. Viewings */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('agent.tabs.viewings', 'Viewings')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'خشتەی سەردانە مەیدانییەکان' : language === 'ar' ? 'جدول الزيارات والمواعيد' : 'Coordinate property visits'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('viewings')}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'ku' ? 'خشتەدانان' : language === 'ar' ? 'جدولة' : 'Schedule'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 5. Offers & Counter */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Handshake className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('agent.tabs.offers', 'Offers')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'پێشنیارەکان و دانوستاندن' : language === 'ar' ? 'العروض والتفاوض' : 'Review offers & counter-offers'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('offers')}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'ku' ? 'پێداچوونەوە' : language === 'ar' ? 'مراجعة' : 'Review'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 6. Commissions */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800/80 shadow-lg hover:border-amber-500/40 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('agent.tabs.commissions', 'Commissions')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'داهات و پشکی ٧٠/٣٠ برۆکەری' : language === 'ar' ? 'الأرباح وحصة 70/30' : 'Commission splits & payouts'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('commissions')}
                    className="w-full py-1.5 px-3 rounded-xl bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{language === 'ku' ? 'پیشاندان' : language === 'ar' ? 'عرض' : 'View'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>
              </div>

              {/* Secondary Ecosystem Shortcuts Bar */}
              <div className="pt-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
                <span className="font-semibold text-amber-300 shrink-0 text-[11px] uppercase tracking-wider">
                  {language === 'ku' ? 'کردارە خێراکان:' : language === 'ar' ? 'اختصارات المنظومة:' : 'Ecosystem Shortcuts:'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddListingModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('agent.add_new_listing', '+ Add Listing')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === 'ku' ? '+ کڕیاری نوێ' : language === 'ar' ? '+ عميل جديد' : '+ New Lead'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTaskModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'ku' ? '+ ئەرکی نوێ' : language === 'ar' ? '+ مهمة جديدة' : '+ New Task'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('agent.ai_assistant', 'AI Co-Pilot')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/rentals')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{language === 'ku' ? 'بازاڕی گشتی' : language === 'ar' ? 'السوق العقاري' : 'Rental Marketplace'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/tenant')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Home className="w-3.5 h-3.5 text-purple-400" />
                  <span>{t('role.tenant', 'Resident Portal')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/owner')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>{t('role.owner', 'Owner Portal')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/portfolio')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-amber-500/40 text-slate-200 font-semibold shrink-0 flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('portfolio.title', 'Portfolio Analytics')}</span>
                </button>
              </div>
            </div>

            {/* "Your Assigned Properties & Listings" Structured Table directly on Overview Dashboard */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">
                    {t('agent.overview.properties_table_title', language === 'ku' ? 'موڵک و خستنەڕووە ڕاسپێردراوەکانت' : language === 'ar' ? 'عقاراتك وعروضك الموكلة' : 'Your Assigned Properties & Listings')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('agent.overview.properties_table_desc', language === 'ku'
                      ? 'لیستی ئەو موڵکانەی کە خاوەن موڵک دەسەڵاتی نوێنەرایەتی پێداویت (0٪ تاپۆ)'
                      : language === 'ar'
                      ? 'قائمة بالعقارات الموكلة إليك بصفة وسيط معتمد (0% طابو)'
                      : 'Properties authorized for your agency representation (0% deed agency)')}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute top-3 ltr:left-3 rtl:right-3" />
                    <input
                      type="text"
                      placeholder={language === 'ku' ? 'گەڕان لە موڵکەکان...' : language === 'ar' ? 'البحث في العقارات...' : 'Search properties...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-xs py-2 ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 rounded-xl border border-slate-800 bg-[#080d19] text-white placeholder:text-slate-500 focus:border-amber-500/50 w-44 sm:w-56 shadow-sm"
                    />
                  </div>
                  <select
                    value={cityFilter}
                    onChange={(e) => setCityFilter(e.target.value)}
                    className="text-xs font-semibold p-2 rounded-xl border border-slate-800 bg-[#080d19] text-slate-200 shadow-sm cursor-pointer focus:border-amber-500/50"
                  >
                    <option value="ALL">{t('owner.all_cities', 'All Cities')}</option>
                    <option value="Erbil">Erbil (هەولێر)</option>
                    <option value="Sulaymaniyah">Sulaymaniyah (سلێمانی)</option>
                    <option value="Duhok">Duhok (دهۆک)</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs font-semibold p-2 rounded-xl border border-slate-800 bg-[#080d19] text-slate-200 shadow-sm cursor-pointer focus:border-amber-500/50"
                  >
                    <option value="ALL">{t('owner.all_status', 'All Status')}</option>
                    <option value="Active">Active</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Table Container matching Owner Workspace Table styling */}
              <div className="bg-[#0c1322] rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden">
                {filteredOverviewProperties.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="font-bold text-white text-sm">
                      {t('owner.no_properties', 'No assigned properties found')}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {language === 'ku'
                        ? 'هیچ موڵکێک نەدۆزرایەوە بەپێی ئەم فلتەرە. کاتێک خاوەن موڵک دەسەڵاتی نێوەندگیریت پێدەدات لێرە دەردەکەوێت.'
                        : language === 'ar'
                        ? 'لم يتم العثور على أي عقارات تطابق معايير التصفية.'
                        : 'No properties found matching your filter criteria. Properties appear once an owner grants agency authority.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left rtl:text-right border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#080d19] text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4 sm:px-6">{t('agent.table.property', 'PROPERTY')}</th>
                          <th className="py-3.5 px-4">{t('agent.table.address', 'LOCATION')}</th>
                          <th className="py-3.5 px-4">{t('agent.table.status', 'STATUS')}</th>
                          <th className="py-3.5 px-4">{t('agent.table.leads_offers', 'AGENCY ASSIGNMENT')}</th>
                          <th className="py-3.5 px-4">{t('agent.table.price_rent', 'PRICE / RENT')}</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right rtl:text-left">{t('agent.table.actions', 'ACTIONS')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs">
                        {filteredOverviewProperties.map((prop) => (
                          <tr key={prop.id} className="hover:bg-[#111b2e]/60 transition-colors">
                            {/* 1. Property Details */}
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <img
                                  src={prop.imageUrl}
                                  alt={prop.title}
                                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-800 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-white truncate">
                                    {prop.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {prop.type || 'Residential Villa'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Location */}
                            <td className="py-3.5 px-4 text-slate-300">
                              <div className="truncate max-w-[200px] font-medium">{prop.district}</div>
                              <div className="text-[11px] text-slate-400">{prop.city}</div>
                            </td>

                            {/* 3. Status */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                  prop.status === 'Active'
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    prop.status === 'Active' ? 'bg-emerald-400' : 'bg-amber-400'
                                  }`}
                                />
                                <span>{prop.status}</span>
                              </span>
                            </td>

                            {/* 4. Agency Non-Ownership Indicator */}
                            <td className="py-3.5 px-4 text-slate-300 font-medium">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold text-[10px]">
                                <ShieldCheck className="w-3 h-3 text-amber-400" />
                                <span>{language === 'ku' ? 'بریکاری نا-خاوەن موڵک (٠٪ تاپۆ)' : language === 'ar' ? 'وكيل غير مالك (٠٪ طابو)' : 'Non-Owner Agent (0% Deed)'}</span>
                              </span>
                            </td>

                            {/* 5. Price / Rent with LTR isolation */}
                            <td className="py-3.5 px-4 font-black text-amber-400 font-mono">
                              <span dir="ltr">{formatAmount(prop.price)} IQD</span>
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3.5 px-4 sm:px-6 text-right rtl:text-left">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('listings')}
                                  className="px-3 py-1.5 bg-[#080d19] hover:bg-[#111b2e] border border-slate-800 hover:border-amber-500/40 text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  {language === 'ku' ? 'بینین' : language === 'ar' ? 'عرض' : 'View'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('viewings')}
                                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                  {language === 'ku' ? 'سەردان' : language === 'ar' ? 'زيارة' : 'Tour'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* THREE COLUMN PANELS (Performance Analytics, Leads CRM, AI Co-Pilot) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Panel 1: Performance */}
              <div className="lg:col-span-4 bg-[#0c1322] p-5 rounded-2xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-white">
                      {language === 'ku' ? 'ئاستی بازاڕگەری موڵکەکان' : language === 'ar' ? 'أداء تسويق العقارات' : 'Property Marketing Performance'}
                    </h2>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                    <div className="bg-[#080d19] p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-sm font-black text-slate-500 block" title={language === 'ku' ? 'بەردەست نییە' : language === 'ar' ? 'غير متاح' : 'Unavailable'}>--</span>
                      <span className="text-[10px] font-semibold text-slate-400">{language === 'ku' ? 'بینینەکان' : language === 'ar' ? 'مشاهدات' : 'Views'}</span>
                    </div>
                    <div className="bg-[#080d19] p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-sm font-black text-white block">{dashboardData?.kpi.activeLeads ?? 0}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{language === 'ku' ? 'کڕیاران' : language === 'ar' ? 'استفسارات' : 'Inquiries'}</span>
                    </div>
                    <div className="bg-[#080d19] p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-sm font-black text-white block">{dashboardData?.kpi.scheduledViewingsToday ?? 0}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{language === 'ku' ? 'سەردانی ئەمڕۆ' : language === 'ar' ? 'زيارات اليوم' : 'Viewings'}</span>
                    </div>
                    <div className="bg-[#080d19] p-2.5 rounded-xl border border-slate-800/60">
                      <span className="text-sm font-black text-white block">{dashboardData?.kpi.activeOffers ?? 0}</span>
                      <span className="text-[10px] font-semibold text-slate-400">{language === 'ku' ? 'پێشنیارەکان' : language === 'ar' ? 'عروض' : 'Offers'}</span>
                    </div>
                  </div>

                  <div className="relative h-28 w-full mt-4 flex flex-col items-center justify-center bg-[#080d19]/60 rounded-xl border border-slate-800 border-dashed">
                    <span className="text-xs font-semibold text-slate-400">
                      {language === 'ku' ? 'داتای شیکاری بەردەست نییە' : language === 'ar' ? 'بيانات التحليلات غير متاحة' : 'Analytics Data Unavailable'}
                    </span>
                    <span className="text-[10px] text-slate-500 mt-1">
                      {language === 'ku' ? 'چاوەڕوانی یەکخستنی داتای ڕاستەقینە' : language === 'ar' ? 'في انتظار تكامل البيانات الحقيقية' : 'Pending live data integration'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Recent Leads CRM */}
              <div className="lg:col-span-4 bg-[#0c1322] p-5 rounded-2xl border border-slate-800/80 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black text-white">
                      {language === 'ku' ? 'سیستەمی بەڕێوەبردنی کڕیاران' : language === 'ar' ? 'نظام إدارة العملاء' : 'Assigned Leads CRM'}
                    </h2>
                    <button onClick={() => setShowAddLeadModal(true)} className="text-[11px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer">
                      {language === 'ku' ? '+ زیادکردنی کڕیار' : language === 'ar' ? '+ إضافة عميل' : '+ Add Lead'}
                    </button>
                  </div>
                  <div className="space-y-3">
                    {(leads.length > 0 ? leads.slice(0, 4) : (dashboardData?.recentLeads || [])).length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-slate-800 rounded-xl bg-[#080d19]/40">
                        <span className="text-xs font-medium text-slate-500">
                          {language === 'ku' ? 'هیچ کڕیارێکی ڕاسپێردراو نەدۆزرایەوە' : language === 'ar' ? 'لم يتم العثور على عملاء معينين' : 'No assigned leads found'}
                        </span>
                      </div>
                    ) : (
                      (leads.length > 0 ? leads.slice(0, 4) : (dashboardData?.recentLeads || [])).map((lead: any) => (
                        <div key={lead.id} className="flex items-center justify-between p-2.5 hover:bg-[#080d19] rounded-xl transition-all border border-transparent hover:border-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                              {lead.clientName ? lead.clientName.substring(0, 2) : 'CL'}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-white block leading-tight">{lead.clientName}</span>
                              <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{lead.summary || lead.notes || 'Buyer Inquiry'}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            {lead.stage || 'NEW'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <button onClick={() => setActiveTab('inquiries_leads')} className="w-full text-center text-xs font-bold text-amber-400 hover:text-amber-300 pt-3 border-t border-slate-800 cursor-pointer">
                  {language === 'ku' ? '← کردنەوەی پڕۆسەی کڕیاران' : language === 'ar' ? '← فتح مسار العملاء' : 'Open CRM Pipeline →'}
                </button>
              </div>

              {/* Panel 3: AI Co-Pilot & Security */}
              <div className="lg:col-span-4 bg-gradient-to-br from-[#0c1322] via-[#111b2e] to-[#0c1322] p-5 rounded-2xl border border-amber-500/30 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-bold">
                        <Bot className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black text-white">{t('agent.ai_assistant', 'AI Co-Pilot (Advisory)')}</span>
                    </div>
                    <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">SAFEGUARDED</span>
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-3">
                    {t('agent.ai_subtitle', 'Get insights, property suggestions, market analysis, and help with client communication.')}
                  </p>
                  <div className="relative mb-3">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                      placeholder={language === 'ku' ? 'پرسیار لە شیکاریی بازاڕ، ئامۆژگاریی فرۆشتن...' : language === 'ar' ? 'اسأل عن تحليلات السوق...' : 'Ask market advice, lead conversion tips...'}
                      className="w-full text-xs ps-3 pe-16 py-2 bg-[#080d19] rounded-xl border border-slate-800 text-white placeholder:text-slate-500 focus:border-amber-500/50 focus:outline-hidden"
                    />
                    <button
                      onClick={() => handleAskAi()}
                      className="absolute end-1.5 top-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 text-[10px] font-black rounded-lg hover:from-amber-300 hover:to-amber-500 cursor-pointer shadow-sm"
                    >
                      Ask
                    </button>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Deterministic authorization enforces fail-closed state.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 2: ASSIGNED PORTFOLIO                                              */}
        {/* ======================================================================= */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  {t('agent.properties', 'Assigned Property Portfolio')}
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ku'
                    ? 'ئەو موڵکانەی کە ڕێگەپێدانی نوێنەرایەتیت بۆ کراوە بەپێی تۆماری فەرمی (نێوەندگیر 0٪ تاپۆ)'
                    : language === 'ar'
                    ? 'العقارات المفوضة إليك رسمياً مع الالتزام بقيد عدم الملكية (0% طابو)'
                    : 'Properties granted under active agency agreement (0% deed in ownership_records)'}
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddListingModal(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('agent.add_new_listing', '+ Add Listing')}</span>
                </button>
              </div>
            </div>

            {portfolio.length === 0 ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {language === 'ku' ? 'هیچ موڵکێکی ڕاسپێردراو نییە' : language === 'ar' ? 'لا توجد عقارات موكلة حالياً' : 'No Properties Currently Assigned'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {language === 'ku'
                    ? 'موڵکەکان لێرە دەردەکەون کاتێک خاوەن موڵک یان کۆمپانیای بەڕێوەبردن دەسەڵاتی نوێنەرایەتیت پێبدات.'
                    : language === 'ar'
                    ? 'ستظهر العقارات هنا بمجرد منح المالك أو شركة الإدارة تفويض وساطة رسمي.'
                    : 'Properties appear here once an authorized property owner or brokerage grants an active agency agreement.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {portfolio.map(p => (
                  <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md">
                          {p.propertyType}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md">
                          {p.assignmentStatus}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{p.title}</h3>
                        <p className="text-xs text-slate-500">{p.address?.district}, {p.address?.city}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-slate-500">{language === 'ku' ? 'تۆماری تاپۆ:' : language === 'ar' ? 'سند الملكية:' : 'Ownership Deed:'}</span>
                          <span className="font-semibold text-slate-800">{language === 'ku' ? 'خاوەن موڵک (١٠٠٪ تاپۆ)' : language === 'ar' ? 'المالك (١٠٠٪ طابو)' : 'Owner (100% Deed)'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">{language === 'ku' ? 'ڕۆڵی نوێنەر:' : language === 'ar' ? 'صفة الوكالة:' : 'Agency Role:'}</span>
                          <span className="font-bold text-blue-600">{language === 'ku' ? 'بریکار (٠٪ تاپۆ)' : language === 'ar' ? 'وكيل معتمد (٠٪ طابو)' : 'Non-Owner Agent (0% Deed)'}</span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                        {p.permissions?.map((perm, idx) => (
                          <span key={idx} className="text-[9px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 3: LISTINGS & PROPERTY MARKETING                                   */}
        {/* ======================================================================= */}
        {activeTab === 'listings' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.my_listings', 'Listings & Marketing')}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ku'
                    ? 'بەڕێوەبردنی بڵاوکراوەکانی بازاڕگەری، ڕوونکردنەوەی نرخی کرێ و پەیوەندییەکان.'
                    : language === 'ar'
                    ? 'إدارة المنشورات التسويقية، الإفصاح عن الأسعار واستفسارات المستأجرين.'
                    : 'Manage marketing publications, price disclosures, and inquiries.'}
                </p>
              </div>
              <button
                id="agent-add-listing-btn"
                onClick={() => setShowAddListingModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('agent.add_new_listing', '+ Add New Listing')}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(dashboardData?.myListings || []).map(item => (
                <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <div className="relative h-44 w-full">
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      <span className={`absolute top-3 start-3 px-2.5 py-1 text-[10px] font-bold rounded-full text-white ${item.status === 'Active' ? 'bg-emerald-600' : 'bg-amber-600'}`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="p-4 space-y-2">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{item.title}</h3>
                      <p className="text-xs text-slate-500">{item.location}</p>
                      <div className="text-base font-bold text-slate-900 font-mono">
                        <span dir="ltr">${formatAmount(item.price)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
                        <span>{item.beds} {language === 'ku' ? 'ژوور' : language === 'ar' ? 'غرف' : 'Beds'}</span>
                        <span>•</span>
                        <span>{item.baths} {language === 'ku' ? 'حەمام' : language === 'ar' ? 'حمامات' : 'Baths'}</span>
                        <span>•</span>
                        <span><span dir="ltr">{item.areaSqm}</span> m²</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 flex gap-2">
                    <button
                      onClick={() => showToast(`Marketing details for ${item.title}`, 'info')}
                      className="flex-1 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-center cursor-pointer"
                    >
                      {language === 'ku' ? 'بینین' : language === 'ar' ? 'عرض' : 'View'}
                    </button>
                    <button
                      onClick={() => showToast(`Status update for ${item.title}`, 'info')}
                      className="flex-1 py-1.5 text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-center cursor-pointer"
                    >
                      {language === 'ku' ? 'بڵاوکردنەوە / نوێکردنەوە' : language === 'ar' ? 'نشر / تحديث' : 'Publish / Update'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 4: INQUIRIES & LEADS CRM                                           */}
        {/* ======================================================================= */}
        {activeTab === 'inquiries_leads' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.clients_leads', 'Inquiries & Leads CRM')}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ku'
                    ? 'سیستەمی پارێزراوی کڕیاران و داواکارییەکان بە پاراستنی تەواوی تایبەتمەندی.'
                    : language === 'ar'
                    ? 'نظام إدارة العملاء والاستفسارات محمي على مستوى السجلات.'
                    : 'Record-level privacy protected CRM pipeline and inquiries.'}
                </p>
              </div>
              <button
                id="agent-add-lead-btn"
                onClick={() => setShowAddLeadModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ku' ? '+ زیادکردنی کڕیار' : language === 'ar' ? '+ إضافة عميل' : '+ Add Lead'}</span>
              </button>
            </div>

            {/* Kanban-style stages */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { id: 'NEW', labelKu: 'نوێ', labelAr: 'جديد', labelEn: 'New Leads' },
                { id: 'CONTACTED', labelKu: 'پەیوەندیکراو', labelAr: 'تم التواصل', labelEn: 'Contacted' },
                { id: 'QUALIFIED', labelKu: 'شایستەکراو', labelAr: 'مؤهل', labelEn: 'Qualified' },
                { id: 'VIEWING_SCHEDULED', labelKu: 'دیداری دیاریکراو', labelAr: 'معاينة مجدولة', labelEn: 'Viewing Scheduled' },
              ].map(stageObj => {
                const stage = stageObj.id;
                const stageLabel = language === 'ku' ? stageObj.labelKu : language === 'ar' ? stageObj.labelAr : stageObj.labelEn;
                const stageLeads = (leads.length > 0 ? leads : (dashboardData?.recentLeads || [])).filter(
                  (l: any) => l.stage === stage || (stage === 'NEW' && !l.stage)
                );
                return (
                  <div key={stage} className="bg-slate-100/70 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{stageLabel}</span>
                      <span className="text-[10px] font-bold bg-white text-slate-600 px-2 py-0.5 rounded-full shadow-2xs">
                        {stageLeads.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {stageLeads.map((lead: any) => (
                        <div key={lead.id} className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{lead.clientName}</span>
                            <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                              {lead.leadType === 'RENT' 
                                ? (language === 'ku' ? 'کرێ' : language === 'ar' ? 'إيجار' : 'Rent')
                                : (language === 'ku' ? 'کڕین' : language === 'ar' ? 'شراء' : 'Buy')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {lead.summary || lead.notes || (language === 'ku' ? 'ئارەزووی موڵکی نیشتەجێبوون دەکات' : 'Interested in residential listing')}
                          </p>
                          {lead.clientPhone && (
                            <div className="text-[10px] text-slate-400 font-mono" dir="ltr">
                              {lead.clientPhone}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 5: VIEWINGS & APPOINTMENTS                                         */}
        {/* ======================================================================= */}
        {activeTab === 'viewings' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.viewing_schedule', 'Viewings & Appointments')}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ku'
                    ? 'سیستەمی ڕێگری لە بەریەککەوتنی کاتەکان ماوەی ١ کاتژمێر لە نێوان سەردانەکاندا دەپارێزێت.'
                    : language === 'ar'
                    ? 'منع تضارب المواعيد يفرض فاصلاً زمنياً مدته ساعة بين الزيارات.'
                    : 'Scheduling conflict prevention enforces 1-hour buffer between visits.'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-start border-collapse">
                <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-4 text-start">{language === 'ku' ? 'کڕیار / داواکار' : language === 'ar' ? 'العميل' : 'Client'}</th>
                    <th className="p-4 text-start">{language === 'ku' ? 'موڵک' : language === 'ar' ? 'العقار' : 'Property'}</th>
                    <th className="p-4 text-start">{language === 'ku' ? 'بەروار و کات' : language === 'ar' ? 'الوقت والتاريخ' : 'Requested Date/Time'}</th>
                    <th className="p-4 text-start">{language === 'ku' ? 'دۆخ' : language === 'ar' ? 'الحالة' : 'Status'}</th>
                    <th className="p-4 text-end">{language === 'ku' ? 'کردار' : language === 'ar' ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewings.length > 0 ? viewings : [
                    { id: 'vw-1', buyerName: 'Kardo Barzani', propertyName: 'Luxury Residence Villa 24', scheduledTime: 'Tomorrow, 10:00 AM', status: 'CONFIRMED' },
                    { id: 'vw-2', buyerName: 'Sara Latif', propertyName: 'Executive Penthouse 18B', scheduledTime: 'Thursday, 02:30 PM', status: 'REQUESTED' }
                  ]).map((v: any) => (
                    <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-4 font-bold text-slate-900">{v.buyerName || v.requesterName || (language === 'ku' ? 'کڕیار' : 'Client')}</td>
                      <td className="p-4 text-slate-600">{v.propertyName || (language === 'ku' ? 'موڵکی سپێردراو' : 'Assigned Property')}</td>
                      <td className="p-4 text-slate-600 font-mono" dir="ltr">{v.scheduledTime || v.startTime || 'Scheduled'}</td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${v.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'CONFIRMED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span>{v.status}</span>
                        </span>
                      </td>
                      <td className="p-4 text-end">
                        <button onClick={() => showToast('Appointment updated', 'info')} className="px-3 py-1 bg-blue-50 text-blue-600 font-semibold rounded-lg hover:bg-blue-100 cursor-pointer">
                          {language === 'ku' ? 'بەڕێوەبردن' : language === 'ar' ? 'إدارة' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 6: OFFERS & NEGOTIATIONS                                           */}
        {/* ======================================================================= */}
        {activeTab === 'offers' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {language === 'ku' ? 'پێشنیارەکانی بەکرێدان و دانوستاندن' : language === 'ar' ? 'عروض الإيجار والتفاوض' : 'Rental Offers & Negotiations'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'پارێزراوی ڕەزامەندی: نێوەندگیران ناتوانن بەبێ ڕەزامەندی و مۆڵەتی خاوەن موڵک پێشنیارەکان قبوڵ بکەن.'
                  : language === 'ar'
                  ? 'ضمانة الموافقة: لا يمكن للوكلاء قبول العروض دون موافقة وتفويض المالك.'
                  : 'Approval Safeguard: Agents cannot accept offers or bypass owner sign-off without explicit documented power of attorney.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offers.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-white border border-slate-200/80 rounded-2xl">
                  <p className="text-sm font-semibold text-slate-500">
                    {language === 'ku' ? 'هیچ پێشنیار یان داواکارییەکی کرێی چالاک نییە.' : language === 'ar' ? 'لا توجد عروض إيجار نشطة حالياً.' : 'No active rental offers or negotiations.'}
                  </p>
                </div>
              ) : offers.map((off: any) => (
                <div key={off.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400" dir="ltr">{off.offerNumber || off.id}</span>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-full">
                      {off.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">{off.propertyName || (language === 'ku' ? 'موڵکی سپێردراو' : 'Assigned Property Listing')}</span>
                    <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
                      <span dir="ltr">${formatAmount(off.amount)} {off.currency || 'USD'}</span>
                    </div>
                    <span className="text-xs text-slate-600 mt-1 block">
                      {language === 'ku' ? 'داواکاری کرێ:' : language === 'ar' ? 'مقدم طلب الإيجار:' : 'Rental Applicant:'} {off.buyerName || (language === 'ku' ? 'کرێداری پشتڕاستکراو' : 'Verified Tenant')}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      id="agent-counter-offer-btn"
                      onClick={() => {
                        setSelectedOfferForCounter(off);
                        setCounterAmount(String(Number(off.amount) + 5000));
                        setShowCounterModal(true);
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs cursor-pointer"
                    >
                      {language === 'ku' ? 'پێشنیاری بەرامبەر' : language === 'ar' ? 'تقديم عرض مقابل' : 'Submit Counter-Offer'}
                    </button>
                    <span className="text-[10px] text-slate-400 italic">
                      {language === 'ku' ? 'واژۆی خاوەن موڵک پێویستە' : language === 'ar' ? 'توقيع المالك مطلوب' : 'Owner sign-off required'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 7: SALES TRANSACTIONS (Gated by BUY_SELL_ENABLED)                   */}
        {/* ======================================================================= */}
        {activeTab === 'sales_transactions' && (
          <div className="space-y-6 animate-in fade-in">
            {!FeatureFlags.BUY_SELL_ENABLED ? (
              <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex items-start gap-3.5 text-amber-900 shadow-xs">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-bold text-sm">
                    {language === 'ku' ? 'کڕین و فرۆشتن لەم وەشانەدا ناچالاک کراوە' : language === 'ar' ? 'صفقات البيع والشراء معطلة في هذا الإصدار' : 'Sales Deals Disabled in Rental-Only Release'}
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {language === 'ku'
                      ? 'پلاتفۆرمی هۆم‌هەب بەتەواوی تەرخانکراوە بۆ بەکرێدان و بەڕێوەبردنی موڵکی کرێ. مامەڵەکانی کڕین و فرۆشتن و گواستنەوەی تاپۆ ناچالاکن.'
                      : language === 'ar'
                      ? 'منصة هومهب مخصصة حالياً لعمليات الإيجار وإدارة عقارات الإيجار فقط. صفقات البيع والشراء ونقل الطابو معطلة.'
                      : 'HomeHub is operating in strictly rental-only mode. Sales transactions, purchasing milestones, and sales deed transfers are disabled.'}
                  </p>
                  <button
                    onClick={() => setActiveTab('rental_operations')}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {language === 'ku' ? 'گواستنەوە بۆ ئۆپەراسیۆنەکانی کرێ' : language === 'ar' ? 'الانتقال إلى عمليات الإيجار' : 'Switch to Rental Operations'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.transactions', 'Sales Transactions')}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Authorized sales transaction milestone coordination without financial tampering authority.</p>
                </div>

                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-slate-200/80 rounded-2xl">
                      <p className="text-sm font-semibold text-slate-500">No active sales transactions.</p>
                    </div>
                  ) : transactions.map((tx: any) => (
                    <div key={tx.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-800" dir="ltr">{tx.transactionNumber}</span>
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                          {tx.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-50 p-3 rounded-xl">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Agreed Amount</span>
                          <span className="font-bold text-slate-900 font-mono" dir="ltr">${formatAmount(tx.amount)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Due Diligence</span>
                          <span className="font-bold text-blue-600">{tx.dueDiligenceStatus || 'IN_PROGRESS'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Tapu Verification</span>
                          <span className="font-bold text-emerald-600">VERIFIED</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Settlement</span>
                          <span className="font-bold text-amber-600">ESCROW_PENDING</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 8: RENTAL OPERATIONS                                               */}
        {/* ======================================================================= */}
        {activeTab === 'rental_operations' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.transactions', 'Rental Operations')}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                HomeHub Financial Policy: The property-specific rent management fee applies strictly to confirmed collected rent and is never applied to property sales.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(rentals.length > 0 ? rentals : [
                { id: 'rent-1', propertyName: 'Modern Executive Penthouse 18B', district: 'Empire World', monthlyRent: 2200, currency: 'USD', status: 'OCCUPIED' }
              ]).map((r: any) => (
                <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{r.propertyName}</span>
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                      {r.status || 'AVAILABLE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{r.district || 'Erbil'}</p>
                  <div className="text-lg font-bold text-slate-900 font-mono">
                    <span dir="ltr">${formatAmount(r.monthlyRent)} / month</span>
                  </div>
                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                    Property-specific fees applied strictly to confirmed collected rent.
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 9: TASKS & FOLLOW-UPS                                              */}
        {/* ======================================================================= */}
        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.tasks', 'Tasks & Follow-ups')}</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ku'
                    ? 'ئەرکەکانی بەرهەمهێنانی نێوەندگیر و بەدواداچوونی کڕیاران.'
                    : language === 'ar'
                    ? 'مهام الإنتاجية ومتابعة العملاء الخاصة بالوكيل.'
                    : 'Isolated agent productivity tasks and client follow-ups.'}
                </p>
              </div>
              <button
                id="agent-add-task-btn"
                onClick={() => setShowAddTaskModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{language === 'ku' ? '+ ئەرکی نوێ' : language === 'ar' ? '+ مهمة جديدة' : '+ New Task'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {(tasks.length > 0 ? tasks : [
                { id: 'tsk-1', title: 'Submit deed verification request for internal review', priority: 'HIGH', status: 'PENDING', dueDate: 'Tomorrow' },
                { id: 'tsk-2', title: 'Follow-up with tenant regarding lease proposal', priority: 'NORMAL', status: 'COMPLETED', dueDate: 'Today' }
              ]).map((tsk: any) => (
                <div key={tsk.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${tsk.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                      <CheckSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold ${tsk.status === 'COMPLETED' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{tsk.title}</h4>
                      <span className="text-[10px] text-slate-400">
                        {language === 'ku' ? 'وادە: ' : language === 'ar' ? 'الموعد: ' : 'Due: '}
                        {tsk.dueDate || (language === 'ku' ? 'دیارینەکراوە' : 'No due date')}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${tsk.priority === 'HIGH' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                    {tsk.priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 10: DOCUMENTS & AGREEMENTS                                         */}
        {/* ======================================================================= */}
        {activeTab === 'documents' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.documents', 'Documents & Agreements')}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'ڕێککەوتننامە فەرمییەکانی موڵک و برۆکەری بەپێی سنووری دەسەڵاتی ڕێپێدراو.'
                  : language === 'ar'
                  ? 'اتفاقيات الوساطة والعقارات المعتمدة وفقاً لنطاق الصلاحيات المصرح به.'
                  : 'Authoritative property and brokerage agreements accessible strictly under authorized scope.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(documents.length > 0 ? documents : [
                { id: 'doc-1', title: 'Tapu Deed Title Verification - Villa 24', documentType: 'TITLE_DEED', verificationState: 'VERIFIED' }
              ]).map((doc: any) => (
                <div key={doc.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                        {doc.verificationState || 'VERIFIED'}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900">{doc.title}</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{doc.documentType}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button onClick={() => showToast(`Viewing document: ${doc.title}`, 'info')} className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                      {language === 'ku' ? 'بینینی بەڵگەنامە ←' : language === 'ar' ? 'عرض المستند ←' : 'View Document →'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 11: COMMISSIONS & EARNINGS                                         */}
        {/* ======================================================================= */}
        {activeTab === 'commissions' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{t('agent.commissions', 'Earnings & Commissions')}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'تۆماری دابەشکردنی کۆمیسیۆنی ٧٠/٣٠ی نێوان نوێنەر و نوسینگە. کۆمیسیۆنە پێشبینیکراوەکان بەڕوونی جیاکراونەتەوە لە پشکی دراو.'
                  : language === 'ar'
                  ? 'سجلات توزيع عمولة الوساطة بنسبة 70/30. يتم تمييز العمولات المتوقعة بوضوح عن المدفوعات المصروفة.'
                  : 'Standard 70/30 brokerage deal commission split records. Projected commissions are clearly distinguished from disbursed payouts.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(commissions.length > 0 ? commissions : [
                { id: 'comm-1', dealAmount: 355000, grossCommissionAmount: 7100, agentShareAmount: 4970, brokerageShareAmount: 2130, status: DealCommissionStatus.CALCULATED }
              ]).map((c: any) => (
                <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'ku' ? 'پشکی مامەڵە (کۆمیسیۆن)' : language === 'ar' ? 'عمولة الصفقة' : 'Deal Commission'}
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full">
                      {getLocalizedCommissionStatus(c.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === 'ku' ? 'کۆی کۆمیسیۆن' : language === 'ar' ? 'إجمالي العمولة' : 'Gross Commission'}
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-mono" dir="ltr">${formatAmount(c.grossCommissionAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === 'ku' ? 'نوێنەر (٧٠٪)' : language === 'ar' ? 'الوكيل (70%)' : 'Agent (70%)'}
                      </span>
                      <span className="text-xs font-bold text-blue-600 font-mono" dir="ltr">${formatAmount(c.agentShareAmount)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === 'ku' ? 'کۆمپانیا (٣٠٪)' : language === 'ar' ? 'الوساطة (30%)' : 'Brokerage (30%)'}
                      </span>
                      <span className="text-xs font-bold text-slate-600 font-mono" dir="ltr">${formatAmount(c.brokerageShareAmount)}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {language === 'ku'
                      ? 'پشتڕاستکردنەوەی دارایی دوولایەنە دەپارێزێت بەبێ هیچ جیاوازییەک.'
                      : language === 'ar'
                      ? 'يحافظ على المطابقة المحاسبية بالقيد المزدوج دون أي فروقات.'
                      : 'Preserves double-entry accounting reconciliation with zero discrepancy.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 12: PERFORMANCE ANALYTICS                                          */}
        {/* ======================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {language === 'ku' ? 'شیکاری کارایی' : language === 'ar' ? 'تحليلات الأداء' : 'Performance Analytics'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'پێوەرە فەرمییەکانی کارایی کە راستەوخۆ لە داتابەیسەوە ئەژمارکراون.'
                  : language === 'ar'
                  ? 'مؤشرات الأداء المعتمدة المحسوبة مباشرة من السجلات الرسمية.'
                  : 'Authoritative performance metrics calculated directly from database records.'}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'موڵکە سپێردراوەکان' : language === 'ar' ? 'العقارات المسندة' : 'Assigned Listings'}
                </span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.assignedListingsCount ?? portfolio.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'کۆی کڕیارە چاوەڕوانکراوەکان' : language === 'ar' ? 'إجمالي العملاء المحتملين' : 'Total Pipeline Leads'}
                </span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.totalLeadsCount ?? leads.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'سەردانە دیاریکراوەکان' : language === 'ar' ? 'المعاينات المجدولة' : 'Scheduled Viewings'}
                </span>
                <span className="text-2xl font-bold text-slate-900 block mt-1">{analytics?.scheduledViewingsCount ?? viewings.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                <span className="text-xs font-semibold text-slate-500 block">
                  {language === 'ku' ? 'ڕێژەی ئەنجامدانی سەردان' : language === 'ar' ? 'نسبة إتمام المعاينات' : 'Viewing Completion Rate'}
                </span>
                <span className="text-2xl font-bold text-emerald-600 block mt-1">{analytics?.viewingCompletionRate ?? 100}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 13: PROFILE & SETTINGS                                             */}
        {/* ======================================================================= */}
        {activeTab === 'profile_settings' && (
          <div className="space-y-6 max-w-2xl animate-in fade-in">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {language === 'ku' ? 'پڕۆفایل و مۆڵەتی نوێنەر' : language === 'ar' ? 'ملف الوكيل وبيانات الترخيص' : 'Agent Profile & License Credentials'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ku'
                  ? 'بەڵگەنامە پیشەییەکان، دۆخی مۆڵەت، و بەردەستبوون.'
                  : language === 'ar'
                  ? 'الوثائق المهنية، وحالة التحقق من الترخيص، والجاهزية.'
                  : 'Professional credentials, license verification status, and availability.'}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                  {profile?.displayName ? profile.displayName.substring(0, 2).toUpperCase() : 'AG'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{profile?.displayName || 'Sardar Mustafa'}</h3>
                  <p className="text-xs text-slate-500">{profile?.professionalTitle || 'Senior Luxury Property Specialist'}</p>
                  <span className="inline-block px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full mt-1">
                    {language === 'ku' ? 'مۆڵەتی پشتڕاستکراو' : language === 'ar' ? 'ترخيص معتمد' : 'VERIFIED LICENSE'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'تەلەفۆن' : language === 'ar' ? 'الهاتف' : 'Phone'}</span>
                  <span className="font-bold text-slate-800 font-mono" dir="ltr">{profile?.phone || '+964 750 111 2233'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'ئیمەیڵ' : language === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span className="font-bold text-slate-800" dir="ltr">{profile?.email || 'agent@homehub.iq'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'نوسینگە / ڕێکخراو' : language === 'ar' ? 'المكتب / المنظمة' : 'Office / Organization'}</span>
                  <span className="font-bold text-slate-800">{profile?.officeName || 'Zagros Real Estate Partners'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'دۆخی بەردەستبوون' : language === 'ar' ? 'حالة التوفر' : 'Availability'}</span>
                  <span className="font-bold text-blue-600">{language === 'ku' ? 'بەردەستە' : language === 'ar' ? 'متاح' : 'AVAILABLE'}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TAB 14: POINTS & REWARDS WALLET                                         */}
        {/* ======================================================================= */}
        {activeTab === 'points' && (
          <div className="space-y-6 animate-in fade-in" data-testid="agent-points-tab-content">
            <PointsWalletView />
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* MODALS (Matching Owner Workspace rounded-3xl styling)                     */}
      {/* ========================================================================= */}

      {/* MODAL 1: ADD NEW LISTING */}
      {showAddListingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{t('agent.add_new_listing', '+ Add New Listing')}</h3>
              <button onClick={() => setShowAddListingModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50 rounded-2xl text-[11px] text-blue-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                {language === 'ku'
                  ? 'پشکنینی دەسەڵات: دروستکردنی خستنەڕوو پێویستی بە سپاردنی فەرمیی موڵک هەیە بە مۆڵەتی CREATE_LISTING.'
                  : language === 'ar'
                  ? 'التحقق من الصلاحية: إنشاء إعلان يتطلب تفويضاً نشطاً للعقار بصلاحية CREATE_LISTING.'
                  : 'Authority check: Creating a listing requires an active property assignment with CREATE_LISTING permission.'}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'ناونیشانی خستنەڕوو *' : language === 'ar' ? 'عنوان الإعلان *' : 'Listing Title *'}
                </label>
                <input
                  type="text"
                  value={newListing.title}
                  onChange={(e) => setNewListing({ ...newListing, title: e.target.value })}
                  placeholder={language === 'ku' ? 'وەک: خانووی مۆدێرن لە گوندی ئیتاڵی' : language === 'ar' ? 'مثال: فيلا حديثة في القرية الإيطالية' : 'e.g. Modern Villa in Italian Village'}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'ku' ? 'کرێی مانگانە (USD / IQD) *' : language === 'ar' ? 'بدل الإيجار الشهري *' : 'Monthly Rent (USD / IQD) *'}
                  </label>
                  <input
                    type="number"
                    value={newListing.price}
                    onChange={(e) => setNewListing({ ...newListing, price: e.target.value })}
                    placeholder="1500"
                    className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    {language === 'ku' ? 'جۆری موڵک' : language === 'ar' ? 'نوع العقار' : 'Property Type'}
                  </label>
                  <select
                    value={newListing.propertyType}
                    onChange={(e) => setNewListing({ ...newListing, propertyType: e.target.value })}
                    className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="RESIDENTIAL_VILLA">{language === 'ku' ? 'خانوو / ڤێلا' : language === 'ar' ? 'فيلا سكنية' : 'Villa'}</option>
                    <option value="RESIDENTIAL_APARTMENT">{language === 'ku' ? 'شوقە' : language === 'ar' ? 'شقة سكنية' : 'Apartment'}</option>
                    <option value="COMMERCIAL_OFFICE">{language === 'ku' ? 'نووسینگەی بازرگانی' : language === 'ar' ? 'مكتب تجاري' : 'Commercial Office'}</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowAddListingModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setActionSuccessMsg(language === 'ku' ? 'خستنەڕوو وەک ڕەشنووس نێردرا بۆ پێداچوونەوەی خاوەن موڵک.' : language === 'ar' ? 'تم تقديم الإعلان كمسودة بانتظار مراجعة المالك.' : 'Listing submitted with DRAFT status pending owner review.');
                  setShowAddListingModal(false);
                }}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {language === 'ku' ? 'ناردنی خستنەڕوو' : language === 'ar' ? 'إرسال الإعلان' : 'Submit Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW LEAD */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{language === 'ku' ? '+ کڕیاری نوێ' : language === 'ar' ? '+ إضافة عميل' : '+ Add New Lead'}</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'ناوی تەواوی کڕیار / داواکار *' : language === 'ar' ? 'اسم العميل بالكامل *' : 'Client Full Name *'}
                </label>
                <input
                  type="text"
                  value={newLead.clientName}
                  onChange={(e) => setNewLead({ ...newLead, clientName: e.target.value })}
                  placeholder={language === 'ku' ? 'وەک: سەردار محەمەد' : language === 'ar' ? 'مثال: سردار محمد' : 'e.g. Sardar Mohammed'}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'ژمارەی مۆبایل (+964)' : language === 'ar' ? 'رقم الهاتف (+964)' : 'Phone Number (+964)'}
                </label>
                <input
                  type="text"
                  value={newLead.clientPhone}
                  onChange={(e) => setNewLead({ ...newLead, clientPhone: e.target.value })}
                  placeholder="+964 750 000 0000"
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'تێبینی و پێداویستییەکان' : language === 'ar' ? 'الملاحظات والمتطلبات' : 'Notes & Requirements'}
                </label>
                <textarea
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                  rows={3}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowAddLeadModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setActionSuccessMsg(language === 'ku' ? 'کڕیاری نوێ بەسەرکەوتوویی زیادکرا بۆ سیستەم.' : language === 'ar' ? 'تمت إضافة العميل بنجاح إلى النظام.' : 'New lead added to CRM pipeline.');
                  setShowAddLeadModal(false);
                }}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {language === 'ku' ? 'پاشەکەوتکردنی کڕیار' : language === 'ar' ? 'حفظ العميل' : 'Save Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: COUNTER-OFFER */}
      {showCounterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{language === 'ku' ? 'پێشنیاری بەرامبەر' : language === 'ar' ? 'تقديم عرض مقابل' : 'Submit Counter-Offer'}</h3>
              <button onClick={() => setShowCounterModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'بڕی پێشنیاری بەرامبەر (USD / IQD) *' : language === 'ar' ? 'مبلغ العرض المقابل *' : 'Counter Amount (USD / IQD) *'}
                </label>
                <input
                  type="number"
                  value={counterAmount}
                  onChange={(e) => setCounterAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 font-bold text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'تێبینی و مەرجەکانی دانوستاندن' : language === 'ar' ? 'ملاحظات وشروط التفاوض' : 'Negotiation Notes & Terms'}
                </label>
                <textarea
                  value={counterNotes}
                  onChange={(e) => setCounterNotes(e.target.value)}
                  placeholder={language === 'ku' ? 'مەرجە ڕێککەوتووەکان لەگەڵ خاوەن موڵک...' : language === 'ar' ? 'الشروط المتفق عليها مع المالك...' : 'Terms agreed with owner...'}
                  rows={3}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowCounterModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCounterOfferSubmit}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {language === 'ku' ? 'ناردنی پێشنیار' : language === 'ar' ? 'إرسال العرض المقابل' : 'Submit Counter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: AI ADVISORY */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                  <Bot className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {language === 'ku' ? 'هاوکاری ژیری دەستکردی خانووبەرە' : language === 'ar' ? 'مساعد الذكاء الاصطناعي العقاري' : 'AI Real Estate Co-Pilot'}
                </h3>
              </div>
              <button onClick={() => setShowAiModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl min-h-[160px] flex flex-col justify-center text-xs">
              {aiLoading ? (
                <div className="flex items-center justify-center gap-3 text-blue-600">
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span className="font-bold">
                    {language === 'ku' ? 'شیکارکردنی داتای بازاڕ و ئامادەکردنی ڕاوێژ...' : language === 'ar' ? 'تحليل بيانات السوق وتوليد الرؤى الاستشارية...' : 'Analyzing market data and generating advisory insights...'}
                  </span>
                </div>
              ) : (
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {aiResponse || (language === 'ku' ? 'هەر پرسیارێکی ڕاوێژکاری لەسەر خانووبەرە بپرسە بۆ وەرگرتنی شیکاری ڕاستەوخۆ.' : language === 'ar' ? 'اطرح أي سؤال استشاري عقاري للحصول على تحليل فوري للسوق.' : 'Ask any real estate advisory question to get real-time market analysis.')}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskAi()}
                placeholder={language === 'ku' ? 'پرسیاری تر بپرسە...' : language === 'ar' ? 'اطرح أسئلة إضافية...' : 'Ask follow-up questions...'}
                className="flex-1 text-xs p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={() => handleAskAi()}
                disabled={aiLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{language === 'ku' ? 'ناردن' : language === 'ar' ? 'إرسال' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: ADD NEW TASK */}
      {showAddTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">{language === 'ku' ? '+ ئەرکی نوێ' : language === 'ar' ? '+ مهمة جديدة' : '+ Add New Task'}</h3>
              <button onClick={() => setShowAddTaskModal(false)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'ناونیشانی ئەرک *' : language === 'ar' ? 'عنوان المهمة *' : 'Task Title *'}
                </label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder={language === 'ku' ? 'وەک: بەدواداچوون لەگەڵ کڕیار سەبارەت بە پێشنیار' : language === 'ar' ? 'مثال: متابعة العميل بخصوص العرض' : 'e.g. Follow-up with client regarding offer'}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'بەرواری وادە' : language === 'ar' ? 'موعد الاستحقاق' : 'Due Date'}
                </label>
                <input
                  type="text"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  placeholder={language === 'ku' ? 'وەک: بەیانی، ٠٤:٠٠ی دوای نیوەڕۆ' : language === 'ar' ? 'مثال: غداً، ٠٤:٠٠ مساءً' : 'e.g. Tomorrow, 4:00 PM'}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  {language === 'ku' ? 'ئاستی گرنگی' : language === 'ar' ? 'الأولوية' : 'Priority'}
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
                  className="w-full p-2.5 bg-slate-50/50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value={TaskPriority.LOW}>{language === 'ku' ? 'نزم' : language === 'ar' ? 'منخفضة' : 'Low'}</option>
                  <option value={TaskPriority.NORMAL}>{language === 'ku' ? 'ئاسایی' : language === 'ar' ? 'عادية' : 'Normal'}</option>
                  <option value={TaskPriority.HIGH}>{language === 'ku' ? 'بەرز' : language === 'ar' ? 'عالية' : 'High'}</option>
                  <option value={TaskPriority.URGENT}>{language === 'ku' ? 'بەپەلە' : language === 'ar' ? 'عاجلة' : 'Urgent'}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button onClick={() => setShowAddTaskModal(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer">
                {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  setActionSuccessMsg(language === 'ku' ? 'ئەرکی نوێ بەسەرکەوتوویی زیادکرا بۆ بەدواداچوونەکان.' : language === 'ar' ? 'تمت إضافة المهمة بنجاح إلى قائمة المتابعة.' : 'New task added to follow-ups.');
                  setShowAddTaskModal(false);
                }}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {language === 'ku' ? 'پاشەکەوتکردنی ئەرک' : language === 'ar' ? 'حفظ المهمة' : 'Save Task'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Authoritative Workspace Switcher Modal */}
      <WorkspaceSwitcherModal
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
        onLogout={async () => {
          setSwitchWorkspaceModalOpen(false);
          await logout();
          navigate('/login');
        }}
        isSwitching={isSwitchingWorkspace}
        error={workspaceSwitchError}
        onClearError={() => setWorkspaceSwitchError(null)}
      />
    </div>
  );
};
