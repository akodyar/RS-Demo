import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ArrowLeft,
  ArrowRight,
  Lock,
  Edit3,
  Percent,
  Loader2,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminPropertyRecord } from '../../../types/admin';
import { AdminRoleType } from '../../../types';

interface AdminPropertiesModuleProps {
  properties?: AdminPropertyRecord[];
  currentRole: AdminRoleType;
  onUpdateTapuStatus: (propertyId: string, status: AdminPropertyRecord['tapuStatus'], reason: string) => void;
  onBack: () => void;
}

export const AdminPropertiesModule: React.FC<AdminPropertiesModuleProps> = ({
  properties: initialProperties = [],
  currentRole,
  onUpdateTapuStatus,
  onBack,
}) => {
  const { direction, t } = useI18n();

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [operatingModelFilter, setOperatingModelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verificationStatusFilter, setVerificationStatusFilter] = useState('all');

  // Inspection & Decision Modal state
  const [inspectingProperty, setInspectingProperty] = useState<AdminPropertyRecord | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Properties data state
  const [propertiesList, setPropertiesList] = useState<AdminPropertyRecord[]>(initialProperties);
  const [globalPlatformFee, setGlobalPlatformFee] = useState<number>(0.05);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fee Editing Modal state
  const [editingProperty, setEditingProperty] = useState<AdminPropertyRecord | null>(null);
  const [editRentFee, setEditRentFee] = useState<string>('');
  const [editRentFeeUnset, setEditRentFeeUnset] = useState<boolean>(false);
  const [editMgmtFee, setEditMgmtFee] = useState<string>('');
  const [editMgmtFeeUnset, setEditMgmtFeeUnset] = useState<boolean>(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  // Fetch paginated properties from authoritative server endpoint
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-super-admin'
          : localStorage.getItem('auth_token') || '';

      const queryParams = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (searchQuery.trim()) queryParams.set('search', searchQuery.trim());
      if (cityFilter !== 'all') queryParams.set('city', cityFilter);
      if (operatingModelFilter !== 'all') queryParams.set('operatingModel', operatingModelFilter);
      if (statusFilter !== 'all') queryParams.set('status', statusFilter);
      if (verificationStatusFilter !== 'all') queryParams.set('verificationStatus', verificationStatusFilter);

      const res = await fetch(`/api/admin/properties?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch properties from server');
      }

      const data = await res.json();
      if (Array.isArray(data.properties)) {
        setPropertiesList(data.properties);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalCount(data.pagination.total || data.properties.length);
        } else {
          setTotalCount(data.properties.length);
          setTotalPages(1);
        }
        if (data.globalPlatformFee !== undefined) {
          setGlobalPlatformFee(data.globalPlatformFee);
        }
      }
    } catch (err: any) {
      console.error('Admin properties fetch error:', err);
      setFetchError(err.message || 'Error loading properties');
      // If server fetch failed and initial properties exist, fallback gracefully
      if (initialProperties.length > 0 && propertiesList.length === 0) {
        setPropertiesList(initialProperties);
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, cityFilter, operatingModelFilter, statusFilter, verificationStatusFilter, initialProperties]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  // Open Fee Edit Modal
  const handleOpenEditFees = (prop: AdminPropertyRecord) => {
    if (isReadOnly) return;
    setEditingProperty(prop);
    setModalError(null);
    setModalSuccess(false);

    if (prop.rentFee === null || prop.rentFee === undefined) {
      setEditRentFeeUnset(true);
      setEditRentFee('');
    } else {
      setEditRentFeeUnset(false);
      setEditRentFee(String(prop.rentFee));
    }

    if (prop.managementFee === null || prop.managementFee === undefined) {
      setEditMgmtFeeUnset(true);
      setEditMgmtFee('');
    } else {
      setEditMgmtFeeUnset(false);
      setEditMgmtFee(String(prop.managementFee));
    }
  };

  // Submit Fee Updates
  const handleSaveFees = async () => {
    if (!editingProperty || isReadOnly) return;

    setModalSaving(true);
    setModalError(null);
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-super-admin'
          : localStorage.getItem('auth_token') || '';

      const model = editingProperty.operatingModel || 'FULLY_MANAGED';

      const payload: { rentFee?: number | null; managementFee?: number | null } = {};

      if (model === 'FULLY_MANAGED') {
        payload.rentFee = editRentFeeUnset ? null : Number(editRentFee);
        payload.managementFee = editMgmtFeeUnset ? null : Number(editMgmtFee);
      } else if (model === 'AGENT_LISTED_PLATFORM_MANAGED') {
        payload.managementFee = editMgmtFeeUnset ? null : Number(editMgmtFee);
      }

      const res = await fetch(`/api/admin/properties/${editingProperty.id}/fees`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || 'Failed to update property fees');
      }

      setModalSuccess(true);
      setTimeout(() => {
        setEditingProperty(null);
        setModalSuccess(false);
        fetchProperties();
      }, 1200);
    } catch (err: any) {
      setModalError(err.message || 'Error updating fees');
    } finally {
      setModalSaving(false);
    }
  };

  const handleOpenInspect = async (prop: AdminPropertyRecord) => {
    setInspectingProperty(prop);
    setRejectReason('');
    setActionError(null);
    setActionSuccessMsg(null);
    setLoadingHistory(true);
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-super-admin'
          : localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/admin/properties/${prop.id}/verification-history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setVerificationHistory(d.history || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleApproveProperty = async () => {
    if (!inspectingProperty || isReadOnly) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-super-admin'
          : localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/admin/properties/${inspectingProperty.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ notes: 'Approved by admin' })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to approve property');
      }
      setActionSuccessMsg('موڵک بە سەرکەوتوویی پەسەندکرا (Property Approved)');
      setTimeout(() => {
        setInspectingProperty(null);
        fetchProperties();
      }, 1000);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectProperty = async () => {
    if (!inspectingProperty || isReadOnly) return;
    if (!rejectReason.trim()) {
      setActionError('تکایە هۆکاری ڕەتکردنەوە بنووسە (Rejection reason is required)');
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const token =
        import.meta.env.MODE !== 'production'
          ? localStorage.getItem('auth_token') || 'dev-super-admin'
          : localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/admin/properties/${inspectingProperty.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason.trim() })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to reject property');
      }
      setActionSuccessMsg('موڵک ڕەتکرایەوە (Property Rejected)');
      setTimeout(() => {
        setInspectingProperty(null);
        fetchProperties();
      }, 1000);
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4" dir={direction}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="گەڕانەوە"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Home className="w-5 h-5 text-emerald-600" />
              <span>بەڕێوەبەرایەتی موڵکەکان و کرێ (Admin Properties Dashboard)</span>
            </h2>
            <p className="text-xs text-slate-500">
              لیستی موڵکەکان بە جیاوازیپێدانی سێ-کرێیی (Platform, Rent, Management) و وردبینی مۆدێلی کارکردن
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isReadOnly && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>تەنها بینین (Read Only)</span>
            </div>
          )}
          <button
            type="button"
            onClick={fetchProperties}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="نوێکردنەوە"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Platform Fee Banner */}
      <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-blue-700 shrink-0" />
          <span>
            <strong className="font-bold">ڕێژەی گشتی پلاتفۆڕم (Universal Platform Fee):</strong>{' '}
            <span className="font-mono font-extrabold text-blue-800">
              {(globalPlatformFee * 100).toFixed(2)}%
            </span>{' '}
            — لەسەر هەموو موڵکەکان کارایە و گۆڕینی تەنها لە ڕێکخستنە گشتییەکان دەکرێت.
          </span>
        </div>
        <span className="text-[11px] font-semibold bg-white/80 px-2.5 py-1 rounded-lg border border-blue-100 shrink-0">
          کۆی گشتی موڵکەکان: {totalCount}
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="گەڕان بەپێی ناوی موڵک، خاوەن، یان ناسنامە..."
              className="w-full pr-9 pl-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white outline-none"
            />
          </div>

          {/* City Filter */}
          <div>
            <select
              value={cityFilter}
              onChange={(e) => {
                setCityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold cursor-pointer text-slate-700"
            >
              <option value="all">هەموو شارەکان (All Cities)</option>
              <option value="Erbil">هەولێر (Erbil)</option>
              <option value="Sulaymaniyah">سلێمانی (Sulaymaniyah)</option>
              <option value="Duhok">دهۆک (Duhok)</option>
            </select>
          </div>

          {/* Operating Model Filter */}
          <div>
            <select
              value={operatingModelFilter}
              onChange={(e) => {
                setOperatingModelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold cursor-pointer text-slate-700"
            >
              <option value="all">هەموو مۆدێلەکان (All Models)</option>
              <option value="FULLY_MANAGED">FULLY_MANAGED</option>
              <option value="AGENT_LISTED_PLATFORM_MANAGED">AGENT_LISTED_PLATFORM_MANAGED</option>
              <option value="AGENT_OPERATED">AGENT_OPERATED</option>
            </select>
          </div>

          {/* Verification Status Filter */}
          <div className="sm:col-span-4 lg:col-span-1">
            <select
              data-testid="admin-verification-status-filter"
              value={verificationStatusFilter}
              onChange={(e) => {
                setVerificationStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold cursor-pointer text-slate-700"
            >
              <option value="all">هەموو دۆخەکانی پشکنین (All Verification)</option>
              <option value="PENDING_VERIFICATION">چاوەڕوانی پشکنین (Pending)</option>
              <option value="VERIFIED">پشتڕاستکراوە (Verified)</option>
              <option value="REJECTED">ڕەتکراوە (Rejected)</option>
            </select>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Properties Cards List */}
      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
        </div>
      ) : propertiesList.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
          هیچ موڵکێک بەپێی ئەم فلتەرە نەدۆزرایەوە (No properties found).
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {propertiesList.map((prop) => {
            const model = prop.operatingModel || 'FULLY_MANAGED';
            const rentApplies = model === 'FULLY_MANAGED';
            const mgmtApplies = model === 'FULLY_MANAGED' || model === 'AGENT_LISTED_PLATFORM_MANAGED';

            return (
              <div
                key={prop.id}
                data-testid={`admin-property-card-${prop.id}`}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-xs transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Title & Operating Model Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900 leading-tight">
                        {prop.titleKurdish || prop.title}
                      </h4>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <span>{prop.city}</span>
                        <span>•</span>
                        <span>{prop.type}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400 text-[10px]">ID: {prop.id.substring(0, 8)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-200">
                        {model}
                      </span>
                      {prop.verificationStatus === 'VERIFIED' ? (
                        <span data-testid={`admin-prop-verified-badge-${prop.id}`} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>پشتڕاستکراوە (Verified)</span>
                        </span>
                      ) : prop.verificationStatus === 'REJECTED' ? (
                        <span data-testid={`admin-prop-rejected-badge-${prop.id}`} className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold border border-rose-200 flex items-center gap-1">
                          <XCircle className="w-2.5 h-2.5" />
                          <span>ڕەتکراوە (Rejected)</span>
                        </span>
                      ) : (
                        <span data-testid={`admin-prop-pending-badge-${prop.id}`} className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>چاوەڕوانی پشکنین (Pending)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {prop.rejectionReason && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-850 space-y-0.5">
                      <span className="font-bold text-rose-700">هۆکاری ڕەتکردنەوە:</span> {prop.rejectionReason}
                    </div>
                  )}

                  {/* 3-Fee Canonical Breakdown Grid */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-200/50 pb-1">
                      <span>دۆخی ٣-کرێیی (3-Fee Structure)</span>
                      <span className="text-[10px] text-slate-400 font-normal">تەنها لەسەر کرێی کۆکراوە</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      {/* 1. Global Platform Fee */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          {t('fee.platform_fee', 'پلاتفۆرم')}
                        </span>
                        <span className="font-mono font-bold text-blue-700 block mt-0.5">
                          {(globalPlatformFee * 100).toFixed(2)}%
                        </span>
                        <span className="text-[9px] text-blue-600 bg-blue-50 px-1 py-0.2 rounded font-medium">
                          سەرتاسەری
                        </span>
                      </div>

                      {/* 2. Property Rent Fee */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          {t('fee.rent_fee', 'کرێ')}
                        </span>
                        {!rentApplies ? (
                          <span className="text-[10px] text-slate-400 font-bold block mt-1">
                            ناگرێتەوە
                          </span>
                        ) : prop.rentFee === null || prop.rentFee === undefined ? (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-bold block mt-0.5">
                            دیارینەکراوە
                          </span>
                        ) : prop.rentFee === 0 ? (
                          <span className="font-mono font-bold text-slate-700 block mt-0.5">
                            0.00%
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-emerald-700 block mt-0.5">
                            {(Number(prop.rentFee) * 100).toFixed(2)}%
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 block">
                          {rentApplies ? 'تایبەت بە موڵک' : 'مۆدێل قەدەغەی کردووە'}
                        </span>
                      </div>

                      {/* 3. Property Management Fee */}
                      <div className="p-2 bg-white rounded-lg border border-slate-200/80">
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          {t('fee.management_fee', 'بەڕێوەبردن')}
                        </span>
                        {!mgmtApplies ? (
                          <span className="text-[10px] text-slate-400 font-bold block mt-1">
                            ناگرێتەوە
                          </span>
                        ) : prop.managementFee === null || prop.managementFee === undefined ? (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-bold block mt-0.5">
                            دیارینەکراوە
                          </span>
                        ) : prop.managementFee === 0 ? (
                          <span className="font-mono font-bold text-slate-700 block mt-0.5">
                            0.00%
                          </span>
                        ) : (
                          <span className="font-mono font-bold text-purple-700 block mt-0.5">
                            {(Number(prop.managementFee) * 100).toFixed(2)}%
                          </span>
                        )}
                        <span className="text-[9px] text-slate-400 block">
                          {mgmtApplies ? 'تایبەت بە موڵک' : 'مۆدێل قەدەغەی کردووە'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ownership & Agency Details */}
                  <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                    <span>
                      خاوەن موڵک: <strong className="text-slate-800">{prop.ownerName}</strong>
                    </span>
                    {prop.managingAgencyName && (
                      <span>
                        ئاژانس: <span className="text-blue-700 font-medium">{prop.managingAgencyName}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">
                    تۆمار: {prop.dateSubmitted}
                  </span>

                  {!isReadOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`admin-inspect-prop-btn-${prop.id}`}
                        onClick={() => handleOpenInspect(prop)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>پشکنین و بڕیار (Inspect & Verify)</span>
                      </button>

                      <button
                        type="button"
                        data-testid={`admin-edit-fees-btn-${prop.id}`}
                        onClick={() => handleOpenEditFees(prop)}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>کرێکان</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs text-xs">
        <span className="text-slate-500 font-medium">
          پەڕەی <strong className="text-slate-900 font-bold">{page}</strong> لە{' '}
          <strong className="text-slate-900 font-bold">{totalPages}</strong> (کۆی گشتی: {totalCount} موڵک)
        </span>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
          >
            پێشوو
          </button>
          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold cursor-pointer"
          >
            دواتر
          </button>
        </div>
      </div>

      {/* Fee Editing Modal */}
      {editingProperty && (
        <div
          data-testid="admin-fee-edit-modal"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  دەستکاریکردنی کرێکانی موڵک
                </h3>
                <p className="text-xs text-slate-500">
                  {editingProperty.titleKurdish || editingProperty.title} ({editingProperty.operatingModel})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProperty(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {modalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>کرێیەکان لە سێرڤەر بە سەرکەوتوویی پاشەکەوت کران!</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* 1. Global Platform Fee Note */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900">کرێی پلاتفۆڕم (Platform Fee):</span>
                  <span className="font-mono font-bold text-blue-800">
                    {(globalPlatformFee * 100).toFixed(2)}%
                  </span>
                </div>
                <p className="text-[11px] text-blue-700">
                  ئەم ڕێژەیە سەرتاسەرییە و بۆ هەر موڵکێک بە جیا ناگۆڕدرێت. بۆ گۆڕینی، سەردانی ڕێکخستنە گشتییەکان بکە.
                </p>
              </div>

              {/* 2. Rent Fee Control */}
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">کرێی بەکرێدان (Rent Fee):</label>
                  {editingProperty.operatingModel !== 'FULLY_MANAGED' && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      ناگرێتەوە لەم مۆدێلەدا
                    </span>
                  )}
                </div>

                {editingProperty.operatingModel === 'FULLY_MANAGED' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="0.50"
                        disabled={editRentFeeUnset}
                        value={editRentFee}
                        onChange={(e) => setEditRentFee(e.target.value)}
                        placeholder="0.04 بۆ 4%"
                        className="w-32 p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-sm outline-none disabled:opacity-40"
                      />
                      <span className="text-slate-500 font-bold">
                        {editRentFee ? `${(Number(editRentFee) * 100).toFixed(2)}%` : 'ڕێژەی دەسیماڵ'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={editRentFeeUnset}
                          onChange={(e) => {
                            setEditRentFeeUnset(e.target.checked);
                            if (e.target.checked) setEditRentFee('');
                          }}
                          className="w-4 h-4 accent-slate-900"
                        />
                        <span>دیارینەکراوە (Unset / null)</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    ئەم موڵکە لەژێر مۆدێلی {editingProperty.operatingModel} دایە و کرێی بەکرێدانی بۆ دانانرێت.
                  </p>
                )}
              </div>

              {/* 3. Management Fee Control */}
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-900">کرێی بەڕێوەبردن (Management Fee):</label>
                  {editingProperty.operatingModel === 'AGENT_OPERATED' && (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                      ناگرێتەوە لەم مۆدێلەدا
                    </span>
                  )}
                </div>

                {editingProperty.operatingModel !== 'AGENT_OPERATED' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max="0.50"
                        disabled={editMgmtFeeUnset}
                        value={editMgmtFee}
                        onChange={(e) => setEditMgmtFee(e.target.value)}
                        placeholder="0.06 بۆ 6%"
                        className="w-32 p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-sm outline-none disabled:opacity-40"
                      />
                      <span className="text-slate-500 font-bold">
                        {editMgmtFee ? `${(Number(editMgmtFee) * 100).toFixed(2)}%` : 'ڕێژەی دەسیماڵ'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                        <input
                          type="checkbox"
                          checked={editMgmtFeeUnset}
                          onChange={(e) => {
                            setEditMgmtFeeUnset(e.target.checked);
                            if (e.target.checked) setEditMgmtFee('');
                          }}
                          className="w-4 h-4 accent-slate-900"
                        />
                        <span>دیارینەکراوە (Unset / null)</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    مۆدێلی AGENT_OPERATED بە تەواوی لە کرێی بەڕێوەبردن بەخشراوە.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingProperty(null)}
                disabled={modalSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
              >
                پەشیمانبوونەوە
              </button>
              <button
                type="button"
                data-testid="admin-save-property-fees-btn"
                onClick={handleSaveFees}
                disabled={modalSaving}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {modalSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>پاشەکەوتکردن لە سێرڤەر</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Property Inspection & Verification Modal */}
      {inspectingProperty && (
        <div
          data-testid="admin-property-inspect-modal"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-base text-slate-900">
                  پشکنینی وردی موڵک (Property Verification & Decision)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingProperty(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Property Summary Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200/80">
              <div>
                <span className="text-slate-400 block text-[11px]">ناوی موڵک (Title):</span>
                <span className="font-extrabold text-slate-900">{inspectingProperty.title}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">خاوەن موڵک (Owner):</span>
                <span className="font-bold text-slate-900">{inspectingProperty.ownerName} ({inspectingProperty.ownerId || 'N/A'})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">شار / ناونیشان (Location):</span>
                <span className="font-semibold text-slate-800">{inspectingProperty.city} • {(inspectingProperty.address as any)?.street || ''}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">ژمارەی تاپۆ (Tapu Number):</span>
                <span className="font-mono font-bold text-slate-800">{inspectingProperty.tapuNumber || 'TN-N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">دۆخی پشکنین (Verification Status):</span>
                <span className={`inline-block font-extrabold px-2 py-0.5 rounded text-[11px] ${
                  inspectingProperty.verificationStatus === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                  inspectingProperty.verificationStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                  'bg-amber-100 text-amber-800'
                }`}>
                  {inspectingProperty.verificationStatus || 'PENDING_VERIFICATION'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">تفضيل بەڕێوەبردن (Management Choice):</span>
                <span className="font-bold text-purple-700">{inspectingProperty.managementPreference || 'SELF_MANAGED'} ({inspectingProperty.managementArrangementStatus || 'NOT_APPLICABLE'})</span>
              </div>
            </div>

            {/* Photos & Documents */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-700">وێنە و بەڵگەنامە تۆمارکراوەکان (Submitted Media & Documents):</h4>
              {inspectingProperty.photos && inspectingProperty.photos.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {inspectingProperty.photos.map((p, idx) => (
                    <img key={idx} src={p} alt={`Property ${idx}`} className="w-full h-24 object-cover rounded-xl border border-slate-200" />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">هیچ وێنەیەکی ڕاستەوخۆ بارنەکراوە (No photos uploaded).</p>
              )}
            </div>

            {/* Auditable Decision History */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <h4 className="font-bold text-xs text-slate-700">مێژووی بڕیارەکان (Auditable Decision History):</h4>
              {loadingHistory ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading history...</div>
              ) : verificationHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">هیچ مێژوویەکی بڕیاری پێشوو تۆمار نەکراوە (No previous review records).</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {verificationHistory.map((h, i) => (
                    <div key={i} className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span className={h.status === 'VERIFIED' ? 'text-emerald-700' : h.status === 'REJECTED' ? 'text-rose-700' : 'text-amber-700'}>
                          {h.status}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Reviewer: {h.reviewerFirstName || ''} {h.reviewerLastName || ''} ({h.reviewerEmail || h.reviewerId || 'Admin'})
                      </div>
                      {h.rejectionReason && (
                        <div className="text-[11px] text-rose-800 font-semibold">
                          Reason: {h.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Feedback */}
            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-800 rounded-xl font-bold">
                {actionError}
              </div>
            )}
            {actionSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 rounded-xl font-bold">
                {actionSuccessMsg}
              </div>
            )}

            {/* Admin Decision Controls */}
            {!isReadOnly && (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    هۆکاری ڕەتکردنەوە (مەرجە بۆ ڕەتکردنەوە - Required if rejecting):
                  </label>
                  <textarea
                    data-testid="admin-reject-reason-input"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="هۆکاری ڕەتکردنەوە بنووسە بۆ خاوەن موڵک (e.g. Invalid deed document, mismatched owner details)..."
                    rows={2}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:border-rose-500 outline-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setInspectingProperty(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    داخستن (Close)
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="admin-reject-btn"
                      disabled={actionLoading}
                      onClick={handleRejectProperty}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>ڕەتکردنەوە (Reject)</span>
                    </button>

                    <button
                      type="button"
                      data-testid="admin-approve-btn"
                      disabled={actionLoading}
                      onClick={handleApproveProperty}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>پەسەندکردن (Approve)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminPropertiesModule;
