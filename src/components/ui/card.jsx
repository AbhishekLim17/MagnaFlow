import { cn } from '@/lib/utils';
import React from 'react';

/**
 * The single card surface. Screens used to hand-roll their own with
 * `glass-effect` plus one-off padding, which is why no two panels lined up.
 *
 * @param {boolean} [interactive] adds a small hover lift — only for cards that
 *   are genuinely clickable, so the motion still means something.
 */
const Card = React.forwardRef(({ className, interactive = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('surface', interactive && 'interactive cursor-pointer', className)}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1 p-6 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// A panel heading, not a page heading — the old 2xl was competing with the
// page title and flattened the hierarchy.
const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-base font-bold leading-tight tracking-tight text-foreground', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-3 p-6 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
