import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Globe,
  Database,
  Key,
  CheckCircle2,
  Lock,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AdminRoleType } from '../../../types';

interface AdminSettingsModuleProps {
  currentRole: AdminRoleType;
  onBack: () => void;
}

export const AdminSettingsModule: React.FC<AdminSettingsModuleProps> = ({
  currentRole,
  onBack,
}) => {
  const { direction, language, t } = useI18n();
  const [exchangeRateIqd, setExchangeRateIqd] = useState('1530');
  const [platformFeeRate, setPlatformFeeRate] = useState('');
  const [persistedPlatformFeeRate, setPersistedPlatformFeeRate] = useState<string>('');
  const [platformFeeEffectiveFrom, setPlatformFeeEffectiveFrom] = useState<string | null>(null);
  const [twoFactorEnforced, setTwoFactorEnforced] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [largeContractThresholdUsd, setLargeContractThresholdUsd] = useState('100000');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isReadOnly =
    currentRole === AdminRoleType.AUDITOR || currentRole === AdminRoleType.READ_ONLY_ADMIN;

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const token = import.meta.env.MODE !== 'production' ? (localStorage.getItem('auth_token') || 'dev-super-admin') : (localStorage.getItem('auth_token') || '');
        const res = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json.settings) {
            setExchangeRateIqd(String(json.settings.exchangeRateIqd || '1530'));
            const pRate = json.settings.platformFeeRate !== undefined ? String(json.settings.platformFeeRate) : '0.03';
            setPlatformFeeRate(pRate);
            setPersistedPlatformFeeRate(pRate);
            setTwoFactorEnforced(Boolean(json.settings.twoFactorEnforced));
            setMaintenanceMode(Boolean(json.settings.maintenanceMode));
            setLargeContractThresholdUsd(String(json.settings.largeContractThresholdUsd || '100000'));
          }
        }

        // Also fetch detailed fee configuration
        const feeRes = await fetch('/api/admin/fees', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (feeRes.ok) {
          const feeJson = await feeRes.json();
          if (isMounted && feeJson.fees?.platformFee) {
            setPlatformFeeEffectiveFrom(feeJson.fees.platformFee.effectiveFrom || null);
          }
        }
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  const getPlatformFeeValidationError = (): string | null => {
    if (!platformFeeRate || platformFeeRate.trim() === '') {
      return t('fee.err_required', 'Platform fee rate is required');
    }
    const n = Number(platformFeeRate);
    if (isNaN(n) || !isFinite(n)) {
      return t('fee.err_invalid_number', 'Rate must be a valid number');
    }
    if (n < 0) {
      return t('fee.err_negative', 'Rate cannot be negative');
    }
    if (n > 0.50) {
      return t('fee.err_max', 'Rate cannot exceed 50% (0.50)');
    }
    const decParts = platformFeeRate.trim().split('.');
    if (decParts.length === 2 && decParts[1].length > 4) {
      return t('fee.err_precision', 'Rate precision cannot exceed 4 decimal places');
    }
    return null;
  };

  const handleSave = async () => {
    const valErr = getPlatformFeeValidationError();
    if (valErr) {
      setErrorMessage(valErr);
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const token = import.meta.env.MODE !== 'production' ? (localStorage.getItem('auth_token') || 'dev-super-admin') : (localStorage.getItem('auth_token') || '');
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          exchangeRateIqd: Number(exchangeRateIqd),
          platformFeeRate: Number(platformFeeRate),
          twoFactorEnforced,
          maintenanceMode,
          largeContractThresholdUsd: Number(largeContractThresholdUsd),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to persist platform settings');
      }

      setPersistedPlatformFeeRate(platformFeeRate);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const isRatePending = platformFeeRate !== '' && platformFeeRate !== persistedPlatformFeeRate;
  const rateValidationErr = getPlatformFeeValidationError();

  return (
    <div className="space-y-4" dir={direction}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="admin-settings-back-btn"
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            {direction === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-700" />
              <span>{t('fee.admin_title', 'ڕێکخستنە گشتییەکانی پلاتفۆڕم و کرێیەکان')}</span>
            </h2>
            <p className="text-xs text-slate-500">
              {t('fee.admin_subtitle', 'بەڕێوەبردنی مۆدێلی ٣-کرێیی، ڕێژەی پلاتفۆرم، یاساکانی ئاسایش و داتابەیس')}
            </p>
          </div>
        </div>

        {isReadOnly && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>تەنها بینین (Read Only)</span>
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fee Management & Currency Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <span>{t('fee.platform_fee', 'ڕێژەی پلاتفۆڕم (Global Platform Fee)')}</span>
            </h3>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
              سەرتاسەری (Universal)
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Persisted Current Rate Badge */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-500">
                  {t('fee.current_rate', 'ڕێژەی ئێستای تۆمارکراو (Persisted Current Rate)')}
                </p>
                <p className="text-base font-extrabold text-slate-900 mt-0.5">
                  {(Number(persistedPlatformFeeRate || 0) * 100).toFixed(2)}%
                  <span className="text-xs text-slate-500 font-mono ml-2 font-normal">({persistedPlatformFeeRate || '—'})</span>
                </p>
              </div>
              {platformFeeEffectiveFrom && (
                <div className="text-end">
                  <p className="text-[10px] text-slate-400">کاتی چالاکبوون (Effective From)</p>
                  <p className="text-[11px] font-semibold text-slate-700 font-mono">
                    {new Date(platformFeeEffectiveFrom).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {/* Edit Rate Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700">
                  ڕێژەی نوێی پلاتفۆرم (New Rate 0 - 0.50):
                </label>
                {isRatePending && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    گۆڕانکاری چاوەڕوانکراو (Pending: {(Number(platformFeeRate || 0) * 100).toFixed(2)}%)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.50"
                  data-testid="admin-platform-fee-input"
                  value={platformFeeRate}
                  onChange={(e) => setPlatformFeeRate(e.target.value)}
                  disabled={isReadOnly}
                  className={`w-36 p-2 rounded-xl bg-slate-50 border ${rateValidationErr ? 'border-rose-400 bg-rose-50/50' : 'border-slate-200'} font-mono font-bold text-sm outline-none`}
                />
                <span className="text-slate-500 font-bold text-xs">ڕێژەی دەسیماڵ (نموونە: 0.03 بۆ 3%)</span>
              </div>
              {rateValidationErr && (
                <p data-testid="admin-platform-fee-error" className="text-rose-600 text-[11px] mt-1 font-semibold">{rateValidationErr}</p>
              )}
            </div>

            {/* Effective-Time Policy Callout */}
            <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
              <span className="shrink-0 font-bold">ℹ️</span>
              <p>
                {t('fee.effective_time_notice', 'گۆڕینی ڕێژەکە دەستبەجێ لە سێرڤەر پاشەکەوت دەبێت و تەنها کار دەکاتە سەر کۆکردنەوەی داهاتووی کرێ. مێژووی دارایی و لێدجەرەکانی پێشوو گۆڕانکارییان بەسەردا نایەت.')}
              </p>
            </div>

            {/* Exchange Rate */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                نرخی خەمڵێنراوی $1 دۆلار بە دیناری عێراقی (IQD):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={exchangeRateIqd}
                  onChange={(e) => setExchangeRateIqd(e.target.value)}
                  disabled={isReadOnly}
                  className="w-32 p-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-sm outline-none"
                />
                <span className="text-slate-500 font-bold">دینار بۆ هەر $1 USD</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">داواکردنی پەسەندکردنی بەڕێوەبەر</span>
                <span className="text-slate-400 text-[11px]">بۆ هەموو گرێبەستەکانی سەرووی {Number(largeContractThresholdUsd).toLocaleString()} دۆلار</span>
              </div>
              <input type="checkbox" defaultChecked disabled={isReadOnly} className="w-4 h-4 accent-blue-600" />
            </div>
          </div>
        </div>

        {/* Security & System Policies */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>یاساکانی ئاسایش و سەلامەتی (Security Policies)</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">دوو-قۆناغی (2FA Enforce) بۆ هەموو ئەدمینەکان</span>
                <span className="text-slate-400 text-[11px]">پێویستی بە کۆدی PIN یان ئەپڵی تەئکیدکردنەوەیە</span>
              </div>
              <input
                type="checkbox"
                checked={twoFactorEnforced}
                onChange={(e) => setTwoFactorEnforced(e.target.checked)}
                disabled={isReadOnly}
                className="w-4 h-4 accent-emerald-600"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 block">دۆخی چاکسازی (Maintenance Mode)</span>
                <span className="text-slate-400 text-[11px]">ڕاگرتنی کاتی چوونەژوورەوەی کڕیاران بۆ ئەنجامدانی چاکسازی</span>
              </div>
              <input
                type="checkbox"
                checked={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.checked)}
                disabled={isReadOnly}
                className="w-4 h-4 accent-rose-600"
              />
            </div>

            {/* Fee Tiers Status */}
            <div className="pt-3 border-t border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">پلەکانی کرێ بەپێی پۆرتفۆلیۆ (Portfolio Fee Tiers)</span>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mb-1">
                  پێناسەکراوە لە داتابەیس / ناچالاکە لەم وەشاندنەدا
                </span>
                <p className="text-[10px] text-slate-500 mt-1">
                  خشتەی پلەکانی کرێ (pricing_tiers) لە سکیمای داتابەیس بوونی هەیە. دیاریکردنی ڕێژە و سنوورەکان پێویستی بە پەسەندکردنی بەڕێوەبەرایەتی باڵایە و بۆ ئەم فیزە چالاک نەکراوە.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operating Model Applicability Matrix Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
            <span>ماتریسی گونجاوی کرێیەکان بەپێی مۆدێلی کارکردن (Operating-Model Fee Applicability Matrix)</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-semibold">بڕیاری کۆتایی لە سێرڤەر بەڕێوەدەبرێت</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-slate-50 text-slate-700 font-bold">
              <tr>
                <th className="py-2.5 px-3 rounded-s-lg">مۆدێلی کارکردن (Operating Model)</th>
                <th className="py-2.5 px-3">کرێی پلاتفۆرم (Platform Fee)</th>
                <th className="py-2.5 px-3">کرێی بەکرێدان (Rent Fee)</th>
                <th className="py-2.5 px-3">کرێی بەڕێوەبردن (Management Fee)</th>
                <th className="py-2.5 px-3 rounded-e-lg">یاسای تایبەت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  FULLY_MANAGED
                  <span className="block text-[10px] text-slate-400 font-normal">بەڕێوەبردنی تەواوەتی پلاتفۆرم</span>
                </td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ دەگرێتەوە (Applies)</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ دەگرێتەوە (Applies)</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ دەگرێتەوە (Applies)</td>
                <td className="py-2.5 px-3 text-[11px] text-slate-500">هەر سێ کرێ ڕێککەوتوو دەبێت دیاری بکرێت</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  AGENT_LISTED_PLATFORM_MANAGED
                  <span className="block text-[10px] text-slate-400 font-normal">بریکار خستوویەتییە ڕوو، پلاتفۆرم بەڕێوەی دەبات</span>
                </td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ دەگرێتەوە (Applies)</td>
                <td className="py-2.5 px-3 text-slate-400 font-bold">✗ ناگرێتەوە (Does Not Apply)</td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ دەگرێتەوە (Applies)</td>
                <td className="py-2.5 px-3 text-[11px] text-slate-500">کرێی بەکرێدان بە تەواوی هەڵگیراوە</td>
              </tr>
              <tr className="hover:bg-slate-50/50">
                <td className="py-2.5 px-3 font-bold text-slate-900">
                  AGENT_OPERATED
                  <span className="block text-[10px] text-slate-400 font-normal">لەلایەن بریکارەوە بەڕێوەدەبرێت</span>
                </td>
                <td className="py-2.5 px-3 text-emerald-700 font-bold">✓ دەگرێتەوە (Applies)</td>
                <td className="py-2.5 px-3 text-slate-400 font-bold">✗ ناگرێتەوە (Does Not Apply)</td>
                <td className="py-2.5 px-3 text-slate-400 font-bold">✗ ناگرێتەوە (Does Not Apply)</td>
                <td className="py-2.5 px-3 text-[11px] text-slate-500">تەنها کرێی پلاتفۆرم کۆدەکرێتەوە</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100 text-[11px] text-amber-800">
          <span className="font-bold">تێبینی پاراستنی دارایی:</span> کرێی بەکرێدان و بەڕێوەبردن تایبەتن بە هەریەک لە موڵکەکان و لە کاتی تۆمارکردندا بە بەتاڵی دەمێننەوە هەتاوەکو ڕێککەوتنی فەرمی دەکرێت. کرێی دیارینەکراو (Unset) هەرگیز بە هەڵە بە %0 ئەژمار ناکرێت.
        </div>
      </div>

      {/* Save Button */}
      {!isReadOnly && (
        <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
          {saveSuccess ? (
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>ڕێکخستنەکان لە سێرڤەر بە سەرکەوتوویی پاشەکەوت کران!</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-medium">
              گۆڕانکارییەکان دەستبەجێ لەسەر پلاتفۆڕم چالاک دەبن و لە ئاودیت لۆگ تۆمار دەکرێن.
            </span>
          )}

          <button
            type="button"
            data-testid="admin-save-settings-btn"
            onClick={handleSave}
            disabled={saving || Boolean(rateValidationErr)}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>پاشەکەوتکردن لە سێرڤەر</span>
          </button>
        </div>
      )}
    </div>
  );
};
export default AdminSettingsModule;
