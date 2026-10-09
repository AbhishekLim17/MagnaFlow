// A project's sprints (organizations/{org}/projects/{p}/sprints); the arithmetic is lib/sprints.
import {
  addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

const col = (orgId, projectId) => collection(db, 'organizations', orgId, 'projects', projectId, 'sprints');

export const listSprints = async (orgId, projectId) =>
  (await getDocs(col(orgId, projectId))).docs.map((d) => ({ id: d.id, ...d.data() }));

export const createSprint = async (orgId, projectId, { name, goal, startDate, endDate }, by) => {
  const data = {
    name: String(name).trim().slice(0, 80),
    goal: String(goal || '').trim().slice(0, 500),
    startDate,
    endDate,
    status: 'planned',
    completedPoints: null,
    createdBy: by.uid || by.id,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(col(orgId, projectId), data);
  return { id: ref.id, ...data };
};

/** status: 'active' to start it; 'closed' with the points finished, to complete it. */
export const setSprintStatus = (orgId, projectId, id, status, completedPoints = null) =>
  updateDoc(doc(col(orgId, projectId), id), { status, completedPoints });

export const deleteSprint = (orgId, projectId, id) => deleteDoc(doc(col(orgId, projectId), id));
