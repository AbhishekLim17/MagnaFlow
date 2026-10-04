import React from 'react';
import { List, LayoutGrid, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TASK_VIEWS = [
  { value: 'list', label: 'List view', icon: List },
  { value: 'kanban', label: 'Board view', icon: LayoutGrid },
  { value: 'calendar', label: 'Calendar view', icon: CalendarDays },
];

/** Read a remembered view, falling back to the list if it is missing or no longer offered. */
export const savedView = (storageKey) => {
  try {
    const v = localStorage.getItem(storageKey);
    return TASK_VIEWS.some((x) => x.value === v) ? v : 'list';
  } catch {
    return 'list';
  }
};

/** List / board / calendar switch for a task list. */
const ViewToggle = ({ value, onChange, views = TASK_VIEWS }) => (
  <div className="flex items-center overflow-hidden rounded-lg border border-border bg-muted" role="group" aria-label="View">
    {views.map(({ value: v, label, icon: Icon }) => (
      <button
        key={v}
        type="button"
        onClick={() => onChange(v)}
        title={label}
        aria-label={label}
        aria-pressed={value === v}
        className={cn(
          'flex h-10 w-11 items-center justify-center text-sm transition-colors sm:h-9',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>
    ))}
  </div>
);

export default ViewToggle;
