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
