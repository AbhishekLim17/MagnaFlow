import { describe, expect, it } from 'vitest';
import { isWatching, watcherRecipients, watchNotificationText } from './watchers';

describe('watchers', () => {
  it('knows who is watching', () => {
    expect(isWatching({ watchers: ['a', 'b'] }, 'b')).toBe(true);
    expect(isWatching({ watchers: ['a'] }, 'b')).toBe(false);
    expect(isWatching({}, 'a')).toBe(false);
    expect(isWatching({ watchers: ['a'] }, undefined)).toBe(false);
  });

  it('tells every watcher once, except the actor and people already told', () => {
    const task = { watchers: ['a', 'b', 'b', 'c', '', null, 'd'] };
    expect(watcherRecipients(task, 'a', ['c'])).toEqual(['b', 'd']);
    expect(watcherRecipients({}, 'a')).toEqual([]);
  });

  it('words the bell entry', () => {
    expect(watchNotificationText({ type: 'watch_status', mentionedByName: 'Asha', taskTitle: 'Ship it', status: 'in-progress' }))
      .toBe('Asha moved “Ship it” to in progress');
    expect(watchNotificationText({ type: 'watch_comment', taskTitle: 'Ship it' })).toBe('Someone commented on “Ship it”');
    expect(watchNotificationText({ type: 'client_message' })).toBeNull();
  });
});
