// Client requests (client_requests): a client asks the project team for something; the team
// accepts it (it becomes a task) or declines it with a reason. Emails both ways come from the
// mail job (scripts/lib/clientUpdates.cjs); the browser only leaves `notified: false`.
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MAX_DETAILS, MAX_RESPONSE, MAX_TITLE, sortRequests } from '@/lib/clientRequests';

const REQUESTS = 'client_requests';
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const nameOf = (person) => String(person?.name || person?.email || 'Someone').slice(0, 120);

/** One project's requests (a client reads only their own projects'; the rules check). */
export const listProjectRequests = async (orgId, projectId) => sortRequests(rows(await getDocs(query(
  collection(db, REQUESTS), where('orgId', '==', orgId), where('projectId', '==', projectId),
))));

/**
 * The team's inbox: an org admin reads the whole organization in one query; a manager or
 * department head reads project by project (what the rules can check).
 * @param {string} orgId
 * @param {string[]|null} projectIds  null = the whole organization
 */
export const listRequestsForTeam = async (orgId, projectIds) => {
  if (projectIds === null) {
    return sortRequests(rows(await getDocs(query(collection(db, REQUESTS), where('orgId', '==', orgId)))));
  }
  const lists = await Promise.all([...new Set(projectIds)].map((p) => listProjectRequests(orgId, p)));
  return sortRequests(lists.flat());
};

/** A client sends a request about one of their projects. */
export const createRequest = async ({ orgId, projectId, author, title, details, urgency, neededBy }) => {
  const data = {
    orgId,
    projectId,
    title: String(title || '').trim().slice(0, MAX_TITLE),
    details: String(details || '').trim().slice(0, MAX_DETAILS),
    urgency: urgency === 'urgent' ? 'urgent' : 'normal',
    neededBy: neededBy || null,
    requestedBy: author.uid || author.id,
    requestedByName: nameOf(author),
    status: 'new',
    notified: false,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, REQUESTS), data);
  return { id: ref.id, ...data, createdAt: new Date() };
};

/** The client takes back a request the team has not answered yet. */
export const withdrawRequest = (requestId) => deleteDoc(doc(db, REQUESTS, requestId));

const decide = async (requestId, decider, status, response, taskId) => {
  const patch = {
    status,
    decidedBy: decider.uid || decider.id,
    decidedByName: nameOf(decider),
    decidedAt: serverTimestamp(),
    response: String(response || '').trim().slice(0, MAX_RESPONSE),
    notified: false,
    ...(taskId ? { taskId } : {}),
  };
  await updateDoc(doc(db, REQUESTS, requestId), patch);
  return { ...patch, decidedAt: new Date() };
};

/** Mark a request accepted once its task exists. */
export const acceptRequest = (requestId, decider, taskId, response = '') =>
  decide(requestId, decider, 'accepted', response, taskId);

/** Decline a request, telling the client why. */
export const declineRequest = (requestId, decider, response) =>
  decide(requestId, decider, 'declined', response, null);
