// The organisation's workflow stages (organizations/{org}/workflow/stages); rules: lib/stages.
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { safeListen } from '@/lib/safeUnsubscribe';
import { cleanStages } from '@/lib/stages';

const ref = (orgId) => doc(db, 'organizations', orgId, 'workflow', 'stages');

export const subscribeStages = (orgId, onStages) => safeListen(() => onSnapshot(
  ref(orgId),
  (snap) => onStages(cleanStages(snap.exists() ? snap.data().stages : [])),
  () => onStages([]),
));

export const saveStages = (orgId, stages) => setDoc(ref(orgId), { stages: cleanStages(stages) });
