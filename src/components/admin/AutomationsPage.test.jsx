import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AutomationsPage from './AutomationsPage';
import { ConfirmProvider } from '@/components/shared/ConfirmDialog';

const mocks = vi.hoisted(() => ({
  me: { uid: 'a1', id: 'a1', name: 'Arjun', role: 'org-admin', orgId: 'o1' },
  saveRule: vi.fn(),
  saveChannels: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.me }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/organizationService', () => ({ getProjects: async () => [{ id: 'p1', name: 'Apollo' }] }));
vi.mock('@/services/userService', () => ({ getAssignableUsers: async () => [{ id: 's1', name: 'Sana' }] }));
vi.mock('@/services/automationService', () => ({
  listRules: async () => [{ id: 'r1', name: 'Done to Slack', enabled: true, trigger: 'status_changed', toStatus: 'completed', projectId: 'p1', priority: '', action: { type: 'notify_channels' } }],
  getChannels: async () => ({ slack: '', teams: '', webhook: '', webhookSecret: '' }),
  listRecentEvents: async () => [{ id: 'e1', type: 'status_changed', to: 'completed', byName: 'Sana', processed: true, results: ['Done to Slack: slack: posted'], at: new Date() }],
  saveRule: mocks.saveRule,
  saveChannels: mocks.saveChannels,
  deleteRule: vi.fn(),
  sendChannelTest: vi.fn(),
}));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const setup = () => {
  render(<ConfirmProvider><AutomationsPage /></ConfirmProvider>);
  return userEvent.setup();
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveRule.mockImplementation(async (_o, rule) => ({ id: rule.id || 'new', ...rule }));
  mocks.saveChannels.mockResolvedValue();
});

describe('AutomationsPage', () => {
  test('lists the rules in words and what they did', async () => {
    setup();
    expect(await screen.findByText('When a task changes status to Completed in Apollo, post to the channels.')).toBeInTheDocument();
    expect(await screen.findByText('Done to Slack: slack: posted')).toBeInTheDocument();
  });

  test('a new rule needs what it does; a checklist rule saves its items', async () => {
    const user = setup();
    await user.click(await screen.findByRole('button', { name: 'New rule' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save rule' }));
    expect(within(dialog).getByText('Give the rule a name.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Name'), 'Kick-off checklist');
    await user.selectOptions(within(dialog).getByLabelText('When'), 'task_created');
    await user.selectOptions(within(dialog).getByLabelText('Then'), 'add_checklist');
    await user.type(within(dialog).getByLabelText(/Checklist items/), 'Scope{Enter}Estimate');
    await user.click(within(dialog).getByRole('button', { name: 'Save rule' }));
    await waitFor(() => expect(mocks.saveRule).toHaveBeenCalledWith('o1', expect.objectContaining({
      name: 'Kick-off checklist', trigger: 'task_created', action: { type: 'add_checklist', items: ['Scope', 'Estimate'] },
    }), mocks.me));
    expect(await screen.findByText('When a task is created, add 2 checklist items.')).toBeInTheDocument();
  });

  test('channel addresses are checked before saving', async () => {
    const user = setup();
    await user.type(await screen.findByLabelText('Slack incoming webhook'), 'https://example.com/nope');
    await user.click(screen.getByRole('button', { name: 'Save channels' }));
    expect(screen.getByText('That is not a Slack incoming webhook address.')).toBeInTheDocument();
    expect(mocks.saveChannels).not.toHaveBeenCalled();
  });
});
