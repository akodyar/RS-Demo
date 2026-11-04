import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { useAuth, EligibleWorkspace } from '../components/AuthProvider';
import { VendorDashboardData, WorkOrderStatus } from '../types/vendor';
import { WorkspaceSwitcherModal } from '../components/common/WorkspaceSwitcherModal';

// Modular Vendor Components
import { VendorSidebar, VendorProfileData } from '../components/vendor/VendorSidebar';
import { VendorHeader } from '../components/vendor/VendorHeader';
import { VendorKpiGrid } from '../components/vendor/VendorKpiGrid';
import {
  VendorHeroBanner,
  VendorJobActivityChart,
  VendorRequestOverviewDonut,
  VendorQuickActionsGrid,
  VendorTodaySchedule,
  VendorRecentRequests,
  VendorEarningsOverview,
  VendorTopCategories,
  VendorReviewsAndMessages,
} from '../components/vendor/VendorDashboardWidgets';
import {
  QuoteModal,
  WorkOrderModal,
  InvoiceModal,
  ScheduleModal,
  AiCoPilotModal,
  AreaModal,
  AvailabilityModal,
} from '../components/vendor/VendorModals';
import { VendorSubViews } from '../components/vendor/VendorSubViews';
import { useToast } from '../components/ui/Toast';

