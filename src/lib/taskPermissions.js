// Who may change a task's content (title, dates, assignee...), mirroring the `tasks` update
// rule in firestore.rules. The rules are the real boundary; this only decides what the
// interface offers, so nobody is shown a handle that the server would refuse.
//
//  - a platform owner: anything
//  - an org admin: any task in their organisation
//  - a department head: tasks in one of their departments
//  - a project manager: tasks in one of their projects
//  - anyone: tasks they created
// An assignee who did not create the task may only move its status, which is not covered here.

const ORG_ADMIN = new Set(['org-admin', 'admin']);

/**
 * @param {{ id?: string, uid?: string, role?: string, orgId?: string, departmentIds?: string[], projectIds?: string[] }} user
 * @param {{ orgId?: string, departmentId?: string, projectId?: string, createdBy?: string }} task
 */
export const canEditTask = (user, task) => {
  if (!user || !task) return false;
  const uid = user.uid || user.id;
  if (user.role === 'master-admin') return true;
  const sameOrg = (task.orgId ?? null) === (user.orgId ?? null);
  if (!sameOrg) return false;
  if (ORG_ADMIN.has(user.role)) return true;
  if (uid && task.createdBy === uid) return true;
  if (user.role === 'department-head' && task.departmentId && (user.departmentIds || []).includes(task.departmentId)) return true;
  if (user.role === 'manager' && task.projectId && (user.projectIds || []).includes(task.projectId)) return true;
  return false;
};

/**
 * Whether the person runs a project (its manager, the head of its department, or an org
 * admin), mirroring canManageProjectMoney / canTriage in firestore.rules: they answer its
 * client requests and save its baselines.
 */
export const runsProject = (user, project) => {
  if (!user || !project) return false;
  if (user.role === 'master-admin') return true;
  if ((project.orgId ?? user.orgId ?? null) !== (user.orgId ?? null)) return false;
  if (ORG_ADMIN.has(user.role)) return true;
  if (user.role === 'manager') return (user.projectIds || []).includes(project.id);
  if (user.role === 'department-head') return Boolean(project.departmentId) && (user.departmentIds || []).includes(project.departmentId);
  return false;
};

/** The projects a person works in: the ones they run, plus the ones they are a member of. */
export const projectsInScope = (user, projects = []) =>
  projects.filter((p) => runsProject(user, p) || (user?.projectIds || []).includes(p.id));
