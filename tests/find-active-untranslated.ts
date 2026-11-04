import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) results = results.concat(walk(fullPath));
    else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) results.push(fullPath);
  });
  return results;
}

const files = walk('src');
const keysInCode = new Set<string>();
const keyRegex = /t\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = keyRegex.exec(content)) !== null) {
    keysInCode.add(match[1]);
  }
});

console.log('Total unique keys invoked in src code:', keysInCode.size);
const untranslated = JSON.parse(fs.readFileSync('tests/untranslated-ku.json', 'utf8'));
const activeUntranslated = untranslated.filter((item: any) => keysInCode.has(item.key));
console.log('Total untranslated in ku:', untranslated.length);
console.log('Untranslated in ku that are ACTIVELY used in code:', activeUntranslated.length);
fs.writeFileSync('tests/active-untranslated.json', JSON.stringify(activeUntranslated, null, 2));

const prefixes: Record<string, number> = {};
activeUntranslated.forEach((item: any) => {
  const p = item.key.split('.')[0];
  prefixes[p] = (prefixes[p] || 0) + 1;
});
console.log('Prefixes breakdown of active untranslated in code:', prefixes);
