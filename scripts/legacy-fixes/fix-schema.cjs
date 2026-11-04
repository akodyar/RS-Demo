const fs = require('fs');

let schemaStr = fs.readFileSync('src/db/schema.ts', 'utf8');

// Replace `id: text('id').primaryKey()` with `id: text('id').primaryKey().default(sql\`gen_random_uuid()^\`)`
// Wait, actually let's just replace `id: text('id').primaryKey(),` with `id: text('id').primaryKey().default(sql\`gen_random_uuid()\`),`

schemaStr = schemaStr.replace(/id: text\('id'\)\.primaryKey\(\),/g, 'id: text(\'id\').primaryKey().default(sql`gen_random_uuid()`),');

fs.writeFileSync('src/db/schema.ts', schemaStr);
