import { describe, expect, it } from 'vitest';
import { groupMyWork } from './myWork';

const now = new Date(2026, 9, 9, 10); // 9 Oct 2026, 10:00 local
const t = (id, extra) => ({ id, title: id, status: 'pending', assignedTo: 'me', ...extra });

describe('groupMyWork', () => {
  it('sorts my open tasks by when they are due', () => {
    const groups = groupMyWork([
      t('late', { deadline: '2026-10-07' }),
      t('today', { deadline: '2026-10-09' }),
      t('soon', { deadline: '2026-10-15' }),
      t('far', { deadline: '2026-11-30' }),
      t('nodate'),
      t('done', { deadline: '2026-10-01', status: 'completed' }),
      t('theirs', { assignedTo: 'other', deadline: '2026-10-09' }),
    ], 'me', now);
    expect(groups.map((g) => [g.key, g.tasks.map((x) => x.id)])).toEqual([
      ['overdue', ['late']],
      ['today', ['today']],
      ['week', ['soon']],
      ['later', ['far']],
      ['undated', ['nodate']],
    ]);
  });

  it('lists work I handed out that is waiting for my review, and tasks I watch', () => {
    const groups = groupMyWork([
      t('rev', { assignedTo: 'other', createdBy: 'me', status: 'review' }),
      t('watch', { assignedTo: 'other', watchers: ['me'] }),
      t('ignore', { assignedTo: 'other', createdBy: 'me', status: 'in-progress' }),
    ], 'me', now);
    expect(groups.map((g) => [g.key, g.tasks.map((x) => x.id)])).toEqual([
      ['review', ['rev']],
      ['watching', ['watch']],
    ]);
  });

  it('is empty without a viewer', () => {
    expect(groupMyWork([t('a')], undefined, now)).toEqual([]);
  });
});
