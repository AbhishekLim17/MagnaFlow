// Staff Dashboard - Staff member interface for viewing and managing assigned tasks
// Staff can view only their tasks, update status, and create personal tasks

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert, Palmtree, CheckSquare, Plus, Search, Clock, TrendingUp, Target, AlertCircle, MessageSquare, ListChecks, GanttChartSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { LoadingState } from '@/components/shared/States';
import { useToast } from '@/components/ui/use-toast';
import AddTaskDialog from '@/components/staff/AddTaskDialog';
import EditTaskDialog from '@/components/staff/EditTaskDialog';
import TaskDetailsDialog from '@/components/staff/TaskDetailsDialog';
import ProjectGanttChart from '@/components/shared/ProjectGanttChart';
import { canEditTask } from '@/lib/taskPermissions';
import DashboardLayout from '@/components/shared/DashboardLayout';
import KanbanBoard from '@/components/shared/KanbanBoard';
import TaskCalendar from '@/components/shared/TaskCalendar';
import ViewToggle, { savedView } from '@/components/shared/ViewToggle';
import StatCard from '@/components/shared/StatCard';
import MyTasksPanel from '@/components/shared/MyTasksPanel';
import LeavePage from '@/components/shared/LeavePage';
import RaidPage from '@/components/admin/RaidPage';
import WikiPage from '@/components/shared/WikiPage';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import { formatDate } from '@/lib/format';
import { filterAndSortTasks, SORT_OPTIONS } from '@/lib/taskFilters';
import { useCommentCount } from '@/hooks/useCommentCount';
import { useSubtaskCount } from '@/hooks/useSubtaskCount';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const STAFF_MENU = [
  { id: 'dashboard', label: 'My Tasks', icon: CheckSquare },
  { id: 'pages', label: 'Project Pages', icon: BookOpen },
  { id: 'risks', label: 'Risks & Issues', icon: ShieldAlert },
  { id: 'leave', label: 'Leave & Holidays', icon: Palmtree },
];
// The other pages of the staff dashboard (the task list is the first).
const STAFF_PAGES = { leave: LeavePage, risks: RaidPage, pages: WikiPage };

