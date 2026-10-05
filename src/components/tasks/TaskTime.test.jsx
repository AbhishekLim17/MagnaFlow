import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskTime from './TaskTime';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  log: vi.fn(),
  remove: vi.fn(),
  me: { uid: 'u1', name: 'Sana' },
}));
vi.mock('@/services/timeService', () => ({ listTaskEntries: mocks.list, logTime: mocks.log, deleteTimeEntry: mocks.remove }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.me }) }));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const task = { id: 't1', orgId: 'o1', projectId: 'p1', estimateHours: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([
    { id: 'e1', userId: 'u1', userName: 'Sana', minutes: 90, date: '2026-10-02' },
    { id: 'e2', userId: 'u2', userName: 'Vikram', minutes: 60, date: '2026-10-01', note: 'Review' },
  ]);
  mocks.log.mockImplementation(async (args) => ({ id: 'new', userId: 'u1', userName: 'Sana', minutes: args.minutes, date: args.date, note: args.note }));
  mocks.remove.mockResolvedValue();
});

describe('TaskTime', () => {
  test('shows the time logged against the estimate, and who logged it', async () => {
    render(<TaskTime task={task} />);
    expect(await screen.findByText(/2h 30m logged of 4h estimated/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '63');
    expect(within(screen.getByRole('list', { name: 'Time logged' })).getAllByRole('listitem')).toHaveLength(2);
  });

  test('logs time typed the way people type it, and refuses nonsense', async () => {
    const user = userEvent.setup();
    render(<TaskTime task={task} />);
    await screen.findByText(/2h 30m logged/);
    await user.type(screen.getByLabelText('Time spent'), 'lots');
    await user.click(screen.getByRole('button', { name: 'Log time' }));
    expect(screen.getByText(/for example 1.5 or 1:30/)).toBeInTheDocument();
    expect(mocks.log).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Time spent'));
    await user.type(screen.getByLabelText('Time spent'), '1:45');
    await user.type(screen.getByLabelText('Note (optional)'), 'Pairing');
    await user.click(screen.getByRole('button', { name: 'Log time' }));
    await waitFor(() => expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ task, author: mocks.me, minutes: 105, note: 'Pairing' })));
    expect(await screen.findByText(/4h 15m logged of 4h estimated/)).toBeInTheDocument();
    expect(screen.getByText(/over the estimate/)).toBeInTheDocument();
  });

  test('only your own entries can be removed', async () => {
    const user = userEvent.setup();
    render(<TaskTime task={task} />);
    await screen.findByText(/2h 30m logged/);
    const removeButtons = screen.getAllByRole('button', { name: /^Remove / });
    expect(removeButtons).toHaveLength(1);
    await user.click(removeButtons[0]);
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith('e1'));
    expect(await screen.findByText(/1h logged of 4h estimated/)).toBeInTheDocument();
  });
});
