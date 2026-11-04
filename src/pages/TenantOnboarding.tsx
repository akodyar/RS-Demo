import React, { useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useNavigate } from 'react-router-dom';
import { UserCircle, MapPin, CheckCircle, ChevronRight, ChevronLeft, Briefcase, FileText } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

const STEPS = [
  'Welcome',
  'Profile',
  'Preferences',
  'Documents',
  'Review'
];

export const TenantOnboardingPage: React.FC = () => {
  const { t, direction } = useI18n();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    employmentStatus: 'EMPLOYED',
    employer: '',
    income: '',
    desiredBedrooms: '1',
    desiredLocation: ''
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) setCurrentStep(s => s + 1);
  };
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Typically we would hit /api/auth/profile or /api/tenants/onboard
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        throw new Error("Failed to save profile. (Infrastructure may not be configured)");
      }

      navigate('/'); // Redirect to dashboard
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const getStepTitle = (idx: number) => {
    const keys = ['welcome', 'profile', 'preferences', 'documents', 'review'];
    const key = keys[idx] || 'welcome';
    const dict: Record<string, { ku: string; ar: string; en: string }> = {
      welcome: { ku: 'بەخێربێن', ar: 'مرحباً بك', en: 'Welcome' },
      profile: { ku: 'پڕۆفایل', ar: 'الملف الشخصي', en: 'Profile' },
      preferences: { ku: 'تایبەتمەندییەکان', ar: 'التفضيلات', en: 'Preferences' },
      documents: { ku: 'بەڵگەنامەکان', ar: 'المستندات', en: 'Documents' },
      review: { ku: 'پێداچوونەوە', ar: 'المراجعة', en: 'Review' },
    };
    return t(`tenant.onboarding.${key}`, dict[key]?.[direction === 'rtl' ? 'ku' : 'en'] || STEPS[idx]);
  };

  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;
  const PrevIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;

  return (
    <div dir={direction} className={`max-w-3xl mx-auto p-4 sm:p-6 lg:p-8 ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {t('tenant.onboarding.title', 'ڕێکخستنی پڕۆفایلی کرێچی | Tenant Profile Setup')}
        </h1>
        <p className="text-sm text-slate-500">
          {t('tenant.onboarding.subtitle', 'پڕۆفایلەکەت تەواو بکە بۆ داواکردنی موڵک یان بەڕێوەبردنی گرێبەستی کرێداریت.')}
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 -z-10 rounded-full"></div>
          <div 
            className={`absolute top-1/2 -translate-y-1/2 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-300 ${
              direction === 'rtl' ? 'right-0' : 'left-0'
            }`}
            style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
          ></div>
          
          {STEPS.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                idx < currentStep ? 'bg-blue-600 text-white' : 
                idx === currentStep ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-slate-200 text-slate-500'
              }`}>
                {idx < currentStep ? <CheckCircle className="w-5 h-5" /> : <span dir="ltr">{idx + 1}</span>}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${idx <= currentStep ? 'text-slate-900' : 'text-slate-400'}`}>
                {getStepTitle(idx)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
        {currentStep === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 pt-10">
            <UserCircle className="w-16 h-16 text-blue-500" />
            <h2 className="text-2xl font-bold text-slate-900">
              {t('tenant.onboarding.welcome_title', 'بەخێربێن بۆ پۆڕتاڵی کرێچی')}
            </h2>
            <p className="text-slate-600 max-w-md">
              {t('tenant.onboarding.welcome_desc', 'ئێمە یارمەتیت دەدەین لە ڕێکخستنی خێرای هەژمارەکەت تا بتوانیت داواکاری کرێداری بنێریت، کرێ بە ئۆنلاین بدەیت، و داواکاری چاککردنەوە تۆمار بکەیت.')}
            </p>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {t('tenant.onboarding.personal_profile', 'زانیاری کەسیی کرێچی')}
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('tenant.onboarding.first_name', 'ناوی یەکەم')}
                </label>
                <input 
                  type="text" 
                  value={formData.firstName} 
                  onChange={e => setFormData({...formData, firstName: e.target.value})} 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('tenant.onboarding.last_name', 'ناوی دووەم و نازناو')}
                </label>
                <input 
                  type="text" 
                  value={formData.lastName} 
                  onChange={e => setFormData({...formData, lastName: e.target.value})} 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('tenant.onboarding.phone', 'ژمارەی مۆبایل')}
              </label>
              <input 
                type="tel" 
                dir="ltr"
                placeholder="+964 7XX XXX XXXX"
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-start" 
              />
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-slate-500" />
              {t('tenant.onboarding.preferences_title', 'هەڵبژاردنی تایبەتمەندی و شوێن')}
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('tenant.onboarding.desired_bedrooms', 'ژمارەی ژووری خەوتن')}
              </label>
              <select 
                value={formData.desiredBedrooms} 
                onChange={e => setFormData({...formData, desiredBedrooms: e.target.value})} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Studio">{t('tenant.onboarding.opt_studio', 'ستۆدیۆ / یەک ژوور')}</option>
                <option value="1">{t('tenant.onboarding.opt_1bed', '١ ژووری خەوتن')}</option>
                <option value="2">{t('tenant.onboarding.opt_2bed', '٢ ژووری خەوتن')}</option>
                <option value="3+">{t('tenant.onboarding.opt_3bed_plus', '٣+ ژووری خەوتن')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t('tenant.onboarding.preferred_location', 'شوێنی دڵخواز (گەڕەک یان پڕۆژە)')}
              </label>
              <input 
                type="text" 
                placeholder={t('tenant.onboarding.location_placeholder', 'بۆ نموونە: ئیمپایەر، دریم ستی، بەختیاری')} 
                value={formData.desiredLocation} 
                onChange={e => setFormData({...formData, desiredLocation: e.target.value})} 
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" 
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-500" />
              {t('tenant.onboarding.documents_title', 'بەڵگەنامە و پێناسە پێویستەکان')}
            </h2>
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-800">
                <strong>{t('tenant.onboarding.docs_note_title', 'تێبینی دەربارەی بارکردنی دۆکیومێنت:')}</strong>{' '}
                {t('tenant.onboarding.docs_note_body', 'دەتوانیت لەم قۆناغەدا بارکردنی پەڕگەکان تێپەڕێنیت و ڕاستەوخۆ لە کاتی واژووکردنی گرێبەست لەگەڵ خاوەن موڵک یان بریکار پێشکەشی بکەیت.')}
              </p>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">
              {t('tenant.onboarding.review_title', 'پێداچوونەوەی کۆتایی و تۆمارکردن')}
            </h2>
            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 space-y-4">
              <div className="grid grid-cols-2 gap-y-4 text-sm">
                <div>
                  <span className="block text-slate-500 mb-1">{t('tenant.onboarding.name', 'ناو')}</span>
                  <span className="font-semibold text-slate-900">{formData.firstName} {formData.lastName || '-'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">{t('tenant.onboarding.phone', 'ژمارەی مۆبایل')}</span>
                  <span className="font-semibold text-slate-900" dir="ltr">{formData.phone || t('common.not_provided', 'دیاری نەکراوە')}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">{t('tenant.onboarding.target_bedrooms', 'ژمارەی ژوور')}</span>
                  <span className="font-semibold text-slate-900">{formData.desiredBedrooms}</span>
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
          className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <PrevIcon className="w-4 h-4" />
          {t('common.back', 'گەڕانەوە')}
        </button>

        {currentStep < STEPS.length - 1 ? (
          <button 
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2"
          >
            {t('common.next', 'دواتر')}
            <NextIcon className="w-4 h-4" />
          </button>
        ) : (
          <button 
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? t('common.saving', 'پاشەکەوت دەکرێت...') : t('tenant.onboarding.complete_btn', 'تەواوکردنی پڕۆفایل')}
            <CheckCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
