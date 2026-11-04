import * as fs from 'fs';
import * as path from 'path';

const searchTerms = ['0.05', '5%', 'commission', 'platformCommission'];
const directoriesToScan = ['./src', './docs', './tests'];

function scanDirectory(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (stat.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.md'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const term of searchTerms) {
          if (line.includes(term)) {
            console.log(`[${term}] ${fullPath}:${i + 1} - ${line.trim()}`);
          }
        }
      }
    }
  }
}

console.log("--- LEGACY LOGIC SCAN ---");
directoriesToScan.forEach(dir => scanDirectory(dir));
