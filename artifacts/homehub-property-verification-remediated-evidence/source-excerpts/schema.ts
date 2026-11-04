import { relations, sql } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, jsonb, decimal, varchar, uniqueIndex, index, unique } from 'drizzle-orm/pg-core';

export type SupportedCurrency = 'IQD' | 'USD';
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = ['IQD', 'USD'];

export const users = pgTable('users', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  uid: text('uid').unique(), // For IdP mapping if needed
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  roles: jsonb('roles').$type<string[]>(),
  passwordHash: text('password_hash'),
  failedLoginAttempts: integer('failed_login_attempts').default(0),
  lockedUntil: timestamp('locked_until'),
  tokenVersion: integer('token_version').default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  type: text('type').notNull(),
  taxId: text('tax_id'),
  registrationNumber: text('registration_number'),
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address'),
  serviceArea: text('service_area'),
  serviceCategories: jsonb('service_categories').$type<string[]>(),
  teamSize: text('team_size'),
  spendingLimitDefault: decimal('spending_limit_default'),
  status: text('status').default('PENDING_VERIFICATION'), // DRAFT, PENDING_VERIFICATION, VERIFIED, SUSPENDED, REJECTED, ARCHIVED
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').notNull(),
  status: text('status').default('ACTIVE'), // ACTIVE, SUSPENDED, REMOVED
  assignedPropertyIds: jsonb('assigned_property_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const companyInvitations = pgTable('company_invitations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  companyId: text('company_id').references(() => organizations.id).notNull(),
  invitedByUserId: text('invited_by_user_id').references(() => users.id).notNull(),
  email: text('email').notNull(),
  role: text('role').notNull(), // COMPANY_OWNER, COMPANY_ADMIN, PROPERTY_MANAGER, AGENT, ACCOUNTANT, MAINTENANCE_MANAGER, VIEWER
  assignedPropertyIds: jsonb('assigned_property_ids').$type<string[]>(),
  status: text('status').default('PENDING'), // PENDING, ACCEPTED, REJECTED, CANCELLED, EXPIRED
  expiresAt: text('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const properties = pgTable('properties', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  type: text('type').notNull(),
  address: jsonb('address'),
  yearBuilt: integer('year_built'),
  squareFeet: integer('square_feet'),
  status: text('status').default('PENDING_VERIFICATION'),
  verificationStatus: text('verification_status').default('PENDING_VERIFICATION').notNull(),
  rejectionReason: text('rejection_reason'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: text('verified_by').references(() => users.id),
  managementPreference: text('management_preference').default('SELF_MANAGED').notNull(), // 'SELF_MANAGED' | 'HOMEHUB_MANAGED' | 'AGENT_MANAGED'
  managementArrangementStatus: text('management_arrangement_status').default('NOT_APPLICABLE').notNull(), // 'NOT_APPLICABLE' | 'AWAITING_ONBOARDING' | 'AWAITING_AGREEMENT' | 'ACTIVE' | 'SUSPENDED' | 'TERMINATED'
  healthStatus: text('health_status'),
  acquisitionCost: decimal('acquisition_cost'),
  acquisitionDate: text('acquisition_date'),
  currency: text('currency').default('IQD'),
  rentFee: decimal('rent_fee'),
  managementFee: decimal('management_fee'),
  // Operating model: FULLY_MANAGED | AGENT_LISTED_PLATFORM_MANAGED | AGENT_OPERATED
  operatingModel: text('operating_model'),
  // Who manages day-to-day operations (null = HomeHub/platform)
  managedByAgentId: text('managed_by_agent_id').references(() => organizations.id),
  // Who listed/sourced the tenant (null = HomeHub/platform)
  listedByAgentId: text('listed_by_agent_id').references(() => organizations.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const units = pgTable('units', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitNumber: text('unit_number').notNull(),
  beds: integer('beds'),
  baths: decimal('baths'),
  squareFeet: integer('square_feet'),
  status: text('status').default('VACANT'),
  marketRent: decimal('market_rent'),
  currency: text('currency').default('IQD'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('units_property_unit_unique').on(t.propertyId, t.unitNumber),
]);

export const ownershipRecords = pgTable('ownership_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  ownerId: text('owner_id').references(() => users.id),
  companyId: text('company_id').references(() => organizations.id),
  ownershipPercentage: decimal('ownership_percentage'),
  acquiredDate: text('acquired_date'),
  status: text('status').default('PENDING_VERIFICATION'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const managementAgreements = pgTable('management_agreements', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  companyId: text('company_id').references(() => organizations.id).notNull(),
  ownerId: text('owner_id').references(() => users.id).notNull(),
  status: text('status').default('PENDING'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  grantedPermissions: jsonb('granted_permissions').$type<string[]>(),
  spendingLimit: decimal('spending_limit'),
  approvalRules: jsonb('approval_rules').$type<any>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const leases = pgTable('leases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  status: text('status').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  rentAmount: decimal('rent_amount').notNull(),
  currency: text('currency').default('IQD'),
  depositAmount: decimal('deposit_amount'),
  rentCycle: text('rent_cycle'),
  rentalApplicationId: text('rental_application_id').references(() => rentalApplications.id),
  depositReconciliationStatus: text('deposit_reconciliation_status').default('NOT_EVALUATED').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leaseTenants = pgTable('lease_tenants', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  isPrimary: boolean('is_primary').default(false),
});

export const maintenanceRequests = pgTable('maintenance_requests', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  reporterUserId: text('reporter_user_id').references(() => users.id).notNull(),
  category: text('category').notNull(),
  priority: text('priority').notNull(),
  status: text('status').default('REPORTED'),
  title: text('title').notNull(),
  description: text('description').notNull(),
  assignedVendorId: text('assigned_vendor_id').references(() => organizations.id),
  budget: decimal('budget'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const journalEntries = pgTable('journal_entries', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  status: text('status').default('DRAFT'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('journal_entries_prop_date_idx').on(t.propertyId, t.date),
]);

export const ledgerLines = pgTable('ledger_lines', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id).notNull(),
  accountId: text('account_id').notNull(),
  debit: decimal('debit').default('0'),
  credit: decimal('credit').default('0'),
  currency: text('currency').default('IQD'),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp('timestamp').defaultNow(),
  actorUserId: text('actor_user_id').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  changes: jsonb('changes'),
  ipAddress: text('ip_address'),
});

export const rentSchedules = pgTable('rent_schedules', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD'),
  dueDate: text('due_date').notNull(),
  periodStart: text('period_start').notNull(),
  periodEnd: text('period_end').notNull(),
  status: text('status').default('UPCOMING'), // UPCOMING, DUE, PARTIALLY_PAID, PAID, OVERDUE, WAIVED, CANCELLED
  paidAmount: decimal('paid_amount').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('rent_schedules_prop_due_status_idx').on(t.propertyId, t.dueDate, t.status),
  unique('rent_schedules_lease_period_idx').on(t.leaseId, t.periodStart),
]);

export const paymentRecords = pgTable('payment_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  leaseId: text('lease_id').references(() => leases.id),
  rentScheduleId: text('rent_schedule_id').references(() => rentSchedules.id),
  payerId: text('payer_id').references(() => users.id).notNull(),
  collectorId: text('collector_id').references(() => users.id),
  confirmedByUserId: text('confirmed_by_user_id').references(() => users.id),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD'),
  paymentMethod: text('payment_method'),
  referenceNumber: text('reference_number'),
  status: text('status').default('PENDING'), // PENDING, RECORDED, CONFIRMED, FAILED, CANCELLED, REFUNDED
  recordedDate: text('recorded_date').notNull(),
  receiptNumber: text('receipt_number'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('payment_records_prop_status_date_idx').on(t.propertyId, t.status, t.recordedDate),
]);

export const securityDeposits = pgTable('security_deposits', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  requiredAmount: decimal('required_amount').notNull(),
  recordedAmount: decimal('recorded_amount').default('0'),
  releasedAmount: decimal('released_amount').default('0'),
  currency: text('currency').default('IQD'),
  status: text('status').default('PENDING'), // PENDING, HELD, PARTIALLY_REFUNDED, REFUNDED, DEDUCTED
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendors = pgTable('vendors', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  status: text('status').default('ACTIVE'),
  categories: jsonb('categories').$type<string[]>(),
  coverageAreaIds: jsonb('coverage_area_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const maintenanceQuotes = pgTable('maintenance_quotes', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  maintenanceRequestId: text('maintenance_request_id').references(() => maintenanceRequests.id).notNull(),
  vendorId: text('vendor_id'),
  vendorUserId: text('vendor_user_id').references(() => users.id),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  totalAmount: decimal('total_amount').notNull(),
  laborAmount: decimal('labor_amount'),
  materialsAmount: decimal('materials_amount'),
  feesAmount: decimal('fees_amount'),
  currency: text('currency').default('IQD'),
  estimatedDuration: text('estimated_duration'),
  warrantyTerms: text('warranty_terms'),
  lineItems: jsonb('line_items'),
  validUntil: text('valid_until'),
  revisionNumber: integer('revision_number').default(1),
  status: text('status').default('PENDING_APPROVAL'), // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, REVISED
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const workOrders = pgTable('work_orders', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  maintenanceRequestId: text('maintenance_request_id').references(() => maintenanceRequests.id).notNull(),
  quoteId: text('quote_id').references(() => maintenanceQuotes.id),
  vendorId: text('vendor_id'),
  vendorUserId: text('vendor_user_id').references(() => users.id),
  assignedTechnicianId: text('assigned_technician_id').references(() => users.id),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  priority: text('priority').default('MEDIUM'), // LOW, MEDIUM, HIGH, CRITICAL
  status: text('status').default('SCHEDULED'), // SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED
  scheduledStartDate: text('scheduled_start_date'),
  scheduledEndDate: text('scheduled_end_date'),
  actualStartDate: text('actual_start_date'),
  actualEndDate: text('actual_end_date'),
  scopeOfWork: text('scope_of_work'),
  materialsUsed: jsonb('materials_used'),
  completionNotes: text('completion_notes'),
  completionPhotos: jsonb('completion_photos'),
  rating: decimal('rating', { precision: 3, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const inspections = pgTable('inspections', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: text('work_order_id').references(() => workOrders.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  inspectorId: text('inspector_id').references(() => users.id).notNull(),
  status: text('status').default('PASSED'), // PASSED, FAILED
  findings: text('findings'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const assets = pgTable('assets', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  name: text('name').notNull(),
  type: text('type').notNull(), // HVAC, ELEVATOR, APPLIANCE, etc.
  serialNumber: text('serial_number'),
  installationDate: text('installation_date'),
  warrantyExpirationDate: text('warranty_expiration_date'),
  status: text('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const preventiveMaintenancePlans = pgTable('preventive_maintenance_plans', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  assetId: text('asset_id').references(() => assets.id),
  category: text('category').notNull(),
  frequency: text('frequency').notNull(), // WEEKLY, MONTHLY, QUARTERLY, BIANNUALLY, YEARLY
  nextDueDate: text('next_due_date').notNull(),
  assignedVendorId: text('assigned_vendor_id').references(() => organizations.id),
  status: text('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const maintenanceInvoices = pgTable('maintenance_invoices', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: text('work_order_id').references(() => workOrders.id).notNull(),
  quoteId: text('quote_id').references(() => maintenanceQuotes.id),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  vendorId: text('vendor_id'),
  vendorUserId: text('vendor_user_id').references(() => users.id),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD'),
  status: text('status').default('PENDING'), // DRAFT, SUBMITTED, UNDER_REVIEW, APPROVED, PAYABLE, PAID, CANCELLED
  paymentReference: text('payment_reference'),
  invoiceNumber: text('invoice_number'),
  dueDate: text('due_date'),
  lineItems: jsonb('line_items'),
  paidAt: timestamp('paid_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const documents = pgTable('documents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  ownerId: text('owner_id').references(() => users.id),
  uploaderUserId: text('uploader_user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  documentType: text('document_type').notNull(), // TAPU, DEED, LEASE_CONTRACT, INSPECTION, ID, OTHER
  verificationState: text('verification_state').default('PENDING'), // PENDING, VERIFIED, REJECTED
  fileUrl: text('file_url'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id),
  creatorUserId: text('creator_user_id').references(() => users.id).notNull(),
  participantIds: jsonb('participant_ids').$type<string[]>().notNull(),
  title: text('title').notNull(),
  status: text('status').default('ACTIVE'), // ACTIVE, ARCHIVED
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const messages = pgTable('messages', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  conversationId: text('conversation_id').references(() => conversations.id).notNull(),
  senderUserId: text('sender_user_id').references(() => users.id).notNull(),
  senderRole: text('sender_role').notNull(),
  content: text('content').notNull(),
  messageType: text('message_type').default('TEXT'), // TEXT, MAINTENANCE_UPDATE, PAYMENT_REMINDER, LEASE_OFFER
  readByUserIds: jsonb('read_by_user_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const listings = pgTable('listings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  publisherUserId: text('publisher_user_id').references(() => users.id).notNull(),
  publisherCompanyId: text('publisher_company_id').references(() => organizations.id),
  type: text('type').notNull(), // FOR_RENT, FOR_SALE
  price: decimal('price').notNull(),
  currency: text('currency').default('IQD'),
  status: text('status').default('DRAFT'), // DRAFT, PENDING_REVIEW, PUBLISHED, PAUSED, ARCHIVED
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull(),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  category: text('category').notNull(),
  priority: text('priority').default('NORMAL'), // LOW, NORMAL, HIGH, CRITICAL / URGENT
  sensitivity: text('sensitivity').default('NORMAL'), // PUBLIC, NORMAL, PRIVATE, SENSITIVE, SECURITY_PRIVATE, COMPLIANCE_PRIVATE
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').default(false),
  status: text('status').default('QUEUED'), // QUEUED, SCHEDULED, PROCESSING, SENT, DELIVERED, READ, FAILED, CANCELLED, EXPIRED
  sourceDomain: text('source_domain'),
  entityId: text('entity_id'),
  entityType: text('entity_type'),
  templateId: text('template_id'),
  templateVersion: text('template_version'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  scheduledAt: timestamp('scheduled_at'),
  readAt: timestamp('read_at'),
  dismissedAt: timestamp('dismissed_at'),
  expiresAt: timestamp('expires_at'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const idempotencyRecords = pgTable('idempotency_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  key: text('key').notNull(),
  scope: text('scope').notNull(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  requestHash: text('request_hash').notNull(),
  resourceId: text('resource_id'),
  responseStatus: integer('response_status').notNull().default(201),
  responseBody: jsonb('response_body').$type<Record<string, any>>().notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
}, (t) => [
  unique('idempotency_records_user_scope_key_unique').on(t.userId, t.scope, t.key),
  index('idempotency_records_expires_at_idx').on(t.expiresAt),
]);

export const commissions = pgTable('commissions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  paymentRecordId: text('payment_record_id').references(() => paymentRecords.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  leaseId: text('lease_id').references(() => leases.id),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  ownerId: text('owner_id').references(() => users.id),
  companyId: text('company_id').references(() => organizations.id),
  commissionType: text('commission_type').default('RENT_MANAGEMENT').notNull(),
  rate: decimal('rate').notNull(),
  baseAmount: decimal('base_amount').notNull(),
  commissionAmount: decimal('commission_amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  status: text('status').default('POSTED').notNull(), // CALCULATED, POSTED, REVERSED
  policyVersion: text('policy_version').default('v1.0').notNull(),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
  confirmedAt: timestamp('confirmed_at'),
  reversedAt: timestamp('reversed_at'),
});

export const rentalApplications = pgTable('rental_applications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  applicantUserId: text('applicant_user_id').references(() => users.id).notNull(),
  status: text('status').default('SUBMITTED'), // DRAFT, SUBMITTED, UNDER_REVIEW, MORE_INFORMATION_REQUIRED, APPROVED, REJECTED, WITHDRAWN, EXPIRED, CONVERTED_TO_LEASE
  monthlyIncome: decimal('monthly_income'),
  currency: text('currency').default('IQD'),
  employmentStatus: text('employment_status'),
  preferredMoveInDate: text('preferred_move_in_date'),
  notes: text('notes'),
  submittedAt: timestamp('submitted_at').defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const leaseRenewals = pgTable('lease_renewals', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  proposedStartDate: text('proposed_start_date').notNull(),
  proposedEndDate: text('proposed_end_date').notNull(),
  proposedRentAmount: decimal('proposed_rent_amount'),
  currency: text('currency').default('IQD'),
  status: text('status').default('REQUESTED'), // REQUESTED, UNDER_REVIEW, APPROVED, REJECTED, CANCELLED
  tenantNotes: text('tenant_notes'),
  ownerNotes: text('owner_notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const moveOutRequests = pgTable('move_out_requests', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  requestedMoveOutDate: text('requested_move_out_date').notNull(),
  reason: text('reason'),
  forwardingAddress: text('forwarding_address'),
  status: text('status').default('PENDING_REVIEW'), // PENDING_REVIEW, INSPECTION_SCHEDULED, INSPECTED, DEPOSIT_RECONCILED, COMPLETED, CANCELLED
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const leaseMoveOutInspections = pgTable('lease_move_out_inspections', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  leaseId: text('lease_id').references(() => leases.id, { onDelete: 'cascade' }).notNull(),
  moveOutRequestId: text('move_out_request_id').references(() => moveOutRequests.id, { onDelete: 'set null' }),
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  inspectorId: text('inspector_id').references(() => users.id).notNull(),
  status: text('status').default('SCHEDULED').notNull(), // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
  hasMoveInBaseline: boolean('has_move_in_baseline').default(false).notNull(),
  moveInBaselineReference: text('move_in_baseline_reference'),
  generalNotes: text('general_notes'),
  tenantPresent: boolean('tenant_present').default(false).notNull(),
  tenantSignatureRef: text('tenant_signature_ref'),
  metadata: jsonb('metadata'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('lease_move_out_inspections_lease_idx').on(t.leaseId),
  index('lease_move_out_inspections_property_idx').on(t.propertyId),
  index('lease_move_out_inspections_status_idx').on(t.status),
  index('lease_move_out_inspections_req_idx').on(t.moveOutRequestId),
]);

export const leaseMoveOutInspectionItems = pgTable('lease_move_out_inspection_items', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  inspectionId: text('inspection_id').references(() => leaseMoveOutInspections.id, { onDelete: 'cascade' }).notNull(),
  area: text('area').notNull(),
  component: text('component').notNull(),
  condition: text('condition').notNull(), // EXCELLENT, GOOD, FAIR, DAMAGED, MISSING, DIRTY
  damageDescription: text('damage_description'),
  isTenantCaused: boolean('is_tenant_caused').default(false).notNull(),
  estimatedRepairCost: decimal('estimated_repair_cost').default('0').notNull(),
  currency: text('currency').default('IQD').notNull(),
  evidenceRefs: jsonb('evidence_refs').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('lease_move_out_items_inspection_idx').on(t.inspectionId),
]);

export const securityDepositDeductions = pgTable('security_deposit_deductions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  depositId: text('deposit_id').references(() => securityDeposits.id).notNull(),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  inspectionItemId: text('inspection_item_id').references(() => leaseMoveOutInspectionItems.id, { onDelete: 'set null' }),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  category: text('category').notNull(), // DAMAGE, CLEANING, KEY_REPLACEMENT, UNPAID_UTILITIES, OTHER
  description: text('description').notNull(),
  evidenceRefs: jsonb('evidence_refs').$type<string[]>(),
  proposedById: text('proposed_by_id').references(() => users.id).notNull(),
  proposedAt: timestamp('proposed_at').defaultNow().notNull(),
  status: text('status').default('PROPOSED').notNull(), // PROPOSED, OWNER_APPROVED, REJECTED, DISPUTED, SETTLED, CANCELLED
  approvedById: text('approved_by_id').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  disputedAt: timestamp('disputed_at'),
  disputeReason: text('dispute_reason'),
  disputeDeadline: timestamp('dispute_deadline'),
  tenantNotifiedAt: timestamp('tenant_notified_at'),
  noticeNotificationId: text('notice_notification_id').references(() => notifications.id, { onDelete: 'set null' }),
  noticeDeliveryId: text('notice_delivery_id').references(() => notificationDeliveries.id, { onDelete: 'set null' }),
  noticeDeliveryStatus: text('notice_delivery_status').default('NOT_SENT'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('sec_dep_deductions_deposit_idx').on(t.depositId),
  index('sec_dep_deductions_lease_idx').on(t.leaseId),
  index('sec_dep_deductions_status_idx').on(t.status),
  index('sec_dep_deductions_deadline_idx').on(t.disputeDeadline),
  index('sec_dep_deductions_item_idx').on(t.inspectionItemId),
  index('sec_dep_deductions_notice_status_idx').on(t.noticeDeliveryStatus),
]);

// ==========================================
// BUYER DOMAIN AUTHORITATIVE SCHEMAS
// ==========================================

export const buyerProfiles = pgTable('buyer_profiles', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  budgetMin: decimal('budget_min'),
  budgetMax: decimal('budget_max'),
  currency: text('currency').default('IQD'),
  preferredCities: jsonb('preferred_cities').$type<string[]>(),
  preferredPropertyTypes: jsonb('preferred_property_types').$type<string[]>(),
  minBeds: integer('min_beds'),
  minBaths: decimal('min_baths'),
  minSquareMeters: integer('min_square_meters'),
  purchasePurpose: text('purchase_purpose'), // PRIMARY_RESIDENCE, INVESTMENT, VACATION_HOME, COMMERCIAL
  financingStatus: text('financing_status'), // CASH_READY, PRE_APPROVED, MORTGAGE_SEEKING, NOT_STARTED
  notificationPreferences: jsonb('notification_preferences').$type<{
    email: boolean;
    sms: boolean;
    push: boolean;
    instantOfferAlerts: boolean;
  }>(),
  isComplete: boolean('is_complete').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const buyerFavorites = pgTable('buyer_favorites', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  listingId: text('listing_id').references(() => listings.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  uniqueIndex('buyer_property_unique_idx').on(t.buyerId, t.propertyId),
]);

export const savedSearches = pgTable('saved_searches', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  criteria: jsonb('criteria').notNull(),
  isActive: boolean('is_active').default(true),
  notifyOnMatch: boolean('notify_on_match').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const propertyInquiries = pgTable('property_inquiries', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  listingId: text('listing_id').references(() => listings.id),
  inquiryType: text('inquiry_type').default('GENERAL'), // GENERAL, PRICE_INQUIRY, AVAILABILITY, FINANCING, DOCUMENT_REQUEST
  message: text('message').notNull(),
  status: text('status').default('PENDING'), // PENDING, RESPONDED, CLOSED
  recipientUserId: text('recipient_user_id').references(() => users.id),
  recipientCompanyId: text('recipient_company_id').references(() => organizations.id),
  responseMessage: text('response_message'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const propertyViewings = pgTable('property_viewings', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  listingId: text('listing_id').references(() => listings.id),
  scheduledAt: timestamp('scheduled_at').notNull(),
  status: text('status').default('REQUESTED').notNull(), // REQUESTED, CONFIRMED, RESCHEDULED, COMPLETED, CANCELLED, NO_SHOW
  viewingType: text('viewing_type').default('IN_PERSON'), // IN_PERSON, VIRTUAL_TOUR
  notes: text('notes'),
  cancellationReason: text('cancellation_reason'),
  cancelledBy: text('cancelled_by'),
  organizerUserId: text('organizer_user_id').references(() => users.id),
  organizerCompanyId: text('organizer_company_id').references(() => organizations.id),
  feedback: text('feedback'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const propertyOffers = pgTable('property_offers', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  listingId: text('listing_id').references(() => listings.id),
  offerAmount: decimal('offer_amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  depositAmount: decimal('deposit_amount'),
  financingType: text('financing_type').default('CASH'), // CASH, BANK_LOAN, INSTALLMENT, PRE_APPROVED_MORTGAGE
  terms: text('terms'),
  conditions: jsonb('conditions').$type<string[]>(),
  status: text('status').default('OFFER_SUBMITTED').notNull(), // DRAFT, OFFER_SUBMITTED, UNDER_REVIEW, COUNTERED, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED, CANCELLED
  expiresAt: timestamp('expires_at'),
  sellerUserId: text('seller_user_id').references(() => users.id),
  sellerCompanyId: text('seller_company_id').references(() => organizations.id),
  rejectionReason: text('rejection_reason'),
  withdrawnReason: text('withdrawn_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const offerCounterHistory = pgTable('offer_counter_history', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  offerId: text('offer_id').references(() => propertyOffers.id).notNull(),
  actorId: text('actor_id').references(() => users.id).notNull(),
  actorRole: text('actor_role').notNull(), // BUYER, SELLER_OWNER, SELLER_COMPANY
  counterAmount: decimal('counter_amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  counterTerms: text('counter_terms'),
  status: text('status').notNull(), // COUNTERED, ACCEPTED, REJECTED
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const salesContracts = pgTable('sales_contracts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  offerId: text('offer_id').references(() => propertyOffers.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  listingId: text('listing_id').references(() => listings.id),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  sellerId: text('seller_id').references(() => users.id).notNull(),
  contractNumber: text('contract_number').notNull().unique(),
  agreedPrice: decimal('agreed_price').notNull(),
  currency: text('currency').default('IQD').notNull(),
  depositAmount: decimal('deposit_amount'),
  status: text('status').default('DRAFTED').notNull(), // DRAFTED, PENDING_APPROVAL, PENDING_SIGNATURE, EXECUTED, CANCELLED, TERMINATED
  documentUrl: text('document_url'),
  documentIds: jsonb('document_ids').$type<string[]>(),
  terms: text('terms'),
  executionDate: timestamp('execution_date'),
  closingDeadline: timestamp('closing_deadline'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const salesTransactions = pgTable('sales_transactions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  contractId: text('contract_id').references(() => salesContracts.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  buyerId: text('buyer_id').references(() => users.id).notNull(),
  sellerId: text('seller_id').references(() => users.id).notNull(),
  transactionNumber: text('transaction_number').notNull().unique(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  status: text('status').default('TRANSACTION_OPENED').notNull(),
  // TRANSACTION_OPENED, DUE_DILIGENCE, CONTRACT_EXECUTED, PAYMENT_PENDING, SETTLEMENT_PENDING, CLOSING_PENDING, CLOSED, CANCELLED, FAILED
  dueDiligenceStatus: text('due_diligence_status').default('PENDING'), // PENDING, IN_PROGRESS, PASSED, FAILED
  settlementDetails: jsonb('settlement_details'),
  ownershipTransitionRef: text('ownership_transition_ref'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// AGENT / BROKER DOMAIN AUTHORITATIVE SCHEMAS
// ==========================================

export const agentProfiles = pgTable('agent_profiles', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  displayName: text('display_name').notNull(),
  professionalTitle: text('professional_title').default('Real Estate Agent').notNull(),
  biography: text('biography'),
  phone: text('phone'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  officeName: text('office_name'),
  officeAddress: text('office_address'),
  spokenLanguages: jsonb('spoken_languages').$type<string[]>(),
  specialties: jsonb('specialties').$type<string[]>(),
  propertyTypes: jsonb('property_types').$type<string[]>(),
  serviceAreas: jsonb('service_areas').$type<string[]>(),
  availabilityStatus: text('availability_status').default('AVAILABLE').notNull(), // AVAILABLE, BUSY, AWAY, ON_LEAVE
  workingHours: jsonb('working_hours'),
  status: text('status').default('PENDING_VERIFICATION').notNull(), // ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION
  isPublic: boolean('is_public').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentLicenses = pgTable('agent_licenses', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').references(() => agentProfiles.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  licenseNumber: text('license_number').notNull(),
  issuingAuthority: text('issuing_authority').notNull(),
  issuedDate: text('issued_date'),
  expiryDate: text('expiry_date'),
  documentUrl: text('document_url'),
  verificationStatus: text('verification_status').default('SUBMITTED').notNull(), // SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, EXPIRED, SUSPENDED
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentPropertyAssignments = pgTable('agent_property_assignments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').references(() => agentProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  companyId: text('company_id').references(() => organizations.id),
  assignedBy: text('assigned_by').references(() => users.id).notNull(),
  permissions: jsonb('permissions').$type<string[]>().notNull(),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, REVOKED, EXPIRED
  effectiveDate: timestamp('effective_date').defaultNow(),
  expiryDate: timestamp('expiry_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentLeads = pgTable('agent_leads', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').references(() => agentProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  companyId: text('company_id').references(() => organizations.id),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone'),
  clientEmail: text('client_email'),
  leadType: text('lead_type').default('BUY').notNull(), // BUY, RENT, SELL, INVEST, OWNER, TENANT
  stage: text('stage').default('NEW').notNull(), // NEW, CONTACTED, QUALIFIED, VIEWING_SCHEDULED, OFFER_MADE, NEGOTIATING, CLOSED_WON, CLOSED_LOST
  budgetMin: decimal('budget_min'),
  budgetMax: decimal('budget_max'),
  currency: text('currency').default('IQD').notNull(),
  preferredLocations: jsonb('preferred_locations').$type<string[]>(),
  propertyType: text('property_type'),
  notes: text('notes'),
  nextFollowUp: timestamp('next_follow_up'),
  priority: text('priority').default('MEDIUM').notNull(), // LOW, MEDIUM, HIGH, URGENT
  source: text('source').default('MARKETPLACE_INQUIRY').notNull(),
  linkedBuyerId: text('linked_buyer_id').references(() => users.id),
  linkedPropertyId: text('linked_property_id').references(() => properties.id),
  linkedListingId: text('linked_listing_id').references(() => listings.id),
  linkedInquiryId: text('linked_inquiry_id').references(() => propertyInquiries.id),
  linkedViewingId: text('linked_viewing_id').references(() => propertyViewings.id),
  linkedOfferId: text('linked_offer_id').references(() => propertyOffers.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentTasks = pgTable('agent_tasks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').references(() => agentProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  companyId: text('company_id').references(() => organizations.id),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').default('NORMAL').notNull(), // LOW, NORMAL, HIGH, URGENT
  dueDate: timestamp('due_date'),
  status: text('status').default('PENDING').notNull(), // PENDING, IN_PROGRESS, COMPLETED, CANCELLED
  category: text('category').default('GENERAL').notNull(),
  linkedLeadId: text('linked_lead_id').references(() => agentLeads.id),
  linkedPropertyId: text('linked_property_id').references(() => properties.id),
  linkedViewingId: text('linked_viewing_id').references(() => propertyViewings.id),
  linkedOfferId: text('linked_offer_id').references(() => propertyOffers.id),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentCommissions = pgTable('agent_commissions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').references(() => agentProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  companyId: text('company_id').references(() => organizations.id),
  transactionId: text('transaction_id').references(() => salesTransactions.id),
  contractId: text('contract_id').references(() => salesContracts.id),
  propertyId: text('property_id').references(() => properties.id),
  listingId: text('listing_id').references(() => listings.id),
  dealAmount: decimal('deal_amount').notNull(),
  dealType: text('deal_type').default('SALE').notNull(), // SALE, LEASE_ACQUISITION
  commissionBasis: text('commission_basis').default('PERCENTAGE').notNull(), // PERCENTAGE, FIXED_FEE
  grossCommissionRate: decimal('gross_commission_rate'),
  grossCommissionAmount: decimal('gross_commission_amount').notNull(),
  brokerageSplitRate: decimal('brokerage_split_rate').default('0.30'),
  brokerageShareAmount: decimal('brokerage_share_amount').notNull(),
  agentShareAmount: decimal('agent_share_amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  status: text('status').default('CALCULATED').notNull(), // CALCULATED, PENDING_APPROVAL, APPROVED, PAYABLE, DISBURSED, DISPUTED, REVERSED, CANCELLED
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  disbursedAt: timestamp('disbursed_at'),
  paymentReference: text('payment_reference'),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentCompensationAgreements = pgTable('agent_compensation_agreements', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  agentId: text('agent_id').references(() => agentProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  companyId: text('company_id').references(() => organizations.id),
  agreementType: text('agreement_type').default('STANDARD_SPLIT').notNull(),
  brokerageSplitRate: decimal('brokerage_split_rate').notNull(),
  agentSplitRate: decimal('agent_split_rate').notNull(),
  status: text('status').default('ACTIVE').notNull(), // DRAFT, PENDING_APPROVAL, ACTIVE, EXPIRED, TERMINATED
  effectiveDate: timestamp('effective_date').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date'),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const agentEvents = pgTable('agent_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  eventType: text('event_type').notNull(), // VIEWING, CLIENT_MEETING, OFFER_DISCUSSION, TEAM_MEETING, INSPECTION
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  location: text('location'),
  meetingLink: text('meeting_link'),
  status: text('status').default('SCHEDULED').notNull(), // SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED
  linkedLeadId: text('linked_lead_id').references(() => agentLeads.id),
  linkedViewingId: text('linked_viewing_id').references(() => propertyViewings.id),
  linkedPropertyId: text('linked_property_id').references(() => properties.id),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ==========================================
// VENDOR / SERVICE PROVIDER DOMAIN TABLES
// ==========================================

export const vendorProfiles = pgTable('vendor_profiles', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull().unique(),
  organizationId: text('organization_id').references(() => organizations.id),
  businessName: text('business_name').notNull(),
  legalName: text('legal_name'),
  bio: text('bio'),
  categories: jsonb('categories').$type<string[]>(),
  specialties: jsonb('specialties').$type<string[]>(),
  serviceAreas: jsonb('service_areas').$type<string[]>(),
  phone: text('phone'),
  email: text('email'),
  workingHours: jsonb('working_hours'),
  emergencyAvailable: boolean('emergency_available').default(false),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION
  verificationStatus: text('verification_status').default('PENDING').notNull(), // PENDING, SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED
  rating: decimal('rating', { precision: 3, scale: 2 }).default('5.00'),
  reviewCount: integer('review_count').default(0),
  hourlyRate: decimal('hourly_rate'),
  currency: text('currency').default('IQD').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorLicenses = pgTable('vendor_licenses', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  vendorId: text('vendor_id').references(() => vendorProfiles.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  licenseType: text('license_type').notNull(),
  licenseNumber: text('license_number').notNull(),
  issuingAuthority: text('issuing_authority').notNull(),
  issueDate: timestamp('issue_date'),
  expiryDate: timestamp('expiry_date'),
  documentUrl: text('document_url'),
  status: text('status').default('SUBMITTED').notNull(), // SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, EXPIRED
  verifiedBy: text('verified_by').references(() => users.id),
  verifiedAt: timestamp('verified_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const vendorTasks = pgTable('vendor_tasks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  vendorId: text('vendor_id').references(() => vendorProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority').default('MEDIUM').notNull(), // LOW, MEDIUM, HIGH, URGENT
  status: text('status').default('PENDING').notNull(), // PENDING, IN_PROGRESS, COMPLETED, CANCELLED
  dueDate: timestamp('due_date'),
  linkedWorkOrderId: text('linked_work_order_id').references(() => workOrders.id),
  linkedRequestId: text('linked_request_id').references(() => maintenanceRequests.id),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const vendorEvents = pgTable('vendor_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  vendorId: text('vendor_id').references(() => vendorProfiles.id),
  userId: text('user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  eventType: text('event_type').notNull(), // JOB_APPOINTMENT, INSPECTION, CLIENT_MEETING, ESTIMATE_VISIT, BLOCKED_TIME
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  location: text('location'),
  linkedWorkOrderId: text('linked_work_order_id').references(() => workOrders.id),
  linkedPropertyId: text('linked_property_id').references(() => properties.id),
  status: text('status').default('SCHEDULED').notNull(), // SCHEDULED, COMPLETED, CANCELLED, RESCHEDULED
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const propertyReviews = pgTable('property_reviews', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id, { onDelete: 'cascade' }).notNull(),
  leaseId: text('lease_id').references(() => leases.id, { onDelete: 'set null' }),
  tenantId: text('tenant_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rating: integer('rating').notNull(),
  cleanlinessRating: integer('cleanliness_rating'),
  maintenanceRating: integer('maintenance_rating'),
  communicationRating: integer('communication_rating'),
  locationRating: integer('location_rating'),
  title: text('title'),
  comment: text('comment').notNull(),
  status: text('status').default('PUBLISHED').notNull(), // PUBLISHED, HIDDEN, FLAGGED
  moderationReason: text('moderation_reason'),
  moderatedByUserId: text('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  moderatedAt: timestamp('moderated_at'),
  ownerResponse: text('owner_response'),
  ownerRespondedAt: timestamp('owner_responded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('prop_reviews_tenant_prop_unique_idx').on(t.propertyId, t.tenantId),
  index('prop_reviews_property_id_idx').on(t.propertyId),
  index('prop_reviews_tenant_id_idx').on(t.tenantId),
  index('prop_reviews_status_idx').on(t.status),
]);

export const vendorReviews = pgTable('vendor_reviews', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  vendorId: text('vendor_id').references(() => vendorProfiles.id).notNull(),
  workOrderId: text('work_order_id').references(() => workOrders.id).notNull(),
  reviewerUserId: text('reviewer_user_id').references(() => users.id).notNull(),
  reviewerRole: text('reviewer_role').notNull(), // OWNER, TENANT, COMPANY_MANAGER
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  vendorResponse: text('vendor_response'),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  uniqueIndex('vendor_reviews_wo_reviewer_unique_idx').on(t.workOrderId, t.reviewerUserId),
]);


// ==========================================
// FINANCE / ACCOUNTING / REVENUE DOMAIN TABLES
// ==========================================

export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  accountType: text('account_type').notNull(), // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  currency: text('currency').default('IQD').notNull(),
  active: boolean('active').default(true).notNull(),
  systemAccount: boolean('system_account').default(false).notNull(), // true if critical system account that cannot be deleted
  parentAccountId: text('parent_account_id'), // self-referencing for hierarchical CoA, omit foreign key in Drizzle to avoid circular type issues or define carefully
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const financialPolicies = pgTable('financial_policies', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  policyType: text('policy_type').notNull().unique(), // e.g. RENT_MANAGEMENT_COMMISSION_RATE
  policyValue: decimal('policy_value').notNull(),
  currency: text('currency'), // null for percentage/ratio
  active: boolean('active').default(true).notNull(),
  effectiveFrom: timestamp('effective_from').defaultNow(),
  effectiveTo: timestamp('effective_to'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
export const pricingTiers = pgTable('pricing_tiers', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  minProperties: integer('min_properties').notNull(),
  maxProperties: integer('max_properties'), // null means open-ended (e.g. 100+)
  rentFeeRate: decimal('rent_fee_rate').notNull(),
  managementFeeRate: decimal('management_fee_rate').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  priority: integer('priority').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taxRates = pgTable('tax_rates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  rate: decimal('rate').notNull(),
  jurisdiction: text('jurisdiction').notNull(), // e.g. 'IQ-KR', 'IQ'
  isInclusive: boolean('is_inclusive').default(false).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const exchangeRates = pgTable('exchange_rates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  baseCurrency: text('base_currency').notNull(), // e.g. 'USD'
  targetCurrency: text('target_currency').notNull(), // e.g. 'IQD'
  rate: decimal('rate').notNull(),
  date: text('date').notNull(), // 'YYYY-MM-DD'
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  uniqueIndex('exchange_rate_date_idx').on(t.baseCurrency, t.targetCurrency, t.date),
]);

export const financialPeriods = pgTable('financial_periods', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  periodName: text('period_name').notNull(), // e.g. '2023-Q1'
  startDate: text('start_date').notNull(), // 'YYYY-MM-DD'
  endDate: text('end_date').notNull(), // 'YYYY-MM-DD'
  status: text('status').default('OPEN').notNull(), // OPEN, CLOSED
  closedBy: text('closed_by').references(() => users.id),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accountsReceivable = pgTable('accounts_receivable', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id),
  companyId: text('company_id').references(() => organizations.id),
  debtorId: text('debtor_id').references(() => users.id).notNull(), // Who owes the money
  sourceType: text('source_type').notNull(), // RENT, SALE, FEE
  sourceId: text('source_id').notNull(), // Reference to rent_schedules.id, etc.
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').default('OPEN').notNull(), // OPEN, PARTIAL, SETTLED, CANCELLED
  settledAmount: decimal('settled_amount').default('0'),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const accountsPayable = pgTable('accounts_payable', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id),
  companyId: text('company_id').references(() => organizations.id),
  creditorOrganizationId: text('creditor_organization_id').references(() => organizations.id), // Vendor
  creditorUserId: text('creditor_user_id').references(() => users.id), // e.g. Agent
  sourceType: text('source_type').notNull(), // VENDOR_INVOICE, AGENT_COMMISSION
  sourceId: text('source_id').notNull(), // Reference to maintenance_invoices.id, agent_commissions.id
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').default('OPEN').notNull(), // OPEN, APPROVED, PARTIAL, SETTLED, CANCELLED
  settledAmount: decimal('settled_amount').default('0'),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const refundRecords = pgTable('refund_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  originalPaymentId: text('original_payment_id').references(() => paymentRecords.id).notNull(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD').notNull(),
  reason: text('reason').notNull(),
  status: text('status').default('COMPLETED').notNull(), // PENDING, COMPLETED, FAILED
  compensatingJournalId: text('compensating_journal_id').references(() => journalEntries.id).notNull(),
  processedBy: text('processed_by').references(() => users.id).notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reversalRecords = pgTable('reversal_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  originalJournalId: text('original_journal_id').references(() => journalEntries.id).notNull(),
  reversalJournalId: text('reversal_journal_id').references(() => journalEntries.id).notNull(),
  reason: text('reason').notNull(),
  processedBy: text('processed_by').references(() => users.id).notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bankAccounts = pgTable('bank_accounts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id),
  companyId: text('company_id').references(() => organizations.id),
  bankName: text('bank_name').notNull(),
  accountName: text('account_name').notNull(),
  accountNumber: text('account_number').notNull(),
  currency: text('currency').default('IQD').notNull(),
  ledgerAccountId: text('ledger_account_id').notNull(), // Maps to chart_of_accounts.code
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bankStatements = pgTable('bank_statements', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  bankAccountId: text('bank_account_id').references(() => bankAccounts.id).notNull(),
  statementDate: text('statement_date').notNull(),
  openingBalance: decimal('opening_balance').notNull(),
  closingBalance: decimal('closing_balance').notNull(),
  currency: text('currency').default('IQD').notNull(),
  status: text('status').default('UNRECONCILED').notNull(), // UNRECONCILED, PARTIAL, RECONCILED
  fileUrl: text('file_url'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bankReconciliations = pgTable('bank_reconciliations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  bankStatementId: text('bank_statement_id').references(() => bankStatements.id).notNull(),
  bankTransactionId: text('bank_transaction_id'), // Optional: if we store individual statement lines
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id).notNull(),
  matchedAmount: decimal('matched_amount').notNull(),
  matchedBy: text('matched_by').references(() => users.id).notNull(),
  status: text('status').default('MATCHED').notNull(), // MATCHED, DISPUTED, UNMATCHED
  createdAt: timestamp('created_at').defaultNow(),
});

// ==========================================
// STAGE 8: PROPERTY INTELLIGENCE, PORTFOLIO & VALUATION TABLES
// ==========================================

export const propertyValuations = pgTable('property_valuations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  valuationDate: text('valuation_date').notNull(), // 'YYYY-MM-DD'
  estimatedValue: decimal('estimated_value').notNull(),
  currency: text('currency').default('IQD').notNull(),
  method: text('method').notNull(), // AUTHORITATIVE_DEED, PROFESSIONAL_APPRAISAL, PLATFORM_MODEL, MANUAL_ESTIMATE, AI_ADVISORY
  source: text('source').notNull(),
  confidenceIndicator: text('confidence_indicator').default('MEDIUM'), // LOW, MEDIUM, HIGH
  reviewerUserId: text('reviewer_user_id').references(() => users.id),
  documentUrl: text('document_url'),
  notes: text('notes'),
  status: text('status').default('FINAL').notNull(), // DRAFT, FINAL, SUPERSEDED
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('prop_val_prop_date_status_idx').on(t.propertyId, t.valuationDate, t.status),
]);

export const portfolioSnapshots = pgTable('portfolio_snapshots', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  ownerId: text('owner_id').references(() => users.id),
  companyId: text('company_id').references(() => organizations.id),
  snapshotDate: text('snapshot_date').notNull(), // 'YYYY-MM-DD'
  totalProperties: integer('total_properties').notNull(),
  totalUnits: integer('total_units').notNull(),
  occupancyRate: decimal('occupancy_rate').notNull(),
  grossRevenue: decimal('gross_revenue').notNull(),
  operatingExpenses: decimal('operating_expenses').notNull(),
  netOperatingIncome: decimal('net_operating_income').notNull(),
  totalAssetValue: decimal('total_asset_value'),
  currency: text('currency').default('IQD').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('portfolio_snap_owner_date_idx').on(t.ownerId, t.snapshotDate),
  index('portfolio_snap_company_date_idx').on(t.companyId, t.snapshotDate),
]);

// ==========================================
// DEPRECATED: AI PROPERTY AUTOPILOT (STAGE 9)
// Feature removed from active application runtime.
// Table definitions preserved for non-destructive schema stability and historical data safety.
// ==========================================

export const aiActions = pgTable('ai_actions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organizations.id),
  ownerId: text('owner_id').references(() => users.id),
  propertyId: text('property_id').references(() => properties.id),
  actionType: text('action_type').notNull(), // e.g. SEND_RENT_REMINDER, DRAFT_MAINTENANCE_TASK, PROPOSE_FINANCIAL_ACTION
  actionClass: text('action_class').notNull(), // CLASS_A (Advisory), CLASS_B (Low-Risk Automation), CLASS_C (High-Risk Action)
  riskLevel: text('risk_level').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  sourceType: text('source_type').notNull(), // ANOMALY_DETECTOR, MAINTENANCE_TRIAGE, LEASE_EXPIRY_ENGINE, FINANCIAL_MONITOR, MANUAL_PROMPT
  sourceReference: text('source_reference'),
  recommendation: text('recommendation').notNull(),
  rationale: text('rationale').notNull(),
  proposedPayload: jsonb('proposed_payload').$type<Record<string, any>>().notNull(),
  payloadHash: text('payload_hash').notNull(),
  policyVersion: text('policy_version').notNull().default('1.0'),
  requiredApproval: boolean('required_approval').notNull().default(false),
  approvalStatus: text('approval_status').notNull().default('NOT_REQUIRED'), // PENDING, APPROVED, REJECTED, EXPIRED, NOT_REQUIRED
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  executionStatus: text('execution_status').notNull().default('PENDING'), // PENDING, AUTO_ELIGIBLE, APPROVAL_REQUIRED, APPROVED, EXECUTING, EXECUTED, VERIFIED, COMPLETED, REJECTED, CANCELLED, EXPIRED, FAILED, ROLLED_BACK
  executedAt: timestamp('executed_at'),
  executionReference: text('execution_reference'),
  result: jsonb('result').$type<Record<string, any>>(),
  failureReason: text('failure_reason'),
  expiresAt: timestamp('expires_at'),
  idempotencyKey: text('idempotency_key').unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('ai_actions_prop_idx').on(t.propertyId, t.executionStatus),
  index('ai_actions_org_idx').on(t.organizationId, t.executionStatus),
  index('ai_actions_owner_idx').on(t.ownerId, t.executionStatus),
  index('ai_actions_created_idx').on(t.createdAt),
]);

export const aiPolicies = pgTable('ai_policies', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organizations.id),
  ownerId: text('owner_id').references(() => users.id),
  propertyId: text('property_id').references(() => properties.id),
  maxAutoTaskCost: decimal('max_auto_task_cost').default('0'), // Server-enforced financial ceiling for Class B automation (0 = no spending)
  autoActionsEnabled: boolean('auto_actions_enabled').default(false),
  allowedAutoActionTypes: jsonb('allowed_auto_action_types').$type<string[]>().default([]),
  approvalRequiredCategories: jsonb('approval_required_categories').$type<string[]>().default([]),
  quietHoursStart: text('quiet_hours_start'), // e.g. "22:00"
  quietHoursEnd: text('quiet_hours_end'), // e.g. "07:00"
  policyVersion: text('policy_version').default('1.0').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('ai_policies_org_idx').on(t.organizationId),
  index('ai_policies_owner_idx').on(t.ownerId),
  index('ai_policies_prop_idx').on(t.propertyId),
]);

// ==========================================
// STAGE 10: TRUST, VERIFICATION, RISK, COMPLIANCE & DISPUTES
// ==========================================

export const verificationRecords = pgTable('verification_records', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  subjectType: text('subject_type').notNull(), // USER, PROPERTY, COMPANY, AGENT, VENDOR, LISTING, LEASE, DOCUMENT
  subjectId: text('subject_id').notNull(),
  verificationType: text('verification_type').notNull(),
  status: text('status').default('NOT_STARTED').notNull(), // NOT_STARTED, SUBMITTED, UNDER_REVIEW, ADDITIONAL_INFORMATION_REQUIRED, VERIFIED, PARTIALLY_VERIFIED, REJECTED, EXPIRED, REVOKED, SUSPENDED
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  ownerId: text('owner_id').references(() => users.id),
  submittedBy: text('submitted_by').references(() => users.id).notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  rejectionReason: text('rejection_reason'),
  expiresAt: timestamp('expires_at'),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('ver_rec_subject_idx').on(t.subjectType, t.subjectId),
  index('ver_rec_status_idx').on(t.status),
  index('ver_rec_org_idx').on(t.organizationId),
  index('ver_rec_prop_idx').on(t.propertyId),
]);

export const verificationEvidence = pgTable('verification_evidence', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  verificationRecordId: text('verification_record_id').references(() => verificationRecords.id).notNull(),
  evidenceType: text('evidence_type').notNull(),
  title: text('title').notNull(),
  documentRef: text('document_ref').notNull(),
  checksumSha256: text('checksum_sha256').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, VALIDATED, REJECTED, EXPIRED, SUSPECTED_TAMPERING
  submittedBy: text('submitted_by').references(() => users.id).notNull(),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('ver_evid_record_idx').on(t.verificationRecordId),
  index('ver_evid_status_idx').on(t.status),
]);

export const riskSignals = pgTable('risk_signals', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  targetType: text('target_type').notNull(), // USER, COMPANY, PROPERTY, LISTING, TRANSACTION, PAYMENT, DOCUMENT
  targetId: text('target_id').notNull(),
  signalType: text('signal_type').notNull(),
  riskLevel: text('risk_level').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  numericScore: decimal('numeric_score').notNull(),
  description: text('description').notNull(),
  source: text('source').notNull(), // SYSTEM, DETERMINISTIC_RULE, USER_REPORT, AI_ADVISORY
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, REVIEWED, DISMISSED, RESOLVED
  evidenceRef: text('evidence_ref'),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('risk_signals_target_idx').on(t.targetType, t.targetId),
  index('risk_signals_status_level_idx').on(t.status, t.riskLevel),
]);

export const riskAssessments = pgTable('risk_assessments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  score: decimal('score').notNull(),
  level: text('level').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  factors: jsonb('factors').$type<any[]>().notNull(),
  contributingSignalIds: jsonb('contributing_signal_ids').$type<string[]>().default([]),
  ruleVersion: text('rule_version').default('1.0').notNull(),
  calculatedAt: timestamp('calculated_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  status: text('status').default('CURRENT').notNull(), // CURRENT, SUPERSEDED, OVERRIDDEN
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewNotes: text('review_notes'),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('risk_assess_target_status_idx').on(t.targetType, t.targetId, t.status),
  index('risk_assess_org_idx').on(t.organizationId),
  index('risk_assess_prop_idx').on(t.propertyId),
]);

export const complianceRules = pgTable('compliance_rules', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').unique().notNull(), // e.g. COMP_IQ_TAPU_VERIFIED, COMP_IQ_BROKER_LICENSED
  name: text('name').notNull(),
  category: text('category').notNull(), // SYSTEM_POLICY, CONFIGURED_BUSINESS_RULE, EXTERNAL_LEGAL_REQUIREMENT, ADVISORY_INFORMATION
  jurisdiction: text('jurisdiction').notNull(), // IQ-KR, IQ, GLOBAL
  severity: text('severity').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  description: text('description').notNull(),
  applicability: jsonb('applicability').$type<any>().notNull(),
  requiredEvidenceTypes: jsonb('required_evidence_types').$type<string[]>().default([]),
  active: boolean('active').default(true).notNull(),
  effectiveDate: text('effective_date'),
  expirationDate: text('expiration_date'),
  remediation: text('remediation'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const complianceCases = pgTable('compliance_cases', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  ruleId: text('rule_id').references(() => complianceRules.id).notNull(),
  subjectType: text('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  severity: text('severity').notNull(), // LOW, MEDIUM, HIGH, CRITICAL
  status: text('status').default('OPEN').notNull(), // OPEN, TRIAGED, UNDER_REVIEW, ACTION_REQUIRED, ESCALATED, RESOLVED, CLOSED, REOPENED
  decision: text('decision').default('PENDING').notNull(), // PENDING, CLEAR, REVIEW_REQUIRED, RESTRICTED, BLOCKED
  assignedReviewerId: text('assigned_reviewer_id').references(() => users.id),
  remediationAction: text('remediation_action'),
  deadline: timestamp('deadline'),
  notes: text('notes'),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('comp_cases_subject_idx').on(t.subjectType, t.subjectId),
  index('comp_cases_status_idx').on(t.status, t.severity),
  index('comp_cases_org_idx').on(t.organizationId),
]);

export const disputes = pgTable('disputes', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  disputeNumber: text('dispute_number').unique().notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(), // OWNERSHIP_LISTING, TENANT_LANDLORD, BUYER_SELLER, COMPANY_OWNER, VENDOR_SERVICE, PAYMENT_COMMISSION, CONTRACT_LEASE, PROPERTY_INFO, VERIFICATION_DISPUTE, OTHER
  description: text('description').notNull(),
  status: text('status').default('OPEN').notNull(), // OPEN, TRIAGED, UNDER_REVIEW, WAITING_FOR_PARTY, EVIDENCE_REQUESTED, MEDIATION, DECISION_PENDING, RESOLVED, APPEALED, ESCALATED, CLOSED, REOPENED
  resolutionOutcome: text('resolution_outcome').default('PENDING').notNull(), // PENDING, DISMISSED, MUTUAL_AGREEMENT, UPHELD_CLAIMANT, UPHELD_RESPONDENT, EXTERNAL_LEGAL_REVIEW_REQUIRED
  initiatorUserId: text('initiator_user_id').references(() => users.id).notNull(),
  respondentUserId: text('respondent_user_id').references(() => users.id),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  relatedEntityId: text('related_entity_id'),
  assignedReviewerId: text('assigned_reviewer_id').references(() => users.id),
  externalLegalReviewRequired: boolean('external_legal_review_required').default(false).notNull(),
  resolutionNotes: text('resolution_notes'),
  resolvedAt: timestamp('resolved_at'),
  closedAt: timestamp('closed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('disputes_status_idx').on(t.status),
  index('disputes_initiator_idx').on(t.initiatorUserId),
  index('disputes_respondent_idx').on(t.respondentUserId),
  index('disputes_org_idx').on(t.organizationId),
  index('disputes_prop_idx').on(t.propertyId),
]);

export const disputeParties = pgTable('dispute_parties', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  disputeId: text('dispute_id').references(() => disputes.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').notNull(), // INITIATOR, RESPONDENT, INTERESTED_PARTY, MEDIATOR, LEGAL_REPRESENTATIVE
  organizationId: text('organization_id').references(() => organizations.id),
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, NOTIFIED, RESPONDED, DEFAULTED
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('dispute_party_user_idx').on(t.disputeId, t.userId),
  index('dispute_party_user_lookup_idx').on(t.userId),
]);

export const disputeEvidence = pgTable('dispute_evidence', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  disputeId: text('dispute_id').references(() => disputes.id).notNull(),
  submittedBy: text('submitted_by').references(() => users.id).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  documentRef: text('document_ref').notNull(),
  checksumSha256: text('checksum_sha256').notNull(),
  visibility: text('visibility').default('PUBLIC_TO_PARTIES').notNull(), // PUBLIC_TO_PARTIES, PARTY_PRIVATE, INTERNAL_REVIEW, COMPLIANCE_PRIVATE, SECURITY_PRIVATE, AUDITOR_ONLY
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, WITHDRAWN, CHALLENGED, STRICKEN
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  reviewNotes: text('review_notes'),
}, (t) => [
  index('dispute_evidence_dispute_vis_idx').on(t.disputeId, t.visibility),
]);

export const disputeEvents = pgTable('dispute_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  disputeId: text('dispute_id').references(() => disputes.id).notNull(),
  actorUserId: text('actor_user_id').references(() => users.id),
  actorRole: text('actor_role').notNull(),
  eventType: text('event_type').notNull(),
  visibility: text('visibility').default('PUBLIC_TO_PARTIES').notNull(), // PUBLIC_TO_PARTIES, INTERNAL_ONLY
  fromStatus: text('from_status'),
  toStatus: text('to_status'),
  details: jsonb('details').$type<Record<string, any>>(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (t) => [
  index('dispute_events_dispute_time_idx').on(t.disputeId, t.timestamp),
]);

export const disputeAppeals = pgTable('dispute_appeals', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  disputeId: text('dispute_id').references(() => disputes.id).notNull(),
  appellantUserId: text('appellant_user_id').references(() => users.id).notNull(),
  originalResolutionOutcome: text('original_resolution_outcome').notNull(),
  appealReason: text('appeal_reason').notNull(),
  status: text('status').default('FILED').notNull(), // FILED, UNDER_REVIEW, UPHELD, OVERTURNED, DISMISSED
  assignedAppealsOfficerId: text('assigned_appeals_officer_id').references(() => users.id),
  appealDecisionNotes: text('appeal_decision_notes'),
  filedAt: timestamp('filed_at').defaultNow().notNull(),
  decidedAt: timestamp('decided_at'),
}, (t) => [
  index('dispute_appeals_dispute_idx').on(t.disputeId),
]);

export const trustEvents = pgTable('trust_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id),
  actorRole: text('actor_role'),
  fromState: text('from_state'),
  toState: text('to_state'),
  reason: text('reason'),
  evidenceRef: text('evidence_ref'),
  correlationId: text('correlation_id'),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (t) => [
  index('trust_events_entity_idx').on(t.entityType, t.entityId),
  index('trust_events_type_idx').on(t.eventType),
  index('trust_events_time_idx').on(t.timestamp),
]);

// ==========================================
// STAGE 11: COMMUNICATIONS, NOTIFICATIONS & CRM
// ==========================================

export const notificationDeliveries = pgTable('notification_deliveries', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  notificationId: text('notification_id').references(() => notifications.id).notNull(),
  channel: text('channel').notNull(), // IN_APP, EMAIL, SMS, PUSH
  provider: text('provider').notNull(), // INTERNAL_IN_APP, SES, TWILIO, FCM, MOCK_PROVIDER
  providerMessageId: text('provider_message_id'),
  attemptNumber: integer('attempt_number').default(1).notNull(),
  status: text('status').default('QUEUED').notNull(), // QUEUED, PROCESSING, SENT, DELIVERED, FAILED, BOUNCED, REJECTED
  recipientAddress: text('recipient_address').notNull(),
  failureReason: text('failure_reason'),
  idempotencyKey: text('idempotency_key').unique(),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('notif_deliv_notif_idx').on(t.notificationId),
  index('notif_deliv_status_idx').on(t.status),
  uniqueIndex('notif_deliv_idemp_idx').on(t.idempotencyKey),
]);

export const notificationPreferences = pgTable('notification_preferences', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).unique().notNull(),
  channelPreferences: jsonb('channel_preferences').$type<Record<string, boolean>>().default({
    IN_APP: true,
    EMAIL: true,
    SMS: true,
    PUSH: true,
  }).notNull(),
  categoryPreferences: jsonb('category_preferences').$type<Record<string, boolean>>().default({}).notNull(),
  quietHoursEnabled: boolean('quiet_hours_enabled').default(false).notNull(),
  quietHoursStart: text('quiet_hours_start').default('22:00'),
  quietHoursEnd: text('quiet_hours_end').default('07:00'),
  preferredLanguage: text('preferred_language').default('ku').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const communicationConsents = pgTable('communication_consents', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull(),
  consentType: text('consent_type').notNull(), // MARKETING, SMS_NOTIFICATIONS, THIRD_PARTY_SHARING, ANALYTICS
  channel: text('channel').notNull(),
  purpose: text('purpose').notNull(),
  status: text('status').default('GRANTED').notNull(), // GRANTED, REVOKED
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
  source: text('source').notNull(),
}, (t) => [
  index('comm_consents_user_idx').on(t.userId, t.consentType, t.channel),
]);

export const notificationTemplates = pgTable('notification_templates', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  code: text('code').unique().notNull(),
  category: text('category').notNull(),
  name: text('name').notNull(),
  supportedChannels: jsonb('supported_channels').$type<string[]>().notNull(),
  activeVersion: text('active_version').default('1.0').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const notificationTemplateVersions = pgTable('notification_template_versions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  templateId: text('template_id').references(() => notificationTemplates.id).notNull(),
  version: text('version').notNull(),
  language: text('language').notNull(), // ku, ar, en
  titleTemplate: text('title_template').notNull(),
  bodyTemplate: text('body_template').notNull(),
  allowedVariables: jsonb('allowed_variables').$type<string[]>().notNull(),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('template_version_lang_idx').on(t.templateId, t.version, t.language),
]);

export const deviceRegistrations = pgTable('device_registrations', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  userId: text('user_id').references(() => users.id).notNull(),
  deviceToken: text('device_token').notNull(),
  platform: text('platform').notNull(), // IOS, ANDROID, WEB
  status: text('status').default('ACTIVE').notNull(), // ACTIVE, REVOKED
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('device_user_token_idx').on(t.userId, t.deviceToken),
  index('device_token_idx').on(t.deviceToken),
]);

export const notificationWebhookEvents = pgTable('notification_webhook_events', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  provider: text('provider').notNull(),
  providerEventId: text('provider_event_id'),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').$type<Record<string, any>>().notNull(),
  signatureVerified: boolean('signature_verified').default(false).notNull(),
  idempotencyKey: text('idempotency_key').unique(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  uniqueIndex('notif_webhook_provider_event_idx').on(t.provider, t.providerEventId),
  index('notif_webhook_idemp_idx').on(t.idempotencyKey),
]);

export const crmContacts = pgTable('crm_contacts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organizations.id),
  ownerUserId: text('owner_user_id').references(() => users.id).notNull(),
  contactUserId: text('contact_user_id').references(() => users.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  relationship: text('relationship').default('PROSPECT').notNull(), // OWNER, TENANT, BUYER, SELLER, AGENT, VENDOR, PROSPECT, COMPANY, OTHER_AUTHORIZED_PARTY
  tags: jsonb('tags').$type<string[]>().default([]),
  notes: text('notes'),
  isPrivate: boolean('is_private').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('crm_contacts_owner_idx').on(t.ownerUserId),
  index('crm_contacts_org_idx').on(t.organizationId),
  index('crm_contacts_user_idx').on(t.contactUserId),
]);

export const crmActivities = pgTable('crm_activities', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  contactId: text('contact_id').references(() => crmContacts.id),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  activityType: text('activity_type').notNull(), // CALL, EMAIL, SMS, NOTIFICATION, MEETING, VIEWING, MAINTENANCE_LOG, LEASE_EVENT, OFFER_EVENT, DISPUTE_EVENT, COMPLIANCE_EVENT, NOTE
  subject: text('subject').notNull(),
  description: text('description').notNull(),
  actorUserId: text('actor_user_id').references(() => users.id).notNull(),
  visibility: text('visibility').default('TEAM_PUBLIC').notNull(), // TEAM_PUBLIC, PRIVATE_TO_AUTHOR, RESTRICTED_MANAGEMENT
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, any>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('crm_activities_contact_idx').on(t.contactId),
  index('crm_activities_org_idx').on(t.organizationId),
  index('crm_activities_prop_idx').on(t.propertyId),
  index('crm_activities_actor_idx').on(t.actorUserId),
]);

export const crmTasks = pgTable('crm_tasks', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  organizationId: text('organization_id').references(() => organizations.id),
  propertyId: text('property_id').references(() => properties.id),
  contactId: text('contact_id').references(() => crmContacts.id),
  title: text('title').notNull(),
  description: text('description'),
  assignedUserId: text('assigned_user_id').references(() => users.id).notNull(),
  creatorUserId: text('creator_user_id').references(() => users.id).notNull(),
  dueDate: text('due_date').notNull(),
  priority: text('priority').default('NORMAL').notNull(), // LOW, NORMAL, HIGH, CRITICAL
  status: text('status').default('OPEN').notNull(), // OPEN, IN_PROGRESS, WAITING, COMPLETED, CANCELLED, OVERDUE
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('crm_tasks_assigned_idx').on(t.assignedUserId, t.status),
  index('crm_tasks_org_idx').on(t.organizationId),
  index('crm_tasks_prop_idx').on(t.propertyId),
]);

export const crmFollowUps = pgTable('crm_follow_ups', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  contactId: text('contact_id').references(() => crmContacts.id),
  propertyId: text('property_id').references(() => properties.id),
  assignedUserId: text('assigned_user_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(),
  status: text('status').default('PENDING').notNull(), // PENDING, COMPLETED, CANCELLED
  reminderChannel: text('reminder_channel'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => [
  index('crm_follow_ups_assigned_idx').on(t.assignedUserId, t.status),
]);

export const ownerSettlements = pgTable('owner_settlements', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  ownerId: text('owner_id').references(() => users.id).notNull(),
  propertyId: text('property_id').references(() => properties.id),
  companyId: text('company_id').references(() => organizations.id),
  periodStartDate: timestamp('period_start_date').notNull(),
  periodEndDate: timestamp('period_end_date').notNull(),
  totalCollectedIqd: decimal('total_collected_iqd').notNull(),
  platformCommissionIqd: decimal('platform_commission_iqd').notNull(),
  companyCommissionIqd: decimal('company_commission_iqd').notNull(),
  totalExpensesIqd: decimal('total_expenses_iqd').notNull(),
  netPayableIqd: decimal('net_payable_iqd').notNull(),
  status: text('status').default('AVAILABLE').notNull(),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('owner_settlements_owner_idx').on(t.ownerId),
  index('owner_settlements_status_idx').on(t.status),
]);

export const payoutRequests = pgTable('payout_requests', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  settlementId: text('settlement_id').references(() => ownerSettlements.id).notNull(),
  ownerId: text('owner_id').references(() => users.id).notNull(),
  amountIqd: decimal('amount_iqd').notNull(),
  bankAccountNumber: text('bank_account_number'),
  bankName: text('bank_name'),
  iban: text('iban'),
  status: text('status').default('REQUESTED').notNull(),
  requestedByUserId: text('requested_by_user_id').references(() => users.id).notNull(),
  approvedByUserId: text('approved_by_user_id').references(() => users.id),
  externalTransactionReference: text('external_transaction_reference'),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => [
  index('payout_requests_owner_idx').on(t.ownerId),
  index('payout_requests_status_idx').on(t.status),
]);

export const utilityBills = pgTable('utility_bills', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  tenantId: text('tenant_id').references(() => users.id),
  leaseId: text('lease_id').references(() => leases.id),
  type: text('type').notNull(),
  description: text('description'),
  amount: decimal('amount').notNull(),
  outstandingAmount: decimal('outstanding_amount').notNull(),
  status: text('status').default('UNPAID'),
  billingDate: text('billing_date').notNull(),
  dueDate: text('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const utilityPayments = pgTable('utility_payments', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  billId: text('bill_id').references(() => utilityBills.id).notNull(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('IQD'),
  paymentMethod: text('payment_method'),
  status: text('status').default('PENDING'),
  collectorId: text('collector_id').references(() => users.id),
  payerId: text('payer_id').references(() => users.id).notNull(),
  referenceNumber: text('reference_number'),
  idempotencyKey: text('idempotency_key').unique(),
  recordedDate: text('recorded_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
