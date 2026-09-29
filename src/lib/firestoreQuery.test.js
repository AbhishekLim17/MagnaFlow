import { describe, test, expect, vi, beforeEach } from 'vitest';

let calls = [];
let impl;

vi.mock('firebase/firestore', () => ({
  query: vi.fn((_c, ...parts) => ({ parts })),
  orderBy: vi.fn((f, d) => ({ orderBy: [f, d] })),
  limit: vi.fn((n) => ({ limit: n })),
  getDocs: vi.fn(async (q) => { calls.push(q); return impl(q); }),
}));

const { runBoundedQuery, chunk } = await import('./firestoreQuery');

const mk = (id, ms) => ({ id, data: () => ({ createdAt: ms === null ? undefined : { toMillis: () => ms } }) });
const snap = (docs) => ({ docs });
const hasOrder = (q) => q.parts.some((p) => p.orderBy);

beforeEach(() => { calls = []; });

describe('chunk', () => {
  test('splits into groups of ten', () => {
    expect(chunk(Array.from({ length: 23 }, (_, i) => i)).map((c) => c.length)).toEqual([10, 10, 3]);
    expect(chunk([])).toEqual([]);
  });
});

describe('runBoundedQuery', () => {
  test('a result that fits the bound is one plain, complete read', async () => {
    impl = () => snap([mk('a', 3), mk('b', 2)]);
    const r = await runBoundedQuery({ collectionRef: {}, constraints: [{ w: 1 }], boundedAt: 5 });
    expect(calls).toHaveLength(1);
    expect(hasOrder(calls[0])).toBe(false);
    expect(r.docs.map((d) => d.id)).toEqual(['a', 'b']);
    expect(r.truncated).toBe(false);
  });

  // Accounts created by hand in the Firebase console often have no createdAt, and
  // an orderBy would silently drop them. While the result fits, no orderBy is used.
  test('documents without createdAt are kept when the result fits', async () => {
    impl = () => snap([mk('legacy', null), mk('new', 9)]);
    const r = await runBoundedQuery({ collectionRef: {}, boundedAt: 5 });
    expect(r.docs.map((d) => d.id)).toEqual(['new', 'legacy']);
  });

  test('when the bound is reached it re-reads newest-first', async () => {
    impl = (q) => (hasOrder(q) ? snap([mk('new1', 9), mk('new2', 8)]) : snap([mk('old1', 1), mk('old2', 2)]));
    const r = await runBoundedQuery({ collectionRef: {}, boundedAt: 2 });
    expect(calls).toHaveLength(2);
    expect(hasOrder(calls[1])).toBe(true);
    expect(r.docs.map((d) => d.id)).toEqual(['new1', 'new2']);
    expect(r.truncated).toBe(true);
  });

  test('more than 10 list values are queried in chunks and merged, not dropped', async () => {
    const values = Array.from({ length: 12 }, (_, i) => `p${i}`);
    impl = (q) => {
      const where = q.parts.find((p) => p.vals);
      return snap(where.vals.length === 10 ? [mk('x', 10), mk('y', 30)] : [mk('z', 20)]);
    };
    const r = await runBoundedQuery({
      collectionRef: {}, boundedAt: 50,
      multi: { values, build: (c) => ({ vals: c }) },
    });
    expect(calls).toHaveLength(2);
    expect(r.docs.map((d) => d.id)).toEqual(['y', 'z', 'x']);
    expect(r.truncated).toBe(false);
  });

  test('falls back to the plain slice when the ordered index is missing', async () => {
    impl = (q) => {
      if (hasOrder(q)) { const e = new Error('needs index'); e.code = 'failed-precondition'; throw e; }
      return snap([mk('a', 1), mk('b', 2)]);
    };
    const r = await runBoundedQuery({ collectionRef: {}, constraints: [{ w: 1 }], boundedAt: 2 });
    expect(calls).toHaveLength(2);
    expect(r.docs.map((d) => d.id).sort()).toEqual(['a', 'b']);
    expect(r.truncated).toBe(true);
  });

  test('other errors are not swallowed', async () => {
    impl = () => { const e = new Error('nope'); e.code = 'permission-denied'; throw e; };
    await expect(runBoundedQuery({ collectionRef: {}, boundedAt: 5 })).rejects.toThrow('nope');
  });
});
