const fs = require('fs');
const path = require('path');
const d = fs.readdirSync('tests');
d.forEach(f => {
  if (f.endsWith('.ts')) {
    let c = fs.readFileSync('tests/' + f, 'utf8');
    if (c.includes("data.error === 'DATABASE_NOT_CONFIGURED' || data.code === 'SERVICE_UNAVAILABLE'")) {
      c = c.replace(/data\.error === 'DATABASE_NOT_CONFIGURED' \|\| data\.code === 'SERVICE_UNAVAILABLE'/g, "data.code === 'DATABASE_NOT_CONFIGURED' || data.error === 'SERVICE_UNAVAILABLE'");
      fs.writeFileSync('tests/' + f, c);
      console.log('Fixed', f);
    }
  }
});
