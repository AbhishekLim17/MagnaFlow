import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// What the auth listener is handed, controllable from each test.
let authListener;
const signOutMock = vi.fn(async () => {});
const fbUser = { uid: 'u1' };
const authState = { currentUser: fbUser };

const popup = vi.fn();
const linkWithCredential = vi.fn(async () => {});
const signInWithEmailAndPassword = vi.fn();
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...a) => signInWithEmailAndPassword(...a),
  signInWithPopup: (...a) => popup(...a),
  linkWithCredential: (...a) => linkWithCredential(...a),
  getAdditionalUserInfo: (result) => result.info,
  signOut: (...args) => signOutMock(...args),
  onAuthStateChanged: (_auth, cb) => { authListener = cb; return () => {}; },
}));
vi.mock('@/services/authProviderService', () => ({
  makeProvider: (key) => ({ key }),
  credentialFromError: (key, error) => error.credential,
}));
vi.mock('@/config/firebase', () => ({ auth: authState, db: {}, secondaryAuth: {} }));
vi.mock('@/config/functions', () => ({ FUNCTIONS_ENABLED: false, callFunction: vi.fn() }));

const getUserById = vi.fn();
vi.mock('@/services/userService', () => ({
  getUserById: (...a) => getUserById(...a),
  clearCallerProfileCache: vi.fn(),
}));
const getOrganizationById = vi.fn(async () => ({ status: 'active' }));
vi.mock('@/services/organizationService', () => ({
  getOrganizationById: (...a) => getOrganizationById(...a),
}));

const { AuthProvider, useAuth } = await import('./AuthContext');

const fbError = (code) => Object.assign(new Error(`Firebase: ${code}`), { code });

const mount = async () => {
  const utils = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> });
  await waitFor(() => expect(authListener).toBeTypeOf('function'));
  return utils;
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.currentUser = fbUser;
  getOrganizationById.mockResolvedValue({ status: 'active' });
});

