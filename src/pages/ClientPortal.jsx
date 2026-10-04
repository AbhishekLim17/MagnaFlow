// ClientPortal.jsx
// Read-only dashboard for client (external-stakeholder) accounts.
// Shows project progress cards and a Gantt timeline for each project
// the client has been granted access to. No create/edit/delete controls.

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { FolderOpen, CheckCircle2, Clock, AlertTriangle, LogOut, Sun, Moon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getProjectsByIds, getOrganizationById } from "@/services/organizationService";
import { getBranding } from "@/services/brandingService";
import PortalBrandBar from "@/components/shared/PortalBrandBar";
import { EMPTY_BRANDING } from "@/lib/branding";
import { getAllTasks } from "@/services/taskService";
import ProjectGanttChart from "@/components/shared/ProjectGanttChart";
import { reportError } from "@/lib/reportError";
import { usePageTitle } from "@/lib/usePageTitle";
import { isOverdueTask, summarizeProject } from "@/lib/taskState";
import { formatDate, toDate } from "@/lib/format";
import { statusLabel } from "@/lib/taskLabels";

// ─── helpers ──────────────────────────────────────────────────────────────────

// Cancelled work is part of the history, not the plan: it is listed (struck through,
// at the bottom) but left out of every count and of the completion percentage.
const STATUS_ORDER = { cancelled: 1 };
const byStatusGroup = (a, b) => (STATUS_ORDER[a.status] || 0) - (STATUS_ORDER[b.status] || 0);

// ─── component ────────────────────────────────────────────────────────────────

const ClientPortal = () => {
  const { currentUser, logout } = useAuth();
  usePageTitle("Your projects");
  const { theme, toggleTheme } = useTheme();

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState(null);
  // The organisation's look (logo, colour, welcome note) and name, set by their admin.
  const [branding, setBranding] = useState(EMPTY_BRANDING);
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (!currentUser?.orgId) return undefined;
    let cancelled = false;
    Promise.all([getBranding(currentUser.orgId), getOrganizationById(currentUser.orgId).catch(() => null)])
      .then(([b, org]) => {
        if (cancelled) return;
        setBranding(b);
        setOrgName(org?.name || "");
      });
    return () => { cancelled = true; };
  }, [currentUser?.orgId]);

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
          getProjectsByIds(currentUser.orgId, currentUser.projectIds),
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
  const activeTasks = activeProjectId
    ? [...(tasksByProject[activeProjectId] ?? [])].sort(byStatusGroup)
    : [];
  const summary = summarizeProject(activeTasks);
  // Header buttons sit on the organisation's colour when one is set: keep its text colour.
  const onAccent = branding.accent ? "text-current hover:bg-black/10 hover:text-current" : "";

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
      <PortalBrandBar as="header" className="sticky top-0 z-10" branding={branding} orgName={orgName}>
        <span className={`hidden text-sm sm:block ${branding.accent ? "opacity-90" : "text-muted-foreground"}`}>
          {currentUser?.name}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className={`h-9 w-9 ${onAccent}`}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
        </Button>
        <Button variant="ghost" size="sm" onClick={logout} className={`gap-1.5 ${onAccent}`}>
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </PortalBrandBar>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {branding.welcome && (
          <p
            className="rounded-xl border border-border bg-card px-5 py-4 text-sm text-foreground"
            style={branding.accent ? { borderLeft: `4px solid ${branding.accent}` } : undefined}
          >
            {branding.welcome}
          </p>
        )}

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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    {
                      label: "Total Tasks",
                      value: summary.total,
                      icon: FolderOpen,
                      color: "text-primary",
                    },
                    {
                      label: "Completed",
                      value: summary.completed,
                      icon: CheckCircle2,
                      color: "text-success",
                    },
                    {
                      label: "In Progress",
                      value: summary.inProgress,
                      icon: Clock,
                      color: "text-info",
                    },
                    {
                      label: "In Review",
                      value: summary.inReview,
                      icon: Clock,
                      color: "text-warning",
                    },
                    {
                      label: "Overdue",
                      value: summary.overdue,
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
                {summary.total > 0 && (() => {
                  const done = summary.completed;
                  const pct = summary.percent;
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
                        {done} of {summary.total} tasks complete
                        {summary.cancelled > 0 && ` · ${summary.cancelled} cancelled task${summary.cancelled > 1 ? 's' : ''} not counted`}
                      </p>
                    </Card>
                  );
                })()}

                {/* ── Milestones: the dates a client cares about ───────── */}
                {(() => {
                  const milestones = activeTasks
                    .filter((t) => t.milestone)
                    .sort((a, b) => (toDate(a.deadline)?.getTime() ?? Infinity) - (toDate(b.deadline)?.getTime() ?? Infinity));
                  if (milestones.length === 0) return null;
                  return (
                    <Card className="p-5">
                      <h2 className="text-base font-semibold mb-4">Milestones</h2>
                      <ol className="space-y-2">
                        {milestones.map((m) => {
                          const done = m.status === 'completed';
                          const overdue = isOverdueTask(m);
                          return (
                            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                              <span
                                aria-hidden="true"
                                className={`h-3 w-3 shrink-0 rotate-45 rounded-[2px] ${done ? 'bg-success-accent' : overdue ? 'bg-destructive' : 'bg-primary'}`}
                              />
                              <span className={`flex-1 text-sm font-medium ${m.status === 'cancelled' ? 'line-through text-muted-foreground' : ''}`}>{m.title}</span>
                              <span className={`text-xs ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                {done ? 'Reached' : overdue ? 'Was due' : 'Due'} {m.deadline ? formatDate(m.deadline) : 'date to be set'}
                              </span>
                            </li>
                          );
                        })}
                      </ol>
                    </Card>
                  );
                })()}

                {/* ── Task list (title + status + deadline only) ────── */}
                {activeTasks.length > 0 && (
                  <Card className="p-5">
                    <h2 className="text-base font-semibold mb-4">Tasks</h2>
                    <div className="space-y-2">
                      {activeTasks.map((task) => {
                        const overdue = isOverdueTask(task);
                        // Fix #12: add review status style
                        const statusStyles = {
                          completed: "bg-success/10 text-success border-success/20",
                          "in-progress": "bg-primary-soft text-primary border-primary/30",
                          review: "bg-warning-soft text-warning border-warning/40",
                          pending: "bg-muted text-muted-foreground",
                          cancelled: "bg-muted text-muted-foreground line-through",
                        };
                        const dl = task.deadline ? formatDate(task.deadline) : null;

                        return (
                          <div
                            key={task.id}
                            className="rounded-lg border overflow-hidden"
                          >
                            {/* Fix #15: expandable task row with description */}
                            <details>
                              <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none hover:bg-muted/30 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${task.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                                    {task.title}
                                  </p>
                                  {dl && (
                                    <p className={`text-xs mt-0.5 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                                      {overdue ? "Was due " : "Due "}
                                      {dl}
                                    </p>
                                  )}
                                </div>
                                {/* Fix #10: status badge then overdue line separately */}
                                <div className="flex flex-col items-end gap-0.5 shrink-0">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs capitalize ${statusStyles[task.status] ?? ""}`}
                                  >
                                    {statusLabel(task.status)}
                                  </Badge>
                                  {overdue && (
                                    <span className="text-[10px] font-medium text-destructive">Overdue</span>
                                  )}
                                </div>
                              </summary>
                              {task.description && (
                                <div className="px-4 pb-3 border-t border-border text-xs text-muted-foreground">
                                  {task.description}
                                </div>
                              )}
                            </details>
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
