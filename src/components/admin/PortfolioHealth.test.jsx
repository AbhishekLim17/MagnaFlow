import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PortfolioHealth from './PortfolioHealth';

const mocks = vi.hoisted(() => ({
  user: { uid: 'm1', id: 'm1', name: 'Mo', role: 'manager', orgId: 'o1', projectIds: ['p1', 'p2'] },
  tasks: [],
  latest: vi.fn(),
  list: vi.fn(),
  post: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.user }) }));
vi.mock('@/contexts/TasksContext', () => ({ useTasks: () => ({ tasks: mocks.tasks, tasksTruncated: false }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/organizationService', () => ({
  getProjects: async () => [
    { id: 'p1', name: 'Apollo', orgId: 'o1' },
    { id: 'p2', name: 'Atlas', orgId: 'o1' },
    { id: 'p3', name: 'Not mine', orgId: 'o1' },
  ],
}));
vi.mock('@/services/projectUpdateService', () => ({ latestUpdates: mocks.latest, listUpdates: mocks.list, postUpdate: mocks.post }));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const past = { toMillis: () => Date.now() - 3 * 86400000 };
const future = { toMillis: () => Date.now() + 30 * 86400000 };
const itemFor = (name) => screen.getAllByRole('listitem').find((li) => within(li).queryByRole('heading', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tasks = [
    { id: 'a', projectId: 'p1', status: 'completed', deadline: past },
    { id: 'b', projectId: 'p1', status: 'pending', deadline: future },
    { id: 'c', projectId: 'p2', status: 'pending', deadline: past },
    { id: 'd', projectId: 'p2', status: 'pending', deadline: future },
  ];
  mocks.latest.mockResolvedValue({ p1: { health: 'on_track', summary: 'All good', createdByName: 'Mo', createdAt: new Date() }, p2: null });
  mocks.list.mockResolvedValue([]);
  mocks.post.mockImplementation(async (_o, _p, u) => ({ ...u, createdByName: 'Mo', createdAt: new Date() }));
});

describe('PortfolioHealth', () => {
  test('lists the projects the viewer runs, worst first, declared or suggested', async () => {
    render(<PortfolioHealth />);
    expect(await screen.findByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Not mine' })).not.toBeInTheDocument();
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(['Atlas', 'Apollo']);
    expect(itemFor('Atlas')).toHaveTextContent('Off track (suggested)');
    expect(itemFor('Atlas')).toHaveTextContent('1 overdue');
    expect(itemFor('Apollo')).toHaveTextContent('On track');
    expect(itemFor('Apollo')).toHaveTextContent('All good');
    expect(within(itemFor('Apollo')).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  test('posting an update needs a summary, then becomes the project status', async () => {
    const user = userEvent.setup();
    render(<PortfolioHealth />);
    await user.click(within(await waitFor(() => itemFor('Atlas'))).getByRole('button', { name: 'Post update' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Post update' }));
    expect(within(dialog).getByText(/how it is going/)).toBeInTheDocument();

    await user.click(within(dialog).getByLabelText('At risk'));
    await user.type(within(dialog).getByLabelText('Summary'), 'Vendor late, recovering next week');
    await user.click(within(dialog).getByRole('button', { name: 'Post update' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('o1', 'p2', { health: 'at_risk', summary: 'Vendor late, recovering next week' }, mocks.user));
    await waitFor(() => expect(itemFor('Atlas')).toHaveTextContent('At risk'));
    expect(itemFor('Atlas')).not.toHaveTextContent('(suggested)');
  });
});
