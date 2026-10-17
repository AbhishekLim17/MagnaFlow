// Which features an organisation has switched on (organizations/{org}/features/settings
// { enabled: [ids] }), and which each person hid from their own menu (users/{uid}
// .hiddenFeatures). Essentials are always on; everything else starts off and is added from
// the Features page. Turning a feature off hides it and pauses its emails; its data stays.
// Import-free: the mail jobs load this file too (scripts/lib/features.cjs).

/** Always on, cannot be removed. */
export const CORE = ['dashboard', 'tasks', 'people', 'projects', 'timeline', 'reports'];

/** Added from the Features page; off until an org admin adds them. */
export const OPTIONAL = [
  'portfolio', 'workload', 'sprints', 'goals', 'risks', 'pages', 'leave', 'budget', 'timesheets',
  'invoices', 'clientPortal', 'taskFields', 'automations', 'activityLog', 'monthlyReport', 'emailToTask',
];

export const ALL_FEATURES = [...CORE, ...OPTIONAL];

/** Dashboard menu entries (their ids) that belong to an optional feature. Unlisted = essential. */
export const MENU_FEATURE = {
  portfolio: 'portfolio',
  workload: 'workload',
  sprints: 'sprints',
  goals: 'goals',
  risks: 'risks',
  pages: 'pages',
  leave: 'leave',
  budget: 'budget',
  timesheets: 'timesheets',
  invoices: 'invoices',
  clients: 'clientPortal',
  requests: 'clientPortal',
  fields: 'taskFields',
  automations: 'automations',
  activity: 'activityLog',
};

export const isCore = (id) => CORE.includes(id);

/** The organisation's switched-on optional features, from its settings document (or none). */
export const enabledFrom = (settings) => (Array.isArray(settings?.enabled) ? settings.enabled : [])
  .filter((id) => OPTIONAL.includes(id));

/** Is the feature on for the organisation? */
export const featureOn = (enabled, id) => !id || isCore(id) || (enabled || []).includes(id);

/** Is it on, and not hidden by this person? */
export const featureShown = (enabled, hidden, id) => featureOn(enabled, id) && (isCore(id) || !(hidden || []).includes(id));

/** A dashboard's menu without the entries of features that are off or hidden. */
export const visibleMenu = (items, enabled, hidden) =>
  (items || []).filter((item) => featureShown(enabled, hidden, MENU_FEATURE[item.id]));

/** The enabled list with one feature added or removed (essentials are never stored). */
export const toggled = (enabled, id, on) => {
  if (!OPTIONAL.includes(id)) return enabledFrom({ enabled });
  const rest = enabledFrom({ enabled }).filter((x) => x !== id);
  return on ? [...rest, id] : rest;
};
