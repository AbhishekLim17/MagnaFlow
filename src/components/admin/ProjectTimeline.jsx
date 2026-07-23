// ProjectTimeline - org-admin view: pick a project, see its tasks as a Gantt.

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GanttChartSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/organizationService';
import { getAllTasks } from '@/services/taskService';
import { getAllUsers } from '@/services/userService';
import ProjectGanttChart from '@/components/shared/ProjectGanttChart';

const ProjectTimeline = () => {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    (async () => {
      if (!currentUser?.orgId) return;
      try {
        const [projs, allUsers] = await Promise.all([
          getProjects(currentUser.orgId),
          getAllUsers(),
        ]);
        setProjects(projs);
        setUsers(allUsers);
        if (projs.length > 0) setSelectedProjectId(projs[0].id);
      } catch (error) {
        console.error('Error loading timeline data:', error);
        toast({ title: 'Error loading projects', description: error.message, variant: 'destructive' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setTasks([]); return; }
    (async () => {
      setLoadingTasks(true);
      try {
        const data = await getAllTasks({ projectId: selectedProjectId });
        setTasks(data);
      } catch (error) {
        console.error('Error loading project tasks:', error);
        toast({ title: 'Error loading tasks', description: error.message, variant: 'destructive' });
      } finally {
        setLoadingTasks(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const userMap = useMemo(() => {
    const m = {};
    users.forEach((u) => { m[u.id] = u.name; });
    return m;
  }, [users]);

  const getStaffName = (uid) => userMap[uid] || null;
  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Project Timeline</h2>
          <p className="text-gray-300">A Gantt view of a project's tasks, from start date to deadline.</p>
        </div>
        {projects.length > 0 && (
          <div className="w-full sm:w-64">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-gray-800/50 border-gray-700 text-white">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <Card className="glass-effect p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <GanttChartSquare className="text-purple-300" />
            {selectedProject ? selectedProject.name : 'Timeline'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No projects yet. Create one under "Departments &amp; Projects", then assign tasks to it.
            </div>
          ) : loadingTasks ? (
            <div className="text-center py-12 text-gray-400">Loading timeline...</div>
          ) : (
            <ProjectGanttChart tasks={tasks} getStaffName={getStaffName} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectTimeline;
