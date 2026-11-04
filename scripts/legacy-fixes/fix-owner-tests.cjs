const fs = require('fs');
const d = fs.readdirSync('tests');
d.forEach(f => {
  if (f.endsWith('.ts')) {
    let c = fs.readFileSync('tests/' + f, 'utf8');
    c = c.replace(/res[a-zA-Z0-9_]*\.status === 503 && ([a-zA-Z0-9_]+)\.error === 'DATABASE_NOT_CONFIGURED'/g, "$& || $1.code === 'DATABASE_NOT_CONFIGURED'");
    fs.writeFileSync('tests/' + f, c);
    console.log('Fixed', f);
  }
});
