import { describe, test, expect } from 'vitest';
import { ruleProblem, ruleMatches, worthAnEvent, channelText, describeRule, channelProblem } from './automations';

const rule = (extra = {}) => ({ name: 'Done → Slack', enabled: true, trigger: 'status_changed', toStatus: 'completed', action: { type: 'notify_channels' }, ...extra });

describe('ruleProblem', () => {
  test('a complete rule is fine; each missing part is named', () => {
    expect(ruleProblem(rule())).toBeNull();
    expect(ruleProblem(rule({ name: ' ' }))).toMatch(/name/);
    expect(ruleProblem(rule({ trigger: 'whenever' }))).toMatch(/when/);
    expect(ruleProblem(rule({ action: { type: 'set_priority' } }))).toMatch(/priority/);
    expect(ruleProblem(rule({ action: { type: 'assign_to' } }))).toMatch(/who/);
    expect(ruleProblem(rule({ action: { type: 'add_checklist', items: [' '] } }))).toMatch(/at least one/);
  });
});

describe('ruleMatches', () => {
  const task = { status: 'completed', priority: 'high', projectId: 'p1' };
  const event = { type: 'status_changed', to: 'completed' };

  test('trigger, target status, project and priority must all fit', () => {
    expect(ruleMatches(rule(), event, task)).toBe(true);
    expect(ruleMatches(rule({ toStatus: 'review' }), event, task)).toBe(false);
    expect(ruleMatches(rule({ toStatus: '' }), event, task)).toBe(true);
    expect(ruleMatches(rule({ projectId: 'p2' }), event, task)).toBe(false);
    expect(ruleMatches(rule({ priority: 'low' }), event, task)).toBe(false);
    expect(ruleMatches(rule({ enabled: false }), event, task)).toBe(false);
    expect(ruleMatches(rule({ trigger: 'task_created' }), event, task)).toBe(false);
  });

  test('an event that no longer matches the task (changed again, or made up) does nothing', () => {
    expect(ruleMatches(rule(), event, { ...task, status: 'in-progress' })).toBe(false);
    expect(ruleMatches(rule(), event, null)).toBe(false);
  });
});

test('the app records an event only when some enabled rule could want it', () => {
  const rules = [rule({ projectId: 'p1' })];
  expect(worthAnEvent(rules, 'status_changed', { status: 'completed', projectId: 'p1' })).toBe(true);
  expect(worthAnEvent(rules, 'status_changed', { status: 'review', projectId: 'p1' })).toBe(false);
  expect(worthAnEvent(rules, 'task_created', { projectId: 'p1' })).toBe(false);
  expect(worthAnEvent([], 'task_created', {})).toBe(false);
});

test('wording', () => {
  expect(channelText({ type: 'status_changed', to: 'completed', byName: 'Sana' }, { title: 'Ship it' }, 'Apollo'))
    .toBe('“Ship it” in Apollo is now Completed (by Sana)');
  expect(channelText({ type: 'task_created' }, { title: 'New one', priority: 'high' }, '')).toBe('New task: “New one” (high priority)');
  expect(describeRule(rule({ priority: 'high' }), 'Apollo')).toBe('When a task changes status to Completed in Apollo at high priority, post to the channels.');
  expect(describeRule({ trigger: 'task_created', action: { type: 'add_checklist', items: ['a', 'b'] } })).toBe('When a task is created, add 2 checklist items.');
});

test('channel addresses', () => {
  expect(channelProblem('slack', 'https://hooks.slack.com/services/T0/B0/xyz')).toBeNull();
  expect(channelProblem('slack', 'https://example.com/hook')).toMatch(/Slack/);
  expect(channelProblem('teams', 'https://acme.webhook.office.com/webhookb2/abc')).toBeNull();
  expect(channelProblem('teams', 'https://prod-01.westus.logic.azure.com:443/workflows/abc')).toBeNull();
  expect(channelProblem('webhook', 'http://insecure.example.com')).toMatch(/webhook/);
  expect(channelProblem('webhook', 'https://ops.example.com/magnaflow')).toBeNull();
  expect(channelProblem('webhook', '')).toBeNull();
});
