// Saved views: a named task-list filter (the URL query string the list writes, plus the
// list/kanban/calendar choice). Kept on the person's own user document (users/{uid}
// .savedViews), so they follow them to any device.

export const MAX_VIEWS = 20;
const MAX_NAME = 40;

/** Add or replace (same name, any case) a view; newest first, capped. */
export const addView = (views = [], name, search, mode) => {
  const clean = String(name || '').trim().slice(0, MAX_NAME);
  if (!clean) return views;
  const rest = views.filter((v) => v.name.toLowerCase() !== clean.toLowerCase());
  return [{ name: clean, search: String(search || '').replace(/^\?/, '').slice(0, 500), mode: mode || 'list' }, ...rest]
    .slice(0, MAX_VIEWS);
};

export const removeView = (views = [], name) => views.filter((v) => v.name !== name);

/** Only well-formed entries (the document is user-writable, so do not trust its shape). */
export const readViews = (raw) => (Array.isArray(raw) ? raw : [])
  .filter((v) => v && typeof v.name === 'string' && v.name.trim() && typeof v.search === 'string')
  .slice(0, MAX_VIEWS);
