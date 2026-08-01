// Task Management Component - Admin can create, edit, delete, and assign tasks to staff
// Includes task list, filters, search, and dialogs for CRUD operations

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, Calendar, User, MessageSquare, ListChecks } from 'lucide-react';
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
import { getAllUsers } from '@/services/userService';
import { getProjects } from '@/services/organizationService';
import { useCommentCount } from '@/hooks/useCommentCount';
import { useSubtaskCount } from '@/hooks/useSubtaskCount';
import TaskDetailsDialog from '@/components/staff/TaskDetailsDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Admin Task Card with Comment Button
const AdminTaskCard = ({ task, index, onEdit, onDelete, onCommentClick, getStaffName, getPriorityBadge, getStatusBadge, formatDate }) => {
  const commentCount = useCommentCount(task.id);
  const subtaskCounts = useSubtaskCount(task.id);

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
              <h4 className="font-semibold text-lg mb-2">{task.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
            </div>
            <div className="ml-4 flex space-x-2">
              <Badge className={`${getPriorityBadge(task.priority)} border`}>
                {task.priority}
              </Badge>
              <Badge className={`${getStatusBadge(task.status)} border`}>
                {task.status}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" />
                <span>{getStaffName(task.assignedTo)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(task.deadline)}</span>
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
                onClick={() => onCommentClick(task)}
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
            
            <div className="flex items-center space-x-2">
              <Button
                size="sm"
                variant="outline"
                className="border-primary/30 text-primary hover:bg-primary-soft"
                onClick={() => onEdit(task)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/30 text-destructive hover:bg-destructive-soft"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

const TaskManagement = () => {
  const { tasks, loading, createTask, updateTask, deleteTask, refreshTasks } = useTasks();
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [staff, setStaff] = useState([]);        // assignable in this scope
  const [projects, setProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskForComments, setTaskForComments] = useState(null);
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
    refreshTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "New Task" elsewhere in the app links here with ?new=1 so the create
  // dialog opens straight away instead of just landing on the list. The param
  // is stripped afterwards so a refresh doesn't reopen it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('new') === '1') {
      setIsAddDialogOpen(true);
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const loadStaff = async () => {
    try {
      // Scoped roles may only assign work to staff inside their own
      // department/project; org-admins can assign to anyone in the org.
      const filters = { role: 'staff' };
      if (isDeptHead) filters.departmentIds = currentUser?.departmentIds || [];
      if (isManager) filters.projectIds = currentUser?.projectIds || [];
      const staffList = await getAllUsers(filters);
      setStaff(staffList);
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

  // Build the task payload, attaching the selected project (and its department,
  // so department-heads see the task too) for the Gantt view. Scoped roles fall
  // back to their own project/department when they don't pick one explicitly.
  const buildTaskPayload = () => {
    let projectId = formData.projectId || undefined;
    if (!projectId && isManager) projectId = currentUser?.projectIds?.[0];

    const project = projects.find((p) => p.id === projectId);
    let departmentId = project?.departmentId || undefined;
    if (!departmentId && isDeptHead) departmentId = currentUser?.departmentIds?.[0];

    return { ...formData, projectId, departmentId };
  };

  const handleAddTask = async () => {
    if (!formData.title || !formData.assignedTo) {
      toast({
        title: "Validation Error",
        description: "Please fill in title and assign to a staff member.",
        variant: "destructive",
      });
      return;
    }

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
    });
    setSelectedTask(null);
  };

  const formatDateForInput = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toISOString().split('T')[0];
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'No deadline';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // A scoped manager/department-head can only read user docs inside their own
  // scope (enforced by the Firestore rules), so a task assigned to someone
  // outside it can't be resolved to a name. Say that plainly rather than
  // mislabelling an assigned task as "Unassigned".
  const getStaffName = (userId) => {
    if (!userId) return 'Unassigned';
    const known = staff.find((s) => s.id === userId);
    if (known) return known.name || known.email;
    return isScoped ? 'Outside your team' : 'Unassigned';
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      low: 'bg-success-soft text-success border-success/30',
      medium: 'bg-warning-soft text-warning border-warning/30',
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
    };
    return styles[status] || styles.pending;
  };

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (task.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground mt-1">Create and assign tasks to your team</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)} variant="success"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-muted">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-muted">
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
        </div>
      </Card>

      {/* Tasks List */}
      <Card>
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary/30"></div>
              <p className="mt-4 text-muted-foreground">Loading tasks...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No tasks found</p>
            </div>
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

      <TaskFormDialog
        mode="add"
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        formData={formData}
        setFormData={setFormData}
        staff={staff}
        projects={projects}
        onSubmit={handleAddTask}
        onCancel={() => { setIsAddDialogOpen(false); resetForm(); }}
      />

      <TaskFormDialog
        mode="edit"
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={formData}
        setFormData={setFormData}
        staff={staff}
        projects={projects}
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
        />
      )}
    </div>
  );
};

export default TaskManagement;
