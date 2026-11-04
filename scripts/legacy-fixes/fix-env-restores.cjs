const fs = require('fs');

const files = fs.readdirSync('tests').filter(f => f.endsWith('.test.ts'));
for (const f of files) {
  let c = fs.readFileSync('tests/' + f, 'utf8');
  
  // if it has 'delete process.env.SQL_HOST' but no 'process.env.SQL_HOST = '
  // before the next suite, add it.
  
  c = c.replace(/console\.log\('\\n--- SUITE 2:[^\n]*\n/, "process.env.SQL_HOST = '127.0.0.1';\n    process.env.SQL_DB_NAME = 'homehub';\n    $&");
  c = c.replace(/console\.log\('\\n--- SUITE 3:[^\n]*\n/, "process.env.SQL_HOST = '127.0.0.1';\n    process.env.SQL_DB_NAME = 'homehub';\n    $&");
  c = c.replace(/console\.log\('\\n--- SUITE 4:[^\n]*\n/, "process.env.SQL_HOST = '127.0.0.1';\n    process.env.SQL_DB_NAME = 'homehub';\n    $&");
  
  fs.writeFileSync('tests/' + f, c);
}
console.log('Fixed env restores');
