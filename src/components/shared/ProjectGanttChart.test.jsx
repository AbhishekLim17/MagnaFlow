import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import ProjectGanttChart from './ProjectGanttChart';
import { addDays, startOfDay } from '@/lib/ganttLayout';
import { dayKey } from '@/lib/calendarLayout';

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

describe('ProjectGanttChart rescheduling and milestones', () => {
  // jsdom has no PointerEvent; a MouseEvent with the pointer fields is enough here.
  class FakePointerEvent extends MouseEvent {
    constructor(type, init = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 1;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-03-10T12:00:00'));
    window.PointerEvent = FakePointerEvent;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800, height: 0, top: 0, left: 0, right: 800, bottom: 0, x: 0, y: 0, toJSON: () => ({}),
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete window.PointerEvent;
  });

  // Mar 1 - Mar 31 keeps the span fixed: the axis runs Feb 28 .. Apr 2 (33 days).
  const long = task({ id: 'long', title: 'Whole project', startDate: ts('2026-03-01'), deadline: ts('2026-03-31') });
  const report = task({ id: 'b', title: 'Report', startDate: ts('2026-03-09'), deadline: ts('2026-03-12') });
  const day = (iso, plus) => dayKey(addDays(startOfDay(new Date(iso)), plus));
  const DAY_PX = 800 / 33;

  const setup = (props = {}) => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const utils = render(
      <ProjectGanttChart tasks={[long, report]} canReschedule={(t) => t.id === 'b'} onReschedule={onReschedule} {...props} />
    );
    return { ...utils, onReschedule, user: userEvent.setup({ advanceTimers: vi.advanceTimersByTime }) };
  };
  const bar = (name) => screen.getByRole('button', { name: new RegExp(`^${name}:`) });

  test('only bars the viewer may edit can be grabbed', () => {
    setup();
    expect(bar('Report')).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('button', { name: /^Whole project:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /^Whole project:/ })).toBeInTheDocument();
    expect(screen.getByText(/Drag a bar to move it/)).toBeInTheDocument();
  });

  test('without a reschedule handler nothing is draggable and no help is shown', () => {
    render(<ProjectGanttChart tasks={[long, report]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/Drag a bar to move it/)).not.toBeInTheDocument();
  });

  test('dragging the bar moves both dates by whole days', () => {
    const { onReschedule } = setup();
    const el = bar('Report');
    fireEvent.pointerDown(el, { clientX: 300, button: 0 });
    fireEvent.pointerMove(el, { clientX: 300 + DAY_PX * 2 + 2 });
    fireEvent.pointerUp(el, { clientX: 300 + DAY_PX * 2 + 2 });
    expect(onReschedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b' }),
      { startDate: day('2026-03-09', 2), deadline: day('2026-03-12', 2) },
    );
  });

  test('dragging the right edge changes only the deadline', () => {
    const { onReschedule, container } = setup();
    // eslint-disable-next-line testing-library/no-node-access -- the edge handle is decorative, so it has no role
    const handle = container.querySelectorAll('.cursor-ew-resize')[1];
    fireEvent.pointerDown(handle, { clientX: 400, button: 0 });
    fireEvent.pointerMove(bar('Report'), { clientX: 400 + DAY_PX * 3 });
    fireEvent.pointerUp(bar('Report'), { clientX: 400 + DAY_PX * 3 });
    expect(onReschedule).toHaveBeenCalledWith(expect.anything(), {
      startDate: day('2026-03-09', 0), deadline: day('2026-03-12', 3),
    });
  });

  test('a click without movement, or a touch, does not reschedule', () => {
    const { onReschedule } = setup();
    const el = bar('Report');
    fireEvent.pointerDown(el, { clientX: 300, button: 0 });
    fireEvent.pointerUp(el, { clientX: 301 });
    fireEvent.pointerDown(el, { clientX: 300, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(el, { clientX: 400, pointerType: 'touch' });
    fireEvent.pointerUp(el, { clientX: 400, pointerType: 'touch' });
    expect(onReschedule).not.toHaveBeenCalled();
  });

  test('arrow keys move the task; Shift moves only the deadline; Enter saves', async () => {
    const { onReschedule, user } = setup();
    bar('Report').focus();
    await user.keyboard('{ArrowRight}{ArrowRight}{Shift>}{ArrowRight}{/Shift}{Enter}');
    expect(onReschedule).toHaveBeenCalledTimes(1);
    expect(onReschedule.mock.calls[0][1]).toEqual({ startDate: day('2026-03-09', 2), deadline: day('2026-03-12', 3) });
  });

  test('arrow-key changes save themselves after a pause, and Escape cancels them', async () => {
    const { onReschedule, user } = setup();
    bar('Report').focus();
    await user.keyboard('{ArrowLeft}{Escape}');
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(onReschedule).not.toHaveBeenCalled();

    await user.keyboard('{ArrowLeft}');
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(onReschedule).toHaveBeenCalledWith(expect.anything(), { startDate: day('2026-03-09', -1), deadline: day('2026-03-12', -1) });
  });

  test('a refused change puts the bar back where it was', async () => {
    const onReschedule = vi.fn().mockRejectedValue(new Error('denied'));
    setup({ onReschedule });
    const el = bar('Report');
    const before = el.style.left;
    fireEvent.pointerDown(el, { clientX: 300, button: 0 });
    fireEvent.pointerMove(el, { clientX: 300 + DAY_PX * 2 });
    fireEvent.pointerUp(el, { clientX: 300 + DAY_PX * 2 });
    await waitFor(() => expect(onReschedule).toHaveBeenCalled());
    await waitFor(() => expect(bar('Report').style.left).toBe(before));
  });

  test('a milestone is a diamond on its deadline, says so, and moves as one date', async () => {
    const launch = task({ id: 'm', title: 'Launch', startDate: ts('2026-03-02'), deadline: ts('2026-03-20'), milestone: true });
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    render(<ProjectGanttChart tasks={[long, launch]} canReschedule={() => true} onReschedule={onReschedule} />);
    const diamond = screen.getByRole('button', { name: /^Launch: milestone/ });
    expect(diamond).toHaveAttribute('aria-roledescription', 'milestone');
    expect(diamond.className).toContain('rotate-45');
    expect(screen.getByText('Milestone')).toBeInTheDocument(); // legend
    diamond.focus();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).keyboard('{Shift>}{ArrowRight}{/Shift}{Enter}');
    expect(onReschedule.mock.calls[0][1]).toEqual({ startDate: day('2026-03-20', 1), deadline: day('2026-03-20', 1) });
  });
});
