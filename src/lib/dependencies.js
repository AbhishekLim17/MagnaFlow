// Task dependency helpers. Pure: no Firestore, so the same rules run in the UI
// (to hide options that would be circular) and in taskService (to refuse them).
//
// `blockedBy` on a task lists the ids it depends on. A cycle - A blocked by B
// blocked by A - can never be started, and silently blanks the critical path.

// Statuses that no longer hold anything up.
const RESOLVED = new Set(['completed', 'cancelled']);

export const isResolved = (status) => RESOLVED.has(status);

/**
 * Would making `taskId` depend on `blockedBy` create a cycle?
 * Walks the dependency chain of every proposed blocker; if it ever reaches
 * `taskId` (or the proposal names the task itself) there is a loop.
 *
 * @param {string} taskId
 * @param {string[]} blockedBy proposed dependencies
 * @param {(id: string) => string[] | Promise<string[]>} loadBlockedBy dependencies of a task
 * @param {number} [maxNodes] safety bound on how many tasks are visited
 * @returns {Promise<boolean>}
 */
export async function wouldCreateCycle(taskId, blockedBy, loadBlockedBy, maxNodes = 500) {
  const seen = new Set();
  const stack = [...(blockedBy || [])];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    if (seen.size > maxNodes) return false; // pathological graph: stop rather than hang
    const next = await loadBlockedBy(id);
    if (Array.isArray(next)) stack.push(...next);
  }
  return false;
}

/**
 * Synchronous form for the UI: does `candidateId` already depend, directly or
 * transitively, on `targetId`? If so it must not be offered as a prerequisite
 * of `targetId`.
 *
 * @param {string} candidateId
 * @param {string} targetId
 * @param {Object<string, {blockedBy?: string[]}>} byId
 */
export function dependsOn(candidateId, targetId, byId) {
  if (candidateId === targetId) return true;
  const seen = new Set();
  const stack = [candidateId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const dep of byId[id]?.blockedBy || []) {
      if (dep === targetId) return true;
      stack.push(dep);
    }
  }
  return false;
}

/**
 * Ids in `blockedBy` whose task exists and is not yet completed or cancelled.
 * Unknown ids (a deleted prerequisite) never block.
 *
 * @param {string[]} blockedBy
 * @param {(id: string) => {status?: string} | null | undefined} lookup
 */
export function unfinishedBlockers(blockedBy, lookup) {
  return (blockedBy || []).filter((id) => {
    const dep = lookup(id);
    return dep && !isResolved(dep.status);
  });
}
