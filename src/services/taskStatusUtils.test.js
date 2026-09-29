import { describe, test, expect } from 'vitest';
import { nextStatusFromSubtasks as next } from './taskStatusUtils';

describe('nextStatusFromSubtasks', () => {
  test('ticking the first subtask starts a pending task', () => {
    expect(next('pending', 1, 3)).toBe('in-progress');
  });
  test('ticking the last subtask completes the task', () => {
    expect(next('in-progress', 3, 3)).toBe('completed');
    expect(next('review', 3, 3)).toBe('completed');
  });
  test('already-completed task stays as it is when everything is done', () => {
    expect(next('completed', 3, 3)).toBeNull();
  });
  test('a blocked task is never auto-completed', () => {
    expect(next('in-progress', 3, 3, { blocked: true })).toBeNull();
    expect(next('pending', 3, 3, { blocked: true })).toBe('in-progress');
  });
  test('unticking a subtask of a completed task reopens it', () => {
    expect(next('completed', 2, 3)).toBe('in-progress');
  });
  test('unticking everything on a completed task sends it back to pending', () => {
    expect(next('completed', 0, 3)).toBe('pending');
  });
  test('adding an open subtask to a completed task reopens it (3 of 4 done)', () => {
    expect(next('completed', 3, 4)).toBe('in-progress');
  });
  test('does not disturb a task the user moved on by hand', () => {
    expect(next('review', 1, 3)).toBeNull();
    expect(next('in-progress', 0, 3)).toBeNull();
  });
  test('cancelled tasks and empty checklists are left alone', () => {
    expect(next('cancelled', 3, 3)).toBeNull();
    expect(next('pending', 0, 0)).toBeNull();
  });
});
