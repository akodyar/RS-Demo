const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

const tenantKu = `
    // TENANT
    'tenant.error.lease': 'نەتوانرا زانیارییەکانی گرێبەست بهێنرێت',
    'tenant.no_lease': 'لە ئێستادا هیچ گرێبەستێکی چالاکت نییە.',
    'tenant.action_required': 'پێویستی بە کردار هەیە بۆ سووڕی پارەدانی ئێستا',
    'tenant.due': 'شایستەی پارەدان: ',
    'tenant.next_cycle': 'سووڕی داهاتوو',
    'tenant.mock.rent': 'کرێی ئەم مانگە',
    'tenant.mock.paid': 'پارەکە دراوە',
    'currency.iqd': 'دیناری عێراقی',
    'core.history': 'مێژوو',
`;

s = s.replace("ku: {\n    // Canonical Glossary Inject", "ku: {\n    // Canonical Glossary Inject\n" + tenantKu);
fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
