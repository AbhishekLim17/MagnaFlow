import { cn } from '@/lib/utils';
import { cva } from 'class-variance-authority';
import React from 'react';

// Status badges are tinted rather than saturated: at this size a solid fill
// pulls more attention than the status usually deserves, and a table full of
// them turns into confetti. Text carries the brand colour, the background is
// its soft counterpart.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ' +
    'transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ' +
    '[&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary-soft text-primary',
        secondary: 'bg-muted text-muted-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning-foreground',
        destructive: 'bg-destructive-soft text-destructive',
        info: 'bg-info-soft text-info',
        outline: 'border border-border text-foreground',
        // For the rare case that genuinely needs to shout.
        solid: 'bg-primary text-primary-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
