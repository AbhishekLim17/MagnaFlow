// Workflow stages: the organisation's own steps inside the built-in statuses (for example
// "QA" and "Client check" inside In review). Status still drives Kanban columns, dependency
// blocking, the security rules and reports; a task's `stage` only refines how it is labelled.
// Stored at organizations/{org}/workflow/stages { stages: [{ id, name, category }] }. Pure.
import { statusLabel } from './taskLabels';

export const CATEGORIES = ['pending', 'in-progress', 'review', 'completed'];
export const MAX_STAGES = 30;
const SEP = '::';

/** Well-formed stages only, at most MAX_STAGES, names trimmed. */
export const cleanStages = (stages = []) => (Array.isArray(stages) ? stages : [])
  .filter((s) => s && typeof s.id === 'string' && s.id && String(s.name || '').trim() && CATEGORIES.includes(s.category))
  .slice(0, MAX_STAGES)
  .map((s) => ({ id: s.id, name: String(s.name).trim().slice(0, 40), category: s.category }));

/** The task's stage, if it still belongs to the task's status. */
export const stageOf = (task, stages = []) => {
  const stage = task?.stage ? stages.find((s) => s.id === task.stage) : null;
  return stage && stage.category === task.status ? stage : null;
};

/** "QA" when the task is at a stage, else the status ("In review"). */
export const stageLabel = (task, stages = []) => stageOf(task, stages)?.name || statusLabel(task?.status);

/** The choices of a status picker: each status, then its stages. */
export const statusOptions = (stages = [], { cancelled = false } = {}) => [...CATEGORIES, ...(cancelled ? ['cancelled'] : [])]
  .flatMap((status) => [
    { value: status, label: statusLabel(status), status, stage: null },
    ...stages.filter((s) => s.category === status).map((s) => ({ value: `${status}${SEP}${s.id}`, label: `${statusLabel(status)} · ${s.name}`, status, stage: s.id })),
  ]);

/** A picker value for the task, and back. */
export const optionValue = (task, stages = []) => {
  const stage = stageOf(task, stages);
  return stage ? `${task.status}${SEP}${stage.id}` : task?.status;
};
export const parseOption = (value) => {
  const [status, stage = null] = String(value).split(SEP);
  return { status, stage };
};

/** Stage ids: short, readable, unique within the list. */
export const newStageId = (name, stages = []) => {
  const base = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'stage';
  const taken = new Set(stages.map((s) => s.id));
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
};
