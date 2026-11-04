import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { useI18n } from '../../i18n/I18nProvider';
import { FileText, Droplet, Zap, Info, Plus, X, Loader2, CheckCircle2 } from 'lucide-react';

export const OwnerUtilityBills: React.FC<{ propertyId: string }> = ({ propertyId }) => {
  const { token: ctxToken } = useAuth();
  const token = (typeof window !== 'undefined' ? (localStorage.getItem('homehub_auth_token') || localStorage.getItem('auth_token')) : null) || ctxToken || 'dev-owner';
  const { t, language, direction } = useI18n();
  const isRtl = direction === 'rtl';
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState<'ELECTRICITY' | 'WATER' | 'OTHER'>('ELECTRICITY');
  const [amount, setAmount] = useState('');
  const [billingDate, setBillingDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [description, setDescription] = useState('');

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/owner/properties/${propertyId}/utility-bills`, {
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
  }, [propertyId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(language === 'ku' ? 'تکایە بڕی دروست دیاریبکە' : language === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid positive amount');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/owner/properties/${propertyId}/utility-bills`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          amount: numAmount,
          billingDate,
          dueDate,
          description: description.trim() || undefined
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Failed to record bill');
      }

      setFormSuccess(language === 'ku' ? 'پسوڵەکە بەسەرکەوتوویی تۆمارکرا' : language === 'ar' ? 'تم تسجيل الفاتورة بنجاح' : 'Bill recorded successfully');
      setAmount('');
      setDescription('');
      await fetchBills();
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess(null);
      }, 1000);
    } catch (err: any) {
      setFormError(err.message || 'Error creating bill');
    } finally {
      setSubmitting(false);
    }
  };

  const getBillTypeName = (billType: string) => {
    switch (billType) {
      case 'WATER':
        return language === 'ku' ? 'پسوڵەی ئاو' : language === 'ar' ? 'فاتورة المياه' : 'Water Bill';
      case 'ELECTRICITY':
        return language === 'ku' ? 'پسوڵەی کارەبا' : language === 'ar' ? 'فاتورة الكهرباء' : 'Electricity Bill';
      default:
        return language === 'ku' ? 'خزمەتگوزاری تر' : language === 'ar' ? 'خدمات أخرى' : `${billType} Bill`;
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

  return (
    <div 
      data-testid={`owner-utility-bills-container-${propertyId}`}
      className={`mt-4 p-4 border border-rose-200 bg-rose-50/70 rounded-xl ${isRtl ? 'font-arabic' : 'font-sans'}`} 
      dir={direction}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-rose-800 flex items-center gap-2 text-sm">
          <FileText className="w-4 h-4" />
          <span>
            {language === 'ku' 
              ? `پسوڵە نەدراوەکانی خزمەتگوزاری (${bills.length})` 
              : language === 'ar' 
              ? `فواتير الخدمات غير المدفوعة (${bills.length})` 
              : `Unpaid Utility Bills (${bills.length})`}
          </span>
        </h4>
        <button
          type="button"
          id={`btn-owner-record-bill-${propertyId}`}
          onClick={() => {
            setFormError(null);
            setFormSuccess(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{language === 'ku' ? 'تۆمارکردنی پسوڵە' : language === 'ar' ? 'تسجيل فاتورة' : '+ Record Bill'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500 py-3 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
          <span>{t('common.loading', 'Loading...')}</span>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white/80 p-3 rounded-lg border border-rose-100 text-center">
          <p className="text-xs text-slate-500">
            {language === 'ku' ? 'هیچ پسوڵەیەکی نەدراو نییە بۆ ئەم موڵکە.' : language === 'ar' ? 'لا توجد فواتير غير مدفوعة لهذا العقار.' : 'No unpaid utility bills for this property.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map(bill => (
            <div 
              key={bill.id} 
              data-testid={`owner-bill-row-${bill.id}`}
              className="bg-white p-3 rounded-lg border border-rose-100 flex justify-between items-center shadow-xs"
            >
              <div className="flex items-center gap-3">
                {bill.type === 'WATER' ? <Droplet className="w-5 h-5 text-blue-500 shrink-0" /> : 
                 bill.type === 'ELECTRICITY' ? <Zap className="w-5 h-5 text-amber-500 shrink-0" /> :
                 <Info className="w-5 h-5 text-slate-500 shrink-0" />}
                <div>
                  <p className="text-sm font-bold text-slate-900">{getBillTypeName(bill.type)}</p>
                  <p className="text-xs text-slate-500">
                    <span>{language === 'ku' ? 'کرێچی: ' : language === 'ar' ? 'المستأجر: ' : 'Tenant: '}</span>
                    <span className="font-medium text-slate-800">
                      {bill.tenant ? `${bill.tenant.firstName} ${bill.tenant.lastName}` : (language === 'ku' ? 'نادیار' : language === 'ar' ? 'غير محدد' : 'N/A')}
                    </span>
                    {bill.tenant?.id && (
                      <span className="text-[10px] text-slate-400 ms-1 font-mono" dir="ltr">
                        (ID: {bill.tenant.id.substring(0, 8)}...)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <p className="font-bold text-rose-600 font-mono text-sm" dir="ltr">
                  {Number(bill.outstandingAmount).toLocaleString()} IQD
                </p>
                <p className={`text-[11px] font-bold ${bill.status === 'PARTIAL' ? 'text-blue-600' : 'text-amber-600'}`}>
                  {getStatusLabel(bill.status)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Utility Bill Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            id="owner-record-bill-modal"
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95"
            dir={direction}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-600" />
                <span>{language === 'ku' ? 'تۆمارکردنی پسوڵەی نوێ' : language === 'ar' ? 'تسجيل فاتورة جديدة' : 'Record New Utility Bill'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'ku' ? 'جۆری خزمەتگوزاری' : language === 'ar' ? 'نوع الخدمة' : 'Utility Type'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ELECTRICITY', 'WATER', 'OTHER'] as const).map(tOpt => (
                    <button
                      key={tOpt}
                      type="button"
                      onClick={() => setType(tOpt)}
                      className={`py-2 px-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        type === tOpt 
                          ? 'border-rose-600 bg-rose-50 text-rose-700' 
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {getBillTypeName(tOpt)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'ku' ? 'بڕی پسوڵە (دیناری عێراقی - IQD)' : language === 'ar' ? 'مبلغ الفاتورة (دينار عراقي - IQD)' : 'Amount (IQD)'}
                </label>
                <input
                  type="number"
                  id="owner-bill-amount-input"
                  min="1"
                  step="any"
                  required
                  placeholder="50,000"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-rose-600 font-mono text-sm"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ku' ? 'بەرواری دەرچوون' : language === 'ar' ? 'تاريخ الإصدار' : 'Billing Date'}
                  </label>
                  <input
                    type="date"
                    id="owner-bill-billing-date"
                    required
                    value={billingDate}
                    onChange={e => setBillingDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-rose-600 font-mono text-xs"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ku' ? 'بەرواری شایستە' : language === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                  </label>
                  <input
                    type="date"
                    id="owner-bill-due-date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-rose-600 font-mono text-xs"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {language === 'ku' ? 'تێبینی یان ژمارەی پێوەر (ئارەزوومەندانە)' : language === 'ar' ? 'ملاحظات أو رقم العداد (اختياري)' : 'Description / Meter Reading (Optional)'}
                </label>
                <input
                  type="text"
                  id="owner-bill-description-input"
                  placeholder={language === 'ku' ? 'بۆ نموونە: پێوەری کارەبای مانگی ٥' : 'e.g. May electricity meter reading'}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-rose-600 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold cursor-pointer"
                >
                  {language === 'ku' ? 'پاشگەزبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  id="btn-submit-owner-bill"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{language === 'ku' ? 'تۆمارکردن' : language === 'ar' ? 'حفظ' : 'Save Bill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
