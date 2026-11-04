import fs from 'fs';

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));

for (let f of files) {
  let c = fs.readFileSync('tests/' + f, 'utf8');
  let changed = false;
  
  // The block to remove:
  // process.env.DATABASE_URL = 'postgres://fake:fake@127.0.0.1/fake';
  // (global as any)._postgresPool = { ... };
  
  const mockRegex = /    process\.env\.DATABASE_URL = 'postgres:\/\/fake:fake@127\.0\.0\.1\/fake';\n    \(global as any\)\._postgresPool = \{[\s\S]*?end: async \(\) => \{\} \n    \};\n/g;
  
  if (mockRegex.test(c)) {
    c = c.replace(mockRegex, '');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync('tests/' + f, c);
    console.log('Removed mock from ' + f);
  }
}
