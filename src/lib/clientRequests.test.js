import { describe, test, expect } from 'vitest';
import { requestProblems, sortRequests, taskDraftFromRequest, MAX_TITLE } from './clientRequests';

describe('requestProblems', () => {
  test('a summary is all that is needed', () => {
    expect(requestProblems({ title: 'Add a dark mode' })).toEqual({});
    expect(requestProblems({ title: '  ' }).title).toMatch(/what you need/);
    expect(requestProblems({ title: 'x'.repeat(MAX_TITLE + 1) }).title).toMatch(/under/);
    expect(requestProblems({ title: 'ok', neededBy: '12/10/2026' }).neededBy).toMatch(/date/);
    expect(requestProblems({ title: 'ok', neededBy: '2026-10-12' })).toEqual({});
  });
});

test('new requests come first, then the newest', () => {
  const at = (ms) => ({ toMillis: () => ms });
  const list = [
    { id: 'old-done', status: 'accepted', createdAt: at(1) },
    { id: 'new-old', status: 'new', createdAt: at(2) },
    { id: 'recent-done', status: 'declined', createdAt: at(5) },
    { id: 'new-recent', status: 'new', createdAt: at(4) },
  ];
  expect(sortRequests(list).map((r) => r.id)).toEqual(['new-recent', 'new-old', 'recent-done', 'old-done']);
});

test("a request becomes a task in its project, with the client's words and date", () => {
  const draft = taskDraftFromRequest(
    { title: 'Dark mode', details: 'For the dashboard', urgency: 'urgent', neededBy: '2026-11-01', projectId: 'p1', requestedByName: 'Cleo' },
    { id: 'p1', departmentId: 'd1' },
  );
  expect(draft).toEqual({
    title: 'Dark mode',
    description: 'For the dashboard\n\nRequested by Cleo through the client portal.',
    priority: 'high',
    deadline: '2026-11-01',
    projectId: 'p1',
    departmentId: 'd1',
  });
  expect(taskDraftFromRequest({ title: 'x', projectId: 'p1' }, null)).toMatchObject({ priority: 'medium', deadline: '', departmentId: '' });
});
