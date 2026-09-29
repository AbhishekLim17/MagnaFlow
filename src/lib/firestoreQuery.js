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
//    read is now plain while it fits (complete, and it keeps documents that have
//    no createdAt); only when the bound is reached is it repeated newest-first.
//    If the index for that combination has not been deployed yet the server
//    answers `failed-precondition` and the plain slice is kept rather than
//    breaking the screen.
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

    // Plain read first. When the result fits inside the bound it is COMPLETE, and
    // that includes documents with no createdAt (accounts created by hand in the
    // console, for instance) which an orderBy would silently exclude.
    const plain = (await getDocs(query(collectionRef, ...base, firestoreLimit(boundedAt)))).docs;
    if (plain.length < boundedAt) return { docs: plain, hitBound: false };

    // Bound reached: the plain read is an arbitrary slice by document id, so ask
    // for the newest rows instead. A missing index is not fatal: keep the slice.
    try {
      const snap = await getDocs(
        query(collectionRef, ...base, orderBy("createdAt", "desc"), firestoreLimit(boundedAt))
      );
      return { docs: snap.docs, hitBound: true };
    } catch (error) {
      if (error?.code !== "failed-precondition") throw error;
      console.warn("Missing Firestore index for an ordered query; returning an unordered slice.");
      return { docs: plain, hitBound: true };
    }
  };

  const parts = multi && multi.values.length > 0
    ? chunk(multi.values).map((c) => [multi.build(c)])
    : [[]];
  const results = await Promise.all(parts.map(runOne));

  const byId = new Map();
  for (const { docs } of results) for (const d of docs) byId.set(d.id, d);
  const merged = [...byId.values()];
  // Each chunk is newest-first on its own; interleave them by date.
  if (results.length > 1 || merged.length > 1) merged.sort((a, b) => createdMs(b) - createdMs(a));

  // Hitting the bound - in any chunk, or after merging - means there may be more.
  const truncated = results.some((r) => r.hitBound) || merged.length > boundedAt;
  return { docs: merged.slice(0, boundedAt), truncated };
}
