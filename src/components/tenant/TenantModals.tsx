import React, { useState, useEffect } from 'react';
import { 
  X, 
  CreditCard, 
  QrCode, 
  Check, 
  ShieldCheck, 
  Wrench, 
  Upload, 
  RefreshCw, 
  LogOut, 
  Search, 
  Bell, 
  User, 
  Sparkles, 
  AlertTriangle,
  ArrowRight,
  Receipt,
  Building2,
  Building,
  ShoppingBag,
  Compass,
  Users,
  Home,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { 
  TenantPropertySummary, 
  TenantRentDue, 
  PayRentRequest,
  CreateTenantMaintenanceRequest,
  TenantLeaseRenewalRequest,
  TenantMoveOutRequest,
  TenantPaymentHistoryItem
} from '../../types/tenant.js';
import { useI18n } from '../../i18n/I18nProvider';
import { useToast } from '../../components/ui/Toast';
import { FeatureFlags } from '../../utils/featureFlags';

/**
 * 1. PAY RENT MODAL
 */
interface PayRentModalProps {
  isOpen: boolean;
  onClose: () => void;
  rentDue: TenantRentDue | null;
  property: TenantPropertySummary | null;
  onConfirmPayment: (payload: PayRentRequest) => Promise<void>;
}

export const PayRentModal: React.FC<PayRentModalProps> = ({
  isOpen,
  onClose,
  rentDue,
  property,
  onConfirmPayment,
}) => {
  const { showToast } = useToast();
  const { t, language } = useI18n();
  const [gateway, setGateway] = useState<'FIB' | 'FASTPAY' | 'ZAINCASH' | 'BANK_TRANSFER'>('FIB');
  const [processing, setProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);

  const baseCurrency = (rentDue?.currency || 'IQD').toUpperCase();
  const [selectedCurrency, setSelectedCurrency] = useState<string>(baseCurrency);
  const [exchangeQuote, setExchangeQuote] = useState<{ exchangeRate: number; convertedAmount: number } | null>(null);

  useEffect(() => {
    setSelectedCurrency(baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedCurrency !== baseCurrency && rentDue?.scheduleId) {
      const token = localStorage.getItem('auth_token') || '';
      fetch(`/api/tenant/payments/conversion-quote?scheduleId=${rentDue.scheduleId}&targetCurrency=${selectedCurrency}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.exchangeRate) {
          setExchangeQuote({ exchangeRate: data.exchangeRate, convertedAmount: data.convertedAmount });
        }
      })
      .catch(() => {});
    } else {
      setExchangeQuote(null);
    }
  }, [isOpen, selectedCurrency, baseCurrency, rentDue?.scheduleId]);

  if (!isOpen) return null;

  const baseRent = rentDue ? rentDue.amount : 350000;
  // NOTE: All HomeHub fees (Platform, Rent, Management) are owner-paid.
  // Tenant receipts must NOT display platform commission as a tenant charge.
  const isConverted = selectedCurrency !== baseCurrency;
  const effectiveAmount = isConverted && exchangeQuote ? exchangeQuote.convertedAmount : baseRent;
  const currency = selectedCurrency;

  const handlePay = async () => {
    setProcessing(true);
    try {
      await onConfirmPayment({
        scheduleId: rentDue?.scheduleId,
        propertyId: property?.id || 'prop-default',
        leaseId: property?.leaseId || 'lease-default',
        amount: effectiveAmount,
        currency: selectedCurrency,
        paymentMethod: gateway,
        referenceNumber: `TXN-${Date.now().toString().slice(-6)}`,
        allowConversion: true,
      });
      const generatedReceipt = `RCP-${Date.now().toString().slice(-6)}`;
      setSuccessReceipt(generatedReceipt);
    } catch (err: any) {
      showToast(`${t('tenant.paymentFailed', 'Payment failed')}: ${err.message}`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {!successReceipt ? (
          <>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-blue-600 uppercase">
                {t('tenant.directDigitalSettlement', 'Direct Digital Settlement')}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-0.5">
                {t('tenant.payMonthlyRent', 'Pay Monthly Rent')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {property?.name ? (
                  <>
                    <span>{property.name}</span>
                    {property.unitNumber ? <span className="ms-1 font-mono">({property.unitNumber})</span> : null}
                  </>
                ) : (
                  <span>{t('tenant.currentLeaseUnit', 'Current Lease Unit')}</span>
                )}
              </p>
            </div>

            {/* Dual Currency Selection & Live Central Bank Peg Rate */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {t('tenant.paymentCurrency', 'Payment Currency')}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {isConverted && exchangeQuote
                      ? `1 USD = ${exchangeQuote.exchangeRate.toLocaleString()} IQD (Central Bank Peg)`
                      : t('tenant.officialCentralBankRate', 'Authoritative Exchange Rate')}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200">
                {(['IQD', 'USD'] as const).map((curr) => (
                  <button
                    key={curr}
                    id={`btn-currency-${curr.toLowerCase()}`}
                    type="button"
                    onClick={() => setSelectedCurrency(curr)}
                    className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                      selectedCurrency === curr
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {curr}
                  </button>
                ))}
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{t('tenant.baseRent', 'Base Rent')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{effectiveAmount.toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span>{t('tenant.tenantSurcharge', 'Tenant Platform Surcharge (0%)')}</span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold">
                    {t('tenant.zeroPercentFree', '0% FREE')}
                  </span>
                </span>
                <span className="font-semibold text-emerald-600" dir="ltr">0 {currency}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-900">
                <span>{t('tenant.totalPayable', 'Total Amount Charged')}</span>
                <span className="text-blue-600" dir="ltr">{effectiveAmount.toLocaleString()} {currency}</span>
              </div>
              <p className="text-[10px] text-slate-500 italic mt-1 leading-normal">
                {t('tenant.zeroTenantSurchargeNote', '*Tenants pay zero extra fees. HomeHub platform fee is deducted from the collected rent upon owner remittance.')}
              </p>
            </div>

            {/* Gateway Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                {t('tenant.selectPaymentGateway', 'Select Payment Method')}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'FIB', nameKey: 'tenant.gwFib', defaultName: 'First Iraqi Bank (FIB)', icon: QrCode },
                  { id: 'FASTPAY', nameKey: 'tenant.gwFastpay', defaultName: 'FastPay Wallet', icon: CreditCard },
                  { id: 'ZAINCASH', nameKey: 'tenant.gwZaincash', defaultName: 'ZainCash', icon: CreditCard },
                  { id: 'BANK_TRANSFER', nameKey: 'tenant.gwRtgs', defaultName: 'Direct RTGS Wire', icon: ShieldCheck },
                ].map((item) => (
                  <button
                    key={item.id}
                    id={`btn-gateway-${item.id.toLowerCase()}`}
                    type="button"
                    onClick={() => setGateway(item.id as any)}
                    className={`p-3 rounded-xl border text-start flex flex-col gap-1 transition-all cursor-pointer ${
                      gateway === item.id
                        ? 'border-blue-600 bg-blue-50/50 text-blue-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="text-xs font-black">{t(item.nameKey, item.defaultName)}</span>
                    <span className="text-[10px] text-slate-500">{t('tenant.instantVerification', 'Instant Verification')}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              id="confirm-pay-rent-btn"
              type="button"
              disabled={processing}
              onClick={handlePay}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {processing ? (
                <span>{t('tenant.processingPayment', 'Processing with Central Bank Ingress...')}</span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>{t('tenant.confirmPay', 'Confirm Payment')} (<span dir="ltr">{effectiveAmount.toLocaleString()} {currency}</span>)</span>
                </>
              )}
            </button>
          </>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {t('tenant.paymentSuccessTitle', 'Payment Successful!')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('tenant.paymentSuccessDesc', 'Your rent payment has been confirmed and settled into the property ledger.')}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-start space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tenant.receiptNumber', 'Official Receipt:')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{successReceipt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tenant.amountPaid', 'Amount Paid:')}</span>
                <span className="font-bold text-slate-900" dir="ltr">{effectiveAmount.toLocaleString()} {currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('tenant.paymentStatus', 'Status:')}</span>
                <span className="font-bold text-emerald-600">✓ {t('tenant.confirmed', 'Confirmed')}</span>
              </div>
            </div>

            <button
              id="btn-done-pay-rent-modal"
              type="button"
              onClick={onClose}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              {t('tenant.done', 'Done')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 2. REQUEST MAINTENANCE MODAL
 */
interface RequestMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: TenantPropertySummary | null;
  onSubmit: (payload: CreateTenantMaintenanceRequest) => Promise<void>;
}

export const RequestMaintenanceModal: React.FC<RequestMaintenanceModalProps> = ({
  isOpen,
  onClose,
  property,
  onSubmit,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [category, setCategory] = useState<'PLUMBING' | 'ELECTRICAL' | 'HVAC' | 'APPLIANCE' | 'STRUCTURAL' | 'OTHER'>('PLUMBING');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      showToast(t('tenant.fillAllFields', 'Please fill out all required fields'), 'info');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        propertyId: property?.id || 'prop-default',
        unitId: property?.unitId,
        category,
        priority,
        title,
        description,
      });
      onClose();
    } catch (err: any) {
      showToast(`${t('tenant.submissionFailed', 'Submission failed')}: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="text-xl font-black text-slate-900">
            {t('tenant.requestMaintenance', 'Request Maintenance')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('tenant.maintenanceSubtitle', 'Dispatch a qualified technician for your unit at')} {property?.name || t('tenant.currentLeaseUnit', 'Current Lease Unit')}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.issueCategory', 'Issue Category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            >
              <option value="PLUMBING">{t('tenant.catPlumbing', 'Plumbing (Pipes, Faucets, Water Leak)')}</option>
              <option value="ELECTRICAL">{t('tenant.catElectrical', 'Electrical (Wiring, Breakers, Outlets)')}</option>
              <option value="HVAC">{t('tenant.catHvac', 'Heating / Cooling / AC Split')}</option>
              <option value="APPLIANCE">{t('tenant.catAppliance', 'Built-in Kitchen Appliances')}</option>
              <option value="STRUCTURAL">{t('tenant.catStructural', 'Doors, Locks, Windows, Walls')}</option>
              <option value="OTHER">{t('tenant.catOther', 'Other Issue')}</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.priorityLevel', 'Priority Level')}</label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    priority === p
                      ? p === 'URGENT' ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {p === 'LOW' ? t('tenant.prioLow', 'Low') : p === 'NORMAL' ? t('tenant.prioNormal', 'Normal') : p === 'HIGH' ? t('tenant.prioHigh', 'High') : t('tenant.prioUrgent', 'Urgent')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.titleSummary', 'Title / Brief Summary')}</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tenant.maintenanceTitlePlaceholder', 'e.g. Kitchen sink drain leaking under cabinet')}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            >
            </input>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.detailedDescription', 'Detailed Description')}</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('tenant.maintenanceDescPlaceholder', 'Provide exact symptoms, when it started, and preferred inspection hours...')}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-2">
            <button
              id="submit-maintenance-btn"
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {submitting ? t('tenant.submitting', 'Submitting Request...') : t('tenant.submitMaintenanceRequest', 'Submit Maintenance Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * 3. RENEW LEASE MODAL
 */
interface RenewLeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: TenantPropertySummary | null;
  onSubmit: (payload: TenantLeaseRenewalRequest) => Promise<void>;
}

export const RenewLeaseModal: React.FC<RenewLeaseModalProps> = ({
  isOpen,
  onClose,
  property,
  onSubmit,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [startDate, setStartDate] = useState('2026-05-01');
  const [endDate, setEndDate] = useState('2027-05-01');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        leaseId: property?.leaseId || 'lease-default',
        propertyId: property?.id || 'prop-default',
        proposedStartDate: startDate,
        proposedEndDate: endDate,
        tenantNotes: notes,
      });
      showToast(t('tenant.renewalSubmitted', 'Your lease renewal request has been submitted to the landlord for formal approval.'), 'info');
      onClose();
    } catch (err: any) {
      showToast(`${t('tenant.renewalFailed', 'Renewal failed')}: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="text-xl font-black text-slate-900">
            {t('tenant.requestLeaseRenewal', 'Request Lease Renewal')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('tenant.proposeExtensionFor', 'Propose a term extension for')} {property?.unitNumber ? `${property.unitNumber}, ` : ''}{property?.name || t('tenant.currentLeaseUnit', 'Current Lease Unit')}.
          </p>
        </div>

        <form onSubmit={handleRenew} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.proposedStart', 'Proposed Start')}</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.proposedEnd', 'Proposed End')}</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.tenantNotes', 'Tenant Notes (Optional)')}</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('tenant.renewalNotesPlaceholder', 'e.g. Requesting same monthly rent terms and additional AC servicing...')}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {submitting ? t('tenant.submitting', 'Submitting Request...') : t('tenant.submitRenewalRequest', 'Submit Renewal Request')}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * 4. MOVE OUT MODAL
 */
interface MoveOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: TenantPropertySummary | null;
  onSubmit: (payload: TenantMoveOutRequest) => Promise<void>;
}

export const MoveOutModal: React.FC<MoveOutModalProps> = ({
  isOpen,
  onClose,
  property,
  onSubmit,
}) => {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [moveOutDate, setMoveOutDate] = useState('2026-06-30');
  const [reason, setReason] = useState('');
  const [forwardingAddress, setForwardingAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleMoveOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        leaseId: property?.leaseId || 'lease-default',
        propertyId: property?.id || 'prop-default',
        requestedMoveOutDate: moveOutDate,
        reason: reason || t('tenant.defaultMoveOutReason', 'Relocating to another residence'),
        forwardingAddress,
      });
      showToast(t('tenant.moveOutNoticeRegistered', 'Your move-out notice has been registered. An exit inspection will be scheduled.'), 'info');
      onClose();
    } catch (err: any) {
      showToast(`${t('tenant.noticeFailed', 'Notice submission failed')}: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 relative space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 end-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h3 className="text-xl font-black text-slate-900">
            {t('tenant.formalMoveOutNotice', 'Formal Move-out Notice')}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {t('tenant.moveOutNoticeDesc', 'Initiate lease conclusion, exit inspection, and security deposit reconciliation.')}
          </p>
        </div>

        <form onSubmit={handleMoveOut} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.requestedDepartureDate', 'Requested Departure Date')}</label>
            <input
              type="date"
              required
              value={moveOutDate}
              onChange={(e) => setMoveOutDate(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.reasonForMove', 'Reason for Move')}</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{t('tenant.forwardingAddress', 'Forwarding Address & Account')}</label>
            <textarea
              rows={2}
              required
              value={forwardingAddress}
              onChange={(e) => setForwardingAddress(e.target.value)}
              placeholder={t('tenant.moveOutAddressPlaceholder', 'Address and FIB / bank IBAN for returning security deposit...')}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {submitting ? t('tenant.submitting', 'Submitting Notice...') : t('tenant.submitMoveOutNotice', 'Submit Move-out Notice')}
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * 5. SEARCH MODAL
 */
interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: 'home' | 'lease' | 'payments' | 'maintenance') => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { t } = useI18n();
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const items = [
    { title: t('tenant.searchItemRent', 'May 2026 Rent Payment'), category: t('tenant.payments', 'Payments'), view: 'payments' as const },
    { title: t('tenant.searchItemPlumbing', 'Plumbing - Kitchen Sink Issue'), category: t('tenant.maintenance', 'Maintenance'), view: 'maintenance' as const },
    { title: t('tenant.searchItemLease', 'Residential Lease Agreement B-101'), category: t('tenant.myLease', 'Lease'), view: 'lease' as const },
    { title: t('tenant.searchItemRules', 'Building Quiet Hours & Rules'), category: t('tenant.documents', 'Documents'), view: 'lease' as const },
  ];

  const filtered = items.filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-4 shadow-2xl border border-slate-100 space-y-3">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('tenant.searchPlaceholder', 'Search lease, payments, maintenance...')}
            className="flex-1 text-sm outline-hidden"
          />
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {filtered.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onNavigate(item.view);
                onClose();
              }}
              className="w-full text-start p-2.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-between text-xs cursor-pointer"
            >
              <span className="font-bold text-slate-800">{item.title}</span>
              <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                {item.category}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 6. NOTIFICATIONS DRAWER
 */
interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: any[]; // Passed from parent
}

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({ isOpen, onClose, notifications = [] }) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-sm h-full p-6 shadow-2xl space-y-4 animate-in slide-in-from-right duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-black text-slate-900">{t('tenant.notifications', 'Notifications')}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{n.title}</span>
                <span className="text-[10px] text-slate-400">{n.time}</span>
              </div>
              <p className="text-xs text-slate-600">{n.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * 7. AI ASSISTANT DRAWER
 */
interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onAskAI: (query: string) => Promise<any>;
}

export const AIAssistantDrawer: React.FC<AIAssistantDrawerProps> = ({ isOpen, onClose, onAskAI }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean; type?: string; disclaimer?: string }>>([
    {
      text: t('tenant.aiWelcome', 'Hello Ahmed! I am your HomeHub Rental Assistant. How can I help you regarding your apartment, lease rules, or rent payments?'),
      isUser: false,
      type: 'FACT',
    },
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleAsk = async (qText?: string) => {
    const textToAsk = qText || query;
    if (!textToAsk.trim()) return;

    setMessages(prev => [...prev, { text: textToAsk, isUser: true }]);
    setQuery('');
    setLoading(true);

    try {
      const response = await onAskAI(textToAsk);
      setMessages(prev => [
        ...prev,
        {
          text: response.answer,
          isUser: false,
          type: response.type,
          disclaimer: response.disclaimer,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { text: t('tenant.aiConsultError', 'Sorry, I could not retrieve lease context right now.'), isUser: false },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="bg-white w-full max-w-md h-full p-6 shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-base font-black text-slate-900">{t('tenant.rentalAssistant', 'Rental Assistant')}</h3>
                <span className="text-[10px] text-slate-400">{t('tenant.strictlyScopedAdvisory', 'Strictly Scoped Lease Advisory')}</span>
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="flex flex-wrap gap-1.5">
            {[
              t('tenant.promptRentDue', 'When is my next rent due?'),
              t('tenant.promptQuietHours', 'What are my building quiet hours?'),
              t('tenant.promptFivePercent', 'How is the HomeHub commission handled?'),
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAsk(p)}
                className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer text-start"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Chat Feed */}
          <div className="space-y-3 overflow-y-auto max-h-[440px] pt-2">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-2xl text-xs max-w-xs sm:max-w-sm ${
                  m.isUser ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}>
                  <p>{m.text}</p>
                  {m.type && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100/80 px-1.5 py-0.2 rounded-sm">
                      {m.type}
                    </span>
                  )}
                  {m.disclaimer && (
                    <p className="text-[10px] text-slate-400 mt-1 italic border-t border-slate-200/60 pt-1">
                      {m.disclaimer}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-xs text-slate-400 italic">{t('tenant.consultingLease', 'Consulting lease database...')}</div>
            )}
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="pt-3 border-t border-slate-100 flex items-center gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tenant.askAboutLease', 'Ask about your lease or rules...')}
            className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * 8. SWITCH ACCOUNT & PERSONA MODAL
 */
interface SwitchAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRole: (role: string, targetPath: string) => void;
  onLogout: () => void;
  currentRole?: string;
}

export const SwitchAccountModal: React.FC<SwitchAccountModalProps> = ({
  isOpen,
  onClose,
  onSelectRole,
  onLogout,
  currentRole = 'TENANT',
}) => {
  const { t, direction } = useI18n();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const personas = [
    {
      role: 'TENANT',
      title: t('role.tenant', 'Tenant'),
      subtitle: 'Ahmed Farhad • Apartment B-101',
      badge: 'Skyline Residence',
      icon: Home,
      path: '/tenant',
      color: 'bg-blue-600',
    },
    {
      role: 'PROPERTY_OWNER',
      title: t('role.owner', 'Property Owner'),
      subtitle: 'Salar Aziz • 10 Properties',
      badge: 'Portfolio & Fee Management',
      icon: Building2,
      path: '/owner',
      color: 'bg-emerald-600',
    },
    {
      role: 'COMPANY_ADMIN',
      title: t('role.company', 'Management Company'),
      subtitle: 'Zagros Real Estate • 45 Units Managed',
      badge: 'Full Company Workspace',
      icon: Building,
      path: '/company',
      color: 'bg-indigo-600',
    },
    {
      role: 'PLATFORM_ADMIN',
      title: t('role.platform_admin', 'Platform Super Admin'),
      subtitle: 'System Oversight & Governance',
      badge: 'SuperAdmin Access',
      icon: ShieldCheck,
      path: '/admin/dashboard',
      color: 'bg-purple-600',
    },
    ...(FeatureFlags.BUY_SELL_ENABLED ? [{
      role: 'BUYER',
      title: t('role.buyer', 'Buyer'),
      subtitle: 'Zana Mustafa • Property Discovery',
      badge: 'Search & Offers',
      icon: ShoppingBag,
      path: '/buyer',
      color: 'bg-amber-600',
    }] : []),
    {
      role: 'VENDOR',
      title: t('role.vendor', 'Service Vendor'),
      subtitle: 'Erbil Quick Fix Services',
      badge: 'Work Orders & Dispatch',
      icon: Wrench,
      path: '/vendor',
      color: 'bg-rose-600',
    },
    {
      role: 'EXPLORE',
      title: t('action.exit_to_home', 'Explore Marketplace / Home'),
      subtitle: 'Public Mode • Discovery & Listings',
      badge: 'Public Portal',
      icon: Compass,
      path: '/',
      color: 'bg-slate-700',
    },
  ];

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in-95 duration-150 cursor-default"
        dir={direction}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 mb-1">
              <Users className="w-3 h-3 text-blue-600" />
              <span>{t('action.switch_persona', 'Switch Persona')}</span>
            </div>
            <h3 className="text-lg font-black text-slate-900">
              {t('action.switch_account_modal_title', 'Switch Account & Workspaces')}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('action.switch_account_modal_desc', 'Choose an account persona or role to test workflows across the platform.')}
            </p>
          </div>
          <button
            id="btn-close-switch-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Persona Options Grid */}
        <div className="space-y-2 max-h-[380px] overflow-y-auto pe-1 scrollbar-thin">
          {personas.map((p) => {
            const Icon = p.icon;
            const isCurrent = currentRole.toUpperCase() === p.role;
            return (
              <button
                key={p.role}
                type="button"
                onClick={() => onSelectRole(p.role, p.path)}
                className={`w-full p-3 rounded-2xl border text-start flex items-center justify-between gap-3 transition-all cursor-pointer ${
                  isCurrent 
                    ? 'border-blue-500 bg-blue-50/60 shadow-xs ring-1 ring-blue-500' 
                    : 'border-slate-200/80 bg-white hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl ${p.color} text-white flex items-center justify-center shrink-0 shadow-xs`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {p.title}
                      </span>
                      {isCurrent && (
                        <span className="px-1.5 py-0.2 rounded-md bg-blue-600 text-white text-[9px] font-black uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {p.subtitle}
                    </p>
                  </div>
                </div>

                <div className="text-end shrink-0 hidden sm:block">
                  <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200/60 block">
                    {p.badge}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors border border-rose-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>{t('action.sign_out', 'Sign Out')}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            {t('action.stay_here', 'Stay on Tenant Portal')}
          </button>
        </div>
      </div>
    </div>
  );
};

export { WorkspaceSwitcherModal as TenantWorkspaceSwitcherModal } from '../common/WorkspaceSwitcherModal';


