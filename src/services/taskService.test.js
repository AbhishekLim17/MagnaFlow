import { describe, test, expect, vi, beforeEach } from 'vitest';

// Capture the constraints handed to Firestore so we can assert on the query
// that would actually be sent, without touching a real database.
const calls = { where: [], limit: [], orderBy: [] };

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ __col: true })),
  doc: vi.fn(() => ({ __doc: true })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => ({ forEach: () => {}, docs: [], size: 0 })),
  addDoc: vi.fn(async () => ({ id: 'new' })),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  arrayRemove: vi.fn((v) => ({ __arrayRemove: v })),
  query: vi.fn((_c, ...constraints) => ({ __q: constraints })),
  where: vi.fn((f, op, v) => { calls.where.push([f, op, v]); return { __w: [f, op, v] }; }),
  orderBy: vi.fn((f, d) => { calls.orderBy.push([f, d]); return { __o: [f, d] }; }),
  limit: vi.fn((n) => { calls.limit.push(n); return { __l: n }; }),
  Timestamp: { now: () => ({ __now: true }), fromDate: (d) => ({ __ts: d }) },
}));

vi.mock('@/config/firebase', () => ({ db: {}, auth: { currentUser: null }, secondaryAuth: {} }));
vi.mock('./emailService', () => ({ sendCriticalTaskAlert: vi.fn() }));
vi.mock('./subtaskService', () => ({ deleteAllSubtasksForTask: vi.fn() }));
vi.mock('./userService', () => ({ getCallerProfile: vi.fn(async () => null) }));

const { getAllTasks, getTaskStatistics } = await import('./taskService');
const { getDocs, getDoc, doc, updateDoc, arrayRemove } = await import('firebase/firestore');
const { updateTask, deleteTask } = await import('./taskService');

const snapshotOf = (count) => {
  const docs = Array.from({ length: count }, (_, i) => ({ id: `t${i}`, data: () => ({ title: `Task ${i}` }) }));
  return { docs, size: docs.length, forEach: (cb) => docs.forEach(cb) };
};

const fields = () => calls.where.map(([f]) => f);
const valueFor = (field) => calls.where.find(([f]) => f === field)?.[2];
const opFor = (field) => calls.where.find(([f]) => f === field)?.[1];

beforeEach(() => {
  calls.where = []; calls.limit = []; calls.orderBy = [];
});

describe('getAllTasks scoping', () => {
  test('scopes by organization', async () => {
    await getAllTasks({ orgId: 'orgA' });
    expect(fields()).toContain('orgId');
    expect(valueFor('orgId')).toBe('orgA');
  });

  test('scopes a department head to their departments', async () => {
    await getAllTasks({ orgId: 'orgA', departmentIds: ['d1', 'd2'] });
    expect(opFor('departmentId')).toBe('in');
    expect(valueFor('departmentId')).toEqual(['d1', 'd2']);
  });

  test('scopes a manager to their projects', async () => {
    await getAllTasks({ orgId: 'orgA', projectIds: ['p1'] });
    expect(opFor('projectId')).toBe('in');
    expect(valueFor('projectId')).toEqual(['p1']);
  });

  test('scopes staff to tasks assigned to them', async () => {
    await getAllTasks({ assignedTo: 'user1' });
    expect(valueFor('assignedTo')).toBe('user1');
  });

  // Firestore rejects an `in` filter with more than 10 values. Longer lists used
  // to be truncated (silently losing the 11th department onward); they are now
  // split into several queries and merged.
  test('splits an `in` filter of more than 10 values into chunks instead of dropping any', async () => {
    const many = Array.from({ length: 25 }, (_, i) => `d${i}`);
    await getAllTasks({ orgId: 'orgA', departmentIds: many });
    const sizes = calls.where.filter(([f]) => f === 'departmentId').map(([, , v]) => v.length);
    expect(sizes).toEqual([10, 10, 5]);
  });

  test('ignores empty scope arrays rather than emitting a broken filter', async () => {
    await getAllTasks({ orgId: 'orgA', departmentIds: [], projectIds: [] });
    expect(fields()).not.toContain('departmentId');
    expect(fields()).not.toContain('projectId');
  });
});

describe('getAllTasks bounding', () => {
  test('always applies a limit, even with no filters', async () => {
    await getAllTasks();
    expect(calls.limit.length).toBe(1);
    expect(calls.limit[0]).toBeGreaterThan(0);
  });

  test('applies a limit alongside filters', async () => {
    await getAllTasks({ orgId: 'orgA' });
    expect(calls.limit.length).toBe(1);
  });

  test('honours an explicit limit', async () => {
    await getAllTasks({ orgId: 'orgA', limit: 25 });
    expect(calls.limit[0]).toBe(25);
  });
});

