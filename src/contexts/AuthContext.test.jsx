import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// What the auth listener is handed, controllable from each test.
let authListener;
const signOutMock = vi.fn(async () => {});
const fbUser = { uid: 'u1' };
const authState = { currentUser: fbUser };

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  signOut: (...args) => signOutMock(...args),
  onAuthStateChanged: (_auth, cb) => { authListener = cb; return () => {}; },
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
  const hook = renderHook(() => useAuth(), { wrapper: ({ children }) => <AuthProvider>{children}</AuthProvider> });
  await waitFor(() => expect(authListener).toBeTypeOf('function'));
  return hook;
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