describe('restoring a session', () => {
  test('a good profile signs the person in', async () => {
    getUserById.mockResolvedValue({ id: 'u1', role: 'staff', orgId: 'o1', status: 'active' });
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.sessionProblem).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  // The bug: a refresh while the connection blipped dropped the user on the login page
  // with no explanation. They are still signed in; the app could not ask.
  test('an unreachable server is a retryable problem, not a sign-out', async () => {
    getUserById.mockRejectedValue(fbError('unavailable'));
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionProblem).toMatchObject({ kind: 'unreachable' });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  test('retrying after the connection returns restores the session', async () => {
    getUserById.mockRejectedValueOnce(fbError('unavailable'));
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(result.current.sessionProblem).not.toBeNull();

    getUserById.mockResolvedValue({ id: 'u1', role: 'staff', orgId: 'o1', status: 'active' });
    await act(async () => { await result.current.retrySession(); });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.sessionProblem).toBeNull();
  });

  test('a refusal is reported as a failure, with a message, and does not pretend to be a network problem', async () => {
    getUserById.mockRejectedValue(fbError('permission-denied'));
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(result.current.sessionProblem.kind).toBe('failed');
    expect(result.current.sessionProblem.message).toMatch(/permission/i);
  });

  test('a signed-in account with no profile is called out', async () => {
    getUserById.mockResolvedValue(null);
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(result.current.sessionProblem).toMatchObject({ kind: 'no-profile' });
  });

  test('a deactivated account is signed out and told why', async () => {
    getUserById.mockResolvedValue({ id: 'u1', role: 'staff', orgId: 'o1', status: 'inactive' });
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(signOutMock).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.notice).toMatch(/deactivated/i);
  });

  test('a suspended organization is signed out and told why', async () => {
    getUserById.mockResolvedValue({ id: 'u1', role: 'staff', orgId: 'o1', status: 'active' });
    getOrganizationById.mockResolvedValue({ status: 'suspended' });
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(signOutMock).toHaveBeenCalled();
    expect(result.current.notice).toMatch(/suspended/i);
  });

  test('signing out clears any problem', async () => {
    getUserById.mockRejectedValue(fbError('unavailable'));
    const { result } = await mount();
    await act(async () => { await authListener(fbUser); });
    expect(result.current.sessionProblem).not.toBeNull();
    await act(async () => { await authListener(null); });
    expect(result.current.sessionProblem).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

describe('signing in with Google or Microsoft', () => {
  const profile = { id: 'u1', role: 'staff', orgId: 'o1', status: 'active', email: 'sana@x.test' };

  test('a provider account an admin set up signs straight in', async () => {
    popup.mockResolvedValue({ user: { uid: 'u1' }, info: { isNewUser: false } });
    getUserById.mockResolvedValue(profile);
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.loginWithProvider('google'); });
    expect(outcome.success).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(popup).toHaveBeenCalledWith(authState, { key: 'google' });
  });

  test('an address nobody here uses: the account Firebase just made is removed again', async () => {
    const remove = vi.fn(async () => {});
    popup.mockResolvedValue({ user: { uid: 'stranger', delete: remove }, info: { isNewUser: true } });
    getUserById.mockResolvedValue(null);
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.loginWithProvider('google'); });
    expect(remove).toHaveBeenCalled();
    expect(outcome).toMatchObject({ success: false });
    expect(outcome.error).toMatch(/No MagnaFlow account uses this Google address/);
    expect(result.current.isAuthenticated).toBe(false);
  });

  test('a deactivated account is refused here too', async () => {
    popup.mockResolvedValue({ user: { uid: 'u1' }, info: { isNewUser: false } });
    getUserById.mockResolvedValue({ ...profile, status: 'inactive' });
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.loginWithProvider('microsoft'); });
    expect(signOutMock).toHaveBeenCalled();
    expect(outcome.error).toMatch(/deactivated/);
  });

  test('an address that has a password: one password sign-in connects the provider', async () => {
    popup.mockRejectedValue(Object.assign(fbError('auth/account-exists-with-different-credential'), {
      customData: { email: 'Sana@x.test' }, credential: { provider: 'microsoft.com' },
    }));
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.loginWithProvider('microsoft'); });
    expect(outcome).toMatchObject({ success: false, needsPassword: true, email: 'Sana@x.test' });
    expect(outcome.error).toMatch(/Microsoft will be connected/);

    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u1' } });
    getUserById.mockResolvedValue(profile);
    await act(async () => { outcome = await result.current.login('sana@x.test', 'pw'); });
    expect(outcome).toMatchObject({ success: true, linked: 'Microsoft' });
    expect(linkWithCredential).toHaveBeenCalledWith({ uid: 'u1' }, { provider: 'microsoft.com' });
  });

  test('the waiting credential is never connected to a different login', async () => {
    popup.mockRejectedValue(Object.assign(fbError('auth/account-exists-with-different-credential'), {
      customData: { email: 'sana@x.test' }, credential: { provider: 'google.com' },
    }));
    const { result } = await mount();
    await act(async () => { await result.current.loginWithProvider('google'); });

    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: 'u2' } });
    getUserById.mockResolvedValue({ ...profile, id: 'u2', email: 'other@x.test' });
    let outcome;
    await act(async () => { outcome = await result.current.login('other@x.test', 'pw'); });
    expect(outcome.success).toBe(true);
    expect(outcome.linked).toBeNull();
    expect(linkWithCredential).not.toHaveBeenCalled();
  });

  test('closing the window is not an error', async () => {
    popup.mockRejectedValue(fbError('auth/popup-closed-by-user'));
    const { result } = await mount();
    let outcome;
    await act(async () => { outcome = await result.current.loginWithProvider('google'); });
    expect(outcome).toEqual({ success: false, error: '' });
  });
});
