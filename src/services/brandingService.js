// The client portal's branding: organizations/{orgId}/branding/portal.
// Every member of the organization (clients included) may read it; org admins write it.
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { brandingFromDoc, brandingToDoc, EMPTY_BRANDING } from '@/lib/branding';

const brandingRef = (orgId) => doc(db, 'organizations', orgId, 'branding', 'portal');

/** The organization's branding, or the plain look when none is set (or it cannot be read). */
export const getBranding = async (orgId) => {
  if (!orgId) return { ...EMPTY_BRANDING };
  try {
    const snap = await getDoc(brandingRef(orgId));
    return snap.exists() ? brandingFromDoc(snap.data()) : { ...EMPTY_BRANDING };
  } catch (error) {
    console.warn('Branding unavailable:', error?.code || error?.message);
    return { ...EMPTY_BRANDING };
  }
};

export const saveBranding = async (orgId, branding) => {
  const data = {
    ...brandingToDoc(branding),
    updatedBy: auth.currentUser?.uid || null,
    updatedAt: serverTimestamp(),
  };
  await setDoc(brandingRef(orgId), data);
  return brandingFromDoc(data);
};
