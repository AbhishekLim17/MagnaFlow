import { cn } from '@/lib/utils';
import React from 'react';

// h-11 matches the default Button so a field and its action line up on the
// same row. The focus state is a soft brand ring rather than a hard outline.
const inputClasses =
  'flex h-11 w-full rounded-xl border border-input bg-card px-4 py-2 text-sm text-foreground ' +
  'transition-[border-color,box-shadow] duration-200 ease-premium ' +
  'placeholder:text-muted-foreground/70 ' +
  'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground ' +
  'hover:border-border ' +
  'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/12 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted ' +
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/15';

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input type={type} className={cn(inputClasses, className)} ref={ref} {...props} />
  );
});
Input.displayName = 'Input';

export { Input, inputClasses };
