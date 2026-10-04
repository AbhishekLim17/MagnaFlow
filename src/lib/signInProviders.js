// Google and Microsoft sign-in: which are switched on, and what to say when they fail.
// Pure; the Firebase calls live in AuthContext and ConnectedAccounts.
//
// Off unless VITE_SIGNIN_PROVIDERS lists them ("google", "microsoft" or "google,microsoft"),
// because each provider must first be enabled in the Firebase console (docs/SSO_SETUP.md).
// MagnaFlow has no self-signup: a provider only ever signs someone into a login an admin
// already created, either because the addresses match or because they connected it.

export const PROVIDERS = {
  google: { key: 'google', id: 'google.com', label: 'Google' },
  microsoft: { key: 'microsoft', id: 'microsoft.com', label: 'Microsoft' },
};

/** The providers a flag value switches on, in the order given, ignoring anything unknown. */
export const enabledProviders = (flag) => {
  const keys = String(flag || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return [...new Set(keys)].filter((k) => PROVIDERS[k]).map((k) => PROVIDERS[k]);
};

/** The providers switched on for this build. */
export const configuredProviders = () => enabledProviders(import.meta.env?.VITE_SIGNIN_PROVIDERS);

export const providerById = (providerId) => Object.values(PROVIDERS).find((p) => p.id === providerId) || null;

/**
 * Whether someone may disconnect this sign-in method without locking themselves out:
 * another way in (a password or another provider) must remain.
 * @param {string[]} providerIds  ids from the Firebase user's providerData
 */
export const canDisconnect = (providerIds, providerId) =>
  (providerIds || []).some((id) => id !== providerId);

// The person closed the window or clicked twice: nothing to report.
const QUIET = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request', 'auth/user-cancelled']);

/**
 * A sentence for a failed provider sign-in or connect, or '' when the person simply
 * cancelled, or null when it is not provider-specific (use toUserMessage then).
 */
export const providerErrorMessage = (code, label = 'that account') => {
  if (QUIET.has(code)) return '';
  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    case 'auth/account-exists-with-different-credential':
      return `This email signs in with a password. Sign in with your password below once, and ${label} will be connected for next time.`;
    case 'magnaflow/no-profile':
      return `No MagnaFlow account uses this ${label} address. Sign in with your email and password, or ask your administrator to add you.`;
    case 'auth/operation-not-allowed':
    case 'auth/unauthorized-domain':
      return `Signing in with ${label} isn't set up for this site yet. Use your email and password.`;
    case 'auth/credential-already-in-use':
      return `That ${label} account is already connected to another MagnaFlow login.`;
    case 'auth/provider-already-linked':
      return `${label} is already connected.`;
    case 'auth/requires-recent-login':
      return 'For your security, sign out and sign in again, then try once more.';
    case 'auth/no-such-provider':
      return `${label} isn't connected.`;
    default:
      return null;
  }
};
