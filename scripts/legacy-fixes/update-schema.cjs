const fs = require('fs');
let s = fs.readFileSync('src/db/schema.ts', 'utf8');

if (!s.includes('maintenance_quotes')) {
  const newTables = `
export const vendors = pgTable('vendors', {
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
  organizationId: text('organization_id').references(() => organizations.id).notNull(),
  status: text('status').default('ACTIVE'),
  categories: jsonb('categories').$type<string[]>(),
  coverageAreaIds: jsonb('coverage_area_ids').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const maintenanceQuotes = pgTable('maintenance_quotes', {
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
  maintenanceRequestId: text('maintenance_request_id').references(() => maintenanceRequests.id).notNull(),
  vendorId: text('vendor_id').references(() => organizations.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  totalAmount: decimal('total_amount').notNull(),
  currency: text('currency').default('USD'),
  validUntil: text('valid_until'),
  status: text('status').default('PENDING_APPROVAL'), // PENDING_APPROVAL, APPROVED, REJECTED
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const workOrders = pgTable('work_orders', {
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
  maintenanceRequestId: text('maintenance_request_id').references(() => maintenanceRequests.id).notNull(),
  quoteId: text('quote_id').references(() => maintenanceQuotes.id),
  vendorId: text('vendor_id').references(() => organizations.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  status: text('status').default('SCHEDULED'), // SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
  scheduledStartDate: text('scheduled_start_date'),
  actualStartDate: text('actual_start_date'),
  actualEndDate: text('actual_end_date'),
  scopeOfWork: text('scope_of_work'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inspections = pgTable('inspections', {
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
  workOrderId: text('work_order_id').references(() => workOrders.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  inspectorId: text('inspector_id').references(() => users.id).notNull(),
  status: text('status').default('PASSED'), // PASSED, FAILED
  findings: text('findings'),
  createdAt: timestamp('created_at').defaultNow(),
});
`;
  s += newTables;
  fs.writeFileSync('src/db/schema.ts', s);
}
