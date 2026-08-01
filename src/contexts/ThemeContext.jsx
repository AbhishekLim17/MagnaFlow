// Light/dark theme.
//
// The token layer in index.css already defines a full dark palette; this is
// what actually puts the `dark` class on <html> so those tokens take effect.
// (It is also what keeps them in the stylesheet at all — Tailwind drops the
// `.dark` base block if the class never appears anywhere in the source.)

import React, { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'magnaflow-theme';

const ThemeContext = createContext({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private mode / storage disabled — fall through to the default.
  }
  // Light is the designed default. Following the OS would mean most people
  // never see the light theme the product was actually designed in, so dark
  // is opt-in via the header toggle and then remembered.
  return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    // Literal class names, so Tailwind's scanner can see them.
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persisting is a nicety; the theme still applies for this session.
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
