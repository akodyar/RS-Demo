import fs from 'fs';
import path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (!fullPath.includes('node_modules') && !fullPath.includes('.git') && !fullPath.includes('dist')) {
        results = results.concat(walk(fullPath));
      }
    } else if (/\.(tsx|ts|jsx|js|html)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk('./src');
console.log(`Auditing ${files.length} files...`);
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const hasSettlements = content.includes('شایستە داراییەکان') || content.includes('settlements');
  const hasMaintenance = content.includes('چاکسازی') || content.includes('maintenance');
  const hasPoints = content.includes('خاڵ و پاداشت') || content.includes('points');
  const hasReports = content.includes('ڕاپۆرتە داراییەکان') || content.includes('reports');

  if (hasSettlements && hasMaintenance && hasPoints && hasReports) {
    console.log('Match:', f);
  }
}
