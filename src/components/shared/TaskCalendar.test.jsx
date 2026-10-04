import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskCalendar from './TaskCalendar';

const task = (id, title, day, extra = {}) => ({
  id, title, status: 'pending', priority: 'medium', deadline: new Date(2026, 9, day), ...extra,
});

const tasks = [
  task('a', 'Write spec', 22, { priority: 'critical' }),
  task('b', 'Review copy', 22),
  task('c', 'Book venue', 22, { priority: 'low' }),
  task('d', 'Send invites', 22, { status: 'completed' }),
  task('e', 'Launch', 30, { milestone: true }),
  task('f', 'Last month', 1, { deadline: new Date(2026, 8, 30), status: 'completed' }),
  { id: 'g', title: 'No date', status: 'pending', priority: 'high', deadline: null },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 9, 10, 12));
});
afterEach(() => vi.useRealTimers());

const setup = (props = {}) => {
  const onTaskClick = vi.fn();
  render(<TaskCalendar tasks={tasks} onTaskClick={onTaskClick} {...props} />);
  return { onTaskClick, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
};

const grid = () => screen.getByRole('table', { name: /tasks due in/i });

describe('TaskCalendar', () => {
  test('opens on the current month and says how much is due', () => {
    setup();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('October 2026');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('5 due');
  });

  test('a busy day shows three tasks, open and urgent first, then "+N more"', () => {
    setup();
    const g = grid();
    expect(within(g).getByRole('button', { name: /^Write spec, Pending, Critical priority/ })).toBeInTheDocument();
    expect(within(g).getByRole('button', { name: /^Review copy/ })).toBeInTheDocument();
    expect(within(g).getByRole('button', { name: /^Book venue/ })).toBeInTheDocument();
    expect(within(g).queryByRole('button', { name: /^Send invites/ })).not.toBeInTheDocument();
    expect(within(g).getByRole('button', { name: '+1 more' })).toBeInTheDocument();
  });

  test('"+N more" lists the whole day, and choosing a task opens it', async () => {
    const { user, onTaskClick } = setup();
    await user.click(within(grid()).getByRole('button', { name: '+1 more' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Due Thursday, 22 October 2026');
    await user.click(within(dialog).getByRole('button', { name: /^Send invites, Completed/ }));
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'd' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('clicking a task opens it', async () => {
    const { user, onTaskClick } = setup();
    await user.click(within(grid()).getByRole('button', { name: /^Launch, milestone/ }));
    expect(onTaskClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'e' }));
  });

  test('overdue work says so', () => {
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    setup();
    expect(within(grid()).getByRole('button', { name: /^Write spec.*overdue$/ })).toBeInTheDocument();
  });

  test('moves between months and back to today', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('September 2026');
    expect(within(grid()).getByRole('button', { name: /^Last month/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('November 2026');
    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('October 2026');
  });

  test('says how many tasks without a deadline it is not showing', () => {
    setup();
    expect(screen.getByText(/1 task has no deadline and is not shown/)).toBeInTheDocument();
  });

  test('today is marked for screen readers', () => {
    setup();
    expect(within(grid()).getByText(/Saturday, 10 October 2026, today/)).toBeInTheDocument();
  });

  test('the phone agenda lists the month by day', () => {
    setup();
    expect(screen.getByRole('heading', { level: 3, name: /Thu 22 Oct/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Fri 30 Oct/ })).toBeInTheDocument();
  });
});
