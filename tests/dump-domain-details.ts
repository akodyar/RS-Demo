import fs from 'node:fs';
import path from 'node:path';

const keys: any[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests', 'keys-needing-completion.json'), 'utf-8')
);

const groups: Record<string, any[]> = {};
for (const item of keys) {
  const parts = item.key.split('.');
  const cat = parts.length > 1 ? parts[0] : 'phrases';
  if (!groups[cat]) groups[cat] = [];
  groups[cat].push(item);
}

let out = '';
for (const [cat, list] of Object.entries(groups)) {
  out += `\n================== CATEGORY: ${cat} (${list.length}) ==================\n`;
  for (const item of list) {
    out += `KEY: "${item.key}"\n`;
    out += `  EN: ${JSON.stringify(item.en)}\n`;
    out += `  AR: ${JSON.stringify(item.ar)}\n`;
    out += `  KU: ${JSON.stringify(item.ku)}\n`;
    out += `  DEF: ${JSON.stringify(item.defaultValue)}\n`;
  }
}

fs.writeFileSync(path.join(process.cwd(), 'tests', 'domain-details.txt'), out, 'utf-8');
console.log('Saved to tests/domain-details.txt in UTF-8');
