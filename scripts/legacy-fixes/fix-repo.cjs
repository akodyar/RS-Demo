const fs = require('fs');
let s = fs.readFileSync('src/server/repositories/properties.ts', 'utf8');

s = s.replace(
  "}  async getPropertyById(id: string) {",
  "  async getPropertyById(id: string) {"
);
fs.writeFileSync('src/server/repositories/properties.ts', s);
