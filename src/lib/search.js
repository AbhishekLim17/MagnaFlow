// The Ctrl+K palette: find a page or a task by typing. Searches what is already loaded
// (the task list is live in TasksContext), so a search costs no Firestore reads.

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

/** Lower is better; null = no match. Title start beats word start beats anywhere; description last. */
export const matchScore = (query, title, extra = '') => {
  const q = norm(query);
  if (!q) return null;
  const t = norm(title);
  if (t.startsWith(q)) return 0;
  if (t.split(/[\s\-_/.,:()]+/).some((w) => w.startsWith(q))) return 1;
  if (t.includes(q)) return 2;
  if (norm(extra).includes(q)) return 3;
  return null;
};

const ranked = (items, query, titleOf, extraOf, limit) => items
  .map((item, i) => ({ item, i, score: matchScore(query, titleOf(item), extraOf(item)) }))
  .filter((r) => r.score !== null)
  .sort((a, b) => a.score - b.score || a.i - b.i)
  .slice(0, limit)
  .map((r) => r.item);

/**
 * @param {string} query
 * @param {{ pages?: {id: string, label: string}[], tasks?: Object[] }} sources
 * @returns {{ pages: Object[], tasks: Object[] }} with nothing typed: every page, no tasks
 */
export const searchEverything = (query, { pages = [], tasks = [] } = {}, limit = 8) => {
  if (!norm(query)) return { pages, tasks: [] };
  return {
    pages: ranked(pages, query, (p) => p.label, () => '', limit),
    tasks: ranked(tasks, query, (t) => t.title, (t) => t.description, limit),
  };
};

/** True when a key press is meant for a text field, not for a shortcut. */
export const typingInField = (target) => {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(target.isContentEditable);
};
