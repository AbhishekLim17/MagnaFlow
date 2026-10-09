// Email-to-task addresses (scripts/lib/inbound.cjs reads the mail). Turning it on for a project
// makes a random key, stored at inbound_keys/{key} -> { orgId, projectId } for the job and on
// the project as inboxKey for display; turning it off removes both, so the old address dies.
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/config/firebase';

export const INBOUND_MAILBOX = import.meta.env?.VITE_INBOUND_MAILBOX || '';

const newKey = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
};

/** "mailbox+key@domain" for a project's key. */
export const inboundAddress = (key, mailbox = INBOUND_MAILBOX) => {
  const [local, domain] = String(mailbox).split('@');
  return key && local && domain ? `${local}+${key}@${domain}` : '';
};

export const enableInbound = async (orgId, projectId, by) => {
  const key = newKey();
  const batch = writeBatch(db);
  batch.set(doc(db, 'inbound_keys', key), { orgId, projectId, createdBy: by.uid || by.id, createdAt: serverTimestamp() });
  batch.update(doc(db, 'organizations', orgId, 'projects', projectId), { inboxKey: key });
  await batch.commit();
  return key;
};

export const disableInbound = async (orgId, projectId, key) => {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'inbound_keys', key));
  batch.update(doc(db, 'organizations', orgId, 'projects', projectId), { inboxKey: null });
  await batch.commit();
};
