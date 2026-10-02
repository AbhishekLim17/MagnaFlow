import React from 'react';

// The ring used to be `border-b-2 border-border`: a hairline in the divider colour, which is
// nearly invisible, so every page load showed a blank screen. It is now a visible ring and
// is announced to screen readers.
const LoadingSpinner = ({ size = 'default', className = '', label = 'Loading' }) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    default: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <div
        className={`animate-spin rounded-full border-[3px] border-primary/20 border-t-primary motion-reduce:animate-none ${sizeClasses[size]}`}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
};

export default LoadingSpinner;
