import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationSettingsDialog from './NotificationSettingsDialog';

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  toast: vi.fn(),
  reportError: vi.fn(),
  user: { uid: 'me', notificationPrefs: undefined },
}));
vi.mock('@/services/userService', () => ({ getUserById: mocks.getUserById, updateUser: mocks.updateUser }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/reportError', () => ({ reportError: mocks.reportError }));

const setup = (onOpenChange = vi.fn()) => {
  render(<NotificationSettingsDialog open onOpenChange={onOpenChange} />);
  return { user: userEvent.setup(), onOpenChange };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserById.mockResolvedValue({ id: 'me', notificationPrefs: { mentions: false } });
  mocks.updateUser.mockResolvedValue({});
});

describe('NotificationSettingsDialog', () => {
  test('shows the saved settings, everything else on', async () => {
    setup();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /mentions me/i })).not.toBeChecked());
    expect(screen.getByRole('checkbox', { name: /assigned to me/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /morning reminder/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /morning reminder/i })).toHaveAccessibleDescription(/8:00 AM IST/);
    expect(mocks.getUserById).toHaveBeenCalledWith('me');
  });

  test('saves every setting on the signed-in profile', async () => {
    const { user, onOpenChange } = setup();
    const reminder = await screen.findByRole('checkbox', { name: /morning reminder/i });
    await waitFor(() => expect(reminder).toBeEnabled());
    await user.click(reminder);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith('me', {
      notificationPrefs: { assignments: true, mentions: false, critical: true, statusChanges: true, dailyReminder: false },
    }));
    expect(mocks.toast).toHaveBeenCalledWith({ title: 'Email settings saved' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test('says so when every email is off', async () => {
    mocks.getUserById.mockResolvedValue({
      id: 'me',
      notificationPrefs: { assignments: false, mentions: false, critical: false, statusChanges: false, dailyReminder: false },
    });
    setup();
    expect(await screen.findByText(/no email from MagnaFlow/i)).toBeInTheDocument();
  });

  test('a failed save is reported and the dialog stays open', async () => {
    mocks.updateUser.mockRejectedValue(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    const { user, onOpenChange } = setup();
    const save = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(save).toBeEnabled());
    await user.click(save);
    await waitFor(() => expect(mocks.reportError).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
