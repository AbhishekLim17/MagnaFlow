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

const mk = (id, ms) => ({ id, data: () => ({ createdAt: { toMillis: () => ms } }) });
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
  test('orders newest-first and applies the bound', async () => {
    impl = () => snap([mk('a', 3), mk('b', 2)]);
    const r = await runBoundedQuery({ collectionRef: {}, constraints: [{ w: 1 }], boundedAt: 5 });
    expect(hasOrder(calls[0])).toBe(true);
    expect(r.docs.map((d) => d.id)).toEqual(['a', 'b']);
    expect(r.truncated).toBe(false);
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
  });

  test('flags truncation when the bound is reached', async () => {
    impl = () => snap([mk('a', 3), mk('b', 2)]);
    const r = await runBoundedQuery({ collectionRef: {}, boundedAt: 2 });
    expect(r.truncated).toBe(true);
  });

  test('falls back to an unordered read when the index is missing', async () => {
    impl = (q) => {
      if (hasOrder(q)) { const e = new Error('needs index'); e.code = 'failed-precondition'; throw e; }
      return snap([mk('a', 1)]);
    };
    const r = await runBoundedQuery({ collectionRef: {}, constraints: [{ w: 1 }], boundedAt: 5 });
    expect(calls).toHaveLength(2);
    expect(r.docs.map((d) => d.id)).toEqual(['a']);
  });

  test('other errors are not swallowed', async () => {
    impl = () => { const e = new Error('nope'); e.code = 'permission-denied'; throw e; };
    await expect(runBoundedQuery({ collectionRef: {}, boundedAt: 5 })).rejects.toThrow('nope');
  });
});
