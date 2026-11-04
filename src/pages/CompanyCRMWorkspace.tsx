import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth } from '../components/AuthProvider';
import { 
  Users, UserCheck, Clock, Plus, Search, Filter, Mail, 
  Phone, Building2, Shield, CheckCircle, XCircle, AlertTriangle,
  FileText, ExternalLink, RefreshCw, ChevronRight, X, Bell,
  CheckSquare, Calendar, Sliders, MessageSquare
} from 'lucide-react';
import { CompanyManagementAgreementItem, CompanyTenantItem } from '../types/company.js';
import { CrmContactItem, CrmTaskItem, CrmActivityItem, NotificationItem } from '../types/communications-crm.js';

export const CompanyCRMWorkspacePage: React.FC = () => {
  const { t, language, direction } = useI18n();
  const { token } = useAuth();

  const [activeTab, setActiveTab] = useState<'agreements' | 'tenants' | 'contacts' | 'notifications' | 'tasks' | 'timeline' | 'preferences'>('agreements');
  const [loading, setLoading] = useState(false);
  const [dbUnavailable, setDbUnavailable] = useState(false);
  const [agreements, setAgreements] = useState<CompanyManagementAgreementItem[]>([]);
  const [tenants, setTenants] = useState<CompanyTenantItem[]>([]);
  const [contacts, setContacts] = useState<CrmContactItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [tasks, setTasks] = useState<CrmTaskItem[]>([]);
  const [timeline, setTimeline] = useState<CrmActivityItem[]>([]);
  const [preferences, setPreferences] = useState({
    channelPreferences: { IN_APP: true, EMAIL: true, SMS: false, PUSH: false },
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Proposal modal
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalData, setProposalData] = useState({
    ownerEmail: '',
    propertyName: '',
    spendingLimit: 500000,
  });

  // Contact modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    relationship: 'PROSPECT' as const,
    notes: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setDbUnavailable(false);
    try {
      const authHeader = { 'Authorization': `Bearer ${token}` };
      const [agRes, tenRes, ctcRes, notifRes, taskRes, timeRes, prefRes] = await Promise.all([
        fetch('/api/company/management-agreements', { headers: authHeader }),
        fetch('/api/company/tenants', { headers: authHeader }),
        fetch('/api/crm/contacts', { headers: authHeader }),
        fetch('/api/communications/notifications', { headers: authHeader }),
        fetch('/api/crm/tasks', { headers: authHeader }),
        fetch('/api/crm/timeline', { headers: authHeader }),
        fetch('/api/communications/preferences', { headers: authHeader }),
      ]);

      if ([agRes, tenRes, ctcRes, notifRes, taskRes, timeRes].some(r => r.status === 503)) {
        setDbUnavailable(true);
        setAgreements([]);
        setTenants([]);
        setContacts([]);
        setNotifications([]);
        setTasks([]);
        setTimeline([]);
      } else {
        if (agRes.ok) setAgreements(await agRes.json());
        if (tenRes.ok) setTenants(await tenRes.json());
        if (ctcRes.ok) setContacts(await ctcRes.json());
        if (notifRes.ok) setNotifications(await notifRes.json());
        if (taskRes.ok) setTasks(await taskRes.json());
        if (timeRes.ok) setTimeline(await timeRes.json());
        if (prefRes.ok) {
          const prefData = await prefRes.json();
          if (prefData?.channelPreferences) {
            setPreferences({
              channelPreferences: prefData.channelPreferences,
              quietHoursEnabled: !!prefData.quietHoursEnabled,
              quietHoursStart: prefData.quietHoursStart || '22:00',
              quietHoursEnd: prefData.quietHoursEnd || '08:00',
            });
          }
        }
      }
    } catch (err: any) {
      console.error('CRM Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrefs(true);
    try {
      const res = await fetch('/api/communications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        setActionNotice(t('crm.preferencesSaved'));
      }
    } catch (err: any) {
      console.error('Save preferences error:', err);
    } finally {
      setSavingPrefs(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleAgreementResponse = async (agreementId: string, action: 'ACCEPT' | 'DECLINE') => {
    try {
      const res = await fetch(`/api/company/management-agreements/${agreementId}/respond`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setActionNotice(action === 'ACCEPT' 
          ? (language === 'en' ? 'Management agreement accepted successfully.' : language === 'ar' ? 'تم قبول اتفاقية الإدارة بنجاح.' : 'گرێبەستەکە بە سەرکەوتوویی قبوڵکرا.')
          : (language === 'en' ? 'Management agreement declined.' : language === 'ar' ? 'تم رفض اتفاقية الإدارة.' : 'گرێبەستەکە ڕەتکرایەوە.')
        );
        fetchData();
      } else {
        const err = await res.json();
        setActionNotice(err.message || (language === 'en' ? 'Action could not be completed.' : language === 'ar' ? 'تعذر إتمام الإجراء.' : 'کردارەکە ئەنجام نەدرا.'));
      }
    } catch (err: any) {
      setActionNotice(err.message || (language === 'en' ? 'An unexpected error occurred.' : language === 'ar' ? 'حدث خطأ غير متوقع.' : 'هەڵە ڕوویدا.'));
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (res.ok) {
        setActionNotice(language === 'en' ? 'New contact registered successfully in CRM.' : language === 'ar' ? 'تم تسجيل جهة اتصال جديدة بنجاح في إدارة علاقات العملاء.' : 'کەسایەتی نوێ لە CRM تۆمارکرا.');
        setShowContactModal(false);
        setContactData({ firstName: '', lastName: '', email: '', phone: '', relationship: 'PROSPECT', notes: '' });
        fetchData();
      } else {
        const err = await res.json();
        setActionNotice(err.message || (language === 'en' ? 'Failed to register contact.' : language === 'ar' ? 'فشل تسجيل جهة الاتصال.' : 'هەڵە لە تۆمارکردنی کڕیار.'));
      }
    } catch (err: any) {
      setActionNotice(err.message || (language === 'en' ? 'An unexpected error occurred.' : language === 'ar' ? 'حدث خطأ غير متوقع.' : 'هەڵە ڕوویدا.'));
    }
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    try {
      const res = await fetch(`/api/communications/notifications/${notifId}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      if (res.ok) {
        setActionNotice(language === 'en' ? 'Task marked as completed.' : language === 'ar' ? 'تم تحديد المهمة كمكتملة.' : 'ئەرکەکە وەک تەواوکراو تۆمارکرا.');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredAgreements = agreements.filter(a => 
    a.propertyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.propertyName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery)
  );

  const getTabTitle = (tab: string) => {
    switch (tab) {
      case 'agreements': return t('crm.agreementsTab');
      case 'contacts': return t('crm.contactsTab');
      case 'notifications': return t('crm.notificationsTab');
      case 'tasks': return t('crm.tasksTab');
      case 'timeline': return t('crm.timelineTab');
      case 'tenants': return t('crm.tenantsTab');
      case 'preferences': return t('crm.preferencesTab');
      default: return tab;
    }
  };

  return (
    <div className={`min-h-screen bg-[#070b14] text-white flex flex-col md:flex-row ${direction === 'rtl' ? 'font-arabic' : 'font-sans'}`} dir={direction}>
      {/* ========================================================================= */}
      {/* 1. DESKTOP VERTICAL SIDEBAR RAIL (Option 3 - Linear / Stripe Style)        */}
      {/* ========================================================================= */}
      <aside
        className="hidden md:flex flex-col items-center justify-between w-20 lg:w-22 bg-[#0c1322] border-e border-slate-800/90 py-3.5 px-2 shrink-0 sticky top-0 h-screen z-40 shadow-2xl"
        aria-label="Company CRM Navigation Rail"
      >
        <div className="flex flex-col items-center gap-3 w-full min-h-0 flex-1">
          {/* Brand Icon Button */}
          <button
            type="button"
            onClick={() => setActiveTab('agreements')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500 shrink-0"
            title="HomeHub CRM"
            aria-label="HomeHub CRM"
          >
            <span className="font-black text-slate-950 text-sm tracking-tighter select-none">HH</span>
          </button>

          <div className="w-8 h-px bg-slate-800/90 my-0.5 shrink-0" />

          {/* Vertical Navigation Rail Tabs */}
          <nav
            className="flex flex-col items-center gap-1.5 w-full overflow-y-auto scrollbar-none py-1"
            aria-label="CRM Navigation"
          >
            {/* Agreements */}
            <button
              type="button"
              data-testid="crm-tab-agreements"
              onClick={() => setActiveTab('agreements')}
              title={t('crm.agreementsTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'agreements'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'agreements' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <FileText className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'agreements' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕێککەوتن' : language === 'ar' ? 'الاتفاقيات' : 'Agreements'}
              </span>
              {agreements.length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {agreements.length}
                </span>
              )}
            </button>

            {/* Contacts */}
            <button
              type="button"
              data-testid="crm-tab-contacts"
              onClick={() => setActiveTab('contacts')}
              title={t('crm.contactsTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'contacts'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'contacts' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Users className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'contacts' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'کەسەکان' : language === 'ar' ? 'جهات الاتصال' : 'Contacts'}
              </span>
              {contacts.length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                  {contacts.length}
                </span>
              )}
            </button>

            {/* Tenants */}
            <button
              type="button"
              data-testid="crm-tab-tenants"
              onClick={() => setActiveTab('tenants')}
              title={t('crm.tenantsTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'tenants'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'tenants' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <UserCheck className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'tenants' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'کرێچییەکان' : language === 'ar' ? 'المستأجرين' : 'Tenants'}
              </span>
              {tenants.length > 0 && (
                <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center shadow-xs">
                  {tenants.length}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button
              type="button"
              data-testid="crm-tab-notifications"
              onClick={() => setActiveTab('notifications')}
              title={t('crm.notificationsTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'notifications'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'notifications' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Bell className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'notifications' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ئاگاداری' : language === 'ar' ? 'الإشعارات' : 'Alerts'}
              </span>
            </button>

            {/* Tasks */}
            <button
              type="button"
              data-testid="crm-tab-tasks"
              onClick={() => setActiveTab('tasks')}
              title={t('crm.tasksTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'tasks'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'tasks' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <CheckSquare className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'tasks' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ئەرکەکان' : language === 'ar' ? 'المهام' : 'Tasks'}
              </span>
            </button>

            {/* Timeline */}
            <button
              type="button"
              data-testid="crm-tab-timeline"
              onClick={() => setActiveTab('timeline')}
              title={t('crm.timelineTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'timeline'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'timeline' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Clock className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'timeline' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'کاتی' : language === 'ar' ? 'الجدول' : 'Timeline'}
              </span>
            </button>

            {/* Preferences */}
            <button
              type="button"
              data-testid="crm-tab-preferences"
              onClick={() => setActiveTab('preferences')}
              title={t('crm.preferencesTab')}
              className={`w-full py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group relative ${
                activeTab === 'preferences'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
              }`}
            >
              {activeTab === 'preferences' && (
                <span className="absolute top-2.5 bottom-2.5 start-0 w-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
              )}
              <Sliders className={`w-4.5 h-4.5 shrink-0 transition-transform group-hover:scale-110 ${activeTab === 'preferences' ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
              <span className="text-[10px] leading-tight truncate max-w-[56px] select-none text-center">
                {language === 'ku' ? 'ڕێکخستن' : language === 'ar' ? 'الإعدادات' : 'Prefs'}
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Rail Action: Add Contact */}
        <div className="flex flex-col items-center gap-2 w-full pt-3 border-t border-slate-800/80 shrink-0">
          <button
            type="button"
            onClick={() => setShowContactModal(true)}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 flex items-center justify-center shadow-md shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title={t('crm.newContact')}
            aria-label={t('crm.newContact')}
          >
            <Plus className="w-5 h-5 text-slate-950 font-bold" />
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN LAYOUT AREA (Minimal Header + Content Column)                     */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Razor-Sharp Desktop & Mobile Header */}
        <header className="sticky top-0 z-30 bg-[#0c1322]/95 backdrop-blur-md border-b border-amber-500/20 shadow-md px-4 lg:px-8 h-16 flex items-center justify-between gap-4 text-white">
          {/* Start: Mobile Brand Logo & Desktop Breadcrumb */}
          <div className="flex items-center gap-3">
            {/* Mobile Brand Logo */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('agreements')}
                className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xs"
              >
                HH
              </button>
            </div>

            {/* Desktop Breadcrumbs & Active Title */}
            <div className="hidden md:flex items-center gap-2.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('agreements')}
                className="text-slate-400 hover:text-amber-400 transition-colors font-medium cursor-pointer"
              >
                {t('crm.workspaceTitle')}
              </button>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold flex items-center gap-1.5">
                {getTabTitle(activeTab)}
              </span>
            </div>
          </div>

          {/* End Header Area: Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-add-contact"
              onClick={() => setShowContactModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('crm.newContact')}</span>
            </button>
            <button
              id="btn-add-proposal"
              onClick={() => setShowProposalModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#080d19] hover:bg-[#111b2e] text-amber-300 border border-amber-500/30 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('crm.proposal')}</span>
            </button>
            <button
              id="btn-refresh-crm"
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-800 bg-[#080d19] text-slate-300 hover:bg-[#111b2e] flex items-center justify-center cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-6 w-full">

      {dbUnavailable && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">داتابەیس بەردەست نییە (Fail-Closed)</p>
            <p className="mt-0.5">داتابەیسی پەیوەندیدار لەم ژینگەیەدا پەیوەست نەکراوە. هەموو کردارەکان بە شێوازی پارێزراو بلۆککراون.</p>
          </div>
        </div>
      )}

      {actionNotice && (
        <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs sm:text-sm flex items-center justify-between">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-amber-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="md:hidden flex border-b border-amber-500/20 gap-2 pb-1 overflow-x-auto">
        <button
          id="btn-tab-agreements"
          onClick={() => setActiveTab('agreements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'agreements' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t('crm.agreementsTab')} ({agreements.length})</span>
        </button>
        <button
          id="btn-tab-contacts"
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'contacts' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('crm.contactsTab')} ({contacts.length})</span>
        </button>
        <button
          id="btn-tab-notifications"
          onClick={() => setActiveTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'notifications' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>{t('crm.notificationsTab')} ({notifications.length})</span>
        </button>
        <button
          id="btn-tab-tasks"
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'tasks' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>{t('crm.tasksTab')} ({tasks.length})</span>
        </button>
        <button
          id="btn-tab-timeline"
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'timeline' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{t('crm.timelineTab')} ({timeline.length})</span>
        </button>
        <button
          id="btn-tab-tenants"
          onClick={() => setActiveTab('tenants')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'tenants' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>{t('crm.tenantsTab')} ({tenants.length})</span>
        </button>
        <button
          id="btn-tab-preferences"
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer min-h-[44px] whitespace-nowrap ${
            activeTab === 'preferences' ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>{t('crm.preferencesTab')}</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className={`w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
        <input
          id="crm-search-input"
          type="text"
          placeholder={t('crm.searchPlaceholder')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className={`w-full py-2.5 px-4 rounded-xl border border-slate-800 bg-[#080d19] text-white placeholder:text-slate-500 text-sm focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none ${direction === 'rtl' ? 'pr-10' : 'pl-10'}`}
        />
      </div>

      {/* Content: Agreements */}
      {activeTab === 'agreements' && (
        <div className="flex flex-col gap-4">
          {filteredAgreements.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAgreements.map(ag => (
                <div key={ag.id} className="bg-[#0c1322] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-white text-base">{ag.propertyName}</h3>
                        <p className="text-xs text-slate-400">{ag.propertyType}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        ag.status === 'ACTIVE' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' :
                        ag.status === 'PENDING' ? 'bg-amber-950/80 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {ag.status}
                      </span>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex flex-col gap-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('crm.owner')}:</span>
                        <span className="font-semibold text-white">{ag.ownerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">{t('crm.spendingLimitLabel')}:</span>
                        <span className="font-semibold text-amber-400" dir="ltr">{ag.spendingLimit.toLocaleString()} IQD</span>
                      </div>
                    </div>
                  </div>

                  {ag.status === 'PENDING' && (
                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <button
                        id={`btn-accept-agreement-${ag.id}`}
                        onClick={() => handleAgreementResponse(ag.id, 'ACCEPT')}
                        className="flex-1 px-3 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all min-h-[44px] cursor-pointer shadow-md"
                      >
                        {t('crm.acceptAgreement')}
                      </button>
                      <button
                        id={`btn-decline-agreement-${ag.id}`}
                        onClick={() => handleAgreementResponse(ag.id, 'DECLINE')}
                        className="flex-1 px-3 py-2 bg-[#111b2e] hover:bg-[#17243a] text-slate-300 border border-slate-700 rounded-xl text-xs font-bold transition-colors min-h-[44px] cursor-pointer"
                      >
                        {t('crm.declineAgreement')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">{t('crm.noAgreements')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('crm.noAgreementsDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* Content: Contacts */}
      {activeTab === 'contacts' && (
        <div className="flex flex-col gap-4">
          {filteredContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map(c => (
                <div key={c.id} className="bg-[#0c1322] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-white text-base">{c.firstName} {c.lastName}</h4>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-500/30">
                        {c.relationship}
                      </span>
                    </div>
                    {c.email && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5" dir="ltr">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{c.email}</span>
                      </p>
                    )}
                    {c.phone && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5" dir="ltr">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span>{c.phone}</span>
                      </p>
                    )}
                    {c.notes && (
                      <p className="text-xs text-slate-300 mt-2 bg-[#080d19] p-2.5 rounded-xl border border-slate-800">
                        {c.notes}
                      </p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                    <span>{t('crm.recordedOn')} {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
              <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">{t('crm.noContacts')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('crm.noContactsDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* Content: Notifications */}
      {activeTab === 'notifications' && (
        <div className="flex flex-col gap-4">
          {notifications.length > 0 ? (
            <div className="flex flex-col gap-3">
              {notifications.map(n => (
                <div key={n.id} className={`p-4 rounded-2xl border transition-colors flex items-start justify-between gap-4 ${
                  n.readAt || (n as any).read ? 'bg-[#0c1322] border-slate-800' : 'bg-[#111b2e] border-amber-500/30'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl mt-0.5 ${
                      n.category === 'SECURITY' ? 'bg-rose-950/80 text-rose-400 border border-rose-500/30' :
                      n.category === 'RENT' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' :
                      'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                    }`}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{n.title}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {n.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{n.body || (n as any).message}</p>
                      <span className="text-[10px] text-slate-500 mt-1.5 block">
                        {new Date(n.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {!n.readAt && !(n as any).read && (
                    <button
                      id={`btn-mark-read-${n.id}`}
                      onClick={() => handleMarkNotificationRead(n.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 rounded-lg min-h-[44px] cursor-pointer"
                    >
                      {t('crm.markAsRead')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
              <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">{t('crm.noNotifications')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('crm.noNotificationsDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* Content: Tasks */}
      {activeTab === 'tasks' && (
        <div className="flex flex-col gap-4">
          {tasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tasks.map(tsk => (
                <div key={tsk.id} className="bg-[#0c1322] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex items-start justify-between">
                      <h4 className={`font-bold text-sm ${tsk.status === 'COMPLETED' ? 'line-through text-slate-500' : 'text-white'}`}>
                        {tsk.title}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        tsk.status === 'COMPLETED' ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/30' : 'bg-amber-950/80 text-amber-400 border border-amber-500/30'
                      }`}>
                        {tsk.status}
                      </span>
                    </div>
                    {tsk.description && (
                      <p className="text-xs text-slate-300 mt-1">{tsk.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      {t('crm.dueDateLabel')} <span className="font-semibold text-amber-400" dir="ltr">{tsk.dueDate}</span>
                    </p>
                  </div>

                  {tsk.status !== 'COMPLETED' && (
                    <div className="pt-2 border-t border-slate-800 flex justify-end">
                      <button
                        id={`btn-complete-task-${tsk.id}`}
                        onClick={() => handleCompleteTask(tsk.id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black transition-colors min-h-[44px] cursor-pointer shadow-md"
                      >
                        {t('crm.completeTask')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
              <CheckSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">{t('crm.noTasks')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('crm.noTasksDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* Content: Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-6 shadow-xl">
          <h3 className="font-bold text-white text-base mb-4">{t('crm.timelineTab')}</h3>
          {timeline.length > 0 ? (
            <div className={`relative border-slate-800 space-y-6 ${direction === 'rtl' ? 'border-r-2 pr-4' : 'border-l-2 pl-4'}`}>
              {timeline.map(act => (
                <div key={act.id} className="relative">
                  <div className={`absolute top-1 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-[#0c1322] ${direction === 'rtl' ? '-right-6' : '-left-6'}`} />
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700">
                      {act.activityType}
                    </span>
                    <h5 className="font-bold text-white text-sm mt-1">{act.subject}</h5>
                    <p className="text-xs text-slate-300 mt-0.5">{act.description}</p>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      {new Date(act.occurredAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              {t('crm.noTimeline')}
            </div>
          )}
        </div>
      )}

      {/* Content: Tenants */}
      {activeTab === 'tenants' && (
        <div className="flex flex-col gap-4">
          {filteredTenants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTenants.map(tnt => (
                <div key={tnt.id} className="bg-[#0c1322] border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-amber-400/10 text-amber-400 border border-amber-500/20 font-bold flex items-center justify-center text-sm">
                      {tnt.name.slice(0, 2)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{tnt.name}</h4>
                      <p className="text-xs text-slate-400" dir="ltr">{tnt.email}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-slate-800 flex flex-col gap-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('crm.propertyLabel')}</span>
                      <span className="font-semibold text-white">{tnt.propertyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('crm.rentAmountLabel')}</span>
                      <span className="font-semibold text-emerald-400" dir="ltr">{tnt.rentAmount.toLocaleString()} {tnt.currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{t('crm.leaseStatusLabel')}</span>
                      <span className="font-bold text-amber-400">{tnt.leaseStatus}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#0c1322] border border-slate-800 rounded-2xl p-12 text-center shadow-xl">
              <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white">{t('crm.noTenants')}</h3>
              <p className="text-xs text-slate-400 mt-1">{t('crm.noTenantsDesc')}</p>
            </div>
          )}
        </div>
      )}

      {/* Content: Preferences */}
      {activeTab === 'preferences' && (
        <div id="crm-preferences-pane" className="bg-[#0c1322] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Sliders className="w-5 h-5 text-amber-400" />
              <span>{t('crm.preferencesTitle')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">{t('crm.preferencesSubtitle')}</p>
          </div>

          <form onSubmit={handleSavePreferences} className="flex flex-col gap-6">
            {/* Delivery Channels */}
            <div className="space-y-3">
              <h4 className="font-bold text-sm text-white">{t('crm.channels')}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-[#080d19] hover:border-slate-700 cursor-pointer">
                  <input
                    id="pref-in-app"
                    type="checkbox"
                    checked={preferences.channelPreferences.IN_APP}
                    onChange={e => setPreferences({
                      ...preferences,
                      channelPreferences: { ...preferences.channelPreferences, IN_APP: e.target.checked }
                    })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">{t('crm.channelInApp')}</span>
                    <span className="text-[11px] text-slate-400">پەیام و ئاگاداری ڕاستەوخۆ لەناو سیستەم</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-[#080d19] hover:border-slate-700 cursor-pointer">
                  <input
                    id="pref-email"
                    type="checkbox"
                    checked={preferences.channelPreferences.EMAIL}
                    onChange={e => setPreferences({
                      ...preferences,
                      channelPreferences: { ...preferences.channelPreferences, EMAIL: e.target.checked }
                    })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">{t('crm.channelEmail')}</span>
                    <span className="text-[11px] text-slate-400">ناردنی کۆپی فەرمی بۆ ئیمەیڵی پەیوەندیدار</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-[#080d19] hover:border-slate-700 cursor-pointer">
                  <input
                    id="pref-sms"
                    type="checkbox"
                    checked={preferences.channelPreferences.SMS}
                    onChange={e => setPreferences({
                      ...preferences,
                      channelPreferences: { ...preferences.channelPreferences, SMS: e.target.checked }
                    })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">{t('crm.channelSms')}</span>
                    <span className="text-[11px] text-slate-400">کورتەنامەی مۆبایل (+964)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-800 bg-[#080d19] hover:border-slate-700 cursor-pointer">
                  <input
                    id="pref-push"
                    type="checkbox"
                    checked={preferences.channelPreferences.PUSH}
                    onChange={e => setPreferences({
                      ...preferences,
                      channelPreferences: { ...preferences.channelPreferences, PUSH: e.target.checked }
                    })}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">{t('crm.channelPush')}</span>
                    <span className="text-[11px] text-slate-400">ئاگاداری پەنجەرەی مۆبایل و براوسەر</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-white">{t('crm.quietHours')}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{t('crm.quietHoursDesc')}</p>
                </div>
                <input
                  id="pref-quiet-toggle"
                  type="checkbox"
                  checked={preferences.quietHoursEnabled}
                  onChange={e => setPreferences({ ...preferences, quietHoursEnabled: e.target.checked })}
                  className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 cursor-pointer accent-amber-500"
                />
              </div>

              {preferences.quietHoursEnabled && (
                <div className="grid grid-cols-2 gap-4 max-w-sm pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.quietStart')}</label>
                    <input
                      id="pref-quiet-start"
                      type="time"
                      value={preferences.quietHoursStart}
                      onChange={e => setPreferences({ ...preferences, quietHoursStart: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.quietEnd')}</label>
                    <input
                      id="pref-quiet-end"
                      type="time"
                      value={preferences.quietHoursEnd}
                      onChange={e => setPreferences({ ...preferences, quietHoursEnd: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-800 bg-[#080d19] text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                id="btn-save-preferences"
                type="submit"
                disabled={savingPrefs}
                className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer min-h-[44px]"
              >
                {savingPrefs ? t('crm.savePreferences') + '...' : t('crm.savePreferences')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Contact Creation Modal */}
      {showContactModal && (
        <div id="modal-add-contact" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1322] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">{t('crm.addContactTitle')}</h3>
              <button id="btn-close-contact-modal" onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateContact} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.firstName')} *</label>
                  <input
                    id="contact-firstname-input"
                    type="text"
                    required
                    value={contactData.firstName}
                    onChange={e => setContactData({ ...contactData, firstName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.lastName')} *</label>
                  <input
                    id="contact-lastname-input"
                    type="text"
                    required
                    value={contactData.lastName}
                    onChange={e => setContactData({ ...contactData, lastName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.email')}</label>
                <input
                  id="contact-email-input"
                  type="email"
                  value={contactData.email}
                  onChange={e => setContactData({ ...contactData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.phone')}</label>
                <input
                  id="contact-phone-input"
                  type="text"
                  placeholder="+9647501234567"
                  value={contactData.phone}
                  onChange={e => setContactData({ ...contactData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.relationship')}</label>
                <select
                  id="contact-relationship-select"
                  value={contactData.relationship}
                  onChange={e => setContactData({ ...contactData, relationship: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                >
                  <option value="PROSPECT">{t('crm.prospect')}</option>
                  <option value="BUYER">{t('crm.buyer')}</option>
                  <option value="TENANT">{t('crm.tenant')}</option>
                  <option value="OWNER">{t('crm.owner')}</option>
                  <option value="VENDOR">{t('crm.vendor')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.notes')}</label>
                <textarea
                  id="contact-notes-input"
                  rows={3}
                  value={contactData.notes}
                  onChange={e => setContactData({ ...contactData, notes: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  id="btn-cancel-contact"
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-[#111b2e] text-slate-300 rounded-xl text-xs font-bold hover:bg-[#17243a] min-h-[44px] cursor-pointer"
                >
                  {t('crm.cancel')}
                </button>
                <button
                  id="btn-submit-contact"
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black min-h-[44px] cursor-pointer shadow-md"
                >
                  {t('crm.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Proposal Modal */}
      {showProposalModal && (
        <div id="crm-proposal-modal" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0c1322] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-800 text-white">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-base">{t('crm.proposalTitle')}</h3>
              <button id="btn-close-proposal-modal" onClick={() => setShowProposalModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.ownerEmail')}</label>
                <input
                  id="proposal-owner-email-input"
                  type="email"
                  placeholder="owner@homehub.iq"
                  value={proposalData.ownerEmail}
                  onChange={e => setProposalData({ ...proposalData, ownerEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.propertyName')}</label>
                <input
                  id="proposal-property-name-input"
                  type="text"
                  placeholder="Erbil Royal Crown Suites 3A"
                  value={proposalData.propertyName}
                  onChange={e => setProposalData({ ...proposalData, propertyName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">{t('crm.spendingLimit')}</label>
                  <input
                    id="proposal-spending-limit-input"
                    type="number"
                    value={proposalData.spendingLimit}
                    onChange={e => setProposalData({ ...proposalData, spendingLimit: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 border border-slate-800 bg-[#080d19] text-white rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/40 outline-none"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-300 leading-relaxed">
                {t('crm.proposalNotice')}
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button
                  id="btn-cancel-proposal"
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="px-4 py-2 border border-slate-800 bg-[#111b2e] text-slate-300 rounded-xl text-xs font-bold hover:bg-[#17243a] min-h-[44px] cursor-pointer"
                >
                  {t('crm.cancel')}
                </button>
                <button
                  id="btn-submit-proposal"
                  type="button"
                  onClick={() => {
                    setActionNotice(t('crm.proposalSuccess', 'پێشنیازەکە بۆ خاوەن موڵک نێردرا.'));
                    setShowProposalModal(false);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black min-h-[44px] cursor-pointer shadow-md"
                >
                  {t('crm.sendProposal')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
};