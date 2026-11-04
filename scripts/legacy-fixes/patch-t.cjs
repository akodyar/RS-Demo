const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

s = s.replace('t: (key: string) => string;', 't: (key: string, defaultValue?: string) => string;');
s = s.replace('const t = (key: string): string => {\n    return translations[language][key] || key;\n  };', 'const t = (key: string, defaultValue?: string): string => {\n    return translations[language][key] || defaultValue || key;\n  };');

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
