// Saved plans of a project (lib/baselines): organizations/{org}/projects/{project}/baselines.
// The team reads them; whoever runs the project saves and deletes them. Never edited.
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { snapshotOf } from '@/lib/baselines';

const baselines = (orgId, projectId) => collection(db, 'organizations', orgId, 'projects', projectId, 'baselines');
const millis = (v) => (v?.toMillis ? v.toMillis() : v instanceof Date ? v.getTime() : 0);

/** The project's baselines, newest first. */
export const listBaselines = async (orgId, projectId) => {
  const snap = await getDocs(baselines(orgId, projectId));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
};

/** Save the plan as it stands now. */
export const saveBaseline = async (orgId, projectId, { name, tasks }, author) => {
  const data = {
    name: String(name).slice(0, 80),
    tasks: snapshotOf(tasks),
    createdBy: author.uid || author.id,
    createdByName: String(author.name || author.email || '').slice(0, 120),
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(baselines(orgId, projectId), data);
  return { id: ref.id, ...data, createdAt: new Date() };
};

export const deleteBaseline = (orgId, projectId, baselineId) =>
  deleteDoc(doc(baselines(orgId, projectId), baselineId));
