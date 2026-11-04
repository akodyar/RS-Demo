import type { SupportedCurrency } from '../db/schema.js';

export type { SupportedCurrency };

/**
 * Standard central exchange rate for display conversions when live policy is unavailable
 * 1310 IQD per 1 USD (Central Bank of Iraq official rate)
 */
export const DEFAULT_EXCHANGE_RATE_IQD = 1310;

export const isSupportedCurrency = (c: string): c is SupportedCurrency => {
  return c === 'IQD' || c === 'USD';
};

/**
 * Converts monetary amount between IQD and USD
 * Direction:
 *   USD -> IQD: amount * rate (rounded to whole integer IQD)
 *   IQD -> USD: amount / rate (rounded to 2 decimal places USD)
 */
export const convertCurrency = (
  amount: number,
  from: string,
  to: string,
  exchangeRateIqd: number = DEFAULT_EXCHANGE_RATE_IQD
): number => {
  const fromClean = (from || 'IQD').toUpperCase();
  const toClean = (to || 'IQD').toUpperCase();
  if (fromClean === toClean) return amount;
  if (fromClean === 'USD' && toClean === 'IQD') {
    return Math.round(amount * exchangeRateIqd);
  }
  if (fromClean === 'IQD' && toClean === 'USD') {
    return Math.round((amount / exchangeRateIqd) * 100) / 100;
  }
  return amount;
};

/**
 * Monetary precision rounding:
 * USD -> 2 decimal places
 * IQD -> integer dinars
 */
export const roundCurrency = (amount: number, currency: string = 'IQD'): number => {
  const c = (currency || 'IQD').toUpperCase();
  if (c === 'USD') {
    return Math.round(amount * 100) / 100;
  }
  return Math.round(amount);
};

export const formatCurrency = (amount: number, currency: string = 'IQD', locale: string = 'ku') => {
  const cleanCurr = (currency || 'IQD').toUpperCase();
  const isUSD = cleanCurr === 'USD';
  const minDigits = isUSD ? 2 : 0;
  const maxDigits = isUSD ? 2 : 0;
  const roundedAmount = roundCurrency(amount, cleanCurr);

  try {
    const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-IQ' : 'en-US', {
      style: 'currency',
      currency: cleanCurr,
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    }).format(roundedAmount);

    if (cleanCurr === 'IQD') {
      const numOnly = formatted.replace('IQD', '').trim();
      if (locale === 'ku' || locale === 'ar') {
        return `${numOnly} ${isolateLTR('د.ع')}`;
      }
      return `${numOnly} IQD`;
    }
    if (cleanCurr === 'USD' && (locale === 'ku' || locale === 'ar')) {
      return isolateLTR(formatted);
    }
    return formatted;
  } catch (e) {
    return `${roundedAmount} ${cleanCurr}`;
  }
};

/**
 * Safely formats date values for display across locales.
 * Defensively renders neutral placeholder '—' for missing, empty, or invalid date values.
 */
export const formatDate = (
  dateInput: string | number | Date | null | undefined,
  locale: string = 'ku',
  placeholder: string = '—'
): string => {
  if (dateInput === null || dateInput === undefined) return placeholder;
  if (typeof dateInput === 'string' && dateInput.trim() === '') return placeholder;

  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      return placeholder;
    }
    return new Intl.DateTimeFormat(locale === 'ku' || locale === 'ar' ? 'ar-IQ' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  } catch {
    return placeholder;
  }
};

export const formatNumber = (num: number, locale: string = 'ku') => {
  try {
    return new Intl.NumberFormat(locale === 'ku' || locale === 'ar' ? 'ar-IQ' : 'en-US').format(num);
  } catch (e) {
    return num.toString();
  }
};

/**
 * Bidirectional Unicode Isolation (Finding 15 remediation):
 * Enforces Left-to-Right embedding around phone numbers, UUIDs, currencies, and technical IDs
 * inside RTL Kurdish/Arabic layouts using Unicode LRE (U+202A) / PDF (U+202C).
 */
export const isolateLTR = (text: string | number): string => {
  return `\u202A${text}\u202C`;
};
