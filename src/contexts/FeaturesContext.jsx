// The organisation's switched-on features (lib/features), live, and the signed-in person's
// hidden ones. Org admins add or remove features for everyone; anyone can hide an optional
// feature from their own menu. The master admin (no organisation) sees everything.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from './AuthContext';
import { safeListen, safeUnsubscribe } from '@/lib/safeUnsubscribe';
import { reportError } from '@/lib/reportError';
import { OPTIONAL, enabledFrom, featureOn, featureShown, toggled, visibleMenu } from '@/lib/features';

const ORG_ADMIN = new Set(['org-admin', 'admin']);

const ALL_ON = {
  ready: true, enabled: OPTIONAL, hidden: [], canManage: false,
  isOn: () => true, isShown: () => true, menu: (items) => items, setFeature: async () => {}, setHidden: async () => {},
};
const FeaturesContext = createContext(ALL_ON);

export const useFeatures = () => useContext(FeaturesContext);

export const FeaturesProvider = ({ children }) => {
  const { user } = useAuth();
  const orgId = user?.orgId || null;
  const uid = user?.id || user?.uid || null;
  const [enabled, setEnabled] = useState(null); // null until the settings have loaded
  const [hidden, setHiddenList] = useState([]);

  useEffect(() => {
    setEnabled(null);
    if (!orgId) return undefined;
    const stop = safeListen(() => onSnapshot(
      doc(db, 'organizations', orgId, 'features', 'settings'),
      (snap) => setEnabled(enabledFrom(snap.exists() ? snap.data() : null)),
      () => setEnabled([]),
    ));
    return () => safeUnsubscribe(stop);
  }, [orgId]);

  useEffect(() => { setHiddenList(Array.isArray(user?.hiddenFeatures) ? user.hiddenFeatures : []); }, [user]);

  const setFeature = useCallback(async (id, on) => {
    const next = toggled(enabled || [], id, on);
    const before = enabled;
    setEnabled(next);
    try {
      await setDoc(doc(db, 'organizations', orgId, 'features', 'settings'), { enabled: next, updatedBy: uid, updatedAt: serverTimestamp() });
    } catch (error) {
      setEnabled(before);
      reportError(error, { title: on ? "Couldn't add the feature" : "Couldn't remove the feature" });
      throw error;
    }
  }, [enabled, orgId, uid]);

  const setHidden = useCallback(async (id, hide) => {
    const before = hidden;
    const next = hide ? [...new Set([...hidden, id])] : hidden.filter((x) => x !== id);
    setHiddenList(next);
    try {
      await updateDoc(doc(db, 'users', uid), { hiddenFeatures: next });
    } catch (error) {
      setHiddenList(before);
      reportError(error, { title: "Couldn't change your menu" });
    }
  }, [hidden, uid]);

  const value = useMemo(() => {
    if (!orgId) return ALL_ON; // master admin, or signed out
    const list = enabled || [];
    return {
      ready: enabled !== null,
      enabled: list,
      hidden,
      canManage: ORG_ADMIN.has(user?.role),
      isOn: (id) => featureOn(list, id),
      isShown: (id) => featureShown(list, hidden, id),
      menu: (items) => visibleMenu(items, list, hidden),
      setFeature,
      setHidden,
    };
  }, [orgId, enabled, hidden, user?.role, setFeature, setHidden]);

  return <FeaturesContext.Provider value={value}>{children}</FeaturesContext.Provider>;
};
