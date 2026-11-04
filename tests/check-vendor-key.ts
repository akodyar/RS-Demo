import fs from 'node:fs';
import path from 'node:path';
import { translations } from '../src/i18n/I18nProvider';

console.log('Checking translations for "Vendor Dashboard":');
console.log('EN:', translations.en['Vendor Dashboard']);
console.log('AR:', translations.ar['Vendor Dashboard']);
console.log('KU:', translations.ku['Vendor Dashboard']);
