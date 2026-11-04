const fs = require('fs');
let s = fs.readFileSync('src/i18n/I18nProvider.tsx', 'utf8');

// EN
s = s.replace(
  /en: \{([\s\S]*?)'nav\.dashboard'/,
  "en: {$1'property.add_new': 'Add New Property',\n    'property.add.subtitle': 'Register a new property into the portfolio.',\n    'property.type': 'Type',\n    'property.basic_info': 'Basic Info',\n    'property.location': 'Location',\n    'property.details': 'Details',\n    'property.amenities': 'Amenities',\n    'property.ownership': 'Ownership',\n    'property.review': 'Review',\n    'property.type.question': 'What type of property is this?',\n    'property.type.apartment': 'Apartment Building',\n    'property.type.villa': 'Villa / House',\n    'property.type.commercial': 'Commercial',\n    'property.type.industrial': 'Industrial',\n\n    'nav.dashboard'"
);

// KU
s = s.replace(
  /ku: \{([\s\S]*?)'nav\.dashboard'/,
  "ku: {$1'property.add_new': 'زیادکردنی موڵکی نوێ',\n    'property.add.subtitle': 'موڵکێکی نوێ تۆمار بکە لە پۆرتفۆلیۆکەدا.',\n    'property.type': 'جۆر',\n    'property.basic_info': 'زانیاری سەرەتایی',\n    'property.location': 'شوێن',\n    'property.details': 'وردەکارییەکان',\n    'property.amenities': 'خزمەتگوزارییەکان',\n    'property.ownership': 'خاوەندارێتی',\n    'property.review': 'پێداچوونەوە',\n    'property.type.question': 'جۆری ئەم موڵکە چییە؟',\n    'property.type.apartment': 'باڵەخانەی نیشتەجێبوون',\n    'property.type.villa': 'ڤێلا / خانوو',\n    'property.type.commercial': 'بازرگانی',\n    'property.type.industrial': 'پیشەسازی',\n\n    'nav.dashboard'"
);

fs.writeFileSync('src/i18n/I18nProvider.tsx', s);
