// Firebase provider objects for Google / Microsoft sign-in (see lib/signInProviders for
// which are switched on and how failures are worded).
import { GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

/** A provider that always lets the person choose which account to use. */
export const makeProvider = (key) => {
  const provider = key === 'google'
    ? new GoogleAuthProvider()
    : key === 'microsoft' ? new OAuthProvider('microsoft.com') : null;
  if (!provider) throw new Error(`Unknown sign-in provider: ${key}`);
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

/** The provider credential carried by a failed sign-in, so it can be connected later. */
export const credentialFromError = (key, error) => (key === 'google'
  ? GoogleAuthProvider.credentialFromError(error)
  : OAuthProvider.credentialFromError(error));
