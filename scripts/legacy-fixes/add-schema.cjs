const fs = require('fs');
let s = fs.readFileSync('src/db/schema.ts', 'utf8');

if (!s.includes('assets = pgTable')) {
  s += `
export const assets = pgTable('assets', {
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
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
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
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
  id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),
  workOrderId: text('work_order_id').references(() => workOrders.id).notNull(),
  propertyId: text('property_id').references(() => properties.id).notNull(),
  vendorId: text('vendor_id').references(() => organizations.id).notNull(),
  amount: decimal('amount').notNull(),
  currency: text('currency').default('USD'),
  status: text('status').default('PENDING'), // PENDING, PAID, CANCELLED
  paymentReference: text('payment_reference'),
  invoiceNumber: text('invoice_number'),
  dueDate: text('due_date'),
  createdAt: timestamp('created_at').defaultNow(),
});
`;
  fs.writeFileSync('src/db/schema.ts', s);
}
