// A project's RAID log: risks, assumptions, issues and decisions, each with an owner, an
// impact and open/closed. organizations/{org}/projects/{p}/raid. Pure.

export const RAID_TYPES = {
  risk: { label: 'Risk', plural: 'Risks', hint: 'Something that might go wrong' },
  issue: { label: 'Issue', plural: 'Issues', hint: 'Something that has gone wrong' },
  assumption: { label: 'Assumption', plural: 'Assumptions', hint: 'Something the plan takes for granted' },
  decision: { label: 'Decision', plural: 'Decisions', hint: 'Something agreed, and why' },
};
export const IMPACTS = ['high', 'medium', 'low'];
export const MAX_TITLE = 160;
export const MAX_DETAIL = 2000;

const IMPACT_RANK = { high: 0, medium: 1, low: 2 };

/** Why an entry cannot be saved, or null. */
export const raidProblem = (draft) => {
  if (!RAID_TYPES[draft?.type]) return 'Choose what kind of entry this is.';
  if (!String(draft.title || '').trim()) return 'Give it a short title.';
  if (String(draft.title).trim().length > MAX_TITLE) return `Keep the title under ${MAX_TITLE} characters.`;
  if (!IMPACTS.includes(draft.impact)) return 'Choose the impact.';
  return null;
};

/** Open first, then by impact, then soonest due, then newest. */
export const sortRaid = (items = []) => [...items].sort((a, b) =>
  ((a.status === 'closed') - (b.status === 'closed'))
  || (IMPACT_RANK[a.impact] ?? 3) - (IMPACT_RANK[b.impact] ?? 3)
  || String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))
  || String(b.createdAt?.toMillis?.() ?? '').localeCompare(String(a.createdAt?.toMillis?.() ?? '')));

/** What needs attention: open high-impact risks and issues (decisions and assumptions don't). */
export const raidAttention = (items = []) => {
  const open = items.filter((i) => i.status !== 'closed');
  return {
    openRisks: open.filter((i) => i.type === 'risk').length,
    openIssues: open.filter((i) => i.type === 'issue').length,
    highOpen: open.filter((i) => (i.type === 'risk' || i.type === 'issue') && i.impact === 'high').length,
  };
};

/** "2 high risks or issues open" or null. */
export const attentionLine = ({ highOpen }) =>
  (highOpen ? `${highOpen} high-impact risk${highOpen === 1 ? '' : 's'} or issue${highOpen === 1 ? '' : 's'} open` : null);
