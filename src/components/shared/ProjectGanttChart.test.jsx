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

describe('ProjectGanttChart dependencies', () => {
  // jsdom has no layout, so the grid would measure 0px wide and no line would be drawn.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00'));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800, height: 0, top: 0, left: 0, right: 800, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // A long task that keeps the short chains below off the critical path.
  const long = task({ id: 'long', title: 'Whole project', startDate: ts('2026-03-01'), deadline: ts('2026-03-31') });
  const first = task({ id: 'a', title: 'Survey', startDate: ts('2026-03-02'), deadline: ts('2026-03-06') });
  const after = (over = {}) => task({
    id: 'b', title: 'Report', startDate: ts('2026-03-09'), deadline: ts('2026-03-12'), blockedBy: ['a'], ...over,
  });
  const kinds = () => screen.getAllByTestId('gantt-dependency').map((g) => g.getAttribute('data-kind'));

  test('draws one line per real dependency, ignoring missing, self and repeated prerequisites', () => {
    render(<ProjectGanttChart tasks={[long, first, after({ blockedBy: ['a', 'a', 'ghost', 'b'] })]} />);
    expect(screen.getAllByTestId('gantt-dependency')).toHaveLength(1);
  });

  test('draws nothing when no task depends on another', () => {
    render(<ProjectGanttChart tasks={[long, first]} />);
    expect(screen.queryByTestId('gantt-dependency')).not.toBeInTheDocument();
  });

  test('an ordinary prerequisite that still has to finish', () => {
    render(<ProjectGanttChart tasks={[long, first, after()]} />);
    expect(kinds()).toEqual(['open']);
  });

  test('a successor scheduled before its prerequisite ends is flagged, and so is one starting on its last day', () => {
    const { unmount } = render(<ProjectGanttChart tasks={[long, first, after({ startDate: ts('2026-03-04') })]} />);
    expect(kinds()).toEqual(['conflict']);
    unmount();
    const { unmount: again } = render(<ProjectGanttChart tasks={[long, first, after({ startDate: ts('2026-03-06') })]} />);
    expect(kinds()).toEqual(['conflict']);
    again();
    render(<ProjectGanttChart tasks={[long, first, after({ startDate: ts('2026-03-07') })]} />);
    expect(kinds()).toEqual(['open']);
  });

  test('a finished prerequisite is not a conflict, whatever the dates', () => {
    render(<ProjectGanttChart tasks={[long, { ...first, status: 'completed' }, after({ startDate: ts('2026-03-04') })]} />);
    expect(kinds()).toEqual(['done']);
  });

  test('a chain on the critical path is drawn as critical', () => {
    render(<ProjectGanttChart tasks={[first, after()]} />);
    expect(kinds()).toEqual(['critical']);
  });

  test('the legend explains the red dashed line only when the chart has one', () => {
    const { unmount } = render(<ProjectGanttChart tasks={[long, first, after()]} />);
    expect(screen.queryByText(/starts before its prerequisite ends/i)).not.toBeInTheDocument();
    unmount();
    render(<ProjectGanttChart tasks={[long, first, after({ startDate: ts('2026-03-04') })]} />);
    expect(screen.getByText(/starts before its prerequisite ends/i)).toBeInTheDocument();
  });

  test('a bar tells people who cannot see the lines what it is waiting for', () => {
    render(<ProjectGanttChart tasks={[long, first, after()]} />);
    expect(screen.getByRole('img', { name: /Report:.*waits for Survey/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Survey:/ }).getAttribute('aria-label')).not.toMatch(/waits for/);
  });

  test('a prerequisite that is already finished is not listed as something to wait for', () => {
    render(<ProjectGanttChart tasks={[long, { ...first, status: 'completed' }, after()]} />);
    expect(screen.getByRole('img', { name: /Report:/ }).getAttribute('aria-label')).not.toMatch(/waits for/);
  });

  test('each line leaves the prerequisite where its bar ends and arrives where the successor begins', () => {
    render(<ProjectGanttChart tasks={[long, first, after()]} />);
    const px = (bar) => {
      const left = parseFloat(bar.style.left);
      return { left: (left / 100) * 800, right: ((left + parseFloat(bar.style.width)) / 100) * 800 };
    };
    const pred = px(screen.getByRole('img', { name: /^Survey:/ }));
    const succ = px(screen.getByRole('img', { name: /^Report:/ }));

    // eslint-disable-next-line testing-library/no-node-access -- the path data is the thing under test
    const d = screen.getByTestId('gantt-dependency').querySelector('path:last-of-type').getAttribute('d');
    const numbers = d.match(/-?\d+(\.\d+)?/g).map(Number);
    const startX = numbers[0];
    const endX = numbers.at(-2);

    expect(startX).toBeCloseTo(pred.right, 1);
    expect(endX).toBeCloseTo(succ.left - 1, 1); // the arrowhead stops one pixel short of the bar
    expect(d.startsWith('M ')).toBe(true);
    expect(d).not.toContain('NaN');
  });

  test('every line carries its own arrowhead', () => {
    render(<ProjectGanttChart tasks={[long, first, after()]} />);
    // eslint-disable-next-line testing-library/no-node-access -- the marker reference is the thing under test
    const arrow = screen.getByTestId('gantt-dependency').querySelector('path:last-of-type').getAttribute('marker-end');
    expect(arrow).toMatch(/^url\(#.+-arrow-open\)$/);
  });

  test('no lines are drawn before the chart has a width to draw them in', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) });
    render(<ProjectGanttChart tasks={[long, first, after()]} />);
    expect(screen.queryByTestId('gantt-dependency')).not.toBeInTheDocument();
  });
});
