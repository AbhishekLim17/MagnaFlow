// Project pages (organizations/{org}/projects/{p}/pages); the text conventions: lib/wiki.
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MAX_BODY, MAX_TITLE } from '@/lib/wiki';

const col = (orgId, projectId) => collection(db, 'organizations', orgId, 'projects', projectId, 'pages');
const by = (user) => ({ updatedBy: user.uid || user.id, updatedByName: String(user.name || user.email || '').slice(0, 120), updatedAt: serverTimestamp() });

// ponytail: lists whole pages (bodies too) to show the titles; a titles-only index document
// would save bandwidth once a project has hundreds of long pages.
export const listPages = async (orgId, projectId) =>
  (await getDocs(col(orgId, projectId))).docs.map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));

export const getPage = async (orgId, projectId, id) => {
  const snap = await getDoc(doc(col(orgId, projectId), id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const createPage = async (orgId, projectId, { title, body }, user) => {
  const data = {
    title: String(title).trim().slice(0, MAX_TITLE),
    body: String(body || '').slice(0, MAX_BODY),
    createdBy: user.uid || user.id,
    createdAt: serverTimestamp(),
    ...by(user),
  };
  const ref = await addDoc(col(orgId, projectId), data);
  return { id: ref.id, ...data, updatedAt: new Date() };
};

export const savePage = async (orgId, projectId, id, { title, body }, user) => {
  const data = { title: String(title).trim().slice(0, MAX_TITLE), body: String(body || '').slice(0, MAX_BODY), ...by(user) };
  await updateDoc(doc(col(orgId, projectId), id), data);
  return { ...data, updatedAt: new Date() };
};

export const deletePage = (orgId, projectId, id) => deleteDoc(doc(col(orgId, projectId), id));
