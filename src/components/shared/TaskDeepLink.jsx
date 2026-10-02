// Opens the task named by `?task=<id>` in a details dialog, on whatever dashboard page
// the user is on. This is what a notification click (and any shared link) lands on.
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getTaskById } from '@/services/taskService';
import TaskDetailsDialog from '@/components/staff/TaskDetailsDialog';
import { taskIdFromSearch, withoutTaskParam } from '@/lib/taskLink';

// Roles that may change the status of any task they can open; everyone else may only
// change tasks assigned to them (the security rules enforce the same split).
const STATUS_ROLES = new Set(['admin', 'org-admin', 'master-admin', 'department-head', 'manager']);

const TaskDeepLink = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { updateTaskStatus } = useTasks();
  const { toast } = useToast();
  const taskId = taskIdFromSearch(location.search);
  const [task, setTask] = useState(null);

  const close = () =>
    navigate({ pathname: location.pathname, search: withoutTaskParam(location.search) }, { replace: true });

  useEffect(() => {
    if (!taskId) {
      setTask(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const found = await getTaskById(taskId);
        if (cancelled) return;
        if (!found) throw Object.assign(new Error('missing'), { code: 'not-found' });
        setTask(found);
      } catch (error) {
        if (cancelled) return;
        toast({
          title: 'That task is not available',
          description: error.code === 'permission-denied'
            ? 'You no longer have access to it.'
            : 'It may have been deleted.',
          variant: 'destructive',
        });
        close();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  if (!taskId || !task || !currentUser) return null;

  const canChangeStatus = task.assignedTo === currentUser.uid || STATUS_ROLES.has(currentUser.role);

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await updateTaskStatus(id, status);
      if (updated) setTask(updated);
    } catch {
      // updateTaskStatus has already told the user why.
    }
  };

  return (
    <TaskDetailsDialog
      task={task}
      open
      onOpenChange={(open) => { if (!open) close(); }}
      onStatusChange={canChangeStatus ? handleStatusChange : undefined}
      currentUser={currentUser}
    />
  );
};

export default TaskDeepLink;