// Task Card Component with Comment Button
const TaskCardWithComments = ({ task, index, onTaskClick, onStatusChange }) => {
  const commentCount = useCommentCount(task.id);
  const subtaskCounts = useSubtaskCount(task.id);
  
  const getPriorityBadge = (priority) => {
    const badges = {
      critical: 'bg-destructive-soft text-destructive border-destructive/30',
      high: 'bg-warning-soft text-warning border-warning/30',
      medium: 'bg-info-soft text-info border-info/30',
      low: 'bg-success-soft text-success border-success/30',
    };
    return badges[priority] || badges.medium;
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-muted text-muted-foreground border-border',
      'in-progress': 'bg-primary-soft text-primary border-primary/30',
      completed: 'bg-success-soft text-success border-success/30',
      review: 'bg-warning-soft text-warning border-warning/40',
    };
    return badges[status] || badges.pending;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className="hover:border-border transition-all duration-300 cursor-pointer"
        onClick={() => onTaskClick(task)}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">{task.title}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            </div>
            <div className="ml-4 space-x-2">
              <Badge className={`${getPriorityBadge(task.priority)} border`}>
                {task.priority}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Clock className="w-4 h-4" />
                <span>{formatDate(task.deadline, 'No deadline')}</span>
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
                        onTaskClick(task);
                      }}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-primary-soft border border-primary/30 text-primary hover:bg-primary-soft transition-all"
                    >
                      <ListChecks className="w-4 h-4" />
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
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskClick(task);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-primary-soft border border-primary/30 text-primary hover:bg-primary-soft transition-all"
              >
                <MessageSquare className="w-4 h-4" />
                <span className="text-xs font-medium">{commentCount}</span>
              </motion.button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Comments: {commentCount} {commentCount === 1 ? 'comment' : 'comments'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <Select
              value={task.status}
              onValueChange={(value) => onStatusChange(task.id, value)}
              onClick={(e) => e.stopPropagation()}
            >
              <SelectTrigger className={`w-[140px] ${getStatusBadge(task.status)} border`} aria-label={`Status of ${task.title}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const StaffDashboard = () => {
  const confirm = useConfirm();
  const { user, currentUser } = useAuth();
  const { tasks, statistics, loading, updateTaskStatus, deleteTask, refreshTasks, rescheduleTask } = useTasks();
  const { toast } = useToast();
  const [tab, setTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState(() => savedView('staffTaskViewMode'));

  const switchView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem('staffTaskViewMode', mode); } catch { /* remembering is a nicety */ }
  };

  useEffect(() => {
    if (user) {
      refreshTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);


  // The task context toasts the outcome (and, when a prerequisite is unfinished,
  // names it), so this only has to make the call.
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateTaskStatus(taskId, newStatus);
    } catch {
      // already reported by the task context
    }
  };

  const handleEditTask = (task) => {
    setSelectedTask(null); // Close the details dialog first
    setEditingTask(task);
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    const ok = await confirm({
      title: `Delete “${taskTitle}”?`,
      description: <p>The task, its subtasks and comments are removed. This cannot be undone.</p>,
      confirmLabel: 'Delete task',
      destructive: true,
    });
    if (!ok) return;

    // deleteTask reports its own outcome and returns whether it worked.
    if (await deleteTask(taskId)) setSelectedTask(null);
  };

  // The same search/filter/sort the admin task list uses (lib/taskFilters).
  const filteredTasks = filterAndSortTasks(
    tasks,
    { q: searchQuery, status: statusFilter, priority: priorityFilter, sort },
    { me: user?.id },
  );

  // Dashboard statistics. Colors are semantic StatCard keys, not raw Tailwind
  // tokens — interpolated class names get stripped by Tailwind's JIT.
  const dashboardStats = [
    {
      title: 'Total Tasks',
      value: statistics?.total || 0,
      icon: Target,
      color: 'blue',
      description: 'Assigned to you'
    },
    {
      title: 'Pending',
      value: statistics?.pending || 0,
      icon: AlertCircle,
      color: 'slate',
      description: 'Awaiting start'
    },
    {
      title: 'In Progress',
      value: statistics?.inProgress || 0,
      icon: TrendingUp,
      color: 'indigo',
      description: 'Currently working'
    },
    {
      title: 'Completed',
      value: statistics?.completed || 0,
      icon: CheckSquare,
      color: 'teal',
      description: 'Successfully done'
    },
  ];

  // Priority badge styles

  // Status badge styles

  // Format date

  return (
    <DashboardLayout
      subtitle="Staff Panel"
      menuItems={STAFF_MENU}
      activeTab={tab}
      onTabChange={setTab}
      title={STAFF_MENU.find((m) => m.id === tab).label}
    >
      {STAFF_PAGES[tab] ? React.createElement(STAFF_PAGES[tab]) : (
      <div className="space-y-6">
        {/* The header already greets the user by name. */}
        <p className="text-sm text-muted-foreground">Manage your tasks and track your progress</p>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {dashboardStats.map((stat, index) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              description={stat.description}
              index={index}
              loading={loading}
            />
          ))}
        </div>

        {!loading && <MyTasksPanel tasks={tasks} userId={user?.id || currentUser?.uid} />}

        {/* Everyone above staff could see how their work sits on a timeline;
            the people doing it could not. Same component, their tasks only. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GanttChartSquare className="h-5 w-5 text-primary" /> My Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState label="Loading timeline..." />
            ) : (
              <ProjectGanttChart
                tasks={tasks}
                getStaffName={() => user?.name || 'You'}
                canReschedule={(task) => canEditTask(user, task)}
                onReschedule={rescheduleTask}
              />
            )}
          </CardContent>
        </Card>

        {/* Task Management Section */}
        <Card>
          <div className="p-6 space-y-4">
            {/* Header with Add Task Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">My Tasks</h2>
              <div className="flex items-center gap-2">
                <ViewToggle value={viewMode} onChange={switchView} />
                <Button onClick={() => setIsAddTaskOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Personal Task
                </Button>
              </div>
            </div>

            {/* Filters */}
            {/* Wraps instead of squeezing the search box to nothing beside three selects. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  aria-label="Search tasks"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-muted" aria-label="Filter by status">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Not finished</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="review">Review</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[180px] bg-muted" aria-label="Filter by priority">
                  <SelectValue placeholder="Filter by Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-full sm:w-[200px] bg-muted" aria-label="Sort tasks">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Kanban View */}
            {viewMode === 'kanban' && !loading && (
              <KanbanBoard
                tasks={filteredTasks}
                staffMap={{ [user?.id]: user?.name || user?.email || 'You' }}
                onStatusChange={async (taskId, newStatus) => {
                  try {
                    await updateTaskStatus(taskId, newStatus);
                    toast({ title: 'Task moved', description: 'Status updated.' });
                  } catch {
                    toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
                  }
                }}
                onCardClick={setSelectedTask}
                canAdd={false}
              />
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && !loading && (
              <TaskCalendar tasks={filteredTasks} onTaskClick={setSelectedTask} />
            )}

            {/* Tasks List */}
            {viewMode === 'list' && (loading ? (
              <LoadingState label="Loading tasks..." />
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No tasks found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first task to get started'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredTasks.map((task, index) => (
                  <TaskCardWithComments 
                    key={task.id}
                    task={task}
                    index={index}
                    onTaskClick={setSelectedTask}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            ))
            }
          </div>
        </Card>
      </div>
      )}

      {/* Dialogs */}
      <AddTaskDialog
        open={isAddTaskOpen}
        onOpenChange={setIsAddTaskOpen}
      />

      {editingTask && (
        <EditTaskDialog
          open={!!editingTask}
          onOpenChange={(open) => !open && setEditingTask(null)}
          task={editingTask}
        />
      )}

      {selectedTask && (
        <TaskDetailsDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onStatusChange={handleStatusChange}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          currentUser={currentUser}
        />
      )}
    </DashboardLayout>
  );
};

export default StaffDashboard;


