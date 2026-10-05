import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TasksProvider, useTasks } from './TasksContext';

const mocks = vi.hoisted(() => ({
  user: null,
  createTask: vi.fn(),
  getAllTasks: vi.fn(),
  getTaskStatistics: vi.fn(),
  sendTaskAssignedEmail: vi.fn(),
  sendCriticalTaskAlert: vi.fn(),
  toast: vi.fn(),
  addSubtasksBulk: vi.fn(),
  updateTask: vi.fn(),
}));

vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isAuthenticated: Boolean(mocks.user) }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/taskService', () => ({
  getAllTasks: mocks.getAllTasks,
  createTask: mocks.createTask,
  updateTask: mocks.updateTask,
  deleteTask: vi.fn(),
  getTaskStatistics: mocks.getTaskStatistics,
}));
vi.mock('@/services/subtaskService', () => ({ addSubtasksBulk: mocks.addSubtasksBulk }));
vi.mock('@/services/emailService', () => ({
  sendTaskAssignedEmail: mocks.sendTaskAssignedEmail,
  sendCriticalTaskAlert: mocks.sendCriticalTaskAlert,
}));

let api;
const Grab = () => {
  api = useTasks();
  return <p>{api.tasks.length} tasks</p>;
};

const mount = async (user) => {
  mocks.user = user;
  render(<TasksProvider><Grab /></TasksProvider>);
  await waitFor(() => expect(mocks.getAllTasks).toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAllTasks.mockResolvedValue([]);
  mocks.getTaskStatistics.mockResolvedValue({ total: 0 });
  let n = 0;
  mocks.createTask.mockImplementation(async (t) => {
    if (t.title === 'boom') throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    n += 1;
    return { id: `new${n}`, ...t };
  });
});

describe('createFromPlan', () => {
  const head = { id: 'h1', name: 'Neha', role: 'department-head', orgId: 'org1', departmentIds: ['d1'], projectIds: [] };

  test('wires each dependency to the task created for it, and adds the checklists', async () => {
    mocks.addSubtasksBulk.mockResolvedValue(2);
    await mount(head);
    let outcome;
    await act(async () => {
      outcome = await api.createFromPlan([
        { key: 't1', dependsOn: [], subtasks: [], task: { title: 'Kick-off' } },
        { key: 't2', dependsOn: ['t1'], subtasks: ['Mobile', 'Desktop'], task: { title: 'Design' } },
        { key: 't3', dependsOn: ['t1', 't2'], subtasks: [], task: { title: 'Sign-off', milestone: true } },
      ]);
    });
    const [kick, design, signoff] = mocks.createTask.mock.calls.map((c) => c[0]);
    expect(kick.blockedBy).toBeUndefined();
    expect(design).toMatchObject({ title: 'Design', blockedBy: ['new1'], createdBy: 'h1', departmentId: 'd1' });
    expect(signoff.blockedBy).toEqual(['new1', 'new2']);
    expect(mocks.addSubtasksBulk).toHaveBeenCalledWith('new2', ['Mobile', 'Desktop'], 'h1');
    expect(outcome.created).toHaveLength(3);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tasks created from the template' }));
  });

  test('a failed prerequisite does not stop the rest; its dependants are created without it', async () => {
    await mount(head);
    let outcome;
    await act(async () => {
      outcome = await api.createFromPlan([
        { key: 'a', dependsOn: [], subtasks: [], task: { title: 'boom' } },
        { key: 'b', dependsOn: ['a'], subtasks: [], task: { title: 'After' } },
      ]);
    });
    expect(outcome.failed).toEqual([expect.objectContaining({ index: 0 })]);
    expect(mocks.createTask.mock.calls[1][0].blockedBy).toBeUndefined();
  });

  test('a checklist that cannot be saved does not undo the task', async () => {
    mocks.addSubtasksBulk.mockRejectedValue(new Error('denied'));
    await mount(head);
    let outcome;
    await act(async () => {
      outcome = await api.createFromPlan([{ key: 'a', dependsOn: [], subtasks: ['x'], task: { title: 'One' } }]);
    });
    expect(outcome.created).toHaveLength(1);
    expect(outcome.failed).toEqual([]);
  });
});

