import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';
import { useToast } from '../ui/Toast';
import { 
  X, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  Plus, 
  FileText, 
  Camera, 
  ChevronDown, 
  Check, 
  Ban, 
  AlertTriangle, 
  RefreshCw,
  Wrench,
  Layers,
  ArrowRight
} from 'lucide-react';

interface DepositInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantName?: string;
  currency?: string;
  onSuccess?: () => void;
}

type ModalTab = 'deposit' | 'inspections' | 'deductions';

export const DepositInspectionModal: React.FC<DepositInspectionModalProps> = ({
  isOpen,
  onClose,
  leaseId,
  propertyId,
  propertyName,
  tenantName = 'Tenant',
  currency = 'IQD',
  onSuccess,
}) => {
  const { t, direction, language } = useI18n();
  const isRtl = direction === 'rtl';
  const { token, user } = useAuth();
  const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token')) : null);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ModalTab>('deposit');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authoritative State
  const [deposit, setDeposit] = useState<any | null>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);

  // Collect / Release States
  const [collectAmount, setCollectAmount] = useState('');
  const [releaseAmount, setReleaseAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // New Inspection Form
  const [showNewInspectionForm, setShowNewInspectionForm] = useState(false);
  const [newInspection, setNewInspection] = useState({
    hasMoveInBaseline: false,
    moveInBaselineReference: '',
    generalNotes: '',
    tenantPresent: true,
  });

  // Selected Inspection & Item Form
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItem, setNewItem] = useState({
    area: 'Living Room',
    component: 'Window Latch',
    condition: 'DAMAGED' as const,
    damageDescription: '',
    isTenantCaused: true,
    estimatedRepairCost: '',
    currency: currency,
    evidenceRef: '',
  });

  // Deduction Form
  const [showProposeDeductionForm, setShowProposeDeductionForm] = useState(false);
  const [newDeduction, setNewDeduction] = useState({
    inspectionItemId: '',
    amount: '',
    currency: currency,
    category: 'DAMAGE' as const,
    description: '',
    evidenceRef: '',
    notifyTenant: true,
  });

  // Rejection Modal
  const [rejectDeductionId, setRejectDeductionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const fetchAllData = async () => {
    if (!leaseId || !effectiveToken) return;
    setLoading(true);
    setError(null);
    try {
      const [resDep, resInsp, resDed] = await Promise.all([
        fetch(`/api/owner/leases/${leaseId}/deposit`, {
          headers: { 'Authorization': `Bearer ${effectiveToken}` }
        }),
        fetch(`/api/owner/leases/${leaseId}/inspections`, {
          headers: { 'Authorization': `Bearer ${effectiveToken}` }
        }),
        fetch(`/api/owner/leases/${leaseId}/deductions`, {
          headers: { 'Authorization': `Bearer ${effectiveToken}` }
        })
      ]);

      if (resDep.ok) {
        setDeposit(await resDep.json());
      } else {
        setDeposit(null);
      }

      if (resInsp.ok) {
        setInspections(await resInsp.json());
      } else {
        setInspections([]);
      }

      if (resDed.ok) {
        setDeductions(await resDed.json());
      } else {
        setDeductions([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load lease security and inspection data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && leaseId) {
      fetchAllData();
    }
  }, [isOpen, leaseId, effectiveToken]);

  if (!isOpen) return null;

  // Decision P02: check if user is verified owner or admin
  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const canApproveDeduction = userRoles.includes('PROPERTY_OWNER') || userRoles.includes('OWNER') || userRoles.includes('PLATFORM_ADMIN') || userRoles.includes('ADMIN');

  // Handlers
  const handleCollectDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit?.id || !collectAmount) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/deposits/${deposit.id}/collect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({ amount: Number(collectAmount) })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to collect deposit');
      }
      showToast(t('deposit.collect_success', 'Security deposit marked as collected successfully!'), 'success');
      setCollectAmount('');
      await fetchAllData();
      onSuccess?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit?.id || !releaseAmount) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/deposits/${deposit.id}/release`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({ amount: Number(releaseAmount) })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to release deposit');
      }
      showToast(t('deposit.release_success', 'Security deposit released successfully!'), 'success');
      setReleaseAmount('');
      await fetchAllData();
      onSuccess?.();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch('/api/owner/inspections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          leaseId,
          propertyId,
          hasMoveInBaseline: newInspection.hasMoveInBaseline,
          moveInBaselineReference: newInspection.hasMoveInBaseline ? newInspection.moveInBaselineReference : null,
          generalNotes: newInspection.generalNotes || null,
          tenantPresent: newInspection.tenantPresent,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to create move-out inspection');
      }
      showToast(t('inspection.create_success', 'Move-out inspection initiated successfully!'), 'success');
      setShowNewInspectionForm(false);
      setNewInspection({ hasMoveInBaseline: false, moveInBaselineReference: '', generalNotes: '', tenantPresent: true });
      await fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddItem = async (inspectionId: string) => {
    if (!newItem.area || !newItem.component) {
      showToast(t('inspection.error.area_component_required', 'Area and Component are required'), 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/inspections/${inspectionId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          area: newItem.area,
          component: newItem.component,
          condition: newItem.condition,
          damageDescription: newItem.damageDescription || null,
          isTenantCaused: newItem.isTenantCaused,
          estimatedRepairCost: newItem.estimatedRepairCost ? Number(newItem.estimatedRepairCost) : undefined,
          currency: newItem.currency,
          evidenceRefs: newItem.evidenceRef ? [newItem.evidenceRef.trim()] : null,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to add inspection item');
      }
      showToast(t('inspection.item_added', 'Inspection item recorded!'), 'success');
      setShowAddItemForm(false);
      setNewItem({
        area: 'Living Room',
        component: 'Window Latch',
        condition: 'DAMAGED',
        damageDescription: '',
        isTenantCaused: true,
        estimatedRepairCost: '',
        currency,
        evidenceRef: '',
      });
      await fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteInspection = async (inspectionId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/inspections/${inspectionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          generalNotes: 'Completed by management with itemized verification.',
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to complete inspection');
      }
      showToast(t('inspection.completed', 'Inspection completed! You can now propose deductions.'), 'success');
      await fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProposeDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit?.id || !newDeduction.amount || !newDeduction.description) {
      showToast(t('deduction.error.amount_desc_required', 'Amount and description are required'), 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch('/api/owner/deductions/propose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          depositId: deposit.id,
          leaseId,
          inspectionItemId: newDeduction.inspectionItemId || null,
          amount: Number(newDeduction.amount),
          currency: newDeduction.currency,
          category: newDeduction.category,
          description: newDeduction.description.trim(),
          evidenceRefs: newDeduction.evidenceRef ? [newDeduction.evidenceRef.trim()] : null,
          notifyTenant: newDeduction.notifyTenant,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to propose deduction');
      }
      showToast(t('deduction.proposed_success', 'Deduction proposal created successfully!'), 'success');
      setShowProposeDeductionForm(false);
      setNewDeduction({
        inspectionItemId: '',
        amount: '',
        currency,
        category: 'DAMAGE',
        description: '',
        evidenceRef: '',
        notifyTenant: true,
      });
      await fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDeduction = async (deductionId: string) => {
    if (!canApproveDeduction) {
      showToast(t('deduction.error.company_delegation_gap', 'Company managers lack explicit deduction approval authority (Decision P02). Only verified property owners may approve.'), 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/deductions/${deductionId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to approve deduction');
      }
      showToast(t('deduction.approved', 'Deduction approved successfully!'), 'success');
      await fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectDeductionId || !rejectionReason.trim()) {
      showToast(t('deduction.error.reason_required', 'Rejection reason is required'), 'error');
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/owner/deductions/${rejectDeductionId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to reject deduction');
      }
      showToast(t('deduction.rejected', 'Deduction rejected successfully!'), 'success');
      setRejectDeductionId(null);
      setRejectionReason('');
      await fetchAllData();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Calculations
  const recorded = deposit ? Number(deposit.recordedAmount || 0) : 0;
  const released = deposit ? Number(deposit.releasedAmount || 0) : 0;
  const heldBalance = Math.max(0, recorded - released);
  const activeReserved = deductions
    .filter(d => ['PROPOSED', 'OWNER_APPROVED', 'DISPUTED', 'SETTLED'].includes(d.status))
    .reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const unreservedAvailable = Math.max(0, heldBalance - activeReserved);

  const getLocalizedDepositStatus = (status: string) => {
    return t(`deposit.status.${status.toLowerCase()}`, status);
  };

  const getLocalizedDeductionStatus = (status: string) => {
    return t(`deduction.status.${status.toLowerCase()}`, status);
  };

  const getLocalizedInspectionStatus = (status: string) => {
    return t(`inspection.status.${status.toLowerCase()}`, status);
  };

  const getLocalizedCategory = (cat: string) => {
    return t(`deduction.category.${cat.toLowerCase()}`, cat);
  };

  const getLocalizedCondition = (cond: string) => {
    return t(`inspection.condition.${cond.toLowerCase()}`, cond);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto" id="deposit-inspection-modal">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>{t('deposit.modal_title', 'Security Deposit & Move-Out Management')}</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {propertyName} • <span className="font-bold text-slate-700">{tenantName}</span> • Lease <span dir="ltr" className="font-mono">#{leaseId ? leaseId.slice(0, 8) : ''}</span>
              </p>
            </div>
          </div>
          <button 
            type="button" 
            id="btn-close-deposit-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-5 bg-white shrink-0">
          <button
            type="button"
            id="tab-deposit-balance"
            onClick={() => setActiveTab('deposit')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'deposit'
                ? 'border-blue-600 text-blue-700 bg-blue-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>{t('deposit.tab_deposit', 'Deposit Balance & Escrow')}</span>
            {deposit && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                deposit.status === 'HELD' ? 'bg-emerald-100 text-emerald-800' :
                deposit.status === 'RELEASED' || deposit.status === 'REFUNDED' ? 'bg-purple-100 text-purple-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {getLocalizedDepositStatus(deposit.status)}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-move-out-inspections"
            onClick={() => setActiveTab('inspections')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'inspections'
                ? 'border-blue-600 text-blue-700 bg-blue-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{t('deposit.tab_inspections', 'Move-Out Inspections')}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
              {inspections.length}
            </span>
          </button>

          <button
            type="button"
            id="tab-security-deductions"
            onClick={() => setActiveTab('deductions')}
            className={`py-3.5 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'deductions'
                ? 'border-blue-600 text-blue-700 bg-blue-50/30'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t('deposit.tab_deductions', 'Security Deductions')}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
              {deductions.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
              <span className="text-xs font-bold">{t('common.loading', 'Loading authoritative records...')}</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* TAB 1: DEPOSIT & RELEASE */}
              {activeTab === 'deposit' && (
                <div className="space-y-6" id="panel-deposit-balance">
                  {!deposit && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>{t('deposit.no_record_notice', 'No security deposit has been initialized for this lease yet.')}</span>
                    </div>
                  )}

                  {/* Financial KPI Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl" id="card-required-deposit">
                      <span className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                        {t('deposit.required_deposit', 'Required Deposit')}
                      </span>
                      <p className="text-lg font-black text-slate-900" dir="ltr">
                        {deposit ? Number(deposit.requiredAmount).toLocaleString() : '0'} <span className="text-xs text-slate-500">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {t('deposit.fixed_custodial_req', 'Fixed custodial requirement')}
                      </span>
                    </div>

                    <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-xl" id="card-escrow-recorded">
                      <span className="text-[11px] font-bold text-blue-700 uppercase block mb-1">
                        {t('deposit.escrow_recorded', 'Recorded in Escrow')}
                      </span>
                      <p className="text-lg font-black text-blue-900" dir="ltr">
                        {recorded.toLocaleString()} <span className="text-xs text-blue-700">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-blue-600">
                        {t('deposit.held_no_fees', 'Held without fees (0% 3-Fee Model)')}
                      </span>
                    </div>

                    <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl" id="card-active-reserved">
                      <span className="text-[11px] font-bold text-amber-700 uppercase block mb-1">
                        {t('deposit.active_reserved', 'Active Reserved')}
                      </span>
                      <p className="text-lg font-black text-amber-900" dir="ltr">
                        {activeReserved.toLocaleString()} <span className="text-xs text-amber-700">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-amber-600">
                        {t('deposit.deductions_held_note', 'Deductions & disputes held')}
                      </span>
                    </div>

                    <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-xl" id="card-unreserved-available">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase block mb-1">
                        {t('deposit.unreserved_available', 'Unreserved Available')}
                      </span>
                      <p className="text-lg font-black text-emerald-900" dir="ltr">
                        {unreservedAvailable.toLocaleString()} <span className="text-xs text-emerald-700">{currency === 'IQD' && isRtl ? 'د.ع' : currency}</span>
                      </p>
                      <span className="text-[10px] text-emerald-600">
                        {t('deposit.eligible_return_note', 'Eligible for return / release')}
                      </span>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Collect Deposit Form */}
                    <div className="p-5 border border-slate-200 rounded-xl bg-white space-y-3" id="box-collect-deposit">
                      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{t('deposit.collect_heading', 'Collect / Record Security Deposit')}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {deposit?.status === 'HELD' 
                          ? t('deposit.already_held', 'This deposit is currently HELD in custodial escrow.') 
                          : t('deposit.collect_desc', 'Confirm tenant payment of the required deposit. Moves status from PENDING to HELD.')}
                      </p>
                      <form onSubmit={handleCollectDeposit} className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {t('deposit.amount_to_collect', 'Amount to Collect')} ({currency === 'IQD' && isRtl ? 'د.ع' : currency})
                          </label>
                          <input 
                            id="input-collect-deposit-amount"
                            type="number" 
                            step="any"
                            min="1"
                            value={collectAmount}
                            onChange={(e) => setCollectAmount(e.target.value)}
                            placeholder={deposit ? String(deposit.requiredAmount) : '1000000'}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold font-mono"
                            dir="ltr"
                            disabled={deposit?.status === 'HELD' || actionLoading}
                          />
                        </div>
                        <button
                          id="btn-confirm-collect-deposit"
                          type="submit"
                          disabled={deposit?.status === 'HELD' || !collectAmount || actionLoading}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          {actionLoading ? t('common.processing', 'Processing...') : t('deposit.confirm_collect', 'Confirm Custodial Collection')}
                        </button>
                      </form>
                    </div>

                    {/* Release Deposit Form */}
                    <div className="p-5 border border-slate-200 rounded-xl bg-white space-y-3" id="box-release-deposit">
                      <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                        <DollarSign className="w-4 h-4 text-blue-600" />
                        <span>{t('deposit.release_heading', 'Release / Refund Security Deposit')}</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {activeReserved > 0 ? (
                          <span className="text-amber-600 font-bold">
                            ⚠️ {t('deposit.active_reservations_warn', 'Active reservations ({amount}) must be resolved or settled before full release.').replace('{amount}', `${activeReserved.toLocaleString()} ${currency === 'IQD' && isRtl ? 'د.ع' : currency}`)}
                          </span>
                        ) : (
                          t('deposit.release_desc', 'Release held custodial funds back to tenant at end of lease.')
                        )}
                      </p>
                      <form onSubmit={handleReleaseDeposit} className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {t('deposit.amount_to_release', 'Amount to Release')} ({currency === 'IQD' && isRtl ? 'د.ع' : currency})
                          </label>
                          <input 
                            id="input-release-deposit-amount"
                            type="number" 
                            step="any"
                            min="1"
                            max={unreservedAvailable}
                            value={releaseAmount}
                            onChange={(e) => setReleaseAmount(e.target.value)}
                            placeholder={String(unreservedAvailable)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold font-mono"
                            dir="ltr"
                            disabled={unreservedAvailable <= 0 || actionLoading}
                          />
                        </div>
                        <button
                          id="btn-confirm-release-deposit"
                          type="submit"
                          disabled={unreservedAvailable <= 0 || !releaseAmount || actionLoading}
                          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          {actionLoading ? t('common.processing', 'Processing...') : t('deposit.confirm_release', 'Release Unreserved Custodial Funds')}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MOVE-OUT INSPECTIONS */}
              {activeTab === 'inspections' && (
                <div className="space-y-5" id="panel-move-out-inspections">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{t('inspection.list_title', 'Move-Out Inspection Records')}</h3>
                      <p className="text-xs text-slate-500">{t('inspection.records_desc', 'Document property condition, record damages, and upload verified evidence.')}</p>
                    </div>
                    {!showNewInspectionForm && (
                      <button
                        id="btn-open-new-inspection"
                        type="button"
                        onClick={() => setShowNewInspectionForm(true)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('inspection.new_inspection', 'Start New Inspection')}</span>
                      </button>
                    )}
                  </div>

                  {/* Create New Inspection Form */}
                  {showNewInspectionForm && (
                    <form onSubmit={handleCreateInspection} className="p-4 border border-blue-200 bg-blue-50/40 rounded-xl space-y-3 animate-in fade-in" id="form-new-inspection">
                      <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                        <span className="font-bold text-xs text-blue-900">{t('inspection.initiate_title', 'Initiate Move-Out Inspection')}</span>
                        <button 
                          type="button" 
                          onClick={() => setShowNewInspectionForm(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          ✕ {t('common.cancel', 'Cancel')}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-bold cursor-pointer">
                          <input 
                            id="check-move-in-baseline"
                            type="checkbox"
                            checked={newInspection.hasMoveInBaseline}
                            onChange={(e) => setNewInspection({ ...newInspection, hasMoveInBaseline: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span>{t('inspection.baseline_exists', 'Move-In Baseline Exists (Never fabricate)')}</span>
                        </label>

                        <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 text-xs font-bold cursor-pointer">
                          <input 
                            id="check-tenant-present"
                            type="checkbox"
                            checked={newInspection.tenantPresent}
                            onChange={(e) => setNewInspection({ ...newInspection, tenantPresent: e.target.checked })}
                            className="rounded text-blue-600"
                          />
                          <span>{t('inspection.tenant_present', 'Tenant Present During Walkthrough')}</span>
                        </label>
                      </div>

                      {newInspection.hasMoveInBaseline && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">{t('inspection.baseline_ref', 'Move-In Baseline Reference')}</label>
                          <input 
                            id="input-baseline-reference"
                            type="text" 
                            value={newInspection.moveInBaselineReference}
                            onChange={(e) => setNewInspection({ ...newInspection, moveInBaselineReference: e.target.value })}
                            placeholder="e.g. inspections/baseline_unit_101.pdf"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono"
                            dir="ltr"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('inspection.general_notes', 'General Notes')}</label>
                        <textarea 
                          id="input-general-notes"
                          rows={2}
                          value={newInspection.generalNotes}
                          onChange={(e) => setNewInspection({ ...newInspection, generalNotes: e.target.value })}
                          placeholder={t('inspection.general_notes_ph', 'Walkthrough observations, keys returned, meter readings...')}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          id="btn-confirm-start-inspection"
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          {actionLoading ? t('common.processing', 'Creating...') : t('inspection.confirm_start', 'Confirm & Start Inspection')}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Inspections List */}
                  {inspections.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs" id="empty-inspections">
                      {t('inspection.no_records', 'No move-out inspections recorded for this lease.')}
                    </div>
                  ) : (
                    inspections.map((insp) => (
                      <div key={insp.id} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3" id={`inspection-card-${insp.id}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              insp.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                              insp.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {getLocalizedInspectionStatus(insp.status)}
                            </span>
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                              Inspection <span dir="ltr" className="font-mono">#{insp.id.slice(0, 8)}</span>
                            </span>
                            <span className="text-[11px] text-slate-400" dir="ltr">
                              {new Date(insp.createdAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {insp.status !== 'COMPLETED' && (
                              <>
                                <button
                                  type="button"
                                  id={`btn-add-item-${insp.id}`}
                                  onClick={() => {
                                    setSelectedInspectionId(insp.id);
                                    setShowAddItemForm(true);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>{t('inspection.add_item', 'Add Damage Item')}</span>
                                </button>
                                <button
                                  type="button"
                                  id={`btn-complete-inspection-${insp.id}`}
                                  onClick={() => handleCompleteInspection(insp.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                                >
                                  {t('inspection.complete_btn', 'Complete Inspection')}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {insp.generalNotes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {insp.generalNotes}
                          </p>
                        )}

                        {/* Add Item Form inline */}
                        {showAddItemForm && selectedInspectionId === insp.id && (
                          <div className="p-3 border border-slate-200 bg-slate-50 rounded-lg space-y-2 animate-in fade-in" id="form-add-inspection-item">
                            <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                              <span>{t('inspection.record_item_title', 'Record Damage / Inspection Item')}</span>
                              <button onClick={() => setShowAddItemForm(false)} className="text-slate-400 cursor-pointer">✕</button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">{t('inspection.area', 'Area')}</label>
                                <input 
                                  id="input-item-area"
                                  type="text" 
                                  value={newItem.area}
                                  onChange={(e) => setNewItem({ ...newItem, area: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-xs bg-white" 
                                  placeholder="e.g. Living Room"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">{t('inspection.component', 'Component')}</label>
                                <input 
                                  id="input-item-component"
                                  type="text" 
                                  value={newItem.component}
                                  onChange={(e) => setNewItem({ ...newItem, component: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-xs bg-white" 
                                  placeholder="e.g. Window Latch"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">{t('inspection.condition', 'Condition')}</label>
                                <select 
                                  id="select-item-condition"
                                  value={newItem.condition}
                                  onChange={(e: any) => setNewItem({ ...newItem, condition: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-xs bg-white font-bold"
                                >
                                  <option value="DAMAGED">{getLocalizedCondition('DAMAGED')}</option>
                                  <option value="DIRTY">{getLocalizedCondition('DIRTY')}</option>
                                  <option value="MISSING">{getLocalizedCondition('MISSING')}</option>
                                  <option value="FAIR">{getLocalizedCondition('FAIR')}</option>
                                  <option value="GOOD">{getLocalizedCondition('GOOD')}</option>
                                  <option value="EXCELLENT">{getLocalizedCondition('EXCELLENT')}</option>
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">{t('inspection.estimated_cost', 'Estimated Cost')} ({currency})</label>
                                <input 
                                  id="input-item-cost"
                                  type="number" 
                                  value={newItem.estimatedRepairCost}
                                  onChange={(e) => setNewItem({ ...newItem, estimatedRepairCost: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-xs font-mono bg-white" 
                                  dir="ltr"
                                  placeholder="e.g. 50000"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-500">{t('inspection.evidence_ref', 'Evidence Ref (Storage Key)')}</label>
                                <input 
                                  id="input-item-evidence-ref"
                                  type="text" 
                                  value={newItem.evidenceRef}
                                  onChange={(e) => setNewItem({ ...newItem, evidenceRef: e.target.value })}
                                  className="w-full px-2 py-1 border rounded text-xs font-mono bg-white" 
                                  dir="ltr"
                                  placeholder="e.g. inspections/damage1.jpg"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                id="btn-save-inspection-item"
                                type="button"
                                onClick={() => handleAddItem(insp.id)}
                                disabled={actionLoading}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold cursor-pointer"
                              >
                                {actionLoading ? t('common.processing', 'Saving...') : t('inspection.save_item', 'Save Item')}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Items list */}
                        {insp.items && insp.items.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">{t('inspection.itemized_findings', 'Itemized Inspection Findings')}</span>
                            <div className="divide-y divide-slate-100 border border-slate-100 rounded-lg">
                              {insp.items.map((it: any) => (
                                <div key={it.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                                  <div>
                                    <span className="font-bold text-slate-800">{it.area}: {it.component}</span>
                                    <span className={`ms-2 px-2 py-0.5 rounded text-[10px] font-bold ${
                                      it.condition === 'DAMAGED' || it.condition === 'MISSING' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                    }`}>
                                      {getLocalizedCondition(it.condition)}
                                    </span>
                                    {it.damageDescription && (
                                      <p className="text-[11px] text-slate-500 mt-0.5">{it.damageDescription}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    {it.estimatedRepairCost && (
                                      <span className="font-bold text-slate-900 block" dir="ltr">
                                        {Number(it.estimatedRepairCost).toLocaleString()} {it.currency || currency}
                                      </span>
                                    )}
                                    {it.evidenceRefs && it.evidenceRefs.length > 0 && (
                                      <span className="text-[10px] text-blue-600 block">
                                        {t('inspection.evidence_count', '📷 {count} Evidence file(s)').replace('{count}', String(it.evidenceRefs.length))}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: DEDUCTIONS & DISPUTES */}
              {activeTab === 'deductions' && (
                <div className="space-y-5" id="panel-security-deductions">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{t('deduction.list_title', 'Security Deposit Deductions')}</h3>
                      <p className="text-xs text-slate-500">{t('deduction.subtitle', 'Propose repair deductions against held funds. Subject to verified owner approval.')}</p>
                    </div>
                    {!showProposeDeductionForm && (
                      <button
                        id="btn-open-propose-deduction"
                        type="button"
                        onClick={() => setShowProposeDeductionForm(true)}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{t('deduction.propose_btn', 'Propose Deduction')}</span>
                      </button>
                    )}
                  </div>

                  {/* Propose Deduction Form */}
                  {showProposeDeductionForm && (
                    <form onSubmit={handleProposeDeduction} className="p-4 border border-blue-200 bg-blue-50/40 rounded-xl space-y-3 animate-in fade-in" id="form-propose-deduction">
                      <div className="flex justify-between items-center border-b border-blue-200 pb-2">
                        <span className="font-bold text-xs text-blue-900">{t('deduction.propose_title', 'Propose Deposit Deduction')}</span>
                        <button 
                          type="button" 
                          onClick={() => setShowProposeDeductionForm(false)}
                          className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                        >
                          ✕ {t('common.cancel', 'Cancel')}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">{t('deposit.amount_to_collect', 'Amount')} ({currency})</label>
                          <input 
                            id="input-deduction-amount"
                            type="number" 
                            step="any"
                            min="1"
                            max={unreservedAvailable}
                            required
                            value={newDeduction.amount}
                            onChange={(e) => setNewDeduction({ ...newDeduction, amount: e.target.value })}
                            placeholder={String(unreservedAvailable)}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold font-mono bg-white"
                            dir="ltr"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">{t('deduction.category', 'Category')}</label>
                          <select 
                            id="select-deduction-category"
                            value={newDeduction.category}
                            onChange={(e: any) => setNewDeduction({ ...newDeduction, category: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white font-bold"
                          >
                            <option value="DAMAGE">{getLocalizedCategory('DAMAGE')}</option>
                            <option value="CLEANING">{getLocalizedCategory('CLEANING')}</option>
                            <option value="KEY_REPLACEMENT">{getLocalizedCategory('KEY_REPLACEMENT')}</option>
                            <option value="UNPAID_UTILITIES">{getLocalizedCategory('UNPAID_UTILITIES')}</option>
                            <option value="OTHER">{getLocalizedCategory('OTHER')}</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">{t('deduction.link_item', 'Link Damage Item')}</label>
                          <select 
                            id="select-deduction-item"
                            value={newDeduction.inspectionItemId}
                            onChange={(e) => setNewDeduction({ ...newDeduction, inspectionItemId: e.target.value })}
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                          >
                            <option value="">{t('deduction.none_general', 'None (General deduction)')}</option>
                            {inspections.flatMap(i => i.items || []).map((it: any) => (
                              <option key={it.id} value={it.id}>{it.area}: {it.component} ({getLocalizedCondition(it.condition)})</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">{t('deduction.desc_evidence', 'Deduction Description & Repair Evidence')}</label>
                        <textarea 
                          id="input-deduction-description"
                          rows={2}
                          required
                          value={newDeduction.description}
                          onChange={(e) => setNewDeduction({ ...newDeduction, description: e.target.value })}
                          placeholder={t('deduction.desc_ph', 'Explain rationale, repair estimates, or contractor invoice details...')}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">{t('deduction.evidence_ref', 'Evidence Reference (Path)')}</label>
                          <input 
                            id="input-deduction-evidence-ref"
                            type="text"
                            value={newDeduction.evidenceRef}
                            onChange={(e) => setNewDeduction({ ...newDeduction, evidenceRef: e.target.value })}
                            placeholder="e.g. deductions/repair_quote.pdf"
                            className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-mono bg-white"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                            <input 
                              id="check-deduction-notify-tenant"
                              type="checkbox"
                              checked={newDeduction.notifyTenant}
                              onChange={(e) => setNewDeduction({ ...newDeduction, notifyTenant: e.target.checked })}
                              className="rounded text-blue-600"
                            />
                            <span>{t('deduction.notify_tenant', 'Dispatch formal notice to tenant')}</span>
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          id="btn-submit-deduction-proposal"
                          type="submit"
                          disabled={actionLoading}
                          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          {actionLoading ? t('common.processing', 'Proposing...') : t('deduction.submit_proposal', 'Submit Deduction Proposal')}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Deductions List */}
                  {deductions.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs" id="empty-deductions">
                      {t('deduction.no_records', 'No security deposit deductions proposed for this lease.')}
                    </div>
                  ) : (
                    deductions.map((ded) => (
                      <div key={ded.id} className="border border-slate-200 rounded-xl p-4 bg-white space-y-3" id={`deduction-card-${ded.id}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              ded.status === 'OWNER_APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                              ded.status === 'DISPUTED' ? 'bg-amber-100 text-amber-800' :
                              ded.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {getLocalizedDeductionStatus(ded.status)}
                            </span>
                            <span className="text-xs font-bold text-slate-800">
                              {getLocalizedCategory(ded.category)}
                            </span>
                            <span className="text-xs font-black text-slate-900" dir="ltr">
                              {Number(ded.amount).toLocaleString()} {ded.currency || currency}
                            </span>
                          </div>

                          {/* Approval Actions */}
                          {ded.status === 'PROPOSED' && (
                            <div className="flex items-center gap-2">
                              {canApproveDeduction ? (
                                <button
                                  type="button"
                                  id={`btn-approve-deduction-${ded.id}`}
                                  onClick={() => handleApproveDeduction(ded.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{t('deduction.approve_btn', 'Approve')}</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-bold" title="Decision P02: Company managers cannot approve deductions">
                                  {t('deduction.owner_req', 'Owner Approval Required')}
                                </span>
                              )}
                              <button
                                type="button"
                                id={`btn-reject-deduction-${ded.id}`}
                                onClick={() => {
                                  setRejectDeductionId(ded.id);
                                  setRejectionReason('');
                                }}
                                className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg border border-rose-200 cursor-pointer flex items-center gap-1"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>{t('deduction.reject_btn', 'Reject')}</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-slate-600">
                          {ded.description}
                        </p>

                        {/* Dispute status indicator */}
                        {ded.status === 'DISPUTED' && (
                          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                            <span className="font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                              {t('deduction.tenant_dispute_active', 'Tenant Dispute Active')}
                            </span>
                            <p className="text-[11px] text-amber-800">
                              {t('deduction.reason_label', 'Reason: {reason}').replace('{reason}', ded.disputeReason || 'No details provided')}
                            </p>
                          </div>
                        )}

                        {ded.rejectionReason && (
                          <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-100">
                            {t('deduction.rejection_reason_label', 'Rejection Reason: {reason}').replace('{reason}', ded.rejectionReason)}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                          <span>{t('deduction.notice_status', 'Notice: {status}').replace('{status}', ded.noticeDeliveryStatus || 'NOT_SENT')}</span>
                          <span>
                            {ded.disputeDeadline 
                              ? <>{t('tenant.disputeWindowNotice', 'Contestation Window Closes:')} <span dir="ltr" className="font-medium text-slate-600">{new Date(ded.disputeDeadline).toLocaleDateString()}</span></> 
                              : t('deduction.window_unstarted', 'Dispute window unstarted (awaiting delivery)')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Rejection Reason Modal */}
                  {rejectDeductionId && (
                    <div className="p-4 border border-rose-200 bg-rose-50/50 rounded-xl space-y-3 animate-in fade-in" id="form-reject-deduction">
                      <span className="text-xs font-bold text-rose-900 block">{t('deduction.reject_proposal_title', 'Reject Deduction Proposal')}</span>
                      <textarea 
                        id="input-rejection-reason"
                        rows={2}
                        required
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder={t('deduction.reject_ph', 'State why this deduction was rejected...')}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button 
                          type="button" 
                          onClick={() => setRejectDeductionId(null)}
                          className="px-3 py-1 text-xs text-slate-600 font-bold cursor-pointer"
                        >
                          {t('common.cancel', 'Cancel')}
                        </button>
                        <button 
                          id="btn-confirm-rejection"
                          type="button" 
                          onClick={handleRejectDeduction}
                          disabled={actionLoading || !rejectionReason.trim()}
                          className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          {t('deduction.confirm_rejection', 'Confirm Rejection')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between rounded-b-2xl">
          <span className="text-xs text-slate-500 font-medium">
            {t('deposit.escrow_standard_footer', 'HomeHub Custodial Escrow Standard • 0% Platform / Rent / Management Fees')}
          </span>
          <button
            type="button"
            id="btn-footer-close-deposit-modal"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            {t('common.close', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
