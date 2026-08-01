import React from 'react';
import { cn } from '@/lib/utils';

/**
 * The MagnaFlow mark: three petals rotating around a centre, reading as both
 * "flow" and the convergence of departments into one org. Drawn rather than
 * imported so it inherits the brand token and stays crisp at any size.
 */
const Brandmark = ({ className, ...props }) => (
  <span
    className={cn(
      'grid shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-card',
      className
    )}
    {...props}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-[60%] w-[60%]"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.5c2.3 0 4.2 1.9 4.2 4.2 0 1.2-.5 2.3-1.4 3 1.4.5 2.9.4 4.2-.4 1.1 1.9.4 4.4-1.5 5.5-1 .6-2.2.7-3.3.4.5 1.4 1.6 2.4 3 2.9-.7 2.2-3 3.3-5.2 2.6-1.1-.4-2-1.2-2.5-2.2-.5 1-1.4 1.8-2.5 2.2-2.2.7-4.5-.4-5.2-2.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.35"
      />
      <circle cx="12" cy="12" r="3.1" fill="currentColor" />
      <circle cx="12" cy="4.4" r="1.9" fill="currentColor" opacity="0.9" />
      <circle cx="18.6" cy="15.8" r="1.9" fill="currentColor" opacity="0.65" />
      <circle cx="5.4" cy="15.8" r="1.9" fill="currentColor" opacity="0.65" />
    </svg>
  </span>
);

export default Brandmark;
