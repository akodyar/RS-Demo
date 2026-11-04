const fs = require('fs');
let s = fs.readFileSync('src/server/repositories/maintenance.ts', 'utf8');

if (!s.includes('getQuotesByRequestId')) {
  s = s.replace(
    "async getWorkOrdersByProperty(propertyId: string) {",
    "async getQuotesByRequestId(requestId: string) {\n    return await db.select().from(maintenanceQuotes).where(eq(maintenanceQuotes.maintenanceRequestId, requestId));\n  }\n  async getWorkOrdersByRequestId(requestId: string) {\n    return await db.select().from(workOrders).where(eq(workOrders.maintenanceRequestId, requestId));\n  }\n\n  async getWorkOrdersByProperty(propertyId: string) {"
  );
  fs.writeFileSync('src/server/repositories/maintenance.ts', s);
}
