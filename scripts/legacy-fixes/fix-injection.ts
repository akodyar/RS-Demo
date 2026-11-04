import fs from 'fs';

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));

for (let f of files) {
  if (['finding15-readiness.test.ts', 'gap1-admin-db.test.ts', 'real-postgres-integration.test.ts', 'setup-pglite.ts'].includes(f)) continue;

  let c = fs.readFileSync('tests/' + f, 'utf8');
  let changed = false;
  
  c = c.replace(/await injectPgliteMock\(\);\s+const app = express\(\);/g, 'const app = express();');

  // Then inject before PART 2
  const part2Regex = /(console\.log\('\\n--- PART 2:)/;
  if (part2Regex.test(c) && !c.includes('await injectPgliteMock();')) {
    c = c.replace(part2Regex, 'await injectPgliteMock();\n    $1');
    changed = true;
  } else if (c.includes('const resUnauth = await fetch') && !c.includes('await injectPgliteMock();')) {
    // If no PART 2, inject before the first fetch
    c = c.replace('const resUnauth = await fetch', 'await injectPgliteMock();\n    const resUnauth = await fetch');
    changed = true;
  } else if (!c.includes('await injectPgliteMock();')) {
    // Fallback: inject after app.use('/api', apiRouter);
    c = c.replace("app.use('/api', apiRouter);", "app.use('/api', apiRouter);\n  await injectPgliteMock();");
    changed = true;
  }

  if (c !== fs.readFileSync('tests/' + f, 'utf8')) {
    fs.writeFileSync('tests/' + f, c);
    console.log('Fixed PGlite mock injection in ' + f);
  }
}
