// ScopedDashboard - one dashboard serving both Department Heads and Managers.
//
// These two roles are structurally identical: each owns a scope (a department
// or a project), sees the tasks and staff inside it, and can manage both. They
// previously lived in two 91%-identical files; the only real differences are
// which user field holds the scope ids and the nouns shown in the UI, so they
// are expressed as config below.

import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Plus,
  Mail,
  GanttChartSquare,
  Clock,
  TrendingUp,
  AlertTriangle,
  KeyRound,
  Trash2,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter  } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getAllUsers, createUser, deleteUser, resetUserPassword } from '@/services/userService';
import DashboardLayout from '@/components/shared/DashboardLayout';
import StatCard from '@/components/shared/StatCard';
import { useConfirm } from '@/components/shared/ConfirmDialog';
import PasswordField from '@/components/shared/PasswordField';
import FieldError from '@/components/shared/FieldError';
import { validateNewAccount } from '@/lib/accountForm';
import { EmptyState, LoadingState } from '@/components/shared/States';
import ProjectGanttChart from '@/components/shared/ProjectGanttChart';
import { canEditTask } from '@/lib/taskPermissions';
import MyTasksPanel from '@/components/shared/MyTasksPanel';
import TaskManagement from '@/components/admin/TaskManagementNew';
import ClientRequestsInbox from '@/components/admin/ClientRequestsInbox';
import { reportError } from '@/lib/reportError';

export const SCOPE_CONFIG = {
  department: {
    noun: 'Department',
    roleLabel: 'Department Head',
    subtitle: 'Department Panel',
    basePath: '/department',
    // which field on the user doc holds this role's scope ids
    scopeIdsKey: 'departmentIds',
    // which getAllUsers filter matches staff inside that scope
    staffFilterKey: 'departmentIds',
  },
  project: {
    noun: 'Project',
    roleLabel: 'Manager',
    subtitle: 'Manager Panel',
    basePath: '/manager',
    scopeIdsKey: 'projectIds',
    staffFilterKey: 'projectIds',
  },
};

