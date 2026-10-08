// Automation rules, the organisation's channels, and the task events the mail job runs them on
// (lib/automations, scripts/lib/automations.cjs).
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { safeListen } from '@/lib/safeUnsubscribe';
import { db } from '@/config/firebase';

const rulesCol = (orgId) => collection(db, 'organizations', orgId, 'automations');
const channelsRef = (orgId) => doc(db, 'organizations', orgId, 'integrations', 'channels');
const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

export const listRules = async (orgId) => rows(await getDocs(rulesCol(orgId)));

/** The rules, kept current (they change rarely, so this costs almost nothing). */
export const subscribeRules = (orgId, onRules) => safeListen(() => onSnapshot(rulesCol(orgId), (snap) => onRules(rows(snap)), () => onRules([])));

export const saveRule = async (orgId, rule, author) => {
  const data = {
    name: String(rule.name).trim().slice(0, 120),
    enabled: Boolean(rule.enabled),
    trigger: rule.trigger,
    toStatus: rule.trigger === 'status_changed' ? rule.toStatus || '' : '',
    projectId: rule.projectId || '',
    priority: rule.priority || '',
    action: rule.action,
    updatedBy: author.uid || author.id,
    updatedAt: serverTimestamp(),
  };
  if (rule.id) {
    await setDoc(doc(rulesCol(orgId), rule.id), data);
    return { id: rule.id, ...data };
  }
  const ref = await addDoc(rulesCol(orgId), data);
  return { id: ref.id, ...data };
};

export const deleteRule = (orgId, ruleId) => deleteDoc(doc(rulesCol(orgId), ruleId));

export const getChannels = async (orgId) => {
  const snap = await getDoc(channelsRef(orgId));
  return { slack: '', teams: '', webhook: '', webhookSecret: '', ...(snap.exists() ? snap.data() : {}) };
};

export const saveChannels = (orgId, { slack, teams, webhook, webhookSecret }) => setDoc(channelsRef(orgId), {
  slack: String(slack || '').trim(),
  teams: String(teams || '').trim(),
  webhook: String(webhook || '').trim(),
  webhookSecret: String(webhookSecret || '').trim(),
});

const event = (data, user) => addDoc(collection(db, 'task_events'), {
  ...data,
  by: user.uid || user.id,
  byName: String(user.name || user.email || '').slice(0, 120),
  at: serverTimestamp(),
  processed: false,
});

/** Record a task change for the automations (best-effort: never fails the change itself). */
export const recordTaskEvent = (task, type, user) => event({
  orgId: task.orgId,
  taskId: task.id,
  type,
  to: type === 'status_changed' ? task.status : '',
}, user).catch((error) => console.warn('Automation event not recorded:', error?.code || error?.message));

/** Ask the next run of the job to post a test message to every channel. */
export const sendChannelTest = (orgId, user) => event({ orgId, taskId: '', type: 'channel_test', to: '' }, user);

/** What the automations did lately (org admins). */
export const listRecentEvents = async (orgId, max = 20) => {
  const base = collection(db, 'task_events');
  try {
    return rows(await getDocs(query(base, where('orgId', '==', orgId), orderBy('at', 'desc'), limit(max))));
  } catch (error) {
    if (error?.code !== 'failed-precondition') throw error;
    // the (orgId, at) index is still building: sort a plain read here
    const list = rows(await getDocs(query(base, where('orgId', '==', orgId), limit(max * 3))));
    return list.sort((a, b) => (b.at?.toMillis?.() || 0) - (a.at?.toMillis?.() || 0)).slice(0, max);
  }
};
