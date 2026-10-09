// Client invoices from approved timesheets (lib/timesheets): pick a project and a period,
// set the hourly bill rate and tax, check the lines, issue it (saved, numbered, PDF).
// Org admins and the Finance role. Issued invoices are kept; they can be marked paid or void.
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Download, FileText, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import { getOrganizationById, getProjects } from '@/services/organizationService';
import { getProjectBudget } from '@/services/budgetService';
import { listInvoices, listSheets, saveInvoice, setInvoiceStatus } from '@/services/timesheetService';
import { downloadInvoicePdf } from '@/lib/invoicePdf';
import { invoiceLines, invoiceTotals, nextInvoiceNumber, weekStart } from '@/lib/timesheets';
import { formatDate, toInputDate } from '@/lib/format';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/money';
import { reportError } from '@/lib/reportError';

const STATUS_BADGE = { issued: 'secondary', paid: 'success', void: 'outline' };
const firstOfMonth = () => toInputDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

const InvoicesPage = () => {
  const { currentUser } = useAuth();
  const confirm = useConfirm();
  const id = useId();
  const orgId = currentUser?.orgId;
  const [invoices, setInvoices] = useState(null);
  const [projects, setProjects] = useState([]);
  const [orgName, setOrgName] = useState('');
  const [draft, setDraft] = useState(null); // the form, while making one
  const [preview, setPreview] = useState(null); // { lines, currency, projectName }
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [list, projs, org] = await Promise.all([listInvoices(orgId), getProjects(orgId), getOrganizationById(orgId).catch(() => null)]);
      setInvoices(list);
      setProjects(projs);
      setOrgName(org?.name || '');
    } catch (error) {
      setInvoices([]);
      reportError(error, { title: "Couldn't load invoices" });
    }
  }, [orgId]);
  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setDraft({ projectId: projects[0]?.id || '', from: firstOfMonth(), to: toInputDate(), clientName: '', rate: '', taxPercent: '18', notes: '' });
    setPreview(null);
  };
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setPreview(null); };

  const buildPreview = async (e) => {
    e.preventDefault();
    setWorking(true);
    try {
      const [sheets, budget] = await Promise.all([
        listSheets(orgId, draft.projectId, { from: weekStart(draft.from), to: draft.to }),
        getProjectBudget(orgId, draft.projectId).catch(() => null),
      ]);
      setPreview({
        lines: invoiceLines(sheets, () => Number(draft.rate) || 0),
        currency: budget?.currency || DEFAULT_CURRENCY,
        projectName: projects.find((p) => p.id === draft.projectId)?.name || '',
      });
    } catch (error) {
      reportError(error, { title: "Couldn't read the approved timesheets" });
    } finally {
      setWorking(false);
    }
  };

  const totals = useMemo(() => (preview ? invoiceTotals(preview.lines, draft?.taxPercent) : null), [preview, draft?.taxPercent]);

  const issue = async () => {
    setWorking(true);
    try {
      const invoice = {
        // ponytail: numbered from the loaded list; two people issuing at the same moment could
        // collide. A counter document in a transaction fixes that if it ever matters.
        number: nextInvoiceNumber((invoices || []).map((i) => i.number)),
        projectId: draft.projectId,
        projectName: preview.projectName,
        clientName: draft.clientName.trim().slice(0, 200),
        from: draft.from,
        to: draft.to,
        currency: preview.currency,
        lines: preview.lines.map(({ userId, description, hours, rate, amount }) => ({ userId, description, hours, rate, amount })),
        taxPercent: Number(draft.taxPercent) || 0,
        ...totals,
        notes: draft.notes.trim().slice(0, 2000),
      };
      const saved = await saveInvoice(orgId, invoice, currentUser);
      setInvoices((list) => [saved, ...(list || [])]);
      setDraft(null);
      setPreview(null);
      await downloadInvoicePdf({ ...saved, issuedOn: new Date() }, { orgName });
    } catch (error) {
      reportError(error, { title: "Couldn't issue the invoice" });
    } finally {
      setWorking(false);
    }
  };

  const changeStatus = async (inv, status) => {
    if (status === 'void' && !(await confirm({ title: `Void ${inv.number}?`, description: 'It stays on record, marked void.', confirmLabel: 'Void', destructive: true }))) return;
    try {
      await setInvoiceStatus(orgId, inv.id, status);
      setInvoices((list) => list.map((i) => (i.id === inv.id ? { ...i, status } : i)));
    } catch (error) {
      reportError(error, { title: "Couldn't change the invoice" });
    }
  };

  if (invoices === null) return <LoadingState label="Loading invoices…" />;

  return (
    <div className="space-y-6">
      {draft ? (
        <Card>
          <CardHeader><CardTitle>New invoice</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={buildPreview} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor={`${id}-project`}>Project</Label>
                <Select value={draft.projectId} onValueChange={(projectId) => set({ projectId })}>
                  <SelectTrigger id={`${id}-project`}><SelectValue placeholder="Choose a project" /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-from`}>Work from</Label>
                <Input id={`${id}-from`} type="date" value={draft.from} onChange={(e) => set({ from: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-to`}>Work to</Label>
                <Input id={`${id}-to`} type="date" value={draft.to} min={draft.from} onChange={(e) => set({ to: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-client`}>Bill to (client)</Label>
                <Input id={`${id}-client`} value={draft.clientName} onChange={(e) => set({ clientName: e.target.value })} maxLength={200} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-rate`}>Bill rate per hour</Label>
                <Input id={`${id}-rate`} type="number" min="0" step="0.01" value={draft.rate} onChange={(e) => set({ rate: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-tax`}>Tax (GST) %</Label>
                <Input id={`${id}-tax`} type="number" min="0" max="100" step="0.01" value={draft.taxPercent} onChange={(e) => set({ taxPercent: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <Label htmlFor={`${id}-notes`}>Notes on the invoice (payment terms, bank details)</Label>
                <Textarea id={`${id}-notes`} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} rows={2} />
              </div>
              <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={working || !draft.projectId}>Show the lines</Button>
                <Button type="button" variant="ghost" onClick={() => { setDraft(null); setPreview(null); }}>Cancel</Button>
              </div>
            </form>

            {preview && (
              <div className="mt-6 space-y-3" aria-live="polite">
                {preview.lines.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approved timesheets in this period. Approve the weeks under Timesheets first.</p>
                ) : (
                  <>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="py-2">Person</th><th scope="col" className="py-2 text-right">Hours</th>
                        <th scope="col" className="py-2 text-right">Rate</th><th scope="col" className="py-2 text-right">Amount</th>
                      </tr></thead>
                      <tbody>
                        {preview.lines.map((l) => (
                          <tr key={l.userId} className="border-b border-border">
                            <th scope="row" className="py-2 text-left font-medium">{l.description}</th>
                            <td className="py-2 text-right tabular-nums">{l.hours.toFixed(2)}</td>
                            <td className="py-2 text-right tabular-nums">{formatMoney(l.rate, preview.currency)}</td>
                            <td className="py-2 text-right tabular-nums">{formatMoney(l.amount, preview.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
                      <dt className="text-muted-foreground">Subtotal</dt><dd className="text-right tabular-nums">{formatMoney(totals.subtotal, preview.currency)}</dd>
                      <dt className="text-muted-foreground">Tax ({Number(draft.taxPercent) || 0}%)</dt><dd className="text-right tabular-nums">{formatMoney(totals.tax, preview.currency)}</dd>
                      <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums">{formatMoney(totals.total, preview.currency)}</dd>
                    </dl>
                    <Button type="button" onClick={issue} disabled={working || !draft.clientName.trim() || !totals.total}>
                      <FileText className="h-4 w-4" aria-hidden="true" /> Issue invoice and download PDF
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button type="button" onClick={startNew} disabled={!projects.length}><Plus className="h-4 w-4" aria-hidden="true" /> New invoice</Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" hint="Bill a client for the approved hours on their project." />
          ) : (
            <ul className="divide-y divide-border">
              {invoices.map((inv) => (
                <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{inv.number} · {inv.clientName}</h3>
                    <p className="text-xs text-muted-foreground">{inv.projectName} · {formatDate(inv.from)} to {formatDate(inv.to)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{formatMoney(inv.total, inv.currency)}</span>
                    <Badge variant={STATUS_BADGE[inv.status] || 'outline'}>{inv.status === 'issued' ? 'Unpaid' : inv.status === 'paid' ? 'Paid' : 'Void'}</Badge>
                    <Button type="button" size="sm" variant="outline" aria-label={`Download ${inv.number}`}
                      onClick={() => downloadInvoicePdf({ ...inv, issuedOn: inv.createdAt?.toDate?.() || inv.createdAt }, { orgName })}>
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    {inv.status === 'issued' && (
                      <>
                        <Button type="button" size="sm" variant="outline" onClick={() => changeStatus(inv, 'paid')}>Mark paid</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => changeStatus(inv, 'void')}>Void</Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoicesPage;
