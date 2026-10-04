import { describe, test, expect } from 'vitest';
import {
  canDecide, approvalSummary, sortMessages, groupByTask, teamRecipients, messageProblem, clientNotificationText, MAX_MESSAGE,
} from './clientThread';

const at = (iso) => ({ toDate: () => new Date(iso) });

test('a client signs off milestones that are in review or finished', () => {
  expect(canDecide({ milestone: true, status: 'review' })).toBe(true);
  expect(canDecide({ milestone: true, status: 'completed' })).toBe(true);
  expect(canDecide({ milestone: true, status: 'in-progress' })).toBe(false);
  expect(canDecide({ milestone: false, status: 'completed' })).toBe(false);
});

test('approvalSummary', () => {
  expect(approvalSummary({})).toBeNull();
  expect(approvalSummary({ clientApproval: { decision: 'maybe' } })).toBeNull();
  expect(approvalSummary({ clientApproval: { decision: 'changes_requested', byName: 'Acme', at: at('2026-10-04T10:00:00Z'), note: 'Bigger logo' } }))
    .toMatchObject({ label: 'Changes requested', by: 'Acme', note: 'Bigger logo' });
});

describe('ordering', () => {
  const msgs = [
    { id: 'b', taskId: 't1', createdAt: at('2026-10-02T00:00:00Z') },
    { id: 'pending', taskId: 't1', createdAt: null },
    { id: 'a', taskId: 't1', createdAt: at('2026-10-01T00:00:00Z') },
    { id: 'c', taskId: 't2', createdAt: at('2026-10-03T00:00:00Z') },
  ];

  test('oldest first, a message still being saved last', () => {
    expect(sortMessages(msgs).map((m) => m.id)).toEqual(['a', 'b', 'c', 'pending']);
  });

  test('grouped by task', () => {
    const g = groupByTask(msgs);
    expect(g.t1.map((m) => m.id)).toEqual(['a', 'b', 'pending']);
    expect(g.t2).toHaveLength(1);
  });
});

test('the team hears through the task author and assignee, once each, never themselves', () => {
  expect(teamRecipients({ createdBy: 'm', assignedTo: 's' })).toEqual(['m', 's']);
  expect(teamRecipients({ createdBy: 'm', assignedTo: 'm' })).toEqual(['m']);
  expect(teamRecipients({ createdBy: 'm', assignedTo: '' }, 'x')).toEqual(['m']);
  expect(teamRecipients({ createdBy: 'm', assignedTo: 's' }, 'm')).toEqual(['s']);
});

test('messageProblem', () => {
  expect(messageProblem('  ')).toMatch(/Write a message/);
  expect(messageProblem('x'.repeat(MAX_MESSAGE + 1))).toMatch(/under/);
  expect(messageProblem('Looks good')).toBeNull();
});

test('the bell says what the client did', () => {
  expect(clientNotificationText({ type: 'client_approved', mentionedByName: 'Acme', taskTitle: 'Design sign-off' }))
    .toBe('Acme approved “Design sign-off”');
  expect(clientNotificationText({ type: 'client_changes_requested', taskTitle: 'Launch' })).toBe('Your client asked for changes on “Launch”');
  expect(clientNotificationText({ type: 'client_message', mentionedByName: 'Acme' })).toBe('Acme wrote on a task');
  expect(clientNotificationText({ mentionedByName: 'x' })).toBeNull();
});
