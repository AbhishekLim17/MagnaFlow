import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectedAccounts from './ConnectedAccounts';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';
import { PROVIDERS } from '@/lib/signInProviders';

const mocks = vi.hoisted(() => ({
  currentUser: { providerData: [], reload: async () => {} },
  linkWithPopup: vi.fn(),
  unlink: vi.fn(),
  toast: vi.fn(),
  reportError: vi.fn(),
}));
vi.mock('firebase/auth', () => ({ linkWithPopup: mocks.linkWithPopup, unlink: mocks.unlink }));
vi.mock('@/config/firebase', () => ({ auth: { get currentUser() { return mocks.currentUser; } } }));
vi.mock('@/services/authProviderService', () => ({ makeProvider: (key) => ({ key }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/reportError', () => ({ reportError: mocks.reportError }));

const both = [PROVIDERS.google, PROVIDERS.microsoft];
const setup = (providers = both) => {
  render(<ConfirmProvider><ConnectedAccounts providers={providers} /></ConfirmProvider>);
  return userEvent.setup();
};
const row = (label) => screen.getAllByRole('listitem').find((li) => within(li).queryByText(label, { selector: 'p' }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.providerData = [{ providerId: 'password', email: 'sana@x.test' }];
});

describe('ConnectedAccounts', () => {
  test('nothing at all while no provider is switched on', () => {
    const { container } = render(<ConnectedAccounts providers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('connecting a provider', async () => {
    mocks.linkWithPopup.mockImplementation(async () => {
      mocks.currentUser.providerData = [...mocks.currentUser.providerData, { providerId: 'google.com', email: 'sana@gmail.test' }];
    });
    const user = setup();
    expect(row('Google')).toHaveTextContent('Not connected');
    await user.click(screen.getByRole('button', { name: 'Connect Google' }));

    await waitFor(() => expect(row('Google')).toHaveTextContent('Connected as sana@gmail.test'));
    expect(mocks.linkWithPopup).toHaveBeenCalledWith(mocks.currentUser, { key: 'google' });
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Google connected' }));
    expect(row('Microsoft')).toHaveTextContent('Not connected');
  });

  test('disconnecting asks first, and is impossible when it is the only way in', async () => {
    mocks.currentUser.providerData = [{ providerId: 'password' }, { providerId: 'microsoft.com', email: 'sana@outlook.test' }];
    mocks.unlink.mockImplementation(async () => { mocks.currentUser.providerData = [{ providerId: 'password' }]; });
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Disconnect Microsoft' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Disconnect' }));
    await waitFor(() => expect(mocks.unlink).toHaveBeenCalledWith(mocks.currentUser, 'microsoft.com'));
    expect(row('Microsoft')).toHaveTextContent('Not connected');
  });

  test('the only sign-in method cannot be disconnected', () => {
    mocks.currentUser.providerData = [{ providerId: 'google.com', email: 'sana@gmail.test' }];
    setup([PROVIDERS.google]);
    expect(screen.getByRole('button', { name: 'Disconnect Google' })).toBeDisabled();
  });

  test('a Google account already used by another login is explained', async () => {
    mocks.linkWithPopup.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/credential-already-in-use' }));
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Connect Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already connected to another MagnaFlow login/);
    expect(mocks.reportError).not.toHaveBeenCalled();
  });
});
