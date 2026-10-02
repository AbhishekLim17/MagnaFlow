import React from 'react';
import { describe, test, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

const Toggle = () => {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme}>{theme}</button>;
};

// The <meta> lives in <head>, outside anything Testing Library can query.
// eslint-disable-next-line testing-library/no-node-access
const meta = () => document.querySelector('meta[name="theme-color"]');

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
  document.head.insertAdjacentHTML('beforeend', '<meta name="theme-color" content="#f1f3f7">');
  return () => meta()?.remove();
});

describe('ThemeProvider', () => {
  test('starts light, and remembers a switch to dark', async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('light');
    expect(document.documentElement).not.toHaveClass('dark');

    await user.click(screen.getByRole('button'));

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('magnaflow-theme')).toBe('dark');
  });

  test('a saved dark choice is applied on the first render', () => {
    window.localStorage.setItem('magnaflow-theme', 'dark');
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  test("the phone toolbar colour follows the theme", async () => {
    const user = userEvent.setup();
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    expect(meta()).toHaveAttribute('content', '#f1f3f7');

    await user.click(screen.getByRole('button'));
    expect(meta()).toHaveAttribute('content', '#10121e');

    await user.click(screen.getByRole('button'));
    expect(meta()).toHaveAttribute('content', '#f1f3f7');
  });

  test('works when storage is blocked', async () => {
    const user = userEvent.setup();
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try {
      render(<ThemeProvider><Toggle /></ThemeProvider>);
      expect(screen.getByRole('button')).toHaveTextContent('light');
      await user.click(screen.getByRole('button'));
      expect(document.documentElement).toHaveClass('dark');
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
