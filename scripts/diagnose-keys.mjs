import { translations } from '../src/i18n/I18nProvider.tsx';

console.log('Object.keys(translations.en).length:', Object.keys(translations.en).length);
console.log('Object.keys(translations.ar).length:', Object.keys(translations.ar).length);
console.log('Object.keys(translations.ku).length:', Object.keys(translations.ku).length);

console.log('reviews.propertyRatingHeading in en?', translations.en['reviews.propertyRatingHeading']);
console.log('reviews.propertyRatingHeading in ar?', translations.ar['reviews.propertyRatingHeading']);
console.log('reviews.propertyRatingHeading in ku?', translations.ku['reviews.propertyRatingHeading']);
