// Push notifications on this device (Firebase Cloud Messaging, free on the Spark plan).
// Off unless the build sets VITE_FCM_VAPID_KEY (docs/PUSH_SETUP.md). A device that turns it on
// stores its token at users/{uid}/pushTokens/{token}; the mail job (scripts/lib/push.cjs) sends
// a push alongside each email and forgets tokens that stopped working.
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import app, { db } from '@/config/firebase';

const VAPID_KEY = import.meta.env?.VITE_FCM_VAPID_KEY || '';
const STORAGE_KEY = 'magnaflow-push-token';

export const pushConfigured = () => Boolean(VAPID_KEY);
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const remembered = () => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } };
const remember = (token) => { try { if (token) localStorage.setItem(STORAGE_KEY, token); else localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ } };

/** Is this device set to receive pushes for this person? */
export const pushEnabledHere = () => pushSupported() && Notification.permission === 'granted' && Boolean(remembered());

/** Ask permission, register this device, store its token. Returns false if the person said no. */
export const enablePush = async (uid) => {
  if (!pushConfigured() || !pushSupported()) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const { getMessaging, getToken } = await import('firebase/messaging');
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
  });
  if (!token) return false;
  await setDoc(doc(db, 'users', uid, 'pushTokens', token), {
    createdAt: serverTimestamp(),
    device: String(navigator.userAgent || '').slice(0, 200),
  });
  remember(token);
  return true;
};

/** Stop pushes to this device. */
export const disablePush = async (uid) => {
  const token = remembered();
  remember(null);
  if (!token) return;
  await deleteDoc(doc(db, 'users', uid, 'pushTokens', token)).catch(() => {});
  try {
    const { getMessaging, deleteToken } = await import('firebase/messaging');
    await deleteToken(getMessaging(app));
  } catch { /* nothing more to undo */ }
};