const AddStaffDialog = ({ open, onOpenChange, onCreated, orgId, scopeIdsKey, scopeId, noun }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const change = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const { [field]: _fixed, ...rest } = prev;
      return rest;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problems = validateNewAccount(form);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      return;
    }
    setLoading(true);
    try {
      await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: 'staff',
        designation: 'Staff',
        orgId,
        [scopeIdsKey]: [scopeId],
      });
      toast({
        title: 'Staff account created',
        description: `${form.name} has been added to your ${noun.toLowerCase()}.`,
      });
      setForm({ name: '', email: '', password: '' });
      setErrors({});
      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error('Error creating staff:', error);
      reportError(error, { title: 'Failed to create staff' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4 py-2">
          <div>
            <Label htmlFor="add-staff-name" className="text-foreground">Name *</Label>
            <Input id="add-staff-name" value={form.name} onChange={(e) => change('name', e.target.value)}
              autoComplete="off" className="mt-2 surface border-border text-foreground"
              aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? 'add-staff-name-error' : undefined} />
            <FieldError id="add-staff-name-error">{errors.name}</FieldError>
          </div>
          <div>
            <Label htmlFor="add-staff-email" className="text-foreground">Email *</Label>
            <Input id="add-staff-email" type="email" value={form.email} onChange={(e) => change('email', e.target.value)}
              autoComplete="off" placeholder="name@company.com" className="mt-2 surface border-border text-foreground"
              aria-invalid={errors.email ? true : undefined} aria-describedby={errors.email ? 'add-staff-email-error' : undefined} />
            <FieldError id="add-staff-email-error">{errors.email}</FieldError>
          </div>
          <PasswordField
            id="add-staff-password"
            value={form.password}
            onChange={(v) => change('password', v)}
            email={form.email}
            error={errors.password}
            generate
            hint="At least 8 characters. Share it with them securely; they can change it after signing in."
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ScopedDashboard = ({ scope }) => {
  const confirm = useConfirm();
  const cfg = SCOPE_CONFIG[scope];
  const { user } = useAuth();
  const { tasks, statistics, loading: tasksLoading, rescheduleTask } = useTasks();
  const navigate = useNavigate();
  const location = useLocation();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState(null);

  // A head or manager owns their scope, so they can reset a password or remove
  // someone without waiting on an org admin. Both are limited to staff inside
  // that scope by the security rules, not just by this UI.
  const handleResetPassword = async (member) => {
    const ok = await confirm({
      title: 'Send a password reset email?',
      description: <p>{member.name} ({member.email}) will receive a link to choose a new password.</p>,
      confirmLabel: 'Send link',
    });
    if (!ok) return;
    setBusyStaffId(member.id);
    try {
      await resetUserPassword(member.email);
      toast({
        title: 'Reset link sent',
        description: `${member.name} can set a new password from the email.`,
      });
    } catch (error) {
      reportError(error, { title: 'Could not send the reset link' });
    } finally {
      setBusyStaffId(null);
    }
  };

  const handleRemoveStaff = async (member) => {
    const ok = await confirm({
      title: `Remove ${member.name}?`,
      description: <p>Their account is deleted and they lose access immediately. Tasks assigned to them stay assigned until you reassign them.</p>,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setBusyStaffId(member.id);
    try {
      await deleteUser(member.id);
      toast({ title: 'Staff removed', description: `${member.name} no longer has access.` });
      loadStaff();
    } catch (error) {
      reportError(error, { title: 'Could not remove staff' });
    } finally {
      setBusyStaffId(null);
    }
  };

  const scopeIds = user?.[cfg.scopeIdsKey] || [];
  const scopeId = scopeIds[0];

  useEffect(() => {
    const path = location.pathname.split(`${cfg.basePath}/`)[1] || 'dashboard';
    setActiveTab(path === '' ? 'dashboard' : path);
  }, [location, cfg.basePath]);

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const loadStaff = async () => {
    try {
      setStaffLoading(true);
      const data = await getAllUsers({ role: 'staff', [cfg.staffFilterKey]: scopeIds });
      setStaff(data);
    } catch (error) {
      console.error('Error loading staff:', error);
      reportError(error, { title: 'Error loading staff' });
    } finally {
      setStaffLoading(false);
    }
  };

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    navigate(`${cfg.basePath}/${tab === 'dashboard' ? '' : tab}`);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: `${cfg.noun} Tasks`, icon: CheckSquare },
    { id: 'staff', label: `${cfg.noun} Staff`, icon: Users },
    { id: 'requests', label: 'Client Requests', icon: Inbox },
  ];

  const staffNameFor = (uid) => staff.find((s) => s.id === uid)?.name || null;

  const Overview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={statistics?.total ?? tasks.length} icon={CheckSquare} color="blue" index={0} loading={tasksLoading} />
        <StatCard title="In Progress" value={statistics?.inProgress ?? 0} icon={TrendingUp} color="indigo" index={1} loading={tasksLoading} />
        <StatCard title="Pending" value={statistics?.pending ?? 0} icon={Clock} color="slate" index={2} loading={tasksLoading} />
        <StatCard title="Completed" value={statistics?.completed ?? 0} icon={CheckSquare} color="green" index={3} loading={tasksLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <GanttChartSquare className="text-primary" /> {cfg.noun} Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <LoadingState label="Loading timeline..." />
          ) : (
            <ProjectGanttChart
              tasks={tasks}
              getStaffName={staffNameFor}
              canReschedule={(task) => canEditTask(user, task)}
              onReschedule={(task, dates) => rescheduleTask(task, dates)}
            />
          )}
        </CardContent>
      </Card>

      {/* A head or manager is assigned work too; the rollup above never showed it. */}
      <MyTasksPanel tasks={tasks} userId={user?.id || user?.uid} />
    </div>
  );

  const StaffRoster = () => (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Users className="text-primary" /> {cfg.noun} Staff ({staff.length})
        </CardTitle>
        <Button onClick={() => setIsAddStaffOpen(true)} disabled={!scopeId}>
          <Plus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </CardHeader>
      <CardContent>
        {staffLoading ? (
          <LoadingState label="Loading staff..." />
        ) : staff.length === 0 ? (
          <EmptyState
            icon={Users}
            title={`No staff in your ${cfg.noun.toLowerCase()} yet.`}
            hint={scopeId ? 'Use "Add Staff" to create the first one.' : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {staff.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/60 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" />
                    {s.email}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Send a password reset link to ${s.name}`}
                    disabled={busyStaffId === s.id}
                    onClick={() => handleResetPassword(s)}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${s.name}`}
                    disabled={busyStaffId === s.id}
                    onClick={() => handleRemoveStaff(s)}
                    className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // A department head / manager with no scope assigned can't do anything useful.
  if (!scopeId) {
    return (
      <DashboardLayout
        subtitle={cfg.subtitle}
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={navigateToTab}
        title={`${cfg.roleLabel} Dashboard`}
      >
        <EmptyState
          icon={AlertTriangle}
          title={`No ${cfg.noun.toLowerCase()} assigned to your account.`}
          hint={`Ask an organization admin to assign you to a ${cfg.noun.toLowerCase()}.`}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      subtitle={cfg.subtitle}
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={navigateToTab}
      title={menuItems.find((m) => m.id === activeTab)?.label || `${cfg.roleLabel} Dashboard`}
    >
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/tasks" element={<TaskManagement />} />
          <Route path="/staff" element={<StaffRoster />} />
          <Route path="/requests" element={<ClientRequestsInbox />} />
        </Routes>
      </motion.div>

      <AddStaffDialog
        open={isAddStaffOpen}
        onOpenChange={setIsAddStaffOpen}
        onCreated={loadStaff}
        orgId={user?.orgId}
        scopeIdsKey={cfg.scopeIdsKey}
        scopeId={scopeId}
        noun={cfg.noun}
      />
    </DashboardLayout>
  );
};

export default ScopedDashboard;
