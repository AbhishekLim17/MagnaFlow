// src/config/roleRoutes.js
// Central map of role → home route. Add new roles here; never in component code.
//
// The app currently defines exactly two role dashboards in App.jsx: /admin and /staff.
// Every role must map to one of those existing routes, otherwise login redirects the
// user to a route that does not exist (blank screen / redirect loop). If you add a new
// dashboard route in App.jsx, add its role mapping here too.

export const ROLE_HOME_ROUTE = {
  'master-admin': '/admin',
  'org-admin':    '/admin',
  'admin':        '/admin',
  'department-head': '/staff',
  'manager':      '/staff',
  'staff':        '/staff',
};

// Roles allowed into the /admin dashboard.
export const ADMIN_ROLES = ['admin', 'org-admin', 'master-admin'];

// Roles allowed into the /staff dashboard.
export const STAFF_ROLES = ['staff', 'manager', 'department-head'];

/**
 * Returns the home route for a given role, falling back to /staff.
 * @param {string} role
 * @returns {string}
 */
export const getHomeRoute = (role) => ROLE_HOME_ROUTE[role] ?? '/staff';
