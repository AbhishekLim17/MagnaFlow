// Which emails someone gets. One switch per kind of email (lib/notificationPrefs); the mail
// jobs read the same settings, so turning one off stops it at the source. In-app
// notifications (the bell) are not affected.

import React, { useEffect, useId, useState } from 'react';
import { Mail } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getUserById, updateUser } from '@/services/userService';
import { EMAIL_PREFS, withDefaults } from '@/lib/notificationPrefs';
import { reportError } from '@/lib/reportError';

const NotificationSettingsDialog = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const uid = user?.uid || user?.id;
  const baseId = useId();
  const [prefs, setPrefs] = useState(() => withDefaults(user?.notificationPrefs));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // The session's copy of the profile is from sign-in; read the saved settings afresh.
  useEffect(() => {
    if (!open || !uid) return undefined;
    let cancelled = false;
    setLoading(true);
    getUserById(uid)
      .then((fresh) => { if (!cancelled) setPrefs(withDefaults(fresh?.notificationPrefs)); })
      .catch(() => { /* keep what the session had */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, uid]);

  const allOff = EMAIL_PREFS.every(({ key }) => !prefs[key]);

  const save = async () => {
    setSaving(true);
    try {
      await updateUser(uid, { notificationPrefs: prefs });
      toast({ title: 'Email settings saved' });
      onOpenChange(false);
    } catch (error) {
      reportError(error, { title: "Couldn't save your email settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            Email settings
          </DialogTitle>
          <DialogDescription>
            Choose what we email you about. Everything still shows up in the app.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2" disabled={loading || saving} aria-busy={loading}>
          <legend className="sr-only">Email me when</legend>
          {EMAIL_PREFS.map(({ key, label, help }) => {
            const helpId = help ? `${baseId}-${key}-help` : undefined;
            return (
              <label
                key={key}
                className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm has-[:disabled]:cursor-default"
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                  checked={prefs[key]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [key]: e.target.checked }))}
                  aria-describedby={helpId}
                />
                <span>
                  <span className="font-medium text-foreground">{label}</span>
                  {help && <span id={helpId} className="block text-xs text-muted-foreground">{help}</span>}
                </span>
              </label>
            );
          })}
        </fieldset>

        {allOff && (
          <p className="text-sm text-muted-foreground" role="status">
            You will get no email from MagnaFlow. Keep an eye on the bell instead.
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={save} disabled={loading || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
