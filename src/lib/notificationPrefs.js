// Which emails a person wants. Pure and import-free, so the mail jobs (Node, see
// scripts/send-queued-emails.cjs and send-daily-reminders.cjs) use exactly these rules too.
//
// Stored on the user document as `notificationPrefs: { assignments, mentions, critical,
// statusChanges, dailyReminder }`. Anything missing means "yes": people who never opened the
// settings keep getting what they always got. In-app notifications are not affected.

export const EMAIL_PREFS = [
  { key: 'assignments', label: 'A task is assigned to me', help: 'Including the next occurrence of a repeating task.' },
  { key: 'mentions', label: 'Someone @mentions me in a comment', help: '' },
  { key: 'critical', label: 'A task of mine becomes critical', help: 'Sent when a task is created or raised to Critical priority.' },
  { key: 'statusChanges', label: 'A task I am involved in changes status', help: '' },
  { key: 'dailyReminder', label: 'Morning reminder of my critical tasks', help: 'Every day at 8:00 AM IST, while any of your critical tasks are open.' },
  { key: 'weeklyDigest', label: "Monday summary of my projects' health", help: 'For org admins and department heads.' },
  { key: 'clientMessages', label: 'A client writes, signs off a milestone or sends a request', help: 'Messages and sign-offs on tasks you created or are assigned; requests on projects you run.' },
];

// mail_queue `type` -> the preference that governs it
const PREF_FOR_TYPE = {
  task_assigned: 'assignments',
  mention: 'mentions',
  critical_task_alert: 'critical',
  critical_task_reminder: 'dailyReminder',
  task_completed: 'statusChanges',
  task_status_changed: 'statusChanges',
  client_message: 'clientMessages',
  client_approved: 'clientMessages',
  client_changes_requested: 'clientMessages',
  client_request: 'clientMessages',
  weekly_digest: 'weeklyDigest',
};

/** Every preference, with "on" filled in for any that were never set. */
export const withDefaults = (prefs) => Object.fromEntries(
  EMAIL_PREFS.map(({ key }) => [key, !(prefs && prefs[key] === false)]),
);

/**
 * Whether someone with these preferences should get an email of this type. Types without a
 * preference (anything new or unknown) are always sent: switching off one kind of email must
 * never silence another.
 *
 * @param {Object|undefined} prefs  the user's notificationPrefs
 * @param {string} type             mail_queue type, or 'critical_task_reminder' for the daily job
 */
export const wantsEmail = (prefs, type) => {
  const key = PREF_FOR_TYPE[type];
  return !key || !(prefs && prefs[key] === false);
};
