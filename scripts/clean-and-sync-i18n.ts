import * as fs from 'fs';
import * as path from 'path';
import { translationDictionary } from './remediate-localization-dictionaries.js';

const i18nPath = path.resolve('src/i18n/I18nProvider.tsx');
let content = fs.readFileSync(i18nPath, 'utf8');

// We want to replace each key in the file directly, or update existing occurrences
// Let's iterate over every key in translationDictionary:
let enUpdates = 0;
let arUpdates = 0;
let kuUpdates = 0;

// Find the boundaries of en, ar, ku
const enStart = content.indexOf('  en: {');
const arStart = content.indexOf('  ar: {', enStart);
const kuStart = content.indexOf('  ku: {', arStart);
const kuEnd = content.indexOf('\n  }\n};', kuStart);

if (enStart === -1 || arStart === -1 || kuStart === -1 || kuEnd === -1) {
  console.error('Could not find dictionary boundaries:', { enStart, arStart, kuStart, kuEnd });
  process.exit(1);
}

let enSection = content.substring(enStart, arStart);
let arSection = content.substring(arStart, kuStart);
let kuSection = content.substring(kuStart, kuEnd + 4);

// Function to update or append a key in a section
function updateSection(section: string, lang: 'en' | 'ar' | 'ku'): string {
  let lines = section.split('\n');
  const dict = translationDictionary;

  for (const [key, val] of Object.entries(dict)) {
    const targetVal = val[lang].replace(/'/g, "\\'");
    const newLine = `    '${key}': '${targetVal}',`;
    const keyPattern = new RegExp(`^\\s*'${key.replace(/\./g, '\\.')}'\\s*:.*$`);

    let replaced = false;
    for (let i = 0; i < lines.length; i++) {
      if (keyPattern.test(lines[i])) {
        lines[i] = newLine;
        replaced = true;
      }
    }

    if (!replaced) {
      // Find where to insert (before the last line of section which is usually closing brace)
      const lastLineIdx = lines.length - 1;
      lines.splice(lastLineIdx, 0, newLine);
    }
  }

  // Deduplicate lines with exact same key in section
  const seenKeys = new Set<string>();
  const dedupedLines: string[] = [];
  const keyExtractRegex = /^\s*'([a-zA-Z0-9_.-]+)'\s*:/;

  // We iterate backwards so the LAST occurrence (our latest update) wins
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = lines[i].match(keyExtractRegex);
    if (match) {
      const k = match[1];
      if (seenKeys.has(k)) {
        // Skip earlier duplicate!
        continue;
      }
      seenKeys.add(k);
    }
    dedupedLines.unshift(lines[i]);
  }

  return dedupedLines.join('\n');
}

console.log('Updating en section...');
enSection = updateSection(enSection, 'en');
console.log('Updating ar section...');
arSection = updateSection(arSection, 'ar');
console.log('Updating ku section...');
kuSection = updateSection(kuSection, 'ku');

const updatedContent = content.substring(0, enStart) +
  enSection +
  arSection +
  kuSection +
  content.substring(kuEnd + 4);

fs.writeFileSync(i18nPath, updatedContent, 'utf8');
console.log('Successfully updated and deduped all sections in I18nProvider.tsx!');
