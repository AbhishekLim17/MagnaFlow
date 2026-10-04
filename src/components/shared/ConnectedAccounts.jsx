// Connect a Google or Microsoft account to your MagnaFlow login, so you can sign in with
// it next time; or disconnect it. Shown in the password dialog when VITE_SIGNIN_PROVIDERS
// switches providers on. A method can only be disconnected while another way in remains.

import React, { useState } from 'react';
import { linkWithPopup, unlink } from 'firebase/auth';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import ProviderIcon from '@/components/shared/ProviderIcon';
import { auth } from '@/config/firebase';
import { makeProvider } from '@/services/authProviderService';
import { canDisconnect, configuredProviders, providerErrorMessage } from '@/lib/signInProviders';
import { reportError } from '@/lib/reportError';

const linkedIds = () => (auth.currentUser?.providerData || []).map((p) => p.providerId);
const linkedEmail = (providerId) =>
  (auth.currentUser?.providerData || []).find((p) => p.providerId === providerId)?.email || '';

const ConnectedAccountsList = ({ providers }) => {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [ids, setIds] = useState(linkedIds);
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');

  const fail = (error, label, title) => {
    const said = providerErrorMessage(error?.code, label);
    if (said === '') return; // they closed the window
    if (said) setProblem(said);
    else reportError(error, { title });
  };

  const connect = async (p) => {
    setBusy(p.key);
    setProblem('');
    try {
      await linkWithPopup(auth.currentUser, makeProvider(p.key));
      await auth.currentUser.reload().catch(() => {});
      setIds(linkedIds());
      toast({ title: `${p.label} connected`, description: `Next time you can sign in with ${p.label}.` });
    } catch (error) {
      fail(error, p.label, `Couldn't connect ${p.label}`);
    } finally {
      setBusy('');
    }
  };

  const disconnect = async (p) => {
    const ok = await confirm({
      title: `Disconnect ${p.label}?`,
      description: `You won't be able to sign in with ${p.label} until you connect it again.`,
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    setBusy(p.key);
    setProblem('');
    try {
      await unlink(auth.currentUser, p.id);
      setIds(linkedIds());
      toast({ title: `${p.label} disconnected` });
    } catch (error) {
      fail(error, p.label, `Couldn't disconnect ${p.label}`);
    } finally {
      setBusy('');
    }
  };

  return (
    <section aria-labelledby="connected-accounts-heading" className="space-y-3 border-t border-border pt-5">
      <div>
        <h3 id="connected-accounts-heading" className="font-semibold text-foreground">Connected accounts</h3>
        <p className="text-sm text-muted-foreground">Sign in with one of these instead of typing your password.</p>
      </div>
      <ul className="space-y-2">
        {providers.map((p) => {
          const connected = ids.includes(p.id);
          const email = connected ? linkedEmail(p.id) : '';
          return (
            <li key={p.key} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <div className="flex min-w-0 items-center gap-3">
                <ProviderIcon provider={p.key} className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {connected ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                        Connected{email ? ` as ${email}` : ''}
                      </span>
                    ) : 'Not connected'}
                  </p>
                </div>
              </div>
              {connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(busy) || !canDisconnect(ids, p.id)}
                  title={canDisconnect(ids, p.id) ? undefined : 'Your only way to sign in'}
                  onClick={() => disconnect(p)}
                  aria-label={`Disconnect ${p.label}`}
                >
                  {busy === p.key ? 'Working…' : 'Disconnect'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(busy)}
                  onClick={() => connect(p)}
                  aria-label={`Connect ${p.label}`}
                >
                  {busy === p.key ? 'Connecting…' : 'Connect'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {problem && <p className="text-sm text-destructive" role="alert">{problem}</p>}
    </section>
  );
};

const ConnectedAccounts = ({ providers = configuredProviders() }) =>
  (providers.length ? <ConnectedAccountsList providers={providers} /> : null);

export default ConnectedAccounts;
