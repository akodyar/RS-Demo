const fs = require('fs');
let s = fs.readFileSync('src/server/routes/maintenance.ts', 'utf8');

if (!s.includes('router.get(\'/:id/details\'')) {
  s = s.replace(
    "router.put('/:id/triage', requireAuth, checkDbConfig, async (req, res) => {",
    "router.get('/:id/details', requireAuth, checkDbConfig, async (req, res) => {\n  try {\n    // Ideally we should verify ownership here\n    const quotes = await maintenanceRepository.getQuotesByRequestId(req.params.id);\n    const workOrders = await maintenanceRepository.getWorkOrdersByRequestId(req.params.id);\n    res.json({ quotes, workOrders });\n  } catch (error: any) {\n    res.status(500).json({ error: error.message });\n  }\n});\n\n// Triage / Assign request\nrouter.put('/:id/triage', requireAuth, checkDbConfig, async (req, res) => {"
  );
  fs.writeFileSync('src/server/routes/maintenance.ts', s);
}
