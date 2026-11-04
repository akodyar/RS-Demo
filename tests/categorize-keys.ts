import fs from 'node:fs';
import path from 'node:path';

const keys: any[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests', 'keys-needing-completion.json'), 'utf-8')
);

const domains: Record<string, any[]> = {};
for (const item of keys) {
  const parts = item.key.split('.');
  const prefix = parts.length > 1 ? parts[0] : 'common_phrases';
  if (!domains[prefix]) domains[prefix] = [];
  domains[prefix].push(item);
}

for (const [prefix, list] of Object.entries(domains)) {
  console.log(`Domain [${prefix}]: ${list.length} keys`);
}
