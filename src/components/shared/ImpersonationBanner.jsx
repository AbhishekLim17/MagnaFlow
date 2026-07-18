// Persistent banner shown while a master-admin is impersonating another user.
// Impersonation swaps the Firebase Auth session entirely (client SDKs only
// support one signed-in user at a time), so "return" works by having minted a
// second custom token for the master-admin's OWN uid before switching, cached
// in sessionStorage, and signing back in with it.

import React, { useState, useEffect, useCallback } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'magnaflow_impersonation';
const EVENT = 'magnaflow-impersonation-changed';

const readSession = () => {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
};

// Called from the Master Admin dashboard right before switching sessions.
// Dispatches an event so the (already-mounted) banner picks it up without a
// page reload.
export const startImpersonationSession = ({ returnToken, targetName, masterAdminEmail }) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ returnToken, targetName, masterAdminEmail }));
  window.dispatchEvent(new Event(EVENT));
};

const ImpersonationBanner = () => {
  const [session, setSession] = useState(() => {
    try { return readSession(); } catch { return null; }
  });
  const [returning, setReturning] = useState(false);

  useEffect(() => {
    const sync = () => {
      try { setSession(readSession()); } catch { setSession(null); }
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync); // cross-tab
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const handleReturn = useCallback(async () => {
    if (!session) return;
    setReturning(true);
    try {
      await signInWithCustomToken(auth, session.returnToken);
      sessionStorage.removeItem(STORAGE_KEY);
      setSession(null);
    } catch (error) {
      console.error('Error returning to master admin session:', error);
      setReturning(false);
    }
  }, [session]);

  if (!session) return null;

  return (
    <div className="w-full z-50 bg-amber-600 text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 shadow-lg">
      <span className="text-sm font-medium text-center">
        Impersonating {session.targetName || 'user'} — return to {session.masterAdminEmail}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-white/40 text-white hover:bg-white/20"
        onClick={handleReturn}
        disabled={returning}
      >
        {returning ? 'Returning...' : 'Return to Master Admin'}
      </Button>
    </div>
  );
};

export default ImpersonationBanner;
