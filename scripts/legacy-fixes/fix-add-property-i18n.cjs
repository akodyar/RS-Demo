const fs = require('fs');
let s = fs.readFileSync('src/pages/AddPropertyPage.tsx', 'utf8');

s = s.replace(
  "const STEPS = [\n  'Type',\n  'Basic Info',\n  'Location',\n  'Details',\n  'Amenities',\n  'Ownership',\n  'Review'\n];",
  `const STEPS_KEYS = [
  'property.type',
  'property.basic_info',
  'property.location',
  'property.details',
  'property.amenities',
  'property.ownership',
  'property.review'
];`
);

s = s.replace(
  "{STEPS.map((step, idx) => (",
  "{STEPS_KEYS.map((stepKey, idx) => ("
);

s = s.replace(
  "{step}",
  "{t(stepKey)}"
);

s = s.replace(
  "STEPS.length",
  "STEPS_KEYS.length"
).replace(
  "STEPS.length",
  "STEPS_KEYS.length"
).replace(
  "STEPS.length",
  "STEPS_KEYS.length"
);

s = s.replace("Add New Property", "{t('property.add_new')}");
s = s.replace("Register a new property into the portfolio.", "{t('property.add.subtitle')}");
s = s.replace("What type of property is this?", "{t('property.type.question')}");
s = s.replace("Apartment Building", "{t('property.type.apartment')}");
s = s.replace("Villa / House", "{t('property.type.villa')}");
s = s.replace("label: 'Commercial'", "label: t('property.type.commercial')");
s = s.replace("label: 'Industrial'", "label: t('property.type.industrial')");

fs.writeFileSync('src/pages/AddPropertyPage.tsx', s);
