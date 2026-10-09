// The projects the signed-in person works in (lib/taskPermissions projectsInScope), and which
// one is picked. null while loading.
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/organizationService';
import { projectsInScope } from '@/lib/taskPermissions';
import { reportError } from '@/lib/reportError';

export const useMyProjects = () => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    if (!currentUser?.orgId) return;
    getProjects(currentUser.orgId)
      .then((all) => {
        const mine = projectsInScope(currentUser, all);
        setProjects(mine);
        setProjectId((cur) => cur || mine[0]?.id || '');
      })
      .catch((error) => { setProjects([]); reportError(error, { title: "Couldn't load your projects" }); });
  }, [currentUser]);

  return { projects, projectId, setProjectId, project: projects?.find((p) => p.id === projectId) || null };
};
