import React, { useState, useEffect, useMemo } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth, EligibleWorkspace } from '../components/AuthProvider';
import { WorkspaceSwitcherModal } from '../components/common/WorkspaceSwitcherModal';
import { 
  Building2, Users, Wrench, CheckCircle, Clock, Search, 
  Home, Phone, Mail, UserPlus, ChevronRight, Briefcase, 
  Wallet, FileText, AlertTriangle, Shield, Check, Plus,
  DollarSign, X, ExternalLink, RefreshCw, BarChart2,
  Sparkles, Layers, ArrowUpRight, ArrowDownLeft, Key,
  CheckCircle2, ShieldAlert, BrainCircuit,
  Info, AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CompanyDashboardData, CompanyPropertyItem, CompanyApprovalItem, CompanyMemberItem } from '../types/company.js';

// Modular Company Components matching UI design
import { CompanyTopBar } from '../components/company/CompanyTopBar';
import { CompanyProfileCard } from '../components/company/CompanyProfileCard';
import { CompanyWelcomeArea } from '../components/company/CompanyWelcomeArea';
import { CompanyKpiGrid } from '../components/company/CompanyKpiGrid';
import { CompanyQuickActions, QuickActionId } from '../components/company/CompanyQuickActions';
import { CompanyRecentActivity, ActivityItem } from '../components/company/CompanyRecentActivity';
import { CompanyBottomNav, BottomNavTabId } from '../components/company/CompanyBottomNav';
import { 
  SearchModal, 
  NotificationsDrawer, 
  CompanyProfileModal, 
  AddPropertyManagementModal,
  InviteOwnerModal,
  CreateLeaseModal,
  CreateListingModal,
  VendorsModal,
  ReportsModal,
  DocumentsModal,
  MessagesDrawer,
  MoreModal,
  ActivityDetailModal
} from '../components/company/CompanyModals';
import { CashCollectionModal } from '../components/company/CashCollectionModal';

export interface CompanyWorkspacePageProps {
  initialProfileDropdownOpen?: boolean;
}

