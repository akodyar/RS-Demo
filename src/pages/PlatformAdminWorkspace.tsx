import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../components/AuthProvider';
import { AdminRoleType } from '../types';

// Admin Sub-Components
import { AdminHeader } from '../components/admin/AdminHeader';
import { AdminHero } from '../components/admin/AdminHero';
import { AdminMetricsRow } from '../components/admin/AdminMetricsRow';
import { AdminQuickActions, QuickActionKey } from '../components/admin/AdminQuickActions';
import { AdminAnalyticsSection } from '../components/admin/AdminAnalyticsSection';
import { AdminRecentActivityAndAlerts } from '../components/admin/AdminRecentActivityAndAlerts';
import { AdminBottomNav, AdminBottomNavTab } from '../components/admin/AdminBottomNav';
import { AdminMoreMenuModal } from '../components/admin/AdminMoreMenuModal';
import { AdminNotificationsModal } from '../components/admin/AdminNotificationsModal';

// Admin Operational Modules
import { AdminUsersModule } from '../components/admin/modules/AdminUsersModule';
import { AdminCompaniesModule } from '../components/admin/modules/AdminCompaniesModule';
import { AdminPropertiesModule } from '../components/admin/modules/AdminPropertiesModule';
import { AdminMarketplaceModule } from '../components/admin/modules/AdminMarketplaceModule';
import { AdminVerificationModule } from '../components/admin/modules/AdminVerificationModule';
import { AdminFinanceModule } from '../components/admin/modules/AdminFinanceModule';
import { AdminMaintenanceModule } from '../components/admin/modules/AdminMaintenanceModule';
import { AdminSecurityAiModule } from '../components/admin/modules/AdminSecurityAiModule';
import { AdminAuditModule } from '../components/admin/modules/AdminAuditModule';
import { AdminCommunicationsModule } from '../components/admin/modules/AdminCommunicationsModule';
import { AdminSettingsModule } from '../components/admin/modules/AdminSettingsModule';
import { AdminPricingModule } from '../components/admin/modules/AdminPricingModule';
import { AdminReportsModule } from '../components/admin/modules/AdminReportsModule';
import { AdminDocumentsModule } from '../components/admin/modules/AdminDocumentsModule';
import { AdminCalendarModule } from '../components/admin/modules/AdminCalendarModule';
import { AdminPromotionModerationModule } from '../components/admin/modules/AdminPromotionModerationModule';

import { useToast } from '../components/ui/Toast';
import {
  LayoutDashboard,
  Users,
  Building,
  Building2,
  ShoppingBag,
  ShieldCheck,
  Wallet,
  Wrench,
  ShieldAlert,
  FileText,
  Settings,
  Plus,
} from 'lucide-react';
import {
  AdminUserRecord,
  AdminCompanyRecord,
  AdminPropertyRecord,
  AdminMarketplaceListing,
  AdminVerificationItem,
  AdminLedgerEntry,
  AdminMaintenanceOrder,
  AdminSecurityEvent,
  AdminAiGovernanceItem,
  AdminDisputeTicket,
  AdminAuditLogItem,
} from '../types/admin';

