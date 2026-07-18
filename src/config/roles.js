// src/config/roles.js
// Canonical role name constants for the 5-tier RBAC model.
// Use these instead of string literals so rules/services/components/rules stay in sync.

export const ROLES = {
  MASTER_ADMIN: 'master-admin',
  ORG_ADMIN: 'org-admin',
  DEPARTMENT_HEAD: 'department-head',
  MANAGER: 'manager',
  STAFF: 'staff',
};

// Legacy alias: pre-existing accounts created before this model was introduced
// carry role 'admin' instead of 'org-admin'. Both are treated as equivalent
// everywhere (rules, roleRoutes, contexts).
export const LEGACY_ADMIN_ROLE = 'admin';
