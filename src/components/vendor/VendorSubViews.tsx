import React from 'react';
import {
  FileText,
  Wrench,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  Star,
  Users,
  Building,
  MessageSquare,
  ShieldCheck,
  CheckSquare,
  Plus,
  Globe,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nProvider';
import { VendorDashboardData, VendorQuoteStatus } from '../../types/vendor';

interface VendorSubViewsProps {
  activeNav: string;
  data: VendorDashboardData;
  profile: any;
  onBackToDashboard: () => void;
  onNewQuote: () => void;
  onLogWork: () => void;
  onCreateInvoice: () => void;
  onScheduleEvent: () => void;
  onAddArea: () => void;
  onUpdateAvailability: () => void;
  onToggleTask?: (taskId: string, currentStatus: string) => void;
}

export const VendorSubViews: React.FC<VendorSubViewsProps> = ({
  activeNav,
  data,
  profile,
  onBackToDashboard,
  onNewQuote,
  onLogWork,
  onCreateInvoice,
  onScheduleEvent,
  onAddArea,
  onUpdateAvailability,
  onToggleTask,
}) => {
  const { t, direction, language, setLanguage } = useI18n();

  const getNavTitle = (nav: string) => {
    switch (nav) {
      case 'dashboard': return t('vendor.dashboard', 'Dashboard');
      case 'requests': return t('vendor.nav_requests', 'Service Requests');
      case 'work-orders': return t('vendor.nav_work_orders', 'My Work Orders');
      case 'schedule': return t('vendor.nav_scheduled', 'Scheduled Jobs');
      case 'completed': return t('vendor.nav_completed', 'Completed Jobs');
      case 'quotes': return t('vendor.nav_quotes', 'Quotes & Estimates');
      case 'clients': return t('vendor.nav_clients', 'Clients');
      case 'properties': return t('vendor.nav_properties', 'Properties');
      case 'messages': return t('vendor.nav_messages', 'Messages');
      case 'categories': return t('vendor.nav_categories', 'Service Categories');
      case 'availability': return t('vendor.nav_availability', 'Availability & Hours');
      case 'areas': return t('vendor.nav_areas', 'Service Areas');
      case 'team': return t('vendor.nav_team', 'My Team');
      case 'invoices': return t('vendor.nav_invoices', 'Invoices');
      case 'payments': return t('vendor.nav_payments', 'Payments');
      case 'earnings': return t('vendor.nav_earnings', 'Earnings & Reports');
      case 'calendar': return t('vendor.nav_calendar', 'Calendar');
      case 'tasks': return t('vendor.nav_tasks', 'Tasks');
      case 'documents': return t('vendor.nav_documents', 'Documents');
      case 'profile': return t('vendor.nav_profile', 'Vendor Profile');
      case 'verification': return t('vendor.nav_verification', 'Verification & License');
      case 'reviews': return t('vendor.nav_reviews', 'Reviews & Ratings');
      case 'settings': return t('vendor.nav_settings', 'Settings');
      default: return nav.replace('-', ' ');
    }
  };

  const getMemberRole = (role: string) => {
    if (role.includes('HVAC')) return t('vendor.role_hvac_lead', role);
    if (role.includes('Electrician')) return t('vendor.role_electrician', role);
    if (role.includes('Plumbing')) return t('vendor.role_plumber', role);
    if (role.includes('Apprentice')) return t('vendor.role_apprentice', role);
    return role;
  };

  return (
    <div className="space-y-6">
      {/* Sub-view Header & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <span>{direction === 'rtl' ? '→' : '←'}</span>
            <span>{t('vendor.back_dashboard', 'Back to Dashboard')}</span>
          </button>
          <span className="text-slate-300">/</span>
          <h2 className="text-lg font-black text-slate-900 capitalize">
            {getNavTitle(activeNav)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {(activeNav === 'requests' || activeNav === 'quotes') && (
            <button
              type="button"
              onClick={onNewQuote}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('vendor.action_new_quote', '+ New Quote')}
            </button>
          )}
          {activeNav === 'work-orders' && (
            <button
              type="button"
              onClick={onLogWork}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('vendor.action_log_work', 'Log Work')}
            </button>
          )}
          {activeNav === 'invoices' && (
            <button
              type="button"
              onClick={onCreateInvoice}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('vendor.action_create_invoice', '+ Create Invoice')}
            </button>
          )}
          {(activeNav === 'schedule' || activeNav === 'calendar') && (
            <button
              type="button"
              onClick={onScheduleEvent}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('vendor.action_schedule_event', '+ Schedule Event')}
            </button>
          )}
          {activeNav === 'areas' && (
            <button
              type="button"
              onClick={onAddArea}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('vendor.action_add_area', '+ Add Service Area')}
            </button>
          )}
          {activeNav === 'availability' && (
            <button
              type="button"
              onClick={onUpdateAvailability}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {t('vendor.action_update_hours', 'Update Operating Hours')}
            </button>
          )}
        </div>
      </div>

      {/* View 1: Service Requests */}
      {activeNav === 'requests' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_requests_title', 'Assigned Service Requests')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_requests_sub', 'Inbound maintenance requests assigned to your company')}</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-600 rounded-lg">
              {data.recentRequests.length} {t('vendor.total_requests_count', 'Total Requests')}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {data.recentRequests.map((req) => (
              <div key={req.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded" dir="ltr">
                      {req.srCode}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">
                      {t(`req.${req.title.toLowerCase().replace(/ /g, '_')}`, req.title)}
                    </h4>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                        req.priority === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700'
                          : req.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t(`priority.${req.priority.toLowerCase()}`, req.priority)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{req.location}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onNewQuote}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('vendor.action_submit_quote', 'Submit Quote')}
                  </button>
                  <button
                    type="button"
                    onClick={onLogWork}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('vendor.action_dispatch_tech', 'Dispatch Technician')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 2: Work Orders & Completed */}
      {(activeNav === 'work-orders' || activeNav === 'completed') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {activeNav === 'completed' ? t('vendor.subview_completed_title', 'Completed Service Jobs') : t('vendor.subview_work_orders_title', 'Active Work Orders')}
              </h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_work_orders_sub', 'Authorized on-site repair and maintenance tasks')}</p>
            </div>
            <span className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 rounded-lg">
              {activeNav === 'completed' ? `${data.kpi.completedThisMonth} ${t('vendor.completed_word', 'Completed')}` : `${data.kpi.activeWorkOrders} ${t('vendor.active_orders_word', 'Active Orders')}`}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                  <th className="py-2.5 text-start">{t('vendor.th_work_order', 'Work Order #')}</th>
                  <th className="py-2.5 text-start">{t('vendor.th_property', 'Property & Unit')}</th>
                  <th className="py-2.5 text-start">{t('vendor.th_service_scope', 'Service Scope')}</th>
                  <th className="py-2.5 text-start">{t('vendor.th_status', 'Status')}</th>
                  <th className="py-2.5 text-end">{t('vendor.th_action', 'Action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.workOrders
                  .filter((w: any) => activeNav === 'completed' ? w.status === 'COMPLETED' : w.status !== 'COMPLETED')
                  .map((w: any) => (
                    <tr key={w.id} className="hover:bg-slate-50/50">
                      <td className="py-3 font-bold text-slate-800" dir="ltr">WO-{w.id.substring(0, 8)}</td>
                      <td className="py-3 text-slate-600">{w.propertyName || 'Property Location'}</td>
                      <td className="py-3 text-slate-800 font-medium">{w.category || w.scopeOfWork || 'Service Work'}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${w.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {t(`vendor.status_${w.status.toLowerCase()}`, w.status)}
                        </span>
                      </td>
                      <td className="py-3 text-end">
                        {w.status !== 'COMPLETED' ? (
                          <button
                            type="button"
                            onClick={onLogWork}
                            className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold text-[11px] cursor-pointer"
                          >
                            {t('vendor.action_update', 'Update')}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={onCreateInvoice}
                            className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                          >
                            {t('vendor.action_invoice', 'Invoice')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {data.workOrders.filter((w: any) => activeNav === 'completed' ? w.status === 'COMPLETED' : w.status !== 'COMPLETED').length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      No work orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View 3: Quotes & Estimates */}
      {activeNav === 'quotes' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_quotes_title', 'Quotes & Price Estimates')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_quotes_sub', 'Formal contractor quotations submitted to property managers and owners')}</p>
            </div>
            <button
              type="button"
              onClick={onNewQuote}
              className="px-3.5 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              {t('vendor.action_create_quote', '+ Create Quote')}
            </button>
          </div>

          <div className="space-y-3">
            {data.quotes.map((q: any) => (
              <div key={q.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">
                      {t('vendor.quote_label', 'Quote #')} <span dir="ltr">Q-{q.id.substring(0, 8)}</span>
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${q.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {t(`vendor.status_${q.status.toLowerCase()}`, q.status)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="font-semibold">{t('vendor.property_label', 'Property:')}</span> {q.propertyName || 'Property Location'}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold">{t('vendor.scope_label', 'Scope:')}</span> {q.notes || 'No description provided.'}
                  </p>
                </div>
                <div className="text-end">
                  <span className="text-base font-black text-slate-900" dir="ltr">
                    {q.currency === 'USD' ? `$${Number(q.totalAmount).toLocaleString()} USD` : `${Number(q.totalAmount).toLocaleString()} IQD`}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {t('vendor.est_duration_label', 'Est. Duration:')} <span dir="ltr">{q.estimatedDuration || 'N/A'}</span>
                  </p>
                </div>
              </div>
            ))}
            {data.quotes.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                No quotes found.
              </div>
            )}
          </div>
        </div>
      )}

      {/* View 4: Financial & Earnings */}
      {(activeNav === 'invoices' || activeNav === 'payments' || activeNav === 'earnings') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_ledger_title', 'Contractor Financial Ledger')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_ledger_sub', 'Settlements, vendor invoices, and verified platform earnings')}</p>
            </div>
            <button
              type="button"
              onClick={onCreateInvoice}
              className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              {t('vendor.action_new_invoice', '+ New Invoice')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.kpi_total_billed', 'Total Billed YTD')}</span>
              <p className="text-xl font-bold text-slate-900 mt-1" dir="ltr">${data.invoices.reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()} USD</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.kpi_paid_settled', 'Paid Out & Settled')}</span>
              <p className="text-xl font-bold text-emerald-600 mt-1" dir="ltr">${data.invoices.filter((inv) => inv.status === 'PAID').reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()} USD</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.kpi_pending_clearance', 'Pending Clearance')}</span>
              <p className="text-xl font-bold text-amber-600 mt-1" dir="ltr">${data.invoices.filter((inv) => inv.status !== 'PAID').reduce((sum, inv) => sum + Number(inv.amount), 0).toLocaleString()} USD</p>
            </div>
          </div>
        </div>
      )}

      {/* View 5: Schedule & Calendar */}
      {(activeNav === 'schedule' || activeNav === 'calendar') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_calendar_title', 'Contractor Dispatch Calendar')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_calendar_sub', 'Scheduled on-site visits and routine inspection timetable')}</p>
            </div>
            <button
              type="button"
              onClick={onScheduleEvent}
              className="px-3.5 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              {t('vendor.action_new_appointment', '+ New Appointment')}
            </button>
          </div>

          <div className="space-y-3">
            {data.todaySchedule.map((item) => (
              <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs" dir="ltr">
                    {item.time.split(' ')[0]}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {t(`job.${item.title.toLowerCase().replace(/ /g, '_')}`, item.title)}
                    </h4>
                    <p className="text-[11px] text-slate-500">{item.propertyLocation}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                  {t(`vendor.status_${item.status.toLowerCase()}`, item.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 6: Service Categories */}
      {activeNav === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_categories_title', 'Configured Trade Categories')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_categories_sub', 'Service trades eligible for automated matching and maintenance dispatches')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {profile.categories.map((cat: string, i: number) => (
              <div key={i} className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-900">
                    {t(`cat.${cat.toLowerCase().replace(/[^a-z0-9]/g, '_')}`, cat)}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                  {t('vendor.status_active', 'ACTIVE')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 7: Service Areas */}
      {activeNav === 'areas' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_areas_title', 'Service Coverage Areas')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_areas_sub', 'Geographic zones in Iraqi Kurdistan serviced by your technical teams')}</p>
            </div>
            <button
              type="button"
              onClick={onAddArea}
              className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              {t('vendor.action_add_area', '+ Add Area')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {profile.serviceAreas.map((area: string, i: number) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold text-slate-900">{area}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 8: Availability & Operating Hours */}
      {activeNav === 'availability' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_hours_title', 'Operating Hours & Emergency Dispatch')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_hours_sub', 'Live operational availability configured in HomeHub dispatch system')}</p>
            </div>
            <button
              type="button"
              onClick={onUpdateAvailability}
              className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              {t('vendor.action_edit_availability', 'Edit Availability')}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.standard_daily_hours', 'Standard Daily Operating Hours')}</span>
              <p className="text-base font-bold text-slate-900 mt-1" dir="ltr">{profile.workingHours}</p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.emergency_dispatch_title', '24/7 Emergency Dispatch')}</span>
              <p className="text-base font-bold text-emerald-600 mt-1">
                {profile.emergencyAvailable ? t('vendor.emergency_enabled', '✓ ENABLED (On-Call Technicians Ready)') : t('vendor.emergency_disabled', '✗ Standard Hours Only')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* View 9: Tasks */}
      {activeNav === 'tasks' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_tasks_title', 'Operational Checklist & Tasks')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_tasks_sub', 'Internal technician action items and compliance checks')}</p>
            </div>
          </div>
          <div className="space-y-2">
            {data.tasks.map((task: any) => {
              const done = task.status === 'COMPLETED';
              return (
                <div
                  key={task.id}
                  onClick={() => onToggleTask?.(task.id, task.status)}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50 flex items-center justify-between hover:bg-slate-100/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className={`w-4 h-4 ${done ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {task.title}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {done ? t('vendor.task_done', 'DONE') : t('vendor.task_pending', 'PENDING')}
                  </span>
                </div>
              );
            })}
            {data.tasks.length === 0 && (
              <div className="text-center text-xs text-slate-500 py-4">No tasks pending.</div>
            )}
          </div>
        </div>
      )}

      {/* View 10: Team */}
      {activeNav === 'team' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_team_title', 'Contractor Technicians & Team')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_team_sub', 'Authorized personnel registered for on-site property entry')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { name: profile.displayName || 'Vendor Member', role: 'Lead Technician', phone: 'Contact on file', active: true },
            ].map((member, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {member.name.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{member.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{getMemberRole(member.role)}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5" dir="ltr">{member.phone}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 11: Reviews */}
      {activeNav === 'reviews' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_reviews_title', 'Client Reviews & Ratings')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.subview_reviews_sub', 'Verified feedback from property owners and tenants')}</p>
            </div>
            <div className="flex items-center gap-1 text-sm font-black text-amber-500" dir="ltr">
              <Star className="w-4 h-4 fill-amber-400" />
              <span>{data.clientReviews.averageRating} ({data.clientReviews.reviewCount})</span>
            </div>
          </div>
          <div className="space-y-3">
            {data.clientReviews.recentReviews.map((r) => (
              <div key={r.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{r.reviewerName}</span>
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.rating ? 'fill-amber-400' : 'fill-slate-200 text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400" dir="ltr">{r.date}</span>
                </div>
                <p className="text-xs text-slate-700 italic">
                  "{t('vendor.sample_review_comment', r.comment)}"
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View 12: Profile & Verification */}
      {(activeNav === 'profile' || activeNav === 'verification' || activeNav === 'settings' || activeNav === 'documents') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t('vendor.subview_license_title', 'Trade License & Verification Profile')}</h3>
            <p className="text-xs text-slate-500">{t('vendor.subview_license_sub', 'Compliance credentials verified by KRG Ministry of Trade & HomeHub Platform Trust')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.legal_business_name', 'Legal Business Name')}</span>
              <p className="text-sm font-bold text-slate-900">{profile.businessName}</p>
              <p className="text-xs text-slate-600">
                {t('vendor.managing_director', 'Managing Director:')} {profile.displayName}
              </p>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded mt-2">
                {t('vendor.badge_verified_contractor', '✓ VERIFIED CONTRACTOR')}
              </span>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs font-semibold text-slate-500">{t('vendor.trade_license', 'Trade License')}</span>
              <p className="text-sm font-bold text-slate-900" dir="ltr">LIC-{(profile as any).id?.slice(0,8).toUpperCase() || 'PENDING'}</p>
              <p className="text-xs text-slate-600">{t('vendor.issued_by_krg', 'Issued by: Ministry of Trade & Industry, KRG')}</p>
              <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded mt-2">
                {t('vendor.status_active_badge', 'STATUS: ACTIVE')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* View: Settings & Localization Navigator */}
      {activeNav === 'settings' && (
        <div id="vendor-settings-localization-card" className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{t('vendor.localization_title', 'ڕێکخستنی زمان و ناوچە / Localization & Regional Preferences')}</h3>
              <p className="text-xs text-slate-500">{t('vendor.localization_sub', 'Select your preferred operational language and layout direction')}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1" dir="ltr">
            <button
              type="button"
              id="vendor-setting-lang-ku"
              onClick={() => setLanguage('ku')}
              className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
                language === 'ku'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">☀️</span>
                {language === 'ku' && <span className="text-blue-600 text-xs font-bold bg-blue-100 px-2 py-0.5 rounded-full">✓ Active</span>}
              </div>
              <p className="text-sm font-bold text-slate-900 mt-2">کوردی (سۆرانی)</p>
              <p className="text-xs text-slate-500">Kurdish Sorani (RTL)</p>
            </button>
            <button
              type="button"
              id="vendor-setting-lang-ar"
              onClick={() => setLanguage('ar')}
              className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
                language === 'ar'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">🇮🇶</span>
                {language === 'ar' && <span className="text-blue-600 text-xs font-bold bg-blue-100 px-2 py-0.5 rounded-full">✓ Active</span>}
              </div>
              <p className="text-sm font-bold text-slate-900 mt-2">العربية</p>
              <p className="text-xs text-slate-500">Arabic (RTL)</p>
            </button>
            <button
              type="button"
              id="vendor-setting-lang-en"
              onClick={() => setLanguage('en')}
              className={`p-4 rounded-xl border text-start transition-all cursor-pointer ${
                language === 'en'
                  ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg">🇬🇧</span>
                {language === 'en' && <span className="text-blue-600 text-xs font-bold bg-blue-100 px-2 py-0.5 rounded-full">✓ Active</span>}
              </div>
              <p className="text-sm font-bold text-slate-900 mt-2">English</p>
              <p className="text-xs text-slate-500">English (LTR)</p>
            </button>
          </div>
        </div>
      )}

      {/* View 13: Clients & Properties & Messages */}
      {(activeNav === 'clients' || activeNav === 'properties' || activeNav === 'messages') && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 capitalize">{getNavTitle(activeNav)}</h3>
            <p className="text-xs text-slate-500">{t('vendor.subview_associated_records', 'Associated records and messages for authorized service jobs')}</p>
          </div>
          <div className="divide-y divide-slate-100">
            {data.messages.map((m) => (
              <div key={m.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    {m.senderName} ({t(`role.${m.senderRole.toLowerCase().replace(/ /g, '_')}`, m.senderRole)})
                  </p>
                  <p className="text-xs text-slate-500">{m.messageSnippet}</p>
                </div>
                <span className="text-[10px] text-slate-400" dir="ltr">{m.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
