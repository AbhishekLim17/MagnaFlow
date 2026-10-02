// Shown instead of the login page when someone IS signed in but the app could not load
// their profile. Previously any failure there (a Wi-Fi blip during a refresh, say) fell
// through to the login page, which looked like being logged out for no reason, and then
// failed again because the network was still down.
import React, { useEffect, useRef } from 'react';
import { WifiOff, AlertTriangle, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Brandmark from '@/components/shared/Brandmark';
import { useAuth } from '@/contexts/AuthContext';

const COPY = {
  unreachable: {
    icon: WifiOff,
    title: "Can't reach MagnaFlow",
    body: 'Your connection seems to be down, or our servers are busy. You are still signed in; nothing was lost. We will keep trying, or you can try again now.',
  },
  'no-profile': {
    icon: UserX,
    title: "We can't find your profile",
    body: 'You are signed in, but there is no MagnaFlow profile for this account. If you were recently removed from your organization, this is expected. Otherwise, ask your administrator.',
  },
  failed: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    body: 'We could not load your account. Try again, and if it keeps happening, sign out and back in or contact your administrator.',
  },
};

const RETRY_EVERY_MS = 10000;

const SessionProblem = () => {
  const { sessionProblem, retrySession, logout } = useAuth();
  const kind = sessionProblem?.kind || 'failed';
  const copy = COPY[kind] || COPY.failed;
  const Icon = copy.icon;
  const retryRef = useRef(retrySession);
  retryRef.current = retrySession;

  // A dropped connection usually comes back by itself: retry when the browser says
  // it is online again, and every few seconds meanwhile.
  useEffect(() => {
    if (kind !== 'unreachable') return undefined;
    const retry = () => retryRef.current();
    window.addEventListener('online', retry);
    const timer = setInterval(retry, RETRY_EVERY_MS);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(timer);
    };
  }, [kind]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[440px] text-center">
        <Brandmark className="mx-auto h-14 w-14" />
        <Card className="mt-8 p-6 sm:p-8" role="alert">
          <Icon className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-bold tracking-tight">{copy.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
          {sessionProblem?.message && kind === 'failed' && (
            <p className="mt-2 text-xs text-muted-foreground">{sessionProblem.message}</p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {kind !== 'no-profile' && (
              <Button onClick={() => retrySession()}>Try again</Button>
            )}
            <Button variant="outline" onClick={logout}>Sign out</Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SessionProblem;
