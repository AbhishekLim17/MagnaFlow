import { describe, test, expect } from 'vitest';
import { EMAIL_PREFS, withDefaults, wantsEmail } from './notificationPrefs';

describe('withDefaults', () => {
  test('everything is on until someone turns it off', () => {
    expect(withDefaults(undefined)).toEqual({ assignments: true, mentions: true, critical: true, statusChanges: true, dailyReminder: true, weeklyDigest: true, clientMessages: true });
    expect(withDefaults({ mentions: false, unknown: false })).toEqual({ assignments: true, mentions: false, critical: true, statusChanges: true, dailyReminder: true, weeklyDigest: true, clientMessages: true });
  });

  test('one setting per kind of email, each with a label', () => {
    expect(EMAIL_PREFS.map((p) => p.key)).toEqual(['assignments', 'mentions', 'critical', 'statusChanges', 'dailyReminder', 'weeklyDigest', 'clientMessages']);
    expect(EMAIL_PREFS.every((p) => p.label)).toBe(true);
  });
});

describe('wantsEmail', () => {
  test('each email type follows its own setting', () => {
    const prefs = { assignments: false, dailyReminder: false };
    expect(wantsEmail(prefs, 'task_assigned')).toBe(false);
    expect(wantsEmail(prefs, 'critical_task_reminder')).toBe(false);
    expect(wantsEmail(prefs, 'mention')).toBe(true);
    expect(wantsEmail(prefs, 'critical_task_alert')).toBe(true);
    expect(wantsEmail({ statusChanges: false }, 'task_completed')).toBe(false);
    expect(wantsEmail({ statusChanges: false }, 'task_status_changed')).toBe(false);
    expect(wantsEmail({ clientMessages: false }, 'client_approved')).toBe(false);
    expect(wantsEmail({ clientMessages: false }, 'client_request')).toBe(false);
    // a client's reply notice has no setting (clients have no settings screen)
    expect(wantsEmail({ clientMessages: false }, 'client_reply')).toBe(true);
  });

  test('no settings, or an email type with no setting, is always sent', () => {
    expect(wantsEmail(undefined, 'task_assigned')).toBe(true);
    expect(wantsEmail(null, 'mention')).toBe(true);
    expect(wantsEmail({ assignments: false }, 'something_new')).toBe(true);
  });
});
