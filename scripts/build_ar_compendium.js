import fs from 'fs';

const rawCompendium = `Key: accountant.workspace
  EN: Accountant Dashboard
  AR: لوحة تحكم المحاسب

Key: action.add
  EN: Add
  AR: إضافة

Key: action.approve
  EN: Approve
  AR: موافقة

Key: action.back
  EN: Back
  AR: رجوع

Key: action.cancel
  EN: Cancel
  AR: إلغاء

Key: action.close
  EN: Close
  AR: إغلاق

Key: action.complete_setup
  EN: Complete Setup
  AR: إكمال الإعداد

Key: action.confirm
  EN: Confirm
  AR: تأكيد

Key: action.continue
  EN: Continue
  AR: متابعة

Key: action.create
  EN: Create
  AR: إنشاء

Key: action.delete
  EN: Delete
  AR: حذف

Key: action.download
  EN: Download
  AR: تحميل

Key: action.edit
  EN: Edit
  AR: تعديل

Key: action.next
  EN: Next
  AR: التالي

Key: action.reject
  EN: Reject
  AR: رفض

Key: action.save
  EN: Save
  AR: حفظ

Key: action.sign_out
  EN: Sign Out
  AR: تسجيل الخروج

Key: action.submit
  EN: Submit
  AR: إرسال

Key: action.upload
  EN: Upload
  AR: رفع

Key: action.view_details
  EN: View Details
  AR: عرض التفاصيل

Key: admin.active_disputes
  EN: Active Disputes
  AR: النزاعات النشطة

Key: admin.control_center
  EN: Admin Control Center
  AR: مركز تحكم الإدارة

Key: admin.feature_flags
  EN: Feature Flags
  AR: ميزات النظام

Key: admin.governance
  EN: Governance & Policies
  AR: الحوكمة والسياسات

Key: admin.health_status
  EN: Platform Health
  AR: صحة المنصة

Key: admin.overview
  EN: Platform Overview
  AR: نظرة عامة على المنصة

Key: admin.security_audit
  EN: Security & Audit
  AR: الأمن والتدقيق

Key: admin.security_events
  EN: Security Events
  AR: الأحداث الأمنية

Key: admin.settings_flags
  EN: Settings & Flags
  AR: الإعدادات والميزات

Key: admin.total_users
  EN: Total Users
  AR: إجمالي المستخدمين

Key: analytics.accept_insight
  EN: Accept Insight
  AR: قبول التوصية

Key: analytics.active_units
  EN: Active Units
  AR: الوحدات النشطة

Key: analytics.ai_disclaimer
  EN: Ai Disclaimer
  AR: التوصيات الذكية لا تنفذ الإجراءات بشكل مستقل.

Key: analytics.ai_recommendations
  EN: AI Recommendations
  AR: توصيات الذكاء الاصطناعي

Key: analytics.alerts
  EN: Active Alerts
  AR: تنبيهات نشطة

Key: analytics.annual_yield
  EN: Annual Yield
  AR: العائد السنوي

Key: analytics.dismiss_insight
  EN: Dismiss
  AR: تجاهل

Key: analytics.healthy
  EN: Healthy
  AR: سليم

Key: analytics.net_operating_income
  EN: Net Operating Income
  AR: صافي الدخل التشغيلي

Key: analytics.occupancy
  EN: Occupancy Rate
  AR: معدل الإشغال

Key: analytics.overview
  EN: Overview
  AR: نظرة عامة على المحفظة

Key: analytics.overview_desc
  EN: Overview Desc
  AR: أداء الأصول وملخص الاستثمار

Key: analytics.portfolio_health
  EN: Portfolio Health
  AR: صحة المحفظة

Key: analytics.property_valuation
  EN: Estimated Value
  AR: القيمة المقدرة

Key: analytics.require_attention
  EN: Require Attention
  AR: تحتاج انتباه

Key: analytics.revenue_vs_expenses
  EN: Revenue Vs Expenses
  AR: الإيرادات مقابل المصاريف (من بداية السنة)

Key: analytics.total_value
  EN: Total Value
  AR: إجمالي القيمة

Key: analytics.trailing_12m
  EN: Trailing 12m
  AR: آخر 12 شهراً

Key: analytics.units_leased
  EN: Units Leased
  AR: وحدات مؤجرة

Key: analytics.vacancy_rate
  EN: Vacancy Rate
  AR: معدل الشغور

Key: analytics.yoy
  EN: Yoy
  AR: ↑ سنوياً

Key: auth.access_denied
  EN: Access Denied
  AR: تم رفض الوصول

Key: auth.create_account
  EN: Create Account
  AR: إنشاء حساب

Key: auth.email
  EN: Email
  AR: البريد الإلكتروني

Key: auth.error
  EN: Error
  AR: فشل تسجيل الدخول

Key: auth.feature.1
  EN: 1
  AR: إدارة عقارات ذكية

Key: auth.feature.2
  EN: 2
  AR: سير عمل صيانة سلس

Key: auth.feature.3
  EN: 3
  AR: تحكم مالي شفاف

Key: auth.forgot
  EN: Forgot
  AR: نسيت كلمة المرور؟

Key: auth.forgot_password
  EN: Forgot Password
  AR: نسيت كلمة المرور؟

Key: auth.hero.subtitle
  EN: Subtitle
  AR: ربط الملاك والمديرين والمستأجرين والمقاولين في منصة واحدة متكاملة.

Key: auth.hero.title
  EN: Title
  AR: نظام تشغيل عقاري شامل.

Key: auth.login
  EN: Login
  AR: تسجيل الدخول

Key: auth.login.link
  EN: Link
  AR: تسجيل الدخول

Key: auth.login.no_account
  EN: No Account
  AR: ليس لديك حساب؟

Key: auth.login.submit
  EN: Submit
  AR: تسجيل الدخول

Key: auth.login.subtitle
  EN: Subtitle
  AR: تسجيل الدخول لعرض لوحة التحكم.

Key: auth.login.title
  EN: Title
  AR: مرحباً بعودتك

Key: auth.logout
  EN: Logout
  AR: تسجيل الخروج

Key: auth.name
  EN: Name
  AR: الاسم الكامل

Key: auth.name.placeholder
  EN: Placeholder
  AR: اكتب اسمك

Key: auth.password
  EN: Password
  AR: كلمة المرور

Key: auth.phone
  EN: Phone
  AR: رقم الهاتف

Key: auth.register
  EN: Register
  AR: تسجيل حساب

Key: auth.role.select
  EN: Select
  AR: أريد...

Key: auth.sign_out
  EN: Sign Out
  AR: تسجيل الخروج

Key: auth.signin
  EN: Signin
  AR: تسجيل الدخول

Key: auth.signup
  EN: Signup
  AR: تسجيل

Key: auth.signup.has_account
  EN: Has Account
  AR: لديك حساب بالفعل؟

Key: auth.signup.link
  EN: Link
  AR: سجل الآن

Key: auth.signup.submit
  EN: Submit
  AR: إنشاء الحساب

Key: auth.signup.subtitle
  EN: Subtitle
  AR: انضم إلى النظام اليوم.

Key: auth.signup.title
  EN: Title
  AR: إنشاء حساب

Key: auth.system.error
  EN: Error
  AR: تنبيه النظام: خدمة المصادقة غير متاحة.

Key: auth.unauthorized
  EN: Unauthorized
  AR: غير مصرح

Key: auth.verification
  EN: Verification
  AR: التحقق

Key: auth.verified
  EN: Verified
  AR: تم التحقق

Key: autopilot.action.approve
  EN: Approve & Execute
  AR: موافقة وتنفيذ

Key: autopilot.action.reject
  EN: Reject Plan
  AR: رفض الخطة

Key: autopilot.action_history
  EN: Action History
  AR: سجل الإجراءات

Key: autopilot.agent.communication
  EN: Communication Agent
  AR: وكيل التواصل

Key: autopilot.agent.maintenance
  EN: Maintenance Agent
  AR: وكيل الصيانة

Key: autopilot.agent.rental
  EN: Rental Agent
  AR: وكيل التأجير

Key: autopilot.approve
  EN: Approve Action
  AR: الموافقة على الإجراء

Key: autopilot.automation_rules
  EN: Automation Rules
  AR: قواعد الأتمتة

Key: autopilot.level.assisted
  EN: Assisted
  AR: مُساعد

Key: autopilot.level.auto_execute
  EN: Auto Execute (Low Risk)
  AR: تنفيذ تلقائي (منخفض المخاطر)

Key: autopilot.level.auto_prepare
  EN: Auto Prepare
  AR: تجهيز تلقائي

Key: autopilot.level.manual
  EN: Manual Only
  AR: يدوي فقط

Key: autopilot.level.recommend
  EN: Recommend Only
  AR: توصية فقط

Key: autopilot.pending_approvals
  EN: Pending Approvals
  AR: الموافقات المعلقة

Key: autopilot.reject
  EN: Reject
  AR: رفض

Key: autopilot.risk.critical
  EN: Critical
  AR: حرج

Key: autopilot.risk.high
  EN: High Risk
  AR: مخاطرة عالية

Key: autopilot.risk.low
  EN: Low Risk
  AR: مخاطرة منخفضة

Key: autopilot.risk.medium
  EN: Medium Risk
  AR: مخاطرة متوسطة

Key: autopilot.status.blocked
  EN: Blocked by Policy
  AR: محظور بواسطة السياسة

Key: autopilot.status.completed
  EN: Completed
  AR: مكتمل

Key: autopilot.status.executing
  EN: Executing
  AR: قيد التنفيذ

Key: autopilot.status.pending_approval
  EN: Pending Approval
  AR: في انتظار الموافقة

Key: autopilot.status.proposed
  EN: Proposed
  AR: مقترح

Key: autopilot.subtitle
  EN: Governed AI Automation & Decision Assistance
  AR: أتمتة الذكاء الاصطناعي والمساعدة في اتخاذ القرار

Key: autopilot.title
  EN: Property Autopilot
  AR: الطيار الآلي للعقارات

Key: buyer.title
  EN: Title
  AR: مساحة عمل المشتري

Key: buyer.workspace
  EN: Buyer Home
  AR: الرئيسية للمشتري

Key: company.agreements
  EN: Agreements
  AR: اتفاقيات الإدارة

Key: company.all_caught_up
  EN: All Caught Up
  AR: لا يوجد شيء جديد

Key: company.approvals
  EN: Approvals
  AR: الموافقات

Key: company.assigned_properties
  EN: Assigned Properties
  AR: العقارات المعينة

Key: company.crm_expansion
  EN: Crm Expansion
  AR: هذه الميزة ستتوفر في توسعة إدارة علاقات العملاء.

Key: company.dashboard
  EN: Dashboard
  AR: لوحة تحكم الشركة

Key: company.dashboard.desc
  EN: Desc
  AR: إدارة المحفظة والمهام والفريق.

Key: company.finance_expansion
  EN: Finance Expansion
  AR: هذه الميزة ستتوفر في القسم المالي.

Key: company.financial_suite
  EN: Financial Suite
  AR: القسم المالي

Key: company.invite
  EN: Invite
  AR: دعوة عضو

Key: company.invite_member
  EN: Invite Member
  AR: دعوة عضو

Key: company.invite_owner
  EN: Invite Owner
  AR: دعوة مالك عقار

Key: company.leads_market
  EN: Leads Market
  AR: العملاء المحتملون والسوق

Key: company.leases
  EN: Leases
  AR: العقود

Key: company.maintenance
  EN: Maintenance
  AR: الصيانة

Key: company.manage_team
  EN: Manage Team
  AR: إدارة فريقك

Key: company.managed_owners
  EN: Managed Owners
  AR: الملاك تحت الإدارة

Key: company.managed_properties
  EN: Managed Properties
  AR: العقارات المدارة

Key: company.management
  EN: Management
  AR: إدارة الشركة

Key: company.my_tasks
  EN: My Tasks
  AR: مهامي

Key: company.needs_attention
  EN: Needs Attention
  AR: يحتاج انتباه

Key: company.no_approvals
  EN: No Approvals
  AR: لا توجد موافقات معلقة في محفظتك.

Key: company.no_owners
  EN: No Owners
  AR: لا توجد لديك اتفاقيات إدارة فعالة مع أي مالك عقار.

Key: company.no_owners_title
  EN: No Owners Title
  AR: لم يتم العثور على ملاك

Key: company.no_properties
  EN: No Properties
  AR: لم يتم تعيين أي عقارات لك بعد.

Key: company.no_properties_title
  EN: No Properties Title
  AR: لم يتم العثور على عقارات

Key: company.no_tasks
  EN: No Tasks
  AR: لم يتم تعيين أي مهام لك حالياً.

Key: company.no_urgent
  EN: No Urgent
  AR: لا توجد مواضيع عاجلة تتطلب الانتباه.

Key: company.pending_approvals
  EN: Pending Approvals
  AR: الموافقات المعلقة

Key: company.profile
  EN: Profile
  AR: ملف الشركة

Key: company.roles_permissions
  EN: Roles & Permissions
  AR: الأدوار والصلاحيات

Key: company.stats.approvals
  EN: Approvals
  AR: الموافقات

Key: company.stats.owners
  EN: Owners
  AR: الملاك

Key: company.stats.properties
  EN: Properties
  AR: العقارات

Key: company.stats.tasks
  EN: Tasks
  AR: المهام

Key: company.team
  EN: Team Members
  AR: أعضاء الفريق

Key: company.team_desc
  EN: Team Desc
  AR: تعيين العقارات وتحديد الأدوار (مدير، وكيل).

Key: company.team_members
  EN: Team Members
  AR: أعضاء فريق الشركة

Key: company.tenants
  EN: Tenants
  AR: المستأجرون

Key: company.view_all
  EN: View All
  AR: عرض الكل

Key: company.workspace
  EN: Workspace
  AR: مساحة عمل الشركة

Key: contract.center
  EN: Contracts & Signatures
  AR: العقود والتوقيعات

Key: contract.status.pending_signature
  EN: Pending Signature
  AR: في انتظار التوقيع

Key: contract.status.signed
  EN: Signed
  AR: موقع

Key: core.actions
  EN: Actions
  AR: الإجراءات

Key: core.dashboard
  EN: Dashboard
  AR: لوحة القيادة

Key: core.details
  EN: Details
  AR: التفاصيل

Key: core.ecosystem
  EN: Ecosystem
  AR: نظام العقارات البيئي

Key: core.filter
  EN: Filter
  AR: تصفية

Key: core.history
  EN: History
  AR: السجل

Key: core.more
  EN: More
  AR: المزيد

Key: core.notes
  EN: Notes
  AR: ملاحظات

Key: core.overview
  EN: Overview
  AR: نظرة عامة

Key: core.platform
  EN: Platform
  AR: منصة العقارات

Key: core.properties
  EN: Properties
  AR: العقارات

Key: core.property
  EN: Property
  AR: عقار

Key: core.real_estate
  EN: Real Estate
  AR: العقارات

Key: core.search
  EN: Search
  AR: بحث

Key: core.status
  EN: Status
  AR: الحالة

Key: core.workspace
  EN: Workspace
  AR: مساحة العمل

Key: crm.ai_draft
  EN: Draft with AI
  AR: صياغة بواسطة الذكاء الاصطناعي

Key: crm.contacts
  EN: Contacts
  AR: جهات الاتصال

Key: crm.conversations
  EN: Conversations
  AR: المحادثات

Key: crm.follow_ups
  EN: Follow-ups
  AR: المتابعات

Key: crm.inbox
  EN: Secure Inbox
  AR: صندوق الوارد الآمن

Key: crm.leads
  EN: My Leads
  AR: عملائي المحتملين

Key: crm.send_message
  EN: Send Message
  AR: إرسال رسالة

Key: crm.status.contacted
  EN: Contacted
  AR: تم التواصل

Key: crm.status.new
  EN: New Lead
  AR: عميل جديد

Key: crm.title
  EN: Title
  AR: إدارة علاقات العملاء والسوق

Key: currency.iqd
  EN: Iqd
  AR: دينار عراقي

Key: document.center
  EN: Document Center
  AR: مركز المستندات

Key: document.floor_plan
  EN: Floor Plan
  AR: مخطط الطابق

Key: document.previous_lease
  EN: Previous Lease
  AR: عقد الإيجار السابق (منتهي)

Key: document.title_deed
  EN: Title Deed
  AR: سند الملكية (موثق)

Key: document.upload
  EN: Upload Document
  AR: رفع مستند

Key: document.verified
  EN: Verified Document
  AR: مستند موثق

Key: finance.amount
  EN: Amount
  AR: المبلغ

Key: finance.chart_of_accounts
  EN: Chart of Accounts
  AR: دليل الحسابات

Key: finance.deposit
  EN: Deposit
  AR: التأمين

Key: finance.expense
  EN: Expense
  AR: المصروفات

Key: finance.expenses
  EN: Expenses
  AR: المصروفات

Key: finance.invoices
  EN: Invoices
  AR: الفواتير

Key: finance.journal
  EN: Journal Entries
  AR: قيود اليومية

Key: finance.ledger
  EN: General Ledger
  AR: دفتر الأستاذ العام

Key: finance.payment
  EN: Payment
  AR: الدفع

Key: finance.payments
  EN: Payments
  AR: المدفوعات

Key: finance.post_entry
  EN: Post Journal Entry
  AR: ترحيل قيد يومية

Key: finance.receipt
  EN: Receipt
  AR: الإيصال

Key: finance.reconciliation
  EN: Reconciliation
  AR: المطابقة

Key: finance.refund
  EN: Refund
  AR: استرداد

Key: finance.rent
  EN: Rent
  AR: الإيجار

Key: finance.reports
  EN: Financial Reports
  AR: التقارير المالية

Key: finance.revenue
  EN: Revenue
  AR: الإيرادات

Key: finance.status.posted
  EN: Posted
  AR: مُرحل

Key: finance.status.unbalanced
  EN: Unbalanced
  AR: غير متوازن

Key: finance.total
  EN: Total
  AR: المجموع

Key: form.company_name
  EN: Company Name
  AR: الاسم القانوني للشركة

Key: form.email
  EN: Email
  AR: البريد الإلكتروني للعمل

Key: form.employees
  EN: Employees
  AR: موظف

Key: form.phone
  EN: Phone
  AR: هاتف العمل

Key: form.reg_number
  EN: Reg Number
  AR: رقم الترخيص / التسجيل

Key: form.service_area
  EN: Service Area
  AR: منطقة الخدمة الرئيسية

Key: form.team_size
  EN: Team Size
  AR: حجم الفريق

Key: integration.capability_label
  EN: Capability Label
  AR: القدرة:

Key: integration.configure_keys
  EN: Configure Keys
  AR: تهيئة المفاتيح

Key: integration.configured
  EN: Configured
  AR: مهيأ

Key: integration.email_notif
  EN: Email Notif
  AR: إشعارات البريد الإلكتروني

Key: integration.esignature
  EN: Esignature
  AR: التوقيع الإلكتروني

Key: integration.fallback_message
  EN: This service is currently unavailable or not configured. Please contact administration.
  AR: هذه الخدمة غير متاحة حالياً أو غير مهيأة. يرجى الاتصال بالإدارة.

Key: integration.healthy
  EN: Healthy
  AR: سليم

Key: integration.manage_settings
  EN: Manage Settings
  AR: إدارة الإعدادات

Key: integration.not_configured
  EN: Not Configured
  AR: غير مهيأ

Key: integration.payment
  EN: Payment Gateway
  AR: بوابة الدفع

Key: integration.providers
  EN: Providers
  AR: مقدمو الخدمات

Key: integration.safe_paused_long
  EN: Safe Paused Long
  AR: تم إيقاف العمليات المعتمدة على هذا المزود بشكل آمن. لم يتم فقدان أي بيانات.

Key: integration.sms_provider
  EN: Sms Provider
  AR: مزود الرسائل القصيرة

Key: integration.storage
  EN: Secure Storage
  AR: التخزين الآمن

Key: integration.subtitle
  EN: Subtitle
  AR: البنية التحتية ومقدمو الخدمات الخارجيون

Key: integration.title
  EN: Integrations & Providers
  AR: التكاملات ومقدمو الخدمات

Key: integration.unavailable
  EN: Unavailable
  AR: غير متاح

Key: integration.webhooks
  EN: Webhook Events
  AR: أحداث Webhook

Key: intelligence.accept
  EN: Accept & Execute
  AR: قبول وتنفيذ

Key: intelligence.ai
  EN: AI INTERPRETATION
  AR: تحليل الذكاء الاصطناعي

Key: intelligence.data_quality
  EN: Data Quality
  AR: جودة البيانات

Key: intelligence.forecast
  EN: FORECAST
  AR: توقع

Key: intelligence.metric
  EN: CALCULATED
  AR: محسوب

Key: intelligence.metrics
  EN: Metrics & Forecasts
  AR: المقاييس والتوقعات

Key: intelligence.observed
  EN: OBSERVED FACT
  AR: حقيقة مرصودة

Key: intelligence.recommendations
  EN: AI Recommendations
  AR: توصيات الذكاء الاصطناعي

Key: intelligence.reject
  EN: Dismiss
  AR: تجاهل

Key: intelligence.title
  EN: Company Intelligence
  AR: ذكاء الشركة

Key: lease.agreement
  EN: Agreement
  AR: اتفاقية عقد الإيجار

Key: lease.due_date
  EN: Due Date
  AR: تاريخ الاستحقاق

Key: lease.renewal
  EN: Renewal
  AR: تجديد العقد

Key: lease.rent_amount
  EN: Rent Amount
  AR: مبلغ الإيجار

Key: lease.status.active
  EN: Active
  AR: نشط

Key: lease.term
  EN: Term
  AR: مدة العقد

Key: maintenance.active_wos
  EN: Active Wos
  AR: أوامر العمل النشطة

Key: maintenance.approve_quote
  EN: Approve Quote
  AR: الموافقة على عرض السعر

Key: maintenance.approve_wo
  EN: Approve Wo
  AR: الموافقة وإنشاء أمر العمل

Key: maintenance.assigned_vendor
  EN: Assigned Vendor
  AR: الفني المعين:

Key: maintenance.cancel_request
  EN: Cancel Request
  AR: إلغاء الطلب

Key: maintenance.control_center
  EN: Control Center
  AR: مركز تحكم الصيانة

Key: maintenance.details_actions
  EN: Details Actions
  AR: التفاصيل والإجراءات

Key: maintenance.emergency
  EN: Emergency
  AR: طوارئ

Key: maintenance.error.approve
  EN: Approve
  AR: تعذر الموافقة على عرض السعر

Key: maintenance.error.fetch
  EN: Fetch
  AR: تعذر جلب قائمة الانتظار

Key: maintenance.issue
  EN: Issue
  AR: المشكلة

Key: maintenance.manage_schedule
  EN: Manage Schedule
  AR: إدارة الجدول الزمني

Key: maintenance.no_requests
  EN: No Requests
  AR: لا توجد طلبات صيانة نشطة حالياً.

Key: maintenance.pending_quotes
  EN: Pending Quotes
  AR: عروض الأسعار المعلقة

Key: maintenance.priority
  EN: Priority
  AR: الأولوية

Key: maintenance.queue_empty
  EN: Queue Empty
  AR: قائمة الانتظار فارغة

Key: maintenance.quotes
  EN: My Quotes
  AR: عروضي

Key: maintenance.request
  EN: Request
  AR: طلب صيانة

Key: maintenance.requests
  EN: Work Requests
  AR: طلبات العمل

Key: maintenance.review_quote
  EN: Review Quote
  AR: مراجعة عرض السعر

Key: maintenance.schedule
  EN: Schedule Work
  AR: جدولة العمل

Key: maintenance.status.assigned
  EN: Assigned
  AR: مُعين

Key: maintenance.status.completed
  EN: Completed
  AR: مكتمل

Key: maintenance.status.in_progress
  EN: In Progress
  AR: قيد التنفيذ

Key: maintenance.status.quote_required
  EN: Quote Required
  AR: مطلوب عرض سعر

Key: maintenance.submit_quote
  EN: Submit Quote
  AR: تقديم عرض سعر

Key: maintenance.subtitle
  EN: Subtitle
  AR: إدارة أوامر العمل وفرز الطلبات ومراجعة عروض الأسعار

Key: maintenance.title
  EN: Title
  AR: الصيانة

Key: maintenance.triage
  EN: Triage
  AR: فرز / تحديد الأولويات

Key: maintenance.view_work_order
  EN: View Work Order
  AR: عرض أمر العمل

Key: maintenance.wo
  EN: Wo
  AR: أمر العمل:

Key: maintenance.work_orders
  EN: Work Orders
  AR: أوامر العمل

Key: marketplace.bedrooms
  EN: Bedrooms
  AR: غرف النوم

Key: marketplace.filters
  EN: Filters
  AR: التصفيات

Key: marketplace.for_rent
  EN: For Rent
  AR: للإيجار

Key: marketplace.for_sale
  EN: For Sale
  AR: للبيع

Key: marketplace.price_range
  EN: Price Range
  AR: نطاق السعر

Key: marketplace.search
  EN: Search Properties
  AR: البحث عن عقارات

Key: marketplace.title
  EN: Title
  AR: سوق العقارات

Key: nav.dashboard
  EN: Dashboard
  AR: لوحة القيادة

Key: nav.finance
  EN: Finance
  AR: المالية

Key: nav.home
  EN: Home
  AR: الرئيسية

Key: nav.leads
  EN: Leads
  AR: العملاء المحتملين

Key: nav.marketplace
  EN: Marketplace
  AR: السوق

Key: nav.operations
  EN: Operations
  AR: العمليات

Key: nav.operations_short
  EN: Operations Short
  AR: العمليات

Key: nav.owners
  EN: Owners
  AR: الملاك

Key: nav.portfolio
  EN: Portfolio
  AR: المحفظة

Key: nav.properties
  EN: Properties
  AR: العقارات

Key: nav.properties_short
  EN: Properties Short
  AR: العقارات

Key: nav.team
  EN: Team
  AR: الفريق

Key: offer.status.accepted
  EN: Offer Accepted
  AR: تم قبول العرض

Key: offer.status.submitted
  EN: Offer Submitted
  AR: تم تقديم العرض

Key: onboard.company.doc_license
  EN: Doc License
  AR: رفع رخصة العمل

Key: onboard.company.doc_skip
  EN: Doc Skip
  AR: تم التخطي لبيئة الاختبار

Key: onboard.company.profile
  EN: Profile
  AR: ملف الشركة

Key: onboard.company.services
  EN: Services
  AR: الخدمات والمناطق

Key: onboard.company.subtitle
  EN: Subtitle
  AR: سجل شركة الإدارة الخاصة بك لبدء إدارة العقارات.

Key: onboard.company.title
  EN: Title
  AR: إعداد الشركة

Key: onboard.company.verification_notice
  EN: Verification Notice
  AR: خدمات KYC/KYB الخارجية معلقة حالياً. سيتم الموافقة على التحقق تلقائياً لأغراض الاختبار.

Key: onboard.company.welcome
  EN: Welcome
  AR: مرحباً في بيئة العمل الاحترافية

Key: onboard.company.welcome_desc
  EN: Welcome Desc
  AR: قم بإعداد ملف شركتك لدعوة أعضاء الفريق والملاك وإدارة العقارات بكفاءة.

Key: onboard.review
  EN: Review
  AR: المراجعة

Key: onboard.verification
  EN: Verification
  AR: التحقق

Key: onboard.welcome
  EN: Welcome
  AR: مرحباً

Key: owner.approvals
  EN: Pending Approvals
  AR: الموافقات المعلقة

Key: owner.invite_company
  EN: Invite Company
  AR: دعوة شركة

Key: owner.management_companies
  EN: Management Companies
  AR: شركات الإدارة

Key: owner.my_properties
  EN: My Properties
  AR: عقاراتي

Key: owner.performance
  EN: Performance
  AR: أداء المحفظة

Key: owner.portfolio_properties
  EN: Portfolio Properties
  AR: عقارات المحفظة

Key: owner.revenue_vs_expenses
  EN: Revenue Vs Expenses
  AR: الإيرادات مقابل المصاريف

Key: owner.stats.revenue
  EN: Revenue
  AR: إجمالي الإيرادات

Key: owner.stats.spend
  EN: Spend
  AR: مصاريف الصيانة

Key: owner.stats.units
  EN: Units
  AR: الوحدات النشطة

Key: owner.stats.value
  EN: Value
  AR: إجمالي قيمة المحفظة

Key: owner.workspace
  EN: Owner Portfolio
  AR: محفظة المالك

Key: owner.workspace.subtitle
  EN: Subtitle
  AR: ذكاء العقارات وصحة المحفظة والتحليلات المالية.

Key: passport.subtitle
  EN: Digital Property Record & Identity
  AR: السجل الرقمي والهوية للعقار

Key: passport.title
  EN: Property Passport
  AR: جواز سفر العقار

Key: platform.name
  EN: Real Estate Platform
  AR: منصة العقارات

Key: portfolio.active_units
  EN: Active Units
  AR: الوحدات النشطة

Key: portfolio.annual_yield
  EN: Annual Yield
  AR: العائد السنوي

Key: portfolio.foundation_msg
  EN: Foundation Msg
  AR: مركز التحليلات وإدارة المحفظة

Key: portfolio.subtitle
  EN: Subtitle
  AR: أداء الأصول ونظرة عامة على الاستثمار

Key: portfolio.title
  EN: Title
  AR: تحليلات المحفظة

Key: portfolio.total_asset_value
  EN: Total Asset Value
  AR: إجمالي قيمة الأصول

Key: portfolio.vacancy_rate
  EN: Vacancy Rate
  AR: معدل الشغور

Key: property.add.subtitle
  EN: Register a new property into the portfolio.
  AR: تسجيل عقار جديد في المحفظة.

Key: property.add_new
  EN: Add New Property
  AR: إضافة عقار جديد

Key: property.address
  EN: Address
  AR: عنوان العقار

Key: property.amenities
  EN: Amenities
  AR: المرافق والميزات

Key: property.apartment
  EN: Apartment
  AR: شقة

Key: property.basic_info
  EN: Basic Info
  AR: المعلومات الأساسية

Key: property.beds_baths
  EN: Beds Baths
  AR: غرف نوم / حمامات

Key: property.command_center
  EN: Command Center
  AR: مركز القيادة

Key: property.commercial
  EN: Commercial
  AR: عقار تجاري

Key: property.details
  EN: Details
  AR: التفاصيل

Key: property.documents
  EN: Documents
  AR: المستندات

Key: property.error.fetch
  EN: Fetch
  AR: تعذر الحصول على بيانات العقار

Key: property.features
  EN: Features
  AR: المميزات

Key: property.health
  EN: Health
  AR: صحة العقار

Key: property.house
  EN: House
  AR: منزل

Key: property.loading
  EN: Loading
  AR: جاري تحميل تفاصيل العقار...

Key: property.location
  EN: Location
  AR: الموقع

Key: property.maintenance
  EN: Maintenance
  AR: الصيانة

Key: property.maintenance.triage
  EN: Triage Required
  AR: يتطلب الفرز

Key: property.name
  EN: Name
  AR: اسم العقار

Key: property.no_address
  EN: No Address
  AR: لم يتم تقديم العنوان

Key: property.no_maintenance
  EN: No Maintenance
  AR: لا توجد طلبات صيانة نشطة.

Key: property.not_found
  EN: Not Found
  AR: العقار غير موجود.

Key: property.offer.submit
  EN: Submit Offer
  AR: تقديم عرض

Key: property.onboarding.submit
  EN: Submit for Verification
  AR: إرسال للتحقق

Key: property.onboarding.title
  EN: Add New Property
  AR: إضافة عقار جديد

Key: property.overview
  EN: Overview
  AR: نظرة عامة

Key: property.ownership
  EN: Ownership
  AR: الملكية

Key: property.ownership.label
  EN: Label
  AR: الملكية

Key: property.ownership.verified
  EN: Verified
  AR: موثقة (100% حصة)

Key: property.passport
  EN: Passport
  AR: جواز سفر العقار

Key: property.portfolio
  EN: Portfolio
  AR: محفظة العقارات

Key: property.review
  EN: Review
  AR: المراجعة

Key: property.size
  EN: Size
  AR: المساحة

Key: property.sqm
  EN: Sqm
  AR: متر مربع

Key: property.status.active
  EN: Active
  AR: نشط

Key: property.status.draft
  EN: Draft
  AR: مسودة

Key: property.status.occupied
  EN: Occupied
  AR: مشغول

Key: property.status.pending
  EN: Pending
  AR: قيد الانتظار

Key: property.status.vacant
  EN: Vacant
  AR: شاغر

Key: property.status.verified
  EN: Verified
  AR: تم التحقق

Key: property.status_vacant
  EN: Status Vacant
  AR: شاغر

Key: property.tasks
  EN: Tasks
  AR: المهام

Key: property.timeline
  EN: Timeline
  AR: الجدول الزمني

Key: property.type
  EN: Type
  AR: النوع

Key: property.type.apartment
  EN: Apartment Building
  AR: بناية شقق

Key: property.type.apartment_short
  EN: Apartment Short
  AR: شقة

Key: property.type.commercial
  EN: Commercial
  AR: عقار تجاري

Key: property.type.commercial_short
  EN: Commercial Short
  AR: تجاري

Key: property.type.industrial
  EN: Industrial
  AR: عقار صناعي

Key: property.type.industrial_short
  EN: Industrial Short
  AR: صناعي

Key: property.type.label
  EN: Label
  AR: نوع العقار

Key: property.type.question
  EN: What type of property is this?
  AR: ما نوع هذا العقار؟

Key: property.type.villa
  EN: Villa / House
  AR: فيلا / منزل

Key: property.type.villa_short
  EN: Villa Short
  AR: فيلا

Key: property.unit
  EN: Unit
  AR: الوحدة

Key: property.units
  EN: Units
  AR: الوحدات

Key: property.unknown
  EN: Unknown
  AR: غير معروف

Key: property.unnamed
  EN: Unnamed
  AR: عقار بدون اسم

Key: property.viewing.request
  EN: Request Viewing
  AR: طلب معاينة

Key: property.villa
  EN: Villa
  AR: فيلا

Key: rent.status.overdue
  EN: Overdue
  AR: متأخر

Key: rent.status.upcoming
  EN: Upcoming
  AR: قادم

Key: role.accountant
  EN: Accountant
  AR: محاسب

Key: role.admin
  EN: Platform Admin
  AR: مدير المنصة

Key: role.agent
  EN: Agent
  AR: وسيط عقاري

Key: role.buyer
  EN: Buyer
  AR: مشتري

Key: role.company
  EN: Management Company
  AR: شركة إدارة

Key: role.manager
  EN: Manager
  AR: مدير

Key: role.owner
  EN: Property Owner
  AR: مالك العقار

Key: role.platform_admin
  EN: Platform Admin
  AR: مدير المنصة

Key: role.tenant
  EN: Tenant
  AR: مستأجر

Key: role.vendor
  EN: Service Vendor
  AR: مقاول خدمات

Key: role.vendor.desc
  EN: Desc
  AR: الصيانة والمقاولات

Key: status.active
  EN: Active
  AR: نشط

Key: status.approved
  EN: Approved
  AR: تمت الموافقة

Key: status.cancelled
  EN: Cancelled
  AR: ملغي

Key: status.completed
  EN: Completed
  AR: مكتمل

Key: status.completed_text
  EN: Completed Text
  AR: مكتمل

Key: status.critical_text
  EN: Critical Text
  AR: حرج

Key: status.draft
  EN: Draft
  AR: مسودة

Key: status.expired
  EN: Expired
  AR: منتهي الصلاحية

Key: status.failed
  EN: Failed
  AR: فشل

Key: status.high_text
  EN: High Text
  AR: عالي

Key: status.in_progress
  EN: In Progress
  AR: قيد التنفيذ

Key: status.inactive
  EN: Inactive
  AR: غير نشط

Key: status.loading
  EN: Loading...
  AR: جاري التحميل...

Key: status.low_text
  EN: Low Text
  AR: منخفض

Key: status.medium_text
  EN: Medium Text
  AR: متوسط

Key: status.new_request
  EN: New Request
  AR: طلب جديد

Key: status.notice
  EN: Notice
  AR: تنبيه

Key: status.pending
  EN: Pending
  AR: معلق

Key: status.pending_approval
  EN: Pending Approval
  AR: في انتظار الموافقة

Key: status.pending_verification
  EN: Pending Verification
  AR: في انتظار التحقق

Key: status.quote_ready
  EN: Quote Ready
  AR: عرض السعر جاهز

Key: status.rejected
  EN: Rejected
  AR: مرفوض

Key: status.saving
  EN: Saving
  AR: جاري الحفظ...

Key: status.suspended
  EN: Suspended
  AR: موقوف

Key: status.triaged
  EN: Triaged
  AR: تم الفرز

Key: status.triaged_text
  EN: Triaged Text
  AR: تم الفرز

Key: status.unavailable
  EN: Unavailable
  AR: غير متاح

Key: status.work_order
  EN: Work Order
  AR: أمر العمل

Key: status.work_order_created
  EN: Work Order Created
  AR: تم إنشاء أمر عمل

Key: tenant.action_required
  EN: Action Required
  AR: مطلوب إجراء لدورة الدفع الحالية

Key: tenant.application
  EN: Application
  AR: طلب المستأجر

Key: tenant.due
  EN: Due
  AR: المستحق:

Key: tenant.error.lease
  EN: Lease
  AR: تعذر الحصول على تفاصيل العقد

Key: tenant.maintenance_request
  EN: Request Maintenance
  AR: طلب صيانة

Key: tenant.mock.paid
  EN: Paid
  AR: تم الدفع

Key: tenant.mock.rent
  EN: Rent
  AR: إيجار هذا الشهر

Key: tenant.my_home
  EN: My Home
  AR: منزلي

Key: tenant.my_lease
  EN: My Lease
  AR: عقد الإيجار الخاص بي

Key: tenant.next_cycle
  EN: Next Cycle
  AR: الدورة القادمة

Key: tenant.no_lease
  EN: No Lease
  AR: ليس لديك عقد نشط حالياً.

Key: tenant.pay_now
  EN: Pay Now (Record)
  AR: ادفع الآن (تسجيل)

Key: tenant.payment_history
  EN: Payment History
  AR: سجل المدفوعات

Key: tenant.profile
  EN: Profile
  AR: ملف المستأجر

Key: tenant.rent_due
  EN: Rent Due
  AR: الإيجار المستحق

Key: tenant.workspace
  EN: Tenant Home
  AR: الرئيسية للمستأجر

Key: time.aug
  EN: Aug
  AR: أغسطس

Key: time.date
  EN: Date
  AR: التاريخ

Key: time.jul
  EN: Jul
  AR: يوليو

Key: time.jun
  EN: Jun
  AR: يونيو

Key: time.may
  EN: May
  AR: مايو

Key: time.oct
  EN: Oct
  AR: أكتوبر

Key: time.sep
  EN: Sep
  AR: سبتمبر

Key: time.today
  EN: Today
  AR: اليوم

Key: time.tomorrow
  EN: Tomorrow
  AR: غداً

Key: time.yesterday
  EN: Yesterday
  AR: أمس

Key: timeline.acquired
  EN: Acquired
  AR: تم شراء العقار

Key: timeline.title
  EN: Property Timeline
  AR: الجدول الزمني للعقار

Key: timeline.verified
  EN: Verified
  AR: تم التحقق من الملكية

Key: trust.action.escalate
  EN: Escalate
  AR: تصعيد

Key: trust.disputes
  EN: Active Disputes
  AR: النزاعات النشطة

Key: trust.risk_signals
  EN: Risk Signals
  AR: إشارات الخطر

Key: trust.status.pending
  EN: Under Review
  AR: قيد المراجعة

Key: trust.status.suspended
  EN: Suspended
  AR: موقوف

Key: trust.status.verified
  EN: Verified
  AR: موثق

Key: trust.title
  EN: Trust & Security Center
  AR: مركز الثقة والأمان

Key: trust.verifications
  EN: Verifications
  AR: التحققات

Key: ui.empty
  EN: Empty
  AR: فارغ

Key: ui.error
  EN: Error
  AR: خطأ

Key: ui.error_loading
  EN: Error Loading
  AR: خطأ في التحميل: 

Key: ui.feature_unavailable
  EN: Feature Unavailable
  AR: هذه الميزة غير متاحة حالياً أو قيد التكامل.

Key: ui.loading
  EN: Loading
  AR: جاري التحميل...

Key: ui.loading_details
  EN: Loading Details
  AR: جاري تحميل التفاصيل...

Key: ui.module_not_configured
  EN: Module Not Configured
  AR: هذه الوحدة لم تتم تهيئتها بالكامل مع مصادر البيانات الحقيقية بعد.

Key: ui.no_data
  EN: No Data
  AR: لا توجد بيانات متاحة

Key: ui.no_properties
  EN: No Properties
  AR: لم يتم العثور على عقارات في محفظتك.

Key: ui.no_results
  EN: No Results
  AR: لم يتم العثور على نتائج

Key: ui.success
  EN: Success
  AR: نجاح

Key: ui.try_again
  EN: Try Again
  AR: حاول مرة أخرى

Key: vendor.all_caught_up
  EN: All Caught Up
  AR: لا توجد أوامر عمل جديدة

Key: vendor.assigned_title
  EN: Assigned Title
  AR: أوامر العمل المعينة

Key: vendor.dashboard_subtitle
  EN: Dashboard Subtitle
  AR: إدارة طلبات الخدمة وعروض الأسعار وأوامر العمل.

Key: vendor.dashboard_title
  EN: Dashboard Title
  AR: لوحة تحكم الفني

Key: vendor.duration_placeholder
  EN: Duration Placeholder
  AR: مثال: يومين

Key: vendor.error.fetch
  EN: Fetch
  AR: تعذر الحصول على الطلبات المحددة

Key: vendor.estimated_duration
  EN: Estimated Duration
  AR: المدة المقدرة

Key: vendor.failed_quote
  EN: Failed Quote
  AR: فشل في تقديم عرض السعر

Key: vendor.fees
  EN: Fees
  AR: رسوم إضافية

Key: vendor.id
  EN: Id
  AR: رقم الفني:

Key: vendor.labor_cost
  EN: Labor Cost
  AR: تكلفة العمالة

Key: vendor.loading_assignments
  EN: Loading Assignments
  AR: جاري تحميل أوامر العمل...

Key: vendor.mark_completed
  EN: Mark Completed
  AR: وضع علامة مكتمل

Key: vendor.material_cost
  EN: Material Cost
  AR: تكلفة المواد

Key: vendor.no_assignments
  EN: No Assignments
  AR: لا توجد مهام معينة

Key: vendor.no_requests
  EN: No Requests
  AR: ليس لديك طلبات صيانة نشطة حالياً.

Key: vendor.notes_placeholder
  EN: Notes Placeholder
  AR: تفاصيل إضافية...

Key: vendor.profile
  EN: Profile
  AR: ملف الفني

Key: vendor.quote
  EN: Quote
  AR: عرض السعر

Key: vendor.refresh
  EN: Refresh
  AR: تحديث

Key: vendor.submit_quote
  EN: Submit Quote
  AR: تقديم عرض سعر

Key: vendor.total
  EN: Total
  AR: إجمالي العرض

Key: vendor.workspace
  EN: Vendor Dashboard
  AR: لوحة تحكم الفني

Key: work_order.title
  EN: Title
  AR: أمر العمل

Key: workspace.context
  EN: Context
  AR: مساحات العمل
`;

