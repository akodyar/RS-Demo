import React from 'react';
import { X, Sparkles, Send, Wrench, FileText, DollarSign, Calendar, MapPin, Clock } from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { WorkOrderStatus } from '../../types/vendor';

// Quote Modal
interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: {
    maintenanceRequestId: string;
    propertyId: string;
    propertyName: string;
    totalAmount: string;
    laborAmount: string;
    materialsAmount: string;
    feesAmount: string;
    estimatedDuration: string;
    warrantyTerms: string;
    notes: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
}) => {
  const { t, language, direction } = useI18n();
  const isRtl = direction === 'rtl';
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 ${isRtl ? 'font-arabic' : 'font-sans'}`} dir={direction} onClick={onClose}>
      <div data-testid="quote-modal-container" className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900">
              {language === 'ku' ? 'پێشکەشکردنی پێشنیاری نرخی چاکسازی' : language === 'ar' ? 'تقديم عرض أسعار الصيانة' : 'Submit Service Quote'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {language === 'ku' ? 'موڵکی مەبەست' : language === 'ar' ? 'العقار المعني' : 'Target Property'}
            </label>
            <input
              type="text"
              disabled
              value={form.propertyName}
              className="w-full px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {language === 'ku' ? 'دەستی کار (د.ع)' : language === 'ar' ? 'أجور العمل' : 'Labor (IQD)'}
              </label>
              <input
                type="number"
                value={form.laborAmount}
                onChange={(e) => {
                  const l = Number(e.target.value);
                  const m = Number(form.materialsAmount);
                  const f = Number(form.feesAmount);
                  setForm({ ...form, laborAmount: e.target.value, totalAmount: (l + m + f).toString() });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {language === 'ku' ? 'کەرەستە (د.ع)' : language === 'ar' ? 'المواد' : 'Materials (IQD)'}
              </label>
              <input
                type="number"
                value={form.materialsAmount}
                onChange={(e) => {
                  const l = Number(form.laborAmount);
                  const m = Number(e.target.value);
                  const f = Number(form.feesAmount);
                  setForm({ ...form, materialsAmount: e.target.value, totalAmount: (l + m + f).toString() });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                {language === 'ku' ? 'رسوومات (د.ع)' : language === 'ar' ? 'الرسوم' : 'Fees (IQD)'}
              </label>
              <input
                type="number"
                value={form.feesAmount}
                onChange={(e) => {
                  const l = Number(form.laborAmount);
                  const m = Number(form.materialsAmount);
                  const f = Number(e.target.value);
                  setForm({ ...form, feesAmount: e.target.value, totalAmount: (l + m + f).toString() });
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl flex items-center justify-between text-blue-950">
            <span className="font-semibold">{t('vendor.calculated_total_estimate', 'Calculated Total Estimate:')}</span>
            <span className="text-base font-bold text-blue-600 font-mono" dir="ltr">{Number(form.totalAmount || 0).toLocaleString()} IQD</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('vendor.estimated_duration', 'Estimated Duration')}</label>
              <input
                type="text"
                value={form.estimatedDuration}
                onChange={(e) => setForm({ ...form, estimatedDuration: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('vendor.warranty_terms', 'Warranty Terms')}</label>
              <input
                type="text"
                value={form.warrantyTerms}
                onChange={(e) => setForm({ ...form, warrantyTerms: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.scope_notes', 'Scope & Diagnostic Notes')}</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold shadow-md shadow-blue-500/20 hover:bg-blue-500 cursor-pointer"
            >
              {t('vendor.submit_quote_btn', 'Submit Quote')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Work Order Modal
interface WorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: {
    workOrderId: string;
    status: WorkOrderStatus;
    notes: string;
    photoUrl: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => void;
}

export const WorkOrderModal: React.FC<WorkOrderModalProps> = ({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">{t('vendor.modal_work_order_title', 'Log Work / Update Status')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.work_order_status', 'Work Order Status')}</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as WorkOrderStatus })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white"
            >
              <option value="IN_PROGRESS">{t('vendor.opt_in_progress', 'IN_PROGRESS (Currently working on site)')}</option>
              <option value="PAUSED">{t('vendor.opt_paused', 'PAUSED (Awaiting materials)')}</option>
              <option value="COMPLETED">{t('vendor.opt_completed', 'COMPLETED (Work finished)')}</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.completion_notes', 'On-Site Completion Notes')}</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.proof_photo_url', 'Proof of Work Photo URL')}</label>
            <input
              type="text"
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer"
            >
              {t('vendor.update_work_order_btn', 'Update Work Order')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Invoice Modal
interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: {
    workOrderId: string;
    amount: string;
    currency: string;
    dueDate: string;
    description: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-slate-900">{t('vendor.modal_invoice_title', 'Create Vendor Invoice')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.invoice_amount', 'Invoice Amount (IQD)')}</label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.due_date', 'Due Date')}</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.invoiced_scope', 'Scope of Invoiced Services')}</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer"
            >
              {t('vendor.submit_invoice_btn', 'Submit Invoice')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Schedule Modal
interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: {
    title: string;
    eventType: string;
    startTime: string;
    endTime: string;
    location: string;
    notes: string;
  };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  onClose,
  form,
  setForm,
  onSubmit,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-base text-slate-900">{t('vendor.modal_schedule_title', 'Schedule Service Appointment')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.appointment_title', 'Appointment Title')}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('vendor.start_time', 'Start Time')}</label>
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">{t('vendor.end_time', 'End Time')}</label>
              <input
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">{t('vendor.location_label', 'Location')}</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer"
            >
              {t('vendor.confirm_schedule_btn', 'Confirm Schedule')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// AI Co-Pilot Modal
interface AiCoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  setQuery: (q: string) => void;
  response: string | null;
  loading: boolean;
  onConsult: (prompt?: string) => void;
}

export const AiCoPilotModal: React.FC<AiCoPilotModalProps> = ({
  isOpen,
  onClose,
  query,
  setQuery,
  response,
  loading,
  onConsult,
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">{t('vendor.ai_modal_title', 'Vendor Advisory AI Co-Pilot')}</h3>
              <p className="text-[10px] text-slate-500">{t('vendor.ai_modal_sub', 'Advisory intelligence • Zero autonomous execution power')}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2 my-4">
          <button
            type="button"
            onClick={() => onConsult('Suggest repair quote structure for AC unit')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
          >
            {t('vendor.ai_prompt_quote', 'Quote Structure for AC')}
          </button>
          <button
            type="button"
            onClick={() => onConsult('HVAC diagnostic checklist')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
          >
            {t('vendor.ai_prompt_checklist', 'Diagnostic Checklist')}
          </button>
          <button
            type="button"
            onClick={() => onConsult('Draft customer message for completed repair')}
            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 text-[11px] font-medium transition-colors cursor-pointer"
          >
            {t('vendor.ai_prompt_msg', 'Customer Message Draft')}
          </button>
        </div>

        {/* AI Output Card */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 min-h-[140px] max-h-[220px] overflow-y-auto text-xs text-slate-700 whitespace-pre-line leading-relaxed">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 italic">
              <Sparkles className="w-4 h-4 animate-spin text-blue-600" />
              <span>{t('vendor.ai_loading', 'Generating advisory recommendation...')}</span>
            </div>
          ) : response ? (
            response
          ) : (
            <span className="text-slate-400">
              {t('vendor.ai_empty_hint', 'Ask the advisory assistant for quote formulas, technical inspection checklists, or customer communication suggestions.')}
            </span>
          )}
        </div>

        {/* Query Input Box */}
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            placeholder={t('vendor.ai_input_placeholder', 'Ask advisory AI a question...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onConsult()}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            onClick={() => onConsult()}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:bg-blue-500 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('vendor.ai_consult_btn', 'Consult')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Area Modal
interface AreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceAreas: string[];
  onSaveArea: (area: string) => void;
}

export const AreaModal: React.FC<AreaModalProps> = ({
  isOpen,
  onClose,
  serviceAreas,
  onSaveArea,
}) => {
  const { t } = useI18n();
  const [newArea, setNewArea] = React.useState('Empire World & Dream City');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-900">{t('vendor.modal_area_title', 'Add Service Coverage Area')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-xs">
          <p className="text-slate-600">{t('vendor.active_areas_label', 'Currently active service areas:')} <strong>{serviceAreas.join(', ')}</strong>.</p>
          <input
            type="text"
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            placeholder={t('vendor.area_input_placeholder', 'Enter new district or neighborhood...')}
            className="w-full px-3 py-2 rounded-lg border border-slate-200"
          />
          <button
            type="button"
            onClick={() => onSaveArea(newArea)}
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 cursor-pointer"
          >
            {t('vendor.save_area_btn', 'Save Area')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Availability Modal
interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  workingHours: string;
  emergencyAvailable: boolean;
  onSaveAvailability: (hours: string, emergency: boolean) => void;
}

export const AvailabilityModal: React.FC<AvailabilityModalProps> = ({
  isOpen,
  onClose,
  workingHours: initialHours,
  emergencyAvailable: initialEmergency,
  onSaveAvailability,
}) => {
  const { t } = useI18n();
  const [hours, setHours] = React.useState(initialHours);
  const [emergency, setEmergency] = React.useState(initialEmergency);

  React.useEffect(() => { setHours(initialHours); }, [initialHours]);
  React.useEffect(() => { setEmergency(initialEmergency); }, [initialEmergency]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-600" />
            <h3 className="font-bold text-sm text-slate-900">{t('vendor.modal_availability_title', 'Operating Availability')}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block text-slate-600 mb-1">{t('vendor.standard_hours_label', 'Standard Hours')}</label>
            <input
              type="text"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="emergency-input-modal"
              checked={emergency}
              onChange={(e) => setEmergency(e.target.checked)}
              className="rounded text-blue-600"
            />
            <label htmlFor="emergency-input-modal" className="text-slate-700">{t('vendor.emergency_dispatch_available', '24/7 Emergency Dispatch Available')}</label>
          </div>
          <button
            type="button"
            onClick={() => onSaveAvailability(hours, emergency)}
            className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-500 cursor-pointer"
          >
            {t('vendor.save_availability_btn', 'Save Availability')}
          </button>
        </div>
      </div>
    </div>
  );
};
