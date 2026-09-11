// criticalPath.js -- pure CPM (Critical Path Method) algorithm.
//
// Input:  tasks[] with { id, startDate, deadline, blockedBy: string[] }
// Output: Set<string> of task IDs whose total float == 0 (critical path).

const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (v) => {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
};

const durationDays = (task) => {
  const s = toMs(task.startDate) ?? toMs(task.createdAt);
  const e = toMs(task.deadline);
  if (!s || !e || e < s) return 1;
  return Math.max(1, Math.round((e - s) / DAY_MS));
};

export function computeCriticalPath(tasks) {
  if (!tasks || tasks.length === 0) return new Set();

  const byId = {};
  for (const t of tasks) byId[t.id] = t;

  const successors = {};
  const inDegree = {};
  for (const t of tasks) {
    successors[t.id] = successors[t.id] || [];
    inDegree[t.id] = inDegree[t.id] || 0;
    for (const predId of (t.blockedBy || [])) {
      if (!byId[predId]) continue;
      successors[predId] = successors[predId] || [];
      successors[predId].push(t.id);
      inDegree[t.id] = (inDegree[t.id] || 0) + 1;
    }
  }

  const queue = [];
  for (const t of tasks) {
    if ((inDegree[t.id] || 0) === 0) queue.push(t.id);
  }
  const topoOrder = [];
  while (queue.length > 0) {
    const id = queue.shift();
    topoOrder.push(id);
    for (const succId of (successors[id] || [])) {
      inDegree[succId]--;
      if (inDegree[succId] === 0) queue.push(succId);
    }
  }

  if (topoOrder.length !== tasks.length) return new Set();

  const dur = {};
  const ES  = {};
  const EF  = {};
  const LS  = {};
  const LF  = {};

  for (const t of tasks) {
    dur[t.id] = durationDays(t);
    ES[t.id] = 0;
  }

  for (const id of topoOrder) {
    EF[id] = ES[id] + dur[id];
    for (const succId of (successors[id] || [])) {
      if (EF[id] > ES[succId]) ES[succId] = EF[id];
    }
  }

  const projectEnd = Math.max(...Object.values(EF));

  for (const id of topoOrder) LF[id] = projectEnd;
  for (const id of [...topoOrder].reverse()) {
    LS[id] = LF[id] - dur[id];
    for (const predId of (byId[id]?.blockedBy || [])) {
      if (!byId[predId]) continue;
      if (LS[id] < LF[predId]) LF[predId] = LS[id];
    }
  }
  for (const id of topoOrder) LS[id] = LF[id] - dur[id];

  const critical = new Set();
  for (const id of topoOrder) {
    if (LS[id] - ES[id] === 0) critical.add(id);
  }
  return critical;
}
