import { describe, expect, it } from 'vitest';
import { attentionLine, raidAttention, raidProblem, sortRaid } from './raid';

describe('raid', () => {
  it('checks an entry', () => {
    expect(raidProblem({ type: 'risk', title: 'Vendor late', impact: 'high' })).toBeNull();
    expect(raidProblem({ type: 'rumour', title: 'x', impact: 'high' })).toMatch(/kind/);
    expect(raidProblem({ type: 'risk', title: '  ', impact: 'high' })).toMatch(/title/);
    expect(raidProblem({ type: 'risk', title: 'x'.repeat(200), impact: 'high' })).toMatch(/under/);
    expect(raidProblem({ type: 'risk', title: 'x', impact: 'huge' })).toMatch(/impact/);
  });

  it('puts open, high-impact, soon-due entries first', () => {
    const sorted = sortRaid([
      { id: 'closedHigh', status: 'closed', impact: 'high' },
      { id: 'lowOpen', status: 'open', impact: 'low' },
      { id: 'highLater', status: 'open', impact: 'high', dueDate: '2026-12-01' },
      { id: 'highSoon', status: 'open', impact: 'high', dueDate: '2026-10-20' },
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['highSoon', 'highLater', 'lowOpen', 'closedHigh']);
  });

  it('counts what needs attention', () => {
    const counts = raidAttention([
      { type: 'risk', impact: 'high', status: 'open' },
      { type: 'issue', impact: 'high', status: 'open' },
      { type: 'issue', impact: 'low', status: 'open' },
      { type: 'risk', impact: 'high', status: 'closed' },
      { type: 'decision', impact: 'high', status: 'open' },
    ]);
    expect(counts).toEqual({ openRisks: 1, openIssues: 2, highOpen: 2 });
    expect(attentionLine(counts)).toBe('2 high-impact risks or issues open');
    expect(attentionLine({ highOpen: 1 })).toBe('1 high-impact risk or issue open');
    expect(attentionLine({ highOpen: 0 })).toBeNull();
  });
});
