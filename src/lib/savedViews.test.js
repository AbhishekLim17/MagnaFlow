import { describe, expect, it } from 'vitest';
import { addView, removeView, readViews, MAX_VIEWS } from './savedViews';

describe('saved views', () => {
  it('adds newest first and replaces a view of the same name', () => {
    let v = addView([], 'Overdue', '?status=overdue', 'list');
    v = addView(v, 'Mine', 'assignee=me', 'kanban');
    v = addView(v, ' overdue ', 'status=overdue&sort=deadline');
    expect(v).toEqual([
      { name: 'overdue', search: 'status=overdue&sort=deadline', mode: 'list' },
      { name: 'Mine', search: 'assignee=me', mode: 'kanban' },
    ]);
  });

  it('ignores a blank name and caps the list', () => {
    expect(addView([], '   ', 'a=1')).toEqual([]);
    let v = [];
    for (let i = 0; i < MAX_VIEWS + 5; i += 1) v = addView(v, `v${i}`, '');
    expect(v).toHaveLength(MAX_VIEWS);
    expect(v[0].name).toBe(`v${MAX_VIEWS + 4}`);
  });

  it('removes by name and reads only well-formed entries', () => {
    expect(removeView([{ name: 'a', search: '' }, { name: 'b', search: '' }], 'a')).toEqual([{ name: 'b', search: '' }]);
    expect(readViews([{ name: 'ok', search: 'q=x' }, { name: '' }, null, { name: 'x', search: 3 }])).toEqual([{ name: 'ok', search: 'q=x' }]);
    expect(readViews('nope')).toEqual([]);
  });
});
