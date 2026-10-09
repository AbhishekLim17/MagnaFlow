// Public holidays (organizations/{org}/holidays/list) and leave (organizations/{org}/leave).
// What they do to capacity: lib/leave.
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { cleanHolidays } from '@/lib/leave';

const holidaysRef = (orgId) => doc(db, 'organizations', orgId, 'holidays', 'list');
const leaveCol = (orgId) => collection(db, 'organizations', orgId, 'leave');

export const getHolidays = async (orgId) => {
  const snap = await getDoc(holidaysRef(orgId));
  return snap.exists() ? cleanHolidays(snap.data().days) : [];
};

export const saveHolidays = async (orgId, days) => {
  const clean = cleanHolidays(days);
  await setDoc(holidaysRef(orgId), { days: clean });
  return clean;
};

/** Leave that ends on or after `fromDay` ("YYYY-MM-DD"). */
export const listLeave = async (orgId, fromDay) => {
  const snap = await getDocs(query(leaveCol(orgId), where('to', '>=', fromDay)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

export const addLeave = async (orgId, { person, from, to, note }, by) => {
  const data = {
    userId: person.id || person.uid,
    userName: String(person.name || person.email || '').slice(0, 120),
    from,
    to,
    note: String(note || '').trim().slice(0, 200),
    createdBy: by.uid || by.id,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(leaveCol(orgId), data);
  return { id: ref.id, ...data };
};

export const deleteLeave = (orgId, leaveId) => deleteDoc(doc(leaveCol(orgId), leaveId));
