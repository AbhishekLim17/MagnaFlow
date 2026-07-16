// src/config/roleRoutes.js
// Central map of role → home route. Add new roles here; never in component code.

export const ROLE_HOME_ROUTE = {
  'master-admin': '/master',
  'org-admin':    '/admin',
  'admin':        '/admin',        // legacy alias
  'department-head': '/department',
  'manager':      '/staff',
  'staff':        '/staff',
};

/**
 * Returns the home route for a given role, falling back to /staff.
 * @param {string} role
 * @returns {string}
 */
export const getHomeRoute = (role) => ROLE_HOME_ROUTE[role] ?? '/staff';
