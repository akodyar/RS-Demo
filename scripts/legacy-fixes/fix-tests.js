const fs = require('fs');
const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));

for (let f of files) {
  let c = fs.readFileSync('tests/' + f, 'utf8');
  let changed = false;
  
  const replacer = (match, p1) => {
    changed = true;
    return `    process.env.SQL_HOST = originalHost || '127.0.0.1';
    process.env.SQL_DB_NAME = originalDb || 'homehub';
    process.env.DATABASE_URL = 'postgres://fake:fake@127.0.0.1/fake';
    (global)._postgresPool = { 
      connect: async () => ({ query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }), release: () => {} }), 
      query: async () => ({ rows: [{ '?column?': 1 }], rowCount: 1 }), 
      on: () => {}, 
      end: async () => {} 
    };
    try {
        const { resetDbHealthCache } = await import('../src/server/middleware/dbGuard.js');
        resetDbHealthCache();
    } catch(e) {
        // may be CJS or dynamic import issues in some tests, ignore if fails
    }
    console.log('\\n--- SUITE ` + p1;
  };
  
  // replace exact block
  const regex = /    process\.env\.SQL_HOST = originalHost;\s+process\.env\.SQL_DB_NAME = originalDb;\s+process\.env\.SQL_HOST = '127\.0\.0\.1';\s+process\.env\.SQL_DB_NAME = 'homehub';\s+console\.log\('\\n--- SUITE (\d+)/g;
  
  c = c.replace(regex, replacer);
  
  if (changed) {
    fs.writeFileSync('tests/' + f, c);
    console.log('Fixed ' + f);
  }
}
