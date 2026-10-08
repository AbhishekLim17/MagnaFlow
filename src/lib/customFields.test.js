import { test, expect } from 'vitest';
import { fieldProblem, cleanValue, cleanValues, displayValue } from './customFields';

const size = { id: 'size', name: 'Size', type: 'select', options: ['S', 'M', 'L'] };
const cost = { id: 'cost', name: 'Cost centre', type: 'number' };
const golive = { id: 'golive', name: 'Go-live', type: 'date' };
const ref = { id: 'ref', name: 'Client ref', type: 'text' };

test('fieldProblem', () => {
  expect(fieldProblem(size)).toBeNull();
  expect(fieldProblem({ ...ref, name: ' ' })).toMatch(/name/);
  expect(fieldProblem({ ...size, options: ['S'] })).toMatch(/two choices/);
  expect(fieldProblem({ ...size, options: ['S', 'S'] })).toMatch(/once/);
  expect(fieldProblem({ name: 'x', type: 'colour' })).toMatch(/type/);
});

test('values are typed and checked against the field', () => {
  expect(cleanValue(cost, '12,5')).toBe(12.5);
  expect(cleanValue(cost, 'twelve')).toBeNull();
  expect(cleanValue(golive, '2026-11-01')).toBe('2026-11-01');
  expect(cleanValue(golive, 'soon')).toBeNull();
  expect(cleanValue(size, 'M')).toBe('M');
  expect(cleanValue(size, 'XL')).toBeNull();
  expect(cleanValue(ref, '  PO-77  ')).toBe('PO-77');
  expect(cleanValues([size, cost, ref], { size: 'L', cost: '', ref: 'PO-1', gone: 'x' })).toEqual({ size: 'L', ref: 'PO-1' });
});

test('displayValue', () => {
  expect(displayValue(golive, '2026-11-01', () => '1 Nov 2026')).toBe('1 Nov 2026');
  expect(displayValue(cost, 7)).toBe('7');
  expect(displayValue(ref, undefined)).toBe('');
});
