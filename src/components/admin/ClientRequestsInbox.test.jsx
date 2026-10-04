import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientRequestsInbox, { triageScope } from './ClientRequestsInbox';

const mocks = vi.hoisted(() => ({
  user: { uid: 'm1', id: 'm1', name: 'Mo Manager', role: 'manager', orgId: 'o1', projectIds: ['p1'] },
  profile: { id: 'm1', name: 'Mo Manager', role: 'manager', orgId: 'o1', projectIds: ['p1'] },
  listForTeam: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
  createTask: vi.fn(),
  toast: vi.fn(),
}));
// The real shapes: the stored profile has an id and no uid; currentUser has both.
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.profile, currentUser: mocks.user }) }));
vi.mock('@/contexts/TasksContext', () => ({ useTasks: () => ({ createTask: mocks.createTask }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/organizationService', () => ({
  getProjects: async () => [{ id: 'p1', name: 'Apollo', departmentId: 'd1' }, { id: 'p2', name: 'Atlas', departmentId: 'd2' }],
}));
vi.mock('@/services/userService', () => ({ getAssignableUsers: async () => [{ id: 's1', name: 'Sana Staff', status: 'active' }] }));
vi.mock('@/services/clientRequestService', () => ({
  listRequestsForTeam: mocks.listForTeam, acceptRequest: mocks.accept, declineRequest: mocks.decline,
}));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const waiting = {
  id: 'r1', orgId: 'o1', projectId: 'p1', title: 'Dark mode', details: 'For the dashboard', urgency: 'urgent',
  neededBy: '2026-11-01', requestedBy: 'c1', requestedByName: 'Cleo Client', status: 'new', createdAt: new Date('2026-10-02'),
};
const answered = { ...waiting, id: 'r0', title: 'Logo', status: 'declined', decidedByName: 'Mo Manager', response: 'Already done' };

const itemWith = (text) => screen.getAllByRole('listitem').find((li) => within(li).queryByText(text));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listForTeam.mockResolvedValue([waiting, answered]);
  mocks.createTask.mockResolvedValue({ id: 't9' });
  mocks.accept.mockImplementation(async () => ({ status: 'accepted', decidedByName: 'Mo Manager', decidedAt: new Date() }));
  mocks.decline.mockImplementation(async (_id, _u, response) => ({ status: 'declined', decidedByName: 'Mo Manager', response, decidedAt: new Date() }));
});

test('triageScope: who answers which projects', () => {
  const projects = [{ id: 'p1', departmentId: 'd1' }, { id: 'p2', departmentId: 'd2' }];
  expect(triageScope({ role: 'org-admin' }, projects)).toBeNull();
  expect(triageScope({ role: 'manager', projectIds: ['p2'] }, projects)).toEqual(['p2']);
  expect(triageScope({ role: 'department-head', departmentIds: ['d1'] }, projects)).toEqual(['p1']);
  expect(triageScope({ role: 'staff' }, projects)).toEqual([]);
});

describe('ClientRequestsInbox', () => {
  test("shows the waiting requests of the manager's projects", async () => {
    render(<ClientRequestsInbox />);
    expect(await screen.findByText('Dark mode')).toBeInTheDocument();
    expect(mocks.listForTeam).toHaveBeenCalledWith('o1', ['p1']);
    expect(screen.queryByText('Logo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New (1)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  test('accepting creates the task in the same project from the request, then marks it accepted', async () => {
    const user = userEvent.setup();
    render(<ClientRequestsInbox />);
    await user.click(await screen.findByRole('button', { name: 'Accept as a task' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Task title')).toHaveValue('Dark mode');
    expect(within(dialog).getByLabelText('Deadline')).toHaveValue('2026-11-01');
    await user.click(within(dialog).getByRole('button', { name: 'Create task and accept' }));

    await waitFor(() => expect(mocks.accept).toHaveBeenCalledWith('r1', mocks.user, 't9', ''));
    expect(mocks.createTask).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Dark mode', projectId: 'p1', departmentId: 'd1', priority: 'high', deadline: '2026-11-01', assignedTo: '',
    }));
    // answered requests leave the "New" list
    await waitFor(() => expect(screen.queryByText('Dark mode')).not.toBeInTheDocument());
  });

  test('if marking it accepted fails, trying again does not make a second task', async () => {
    mocks.accept.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'unavailable' }));
    const user = userEvent.setup();
    render(<ClientRequestsInbox />);
    await user.click(await screen.findByRole('button', { name: 'Accept as a task' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create task and accept' }));
    expect(await within(dialog).findByText(/task was created, but the request is not marked accepted/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create task and accept' }));
    await waitFor(() => expect(mocks.accept).toHaveBeenCalledTimes(2));
    expect(mocks.createTask).toHaveBeenCalledTimes(1);
  });

  test('declining needs a reason for the client', async () => {
    const user = userEvent.setup();
    render(<ClientRequestsInbox />);
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    expect(within(dialog).getByText(/Tell the client why/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Reason'), 'Out of scope');
    await user.click(within(dialog).getByRole('button', { name: 'Decline' }));
    await waitFor(() => expect(mocks.decline).toHaveBeenCalledWith('r1', mocks.user, 'Out of scope'));
  });

  test('All shows answered requests with the answer', async () => {
    const user = userEvent.setup();
    render(<ClientRequestsInbox />);
    await screen.findByText('Dark mode');
    await user.click(screen.getByRole('button', { name: 'All (2)' }));
    expect(itemWith('Logo')).toHaveTextContent('Declined by Mo Manager');
  });
});
