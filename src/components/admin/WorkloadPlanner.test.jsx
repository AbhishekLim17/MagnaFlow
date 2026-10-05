import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkloadPlanner from './WorkloadPlanner';

const mocks = vi.hoisted(() => ({
  me: { uid: 'admin', id: 'admin', role: 'org-admin', orgId: 'o1' },
  tasks: [],
  people: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: mocks.me }) }));
vi.mock('@/contexts/TasksContext', () => ({ useTasks: () => ({ tasks: mocks.tasks }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/userService', () => ({ getAssignableUsers: mocks.people, updateUser: mocks.update }));
vi.mock('@/lib/reportError', () => ({ reportError: vi.fn() }));

const day = (iso) => ({ toDate: () => new Date(`${iso}T00:00:00`) });
const rowFor = (name) => screen.getAllByRole('row').find((r) => within(r).queryByRole('rowheader', { name }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-07T10:00:00'));
  vi.clearAllMocks();
  mocks.tasks = [
    // 50h over Mon 5 - Fri 9 Oct for Sana: over her 40h
    { id: 'a', assignedTo: 'sana', estimateHours: 50, startDate: day('2026-10-05'), deadline: day('2026-10-09'), status: 'pending' },
    { id: 'b', assignedTo: 'vik', estimateHours: 10, startDate: day('2026-10-05'), deadline: day('2026-10-09'), status: 'pending' },
    { id: 'c', assignedTo: 'vik', status: 'pending' },
  ];
  mocks.people.mockResolvedValue([
    { id: 'sana', name: 'Sana', role: 'staff' },
    { id: 'vik', name: 'Vikram', role: 'staff', weeklyCapacityHours: 20 },
    { id: 'admin', name: 'Arjun', role: 'org-admin' },
  ]);
  mocks.update.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe('WorkloadPlanner', () => {
  test('shows each week against capacity, most stretched first, and calls out the overloaded', async () => {
    render(<WorkloadPlanner />);
    await waitFor(() => expect(rowFor('Sana')).toBeTruthy());
    expect(screen.getByRole('status')).toHaveTextContent('1 person is over capacity');
    const names = screen.getAllByRole('rowheader').map((h) => h.textContent);
    expect(names[0]).toBe('Sana');
    expect(rowFor('Sana')).toHaveTextContent('50h, over capacity (40h)');
    expect(rowFor('Vikram')).toHaveTextContent('10h');
    expect(rowFor('Vikram')).toHaveTextContent('1 task'); // the unestimated one
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toContain('Week of 5 Oct');
  });

  test('an admin sets a capacity; nobody sets their own', async () => {
    const user = userEvent.setup();
    render(<WorkloadPlanner />);
    await waitFor(() => expect(rowFor('Sana')).toBeTruthy());
    expect(within(rowFor('Arjun')).queryByRole('spinbutton')).not.toBeInTheDocument();
    const input = within(rowFor('Sana')).getByRole('spinbutton', { name: /Weekly capacity of Sana/ });
    await user.clear(input);
    await user.type(input, '60{Enter}');
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith('sana', { weeklyCapacityHours: 60 }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Nobody is over capacity'));
  });
});
