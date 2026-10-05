// Portfolio health: how each project is doing, from its tasks (suggested) or from the latest
// status update its team posted (declared). Pure and import-free, so the weekly digest job
// (scripts/send-weekly-digest.cjs) uses exactly these rules too.

export const HEALTH = {
  on_track: { key: 'on_track', label: 'On track', rank: 0 },
  at_risk: { key: 'at_risk', label: 'At risk', rank: 1 },
  off_track: { key: 'off_track', label: 'Off track', rank: 2 },
};
export const HEALTH_KEYS = Object.keys(HEALTH);
export const MAX_SUMMARY = 2000;

const DAY = 24 * 60 * 60 * 1000;
const ms = (v) => {
  if (!v) return null;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * The numbers behind a project's health.
 * @param {Object[]} tasks the project's tasks
 * @param {Date} [now]
 */
export const projectMetrics = (tasks, now = new Date()) => {
  const today = startOfDay(now);
  const live = (tasks || []).filter((t) => t.status !== 'cancelled');
  const open = live.filter((t) => t.status !== 'completed');
  const due = (t) => ms(t.deadline);
  const overdue = open.filter((t) => due(t) != null && due(t) < today);
  const dueSoon = open.filter((t) => due(t) != null && due(t) >= today && due(t) < today + 7 * DAY);
  const upcoming = open
    .filter((t) => t.milestone && due(t) != null && due(t) >= today)
    .sort((a, b) => due(a) - due(b));
  return {
    total: live.length,
    done: live.length - open.length,
    open: open.length,
    percent: live.length ? Math.round(((live.length - open.length) / live.length) * 100) : 0,
    overdue: overdue.length,
    dueSoon: dueSoon.length,
    overdueMilestones: overdue.filter((t) => t.milestone).length,
    nextMilestone: upcoming[0] ? { title: upcoming[0].title || 'Milestone', deadline: due(upcoming[0]) } : null,
  };
};

/**
 * What the tasks say: off track when a milestone has slipped or a quarter of the open work is
 * overdue; at risk when anything is overdue; otherwise on track.
 */
export const suggestedHealth = (m) => {
  if (m.overdueMilestones > 0 || (m.open > 0 && m.overdue / m.open >= 0.25)) return 'off_track';
  if (m.overdue > 0) return 'at_risk';
  return 'on_track';
};

/**
 * The health to show: the team's latest update when there is one, otherwise the suggestion.
 * @returns {{ key: string, label: string, declared: boolean, update: Object|null }}
 */
export const projectHealth = (metrics, latestUpdate) => {
  const declared = latestUpdate && HEALTH[latestUpdate.health];
  const key = declared ? latestUpdate.health : suggestedHealth(metrics);
  return { key, label: HEALTH[key].label, declared: Boolean(declared), update: declared ? latestUpdate : null };
};

/** Worst first, then by name. */
export const sortByHealth = (items) => [...items].sort((a, b) =>
  (HEALTH[b.health.key].rank - HEALTH[a.health.key].rank) || String(a.name).localeCompare(String(b.name)));

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One line for the digest: "At risk (suggested) · 62% done · 2 overdue · 3 due this week". */
export const digestLine = ({ metrics: m, health }) => [
  `${health.label}${health.declared ? '' : ' (suggested)'}`,
  `${m.percent}% done`,
  m.overdue ? `${m.overdue} overdue` : null,
  m.dueSoon ? `${m.dueSoon} due this week` : null,
].filter(Boolean).join(' · ');

/** The digest's opening sentence: "1 off track, 1 at risk, 3 on track. 5 tasks overdue." */
export const digestSummary = (items) => {
  const count = (k) => items.filter((i) => i.health.key === k).length;
  const overdue = items.reduce((n, i) => n + i.metrics.overdue, 0);
  const parts = ['off_track', 'at_risk', 'on_track'].map((k) => (count(k) ? `${count(k)} ${HEALTH[k].label.toLowerCase()}` : null)).filter(Boolean);
  return `${plural(items.length, 'project')}: ${parts.join(', ')}.${overdue ? ` ${plural(overdue, 'task')} overdue.` : ' Nothing overdue.'}`;
};