export const PlatformAdminWorkspacePage: React.FC = () => {
  const { showToast } = useToast();
  const { direction, t } = useI18n();
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  // Role selection state (defaults to SUPER_ADMIN)
  const [currentRole, setCurrentRole] = useState<AdminRoleType>(AdminRoleType.SUPER_ADMIN);

  // Active View / Submodule: null means Dashboard main view
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // Bottom Navigation Active Tab
  const [activeNavTab, setActiveNavTab] = useState<AdminBottomNavTab>('dashboard');

  // Modals
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Live Module State (Strictly Server-Authoritative PostgreSQL backed, no mock fallbacks)
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [companies, setCompanies] = useState<AdminCompanyRecord[]>([]);
  const [properties, setProperties] = useState<AdminPropertyRecord[]>([]);
  const [marketplaceListings, setMarketplaceListings] = useState<AdminMarketplaceListing[]>([]);
  const [verifications, setVerifications] = useState<AdminVerificationItem[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<AdminLedgerEntry[]>([]);
  const [maintenanceOrders, setMaintenanceOrders] = useState<AdminMaintenanceOrder[]>([]);
  const [securityEvents, setSecurityEvents] = useState<AdminSecurityEvent[]>([]);
  const [aiGovernanceItems, setAiGovernanceItems] = useState<AdminAiGovernanceItem[]>([]);
  const [disputes, setDisputes] = useState<AdminDisputeTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);

  // Server-Authoritative Metrics & Approvals State
  const [metricsData, setMetricsData] = useState<{
    totalUsers: number;
    totalCompanies: number;
    totalProperties: number;
    totalRecords: number;
    monthlyGrowthPercentage: number | null;
    activeCriticalAlertsCount: number;
    userComposition: any[];
    pendingApprovals: any;
    recentActivities: any[];
  } | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);

  // Authorized Roles from User Identity (Server-Enforced Scope)
  const authorizedRoles: AdminRoleType[] = React.useMemo(() => {
    const userRoles = (user as any)?.roles;
    if (Array.isArray(userRoles)) {
      const valid = userRoles.filter((r: any) =>
        Object.values(AdminRoleType).includes(r as AdminRoleType)
      ) as AdminRoleType[];
      if (valid.length > 0) return valid;
    }
    return [AdminRoleType.SUPER_ADMIN];
  }, [user]);

  // Fetch Authoritative Audit Logs from Server
  const refreshAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setAuditLogs(data.logs);
        }
      }
    } catch (e) {
      console.warn('Could not sync audit logs from server:', e);
    }
  };

  // Fetch initial data from server routes
  useEffect(() => {
    let isMounted = true;
    const loadServerData = async () => {
      try {
        setIsMetricsLoading(true);
        const headers = { Authorization: `Bearer ${token}` };
        const [
          metricsRes,
          usersRes,
          companiesRes,
          propsRes,
          marketRes,
          verifRes,
          ledgerRes,
          maintRes,
          secRes,
          aiRes,
          disputesRes,
          auditRes,
        ] = await Promise.allSettled([
          fetch('/api/admin/metrics', { headers }),
          fetch('/api/admin/users', { headers }),
          fetch('/api/admin/companies', { headers }),
          fetch('/api/admin/properties', { headers }),
          fetch('/api/admin/marketplace', { headers }),
          fetch('/api/admin/verifications', { headers }),
          fetch('/api/admin/finance/ledger', { headers }),
          fetch('/api/admin/maintenance', { headers }),
          fetch('/api/admin/security-events', { headers }),
          fetch('/api/admin/ai-governance', { headers }),
          fetch('/api/admin/disputes', { headers }),
          fetch('/api/admin/audit-logs', { headers }),
        ]);

        if (!isMounted) return;

        if (metricsRes.status === 'fulfilled' && metricsRes.value.ok) {
          const data = await metricsRes.value.json();
          if (data.status === 'ok' && data.metrics) {
            setMetricsData(data.metrics);
            setUnreadNotifications(data.metrics.activeCriticalAlertsCount || 0);
          }
        }
        if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
          const data = await usersRes.value.json();
          if (Array.isArray(data.users)) setUsers(data.users);
        }
        if (companiesRes.status === 'fulfilled' && companiesRes.value.ok) {
          const data = await companiesRes.value.json();
          if (Array.isArray(data.companies)) setCompanies(data.companies);
        }
        if (propsRes.status === 'fulfilled' && propsRes.value.ok) {
          const data = await propsRes.value.json();
          if (Array.isArray(data.properties)) setProperties(data.properties);
        }
        if (marketRes.status === 'fulfilled' && marketRes.value.ok) {
          const data = await marketRes.value.json();
          if (Array.isArray(data.listings)) setMarketplaceListings(data.listings);
        }
        if (verifRes.status === 'fulfilled' && verifRes.value.ok) {
          const data = await verifRes.value.json();
          if (Array.isArray(data.items)) setVerifications(data.items);
        }
        if (ledgerRes.status === 'fulfilled' && ledgerRes.value.ok) {
          const data = await ledgerRes.value.json();
          if (Array.isArray(data.ledger)) setLedgerEntries(data.ledger);
        }
        if (maintRes.status === 'fulfilled' && maintRes.value.ok) {
          const data = await maintRes.value.json();
          if (Array.isArray(data.orders)) setMaintenanceOrders(data.orders);
        }
        if (secRes.status === 'fulfilled' && secRes.value.ok) {
          const data = await secRes.value.json();
          if (Array.isArray(data.events)) setSecurityEvents(data.events);
        }
        if (aiRes.status === 'fulfilled' && aiRes.value.ok) {
          const data = await aiRes.value.json();
          if (Array.isArray(data.items)) setAiGovernanceItems(data.items);
        }
        if (disputesRes.status === 'fulfilled' && disputesRes.value.ok) {
          const data = await disputesRes.value.json();
          if (Array.isArray(data.disputes)) setDisputes(data.disputes);
        }
        if (auditRes.status === 'fulfilled' && auditRes.value.ok) {
          const data = await auditRes.value.json();
          if (Array.isArray(data.logs)) setAuditLogs(data.logs);
        }
      } catch (e) {
        console.error('Backend admin fetch error (fail-closed, no mock fallbacks):', e);
      } finally {
        if (isMounted) setIsMetricsLoading(false);
      }
    };

    loadServerData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // ==========================================
  // SERVER-AUTHORITATIVE MUTATION HANDLERS
  // ==========================================

  // 1. User Status Mutation
  const handleUpdateUserStatus = async (userId: string, newStatus: any, reason: string) => {
    const prevUsers = [...users];
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));

    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus, reason }),
      });

      if (!res.ok) {
        const err = await res.json();
        setUsers(prevUsers);
        showToast(err.message || 'Error updating user status.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error updating user status:', e);
    }
  };

  // 2. User Role Mutation
  const handleUpdateUserRole = async (userId: string, newRole: any) => {
    const prevUsers = [...users];
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        const err = await res.json();
        setUsers(prevUsers);
        showToast(err.message || 'Error updating user role.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error updating user role:', e);
    }
  };

  // 3. Company Verification & Status Mutation
  const handleUpdateCompanyStatus = async (companyId: string, status: any, reason: string) => {
    const prevCompanies = [...companies];
    setCompanies((prev) => prev.map((c) => (c.id === companyId ? { ...c, status } : c)));

    try {
      const res = await fetch(`/api/admin/companies/${companyId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status, reason }),
      });

      if (!res.ok) {
        const err = await res.json();
        setCompanies(prevCompanies);
        showToast(err.message || 'Error updating company status.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error updating company status:', e);
    }
  };

  // 4. Property Tapu Deed Verification Mutation
  const handleUpdateTapuStatus = async (propertyId: string, tapuStatus: any, reason: string) => {
    const prevProps = [...properties];
    setProperties((prev) => prev.map((p) => (p.id === propertyId ? { ...p, tapuStatus } : p)));

    try {
      const res = await fetch(`/api/admin/properties/${propertyId}/tapu-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tapuStatus, reason }),
      });

      if (!res.ok) {
        const err = await res.json();
        setProperties(prevProps);
        showToast(err.message || 'Error updating tapu status.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error updating tapu status:', e);
    }
  };

  // 5. Marketplace Listing Moderation
  const handleUpdateListingStatus = async (listingId: string, status: any) => {
    const prevListings = [...marketplaceListings];
    setMarketplaceListings((prev) => prev.map((l) => (l.id === listingId ? { ...l, status } : l)));

    try {
      const res = await fetch(`/api/admin/marketplace/${listingId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMarketplaceListings(prevListings);
        showToast(err.message || 'Error updating marketplace listing.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error updating marketplace listing:', e);
    }
  };

  // 6. Verification Decision
  const handleDecideVerification = async (itemId: string, decision: 'VERIFIED' | 'REJECTED', reason: string) => {
    const prevVerifs = [...verifications];
    setVerifications((prev) => prev.map((v) => (v.id === itemId ? { ...v, status: decision } : v)));

    try {
      const res = await fetch(`/api/admin/verifications/${itemId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision, reason }),
      });

      if (!res.ok) {
        const err = await res.json();
        setVerifications(prevVerifs);
        showToast(err.message || 'Error deciding verification.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error deciding verification:', e);
    }
  };

  // 7. Maintenance Order Mutation
  const handleUpdateMaintenanceOrder = async (orderId: string, status: any) => {
    const prevOrders = [...maintenanceOrders];
    setMaintenanceOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));

    try {
      const res = await fetch(`/api/admin/maintenance/${orderId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const err = await res.json();
        setMaintenanceOrders(prevOrders);
        showToast(err.message || 'Error updating maintenance order.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error updating maintenance order:', e);
    }
  };

  // 8. Security Incident Mitigation
  const handleMitigateSecurityEvent = async (eventId: string, actionTaken: string) => {
    const prevEvents = [...securityEvents];
    setSecurityEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: 'BLOCKED' } : e)));

    try {
      const res = await fetch(`/api/admin/security-events/${eventId}/mitigate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ actionTaken }),
      });

      if (!res.ok) {
        const err = await res.json();
        setSecurityEvents(prevEvents);
        showToast(err.message || 'Error mitigating security event.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error mitigating security event:', e);
    }
  };

  // 9. Dispute Resolution
  const handleResolveDispute = async (ticketId: string, resolution: string) => {
    const prevDisputes = [...disputes];
    setDisputes((prev) =>
      prev.map((d) => (d.id === ticketId ? { ...d, status: 'RESOLVED', resolution } : d))
    );

    try {
      const res = await fetch(`/api/admin/disputes/${ticketId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resolution }),
      });

      if (!res.ok) {
        const err = await res.json();
        setDisputes(prevDisputes);
        showToast(err.message || 'Error resolving dispute.', 'error');
        return;
      }
      await refreshAuditLogs();
    } catch (e) {
      console.warn('Network error resolving dispute:', e);
    }
  };

  // 10. Broadcast System Message
  const handleSendBroadcast = async (title: string, message: string) => {
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, message }),
      });

      if (!res.ok) {
        const err = await res.json();
        showToast(err.message || 'Error broadcasting message.', 'error');
        return;
      }
      await refreshAuditLogs();
      showToast('Broadcast message queued and logged.', 'info');
    } catch (e) {
      console.warn('Network error broadcasting message:', e);
    }
  };

  // ==========================================
  // NAVIGATION HANDLERS
  // ==========================================
  const handleSelectNavTab = (tab: AdminBottomNavTab) => {
    setActiveNavTab(tab);
    if (tab === 'dashboard') {
      setActiveModule(null);
    } else if (tab === 'messages') {
      setActiveModule('messages');
    } else if (tab === 'calendar') {
      setActiveModule('calendar');
    } else if (tab === 'reports') {
      setActiveModule('reports');
    } else if (tab === 'more') {
      setIsMoreMenuOpen(true);
    }
  };

  const handleQuickAction = (key: QuickActionKey) => {
    setActiveModule(key);
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/admin/login');
  };

  const getModuleTitle = (mod: string | null) => {
    switch (mod) {
      case null: return direction === 'rtl' ? 'داشبۆردی سەرەکی' : 'Main Dashboard';
      case 'users': return direction === 'rtl' ? 'بەڕێوەبردنی بەکارهێنەران' : 'Users Management';
      case 'companies': return direction === 'rtl' ? 'کۆمپانیاکانی بەڕێوەبردن' : 'Management Companies';
      case 'properties': return direction === 'rtl' ? 'سەند و پشکنینی موڵک' : 'Properties & Tapu';
      case 'marketplace': return direction === 'rtl' ? 'بازاڕی موڵک' : 'Marketplace Listings';
      case 'verification': return direction === 'rtl' ? 'متمانە و بەڵگەنامەکان' : 'Trust & Verifications';
      case 'finance': return direction === 'rtl' ? 'دارایی و 3-Fee Model' : 'Finance & Fee Governance';
      case 'maintenance': return direction === 'rtl' ? 'چاکسازی و وەستاکان' : 'Maintenance & Work Orders';
      case 'security': return direction === 'rtl' ? 'ئاسایش و ژیری دەستکرد' : 'Security & AI Governance';
      case 'audit': return direction === 'rtl' ? 'تۆماری گشتی چاودێری' : 'Immutable Audit Logs';
      case 'settings': return direction === 'rtl' ? 'ڕێکخستنەکانی سیستەم' : 'System Settings';
      default: return mod;
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row pb-20 ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Platform Admin Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveModule(null)}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Admin Dashboard"
            aria-label="HomeHub Admin Dashboard"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Admin Navigation"
          >
            {/* Dashboard */}
            <button
              type="button"
              onClick={() => setActiveModule(null)}
              title="Dashboard"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === null
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === null && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <LayoutDashboard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === null ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'داشبۆرد' : 'Overview'}
              </span>
            </button>

            {/* Users */}
            <button
              type="button"
              id="admin-tab-users"
              data-testid="admin-tab-users"
              onClick={() => setActiveModule('users')}
              title="Users"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'users'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'users' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Users className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'users' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'بەکارهێنەر' : 'Users'}
              </span>
            </button>

            {/* Companies */}
            <button
              type="button"
              id="admin-tab-companies"
              data-testid="admin-tab-companies"
              onClick={() => setActiveModule('companies')}
              title="Companies"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'companies'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'companies' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Building className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'companies' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'کۆمپانیا' : 'Companies'}
              </span>
            </button>

            {/* Properties */}
            <button
              type="button"
              id="admin-tab-properties"
              data-testid="admin-tab-properties"
              onClick={() => setActiveModule('properties')}
              title="Properties"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'properties'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'properties' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Building2 className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'properties' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'موڵک' : 'Properties'}
              </span>
            </button>

            {/* Marketplace */}
            <button
              type="button"
              id="admin-tab-marketplace"
              data-testid="admin-tab-marketplace"
              onClick={() => setActiveModule('marketplace')}
              title="Marketplace"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'marketplace'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'marketplace' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <ShoppingBag className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'marketplace' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'بازاڕ' : 'Market'}
              </span>
            </button>

            {/* Verification */}
            <button
              type="button"
              id="admin-tab-verification"
              data-testid="admin-tab-verification"
              onClick={() => setActiveModule('verification')}
              title="Verifications"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'verification'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'verification' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <ShieldCheck className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'verification' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'متمانە' : 'Trust'}
              </span>
              {verifications.filter((v) => v.status === 'PENDING').length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {verifications.filter((v) => v.status === 'PENDING').length}
                </span>
              )}
            </button>

            {/* Finance */}
            <button
              type="button"
              onClick={() => setActiveModule('finance')}
              title="Finance"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'finance'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'finance' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wallet className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'finance' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'دارایی' : 'Finance'}
              </span>
            </button>

            {/* Maintenance */}
            <button
              type="button"
              onClick={() => setActiveModule('maintenance')}
              title="Maintenance"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'maintenance'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'maintenance' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wrench className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'maintenance' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'چاکسازی' : 'Repairs'}
              </span>
            </button>

            {/* Security */}
            <button
              type="button"
              onClick={() => setActiveModule('security')}
              title="Security & AI"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'security'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'security' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <ShieldAlert className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'security' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'ئاسایش' : 'Security'}
              </span>
            </button>

            {/* Audit */}
            <button
              type="button"
              onClick={() => setActiveModule('audit')}
              title="Audit Logs"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'audit'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'audit' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'audit' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'چاودێری' : 'Audit'}
              </span>
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => setActiveModule('settings')}
              title="Settings"
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeModule === 'settings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeModule === 'settings' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Settings className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeModule === 'settings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {direction === 'rtl' ? 'ڕێکخستن' : 'Settings'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Open Settings */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setActiveModule('settings')}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="System Settings"
            aria-label="System Settings"
          >
            <Settings className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 1. Header with HomeHub logo, language switcher, notification bell, and RBAC switcher */}
        <AdminHeader
          currentRole={currentRole}
          activeModuleTitle={getModuleTitle(activeModule)}
          authorizedRoles={authorizedRoles}
          onSelectRole={setCurrentRole}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          unreadNotificationsCount={unreadNotifications}
          onSignOut={handleSignOut}
          onOpenSettings={() => setActiveModule('settings')}
        />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto py-2">
        {/* =========================================
            SUBMODULE SCREENS
           ========================================= */}
        {activeModule === 'users' && (
          <div className="p-4">
            <AdminUsersModule
              users={users}
              currentRole={currentRole}
              onUpdateUserStatus={handleUpdateUserStatus}
              onUpdateUserRole={handleUpdateUserRole}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'companies' && (
          <div className="p-4">
            <AdminCompaniesModule
              companies={companies}
              currentRole={currentRole}
              onUpdateCompanyStatus={handleUpdateCompanyStatus}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'properties' && (
          <div className="p-4">
            <AdminPropertiesModule
              properties={properties}
              currentRole={currentRole}
              onUpdateTapuStatus={handleUpdateTapuStatus}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'marketplace' && (
          <div className="p-4">
            <AdminMarketplaceModule
              listings={marketplaceListings}
              currentRole={currentRole}
              onUpdateListingStatus={handleUpdateListingStatus}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'verification' && (
          <div className="p-4">
            <AdminVerificationModule
              items={verifications}
              currentRole={currentRole}
              onDecideVerification={handleDecideVerification}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'finance' && (
          <div className="p-4">
            <AdminFinanceModule
              ledgerEntries={ledgerEntries}
              currentRole={currentRole}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'maintenance' && (
          <div className="p-4">
            <AdminMaintenanceModule
              orders={maintenanceOrders}
              currentRole={currentRole}
              onUpdateOrderStatus={handleUpdateMaintenanceOrder}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'security' && (
          <div className="p-4">
            <AdminSecurityAiModule
              securityEvents={securityEvents}
              aiGovernanceItems={aiGovernanceItems}
              currentRole={currentRole}
              onMitigateSecurityEvent={handleMitigateSecurityEvent}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'audit' && (
          <div className="p-4">
            <AdminAuditModule
              auditLogs={auditLogs}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'pricing' && (
          <div className="p-4" dir={direction}>
            <div className="mb-4">
              <button
                data-testid="admin-pricing-back-btn"
                onClick={() => setActiveModule(null)}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors cursor-pointer"
              >
                <span>{direction === 'rtl' ? '→' : '←'}</span>
                <span>{t('pricing.back_to_dashboard', 'Back to Dashboard')}</span>
              </button>
            </div>
            <AdminPricingModule />
          </div>
        )}

        {activeModule === 'promotions' && (
          <div className="p-4">
            <AdminPromotionModerationModule
              currentRole={currentRole}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'messages' && (
          <div className="p-4">
            <AdminCommunicationsModule
              disputes={disputes}
              currentRole={currentRole}
              onResolveDispute={handleResolveDispute}
              onSendBroadcast={handleSendBroadcast}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'settings' && (
          <div className="p-4">
            <AdminSettingsModule
              currentRole={currentRole}
              onBack={() => setActiveModule(null)}
            />
          </div>
        )}

        {activeModule === 'reports' && (
          <div className="p-4">
            <AdminReportsModule onBack={() => setActiveModule(null)} />
          </div>
        )}

        {activeModule === 'documents' && (
          <div className="p-4">
            <AdminDocumentsModule onBack={() => setActiveModule(null)} />
          </div>
        )}

        {activeModule === 'calendar' && (
          <div className="p-4">
            <AdminCalendarModule onBack={() => setActiveModule(null)} />
          </div>
        )}

        {/* =========================================
            MAIN DASHBOARD (When activeModule is null)
           ========================================= */}
        {!activeModule && (() => {
          const authTotalUsers = metricsData?.totalUsers ?? users.length;
          const authTotalCompanies = metricsData?.totalCompanies ?? companies.length;
          const authTotalProperties = metricsData?.totalProperties ?? properties.length;
          const authTotalRecords = metricsData?.totalRecords ?? (auditLogs.length + ledgerEntries.length + maintenanceOrders.length);
          const authCriticalAlerts = metricsData?.activeCriticalAlertsCount ?? (
            securityEvents.filter((e) => e.status !== 'BLOCKED' && e.status !== 'RESOLVED' && e.status !== 'MITIGATED').length +
            maintenanceOrders.filter((m) => m.urgency === 'CRITICAL' && m.status !== 'COMPLETED').length +
            disputes.filter((d) => d.status === 'OPEN').length
          );

          const dynamicComposition = metricsData?.userComposition || (() => {
            const roleCounts: Record<string, number> = {};
            users.forEach((u) => {
              const r = u.role || 'OTHER';
              roleCounts[r] = (roleCounts[r] || 0) + 1;
            });
            return Object.entries(roleCounts).map(([roleKey, count]) => ({
              roleKey,
              count,
              percent: users.length > 0 ? Math.round((count / users.length) * 100) : 0,
            }));
          })();

          const dynamicActivities = metricsData?.recentActivities || auditLogs.slice(0, 5).map((l) => ({
            id: l.id,
            title: l.action,
            entity: l.targetEntity || l.resourceType || 'سیستەم',
            targetId: l.targetId || l.resourceId,
            time: l.timestamp || 'ئەمڕۆ',
            module: l.targetEntity ? l.targetEntity.toLowerCase() : 'audit',
            details: l.details,
          }));

          const dynamicApprovals = metricsData?.pendingApprovals || {
            propertyVerifications: properties.filter((p) => p.tapuStatus === 'PENDING_VERIFICATION').length,
            companyVerifications: companies.filter((c) => c.status === 'pending').length,
            newListings: marketplaceListings.filter((l) => l.status === 'PENDING_REVIEW').length,
            userVerifications: verifications.filter((v) => v.status === 'PENDING').length,
            financialApprovals: ledgerEntries.filter((l) => l.status === 'RECORDED').length,
            disputeCases: disputes.filter((d) => d.status === 'OPEN').length,
            promotionCampaigns: 0,
          };

          return (
            <div className="space-y-1">
              {/* 1. Hero Section matching reference image */}
              <AdminHero
                adminName={(user as any)?.name || user?.email}
                criticalIssuesCount={authCriticalAlerts}
                onViewIssues={() => setActiveModule('messages')}
              />

              {/* 2. 4 Top Metric Cards (Authoritative server data) */}
              <AdminMetricsRow
                totalUsers={authTotalUsers}
                totalCompanies={authTotalCompanies}
                totalProperties={authTotalProperties}
                totalRecords={authTotalRecords}
                isLoading={isMetricsLoading}
                onSelectMetric={(key) => {
                  if (key === 'users') setActiveModule('users');
                  if (key === 'companies') setActiveModule('companies');
                  if (key === 'properties') setActiveModule('properties');
                  if (key === 'records') setActiveModule('audit');
                }}
              />

              {/* 3. Quick Actions Grid (12 action tiles in 2 rows of 6 matching reference image) */}
              <AdminQuickActions
                onSelectAction={handleQuickAction}
                onViewAll={() => setIsMoreMenuOpen(true)}
              />

              {/* 4. User Growth & User Distribution Analytics Section */}
              <AdminAnalyticsSection
                totalUsers={authTotalUsers}
                monthlyGrowthPercent={metricsData?.monthlyGrowthPercentage ?? null}
                compositionData={dynamicComposition}
                onOpenUserGrowth={() => setActiveModule('reports')}
                onFilterUserRole={(role) => setActiveModule('users')}
              />

              {/* 5. Recent Activity & Pending Approvals matching reference image */}
              <AdminRecentActivityAndAlerts
                activities={dynamicActivities}
                pendingApprovals={dynamicApprovals}
                isLoading={isMetricsLoading}
                onViewAllActivity={() => setActiveModule('audit')}
                onViewAllAlerts={() => setActiveModule('verification')}
                onSelectAction={(mod) => setActiveModule(mod)}
              />
            </div>
          );
        })()}
      </main>

      {/* Bottom Navigation Bar (5 tabs matching reference image) */}
      <AdminBottomNav
        activeTab={activeNavTab}
        onSelectTab={handleSelectNavTab}
        unreadMessagesCount={unreadMessages}
      />

      {/* More Modules Modal */}
      <AdminMoreMenuModal
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        onSelectModule={(key) => {
          setActiveModule(key);
          setIsMoreMenuOpen(false);
        }}
        onSignOut={handleSignOut}
      />

      {/* Admin Notification Center Modal */}
      <AdminNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateModule={(modKey) => {
          setActiveModule(modKey);
          setIsNotificationsOpen(false);
        }}
        onUpdateUnreadCount={setUnreadNotifications}
      />
      </div>
    </div>
  );
};
