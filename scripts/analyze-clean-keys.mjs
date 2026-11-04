import { translations } from '../src/i18n/I18nProvider.tsx';

const enSet = new Set(Object.keys(translations.en));
const arSet = new Set(Object.keys(translations.ar));
const kuSet = new Set(Object.keys(translations.ku));

console.log('EN keys count:', enSet.size);
console.log('AR keys count:', arSet.size);
console.log('KU keys count:', kuSet.size);

const inArNotEn = [...arSet].filter(k => !enSet.has(k));
const inKuNotEn = [...kuSet].filter(k => !enSet.has(k));
const inEnNotAr = [...enSet].filter(k => !arSet.has(k));
const inEnNotKu = [...enSet].filter(k => !kuSet.has(k));

console.log('In AR but not EN:', inArNotEn.length);
console.log('In KU but not EN:', inKuNotEn.length);
console.log('In EN but not AR:', inEnNotAr.length);
console.log('In EN but not KU:', inEnNotKu.length);

const allKeys = new Set([...enSet, ...arSet, ...kuSet]);
console.log('Total unique keys across all three:', allKeys.size);

// Sample keys in AR/KU but not EN
console.log('Sample keys in AR but not EN:', inArNotEn.slice(0, 10));
console.log('Sample keys in KU but not EN:', inKuNotEn.slice(0, 10));
