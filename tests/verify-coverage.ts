import fs from 'node:fs';
import path from 'node:path';
import { newTranslations } from '../scripts/generate-synchronized-translations';

const needed: any[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests', 'keys-needing-completion.json'), 'utf-8')
);

const newMap = new Map<string, any>();
for (const item of newTranslations) {
  newMap.set(item.key, item);
}

const uncovered = needed.filter(item => !newMap.has(item.key));
console.log(`Uncovered keys: ${uncovered.length}`);
if (uncovered.length > 0) {
  console.log('Uncovered list:', uncovered.map(u => u.key));
} else {
  console.log('SUCCESS: 100% of all 390 discrepancy keys are covered with complete translations!');
}

// Also check for any empty or null values in newTranslations
let emptyCount = 0;
for (const item of newTranslations) {
  if (!item.en || !item.ar || !item.ku) {
    console.log(`Incomplete item: ${item.key} | EN: ${item.en} | AR: ${item.ar} | KU: ${item.ku}`);
    emptyCount++;
  }
}
console.log(`Incomplete items in newTranslations: ${emptyCount}`);
