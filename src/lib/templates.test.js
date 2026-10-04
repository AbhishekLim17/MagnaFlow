import { describe, test, expect } from 'vitest';
import { tasksToTemplateItems, dependencyOrder, planFromTemplate, describeTemplate } from './templates';

// Stored the way the app stores dates: midnight UTC of the day.
const day = (iso) => new Date(`${iso}T00:00:00Z`);

const tasks = [
  { id: 'a', title: 'Kick-off', priority: 'high', startDate: day('2026-10-05'), deadline: day('2026-10-05'), blockedBy: [] },
  { id: 'b', title: 'Design', description: 'Wireframes', priority: 'medium', startDate: day('2026-10-07'), deadline: day('2026-10-11'), blockedBy: ['a'] },
  { id: 'c', title: 'Sign-off', priority: 'critical', milestone: true, startDate: day('2026-10-12'), deadline: day('2026-10-12'), blockedBy: ['b', 'outside'] },
  { id: 'd', title: 'Someday', priority: 'low', blockedBy: [] },
  { id: 'e', title: 'Dropped', status: 'cancelled', startDate: day('2026-10-01'), deadline: day('2026-10-02') },
];

describe('tasksToTemplateItems', () => {
  const items = tasksToTemplateItems(tasks, { b: ['Mobile', ' Desktop ', ''] });

  test('dates become offsets from the first day, and lengths in days', () => {
    expect(items.map((i) => [i.title, i.startOffset, i.duration])).toEqual([
      ['Kick-off', 0, 0], ['Design', 2, 4], ['Sign-off', 7, 0], ['Someday', null, null],
    ]);
  });

  test('cancelled tasks are left out', () => {
    expect(items.map((i) => i.title)).not.toContain('Dropped');
  });

  test('dependencies point at other items; ones outside the set are dropped', () => {
    expect(items.find((i) => i.title === 'Design').dependsOn).toEqual(['t1']);
    expect(items.find((i) => i.title === 'Sign-off').dependsOn).toEqual(['t2']);
  });

  test('checklists and milestone flags travel with the task', () => {
    expect(items.find((i) => i.title === 'Design').subtasks).toEqual(['Mobile', 'Desktop']);
    expect(items.find((i) => i.title === 'Sign-off').milestone).toBe(true);
  });
});

describe('dependencyOrder', () => {
  test('prerequisites come first, otherwise the order is kept', () => {
    const items = [
      { key: 'c', dependsOn: ['b'] }, { key: 'x', dependsOn: [] }, { key: 'b', dependsOn: ['a'] }, { key: 'a', dependsOn: [] },
    ];
    expect(dependencyOrder(items).map((i) => i.key)).toEqual(['a', 'b', 'c', 'x']);
  });

  test('a loop in bad data does not hang or drop items', () => {
    const items = [{ key: 'a', dependsOn: ['b'] }, { key: 'b', dependsOn: ['a'] }];
    expect(dependencyOrder(items).map((i) => i.key).sort()).toEqual(['a', 'b']);
  });
});

describe('planFromTemplate', () => {
  const template = { items: tasksToTemplateItems(tasks, { b: ['Mobile'] }) };

  test('lays the plan out from a new start date, same rhythm', () => {
    const plan = planFromTemplate(template, { startDate: '2026-11-02', projectId: 'p1', departmentId: 'd1', assignedTo: 'u1' });
    const byTitle = Object.fromEntries(plan.map((p) => [p.task.title, p.task]));
    expect(byTitle['Kick-off']).toMatchObject({ startDate: '2026-11-02', deadline: '2026-11-02', status: 'pending', assignedTo: 'u1', projectId: 'p1', departmentId: 'd1' });
    expect(byTitle.Design).toMatchObject({ startDate: '2026-11-04', deadline: '2026-11-08', description: 'Wireframes' });
    expect(byTitle['Sign-off']).toMatchObject({ startDate: '2026-11-09', deadline: '2026-11-09', milestone: true, priority: 'critical' });
    expect(byTitle.Someday).toMatchObject({ startDate: '', deadline: '' });
  });

  test('comes out in an order where prerequisites exist before the tasks that wait on them', () => {
    const plan = planFromTemplate(template, { startDate: '2026-11-02' });
    const pos = Object.fromEntries(plan.map((p, i) => [p.key, i]));
    plan.forEach((p) => p.dependsOn.forEach((k) => expect(pos[k]).toBeLessThan(pos[p.key])));
    expect(plan.find((p) => p.task.title === 'Design').subtasks).toEqual(['Mobile']);
  });

  test('works across a month end', () => {
    const plan = planFromTemplate(template, { startDate: '2026-12-28' });
    expect(plan.find((p) => p.task.title === 'Sign-off').task.deadline).toBe('2027-01-04');
  });

  test('without a start date the tasks have no dates', () => {
    const plan = planFromTemplate(template, {});
    expect(plan.every((p) => p.task.deadline === '')).toBe(true);
  });
});

describe('describeTemplate', () => {
  test('summarises size, span, dependencies and checklists', () => {
    expect(describeTemplate({ items: tasksToTemplateItems(tasks, { b: ['x', 'y'] }) })).toBe('4 tasks over 8 days, 2 dependencies, 2 checklist items');
    expect(describeTemplate({ items: [{ key: 'a', startOffset: null }] })).toBe('1 task');
  });
});