describe('importTasks', () => {
  const manager = { id: 'm1', name: 'Rohit', role: 'manager', orgId: 'org1', projectIds: ['p1'], departmentIds: [] };

  test('stamps each task like a normal create, adds them to the list, and toasts once', async () => {
    await mount(manager);
    let outcome;
    await act(async () => {
      outcome = await api.importTasks([
        { title: 'One', assignedTo: 'u1', priority: 'medium' },
        { title: 'Two', assignedTo: 'u2', priority: 'critical', projectId: 'p1' },
      ]);
    });

    expect(mocks.createTask).toHaveBeenCalledTimes(2);
    expect(mocks.createTask.mock.calls[0][0]).toMatchObject({ title: 'One', createdBy: 'm1', orgId: 'org1', projectId: 'p1' });
    expect(outcome.created.map((t) => t.title)).toEqual(['One', 'Two']);
    expect(outcome.failed).toEqual([]);
    expect(screen.getByText('2 tasks')).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tasks imported', description: '2 tasks added.' }));
  });

  test('sends no email unless asked, and the right kind when asked', async () => {
    await mount(manager);
    await act(async () => { await api.importTasks([{ title: 'One', assignedTo: 'u1' }]); });
    expect(mocks.sendTaskAssignedEmail).not.toHaveBeenCalled();

    await act(async () => {
      await api.importTasks(
        [{ title: 'One', assignedTo: 'u1', priority: 'low' }, { title: 'Hot', assignedTo: 'u2', priority: 'critical' }, { title: 'Nobody' }],
        { notify: true },
      );
    });
    expect(mocks.sendTaskAssignedEmail).toHaveBeenCalledTimes(1);
    expect(mocks.sendCriticalTaskAlert).toHaveBeenCalledTimes(1);
    expect(mocks.sendCriticalTaskAlert.mock.calls[0][0]).toMatchObject({ toUid: 'u2', taskTitle: 'Hot', assignedBy: 'Rohit' });
  });

  test('a row that fails is reported with its position and does not stop the rest', async () => {
    await mount(manager);
    const progress = [];
    let outcome;
    await act(async () => {
      outcome = await api.importTasks(
        [{ title: 'One' }, { title: 'boom' }, { title: 'Three' }],
        { onProgress: (done, total) => progress.push(`${done}/${total}`) },
      );
    });
    expect(outcome.created.map((t) => t.title)).toEqual(['One', 'Three']);
    expect(outcome.failed).toEqual([{ index: 1, task: { title: 'boom' }, message: expect.any(String) }]);
    expect(progress).toEqual(['1/3', '2/3', '3/3']);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Imported 2 of 3 tasks' }));
  });

  test('statistics are refreshed once for the whole batch', async () => {
    await mount(manager);
    const before = mocks.getTaskStatistics.mock.calls.length;
    await act(async () => { await api.importTasks([{ title: 'a' }, { title: 'b' }, { title: 'c' }]); });
    expect(mocks.getTaskStatistics.mock.calls.length - before).toBe(1);
  });
});

describe('rescheduleTask', () => {
  test('moves the task and the dependents the Gantt worked out; one Undo puts them all back', async () => {
    mocks.updateTask.mockImplementation(async (id, u) => ({ id, ...u }));
    await mount({ id: 'u1', role: 'org-admin', orgId: 'o1' });
    const task = { id: 'b', title: 'Report', startDate: '2026-03-09T00:00:00.000Z', deadline: '2026-03-12T00:00:00.000Z' };
    const dep = { id: 'c', title: 'Review', startDate: '2026-03-13T00:00:00.000Z', deadline: '2026-03-14T00:00:00.000Z' };
    const onChange = vi.fn();
    await act(() => api.rescheduleTask(task, { startDate: '2026-03-11', deadline: '2026-03-14' }, {
      onChange, dependents: [{ task: dep, startDate: '2026-03-15', deadline: '2026-03-16' }],
    }));
    expect(mocks.updateTask).toHaveBeenCalledWith('c', { startDate: '2026-03-15', deadline: '2026-03-16' });
    expect(onChange).toHaveBeenCalledTimes(2);
    const shown = mocks.toast.mock.calls.at(-1)[0];
    expect(shown.description).toMatch(/1 task that depends on it moved along/);

    mocks.updateTask.mockClear();
    await act(() => shown.action.props.onClick());
    expect(mocks.updateTask).toHaveBeenCalledWith('b', { startDate: '2026-03-09', deadline: '2026-03-12' });
    expect(mocks.updateTask).toHaveBeenCalledWith('c', { startDate: '2026-03-13', deadline: '2026-03-14' });
  });

  test('a dependent that cannot be saved stays put and is not undone', async () => {
    mocks.updateTask.mockImplementation(async (id, u) => {
      if (id === 'c') throw Object.assign(new Error('no'), { code: 'permission-denied' });
      return { id, ...u };
    });
    await mount({ id: 'u1', role: 'org-admin', orgId: 'o1' });
    const task = { id: 'b', title: 'Report', startDate: '2026-03-09T00:00:00.000Z', deadline: '2026-03-12T00:00:00.000Z' };
    await act(() => api.rescheduleTask(task, { startDate: '2026-03-11', deadline: '2026-03-14' }, {
      dependents: [{ task: { id: 'c', title: 'Review' }, startDate: '2026-03-15', deadline: '2026-03-16' }],
    }));
    const shown = mocks.toast.mock.calls.find(([t]) => t.title === 'Rescheduled')[0];
    expect(shown.description).not.toMatch(/moved along/);
  });
});
