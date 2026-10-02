import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KanbanBoard from './KanbanBoard';

// The card counts come from Firestore listeners; the board does not care about them here.
vi.mock('@/hooks/useCommentCount', () => ({ useCommentCount: () => 0 }));
vi.mock('@/hooks/useSubtaskCount', () => ({ useSubtaskCount: () => ({ total: 0, completed: 0 }) }));

const tasks = [
  { id: 't1', title: 'Renew the payment gateway', status: 'pending', priority: 'high', assignedTo: 'u1' },
  { id: 't2', title: 'Ship the billing job', status: 'in-progress', priority: 'medium' },
  { id: 't3', title: 'Old idea', status: 'cancelled', priority: 'low' },
];

const setup = (props = {}) => {
  const onCardClick = vi.fn();
  const onAddTask = vi.fn();
  render(
    <KanbanBoard tasks={tasks} staffMap={{ u1: 'Aisha Khan' }} onCardClick={onCardClick} onAddTask={onAddTask} canAdd {...props} />
  );
  return { onCardClick, onAddTask, user: userEvent.setup() };
};

describe('KanbanBoard accessibility', () => {
  test('columns are headings, cards are headings under them (no skipped levels)', () => {
    setup();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Todo', 'In Progress', 'Review', 'Done']);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Renew the payment gateway',
      'Ship the billing job',
    ]);
  });

  test('a card opens from the keyboard through its title button', async () => {
    const { onCardClick, user } = setup();
    // Tab until the first card's title is focused: it must be reachable that way.
    const title = screen.getByRole('button', { name: 'Renew the payment gateway' });
    let reached = false;
    for (let i = 0; i < 12 && !reached; i += 1) {
      await user.tab();
      try {
        expect(title).toHaveFocus();
        reached = true;
      } catch {
        // not there yet; keep tabbing
      }
    }
    expect(reached).toBe(true);

    await user.keyboard('{Enter}');
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick.mock.calls[0][0].id).toBe('t1');
  });

  test('clicking a card opens it exactly once', async () => {
    const { onCardClick, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Ship the billing job' }));
    expect(onCardClick).toHaveBeenCalledTimes(1);
    expect(onCardClick.mock.calls[0][0].id).toBe('t2');
  });

  test('each drag handle says which task it moves, and nothing nests inside another button', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Move Renew the payment gateway' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move Ship the billing job' })).toBeInTheDocument();
    for (const button of screen.getAllByRole('button')) {
      expect(within(button).queryAllByRole('button')).toHaveLength(0);
    }
  });

  test('the add buttons name their column', async () => {
    const { onAddTask, user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add task to Review' }));
    expect(onAddTask).toHaveBeenCalledWith('review');
  });

  test('the board explains the keyboard way to move a card', () => {
    setup();
    expect(document.body.textContent).toMatch(/press space or enter on its move button/i);
  });

  test('cancelled work is counted, not shown', () => {
    setup();
    expect(screen.getByText(/1 cancelled task is hidden/i)).toBeInTheDocument();
    expect(screen.queryByText('Old idea')).not.toBeInTheDocument();
  });
});
