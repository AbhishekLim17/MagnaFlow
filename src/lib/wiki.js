// Project pages (wiki / notes): plain text with a few line conventions, so there is no
// Markdown library to ship and no HTML to sanitise. Pure.
//   # Heading        ## Smaller heading
//   - item / * item  a bullet
//   - [ ] item       an action item: it can be turned into a task
//   - [x] item       an action item that is done (or already a task)
export const MAX_BODY = 50_000;
export const MAX_TITLE = 120;

/** @returns {{ kind: 'h1'|'h2'|'todo'|'done'|'bullet'|'text'|'blank', text: string, index: number }[]} */
export const parseLines = (body = '') => String(body).split(/\r?\n/).map((line, index) => {
  const t = line.trimEnd();
  let m;
  if (!t.trim()) return { kind: 'blank', text: '', index };
  if ((m = t.match(/^##\s+(.*)$/))) return { kind: 'h2', text: m[1], index };
  if ((m = t.match(/^#\s+(.*)$/))) return { kind: 'h1', text: m[1], index };
  if ((m = t.match(/^\s*[-*]\s+\[\s\]\s+(.*)$/))) return { kind: 'todo', text: m[1], index };
  if ((m = t.match(/^\s*[-*]\s+\[[xX]\]\s+(.*)$/))) return { kind: 'done', text: m[1], index };
  if ((m = t.match(/^\s*[-*]\s+(.*)$/))) return { kind: 'bullet', text: m[1], index };
  return { kind: 'text', text: t, index };
});

/** The body with the action item on line `index` ticked. */
export const tickLine = (body, index) => {
  const lines = String(body).split(/\r?\n/);
  if (lines[index] !== undefined) lines[index] = lines[index].replace(/\[\s\]/, '[x]');
  return lines.join('\n');
};

/** Open action items on a page. */
export const openActions = (body) => parseLines(body).filter((l) => l.kind === 'todo').length;

/** Why a page cannot be saved, or null. */
export const pageProblem = ({ title, body }) => {
  if (!String(title || '').trim()) return 'Give the page a title.';
  if (String(title).trim().length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  if (String(body || '').length > MAX_BODY) return `A page can hold ${MAX_BODY.toLocaleString('en-IN')} characters; split it in two.`;
  return null;
};
