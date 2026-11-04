import React, { useState } from 'react';
import { useAuth } from '../components/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, CheckCircle, ChevronLeft, ChevronRight, 
  MapPin, ShieldCheck, Briefcase, FileText, AlertTriangle
} from 'lucide-react';

export const CompanyOnboardingPage: React.FC = () => {
  const { user, token } = useAuth();
  const { t, direction } = useI18n();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const STEPS = [
    t('onboard.welcome', 'بەخێربێن (Welcome)'),
    t('onboard.company.profile', 'زانیاری کۆمپانیا (Profile)'),
    t('onboard.company.services', 'خزمەتگوزاری و ناوچە (Services)'),
    t('onboard.verification', 'پشتڕاستکردنەوە (KYB)'),
    t('onboard.review', 'پێداچوونەوە و ناردن (Review)')
  ];

  const [formData, setFormData] = useState({
    companyName: '',
    legalName: '',
    registrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    serviceArea: 'هەولێر و دەوروبەری (Erbil & Region)',
    teamSize: '1-5'
  });

  const handleNext = () => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1));
  const handlePrev = () => setCurrentStep(prev => Math.max(0, prev - 1));

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/company/onboard', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.companyName,
          legalName: formData.legalName || formData.companyName,
          registrationNumber: formData.registrationNumber,
          email: formData.contactEmail,
          phone: formData.contactPhone,
          serviceArea: formData.serviceArea,
          teamSize: formData.teamSize,
        }),
      });

      if (res.status === 503) {
        // Fail-closed database notification
        setError('داتابەیسی پەیوەندیداری PostgreSQL هێشتا ڕێکەنەخراوە. سیستەم بە شێوازی داخراو (Fail-Closed) کاردەکات تاوەکو داتابەیس پێکبەسترێت.');
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to onboard company.');
      }

      setLoading(false);
      navigate('/workspace/company');
    } catch (err: any) {
      setError(err.message || 'Error occurred while saving company details.');
      setLoading(false);
    }
  };

  return (
    <div className={`max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('onboard.company.title', 'تۆمارکردنی کۆمپانیای خانووبەرە')}</h1>
        <p className="text-sm text-slate-500">{t('onboard.company.subtitle', 'کۆمپانیاکەت تۆمار بکە بۆ دەستپێکردنی بەڕێوەبردنی موڵک و بانگهێشتکردنی خاوەن موڵکەکان.')}</p>
      </div>

      {/* Stepper Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
          <div 
            className={`absolute ${direction === 'rtl' ? 'right-0' : 'left-0'} top-1/2 -translate-y-1/2 h-1 bg-indigo-600 -z-10 rounded-full transition-all duration-300`}
            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          ></div>
          
          {STEPS.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                idx < currentStep ? 'bg-indigo-600 text-white' : 
                idx === currentStep ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' : 'bg-slate-200 text-slate-500'
              }`}>
                {idx < currentStep ? <CheckCircle className="w-5 h-5" /> : idx + 1}
              </div>
              <span className={`text-[11px] sm:text-xs font-medium hidden sm:block ${idx <= currentStep ? 'text-slate-900' : 'text-slate-400'}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs sm:text-sm text-amber-900 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">ئاگاداری:</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
        {currentStep === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 pt-8 pb-4">
            <div className="bg-indigo-50 p-4 rounded-2xl text-indigo-600 mb-2 border border-indigo-100">
              <Building2 className="w-16 h-16" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              بەخێربێن بۆ ژینگەی بەڕێوەبردنی پیشەیی HomeHub
            </h2>
            <p className="text-slate-600 max-w-md text-xs sm:text-sm leading-relaxed">
              لە ڕێگەی ئەم ژینگەیەوە دەتوانیت بە فەرمی گرێبەستی بەڕێوەبردن لەگەڵ خاوەن موڵکەکان ببەستیت، دەسەڵاتی دارایی دیاری بکەیت و هەموو ئۆپەراسیۆنەکانی کرێ و چاککردنەوە لە یەک شوێندا بەڕێوەببەیت.
            </p>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-slate-500" />
              <span>پڕۆفایلی فەرمی کۆمپانیا</span>
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ناوی فەرمی کۆمپانیا / نووسینگە *</label>
              <input 
                type="text" 
                required
                placeholder="نموونە: کۆمپانیای زاگرۆس بۆ بەڕێوەبردنی موڵک"
                value={formData.companyName} 
                onChange={e => setFormData({...formData, companyName: e.target.value})} 
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ناوی بازرگانی تۆمارکراو (Legal Entity Name)</label>
              <input 
                type="text" 
                placeholder="Zagros Real Estate Management LLC"
                value={formData.legalName} 
                onChange={e => setFormData({...formData, legalName: e.target.value})} 
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ژمارەی مۆڵەتی بازرگانی (Commercial Registration No.)</label>
              <input 
                type="text" 
                placeholder="KRG-REG-987654"
                value={formData.registrationNumber} 
                onChange={e => setFormData({...formData, registrationNumber: e.target.value})} 
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ئیمەیڵی فەرمی کۆمپانیا</label>
                <input 
                  type="email" 
                  placeholder="office@company.iq"
                  value={formData.contactEmail} 
                  onChange={e => setFormData({...formData, contactEmail: e.target.value})} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                  dir="ltr" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">ژمارەی تەلەفۆنی پەیوەندی</label>
                <input 
                  type="tel" 
                  placeholder="+964 750 000 0000"
                  value={formData.contactPhone} 
                  onChange={e => setFormData({...formData, contactPhone: e.target.value})} 
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
                  dir="ltr" 
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-500" />
              <span>سنووری جوگرافی و قەبارەی تیم</span>
            </h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">ناوچەی سەرەکی کارکردن (شار یان پارێزگا)</label>
              <input 
                type="text" 
                value={formData.serviceArea} 
                onChange={e => setFormData({...formData, serviceArea: e.target.value})} 
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">قەبارەی تیمی کۆمپانیا</label>
              <select 
                value={formData.teamSize} 
                onChange={e => setFormData({...formData, teamSize: e.target.value})} 
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-white outline-none text-sm"
              >
                <option value="1-5">١ تا ٥ کارمەند (Small Team)</option>
                <option value="6-20">٦ تا ٢٠ کارمەند (Medium Agency)</option>
                <option value="21-50">٢١ تا ٥٠ کارمەند (Large Agency)</option>
                <option value="50+">٥٠+ کارمەند (Enterprise Management)</option>
              </select>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-500" />
              <span>پشتڕاستکردنەوەی یاسایی (Verification Status)</span>
            </h2>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                <strong>ڕوونکردنەوەی فەرمی سیستەم:</strong> بەستنەوە بە سیستەمی دەرەکی KYB لەم ژینگەیەدا دواخراوە. کۆمپانیا لەگەڵ دروستبوونیدا لە دۆخی <span className="font-bold">PENDING_VERIFICATION</span> تۆمار دەکرێت بۆ پاراستنی ڕاستگۆیی داتا بەپێی یاساکانی سیستەم.
              </p>
            </div>
            <div className="p-4 border border-slate-200 rounded-xl flex items-start gap-3 bg-slate-50">
              <input type="checkbox" className="mt-1" defaultChecked disabled />
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-900">پشکنینی بەڵگەنامەی بازرگانی (Commercial License Audit)</p>
                <p className="text-xs text-slate-500 mt-0.5">پشکنینی ناوخۆیی بەڵگەنامە لەلایەن بەڕێوەبەری پلاتفۆرمەوە ئەنجام دەدرێت.</p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">پێداچوونەوە بە زانیارییەکان پێش تۆمارکردن</h2>
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="block text-slate-500">ناوی کۆمپانیا:</span>
                  <span className="font-semibold text-slate-900">{formData.companyName || '-'}</span>
                </div>
                <div>
                  <span className="block text-slate-500">ژمارەی تۆمار:</span>
                  <span className="font-semibold text-slate-900" dir="ltr">{formData.registrationNumber || '-'}</span>
                </div>
                <div>
                  <span className="block text-slate-500">ئیمەیڵ:</span>
                  <span className="font-semibold text-slate-900" dir="ltr">{formData.contactEmail || '-'}</span>
                </div>
                <div>
                  <span className="block text-slate-500">ناوچەی کارکردن:</span>
                  <span className="font-semibold text-slate-900">{formData.serviceArea || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button 
          onClick={handlePrev}
          disabled={currentStep === 0 || loading}
          className="px-5 py-2.5 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] cursor-pointer"
        >
          {direction === 'rtl' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          <span>{t('action.back', 'گەڕانەوە')}</span>
        </button>
        
        {currentStep < STEPS.length - 1 ? (
          <button 
            onClick={handleNext}
            disabled={currentStep === 1 && !formData.companyName}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 min-h-[44px] cursor-pointer"
          >
            <span>{t('action.next', 'دواتر')}</span>
            {direction === 'rtl' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={loading || !formData.companyName}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 min-h-[44px] cursor-pointer"
          >
            <span>{loading ? 'لە خەزنکردندایە...' : 'تەواوکردنی تۆمارکردن'}</span>
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
