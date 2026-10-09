// Leave and public holidays (lib/leave). Everyone records their own leave; heads and managers
// record it for their staff, org admins for anyone, and org admins keep the holiday list.
// Workload counts both: a day away takes a fifth off that week's capacity.
import React, { useCallback, useEffect, useId, useState } from 'react';
import { CalendarOff, Palmtree, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FieldError from '@/components/shared/FieldError';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useAuth } from '@/contexts/AuthContext';
import { getAssignableUsers } from '@/services/userService';
import { addLeave, deleteLeave, getHolidays, listLeave, saveHolidays } from '@/services/leaveService';
import { leaveProblem, upcomingLeave, workingDaysBetween } from '@/lib/leave';
import { formatDate, toInputDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const ORG_ADMIN = new Set(['org-admin', 'admin']);
const LEADS = new Set(['org-admin', 'admin', 'department-head', 'manager']);

const LeavePage = () => {
  const { currentUser } = useAuth();
  const id = useId();
  const orgId = currentUser?.orgId;
  const me = currentUser?.uid;
  const isAdmin = ORG_ADMIN.has(currentUser?.role);
  const today = toInputDate();
  const [holidays, setHolidays] = useState(null);
  const [leave, setLeave] = useState(null);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ personId: me, from: today, to: today, note: '' });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [holidayDraft, setHolidayDraft] = useState({ date: '', name: '' });

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [h, l] = await Promise.all([getHolidays(orgId), listLeave(orgId, today)]);
      setHolidays(h);
      setLeave(l);
    } catch (e) {
      setHolidays([]); setLeave([]);
      reportError(e, { title: "Couldn't load leave and holidays" });
    }
  }, [orgId, today]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!LEADS.has(currentUser?.role)) return;
    getAssignableUsers(currentUser).then(setPeople).catch(() => setPeople([]));
  }, [currentUser]);

  const submitLeave = async (e) => {
    e.preventDefault();
    const problem = leaveProblem(form.from, form.to);
    setError(problem);
    if (problem) return;
    setSaving(true);
    try {
      const person = people.find((p) => p.id === form.personId) || { id: me, name: currentUser.name, email: currentUser.email };
      const saved = await addLeave(orgId, { person, from: form.from, to: form.to, note: form.note }, currentUser);
      setLeave((list) => [...(list || []), saved]);
      setForm((f) => ({ ...f, note: '' }));
    } catch (err) {
      reportError(err, { title: "Couldn't save the leave" });
    } finally {
      setSaving(false);
    }
  };

  const removeLeave = async (l) => {
    try {
      await deleteLeave(orgId, l.id);
      setLeave((list) => list.filter((x) => x.id !== l.id));
    } catch (err) {
      reportError(err, { title: "Couldn't remove the leave" });
    }
  };

  const storeHolidays = async (days) => {
    try {
      setHolidays(await saveHolidays(orgId, days));
    } catch (err) {
      reportError(err, { title: "Couldn't save the holidays" });
    }
  };

  if (holidays === null || leave === null) return <LoadingState label="Loading leave and holidays…" />;
  const upcoming = upcomingLeave(leave, today);
  const futureHolidays = holidays.filter((h) => h.date >= today);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Palmtree className="h-5 w-5 text-primary" aria-hidden="true" /> Leave</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={submitLeave} className="grid gap-3 sm:grid-cols-2" noValidate>
            {people.length > 1 && (
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor={`${id}-person`}>Who is away</Label>
                <Select value={form.personId} onValueChange={(personId) => setForm((f) => ({ ...f, personId }))}>
                  <SelectTrigger id={`${id}-person`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.id === me ? `${p.name || p.email} (you)` : (p.name || p.email)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor={`${id}-from`}>First day</Label>
              <Input id={`${id}-from`} type="date" value={form.from} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
                onChange={(e) => setForm((f) => ({ ...f, from: e.target.value, to: f.to < e.target.value ? e.target.value : f.to }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-to`}>Last day</Label>
              <Input id={`${id}-to`} type="date" value={form.to} min={form.from} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
                onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`${id}-note`}>Note <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Input id={`${id}-note`} value={form.note} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <FieldError id={`${id}-err`}>{error}</FieldError>
              <Button type="submit" disabled={saving}>Add leave</Button>
              {!error && leaveProblem(form.from, form.to) === null && (
                <span className="ml-3 text-sm text-muted-foreground">
                  {workingDaysBetween(form.from, form.to, holidays)} working day{workingDaysBetween(form.from, form.to, holidays) === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </form>

          <section aria-labelledby={`${id}-upcoming`}>
            <h3 id={`${id}-upcoming`} className="mb-2 text-sm font-semibold">Who is away</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody has leave coming up.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.userName}{l.userId === me ? ' (you)' : ''}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.from === l.to ? formatDate(l.from) : `${formatDate(l.from)} to ${formatDate(l.to)}`}
                        {' · '}{workingDaysBetween(l.from, l.to, holidays)} working day{workingDaysBetween(l.from, l.to, holidays) === 1 ? '' : 's'}
                        {l.note ? ` · ${l.note}` : ''}
                      </p>
                    </div>
                    {(l.userId === me || l.createdBy === me || isAdmin) && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${l.userName}'s leave from ${formatDate(l.from)}`} onClick={() => removeLeave(l)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarOff className="h-5 w-5 text-primary" aria-hidden="true" /> Public holidays</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {isAdmin && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!holidayDraft.date) return;
                storeHolidays([...holidays, holidayDraft]);
                setHolidayDraft({ date: '', name: '' });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor={`${id}-hdate`}>Date</Label>
                <Input id={`${id}-hdate`} type="date" value={holidayDraft.date} onChange={(e) => setHolidayDraft((h) => ({ ...h, date: e.target.value }))} />
              </div>
              <div className="min-w-[160px] flex-1 space-y-1">
                <Label htmlFor={`${id}-hname`}>Name</Label>
                <Input id={`${id}-hname`} value={holidayDraft.name} maxLength={80} placeholder="Diwali" onChange={(e) => setHolidayDraft((h) => ({ ...h, name: e.target.value }))} />
              </div>
              <Button type="submit" variant="outline" disabled={!holidayDraft.date}>Add holiday</Button>
            </form>
          )}
          {futureHolidays.length === 0 ? (
            <EmptyState icon={CalendarOff} title="No holidays coming up" hint={isAdmin ? 'Add the days your organisation is closed.' : 'Your admin adds the days the organisation is closed.'} />
          ) : (
            <ul className="divide-y divide-border">
              {futureHolidays.map((h) => (
                <li key={h.date} className="flex items-center justify-between gap-3 py-2">
                  <p className="text-sm"><span className="font-medium">{h.name}</span> <span className="text-muted-foreground">· {formatDate(h.date)}</span></p>
                  {isAdmin && (
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remove the holiday ${h.name}`} onClick={() => storeHolidays(holidays.filter((x) => x.date !== h.date))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeavePage;
