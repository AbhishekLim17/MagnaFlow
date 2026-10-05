// ProjectTimeline - pick a project, see its tasks as a Gantt, and compare them with a saved
// baseline. Org admins see every project; department heads and managers the ones they run.

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { GanttChartSquare, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/organizationService';
import { getAllTasks } from '@/services/taskService';
import { getAssignableUsers } from '@/services/userService';
import { listBaselines, saveBaseline, deleteBaseline } from '@/services/baselineService';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/lib/format';
import ProjectGanttChart from '@/components/shared/ProjectGanttChart';
import { useTasks } from '@/contexts/TasksContext';
import { canEditTask, runsProject } from '@/lib/taskPermissions';
import { reportError } from '@/lib/reportError';

const NO_BASELINE = 'none';

const ProjectTimeline = () => {
  const { currentUser } = useAuth();
  const { rescheduleTask } = useTasks();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [baselines, setBaselines] = useState([]);
  const [baselineId, setBaselineId] = useState(NO_BASELINE);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const confirm = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      if (!currentUser?.orgId) return;
      try {
        const [allProjects, people] = await Promise.all([
          getProjects(currentUser.orgId),
          // names for the bars; a scoped role can only read its own team, which is fine
          getAssignableUsers(currentUser).catch(() => []),
        ]);
        const projs = allProjects.filter((p) => runsProject(currentUser, p));
        setProjects(projs);
        setUsers(people);
        if (projs.length > 0) setSelectedProjectId(projs[0].id);
      } catch (error) {
        reportError(error, { title: 'Error loading projects' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The project's saved plans, to compare with.
  useEffect(() => {
    setBaselines([]);
    setBaselineId(NO_BASELINE);
    if (!selectedProjectId) return;
    listBaselines(currentUser.orgId, selectedProjectId)
      .then(setBaselines)
      .catch((error) => reportError(error, { title: "Couldn't load the baselines", silent: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) { setTasks([]); return; }
    (async () => {
      setLoadingTasks(true);
      try {
        // orgId is required alongside projectId: the task-read rules are
        // org-scoped, so Firestore rejects a projectId-only query.
        const data = await getAllTasks({ orgId: currentUser.orgId, projectId: selectedProjectId });
        setTasks(data);
      } catch (error) {
        reportError(error, { title: 'Error loading tasks' });
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
  const baseline = baselines.find((b) => b.id === baselineId) || null;

  const saveCurrentPlan = async () => {
    setSavingBaseline(true);
    try {
      const saved = await saveBaseline(currentUser.orgId, selectedProjectId, {
        name: `Plan as of ${formatDate(new Date())}`,
        tasks,
      }, currentUser);
      setBaselines((list) => [saved, ...list]);
      setBaselineId(saved.id);
      toast({ title: 'Baseline saved', description: 'The timeline now shows how far each task moves from this plan.' });
    } catch (error) {
      reportError(error, { title: "Couldn't save the baseline" });
    } finally {
      setSavingBaseline(false);
    }
  };

  const removeBaseline = async () => {
    if (!baseline) return;
    const ok = await confirm({ title: `Delete “${baseline.name}”?`, description: 'The tasks are not changed.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await deleteBaseline(currentUser.orgId, selectedProjectId, baseline.id);
      setBaselines((list) => list.filter((b) => b.id !== baseline.id));
      setBaselineId(NO_BASELINE);
    } catch (error) {
      reportError(error, { title: "Couldn't delete the baseline" });
    }
  };

  // Legacy admins without an org can't have projects to chart.
  if (!currentUser?.orgId) {
    return (
      <div className="text-center py-16 text-muted-foreground max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">No organization linked</h2>
        <p>This account isn't part of an organization, so there are no projects to chart. Sign in with an organization-admin account.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <p className="text-muted-foreground">A Gantt view of a project's tasks, from start date to deadline.</p>
        </div>
        {projects.length > 0 && (
          <div className="w-full sm:w-64">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="bg-muted" aria-label="Project">
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <GanttChartSquare className="text-primary" />
            {selectedProject ? selectedProject.name : 'Timeline'}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          {selectedProject && (
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="w-full sm:w-64">
                <Label htmlFor="baseline-select">Compare with</Label>
                <Select value={baselineId} onValueChange={setBaselineId}>
                  <SelectTrigger id="baseline-select" className="mt-1 bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BASELINE}>No baseline</SelectItem>
                    {baselines.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}{b.createdByName ? ` · ${b.createdByName}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" variant="outline" onClick={saveCurrentPlan} disabled={savingBaseline || loadingTasks || tasks.length === 0}>
                <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                {savingBaseline ? 'Saving…' : 'Save as baseline'}
              </Button>
              {baseline && (
                <Button type="button" variant="ghost" onClick={removeBaseline}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Delete this baseline
                </Button>
              )}
            </div>
          )}
          {projects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No projects yet. Create one under "Departments &amp; Projects", then assign tasks to it.
            </div>
          ) : loadingTasks ? (
            <div className="text-center py-12 text-muted-foreground">Loading timeline...</div>
          ) : (
            <ProjectGanttChart
              tasks={tasks}
              baseline={baseline?.tasks || null}
              getStaffName={getStaffName}
              canReschedule={(task) => canEditTask(currentUser, task)}
              onReschedule={(task, dates, extra) => rescheduleTask(task, dates, {
                ...extra,
                // this screen loads the project's tasks itself; keep that copy in step
                onChange: (id, updated) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t))),
              })}
            />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default ProjectTimeline;
