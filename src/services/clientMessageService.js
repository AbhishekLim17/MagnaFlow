// The client conversation on a task (client_messages) and a client's sign-off on a
// milestone (tasks/{id}.clientApproval). Wording and rules of thumb: lib/clientThread.
// Emails about new messages are sent by the mail job (scripts/lib/clientUpdates.cjs), which
// looks the addresses up itself; the browser only flags each message `notified: false`.
import {
  collection, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { safeListen } from '@/lib/safeUnsubscribe';
import { MAX_MESSAGE, MAX_NOTE, sortMessages, teamRecipients } from '@/lib/clientThread';

const MESSAGES = 'client_messages';
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const nameOf = (author) => String(author?.name || author?.email || 'Someone').slice(0, 120);

/** Every message of one project (the client portal reads them all at once). */
export const listProjectMessages = async (orgId, projectId) => {
  const snap = await getDocs(query(
    collection(db, MESSAGES),
    where('orgId', '==', orgId),
    where('projectId', '==', projectId),
  ));
  return sortMessages(rows(snap));
};

/** One task's conversation, live (the team's task view). */
export const subscribeTaskMessages = (taskId, onChange, onError) => safeListen(() => onSnapshot(
  query(collection(db, MESSAGES), where('taskId', '==', taskId)),
  (snap) => onChange(sortMessages(rows(snap))),
  (error) => onError?.(error),
));

const messageData = (task, author, fromClient, kind, text) => ({
  orgId: task.orgId,
  projectId: task.projectId,
  taskId: task.id,
  authorId: author.uid || author.id,
  authorName: nameOf(author),
  fromClient,
  kind,
  text: String(text || '').trim().slice(0, MAX_MESSAGE),
  notified: false,
  createdAt: serverTimestamp(),
});

// The bell, for the task's author and assignee, when the client says something.
const notifyTeam = (batch, task, author, type, text) => {
  for (const userId of teamRecipients(task, author.uid || author.id)) {
    batch.set(doc(collection(db, 'comment_notifications')), {
      userId,
      taskId: task.id,
      mentionedBy: author.uid || author.id,
      mentionedByName: nameOf(author),
      type,
      taskTitle: task.title ? String(task.title).slice(0, 200) : null,
      excerpt: text ? String(text).slice(0, 160) : null,
      read: false,
      createdAt: serverTimestamp(),
    });
  }
};

/**
 * Post a message in a task's client conversation.
 * @param {{ task: Object, author: {uid, name, email}, fromClient: boolean, text: string }} args
 * @returns the message as stored (with the local time; the server's stamp is within moments of it)
 */
export const sendClientMessage = async ({ task, author, fromClient, text }) => {
  const batch = writeBatch(db);
  const ref = doc(collection(db, MESSAGES));
  const data = messageData(task, author, fromClient, 'message', text);
  batch.set(ref, data);
  if (fromClient) notifyTeam(batch, task, author, 'client_message', data.text);
  await batch.commit();
  return { id: ref.id, ...data, createdAt: new Date() };
};

/**
 * A client approves a milestone or asks for changes. The decision goes on the task (so every
 * view can show it) and into the conversation (so the history stays), in one write.
 * @param {{ task: Object, author: Object, decision: 'approved'|'changes_requested', note?: string }} args
 */
export const decideMilestone = async ({ task, author, decision, note = '' }) => {
  const batch = writeBatch(db);
  const trimmed = String(note || '').trim().slice(0, MAX_NOTE);
  const approval = { decision, by: author.uid || author.id, byName: nameOf(author), at: serverTimestamp(), note: trimmed };
  batch.update(doc(db, 'tasks', task.id), { clientApproval: approval });
  const ref = doc(collection(db, MESSAGES));
  const data = messageData(task, author, true, decision, trimmed);
  batch.set(ref, data);
  notifyTeam(batch, task, author, decision === 'approved' ? 'client_approved' : 'client_changes_requested', trimmed);
  await batch.commit();
  return {
    approval: { ...approval, at: new Date() },
    message: { id: ref.id, ...data, createdAt: new Date() },
  };
};
