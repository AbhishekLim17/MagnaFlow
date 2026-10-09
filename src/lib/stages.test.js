import { describe, expect, it } from 'vitest';
import { cleanStages, newStageId, optionValue, parseOption, stageLabel, stageOf, statusOptions } from './stages';

const stages = [
  { id: 'qa', name: 'QA', category: 'review' },
  { id: 'client', name: 'Client check', category: 'review' },
  { id: 'build', name: 'Building', category: 'in-progress' },
];

describe('stages', () => {
  it('keeps only well-formed stages', () => {
    expect(cleanStages([...stages, { id: 'x', name: ' ', category: 'review' }, { id: 'y', name: 'Y', category: 'archived' }, null]))
      .toEqual(stages);
    expect(cleanStages('nope')).toEqual([]);
  });

  it("labels a task by its stage only while the stage belongs to the task's status", () => {
    expect(stageOf({ status: 'review', stage: 'qa' }, stages)?.name).toBe('QA');
    expect(stageLabel({ status: 'review', stage: 'qa' }, stages)).toBe('QA');
    // moved to Completed on the board: the review stage no longer applies
    expect(stageLabel({ status: 'completed', stage: 'qa' }, stages)).toBe('Completed');
    expect(stageLabel({ status: 'pending', stage: 'gone' }, stages)).toBe('Pending');
  });

  it('lists each status followed by its stages, and round-trips a choice', () => {
    const options = statusOptions(stages);
    expect(options.map((o) => o.label)).toEqual([
      'Pending', 'In progress', 'In progress · Building', 'In review', 'In review · QA', 'In review · Client check', 'Completed',
    ]);
    expect(statusOptions([], { cancelled: true }).map((o) => o.value)).toContain('cancelled');
    expect(optionValue({ status: 'review', stage: 'client' }, stages)).toBe('review::client');
    expect(optionValue({ status: 'review', stage: 'build' }, stages)).toBe('review');
    expect(parseOption('review::client')).toEqual({ status: 'review', stage: 'client' });
    expect(parseOption('pending')).toEqual({ status: 'pending', stage: null });
  });

  it('makes readable unique ids', () => {
    expect(newStageId('Client check!', stages)).toBe('client-check');
    expect(newStageId('QA', stages)).toBe('qa-2');
    expect(newStageId('***', [])).toBe('stage');
  });
});
