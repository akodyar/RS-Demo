const fs = require('fs');
const path = require('path');

const dir = 'src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') && f.includes('Workspace'));

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const tCount = (content.match(/t\(/g) || []).length;
  console.log(`${file}: ${tCount} translation keys used.`);
}
