import fs from 'fs';

const content = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

function getKeysMatching(prefix) {
  const regex = new RegExp(`['"](${prefix}[^'"]*)['"]\\s*:\\s*['"]((?:\\\\['"]|[^'"])*)['"]`, 'g');
  const enMatches = [];
  const enStart = content.indexOf('  en: {');
  const arStart = content.indexOf('  ar: {');
  const kuStart = content.indexOf('  ku: {');
  const enSlice = content.substring(enStart, arStart);
  const arSlice = content.substring(arStart, kuStart);
  const kuSlice = content.substring(kuStart);

  function extract(slice) {
    const map = new Map();
    let m;
    const r = new RegExp(`['"](${prefix}[^'"]*)['"]\\s*:\\s*['"]((?:\\\\['"]|[^'"])*)['"]`, 'g');
    while ((m = r.exec(slice)) !== null) {
      map.set(m[1], m[2]);
    }
    return map;
  }

  const enMap = extract(enSlice);
  const arMap = extract(arSlice);
  const kuMap = extract(kuSlice);

  return { enMap, arMap, kuMap };
}

const homeKeys = getKeysMatching('home.');
console.log('home.* keys count:', homeKeys.enMap.size);
for (const [k, v] of homeKeys.enMap.entries()) {
  console.log(`[${k}]`);
  console.log(`  en: ${v}`);
  console.log(`  ar: ${homeKeys.arMap.get(k)}`);
  console.log(`  ku: ${homeKeys.kuMap.get(k)}`);
}