// Additional Arabic UI strings for components
const additionalArabicUI = {
  // Navigation & Common
  'Marketplace': 'السوق',
  'Workspace Context': 'مساحات العمل',
  'Buyer': 'مشتري',
  'Accountant': 'محاسب',
  'Maintenance': 'الصيانة',
  'Portfolio': 'المحفظة',
  'Platform Admin': 'مدير المنصة',
  'Integrations': 'التكاملات',
  'AI Autopilot': 'الطيار الآلي الذكي',
  'Total Asset Value': 'إجمالي قيمة الأصول',
  'Annual Yield': 'العائد السنوي',
  'Active Units': 'الوحدات النشطة',
  'Vacancy Rate': 'معدل الشغور',
  'Portfolio Analytics': 'تحليلات المحفظة',
  'Asset performance and investment overview': 'أداء الأصول ونظرة عامة على الاستثمار',
  'Analytics Dashboard rendering foundation': 'أساسيات عرض لوحة تحليلات المحفظة',
  'IQD': 'د.ع',

  // Property Command Center
  'View Details': 'عرض التفاصيل',
  'Today, 10:00 AM': 'اليوم، ١٠:٠٠ ص',
  'Maintenance requested by Company Admin': 'طلب صيانة مقدم من مدير الشركة',
  'Oct 12, 2023': '١٢ أكتوبر ٢٠٢٣',
  'Management Agreement Active': 'اتفاقية الإدارة نشطة',
  'Title Deed (Verified)': 'سند الملكية (موثق)',
  'Floor Plan PDF': 'مخطط الطابق PDF',
  'Previous Lease (Expired)': 'عقد الإيجار السابق (منتهي)',
  'Vacant': 'شاغر',
  'No active maintenance requests.': 'لا توجد طلبات صيانة نشطة.',

  // Integrations Admin Workspace
  'Real-World Infrastructure & External APIs': 'البنية التحتية الحقيقية والواجهات البرمجية الخارجية',
  'Providers': 'مقدمو الخدمات',
  'Recent Webhook Events': 'أحداث الويب هوك الأخيرة',
  'Configure Keys': 'تهيئة المفاتيح',
  'Manage Settings': 'إدارة الإعدادات',
  'EMAIL NOTIFICATIONS': 'إشعارات البريد الإلكتروني',
  'SMS PROVIDER': 'مزود الرسائل النصية القصيرة',
  'E-SIGNATURE': 'التوقيع الإلكتروني',
  'CONFIGURED': 'مهيأ',
  'Signature Validation Active': 'التحقق من التوقيع نشط',
  'Provider': 'المزود',
  'Event Type': 'نوع الحدث',
  'Event ID': 'معرف الحدث',
  'Timestamp': 'الطابع الزمني',
  'INVALID_SIGNATURE': 'توقيع غير صالح',
  'PROCESSED': 'تمت المعالجة',

  // Dev Auth Override & Test Personas
  'Isolated Development Mode': 'وضع التطوير المنعزل',
  'Authentication is not configured. Select a test persona to view the UI.': 'المصادقة غير مهيأة. اختر شخصية اختبار لعرض واجهة المستخدم.',
  'Maintenance Vendor': 'مقاول صيانة',
  'Role:': 'الدور:',

  // Integration Fallback
  'Capability:': 'القدرة:',
  'Operations dependent on this provider have been safely paused. No data has been lost or fabricated.': 'تم إيقاف العمليات المعتمدة على هذا المزود بأمان. لم تفقد أي بيانات.',

  // Tenant Maintenance Request
  'Plumbing': 'السباكة',
  'Electrical': 'الكهرباء',
  'HVAC': 'التكييف والتهوية',
  'Appliances': 'الأجهزة المنزلية',
  'Structural': 'الأبواب والنوافذ والجدران',
  'Pest Control': 'مكافحة الحشرات',
  'Other': 'أخرى',
  'Low': 'منخفض',
  'Medium': 'متوسط',
  'High': 'مرتفع',
  'Emergency': 'طوارئ',
  'Submit Request': 'إرسال الطلب',

  // Add Property Multi-Step Wizard
  'Apartment Building': 'بناية شقق',
  'Villa / House': 'فيلا / منزل',
  'Commercial': 'تجاري',
  'Industrial': 'صناعي',
  'Parking': 'موقف سيارات',
  'Elevator': 'مصعد',
  'Security': 'أمن وحراسة',
  'Gym': 'صالة رياضية',
  'Pool': 'مسبح',
  'Garden': 'حديقة',
  'Balcony': 'شرفة',
  'Smart Home': 'منزل ذكي',

  // Accountant Workspace
  'Total Revenue': 'إجمالي الإيرادات',
  'Total Expenses': 'إجمالي المصروفات',
  'Pending Invoices': 'الفواتير المعلقة',
  'Reconciliation Status': 'حالة المطابقة',
  'Reference No.': 'الرقم المرجعي',
  'Account': 'الحساب',
  'Debit': 'مدين',
  'Credit': 'دائن',
  'Post New Journal Entry': 'ترحيل قيد يومية جديد'
};

const lines = rawCompendium.split('\n');
const parsed = {};
let currentKey = '';
let currentEn = '';
let currentAr = '';

for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed.startsWith('Key: ')) {
    if (currentKey && currentAr) {
      parsed[currentKey] = { en: currentEn, ar: currentAr };
    }
    currentKey = trimmed.replace('Key: ', '').trim();
    currentEn = '';
    currentAr = '';
  } else if (trimmed.startsWith('EN: ')) {
    currentEn = trimmed.replace('EN: ', '').trim();
  } else if (trimmed.startsWith('AR: ')) {
    currentAr = trimmed.replace('AR: ', '').trim();
  }
}
if (currentKey && currentAr) {
  parsed[currentKey] = { en: currentEn, ar: currentAr };
}

console.log('Parsed total keys:', Object.keys(parsed).length);

const arDict = {};
for (const [k, v] of Object.entries(parsed)) {
  arDict[k] = v.ar;
}
Object.assign(arDict, additionalArabicUI);

fs.writeFileSync('scripts/ar_dictionary.json', JSON.stringify(arDict, null, 2));
console.log('Total AR keys generated:', Object.keys(arDict).length);
