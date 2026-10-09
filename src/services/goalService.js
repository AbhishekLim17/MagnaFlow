// Goals and key results (organizations/{org}/goals); the arithmetic is lib/goals.
import {
  addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { cleanKeyResults, MAX_GOAL_PROJECTS } from '@/lib/goals';

const col = (orgId) => collection(db, 'organizations', orgId, 'goals');

const fields = (goal) => ({
  title: String(goal.title).trim().slice(0, 160),
  description: String(goal.description || '').trim().slice(0, 2000),
  ownerId: goal.ownerId || null,
  ownerName: String(goal.ownerName || '').slice(0, 120),
  startDate: goal.startDate || null,
  dueDate: goal.dueDate || null,
  projectIds: (goal.projectIds || []).slice(0, MAX_GOAL_PROJECTS),
  keyResults: cleanKeyResults(goal.keyResults),
  updatedAt: serverTimestamp(),
});

export const listGoals = async (orgId) =>
  (await getDocs(col(orgId))).docs.map((d) => ({ id: d.id, ...d.data() }));

export const createGoal = async (orgId, goal, by) => {
  const data = { ...fields(goal), createdBy: by.uid || by.id, createdAt: serverTimestamp() };
  const ref = await addDoc(col(orgId), data);
  return { id: ref.id, ...data, createdAt: new Date(), updatedAt: new Date() };
};

export const updateGoal = async (orgId, id, goal) => {
  const data = fields(goal);
  await updateDoc(doc(col(orgId), id), data);
  return { ...data, updatedAt: new Date() };
};

/** The owner's check-in: new current values only. */
export const checkIn = async (orgId, id, keyResults) => {
  const data = { keyResults: cleanKeyResults(keyResults), updatedAt: serverTimestamp() };
  await updateDoc(doc(col(orgId), id), data);
  return { ...data, updatedAt: new Date() };
};

export const deleteGoal = (orgId, id) => deleteDoc(doc(col(orgId), id));
