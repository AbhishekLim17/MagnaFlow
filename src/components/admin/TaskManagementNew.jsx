// Task Management Component - Admin can create, edit, delete, and assign tasks to staff
// Includes task list, filters, search, and dialogs for CRUD operations

import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, Calendar, User, MessageSquare, ListChecks, AlertTriangle, ArrowDownUp, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useTasks } from '@/contexts/TasksContext';
import TaskFormDialog from '@/components/admin/TaskFormDialog';
import { getAssignableUsers, getAllUsers } from '@/services/userService';
import { getProjects, getDepartments, getOrganizationById } from '@/services/organizationService';
import TaskImportExportDialog from '@/components/admin/TaskImportExportDialog';
import TemplatesDialog from '@/components/admin/TemplatesDialog';
import { optionFromRepeat, repeatFromOption, describeRepeat } from '@/lib/recurrence';
import { useDesignations } from '@/contexts/DesignationsContext';
import { useCommentCount } from '@/hooks/useCommentCount';
import { useSubtaskCount } from '@/hooks/useSubtaskCount';
import TaskDetailsDialog from '@/components/staff/TaskDetailsDialog';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState, LoadingState } from '@/components/shared/States';
import { formatDate as formatDay } from '@/lib/format';
import { priorityLabel } from '@/lib/taskLabels';
import { describeDeadline } from '@/lib/taskState';
import {
  SORT_OPTIONS, filterAndSortTasks, activeFilterCount, filtersFromParams, writeFilters,
} from '@/lib/taskFilters';
import KanbanBoard from '@/components/shared/KanbanBoard';
import TaskCalendar from '@/components/shared/TaskCalendar';
import { approvalSummary } from '@/lib/clientThread';
import ViewToggle, { savedView } from '@/components/shared/ViewToggle';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Admin Task Card with Comment Button
const AdminTaskCard = ({ task, index, onEdit, onDelete, onCommentClick, onStatusChange, getStaffName, getPriorityBadge, getStatusBadge, formatDate }) => {
  const commentCount = useCommentCount(task.id);
  const subtaskCounts = useSubtaskCount(task.id);
  const deadline = describeDeadline(task);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="hover:border-border transition-all duration-300">
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h2 className="font-semibold text-lg mb-2">{task.title}</h2>
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            </div>
            <div className="ml-4 flex flex-wrap items-start justify-end gap-2">
              {task.milestone && (
                <Badge className="bg-primary-soft text-primary border border-primary/30">◆ Milestone</Badge>
              )}
              {approvalSummary(task) && (
                <Badge className={approvalSummary(task).decision === 'approved'
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-warning-soft text-warning border border-warning/40'}
                >
                  {approvalSummary(task).decision === 'approved' ? '✓ Client approved' : '✎ Client wants changes'}
                </Badge>
              )}
              {task.repeat && task.repeating !== false && (
                <Badge className="bg-muted text-muted-foreground border border-border">↻ {describeRepeat(task.repeat)}</Badge>
              )}
              <Badge className={`${getPriorityBadge(task.priority)} border`}>
                {priorityLabel(task.priority)}
              </Badge>
              <Select
                value={task.status}
                onValueChange={(v) => onStatusChange?.(task.id, v)}
              >
                <SelectTrigger
                  aria-label={`Status of ${task.title}`}
                  className={`h-9 sm:h-7 text-xs px-2 min-w-[110px] ${getStatusBadge(task.status)} border`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In progress</SelectItem>
                  <SelectItem value="review">In review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-border">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" aria-hidden="true" />
                <span>{getStaffName(task.assignedTo)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" aria-hidden="true" />
                <span>{formatDate(task.deadline)}</span>
                {deadline.tone === 'danger' && (
                  <span className="font-semibold text-destructive">· {deadline.label}</span>
                )}
              </div>
              
              <TooltipProvider>
                {/* Subtask Badge - Clickable */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCommentClick(task);
                      }}
                      aria-label={`Subtasks for ${task.title}: ${subtaskCounts.completed} of ${subtaskCounts.total} completed`}
                      className="flex min-h-10 items-center space-x-1 px-3 py-1.5 rounded-xl bg-primary-soft border border-primary/30 text-primary hover:bg-primary-soft transition-all sm:min-h-0"
                    >
                      <ListChecks className="w-4 h-4" aria-hidden="true" />
                      <span className="text-xs font-medium">{subtaskCounts.completed}/{subtaskCounts.total}</span>
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Subtasks: {subtaskCounts.completed} of {subtaskCounts.total} completed</p>
                  </TooltipContent>
                </Tooltip>
                
                {/* Comment Button with Count */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCommentClick(task)}
                aria-label={`Comments on ${task.title}: ${commentCount}`}
                className="flex min-h-10 items-center space-x-1 px-3 py-1.5 rounded-xl bg-primary-soft border border-primary/30 text-primary hover:bg-primary-soft transition-all sm:min-h-0"
              >
                <MessageSquare className="w-4 h-4" aria-hidden="true" />
                <span className="text-xs font-medium">{commentCount}</span>
              </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Comments: {commentCount} {commentCount === 1 ? 'comment' : 'comments'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="min-h-10 border-primary/30 text-primary hover:bg-primary-soft sm:min-h-0"
                onClick={() => onEdit(task)}
                aria-label={`Edit ${task.title}`}
              >
                <Edit className="w-4 h-4 mr-1" aria-hidden="true" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10 min-w-10 border-destructive/30 text-destructive hover:bg-destructive-soft sm:min-h-0 sm:min-w-0"
                onClick={() => onDelete(task)}
                aria-label={`Delete ${task.title}`}
                title="Delete"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const TaskManagement = () => {
  const { tasks, tasksTruncated, loading, createTask, updateTask, updateTaskStatus, deleteTask, refreshTasks } = useTasks();
  const { currentUser } = useAuth();
  const location = useLocation();
  const [staff, setStaff] = useState([]);        // assignable in this scope
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [ioOpen, setIoOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const { designations } = useDesignations();
  // Filters live in the URL (?q=&status=&assignee=&project=&sort=), so a filtered list can be
  // bookmarked, shared and survives Back and a refresh. They used to reset on every visit.
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const setFilters = (patch) =>
    setSearchParams((prev) => writeFilters(prev, { ...filtersFromParams(prev), ...patch }), { replace: true });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskForComments, setTaskForComments] = useState(null);
  const [viewMode, setViewMode] = useState(() => savedView('taskViewMode'));

  const switchView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('taskViewMode', mode); } catch { /* remembering is a nicety */ }
  };
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    status: 'pending',
    startDate: '',
    deadline: '',
    projectId: '',
    blockedBy: [],
    milestone: false,
    repeat: 'none',
  });

  const { toast } = useToast();

  // This component serves org-admins, department-heads and managers. The task
  // LIST is already role-scoped by TasksContext; what varies here is which
  // staff can be assigned and which projects can be picked.
  const role = currentUser?.role;
  const isDeptHead = role === 'department-head';
  const isManager = role === 'manager';
  const isScoped = isDeptHead || isManager;

  useEffect(() => {
    loadStaff();
    loadProjects();
    loadDepartments();
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "New Task" elsewhere in the app links here with ?new=1 so the create
  // dialog opens straight away instead of just landing on the list. The param
  // is stripped afterwards so a refresh doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      setIsAddDialogOpen(true);
      // strip only this parameter; the filters in the URL stay
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('new'); return next; }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const loadStaff = async () => {
    try {
      // Scoped roles may only assign work to staff inside their own
      // department/project (and themselves); org-admins can assign to anyone in
      // the organization, not just the 'staff' role.
      setStaff(await getAssignableUsers(currentUser));
    } catch (error) {
      console.error('Error loading staff:', error);
    }
  };

  const loadProjects = async () => {
    if (!currentUser?.orgId) return;
    try {
      const all = await getProjects(currentUser.orgId);
      // Narrow the project picker to the caller's own scope.
      let visible = all;
      if (isManager) {
        const mine = currentUser?.projectIds || [];
        visible = all.filter((p) => mine.includes(p.id));
      } else if (isDeptHead) {
        const mine = currentUser?.departmentIds || [];
        visible = all.filter((p) => mine.includes(p.departmentId));
      }
      setProjects(visible);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Department names, for exports. Best-effort: a list without them is still useful.
  const loadDepartments = async () => {
    if (!currentUser?.orgId) return;
    try {
      setDepartments(await getDepartments(currentUser.orgId));
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  // Build the task payload, attaching the selected project (and its department,
  // so department-heads see the task too) for the Gantt view. Scoped roles fall
  // back to their own project/department when they don't pick one explicitly.
  const buildTaskPayload = () => {
    let projectId = formData.projectId || undefined;
    if (!projectId && isManager) projectId = currentUser?.projectIds?.[0];

    const project = projects.find((p) => p.id === projectId);
    let departmentId = project?.departmentId || undefined;
    if (!departmentId && isDeptHead) departmentId = currentUser?.departmentIds?.[0];

    // A milestone is a single date: its deadline.
    const dates = formData.milestone ? { startDate: formData.deadline } : {};
    // Saving re-bases the schedule on these dates (occurrence 0), so editing a repeating
    // task's dates moves the rest of the series with it.
    const repeat = repeatFromOption(formData.repeat, {
      startDate: dates.startDate ?? formData.startDate,
      deadline: formData.deadline,
    });
    return {
      ...formData,
      ...dates,
      milestone: Boolean(formData.milestone),
      repeat,
      repeating: Boolean(repeat),
      occurrence: 0,
      projectId,
      departmentId,
    };
  };

  // A deadline before the start date makes a nonsense Gantt bar (it is silently
  // clamped to a one-day task), so refuse it up front.
  const datesAreInvalid = () => {
    if (formData.repeat && formData.repeat !== 'none' && !formData.deadline) {
      toast({
        title: "A repeating task needs a deadline",
        description: "The schedule counts from it.",
        variant: "destructive",
      });
      return true;
    }
    if (formData.milestone && !formData.deadline) {
      toast({
        title: "A milestone needs a date",
        description: "Set the deadline: that is the milestone's date.",
        variant: "destructive",
      });
      return true;
    }
    if (formData.startDate && formData.deadline && formData.deadline < formData.startDate) {
      toast({
        title: "Check the dates",
        description: "The deadline cannot be earlier than the start date.",
        variant: "destructive",
      });
      return true;
    }
    return false;
  };

  const handleAddTask = async () => {
    if (!formData.title || !formData.assignedTo) {
      toast({
        title: "Validation Error",
        description: "Please add a title and choose who the task is assigned to.",
        variant: "destructive",
      });
      return;
    }

    if (datesAreInvalid()) return;

    try {
      await createTask(buildTaskPayload());
      setIsAddDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleEditTask = async () => {
    if (!formData.title || !formData.assignedTo) {
      toast({
        title: "Validation Error",
        description: "Please fill in title and assign to a staff member.",
        variant: "destructive",
      });
      return;
    }

    if (datesAreInvalid()) return;

    try {
      await updateTask(selectedTask.id, buildTaskPayload());
      setIsEditDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      await deleteTask(taskToDelete.id);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const openEditDialog = (task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      assignedTo: task.assignedTo,
      priority: task.priority,
      status: task.status,
      startDate: task.startDate ? formatDateForInput(task.startDate) : '',
      deadline: task.deadline ? formatDateForInput(task.deadline) : '',
      projectId: task.projectId || '',
      blockedBy: Array.isArray(task.blockedBy) ? task.blockedBy : [],
      milestone: Boolean(task.milestone),
      repeat: optionFromRepeat(task.repeating !== false ? task.repeat : null),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assignedTo: '',
      priority: 'medium',
      status: 'pending',
      startDate: '',
      deadline: '',
      projectId: '',
      blockedBy: [],
      milestone: false,
      repeat: 'none',
    });
    setSelectedTask(null);
  };

  const formatDateForInput = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  const formatDate = (timestamp) => formatDay(timestamp, 'No deadline');

  // A scoped manager/department-head can only read user docs inside their own
  // scope (enforced by the Firestore rules), so a task assigned to someone
  // outside it can't be resolved to a name; say so plainly. For an org-admin an
  // id that matches nobody means the account was removed. Only a task with NO
  // assignee is "Unassigned".
  const getStaffName = (userId) => {
    if (!userId) return 'Unassigned';
    const known = staff.find((s) => s.id === userId);
    if (known) return known.name || known.email;
    return isScoped ? 'Outside your team' : 'Former member';
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-success-soft text-success border-success/30',
      medium: 'bg-info-soft text-info border-info/30',
      high: 'bg-warning-soft text-warning border-warning/30',
      critical: 'bg-destructive-soft text-destructive border-destructive/30',
    };
    return styles[priority] || styles.medium;
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-muted text-muted-foreground border-border',
      'in-progress': 'bg-primary-soft text-primary border-primary/30',
      completed: 'bg-success-soft text-success border-success/30',
      review: 'bg-warning-soft text-warning border-warning/40',
    };
    return styles[status] || styles.pending;
  };

  const staffMap = React.useMemo(() => {
    const m = {};
    staff.forEach(s => { m[s.id] = s.name || s.email; });
    return m;
  }, [staff]);

  const filteredTasks = useMemo(
    () => filterAndSortTasks(tasks, filters, { me: currentUser?.uid, getName: getStaffName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, filters, staff, currentUser?.uid]
  );
  const filterCount = activeFilterCount(filters);

  const isOrgAdmin = role === 'org-admin' || role === 'admin';
  const exportLookups = useMemo(() => ({
    person: (uid) => staff.find((s) => s.id === uid),
    projectName: (id) => projects.find((p) => p.id === id)?.name,
    departmentName: (id) => departments.find((d) => d.id === id)?.name,
  }), [staff, projects, departments]);

  // The whole-workspace export is for org-admins: they are the only role that can read
  // every person, project and department in the organisation.
  const loadWorkspace = async () => {
    const [people, allProjects, allDepartments, org] = await Promise.all([
      getAllUsers(),
      getProjects(currentUser.orgId),
      getDepartments(currentUser.orgId),
      getOrganizationById(currentUser.orgId).catch(() => null),
    ]);
    return {
      people,
      projects: allProjects,
      departments: allDepartments,
      designations,
      organisation: org?.name || '',
      exportedBy: currentUser?.name || currentUser?.email || '',
      tasksTruncated,
    };
  };
  const clearFilters = () => setFilters({ q: '', status: 'all', priority: 'all', assignee: 'all', project: 'all' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">Create and assign tasks to your team</p>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <ViewToggle value={viewMode} onChange={switchView} />
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setTemplatesOpen(true)} aria-label="Task templates">
              <LayoutTemplate aria-hidden="true" />
              <span className="hidden lg:inline">Templates</span>
            </Button>
            <Button type="button" variant="outline" onClick={() => setIoOpen(true)} aria-label="Import or export tasks">
              <ArrowDownUp aria-hidden="true" />
              <span className="hidden lg:inline">Import / export</span>
            </Button>
            <Button onClick={() => setIsAddDialogOpen(true)} variant="success">
              <Plus className="w-4 h-4 mr-2" />
              Create Task
            </Button>
          </div>
        </div>
      </div>

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        currentUser={currentUser}
        projects={projects}
        people={staff}
        tasks={tasks}
      />

      <TaskImportExportDialog
        open={ioOpen}
        onOpenChange={setIoOpen}
        people={staff}
        projects={projects}
        visibleTasks={filteredTasks}
        allTasks={tasks}
        filtered={filterCount > 0}
        lookups={exportLookups}
        defaultProjectId={isManager ? currentUser?.projectIds?.[0] : undefined}
        loadWorkspace={isOrgAdmin && currentUser?.orgId ? loadWorkspace : undefined}
      />

      {/* A read this size is bounded (see taskService); this is the only
          visible sign that bound was actually hit, so the list can look
          complete while quietly not being the whole list. */}
      {tasksTruncated && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-soft p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Showing the first {tasks.length} tasks. There may be more — narrow the filters below to see a
            specific set.
          </span>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="relative col-span-2 sm:col-span-3 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search title, description or person…"
              aria-label="Search tasks"
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              className="pl-10 bg-muted border-border"
            />
          </div>
          <Select value={filters.status} onValueChange={(v) => setFilters({ status: v })}>
            <SelectTrigger className="w-full bg-muted" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open (not finished)</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In progress</SelectItem>
              <SelectItem value="review">In review</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.priority} onValueChange={(v) => setFilters({ priority: v })}>
            <SelectTrigger className="w-full bg-muted" aria-label="Filter by priority">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.assignee} onValueChange={(v) => setFilters({ assignee: v })}>
            <SelectTrigger className="w-full bg-muted" aria-label="Filter by assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="me">Assigned to me</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name || member.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v })}>
            <SelectTrigger className="w-full bg-muted" aria-label="Sort tasks">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {projects.length > 0 && (
          <div className="mt-3 max-w-xs">
            <Select value={filters.project} onValueChange={(v) => setFilters({ project: v })}>
              <SelectTrigger className="w-full bg-muted" aria-label="Filter by project">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                <SelectItem value="none">No project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!loading && tasks.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
            <span>
              Showing {filteredTasks.length} of {tasks.length} task{tasks.length === 1 ? '' : 's'}
            </span>
            {filterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Clear {filterCount} filter{filterCount > 1 ? 's' : ''}
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Kanban View */}
      {viewMode === 'kanban' && !loading && (
        <KanbanBoard
          tasks={filteredTasks}
          staffMap={staffMap}
          onStatusChange={async (taskId, newStatus) => {
            try {
              await updateTaskStatus(taskId, newStatus);
            } catch {
              // The task context has already explained what went wrong.
            }
          }}
          onCardClick={setTaskForComments}
          onAddTask={(defaultStatus) => {
            setFormData(prev => ({ ...prev, status: defaultStatus }));
            setIsAddDialogOpen(true);
          }}
          canAdd={true}
        />
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && !loading && (
        <TaskCalendar tasks={filteredTasks} onTaskClick={setTaskForComments} />
      )}

      {/* Tasks List */}
      {viewMode === 'list' && (
      <Card>
        <div className="p-6">
          {loading ? (
            <LoadingState label="Loading tasks…" rows={4} />
          ) : tasks.length === 0 ? (
            <EmptyState
              icon={Plus}
              title="No tasks yet"
              hint="Create the first task and assign it to someone on your team."
              action={<Button onClick={() => setIsAddDialogOpen(true)}>Create a task</Button>}
            />
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No tasks match these filters"
              hint="Try a different search, or clear the filters to see everything."
              action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredTasks.map((task, index) => (
                <AdminTaskCard
                  key={task.id}
                  task={task}
                  index={index}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                  onCommentClick={setTaskForComments}
                  onStatusChange={async (taskId, newStatus) => {
                    try {
                      await updateTaskStatus(taskId, newStatus);
                    } catch {
                      // The task context has already explained what went wrong.
                    }
                  }}
                  getStaffName={getStaffName}
                  getPriorityBadge={getPriorityBadge}
                  getStatusBadge={getStatusBadge}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </Card>
      )}

      <TaskFormDialog
        mode="add"
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        staff={staff}
        projects={projects}
        tasks={tasks}
        onSubmit={handleAddTask}
        onCancel={() => { setIsAddDialogOpen(false); resetForm(); }}
      />

      <TaskFormDialog
        mode="edit"
        taskId={selectedTask?.id}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={formData}
        setFormData={setFormData}
        staff={staff}
        projects={projects}
        tasks={tasks}
        onSubmit={handleEditTask}
        onCancel={() => { setIsEditDialogOpen(false); resetForm(); }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task "{taskToDelete?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTaskToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} variant="destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Details Dialog with Comments */}
      {taskForComments && (
        <TaskDetailsDialog
          task={taskForComments}
          open={!!taskForComments}
          onOpenChange={(open) => !open && setTaskForComments(null)}
          currentUser={currentUser}
          getUserName={getStaffName}
          onStatusChange={async (taskId, newStatus) => {
            try {
              await updateTaskStatus(taskId, newStatus);
            } catch {
              // The task context has already explained what went wrong.
            }
          }}
        />
      )}
    </div>
  );
};

export default TaskManagement;


