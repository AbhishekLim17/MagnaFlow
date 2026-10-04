// Requests a client sends from the portal ("please add a dark mode"), and how the team
// turns one into a task or declines it. Pure; Firestore side: services/clientRequestService,
// rules: client_requests.

export const MAX_TITLE = 200;
export const MAX_DETAILS = 4000;
export const MAX_RESPONSE = 2000;

export const REQUEST_STATUS = {
  new: { label: 'Waiting for the team', teamLabel: 'New' },
  accepted: { label: 'Accepted', teamLabel: 'Accepted' },
  declined: { label: 'Declined', teamLabel: 'Declined' },
};

export const URGENCY = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Problems with a client's request form, by field ({} when it can be sent). */
export const requestProblems = ({ title, details, neededBy } = {}) => {
  const out = {};
  const t = String(title || '').trim();
  if (!t) out.title = 'Say in a few words what you need.';
  else if (t.length > MAX_TITLE) out.title = `Keep the summary under ${MAX_TITLE} characters.`;
  if (String(details || '').length > MAX_DETAILS) out.details = `Keep the details under ${MAX_DETAILS} characters.`;
  if (neededBy && !DAY.test(neededBy)) out.neededBy = 'Pick a date.';
  return out;
};

/** New requests first, then the most recent. */
export const sortRequests = (requests) => [...(requests || [])].sort((a, b) => {
  const na = a.status === 'new' ? 0 : 1;
  const nb = b.status === 'new' ? 0 : 1;
  if (na !== nb) return na - nb;
  const ta = a.createdAt?.toMillis?.() ?? (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
  const tb = b.createdAt?.toMillis?.() ?? (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
  return tb - ta;
});

/**
 * The task a request becomes, before the team adjusts it: the client's words, its urgency
 * as priority, its date as the deadline, in the request's project (and that project's
 * department).
 */
export const taskDraftFromRequest = (request, project) => ({
  title: String(request?.title || '').slice(0, MAX_TITLE),
  description: [
    String(request?.details || '').trim(),
    `Requested by ${request?.requestedByName || 'the client'} through the client portal.`,
  ].filter(Boolean).join('\n\n'),
  priority: request?.urgency === 'urgent' ? 'high' : 'medium',
  deadline: request?.neededBy || '',
  projectId: request?.projectId || '',
  departmentId: project?.departmentId || '',
});
