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
}));

vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: mocks.user, isAuthenticated: Boolean(mocks.user) }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/services/taskService', () => ({
  getAllTasks: mocks.getAllTasks,
  createTask: mocks.createTask,
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getTaskStatistics: mocks.getTaskStatistics,
}));
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
