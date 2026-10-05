// Project status updates (portfolio health): organizations/{org}/projects/{project}/updates.
import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MAX_SUMMARY } from '@/lib/portfolio';

const updates = (orgId, projectId) => collection(db, 'organizations', orgId, 'projects', projectId, 'updates');

/** A project's recent updates, newest first. */
export const listUpdates = async (orgId, projectId, max = 10) => {
  const snap = await getDocs(query(updates(orgId, projectId), orderBy('createdAt', 'desc'), limit(max)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/** { projectId: latest update } for the given projects (one small read each). */
export const latestUpdates = async (orgId, projectIds) => {
  const pairs = await Promise.all(projectIds.map(async (id) => {
    const [latest] = await listUpdates(orgId, id, 1).catch(() => []);
    return [id, latest || null];
  }));
  return Object.fromEntries(pairs);
};

export const postUpdate = async (orgId, projectId, { health, summary }, author) => {
  const data = {
    health,
    summary: String(summary || '').trim().slice(0, MAX_SUMMARY),
    createdBy: author.uid || author.id,
    createdByName: String(author.name || author.email || '').slice(0, 120),
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(updates(orgId, projectId), data);
  return { id: ref.id, ...data, createdAt: new Date() };
};
