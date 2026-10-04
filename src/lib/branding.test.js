import { describe, test, expect } from 'vitest';
import {
  normalizeHex, contrastRatio, textOn, LIGHT_TEXT, DARK_TEXT, logoProblem, brandingFromDoc, brandingToDoc, MAX_LOGO_CHARS,
} from './branding';

describe('normalizeHex', () => {
  test('accepts the usual ways of writing a colour', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex(' 1D4ED8 ')).toBe('#1d4ed8');
    expect(normalizeHex('#1d4ed8')).toBe('#1d4ed8');
  });

  test('anything else is no colour', () => {
    for (const bad of ['', null, undefined, 'blue', '#12345', '#1234567', 'rgb(0,0,0)']) expect(normalizeHex(bad)).toBeNull();
  });
});

describe('contrast', () => {
  test('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  test('text on an accent always reaches 4.5:1', () => {
    expect(textOn('#1d4ed8')).toBe(LIGHT_TEXT);
    expect(textOn('#facc15')).toBe(DARK_TEXT);
    for (let v = 0; v <= 255; v += 15) {
      const hex = `#${v.toString(16).padStart(2, '0').repeat(3)}`;
      expect(contrastRatio(hex, textOn(hex))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('logo', () => {
  test('raster images as data URLs, within the size cap', () => {
    expect(logoProblem(null)).toBeNull();
    expect(logoProblem('data:image/png;base64,iVBORw0KGgo=')).toBeNull();
    expect(logoProblem('data:image/svg+xml;base64,PHN2Zz4=')).toMatch(/PNG, JPG/);
    expect(logoProblem('https://example.com/logo.png')).toMatch(/PNG, JPG/);
    expect(logoProblem(`data:image/png;base64,${'A'.repeat(MAX_LOGO_CHARS)}`)).toMatch(/too detailed/);
  });
});

test('reading and saving keep only clean values', () => {
  expect(brandingFromDoc(undefined)).toEqual({ accent: null, logo: null, welcome: '' });
  expect(brandingFromDoc({ accent: 'red', logo: 'javascript:alert(1)', welcome: 5 })).toEqual({ accent: null, logo: null, welcome: '' });
  expect(brandingToDoc({ accent: '0f766e', logo: '', welcome: '  Hello  ' })).toEqual({ accent: '#0f766e', logo: null, welcome: 'Hello' });
});
