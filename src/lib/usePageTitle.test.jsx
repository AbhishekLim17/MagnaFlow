import { describe, test, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { formatTitle, usePageTitle } from './usePageTitle';

describe('page titles', () => {
  test('a screen name comes first, the product second', () => {
    expect(formatTitle('Tasks')).toBe('Tasks · MagnaFlow');
    expect(formatTitle('')).toBe('MagnaFlow');
    expect(formatTitle(undefined)).toBe('MagnaFlow');
  });
  test('the hook sets and updates the document title', () => {
    const { rerender } = renderHook(({ t }) => usePageTitle(t), { initialProps: { t: 'Budget' } });
    expect(document.title).toBe('Budget · MagnaFlow');
    rerender({ t: 'Reports' });
    expect(document.title).toBe('Reports · MagnaFlow');
  });
});
