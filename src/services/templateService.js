// Task templates, stored per organisation in organizations/{orgId}/templates.
// What a template holds is built and laid out by lib/templates; this only reads and writes.
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { MAX_TEMPLATE_TASKS } from '@/lib/templates';

const templatesOf = (orgId) => collection(db, 'organizations', orgId, 'templates');

/** Every template in the organisation, alphabetically. */
export const listTemplates = async (orgId) => {
  if (!orgId) return [];
  const snap = await getDocs(templatesOf(orgId));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));
};

/**
 * @param {string} orgId
 * @param {{ name: string, description?: string, items: Object[] }} template
 * @param {string} createdBy uid
 * @returns {Promise<string>} the new template's id
 */
export const saveTemplate = async (orgId, { name, description = '', items }, createdBy) => {
  const clean = String(name || '').trim();
  if (!clean) throw Object.assign(new Error('Give the template a name.'), { userFacing: true });
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('There are no tasks to save.'), { userFacing: true });
  }
  if (items.length > MAX_TEMPLATE_TASKS) {
    throw Object.assign(new Error(`A template can hold at most ${MAX_TEMPLATE_TASKS} tasks.`), { userFacing: true });
  }
  const ref = await addDoc(templatesOf(orgId), {
    name: clean.slice(0, 120),
    description: String(description || '').trim().slice(0, 500),
    items,
    createdBy,
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const deleteTemplate = (orgId, templateId) => deleteDoc(doc(db, 'organizations', orgId, 'templates', templateId));
