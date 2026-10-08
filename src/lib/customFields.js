// Custom fields: an organisation's own task fields (a client reference, a cost centre, a go-live
// date, a size). Definitions at organizations/{org}/customFields; a task keeps its values in
// task.customFields { fieldId: value }. Pure.

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Choice from a list' },
];
export const MAX_FIELDS = 20;
export const MAX_TEXT = 500;

/** Why a field definition cannot be saved, or null. */
export const fieldProblem = (field) => {
  if (!String(field?.name || '').trim()) return 'Give the field a name.';
  if (!FIELD_TYPES.some((t) => t.value === field.type)) return 'Choose a type.';
  if (field.type === 'select') {
    const options = (field.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2) return 'Give at least two choices.';
    if (new Set(options).size !== options.length) return 'Each choice once.';
  }
  return null;
};

/** A typed value from what the form holds; null when empty or not valid for the field. */
export const cleanValue = (field, raw) => {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  switch (field.type) {
    case 'number': {
      const n = Number(s.replace(',', '.'));
      return Number.isFinite(n) ? n : null;
    }
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
    case 'select': return (field.options || []).includes(s) ? s : null;
    default: return s.slice(0, MAX_TEXT);
  }
};

/** The task's values for the current definitions, ready to store (empty ones left out). */
export const cleanValues = (fields, raw) => {
  const out = {};
  for (const f of fields || []) {
    const v = cleanValue(f, raw?.[f.id]);
    if (v !== null) out[f.id] = v;
  }
  return out;
};

/** A value as text, for the task details and the CSV export. */
export const displayValue = (field, value, formatDate = (d) => d) => {
  if (value == null || value === '') return '';
  if (field.type === 'date') return formatDate(value);
  return String(value);
};
