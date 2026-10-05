// Workload: each person's estimated hours for the next weeks against their weekly capacity,
// so over-allocation shows before it happens (lib/capacity). Admins (and heads/managers, for
// their staff) set a person's capacity here.
import React, { useEffect, useMemo, useState } from 'react';
import { Gauge } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getAssignableUsers, updateUser } from '@/services/userService';
import { capacityOf, loadLevel, unestimatedCount, weeklyLoad, WEEKS_SHOWN } from '@/lib/capacity';
import { formatDayMonth } from '@/lib/format';
import { reportError } from '@/lib/reportError';

const ORG_ADMIN = new Set(['org-admin', 'admin', 'master-admin']);
const CELL = {
  over: 'bg-destructive-soft text-destructive font-semibold',
  near: 'bg-warning-soft text-warning font-semibold',
  ok: 'text-foreground',
};
const LEVEL_WORDS = { over: 'over capacity', near: 'nearly full', ok: '' };

// Mirrors the users update rule: an org admin sets anyone below them; a head or manager their staff.
const canSetCapacity = (me, person) => {
  if (!me || !person || person.id === (me.uid || me.id)) return false;
  if (ORG_ADMIN.has(me.role)) return !ORG_ADMIN.has(person.role);
  return ['department-head', 'manager'].includes(me.role) && person.role === 'staff';
};

const CapacityInput = ({ person, onSave }) => {
  const [value, setValue] = useState(String(capacityOf(person)));
  useEffect(() => { setValue(String(capacityOf(person))); }, [person]);
  const commit = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0 || n > 168) { setValue(String(capacityOf(person))); return; }
    if (n !== capacityOf(person)) onSave(person, n);
  };
  return (
    <Input
      type="number"
      min={0}
      max={168}
      className="h-9 w-20"
      aria-label={`Weekly capacity of ${person.name || person.email}, in hours`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
};

const WorkloadPlanner = () => {
  const { currentUser } = useAuth();
  const { tasks } = useTasks();
  const { toast } = useToast();
  const [people, setPeople] = useState([]);

  useEffect(() => {
    getAssignableUsers(currentUser)
      .then((list) => setPeople(list.filter((p) => p.status !== 'inactive')))
      .catch((error) => reportError(error, { title: "Couldn't load the team" }));
  }, [currentUser]);

  const { weeks, load } = useMemo(() => weeklyLoad(tasks), [tasks]);
  const rows = useMemo(() => people
    .map((p) => ({ person: p, hours: load.get(p.id) || Array(WEEKS_SHOWN).fill(0), capacity: capacityOf(p), unestimated: unestimatedCount(tasks, p.id) }))
    .sort((a, b) => Math.max(...b.hours.map((h) => h / (b.capacity || 1))) - Math.max(...a.hours.map((h) => h / (a.capacity || 1)))), [people, load, tasks]);
  const overloaded = rows.filter((r) => r.hours.some((h) => loadLevel(h, r.capacity) === 'over')).length;

  const saveCapacity = async (person, hours) => {
    try {
      await updateUser(person.id, { weeklyCapacityHours: hours });
      setPeople((list) => list.map((p) => (p.id === person.id ? { ...p, weeklyCapacityHours: hours } : p)));
      toast({ title: `${person.name || 'Their'} capacity set to ${hours}h a week` });
    } catch (error) {
      reportError(error, { title: "Couldn't save the capacity" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" aria-hidden="true" />
          Next {WEEKS_SHOWN} weeks
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Estimated hours of open work per person and week (each task&apos;s estimate spread over its weekdays), against
          their weekly capacity. Tasks without an estimate are counted separately: the load leaves them out.
        </p>
        <p className={`text-sm font-medium ${overloaded ? 'text-destructive' : 'text-success'}`} role="status">
          {overloaded
            ? `${overloaded} ${overloaded === 1 ? 'person is' : 'people are'} over capacity in at least one week.`
            : 'Nobody is over capacity.'}
        </p>
      </CardHeader>
      <CardContent>
        <p className="mb-2 text-xs text-muted-foreground sm:hidden">Swipe sideways to see every week.</p>
        <div className="overflow-x-auto" role="region" aria-label="Workload by person and week" tabIndex={0}>
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 font-medium">Person</th>
                <th scope="col" className="py-2 pr-3 font-medium">Capacity / week</th>
                {weeks.map((w) => <th key={w.toISOString()} scope="col" className="py-2 pr-2 text-right font-medium">Week of {formatDayMonth(w)}</th>)}
                <th scope="col" className="py-2 text-right font-medium">No estimate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, hours, capacity, unestimated }) => (
                <tr key={person.id} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium text-foreground">{person.name || person.email}</th>
                  <td className="py-2 pr-3">
                    {canSetCapacity(currentUser, person)
                      ? <CapacityInput person={person} onSave={saveCapacity} />
                      : <span>{capacity}h</span>}
                  </td>
                  {hours.map((h, i) => {
                    const level = loadLevel(h, capacity);
                    return (
                      <td key={weeks[i].toISOString()} className="py-2 pr-2 text-right">
                        <span className={`inline-block min-w-[3.5rem] rounded-md px-1.5 py-0.5 font-mono ${CELL[level]}`}>
                          {h ? `${h}h` : '—'}
                          {LEVEL_WORDS[level] && <span className="sr-only">, {LEVEL_WORDS[level]} ({capacity}h)</span>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-2 text-right text-muted-foreground">{unestimated ? `${unestimated} task${unestimated === 1 ? '' : 's'}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkloadPlanner;