export const CompanyWorkspacePage: React.FC<CompanyWorkspacePageProps> = ({
  initialProfileDropdownOpen = false,
}) => {
  const { t, direction, language } = useI18n();
  const { token, user, logout, eligibleWorkspaces, activeWorkspace, selectWorkspace } = useAuth();
  const navigate = useNavigate();

  // Workspace Switcher Modal State
  const [switchWorkspaceModalOpen, setSwitchWorkspaceModalOpen] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceSwitchError, setWorkspaceSwitchError] = useState<string | null>(null);

  const handleSelectWorkspace = async (target: EligibleWorkspace) => {
    if (isSwitchingWorkspace) return;
    setIsSwitchingWorkspace(true);
    setWorkspaceSwitchError(null);

    try {
      await selectWorkspace(target.workspaceId);
      setSwitchWorkspaceModalOpen(false);

      if (target.destination && target.destination !== '/workspace/company' && target.destination !== '/company') {
        navigate(target.destination);
      } else {
        await fetchDashboard();
      }
    } catch (err: any) {
      console.error('Failed to switch workspace:', err);
      setWorkspaceSwitchError(
        err?.message ||
        (language === 'ku'
          ? 'گۆڕینی شوێنی کار سەرکەوتوو نەبوو. تکایە دووبارە هەوڵبدەرەوە.'
          : language === 'ar'
          ? 'فشل تبديل مساحة العمل. يرجى المحاولة مرة أخرى.'
          : 'Failed to switch workspace. Please try again.')
      );
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };
  
  const [activeTab, setActiveTab] = useState<'home' | 'properties' | 'operations' | 'approvals' | 'financials' | 'team' | 'intelligence'>('home');
  const [loading, setLoading] = useState(false);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<CompanyDashboardData | null>(null);

  // Modals state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showNotificationsDrawer, setShowNotificationsDrawer] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showInviteOwnerModal, setShowInviteOwnerModal] = useState(false);
  const [showCashCollectionModal, setShowCashCollectionModal] = useState(false);
  const [showCreateLeaseModal, setShowCreateLeaseModal] = useState(false);
  const [showCreateListingModal, setShowCreateListingModal] = useState(false);
  const [showVendorsModal, setShowVendorsModal] = useState(false);
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showMessagesDrawer, setShowMessagesDrawer] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [showAllActivityModal, setShowAllActivityModal] = useState(false);

  // Team Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('PROPERTY_MANAGER');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [showAddAgreementModal, setShowAddAgreementModal] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<CompanyPropertyItem | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [membersList, setMembersList] = useState<CompanyMemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch('/api/company/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setMembersList(data);
      }
    } catch (e) {
      console.error('Failed to load team members:', e);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleToggleMemberStatus = async (memberId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/company/members/${memberId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setActionNotice(`Member status updated to ${nextStatus}.`);
        fetchMembers();
      } else {
        const err = await res.json();
        setActionNotice(err.message || 'Failed to update member status.');
      }
    } catch (err: any) {
      setActionNotice(err.message || 'Status update error.');
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/company/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 503) {
        setDbUnavailable(true);
        setDashboardData(null);
      } else if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        setDbUnavailable(false);
      } else {
        const err = await res.json();
        setErrorMessage(err.message || 'Failed to load company workspace.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error connecting to company service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'team') {
      fetchMembers();
    }
  }, [activeTab, token]);

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/company/members/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setInviteSuccess(true);
        fetchMembers();
        setTimeout(() => {
          setShowInviteModal(false);
          setInviteSuccess(false);
          setInviteEmail('');
        }, 1500);
      } else {
        const err = await res.json();
        setActionNotice(err.message || 'Could not send invitation.');
      }
    } catch (err: any) {
      setActionNotice(err.message || 'Invitation failed.');
    }
  };

  const handleApprovalDecision = async (approvalId: string, type: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/company/approvals/${approvalId}/decision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, decision }),
      });
      if (res.ok) {
        setActionNotice(`بڕیارەکە بە سەرکەوتوویی تۆمارکرا (${decision}).`);
        fetchDashboard();
      } else {
        const err = await res.json();
        setActionNotice(err.message || 'ناتوانرێت بڕیار بدرێت.');
      }
    } catch (err: any) {
      setActionNotice(err.message || 'هەڵە لە جێبەجێکردندا.');
    }
  };

  // KPIs
  const kpis = dashboardData?.kpis || {
    managedProperties: 0,
    activeTenants: 0,
    monthlyRentManagedIqd: 0,
    openMaintenance: 0,
    activeListings: 0,
    pendingApprovals: 0,
  };

  const handleQuickAction = (actionId: QuickActionId) => {
    switch (actionId) {
      case 'add_management':
        setShowAddAgreementModal(true);
        break;
      case 'invite_owner':
        setShowInviteOwnerModal(true);
        break;
      case 'add_team_member':
        setShowInviteModal(true);
        break;
      case 'manage_properties':
        setActiveTab('properties');
        break;
      case 'manage_tenants':
        navigate('/workspace/company/crm');
        break;
      case 'create_lease':
        setShowCreateLeaseModal(true);
        break;
      case 'maintenance':
        setActiveTab('operations');
        break;
      case 'create_listing':
        setShowCreateListingModal(true);
        break;
      case 'vendors':
        setShowVendorsModal(true);
        break;
      case 'financials':
        setActiveTab('financials');
        break;
      case 'approvals':
        setActiveTab('approvals');
        break;
      case 'reports':
        setShowReportsModal(true);
        break;
      case 'documents':
        setShowDocumentsModal(true);
        break;
      case 'messages':
        setShowMessagesDrawer(true);
        break;
      case 'ai_assistant':
        setActiveTab('intelligence');
        break;
      case 'more':
        setShowMoreModal(true);
        break;
    }
  };

  const handleBottomNavSelect = (tabId: BottomNavTabId) => {
    if (tabId === 'messages') {
      setShowMessagesDrawer(true);
    } else if (tabId === 'more') {
      setShowMoreModal(true);
    } else if (tabId === 'home') {
      setActiveTab('home');
    } else if (tabId === 'properties') {
      setActiveTab('properties');
    } else if (tabId === 'operations') {
      setActiveTab('operations');
    }
  };

  const handleSelectKpi = (key: 'properties' | 'tenants' | 'financials' | 'maintenance' | 'listings' | 'approvals') => {
    if (key === 'properties') setActiveTab('properties');
    else if (key === 'tenants') navigate('/workspace/company/crm');
    else if (key === 'maintenance') setActiveTab('operations');
    else if (key === 'approvals') setActiveTab('approvals');
    else if (key === 'financials') setActiveTab('financials');
    else if (key === 'listings') setShowCreateListingModal(true);
  };

  const recentActivities: ActivityItem[] = useMemo(() => {
    if (dashboardData?.recentActivities && dashboardData.recentActivities.length > 0) {
      return dashboardData.recentActivities.map((act) => ({
        id: act.id,
        title: act.action,
        subtitle: act.description,
        timeAgo: act.timestamp,
        timestamp: act.timestamp,
        type: (act.resourceType === 'MAINTENANCE' ? 'MAINTENANCE' : act.resourceType === 'LEASE' ? 'LEASE' : act.resourceType === 'PAYMENT' ? 'PAYMENT' : 'APPROVAL') as any,
        status: 'COMPLETED',
      }));
    }
    return [];
  }, [dashboardData?.recentActivities]);

  const renderReconciliationBadge = () => {
    // 1. Loading state (actively loading and no prior dashboard data)
    if (loading && !dashboardData) {
      return (
        <span 
          data-testid="badge-reconciliation-status"
          data-status="LOADING"
          role="status"
          aria-label={t('company.status_loading', 'لە پشکنینی هاوسەنگیدایە... (Verifying Reconciliation...)')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 shadow-xs"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-500" />
          <span>{t('company.status_loading', 'لە پشکنینی هاوسەنگیدایە... (Verifying Reconciliation...)')}</span>
        </span>
      );
    }

    // 2. Database Unavailable or API Error or Missing Data
    if (dbUnavailable || errorMessage || !dashboardData) {
      return (
        <span 
          data-testid="badge-reconciliation-status"
          data-status="UNAVAILABLE"
          role="status"
          aria-label={t('company.status_error', 'داتای هاوسەنگی بەردەست نییە (Reconciliation Unavailable)')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 shadow-xs"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>{t('company.status_error', 'داتای هاوسەنگی بەردەست نییە (Reconciliation Unavailable)')}</span>
        </span>
      );
    }

    const status = dashboardData.financialSummary?.reconciliationStatus;

    // 3. Balanced (all double-entry ledger lines balanced and portfolio summary reconciled)
    if (status === 'BALANCED') {
      return (
        <span 
          data-testid="badge-reconciliation-status"
          data-status="BALANCED"
          role="status"
          aria-label={t('company.ledger_balanced', 'دەفتەری دارایی هاوسەنگ (Double-Entry Balanced)')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>{t('company.ledger_balanced', 'دەفتەری دارایی هاوسەنگ (Double-Entry Balanced)')}</span>
        </span>
      );
    }

    // 4. Pending Ledger Posting (confirmed payments processed under fallback without ledger posting)
    if (status === 'PENDING_RECONCILIATION') {
      return (
        <span 
          data-testid="badge-reconciliation-status"
          data-status="PENDING_RECONCILIATION"
          role="status"
          aria-label={t('company.status_pending', 'لە چاوەڕوانی تۆمارکردنی دەفتەردایە (Pending Ledger Posting)')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs"
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>{t('company.status_pending', 'لە چاوەڕوانی تۆمارکردنی دەفتەردایە (Pending Ledger Posting)')}</span>
        </span>
      );
    }

    // 5. Unreconciled (discrepancy detected in double-entry journal balance or portfolio summary)
    if (status === 'UNRECONCILED') {
      return (
        <span 
          data-testid="badge-reconciliation-status"
          data-status="UNRECONCILED"
          role="status"
          aria-label={t('company.status_unreconciled', 'ناهەوسەنگی لە دەفتەردا هەیە (Reconciliation Discrepancy)')}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-xs"
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>{t('company.status_unreconciled', 'ناهەوسەنگی لە دەفتەردا هەیە (Reconciliation Discrepancy)')}</span>
        </span>
      );
    }

    // 6. No Data / No Financial Activity
    return (
      <span 
        data-testid="badge-reconciliation-status"
        data-status="NO_DATA"
        role="status"
        aria-label={t('company.status_no_data', 'هیچ چالاکییەکی دارایی نییە (No Financial Activity)')}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 shadow-xs"
      >
        <Info className="w-3.5 h-3.5 text-slate-500" />
        <span>{t('company.status_no_data', 'هیچ چالاکییەکی دارایی نییە (No Financial Activity)')}</span>
      </span>
    );
  };

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'home': return language === 'ku' ? 'سەرەکی' : language === 'ar' ? 'الرئيسية' : 'Overview';
      case 'properties': return language === 'ku' ? 'موڵکەکان' : language === 'ar' ? 'العقارات' : 'Properties';
      case 'operations': return language === 'ku' ? 'ئۆپەراسیۆن و چاکسازی' : language === 'ar' ? 'العمليات والصيانة' : 'Operations';
      case 'approvals': return language === 'ku' ? 'پەسەندکردنەکان' : language === 'ar' ? 'الموافقات' : 'Approvals';
      case 'financials': return language === 'ku' ? 'دارایی و دەفتەر' : language === 'ar' ? 'المالية' : 'Financials';
      case 'team': return language === 'ku' ? 'تیمی کار' : language === 'ar' ? 'فريق العمل' : 'Team';
      case 'intelligence': return language === 'ku' ? 'شیکاری و AI' : language === 'ar' ? 'التحليلات والذكاء الاصطناعي' : 'Intelligence';
      default: return '';
    }
  };

  return (
    <div 
      data-testid="company-workspace-root" 
      className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} 
      dir={direction}
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Company Workspace Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Company Dashboard"
            aria-label="HomeHub Company Dashboard"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Company Navigation"
          >
            {/* home */}
            <button
              type="button"
              data-testid="tab-home"
              onClick={() => setActiveTab('home')}
              title={t('nav.dashboard', 'Overview')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'home'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'home' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Home className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'home' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'سەرەکی' : language === 'ar' ? 'الرئيسية' : 'Home'}
              </span>
            </button>

            {/* properties */}
            <button
              type="button"
              data-testid="tab-properties"
              onClick={() => setActiveTab('properties')}
              title="Properties"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'properties'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'properties' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Building2 className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'properties' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'موڵکەکان' : language === 'ar' ? 'العقارات' : 'Properties'}
              </span>
              {kpis.managedProperties > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {kpis.managedProperties}
                </span>
              )}
            </button>

            {/* operations */}
            <button
              type="button"
              data-testid="tab-operations"
              onClick={() => setActiveTab('operations')}
              title="Operations"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'operations'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'operations' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wrench className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'operations' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ئۆپەراسیۆن' : language === 'ar' ? 'العمليات' : 'Operations'}
              </span>
              {kpis.openMaintenance > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {kpis.openMaintenance}
                </span>
              )}
            </button>

            {/* approvals */}
            <button
              type="button"
              data-testid="tab-approvals"
              onClick={() => setActiveTab('approvals')}
              title="Approvals"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'approvals'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'approvals' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CheckCircle className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'approvals' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'پەسەندکردن' : language === 'ar' ? 'الموافقات' : 'Approvals'}
              </span>
              {kpis.pendingApprovals > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {kpis.pendingApprovals}
                </span>
              )}
            </button>

            {/* financials */}
            <button
              type="button"
              data-testid="tab-financials"
              onClick={() => setActiveTab('financials')}
              title="Financials"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'financials'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'financials' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wallet className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'financials' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'دارایی' : language === 'ar' ? 'المالية' : 'Finance'}
              </span>
            </button>

            {/* team */}
            <button
              type="button"
              data-testid="tab-team"
              onClick={() => setActiveTab('team')}
              title="Team"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'team'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'team' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Users className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'team' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'تیم' : language === 'ar' ? 'الفريق' : 'Team'}
              </span>
            </button>

            {/* intelligence */}
            <button
              type="button"
              data-testid="tab-intelligence"
              onClick={() => setActiveTab('intelligence')}
              title="Intelligence"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'intelligence'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'intelligence' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Sparkles className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'intelligence' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕاپۆرت' : language === 'ar' ? 'التقارير' : 'Reports'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Add Agreement */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddAgreementModal(true)}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={language === 'ku' ? 'زیادکردنی ڕێککەوتن' : language === 'ar' ? 'إضافة اتفاقية' : 'Add Agreement'}
            aria-label="Add Agreement"
          >
            <Plus className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Visual Top Bar matching design */}
        <CompanyTopBar 
          companyName={dashboardData?.company.name || 'HomeHub Partner'}
          activeTabTitle={getTabTitle(activeTab)}
          unreadNotificationsCount={dashboardData?.urgentAlerts?.length || 0}
          onOpenSearch={() => setShowSearchModal(true)}
          onOpenNotifications={() => setShowNotificationsDrawer(true)}
          onOpenProfile={() => setShowProfileModal(true)}
          onOpenWorkspaceSwitcher={() => setSwitchWorkspaceModalOpen(true)}
          initialUserMenuOpen={initialProfileDropdownOpen}
        />

        <div className="flex flex-col gap-6 max-w-7xl mx-auto px-3 sm:px-6 py-4 pb-28 lg:pb-12 w-full">

      {/* Notice of External Integrations & Fail-Closed State */}
      {dbUnavailable && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm flex items-start gap-2.5 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">ئاگاداری ژێرخانی داتابەیس (Database Service Unavailable)</p>
            <p className="mt-0.5">
              داتابەیسی پەیوەندیداری PostgreSQL لەم ژینگەیەدا هێشتا نەکراوەتەوە. سیستەم بە شێوازی داخراو (Fail-Closed) کاردەکات بەبێ دروستکردنی داتای ساختە.
            </p>
          </div>
        </div>
      )}

      {actionNotice && (
        <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs sm:text-sm flex items-center justify-between shadow-xs">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-blue-500 hover:text-blue-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="md:hidden flex border-b border-amber-500/20 overflow-x-auto no-scrollbar gap-2 pb-1">
        {[
          { id: 'home', label: 'سەرەکی (Overview)', icon: Home },
          { id: 'properties', label: 'موڵکەکان (Properties)', icon: Building2 },
          { id: 'operations', label: 'ئۆپەراسیۆن (Operations)', icon: Wrench },
          { id: 'approvals', label: `پەسەندکردنەکان (${kpis.pendingApprovals})`, icon: CheckCircle },
          { id: 'financials', label: 'دارایی و عمولە (Finance)', icon: Wallet },
          { id: 'team', label: 'تیمی کار (Team)', icon: Users },
          { id: 'intelligence', label: 'ڕاپۆرت و AI (Intelligence)', icon: Sparkles },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer min-h-[44px] ${
                isActive 
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: HOME / OVERVIEW */}
      {activeTab === 'home' && (
        <div className="flex flex-col gap-6">
          
          {/* Welcome Greeting Area */}
          <CompanyWelcomeArea 
            userName={(user as any)?.name || (user?.email ? user.email.split('@')[0] : '')}
            location={dashboardData?.company?.address?.city || ''}
          />

          {/* Company Profile Hero Card */}
          <CompanyProfileCard 
            company={dashboardData?.company || null}
            managedCount={kpis.managedProperties}
            tenantsCount={kpis.activeTenants}
            teamCount={dashboardData?.callerMember ? 1 : 0}
            onViewProfile={() => setShowProfileModal(true)}
          />

          {/* 6 Key Performance Indicators (KPIs) */}
          <CompanyKpiGrid 
            managedProperties={kpis.managedProperties}
            activeTenants={kpis.activeTenants}
            monthlyRentManagedIqd={kpis.monthlyRentManagedIqd}
            openMaintenance={kpis.openMaintenance}
            activeListings={kpis.activeListings}
            pendingApprovals={kpis.pendingApprovals}
            onSelectKpi={handleSelectKpi}
          />

          {/* 16 Quick Actions 4x4 Grid */}
          <CompanyQuickActions 
            onActionClick={handleQuickAction}
            onSeeAll={() => setShowMoreModal(true)}
          />

          {/* Recent Activity Section */}
          <CompanyRecentActivity 
            activities={recentActivities}
            onSelectActivity={(act) => setSelectedActivity(act)}
            onViewAllActivity={() => setShowAllActivityModal(true)}
          />

          {/* Dual Panel: Urgent Alerts & AI Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Urgent Alerts Panel */}
            <div className="bg-[#0c1322] border border-slate-800 rounded-3xl p-5 shadow-xl">
              <h3 className="font-bold text-white mb-3 flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>ئاگادارییە گرنگەکان (Urgent Notifications)</span>
              </h3>
              {dashboardData?.urgentAlerts && dashboardData.urgentAlerts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {dashboardData.urgentAlerts.map(alert => (
                    <div key={alert.id} className="p-3.5 rounded-2xl bg-[#080d19] border border-slate-800 flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm font-bold text-white">{alert.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center bg-[#080d19] border border-slate-800 rounded-2xl">
                  <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm font-semibold text-slate-200">هیچ کێشەیەکی بەپەلە نییە</p>
                  <p className="text-xs text-slate-500 mt-0.5">پۆرتفۆلیۆکەت بە تەواوی ئارام و ڕێکخراوە.</p>
                </div>
              )}
            </div>

            {/* AI Advisory Panel (Strictly labeled) */}
            <div className="bg-[#0c1322] border border-slate-800 rounded-3xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white flex items-center gap-2 text-base">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <span>ڕاوێژکاری ژیری دەستکرد (AI Assistant)</span>
                </h3>
                <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Human In The Loop
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {dashboardData?.aiRecommendations && dashboardData.aiRecommendations.length > 0 ? (
                  dashboardData.aiRecommendations.map(rec => (
                    <div key={rec.id} className="p-3.5 rounded-2xl bg-[#111b2e] border border-slate-800 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">{rec.headline}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                          {rec.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{rec.details}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 p-4 text-center bg-[#080d19] border border-slate-800 rounded-2xl">
                    ڕاسپاردە پەیوەستەکان لەدوای تۆمارکردنی موڵکەکان دەردەکەون.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROPERTIES */}
      {activeTab === 'properties' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">موڵکە بەڕێوەبراوەکان (Managed Portfolio)</h2>
            <div className="text-xs text-slate-500">
              کۆمپانیا تەنها مافی بەڕێوەبردنی هەیە و نابێتە خاوەنی موڵکەکان (Ownership remains with Owners).
            </div>
          </div>

          {dashboardData?.managedProperties && dashboardData.managedProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.managedProperties.map(prop => (
                <div key={prop.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 hover:border-indigo-300 transition-all">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{prop.name}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{prop.type}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {prop.managementAgreementStatus}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">خاوەن موڵک:</span>
                        <span className="font-semibold text-slate-800">{prop.ownerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">سنووری خەرجی مۆڵەتپێدراو:</span>
                        <span className="font-semibold text-indigo-700">{prop.spendingLimit.toLocaleString()} IQD</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">کرێی بەڕێوەبردن (Management Fee):</span>
                        <span className="font-semibold text-slate-800">{prop.managementFee ? `${(Number(prop.managementFee) * 100).toFixed(1)}%` : 'دیارینەکراوە'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">مافی خاوەندارێتی:</span>
                        <span className="font-bold text-rose-600">بەڕێوەبەر (Not Owner)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setSelectedProperty(prop)}
                      className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer min-h-[44px]"
                    >
                      بینینی وردەکاری
                    </button>
                    <Link
                      to={`/properties/${prop.id}`}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-colors min-h-[44px] flex items-center justify-center"
                    >
                      پاسپۆرت
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">هیچ موڵکێک لەژێر بەڕێوەبردندا نییە</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                بۆ بەڕێوەبردنی موڵکەکان پێویستە خاوەن موڵک بانگهێشتت بکات و گرێبەستی بەڕێوەبردن (Management Agreement) لە دۆخی ACTIVE دابێت.
              </p>
              <button
                onClick={() => setShowAddAgreementModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>ناردنی داواکاری بۆ خاوەن موڵک</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OPERATIONS (TENANTS, LEASES, MAINTENANCE) */}
      {activeTab === 'operations' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <Users className="w-6 h-6 text-indigo-600 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500">کرێچییەکان</p>
              <p className="text-lg font-bold text-slate-900">{kpis.activeTenants} کەس</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <FileText className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500">گرێبەستەکان</p>
              <p className="text-lg font-bold text-slate-900">{kpis.managedProperties} کرێ</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <Wrench className="w-6 h-6 text-amber-600 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500">چاککردنەوە</p>
              <p className="text-lg font-bold text-slate-900">{kpis.openMaintenance} داواکاری</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 text-center">
              <Briefcase className="w-6 h-6 text-purple-600 mx-auto mb-1.5" />
              <p className="text-xs text-slate-500">وەستاکان (Vendors)</p>
              <p className="text-lg font-bold text-slate-900">تۆمارکراو</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 className="font-bold text-slate-900 text-base mb-2">بەڕێوەبردنی خزمەتگوزارییەکانی کڕیار و موڵک</h3>
            <p className="text-xs text-slate-500 mb-6">
              دەسەڵاتی کۆمپانیا بەپێی ڕێکارەکانی سەر ڕاستاندن (Authorization Matrix) سنوردارکراوە و سەرپێچی دەسەڵات لە سیستەمەکەدا بلۆک دەکرێت.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Link to="/workspace/maintenance" className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-800">داواکاری نوێی چاککردنەوە</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link to="/rentals" className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-800">بڵاوکردنەوە لە بازاڕی HomeHub</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
              <Link to="/workspace/company/crm" className="p-4 rounded-xl border border-slate-200 hover:border-indigo-400 transition-all flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-slate-800">بەشی پەیوەندی خاوەن موڵک (CRM)</span>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">داواکارییەکانی پەسەندکردن (Approvals Engine)</h2>
            <span className="text-xs text-slate-500">سەرووی سنووری دیاریکراو پێویستی بە ڕەزامەندی خاوەن موڵکە</span>
          </div>

          {dashboardData?.pendingApprovals && dashboardData.pendingApprovals.length > 0 ? (
            <div className="flex flex-col gap-3">
              {dashboardData.pendingApprovals.map(app => (
                <div key={app.id} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {app.type}
                      </span>
                      {app.requiresOwnerDecision && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                          بڕیاری خاوەن موڵک پێویستە
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{app.title}</h4>
                    <p className="text-xs text-slate-500">{app.description}</p>
                    <p className="text-[11px] text-slate-400">موڵک: {app.propertyName} • خاوەن موڵک: {app.ownerName}</p>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleApprovalDecision(app.id, app.type, 'APPROVE')}
                      className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors min-h-[44px] cursor-pointer"
                    >
                      پەسەندکردن
                    </button>
                    <button
                      onClick={() => handleApprovalDecision(app.id, app.type, 'REJECT')}
                      className="flex-1 sm:flex-none px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors min-h-[44px] cursor-pointer"
                    >
                      ڕەتکردنەوە
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">هیچ داواکارییەکی پەسەندکردن نییە</h3>
              <p className="text-xs text-slate-500 mt-1">هەموو نەفەقە و گرێبەستەکان لە سنووری ڕێپێدراودان.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: FINANCIALS */}
      {activeTab === 'financials' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-slate-900 text-base">{t('company.financial_overview', 'کورتەی دارایی پۆرتفۆلیۆ (Financial Overview)')}</h3>
              {renderReconciliationBadge()}
            </div>
            <p className="text-xs text-slate-500 mb-4">
              {t('company.ledger_source_desc', 'داتاکان بە شێوەیەکی فەرمی لە دەفتەری دارایی دوولایەنەی PostgreSQL وەرگیراون بەپێی تۆمارە پشتڕاستکراوەکان.')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500">{t('company.collected_rent', 'کۆی کرێی کۆکراوە (Collected Rent)')}</span>
                <p className="text-xl font-bold text-slate-900 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.collectedRentIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-emerald-600 font-medium">{t('company.confirmed_status', 'پشتڕاستکراوە')}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500">{t('company.pending_rent', 'کرێی لە چاوەڕوانیدا (Pending Rent)')}</span>
                <p className="text-xl font-bold text-slate-900 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.pendingRentIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-amber-600 font-medium">{t('company.awaiting_collection', 'لە چاوەڕوانی وەرگرتندا')}</span>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-200">
                <span className="text-xs text-indigo-700">{t('company.platform_fee', 'عمولەی پلاتفۆرم (HomeHub Platform Fee)')}</span>
                <p className="text-xl font-bold text-indigo-900 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.platformCommissionIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-indigo-600 font-medium">{t('company.canonical_policy', 'تەنها لە کرێی کۆکراوە (Only on collected rent)')}</span>
              </div>
              <div className="p-4 rounded-xl bg-cyan-50/50 border border-cyan-200" data-testid="card-company-rent-fee">
                <span className="text-xs text-cyan-800">{t('company.rent_fee', 'عمولەی کرێ (HomeHub Rent Fee)')}</span>
                <p className="text-xl font-bold text-cyan-900 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.rentFeeIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-cyan-700 font-medium">{t('company.fully_managed_only', 'تەنها لە مۆدێلی بەڕێوەبردنی تەواو (Fully Managed only)')}</span>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500">{t('company.commission_earned', 'عمولەی بەڕێوەبردنی کۆمپانیا (Company Management Fee)')}</span>
                <p className="text-xl font-bold text-slate-900 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.commissionsEarnedIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-slate-500 font-medium">{t('company.per_agreement', 'بەپێی ڕێککەوتننامەی بەڕێوەبردن')}</span>
              </div>
              <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200">
                <span className="text-xs text-rose-700">{t('company.expenses_approved', 'خەرجی پەسەندکراوی چاککردنەوە (Maintenance Expenses)')}</span>
                <p className="text-xl font-bold text-rose-700 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.expensesApprovedIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-rose-600 font-medium">{t('company.paid_to_contractors', 'تەرخانکراو بۆ وەستاکان')}</span>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
                <span className="text-xs text-emerald-800">{t('company.owner_payable', 'شایستەی ماوەی خاوەن موڵک (Net Owner Settlement Payable)')}</span>
                <p className="text-xl font-bold text-emerald-900 mt-1" dir="ltr">
                  {(dashboardData?.financialSummary.ownerSettlementPayableIqd || 0).toLocaleString()} IQD
                </p>
                <span className="text-[10px] text-emerald-700 font-medium">{t('company.post_commission_balance', 'پاش لێدەرکردنی عمولە و خەرجی پەسەندکراو')}</span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button 
                data-testid="btn-open-cash-collection"
                onClick={() => setShowCashCollectionModal(true)}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <DollarSign className="w-5 h-5" />
                Record / Confirm Cash Collection
              </button>
            </div>

            <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-0.5">{t('company.settlement_policy_title', 'ڕێسای فەرمی یەکلاکردنەوەی دارایی (Financial Settlement Invariants):')}</p>
                <ul className="list-disc list-inside space-y-1 text-amber-800">
                  <li>{t('company.settlement_rule_1', 'عمولەی پلاتفۆرم و بەڕێوەبردن تەنها لە کرێی پشتڕاستکراوە کە بە تەواوی وەرگیراوە دەبڕدرێت (0% لەسەر کرێی وەرنەگیراو یان خەرجی چاککردنەوە).')}</li>
                  <li>{t('company.settlement_rule_2', 'هیچ بارگرانییەکی زیادە (Surcharge) ناخرێتە سەر کرێچی.')}</li>
                  <li>{t('company.settlement_rule_3', 'پارەپێدانی کۆتایی بە خاوەن موڵک دەستبەجێ بەستراوەتەوە بە پشتڕاستکردنەوەی ڕەسەنی بانکی یان دەستی.')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: TEAM */}
      {activeTab === 'team' && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t('company.team_members', 'ئەندامانی تیمی کۆمپانیا (Team Members)')}</h2>
              <p className="text-xs text-slate-500">{t('company.team_desc', 'دیاریکردنی دەسەڵاتەکان بەپێی ڕۆڵی کارگێڕی (Role-Based Access Control).')}</p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 min-h-[44px] cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('company.invite_member_btn', 'بانگهێشتکردنی ئەندام')}</span>
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            {loadingMembers ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {t('company.loading_members', 'بارکردنی ئەندامانی تیم...')}
              </div>
            ) : membersList.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {membersList.map((member) => (
                  <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                        {member.role ? member.role.slice(0, 2) : 'ME'}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {member.name || member.role}
                        </p>
                        <p className="text-xs text-slate-400" dir="ltr">{member.email || member.userId}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        member.role === 'COMPANY_OWNER' ? 'bg-indigo-100 text-indigo-800' :
                        member.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {member.role}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        member.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {member.status}
                      </span>
                      {member.role !== 'COMPANY_OWNER' && (
                        <button
                          onClick={() => handleToggleMemberStatus(member.id, member.status)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
                        >
                          {member.status === 'ACTIVE' ? t('company.suspend', 'ڕاگرتن') : t('company.activate', 'چالاککردن')}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="p-4 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm">
                      {dashboardData?.callerMember?.role ? dashboardData.callerMember.role.slice(0, 2) : 'CO'}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {(user as any)?.name || (user?.email ? user.email.split('@')[0] : 'ئەندامی چالاک (Active Member)')}
                      </p>
                      <p className="text-xs text-slate-400" dir="ltr">{user?.email || 'authenticated user'}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                    {dashboardData?.callerMember?.role || 'COMPANY_OWNER'}
                  </span>
                </div>
                <div className="p-6 text-center text-slate-400 text-xs border-t border-slate-100">
                  {t('company.no_extra_members', 'هیچ ئەندامێکی تر هێشتا بانگهێشت نەکراوە. دەتوانیت لە ڕێگەی دوگمەی سەرەوە ئەندامانی تیم بانگهێشت بکەیت.')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: INTELLIGENCE & REPORTS */}
      {activeTab === 'intelligence' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base mb-1">{t('company.authoritative_reports', 'ڕاپۆرتە بەڵگەدارەکان (Authoritative Reports)')}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('company.historical_notice', 'بەپێی یاسای سیستەم: داتاکان تەنها لە تۆماری پشتڕاستکراوی پۆرتفۆلیۆ هەژمار دەکرێن، و لە کاتی نەبوونی داتا "N/A" نیشان دەدرێت.')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{t('company.occupancy_rate', 'ڕێژەی پڕبوون (Occupancy Rate)')}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t('company.occupancy_calc_desc', 'کرێچی چالاک بەرامبەر موڵکە بەڕێوەبراوەکان')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-indigo-700">
                    {kpis.managedProperties > 0
                      ? `${Math.min(100, Math.round((kpis.activeTenants / kpis.managedProperties) * 100))}%`
                      : 'N/A'}
                  </p>
                  <span className="text-[11px] text-slate-400">{kpis.activeTenants} لە {kpis.managedProperties} موڵک</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{t('company.collection_rate', 'ڕێژەی کۆکردنەوەی کرێ (Collection Rate)')}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t('company.collection_calc_desc', 'کرێی کۆکراوە بەرامبەر کۆی چاوەڕوانکراو')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {((dashboardData?.financialSummary.collectedRentIqd || 0) + (dashboardData?.financialSummary.pendingRentIqd || 0)) > 0
                      ? `${Math.round(((dashboardData?.financialSummary.collectedRentIqd || 0) / ((dashboardData?.financialSummary.collectedRentIqd || 0) + (dashboardData?.financialSummary.pendingRentIqd || 0))) * 100)}%`
                      : 'N/A'}
                  </p>
                  <span className="text-[11px] text-slate-400">{t('company.from_confirmed_ledger', 'لە دەفتەری پشتڕاستکراوە')}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{t('company.maintenance_load', 'بارگرانی چاککردنەوە (Maintenance Load)')}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{t('company.maintenance_load_desc', 'داواکارییە کراوەکان بەرامبەر خەرجی پەسەندکراو')}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">
                    {kpis.openMaintenance} {t('company.open_tickets', 'کراوە')}
                  </p>
                  <span className="text-[11px] text-slate-400">
                    {(dashboardData?.financialSummary.expensesApprovedIqd || 0).toLocaleString()} IQD پەسەندکراو
                  </span>
                </div>
              </div>
            </div>

            {/* AI Insights Display */}
            {dashboardData?.aiRecommendations && dashboardData.aiRecommendations.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-indigo-600" />
                  <span>{t('company.ai_insights_title', 'ڕێنمایی و شیکاری ژیری دەستکرد (AI Advisory & Insights)')}</span>
                </h4>
                <div className="space-y-3">
                  {dashboardData.aiRecommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 flex items-start gap-3">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-xs text-indigo-950">{rec.headline}</p>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-700">{rec.type}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">{rec.details}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-base">بانگهێشتکردنی ئەندامی نوێ</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            {inviteSuccess ? (
              <div className="p-4 text-center text-emerald-700 bg-emerald-50 rounded-xl text-sm font-semibold">
                بانگهێشتنامەکە بە سەرکەوتوویی نێردرا!
              </div>
            ) : (
              <form onSubmit={handleInviteMember} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ئیمەیڵی بەکارهێنەر</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="agent@company.iq"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ڕۆڵ لە ناو کۆمپانیا</label>
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="PROPERTY_MANAGER">بەڕێوەبەری موڵک (Property Manager)</option>
                    <option value="AGENT">بریکار (Agent)</option>
                    <option value="ACCOUNTANT">ژمێریار (Accountant)</option>
                    <option value="MAINTENANCE_MANAGER">بەڕێوەبەری چاککردنەوە (Maintenance Manager)</option>
                    <option value="VIEWER">بینەر - بێ دەسەڵاتی دەستکاری (Viewer)</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 min-h-[44px]"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 min-h-[44px]"
                  >
                    ناردنی بانگهێشت
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Property Detail Modal */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedProperty.name}</h3>
                <span className="text-xs text-rose-600 font-semibold">کۆمپانیا بەڕێوەبەرە (Not the Owner)</span>
              </div>
              <button onClick={() => setSelectedProperty(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-slate-700">
              <div className="p-3 rounded-xl bg-slate-50 flex justify-between">
                <span className="text-slate-500">خاوەن موڵک:</span>
                <span className="font-bold">{selectedProperty.ownerName}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 flex justify-between">
                <span className="text-slate-500">سنووری خەرجی مۆڵەتپێدراو:</span>
                <span className="font-bold text-indigo-700">{selectedProperty.spendingLimit.toLocaleString()} IQD</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 flex justify-between">
                <span className="text-slate-500">کرێی بەڕێوەبردن:</span>
                <span className="font-bold">{selectedProperty.managementFee ? `${(Number(selectedProperty.managementFee) * 100).toFixed(1)}%` : 'دیارینەکراوە'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block mb-1">دەسەڵاتە بەخشراوەکان لەلایەن خاوەن موڵکەوە:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedProperty.grantedPermissions.map((perm, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedProperty(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 min-h-[44px]"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modals & Drawers matching UI Design */}
      <SearchModal 
        isOpen={showSearchModal} 
        onClose={() => setShowSearchModal(false)} 
        onSelectResult={(type) => {
          if (type === 'property') setActiveTab('properties');
          else if (type === 'tenant') navigate('/workspace/company/crm');
        }}
      />

      <NotificationsDrawer 
        isOpen={showNotificationsDrawer} 
        onClose={() => setShowNotificationsDrawer(false)} 
      />

      <CompanyProfileModal 
        isOpen={showProfileModal} 
        onClose={() => setShowProfileModal(false)}
        company={dashboardData?.company || { name: 'Kurdistan Properties', status: 'VERIFIED', registrationNumber: 'KR-2024-889' }}
      />

      <AddPropertyManagementModal 
        isOpen={showAddAgreementModal} 
        onClose={() => setShowAddAgreementModal(false)} 
        onSubmitNotice={(msg) => setActionNotice(msg)}
      />

      <InviteOwnerModal 
        isOpen={showInviteOwnerModal} 
        onClose={() => setShowInviteOwnerModal(false)} 
        onSubmitNotice={(msg) => setActionNotice(msg)}
      />

      <CreateLeaseModal 
        isOpen={showCreateLeaseModal} 
        onClose={() => setShowCreateLeaseModal(false)} 
        properties={dashboardData?.managedProperties}
        onSubmitNotice={(msg) => setActionNotice(msg)}
      />

      <CreateListingModal 
        isOpen={showCreateListingModal} 
        onClose={() => setShowCreateListingModal(false)} 
        onSubmitNotice={(msg) => setActionNotice(msg)}
      />

      <VendorsModal 
        isOpen={showVendorsModal} 
        onClose={() => setShowVendorsModal(false)} 
      />

      <ReportsModal 
        isOpen={showReportsModal} 
        onClose={() => setShowReportsModal(false)} 
      />

      <DocumentsModal 
        isOpen={showDocumentsModal} 
        onClose={() => setShowDocumentsModal(false)} 
      />

      <MessagesDrawer 
        isOpen={showMessagesDrawer} 
        onClose={() => setShowMessagesDrawer(false)} 
      />

      <MoreModal 
        isOpen={showMoreModal} 
        onClose={() => setShowMoreModal(false)} 
        onSelectTab={(tab) => setActiveTab(tab)}
      />

      <ActivityDetailModal 
        isOpen={!!selectedActivity} 
        onClose={() => setSelectedActivity(null)} 
        activity={selectedActivity}
      />

      <CashCollectionModal 
        isOpen={showCashCollectionModal} 
        onClose={() => setShowCashCollectionModal(false)} 
        properties={dashboardData?.managedProperties || []}
        onSubmitNotice={(msg) => setActionNotice(msg)}
        token={token || undefined}
      />

      {/* All Activity Modal */}
      {showAllActivityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">سەرجەم چالاکییەکان (All Activities)</h3>
              <button onClick={() => setShowAllActivityModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {recentActivities.map((act) => (
                <div 
                  key={act.id} 
                  onClick={() => {
                    setShowAllActivityModal(false);
                    setSelectedActivity(act);
                  }}
                  className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">{act.title}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{act.subtitle}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{act.timestamp}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-200 text-slate-800">
                    {act.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAllActivityModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation */}
      <CompanyBottomNav 
        activeTab={activeTab === 'home' ? 'home' : activeTab === 'properties' ? 'properties' : activeTab === 'operations' ? 'operations' : 'more'}
        onTabChange={handleBottomNavSelect}
        unreadMessagesCount={0}
      />

        </div>
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
