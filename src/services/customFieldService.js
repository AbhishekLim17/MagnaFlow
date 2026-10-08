// The organisation's custom task fields: organizations/{org}/customFields (lib/customFields).
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { safeListen } from '@/lib/safeUnsubscribe';

const col = (orgId) => collection(db, 'organizations', orgId, 'customFields');
const byCreated = (a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);

/** The definitions, live, oldest first (the order they show in forms). */
export const subscribeCustomFields = (orgId, onFields) => safeListen(() => onSnapshot(
  col(orgId),
  (snap) => onFields(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreated)),
  () => onFields([]),
));

export const saveCustomField = async (orgId, field) => {
  const data = {
    name: String(field.name).trim().slice(0, 60),
    type: field.type,
    options: field.type === 'select' ? field.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 50) : [],
  };
  if (field.id) {
    await setDoc(doc(col(orgId), field.id), { ...data, createdAt: field.createdAt || serverTimestamp() });
    return { ...field, ...data };
  }
  const ref = await addDoc(col(orgId), { ...data, createdAt: serverTimestamp() });
  return { id: ref.id, ...data };
};

export const deleteCustomField = (orgId, fieldId) => deleteDoc(doc(col(orgId), fieldId));
