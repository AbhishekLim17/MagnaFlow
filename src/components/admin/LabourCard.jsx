// Logged time on a project as labour cost: hours against the estimate, and what each person's
// time cost at their rate. Org admins set the cost rates here (a default and per person).
import React, { useId, useState } from 'react';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatMinutes } from '@/lib/timeTracking';
import { formatMoney } from '@/lib/money';

const LabourCard = ({ labour, rates, currency, estimateHours, canEditRates, onSaveRates }) => {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft({
      defaultRate: rates.defaultRate || '',
      people: Object.fromEntries(labour.byPerson.map((p) => [p.userId, rates.people?.[p.userId] ?? ''])),
    });
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveRates({ defaultRate: draft.defaultRate, people: { ...rates.people, ...draft.people } });
      setEditing(false);
    } catch {
      // the caller has already said what went wrong; keep the form open
    } finally {
      setSaving(false);
    }
  };

  const estimateMin = estimateHours > 0 ? estimateHours * 60 : null;

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden="true" />
            Logged time
          </h2>
          <p className="mt-1 text-sm text-foreground">
            {formatMinutes(labour.minutes)} logged{estimateMin ? ` of ${formatMinutes(estimateMin)} estimated` : ''}
            {' · '}labour {formatMoney(labour.cost, currency)} (counted in Spent)
          </p>
        </div>
        {canEditRates && !editing && (
          <Button type="button" variant="outline" size="sm" onClick={startEditing}>Cost rates</Button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-border p-4" noValidate>
          <p className="text-xs text-muted-foreground">Cost per hour, in the project&apos;s currency. Only admins, department heads and managers see rates.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${id}-default`}>Default rate</Label>
              <Input id={`${id}-default`} type="number" min={0} step="any" className="mt-1" value={draft.defaultRate}
                onChange={(e) => setDraft((d) => ({ ...d, defaultRate: e.target.value }))} />
            </div>
            {labour.byPerson.map((p) => (
              <div key={p.userId}>
                <Label htmlFor={`${id}-${p.userId}`}>{p.userName}</Label>
                <Input id={`${id}-${p.userId}`} type="number" min={0} step="any" className="mt-1" placeholder="Default" value={draft.people[p.userId]}
                  onChange={(e) => setDraft((d) => ({ ...d, people: { ...d.people, [p.userId]: e.target.value } }))} />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving…' : 'Save rates'}</Button>
          </div>
        </form>
      )}

      {labour.byPerson.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has logged time on this project yet (task details → Time).</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Person</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Time</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Rate / h</th>
                <th scope="col" className="py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {labour.byPerson.map((p) => (
                <tr key={p.userId} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3">{p.userName}</td>
                  <td className="py-2 pr-3 text-right font-mono">{formatMinutes(p.minutes)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{p.rate ? formatMoney(p.rate, currency) : '—'}</td>
                  <td className="py-2 text-right font-mono">{formatMoney(p.cost, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {labour.byPerson.some((p) => !p.rate) && (
            <p className="mt-2 text-xs text-warning">Time without a rate counts as nothing. {canEditRates ? 'Set the rates above.' : 'Ask an org admin to set the rates.'}</p>
          )}
        </div>
      )}
    </Card>
  );
};

export default LabourCard;
