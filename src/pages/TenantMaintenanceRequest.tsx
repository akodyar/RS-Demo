import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Wrench, ChevronLeft, UploadCloud, CheckCircle } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

export const TenantMaintenanceRequest: React.FC = () => {
  const { t, language, direction } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user } = useAuth();
  const isRtl = direction === 'rtl';
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const initialPropertyId = searchParams.get('propertyId') || '';

  const [formData, setFormData] = useState({
    title: '',
    category: 'PLUMBING',
    priority: 'NORMAL',
    description: '',
    propertyId: initialPropertyId,
  });

  useEffect(() => {
    const qProp = searchParams.get('propertyId');
    if (qProp && qProp !== formData.propertyId) {
      setFormData(prev => ({ ...prev, propertyId: qProp }));
    }
  }, [searchParams]);

  const categories = [
    { id: 'PLUMBING', label: language === 'ku' ? 'بۆری و ئاوەڕۆ' : language === 'ar' ? 'السباكة والمياه' : 'Plumbing (Leaks, Clogs)' },
    { id: 'ELECTRICAL', label: language === 'ku' ? 'کارەبا و ڕووناکی' : language === 'ar' ? 'الكهرباء والإنارة' : 'Electrical (Outlets, Lights)' },
    { id: 'HVAC', label: language === 'ku' ? 'گەرمکەر و ساردکەرەوە' : language === 'ar' ? 'التدفئة والتكييف' : 'Heating & AC' },
    { id: 'APPLIANCE', label: language === 'ku' ? 'ئامێرەکانی ناوماڵ' : language === 'ar' ? 'الأجهزة المنزلية' : 'Appliances' },
    { id: 'STRUCTURAL', label: language === 'ku' ? 'دەرگا، پەنجەرە و دیوار' : language === 'ar' ? 'الأبواب والنوافذ والجدران' : 'Doors, Windows, Walls' },
    { id: 'PEST_CONTROL', label: language === 'ku' ? 'قڕکردنی مێروو' : language === 'ar' ? 'مكافحة الحشرات' : 'Pest Control' },
    { id: 'OTHER', label: language === 'ku' ? 'هی تر' : language === 'ar' ? 'أخرى' : 'Other' },
  ];

  const priorities = [
    { id: 'LOW', label: language === 'ku' ? 'نزم - ئاسایی' : language === 'ar' ? 'منخفض - روتيني' : 'Low - Routine Issue' },
    { id: 'MEDIUM', label: language === 'ku' ? 'مامناوەند - پێویستی بە بەدواداچوونە' : language === 'ar' ? 'متوسط - يحتاج متابعة' : 'Medium - Needs attention soon' },
    { id: 'HIGH', label: language === 'ku' ? 'بەرز - بەپەلە' : language === 'ar' ? 'عالي - عاجل' : 'High - Urgent issue' },
    { id: 'CRITICAL', label: language === 'ku' ? 'فریاگوزاری - مەترسی دەستبەجێ' : language === 'ar' ? 'طوارئ - خطر داهم' : 'Emergency - Immediate risk' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let targetPropertyId = formData.propertyId;
      if (!targetPropertyId) {
        const leaseRes = await fetch('/api/leases/my-leases', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (leaseRes.ok) {
          const leases = await leaseRes.json();
          const today = new Date().toISOString().slice(0, 10);
          const validLease = leases.find((item: any) => {
            const l = item.lease || item;
            return (l.status === 'ACTIVE' || l.status === 'EXPIRING') && (!l.endDate || l.endDate >= today);
          }) || leases[0];

          if (validLease?.property?.id) {
            targetPropertyId = validLease.property.id;
          } else if (validLease?.lease?.propertyId) {
            targetPropertyId = validLease.lease.propertyId;
          } else if (validLease?.propertyId) {
            targetPropertyId = validLease.propertyId;
          }
        }
      }

      if (!targetPropertyId) {
        throw new Error(language === 'ku' ? 'هیچ گرێبەستێکی کرێی چالاکت نییە لەگەڵ ئەم موڵکە.' : language === 'ar' ? 'ليس لديك عقد إيجار نشط مرتبط بعقار.' : 'You do not have an active lease attached to a property.');
      }

      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          propertyId: targetPropertyId,
          unitId: null,
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || (language === 'ku' ? 'ناردنی داواکاری سەرکەوتوو نەبوو.' : 'Failed to submit request.'));
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`min-h-screen bg-[#070b14] text-white py-12 px-4 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
        <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-[#0c1322] rounded-3xl shadow-2xl border border-amber-500/30 text-center space-y-5 animate-in zoom-in-95">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
            <CheckCircle className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h2 className="text-2xl font-black text-white">
            {language === 'ku' ? 'داواکاری چاکسازی تۆمارکرا' : language === 'ar' ? 'تم تسجيل طلب الصيانة بنجاح' : 'Maintenance Request Submitted'}
          </h2>
          <div className="p-4 rounded-2xl bg-[#111b2e] border border-amber-500/25 text-xs text-slate-300 text-start space-y-2 font-medium leading-relaxed">
            <p className="font-bold flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              {language === 'ku' ? 'سیستەمی زیرەکی هۆم هاب (AI Triage):' : language === 'ar' ? 'نظام الفرز الذكي (AI Triage):' : 'HomeHub AI Triage System:'}
            </p>
            <p className="text-slate-300">
              {language === 'ku'
                ? 'داواکارییەکەت پۆلێنکرا و پێشنیاری نرخ (Bidding) بۆ ٤ دابینکەر و وەستای باوەڕپێکراو لە ناوچەکەت نێردرا. خاوەن موڵک بە یەک کلیک باشترین نرخ پەسەند دەکات.'
                : language === 'ar'
                ? 'تم تصنيف طلبك وإرسال مناقصة الأسعار إلى 4 مزودين وفنيين معتمدين في منطقتك. يمكن للمالك اعتماد أفضل عرض بنقرة واحدة.'
                : 'Your request has been categorized and dispatched for competitive quotes to 4 verified vendors in your district. The owner can review and approve with one click.'}
            </p>
          </div>
          <div className="pt-2">
            <button 
              type="button"
              onClick={() => navigate('/workspace/tenant')}
              className="bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 active:scale-95 text-slate-950 font-black px-8 py-3 rounded-xl text-sm transition-all shadow-lg shadow-amber-950/40 cursor-pointer"
            >
              {language === 'ku' ? 'گەڕانەوە بۆ داشبۆردی کرێچی' : language === 'ar' ? 'العودة إلى لوحة المستأجر' : 'Return to Tenant Dashboard'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#070b14] text-white py-8 px-4 sm:px-6 lg:px-8 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-400 hover:text-amber-300 font-medium mb-6 transition-colors cursor-pointer text-sm"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {language === 'ku' ? 'گەڕانەوە' : language === 'ar' ? 'رجوع' : 'Back'}
        </button>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
              <Wrench className="w-5 h-5 text-amber-400" />
            </div>
            <span>{language === 'ku' ? 'داواکاری نوێی چاکسازی' : language === 'ar' ? 'طلب صيانة جديد' : 'New Maintenance Request'}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {language === 'ku' ? 'تکایە وردەکاری ئەو کێشەیە بنووسە کە ڕووبەڕووی بوویتەتەوە.' : language === 'ar' ? 'يرجى تقديم تفاصيل حول المشكلة التي تواجهها.' : 'Please provide details about the issue you are experiencing.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-950/40 border border-rose-800/60 rounded-2xl text-sm text-rose-300 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#0c1322] rounded-3xl shadow-2xl border border-slate-800/90 overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            
            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                {language === 'ku' ? 'ناونیشانی کێشەکە' : language === 'ar' ? 'عنوان المشكلة' : 'Issue Title'}
              </label>
              <input 
                type="text" 
                required
                placeholder={language === 'ku' ? 'نموونە: دزەکردنی ئاوی سینکی چێشتخانە' : language === 'ar' ? 'مثال: تسريب مياه من مغسلة المطبخ' : 'e.g., Leaking kitchen sink'}
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                className="w-full px-4 py-2.5 bg-[#080d19] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 outline-none text-sm" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                  {language === 'ku' ? 'جۆری کێشە (پۆلێن)' : language === 'ar' ? 'الفئة' : 'Category'}
                </label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[#080d19] border border-slate-700/80 rounded-xl text-white focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 outline-none text-sm cursor-pointer" 
                >
                  {categories.map(c => <option key={c.id} value={c.id} className="bg-[#0c1322] text-white">{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                  {language === 'ku' ? 'ئاستی لەپێشینەیی' : language === 'ar' ? 'الأولوية' : 'Priority'}
                </label>
                <select 
                  value={formData.priority} 
                  onChange={e => setFormData({...formData, priority: e.target.value})}
                  className="w-full px-4 py-2.5 bg-[#080d19] border border-slate-700/80 rounded-xl text-white focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 outline-none text-sm cursor-pointer" 
                >
                  {priorities.map(p => <option key={p.id} value={p.id} className="bg-[#0c1322] text-white">{p.label}</option>)}
                </select>
              </div>
            </div>

            {formData.priority === 'CRITICAL' && (
              <div className="bg-amber-950/40 border border-amber-500/40 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-300">
                    {language === 'ku' ? 'ڕێکاری فریاگوزاری خێرا' : language === 'ar' ? 'بروتوكول الطوارئ' : 'Emergency Protocol'}
                  </p>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {language === 'ku' 
                      ? 'بۆ فریاگوزارییە هەستیارەکان (وەک لافاوی زۆر یان ئاگرکەوتنەوە)، تکایە دەستبەجێ پەیوەندی بە ژمارەی فریاکەوتن یان هێڵی گەرمی ٢٤/٧ بکە.' 
                      : language === 'ar' 
                      ? 'لحالات الطوارئ الحرجة (مثل الفيضانات الكبيرة أو الحريق)، يرجى الاتصال بخدمات الطوارئ فوراً أو الاتصال بالخط الساخن على مدار الساعة.' 
                      : 'For critical emergencies (e.g., major flooding, fire), please contact emergency services immediately or call the property 24/7 hotline directly.'}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                {language === 'ku' ? 'ڕوونکردنەوەی ورد' : language === 'ar' ? 'الوصف التفصيلي' : 'Detailed Description'}
              </label>
              <textarea 
                required
                rows={4}
                placeholder={language === 'ku' ? 'تکایە کێشەکە بە وردی ڕوونبکەرەوە. لە کوێیە؟ کەی دەستی پێکرد؟' : language === 'ar' ? 'يرجى وصف المشكلة بالتفصيل. أين تقع؟ متى بدأت؟' : 'Please describe the problem in detail. Where is it located? When did it start?'}
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full px-4 py-2.5 bg-[#080d19] border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 outline-none text-sm resize-none" 
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-1.5">
                {language === 'ku' ? 'وێنە و بەڵگەکان' : language === 'ar' ? 'الصور والوثائق' : 'Photos / Evidence'}
              </label>
              <div className="border border-dashed border-slate-700 rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-slate-400 bg-[#080d19]/60 hover:bg-[#080d19] transition-colors cursor-not-allowed">
                <UploadCloud className="w-8 h-8 text-amber-400/80 mb-2" />
                <p className="text-sm font-medium text-slate-300">
                  {language === 'ku' ? 'بارکردنی پەڕگە لەم ژینگەیەدا ناچالاکە' : language === 'ar' ? 'تم تأجيل رفع المستندات في هذه البيئة' : 'Document upload is deferred in this environment'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'ku' ? 'دەتوانیت بەڵگەکان ڕاستەوخۆ پێشکەشی بەڕێوەبەری موڵک بکەیت.' : language === 'ar' ? 'يمكنك تقديم الأدلة مباشرة إلى مدير العقار.' : 'You can provide evidence directly to the property manager.'}
                </p>
              </div>
            </div>

          </div>
          
          <div className="bg-[#080d19] p-4 sm:p-5 border-t border-slate-800 flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => navigate(-1)}
              disabled={loading}
              className="px-6 py-2.5 border border-slate-700 text-slate-300 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {language === 'ku' ? 'پەشیمانبوونەوە' : language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-7 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 active:scale-95 text-slate-950 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-amber-950/30"
            >
              {loading 
                ? (language === 'ku' ? 'تۆماردەکرێت...' : language === 'ar' ? 'جاري الإرسال...' : 'Submitting...') 
                : (language === 'ku' ? 'ناردنی داواکاری' : language === 'ar' ? 'إرسال الطلب' : 'Submit Request')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
