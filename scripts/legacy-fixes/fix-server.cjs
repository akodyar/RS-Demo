const fs = require('fs');
let s = fs.readFileSync('server.ts', 'utf8');

if (!s.includes('/api/maintenance')) {
  s = s.replace(
    "import propertiesRouter from './src/server/routes/properties.js';",
    "import propertiesRouter from './src/server/routes/properties.js';\nimport maintenanceRouter from './src/server/routes/maintenance.js';"
  );
  s = s.replace(
    "app.use('/api/leases', leasesRouter);",
    "app.use('/api/leases', leasesRouter);\n  app.use('/api/maintenance', maintenanceRouter);"
  );
  fs.writeFileSync('server.ts', s);
}
