// Bounded, newest-first list queries that do not silently lose rows.
//
// Two problems this solves for taskService / userService:
//
// 1. `in` and `array-contains-any` accept at most 10 values. The callers used
//    `.slice(0, 10)`, so a department head with 11 departments (or a manager
//    with 11 projects) silently lost everything past the tenth. Long lists are
//    now split into chunks of 10, queried separately and merged.
//
// 2. With filters present the queries had no orderBy (to dodge composite
//    indexes) but still had a limit, so once a result set exceeded the limit
//    Firestore returned an arbitrary slice by document id - not the newest. The
//    query now orders by createdAt desc. If the index for that combination has
//    not been deployed yet the server answers `failed-precondition`; we then fall
//    back to the old unordered read instead of breaking the screen.
import { query, orderBy, limit as firestoreLimit, getDocs } from 'firebase/firestore';

const MAX_IN_VALUES = 10;

export const chunk = (values, size = MAX_IN_VALUES) => {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
};

const createdMs = (d) => {
  const v = d.data().createdAt;
  return v && typeof v.toMillis === 'function' ? v.toMillis() : 0;
};

/**
 * @param {Object} opts
 * @param {import('firebase/firestore').CollectionReference} opts.collectionRef
 * @param {Array} opts.constraints where() clauses common to every query
 * @param {{ values: any[], build: (chunk: any[]) => any } | null} [opts.multi]
 *        a list-valued filter; `build` turns one chunk into a where() clause
 * @param {number} opts.boundedAt maximum rows to return
 * @returns {Promise<{ docs: Array, truncated: boolean }>}
 */
export async function runBoundedQuery({ collectionRef, constraints = [], multi = null, boundedAt }) {
  const runOne = async (extra) => {
    const base = [...constraints, ...extra];
    try {
      const snap = await getDocs(
        query(collectionRef, ...base, orderBy('createdAt', 'desc'), firestoreLimit(boundedAt))
      );
      return snap.docs;
    } catch (error) {
      if (error?.code !== 'failed-precondition') throw error;
      console.warn('Missing Firestore index for an ordered query; falling back to unordered read.');
      const snap = await getDocs(query(collectionRef, ...base, firestoreLimit(boundedAt)));
      return snap.docs;
    }
  };

  const parts = multi && multi.values.length > 0
    ? chunk(multi.values).map((c) => [multi.build(c)])
    : [[]];
  const results = await Promise.all(parts.map(runOne));

  const byId = new Map();
  for (const docs of results) for (const d of docs) byId.set(d.id, d);
  const merged = [...byId.values()];
  // Each chunk is newest-first on its own; interleave them by date.
  if (results.length > 1 || merged.length > 1) merged.sort((a, b) => createdMs(b) - createdMs(a));

  // Hitting the bound - in any chunk, or after merging - means there may be more.
  const truncated = results.some((docs) => docs.length >= boundedAt) || merged.length > boundedAt;
  return { docs: merged.slice(0, boundedAt), truncated };
}
