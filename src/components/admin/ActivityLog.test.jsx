import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivityLog from './ActivityLog';

const mocks = vi.hoisted(() => ({
  getOrgAuditLogs: vi.fn(),
  getAllUsers: vi.fn(),
  downloadText: vi.fn(),
}));
vi.mock('@/services/auditService', () => ({ getOrgAuditLogs: mocks.getOrgAuditLogs }));
vi.mock('@/services/userService', () => ({ getAllUsers: mocks.getAllUsers }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'admin', orgId: 'org1' } }) }));
vi.mock('@/lib/csv', async (importOriginal) => ({ ...(await importOriginal()), downloadText: mocks.downloadText }));

const at = (iso) => ({ toDate: () => new Date(iso), toMillis: () => Date.parse(iso) });
const entries = [
  { id: 'e1', action: 'update_user', actorId: 'admin', targetUserId: 'u1', changes: { status: 'inactive' }, timestamp: at('2026-10-03T10:00:00Z') },
  { id: 'e2', action: 'create_project', actorId: 'head', targetName: 'Apollo', timestamp: at('2026-10-02T10:00:00Z') },
  { id: 'e3', action: 'reset_password', actorId: 'admin', targetEmail: 'Priya@x.test', timestamp: at('2026-10-01T10:00:00Z') },
  { id: 'e4', action: 'suspend_org', actorId: 'platform-owner', timestamp: at('2026-09-30T10:00:00Z') },
];
const users = [
  { id: 'admin', name: 'Asha Admin', email: 'asha@x.test' },
  { id: 'head', name: 'Hari Head', email: 'hari@x.test' },
  { id: 'u1', name: 'Priya Nair', email: 'priya@x.test' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getOrgAuditLogs.mockResolvedValue(entries);
  mocks.getAllUsers.mockResolvedValue(users);
});

const items = () => within(screen.getByRole('list', { name: /activity/i })).getAllByRole('listitem');

describe('ActivityLog', () => {
  test("lists the organization's changes in words, with who made them", async () => {
    render(<ActivityLog />);
    await waitFor(() => expect(items()).toHaveLength(4));
    expect(mocks.getOrgAuditLogs).toHaveBeenCalledWith('org1', 200);
    expect(items()[0]).toHaveTextContent('Deactivated Priya Nair');
    expect(items()[0]).toHaveTextContent('by Asha Admin');
    expect(items()[1]).toHaveTextContent('Created the project Apollo');
    expect(items()[1]).toHaveTextContent('by Hari Head');
    // a reset names the person by email; their name is found from the member list
    expect(items()[2]).toHaveTextContent('Sent Priya Nair a password reset link');
    // organization changes come from the platform, whose admin is not a member
    expect(items()[3]).toHaveTextContent('Suspended the organisation');
    expect(items()[3]).toHaveTextContent('by MagnaFlow (platform admin)');
  });

  test('search narrows the list, and the CSV holds what is shown', async () => {
    const user = userEvent.setup();
    render(<ActivityLog />);
    await waitFor(() => expect(items()).toHaveLength(4));
    await user.type(screen.getByLabelText('Search'), 'apollo');
    expect(items()).toHaveLength(1);
    expect(screen.getByText('1 of 4 entries')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /download csv/i }));
    const [csv, filename] = mocks.downloadText.mock.calls[0];
    expect(filename).toBe('Activity log.csv');
    expect(csv).toContain('Created the project Apollo');
    expect(csv).not.toContain('Deactivated');
  });

  test('an empty log says what will appear there', async () => {
    mocks.getOrgAuditLogs.mockResolvedValue([]);
    render(<ActivityLog />);
    expect(await screen.findByText(/Nothing recorded yet/)).toBeInTheDocument();
  });

  test('a failed load can be retried', async () => {
    mocks.getOrgAuditLogs.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    const user = userEvent.setup();
    render(<ActivityLog />);
    const alert = await screen.findByRole('alert');
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(items()).toHaveLength(4));
  });
});
