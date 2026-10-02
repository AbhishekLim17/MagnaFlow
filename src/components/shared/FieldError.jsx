import React from 'react';

/**
 * An inline error under a form field. Give the field `aria-describedby={id}` (and
 * `aria-invalid`) so a screen reader announces it with the field. Renders nothing when
 * there is no message, so it can always be left in place.
 */
const FieldError = ({ id, children }) => (children
  ? <p id={id} role="alert" className="mt-1.5 text-sm text-destructive">{children}</p>
  : null);

export default FieldError;