// This is the only signal a caller gets that a bounded read may not be the
// whole collection — an org that outgrows the limit used to see a task list
// that looked complete but silently wasn't, with nothing to say why.
describe('getAllTasks truncation flag', () => {
  test('flags the result when it exactly fills the requested bound', async () => {
    getDocs.mockResolvedValueOnce(snapshotOf(5));
    const tasks = await getAllTasks({ orgId: 'orgA', limit: 5 });
    expect(tasks.truncated).toBe(true);
  });

  test('does not flag a result that falls short of the bound', async () => {
    getDocs.mockResolvedValueOnce(snapshotOf(3));
    const tasks = await getAllTasks({ orgId: 'orgA', limit: 5 });
    expect(tasks.truncated).toBe(false);
  });

  test('an empty result is not flagged', async () => {
    getDocs.mockResolvedValueOnce(snapshotOf(0));
    const tasks = await getAllTasks({ orgId: 'orgA', limit: 5 });
    expect(tasks.truncated).toBe(false);
  });
});

describe('getTaskStatistics', () => {
  test('passes its scope through to the underlying query', async () => {
    await getTaskStatistics({ orgId: 'orgA' });
    expect(valueFor('orgId')).toBe('orgA');
  });

  test('returns a zeroed shape when there are no tasks', async () => {
    const stats = await getTaskStatistics({ orgId: 'orgA' });
    expect(stats).toMatchObject({ total: 0, pending: 0, inProgress: 0, completed: 0 });
    expect(stats.byPriority).toBeDefined();
  });
});

// Dependencies are enforced in the service so every screen gets the same rule.
describe('updateTask dependency guards', () => {
  const tasksById = {};
  const asDoc = (t) => (t ? { exists: () => true, id: t.id, data: () => t } : { exists: () => false });

  beforeEach(() => {
    for (const k of Object.keys(tasksById)) delete tasksById[k];
    updateDoc.mockClear();
    doc.mockImplementation((_db, _col, id) => ({ __doc: true, id }));
    getDoc.mockImplementation(async (ref) => asDoc(tasksById[ref?.id]));
  });

  test('a task with unfinished prerequisites cannot be started', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: ['b'] };
    tasksById.b = { id: 'b', status: 'in-progress' };
    await expect(updateTask('a', { status: 'in-progress' })).rejects.toMatchObject({ code: 'task-blocked' });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('it can be started once prerequisites are completed or cancelled', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: ['b', 'c'] };
    tasksById.b = { id: 'b', status: 'completed' };
    tasksById.c = { id: 'c', status: 'cancelled' };
    await updateTask('a', { status: 'in-progress' });
    expect(updateDoc).toHaveBeenCalled();
  });

  test('moving back to pending is never blocked', async () => {
    tasksById.a = { id: 'a', status: 'in-progress', blockedBy: ['b'] };
    tasksById.b = { id: 'b', status: 'pending' };
    await updateTask('a', { status: 'pending' });
    expect(updateDoc).toHaveBeenCalled();
  });

  test('a dependency loop is refused', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: [] };
    tasksById.b = { id: 'b', status: 'pending', blockedBy: ['a'] };
    await expect(updateTask('a', { blockedBy: ['b'] })).rejects.toMatchObject({ code: 'dependency-cycle' });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test('reopening a completed task clears completedAt', async () => {
    tasksById.a = { id: 'a', status: 'completed', blockedBy: [] };
    await updateTask('a', { status: 'in-progress' });
    expect(updateDoc.mock.calls[0][1]).toMatchObject({ status: 'in-progress', completedAt: null });
  });

  test('updating a task that no longer exists reports it', async () => {
    await expect(updateTask('gone', { status: 'completed' })).rejects.toMatchObject({ code: 'task-not-found' });
  });
});

describe('deleteTask', () => {
  test('detaches the deleted task from tasks that depended on it', async () => {
    updateDoc.mockClear();
    await deleteTask('t1', { dependentTaskIds: ['x', 'y'] });
    expect(updateDoc).toHaveBeenCalledTimes(2);
    expect(updateDoc.mock.calls[0][1].blockedBy).toEqual({ __arrayRemove: 't1' });
    expect(arrayRemove).toHaveBeenCalledWith('t1');
  });

  test('a dependent that cannot be updated does not block the delete', async () => {
    updateDoc.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 'permission-denied' }));
    await expect(deleteTask('t1', { dependentTaskIds: ['x'] })).resolves.not.toThrow();
  });
});
