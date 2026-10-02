// @mention resolution.
//
// A mention is written as `@` + the person's name with spaces removed
// ("@JaneSmith"), inserted by the picker. Resolution matches the text against
// the people the picker actually offered, so it is exact: the old code fetched
// EVERY user document, matched by case-insensitive substring ("@ann" also hit
// Joanna and Hannah), only ever saw the first word of a name, and - because it
// listed the whole users collection - was refused by the security rules for
// every role below org-admin, so mentions silently notified nobody.

/** The text a mention of this person is written as (without the leading @). */
export const mentionToken = (name) => String(name || '').replace(/\s+/g, '');

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * People mentioned in `text`, drawn from `people` ({ id, name, email? }).
 * A mention must start at the beginning or after a non-word character and must
 * not run on into further word characters, so "@Ann" does not match "@Annabel".
 */
export function resolveMentions(text, people) {
  const found = new Map();
  if (!text) return [];
  for (const person of people || []) {
    const token = mentionToken(person.name);
    if (!token) continue;
    const re = new RegExp(`(^|[^\\w])@${escapeRegExp(token)}(?!\\w)`, 'i');
    if (re.test(text)) found.set(person.id, person);
  }
  return [...found.values()];
}

/** Merge lists of people by id; earlier lists win, but a later email fills a gap. */
export function mergePeople(...lists) {
  const byId = new Map();
  for (const list of lists) {
    for (const p of list || []) {
      if (!p || !p.id) continue;
      const existing = byId.get(p.id);
      if (!existing) byId.set(p.id, { ...p });
      else if (!existing.email && p.email) existing.email = p.email;
    }
  }
  return [...byId.values()];
}

// ---- typeahead ----------------------------------------------------------------

// Characters that may appear inside a mention token (a name without spaces).
const TOKEN_CHARS = /^[\p{L}\p{N}_'’.-]*$/u;

/**
 * Is the caret inside an @mention being typed? Returns { start, query } where `start`
 * is the index of the "@", or null. An "@" glued to a word ("bob@x.com") is not one.
 */
export function getMentionQuery(text, caret) {
  if (typeof text !== 'string' || caret === null || caret === undefined) return null;
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at === -1) return null;
  if (at > 0 && /[\p{L}\p{N}_]/u.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (!TOKEN_CHARS.test(query)) return null;
  return { start: at, query };
}

/**
 * People matching what has been typed after the "@": names (or any word of a name)
 * that start with it first, then names that merely contain it.
 */
export function suggestPeople(people, query, limit = 6) {
  const q = String(query || '').toLowerCase();
  const scored = [];
  for (const person of people || []) {
    const name = String(person.name || '');
    if (!name) continue;
    const lower = name.toLowerCase();
    const token = mentionToken(name).toLowerCase();
    let rank = -1;
    if (q === '') rank = 2;
    else if (token.startsWith(q) || lower.startsWith(q)) rank = 0;
    else if (lower.split(/\s+/).some((w) => w.startsWith(q))) rank = 1;
    else if (lower.includes(q)) rank = 3;
    if (rank >= 0) scored.push({ person, rank, name: lower });
  }
  scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((s) => s.person);
}

/** Replace the "@query" being typed with the chosen person; returns the new text and caret. */
export function applyMention(text, start, caret, person) {
  const insert = `@${mentionToken(person.name)} `;
  const next = text.slice(0, start) + insert + text.slice(caret);
  return { text: next, caret: start + insert.length };
}
