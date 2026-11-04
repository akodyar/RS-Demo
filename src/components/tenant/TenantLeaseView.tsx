import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  CreditCard, 
  ShieldCheck, 
  Download, 
  RefreshCw, 
  LogOut, 
  CheckCircle2, 
  Building2,
  AlertCircle,
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Layers,
  AlertTriangle,
  Scale,
  Star,
  MessageSquare,
  Edit3
} from 'lucide-react';
import { TenantPropertySummary } from '../../types/tenant.js';
import { PropertyReview, PropertyReviewAggregate } from '../../types/review.js';
import { useI18n } from '../../i18n/I18nProvider';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../AuthProvider';
import { TenantDepositDisputeModal } from './TenantDepositDisputeModal';
import { TenantPropertyReviewModal } from './TenantPropertyReviewModal';

interface TenantLeaseViewProps {
  lease: TenantPropertySummary | null;
  onRenewLease: () => void;
  onMoveOut: () => void;
  onDownloadLease?: () => void;
  onAcceptLease?: () => void;
}

export const TenantLeaseView: React.FC<TenantLeaseViewProps> = ({
  lease,
  onRenewLease,
  onMoveOut,
  onDownloadLease,
  onAcceptLease,
}) => {
  const { showToast } = useToast();
  const { t, direction } = useI18n();
  const { token } = useAuth();
  const effectiveToken = token || (typeof window !== 'undefined' ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token')) : null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Authoritative Deposit, Inspection & Deduction State
  const [depositDetails, setDepositDetails] = useState<any | null>(null);
  const [inspections, setInspections] = useState<any[]>([]);
  const [deductions, setDeductions] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedDeductionForDispute, setSelectedDeductionForDispute] = useState<any | null>(null);

  const fetchDepositAndInspectionDetails = async () => {
    if (!lease?.leaseId || !effectiveToken) return;
    setLoadingDetails(true);
    try {
      const [resDep, resInsp, resDed] = await Promise.all([
        fetch(`/api/tenant/leases/${lease.leaseId}/deposit`, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        }),
        fetch(`/api/tenant/leases/${lease.leaseId}/inspections`, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        }),
        fetch(`/api/tenant/leases/${lease.leaseId}/deductions`, {
          headers: { Authorization: `Bearer ${effectiveToken}` }
        })
      ]);

      if (resDep.ok) {
        setDepositDetails(await resDep.json());
      }
      if (resInsp.ok) {
        setInspections(await resInsp.json());
      }
      if (resDed.ok) {
        setDeductions(await resDed.json());
      }
    } catch (err) {
      console.warn('Failed to load tenant deposit/inspection details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Review & Rating State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [userReview, setUserReview] = useState<PropertyReview | null>(null);
  const [propertyAggregate, setPropertyAggregate] = useState<PropertyReviewAggregate | null>(null);
  const [isReviewEligible, setIsReviewEligible] = useState<boolean>(false);
  const [loadingReview, setLoadingReview] = useState<boolean>(false);

  const fetchReviewDetails = async () => {
    if (!lease?.id) return;
    setLoadingReview(true);
    try {
      const aggRes = await fetch(`/api/reviews/properties/${lease.id}`);
      if (aggRes.ok) {
        const aggData = await aggRes.json();
        setPropertyAggregate(aggData.aggregate || null);
      }

      if (token) {
        const eligRes = await fetch(`/api/reviews/properties/${lease.id}/eligibility`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (eligRes.ok) {
          const eligData = await eligRes.json();
          setIsReviewEligible(Boolean(eligData.eligible));
          if (eligData.existingReview) {
            setUserReview(eligData.existingReview);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to fetch review details:', err);
    } finally {
      setLoadingReview(false);
    }
  };

  useEffect(() => {
    if (lease?.leaseId && effectiveToken) {
      fetchDepositAndInspectionDetails();
    }
    if (lease?.id) {
      fetchReviewDetails();
    }
  }, [lease?.leaseId, lease?.id, effectiveToken]);

  // Keyboard navigation for photo lightbox
  useEffect(() => {
    if (!galleryOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGalleryOpen(false);
      if (e.key === 'ArrowRight') {
        direction === 'rtl' ? handlePrev() : handleNext();
      }
      if (e.key === 'ArrowLeft') {
        direction === 'rtl' ? handleNext() : handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [galleryOpen, direction, activePhotoIdx]);

  if (!lease) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">
          {t('tenant.noActiveLease', 'No Active Lease Found')}
        </h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {t('tenant.noActiveLeaseDesc', 'You currently do not have an active lease record associated with your account.')}
        </p>
      </div>
    );
  }

  const rawPhotos = Array.isArray(lease.photos) && lease.photos.length > 0 ? lease.photos : (lease.imageUrl ? [lease.imageUrl] : []);
  const photos = rawPhotos.filter(Boolean);

  const handleNext = () => {
    if (photos.length === 0) return;
    setActivePhotoIdx((prev) => (prev + 1) % photos.length);
  };

  const handlePrev = () => {
    if (photos.length === 0) return;
    setActivePhotoIdx((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <div id="tenant-lease-view" className="space-y-6">
      {/* Header card with status */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              lease.leaseStatus === 'PENDING_SIGNATURE'
                ? 'bg-amber-100 text-amber-800'
                : lease.leaseStatus === 'EXPIRED' || lease.leaseStatus === 'TERMINATED'
                ? 'bg-red-100 text-red-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lease.leaseStatus === 'ACTIVE' ? t('tenant.active', 'Active')
                : lease.leaseStatus === 'PENDING_SIGNATURE' ? t('tenant.pendingSignature', 'Awaiting Your Acceptance')
                : lease.leaseStatus === 'EXPIRED' ? t('tenant.expired', 'Expired')
                : lease.leaseStatus}
            </span>
            <span className="text-xs text-slate-500 font-bold">
              ID: #{lease.leaseId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
            {lease.unitNumber}, {lease.name}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {lease.address}, {lease.city}, {lease.region}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onDownloadLease || (() => showToast(t('tenant.downloadingLeasePdf', 'Downloading official stamped lease agreement (PDF)...'), 'info'))}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{t('tenant.downloadAgreement', 'Download Agreement')}</span>
          </button>

          <button
            id="btn-tenant-renew-lease"
            type="button"
            onClick={onRenewLease}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('tenant.renewLease', 'Renew Lease')}</span>
          </button>

          {lease.leaseStatus === 'PENDING_SIGNATURE' && onAcceptLease && (
            <button
              type="button"
              onClick={onAcceptLease}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t('tenant.acceptLease', 'Accept Lease')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial & Contract Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {t('tenant.monthlyRent', 'Monthly Rent')}
          </span>
          <p className="text-2xl font-black text-slate-900" dir="ltr">
            {lease.monthlyRent.toLocaleString()}
            <span className="text-xs font-bold text-slate-500 ms-1 uppercase">{lease.currency}</span>
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">{t('tenant.dueFirstOfMonth', 'Due 1st of each month')}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {t('tenant.securityDeposit', 'Security Deposit')}
          </span>
          <p className="text-2xl font-black text-slate-900" dir="ltr">
            {lease.securityDeposit.toLocaleString()}
            <span className="text-xs font-bold text-slate-500 ms-1 uppercase">{lease.currency}</span>
          </p>
          <span className="text-[11px] text-emerald-600 font-bold mt-1 block">{t('tenant.heldInEscrow', 'Held in Escrow')}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {t('tenant.leaseDuration', 'Lease Term')}
          </span>
          <p className="text-xl font-black text-slate-900">
            <span dir="ltr">{lease.durationMonths}</span> {t('tenant.months', 'Months')}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">{t('tenant.standardFixedTerm', 'Standard Fixed Term')}</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {t('tenant.dates', 'Effective Dates')}
          </span>
          <p className="text-xs font-extrabold text-slate-900 mt-1" dir="ltr">
            {lease.leaseStart} → {lease.leaseEnd}
          </p>
          <span className="text-[11px] text-blue-600 font-bold mt-2 block">
            {t('tenant.noticeWindow', 'Notice Window: 60 Days')}
          </span>
        </div>
      </div>

      {/* Security Deposit Escrow, Move-Out Inspections & Deductions */}
      <div id="tenant-lease-deposit-section" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {t('tenant.depositEscrowTitle', 'Security Deposit Escrow & Inspections')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('tenant.depositEscrowDesc', 'Authoritative held escrow, move-out condition records, and deduction contestations.')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDepositAndInspectionDetails}
            disabled={loadingDetails}
            className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDetails ? 'animate-spin' : ''}`} />
            <span>{t('common.refresh', 'Refresh')}</span>
          </button>
        </div>

        {/* Deposit Balances */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 block uppercase">
              {t('tenant.depositHeld', 'Held Balance')}
            </span>
            <span className="text-lg font-black text-emerald-700 block mt-0.5" dir="ltr">
              {depositDetails?.heldAmount != null ? Number(depositDetails.heldAmount).toLocaleString() : (lease.securityDeposit || 0).toLocaleString()}{' '}
              <span className="text-xs text-slate-500 font-semibold">{depositDetails?.currency || lease.currency}</span>
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 block uppercase">
              {t('tenant.depositRecorded', 'Total Recorded')}
            </span>
            <span className="text-lg font-black text-slate-800 block mt-0.5" dir="ltr">
              {depositDetails?.recordedAmount != null ? Number(depositDetails.recordedAmount).toLocaleString() : (lease.securityDeposit || 0).toLocaleString()}{' '}
              <span className="text-xs text-slate-500 font-semibold">{depositDetails?.currency || lease.currency}</span>
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 block uppercase">
              {t('tenant.depositStatus', 'Escrow Status')}
            </span>
            <span className="inline-block mt-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
              {depositDetails?.status || t('tenant.heldInEscrow', 'Held in Escrow')}
            </span>
          </div>
        </div>

        {/* Inspections List */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>{t('tenant.inspectionsHeading', 'Move-In & Move-Out Inspections')}</span>
          </h4>

          {inspections.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              {t('tenant.noInspections', 'No inspections recorded for this lease yet.')}
            </p>
          ) : (
            <div className="space-y-2">
              {inspections.map((insp: any) => (
                <div key={insp.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-blue-100 text-blue-800">
                        {insp.inspectionType}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {insp.inspectionDate ? new Date(insp.inspectionDate).toLocaleDateString() : t('common.pending', 'Pending')}
                      </span>
                    </div>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                      {insp.status}
                    </span>
                  </div>

                  {insp.baselineInspectionId ? (
                    <div className="text-[11px] text-slate-500">
                      {t('tenant.baselineLinked', 'Linked Baseline ID: ')}<span dir="ltr" className="font-mono">{insp.baselineInspectionId}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-amber-700 font-medium">
                      {t('tenant.noBaseline', 'Explicitly recorded: No move-in baseline on file.')}
                    </div>
                  )}

                  {insp.summaryFindings && (
                    <p className="text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                      {insp.summaryFindings}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Deductions List */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>{t('tenant.deductionsHeading', 'Proposed Deductions & Contestation')}</span>
          </h4>

          {deductions.length === 0 ? (
            <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              {t('tenant.noDeductions', 'No security deposit deductions proposed. Full deposit eligible for return upon lease exit.')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {deductions.map((ded: any) => {
                const isExpired = ded.disputeDeadline ? new Date() > new Date(ded.disputeDeadline) : false;
                const canDispute = (ded.status === 'PROPOSED' || ded.status === 'OWNER_APPROVED' || ded.status === 'TENANT_NOTIFIED') && !ded.disputedAt && !isExpired;
                return (
                  <div key={ded.id} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 uppercase">{ded.category || 'DEDUCTION'}</span>
                        <span className="text-xs font-black text-rose-600" dir="ltr">
                          -{Number(ded.amount).toLocaleString()} {ded.currency || lease.currency}
                        </span>
                      </div>
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded ${
                        ded.status === 'DISPUTED' ? 'bg-amber-100 text-amber-800' :
                        ded.status === 'OWNER_APPROVED' ? 'bg-indigo-100 text-indigo-800' :
                        ded.status === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {ded.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">{ded.description}</p>

                    {ded.evidenceRefs && ded.evidenceRefs.length > 0 && (
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Camera className="w-3 h-3 text-slate-400" />
                        <span>{t('tenant.evidenceAttached', 'Evidence records attached ({count})').replace('{count}', String(ded.evidenceRefs.length))}</span>
                      </div>
                    )}

                    {ded.disputeDeadline && (
                      <div className={`text-[11px] font-bold ${isExpired ? 'text-slate-500' : 'text-amber-700'}`}>
                        {t('tenant.disputeWindowNotice', 'Contestation Window Closes: ')}
                        <span dir="ltr">{new Date(ded.disputeDeadline).toLocaleDateString()}</span>
                        {isExpired && <span className="ms-1.5 text-rose-600">({t('tenant.windowClosedBadge', 'Closed')})</span>}
                      </div>
                    )}

                    {ded.disputedAt && (
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-800 space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{t('tenant.disputeActive', 'Active Formal Dispute')}</span>
                        </div>
                        {ded.disputeReason && <p>{ded.disputeReason}</p>}
                      </div>
                    )}

                    {canDispute && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedDeductionForDispute(ded)}
                          className="px-3 py-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{t('tenant.disputeAction', 'Dispute Deduction')}</span>
                        </button>
                      </div>
                    )}

                    {isExpired && !ded.disputedAt && (
                      <div className="pt-2 flex justify-end">
                        <span className="px-2.5 py-1 text-[11px] font-bold text-slate-500 bg-slate-100 rounded-lg border border-slate-200">
                          {t('tenant.disputeWindowExpired', 'Dispute Window Expired')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Building Rules & Amenities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            {t('tenant.buildingRules', 'Building Rules & Guidelines')}
          </h3>
          <ul className="space-y-2.5 text-xs sm:text-sm text-slate-600">
            {((lease.buildingRules && lease.buildingRules.length > 0) ? lease.buildingRules : [
              t('tenant.ruleQuietHours', 'Quiet hours between 11:00 PM and 7:00 AM'),
              t('tenant.ruleBalcony', 'Balcony cleanliness and aesthetic guidelines'),
              t('tenant.ruleParking', 'Dedicated underground parking space B-14'),
              t('tenant.ruleWaste', 'Waste disposal chute active 24/7 on each floor'),
              t('tenant.ruleSublease', 'Subletting prohibited without prior written consent')
            ]).map((rule, idx) => {
              const r = rule.toLowerCase();
              let localizedRule = rule;
              if (r.includes('quiet') || r.includes('بێدەنگی') || r.includes('هدوء')) {
                localizedRule = t('tenant.ruleQuietHours', 'Quiet hours between 11:00 PM and 7:00 AM');
              } else if (r.includes('balcony') || r.includes('باڵکۆن') || r.includes('شرفة')) {
                localizedRule = t('tenant.ruleBalcony', 'Balcony cleanliness and aesthetic guidelines');
              } else if (r.includes('parking') || r.includes('وەستانی') || r.includes('موقف')) {
                localizedRule = t('tenant.ruleParking', 'Dedicated underground parking space B-14');
              } else if (r.includes('waste') || r.includes('خۆڵ') || r.includes('نفايات') || r.includes('chute')) {
                localizedRule = t('tenant.ruleWaste', 'Waste disposal chute active 24/7 on each floor');
              } else if (r.includes('sublease') || r.includes('لاوەکی') || r.includes('تأجير فرعي')) {
                localizedRule = t('tenant.ruleSublease', 'Subletting prohibited without prior written consent');
              }
              return (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{localizedRule}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            {t('tenant.propertyDetails', 'Property & Management Details')}
          </h3>
          <div className="space-y-2.5 text-xs sm:text-sm text-slate-600">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-500">{t('tenant.managementContact', 'Management Contact')}</span>
              <span className="font-bold text-slate-900">{lease.landlordName || 'HomeHub Autonomous Management'}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-500">{t('tenant.emergencyHotlines', 'Emergency Hotlines')}</span>
              <span className="font-bold text-slate-900" dir="ltr">+964 750 000 0000</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between">
              <span className="text-slate-500">{t('tenant.includedAmenities', 'Included Amenities')}</span>
              <span className="font-bold text-slate-900">{t('tenant.amenitiesList', 'HVAC, Water, 24/7 Security, Elevator')}</span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onMoveOut}
              className="w-full py-2.5 text-center text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('tenant.requestMoveOut', 'Request Move-out / Notice')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Property Photos & Gallery Card */}
      {photos.length > 0 && (
        <div id="tenant-lease-photos-card" className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t('tenant.propertyPhotos', 'Property Photos & Gallery')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('tenant.propertyPhotosDesc', 'High-resolution images of your leased home provided by the owner and management.')}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              {t('tenant.photosCount', '{count} Photos').replace('{count}', String(photos.length))}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
            {photos.map((photo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActivePhotoIdx(idx);
                  setGalleryOpen(true);
                }}
                className="group relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-100 border border-slate-200 hover:border-blue-500 hover:shadow-md transition-all cursor-pointer text-start"
              >
                <img
                  src={photo}
                  alt={`Property Photo ${idx + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/20 transition-colors" />
                {idx === 0 && (
                  <span className="absolute top-2 start-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                    {t('property.photos.cover_badge', 'Cover Photo')}
                  </span>
                )}
                <span className="absolute bottom-2 end-2 bg-slate-900/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  {idx + 1} / {photos.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Property Review & Verified Resident Feedback */}
      <div id="tenant-property-review-card" className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {t('reviews.propertyRatingHeading', 'Property Rating & Resident Experience')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('reviews.propertyRatingSub', 'Verified resident feedback on maintenance, amenities, and living conditions.')}
              </p>
            </div>
          </div>

          {/* Aggregate Rating Badge */}
          {propertyAggregate && propertyAggregate.totalReviews > 0 ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/60" dir="ltr">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-sm font-black text-amber-900">
                {propertyAggregate.averageRating.toFixed(1)}
              </span>
              <span className="text-xs font-semibold text-amber-700">
                ({propertyAggregate.totalReviews} {t('reviews.reviewsCount', 'reviews')})
              </span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-400 italic">
              {t('reviews.noReviewsYet', 'No resident reviews yet')}
            </span>
          )}
        </div>

        {/* User's Review Status or CTA */}
        {userReview ? (
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                  {t('reviews.yourReview', 'Your Submitted Review')}
                </span>
                <div className="flex items-center text-amber-400" dir="ltr">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-3.5 h-3.5 ${s <= userReview.rating ? 'fill-amber-400' : 'text-slate-200 fill-slate-100'}`}
                    />
                  ))}
                  <span className="ms-1.5 text-xs font-black text-slate-700">{userReview.rating}/5</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setReviewModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('reviews.editReview', 'Edit Review')}</span>
              </button>
            </div>

            {userReview.title && (
              <h4 className="text-xs font-bold text-slate-900">{userReview.title}</h4>
            )}

            <p className="text-xs text-slate-700 leading-relaxed italic">
              "{userReview.comment}"
            </p>

            {/* Official Owner / Management Response if present */}
            {userReview.ownerResponse && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-1">
                <span className="text-[11px] font-black text-emerald-900 block">
                  {t('reviews.managementResponse', 'Response from Property Management')}:
                </span>
                <p className="text-xs text-emerald-800 italic">
                  "{userReview.ownerResponse}"
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">
                {t('reviews.shareYourThoughts', 'How is your living experience at this property?')}
              </span>
              <p className="text-xs text-slate-500">
                {t('reviews.helpCommunity', 'Your honest review helps future residents and helps management improve building services.')}
              </p>
            </div>

            <button
              type="button"
              disabled={!isReviewEligible && !loadingReview}
              onClick={() => setReviewModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-black shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Star className="w-4 h-4 fill-white" />
              <span>{t('reviews.writeReview', 'Write a Review')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Photo Lightbox Modal */}
      {galleryOpen && photos.length > 0 && (
        <div 
          id="tenant-lease-photo-lightbox"
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setGalleryOpen(false)}
        >
          {/* Top Bar */}
          <div 
            className="flex items-center justify-between text-white pb-3 border-b border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 flex items-center justify-center text-blue-400">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{lease.unitNumber}, {lease.name}</h3>
                <p className="text-xs text-slate-400">
                  {t('tenant.photoOf', 'Photo {current} of {total}')
                    .replace('{current}', String(activePhotoIdx + 1))
                    .replace('{total}', String(photos.length))}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 hidden sm:inline-block px-2 py-1 bg-white/5 rounded-md border border-white/10 font-mono">
                ESC
              </span>
              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label={t('common.close', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Photo Viewing Stage */}
          <div 
            className="relative flex-1 flex items-center justify-center py-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[activePhotoIdx]}
              alt={`${lease.name} - ${activePhotoIdx + 1}`}
              className="max-h-[65vh] sm:max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all duration-300"
              referrerPolicy="no-referrer"
            />

            {/* Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  className="absolute start-2 sm:start-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-md transition-transform hover:scale-110 cursor-pointer"
                  aria-label={t('tenant.previousPhoto', 'Previous Photo')}
                >
                  <ChevronLeft className="w-6 h-6 rtl:rotate-180" />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  className="absolute end-2 sm:end-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white flex items-center justify-center border border-white/20 shadow-lg backdrop-blur-md transition-transform hover:scale-110 cursor-pointer"
                  aria-label={t('tenant.nextPhoto', 'Next Photo')}
                >
                  <ChevronRight className="w-6 h-6 rtl:rotate-180" />
                </button>
              </>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          {photos.length > 1 && (
            <div 
              className="pt-3 border-t border-white/10 flex items-center justify-center gap-2 overflow-x-auto max-w-full py-1"
              onClick={(e) => e.stopPropagation()}
            >
              {photos.map((photo, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 transition-all cursor-pointer ${
                    activePhotoIdx === idx
                      ? 'ring-2 ring-blue-500 scale-105 shadow-md shadow-blue-500/30'
                      : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={photo}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-0 inset-x-0 bg-blue-600/90 text-white text-[9px] font-bold text-center py-0.5 leading-none">
                      Cover
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tenant Dispute Deduction Modal */}
      {selectedDeductionForDispute && (
        <TenantDepositDisputeModal
          isOpen={!!selectedDeductionForDispute}
          onClose={() => setSelectedDeductionForDispute(null)}
          deduction={selectedDeductionForDispute}
          onSuccess={() => {
            setSelectedDeductionForDispute(null);
            fetchDepositAndInspectionDetails();
          }}
        />
      )}

      {/* Tenant Property Review Modal */}
      {reviewModalOpen && (
        <TenantPropertyReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          propertyId={lease.id}
          propertyName={`${lease.unitNumber}, ${lease.name}`}
          existingReview={userReview}
          onSuccess={(savedReview) => {
            setUserReview(savedReview);
            fetchReviewDetails();
          }}
        />
      )}
    </div>
  );
};
