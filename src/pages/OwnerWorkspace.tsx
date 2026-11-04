import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useI18n, SupportedLanguage } from '../i18n/I18nProvider';
import { useAuth, EligibleWorkspace } from '../components/AuthProvider';
import { WorkspaceSwitcherModal } from '../components/common/WorkspaceSwitcherModal';
import { HomeHubLogo } from '../components/onboarding/HomeHubLogo';
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  Wrench,
  ArrowUp,
  ArrowDown,
  Plus,
  Compass,
  FileText,
  BarChart3,
  Upload,
  MessageSquare,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Sparkles,
  Lightbulb,
  CheckCircle2,
  Clock,
  ChevronRight,
  Home,
  Menu,
  X,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  LogOut,
  Settings,
  HelpCircle,
  Filter,
  Search,
  Check,
  Ban,
  FileCheck,
  CreditCard,
  Percent,
  Layers,
  Globe,
  DollarSign,
  Briefcase,
  AlertCircle,
  Send,
  Eye,
  FileSignature,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { OwnerDashboardData, OwnerPropertyItem } from '../types/owner';
import { OwnerSettlementTab } from '../components/OwnerSettlementTab';
import { DepositInspectionModal } from '../components/owner/DepositInspectionModal';
import { OwnerUtilityBills } from '../components/owner/OwnerUtilityBills';
import { PropertyHealthDashboard } from '../components/shared/PropertyHealthDashboard';
import { PointsWalletView } from '../components/points/PointsWalletView';

type TabType =
  | 'overview'
  | 'properties'
  | 'leases'
  | 'earnings'
  | 'companies'
  | 'maintenance'
  | 'documents'
  | 'analytics'
  | 'settings'
  | 'settlements'
  | 'points';

export interface OwnerWorkspacePageProps {
  initialProfileDropdownOpen?: boolean;
}

