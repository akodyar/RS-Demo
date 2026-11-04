const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src', 'server', 'routes');
const filesToClean = ['crm.ts', 'communications.ts', 'webhooks.ts'];

for (const file of filesToClean) {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) continue;
  let content = fs.readFileSync(fp, 'utf8');

  // Remove isDatabaseConfigured definition and usages
  content = content.replace(/const isDatabaseConfigured[^}]+};\n+/g, '');
  content = content.replace(/const sendDbNotConfigured[^}]+};\n+/g, '');
  content = content.replace(/^[ \t]*if \(!isDatabaseConfigured\(\)\) return sendDbNotConfigured\(res\);\n/gm, '');
  
  // Also make sure to remove duplicate blank lines
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

  fs.writeFileSync(fp, content);
  console.log(`Cleaned ${file}`);
}
