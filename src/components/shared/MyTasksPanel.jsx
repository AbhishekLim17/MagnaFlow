// The tasks assigned to whoever is looking at the screen.
//
// Admins, department heads and managers get work assigned to them like anyone
// else, but their dashboards only ever showed the org/department/project
// rollup — so their own tasks were visible to everyone except them. This is
// the same panel on all three, rather than three near-identical copies.

import React from 'react';
import { CheckSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/States';

const STATUS_VARIANT = {
  completed: 'success',
  'in-progress': 'default',
  pending: 'secondary',
  cancelled: 'outline',
};

const PRIORITY_VARIANT = {
  critical: 'destructive',
  high: 'warning',
  medium: 'secondary',
  low: 'outline',
};

const toDate = (value) => {
  if (!value) return null;
  return value.toDate ? value.toDate() : new Date(value);
};

const formatDeadline = (value) => {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return 'No deadline';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const isOverdue = (task) => {
  const date = toDate(task.deadline);
  if (!date || task.status === 'completed' || task.status === 'cancelled') return false;
  return date.getTime() < Date.now();
};

/**
 * @param {Object[]} tasks   every task the viewer can see
 * @param {string}   userId  the viewer's uid
 * @param {string}   [title]
 */
const MyTasksPanel = ({ tasks = [], userId, title = 'Assigned to me' }) => {
  const mine = React.useMemo(() => {
    if (!userId) return [];
    return tasks
      .filter((t) => t.assignedTo === userId && t.status !== 'cancelled')
      // Soonest deadline first; anything undated sinks to the bottom.
      .sort((a, b) => {
        const da = toDate(a.deadline)?.getTime() ?? Infinity;
        const db = toDate(b.deadline)?.getTime() ?? Infinity;
        return da - db;
      });
  }, [tasks, userId]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" /> {title}
        </CardTitle>
        {mine.length > 0 && (
          <Badge variant="secondary">{mine.length}</Badge>
        )}
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="Nothing assigned to you"
            hint="Tasks assigned to you will appear here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {mine.map((task) => (
              <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{task.title}</p>
                  <p className={`text-xs ${isOverdue(task) ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                    {isOverdue(task) ? 'Overdue — ' : ''}
                    {formatDeadline(task.deadline)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={PRIORITY_VARIANT[task.priority] || 'outline'}>{task.priority}</Badge>
                  <Badge variant={STATUS_VARIANT[task.status] || 'outline'}>{task.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default MyTasksPanel;
