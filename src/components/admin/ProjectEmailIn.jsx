// A project's email-to-task address (services/inboundService): turn it on, copy it, turn it off.
// Hidden unless the build names the app's mailbox (VITE_INBOUND_MAILBOX).
import React, { useState } from 'react';
import { Copy, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { disableInbound, enableInbound, INBOUND_MAILBOX, inboundAddress } from '@/services/inboundService';
import { reportError } from '@/lib/reportError';

const ProjectEmailIn = ({ project, orgId, currentUser, onChange }) => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  if (!INBOUND_MAILBOX) return null;
  const address = inboundAddress(project.inboxKey);

  const run = async (work, failTitle) => {
    setBusy(true);
    try { await work(); } catch (error) { reportError(error, { title: failTitle }); } finally { setBusy(false); }
  };

  if (!address) {
    return (
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy}
        onClick={() => run(async () => onChange(await enableInbound(orgId, project.id, currentUser)), "Couldn't turn on email-in")}>
        <Mail className="h-3.5 w-3.5" aria-hidden="true" /> Turn on email-in
      </Button>
    );
  }
  return (
    <div className="mt-1 space-y-1">
      <p className="break-all text-xs text-muted-foreground">
        Email tasks to <span className="font-mono text-foreground">{address}</span>
      </p>
      <div className="flex gap-1">
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" aria-label={`Copy the email address of ${project.name}`}
          onClick={() => navigator.clipboard?.writeText(address).then(() => toast({ title: 'Address copied' }), () => {})}>
          <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={busy}
          onClick={() => run(async () => { await disableInbound(orgId, project.id, project.inboxKey); onChange(null); }, "Couldn't turn off email-in")}>
          Turn off
        </Button>
      </div>
    </div>
  );
};

export default ProjectEmailIn;
