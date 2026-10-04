import { describe, test, expect } from 'vitest';
import { enabledProviders, providerById, canDisconnect, providerErrorMessage } from './signInProviders';

describe('enabledProviders', () => {
  test('off unless listed', () => {
    expect(enabledProviders(undefined)).toEqual([]);
    expect(enabledProviders('')).toEqual([]);
  });

  test('reads a comma list in order, forgiving case, spaces, repeats and unknowns', () => {
    expect(enabledProviders('microsoft, Google ,google,facebook').map((p) => p.key)).toEqual(['microsoft', 'google']);
    expect(enabledProviders('google')[0]).toMatchObject({ id: 'google.com', label: 'Google' });
  });
});

test('providerById', () => {
  expect(providerById('microsoft.com').label).toBe('Microsoft');
  expect(providerById('password')).toBeNull();
});

test('a sign-in method can be disconnected only while another remains', () => {
  expect(canDisconnect(['password', 'google.com'], 'google.com')).toBe(true);
  expect(canDisconnect(['google.com', 'microsoft.com'], 'google.com')).toBe(true);
  expect(canDisconnect(['google.com'], 'google.com')).toBe(false);
  expect(canDisconnect([], 'google.com')).toBe(false);
});

describe('providerErrorMessage', () => {
  test('closing the window is not an error', () => {
    expect(providerErrorMessage('auth/popup-closed-by-user', 'Google')).toBe('');
    expect(providerErrorMessage('auth/cancelled-popup-request', 'Google')).toBe('');
  });

  test('says what to do next', () => {
    expect(providerErrorMessage('auth/account-exists-with-different-credential', 'Microsoft'))
      .toMatch(/Sign in with your password below once, and Microsoft will be connected/);
    expect(providerErrorMessage('magnaflow/no-profile', 'Google')).toMatch(/No MagnaFlow account uses this Google address/);
    expect(providerErrorMessage('auth/operation-not-allowed', 'Google')).toMatch(/isn't set up/);
    expect(providerErrorMessage('auth/popup-blocked')).toMatch(/Allow pop-ups/);
  });

  test('anything else is left to the general messages', () => {
    expect(providerErrorMessage('auth/network-request-failed', 'Google')).toBeNull();
  });
});