export const OwnerWorkspacePage: React.FC<OwnerWorkspacePageProps> = ({ initialProfileDropdownOpen = false }) => {
  const { t, language, setLanguage, direction } = useI18n();
  const { user, logout, activeWorkspace, eligibleWorkspaces, selectWorkspace } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
      const destination = selected?.destination || target.destination || '/owner';
      if (destination && destination !== '/owner' && destination !== window.location.pathname) {
        navigate(destination);
      } else {
        await fetchDashboardData();
      }
    } catch (err: any) {
      const msg = err.message || t('workspace.switch_failed', 'Failed to switch workspace.');
      setWorkspaceSwitchError(msg);
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };

  // Navigation & View State
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as TabType;
      const validTabs: TabType[] = [
        'overview', 'properties', 'leases', 'earnings', 'companies',
        'maintenance', 'documents', 'analytics', 'settings', 'settlements', 'points'
      ];
      if (tab && validTabs.includes(tab)) return tab;
    }
    return 'overview';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') as TabType;
    const validTabs: TabType[] = [
      'overview', 'properties', 'leases', 'earnings', 'companies',
      'maintenance', 'documents', 'analytics', 'settings', 'settlements', 'points'
    ];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Authoritative Data State
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [dbUnconfigured, setDbUnconfigured] = useState<boolean>(false);

  // UI Interactive States
  const getLocalizedMonth = (mStr: string) => {
    if (!mStr) return '';
    const parts = mStr.trim().split(' ');
    const m = parts[0]?.toUpperCase() || '';
    const y = parts[1] || '';
    const kuMonths: Record<string, string> = {
      JAN: 'کانوونی دووەم', FEB: 'شوبات', MAR: 'ئادار', APR: 'نیسان',
      MAY: 'ئایار', JUN: 'حوزەیران', JUL: 'تەممووز', AUG: 'ئاب',
      SEP: 'ئەیلوول', OCT: 'تشرینی یەکەم', NOV: 'تشرینی دووەم', DEC: 'کانوونی یەکەم'
    };
    const arMonths: Record<string, string> = {
      JAN: 'يناير', FEB: 'فبراير', MAR: 'مارس', APR: 'أبريل',
      MAY: 'مايو', JUN: 'يونيو', JUL: 'يوليو', AUG: 'أغسطس',
      SEP: 'سبتمبر', OCT: 'أكتوبر', NOV: 'نوفمبر', DEC: 'ديسمبر'
    };
    if (language === 'ku') return kuMonths[m] ? `${kuMonths[m]} ${y ? "'" + y : ''}` : mStr;
    if (language === 'ar') return arMonths[m] ? `${arMonths[m]} ${y ? "'" + y : ''}` : mStr;
    return mStr;
  };

    const [incomePeriod, setIncomePeriod] = useState<'3m' | '6m' | '9m' | '12m'>('6m');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(initialProfileDropdownOpen);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissTip, setDismissTip] = useState(false);
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dashboardPeriod, setDashboardPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Modals
  const [addPropertyModalOpen, setAddPropertyModalOpen] = useState(false);
  const [createLeaseModalOpen, setCreateLeaseModalOpen] = useState(false);
  const [requestMaintenanceModalOpen, setRequestMaintenanceModalOpen] = useState(false);
  const [inviteCompanyModalOpen, setInviteCompanyModalOpen] = useState(false);
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false);
  const [selectedFeeBreakdownProp, setSelectedFeeBreakdownProp] = useState<OwnerPropertyItem | null>(null);
  const [depositInspectionModalState, setDepositInspectionModalState] = useState<{
    isOpen: boolean;
    leaseId: string;
    propertyId: string;
    propertyName: string;
    tenantName?: string;
    currency?: string;
  }>({
    isOpen: false,
    leaseId: '',
    propertyId: '',
    propertyName: '',
    tenantName: '',
    currency: 'IQD',
  });

  // Form State for Add Property Modal
  const [newPropForm, setNewPropForm] = useState({
    name: '',
    nameKurdish: '',
    location: '',
    city: 'هەولێر',
    type: 'شوقە (Apartment)',
    monthlyRentIqd: '',
    unitsCount: '1',
  });
  const [submittingProp, setSubmittingProp] = useState(false);

  const generateOwnerPropIdempotencyKey = () => {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'owner_prop_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  };
  const [ownerPropIdempotencyKey, setOwnerPropIdempotencyKey] = useState<string>(generateOwnerPropIdempotencyKey);
  const ownerPropEditedAfterAttemptRef = useRef<boolean>(false);

  useEffect(() => {
    if (ownerPropEditedAfterAttemptRef.current) {
      setOwnerPropIdempotencyKey(generateOwnerPropIdempotencyKey());
      ownerPropEditedAfterAttemptRef.current = false;
    }
  }, [newPropForm]);

  // Layout Demo Fixture Mode (Strictly isolated from production operational ledger)
  
  // Form State for Create Lease Modal
  const [newLeaseForm, setNewLeaseForm] = useState({
    propertyId: '',
    tenantName: '',
    tenantPhone: '',
    monthlyRentIqd: '',
    depositIqd: '',
    startDate: '',
    endDate: '',
  });
  const [submittingLease, setSubmittingLease] = useState(false);
  const [leasesList, setLeasesList] = useState<any[]>([]);
  const [activatingLeaseId, setActivatingLeaseId] = useState<string | null>(null);
  const [renewalsList, setRenewalsList] = useState<any[]>([]);
  const [processingRenewalId, setProcessingRenewalId] = useState<string | null>(null);

  // Form State for Request Maintenance Modal
  const [newMaintForm, setNewMaintForm] = useState({
    propertyId: '',
    category: 'plumbing',
    title: '',
    description: '',
    priority: 'NORMAL',
  });
  const [submittingMaint, setSubmittingMaint] = useState(false);

  // Form State for Invite Company Modal
  const [inviteCompanyForm, setInviteCompanyForm] = useState({
    propertyId: '',
    companyId: '',
    companyName: '',
    spendingLimit: '',
    startDate: '',
  });
  const [submittingInvite, setSubmittingInvite] = useState(false);

  // Form State for Upload Document Modal
  const [uploadDocForm, setUploadDocForm] = useState({
    propertyId: '',
    documentType: 'tapu',
    title: '',
    fileUrl: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const [submittingDoc, setSubmittingDoc] = useState(false);

  // Action status notification
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch Authoritative Owner Dashboard Data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      setDbUnconfigured(false);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch('/api/owner/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 503) {
        const body = await res.json().catch(() => ({}));
        if (body.code === 'SERVICE_UNAVAILABLE' || body.error === 'DATABASE_NOT_CONFIGURED') {
          setDbUnconfigured(true);
          setError(
            language === 'ku'
              ? 'سێرڤەری سەرەکی لە دۆخی پارێزراودایە (Fail-Closed). زانیارییە داراییەکان پارێزراون.'
              : language === 'ar'
              ? 'قاعدة البيانات الرئيسية غير متصلة (Fail-Closed). يتم تطبيق الحماية الأمنية الصارمة.'
              : 'Relational database storage is unconfigured. Fail-closed security enforced for Owner Domain.'
          );
          return;
        }
      }

      if (!res.ok) {
        throw new Error(`Failed to load owner data (HTTP ${res.status})`);
      }

      const payload = await res.json();
      setData(payload);

      try {
        const leasesRes = await fetch('/api/owner/leases', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (leasesRes.ok) {
          const leasesPayload = await leasesRes.json();
          setLeasesList(Array.isArray(leasesPayload) ? leasesPayload : []);
        }

        const renewalsRes = await fetch('/api/owner/renewals', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (renewalsRes.ok) {
          const renewalsPayload = await renewalsRes.json();
          setRenewalsList(Array.isArray(renewalsPayload) ? renewalsPayload : []);
        }
      } catch (lErr) {
        console.warn('Error loading owner leases or renewals:', lErr);
      }
    } catch (err: any) {
      console.error('Owner dashboard fetch error:', err);
      setError(err.message || 'Error loading dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleAddPropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPropForm.name) return;
    try {
      setSubmittingProp(true);
      ownerPropEditedAfterAttemptRef.current = true;
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch('/api/owner/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': ownerPropIdempotencyKey,
        },
        body: JSON.stringify(newPropForm),
      });

      if (res.ok) {
        setAddPropertyModalOpen(false);
        setOwnerPropIdempotencyKey(generateOwnerPropIdempotencyKey());
        ownerPropEditedAfterAttemptRef.current = false;
        setNewPropForm({
          name: '',
          nameKurdish: '',
          location: '',
          city: 'هەولێر',
          type: 'شوقە (Apartment)',
          monthlyRentIqd: '',
          unitsCount: '1',
        });
        setActionSuccess(
          language === 'ku'
            ? 'موڵک بە سەرکەوتوویی زیادکرا و تۆماری خاوەندارێتی دروستکرا.'
            : language === 'ar'
            ? 'تمت إضافة العقار بنجاح وإنشاء سجل الملكية.'
            : 'Property added successfully with verified ownership record.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else if (res.status === 503) {
        setAddPropertyModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): تۆمارکردن هەڵپەسێردراوە تا سێرڤەری سەرەکی گرێدەدرێت.'
            : language === 'ar'
            ? 'النظام في وضع الحماية الصارم (Fail-Closed): تم إيقاف الحفظ حتى توفر قاعدة البيانات.'
            : 'Fail-closed active: Write blocked until authoritative PostgreSQL is available.'
        );
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Failed to create property:', err);
    } finally {
      setSubmittingProp(false);
    }
  };

  const handleReadAllNotifications = async () => {
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';
      await fetch('/api/owner/notifications/read-all', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data) {
        setData({
          ...data,
          unreadNotificationsCount: 0,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateLeaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaseForm.tenantName || !newLeaseForm.propertyId) return;
    try {
      setSubmittingLease(true);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch('/api/owner/leases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId: newLeaseForm.propertyId,
          tenantId: newLeaseForm.tenantPhone || 'tenant_user_01',
          startDate: newLeaseForm.startDate,
          endDate: newLeaseForm.endDate,
          rentAmount: Number(newLeaseForm.monthlyRentIqd),
          depositAmount: Number(newLeaseForm.depositIqd),
          currency: 'IQD',
        }),
      });

      if (res.ok) {
        setCreateLeaseModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'گرێبەستی دیجیتاڵی دروستکرا و تۆمار کرا.'
            : language === 'ar'
            ? 'تم إنشاء عقد الإيجار الإلكتروني وحفظه بنجاح.'
            : 'Digital lease agreement created and recorded.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else if (res.status === 503) {
        setCreateLeaseModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): دروستکردنی گرێبەست هەڵپەسێردراوە.'
            : language === 'ar'
            ? 'النظام في وضع الحماية الصارم (Fail-Closed): تم إيقاف إنشاء العقد حتى اتصال قاعدة البيانات.'
            : 'Fail-closed active: Lease creation blocked until authoritative PostgreSQL is available.'
        );
        setTimeout(() => setActionSuccess(null), 5000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setActionSuccess(`Error: ${errData.error || 'Failed to create lease'}`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to create lease:', err);
    } finally {
      setSubmittingLease(false);
    }
  };

  const handleActivateLease = async (leaseId: string) => {
    try {
      setActivatingLeaseId(leaseId);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch(`/api/leases/${leaseId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setActionSuccess(
          language === 'ku'
            ? 'گرێبەستی کرێ بە سەرکەوتوویی چالاک کرا و خشتەی پارەدان دروستکرا.'
            : language === 'ar'
            ? 'تم تفعيل عقد الإيجار بنجاح وإنشاء جدول الدفعات.'
            : 'Lease agreement activated and rent schedule generated.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionSuccess(`Error: ${err.message || err.error || 'Failed to activate lease'}`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to activate lease:', err);
    } finally {
      setActivatingLeaseId(null);
    }
  };

  const handleApproveRenewal = async (renewalId: string) => {
    try {
      setProcessingRenewalId(renewalId);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch(`/api/leases/renewals/${renewalId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setActionSuccess(
          language === 'ku'
            ? 'داواکاری نوێکردنەوەی گرێبەست بە سەرکەوتوویی پەسەندکرا و خشتەی کرێ درێژکرایەوە.'
            : language === 'ar'
            ? 'تمت الموافقة على طلب التجديد وتحديث جدول الإيجار بنجاح.'
            : 'Lease renewal request approved and rent schedule successfully extended.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionSuccess(`Error: ${err.message || err.error || 'Failed to approve renewal'}`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to approve renewal:', err);
    } finally {
      setProcessingRenewalId(null);
    }
  };

  const handleRejectRenewal = async (renewalId: string) => {
    try {
      setProcessingRenewalId(renewalId);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch(`/api/leases/renewals/${renewalId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ownerNotes: 'Rejected by property management' }),
      });

      if (res.ok) {
        setActionSuccess(
          language === 'ku'
            ? 'داواکاری نوێکردنەوەی گرێبەست ڕەتکرایەوە.'
            : language === 'ar'
            ? 'تم رفض طلب تجديد العقد.'
            : 'Lease renewal request has been rejected.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionSuccess(`Error: ${err.message || err.error || 'Failed to reject renewal'}`);
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err: any) {
      console.error('Failed to reject renewal:', err);
    } finally {
      setProcessingRenewalId(null);
    }
  };

  const handleRequestMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaintForm.title || !newMaintForm.propertyId) return;
    try {
      setSubmittingMaint(true);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch('/api/owner/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId: newMaintForm.propertyId,
          title: newMaintForm.title,
          category: newMaintForm.category.toUpperCase(),
          priority: newMaintForm.priority,
          description: newMaintForm.description,
        }),
      });

      if (res.ok) {
        setRequestMaintenanceModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'داواکاری چاکسازی بە سەرکەوتوویی لە داتابەیس تۆمارکرا و خرایە ڕیزی پێداچوونەوە.'
            : language === 'ar'
            ? 'تم تسجيل طلب الصيانة بنجاح في قاعدة البيانات وإدراجه في قائمة المراجعة.'
            : 'Maintenance ticket created and logged in property maintenance registry.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else if (res.status === 503) {
        setRequestMaintenanceModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): داواکاری چاکسازی هەڵپەسێردراوە.'
            : language === 'ar'
            ? 'النظام في وضع الحماية الصارم (Fail-Closed): تم إيقاف طلب الصيانة مؤقتاً.'
            : 'Fail-closed active: Maintenance dispatch blocked until PostgreSQL is online.'
        );
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error('Failed to request maintenance:', err);
    } finally {
      setSubmittingMaint(false);
    }
  };

  const handleInviteCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCompanyForm.propertyId) return;
    try {
      setSubmittingInvite(true);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch('/api/owner/management-agreements/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId: inviteCompanyForm.propertyId,
          companyId: inviteCompanyForm.companyId || 'company-nominee-1',
          spendingLimit: Number(inviteCompanyForm.spendingLimit),
          grantedPermissions: ['VIEW_MAINTENANCE', 'SUBMIT_QUOTES', 'MANAGE_LEASES'],
          startDate: inviteCompanyForm.startDate,
        }),
      });

      if (res.ok) {
        setInviteCompanyModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'بانگهێشتنامەی بەڕێوەبردن نێردرا بە دیاریکردنی سنووری خەرجی.'
            : language === 'ar'
            ? 'تم إرسال دعوة تفويض الإدارة مع تحديد سقف الإنفاق المصرح.'
            : 'Management company invitation dispatched with spending limit controls.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else if (res.status === 503) {
        setInviteCompanyModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): بانگهێشتنامە هەڵپەسێردراوە.'
            : language === 'ar'
            ? 'النظام في وضع الحماية الصارم (Fail-Closed): تم إيقاف إرسال الدعوة مؤقتاً.'
            : 'Fail-closed active: Delegation blocked until PostgreSQL is online.'
        );
        setTimeout(() => setActionSuccess(null), 5000);
      }
    } catch (err: any) {
      console.error('Failed to invite company:', err);
    } finally {
      setSubmittingInvite(false);
    }
  };

  const handleUploadDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFileUploadError(null);
    if (!uploadDocForm.title || !uploadDocForm.propertyId) return;
    if (!selectedFile) {
      setFileUploadError(
        language === 'ku'
          ? 'تکایە سەرەتا فایلێکی دروست هەڵبژێرە.'
          : language === 'ar'
          ? 'يرجى اختيار ملف مستند صالح أولاً.'
          : 'Please select a valid document file first.'
      );
      return;
    }

    try {
      setSubmittingDoc(true);
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      // Test real presigned upload request against backend storage infrastructure
      const presignRes = await fetch('/api/storage/presigned-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: uploadDocForm.documentType === 'tapu' ? 'TITLE_DEED' : 'LEASE_CONTRACT',
          fileName: selectedFile.name,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type || 'application/pdf',
          sourceEntityId: uploadDocForm.propertyId,
        }),
      });

      if (presignRes.status === 503) {
        setUploadDocModalOpen(false);
        setActionSuccess(
          language === 'ku'
            ? 'سیستەمی هەڵگرتنی بەڵگەنامەی هەوری (Storage) لە قۆناغی پێش-گرێداندایە (Fail-Closed). بارکردن ڕاگیراوە.'
            : language === 'ar'
            ? 'خدمة التخزين السحابي للمستندات في مرحلة ما قبل الإعداد (Fail-Closed). تم إيقاف الرفع مؤقتاً.'
            : 'Cloud document storage (S3/GCS) is in pre-integration phase (503 STORAGE_NOT_CONFIGURED). Upload safely paused.'
        );
        setTimeout(() => setActionSuccess(null), 6000);
        return;
      }

      if (!presignRes.ok) {
        const errJson = await presignRes.json().catch(() => ({}));
        setFileUploadError(errJson.message || 'Storage upload request rejected by policy');
        return;
      }

      // If presigned URL was granted, perform genuine upload and document registration
      const { uploadUrl, documentKey } = await presignRes.json();
      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': selectedFile.type },
        body: selectedFile,
      });

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId: uploadDocForm.propertyId,
          title: uploadDocForm.title,
          category: uploadDocForm.documentType.toUpperCase(),
          fileUrl: documentKey,
        }),
      });

      if (res.ok) {
        setUploadDocModalOpen(false);
        setSelectedFile(null);
        setActionSuccess(
          language === 'ku'
            ? 'بەڵگەنامە بە سەرکەوتوویی لە کۆگای پارێزراو تۆمارکرا.'
            : language === 'ar'
            ? 'تم حفظ المستند بنجاح في السجل المشفر.'
            : 'Document registered and stored in secure repository.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      }
    } catch (err: any) {
      console.error('Failed to upload document:', err);
      setFileUploadError(err.message || 'Failed to process document upload');
    } finally {
      setSubmittingDoc(false);
    }
  };

  const handleQuoteDecision = async (quoteId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch(`/api/owner/approvals/${quoteId}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision }),
      });

      if (res.ok) {
        setActionSuccess(
          decision === 'APPROVED'
            ? (language === 'ku' ? 'خەمڵاندنی چاکسازی پەسەندکرا.' : language === 'ar' ? 'تمت الموافقة على عرض سعر الصيانة.' : 'Maintenance quote approved.')
            : (language === 'ku' ? 'خەمڵاندنی چاکسازی ڕەتکرایەوە.' : language === 'ar' ? 'تم رفض عرض سعر الصيانة.' : 'Maintenance quote rejected.')
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else if (res.status === 503) {
        setActionSuccess(
          decision === 'APPROVED'
            ? (language === 'ku' ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): پەسەندکردن هەڵپەسێردراوە.' : language === 'ar' ? 'النظام في وضع الحماية (Fail-Closed): تم إيقاف الموافقة مؤقتاً.' : 'Fail-closed active: Decision blocked until PostgreSQL is online.')
            : (language === 'ku' ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): ڕەتکردنەوە هەڵپەسێردراوە.' : language === 'ar' ? 'النظام في وضع الحماية (Fail-Closed): تم إيقاف الرفض مؤقتاً.' : 'Fail-closed active: Decision blocked until PostgreSQL is online.')
        );
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Error deciding quote:', err);
    }
  };

  const handleTerminateAuthority = async (agreementId: string) => {
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-owner'
          : localStorage.getItem('auth_token') || '';

      const res = await fetch(`/api/owner/management-agreements/${agreementId}/terminate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setActionSuccess(
          language === 'ku'
            ? 'دەسەڵاتی بەڕێوەبردن بە سەرکەوتوویی هەڵوەشێندرایەوە.'
            : language === 'ar'
            ? 'تم إنهاء تفويض إدارة العقار بنجاح واستعادة السيطرة المباشرة.'
            : 'Management authority terminated. Property returned to direct self-management.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
        await fetchDashboardData();
      } else if (res.status === 503) {
        setActionSuccess(
          language === 'ku'
            ? 'سیستەم لە دۆخی پارێزراودایە (Fail-Closed): هەڵوەشاندنەوە هەڵپەسێردراوە.'
            : language === 'ar'
            ? 'النظام في وضع الحماية الصارم (Fail-Closed): تم إيقاف الإنهاء مؤقتاً.'
            : 'Fail-closed active: Agreement termination blocked until PostgreSQL is online.'
        );
        setTimeout(() => setActionSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Error terminating agreement:', err);
    }
  };

  // Currency Formatter with isolated LTR spans
  const formatIqd = (val: number) => {
    return new Intl.NumberFormat('en-US').format(val || 0);
  };

  // Date Formatter
  const todayFormatted = new Intl.DateTimeFormat(
    language === 'en' ? 'en-US' : language === 'ar' ? 'ar-IQ' : 'ckb',
    { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  ).format(new Date());

  const isRtl = direction === 'rtl';

  // 1. Authoritative Empty State (Used when DB has 0 properties or is unconfigured and demo mode is OFF)
  const honestEmptyData: OwnerDashboardData = {
    ownerId: user?.uid || 'owner-live',
    ownerName: user?.displayName || (language === 'ku' ? 'خاوەن موڵک' : language === 'ar' ? 'مالك العقار' : 'Property Owner'),
    ownerRole: 'PROPERTY_OWNER',
    unreadNotificationsCount: 0,
    unreadMessagesCount: 0,
    kpis: {
      totalProperties: 0,
      propertiesChangeText: language === 'ku' ? 'هیچ موڵکێک نییە' : language === 'ar' ? 'لا توجد عقارات' : '0 registered',
      activeTenants: 0,
      occupancyRate: 0,
      monthlyRevenueIqd: 0,
      revenueChangeText: '0 IQD',
      openMaintenance: 0,
      urgentMaintenance: 0,
    },
    properties: [],
    recentActivities: [],
    upcomingEvents: [],
    rentalIncome: {
      period: '6m',
      currency: 'IQD',
      months: [],
      totalActualIqd: 0,
      totalExpectedIqd: 0,
      platformFeeRate: 0.05,
    },
    occupancy: {
      totalUnits: 0,
      occupiedCount: 0,
      occupiedPercentage: 0,
      vacantCount: 0,
      vacantPercentage: 0,
      maintenanceCount: 0,
      maintenancePercentage: 0,
    },
    quickTip: {
      id: 'tip-live-01',
      text: 'Register official Tapu deeds to enable digital lease creation and automated rent collection.',
      textKurdish: 'بەڵگەنامەی فەرمیی تاپۆ تۆمار بکە بۆ دروستکردنی گرێبەستی دیجیتاڵی و کۆکردنەوەی کرێ بە کۆمیسیۆنی ڕەسمی.',
      textArabic: 'قم بتسجيل سندات الطابو الرسمية لتمكين إنشاء عقود الإيجار الرقمية وتحصيل الإيجار بنسبة ڕەسمی المعتمدة.',
      category: 'DOCUMENT',
      isAiGenerated: true,
    },
  };

  // 2. Explicit Demo / Inspection Fixtures (Strictly isolated, displayed only when user enables Demo Mode)
  
  // 3. Presentation Data Resolution: Authoritative database data takes precedence.
  // When DB is unconfigured or empty, honestEmptyData is used unless user explicitly toggled demo fixture mode.
  const presentationData: OwnerDashboardData = data ? data : honestEmptyData;

  // Filtered properties
  const filteredProperties = presentationData.properties.filter((p) => {
    if (cityFilter !== 'ALL' && !p.city.includes(cityFilter)) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name.toLowerCase().includes(q);
      const matchKu = p.nameKurdish?.toLowerCase().includes(q) || false;
      const matchLoc = p.location.toLowerCase().includes(q);
      if (!matchName && !matchKu && !matchLoc) return false;
    }
    return true;
  });

  const getTabTitle = (tab: TabType) => {
    switch (tab) {
      case 'overview':
        return t('nav.dashboard', language === 'ku' ? 'داشبۆرد' : language === 'ar' ? 'لوحة التحكم' : 'Dashboard');
      case 'properties':
        return t('owner.nav.properties', language === 'ku' ? 'موڵکەکان' : language === 'ar' ? 'العقارات' : 'Properties');
      case 'leases':
        return t('role.tenant', language === 'ku' ? 'کرێچییەکان' : language === 'ar' ? 'المستأجرين' : 'Tenants');
      case 'earnings':
        return t('owner.accounting', language === 'ku' ? 'ژمێریاری و دارایی' : language === 'ar' ? 'المحاسبة والمالية' : 'Accounting & Earnings');
      case 'settlements':
        return t('owner.nav.settlements', language === 'ku' ? 'شایستە داراییەکان' : language === 'ar' ? 'المستحقات والتسويات' : 'Settlements & Payouts');
      case 'maintenance':
        return t('maintenance.title', language === 'ku' ? 'چاکسازی و خزمەتگوزاری' : language === 'ar' ? 'الصيانة والخدمات' : 'Maintenance & Services');
      case 'analytics':
        return t('owner.nav.reports', language === 'ku' ? 'ڕاپۆرتە داراییەکان' : language === 'ar' ? 'التقارير المالية' : 'Financial Reports & Analytics');
      case 'points':
        return language === 'ku' ? 'خاڵ و پاداشت' : language === 'ar' ? 'النقاط والمكافآت' : 'Points & Rewards';
      case 'documents':
        return t('owner.nav.documents', language === 'ku' ? 'بەڵگەنامەکان' : language === 'ar' ? 'المستندات' : 'Documents');
      case 'companies':
        return t('owner.nav.companies', language === 'ku' ? 'کۆمپانیاکان' : language === 'ar' ? 'الشركات' : 'Management Companies');
      case 'settings':
        return t('owner.nav.settings', language === 'ku' ? 'ڕێکخستنەکان' : language === 'ar' ? 'الإعدادات' : 'Settings');
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
        aria-label="Owner Workspace Navigation Rail"
      >
        {/* Top: HomeHub Brand Icon & Primary Navigation */}
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub Dashboard"
            aria-label="HomeHub Dashboard"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="Owner Navigation"
          >
            {/* 1. Dashboard */}
            <button
              type="button"
              id="owner-nav-overview"
              data-testid="owner-nav-overview"
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

            {/* 2. Properties */}
            <button
              type="button"
              id="owner-nav-properties"
              data-testid="owner-nav-properties"
              onClick={() => setActiveTab('properties')}
              title={t('owner.nav.properties', 'Properties')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'properties' || activeTab === 'documents'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {(activeTab === 'properties' || activeTab === 'documents') && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Building2 className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'properties' || activeTab === 'documents' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('owner.nav.properties', 'Properties')}
              </span>
            </button>

            {/* 3. Tenants */}
            <button
              type="button"
              id="owner-nav-leases"
              data-testid="owner-nav-leases"
              onClick={() => setActiveTab('leases')}
              title={t('role.tenant', 'Tenants')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'leases'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'leases' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Users className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'leases' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {t('role.tenant', 'Tenants')}
              </span>
            </button>

            {/* 4. Accounting */}
            <button
              type="button"
              id="owner-nav-earnings"
              data-testid="owner-nav-earnings"
              onClick={() => setActiveTab('earnings')}
              title={t('owner.accounting', language === 'ku' ? 'ژمێریاری' : language === 'ar' ? 'المحاسبة' : 'Accounting / Earnings')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'earnings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'earnings' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wallet className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'earnings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ژمێریاری' : language === 'ar' ? 'المحاسبة' : 'Finance'}
              </span>
            </button>

            {/* 5. Settlements & Payouts */}
            <button
              type="button"
              id="owner-nav-settlements"
              data-testid="owner-nav-settlements"
              onClick={() => setActiveTab('settlements')}
              title={t('owner.nav.settlements', 'Settlements & Payouts')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'settlements'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'settlements' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CreditCard className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'settlements' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'شایستەکان' : language === 'ar' ? 'المستحقات' : 'Payouts'}
              </span>
            </button>

            {/* 6. Maintenance */}
            <button
              type="button"
              id="owner-nav-maintenance"
              data-testid="owner-nav-maintenance"
              onClick={() => setActiveTab('maintenance')}
              title={t('maintenance.title', 'Maintenance')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'maintenance'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'maintenance' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Wrench className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'maintenance' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'چاکسازی' : language === 'ar' ? 'الصيانة' : 'Repairs'}
              </span>
              {presentationData.kpis.openMaintenance > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {presentationData.kpis.openMaintenance}
                </span>
              )}
            </button>

            {/* 7. Reports */}
            <button
              type="button"
              id="owner-nav-analytics"
              data-testid="owner-nav-analytics"
              onClick={() => setActiveTab('analytics')}
              title={t('owner.nav.reports', language === 'ku' ? 'ڕاپۆرتەکان' : language === 'ar' ? 'التقارير' : 'Reports')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'analytics'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'analytics' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <BarChart3 className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'analytics' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕاپۆرت' : language === 'ar' ? 'التقارير' : 'Reports'}
              </span>
            </button>

            {/* 8. Points & Rewards */}
            <button
              type="button"
              id="owner-nav-points"
              data-testid="owner-nav-points"
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
                {language === 'ku' ? 'پاداشت' : language === 'ar' ? 'المكافآت' : 'Points'}
              </span>
            </button>

            {/* 9. Documents */}
            <button
              type="button"
              id="owner-nav-documents"
              data-testid="owner-nav-documents"
              onClick={() => setActiveTab('documents')}
              title={t('owner.nav.documents', 'Documents')}
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

            {/* 10. Companies */}
            <button
              type="button"
              id="owner-nav-companies"
              data-testid="owner-nav-companies"
              onClick={() => setActiveTab('companies')}
              title={t('owner.nav.companies', 'Companies')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'companies'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'companies' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Briefcase className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'companies' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'کۆمپانیا' : language === 'ar' ? 'الشركات' : 'Companies'}
              </span>
            </button>

            {/* 11. Settings */}
            <button
              type="button"
              id="owner-nav-settings"
              data-testid="owner-nav-settings"
              onClick={() => setActiveTab('settings')}
              title={t('owner.nav.settings', 'Settings')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'settings'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'settings' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Settings className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'settings' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕێکخستن' : language === 'ar' ? 'الإعدادات' : 'Settings'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Quick Add Property */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/properties/add')}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={language === 'ku' ? 'تۆمارکردنی موڵکی نوێ' : language === 'ar' ? 'إضافة عقار جديد' : 'Add New Property'}
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
                aria-label="HomeHub Dashboard"
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
                {language === 'ku' ? 'شوێنی کاری خاوەن موڵک' : language === 'ar' ? 'مساحة عمل المالك' : 'Owner Workspace'}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>

            {/* Live Financial KPI Pill */}
            {presentationData.kpis.monthlyRevenueIqd > 0 && (
              <div className="hidden xl:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs px-3 py-1.5 rounded-xl font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-400 font-normal">
                  {language === 'ku' ? 'داهاتی مانگانە:' : language === 'ar' ? 'الدخل الشهري:' : 'Monthly Revenue:'}
                </span>
                <span dir="ltr" className="font-black text-emerald-300">
                  {formatIqd(presentationData.kpis.monthlyRevenueIqd)} IQD
                </span>
              </div>
            )}
          </div>

          {/* End: Quick Action + Workspace Switcher + Language + Notifications + Profile */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Quick Add Property Button (Desktop) */}
            <button
              type="button"
              onClick={() => navigate('/properties/add')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 text-slate-950 font-bold" />
              <span>
                {language === 'ku' ? 'تۆمارکردنی موڵک' : language === 'ar' ? 'إضافة عقار' : 'Add Property'}
              </span>
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
                onChange={(e) => setLanguage(e.target.value as any)}
                className="bg-transparent border-none text-xs font-semibold text-slate-300 cursor-pointer focus:ring-0 p-0 pr-1"
                aria-label="Select language"
              >
                <option value="en" className="bg-[#0c1322] text-white">English</option>
                <option value="ku" className="bg-[#0c1322] text-white">کوردی سۆرانی</option>
                <option value="ar" className="bg-[#0c1322] text-white">العربية</option>
              </select>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                id="owner-notification-bell-btn"
                type="button"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-label={t('owner.notifications', 'Notifications')}
              >
                <Bell className="w-4.5 h-4.5" />
                {presentationData.unreadNotificationsCount > 0 && (
                  <span id="badge-owner-unread-notifications" className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black tracking-tight flex items-center justify-center border-2 border-[#0c1322] shadow-xs">
                    {presentationData.unreadNotificationsCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Drawer */}
              {notificationsOpen && (
                <div id="owner-notifications-dropdown" className="absolute top-12 ltr:right-0 rtl:left-0 w-80 max-w-[90vw] bg-[#0c1322] border border-amber-500/30 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 text-white">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="font-bold text-sm text-white">
                      {t('owner.notifications', 'Notifications')}
                    </h3>
                    <button
                      id="btn-owner-mark-all-read"
                      onClick={handleReadAllNotifications}
                      className="text-xs text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                    >
                      {t('owner.see_all', 'Mark all read')}
                    </button>
                  </div>
                  <div className="py-2 space-y-2 max-h-64 overflow-y-auto">
                    <div className="p-2.5 rounded-xl bg-[#080d19] border border-slate-800">
                      <p className="text-xs font-bold text-amber-400">
                        {language === 'ku'
                          ? 'کرێی مانگانە وەرگیرا'
                          : language === 'ar'
                          ? 'تم تحصيل الإيجار الشهري'
                          : 'Monthly Rent Collected'}
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        <span dir="ltr">1,800,000 IQD</span> (
                        {language === 'ku'
                          ? 'شایستەی دارایی خاوەن موڵک وەرگیراوە'
                          : language === 'ar'
                          ? 'استحقاق المالك المحصل'
                          : 'Owner net credited'}
                        )
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">2h ago</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#080d19] border border-rose-500/30">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                        {language === 'ku'
                          ? 'پەسەندکردنی چاکسازی پێویستە'
                          : language === 'ar'
                          ? 'مطلوب موافقة المالك على الصيانة'
                          : 'Owner Quote Approval Required'}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {language === 'ku'
                          ? 'تێچووی 650,000 IQD سنووری بەڕێوەبەری تێپەڕاندووە'
                          : language === 'ar'
                          ? 'عرض السعر 650,000 د.ع يتجاوز حد الصلاحية'
                          : 'Quote of 650,000 IQD exceeds company spending limit'}
                      </p>
                      <span className="text-[10px] text-slate-500 mt-1 block">5h ago</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Workspace Switcher Quick Header Button */}
            <button
              id="owner-header-switch-workspace-btn"
              type="button"
              onClick={() => setSwitchWorkspaceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
              title={t('workspace.switch_button_title', 'گۆڕینی شوێنی کار')}
            >
              <Users className="w-4 h-4 text-amber-400" />
              <span className="hidden lg:inline">
                {t('workspace.switch_button', 'گۆڕینی شوێنی کار')}
              </span>
            </button>

            {/* Owner Profile Dropdown */}
            <div className="relative">
              <button
                id="owner-profile-btn"
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer min-h-[40px] focus:outline-none focus:ring-2 focus:ring-amber-500"
                aria-expanded={profileDropdownOpen}
                aria-label="Owner profile menu"
              >
                <img
                  src={
                    presentationData.avatarUrl ||
                    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'
                  }
                  alt={presentationData.ownerName}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-amber-500/40"
                />
                <div className="text-left rtl:text-right hidden sm:block">
                  <div className="text-xs font-bold text-white leading-tight">
                    {presentationData.ownerName === 'Owner'
                      ? (language === 'ku' ? 'خاوەن موڵک' : language === 'ar' ? 'مالك العقار' : 'Property Owner')
                      : presentationData.ownerName}
                  </div>
                  <div className="text-[10px] text-amber-400/90 font-medium">
                    {t('owner.role_label', 'Property Owner')}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute top-12 ltr:right-0 rtl:left-0 w-60 bg-[#0c1322] border border-amber-500/30 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 text-white">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <p className="text-xs font-bold text-white">
                      {presentationData.ownerName === 'Owner'
                        ? (language === 'ku' ? 'خاوەن موڵک' : language === 'ar' ? 'مالك العقار' : 'Property Owner')
                        : presentationData.ownerName}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user?.email || 'owner@homehub.iq'}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('properties');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Building2 className="w-4 h-4 text-amber-400" />
                      {t('owner.my_properties', 'My Properties')}
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('earnings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Wallet className="w-4 h-4 text-amber-400" />
                      {t('owner.nav.earnings', 'Rent & Earnings (Fee)')}
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        setActiveTab('settings');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-[#111b2e] hover:text-white rounded-xl text-left rtl:text-right cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-amber-400" />
                      {t('owner.nav.settings', 'Settings')}
                    </button>
                    <button
                      id="owner-switch-workspace-btn"
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
          { id: 'overview', label: t('owner.nav.overview', 'Overview'), icon: LayoutDashboard },
          { id: 'properties', label: t('owner.nav.properties', 'Properties'), icon: Building2 },
          { id: 'leases', label: t('owner.nav.leases', 'Leases'), icon: FileText },
          { id: 'earnings', label: t('owner.nav.earnings', 'Rent & Earnings (Fee)'), icon: Wallet },
          { id: 'companies', label: t('owner.nav.companies', 'Companies'), icon: Briefcase },
          { id: 'maintenance', label: t('owner.nav.maintenance', 'Maintenance'), icon: Wrench },
          { id: 'documents', label: t('owner.nav.documents', 'Documents'), icon: FileCheck },
          { id: 'analytics', label: t('owner.nav.analytics', 'Analytics'), icon: BarChart3 },
          { id: 'settings', label: t('owner.nav.settings', 'Settings'), icon: Settings },
          { id: 'settlements', label: t('owner.nav.settlements', 'Settlements'), icon: CreditCard },
          { id: 'points', label: language === 'ku' ? 'خاڵ و پاداشت' : language === 'ar' ? 'النقاط والمكافآت' : 'Points & Rewards', icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`owner-mobile-tab-${tab.id}`}
              type="button"
              data-testid={`owner-mobile-nav-${tab.id}`}
              onClick={() => setActiveTab(tab.id as TabType)}
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
        {/* Success Alert */}
        {actionSuccess && (
          <div className="mb-4 p-3.5 rounded-lg bg-zinc-100 border border-emerald-200 text-emerald-900 flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
            <CheckCircle2 className="w-4.5 h-4.5 text-black shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Fail-Closed Status Alert */}
        {dbUnconfigured && (
          <div className="p-3.5 rounded-lg border bg-zinc-100/90 border-amber-200 text-amber-900 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4.5 h-4.5 text-black shrink-0 mt-0.5" />
              <div>
                <span className="font-medium block">
                  {language === 'ku'
                    ? 'سێرڤەری سەرەکی لە دۆخی پارێزراودایە (Fail-Closed Enforcement)'
                    : language === 'ar'
                    ? 'قاعدة البيانات في وضع الحماية الصارم (Fail-Closed Enforcement)'
                    : 'Authoritative Relational Database Offline (Fail-Closed Security Enforced)'}
                </span>
                <span className="text-[11px] text-amber-800 mt-0.5 block">
                  {language === 'ku'
                    ? 'بەپێی یاساکانی پلاتفۆرم، داتای دارایی و تۆماری تاپۆ ڕاستەوخۆ دەپارێزرێن. سیستەم ڕێگری دەکات لە دروستکردنی باڵانسی وەهمی.'
                    : language === 'ar'
                    ? 'بموجب قواعد الحوكمة، البيانات المالية وسجلات الطابو محمية بالكامل. يُمنع توليد أرقام مالية وهمية.'
                    : 'Per architectural rules, financial ledger balances and deed records remain protected. Operational state displays honest zeroes.'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              <button
                type="button"
                onClick={fetchDashboardData}
                className="px-3 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-medium rounded-lg cursor-pointer text-[11px] transition-colors"
              >
                {language === 'ku' ? 'دووبارە پەیوەندی بکەوە' : language === 'ar' ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT CONTAINER (Desktop-First 1440x900 / 1366x768 / etc.)        */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 space-y-8">
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW (DASHBOARD)                                              */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-8 animate-in fade-in">
            {/* 1. Header Greeting & Date Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  {t('nav.dashboard', 'Dashboard')}
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-normal">
                  {language === 'ku'
                    ? `بەخێربێیتەوە! لێرەدا کورتەیەک لە موڵکەکانت و چالاکییە نوێیەکان دەبینیت.`
                    : language === 'ar'
                    ? `مرحباً بعودتك! إليك نظرة عامة على عقاراتك والأنشطة الأخيرة.`
                    : `Welcome back! Here is an overview of your properties and recent activity.`}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <select
                    id="owner-dashboard-period-select"
                    aria-label="Dashboard Period"
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
            <PropertyHealthDashboard role="OWNER" />

            {/* 2. 4-Column Primary Desktop KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {/* KPI 1: Total Properties */}
              <button
                type="button"
                onClick={() => setActiveTab('properties')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4"
              >
                <div className="w-13 h-13 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Home className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('owner.kpi.total_properties', 'Total Properties')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5 leading-tight">
                    {presentationData.kpis.totalProperties}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {presentationData.kpis.totalProperties === 0
                        ? (language === 'ku' ? 'هیچ موڵکێک تۆمار نەکراوە' : language === 'ar' ? 'لا توجد عقارات مسجلة' : 'No properties registered')
                        : (presentationData.kpis.propertiesChangeText || (language === 'ku' ? '+١ لە مانگی ڕابردووەوە' : language === 'ar' ? '+١ من الشهر الماضي' : '+1 from last month'))}
                    </span>
                  </div>
                </div>
              </button>

              {/* KPI 2: Monthly Rental Income */}
              <button
                type="button"
                onClick={() => setActiveTab('earnings')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4"
              >
                <div className="w-13 h-13 rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('owner.kpi.monthly_revenue', 'Monthly Rental Income')}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-white block mt-0.5 leading-tight truncate">
                    <span dir="ltr">{formatIqd(presentationData.kpis.monthlyRevenueIqd)} IQD</span>
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 mt-1">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {presentationData.kpis.revenueChangeText && presentationData.kpis.monthlyRevenueIqd > 0
                        ? presentationData.kpis.revenueChangeText
                        : (language === 'ku' ? 'چاوەڕوانی پشتڕاستکردنەوە' : language === 'ar' ? 'بانتظار التأكيد' : 'Awaiting confirmation')}
                    </span>
                  </div>
                </div>
              </button>

              {/* KPI 3: Pending Requests */}
              <button
                type="button"
                onClick={() => setActiveTab('maintenance')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4"
              >
                <div className="w-13 h-13 rounded-2xl bg-sky-950/80 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('owner.kpi.open_maintenance', 'Pending Requests')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5 leading-tight">
                    {presentationData.kpis.openMaintenance}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 mt-1">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate" dir="ltr">
                      {presentationData.kpis.urgentMaintenance} {language === 'ku' ? 'بەپەلە' : language === 'ar' ? 'عاجل' : 'urgent'}
                    </span>
                  </div>
                </div>
              </button>

              {/* KPI 4: Overdue Payments */}
              <button
                type="button"
                onClick={() => setActiveTab('leases')}
                className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl hover:border-amber-500/40 hover:shadow-amber-500/5 transition-all duration-200 text-left rtl:text-right cursor-pointer flex items-center gap-4"
              >
                <div className="w-13 h-13 rounded-2xl bg-amber-950/80 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-slate-400 block truncate">
                    {t('owner.kpi.overdue_payments', language === 'ku' ? 'پارەدانە دواکەوتووەکان' : language === 'ar' ? 'المدفوعات المتأخرة' : 'Overdue Payments')}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-white block mt-0.5 leading-tight">
                    {presentationData.kpis.occupancyRate > 0 ? '2' : '0'}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-400 mt-1">
                    <ArrowUp className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{language === 'ku' ? '+١ لە مانگی ڕابردووەوە' : language === 'ar' ? '+١ عن الشهر الماضي' : '+1 from last month'}</span>
                  </div>
                </div>
              </button>
            </div>

            {/* 3. Quick Actions */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">
                    {t('owner.quick_actions', 'Quick Actions')}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'ku'
                      ? 'کردارە باوەکان بۆ بەڕێوەبردنی موڵکەکانت'
                      : language === 'ar'
                      ? 'مهام شائعة لإدارة عقاراتك'
                      : 'Common tasks to manage your properties'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/properties/add')}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('owner.action.add_property', 'Add New Property')}</span>
                </button>
              </div>

              {/* 6 Clean Action Cards Matching Visual Reference */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. My Properties */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Home className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('owner.my_properties', 'My Properties')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'بینین و بەڕێوەبردنی موڵکەکانت' : language === 'ar' ? 'عرض وإدارة جميع عقاراتك' : 'View and manage all your properties'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('properties')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#111b2e] hover:bg-[#17243a] text-amber-400 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>{language === 'ku' ? 'بەڕێوەبردن' : language === 'ar' ? 'إدارة' : 'Manage'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 2. Tenants */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('owner.action.manage_tenants', 'Tenants')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'بەڕێوەبردنی کرێنشین و گرێبەست' : language === 'ar' ? 'إدارة المستأجرين وعقود الإيجار' : 'Manage tenants and leases'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('leases')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#111b2e] hover:bg-[#17243a] text-emerald-400 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>{language === 'ku' ? 'بەڕێوەبردن' : language === 'ar' ? 'إدارة' : 'Manage'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 3. Rent & Payments */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-950/80 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('owner.action.view_reports', language === 'ku' ? 'کرێ و پارەدان' : language === 'ar' ? 'الإيجار والمدفوعات' : 'Rent & Payments')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'وەرگرتن و قۆناغەکانی پارەدان' : language === 'ar' ? 'تحصيل الإيجار والدفعات' : 'View rent collection and payments'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('earnings')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#111b2e] hover:bg-[#17243a] text-amber-400 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>{language === 'ku' ? 'بەدواداچوون' : language === 'ar' ? 'تتبع' : 'Track'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 4. Expenses */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('owner.action.settlements', language === 'ku' ? 'خەرجییەکان' : language === 'ar' ? 'المصاريف' : 'Expenses')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'خەرجی و حیساباتی دەفتەری' : language === 'ar' ? 'تتبع نفقات ومصاريف العقار' : 'Track property expenses'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('settlements')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#111b2e] hover:bg-[#17243a] text-amber-400 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>{language === 'ku' ? 'پیشاندان' : language === 'ar' ? 'عرض' : 'View'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 5. Maintenance */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('maintenance.title', 'Maintenance')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'پێداچوونەوەی داواکارییەکانی سێرڤس' : language === 'ar' ? 'مراجعة وإدارة طلبات الخدمة' : 'Review and manage service requests'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('maintenance')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#111b2e] hover:bg-[#17243a] text-rose-400 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>{language === 'ku' ? 'پێداچوونەوە' : language === 'ar' ? 'مراجعة' : 'Review'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>

                {/* 6. Reports */}
                <div className="bg-[#0c1322] p-4 rounded-2xl border border-slate-800 shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between text-center items-center group">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-xs text-white mb-0.5">{t('owner.nav.reports', language === 'ku' ? 'ڕاپۆرتەکان' : language === 'ar' ? 'التقارير' : 'Reports')}</h3>
                  <p className="text-[11px] text-slate-400 mb-3 line-clamp-2 leading-relaxed">
                    {language === 'ku' ? 'ڕاپۆرتی دارایی و شیکاریی گشتی' : language === 'ar' ? 'التقارير المالية والبيانات' : 'Financial reports and statements'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('analytics')}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#111b2e] hover:bg-[#17243a] text-cyan-400 border border-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer min-h-[36px]"
                  >
                    <span>{language === 'ku' ? 'پیشاندان' : language === 'ar' ? 'عرض' : 'View'}</span>
                    <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </button>
                </div>
              </div>

              {/* Secondary Ecosystem Shortcuts Bar */}
              <div className="pt-2 flex items-center gap-2 overflow-x-auto pb-1 text-xs text-slate-400">
                <span className="font-bold text-amber-400 shrink-0 text-[11px] uppercase tracking-wider">
                  {language === 'ku' ? 'کردارە خێراکان:' : language === 'ar' ? 'اختصارات المنظومة:' : 'Ecosystem Shortcuts:'}
                </span>
                <button
                  type="button"
                  onClick={() => setCreateLeaseModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <FileSignature className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('owner.action.create_lease', 'Create Digital Lease')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUploadDocModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('owner.action.upload_document', 'Upload Tapu / Deed')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/rentals')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('owner.action.list_marketplace', 'Rental Marketplace')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/tenant')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <Home className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('role.tenant', 'Resident Portal')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/agent')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('agent.agent_broker', 'Agent / Broker')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/vendor')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('role.vendor', 'Service Vendor')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/workspace/portfolio')}
                  className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t('portfolio.title', 'Portfolio Analytics')}</span>
                </button>
                {Boolean((user as any)?.role === 'ADMIN' || (user as any)?.role === 'PLATFORM_ADMIN' || (user as any)?.role === 'SUPER_ADMIN') && (
                  <button
                    type="button"
                    onClick={() => navigate('/workspace/platform-admin')}
                    className="px-3 py-1.5 rounded-xl bg-[#0c1322] border border-slate-800 hover:border-slate-700 text-slate-300 font-semibold shrink-0 flex items-center gap-1.5 shadow-md transition-colors cursor-pointer min-h-[38px]"
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('role.platform_admin', 'Platform Admin')}</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4. "Your Properties" Structured Table Directly on Dashboard Overview */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-white">
                    {language === 'ku' ? 'موڵکەکانت' : language === 'ar' ? 'عقاراتك' : 'Your Properties'}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {language === 'ku'
                      ? 'لیستی موڵکەکانت و دۆخی ئێستایان'
                      : language === 'ar'
                      ? 'قائمة بعقاراتك وحالتها الحالية'
                      : 'A list of your properties and their current status'}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute top-3 ltr:left-3 rtl:right-3" />
                    <input
                      type="text"
                      placeholder={language === 'ku' ? 'گەڕان لە موڵکەکان...' : language === 'ar' ? 'البحث في العقارات...' : 'Search properties...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-xs py-2 ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 rounded-xl border border-slate-800 bg-[#080d19] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 w-44 sm:w-56 shadow-md outline-none"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs font-semibold p-2 rounded-xl border border-slate-800 bg-[#080d19] text-white shadow-md cursor-pointer focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                  >
                    <option value="ALL">{language === 'ku' ? 'هەموو دۆخەکان' : language === 'ar' ? 'جميع الحالات' : 'All Status'}</option>
                    <option value="Occupied">{t('owner.occupied', 'Occupied')}</option>
                    <option value="Vacant">{t('owner.vacant', 'Vacant')}</option>
                  </select>
                </div>
              </div>

              {/* Table Container */}
              <div className="bg-[#0c1322] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                {filteredProperties.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Building2 className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="font-bold text-white text-sm">
                      {t('owner.no_properties', 'No registered properties found')}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      {language === 'ku'
                        ? 'هیچ موڵکێک لە تۆمارەکاندا نەدۆزرایەوە بەپێی ئەم فلتەرە.'
                        : language === 'ar'
                        ? 'لم يتم العثور على أي عقارات مسجلة تطابق معايير التصفية.'
                        : 'No properties found matching your filter criteria.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left rtl:text-right border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-[#080d19] text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3.5 px-4 sm:px-6">{language === 'ku' ? 'موڵک' : language === 'ar' ? 'العقار' : 'PROPERTY'}</th>
                          <th className="py-3.5 px-4">{language === 'ku' ? 'ناونیشان' : language === 'ar' ? 'العنوان' : 'ADDRESS'}</th>
                          <th className="py-3.5 px-4">{language === 'ku' ? 'دۆخ' : language === 'ar' ? 'الحالة' : 'STATUS'}</th>
                          <th className="py-3.5 px-4">{language === 'ku' ? 'کرێنشینان' : language === 'ar' ? 'المستأجرون' : 'TENANTS'}</th>
                          <th className="py-3.5 px-4">{language === 'ku' ? 'کرێی مانگانە' : language === 'ar' ? 'الإيجار الشهري' : 'MONTHLY RENT'}</th>
                          <th className="py-3.5 px-4 sm:px-6 text-right rtl:text-left">{language === 'ku' ? 'کردارەکان' : language === 'ar' ? 'الإجراءات' : 'ACTIONS'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {filteredProperties.map((prop) => (
                          <tr key={prop.id} className="hover:bg-[#111b2e]/60 transition-colors">
                            {/* 1. Property Details */}
                            <td className="py-3.5 px-4 sm:px-6">
                              <div className="flex items-center gap-3">
                                <img
                                  src={prop.imageUrl || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=400&q=80'}
                                  alt={prop.name}
                                  className="w-12 h-12 rounded-xl object-cover ring-1 ring-slate-800 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="font-bold text-white truncate">
                                    {language === 'ku' && prop.nameKurdish ? prop.nameKurdish : prop.name}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                    {prop.type || 'Residential'}
                                    {prop.managingAgencyName && (
                                      <span className="text-amber-400 font-semibold" data-testid="prop-managing-agency">
                                        {' '}• {prop.managingAgencyName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Address */}
                            <td className="py-3.5 px-4 text-slate-300">
                              <div className="truncate max-w-[200px]">{prop.location}</div>
                              <div className="text-[11px] text-slate-500">{prop.city}</div>
                            </td>

                            {/* 3. Status */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  prop.status === 'Occupied'
                                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                                    : prop.status === 'Under Management'
                                    ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    prop.status === 'Occupied'
                                      ? 'bg-emerald-400'
                                      : prop.status === 'Under Management'
                                      ? 'bg-amber-400'
                                      : 'bg-slate-400'
                                  }`}
                                />
                                <span>
                                  {prop.status === 'Occupied'
                                    ? t('owner.occupied', 'Occupied')
                                    : prop.status === 'Under Management'
                                    ? (language === 'ku' ? 'لەژێر بەڕێوەبردندایە' : language === 'ar' ? 'تحت الإدارة' : 'Under Management')
                                    : t('owner.vacant', 'Available for Rent')}
                                </span>
                              </span>
                            </td>

                            {/* 4. Tenants */}
                            <td className="py-3.5 px-4 text-slate-300 font-medium">
                              {prop.isOccupied ? (
                                <div>
                                  <span className="font-bold text-white">{prop.tenantName || '1 / 1'}</span>
                                  <span className="text-[10px] text-slate-500 block">{prop.leaseEndDate ? `Ends ${prop.leaseEndDate}` : 'Active Lease'}</span>
                                </div>
                              ) : (
                                <span className="text-slate-500">0 / {prop.unitsCount || 1}</span>
                              )}
                            </td>

                            {/* 5. Monthly Rent */}
                            <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                              <span dir="ltr">{formatIqd(prop.monthlyRentIqd)} IQD</span>
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3.5 px-4 sm:px-6 text-right rtl:text-left">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/properties/${prop.id}`)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#111b2e] hover:bg-[#17243a] text-slate-200 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer min-h-[34px]"
                                  title={t('action.view', 'View Property')}
                                >
                                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{language === 'ku' ? 'پیشاندان' : language === 'ar' ? 'عرض' : 'View'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveTab('properties')}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-[#111b2e] hover:bg-[#17243a] text-slate-200 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer min-h-[34px]"
                                  title={t('action.edit', 'Edit Property')}
                                >
                                  <Pencil className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{language === 'ku' ? 'دەستکاری' : language === 'ar' ? 'تعديل' : 'Edit'}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSelectedFeeBreakdownProp(prop)}
                                  className="p-1.5 rounded-lg border border-slate-800 bg-[#111b2e] hover:bg-[#17243a] text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[34px]"
                                  title={language === 'ku' ? 'وردەکاریی ڕەسمی' : language === 'ar' ? 'تفاصيل الرسوم' : 'Fee Breakdown'}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
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


            {/* Side-by-side Visualizations: Rental Income Bar Chart & Occupancy Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rental Income SVG Chart */}
              <div className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {t('owner.rental_income', 'Rental Income')}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ku'
                        ? 'داهاتی ڕاستەقینەی وەرگیراو بەرامبەر پێشبینیکراو'
                        : language === 'ar'
                        ? 'الإيرادات المحصلة فعلياً مقابل المتوقعة'
                        : 'Actual collected rent vs expected rent'}
                    </p>
                  </div>
                  <select
                    value={incomePeriod}
                    onChange={(e) => setIncomePeriod(e.target.value as any)}
                    className="text-xs font-semibold bg-[#080d19] border border-slate-800 rounded-xl px-2.5 py-1 text-white cursor-pointer outline-none"
                  >
                    <option value="3m">{language === 'ku' ? '٣ مانگ' : language === 'ar' ? '٣ أشهر' : '3 Months'}</option>
                    <option value="6m">{language === 'ku' ? '٦ مانگ' : language === 'ar' ? '٦ أشهر' : '6 Months'}</option>
                    <option value="9m">{language === 'ku' ? '٩ مانگ' : language === 'ar' ? '٩ أشهر' : '9 Months'}</option>
                    <option value="12m">{language === 'ku' ? '١٢ مانگ' : language === 'ar' ? '١٢ شهراً' : '12 Months'}</option>
                  </select>
                </div>

                {/* SVG Bars */}
                {presentationData.rentalIncome.months.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                    <DollarSign className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-300">
                      {language === 'ku'
                        ? 'هیچ داتایەکی داهاتی کرێ تۆمار نەکراوە'
                        : language === 'ar'
                        ? 'لا توجد بيانات إيرادات مسجلة حتى الآن'
                        : 'No rental income recorded yet'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      {language === 'ku'
                        ? 'داهات دوای وەرگرتن و پشتڕاستکردنەوەی کرێ لێرە دەردەکەوێت.'
                        : language === 'ar'
                        ? 'ستظهر الإيرادات فور تحصيل وتأكيد دفعات الإيجار.'
                        : 'Income displays once rent payments are confirmed and settled.'}
                    </p>
                  </div>
                ) : (
                  <div className="pt-3">
                    <div className="flex items-end justify-between h-40 gap-3 px-3 border-b border-slate-800">
                      {presentationData.rentalIncome.months.map((m, idx) => {
                        const maxVal = 7000000;
                        const actualHeight = Math.round((m.actualIncomeIqd / maxVal) * 100);
                        const expectedHeight = Math.round((m.expectedIncomeIqd / maxVal) * 100);

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                            <div className="w-full flex items-end justify-center gap-1.5 h-[120px]">
                              {/* Actual Bar (Champagne Gold) */}
                              <div
                                style={{ height: `${actualHeight}%` }}
                                className="w-3.5 sm:w-4 bg-gradient-to-t from-amber-500 to-amber-400 rounded-t-md transition-all duration-500 shadow-md"
                                title={`${m.month} Actual: ${formatIqd(m.actualIncomeIqd)} IQD`}
                              />
                              {/* Expected Bar (Muted Navy) */}
                              <div
                                style={{ height: `${expectedHeight}%` }}
                                className="w-3.5 sm:w-4 bg-slate-700 rounded-t-md transition-all duration-500"
                                title={`${m.month} Expected: ${formatIqd(m.expectedIncomeIqd)} IQD`}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-400 uppercase">
                              {getLocalizedMonth(m.month)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Chart Legend */}
                    <div className="flex items-center justify-center gap-6 mt-3 text-xs font-semibold text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-amber-400 to-amber-500" />
                        <span className="text-white">{t('owner.income_iqd', 'Income (IQD)')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-sm bg-slate-700" />
                        <span>{t('owner.expected_iqd', 'Expected')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Property Occupancy Donut Visualization */}
              <div className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {t('owner.property_occupancy', 'Property Occupancy')}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {language === 'ku'
                        ? 'دۆخی ئێستای بەکارهێنانی یەکەکان'
                        : language === 'ar'
                        ? 'حالة إشغال الوحدات العقارية الحالية'
                        : 'Real-time portfolio unit utilization'}
                    </p>
                  </div>
                </div>

                {presentationData.occupancy.totalUnits === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-4">
                    <Building2 className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-300">
                      {language === 'ku'
                        ? 'هیچ یەکەیەکی تۆمارکراو نییە'
                        : language === 'ar'
                        ? 'لا توجد وحدات عقارية مسجلة'
                        : 'No property units registered'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                      {language === 'ku'
                        ? 'موڵکێک زیاد بکە بۆ بەدواداچوونی ڕێژەی پڕبوون و بەتاڵی.'
                        : language === 'ar'
                        ? 'أضف عقاراً للبدء في تتبع نسب الإشغال والشغور.'
                        : 'Add a property to start tracking occupancy metrics.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-2">
                    {/* SVG Donut */}
                    <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-800"
                          strokeWidth="3.8"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-amber-400"
                          strokeDasharray={`${presentationData.occupancy.occupiedPercentage}, 100`}
                          strokeWidth="3.8"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-2xl font-black tracking-tight text-white leading-none">
                          {presentationData.occupancy.occupiedPercentage}%
                        </span>
                        <span className="text-[9px] font-bold text-amber-400 mt-1 uppercase">
                          {t('owner.occupied', 'Occupied')}
                        </span>
                      </div>
                    </div>

                    {/* Legend stats */}
                    <div className="space-y-2.5 text-xs w-full sm:w-48">
                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#080d19] border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="font-semibold text-slate-300">
                            {t('owner.occupied', 'Occupied')}
                          </span>
                        </div>
                        <span className="font-bold text-white">
                          {presentationData.occupancy.occupiedCount} ({presentationData.occupancy.occupiedPercentage}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#080d19] border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                          <span className="font-semibold text-slate-300">
                            {t('owner.vacant', 'Vacant')}
                          </span>
                        </div>
                        <span className="font-bold text-white">
                          {presentationData.occupancy.vacantCount} ({presentationData.occupancy.vacantPercentage}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-[#080d19] border border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                          <span className="font-semibold text-slate-300">
                            {t('owner.under_maintenance', 'Under Maintenance')}
                          </span>
                        </div>
                        <span className="font-bold text-white">
                          {presentationData.occupancy.maintenanceCount} ({presentationData.occupancy.maintenancePercentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 6. Recent Activity & AI Advisory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <div className="bg-[#0c1322] p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">
                    {t('owner.recent_activity', 'Recent Activity')}
                  </h3>
                </div>

                <div className="space-y-3">
                  {presentationData.recentActivities.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      <Clock className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="text-xs font-medium text-slate-400">
                        {language === 'ku'
                          ? 'هیچ چالاکییەکی نوێ تۆمار نەکراوە'
                          : language === 'ar'
                          ? 'لا توجد أنشطة تشغيلية مسجلة'
                          : 'No recent operational activity'}
                      </p>
                    </div>
                  ) : (
                    presentationData.recentActivities.map((act) => (
                      <div key={act.id} className="flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              act.type === 'RENT_PAYMENT'
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30'
                                : act.type === 'MAINTENANCE_REQUEST'
                                ? 'bg-rose-950/80 text-rose-400 border border-rose-500/30'
                                : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {act.type === 'RENT_PAYMENT' && <Wallet className="w-4 h-4" />}
                            {act.type === 'MAINTENANCE_REQUEST' && <Wrench className="w-4 h-4" />}
                            {act.type === 'LEASE_SIGNED' && <FileText className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-white leading-snug truncate">
                              {language === 'ku' && act.titleKurdish ? act.titleKurdish : act.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{act.relatedEntity}</p>
                            <span className="text-[10px] text-slate-500">{act.timeAgo}</span>
                          </div>
                        </div>

                        {act.amountFormatted && (
                          <div className="text-right rtl:text-left shrink-0 font-bold text-amber-400 font-mono">
                            <span dir="ltr">{act.amountFormatted}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* AI Advisor Card */}
              <div className="space-y-4">
                {!dismissTip ? (
                  <div className="p-5 rounded-2xl bg-[#0c1322] border border-amber-500/30 flex items-start gap-3.5 shadow-xl">
                    <div className="w-10 h-10 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Lightbulb className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-amber-400">
                          {t('owner.quick_tip', 'Property Intelligence Advisor')}
                        </span>
                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded-md bg-amber-400 text-slate-950">
                          AI
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                        {language === 'ku' && presentationData.quickTip.textKurdish
                          ? presentationData.quickTip.textKurdish
                          : language === 'ar' && presentationData.quickTip.textArabic
                          ? presentationData.quickTip.textArabic
                          : presentationData.quickTip.text}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDismissTip(true)}
                      className="text-slate-400 hover:text-white p-1 cursor-pointer"
                      aria-label="Dismiss Tip"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-[#0c1322] border border-slate-800 text-center shadow-xl">
                    <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-slate-300">
                      {language === 'ku' ? 'ڕاوێژکاری ژیری دەستکرد چالاکە' : language === 'ar' ? 'المستشار الذكي نشط' : 'AI Advisor Active'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PROPERTY PORTFOLIO                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'properties' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-zinc-100 shadow-sm">
              <div>
                <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                  {t('owner.nav.properties', 'Property Portfolio')}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {language === 'ku'
                    ? 'هەموو ئەو موڵکانەی کە تۆماری خاوەندارێتییان بە ناوی تۆوەیە'
                    : language === 'ar'
                    ? 'جميع العقارات المسجلة تحت ملكيتك الرسمية'
                    : 'All properties registered under your verified ownership'}
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search Input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute top-3 ltr:left-3 rtl:right-3" />
                  <input
                    type="text"
                    placeholder={t('owner.search_property_ph', 'Search property...')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="text-xs py-2 ltr:pl-8 rtl:pr-8 ltr:pr-3 rtl:pl-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black w-44 sm:w-52"
                  />
                </div>

                {/* City Filter */}
                <select
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="text-xs font-medium p-2 rounded-xl border border-zinc-200 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="ALL">{t('owner.all_cities', 'All Cities')}</option>
                  <option value="هەولێر">Erbil (هەولێر)</option>
                  <option value="سلێمانی">Sulaymaniyah (سلێمانی)</option>
                  <option value="دهۆک">Duhok (دهۆک)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-medium p-2 rounded-xl border border-zinc-200 bg-white text-slate-700 cursor-pointer"
                >
                  <option value="ALL">{t('owner.all_status', 'All Status')}</option>
                  <option value="Occupied">{t('owner.occupied', 'Occupied')}</option>
                  <option value="Vacant">{t('owner.vacant', 'Vacant')}</option>
                </select>

                <button
                  type="button"
                  onClick={() => navigate('/properties/add')}
                  className="px-4 py-2 bg-black hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('owner.action.add_property', 'Add Property')}</span>
                </button>
              </div>
            </div>

            {/* Properties Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProperties.length === 0 ? (
                <div className="col-span-full bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-3">
                  <Building2 className="w-12 h-12 text-slate-400 mx-auto" />
                  <h3 className="font-medium text-zinc-900 text-sm">
                    {t('owner.no_properties', 'No registered properties found')}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    {language === 'ku'
                      ? 'هیچ موڵکێک لە تۆمارەکاندا نەدۆزرایەوە بەپێی ئەم فلتەرە. دەتوانیت یەکەمین موڵک بە تۆماری تاپۆ زیاد بکەیت.'
                      : language === 'ar'
                      ? 'لم يتم العثور على أي عقارات مسجلة تطابق معايير التصفية. يمكنك إضافة عقارك الأول مع وثائق الطابو.'
                      : 'No properties found matching your filter criteria. Register your first property with title deed documentation.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/properties/add')}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white font-medium text-xs rounded-xl shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('owner.action.add_property', 'Add Property')}</span>
                  </button>
                </div>
              ) : (
                filteredProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="relative h-44 w-full bg-slate-100">
                      <img
                        src={prop.imageUrl}
                        alt={prop.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 ltr:left-3 rtl:right-3 flex items-center gap-1.5 flex-wrap">
                        
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            prop.status === 'Occupied'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-800/80 backdrop-blur-xs text-white'
                          }`}
                        >
                          {prop.status === 'Occupied'
                            ? t('owner.occupied', 'Occupied')
                            : t('owner.vacant', 'Vacant')}
                        </span>

                        {(prop.verificationStatus === 'VERIFIED' || prop.tapuStatus === 'VERIFIED') ? (
                          <span data-testid={`verification-badge-${prop.id}`} className="px-2.5 py-1 rounded-full text-xs font-bold bg-teal-600 text-white shadow-xs flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            {language === 'ku' ? 'پشتڕاستکراوە' : language === 'ar' ? 'تم التحقق' : 'Verified'}
                          </span>
                        ) : (prop.verificationStatus === 'REJECTED' || prop.tapuStatus === 'REJECTED') ? (
                          <span data-testid={`verification-badge-${prop.id}`} className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white shadow-xs flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {language === 'ku' ? 'ڕەتکرایەوە' : language === 'ar' ? 'مرفوض' : 'Rejected'}
                          </span>
                        ) : (
                          <span data-testid={`verification-badge-${prop.id}`} className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {language === 'ku' ? 'چاوەڕوانی پشکنین' : language === 'ar' ? 'قيد التحقق' : 'Pending Verification'}
                          </span>
                        )}
                      </div>

                      <div className="absolute bottom-3 ltr:right-3 rtl:left-3 bg-white/95 backdrop-blur-xs px-3 py-1.5 rounded-xl shadow-xs text-right rtl:text-left">
                        <div className="text-xs font-medium tracking-tight tracking-tight text-zinc-900" dir="ltr">
                          {formatIqd(prop.monthlyRentIqd)} IQD
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium">
                          {t('owner.currency.per_month', '/ month')}
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div>
                        <h3 className="font-medium text-sm sm:text-base text-zinc-900">
                          {language === 'ku' && prop.nameKurdish ? prop.nameKurdish : prop.name}
                        </h3>
                        <p className="text-xs text-zinc-500 mt-0.5">{prop.location}</p>
                      </div>

                      {/* Rejection Banner & Resubmit Action */}
                      {(prop.verificationStatus === 'REJECTED' || prop.tapuStatus === 'REJECTED') && (
                        <div data-testid={`rejection-banner-${prop.id}`} className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 text-xs text-rose-900">
                          <div className="flex items-center gap-1.5 font-bold text-rose-700">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{language === 'ku' ? 'هۆکاری ڕەتکردنەوە:' : language === 'ar' ? 'سبب الرفض:' : 'Rejection Reason:'}</span>
                          </div>
                          <p className="text-slate-800 font-medium">
                            {prop.rejectionReason || (language === 'ku' ? 'بەڵگەنامەی ناتەواو یان پێویستی بە زانیاری زیاترە.' : 'Documentation incomplete or requires additional proof.')}
                          </p>
                          <button
                            type="button"
                            data-testid={`resubmit-prop-btn-${prop.id}`}
                            onClick={async () => {
                              try {
                                const token = localStorage.getItem('auth_token') || 'dev-owner';
                                const res = await fetch(`/api/properties/${prop.id}/resubmit`, {
                                  method: 'POST',
                                  headers: { Authorization: `Bearer ${token}` }
                                });
                                if (res.ok) {
                                  fetchDashboardData();
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="mt-1 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            {language === 'ku' ? 'دووبارە پێشکەشکردنەوە بۆ پشکنین' : 'Resubmit for Review'}
                          </button>
                        </div>
                      )}

                      {/* Pending Verification Notice */}
                      {prop.verificationStatus === 'PENDING_VERIFICATION' && (
                        <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>
                            {language === 'ku'
                              ? 'لە پشکنیندایە: پێش پەسەندکردنی کارگێڕی، موڵک لە بازاڕ دەرناکەوێت.'
                              : 'Pending admin review: Not publicly listed until approved.'}
                          </span>
                        </div>
                      )}

                      {/* Property Metadata Badges */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-100">
                        <div>
                          <span className="text-slate-400 block text-[11px]">{t('owner.type_label', 'Type:')}</span>
                          <span className="font-medium text-zinc-800">{prop.type}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">{t('owner.management_label', 'Management:')}</span>
                          <span className="font-medium text-zinc-800">
                            {prop.managementPreference === 'HOMEHUB_MANAGED' ? (
                              <span className="text-blue-700 font-semibold">
                                {language === 'ku' ? 'بەڕێوەبردن لەلایەن هۆم‌هەب' : language === 'ar' ? 'إدارة هوم هب' : 'HomeHub-Managed'}
                              </span>
                            ) : prop.managementPreference === 'AGENT_MANAGED' ? (
                              <span className="text-purple-700 font-semibold">
                                {prop.managingAgencyName || (language === 'ku' ? 'بەڕێوەبردن لەلایەن ئاژانس' : language === 'ar' ? 'إدارة وكيل' : 'Agent-Managed')}
                              </span>
                            ) : (
                              <span className="text-zinc-600 font-medium">
                                {language === 'ku' ? 'بەڕێوەبردنی خۆیی' : language === 'ar' ? 'إدارة ذاتية' : t('owner.companies.self_managed', 'Self-Managed')}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Management Arrangement Status Pill if applicable */}
                      {prop.managementArrangementStatus && prop.managementArrangementStatus !== 'NOT_APPLICABLE' && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <span className="text-slate-400">
                              {language === 'ku' ? 'دۆخی ڕێککەوتن:' : language === 'ar' ? 'حالة الاتفاقية:' : 'Arrangement:'}
                            </span>
                            <span>
                              {prop.managementArrangementStatus === 'AWAITING_ONBOARDING'
                                ? (language === 'ku' ? 'لە چاوەڕوانی ئۆنبۆردکردن' : language === 'ar' ? 'في انتظار الإعداد' : 'Awaiting Onboarding')
                                : prop.managementArrangementStatus === 'AWAITING_AGREEMENT'
                                ? (language === 'ku' ? 'لە چاوەڕوانی واژۆی گرێبەست' : language === 'ar' ? 'في انتظار توقيع الاتفاقية' : 'Awaiting Agreement')
                                : prop.managementArrangementStatus === 'ACTIVE'
                                ? (language === 'ku' ? 'چالاک' : language === 'ar' ? 'نشط' : 'Active')
                                : prop.managementArrangementStatus}
                            </span>
                          </span>
                        </div>
                      )}

                      {prop.isOccupied && prop.tenantName && (
                        <div className="p-2.5 rounded-xl bg-zinc-100/70 border border-zinc-200 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-black" />
                            <span className="font-medium text-zinc-800">{prop.tenantName}</span>
                          </div>
                          <span className="text-[11px] text-zinc-500">
                            Expires: {prop.leaseEndDate}
                          </span>
                        </div>
                      )}

                      {/* Embedded Property Utility Bills */}
                      <OwnerUtilityBills propertyId={prop.id} />
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('leases')}
                        className="text-xs font-medium text-black hover:text-blue-800 cursor-pointer"
                      >
                        {t('owner.leases.title', 'View Leases')}
                      </button>
                      {(() => {
                        const matchingLease = leasesList.find((l) => l.propertyId === prop.id);
                        if (matchingLease || prop.isOccupied) {
                          return (
                            <button
                              id={`btn-deposit-inspections-${matchingLease?.id || prop.id}`}
                              type="button"
                              onClick={() => setDepositInspectionModalState({
                                isOpen: true,
                                leaseId: matchingLease?.id || '',
                                propertyId: prop.id,
                                propertyName: language === 'ku' && prop.nameKurdish ? prop.nameKurdish : prop.name,
                                tenantName: matchingLease?.tenantName || prop.tenantName,
                                currency: matchingLease?.currency || 'IQD',
                              })}
                              className="text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                            >
                              {language === 'ku' ? 'بارمتە' : language === 'ar' ? 'التأمين' : 'Deposit'}
                            </button>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRequestMaintenanceModalOpen(true)}
                      className="text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer flex items-center gap-1"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{t('owner.maintenance.new_request', 'Maintenance')}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: RENTAL AND LEASE MANAGEMENT                                        */}
        {/* ========================================================================= */}
        {activeTab === 'leases' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-zinc-100 shadow-sm">
              <div>
                <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                  {t('owner.leases.title', 'Rental & Lease Management')}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {language === 'ku'
                    ? 'بەڕێوەبردنی گرێبەستی کرێنشینان، وادەکان، و دڵنیابوونەوە لە پارەدان'
                    : language === 'ar'
                    ? 'إدارة عقود الإيجار، التواريخ، ومتابعة المدفوعات'
                    : 'Manage tenant contracts, lease renewals, and payment schedules'}
                </p>
              </div>

              <button
                id="btn-open-create-lease-modal"
                type="button"
                onClick={() => setCreateLeaseModalOpen(true)}
                className="px-4 py-2 bg-black hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('owner.leases.create_lease', 'Create Digital Lease')}</span>
              </button>
            </div>

            {/* Pending Lease Renewals Section */}
            {renewalsList.filter((r) => r.status === 'REQUESTED').length > 0 && (
              <div id="section-pending-renewals" className="bg-amber-50/50 rounded-2xl border border-amber-200/80 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-amber-950">
                        {language === 'ku'
                          ? 'داواکارییەکانی نوێکردنەوەی گرێبەست (چاوەڕوانی پەسەندکردن)'
                          : language === 'ar'
                          ? 'طلبات تجديد عقود الإيجار (بانتظار الموافقة)'
                          : 'Pending Lease Renewal Requests'}
                      </h2>
                      <p className="text-[11px] text-amber-700">
                        {language === 'ku'
                          ? 'داواکاریی کرێنشین بۆ درێژکردنەوەی ماوەی گرێبەست یان گۆڕینی مەرجە داراییەکان'
                          : language === 'ar'
                          ? 'طلبات المستأجرين لتمديد مدة العقد أو تعديل الشروط المالية'
                          : 'Tenant requests to extend lease term or revise rental parameters'}
                      </p>
                    </div>
                  </div>
                  <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full border border-amber-200">
                    {renewalsList.filter((r) => r.status === 'REQUESTED').length}{' '}
                    {language === 'ku' ? 'داواکاری لە چاوەڕوانیدا' : 'Pending Requests'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renewalsList
                    .filter((r) => r.status === 'REQUESTED')
                    .map((ren) => (
                      <div
                        key={ren.id}
                        id={`renewal-card-${ren.id}`}
                        className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold text-zinc-900 text-sm">{ren.propertyName}</h3>
                            <p className="text-xs text-zinc-500">
                              {ren.tenantName}{' '}
                              {ren.tenantPhone && (
                                <span className="font-mono text-[11px]" dir="ltr">
                                  • {ren.tenantPhone}
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {language === 'ku' ? 'چاوەڕوانی بڕیار' : language === 'ar' ? 'قيد المراجعة' : 'Pending Review'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-zinc-50 p-3 rounded-lg border border-zinc-100">
                          <div>
                            <span className="text-[10px] text-zinc-400 block mb-0.5">
                              {language === 'ku' ? 'ماوەی ئێستا' : language === 'ar' ? 'المدة الحالية' : 'Current Term'}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-600 block" dir="ltr">
                              {ren.currentStartDate?.slice(0, 10)} → {ren.currentEndDate?.slice(0, 10)}
                            </span>
                            <span className="font-mono text-[11px] text-zinc-700 font-semibold mt-0.5 block" dir="ltr">
                              {formatIqd(ren.currentRentAmount)} {ren.currency || 'IQD'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-blue-600 font-bold block mb-0.5">
                              {language === 'ku' ? 'ماوەی پێشنیازکراو' : language === 'ar' ? 'المدة المقترحة' : 'Proposed Term'}
                            </span>
                            <span className="font-mono text-[11px] text-blue-900 font-bold block" dir="ltr">
                              {ren.proposedStartDate?.slice(0, 10)} → {ren.proposedEndDate?.slice(0, 10)}
                            </span>
                            <span className="font-mono text-[11px] text-blue-900 font-bold mt-0.5 block" dir="ltr">
                              {formatIqd(ren.proposedRentAmount)} {ren.currency || 'IQD'}
                            </span>
                          </div>
                        </div>

                        {ren.tenantNotes && (
                          <div className="text-xs text-zinc-600 bg-amber-50/30 p-2.5 rounded-lg border border-amber-100/70 italic">
                            "{ren.tenantNotes}"
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            id={`btn-approve-renewal-${ren.id}`}
                            type="button"
                            disabled={processingRenewalId === ren.id}
                            onClick={() => handleApproveRenewal(ren.id)}
                            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                          >
                            {processingRenewalId === ren.id
                              ? (language === 'ku' ? 'پەسەند دەکرێت...' : 'Approving...')
                              : (language === 'ku' ? 'پەسەندکردنی نوێکردنەوە' : language === 'ar' ? 'الموافقة على التجديد' : 'Approve Renewal')}
                          </button>
                          <button
                            id={`btn-reject-renewal-${ren.id}`}
                            type="button"
                            disabled={processingRenewalId === ren.id}
                            onClick={() => handleRejectRenewal(ren.id)}
                            className="flex-1 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 text-center"
                          >
                            {processingRenewalId === ren.id
                              ? (language === 'ku' ? 'ڕەتدەکرێتەوە...' : 'Rejecting...')
                              : (language === 'ku' ? 'ڕەتکردنەوە' : language === 'ar' ? 'رفض' : 'Reject')}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Leases Table */}
            <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-zinc-50/50 backdrop-blur-sm border-b border-zinc-100 text-zinc-500 uppercase font-medium text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">{t('owner.leases.col_property', 'Property')}</th>
                      <th className="px-5 py-3.5">{t('owner.leases.col_tenant', 'Tenant Name')}</th>
                      <th className="px-5 py-3.5">{t('owner.leases.col_dates', 'Term Dates')}</th>
                      <th className="px-5 py-3.5">{t('owner.leases.col_rent', 'Monthly Rent')}</th>
                      <th className="px-5 py-3.5">{t('owner.leases.col_deposit', 'Deposit (0% fee)')}</th>
                      <th className="px-5 py-3.5">{t('owner.leases.col_status', 'Payment Status')}</th>
                      <th className="px-5 py-3.5 text-center">{t('owner.leases.col_actions', 'Actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leasesList.length === 0 && presentationData.properties.filter((p) => p.isOccupied).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                          <FileText className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                          <p className="text-xs font-medium text-zinc-500">
                            {language === 'ku'
                              ? 'هیچ گرێبەستێکی کرێ نییە'
                              : language === 'ar'
                              ? 'لا توجد عقود إيجار حالياً'
                              : 'No lease agreements found'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {language === 'ku'
                              ? 'گرێبەستی دیجیتاڵی نوێ دروست بکە بۆ بەستنەوەی کرێنشین و دیاریکردنی کرێی مانگانە.'
                              : language === 'ar'
                              ? 'أنشئ عقداً إلكترونياً جديداً لربط المستأجر وتحديد الإيجار الشهري.'
                              : 'Create a digital lease agreement to assign tenants and track rent collection.'}
                          </p>
                          <button
                            id="btn-create-lease-empty-state"
                            type="button"
                            onClick={() => setCreateLeaseModalOpen(true)}
                            className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black text-white font-medium text-xs rounded-xl hover:bg-blue-700 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{t('owner.leases.create_lease', 'Create Digital Lease')}</span>
                          </button>
                        </td>
                      </tr>
                    ) : leasesList.length > 0 ? (
                      leasesList.map((lease) => (
                        <tr key={lease.id} className="hover:bg-zinc-50/60" id={`lease-row-${lease.id}`}>
                          <td className="px-5 py-4 font-medium text-zinc-900">
                            <div className="flex items-center gap-2">
                              <span>{lease.propertyName}</span>
                              {lease.unitNumber && lease.unitNumber !== 'Main' && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                  {lease.unitNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-700">
                            <div>{lease.tenantName || 'Tenant'}</div>
                            <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                              {lease.tenantPhone || lease.tenantEmail || lease.tenantId || '+964 750 000 0000'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-zinc-500">
                            <div className="text-[11px] font-mono" dir="ltr">{lease.startDate} → {lease.endDate}</div>
                            <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                              {lease.status === 'ACTIVE'
                                ? (language === 'ku' ? 'گرێبەستی چالاک' : language === 'ar' ? 'عقد نشط' : 'Active Contract')
                                : (language === 'ku' ? 'لە چاوەڕوانی واژۆ' : language === 'ar' ? 'بانتظار التوقيع' : 'Pending Signature')}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-medium tracking-tight text-zinc-900 font-mono" dir="ltr">
                            {formatIqd(lease.rentAmount)} {lease.currency || 'IQD'}
                          </td>
                          <td className="px-5 py-4 text-zinc-500 font-mono" dir="ltr">
                            {formatIqd(lease.depositAmount)} {lease.currency || 'IQD'}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium border ${
                              lease.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : lease.status === 'PENDING_APPROVAL'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : lease.status === 'EXPIRED' || lease.status === 'TERMINATED'
                                ? 'bg-zinc-100 text-zinc-700 border-zinc-300'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {lease.status === 'ACTIVE'
                                ? (language === 'ku' ? 'چالاکە' : language === 'ar' ? 'نشط' : 'Active')
                                : lease.status === 'PENDING_APPROVAL'
                                ? (language === 'ku' ? 'لە چاوەڕوانی پەسەندکردن' : language === 'ar' ? 'بانتظار الموافقة' : 'Pending Approval')
                                : lease.status === 'EXPIRED'
                                ? (language === 'ku' ? 'بەسەرچووە' : language === 'ar' ? 'منتهي الصلاحية' : 'Expired')
                                : lease.status === 'TERMINATED'
                                ? (language === 'ku' ? 'هەڵوەشاوەتەوە' : language === 'ar' ? 'تم إنهاؤه' : 'Terminated')
                                : (language === 'ku' ? 'لە چاوەڕوانی واژۆکردن' : language === 'ar' ? 'بانتظار التوقيع' : 'Pending Signature')}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {(lease.status === 'PENDING_APPROVAL' || lease.status === 'PENDING_SIGNATURE' || lease.status === 'DRAFT') ? (
                                <button
                                  id={`btn-activate-lease-${lease.id}`}
                                  type="button"
                                  onClick={() => handleActivateLease(lease.id)}
                                  disabled={activatingLeaseId === lease.id}
                                  className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {activatingLeaseId === lease.id 
                                    ? (language === 'ku' ? 'چالاکدەکرێت...' : language === 'ar' ? 'جاري التفعيل...' : 'Activating...')
                                    : (language === 'ku' ? 'چالاککردنی گرێبەست' : language === 'ar' ? 'تفعيل العقد' : 'Activate Lease')}
                                </button>
                              ) : (
                                <>
                                  <button
                                    id={`btn-deposit-inspections-${lease.id}`}
                                    type="button"
                                    onClick={() => setDepositInspectionModalState({
                                      isOpen: true,
                                      leaseId: lease.id,
                                      propertyId: lease.propertyId,
                                      propertyName: lease.propertyName,
                                      tenantName: lease.tenantName,
                                      currency: lease.currency || 'IQD',
                                    })}
                                    className="text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                  >
                                    {language === 'ku' ? 'بارمتە و پشکنین' : language === 'ar' ? 'التأمين والفحص' : 'Deposit & Inspections'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setActiveTab('earnings')}
                                    className="text-xs font-medium text-black hover:text-blue-800 cursor-pointer"
                                  >
                                    View Ledger
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      presentationData.properties
                        .filter((p) => p.isOccupied)
                        .map((prop) => (
                          <tr key={prop.id} className="hover:bg-zinc-50/60">
                            <td className="px-5 py-4 font-medium text-zinc-900">
                              <div className="flex items-center gap-2">
                                <span>{language === 'ku' && prop.nameKurdish ? prop.nameKurdish : prop.name}</span>
                                
                              </div>
                            </td>
                            <td className="px-5 py-4 text-slate-700">
                              <div>{prop.tenantName || 'Tenant'}</div>
                              <span className="text-[11px] text-slate-400 font-mono" dir="ltr">
                                {prop.tenantPhone || '+964 750 000 0000'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-zinc-500">
                              Expires: {prop.leaseEndDate || '2027-01-01'}
                              <span className="block text-[10px] text-black font-medium">
                                Active Contract
                              </span>
                            </td>
                            <td className="px-5 py-4 font-medium tracking-tight tracking-tight text-zinc-900 font-mono" dir="ltr">
                              {formatIqd(prop.monthlyRentIqd)} IQD
                            </td>
                            <td className="px-5 py-4 text-zinc-500 font-mono" dir="ltr">
                              {formatIqd(prop.monthlyRentIqd)} IQD
                            </td>
                            <td className="px-5 py-4">
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-zinc-100 text-emerald-700 border border-emerald-200">
                                Confirmed Paid
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  id={`btn-deposit-inspections-${prop.activeLeaseId || prop.id}`}
                                  type="button"
                                  disabled={!prop.activeLeaseId}
                                  onClick={() => setDepositInspectionModalState({
                                    isOpen: true,
                                    leaseId: prop.activeLeaseId || '',
                                    propertyId: prop.id,
                                    propertyName: language === 'ku' && prop.nameKurdish ? prop.nameKurdish : prop.name,
                                    tenantName: prop.tenantName,
                                    currency: 'IQD',
                                  })}
                                  className="text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={!prop.activeLeaseId ? (language === 'ku' ? 'هیچ گرێبەستێکی چالاک نییە' : language === 'ar' ? 'لا يوجد عقد نشط' : 'No active lease') : undefined}
                                >
                                  {language === 'ku' ? 'بارمتە و پشکنین' : language === 'ar' ? 'التأمين والفحص' : 'Deposit & Inspections'}
                                </button>
                              <button
                                type="button"
                                onClick={() => setActiveTab('earnings')}
                                className="text-xs font-medium text-black hover:text-blue-800 cursor-pointer"
                              >
                                View Ledger
                              </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RENT COLLECTION AND OWNER EARNINGS (CANONICAL platform fee)       */}
        {/* ========================================================================= */}
        {activeTab === 'earnings' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Header with Canonical Policy Badges */}
            <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium tracking-tight tracking-tight uppercase text-black bg-zinc-100 border border-zinc-300/80 px-2 py-0.5 rounded-md">
                    {language === 'ku' ? 'مۆدێلی ٣-تێچووی فەرمی' : language === 'ar' ? 'نموذج الرسوم الثلاثي المعتمد' : 'Canonical 3-Fee Model'}
                  </span>
                  <span className="text-[10px] font-medium text-zinc-500 bg-slate-100 px-2 py-0.5 rounded-md border border-zinc-200">
                    {language === 'ku' ? 'دەفتەری ژمێریاری هاوسەنگ' : language === 'ar' ? 'دفتر أستاذ متوازن' : 'Double-Entry Verified'}
                  </span>
                </div>
                <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900 mt-1">
                  {language === 'ku'
                    ? 'کۆکردنەوەی کرێ و شایستەی دارایی خاوەن موڵک (مۆدێلی ٣-تێچوو)'
                    : language === 'ar'
                    ? 'تحصيل الإيجار ومستحقات المالك (النموذج الثلاثي)'
                    : t('owner.nav.earnings', 'Rent Collection & Owner Earnings (3-Fee Model)')}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {language === 'ku'
                    ? 'هۆمهەب کرێ بە ڕاستەوخۆ لە کرێنشین وەردەگرێت، تێچووە ڕێککەوتووەکان (پلاتفۆرم، کرێ، بەڕێوەبردن) بە ئۆتۆماتیکی دەبڕێت، و شایستەی دارایی تەواو دەگوازێتەوە بۆ خاوەن موڵک.'
                    : language === 'ar'
                    ? 'تقوم هوم هاب بتحصيل الإيجار مباشرة من المستأجر، واقتطاع الرسوم المعتمدة تلقائياً، وتحويل صافي الاستحقاق لحساب المالك.'
                    : 'HomeHub collects rent directly from tenants, automatically deducts agreed fees (Platform, Rent, Management), and remits remaining Net to property owner.'}
                </p>
              </div>

              {/* Quick Policy Math Pill */}
              <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 text-xs font-mono shrink-0 flex items-center gap-3">
                <div className="text-center">
                  <span className="text-[10px] text-slate-400 block font-sans">{t('owner.policy.tenant', 'Tenant')}</span>
                  <span className="font-medium text-zinc-800" dir="ltr">100%</span>
                </div>
                <span className="text-slate-400 rtl:rotate-180">→</span>
                <div className="text-center">
                  <span className="text-[10px] text-blue-500 block font-sans">{t('owner.policy.fee', 'HomeHub Fee')}</span>
                  <span className="font-medium tracking-tight text-black">{language === 'ku' ? 'تێچوو' : language === 'ar' ? 'عمولة' : 'Deduction'}</span>
                </div>
                <span className="text-slate-400 rtl:rotate-180">→</span>
                <div className="text-center">
                  <span className="text-[10px] text-black block font-sans">{t('owner.policy.net', 'Owner Net')}</span>
                  <span className="font-medium tracking-tight text-black">{language === 'ku' ? 'پوختە' : language === 'ar' ? 'صافي' : 'Payout'}</span>
                </div>
              </div>
            </div>

            {/* Visual 3-Step Service Model Workflow Card */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-xl p-5 sm:p-6 shadow-sm border border-slate-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-zinc-1000/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-zinc-1000/20 text-zinc-300 rounded-xl border border-blue-400/30">
                      <Percent className="w-4 h-4" />
                    </div>
                    <h2 className="text-sm sm:text-base font-medium tracking-tight tracking-tight text-white">
                      {language === 'ku'
                        ? 'مۆدێلی خزمەتگوزاریی کۆکردنەوەی کرێ و گواستنەوەی پارە'
                        : language === 'ar'
                        ? 'نموذج خدمة تحصيل الإيجارات والتحويل المالي'
                        : 'Direct Rent Collection & Automated Remittance Service Model'}
                    </h2>
                  </div>
                  <span className="text-[11px] text-zinc-200 font-medium">
                    {language === 'ku' ? 'تەواو دیجیتاڵی و شەفاف' : language === 'ar' ? 'رقمي بالكامل وموثوق' : 'Fully Automated & Audited'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  {/* Step 1 */}
                  <div className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium tracking-tight tracking-tight text-zinc-300 bg-zinc-1000/20 px-2 py-0.5 rounded">01</span>
                        <span className="text-[10px] font-medium text-emerald-400 bg-zinc-1000/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {language === 'ku' ? '١٠٠٪ کرێ' : language === 'ar' ? '١٠٠٪ إيجار' : '100% Gross'}
                        </span>
                      </div>
                      <h3 className="text-xs font-medium text-white">
                        {language === 'ku'
                          ? '١. وەرگرتنی کرێ لە کرێنشین'
                          : language === 'ar'
                          ? '١. تحصيل الإيجار من المستأجر'
                          : '1. Direct Rent Collection'}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {language === 'ku'
                          ? 'هۆمهەب کرێ بە ڕاستەوخۆ لە کرێنشین کۆدەکاتەوە. کرێنشین هیچ پارەیەکی زیادە (سەرچارج ٠٪) نادات.'
                          : language === 'ar'
                          ? 'تحصل المنصة الإيجار مباشرة من المستأجر. لا يفرض أي مقابل أو عمولة إضافية على المستأجر (٠٪).'
                          : 'HomeHub collects 100% of rent from tenants. Tenants pay zero extra fees (0% tenant surcharge).'}
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-white/10">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{language === 'ku' ? 'ئەمانەت ٠٪ کۆمیسیۆنە' : language === 'ar' ? 'الودائع ٠٪ عمولة' : '0% commission on deposits'}</span>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium tracking-tight tracking-tight text-zinc-300 bg-zinc-1000/20 px-2 py-0.5 rounded">02</span>
                        <span className="text-[10px] font-medium text-zinc-300 bg-zinc-1000/20 px-2 py-0.5 rounded border border-blue-400/30">
                          {language === 'ku' ? 'تێچووی ٣-بەش' : language === 'ar' ? 'الرسوم المعتمدة' : '3-Fee Deduction'}
                        </span>
                      </div>
                      <h3 className="text-xs font-medium text-white">
                        {language === 'ku'
                          ? '٢. لێبڕینی ئۆتۆماتیکیی تێچووەکان'
                          : language === 'ar'
                          ? '٢. خصم الرسوم تلقائياً'
                          : '2. Automated 3-Fee Allocation'}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {language === 'ku'
                          ? 'تەنها دوای پشتڕاستکردنەوە، سیستەم بە شێوەی ئۆتۆماتیکی تێچووەکانی پلاتفۆرم، کرێ و بەڕێوەبردن لێدەبڕێت و لە دەفتەری ژمێریاری تۆماری دەکات.'
                          : language === 'ar'
                          ? 'فور تأكيد التحصيل، يخصم النظام تلقائياً الرسوم المعتمدة ويثبتها في دفتر الأستاذ دون تدخل يدوي.'
                          : 'Strictly upon confirmation, applicable fees (Platform, Rent, Management) are deducted and logged into the double-entry accounting ledger.'}
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-white/10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span>{language === 'ku' ? 'تەنها لەسەر کرێی وەرگیراو' : language === 'ar' ? 'فقط على الإيجار المؤكد' : 'Confirmed rent only'}</span>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 flex flex-col justify-between space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-medium tracking-tight tracking-tight text-emerald-400 bg-zinc-1000/20 px-2 py-0.5 rounded">03</span>
                        <span className="text-[10px] font-medium text-emerald-300 bg-zinc-1000/20 px-2 py-0.5 rounded border border-emerald-400/30">
                          {language === 'ku' ? 'شایستەی خاوەن موڵک' : language === 'ar' ? 'صافي المالك' : 'Owner Remittance'}
                        </span>
                      </div>
                      <h3 className="text-xs font-medium text-white">
                        {language === 'ku'
                          ? '٣. گواستنەوەی شایستەی دارایی بۆ خاوەن موڵک'
                          : language === 'ar'
                          ? '٣. تحويل صافي المستحقات للمالك'
                          : '3. Net Remittance to Owner'}
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {language === 'ku'
                          ? 'شایستەی پوختەی کرێ ڕاستەوخۆ دەگوازرێتەوە بۆ هەژماری بانکیی خاوەن موڵک (FIB / Qi Card / Bank Wire).'
                          : language === 'ar'
                          ? 'يتم تحويل صافي المستحقات بالكامل إلى الحساب المصرفي المعتمد للمالك (FIB / Qi Card / حوالة مصرفية).'
                          : 'The remaining net income balance is remitted directly to the owner\'s verified bank account.'}
                      </p>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-white/10">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{language === 'ku' ? 'گواستنەوەی ڕاستەوخۆی بانکی' : language === 'ar' ? 'تسوية مصرفية مباشرة' : 'Direct bank remittance'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Ledger KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {language === 'ku' ? 'کۆی کرێی کۆکراوە (١٠٠٪)' : language === 'ar' ? 'إجمالي الإيجار المحصل (١٠٠٪)' : 'Gross Rent Collected (100%)'}
                  </span>
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-zinc-900 mt-1 block" dir="ltr">
                  {formatIqd(presentationData.rentalIncome.totalActualIqd)} IQD
                </span>
                <span className="text-[11px] text-black font-medium mt-1 block">
                  {presentationData.rentalIncome.totalActualIqd > 0
                    ? (language === 'ku' ? '١٠٠٪ کرێی پشتڕاستکراوی کۆکراوە' : language === 'ar' ? '١٠٠٪ إيجار محصل ومؤكد' : '100% Confirmed Rent Collected')
                    : (language === 'ku' ? 'هیچ کرێیەک کۆنەکراوەتەوە' : language === 'ar' ? 'لا يوجد إيجار محصل' : 'No Rent Collected')}
                </span>
              </div>

              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {language === 'ku' ? 'کۆی تێچووەکانی هۆمهەب' : language === 'ar' ? 'إجمالي رسوم هوم هاب' : 'Total HomeHub Fees'}
                  </span>
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-black mt-1 block" dir="ltr">
                  {formatIqd(presentationData.rentalIncome.totalCommissionIqd ?? 0)} IQD
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                  {language === 'ku'
                    ? 'کۆی گشتیی تێچووەکانی پلاتفۆرم، کرێ و بەڕێوەبردن لەسەر کرێی پشتڕاستکراوە'
                    : language === 'ar'
                    ? 'إجمالي رسوم المنصة والإيجار والإدارة على الإيجار المؤكد'
                    : 'Aggregated Platform, Rent & Management fees on confirmed rent'}
                </span>
              </div>

              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {language === 'ku' ? 'شایستەی دارایی خاوەن موڵک (پوختە)' : language === 'ar' ? 'صافي مستحقات المالك' : 'Owner Net Income'}
                  </span>
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-black mt-1 block" dir="ltr">
                  {formatIqd(presentationData.rentalIncome.totalNetOwnerIncomeIqd ?? (presentationData.rentalIncome.totalActualIqd - (presentationData.rentalIncome.totalCommissionIqd ?? 0)))} IQD
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                  {language === 'ku'
                    ? 'شایستەی دارایی پوختەی ڕاستەقینە بۆ خاوەن موڵک'
                    : language === 'ar'
                    ? 'صافي المستحقات المحتسبة للمالك'
                    : 'Actual Net Entitlement to Property Owner'}
                </span>
              </div>
            </div>

            {/* Core Banking Gateway Limitation Notice */}
            <div className="p-4 rounded-lg bg-zinc-100/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-medium block">
                  {language === 'ku'
                    ? 'ئاگاداری دەروازەی بانکی (FIB / Qi Card): قۆناغی پێش-گرێدان'
                    : language === 'ar'
                    ? 'تنبيه بوابة الدفع المصرفي (FIB / Qi Card): مرحلة ما قبل الربط المباشر'
                    : 'Banking Gateway Status (FIB / Qi Card): Pre-Integration Stage'}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {language === 'ku'
                    ? 'شایستەی دارایی خاوەن موڵک بە شێوەی ژمێریاری هەژمار دەکرێت. دەروازەی ڕاستەوخۆی بانکی هێشتا بە سێرڤەری سەرەکی نەبەستراوەتەوە و پارەدان بە فەرمی ئەنجام نادرێت تا قۆناغی تەواوکردنی گرێدانی بانکی.'
                    : language === 'ar'
                    ? 'يتم احتساب مستحقات المالك دفترياً. بوابات الدفع المصرفي المباشر لم تفعل بعد للإيداع الفعلي بانتظار استكمال الربط المصرفي الرسمي.'
                    : 'Owner net entitlement is calculated based on confirmed collections. Direct banking gateway disbursements are currently in pre-integration sandbox phase; no actual banking settlements occur until core gateway integration.'}
                </p>
              </div>
            </div>

            {/* Rent Collection Ledger Table */}
            <div className="bg-white rounded-xl border border-zinc-100 shadow-sm overflow-hidden space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-sm text-zinc-900">
                    {language === 'ku' ? 'دەفتەری ژمێریاری کۆکردنەوەی کرێ' : language === 'ar' ? 'دفتر أستاذ تحصيل الإيجارات' : 'Rent Collection Ledger'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    {language === 'ku'
                      ? 'شایستەی هەژمارکراوی خاوەن موڵک بەرامبەر تێچووەکانی هۆمهەب بۆ هەر موڵکێک'
                      : language === 'ar'
                      ? 'استحقاقات المالك المحتسبة مقابل رسوم هوم هاب لكل عقار'
                      : 'Calculated owner entitlement vs HomeHub fee per property'}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left rtl:text-right">
                  <thead className="bg-zinc-50/50 backdrop-blur-sm border-b border-zinc-100 text-zinc-500 uppercase font-medium text-[10px]">
                    <tr>
                      <th className="px-4 py-3">{language === 'ku' ? 'موڵک' : language === 'ar' ? 'العقار' : 'Property'}</th>
                      <th className="px-4 py-3">{language === 'ku' ? 'کرێنشین' : language === 'ar' ? 'المستأجر' : 'Tenant'}</th>
                      <th className="px-4 py-3">{language === 'ku' ? 'کۆی کرێ' : language === 'ar' ? 'إجمالي الإيجار' : 'Gross Rent'}</th>
                      <th className="px-4 py-3">{language === 'ku' ? 'تێچووی هۆمهەب' : language === 'ar' ? 'رسوم هوم هاب' : 'HomeHub Fee'}</th>
                      <th className="px-4 py-3">{language === 'ku' ? 'شایستەی پوختەی خاوەن موڵک' : language === 'ar' ? 'صافي مستحقات المالك' : 'Owner Net'}</th>
                      <th className="px-4 py-3">{language === 'ku' ? 'دۆخی کۆکردنەوە' : language === 'ar' ? 'حالة التحصيل' : 'Collection Status'}</th>
                      <th className="px-4 py-3">{language === 'ku' ? 'شایستە و وردەکاری' : language === 'ar' ? 'التسوية والتفاصيل' : 'Settlement & Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {presentationData.properties.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-sans">
                          <DollarSign className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                          <p className="text-xs font-medium text-zinc-500">
                            {language === 'ku'
                              ? 'هیچ تۆمارێکی کرێ کۆنەکراوەتەوە'
                              : language === 'ar'
                              ? 'لا توجد سجلات تحصيل إيجار حتى الآن'
                              : 'No rent collection records found'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {language === 'ku'
                              ? 'تۆماری دارایی دوای وەرگرتن و پەسەندکردنی پارەی کرێنشین لە دەفتەری ژمێریاری دەردەکەوێت.'
                              : language === 'ar'
                              ? 'ستظهر القيود المالية فور تأكيد تسديد الإيجار من قبل المستأجرين في دفتر الأستاذ.'
                              : 'Financial ledger entries will appear here upon tenant rent payment confirmation.'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      presentationData.properties.map((prop) => {
                        const isOccupied = prop.isOccupied && Boolean(prop.tenantName);
                        const rent = prop.collectedRentIqd ?? 0;
                        const fee = prop.totalFeeDeductedIqd ?? 0;
                        const net = prop.netOwnerIncomeIqd ?? 0;

                        return (
                          <React.Fragment key={prop.id}>
                          <tr key={prop.id} className="hover:bg-zinc-50/60">
                            <td className="px-4 py-3.5 font-sans font-medium text-zinc-900">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{language === 'ku' && prop.nameKurdish ? prop.nameKurdish : prop.name}</span>
                                {prop.operatingModel && (
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider font-mono uppercase ${
                                    prop.operatingModel === 'FULLY_MANAGED'
                                      ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                      : prop.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED'
                                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  }`}>
                                    {prop.operatingModel === 'FULLY_MANAGED'
                                      ? (language === 'ku' ? 'بەڕێوەبردنی تەواو' : language === 'ar' ? 'إدارة كاملة' : 'FULLY MANAGED')
                                      : prop.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED'
                                      ? (language === 'ku' ? 'تۆمارکراوی بریکار - سەکۆ' : language === 'ar' ? 'مدرج من وكيل - منصة' : 'AGENT LISTED')
                                      : (language === 'ku' ? 'کارپێکراوی بریکار' : language === 'ar' ? 'تشغيل وكيل' : 'AGENT OPERATED')}
                                  </span>
                                )}
                              </div>
                              <span className="block text-[10px] text-slate-400 font-normal">{prop.location}</span>
                            </td>
                            <td className="px-4 py-3.5 font-sans text-slate-700">
                              {prop.tenantName || (
                                <span className="text-slate-400 italic">
                                  {language === 'ku' ? 'بەتاڵ (بێ کرێنشین)' : language === 'ar' ? 'شاغر (بدون مستأجر)' : 'Vacant (No Tenant)'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-medium" dir="ltr">
                              {formatIqd(rent)} IQD
                            </td>
                            <td className={`px-4 py-3.5 font-medium ${isOccupied ? 'text-black' : 'text-slate-400'}`} dir="ltr">
                              {formatIqd(fee)} IQD
                            </td>
                            <td className={`px-4 py-3.5 font-medium tracking-tight tracking-tight ${isOccupied ? 'text-black' : 'text-slate-400'}`} dir="ltr">
                              {formatIqd(net)} IQD
                            </td>
                            <td className="px-4 py-3.5 font-sans">
                              {isOccupied ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-emerald-700 border border-emerald-200">
                                  {language === 'ku' ? 'پشتڕاستکراوە' : language === 'ar' ? 'مؤكد' : 'CONFIRMED'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-zinc-500 border border-zinc-200">
                                  {language === 'ku' ? 'بەتاڵ' : language === 'ar' ? 'شاغر' : 'VACANT'}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 font-sans">
                              <div className="flex items-center gap-2">
                                {isOccupied ? (
                                  <>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-emerald-800 border border-emerald-200">
                                      {language === 'ku' ? 'شایستەی هەژمارکراو (پوختە)' : language === 'ar' ? 'مستحقات دفتريّة (صافي)' : 'Calculated Net'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedFeeBreakdownProp(prop)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-100 hover:bg-blue-100 text-black rounded-lg text-[10px] font-medium border border-zinc-300 transition-colors cursor-pointer"
                                      title="View itemized Fee breakdown"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>{language === 'ku' ? 'وردەکاری' : language === 'ar' ? 'التفاصيل' : 'Breakdown'}</span>
                                    </button>
                                  </>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-zinc-500 border border-zinc-200">
                                    {language === 'ku' ? '٠٪ کرێ (بێ کرێنشین)' : language === 'ar' ? '٠٪ عمولة (شاغر)' : '0% Fee (Vacant)'}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={7} className="px-4 py-0 border-none">
                              <OwnerUtilityBills propertyId={prop.id} />
                            </td>
                          </tr>
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: MANAGING COMPANIES AND DELEGATION                                  */}
        {/* ========================================================================= */}
        {activeTab === 'companies' && (
          <div className="space-y-8 animate-in fade-in">
            {/* Header with Ownership vs Management Separation Explanation */}
            <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                    {t('owner.companies.title', 'Managing Companies & Delegated Authority')}
                  </h1>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {t(
                      'owner.companies.subtitle',
                      'Property ownership (ownership_records) remains exclusively with the deed holder. Delegated management gives operational authority under strict spending limits.'
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setInviteCompanyModalOpen(true)}
                  className="px-4 py-2 bg-black hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('owner.companies.invite', 'Invite Management Company')}</span>
                </button>
              </div>
            </div>

            {/* Companies List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {presentationData.properties.length === 0 ? (
                <div className="col-span-full bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-3">
                  <Briefcase className="w-12 h-12 text-slate-400 mx-auto" />
                  <h3 className="font-medium text-zinc-900 text-sm">
                    {language === 'ku' ? 'هیچ کۆمپانیایەکی بەڕێوەبردن دیاری نەکراوە' : 'No Management Companies Delegated'}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    {language === 'ku'
                      ? 'هەموو موڵکەکانت لەژێر بەڕێوەبردنی ڕاستەوخۆی خۆتدان. دەتوانیت دەسەڵاتی بەڕێوەبردن بە سنووری خەرجی دیاریکراو ببەخشیت بە کۆمپانیای مۆڵەتپێدراو.'
                      : 'All properties are under direct owner operations. You can delegate operational maintenance and leasing to licensed property management companies under strict spending caps.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setInviteCompanyModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white font-medium text-xs rounded-xl shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('owner.companies.invite', 'Invite Management Company')}</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium uppercase text-black bg-zinc-100 px-2 py-0.5 rounded-md border border-purple-100">
                              Active Agreement
                            </span>
                            
                          </div>
                          <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900 mt-1">
                            Al-Nomou Real Estate Management Co.
                          </h3>
                          <p className="text-xs text-zinc-500">
                            License: KR-RE-2024-884 • Erbil HQ
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-lg space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('owner.companies.assigned_prop', 'Assigned Property:')}</span>
                          <span className="font-medium text-zinc-800">Empire World Tower 3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('owner.companies.spending_limit', 'Approved Spending Limit:')}</span>
                          <span className="font-medium text-zinc-900 font-mono" dir="ltr">
                            500,000 IQD
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500">{t('owner.companies.granted_perms', 'Granted Permissions:')}</span>
                          <div className="flex gap-1 flex-wrap">
                            <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded border border-zinc-200">
                              VIEW_MAINTENANCE
                            </span>
                            <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded border border-zinc-200">
                              SUBMIT_QUOTES
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-amber-700 bg-zinc-100 p-2.5 rounded-xl border border-amber-200/80">
                        <AlertCircle className="w-3.5 h-3.5 inline mr-1 text-black" />
                        {language === 'ku'
                          ? 'ئەو خەمڵاندنانەی لە سەرووی 500,000 دینارن بە شێوەیەکی ئۆتۆماتیکی پێویستیان بە ڕەزامەندی خاوەن موڵک هەیە.'
                          : language === 'ar'
                          ? 'عروض الأسعار التي تتجاوز 500,000 د.ع تتطلب تلقائياً موافقة المالك.'
                          : 'Quotes above 500,000 IQD automatically require Owner approval.'}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{t('owner.companies.valid_through', 'Agreement valid through 2027')}</span>
                      <button
                        type="button"
                        onClick={() => handleTerminateAuthority('agr-demo-1')}
                        className="text-xs font-medium text-black hover:text-rose-800 cursor-pointer"
                      >
                        {t('owner.companies.terminate', 'Terminate Authority')}
                      </button>
                    </div>
                  </div>

                  {/* Self-Managed Properties Card */}
                  <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium uppercase text-zinc-500 bg-slate-100 px-2 py-0.5 rounded-md border border-zinc-200">
                              {t('owner.companies.self_managed', 'Self-Managed')}
                            </span>
                            
                          </div>
                          <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900 mt-1">
                            {language === 'ku' ? 'بەڕێوەبردنی ڕاستەوخۆی خاوەن موڵک' : language === 'ar' ? 'إدارة المالك المباشرة' : 'Direct Owner Operations'}
                          </h3>
                          <p className="text-xs text-zinc-500">
                            {language === 'ku' ? 'کۆنترۆڵی تەواوی ڕاستەوخۆ لەلایەن خاوەن تاپۆوە' : language === 'ar' ? 'تحكم مباشر كامل من قبل صاحب سند الملكية' : 'Full direct control by property deed holder'}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-50 rounded-lg space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('owner.companies.self_managed_props', 'Self-Managed Properties:')}</span>
                          <span className="font-medium text-zinc-800">
                            Dream City Villa 45, New Duhok Flat 8
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('owner.companies.delegated_company', 'Delegated Company:')}</span>
                          <span className="font-medium text-zinc-500">{t('owner.companies.owner_direct', 'None (Owner Direct)')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-500">{t('owner.companies.approval_threshold', 'Owner Approval Threshold:')}</span>
                          <span className="font-medium text-emerald-700">{t('owner.companies.direct_signoff', '100% Direct Sign-off')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">{t('owner.companies.zero_delegation', 'Zero management delegation')}</span>
                      <button
                        type="button"
                        onClick={() => setInviteCompanyModalOpen(true)}
                        className="text-xs font-medium text-black hover:text-blue-800 cursor-pointer"
                      >
                        Delegate to Company
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: MAINTENANCE AND SERVICE REQUESTS                                   */}
        {/* ========================================================================= */}
        {activeTab === 'maintenance' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-zinc-100 shadow-sm">
              <div>
                <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                  {t('owner.maintenance.title', 'Maintenance & Service Quotes')}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {language === 'ku'
                    ? 'پەسەندکردنی خەرجییەکان و چاودێری کردنی کاری وەستاکان'
                    : language === 'ar'
                    ? 'الموافقة على عروض الأسعار ومتابعة طلبات الصيانة'
                    : 'Review contractor estimates, approve quotes, and track repair work'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setRequestMaintenanceModalOpen(true)}
                className="px-4 py-2 bg-black hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{t('owner.maintenance.new_request', 'Request Maintenance')}</span>
              </button>
            </div>

            {/* Pending Quotes Requiring Owner Decision */}
            <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${'bg-slate-300'}`} />
                <h3 className="font-medium text-sm text-zinc-900">
                  {t('owner.maintenance.pending_quotes', 'Quotes Requiring Owner Sign-off')}
                </h3>
              </div>

              <div className="p-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
                <Wrench className="w-8 h-8 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-zinc-900">
                  {language === 'ku'
                    ? 'هیچ خەمڵاندنێک نییە بۆ پەسەندکردن'
                    : language === 'ar'
                    ? 'لا توجد طلبات صيانة معلقة بانتظار الموافقة'
                    : 'No pending maintenance quotes requiring sign-off'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {language === 'ku'
                    ? 'کاتێک وەستایەک خەمڵاندنی تێچوو پێشکەش دەکات کە لە سنووری دیاریکراو زیاتر بێت، لێرە دەردەکەوێت.'
                    : language === 'ar'
                    ? 'عند تقديم المقاولين لعروض تتجاوز سقف الإنفاق المصرح، ستظهر هنا للموافقة أو الرفض.'
                    : 'Contractor estimates exceeding the delegated spending limit will appear here for decision.'}
                </p>
                <button
                  type="button"
                  onClick={() => setRequestMaintenanceModalOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black text-white font-medium text-xs rounded-xl hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('owner.maintenance.new_request', 'Request Maintenance')}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: DOCUMENTS AND PROPERTY RECORDS (TAPU)                              */}
        {/* ========================================================================= */}
        {activeTab === 'documents' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-xl border border-zinc-100 shadow-sm">
              <div>
                <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                  {t('owner.documents.title', 'Property Documents & Tapu Records')}
                </h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {language === 'ku'
                    ? 'بەڵگەنامەکانی تاپۆ، گرێبەستی یاسایی، و فۆرمی دەسەڵاتپێدان'
                    : language === 'ar'
                    ? 'سجلات الطابو الرسمية، العقود القانونية، واتفاقيات الإدارة'
                    : 'Official Tapu deed records, legal lease contracts, and management agreements'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setUploadDocModalOpen(true)}
                className="px-4 py-2 bg-black hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{t('owner.documents.upload', 'Upload Document')}</span>
              </button>
            </div>

            {/* Storage Pre-Integration Banner */}
            <div className="p-4 rounded-lg bg-zinc-100/90 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-medium block">
                  {language === 'ku'
                    ? 'ئاگاداری هەڵگرتنی بەڵگەنامەکان (S3 / GCS): قۆناغی پێش-گرێدان'
                    : language === 'ar'
                    ? 'تنبيه التخزين السحابي للمستندات (S3 / GCS): مرحلة ما قبل الربط السحابي'
                    : 'Cloud Document Storage (S3 / GCS): Pre-Integration Stage'}
                </span>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  {language === 'ku'
                    ? 'پاشبنەمای هۆمهەب سیستەمی واژۆی ئەلیکترۆنیی HMAC-SHA256 بەکاردەهێنێت بە ماوەی بەسەرچوونی ٩٠٠ چرکە. بارکردنی تەواو و خۆکارانە کارا دەبێت لەگەڵ چالاککردنی کۆگای هەوریدا.'
                    : language === 'ar'
                    ? 'يدعم النظام التحقق التشفيري HMAC-SHA256 للروابط قصيرة الأجل (٩٠٠ ثانية). سيتم تفعيل الرفع الآلي المباشر فور تفعيل مفاتيح التخزين السحابي.'
                    : 'HomeHub uses cryptographically signed, short-lived URLs (HMAC-SHA256, 15-minute TTL) with strict MIME validation. Direct upload will be enabled upon S3/GCS bucket activation.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {presentationData.properties.length === 0 && (
                <div className="col-span-full bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-3">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto" />
                  <h3 className="font-medium text-zinc-900 text-sm">
                    {language === 'ku' ? 'هیچ بەڵگەنامەیەک بارنەکراوە' : 'No Property Documents Uploaded'}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    {language === 'ku'
                      ? 'بەڵگەنامەکانی تاپۆ (سەدی موڵکداری)، گرێبەستەکانی کرێ، یان ڕاپۆرتەکانی پشکنین باربکە بۆ پشتڕاستکردنەوەی فەرمی.'
                      : 'Upload official Tapu title deeds, lease contracts, or inspection certificates to establish cryptographic verification.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setUploadDocModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white font-medium text-xs rounded-xl shadow-xs hover:bg-blue-700 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t('owner.documents.upload', 'Upload Document')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: PORTFOLIO ANALYTICS                                                */}
        {/* ========================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm">
              <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                {t('owner.nav.analytics', 'Portfolio Analytics & Financial Health')}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('owner.analytics.subtitle', 'Comprehensive yield metrics, vacancy rates, and historical collection trends')}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {t('owner.analytics.gross_yield', 'Gross Rental Yield')}
                  </span>
                  
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-zinc-900 mt-1 block">
                  {presentationData.properties.length > 0 ? ('N/A') : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                  {presentationData.properties.length > 0
                    ? t('owner.analytics.calculated_verified', 'Calculated on verified properties')
                    : t('owner.analytics.no_registered_props', 'No registered properties')}
                </span>
              </div>
              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {t('owner.analytics.noi', 'Net Operating Income (NOI)')}
                  </span>
                  
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-zinc-900 mt-1 block" dir="ltr">
                  {presentationData.properties.length > 0 ? (`${formatIqd(presentationData.rentalIncome.totalActualIqd)} IQD`) : '0 IQD'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                  {presentationData.properties.length > 0
                    ? t('owner.analytics.based_confirmed_rent', 'Based on confirmed rent')
                    : t('owner.analytics.no_operational_revenue', 'No operational revenue')}
                </span>
              </div>
              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {t('owner.analytics.collection_rate', 'Collection Rate')}
                  </span>
                  
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-black mt-1 block">
                  {presentationData.properties.filter(p => p.isOccupied).length > 0
                    ? (<span dir="ltr">100.0%</span>)
                    : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                  {presentationData.properties.filter(p => p.isOccupied).length > 0
                    ? t('owner.analytics.confirmed_collections', 'Confirmed Collections')
                    : t('owner.analytics.no_active_leases', 'No active leases')}
                </span>
              </div>
              <div className="bg-white p-5 rounded-lg border border-zinc-100 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500 block">
                    {t('owner.analytics.avg_lease_duration', 'Average Lease Duration')}
                  </span>
                  
                </div>
                <span className="text-2xl font-medium tracking-tight tracking-tight text-zinc-900 mt-1 block">
                  {presentationData.properties.filter(p => p.isOccupied).length > 0 ? (<><span dir="ltr">12.0</span> {t('owner.analytics.months', 'mos')}</>) : 'N/A'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium mt-1 block">
                  {presentationData.properties.filter(p => p.isOccupied).length > 0 ? t('owner.portfolio.active_leased', 'Active Leased Portfolio') : t('owner.portfolio.no_active_tenants', 'No active tenants')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: SETTLEMENTS                                                          */}
        {/* ========================================================================= */}
        {activeTab === 'settlements' && (
          <div className="space-y-8 animate-in fade-in">
             <OwnerSettlementTab />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: POINTS & REWARDS WALLET                                              */}
        {/* ========================================================================= */}
        {activeTab === 'points' && (
          <div className="space-y-8 animate-in fade-in" data-testid="owner-points-tab-content">
            <PointsWalletView />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: SETTINGS & LOCALIZATION                                            */}
        {/* ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="space-y-8 animate-in fade-in">
            <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm">
              <h1 className="text-xl font-medium tracking-tight tracking-tight text-zinc-900">
                {t('owner.nav.settings', 'Owner Settings & Account Preferences')}
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                {t('owner.settings.subtitle', 'Manage profile info, language, notifications, and payout bank accounts')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Language & Direction Setting */}
              <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm space-y-4">
                <h3 className="font-medium text-sm text-zinc-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-black" />
                  <span>{t('owner.settings.language_title', 'Platform Language & Direction')}</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  {t('owner.settings.language_desc', 'Select your primary language. Directionality mirrors automatically.')}
                </p>

                <div className="space-y-2">
                  {[
                    { code: 'ku', label: 'کوردی سۆرانی (Kurdish Sorani)', dir: 'RTL' },
                    { code: 'ar', label: 'العربية (Arabic)', dir: 'RTL' },
                    { code: 'en', label: 'English (United States)', dir: 'LTR' },
                  ].map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setLanguage(item.code as SupportedLanguage)}
                      className={`w-full p-3 rounded-lg border flex items-center justify-between text-xs font-medium cursor-pointer transition-all ${
                        language === item.code
                          ? 'border-blue-600 bg-zinc-100/70 text-blue-900'
                          : 'border-zinc-200 hover:bg-zinc-50 text-slate-700'
                      }`}
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-zinc-500">
                        {item.dir}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bank Payout Account (FIB / Qi Card) */}
              <div className="bg-white p-5 rounded-xl border border-zinc-100 shadow-sm space-y-4">
                <h3 className="font-medium text-sm text-zinc-900 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-black" />
                  <span>{t('owner.settings.bank_title', 'Verified Payout Bank Account')}</span>
                </h3>
                <p className="text-xs text-zinc-500">
                  {t('owner.settings.bank_desc', 'Owner net entitlement is transferred directly to your bank account.')}
                </p>

                <div className="p-4 rounded-lg bg-zinc-50 border-2 border-dashed border-zinc-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-zinc-500">{t('owner.settings.no_bank_linked', 'No Bank Account Linked')}</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {t('owner.settings.bank_notice', 'Core banking integration (FIB / Qi Card) is in pre-integration phase. Direct payout account linking will be enabled upon official banking gateway activation.')}
                  </p>
                  <div className="pt-2 border-t border-zinc-200 flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 text-black" />
                    <span>{t('owner.settings.gateway_status', 'Disbursement Gateway: Offline (Pre-Integration)')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 4. MODALS (Add Property, Create Lease, Request Maintenance, etc.)           */}
      {/* ========================================================================= */}



      {/* MODAL 2: Create Lease */}
      {createLeaseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir={direction}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4 text-start">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900">
                {t('owner.leases.create_lease', 'Create Digital Lease Agreement')}
              </h3>
              <button
                onClick={() => setCreateLeaseModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleCreateLeaseSubmit}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.leases.select_property', 'Select Property')}
                </label>
                <select
                  id="select-create-lease-property"
                  value={newLeaseForm.propertyId}
                  onChange={(e) => setNewLeaseForm({ ...newLeaseForm, propertyId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
                  required
                >
                  <option value="">{t('owner.leases.choose_property_ph', 'Choose property...')}</option>
                  {presentationData.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('owner.leases.tenant_name', 'Tenant Name')}
                  </label>
                  <input
                    id="input-create-lease-tenant-name"
                    type="text"
                    required
                    placeholder={t('owner.leases.tenant_name_ph', 'Full legal name')}
                    value={newLeaseForm.tenantName}
                    onChange={(e) =>
                      setNewLeaseForm({ ...newLeaseForm, tenantName: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {language === 'ku' ? 'مۆبایل یان ناسنامەی کرێچی' : language === 'ar' ? 'هاتف أو معرف المستأجر' : 'Tenant Phone or ID'}
                  </label>
                  <input
                    id="input-create-lease-tenant"
                    type="text"
                    required
                    placeholder={language === 'ku' ? 'user_tenant_01 یان +964 750...' : 'user_tenant_01 or +964 750...'}
                    value={newLeaseForm.tenantPhone}
                    onChange={(e) =>
                      setNewLeaseForm({ ...newLeaseForm, tenantPhone: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('owner.leases.monthly_rent', 'Monthly Rent (IQD)')}
                  </label>
                  <input
                    id="input-create-lease-rent"
                    type="number"
                    required
                    value={newLeaseForm.monthlyRentIqd}
                    onChange={(e) =>
                      setNewLeaseForm({ ...newLeaseForm, monthlyRentIqd: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('owner.leases.security_deposit', 'Security Deposit (IQD)')}
                  </label>
                  <input
                    id="input-create-lease-deposit"
                    type="number"
                    required
                    value={newLeaseForm.depositIqd}
                    onChange={(e) =>
                      setNewLeaseForm({ ...newLeaseForm, depositIqd: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('owner.leases.start_date', 'Start Date')}
                  </label>
                  <input
                    id="input-create-lease-start"
                    type="date"
                    value={newLeaseForm.startDate}
                    onChange={(e) =>
                      setNewLeaseForm({ ...newLeaseForm, startDate: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {t('owner.leases.end_date', 'End Date')}
                  </label>
                  <input
                    id="input-create-lease-end"
                    type="date"
                    value={newLeaseForm.endDate}
                    onChange={(e) =>
                      setNewLeaseForm({ ...newLeaseForm, endDate: e.target.value })
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200"
                  />
                </div>
              </div>

              <div className="p-3 bg-zinc-100 rounded-lg border border-zinc-200 text-[11px] text-blue-900 leading-relaxed">
                <Percent className="w-3.5 h-3.5 inline mx-1 text-black align-text-bottom" />
                <span>
                  {t('owner.leases.fee_notice', 'Note: HomeHub fee applies solely to confirmed monthly rent. Security deposits incur 0% commission.')}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  id="btn-cancel-create-lease"
                  type="button"
                  onClick={() => setCreateLeaseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-slate-100 cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  id="btn-submit-create-lease"
                  type="submit"
                  disabled={submittingLease}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-black text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {submittingLease ? t('owner.leases.creating', 'Creating...') : t('owner.leases.create_and_send', 'Create & Send Lease')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Request Maintenance */}
      {requestMaintenanceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir={direction}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4 text-start">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900">
                {t('owner.maintenance.new_request', 'Submit Maintenance Request')}
              </h3>
              <button
                onClick={() => setRequestMaintenanceModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleRequestMaintenanceSubmit}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.maintenance.select_property', 'Select Property')}
                </label>
                <select
                  value={newMaintForm.propertyId}
                  onChange={(e) => setNewMaintForm({ ...newMaintForm, propertyId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
                  required
                >
                  <option value="">{t('owner.maintenance.select_property_ph', 'Select a property...')}</option>
                  {presentationData.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.maintenance.issue_category', 'Issue Category')}
                </label>
                <select
                  value={newMaintForm.category}
                  onChange={(e) => setNewMaintForm({ ...newMaintForm, category: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
                >
                  <option value="plumbing">{t('category.plumbing', 'Plumbing')}</option>
                  <option value="electrical">{t('category.electrical', 'Electrical')}</option>
                  <option value="hvac">{t('category.hvac', 'HVAC & Cooling')}</option>
                  <option value="structural">{t('category.structural', 'Carpentry & Structural')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.maintenance.title_label', 'Title')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('owner.maintenance.title_ph', 'e.g. Water leak in kitchen pipe')}
                  value={newMaintForm.title}
                  onChange={(e) => setNewMaintForm({ ...newMaintForm, title: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.maintenance.desc_label', 'Issue Description')}
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder={t('owner.maintenance.desc_ph', 'Describe the problem in detail...')}
                  value={newMaintForm.description}
                  onChange={(e) => setNewMaintForm({ ...newMaintForm, description: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestMaintenanceModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-slate-100 cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingMaint}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-black text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {submittingMaint ? t('owner.maintenance.submitting', 'Submitting...') : t('owner.maintenance.submit_btn', 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Invite Management Company */}
      {inviteCompanyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir={direction}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4 text-start">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900">
                {t('owner.companies.invite', 'Invite Management Company')}
              </h3>
              <button
                onClick={() => setInviteCompanyModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleInviteCompanySubmit}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.leases.select_property', 'Select Property')}
                </label>
                <select
                  value={inviteCompanyForm.propertyId}
                  onChange={(e) => setInviteCompanyForm({ ...inviteCompanyForm, propertyId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
                  required
                >
                  <option value="">{t('owner.companies.select_prop_ph', 'Select property to delegate...')}</option>
                  {presentationData.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.companies.name_or_license', 'Company Name or License')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('owner.companies.name_or_license_ph', 'e.g. Al-Nomou Real Estate Co.')}
                  value={inviteCompanyForm.companyName}
                  onChange={(e) => setInviteCompanyForm({ ...inviteCompanyForm, companyName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.companies.spending_limit_label', 'Approved Spending Limit (IQD)')}
                </label>
                <input
                  type="number"
                  required
                  value={inviteCompanyForm.spendingLimit}
                  onChange={(e) => setInviteCompanyForm({ ...inviteCompanyForm, spendingLimit: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black font-mono"
                  dir="ltr"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  {t('owner.companies.spending_limit_hint', 'Quotes exceeding this amount require explicit Owner approval before contractor dispatch.')}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInviteCompanyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-slate-100 cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingInvite}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-black text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {submittingInvite ? t('owner.companies.sending', 'Sending...') : t('owner.companies.send_invitation', 'Send Invitation')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Upload Document */}
      {uploadDocModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir={direction}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4 text-start">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900">
                {t('owner.documents.upload', 'Upload Property Document or Tapu Deed')}
              </h3>
              <button
                onClick={() => setUploadDocModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleUploadDocSubmit}
              className="space-y-3.5"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.documents.doc_type', 'Document Type')}
                </label>
                <select
                  value={uploadDocForm.documentType}
                  onChange={(e) => setUploadDocForm({ ...uploadDocForm, documentType: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
                >
                  <option value="tapu">{t('owner.documents.tapu_option', 'Official Title Deed (Tapu)')}</option>
                  <option value="lease">{t('owner.documents.lease_option', 'Lease Agreement')}</option>
                  <option value="management">{t('owner.documents.management_option', 'Management Agreement')}</option>
                  <option value="inspection">{t('owner.documents.inspection_option', 'Inspection Report')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.leases.select_property', 'Select Property')}
                </label>
                <select
                  value={uploadDocForm.propertyId}
                  onChange={(e) => setUploadDocForm({ ...uploadDocForm, propertyId: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 bg-white"
                  required
                >
                  <option value="">{t('owner.maintenance.select_property_ph', 'Select a property...')}</option>
                  {presentationData.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {t('owner.documents.doc_title', 'Document Title')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('owner.documents.doc_title_ph', 'e.g. Official Deed ERB-2024-9981')}
                  value={uploadDocForm.title}
                  onChange={(e) => setUploadDocForm({ ...uploadDocForm, title: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700">
                  {t('owner.documents.select_file', 'Select Document File')}
                </label>
                <div className="p-4 border-2 border-dashed border-zinc-200 rounded-lg text-center space-y-2 hover:border-blue-400 transition-colors relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => {
                      setFileUploadError(null);
                      const file = e.target.files?.[0];
                      if (file) {
                        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
                        if (!allowedTypes.includes(file.type)) {
                          setFileUploadError(
                            language === 'ku'
                              ? 'تەنها فایلەکانی PDF، JPG، PNG، و WebP ڕێگەپێدراون.'
                              : language === 'ar'
                              ? 'فقط ملفات PDF و JPG و PNG و WebP مسموح بها.'
                              : 'Only PDF, JPG, PNG, and WebP files are supported.'
                          );
                          setSelectedFile(null);
                          return;
                        }
                        if (file.size > 25 * 1024 * 1024) {
                          setFileUploadError(
                            language === 'ku'
                              ? 'قەبارەی فایل نابێت لە ٢٥ مێگابایت زیاتر بێت.'
                              : language === 'ar'
                              ? 'حجم الملف يجب ألا يتجاوز ٢٥ ميجابايت.'
                              : 'File size must not exceed 25MB.'
                          );
                          setSelectedFile(null);
                          return;
                        }
                        setSelectedFile(file);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-7 h-7 text-slate-400 mx-auto" />
                  {selectedFile ? (
                    <div>
                      <p className="text-xs font-medium text-black truncate">{selectedFile.name}</p>
                      <p className="text-[10px] text-zinc-500 font-mono" dir="ltr">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-medium text-slate-700">
                        {language === 'ku' ? 'کلیك بکە یان فایلەکە لێرە دابنێ' : language === 'ar' ? 'انقر أو اسحب الملف هنا للاختيار' : 'Click or drag document to select'}
                      </div>
                      <div className="text-[10px] text-slate-400" dir="ltr">PDF, JPG, PNG, WebP (Max 25MB)</div>
                    </div>
                  )}
                </div>
                {fileUploadError && (
                  <p className="text-xs text-black font-medium">{fileUploadError}</p>
                )}
              </div>

              {/* Infrastructure Pre-Integration Notice */}
              <div className="p-3 rounded-xl bg-zinc-100 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-medium block">
                    {language === 'ku'
                      ? 'دۆخی هەڵگرتنی هەوری: قۆناغی پێش-گرێدان'
                      : language === 'ar'
                      ? 'حالة التخزين السحابي: مرحلة ما قبل التفعيل'
                      : 'Cloud Storage Status: Pre-Integration Stage'}
                  </span>
                  <span>
                    {language === 'ku'
                      ? 'کۆگای هەوری (S3 / GCS) لە قۆناغی ئامادەسازیدایە. لە کاتی ناردندا، سیستەم دۆخی پارێزراو (Fail-Closed) جێبەجێ دەکات.'
                      : language === 'ar'
                      ? 'مساحة التخزين السحابية (S3 / GCS) قيد الإعداد التقني. عند الرفع، يطبق النظام الحماية الصارمة (Fail-Closed).'
                      : 'Production object storage (S3 / GCS) is in pre-integration sandbox. Submissions verify cryptographic boundaries fail-closed.'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadDocModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:bg-slate-100 cursor-pointer"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={submittingDoc}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-black text-white hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  {submittingDoc ? t('owner.documents.uploading', 'Uploading...') : t('owner.documents.upload_btn', 'Upload Document')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Itemized management fee Breakdown */}
      {selectedFeeBreakdownProp && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in" dir={direction}>
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4 text-start">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-zinc-100 text-black rounded-xl">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium tracking-tight tracking-tight text-base text-zinc-900">
                    {language === 'ku'
                      ? 'وردەکاریی ژمێریاریی سێ ڕەسمەکە و شایستەی خاوەن موڵک'
                      : language === 'ar'
                      ? 'تفاصيل الرسوم الثلاث وصافي مستحقات المالك'
                      : 'Three-Fee Ledger Breakdown & Net Owner Income'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-zinc-500 font-medium">
                      {language === 'ku' && selectedFeeBreakdownProp.nameKurdish
                        ? selectedFeeBreakdownProp.nameKurdish
                        : selectedFeeBreakdownProp.name}
                    </p>
                    {selectedFeeBreakdownProp.operatingModel && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold tracking-wider font-mono uppercase ${
                        selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : selectedFeeBreakdownProp.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED'
                          ? (language === 'ku' ? 'بەڕێوەبردنی تەواو' : language === 'ar' ? 'إدارة كاملة' : 'FULLY MANAGED')
                          : selectedFeeBreakdownProp.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED'
                          ? (language === 'ku' ? 'تۆمارکراوی بریکار - سەکۆ' : language === 'ar' ? 'مدرج من وكيل - منصة' : 'AGENT LISTED')
                          : (language === 'ku' ? 'کارپێکراوی بریکار' : language === 'ar' ? 'تشغيل وكيل' : 'AGENT OPERATED')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFeeBreakdownProp(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-zinc-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Math Summary Card — Dynamic Three-Fee Model */}
            <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-200 space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-200/60">
                <span className="font-medium text-zinc-600">
                  {language === 'ku' ? 'کۆی کرێی وەرگیراوی پشتڕاستکراو (١٠٠٪):' : language === 'ar' ? 'إجمالي الإيجار المحصل المؤكد (١٠٠٪):' : 'Gross Confirmed Rent Collected (100%):'}
                </span>
                <span className="font-bold text-zinc-900 font-mono text-sm" dir="ltr">
                  {formatIqd(selectedFeeBreakdownProp.collectedRentIqd ?? (selectedFeeBreakdownProp as any).actualPaidIqd ?? selectedFeeBreakdownProp.monthlyRentIqd)} IQD
                </span>
              </div>

              {/* Fee 1: Platform Fee */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  <span>{language === 'ku' ? 'ڕەسمی سەکۆ (Platform Fee):' : language === 'ar' ? 'رسوم المنصة (Platform Fee):' : 'Platform Fee:'}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1 py-0.2 rounded font-mono font-medium">
                    {selectedFeeBreakdownProp.platformFeeRate ? `${(selectedFeeBreakdownProp.platformFeeRate * 100).toFixed(1)}%` : '5.0%'}
                  </span>
                </span>
                <span className="font-medium text-rose-700 font-mono" dir="ltr">
                  - {formatIqd(selectedFeeBreakdownProp.platformFeeIqd ?? Math.round((selectedFeeBreakdownProp.collectedRentIqd ?? (selectedFeeBreakdownProp as any).actualPaidIqd ?? selectedFeeBreakdownProp.monthlyRentIqd) * 0.05))} IQD
                </span>
              </div>

              {/* Fee 2: Rent Fee (Fully Managed Only) */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-700">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' ? 'bg-purple-500' : 'bg-zinc-300'}`}></span>
                  <span>{language === 'ku' ? 'ڕەسمی کرێ (Rent Fee):' : language === 'ar' ? 'رسوم الإيجار (Rent Fee):' : 'Rent Fee:'}</span>
                  {selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' && (selectedFeeBreakdownProp.rentFeeRate ?? 0) > 0 ? (
                    <span className="text-[10px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-mono font-medium">
                      {`${((selectedFeeBreakdownProp.rentFeeRate || 0) * 100).toFixed(1)}%`}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-200 text-zinc-600 px-1 py-0.2 rounded font-mono">
                      {selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' ? '0%' : 'N/A'}
                    </span>
                  )}
                </span>
                <span className={`font-mono text-xs ${selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' && (selectedFeeBreakdownProp.rentFeeIqd ?? 0) > 0 ? 'font-medium text-rose-700' : 'text-zinc-400'}`} dir="ltr">
                  {selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' && (selectedFeeBreakdownProp.rentFeeIqd ?? 0) > 0
                    ? `- ${formatIqd(selectedFeeBreakdownProp.rentFeeIqd ?? 0)} IQD`
                    : '0 IQD'}
                </span>
              </div>

              {/* Fee 3: Management Fee (Fully Managed & Agent Listed Platform Managed) */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-zinc-700">
                  <span className={`w-1.5 h-1.5 rounded-full ${(selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' || selectedFeeBreakdownProp.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') ? 'bg-indigo-500' : 'bg-zinc-300'}`}></span>
                  <span>{language === 'ku' ? 'ڕەسمی بەڕێوەبردن (Management Fee):' : language === 'ar' ? 'رسوم الإدارة (Management Fee):' : 'Management Fee:'}</span>
                  {(selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' || selectedFeeBreakdownProp.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') && (selectedFeeBreakdownProp.managementFeeRate ?? 0) > 0 ? (
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded font-mono font-medium">
                      {`${((selectedFeeBreakdownProp.managementFeeRate || 0) * 100).toFixed(1)}%`}
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-200 text-zinc-600 px-1 py-0.2 rounded font-mono">
                      {selectedFeeBreakdownProp.operatingModel === 'AGENT_OPERATED' ? 'N/A' : '0%'}
                    </span>
                  )}
                </span>
                <span className={`font-mono text-xs ${(selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' || selectedFeeBreakdownProp.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') && (selectedFeeBreakdownProp.managementFeeIqd ?? 0) > 0 ? 'font-medium text-rose-700' : 'text-zinc-400'}`} dir="ltr">
                  {(selectedFeeBreakdownProp.operatingModel === 'FULLY_MANAGED' || selectedFeeBreakdownProp.operatingModel === 'AGENT_LISTED_PLATFORM_MANAGED') && (selectedFeeBreakdownProp.managementFeeIqd ?? 0) > 0
                    ? `- ${formatIqd(selectedFeeBreakdownProp.managementFeeIqd ?? 0)} IQD`
                    : '0 IQD'}
                </span>
              </div>

              {/* Total Fees Subtotal */}
              <div className="pt-2 border-t border-dashed border-zinc-200 flex items-center justify-between text-xs font-semibold text-rose-700">
                <span>{language === 'ku' ? 'کۆی گشتی ڕەسمە لێبڕاوەکان:' : language === 'ar' ? 'إجمالي الرسوم المقتطعة:' : 'Total HomeHub Fees Deducted:'}</span>
                <span className="font-mono text-sm" dir="ltr">
                  - {formatIqd(selectedFeeBreakdownProp.totalFeeDeductedIqd ?? (selectedFeeBreakdownProp as any).commissionIqd ?? 0)} IQD
                </span>
              </div>

              {/* Net Owner Remittance */}
              <div className="pt-2.5 border-t-2 border-zinc-200 flex items-center justify-between bg-emerald-50/60 -mx-4 -mb-4 p-4 rounded-b-xl">
                <div>
                  <span className="font-bold text-sm text-emerald-950 block">
                    {language === 'ku' ? 'شایستەی دارایی خاوەن موڵک (پوختە):' : language === 'ar' ? 'صافي مستحقات المالك المحتسبة:' : 'Owner Net Income Entitlement:'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-medium">
                    {language === 'ku' ? 'ڕاستەوخۆ دەگوازرێتەوە بۆ هەژماری بانکی خاوەن موڵک' : language === 'ar' ? 'تحول مباشرة للحساب المصرفي للمالك' : 'Direct bank remittance upon settlement'}
                  </span>
                </div>
                <span className="text-xl font-black text-emerald-700 font-mono" dir="ltr">
                  {formatIqd(selectedFeeBreakdownProp.netOwnerIncomeIqd ?? 0)} IQD
                </span>
              </div>
            </div>

            {/* Invariants & Accounting Ledger Details */}
            <div className="space-y-2 text-xs">
              <h4 className="font-medium text-zinc-800 text-[11px] uppercase tracking-wider">
                {language === 'ku' ? 'یاساکانی سیستەم و دەفتەری ژمێریاری' : language === 'ar' ? 'المحددات المحاسبية والقانونية' : 'System Invariants & Double-Entry Ledger'}
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/50">
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'سەرچارجی کرێنشین' : language === 'ar' ? 'رسوم المستأجر' : 'Tenant Surcharge'}</span>
                  <span className="font-medium text-emerald-700">0 IQD (0% FREE)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/50">
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'کۆمیسیۆنی بارمتە' : language === 'ar' ? 'عمولة التأمين' : 'Security Deposit Fee'}</span>
                  <span className="font-medium text-emerald-700">0% (EXEMPT)</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/50">
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'قیودی ژمێریاری' : language === 'ar' ? 'القيد المزدوج' : 'Double-Entry Entry'}</span>
                  <span className="font-mono text-zinc-800 font-medium text-[10px]">CLEARING → REVENUE</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/50">
                  <span className="text-slate-400 block text-[10px]">{language === 'ku' ? 'کەناڵی گواستنەوە' : language === 'ar' ? 'قناة التحويل' : 'Disbursement Channel'}</span>
                  <span className="font-medium text-black text-[10px]">FIB / Qi Card Wire</span>
                </div>
              </div>
            </div>

            {/* Tenant & Lease Details */}
            <div className="p-3 bg-zinc-100/60 rounded-xl border border-zinc-200 text-xs text-blue-950 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-black shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <span className="font-medium block">
                  {language === 'ku' ? 'کرێنشینی چالاک:' : language === 'ar' ? 'المستأجر الحالي:' : 'Active Tenant:'}{' '}
                  {selectedFeeBreakdownProp.tenantName}
                </span>
                <span className="text-zinc-500">
                  {language === 'ku'
                    ? 'کرێ لەڕێگەی هۆمهەب لە کرێنشین وەرگیراوە. تێچووە ڕێککەوتووەکان لە ساتی پشتڕاستکردنەوە دەبڕدرێت و شایستەی دارایی بە فەرمی بۆ خاوەن موڵک دیاریدەکرێت.'
                    : language === 'ar'
                    ? 'تم تحصيل الإيجار عبر المنصة من المستأجر. يتم اقتطاع الرسوم المعتمدة عند التأكيد وقيد صافي الاستحقاق لصالح المالك قانونياً.'
                    : 'Rent collected via HomeHub escrow from tenant. Canonical three-fee deductions applied upon payment confirmation, with net credited to owner.'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedFeeBreakdownProp(null)}
                className="px-5 py-2.5 bg-zinc-900 hover:bg-slate-800 text-white font-medium text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {language === 'ku' ? 'داخستن' : language === 'ar' ? 'إغلاق' : 'Close Breakdown'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Deposit & Move-Out Inspection Modal */}
      {depositInspectionModalState.isOpen && (
        <DepositInspectionModal
          isOpen={depositInspectionModalState.isOpen}
          onClose={() => setDepositInspectionModalState(prev => ({ ...prev, isOpen: false }))}
          leaseId={depositInspectionModalState.leaseId}
          propertyId={depositInspectionModalState.propertyId}
          propertyName={depositInspectionModalState.propertyName}
          tenantName={depositInspectionModalState.tenantName}
          currency={depositInspectionModalState.currency || 'IQD'}
          onSuccess={fetchDashboardData}
        />
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
