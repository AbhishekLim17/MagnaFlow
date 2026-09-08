// ClientPortal.jsx
// Read-only dashboard for client (external-stakeholder) accounts.
// Shows project progress cards and a Gantt timeline for each project
// the client has been granted access to. No create/edit/delete controls.

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FolderOpen, CheckCircle2, Clock, AlertTriangle, LogOut } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getProjects } from "@/services/organizationService";
import { getAllTasks } from "@/services/taskService";
import ProjectGanttChart from "@/components/shared/ProjectGanttChart";
import { reportError } from "@/lib/reportError";

// ─── helpers ──────────────────────────────────────────────────────────────────

const isOverdue = (task) => {
  if (task.status === "completed" || task.status === "cancelled") return false;
  if (!task.deadline) return false;
  const dl = typeof task.deadline.toDate === "function"
    ? task.deadline.toDate()
    : new Date(task.deadline);
  return dl < new Date();
};

// ─── component ────────────────────────────────────────────────────────────────

const ClientPortal = () => {
  const { currentUser, logout } = useAuth();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState(null);

  // Load project names and tasks for this client's assigned projects
  useEffect(() => {
    if (!currentUser?.orgId || !currentUser?.projectIds?.length) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [allProjects, taskResult] = await Promise.all([
          getProjects(currentUser.orgId),
          getAllTasks({
            orgId: currentUser.orgId,
            projectIds: currentUser.projectIds,
          }),
        ]);
        if (cancelled) return;
        // Only include projects the client is actually linked to
        const myProjects = allProjects.filter((p) =>
          currentUser.projectIds.includes(p.id)
        );
        setProjects(myProjects);
        setTasks(taskResult.tasks ?? taskResult);
        if (myProjects.length > 0) setActiveProjectId(myProjects[0].id);
      } catch (err) {
        reportError(err, { context: "ClientPortal.load" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Group tasks by project
  const tasksByProject = useMemo(() => {
    const map = {};
    for (const t of tasks) {
      const pid = t.projectId;
      if (!pid) continue;
      if (!map[pid]) map[pid] = [];
      map[pid].push(t);
    }
    return map;
  }, [tasks]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeTasks = activeProjectId ? (tasksByProject[activeProjectId] ?? []) : [];

  // ── render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading your projects…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top Bar ─────────────────────────────────────────────────── */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-sm">MagnaFlow</span>
              <span className="text-muted-foreground text-xs ml-2">Client View</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {currentUser?.name}
            </span>
            <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {projects.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <FolderOpen className="w-14 h-14 text-muted-foreground" />
            <div>
              <p className="font-semibold text-lg">No projects yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Your account hasn't been linked to any projects. Contact your project manager.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Project selector (tabs when multiple) ─────────────── */}
            {projects.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveProjectId(p.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      activeProjectId === p.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {activeProject && (
              <motion.div
                key={activeProjectId}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* ── Project headline ─────────────────────────────── */}
                <div>
                  <h1 className="text-2xl font-bold">{activeProject.name}</h1>
                  <p className="text-muted-foreground text-sm mt-1">
                    Project progress overview
                  </p>
                </div>

                {/* ── Summary cards ────────────────────────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Total Tasks",
                      value: activeTasks.length,
                      icon: FolderOpen,
                      color: "text-primary",
                    },
                    {
                      label: "Completed",
                      value: activeTasks.filter((t) => t.status === "completed").length,
                      icon: CheckCircle2,
                      color: "text-success",
                    },
                    {
                      label: "In Progress",
                      value: activeTasks.filter((t) => t.status === "in-progress").length,
                      icon: Clock,
                      color: "text-blue-500",
                    },
                    {
                      label: "Overdue",
                      value: activeTasks.filter(isOverdue).length,
                      icon: AlertTriangle,
                      color: "text-destructive",
                    },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <Card key={label} className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <span className="text-xs text-muted-foreground">{label}</span>
                      </div>
                      <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    </Card>
                  ))}
                </div>

                {/* ── Progress bar ──────────────────────────────────── */}
                {activeTasks.length > 0 && (() => {
                  const done = activeTasks.filter((t) => t.status === "completed").length;
                  const pct = Math.round((done / activeTasks.length) * 100);
                  return (
                    <Card className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Overall Completion</span>
                        <Badge variant={pct === 100 ? "default" : "secondary"}>
                          {pct}%
                        </Badge>
                      </div>
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="bg-primary h-3 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {done} of {activeTasks.length} tasks complete
                      </p>
                    </Card>
                  );
                })()}

                {/* ── Task list (title + status + deadline only) ────── */}
                {activeTasks.length > 0 && (
                  <Card className="p-5">
                    <h2 className="text-base font-semibold mb-4">Tasks</h2>
                    <div className="space-y-2">
                      {activeTasks.map((task) => {
                        const overdue = isOverdue(task);
                        const statusStyles = {
                          completed: "bg-success/10 text-success border-success/20",
                          "in-progress": "bg-blue-500/10 text-blue-500 border-blue-500/20",
                          pending: "bg-muted text-muted-foreground",
                          cancelled: "bg-muted text-muted-foreground line-through",
                        };
                        const dl = task.deadline
                          ? (typeof task.deadline.toDate === "function"
                              ? task.deadline.toDate()
                              : new Date(task.deadline)
                            ).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                          : null;

                        return (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 rounded-lg border px-4 py-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${task.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                                {task.title}
                              </p>
                              {dl && (
                                <p className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                  {overdue ? "Overdue · " : "Due "}
                                  {dl}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize shrink-0 ${statusStyles[task.status] ?? ""}`}
                            >
                              {task.status === "in-progress" ? "In Progress" : task.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {/* ── Gantt Timeline ───────────────────────────────── */}
                {activeTasks.length > 0 && (
                  <Card className="p-5">
                    <h2 className="text-base font-semibold mb-4">Timeline</h2>
                    <ProjectGanttChart tasks={activeTasks} />
                  </Card>
                )}

                {activeTasks.length === 0 && (
                  <Card>
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                      <Clock className="w-10 h-10 text-muted-foreground" />
                      <p className="font-medium">No tasks yet</p>
                      <p className="text-sm text-muted-foreground">
                        Tasks will appear here as your project gets underway.
                      </p>
                    </div>
                  </Card>
                )}
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ClientPortal;
