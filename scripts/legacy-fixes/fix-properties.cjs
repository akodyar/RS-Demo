const fs = require('fs');
let s = fs.readFileSync('src/server/routes/properties.ts', 'utf8');
s = s.replace(/\}\);\n\}\);/g, '});');
fs.writeFileSync('src/server/routes/properties.ts', s);
