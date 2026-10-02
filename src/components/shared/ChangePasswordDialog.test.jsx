import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangePasswordDialog from './ChangePasswordDialog';

const mocks = vi.hoisted(() => ({
  reauthenticateWithCredential: vi.fn(),
  updatePassword: vi.fn(),
  toast: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('@/config/firebase', () => ({ auth: { currentUser: { email: 'sana@demo.test' } } }));
vi.mock('firebase/auth', () => ({
  EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
  reauthenticateWithCredential: mocks.reauthenticateWithCredential,
  updatePassword: mocks.updatePassword,
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/reportError', () => ({ reportError: mocks.reportError }));

const setup = () => {
  const onOpenChange = vi.fn();
  render(<ChangePasswordDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange, user: userEvent.setup() };
};

const fill = async (user, { current = 'Old-Passw0rd', next = 'Quiet-River-83', confirm = next } = {}) => {
  await user.type(screen.getByLabelText(/^Current password/), current);
  await user.type(screen.getByLabelText(/^New password/), next);
  await user.type(screen.getByLabelText(/^Confirm new password/), confirm);
};

const submit = (user) => user.click(screen.getByRole('button', { name: /change password/i }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reauthenticateWithCredential.mockResolvedValue({});
  mocks.updatePassword.mockResolvedValue();
});

describe('ChangePasswordDialog', () => {
  test('puts each problem next to its field and sends nothing', async () => {
    const { user } = setup();
    await submit(user);

    expect(screen.getByLabelText(/^Current password/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter your current password.')).toBeInTheDocument();
    expect(screen.getByText('Enter a password.')).toBeInTheDocument();
    expect(mocks.reauthenticateWithCredential).not.toHaveBeenCalled();
  });

  test('a short new password says how short', async () => {
    const { user } = setup();
    await fill(user, { next: 'abc12', confirm: 'abc12' });
    await submit(user);
    expect(screen.getByText(/at least 8 characters \(this has 5\)/i)).toBeInTheDocument();
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  test('catches a mismatch and a reused password', async () => {
    const { user } = setup();
    await fill(user, { confirm: 'Quiet-River-84' });
    await submit(user);
    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
  });

  test('refuses to "change" it to the same password', async () => {
    const { user } = setup();
    await fill(user, { current: 'Quiet-River-83', next: 'Quiet-River-83' });
    await submit(user);
    expect(screen.getByText(/different from your current one/i)).toBeInTheDocument();
    expect(mocks.updatePassword).not.toHaveBeenCalled();
  });

  test('verifies the current password, updates, confirms and closes', async () => {
    const { user, onOpenChange } = setup();
    await fill(user);
    await submit(user);

    await waitFor(() => expect(mocks.updatePassword).toHaveBeenCalledWith(expect.anything(), 'Quiet-River-83'));
    expect(mocks.reauthenticateWithCredential).toHaveBeenCalledWith(
      expect.anything(),
      { email: 'sana@demo.test', password: 'Old-Passw0rd' },
    );
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Password changed' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('a wrong current password is reported on that field, not as a generic failure', async () => {
    mocks.reauthenticateWithCredential.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    const { user, onOpenChange } = setup();
    await fill(user);
    await submit(user);

    expect(await screen.findByText(/not your current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Current password/)).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.updatePassword).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test('any other failure goes through the shared error reporter', async () => {
    mocks.updatePassword.mockRejectedValue(Object.assign(new Error('boom'), { code: 'auth/network-request-failed' }));
    const { user } = setup();
    await fill(user);
    await submit(user);
    await waitFor(() => expect(mocks.reportError).toHaveBeenCalled());
  });
});
