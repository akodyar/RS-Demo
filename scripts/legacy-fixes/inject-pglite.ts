import fs from 'fs';

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));

for (let f of files) {
  if (['finding15-readiness.test.ts', 'gap1-admin-db.test.ts', 'real-postgres-integration.test.ts', 'setup-pglite.ts'].includes(f)) continue;

  let c = fs.readFileSync('tests/' + f, 'utf8');
  let changed = false;
  
  if (!c.includes(`import { injectPgliteMock } from './setup-pglite.js';`)) {
    c = `import { injectPgliteMock } from './setup-pglite.js';\n` + c;
    changed = true;
  }
  
  // Inject before const app = express();
  if (c.includes('const app = express();') && !c.includes('await injectPgliteMock();')) {
    c = c.replace('const app = express();', 'await injectPgliteMock();\n  const app = express();');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync('tests/' + f, c);
    console.log('Injected PGlite mock into ' + f);
  }
}
