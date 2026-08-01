// Shared empty / loading state blocks.
// These replace ~10 hand-rolled copies of the same markup across dashboards.

import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Empty state with an optional icon and hint line.
 *
 * An empty screen is a dead end unless it says what to do next, so `action` is
 * strongly encouraged wherever the user can actually create the missing thing.
 */
export const EmptyState = ({ icon: Icon, title, hint, action = null, className = '' }) => (
  <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
    {Icon && (
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
    )}
    <p className="text-base font-semibold text-foreground">{title}</p>
    {hint && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{hint}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

/**
 * A single shimmering placeholder block.
 */
export const Skeleton = ({ className = '' }) => (
  <div className={cn('skeleton h-4 w-full', className)} aria-hidden="true" />
);

/**
 * Loading state.
 *
 * Defaults to skeleton rows rather than a spinner: they hold the layout at
 * roughly the size of the content that is coming, so the page doesn't jump
 * when it arrives, and they read as "nearly there" rather than "stuck".
 *
 * @param {'rows'|'cards'|'spinner'} [variant]
 */
export const LoadingState = ({
  label = 'Loading…',
  variant = 'rows',
  rows = 4,
  className = '',
}) => {
  if (variant === 'spinner') {
    return (
      <div className={cn('flex flex-col items-center py-14', className)} role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}
        role="status"
        aria-label={label}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="surface space-y-3 p-5">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)} role="status" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-border/60 p-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
};

export default { EmptyState, LoadingState, Skeleton };
