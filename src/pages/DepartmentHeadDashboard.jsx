// Department Head Dashboard - tasks and staff roster scoped to the head's
// own department(s). Can create new staff, auto-assigned into the department.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut, CheckSquare, Users, Plus, Mail, GanttChartSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useTasks } from '@/contexts/TasksContext';
import { useToast } from '@/components/ui/use-toast';
import { getAllUsers, createUser } from '@/services/userService';
import ProjectGanttChart from '@/components/shared/ProjectGanttChart';

const AddStaffDialog = ({ open, onOpenChange, onCreated, orgId, departmentId }) => {
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
        departmentIds: [departmentId],
      });
      toast({ title: 'Staff account created', description: `${form.name} has been added to your department.` });
      setForm({ name: '', email: '', password: '' });
      onOpenChange(false);
      onCreated();
    } catch (error) {
      console.error('Error creating staff:', error);
      toast({ title: 'Failed to create staff', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle>Add Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div>
            <Label className="text-gray-200">Name *</Label>
            <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <div>
            <Label className="text-gray-200">Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <div>
            <Label className="text-gray-200">Password *</Label>
            <Input type="password" minLength={6} value={form.password} onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
              className="mt-2 glass-effect border-white/20 text-white" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
              {loading ? 'Creating...' : 'Create Staff'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const priorityBadge = (priority) => ({
  critical: 'bg-red-500/10 text-red-400 border-red-500/50',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/50',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50',
  low: 'bg-green-500/10 text-green-400 border-green-500/50',
}[priority] || 'bg-gray-500/10 text-gray-400 border-gray-500/50');

const DepartmentHeadDashboard = () => {
  const { user, logout } = useAuth();
  const { tasks, loading: tasksLoading } = useTasks();
  const { toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);

  const departmentId = user?.departmentIds?.[0];

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStaff = async () => {
    try {
      setStaffLoading(true);
      const data = await getAllUsers({ role: 'staff', departmentIds: user?.departmentIds || [] });
      setStaff(data);
    } catch (error) {
      console.error('Error loading department staff:', error);
      toast({ title: 'Error loading staff', description: error.message, variant: 'destructive' });
    } finally {
      setStaffLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Department Dashboard</h1>
            <p className="text-gray-300">{user?.name} · Department Head</p>
          </div>
          <Button onClick={handleLogout} variant="outline" className="border-white/20 text-white">
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>

        <Card className="glass-effect p-6 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CheckSquare className="text-purple-300" /> Department Tasks ({tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasksLoading ? (
              <div className="text-center py-8 text-gray-400">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No tasks in your department yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div key={task.id} className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{task.title}</p>
                      <p className="text-xs text-gray-400">{task.status}</p>
                    </div>
                    <Badge className={priorityBadge(task.priority)}>{task.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-effect p-6 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <GanttChartSquare className="text-purple-300" /> Department Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectGanttChart tasks={tasks} getStaffName={(uid) => staff.find((s) => s.id === uid)?.name || null} />
          </CardContent>
        </Card>

        <Card className="glass-effect p-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="text-purple-300" /> Department Staff ({staff.length})
            </CardTitle>
            <Button
              onClick={() => setIsAddStaffOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={!departmentId}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Staff
            </Button>
          </CardHeader>
          <CardContent>
            {staffLoading ? (
              <div className="text-center py-8 text-gray-400">Loading staff...</div>
            ) : staff.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No staff in your department yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {staff.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-white font-medium">{s.name}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AddStaffDialog
        open={isAddStaffOpen}
        onOpenChange={setIsAddStaffOpen}
        onCreated={loadStaff}
        orgId={user?.orgId}
        departmentId={departmentId}
      />
    </div>
  );
};

export default DepartmentHeadDashboard;
