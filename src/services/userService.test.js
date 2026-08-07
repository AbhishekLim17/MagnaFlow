import { describe, test, expect, vi, beforeEach } from 'vitest';

// Documents the fake Firestore returns, keyed by the collection being queried.
let userDocs = [];
let deletionDocs = [];
let lastCollection = null;

const snap = (arr) => ({
  docs: arr.map((d) => ({ id: d.id, data: () => d })),
  forEach(cb) { this.docs.forEach(cb); },
  size: arr.length,
});

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => { lastCollection = name; return { __col: name }; }),
  doc: vi.fn(() => ({ __doc: true })),
  documentId: vi.fn(() => ({ __fieldPath: '__name__' })),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  getDocs: vi.fn(async () => (lastCollection === 'userDeletions' ? snap(deletionDocs) : snap(userDocs))),
  addDoc: vi.fn(async () => ({ id: 'new' })),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
  deleteDoc: vi.fn(async () => {}),
  query: vi.fn((c) => c),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  limit: vi.fn(() => ({})),
  Timestamp: { now: () => ({ __now: true }) },
}));

vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('@/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin1', email: 'admin@x.com' } },
  secondaryAuth: { currentUser: null },
}));

const { getPendingAuthCleanups, getUsersByIds, getAllUsers } = await import('./userService');
const { getDocs } = await import('firebase/firestore');

beforeEach(() => {
  userDocs = [];
  deletionDocs = [];
  lastCollection = null;
});

describe('getPendingAuthCleanups', () => {
  // Regression: a deleted user may be re-added later (rehired, or the address
  // reused). Surfacing that record would tell an admin to delete the Firebase
  // sign-in of a CURRENTLY ACTIVE user and lock them out.
  test('hides a record whose email is back in active use', async () => {
    deletionDocs = [{ id: 'u1', email: 'tejas@x.com', orgId: 'orgA', authCleanupDone: false }];
    userDocs = [{ id: 'u9', email: 'tejas@x.com', role: 'staff', orgId: 'orgA' }];

    expect(await getPendingAuthCleanups('orgA')).toHaveLength(0);
  });

  test('surfaces a record whose email is genuinely unused', async () => {
    deletionDocs = [{ id: 'u2', email: 'gone@x.com', orgId: 'orgA', authCleanupDone: false }];
    userDocs = [{ id: 'u9', email: 'someone.else@x.com', role: 'staff', orgId: 'orgA' }];

    const pending = await getPendingAuthCleanups('orgA');
    expect(pending).toHaveLength(1);
    expect(pending[0].email).toBe('gone@x.com');
  });

  test('compares emails case-insensitively', async () => {
    deletionDocs = [{ id: 'u3', email: 'Mixed@X.com', orgId: 'orgA', authCleanupDone: false }];
    userDocs = [{ id: 'u9', email: 'mixed@x.com', role: 'staff', orgId: 'orgA' }];

    expect(await getPendingAuthCleanups('orgA')).toHaveLength(0);
  });

  test('drops records with no email rather than showing a blank row', async () => {
    deletionDocs = [{ id: 'u4', email: null, orgId: 'orgA', authCleanupDone: false }];
    expect(await getPendingAuthCleanups('orgA')).toHaveLength(0);
  });

  test('returns nothing when there are no deletion records', async () => {
    expect(await getPendingAuthCleanups('orgA')).toEqual([]);
  });

  // This panel is advisory; it must never take the page down with it.
  test('returns an empty list instead of throwing when the query fails', async () => {
    const fs = await import('firebase/firestore');
    fs.getDocs.mockRejectedValueOnce(new Error('permission-denied'));
    expect(await getPendingAuthCleanups('orgA')).toEqual([]);
  });
});

// The audit log's targetUserId, and anything else that has a bare uid and
// wants a name for it, resolves through this — bounded and batched rather
// than fetching every user in the org to label one log line.
describe('getUsersByIds', () => {
  test('resolves a known id to its user document', async () => {
    userDocs = [{ id: 'u1', name: 'Ajay Gupta', email: 'ajay@x.com' }];
    const map = await getUsersByIds(['u1']);
    expect(map.get('u1')).toMatchObject({ name: 'Ajay Gupta' });
  });

  // A deleted account must not blow up whatever is trying to label it —
  // absent from the map is the correct outcome, not a thrown error.
  test('an id with no matching document is simply absent from the map', async () => {
    userDocs = [];
    const map = await getUsersByIds(['ghost-uid']);
    expect(map.has('ghost-uid')).toBe(false);
  });

  test('returns an empty map for no ids, without querying Firestore', async () => {
    const map = await getUsersByIds([]);
    expect(map.size).toBe(0);
    expect(getDocs).not.toHaveBeenCalled();
  });

  test('de-duplicates repeated ids into a single lookup', async () => {
    userDocs = [{ id: 'u1', name: 'Ajay Gupta' }];
    const map = await getUsersByIds(['u1', 'u1', 'u1']);
    expect(map.size).toBe(1);
  });
});

// Mirrors the identical guarantee tested on getAllTasks: hitting the bound
// exactly must be visible to the caller, since it is the only sign a screen
// gets that "all staff" may not actually be all staff.
describe('getAllUsers truncation flag', () => {
  test('flags the result when it exactly fills the requested bound', async () => {
    userDocs = Array.from({ length: 5 }, (_, i) => ({ id: `u${i}`, role: 'staff', orgId: 'orgA' }));
    const users = await getAllUsers({ role: 'staff', orgId: 'orgA', limit: 5 });
    expect(users.truncated).toBe(true);
  });

  test('does not flag a result that falls short of the bound', async () => {
    userDocs = [{ id: 'u1', role: 'staff', orgId: 'orgA' }];
    const users = await getAllUsers({ role: 'staff', orgId: 'orgA', limit: 5 });
    expect(users.truncated).toBe(false);
  });
});
