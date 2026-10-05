// Time on a task: how much was logged (against its estimate), by whom, and a form to log your
// own. Entries feed the project's labour cost in the Budget Tracker.
import React, { useEffect, useId, useState } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import FieldError from '@/components/shared/FieldError';
import { useAuth } from '@/contexts/AuthContext';
import { deleteTimeEntry, listTaskEntries, logTime } from '@/services/timeService';
import { durationProblem, formatMinutes, MAX_NOTE, parseDuration } from '@/lib/timeTracking';
import { formatDate, toInputDate } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const TaskTime = ({ task }) => {
  const id = useId();
  const { currentUser } = useAuth();
  const me = currentUser?.uid || currentUser?.id;
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ time: '', date: toInputDate(), note: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTaskEntries(task.id)
      .then((list) => { if (!cancelled) setEntries(list); })
      .catch((err) => reportError(err, { title: "Couldn't load the time logged", silent: true }));
    return () => { cancelled = true; };
  }, [task.id]);

  const total = entries.reduce((n, e) => n + (Number(e.minutes) || 0), 0);
  const estimateMin = Number(task.estimateHours) > 0 ? Number(task.estimateHours) * 60 : null;

  const submit = async (e) => {
    e.preventDefault();
    const minutes = parseDuration(form.time);
    const problem = durationProblem(minutes);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      const entry = await logTime({ task, author: currentUser, minutes, date: form.date || toInputDate(), note: form.note });
      setEntries((list) => [entry, ...list]);
      setForm({ time: '', date: form.date, note: '' });
      setError('');
    } catch (err) {
      reportError(err, { title: "Couldn't log the time" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry) => {
    try {
      await deleteTimeEntry(entry.id);
      setEntries((list) => list.filter((x) => x.id !== entry.id));
    } catch (err) {
      reportError(err, { title: "Couldn't remove the entry" });
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={`${id}-heading`} className="flex items-center gap-2 font-semibold text-foreground">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          Time
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatMinutes(total)} logged{estimateMin ? ` of ${formatMinutes(estimateMin)} estimated` : ''}
          {estimateMin && total > estimateMin && <span className="font-medium text-warning"> · over the estimate</span>}
        </p>
      </div>
      {estimateMin && (
        <div className="h-1.5 w-full rounded-full bg-muted" role="progressbar" aria-label="Time logged against the estimate"
          aria-valuenow={Math.round((total / estimateMin) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-1.5 rounded-full ${total > estimateMin ? 'bg-warning' : 'bg-primary'}`} style={{ width: `${Math.min(100, (total / estimateMin) * 100)}%` }} />
        </div>
      )}

      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[7rem_10rem_1fr_auto] sm:items-end" noValidate>
        <div>
          <label htmlFor={`${id}-time`} className="text-xs font-medium text-foreground">Time spent</label>
          <Input id={`${id}-time`} className="mt-1" placeholder="1.5 or 1:30" value={form.time}
            onChange={(e) => { setForm((f) => ({ ...f, time: e.target.value })); setError(''); }}
            aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
        </div>
        <div>
          <label htmlFor={`${id}-date`} className="text-xs font-medium text-foreground">Day</label>
          <Input id={`${id}-date`} type="date" className="mt-1" max={toInputDate()} value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label htmlFor={`${id}-note`} className="text-xs font-medium text-foreground">Note (optional)</label>
          <Input id={`${id}-note`} className="mt-1" maxLength={MAX_NOTE} value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'Logging…' : 'Log time'}</Button>
      </form>
      <FieldError id={`${id}-error`}>{error}</FieldError>

      {entries.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border text-sm" aria-label="Time logged">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="font-medium text-foreground">{formatMinutes(e.minutes)}</span>
                <span className="text-muted-foreground"> · {e.userName || 'Someone'} · {formatDate(e.date)}</span>
                {e.note && <span className="block truncate text-xs text-muted-foreground">{e.note}</span>}
              </span>
              {e.userId === me && (
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Remove ${formatMinutes(e.minutes)} on ${formatDate(e.date)}`} onClick={() => remove(e)}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default TaskTime;
