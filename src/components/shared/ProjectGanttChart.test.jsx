import { render, screen } from '@testing-library/react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import ProjectGanttChart from './ProjectGanttChart';

// Firestore Timestamp stand-in.
const ts = (iso) => ({ toDate: () => new Date(iso) });

const task = (over = {}) => ({
  id: 't1',
  title: 'Survey',
  status: 'pending',
  startDate: ts('2026-03-02'),
  deadline: ts('2026-03-06'),
  ...over,
});

describe('ProjectGanttChart', () => {
  beforeEach(() => {
    // Pin "today" so overdue calculations are deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  test('prompts for dates when there are no tasks', () => {
    render(<ProjectGanttChart tasks={[]} />);
    expect(screen.getByText(/no tasks with dates yet/i)).toBeInTheDocument();
  });

  test('renders a bar per task, labelled with status and dates', () => {
    render(<ProjectGanttChart tasks={[task()]} />);
    expect(screen.getByText('Survey')).toBeInTheDocument();
    // Status is exposed accessibly, not by colour alone.
    expect(screen.getByRole('img', { name: /Survey:/ })).toBeInTheDocument();
  });

  test('marks an incomplete task past its deadline as Overdue', () => {
    render(<ProjectGanttChart tasks={[task({ status: 'pending' })]} />);
    expect(screen.getByRole('img', { name: /Overdue/ })).toBeInTheDocument();
  });

  test('does not mark a completed task as overdue', () => {
    render(<ProjectGanttChart tasks={[task({ status: 'completed' })]} />);
    expect(screen.getByRole('img', { name: /Completed/ })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Overdue/ })).not.toBeInTheDocument();
  });

  test('falls back to createdAt when a task has no start date', () => {
    render(
      <ProjectGanttChart
        tasks={[task({ startDate: null, createdAt: ts('2026-03-01'), status: 'completed' })]}
      />
    );
    expect(screen.getByText('Survey')).toBeInTheDocument();
  });

  test('survives a task whose deadline precedes its start date', () => {
    expect(() =>
      render(
        <ProjectGanttChart
          tasks={[task({ startDate: ts('2026-03-08'), deadline: ts('2026-03-02') })]}
        />
      )
    ).not.toThrow();
  });

  test('skips tasks with no usable dates instead of crashing', () => {
    render(<ProjectGanttChart tasks={[task({ startDate: null, deadline: null, createdAt: null })]} />);
    expect(screen.getByText(/no tasks with dates yet/i)).toBeInTheDocument();
  });

  test('shows the assignee name when a resolver is supplied', () => {
    render(
      <ProjectGanttChart tasks={[task({ assignedTo: 'u1' })]} getStaffName={() => 'Ravi Kumar'} />
    );
    expect(screen.getByText('Ravi Kumar')).toBeInTheDocument();
  });

  test('orders tasks by start date', () => {
    render(
      <ProjectGanttChart
        tasks={[
          task({ id: 'b', title: 'Later', startDate: ts('2026-03-05') }),
          task({ id: 'a', title: 'Earlier', startDate: ts('2026-03-01') }),
        ]}
      />
    );
    // getAllByTestId returns matches in document order, which is what the
    // assertion is really about — reaching into the container to select by
    // class coupled the test to styling that has since changed twice.
    const titles = screen.getAllByTestId('gantt-task-title').map((n) => n.textContent);
    expect(titles.indexOf('Earlier')).toBeLessThan(titles.indexOf('Later'));
  });
});
