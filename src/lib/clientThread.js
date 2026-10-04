// The conversation between a project team and its client about a task, and the client's
// sign-off on milestones. Pure: the Firestore side is services/clientMessageService, the
// security in firestore.rules (client_messages, tasks.clientApproval).
//
// It is kept apart from internal comments on purpose: nothing said inside the team can
// reach a client by accident.

import { toDate } from './format';

export const MAX_MESSAGE = 4000;
export const MAX_NOTE = 2000;

/** A milestone the client may sign off: the team has put it up for review or finished it. */
export const canDecide = (task) =>
  Boolean(task?.milestone) && ['review', 'completed'].includes(task?.status);

export const DECISIONS = {
  approved: { label: 'Approved', verb: 'approved' },
  changes_requested: { label: 'Changes requested', verb: 'asked for changes on' },
};

/** Where a milestone stands with the client, in words; null while undecided. */
export const approvalSummary = (task) => {
  const a = task?.clientApproval;
  if (!a || !DECISIONS[a.decision]) return null;
  return {
    decision: a.decision,
    label: DECISIONS[a.decision].label,
    by: a.byName || 'The client',
    at: toDate(a.at),
    note: a.note || '',
  };
};

/** Messages in the order they were written (pending server timestamps last). */
export const sortMessages = (messages) => [...(messages || [])].sort((a, b) => {
  const ta = toDate(a.createdAt)?.getTime() ?? Infinity;
  const tb = toDate(b.createdAt)?.getTime() ?? Infinity;
  return ta - tb;
});

/** { taskId: [messages, oldest first] } */
export const groupByTask = (messages) => {
  const out = {};
  for (const m of sortMessages(messages)) (out[m.taskId] ||= []).push(m);
  return out;
};

/** Who on the team hears about a client's message: the task's author and its assignee. */
export const teamRecipients = (task, exceptUid) =>
  [...new Set([task?.createdBy, task?.assignedTo])].filter((uid) => uid && uid !== exceptUid);

/** Why a message cannot be sent, or null. */
export const messageProblem = (text) => {
  const t = String(text || '').trim();
  if (!t) return 'Write a message first.';
  if (t.length > MAX_MESSAGE) return `Keep it under ${MAX_MESSAGE} characters.`;
  return null;
};

/** The bell's sentence for a notification about a client (null for other kinds). */
export const clientNotificationText = (n) => {
  const who = n?.mentionedByName || 'Your client';
  const on = n?.taskTitle ? `“${n.taskTitle}”` : 'a task';
  switch (n?.type) {
    case 'client_message': return `${who} wrote on ${on}`;
    case 'client_approved': return `${who} approved ${on}`;
    case 'client_changes_requested': return `${who} asked for changes on ${on}`;
    default: return null;
  }
};
