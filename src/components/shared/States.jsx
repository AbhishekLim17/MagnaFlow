// Shared empty / loading state blocks.
// These replace ~10 hand-rolled copies of the same markup across dashboards.

import React from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

/**
 * Empty state with an optional icon and hint line.
 */
export const EmptyState = ({ icon: Icon, title, hint, action = null, className = '' }) => (
  <div className={`text-center py-12 ${className}`}>
    {Icon && <Icon className="w-14 h-14 text-gray-600 mx-auto mb-4" />}
    <p className="text-gray-400">{title}</p>
    {hint && <p className="text-sm text-gray-500 mt-2">{hint}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/**
 * Inline loading block with a spinner and label.
 */
export const LoadingState = ({ label = 'Loading...', size = 'default', className = '' }) => (
  <div className={`text-center py-12 ${className}`}>
    <LoadingSpinner size={size} />
    <p className="mt-4 text-gray-400">{label}</p>
  </div>
);

export default { EmptyState, LoadingState };
