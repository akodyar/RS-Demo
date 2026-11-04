import fs from 'node:fs';
import path from 'node:path';

const content = fs.readFileSync(path.join(process.cwd(), 'src', 'i18n', 'I18nProvider.tsx'), 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Vendor Dashboard')) {
    console.log(`Line ${i + 1}: ${lines[i]}`);
  }
}
