import fs from 'fs';

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));

for (let f of files) {
  // Skip tests we've already fixed or don't want to break
  if (['owner-domain-idor-adversary.test.ts', 'finding15-readiness.test.ts', 'gap1-admin-db.test.ts', 'finding4-filters.test.ts', 'real-postgres-integration.test.ts'].includes(f)) continue;

  let c = fs.readFileSync('tests/' + f, 'utf8');
  let changed = false;
  
  const replacer = () => {
    changed = true;
    return `    process.env.SQL_HOST = '127.0.0.1';
    process.env.SQL_DB_NAME = 'homehub';
    process.env.DATABASE_URL = 'postgres://fake:fake@127.0.0.1/fake';
    (global as any)._postgresPool = { 
      connect: async () => ({ query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }), release: () => {} }), 
      query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }), 
      on: () => {}, 
      end: async () => {} 
    };
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {}`;
  };
  
  const regex = /    process\.env\.SQL_HOST = '127\.0\.0\.1';\s+process\.env\.SQL_DB_NAME = 'homehub';/g;
  
  c = c.replace(regex, replacer);
  
  if (changed) {
    fs.writeFileSync('tests/' + f, c);
    console.log('Fixed ' + f);
  }
}
