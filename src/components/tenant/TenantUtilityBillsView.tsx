import React, { useState, useEffect } from 'react';
import { FileText, CreditCard, Droplet, Zap, Info, AlertCircle, RotateCw, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { useAuth } from '../AuthProvider';
import { useToast } from '../ui/Toast';

export const TenantUtilityBillsView: React.FC = () => {
  const { t, language, direction } = useI18n();
  const isRtl = direction === 'rtl';
  const { token: ctxToken } = useAuth();
  const token = (typeof window !== 'undefined' ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token')) : null) || ctxToken || 'dev-tenant';
  const { showToast } = useToast();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [paymentErrors, setPaymentErrors] = useState<Record<string, string>>({});

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tenant/utility-bills', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setBills(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [token]);

  const getBillTypeName = (type: string) => {
    switch (type) {
      case 'WATER':
        return language === 'ku' ? 'پسوڵەی ئاو' : language === 'ar' ? 'فاتورة المياه' : 'Water Bill';
      case 'ELECTRICITY':
        return language === 'ku' ? 'پسوڵەی کارەبا' : language === 'ar' ? 'فاتورة الكهرباء' : 'Electricity Bill';
      default:
        return language === 'ku' ? 'خزمەتگوزاری تر' : language === 'ar' ? 'خدمات أخرى' : `${type} Bill`;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'UNPAID':
        return language === 'ku' ? 'نەدراوە' : language === 'ar' ? 'غير مدفوع' : 'UNPAID';
      case 'PARTIAL':
        return language === 'ku' ? 'بەشێکی دراوە' : language === 'ar' ? 'مدفوع جزئياً' : 'PARTIALLY PAID';
      case 'PAID':
        return language === 'ku' ? 'دراوە' : language === 'ar' ? 'مدفوع' : 'PAID';
      default:
        return status;
    }
  };

  const handlePay = async (billId: string, amount: number) => {
    // Prevention of duplicate submissions
    if (payingBillId) return;

    setPayingBillId(billId);
    setPaymentErrors(prev => {
      const next = { ...prev };
      delete next[billId];
      return next;
    });

    try {
      const res = await fetch(`/api/tenant/utility-bills/${billId}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount, paymentMethod: 'SYSTEM' })
      });

      if (res.ok) {
        showToast(
          t('tenant.utility_paid_success', language === 'ku' ? 'پارەدانی پسوڵەی خزمەتگوزاری بە سەرکەوتوویی تۆمارکرا.' : 'Utility bill payment recorded successfully.'),
          'success'
        );
        await fetchBills();
      } else {
        const errData = await res.json().catch(() => ({}));
        const rawMsg = errData.message || errData.error || t('tenant.utility_payment_failed', 'Payment failed. Please verify your balance and try again.');
        const errMsg = typeof rawMsg === 'string' ? rawMsg.replace(/^(VALIDATION_ERROR|FORBIDDEN):\s*/i, '') : 'Payment failed';

        setPaymentErrors(prev => ({ ...prev, [billId]: errMsg }));
        showToast(errMsg, 'error');
      }
    } catch (e: any) {
      const errMsg = e.message || t('tenant.utility_network_error', 'Network error connecting to utility billing service.');
      setPaymentErrors(prev => ({ ...prev, [billId]: errMsg }));
      showToast(errMsg, 'error');
    } finally {
      setPayingBillId(null);
    }
  };

  return (
    <div className={`space-y-6 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-slate-900">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>{t('tenant.utilityBills', 'Utility Bills')}</span>
        </h3>
        
        {loading ? (
          <div className="flex items-center gap-2 text-slate-500 py-6 text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>{t('common.loading', 'Loading...')}</span>
          </div>
        ) : bills.length === 0 ? (
          <p className="text-slate-500 text-sm py-4">{t('tenant.no_utility_bills', language === 'ku' ? 'هیچ پسوڵەیەکی خزمەتگوزاری نەدۆزرایەوە.' : 'No utility bills found.')}</p>
        ) : (
          <div className="space-y-4">
            {bills.map(bill => (
              <div 
                key={bill.id} 
                data-testid={`utility-bill-card-${bill.id}`}
                className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 transition-colors"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    {bill.type === 'WATER' ? <Droplet className="w-6 h-6 text-blue-500 shrink-0" /> : 
                     bill.type === 'ELECTRICITY' ? <Zap className="w-6 h-6 text-amber-500 shrink-0" /> :
                     <Info className="w-6 h-6 text-slate-500 shrink-0" />}
                    <div>
                      <h4 className="font-bold text-slate-900">{getBillTypeName(bill.type)}</h4>
                      <p className="text-xs text-slate-500">
                        {t('tenant.due', 'Due')}: <span dir="ltr">{bill.dueDate || bill.billingDate}</span>
                      </p>
                      {bill.description && <p className="text-xs text-slate-500 mt-0.5">{bill.description}</p>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <div className="text-end">
                      <div className="font-bold text-lg text-slate-900 font-mono" dir="ltr">
                        {Number(bill.outstandingAmount).toLocaleString()} {bill.currency || 'IQD'}
                      </div>
                      <div className={`text-xs font-bold ${bill.status === 'PAID' ? 'text-emerald-600' : bill.status === 'PARTIAL' ? 'text-blue-600' : 'text-amber-600'}`}>
                        {getStatusLabel(bill.status)}
                      </div>
                    </div>
                    
                    {bill.outstandingAmount > 0 && (
                      <div>
                        {payingBillId === bill.id ? (
                          <button
                            type="button"
                            disabled
                            className="bg-blue-400 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 cursor-not-allowed opacity-80"
                          >
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('common.processing', 'Processing...')}</span>
                          </button>
                        ) : paymentErrors[bill.id] ? (
                          <button
                            type="button"
                            onClick={() => handlePay(bill.id, parseFloat(bill.outstandingAmount))}
                            disabled={payingBillId !== null}
                            data-testid={`pay-utility-${bill.id}`}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className="w-4 h-4" />
                            <span>{language === 'ku' ? 'دووبارە هەوڵدانەوە' : language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePay(bill.id, parseFloat(bill.outstandingAmount))}
                            disabled={payingBillId !== null}
                            data-testid={`pay-utility-${bill.id}`}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <CreditCard className="w-4 h-4" />
                            <span>{language === 'ku' ? 'پارەدان' : language === 'ar' ? 'دفع' : 'Pay'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Inline Error Notice */}
                {paymentErrors[bill.id] && (
                  <div
                    data-testid={`utility-error-${bill.id}`}
                    className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2 animate-in fade-in"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{paymentErrors[bill.id]}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentErrors(prev => {
                        const next = { ...prev };
                        delete next[bill.id];
                        return next;
                      })}
                      className="text-red-500 hover:text-red-800 font-bold text-[11px] cursor-pointer"
                    >
                      {language === 'ku' ? 'داخستن' : language === 'ar' ? 'إغلاق' : 'Dismiss'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
