// src/config/roleRoutes.js
// Central map of role → home route. Add new roles here; never in component code.
//
// Each of the 5 tiers gets its own dashboard route. 'admin' is a legacy alias
// for 'org-admin' (pre-existing accounts created before this model existed).

export const ROLE_HOME_ROUTE = {
  'master-admin': '/master',
  'org-admin': '/admin',
  admin: '/admin',
  'department-head': '/department',
  manager: '/manager',
  staff: '/staff',
};

// Roles allowed into each dashboard route.
export const MASTER_ADMIN_ROLES = ['master-admin'];
export const ORG_ADMIN_ROLES = ['admin', 'org-admin'];
export const DEPARTMENT_HEAD_ROLES = ['department-head'];
export const MANAGER_ROLES = ['manager'];
export const STAFF_ROLES = ['staff'];

/**
 * Returns the home route for a given role, falling back to /staff.
 * @param {string} role
 * @returns {string}
 */
export const getHomeRoute = (role) => ROLE_HOME_ROUTE[role] ?? '/staff';
