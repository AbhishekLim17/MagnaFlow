// A project's RAID log (organizations/{org}/projects/{p}/raid); rules of an entry: lib/raid.
import {
  addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MAX_DETAIL, MAX_TITLE } from '@/lib/raid';

const col = (orgId, projectId) => collection(db, 'organizations', orgId, 'projects', projectId, 'raid');

const fields = (draft) => ({
  type: draft.type,
  title: String(draft.title).trim().slice(0, MAX_TITLE),
  detail: String(draft.detail || '').trim().slice(0, MAX_DETAIL),
  impact: draft.impact,
  ownerId: draft.ownerId || null,
  ownerName: String(draft.ownerName || '').slice(0, 120),
  dueDate: draft.dueDate || null,
});

export const listRaid = async (orgId, projectId, { openOnly = false } = {}) => {
  const q = openOnly ? query(col(orgId, projectId), where('status', '==', 'open')) : col(orgId, projectId);
  return (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addRaid = async (orgId, projectId, draft, by) => {
  const data = {
    ...fields(draft),
    status: 'open',
    createdBy: by.uid || by.id,
    createdByName: String(by.name || by.email || '').slice(0, 120),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(col(orgId, projectId), data);
  return { id: ref.id, ...data, createdAt: new Date() };
};

export const updateRaid = async (orgId, projectId, id, patch) => {
  const data = { ...('title' in patch ? fields(patch) : {}), ...('status' in patch ? { status: patch.status } : {}), updatedAt: serverTimestamp() };
  await updateDoc(doc(col(orgId, projectId), id), data);
  return data;
};

export const deleteRaid = (orgId, projectId, id) => deleteDoc(doc(col(orgId, projectId), id));
