// The org admin's Activity log: who added, removed or changed people, departments, projects
// and budgets, newest first. Read-only; entries are append-only in the rules.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, History, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getOrgAuditLogs } from '@/services/auditService';
import { getAllUsers } from '@/services/userService';
import { AUDIT_CATEGORIES, describeAuditEntry } from '@/lib/auditLog';
import { formatDateTime, formatRelative } from '@/lib/format';
import { toCsv, downloadText, safeFilename } from '@/lib/csv';
import { toUserMessage } from '@/lib/errorMessages';

const MAX_ENTRIES = 200;
const ORG_ACTIONS = new Set(['provision_org', 'update_org', 'suspend_org', 'reactivate_org']);

const ActivityLog = () => {
  const { user } = useAuth();
  const orgId = user?.orgId;
  const [entries, setEntries] = useState([]);
  const [people, setPeople] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const [logs, users] = await Promise.all([getOrgAuditLogs(orgId, MAX_ENTRIES), getAllUsers({ orgId })]);
      setEntries(logs);
      setPeople(new Map(users.map((u) => [u.id, u])));
    } catch (err) {
      setError(toUserMessage(err, "Couldn't load the activity log."));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const byEmail = new Map([...people.values()].map((u) => [String(u.email || '').toLowerCase(), u]));
    const nameOf = (uid) => people.get(uid)?.name;
    return entries.map((e) => {
      // Older entries (and password resets) name the person only by email.
      const target = !e.targetName && !e.targetUserId && e.targetEmail
        ? byEmail.get(String(e.targetEmail).toLowerCase())
        : null;
      const { text, category: cat } = describeAuditEntry(target ? { ...e, targetName: target.name } : e, nameOf);
      const actor = people.get(e.actorId)?.name
        || (ORG_ACTIONS.has(e.action) ? 'MagnaFlow (platform admin)' : e.actorEmail || 'A former member');
      return { id: e.id, text, category: cat, actor, at: e.timestamp };
    });
  }, [entries, people]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => (category === 'all' || r.category === category)
      && (!q || r.text.toLowerCase().includes(q) || r.actor.toLowerCase().includes(q)));
  }, [rows, category, search]);

  const exportCsv = () => {
    const lines = [['When', 'Who', 'What'], ...visible.map((r) => [formatDateTime(r.at), r.actor, r.text])];
    downloadText(toCsv(lines), `${safeFilename('Activity log')}.csv`);
  };

  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" aria-hidden="true" />
            Activity
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Who added, removed or changed people, departments, projects and budgets. Entries cannot be edited or deleted.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Refresh
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={loading || visible.length === 0}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Download CSV
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <div>
            <Label htmlFor="activity-category">Show</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="activity-category" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="activity-search">Search</Label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id="activity-search"
                type="search"
                className="pl-9"
                placeholder="A name, a project, a department…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/40 p-4 text-sm" role="alert">
            <p className="text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={load}>Try again</Button>
          </div>
        ) : loading && entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading activity…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {entries.length === 0
              ? 'Nothing recorded yet. Changes to people, departments, projects and budgets will appear here.'
              : 'Nothing matches. Try another filter or search.'}
          </p>
        ) : (
          <>
            <ol className="divide-y divide-border rounded-xl border border-border" aria-label="Activity, newest first">
              {visible.map((r) => (
                <li key={r.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{r.text}</p>
                    <p className="text-xs text-muted-foreground">by {r.actor}</p>
                  </div>
                  <time
                    className="shrink-0 text-xs text-muted-foreground"
                    dateTime={r.at?.toDate ? r.at.toDate().toISOString() : undefined}
                    title={formatDateTime(r.at)}
                  >
                    {formatRelative(r.at)}
                  </time>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground" role="status">
              {visible.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`
                : `${visible.length} of ${rows.length} entries`}
              {entries.length >= MAX_ENTRIES ? ` · showing the latest ${MAX_ENTRIES}` : ''}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityLog;
