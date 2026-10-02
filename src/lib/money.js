// Money, in one place.
//
// Budgets used to default to USD and were formatted with the browser's own locale, so
// the same project read "$1,000,000" on one machine and "₹10,00,000" on another, and
// the currency list lived in two files. One default, one list, one format.

// The app's audience reads day-first dates and lakh/crore grouping (see lib/format.js).
const MONEY_LOCALE = 'en-IN';

export const DEFAULT_CURRENCY = 'INR';
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD'];

/**
 * "₹12,50,000", "₹499.50", "$1,000". Whole amounts show no decimals; amounts with
 * paise/cents always show two (a 499.50 expense must not read as 500).
 * A currency code Intl does not know falls back to "1,000 XYZ" rather than throwing.
 */
export const formatMoney = (amount, currency = DEFAULT_CURRENCY) => {
  const value = Number(amount);
  const n = Number.isFinite(value) ? value : 0;
  const whole = Number.isInteger(n);
  try {
    return new Intl.NumberFormat(MONEY_LOCALE, {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(n);
  } catch {
    return `${new Intl.NumberFormat(MONEY_LOCALE).format(n)} ${currency}`;
  }
};
