import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { useAuth } from '../../AuthProvider';
import { X, Plus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';

interface PricingTier {
  id: string;
  name: string;
  minProperties: number;
  maxProperties: number | null;
  rentFeeRate: string;
  managementFeeRate: string;
  isActive?: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export const AdminPricingModule: React.FC = () => {
  const { t, direction } = useI18n();
  const auth = useAuth();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    minProperties: '0',
    maxProperties: '',
    rentFeeRate: '',
    managementFeeRate: '',
    priority: '1',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const getAuthToken = () => {
    return (
      auth?.token ||
      localStorage.getItem('auth_token') ||
      (import.meta.env.MODE !== 'production' ? 'dev-super-admin' : '')
    );
  };

  const fetchTiers = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/pricing-tiers', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTiers(data.pricingTiers || []);
      } else {
        setError(data.error || data.message || 'Failed to fetch tiers');
      }
    } catch (err: any) {
      setError(err.message || 'Network error fetching pricing tiers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen && !submitting) {
        handleCloseModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, submitting]);

  const handleOpenModal = () => {
    setFormData({
      name: '',
      minProperties: '0',
      maxProperties: '',
      rentFeeRate: '',
      managementFeeRate: '',
      priority: String((tiers.length || 0) + 1),
    });
    setFormErrors({});
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (submitting) return;
    setIsModalOpen(false);
    setFormErrors({});
    setSubmitError(null);
    setSubmitSuccess(null);
  };

  const parseRate = (val: string): number | null => {
    if (!val || !val.trim()) return null;
    const clean = val.replace('%', '').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) return null;
    return num > 1 ? num / 100 : num;
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = t('pricing.err_name_required', 'Tier name is required');
    }

    const min = parseInt(formData.minProperties, 10);
    if (isNaN(min) || min < 0) {
      errors.minProperties = t('pricing.err_min_invalid', 'Min properties must be 0 or greater');
    }

    if (formData.maxProperties.trim()) {
      const max = parseInt(formData.maxProperties, 10);
      if (isNaN(max)) {
        errors.maxProperties = t('pricing.err_max_invalid', 'Max properties must be a valid number');
      } else if (!isNaN(min) && max < min) {
        errors.maxProperties = t('pricing.err_max_less_min', 'Max properties cannot be less than min properties');
      }
    }

    const rentRate = parseRate(formData.rentFeeRate);
    if (rentRate === null || rentRate < 0 || rentRate > 1) {
      errors.rentFeeRate = t('pricing.err_rent_rate', 'Rent fee rate must be between 0 and 1 (or 0% to 100%)');
    }

    const mgmtRate = parseRate(formData.managementFeeRate);
    if (mgmtRate === null || mgmtRate < 0 || mgmtRate > 1) {
      errors.managementFeeRate = t('pricing.err_mgmt_rate', 'Management fee rate must be between 0 and 1 (or 0% to 100%)');
    }

    const prio = parseInt(formData.priority, 10);
    if (isNaN(prio)) {
      errors.priority = t('pricing.err_prio', 'Priority must be an integer');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const minProps = parseInt(formData.minProperties, 10);
    const maxProps = formData.maxProperties.trim() ? parseInt(formData.maxProperties, 10) : null;
    const rentRate = parseRate(formData.rentFeeRate)!;
    const mgmtRate = parseRate(formData.managementFeeRate)!;
    const prio = parseInt(formData.priority, 10) || 0;

    try {
      const res = await fetch('/api/admin/pricing-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          minProperties: minProps,
          maxProperties: maxProps,
          rentFeeRate: String(rentRate),
          managementFeeRate: String(mgmtRate),
          priority: prio,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || `Server returned ${res.status}`);
      }

      setSubmitSuccess(t('pricing.create_success', 'Pricing tier created successfully!'));
      await fetchTiers();

      setTimeout(() => {
        setIsModalOpen(false);
      }, 800);
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred while creating the pricing tier.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && tiers.length === 0) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        <span>Loading Pricing Tiers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={direction}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {t('pricing.title', 'Tiered Pricing Configuration')}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('pricing.subtitle', 'Manage platform fee tiers, property boundaries, and priority rankings.')}
          </p>
        </div>
        <Button
          data-testid="create-tier-btn"
          onClick={handleOpenModal}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>{t('pricing.create_tier', 'Create New Tier')}</span>
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {tiers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-500 space-y-2">
          <p className="font-bold">{t('pricing.no_tiers', 'No pricing tiers configured.')}</p>
          <p className="text-xs">{t('pricing.no_tiers_hint', 'Click "Create New Tier" to define the first pricing bracket.')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiers.map((tier) => (
            <Card key={tier.id} className="border border-slate-200 shadow-xs hover:shadow-md transition-shadow">
              <CardHeader className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900">{tier.name}</h3>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {t('pricing.priority', 'Priority')} {tier.priority}
                </span>
              </CardHeader>
              <CardBody className="space-y-2 text-xs pt-3 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('pricing.property_range', 'Property Range:')}</span>
                  <span className="font-mono font-bold" dir="ltr">
                    {tier.minProperties} - {tier.maxProperties === null ? '∞' : tier.maxProperties}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('pricing.rent_fee_rate', 'Rent Fee Rate:')}</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
                    {tier.rentFeeRate ? (parseFloat(tier.rentFeeRate) * 100).toFixed(1) + '%' : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('pricing.mgmt_fee_rate', 'Management Fee Rate:')}</span>
                  <span className="font-mono font-bold text-slate-900" dir="ltr">
                    {tier.managementFeeRate ? (parseFloat(tier.managementFeeRate) * 100).toFixed(1) + '%' : 'N/A'}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Real Create Tier Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-tier-modal-title"
          dir={direction}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 id="create-tier-modal-title" className="text-lg font-bold text-slate-900">
                {t('pricing.modal_title', 'Create New Pricing Tier')}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={submitting}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
              {submitError && (
                <div data-testid="tier-error-banner" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Validation Error</p>
                    <p className="text-[11px] mt-0.5">{submitError}</p>
                  </div>
                </div>
              )}

              {submitSuccess && (
                <div data-testid="tier-success-banner" className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">{submitSuccess}</span>
                </div>
              )}

              <div>
                <label htmlFor="tier-name" className="block font-bold text-slate-700 mb-1">
                  {t('pricing.tier_name', 'Tier Name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="tier-name"
                  data-testid="tier-name-input"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Starter, Growth, Enterprise"
                  className={`w-full px-3 py-2 rounded-xl border text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                    formErrors.name ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  }`}
                  disabled={submitting}
                />
                {formErrors.name && (
                  <p data-testid="tier-name-error" className="text-red-600 text-[11px] mt-1 font-medium">{formErrors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tier-min-props" className="block font-bold text-slate-700 mb-1">
                    {t('pricing.min_props', 'Min Properties')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tier-min-props"
                    data-testid="tier-min-props-input"
                    type="number"
                    min="0"
                    value={formData.minProperties}
                    onChange={(e) => setFormData({ ...formData, minProperties: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                      formErrors.minProperties ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    disabled={submitting}
                    dir="ltr"
                  />
                  {formErrors.minProperties && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{formErrors.minProperties}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="tier-max-props" className="block font-bold text-slate-700 mb-1">
                    {t('pricing.max_props', 'Max Properties')} <span className="text-slate-400 font-normal">{t('pricing.max_props_hint', '(Optional)')}</span>
                  </label>
                  <input
                    id="tier-max-props"
                    data-testid="tier-max-props-input"
                    type="number"
                    min="0"
                    placeholder="∞"
                    value={formData.maxProperties}
                    onChange={(e) => setFormData({ ...formData, maxProperties: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                      formErrors.maxProperties ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    disabled={submitting}
                    dir="ltr"
                  />
                  {formErrors.maxProperties && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{formErrors.maxProperties}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="tier-rent-fee" className="block font-bold text-slate-700 mb-1">
                    {t('pricing.rent_fee_rate', 'Rent Fee Rate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tier-rent-fee"
                    data-testid="tier-rent-fee-input"
                    type="text"
                    placeholder="e.g. 0.05 or 5%"
                    value={formData.rentFeeRate}
                    onChange={(e) => setFormData({ ...formData, rentFeeRate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                      formErrors.rentFeeRate ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    disabled={submitting}
                    dir="ltr"
                  />
                  {formErrors.rentFeeRate && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{formErrors.rentFeeRate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="tier-mgmt-fee" className="block font-bold text-slate-700 mb-1">
                    {t('pricing.mgmt_fee_rate', 'Management Fee Rate')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="tier-mgmt-fee"
                    data-testid="tier-mgmt-fee-input"
                    type="text"
                    placeholder="e.g. 0.08 or 8%"
                    value={formData.managementFeeRate}
                    onChange={(e) => setFormData({ ...formData, managementFeeRate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                      formErrors.managementFeeRate ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                    }`}
                    disabled={submitting}
                    dir="ltr"
                  />
                  {formErrors.managementFeeRate && (
                    <p className="text-red-600 text-[11px] mt-1 font-medium">{formErrors.managementFeeRate}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="tier-priority" className="block font-bold text-slate-700 mb-1">
                  {t('pricing.priority', 'Priority Order')}
                </label>
                <input
                  id="tier-priority"
                  data-testid="tier-priority-input"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden ${
                    formErrors.priority ? 'border-red-500 bg-red-50/50' : 'border-slate-200'
                  }`}
                  disabled={submitting}
                  dir="ltr"
                />
                <p className="text-slate-400 text-[10px] mt-1">
                  Lower numbers take precedence during owner tier resolution.
                </p>
                {formErrors.priority && (
                  <p className="text-red-600 text-[11px] mt-1 font-medium">{formErrors.priority}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="tier-cancel-btn"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  {t('pricing.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  data-testid="tier-submit-btn"
                  disabled={submitting}
                  className="flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('pricing.saving', 'Creating...')}</span>
                    </>
                  ) : (
                    <span>{t('pricing.save_tier', 'Save Tier')}</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
