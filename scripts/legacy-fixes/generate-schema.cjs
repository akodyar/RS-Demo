const fs = require('fs');

let types = fs.readFileSync('src/types/index.ts', 'utf8');

let schemaStr = `import { relations, sql } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp, boolean, jsonb, decimal, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(), // For IdP mapping if needed
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true),
  roles: jsonb('roles').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  taxId: text('tax_id'),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const organizationMembers = pgTable('organization_members', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  role: text('role').notNull(),
  status: text('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const properties = pgTable('properties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  address: jsonb('address'),
  yearBuilt: integer('year_built'),
  squareFeet: integer('square_feet'),
  status: text('status').default('DRAFT'),
  healthStatus: text('health_status'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const units = pgTable('units', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitNumber: text('unit_number').notNull(),
  beds: integer('beds'),
  baths: decimal('baths'),
  squareFeet: integer('square_feet'),
  status: text('status').default('VACANT'),
  marketRent: decimal('market_rent'),
  currency: text('currency').default('USD'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ownershipRecords = pgTable('ownership_records', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  ownerId: text('owner_id').references(() => users.id),
  companyId: text('company_id').references(() => organizations.id),
  ownershipPercentage: decimal('ownership_percentage'),
  acquiredDate: text('acquired_date'),
  status: text('status').default('PENDING_VERIFICATION'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const managementAgreements = pgTable('management_agreements', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  companyId: text('company_id').references(() => organizations.id).notNull(),
  ownerId: text('owner_id').references(() => users.id).notNull(),
  status: text('status').default('PENDING'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  grantedPermissions: jsonb('granted_permissions').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leases = pgTable('leases', {
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  unitId: text('unit_id').references(() => units.id),
  status: text('status').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  rentAmount: decimal('rent_amount').notNull(),
  currency: text('currency').default('USD'),
  depositAmount: decimal('deposit_amount'),
  rentCycle: text('rent_cycle'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leaseTenants = pgTable('lease_tenants', {
  id: text('id').primaryKey(),
  leaseId: text('lease_id').references(() => leases.id).notNull(),
  tenantId: text('tenant_id').references(() => users.id).notNull(),
  isPrimary: boolean('is_primary').default(false),
});

export const maintenanceRequests = pgTable('maintenance_requests', {
  id: text('id').primaryKey(),
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
  id: text('id').primaryKey(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  date: text('date').notNull(),
  description: text('description').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  status: text('status').default('DRAFT'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const ledgerLines = pgTable('ledger_lines', {
  id: text('id').primaryKey(),
  journalEntryId: text('journal_entry_id').references(() => journalEntries.id).notNull(),
  accountId: text('account_id').notNull(),
  debit: decimal('debit').default('0'),
  credit: decimal('credit').default('0'),
  currency: text('currency').default('USD'),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  actorUserId: text('actor_user_id').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  changes: jsonb('changes'),
  ipAddress: text('ip_address'),
});
`;

fs.writeFileSync('src/db/schema.ts', schemaStr);