export const VendorWorkspacePage: React.FC = () => {
  const { showToast } = useToast();
  const { t, direction, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const auth = useAuth();
  const token = auth?.token;
  const logout = auth?.logout;

  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDbOffline, setIsDbOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Workspace Switcher Modal State
  const [switchWorkspaceModalOpen, setSwitchWorkspaceModalOpen] = useState(false);
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);
  const [workspaceSwitchError, setWorkspaceSwitchError] = useState<string | null>(null);

  const handleSelectWorkspace = async (target: EligibleWorkspace) => {
    if (target.workspaceId === auth?.activeWorkspace?.workspaceId) {
      setSwitchWorkspaceModalOpen(false);
      return;
    }
    setIsSwitchingWorkspace(true);
    setWorkspaceSwitchError(null);
    try {
      const selected = await auth?.selectWorkspace?.(target.workspaceId);
      setSwitchWorkspaceModalOpen(false);
      const destination = selected?.destination || target.destination || '/vendor';
      if (destination && destination !== '/vendor' && destination !== window.location.pathname) {
        navigate(destination);
      } else {
        await fetchDashboardData();
      }
    } catch (err: any) {
      const msg = err.message || t('workspace.switch_failed', 'Failed to switch workspace.');
      setWorkspaceSwitchError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSwitchingWorkspace(false);
    }
  };

  // Dynamic Vendor Profile State
  const [profile, setProfile] = useState<VendorProfileData>({
    id: '',
    displayName: auth?.user?.displayName || '',
    businessName: '',
    categories: [],
    specialties: [],
    serviceAreas: [],
    workingHours: '08:00 AM - 06:00 PM',
    emergencyAvailable: false,
  });

  // Modals state
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showWorkModal, setShowWorkModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // Quick Action forms
  const [quoteForm, setQuoteForm] = useState({
    maintenanceRequestId: '',
    propertyId: '',
    propertyName: '',
    totalAmount: '',
    laborAmount: '',
    materialsAmount: '',
    feesAmount: '',
    estimatedDuration: '',
    warrantyTerms: '',
    notes: '',
  });

  const [workForm, setWorkForm] = useState({
    workOrderId: 'wo_01',
    status: 'IN_PROGRESS' as WorkOrderStatus,
    notes: 'Work initiated on site. Compressor and refrigerant lines tested.',
    photoUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500',
  });

  const [invoiceForm, setInvoiceForm] = useState({
    workOrderId: 'wo_01',
    amount: '325',
    currency: 'USD',
    dueDate: '2026-10-01',
    description: 'HVAC repair and component replacement',
  });

  const [scheduleForm, setScheduleForm] = useState({
    title: 'AC Maintenance Inspection',
    eventType: 'INSPECTION',
    startTime: '2026-09-22T09:00',
    endTime: '2026-09-22T11:00',
    location: 'Skyline Residences, Erbil',
    notes: 'Bring diagnostic manifold gauge and leak detector.',
  });

  // AI Advisory Co-Pilot state
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Authoritative Dashboard Data
  const [data, setData] = useState<VendorDashboardData>({
    kpi: {
      activeWorkOrders: 0,
      workOrdersDelta: 0,
      scheduledToday: 0,
      scheduledDelta: 0,
      pendingQuotes: 0,
      pendingQuotesDelta: 0,
      completedThisMonth: 0,
      completedDelta: 0,
      totalEarningsThisMonth: 0,
      earningsDelta: 0,
      averageRating: 0,
      ratingDelta: 0,
      currency: 'IQD',
    },
    jobActivity: {
      period: 'Last 7 days',
      days: [],
    },
    requestOverview: {
      totalRequests: 0,
      new: 0,
      assigned: 0,
      inProgress: 0,
      onHold: 0,
      completed: 0,
    },
    todaySchedule: [],
    recentRequests: [],
    messages: [],
    workOrders: [],
    quotes: [],
    invoices: [],
    tasks: [],
    earningsOverview: { year: 2026, months: [] },
    topCategories: [],
    clientReviews: { averageRating: 0, reviewCount: 0, recentReviews: [] },
  });


  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const authToken = token;

      // 1. Fetch Authoritative Dashboard Data
      const res = await fetch('/api/vendor/dashboard', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 503) {
        setIsDbOffline(true);
      } else if (res.ok) {
        const live = await res.json();
        setData(live);
        setIsDbOffline(false);
      }

      // 2. Fetch Authoritative Vendor Profile
      const profRes = await fetch('/api/vendor/profile', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (profRes.ok) {
        const prof = await profRes.json();
        if (prof) {
          setProfile({
            id: prof.id,
            displayName: prof.businessName || auth?.user?.displayName || 'Omar Hassan',
            businessName: prof.legalName || prof.businessName || 'Premium Services Co.',
            categories: prof.categories || ['HVAC Services', 'Plumbing', 'Electrical', 'General Maintenance'],
            specialties: prof.specialties || [],
            serviceAreas: prof.serviceAreas || [],
            workingHours: prof.workingHours
              ? typeof prof.workingHours === 'string'
                ? prof.workingHours
                : `${prof.workingHours.start} - ${prof.workingHours.end} (${prof.workingHours.days?.join(', ')})`
              : '08:00 AM - 06:00 PM',
            emergencyAvailable: Boolean(prof.emergencyAvailable),
          });
        }
      }
    } catch {
      setIsDbOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServiceArea = async (newArea: string) => {
    if (!newArea.trim()) return;
    try {
      const authToken = token;
      const updatedAreas = Array.from(new Set([...profile.serviceAreas, newArea.trim()]));
      const res = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ serviceAreas: updatedAreas }),
      });
      if (res.ok) {
        setProfile((prev) => ({ ...prev, serviceAreas: updatedAreas }));
        showToast('Service coverage area saved successfully.', 'info');
        setShowAreaModal(false);
      } else {
        const err = await res.json();
        showToast(`Service area notice: ${err.message || err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Network notice: ${err.message}`, 'error');
    }
  };

  const handleSaveAvailability = async (hours: string, emergency: boolean) => {
    try {
      const authToken = token;
      const res = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workingHours: hours, emergencyAvailable: emergency }),
      });
      if (res.ok) {
        setProfile((prev) => ({ ...prev, workingHours: hours, emergencyAvailable: emergency }));
        showToast('Operating hours and emergency availability saved successfully.', 'info');
        setShowAvailabilityModal(false);
      } else {
        const err = await res.json();
        showToast(`Availability notice: ${err.message || err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Network notice: ${err.message}`, 'error');
    }
  };

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    try {
      const authToken = token;
      const newStatus = currentStatus === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      const res = await fetch(`/api/vendor/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err: any) {
      console.error('Failed to toggle task:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Quick Action Handlers
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = token;
      const res = await fetch('/api/vendor/quotes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maintenanceRequestId: quoteForm.maintenanceRequestId,
          propertyId: quoteForm.propertyId,
          totalAmount: Number(quoteForm.totalAmount),
          laborAmount: Number(quoteForm.laborAmount),
          materialsAmount: Number(quoteForm.materialsAmount),
          feesAmount: Number(quoteForm.feesAmount),
          estimatedDuration: quoteForm.estimatedDuration,
          warrantyTerms: quoteForm.warrantyTerms,
          notes: quoteForm.notes,
        }),
      });
      if (res.ok || res.status === 201) {
        showToast('Quote submitted successfully to Property Owner / Manager for review.', 'info');
        setShowQuoteModal(false);
        fetchDashboardData();
      } else {
        const err = await res.json();
        showToast(`Quote submission notice: ${err.message || err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'error');
    }
  };

  const handleUpdateWork = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = token;
      const res = await fetch(`/api/vendor/work-orders/${workForm.workOrderId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: workForm.status,
          notes: workForm.notes,
          photos: [workForm.photoUrl],
        }),
      });
      if (res.ok) {
        showToast('Work order updated successfully.', 'info');
        setShowWorkModal(false);
        fetchDashboardData();
      } else {
        const err = await res.json();
        showToast(`Status update notice: ${err.message || err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'error');
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = token;
      const res = await fetch('/api/vendor/invoices', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workOrderId: invoiceForm.workOrderId,
          amount: Number(invoiceForm.amount),
          currency: invoiceForm.currency,
          dueDate: invoiceForm.dueDate,
        }),
      });
      if (res.ok || res.status === 201) {
        showToast('Invoice created and sent for approval.', 'info');
        setShowInvoiceModal(false);
        fetchDashboardData();
      } else {
        const err = await res.json();
        showToast(`Invoice notice: ${err.message || err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'error');
    }
  };

  const handleScheduleEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const authToken = token;
      const res = await fetch('/api/vendor/schedule', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(scheduleForm),
      });
      if (res.ok || res.status === 201) {
        showToast('Appointment scheduled successfully.', 'info');
        setShowScheduleModal(false);
        fetchDashboardData();
      } else {
        const err = await res.json();
        showToast(`Schedule notice: ${err.message || err.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'error');
    }
  };

  const handleAiConsult = async (queryText?: string) => {
    const q = queryText || aiQuery;
    if (!q.trim()) return;

    setAiLoading(true);
    setAiResponse(null);

    try {
      const authToken = token;
      const res = await fetch('/api/vendor/ai/assist', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q }),
      });

      const json = await res.json();
      setAiResponse(json.response || 'No advisory response available.');
    } catch (err: any) {
      setAiResponse(`Advisory system offline: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen bg-[#070b14] text-white flex flex-col lg:flex-row ${
        direction === 'rtl' ? 'font-arabic' : 'font-sans'
      }`}
      dir={direction}
    >
      {/* Vendor Navigation Sidebar Rail (Option 3) */}
      <VendorSidebar
        activeNav={activeNav}
        setActiveNav={setActiveNav}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        profile={profile}
        rating={data.kpi.averageRating}
        reviewCount={data.clientReviews.reviewCount}
        unreadMessagesCount={data.messages.filter((m) => m.unread).length}
        pendingQuotesCount={data.kpi.pendingQuotes}
        openRequestsCount={data.requestOverview.new}
        tasksCount={4}
        onOpenAiAssistant={() => setShowAiModal(true)}
        onOpenWorkspaceSwitcher={() => setSwitchWorkspaceModalOpen(true)}
        onLogout={logout ? () => logout() : undefined}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Workspace Minimal Header / Breadcrumbs */}
        <VendorHeader
          activeNav={activeNav}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          onOpenAiAssistant={() => setShowAiModal(true)}
          onOpenWorkspaceSwitcher={() => setSwitchWorkspaceModalOpen(true)}
          serviceAreaLabel={
            profile.serviceAreas[0]
              ? `${profile.serviceAreas[0]}${language === 'ku' ? '، کوردستان' : language === 'ar' ? '، كردستان' : ', Kurdistan'}`
              : (language === 'ku' ? 'هەولێر، کوردستان' : language === 'ar' ? 'أربيل، كردستان' : 'Erbil, Kurdistan')
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">

          {/* System Status Banner (only when database is unconfigured / offline) */}
          {isDbOffline && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold">{t('vendor.db_notice_title', 'System Notice: Relational Storage Degraded Mode')}</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {t('vendor.db_notice_desc', 'Relational PostgreSQL storage is currently in fail-closed baseline mode. Production operations will fail closed with 503.')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{t('vendor.retry_action', 'Retry')}</span>
              </button>
            </div>
          )}

          {/* Conditional View: Dashboard vs Sub-Navigation */}
          {activeNav === 'dashboard' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Hero Greeting Banner with Primary Actions */}
              <VendorHeroBanner
                displayName={profile.displayName}
                onNewQuote={() => setShowQuoteModal(true)}
                onLogWork={() => setShowWorkModal(true)}
              />

              {/* 6 Top KPI Cards */}
              <VendorKpiGrid
                kpi={data.kpi}
                onCardClick={(section) => setActiveNav(section)}
              />

              {/* Row 2: Operational Overview (Job Activity & Request Donut) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-7">
                  <VendorJobActivityChart jobActivity={data.jobActivity} />
                </div>
                <div className="xl:col-span-5">
                  <VendorRequestOverviewDonut requestOverview={data.requestOverview} />
                </div>
              </div>

              {/* Row 3: Actionable Workflows (Quick Actions, Schedule, Recent Requests) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <VendorQuickActionsGrid
                  onNewQuote={() => setShowQuoteModal(true)}
                  onLogWork={() => setShowWorkModal(true)}
                  onCreateInvoice={() => setShowInvoiceModal(true)}
                  onViewSchedule={() => setShowScheduleModal(true)}
                  onAddArea={() => setShowAreaModal(true)}
                  onUpdateAvailability={() => setShowAvailabilityModal(true)}
                />

                <VendorTodaySchedule
                  schedule={data.todaySchedule}
                  onViewCalendar={() => setActiveNav('calendar')}
                />

                <VendorRecentRequests
                  requests={data.recentRequests}
                  onViewAll={() => setActiveNav('requests')}
                />
              </div>

              {/* Row 4: Performance & Trust (Earnings, Categories, Reviews & Messages) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <VendorEarningsOverview earnings={data.earningsOverview} />

                <VendorTopCategories categories={data.topCategories} />

                <VendorReviewsAndMessages
                  reviews={data.clientReviews}
                  messages={data.messages}
                  onViewReviews={() => setActiveNav('reviews')}
                  onViewMessages={() => setActiveNav('messages')}
                />
              </div>
            </div>
          ) : (
            <VendorSubViews
              activeNav={activeNav}
              data={data}
              profile={profile}
              onBackToDashboard={() => setActiveNav('dashboard')}
              onNewQuote={() => setShowQuoteModal(true)}
              onLogWork={() => setShowWorkModal(true)}
              onCreateInvoice={() => setShowInvoiceModal(true)}
              onScheduleEvent={() => setShowScheduleModal(true)}
              onAddArea={() => setShowAreaModal(true)}
              onUpdateAvailability={() => setShowAvailabilityModal(true)}
              onToggleTask={handleToggleTask}
            />
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. MODALS & ACTION DRAWERS                                                */}
      {/* ========================================================================= */}
      <QuoteModal
        isOpen={showQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        form={quoteForm}
        setForm={setQuoteForm}
        onSubmit={handleCreateQuote}
      />

      <WorkOrderModal
        isOpen={showWorkModal}
        onClose={() => setShowWorkModal(false)}
        form={workForm}
        setForm={setWorkForm}
        onSubmit={handleUpdateWork}
      />

      <InvoiceModal
        isOpen={showInvoiceModal}
        onClose={() => setShowInvoiceModal(false)}
        form={invoiceForm}
        setForm={setInvoiceForm}
        onSubmit={handleCreateInvoice}
      />

      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        form={scheduleForm}
        setForm={setScheduleForm}
        onSubmit={handleScheduleEvent}
      />

      <AiCoPilotModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        query={aiQuery}
        setQuery={setAiQuery}
        response={aiResponse}
        loading={aiLoading}
        onConsult={handleAiConsult}
      />

      <AreaModal
        isOpen={showAreaModal}
        onClose={() => setShowAreaModal(false)}
        serviceAreas={profile.serviceAreas}
        onSaveArea={handleSaveServiceArea}
      />

      <AvailabilityModal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        workingHours={profile.workingHours}
        emergencyAvailable={profile.emergencyAvailable}
        onSaveAvailability={handleSaveAvailability}
      />

      {/* Authoritative Workspace Switcher Modal */}
      <WorkspaceSwitcherModal
        isOpen={switchWorkspaceModalOpen}
        onClose={() => {
          if (!isSwitchingWorkspace) {
            setSwitchWorkspaceModalOpen(false);
            setWorkspaceSwitchError(null);
          }
        }}
        workspaces={auth?.eligibleWorkspaces}
        activeWorkspace={auth?.activeWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
        onLogout={async () => {
          setSwitchWorkspaceModalOpen(false);
          if (auth?.logout) await auth.logout();
          navigate('/login');
        }}
        isSwitching={isSwitchingWorkspace}
        error={workspaceSwitchError}
        onClearError={() => setWorkspaceSwitchError(null)}
      />
    </div>
  );
};
