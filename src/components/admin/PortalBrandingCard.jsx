// Org admins: how the client portal looks. Logo, accent colour and a welcome note, with a
// preview of the portal's top bar exactly as clients will see it.
import React, { useEffect, useRef, useState } from 'react';
import { Palette, Upload, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import FieldError from '@/components/shared/FieldError';
import PortalBrandBar from '@/components/shared/PortalBrandBar';
import { getBranding, saveBranding } from '@/services/brandingService';
import { getOrganizationById } from '@/services/organizationService';
import { EMPTY_BRANDING, MAX_LOGO_CHARS, MAX_WELCOME, logoProblem, normalizeHex } from '@/lib/branding';
import { shrinkImageToDataUrl } from '@/lib/imageResize';
import { reportError } from '@/lib/reportError';

const PortalBrandingCard = ({ orgId }) => {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [orgName, setOrgName] = useState('');
  const [form, setForm] = useState({ ...EMPTY_BRANDING, accentText: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!orgId) return undefined;
    let cancelled = false;
    Promise.all([getBranding(orgId), getOrganizationById(orgId).catch(() => null)]).then(([b, org]) => {
      if (cancelled) return;
      setForm({ ...b, accentText: b.accent || '' });
      setOrgName(org?.name || '');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgId]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const clearError = (key) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    clearError('logo');
    try {
      const dataUrl = await shrinkImageToDataUrl(file, { maxSize: 256, maxChars: MAX_LOGO_CHARS });
      const problem = logoProblem(dataUrl);
      if (problem) setErrors((x) => ({ ...x, logo: problem }));
      else set({ logo: dataUrl });
    } catch (error) {
      setErrors((x) => ({ ...x, logo: error.message }));
    }
  };

  const setAccentText = (value) => {
    clearError('accent');
    const hex = normalizeHex(value);
    set({ accentText: value, ...(hex ? { accent: hex } : {}), ...(value.trim() === '' ? { accent: null } : {}) });
  };

  const save = async () => {
    const accent = form.accentText.trim() ? normalizeHex(form.accentText) : null;
    if (form.accentText.trim() && !accent) {
      setErrors((x) => ({ ...x, accent: 'Use a hex colour such as #1d4ed8.' }));
      return;
    }
    setSaving(true);
    try {
      const saved = await saveBranding(orgId, { accent, logo: form.logo, welcome: form.welcome });
      setForm({ ...saved, accentText: saved.accent || '' });
      toast({ title: 'Portal branding saved', description: 'Clients see it the next time they open the portal.' });
    } catch (error) {
      reportError(error, { title: "Couldn't save the portal branding" });
    } finally {
      setSaving(false);
    }
  };

  const preview = { accent: normalizeHex(form.accentText), logo: form.logo };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" aria-hidden="true" />
          Portal branding
        </CardTitle>
        <p className="text-sm text-muted-foreground">Your logo, colour and a welcome note on the client portal.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground" id="brand-preview-label">Preview</p>
          <div className="overflow-hidden rounded-xl border border-border" role="img" aria-labelledby="brand-preview-label" aria-describedby="brand-preview-desc">
            <PortalBrandBar branding={preview} orgName={orgName} />
            {form.welcome.trim() && <p className="bg-background px-4 py-3 text-sm text-foreground sm:px-6">{form.welcome.trim()}</p>}
          </div>
          <p id="brand-preview-desc" className="sr-only">How the top of the client portal will look.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="brand-logo">Logo</Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                id="brand-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="sr-only"
                onChange={pickLogo}
                aria-describedby={errors.logo ? 'brand-logo-error' : 'brand-logo-hint'}
                aria-invalid={errors.logo ? true : undefined}
              />
              <Button type="button" variant="outline" size="sm" disabled={loading || saving} onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {form.logo ? 'Replace logo' : 'Upload logo'}
              </Button>
              {form.logo && (
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => set({ logo: null })}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Remove
                </Button>
              )}
            </div>
            <p id="brand-logo-hint" className="mt-1 text-xs text-muted-foreground">PNG, JPG, WebP or SVG. It is resized to fit.</p>
            <FieldError id="brand-logo-error">{errors.logo}</FieldError>
          </div>

          <div>
            <Label htmlFor="brand-accent">Accent colour</Label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick the accent colour"
                className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                value={normalizeHex(form.accentText) || '#4f46e5'}
                onChange={(e) => setAccentText(e.target.value)}
                disabled={loading || saving}
              />
              <Input
                id="brand-accent"
                value={form.accentText}
                onChange={(e) => setAccentText(e.target.value)}
                placeholder="Default"
                disabled={loading || saving}
                aria-describedby={errors.accent ? 'brand-accent-error' : 'brand-accent-hint'}
                aria-invalid={errors.accent ? true : undefined}
              />
            </div>
            <p id="brand-accent-hint" className="mt-1 text-xs text-muted-foreground">Leave empty for the standard look. Text on it is picked to stay readable.</p>
            <FieldError id="brand-accent-error">{errors.accent}</FieldError>
          </div>
        </div>

        <div>
          <Label htmlFor="brand-welcome">Welcome note</Label>
          <Textarea
            id="brand-welcome"
            className="mt-1"
            rows={3}
            maxLength={MAX_WELCOME}
            value={form.welcome}
            onChange={(e) => set({ welcome: e.target.value })}
            placeholder="For example: Welcome! Here is where your projects stand. Questions? Write to us on any task."
            disabled={loading || saving}
            aria-describedby="brand-welcome-count"
          />
          <p id="brand-welcome-count" className="mt-1 text-xs text-muted-foreground">{form.welcome.length} / {MAX_WELCOME}</p>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={loading || saving}>{saving ? 'Saving…' : 'Save branding'}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PortalBrandingCard;
