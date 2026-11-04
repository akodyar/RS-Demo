const fs = require('fs');
let s = fs.readFileSync('src/server/routes/properties.ts', 'utf8');
s = s.replace('const propertyId = req.params.propertyId;', 'const propertyId = req.params.propertyId as string;');
fs.writeFileSync('src/server/routes/properties.ts', s);
