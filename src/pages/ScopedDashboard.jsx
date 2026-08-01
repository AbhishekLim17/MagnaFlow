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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getAllUsers, createUser } from '@/services/userService';
import DashboardLayout from '@/components/shared/DashboardLayout';
import StatCard from '@/components/shared/StatCard';
import { EmptyState, LoadingState } from '@/components/shared/States';
import ProjectGanttChart from '@/components/shared/ProjectGanttChart';
import TaskManagement from '@/components/admin/TaskManagementNew';
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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) return;
    setLoading(true);
    try {
      await createUser({
        name: form.name,
        email: form.email,
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
      <DialogContent className="surface border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-foreground">Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <div>
            <Label className="text-foreground">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <div>
            <Label className="text-foreground">Password *</Label>
            <Input type="password" minLength={6} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="mt-2 surface border-border text-foreground" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={loading}>
              {loading ? 'Creating...' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ScopedDashboard = ({ scope }) => {
  const cfg = SCOPE_CONFIG[scope];
  const { user } = useAuth();
  const { tasks, statistics, loading: tasksLoading } = useTasks();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

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
  ];

  const staffNameFor = (uid) => staff.find((s) => s.id === uid)?.name || null;

  const Overview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={statistics?.total ?? tasks.length} icon={CheckSquare} color="blue" index={0} />
        <StatCard title="In Progress" value={statistics?.inProgress ?? 0} icon={TrendingUp} color="indigo" index={1} />
        <StatCard title="Pending" value={statistics?.pending ?? 0} icon={Clock} color="slate" index={2} />
        <StatCard title="Completed" value={statistics?.completed ?? 0} icon={CheckSquare} color="green" index={3} />
      </div>

      <Card className="surface border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <GanttChartSquare className="text-primary" /> {cfg.noun} Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <LoadingState label="Loading timeline..." />
          ) : (
            <ProjectGanttChart tasks={tasks} getStaffName={staffNameFor} />
          )}
        </CardContent>
      </Card>
    </div>
  );

  const StaffRoster = () => (
    <Card className="surface border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Users className="text-primary" /> {cfg.noun} Staff ({staff.length})
        </CardTitle>
        <Button onClick={() => setIsAddStaffOpen(true)} className="bg-primary hover:bg-primary/90" disabled={!scopeId}>
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
              <div key={s.id} className="p-3 rounded-xl bg-muted/60 border border-border">
                <p className="text-foreground font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />{s.email}
                </p>
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
