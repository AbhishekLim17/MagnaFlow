import { cn } from '@/lib/utils';
import React from 'react';

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[96px] w-full rounded-xl border border-input bg-card px-4 py-3 text-sm text-foreground',
        'transition-[border-color,box-shadow] duration-200 ease-premium',
        'placeholder:text-muted-foreground/70 hover:border-border',
        'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12',
        'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export { Textarea };
