import { describe, test, expect } from 'vitest';
import { formatMoney, CURRENCIES, DEFAULT_CURRENCY } from './money';

// Intl puts a no-break space between some symbols and digits; compare without it.
const plain = (s) => s.replace(/ /g, ' ');

describe('formatMoney', () => {
  test('rupees use lakh/crore grouping', () => {
    expect(plain(formatMoney(1250000, 'INR'))).toBe('₹12,50,000');
    expect(plain(formatMoney(10000000, 'INR'))).toBe('₹1,00,00,000');
  });

  test('whole amounts have no decimals, fractional ones always two', () => {
    expect(plain(formatMoney(500, 'INR'))).toBe('₹500');
    expect(plain(formatMoney(499.5, 'INR'))).toBe('₹499.50');
    expect(plain(formatMoney(0.07, 'INR'))).toBe('₹0.07');
  });

  test('other currencies keep their own symbol', () => {
    expect(plain(formatMoney(1000, 'USD'))).toBe('$1,000');
    expect(plain(formatMoney(1000, 'EUR'))).toBe('€1,000');
    expect(plain(formatMoney(1000, 'GBP'))).toBe('£1,000');
  });

  test('missing or nonsense amounts read as zero, not NaN', () => {
    expect(plain(formatMoney(undefined, 'INR'))).toBe('₹0');
    expect(plain(formatMoney(null, 'INR'))).toBe('₹0');
    expect(plain(formatMoney('abc', 'INR'))).toBe('₹0');
    expect(plain(formatMoney('250', 'INR'))).toBe('₹250');
  });

  test('negative amounts (a budget overrun) keep the sign', () => {
    expect(plain(formatMoney(-1500, 'INR'))).toMatch(/^-₹1,500$/);
  });

  test('no currency means the default; an unknown code does not throw', () => {
    expect(formatMoney(5)).toBe(formatMoney(5, DEFAULT_CURRENCY));
    expect(plain(formatMoney(1000, 'NOT-A-CODE'))).toBe('1,000 NOT-A-CODE');
  });

  test('the default is one of the offered currencies, and listed first', () => {
    expect(CURRENCIES[0]).toBe(DEFAULT_CURRENCY);
  });
});
