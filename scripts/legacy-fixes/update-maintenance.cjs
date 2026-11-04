const fs = require('fs');

let s = fs.readFileSync('src/server/routes/maintenance.ts', 'utf8');

s = s.replace(
    "    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))\n    .where(eq(properties.ownerId, req.user!.id)); // Owner's queue",
    "    .innerJoin(properties, eq(maintenanceRequests.propertyId, properties.id))\n    .innerJoin(ownershipRecords, eq(properties.id, ownershipRecords.propertyId))\n    .where(eq(ownershipRecords.ownerId, req.user!.id)); // Owner's queue"
);

// We also need to make sure ownershipRecords is imported
if (!s.includes('ownershipRecords')) {
    s = s.replace(' properties ', ' properties, ownershipRecords ');
}

fs.writeFileSync('src/server/routes/maintenance.ts', s);
