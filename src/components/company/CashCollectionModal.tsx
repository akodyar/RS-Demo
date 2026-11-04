import React, { useState, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { X, DollarSign, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { CompanyPropertyItem } from '../../types/company';

interface CashCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties?: CompanyPropertyItem[];
  onSubmitNotice?: (msg: string) => void;
  token?: string;
}

export const CashCollectionModal: React.FC<CashCollectionModalProps> = ({ 
  isOpen, onClose, properties = [], onSubmitNotice, token 
}) => {
  const { t, direction } = useI18n();
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Record, 2: Confirm, 3: Reverse
  const [members, setMembers] = useState<any[]>([]);
  
  // Form State
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [amount, setAmount] = useState('');
  const [collectorId, setCollectorId] = useState('');
  const [reversePaymentId, setReversePaymentId] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Pending payments for confirmation
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (step === 1) fetchMembers();
      if (step === 2) fetchPendingPayments();
    }
  }, [isOpen, step]);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/company/members', {
        headers: {
          'Authorization': `Bearer ${token || 'dev-company'}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
        if (data.length > 0 && !collectorId) {
          setCollectorId(data[0].userId);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPendingPayments = async () => {
    setLoading(true);
    try {
      // We would ideally have an endpoint like GET /api/leases/payments?status=RECORDED
      // For now, assume this endpoint exists or mock it if unavailable.
      const res = await fetch('/api/company/pending-payments', {
        headers: {
          'Authorization': `Bearer ${token || 'dev-company'}`,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPayments(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/leases/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'dev-company'}`
        },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          leaseId: selectedLeaseId,
          rentScheduleId: selectedScheduleId || undefined,
          payerId: 'user_tenant_01', // Should be dynamic based on lease, hardcoded for now or we need lease details
          amount: Number(amount),
          paymentMethod: 'CASH',
          collectorId: collectorId || 'dev-company',
          referenceNumber: `CASH-${Date.now()}`
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to record cash payment');
      
      setSuccess(`Payment successfully RECORDED (ID: ${data.id})`);
      if (onSubmitNotice) onSubmitNotice('Cash payment recorded successfully');
      
      // Reset form
      setAmount('');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (paymentId: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/leases/payments/${paymentId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'dev-company'}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to confirm cash payment');
      
      setSuccess(`Payment successfully CONFIRMED! Fees posted.`);
      if (onSubmitNotice) onSubmitNotice('Cash payment confirmed successfully');
      
      fetchPendingPayments();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/leases/payments/${reversePaymentId}/reverse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || 'dev-company'}`
        },
        body: JSON.stringify({
          reason: 'Manual cash payment reversal via Company Workspace'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to reverse cash payment');
      
      setSuccess(`Payment (ID: ${reversePaymentId}) successfully REVERSED. Financial adjustments applied.`);
      if (onSubmitNotice) onSubmitNotice('Cash payment reversed successfully');
      setReversePaymentId('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div data-testid="cash-collection-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" dir={direction}>
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cash Collection Workflow</h2>
              <p className="text-xs text-slate-500">Record and confirm physical cash rent payments</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-100 overflow-x-auto">
          <button 
            className={`flex-1 py-3 text-sm font-bold whitespace-nowrap px-4 ${step === 1 ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setStep(1)}
          >
            1. Record Cash
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-bold whitespace-nowrap px-4 ${step === 2 ? 'border-b-2 border-emerald-600 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setStep(2)}
          >
            2. Confirm Cash
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-bold whitespace-nowrap px-4 ${step === 3 ? 'border-b-2 border-rose-600 text-rose-600' : 'text-slate-500 hover:bg-slate-50'}`}
            onClick={() => setStep(3)}
          >
            3. Reverse Payment
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div data-testid="error-message" className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm flex items-start gap-2 border border-rose-200">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div data-testid="success-message" className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex items-start gap-2 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleRecordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Property</label>
                <select 
                  data-testid="property-selector"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Property --</option>
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Lease ID</label>
                <input 
                  type="text" 
                  data-testid="lease-selector"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  value={selectedLeaseId}
                  onChange={(e) => setSelectedLeaseId(e.target.value)}
                  placeholder="Enter Lease ID"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rent Schedule ID (Optional for Overpayment check)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  placeholder="Enter Rent Schedule ID"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Physical Cash Collector</label>
                <select 
                  data-testid="collector-selector"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500"
                  value={collectorId}
                  onChange={(e) => setCollectorId(e.target.value)}
                  required
                >
                  <option value="">-- Select Authorized Collector --</option>
                  {members.map(m => (
                    <option key={m.userId} value={m.userId}>{m.userEmail} ({m.role})</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Identifies who physically received the cash. The Confirmer identity is automatically assigned to you.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount Collected (IQD)</label>
                <input 
                  type="number" 
                  data-testid="amount-input"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-emerald-500 font-bold"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 1000000"
                  required
                  min="1"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  data-testid="btn-record-cash"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Record Payment (CASH)
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-900">Payments Pending Confirmation</h3>
                <button onClick={fetchPendingPayments} className="text-emerald-600 hover:text-emerald-700 text-xs flex items-center gap-1 font-bold">
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
              
              {pendingPayments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
                  No pending cash payments found.
                </div>
              ) : (
                pendingPayments.map(payment => (
                  <div key={payment.id} className="border border-slate-200 rounded-xl p-4 flex justify-between items-center bg-white shadow-sm">
                    <div>
                      <p className="font-bold text-slate-900">{payment.amount.toLocaleString()} IQD <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600 ml-2">{payment.paymentMethod}</span></p>
                      <p className="text-xs text-slate-500 mt-1">Property: {payment.propertyId} | Tenant: {payment.payerId}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Collector: {payment.collectorId}</p>
                    </div>
                    <button 
                      data-testid="btn-confirm-cash"
                      onClick={() => handleConfirm(payment.id)}
                      disabled={loading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                    >
                      Confirm Payment
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleReverse} className="flex flex-col gap-4">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl mb-2">
                <p className="text-sm text-rose-800 font-bold mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Warning: Financial Reversal
                </p>
                <p className="text-xs text-rose-700">
                  Reversing a payment will mark the payment as REVERSED, back out HomeHub fees, and back out the Owner Payable from internal settlements. This action is auditable and cannot be permanently deleted.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment ID to Reverse</label>
                <input 
                  type="text" 
                  data-testid="reverse-payment-id"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-500"
                  value={reversePaymentId}
                  onChange={(e) => setReversePaymentId(e.target.value)}
                  placeholder="Enter the confirmed Payment ID"
                  required
                />
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  data-testid="btn-reverse-cash"
                  disabled={loading || !reversePaymentId}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  Confirm Reversal
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
