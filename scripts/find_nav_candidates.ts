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
    } else if (file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk('./src');
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  // Check for navbar items together
  if (content.includes('چاکسازی') && content.includes('مۆڵکەکان')) {
    console.log('Matches چاکسازی + مۆڵکەکان:', f);
  }
}
