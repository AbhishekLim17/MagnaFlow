// Timesheets: each person's logged time on a project, week by week (Monday to Sunday), for
// whoever runs the project to approve or reject. Approved weeks are what invoices bill.
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { CalendarClock, Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/organizationService';
import { decideSheet, listSheets, listWeekEntries } from '@/services/timesheetService';
import { runsProject } from '@/lib/taskPermissions';
import { reportError } from '@/lib/reportError';
import { formatDate, formatDayMonth, toInputDate } from '@/lib/format';
import { formatMinutes } from '@/lib/timeTracking';
import { addDaysTo, changedSinceDecision, summarizeWeek, weekDays, weekStart } from '@/lib/timesheets';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TimesheetsPage = () => {
  const { currentUser } = useAuth();
  const id = useId();
  const orgId = currentUser?.orgId;
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState('');
  const [monday, setMonday] = useState(() => weekStart(toInputDate()));
  const [rows, setRows] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [busy, setBusy] = useState(null);
  const [rejecting, setRejecting] = useState(null); // userId whose rejection note is open
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!orgId) return;
    getProjects(orgId)
      .then((all) => {
        const mine = all.filter((p) => runsProject(currentUser, p));
        setProjects(mine);
        setProjectId((cur) => cur || mine[0]?.id || '');
      })
      .catch((error) => { setProjects([]); reportError(error, { title: "Couldn't load your projects" }); });
  }, [orgId, currentUser]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setRows(null);
    try {
      const [entries, sheets] = await Promise.all([
        listWeekEntries(orgId, projectId, monday),
        listSheets(orgId, projectId, { week: monday }),
      ]);
      setRows(summarizeWeek(entries, monday));
      setDecisions(Object.fromEntries(sheets.map((s) => [s.userId, s])));
    } catch (error) {
      setRows([]);
      reportError(error, { title: "Couldn't load the timesheets" });
    }
  }, [orgId, projectId, monday]);
  useEffect(() => { load(); }, [load]);

  const decide = async (row, status) => {
    setBusy(row.userId);
    try {
      const saved = await decideSheet(orgId, projectId, row, monday, status, status === 'rejected' ? note : '', currentUser);
      setDecisions((d) => ({ ...d, [row.userId]: saved }));
      setRejecting(null);
      setNote('');
    } catch (error) {
      reportError(error, { title: status === 'approved' ? "Couldn't approve the week" : "Couldn't reject the week" });
    } finally {
      setBusy(null);
    }
  };

  const days = useMemo(() => weekDays(monday), [monday]);
  const me = currentUser?.uid;
  const isAdmin = ['org-admin', 'admin', 'master-admin'].includes(currentUser?.role);
  const thisWeek = weekStart(toInputDate());

  if (projects === null) return <LoadingState label="Loading projects…" />;
  if (!projects.length) {
    return <EmptyState icon={CalendarClock} title="No projects to approve" hint="Timesheets appear for the projects you run." />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" /> Weekly timesheets</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Approve the time your team logged. Approved weeks can be invoiced.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`${id}-project`}>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id={`${id}-project`} className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" onClick={() => setMonday((m) => addDaysTo(m, -7))} aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[150px] text-center text-sm font-semibold" aria-live="polite">
              {formatDayMonth(monday)} – {formatDate(addDaysTo(monday, 6))}
            </span>
            <Button type="button" variant="outline" size="icon" onClick={() => setMonday((m) => addDaysTo(m, 7))} aria-label="Next week" disabled={monday >= thisWeek}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rows === null ? (
          <LoadingState label="Loading the week…" rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No time logged this week" hint="Time logged on this project's tasks shows up here." />
        ) : (
          <div className="overflow-x-auto" role="region" aria-label="Timesheet table" tabIndex={0}>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-semibold">Person</th>
                  {days.map((d, i) => <th scope="col" key={d} className="px-1 py-2 text-right font-semibold">{DAY_NAMES[i]} {Number(d.slice(8))}</th>)}
                  <th scope="col" className="px-2 py-2 text-right font-semibold">Total</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Status</th>
                  <th scope="col" className="py-2 text-right font-semibold"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sheet = decisions[row.userId];
                  const changed = changedSinceDecision(row, sheet);
                  const own = row.userId === me && !isAdmin;
                  return (
                    <React.Fragment key={row.userId}>
                      <tr className="border-b border-border align-middle">
                        <th scope="row" className="py-3 pr-3 text-left font-semibold">{row.userName}</th>
                        {row.byDay.map((m, i) => (
                          <td key={days[i]} className={`px-1 py-3 text-right tabular-nums ${m ? '' : 'text-muted-foreground'}`}>{m ? formatMinutes(m) : '–'}</td>
                        ))}
                        <td className="px-2 py-3 text-right font-semibold tabular-nums">{formatMinutes(row.minutes)}</td>
                        <td className="px-2 py-3">
                          {!sheet ? <Badge variant="outline">Not reviewed</Badge>
                            : changed ? <Badge variant="warning" title={`${formatMinutes(sheet.minutes)} was ${sheet.status}`}>Changed since {sheet.status}</Badge>
                              : sheet.status === 'approved' ? <Badge variant="success">Approved</Badge>
                                : <Badge variant="destructive" title={sheet.note || undefined}>Rejected</Badge>}
                        </td>
                        <td className="py-3 text-right">
                          {own ? (
                            <span className="text-xs text-muted-foreground">Your own week</span>
                          ) : (
                            <span className="inline-flex gap-1">
                              <Button type="button" size="sm" variant="outline" disabled={busy === row.userId || (sheet?.status === 'approved' && !changed)}
                                onClick={() => decide(row, 'approved')} aria-label={`Approve ${row.userName}'s week`}>
                                <Check className="h-4 w-4" aria-hidden="true" /> Approve
                              </Button>
                              <Button type="button" size="sm" variant="ghost" disabled={busy === row.userId}
                                onClick={() => { setRejecting(row.userId); setNote(''); }} aria-label={`Reject ${row.userName}'s week`}>
                                <X className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </span>
                          )}
                        </td>
                      </tr>
                      {rejecting === row.userId && (
                        <tr className="border-b border-border">
                          <td colSpan={11} className="py-3">
                            <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); decide(row, 'rejected'); }}>
                              <div className="min-w-[240px] flex-1 space-y-1">
                                <Label htmlFor={`${id}-note-${row.userId}`}>Why is this week rejected?</Label>
                                <Input id={`${id}-note-${row.userId}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus />
                              </div>
                              <Button type="submit" size="sm" variant="destructive" disabled={busy === row.userId}>Reject week</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(null)}>Cancel</Button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimesheetsPage;
