// Goals and key results (OKRs): organizations/{org}/goals. A goal's progress is the average of
// its key results (each from its start value to its target); a goal without key results takes
// the share of finished tasks in its linked projects. Pure.
import { toDate } from './format';

export const MAX_KRS = 10;
export const MAX_GOAL_PROJECTS = 20;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/** 0..1, or null when the key result cannot be measured (target equals start). */
export const krProgress = (kr) => {
  const start = Number(kr?.start) || 0;
  const target = Number(kr?.target);
  const current = Number(kr?.current) || 0;
  if (!Number.isFinite(target) || target === start) return null;
  return clamp01((current - start) / (target - start));
};

/** Share of finished tasks (cancelled ones left out) in these projects, 0..1, or null. */
export const projectsProgress = (tasks = [], projectIds = []) => {
  const ids = new Set(projectIds);
  const live = tasks.filter((t) => ids.has(t.projectId) && t.status !== 'cancelled');
  if (!live.length) return null;
  return live.filter((t) => t.status === 'completed').length / live.length;
};

/** 0..1, or null when there is nothing to measure. */
export const goalProgress = (goal, tasks = []) => {
  const measured = (goal?.keyResults || []).map(krProgress).filter((p) => p !== null);
  if (measured.length) return measured.reduce((a, b) => a + b, 0) / measured.length;
  return projectsProgress(tasks, goal?.projectIds || []);
};

/**
 * On track if progress keeps up with the time gone (within 10 points), at risk within 25,
 * off track beyond that; 'done' at 100%; null without a due date or a measure.
 */
export const goalStatus = (goal, progress, now = new Date()) => {
  if (progress === null || progress === undefined) return null;
  if (progress >= 1) return 'done';
  const start = toDate(goal.startDate || goal.createdAt);
  const due = toDate(goal.dueDate);
  if (!start || !due || due <= start) return null;
  const elapsed = clamp01((now - start) / (due - start));
  if (progress >= elapsed - 0.1) return 'on_track';
  if (progress >= elapsed - 0.25) return 'at_risk';
  return 'off_track';
};

export const STATUS_LABEL = { done: 'Done', on_track: 'On track', at_risk: 'At risk', off_track: 'Off track' };

/** Why a goal cannot be saved, or null. */
export const goalProblem = (goal) => {
  if (!String(goal?.title || '').trim()) return 'Give the goal a title.';
  if (String(goal.title).trim().length > 160) return 'Keep the title under 160 characters.';
  const krs = goal.keyResults || [];
  if (krs.length > MAX_KRS) return `At most ${MAX_KRS} key results.`;
  for (const kr of krs) {
    if (!String(kr.title || '').trim()) return 'Every key result needs a name.';
    if (!Number.isFinite(Number(kr.target)) || String(kr.target).trim() === '') return `Give “${kr.title}” a target number.`;
    if (Number(kr.target) === (Number(kr.start) || 0)) return `“${kr.title}”: the target must differ from the starting value.`;
  }
  return null;
};

/** The key results as stored: trimmed, numbers as numbers. */
export const cleanKeyResults = (krs = []) => krs.slice(0, MAX_KRS).map((kr) => ({
  title: String(kr.title || '').trim().slice(0, 160),
  start: Number(kr.start) || 0,
  target: Number(kr.target),
  current: Number(kr.current) || 0,
  unit: String(kr.unit || '').trim().slice(0, 20),
}));
