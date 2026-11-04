import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { 
  Building, Building2, ShieldCheck, MapPin, CheckCircle, FileText, AlertCircle, Wrench, Activity, 
  TrendingUp, DollarSign, Percent, Clock, PlusCircle, HelpCircle, RefreshCw, BarChart2,
  Star, MessageSquare
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { PropertyPerformanceMetrics, PropertyValuationItem } from '../types/analytics';
import { useToast } from '../components/ui/Toast';
import { DepositInspectionModal } from '../components/owner/DepositInspectionModal';
import { PromotePropertyModal } from '../components/promotions/PromotePropertyModal';
import { Sparkles } from 'lucide-react';

export const PropertyCommandCenter: React.FC = () => {
  const { showToast } = useToast();
  const { t, direction } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { token, user } = useAuth();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [property, setProperty] = useState<any>(null);
  const [propertyListing, setPropertyListing] = useState<any | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<PropertyPerformanceMetrics | null>(null);
  const [valuations, setValuations] = useState<PropertyValuationItem[]>([]);
  const [currency, setCurrency] = useState<'IQD' | 'USD'>('IQD');
  const navigate = useNavigate();
  const [leases, setLeases] = useState<any[]>([]);
  const [activeLease, setActiveLease] = useState<any | null>(null);
  const [rentSchedules, setRentSchedules] = useState<any[]>([]);
  const [financialSummary, setFinancialSummary] = useState<any>(null);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);

  // Authoritative Property Reviews & Aggregate
  const [reviewsAggregate, setReviewsAggregate] = useState<any | null>(null);
  const [reviewsList, setReviewsList] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showValuationModal, setShowValuationModal] = useState(false);
  const [newValuation, setNewValuation] = useState({
    estimatedValue: '',
    currency: 'IQD',
    method: 'MANUAL_ESTIMATE',
    source: '',
    notes: '',
  });
  const [submittingValuation, setSubmittingValuation] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        setLoading(true);
        const resProp = await fetch(`/api/properties/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!resProp.ok) {
          if (resProp.status === 404) throw new Error("Property not found");
          throw new Error("Failed to load property details.");
        }
        setProperty(await resProp.json());

        const resRequests = await fetch(`/api/maintenance/property/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resRequests.ok) {
          setRequests(await resRequests.json());
        }

        // Authoritative lease & rent schedule fetching
        try {
          const resLeases = await fetch(`/api/properties/${id}/leases`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resLeases.ok) {
            const leasesData = await resLeases.json();
            setLeases(leasesData);
            const active = leasesData.find((l: any) => l.lease?.status === 'ACTIVE' || l.lease?.status === 'EXPIRING');
            if (active?.lease?.id) {
              setActiveLease(active);
              const resSchedule = await fetch(`/api/leases/${active.lease.id}/schedule`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (resSchedule.ok) {
                const schedData = await resSchedule.json();
                setRentSchedules(schedData);
              }
            }
          }
        } catch (leaseErr) {
          console.warn("Could not load lease schedules:", leaseErr);
        }

        // Authoritative financial summary fetching
        try {
          setFinancialLoading(true);
          const resFin = await fetch(`/api/properties/${id}/financial-summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resFin.ok) {
            const finData = await resFin.json();
            setFinancialSummary(finData);
            setFinancialError(null);
          } else {
            const errData = await resFin.json().catch(() => ({}));
            setFinancialError(errData.message || "Failed to load authoritative financial summary");
          }
        } catch (fErr: any) {
          setFinancialError(fErr.message);
        } finally {
          setFinancialLoading(false);
        }

        // Authoritative property reviews fetching
        try {
          const resReviews = await fetch(`/api/reviews/properties/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (resReviews.ok) {
            const revData = await resReviews.json();
            setReviewsAggregate(revData.aggregate || null);
            setReviewsList(revData.reviews || []);
          }
        } catch (revErr) {
          console.warn("Could not load property reviews:", revErr);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPropertyData();
  }, [id, token, refreshTrigger]);

  const fetchAnalytics = async () => {
    if (!id) return;
    setAnalyticsLoading(true);
    try {
      const [resPerf, resVals] = await Promise.all([
        fetch(`/api/analytics/properties/${id}?currency=${currency}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/analytics/properties/${id}/valuations`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (resPerf.ok) {
        const perfData = await resPerf.json();
        setAnalytics(perfData);
      }
      if (resVals.ok) {
        const valData = await resVals.json();
        setValuations(valData);
      }
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (id && token) {
      fetchAnalytics();
    }
  }, [id, currency, token]);

  const handleCreateValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newValuation.estimatedValue) return;
    setSubmittingValuation(true);
    try {
      const res = await fetch(`/api/analytics/properties/${id}/valuations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estimatedValue: parseFloat(newValuation.estimatedValue),
          currency: newValuation.currency,
          method: newValuation.method,
          source: newValuation.source || 'Manual submission',
          notes: newValuation.notes || undefined,
          status: 'FINAL',
        })
      });
      if (!res.ok) {
        const errJson = await res.json();
        showToast(errJson.error || "Failed to record valuation", 'error');
      } else {
        setShowValuationModal(false);
        setNewValuation({ estimatedValue: '', currency: 'IQD', method: 'MANUAL_ESTIMATE', source: '', notes: '' });
        fetchAnalytics();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to record valuation", 'error');
    } finally {
      setSubmittingValuation(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">{t('property.loading', 'Loading property details...')}</div>;
  if (error) return (
    <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-slate-200/80 rounded-3xl shadow-sm text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
        <Building2 className="w-7 h-7" />
      </div>
      <div className="space-y-1.5">
        <h3 className="text-xl font-bold text-slate-900">{t('property.error.access_title', 'Property Management Command Center')}</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          {error.includes('token') || error.includes('401') || error.includes('auth') || error.includes('Access denied') || error.includes('Failed to load')
            ? t('property.error.auth_restricted', 'Access to internal property analytics and financial operations requires an authorized Owner or Property Manager session.')
            : error}
        </p>
      </div>
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          to={`/rentals?propertyId=${id}`}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all shadow-xs inline-flex items-center justify-center"
        >
          {t('property.action.view_public_listing', 'View Public Rental Listing')}
        </Link>
        <Link
          to={`/login?redirect=/properties/${id}`}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm transition-all border border-slate-200/80 inline-flex items-center justify-center"
        >
          {t('property.action.sign_in_owner', 'Sign In as Owner')}
        </Link>
      </div>
    </div>
  );
  if (!property) return <div className="p-8 text-center text-slate-500">{t('property.not_found', 'Property not found.')}</div>;

  const renderMetric = (val: number | null | undefined, suffix = '', prefix = '') => {
    if (val === null || val === undefined) {
      return <span className="text-slate-400 text-xs italic">Insufficient Data</span>;
    }
    return <span className="font-semibold text-slate-900">{prefix}{val.toLocaleString(undefined, { maximumFractionDigits: 1 })}{suffix}</span>;
  };

  // Authoritative financial state & 3-Fee derivation from backend summary
  const hasActiveLease = financialSummary !== null
    ? Boolean(financialSummary.hasActiveLease)
    : Boolean(activeLease?.lease);

  const sortedSchedules = [...rentSchedules].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const currentSchedule = financialSummary?.currentSchedule || (sortedSchedules.length > 0
    ? (sortedSchedules.slice().reverse().find(s => s.status === 'PAID') ||
       sortedSchedules.find(s => s.status === 'UPCOMING' || s.status === 'OVERDUE' || s.status === 'PARTIALLY_PAID') ||
       sortedSchedules[0])
    : null);

  // Authoritative figures from server: NEVER treat schedule.paidAmount alone as confirmed income!
  const scheduledRentAmount = financialSummary
    ? Number(financialSummary.scheduledRentAmount || 0)
    : (currentSchedule ? Number(currentSchedule.amount || 0) : (activeLease?.lease?.rentAmount ? Number(activeLease.lease.rentAmount) : 0));

  const collectedRentAmount = financialSummary
    ? Number(financialSummary.confirmedCollectedRent || 0)
    : 0;

  const activeCurrency = financialSummary?.currency || currentSchedule?.currency || activeLease?.lease?.currency || property?.currency || currency;

  // Authoritative 3-Fee Model (Platform Fee, Rent Fee, Management Fee)
  const opModel = financialSummary?.operatingModel || property?.operatingModel || 'FULLY_MANAGED';
  const platformFeeRate = financialSummary ? Number(financialSummary.platformFeeRate || 0) : 0;
  
  const rentFeeRateRaw: number | null = (financialSummary?.rentFeeRate !== undefined)
    ? financialSummary.rentFeeRate
    : (property?.rentFee !== undefined && property?.rentFee !== null && String(property.rentFee).trim() !== '' ? parseFloat(property.rentFee) : null);

  const managementFeeRateRaw: number | null = (financialSummary?.managementFeeRate !== undefined)
    ? financialSummary.managementFeeRate
    : (property?.managementFee !== undefined && property?.managementFee !== null && String(property.managementFee).trim() !== '' ? parseFloat(property.managementFee) : null);

  const platformFeeAmount = financialSummary ? Number(financialSummary.platformFeeAmount || 0) : 0;
  const rentFeeAmount = financialSummary ? Number(financialSummary.rentFeeAmount || 0) : 0;
  const managementFeeAmount = financialSummary ? Number(financialSummary.managementFeeAmount || 0) : 0;
  const totalFeeAmount = financialSummary ? Number(financialSummary.totalFeeAmount || 0) : 0;
  const ownerNetAmount = financialSummary ? Number(financialSummary.ownerNetAmount || 0) : 0;

  const dueDate = currentSchedule?.dueDate || null;
  const paidDate = financialSummary?.latestConfirmedPayment?.recordedDate ||
                   financialSummary?.latestConfirmedPayment?.confirmedAt ||
                   null;

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const periodTitle = currentSchedule?.dueDate
    ? `${new Date(currentSchedule.dueDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ${t('property.rent', 'Rent')}`
    : t('property.rent_breakdown', 'Rent Collection & Payout');

  const getScheduleStatusBadge = () => {
    if (!hasActiveLease) {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{t('property.no_active_lease', 'No Active Lease')}</span>;
    }
    if (!currentSchedule) {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{t('property.no_schedule', 'No Schedule')}</span>;
    }
    if (collectedRentAmount >= scheduledRentAmount && scheduledRentAmount > 0) {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">{t('payment.status.confirmed', 'Collected')}</span>;
    }
    if (collectedRentAmount > 0) {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">{t('payment.status.partially_paid', 'Partially Collected')}</span>;
    }
    if (currentSchedule.status === 'OVERDUE') {
      return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">{t('payment.status.overdue', 'Overdue')}</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">{t('payment.status.upcoming', 'Upcoming')}</span>;
  };

  const getOperatingModelLabel = () => {
    switch (opModel) {
      case 'FULLY_MANAGED':
        return t('property.model.fully_managed_title', 'Fully Managed (All 3 Fees Apply)');
      case 'AGENT_LISTED_PLATFORM_MANAGED':
        return t('property.model.agent_listed_title', 'Agent Listed, Platform Managed (Platform + Mgmt Fee)');
      case 'AGENT_OPERATED':
        return t('property.model.agent_operated_title', 'Agent Operated (Platform Fee Only)');
      default:
        return opModel;
    }
  };

  const handleViewStatement = () => {
    if (user?.roles?.some((r: string) => ['PROPERTY_OWNER', 'COMPANY', 'COMPANY_MEMBER', 'PLATFORM_ADMIN'].includes(r))) {
      navigate('/owner');
    } else {
      showToast(t('statement.notice', 'Financial statement ledger is accessible to property owners and management companies in the Owner Workspace.'), 'info');
    }
  };

  const handleDownloadReceipt = () => {
    if (financialSummary?.latestConfirmedPayment) {
      const rcp = financialSummary.latestConfirmedPayment;
      const rcpNum = rcp.receiptNumber || (rcp.id ? `#RCP-${rcp.id.slice(0, 6).toUpperCase()}` : 'Confirmed');
      showToast(
        t('receipt.notice', `Payment receipt record verified (${rcpNum}). Formal PDF document download is pending banking/accounting export service integration.`),
        'info'
      );
    } else {
      showToast(t('receipt.none', 'No confirmed payment receipt is available for this period.'), 'info');
    }
  };

  return (
    <div className={`flex flex-col gap-6 ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* Header & Verification Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0c1322] p-6 rounded-2xl border border-amber-500/30 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl font-black text-white">{property.name || t('property.unnamed', 'Unnamed Property')}</h1>
            <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              {t('property.status.verified')}
            </span>
            {reviewsAggregate && reviewsAggregate.totalReviews > 0 && (
              <div
                id="property-command-center-reviews-badge"
                className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-bold"
                dir="ltr"
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{reviewsAggregate.averageRating.toFixed(1)}</span>
                <span className="text-[11px] text-amber-400/80 font-normal">
                  ({reviewsAggregate.totalReviews} {t('reviews.reviewsCount', 'reviews')})
                </span>
              </div>
            )}
          </div>
          <p className="text-slate-400 flex items-center gap-1 text-sm">
            <MapPin className="w-4 h-4 text-amber-400" /> {property.address?.city ? `${property.address.city}, ${property.address.street || ''}` : t('property.no_address', 'No address provided')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Promote & Sponsor Property Action */}
          <button
            type="button"
            data-testid="promote-property-btn"
            onClick={() => setPromoteModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
            <span>Promote Property</span>
          </button>

          <div className="flex items-center bg-[#080d19] rounded-xl p-1 border border-slate-800">
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${currency === 'USD' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              USD
            </button>
            <button
              onClick={() => setCurrency('IQD')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${currency === 'IQD' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              IQD
            </button>
          </div>
          <div className="text-end">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-0.5">{t('property.ownership.label', 'Ownership')}</p>
            <p className="text-sm font-black text-amber-400">{t('property.ownership.verified', 'Verified')}</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RENT COLLECTION & PAYOUT BREAKDOWN (Authoritative Relational Model)        */}
      {/* ========================================================================= */}
      <div className="bg-[#0c1322] rounded-2xl border border-slate-800/80 shadow-xl overflow-hidden mt-2">
        {/* Header Title */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">{periodTitle}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasActiveLease ? (activeLease?.tenant ? `${t('lease.tenant', 'Tenant')}: ${activeLease.tenant.firstName || ''} ${activeLease.tenant.lastName || ''}` : t('property.active_lease', 'Active Lease')) : t('property.vacant', 'Vacant / No Active Lease')}
            </p>
          </div>
          {getScheduleStatusBadge()}
        </div>

        {financialError && (
          <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            {t('property.financial_error', 'Authoritative financial records are temporarily unavailable. Data is not fabricated.')}
          </div>
        )}

        {/* Summary Dates & Amount */}
        <div className="p-5 grid grid-cols-3 gap-4 border-b border-slate-800 text-start" dir={direction}>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t('property.rent_amount', 'Rent Amount')}</p>
            <p className="text-lg font-black text-amber-400">
              {hasActiveLease ? `${scheduledRentAmount.toLocaleString()} ${activeCurrency}` : `—`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t('property.due_date', 'Due Date')}</p>
            <p className="text-sm font-bold text-white">{formatDate(dueDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">{t('property.paid_date', 'Paid Date')}</p>
            <p className="text-sm font-bold text-white">{formatDate(paidDate)}</p>
          </div>
        </div>

        {/* Collection Breakdown Box */}
        <div className="p-5">
          <div className="bg-[#080d19] border border-slate-800 rounded-xl overflow-hidden text-start" dir={direction}>
            <div className="px-4 py-3 bg-[#0c1322] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">{t('property.collection_breakdown', 'Collection Breakdown')}</h3>
                <p className="text-xs text-slate-400">{getOperatingModelLabel()}</p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 self-start sm:self-auto">
                {opModel}
              </span>
            </div>
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800">
              <span className="text-sm text-slate-300">{t('property.total_collected', 'Total Rent Collected (Confirmed)')}</span>
              <span className="text-sm font-black text-white" dir="ltr">{collectedRentAmount.toLocaleString()} {activeCurrency}</span>
            </div>

            {/* Dynamic 3-Fee Model Breakdown */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs text-slate-300">
              <span>Platform Fee ({(platformFeeRate * 100).toFixed(0)}%)</span>
              <span className={platformFeeAmount > 0 ? "font-bold text-rose-400" : "text-slate-500"} dir="ltr">
                {platformFeeAmount > 0 ? `- ${platformFeeAmount.toLocaleString()} ${activeCurrency}` : `0 ${activeCurrency}`}
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs text-slate-300">
              <span>{t('fee.rent_fee', 'Rent Fee')} {opModel === 'FULLY_MANAGED' ? (rentFeeRateRaw === null ? t('fee.not_configured', '(Not Configured)') : `(${((rentFeeRateRaw) * 100).toFixed(1)}%)`) : t('fee.not_applicable', '(Not Applicable)')}</span>
              <span className={rentFeeAmount > 0 ? "font-bold text-rose-400" : "text-slate-500"} dir="ltr">
                {opModel === 'FULLY_MANAGED' ? (rentFeeRateRaw === null ? '—' : (rentFeeAmount > 0 ? `- ${rentFeeAmount.toLocaleString()} ${activeCurrency}` : `0 ${activeCurrency}`)) : `N/A`}
              </span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-800 text-xs text-slate-300">
              <span>{t('fee.management_fee', 'Management Fee')} {opModel !== 'AGENT_OPERATED' ? (managementFeeRateRaw === null ? t('fee.not_configured', '(Not Configured)') : `(${((managementFeeRateRaw) * 100).toFixed(1)}%)`) : t('fee.not_applicable', '(Not Applicable)')}</span>
              <span className={managementFeeAmount > 0 ? "font-bold text-rose-400" : "text-slate-500"} dir="ltr">
                {opModel !== 'AGENT_OPERATED' ? (managementFeeRateRaw === null ? '—' : (managementFeeAmount > 0 ? `- ${managementFeeAmount.toLocaleString()} ${activeCurrency}` : `0 ${activeCurrency}`)) : `N/A`}
              </span>
            </div>

            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-800 bg-rose-500/10">
              <span className="text-sm font-bold text-rose-300">{t('property.total_fees', 'Total Applicable Fees')}</span>
              <span className="text-sm font-black text-rose-400" dir="ltr">
                {totalFeeAmount > 0 ? `- ${totalFeeAmount.toLocaleString()} ${activeCurrency}` : `0 ${activeCurrency}`}
              </span>
            </div>

            <div className="px-4 py-4 flex items-center justify-between bg-[#080d19]">
              <span className="text-base font-black text-white">{t('property.owner_net', 'Owner Receives (Net)')}</span>
              <span className="text-lg font-black text-emerald-400" dir="ltr">
                {ownerNetAmount.toLocaleString()} {activeCurrency}
              </span>
            </div>
          </div>
        </div>

        {/* Status Alert */}
        <div className="px-5 pb-5 text-start" dir={direction}>
          {collectedRentAmount > 0 && ownerNetAmount > 0 ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-300">
                    {ownerNetAmount.toLocaleString()} {activeCurrency} {t('payout.entitlement_recorded', 'net owner entitlement recorded')}
                  </p>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    {t('payout.gateway_notice', 'Disbursement gateway in pre-integration. Settlement payouts are managed via Owner Finances.')}
                  </p>
                </div>
              </div>
              <Link to="/owner" className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0">
                {t('payout.view_settlements', 'View Settlements →')}
              </Link>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-[#080d19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-200">
                    {hasActiveLease ? t('payout.none_awaiting', 'No Confirmed Collections Awaiting Payout') : t('payout.no_active_lease', 'No Active Lease Recorded')}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {hasActiveLease 
                      ? t('payout.collections_appear', 'Rent collections will appear here once confirmed in the system.') 
                      : t('payout.assign_lease', 'Assign or activate a lease to track scheduled rent and owner payouts.')}
                  </p>
                </div>
              </div>
              {hasActiveLease && (
                <Link to="/owner" className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0">
                  {t('payout.view_finances', 'View Finances →')}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-3">
          <button 
            type="button" 
            onClick={handleViewStatement}
            className="w-full sm:flex-1 py-2.5 rounded-xl border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-sm font-bold text-slate-200 transition"
          >
            {t('property.view_statement', 'View Full Statement')}
          </button>
          <button 
            type="button" 
            onClick={handleDownloadReceipt}
            className="w-full sm:flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-sm font-black transition shadow-md"
          >
            {t('property.download_receipt', 'Download Receipt')}
          </button>
          <button 
            type="button" 
            onClick={() => setDepositModalOpen(true)}
            disabled={!hasActiveLease}
            className="w-full sm:flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>{t('property.deposit_inspections', 'Deposit & Move-Out')}</span>
          </button>
        </div>
      </div>

      {/* STAGE 8: Financial & Investment Intelligence Section */}
      <div className="bg-[#0c1322] p-6 rounded-2xl border border-slate-800/80 shadow-xl text-white">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-amber-400" />
              Financial & Investment Intelligence
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Deterministic property performance, verified cash flow, yields, and appraisal history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAnalytics}
              className="p-2 text-slate-300 hover:text-amber-400 rounded-xl border border-slate-800 bg-[#080d19] hover:border-amber-500/30 transition cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 ${analyticsLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowValuationModal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black rounded-xl text-sm flex items-center gap-1.5 transition shadow-md cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 fill-slate-950" />
              Record Valuation
            </button>
          </div>
        </div>

        {analyticsLoading && !analytics ? (
          <div className="py-8 text-center text-slate-500">Loading deterministic property analytics...</div>
        ) : (
          <div className="space-y-6">
            {/* Primary KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Occupancy Rate</p>
                <div className="mt-1 flex items-baseline gap-1 text-white font-black text-lg">
                  {renderMetric(analytics?.occupancyRate, '%')}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {analytics?.occupiedUnits ?? 0} of {analytics?.totalUnits ?? 0} Units Occupied
                </p>
              </div>

              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Collection Rate</p>
                <div className="mt-1 text-white font-black text-lg">
                  {renderMetric(analytics?.collectionRate, '%')}
                </div>
                <p className="text-xs text-slate-500 mt-1">Confirmed vs Scheduled</p>
              </div>

              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Net Operating Income (NOI)</p>
                <div className="mt-1 text-amber-400 font-black text-lg">
                  {renderMetric(analytics?.netOperatingIncome, ` ${currency}`)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Gross Rev - OpEx (excl. CapEx)</p>
              </div>

              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Property Cash Flow</p>
                <div className="mt-1 text-emerald-400 font-black text-lg">
                  {renderMetric(analytics?.cashFlow?.netTotal, ` ${currency}`)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Authoritative Finance Cashflow</p>
              </div>
            </div>

            {/* Yields & Investment Returns */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Gross Yield</p>
                <div className="mt-1 text-white font-black text-lg">
                  {renderMetric(analytics?.grossRentalYield, '%')}
                </div>
                <p className="text-xs text-amber-400/80 mt-1">Annualized Rent / Value</p>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Net Yield / Cap Rate</p>
                <div className="mt-1 text-white font-black text-lg">
                  {renderMetric(analytics?.capitalizationRate, '%')}
                </div>
                <p className="text-xs text-amber-400/80 mt-1">Annualized NOI / Value</p>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Appreciation</p>
                <div className="mt-1 text-white font-black text-lg">
                  {renderMetric(analytics?.appreciationRate, '%')}
                </div>
                <p className="text-xs text-amber-400/80 mt-1">Valuation vs Acquisition</p>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Unrealized Gain</p>
                <div className="mt-1 text-white font-black text-lg">
                  {renderMetric(analytics?.unrealizedReturn, ` ${currency}`)}
                </div>
                <p className="text-xs text-amber-400 font-medium mt-1">UNREALIZED (Labelled)</p>
              </div>
            </div>

            {/* Arrears Aging & Expense Ratios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-800 bg-[#080d19] rounded-xl">
                <h3 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
                  <span>Rent Arrears & Aging</span>
                  <span className="text-xs font-normal text-rose-400">
                    Delinquency: {analytics?.delinquencyRate !== null && analytics?.delinquencyRate !== undefined ? `${analytics.delinquencyRate.toFixed(1)}%` : '0.0%'}
                  </span>
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-[#0c1322] border border-slate-800 rounded-lg">
                    <p className="text-[10px] text-slate-400 uppercase">0-30 Days</p>
                    <p className="text-sm font-bold text-slate-200">{analytics?.arrearsBuckets?.days0To30 ?? 0} {currency}</p>
                  </div>
                  <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <p className="text-[10px] text-amber-400 uppercase">31-60 Days</p>
                    <p className="text-sm font-bold text-amber-300">{analytics?.arrearsBuckets?.days31To60 ?? 0} {currency}</p>
                  </div>
                  <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <p className="text-[10px] text-orange-400 uppercase">61-90 Days</p>
                    <p className="text-sm font-bold text-orange-300">{analytics?.arrearsBuckets?.days61To90 ?? 0} {currency}</p>
                  </div>
                  <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                    <p className="text-[10px] text-rose-400 uppercase">90+ Days</p>
                    <p className="text-sm font-bold text-rose-300">{analytics?.arrearsBuckets?.days90Plus ?? 0} {currency}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 border border-slate-800 bg-[#080d19] rounded-xl">
                <h3 className="text-sm font-bold text-white mb-3">Operating & Maintenance Metrics</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Gross Revenue</p>
                    <p className="text-sm font-bold text-white">{renderMetric(analytics?.grossCollectedRent, ` ${currency}`)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Operating Expenses</p>
                    <p className="text-sm font-bold text-white">{renderMetric(analytics?.operatingExpenses, ` ${currency}`)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Maint. Ratio</p>
                    <p className="text-sm font-bold text-amber-400">{renderMetric(analytics?.maintenanceCostRatio, '%')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Valuation & Appraisal Intelligence */}
            <div className="p-5 bg-[#080d19] border border-slate-800 rounded-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Building className="w-5 h-5 text-amber-400" />
                    Property Valuation Intelligence
                  </h3>
                  <p className="text-xs text-slate-400">
                    Authoritative deeds, certified appraisals, platform models, and advisory estimates.
                  </p>
                </div>
                {analytics?.latestValuation && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Latest Status:</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      analytics.latestValuation.status === 'FINAL' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                      analytics.latestValuation.status === 'DRAFT' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {analytics.latestValuation.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      analytics.latestValuation.method === 'AUTHORITATIVE_DEED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      analytics.latestValuation.method === 'PROFESSIONAL_APPRAISAL' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' :
                      analytics.latestValuation.method === 'AI_ADVISORY' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {analytics.latestValuation.method.replace('_', ' ')}
                    </span>
                  </div>
                )}
              </div>

              {analytics?.latestValuation ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 p-4 bg-[#0c1322] border border-slate-800 rounded-xl">
                  <div>
                    <p className="text-xs text-slate-400">Current Market Valuation</p>
                    <p className="text-xl font-black text-amber-400">
                      <span dir="ltr">{analytics.latestValuation.estimatedValue.toLocaleString()} {analytics.latestValuation.currency}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Valuation Date & Source</p>
                    <p className="text-sm font-semibold text-slate-200">
                      {new Date(analytics.latestValuation.valuationDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{analytics.latestValuation.source}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Price per Area</p>
                    <p className="text-sm font-semibold text-slate-200">
                      {property.squareFeet ? (
                        <>
                          <span dir="ltr">{((analytics.latestValuation.estimatedValue / (property.squareFeet / 10.76391042))).toFixed(1)} {analytics.latestValuation.currency}/m²</span>
                        </>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Area not recorded</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#0c1322] border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-sm mb-4">
                  No valuation records found for this property. Record an appraisal or title deed value.
                </div>
              )}

              {/* Valuation History */}
              {valuations.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left text-slate-300">
                    <thead className="bg-[#0c1322] text-slate-400 uppercase font-semibold border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Valuation</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {valuations.map((v) => (
                        <tr key={v.id} className="hover:bg-[#111b2e]/50">
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-400">{new Date(v.valuationDate).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-bold text-amber-400 whitespace-nowrap">
                            <span dir="ltr">{v.estimatedValue.toLocaleString()} {v.currency}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                              v.method === 'AUTHORITATIVE_DEED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              v.method === 'PROFESSIONAL_APPRAISAL' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                              v.method === 'AI_ADVISORY' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                              'bg-slate-800 text-slate-300'
                            }`}>
                              {v.method}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 truncate max-w-xs text-slate-300">{v.source}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              v.status === 'FINAL' ? 'bg-emerald-500/20 text-emerald-300' :
                              v.status === 'DRAFT' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {v.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Context & Overview */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#0c1322] p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Building className="w-5 h-5 text-amber-400" />
              {t('property.overview')}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase font-bold">{t('property.size', 'Size')}</p>
                <p className="font-black text-white text-base mt-1">{property.squareFeet ? `${property.squareFeet} SqFt` : '--'}</p>
              </div>
              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase font-bold">{t('property.type', 'Type')}</p>
                <p className="font-black text-white text-base mt-1">{property.type ? t(property.type, property.type) : t('property.unknown', 'Unknown')}</p>
              </div>
              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase font-bold">Acquisition Cost</p>
                <p className="font-black text-amber-400 text-base mt-1">
                  {property.acquisitionCost ? (
                    <span dir="ltr">{Number(property.acquisitionCost).toLocaleString()} {property.currency || 'IQD'}</span>
                  ) : (
                    <span className="text-slate-500 text-xs italic">Unrecorded</span>
                  )}
                </p>
              </div>
              <div className="p-4 bg-[#080d19] border border-slate-800 rounded-xl">
                <p className="text-xs text-slate-400 uppercase font-bold">{t('core.status', 'Status')}</p>
                <p className="font-black text-emerald-400 text-base mt-1">{analytics?.occupancyRate === 100 ? 'Occupied' : 'Active'}</p>
              </div>
            </div>
          </div>

          {/* Maintenance & Tasks */}
          <div className="bg-[#0c1322] p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Wrench className="w-5 h-5 text-amber-400" />
              {t('property.maintenance')} & {t('property.tasks')}
            </h2>
            <div className="flex flex-col gap-3">
              {requests.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm bg-[#080d19] border border-slate-800 rounded-xl">{t('property.no_maintenance', 'No active maintenance requests.')}</div>
              ) : (
                requests.map((item) => (
                  <div key={item.request.id} className="flex flex-col md:flex-row md:items-center justify-between p-3.5 border border-slate-800 rounded-xl bg-[#080d19] hover:bg-[#111b2e] transition-colors gap-3">
                    <div className="flex items-start gap-3">
                      {item.request.priority === 'CRITICAL' ? (
                        <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
                      ) : item.request.status === 'COMPLETED' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                      ) : (
                        <Wrench className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="font-bold text-sm text-white">{item.request.title}</p>
                        <p className="text-xs text-slate-400">
                          {item.request.status} • {item.request.priority}
                        </p>
                      </div>
                    </div>
                    <Link to="/maintenance" className="text-sm font-bold text-amber-400 hover:text-amber-300 whitespace-nowrap">
                      {t('action.view_details', 'View Details')}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* STAGE 13: Resident Reviews & Living Experience */}
          <div id="property-resident-reviews-card" className="bg-[#0c1322] p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-xs">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {t('reviews.propertyRatingHeading', 'Property Rating & Resident Experience')}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {t('reviews.propertyRatingSub', 'Verified resident feedback on maintenance, amenities, and living conditions.')}
                  </p>
                </div>
              </div>

              {reviewsAggregate && reviewsAggregate.totalReviews > 0 ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 self-start sm:self-auto" dir="ltr">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-black">{reviewsAggregate.averageRating.toFixed(1)}</span>
                  <span className="text-xs text-amber-400/80">/ 5 ({reviewsAggregate.totalReviews})</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  {t('reviews.noReviewsYet', 'No resident reviews yet')}
                </span>
              )}
            </div>

            {reviewsAggregate && reviewsAggregate.totalReviews > 0 ? (
              <div className="space-y-5">
                {/* Aspect Ratings Breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-[#080d19] border border-slate-800 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('reviews.cleanliness', 'Cleanliness & Upkeep')}</p>
                    <p className="text-base font-black text-amber-400 mt-1" dir="ltr">
                      {reviewsAggregate.cleanlinessAverage ? `${reviewsAggregate.cleanlinessAverage} / 5` : '—'}
                    </p>
                  </div>
                  <div className="p-3.5 bg-[#080d19] border border-slate-800 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('reviews.maintenance', 'Maintenance')}</p>
                    <p className="text-base font-black text-amber-400 mt-1" dir="ltr">
                      {reviewsAggregate.maintenanceAverage ? `${reviewsAggregate.maintenanceAverage} / 5` : '—'}
                    </p>
                  </div>
                  <div className="p-3.5 bg-[#080d19] border border-slate-800 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('reviews.communication', 'Communication')}</p>
                    <p className="text-base font-black text-amber-400 mt-1" dir="ltr">
                      {reviewsAggregate.communicationAverage ? `${reviewsAggregate.communicationAverage} / 5` : '—'}
                    </p>
                  </div>
                  <div className="p-3.5 bg-[#080d19] border border-slate-800 rounded-xl">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('reviews.location', 'Location')}</p>
                    <p className="text-base font-black text-amber-400 mt-1" dir="ltr">
                      {reviewsAggregate.locationAverage ? `${reviewsAggregate.locationAverage} / 5` : '—'}
                    </p>
                  </div>
                </div>

                {/* Published Reviews Feed */}
                <div className="space-y-3">
                  {reviewsList.slice(0, 3).map((rev) => (
                    <div key={rev.id} className="p-4 bg-[#080d19] border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{rev.tenantName || t('reviews.verifiedResident', 'Verified Resident')}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                            {t('reviews.verifiedResident', 'Verified Resident')}
                          </span>
                        </div>
                        <div className="flex items-center text-amber-400" dir="ltr">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-3.5 h-3.5 ${s <= rev.rating ? 'fill-amber-400' : 'text-slate-700 fill-slate-800'}`}
                            />
                          ))}
                          <span className="ms-1.5 text-xs font-black text-amber-400">{rev.rating}/5</span>
                        </div>
                      </div>
                      {rev.title && <h4 className="text-xs font-bold text-slate-200">{rev.title}</h4>}
                      <p className="text-xs text-slate-300 leading-relaxed italic">"{rev.comment}"</p>
                      {rev.ownerResponse && (
                        <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 space-y-1">
                          <span className="text-[11px] font-bold block">{t('reviews.managementResponse', 'Response from Property Management')}:</span>
                          <p className="text-xs italic">"{rev.ownerResponse}"</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-slate-400 text-sm bg-[#080d19] border border-slate-800 rounded-xl">
                {t('reviews.noReviewsYet', 'No resident reviews yet for this property.')}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Docs */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#0c1322] p-6 rounded-2xl border border-slate-800 shadow-xl text-white">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <FileText className="w-5 h-5 text-amber-400" />
              {t('property.documents')}
            </h2>
            <ul className="flex flex-col gap-2">
              <li className="flex items-center gap-2 text-sm text-slate-300 p-2.5 hover:bg-[#080d19] rounded-xl cursor-pointer border border-transparent hover:border-slate-800 transition">
                <FileText className="w-4 h-4 text-amber-400" /> {t('document.title_deed', 'Title Deed (Verified)')}
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-300 p-2.5 hover:bg-[#080d19] rounded-xl cursor-pointer border border-transparent hover:border-slate-800 transition">
                <FileText className="w-4 h-4 text-amber-400" /> {t('document.floor_plan', 'Floor Plan PDF')}
              </li>
              <li className="flex items-center gap-2 text-sm text-slate-300 p-2.5 hover:bg-[#080d19] rounded-xl cursor-pointer border border-transparent hover:border-slate-800 transition">
                <FileText className="w-4 h-4 text-amber-400" /> {t('document.previous_lease', 'Previous Lease (Expired)')}
              </li>
            </ul>
          </div>

          <div className="bg-[#0c1322] p-6 rounded-2xl border border-slate-800 shadow-xl flex-1 text-white">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Activity className="w-5 h-5 text-amber-400" />
              {t('property.timeline')}
            </h2>
            <div className="relative border-l border-slate-800 ml-3 flex flex-col gap-4">
              <div className="pl-4 relative">
                <div className="w-2 h-2 bg-amber-400 rounded-full absolute -left-[5px] top-1.5 ring-4 ring-[#0c1322]"></div>
                <p className="text-xs text-slate-400 mb-0.5">{t('Today, 10:00 AM', 'Today, 10:00 AM')}</p>
                <p className="text-sm text-slate-200">{t('Maintenance requested by Company Admin', 'Maintenance requested by Company Admin')}</p>
              </div>
              <div className="pl-4 relative">
                <div className="w-2 h-2 bg-slate-600 rounded-full absolute -left-[5px] top-1.5 ring-4 ring-[#0c1322]"></div>
                <p className="text-xs text-slate-400 mb-0.5">{t('Oct 12, 2023', 'Oct 12, 2023')}</p>
                <p className="text-sm text-slate-200">{t('Management Agreement Active', 'Management Agreement Active')}</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modal for Valuation Recording */}
      {showValuationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-[#0c1322] rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-amber-500/30 text-white">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-black text-lg text-white">Record Property Valuation</h3>
              <button onClick={() => setShowValuationModal(false)} className="text-slate-400 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleCreateValuation} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Estimated Value</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newValuation.estimatedValue}
                  onChange={(e) => setNewValuation({ ...newValuation, estimatedValue: e.target.value })}
                  placeholder="e.g. 250000"
                  className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] rounded-xl text-sm text-white focus:border-amber-500/50 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Currency</label>
                  <select
                    value={newValuation.currency}
                    onChange={(e) => setNewValuation({ ...newValuation, currency: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] rounded-xl text-sm text-white outline-none"
                  >
                    <option value="USD" className="bg-[#0c1322] text-white">USD</option>
                    <option value="IQD" className="bg-[#0c1322] text-white">IQD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Method</label>
                  <select
                    value={newValuation.method}
                    onChange={(e) => setNewValuation({ ...newValuation, method: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] rounded-xl text-sm text-white outline-none"
                  >
                    <option value="AUTHORITATIVE_DEED" className="bg-[#0c1322] text-white">Authoritative Deed</option>
                    <option value="PROFESSIONAL_APPRAISAL" className="bg-[#0c1322] text-white">Appraisal</option>
                    <option value="PLATFORM_MODEL" className="bg-[#0c1322] text-white">Platform Model</option>
                    <option value="MANUAL_ESTIMATE" className="bg-[#0c1322] text-white">Manual Estimate</option>
                    <option value="AI_ADVISORY" className="bg-[#0c1322] text-white">AI Advisory</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Source / Appraiser</label>
                <input
                  type="text"
                  value={newValuation.source}
                  onChange={(e) => setNewValuation({ ...newValuation, source: e.target.value })}
                  placeholder="e.g. Al-Mansour Certified Real Estate Appraisals"
                  className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] rounded-xl text-sm text-white focus:border-amber-500/50 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Notes</label>
                <textarea
                  value={newValuation.notes}
                  onChange={(e) => setNewValuation({ ...newValuation, notes: e.target.value })}
                  rows={2}
                  placeholder="Valuation justification or inspection notes..."
                  className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] rounded-xl text-sm text-white focus:border-amber-500/50 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowValuationModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingValuation}
                  className="px-4 py-2 text-sm font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 rounded-xl disabled:opacity-50 cursor-pointer shadow-md"
                >
                  {submittingValuation ? 'Saving...' : 'Save Valuation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Deposit Escrow & Move-Out Inspection Modal */}
      {(activeLease?.lease?.id || leases[0]?.lease?.id || (financialSummary as any)?.activeLeaseId) && property && (
        <DepositInspectionModal
          isOpen={depositModalOpen}
          onClose={() => setDepositModalOpen(false)}
          leaseId={activeLease?.lease?.id || leases[0]?.lease?.id || (financialSummary as any)?.activeLeaseId}
          propertyId={property.id}
          propertyName={property.name}
          tenantName={activeLease?.tenant ? `${activeLease.tenant.firstName || ''} ${activeLease.tenant.lastName || ''}`.trim() : undefined}
          currency={activeCurrency}
          onSuccess={() => setRefreshTrigger(prev => prev + 1)}
        />
      )}

      {/* Property Promotion & Sponsorship Modal */}
      {property && (
        <PromotePropertyModal
          isOpen={promoteModalOpen}
          propertyId={property.id}
          propertyName={property.name}
          onClose={() => setPromoteModalOpen(false)}
          onSuccess={() => {
            showToast('Promotion campaign successfully submitted.', 'success');
          }}
        />
      )}
    </div>
  );
};

