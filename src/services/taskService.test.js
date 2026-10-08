import { describe, test, expect, vi, beforeEach } from 'vitest';

// Capture the constraints handed to Firestore so we can assert on the query
// that would actually be sent, without touching a real database.
const calls = { where: [], limit: [], orderBy: [], listeners: [], stopped: 0 };

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
  // the live list: each listener remembers its query and callback
  onSnapshot: vi.fn((q, next) => { calls.listeners.push({ q, next }); return () => { calls.stopped += 1; }; }),
  Timestamp: { now: () => ({ __now: true }), fromDate: (d) => ({ __ts: d }) },
}));

vi.mock('@/config/firebase', () => ({ db: {}, auth: { currentUser: null }, secondaryAuth: {} }));
vi.mock('./emailService', () => ({ sendCriticalTaskAlert: vi.fn() }));
vi.mock('./subtaskService', () => ({ deleteAllSubtasksForTask: vi.fn() }));
vi.mock('./userService', () => ({ getCallerProfile: vi.fn(async () => null) }));

const { getAllTasks, getTaskStatistics, subscribeTasks } = await import('./taskService');
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
  calls.where = []; calls.limit = []; calls.orderBy = []; calls.listeners = []; calls.stopped = 0;
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
    tasksById.b = { id: 'b', title: 'Write the spec', status: 'in-progress' };
    await expect(updateTask('a', { status: 'in-progress' })).rejects.toMatchObject({ code: 'task-blocked' });
    expect(updateDoc).not.toHaveBeenCalled();
  });

  // The user must be told WHICH task is in the way, not just that one is.
  test('the error names the blocking task and its state', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: ['b'] };
    tasksById.b = { id: 'b', title: 'Write the spec', status: 'in-progress' };
    const error = await updateTask('a', { status: 'completed' }).catch((e) => e);
    expect(error.message).toBe('Blocked by “Write the spec” (In progress). Finish it first.');
    expect(error.userFacing).toBe(true);
    expect(error.blockers).toEqual([{ id: 'b', title: 'Write the spec', status: 'in-progress' }]);
  });

  test('several blockers are summarised, naming up to three', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: ['b', 'c', 'd', 'e'] };
    for (const [id, title] of [['b', 'One'], ['c', 'Two'], ['d', 'Three'], ['e', 'Four']]) tasksById[id] = { id, title, status: 'pending' };
    const error = await updateTask('a', { status: 'in-progress' }).catch((e) => e);
    expect(error.message).toContain('Blocked by 4 tasks: “One” (Pending), “Two” (Pending), “Three” (Pending) and 1 more.');
  });

  test('start to start: it can start once the prerequisite has started', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: ['b'], dependencyLinks: { b: { type: 'SS' } } };
    tasksById.b = { id: 'b', title: 'Design', status: 'pending' };
    const error = await updateTask('a', { status: 'in-progress' }).catch((e) => e);
    expect(error.message).toBe('Blocked by “Design” (Pending). Start it first.');
    tasksById.b.status = 'in-progress';
    await expect(updateTask('a', { status: 'in-progress' })).resolves.toBeDefined();
  });

  test('finish to finish: it can start any time, but not be completed first', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: ['b'], dependencyLinks: { b: { type: 'FF' } } };
    tasksById.b = { id: 'b', title: 'Testing', status: 'in-progress' };
    await expect(updateTask('a', { status: 'in-progress' })).resolves.toBeDefined();
    const error = await updateTask('a', { status: 'completed' }).catch((e) => e);
    expect(error.message).toBe('Blocked by “Testing” (In progress). It has to finish before this one can.');
  });

  test('links are stored only for listed prerequisites and only when not the default', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: [] };
    tasksById.b = { id: 'b', status: 'pending' };
    await updateTask('a', { blockedBy: ['b'], dependencyLinks: { b: { type: 'SS', lag: 2 }, gone: { type: 'FF' } } });
    expect(updateDoc.mock.calls.at(-1)[1].dependencyLinks).toEqual({ b: { type: 'SS', lag: 2 } });
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

  test('new dates are stored as timestamps, and an emptied date is cleared rather than saved as ""', async () => {
    tasksById.a = { id: 'a', status: 'pending', blockedBy: [] };
    await updateTask('a', { startDate: '', deadline: '2026-10-12' });
    const written = updateDoc.mock.calls[0][1];
    expect(written.startDate).toBeNull();
    expect(written.deadline).toEqual({ __ts: new Date('2026-10-12') });
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

describe('subscribeTasks', () => {
  const snap = (ids) => ({ docs: ids.map((id) => ({ id, data: () => ({ title: id }) })) });

  test('one listener per chunk of more than 10 projects; one merged list once every chunk answered', () => {
    const got = [];
    const projectIds = Array.from({ length: 12 }, (_, i) => `p${i}`);
    const stop = subscribeTasks({ orgId: 'o1', projectIds }, (tasks) => got.push(tasks));
    expect(calls.listeners).toHaveLength(2);
    calls.listeners[0].next(snap(['a', 'b']));
    expect(got).toHaveLength(0);
    calls.listeners[1].next(snap(['b', 'c']));
    expect(got.at(-1).map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    expect(got.at(-1).truncated).toBe(false);
    calls.listeners[0].next(snap(['a']));
    expect(got.at(-1).map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
    stop();
    expect(calls.stopped).toBe(2);
  });

  test('a chunk that reaches the bound is flagged', () => {
    let last;
    subscribeTasks({ orgId: 'o1', limit: 2 }, (tasks) => { last = tasks; });
    calls.listeners[0].next(snap(['a', 'b']));
    expect(last.truncated).toBe(true);
    expect(calls.limit).toContain(2);
  });
});
