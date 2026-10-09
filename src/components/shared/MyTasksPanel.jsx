// "My Work": the viewer's own tasks grouped by when they are due, plus work they handed
// out that is waiting for their review and tasks they watch (lib/myWork). Shown on every
// dashboard that has tasks; clicking a row opens the task where you are (?task=).

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/States';
import { formatDate } from '@/lib/format';
import { priorityLabel, statusLabel } from '@/lib/taskLabels';
import { groupMyWork } from '@/lib/myWork';
import { taskLink } from '@/lib/taskLink';

const PRIORITY_VARIANT = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
};

/**
 * @param {Object[]} tasks   every task the viewer can see
 * @param {string}   userId  the viewer's uid
 * @param {string}   [title]
 */
const MyTasksPanel = ({ tasks = [], userId, title = 'My Work' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const groups = React.useMemo(() => groupMyWork(tasks, userId), [tasks, userId]);
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" aria-hidden="true" /> {title}
        </CardTitle>
        {total > 0 && <Badge variant="secondary">{total}</Badge>}
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing waiting for you"
            hint="Tasks assigned to you, work to review and tasks you watch will appear here."
          />
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.key} aria-labelledby={`mywork-${group.key}`}>
                <h3
                  id={`mywork-${group.key}`}
                  className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
                    group.key === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {group.label} · {group.tasks.length}
                </h3>
                <ul className="divide-y divide-border">
                  {group.tasks.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => navigate(taskLink(location.pathname, task.id))}
                        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{task.title}</span>
                          <span className="block text-xs text-muted-foreground">{formatDate(task.deadline, 'No deadline')}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge variant={PRIORITY_VARIANT[task.priority] || 'outline'}>{priorityLabel(task.priority)}</Badge>
                          <Badge variant="outline">{statusLabel(task.status)}</Badge>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MyTasksPanel;
