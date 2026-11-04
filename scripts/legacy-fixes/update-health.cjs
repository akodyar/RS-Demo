const fs = require('fs');

let serverContent = fs.readFileSync('server.ts', 'utf8');

const healthEndpoint = `
  app.get('/api/health', async (req, res) => {
    let dbStatus = 'DATABASE_UNAVAILABLE';
    
    // Check config
    const hasConfig = process.env.SQL_HOST && process.env.SQL_DB_NAME;
    if (!hasConfig) {
      dbStatus = 'DATABASE_NOT_CONFIGURED';
    } else {
      try {
        const { createPool } = await import('./src/db/index.js');
        const pool = createPool();
        await pool.query('SELECT 1');
        dbStatus = 'DATABASE_CONNECTED';
      } catch (e: any) {
        dbStatus = 'DATABASE_CONFIGURATION_ERROR';
        console.error("DB Health Check Failed", e.message);
      }
    }

    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: dbStatus
    });
  });
`;

serverContent = serverContent.replace(/app\.get\('\/api\/health', \(req, res\) => \{[\s\S]*?\}\);/, healthEndpoint);
fs.writeFileSync('server.ts', serverContent);
