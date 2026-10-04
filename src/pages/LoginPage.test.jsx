import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const login = vi.fn();
const loginWithProvider = vi.fn();
const authState = { login, loginWithProvider, notice: null };
const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'light', toggleTheme: vi.fn() }) }));
const resetUserPassword = vi.fn();
vi.mock('@/services/userService', () => ({ resetUserPassword: (...a) => resetUserPassword(...a) }));

const { default: LoginPage } = await import('./LoginPage');

const type = async (user, label, text) => {
  const field = screen.getByLabelText(label);
  await user.clear(field);
  if (text) await user.type(field, text);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  authState.notice = null;
});

describe('signing in', () => {
  test('an empty form says what is missing next to the field and does not try to sign in', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(login).not.toHaveBeenCalled();
  });

  test('a malformed email is called out, a missing password too', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await type(user, 'Email', 'not-an-email');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText(/doesn't look like an email/i)).toBeInTheDocument();

    await type(user, 'Email', 'a@b.co');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  test('a wrong password stays on screen, clears the field and returns the cursor to it', async () => {
    login.mockResolvedValue({ success: false, error: 'Incorrect email or password. Please check and try again.' });
    const user = userEvent.setup();
    render(<LoginPage />);
    await type(user, 'Email', '  a@b.co ');
    await type(user, 'Password', 'nope');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(login).toHaveBeenCalledWith('a@b.co', 'nope');
    expect(await screen.findByText(/Incorrect email or password/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveValue(''));
    expect(screen.getByLabelText('Password')).toHaveFocus();
  });

  test('says why when the person was signed out without asking', () => {
    authState.notice = 'Your account has been deactivated. Please contact your administrator.';
    render(<LoginPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/deactivated/);
  });
});

describe('forgot password', () => {
  const openReset = async (user) => {
    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
  };

  test('sends a reset link and confirms without saying whether the account exists', async () => {
    resetUserPassword.mockResolvedValue();
    const user = userEvent.setup();
    render(<LoginPage />);
    await openReset(user);
    await type(user, 'Email', 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(resetUserPassword).toHaveBeenCalledWith('a@b.co');
    expect(await screen.findByText(/if an account exists for/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send again in/i })).toBeDisabled();
  });

  test('an unknown address reads exactly like a known one (no account enumeration)', async () => {
    resetUserPassword.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/user-not-found' }));
    const user = userEvent.setup();
    render(<LoginPage />);
    await openReset(user);
    await type(user, 'Email', 'ghost@b.co');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/if an account exists for/i)).toBeInTheDocument();
  });

  test('a real failure (offline) is reported, not hidden', async () => {
    resetUserPassword.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/network-request-failed' }));
    const user = userEvent.setup();
    render(<LoginPage />);
    await openReset(user);
    await type(user, 'Email', 'a@b.co');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText(/cannot reach the server/i)).toBeInTheDocument();
    expect(screen.queryByText(/if an account exists/i)).not.toBeInTheDocument();
  });

  test('can go back to signing in', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await openReset(user);
    await user.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(screen.getByRole('heading', { name: /sign in to magnaflow/i })).toBeInTheDocument();
  });
});

describe('Google and Microsoft sign-in', () => {
  test('hidden unless switched on for this build', () => {
    render(<LoginPage />);
    expect(screen.queryByRole('button', { name: /continue with/i })).not.toBeInTheDocument();
  });

  test('a button per provider that is switched on', async () => {
    vi.stubEnv('VITE_SIGNIN_PROVIDERS', 'google,microsoft');
    loginWithProvider.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: 'Continue with Microsoft' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(loginWithProvider).toHaveBeenCalledWith('google');
  });

  test('an address with a password: fills it in, explains, and connects after the password sign-in', async () => {
    vi.stubEnv('VITE_SIGNIN_PROVIDERS', 'microsoft');
    loginWithProvider.mockResolvedValue({
      success: false, needsPassword: true, email: 'sana@x.test',
      error: 'This email signs in with a password. Sign in with your password below once, and Microsoft will be connected for next time.',
    });
    login.mockResolvedValue({ success: true, linked: 'Microsoft' });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Continue with Microsoft' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Microsoft will be connected/);
    expect(screen.getByLabelText('Email')).toHaveValue('sana@x.test');
    await waitFor(() => expect(screen.getByLabelText('Password')).toHaveFocus());

    await user.type(screen.getByLabelText('Password'), 'pw');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Microsoft connected' })));
  });

  test('a refusal is shown on the form; closing the window shows nothing', async () => {
    vi.stubEnv('VITE_SIGNIN_PROVIDERS', 'google');
    loginWithProvider.mockResolvedValueOnce({ success: false, error: '' });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    loginWithProvider.mockResolvedValueOnce({ success: false, error: 'No MagnaFlow account uses this Google address.' });
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/No MagnaFlow account uses this Google address/);
  });
});
