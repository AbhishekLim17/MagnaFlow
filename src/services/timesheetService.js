// Weekly timesheets (organizations/{org}/projects/{p}/timesheets) and client invoices
// (organizations/{org}/invoices). The arithmetic is in lib/timesheets.
import {
  addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { addDaysTo, sheetId } from '@/lib/timesheets';

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));
const sheets = (orgId, projectId) => collection(db, 'organizations', orgId, 'projects', projectId, 'timesheets');
const invoices = (orgId) => collection(db, 'organizations', orgId, 'invoices');

/** Time logged on a project in the week starting `monday`. */
export const listWeekEntries = async (orgId, projectId, monday) => rows(await getDocs(query(
  collection(db, 'time_entries'),
  where('orgId', '==', orgId),
  where('projectId', '==', projectId),
  where('date', '>=', monday),
  where('date', '<=', addDaysTo(monday, 6)),
)));

/** The decisions on a project's timesheets: for one week, or for weeks starting in [from, to]. */
export const listSheets = async (orgId, projectId, { week, from, to } = {}) => {
  const filters = week
    ? [where('weekStart', '==', week)]
    : [where('weekStart', '>=', from), where('weekStart', '<=', to)];
  return rows(await getDocs(query(sheets(orgId, projectId), ...filters)));
};

/** Approve or reject one person's week (the minutes approved are the ones on screen). */
export const decideSheet = async (orgId, projectId, { userId, userName, minutes }, monday, status, note, by) => {
  const data = {
    userId,
    userName: String(userName || '').slice(0, 120),
    weekStart: monday,
    minutes: Math.round(minutes),
    status,
    note: String(note || '').trim().slice(0, 500),
    decidedBy: by.uid || by.id,
    decidedByName: String(by.name || by.email || '').slice(0, 120),
    decidedAt: serverTimestamp(),
  };
  await setDoc(doc(sheets(orgId, projectId), sheetId(userId, monday)), data);
  return { id: sheetId(userId, monday), ...data, decidedAt: new Date() };
};

export const listInvoices = async (orgId) =>
  rows(await getDocs(query(invoices(orgId), orderBy('createdAt', 'desc'))));

export const saveInvoice = async (orgId, invoice, by) => {
  const data = {
    ...invoice,
    status: 'issued',
    paidAt: null,
    createdBy: by.uid || by.id,
    createdByName: String(by.name || by.email || '').slice(0, 120),
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(invoices(orgId), data);
  return { id: ref.id, ...data, createdAt: new Date() };
};

export const setInvoiceStatus = (orgId, invoiceId, status) =>
  updateDoc(doc(invoices(orgId), invoiceId), { status, paidAt: status === 'paid' ? serverTimestamp() : null });
