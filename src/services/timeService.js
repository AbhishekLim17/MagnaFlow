// Time logged on tasks (time_entries) and the organisation's cost rates
// (organizations/{org}/finance/rates). Sums and costs: lib/timeTracking.
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MAX_NOTE } from '@/lib/timeTracking';

const ENTRIES = 'time_entries';
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const newestFirst = (list) => list.sort((a, b) => String(b.date).localeCompare(String(a.date)));

/** Log time on a task, as the signed-in person. */
export const logTime = async ({ task, author, minutes, date, note }) => {
  const data = {
    orgId: task.orgId,
    projectId: task.projectId || null,
    taskId: task.id,
    userId: author.uid || author.id,
    userName: String(author.name || author.email || '').slice(0, 120),
    minutes: Math.round(minutes),
    date,
    note: String(note || '').trim().slice(0, MAX_NOTE),
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, ENTRIES), data);
  return { id: ref.id, ...data, createdAt: new Date() };
};

export const deleteTimeEntry = (entryId) => deleteDoc(doc(db, ENTRIES, entryId));

/** Everything logged on one task (anyone who can see the task). */
export const listTaskEntries = async (taskId) =>
  newestFirst(rows(await getDocs(query(collection(db, ENTRIES), where('taskId', '==', taskId)))));

/** Everything logged on a project (whoever runs it: the labour cost in the budget). */
export const listProjectEntries = async (orgId, projectId) =>
  newestFirst(rows(await getDocs(query(collection(db, ENTRIES), where('orgId', '==', orgId), where('projectId', '==', projectId)))));

const ratesRef = (orgId) => doc(db, 'organizations', orgId, 'finance', 'rates');

/** { defaultRate, people: { uid: rate } } (empty when none are set). */
export const getRates = async (orgId) => {
  const snap = await getDoc(ratesRef(orgId));
  return snap.exists() ? { defaultRate: 0, people: {}, ...snap.data() } : { defaultRate: 0, people: {} };
};

export const saveRates = async (orgId, { defaultRate, people }) => {
  const clean = Object.fromEntries(Object.entries(people || {})
    .filter(([, v]) => v !== '' && v != null && Number.isFinite(Number(v)) && Number(v) >= 0)
    .map(([k, v]) => [k, Number(v)]));
  const data = { defaultRate: Math.max(0, Number(defaultRate) || 0), people: clean };
  await setDoc(ratesRef(orgId), data);
  return data;
};
