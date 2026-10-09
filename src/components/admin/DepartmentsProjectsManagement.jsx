// Departments & Projects Management - org-admin CRUD for their own org's
// departments and projects. Department Heads/Managers are assigned to these
// via Admin Management (src/components/admin/AdminManagement.jsx).

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { reportError } from '@/lib/reportError';
import ProjectEmailIn from '@/components/admin/ProjectEmailIn';
import { CURRENCIES, DEFAULT_CURRENCY, formatMoney } from '@/lib/money';
import {
  getDepartments,
  createDepartment,
  deleteDepartment,
  getProjects,
  createProject,
  deleteProject,
} from '@/services/organizationService';

const DepartmentsProjectsManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDeptDialogOpen, setIsDeptDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [newProject, setNewProject] = useState({ name: '', departmentId: '', budget: '', currency: DEFAULT_CURRENCY });
  const [deptToDelete, setDeptToDelete] = useState(null);   // fix #11
  const [projectToDelete, setProjectToDelete] = useState(null); // fix #11

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAll = async () => {
    if (!user?.orgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [depts, projs] = await Promise.all([getDepartments(user.orgId), getProjects(user.orgId)]);
      setDepartments(depts);
      setProjects(projs);
    } catch (error) {
      reportError(error, { title: 'Error loading data' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    if (!newDeptName.trim()) return;
    try {
      await createDepartment(user.orgId, newDeptName.trim());
      toast({ title: 'Department created', description: `"${newDeptName}" has been added.` });
      setNewDeptName('');
      setIsDeptDialogOpen(false);
      loadAll();
    } catch (error) {
      reportError(error, { title: 'Failed to create department' });
    }
  };

  const handleDeleteDept = async (dept) => {
    // fix #11: opens AlertDialog instead of window.confirm
    setDeptToDelete(dept);
  };
  const confirmDeleteDept = async () => {
    if (!deptToDelete) return;
    try {
      await deleteDepartment(user.orgId, deptToDelete.id, deptToDelete.name);
      loadAll();
    } catch (error) {
      reportError(error, { title: 'Failed to delete department' });
    } finally {
      setDeptToDelete(null);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProject.name.trim() || !newProject.departmentId) return;
    try {
      await createProject(user.orgId, {
      name: newProject.name.trim(),
      departmentId: newProject.departmentId,
      budget: Number(newProject.budget) || 0,
      currency: newProject.currency || DEFAULT_CURRENCY,
    });
      toast({ title: 'Project created', description: `"${newProject.name}" has been added.` });
      setNewProject({ name: '', departmentId: '', budget: '', currency: DEFAULT_CURRENCY });
      setIsProjectDialogOpen(false);
      loadAll();
    } catch (error) {
      reportError(error, { title: 'Failed to create project' });
    }
  };

  const handleDeleteProject = (project) => {
    // fix #11, #16: open AlertDialog with orphan warning instead of window.confirm
    setProjectToDelete(project);
  };
  const confirmDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      await deleteProject(user.orgId, projectToDelete.id, projectToDelete.name);
      loadAll();
    } catch (error) {
      reportError(error, { title: 'Failed to delete project' });
    } finally {
      setProjectToDelete(null);
    }
  };

  const departmentName = (id) => departments.find(d => d.id === id)?.name || 'Unknown';

  // Legacy admin accounts (role 'admin', created before multi-tenancy) have no
  // orgId, so they can't own departments/projects. Show a clear message instead
  // of letting the org-scoped Firestore paths fail cryptically.
  if (!user?.orgId) {
    return (
      <div className="text-center py-16 text-muted-foreground max-w-lg mx-auto">
        <h2 className="text-xl font-semibold text-muted-foreground mb-2">No organization linked</h2>
        <p>
          This account isn't part of an organization, so it can't manage departments or projects.
          Sign in with an organization-admin account, or ask a master admin to provision one.
        </p>
      </div>
    );
  }

  return (
    <>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-8">
        <p className="text-muted-foreground">Create the departments and projects that Department Heads and Managers get assigned to.</p>
      </div>

      <Card className="p-6 mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="text-primary" /> Departments ({departments.length})
          </CardTitle>
          <Button onClick={() => setIsDeptDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Department
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : departments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No departments yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {departments.map((dept) => (
                <div key={dept.id} className="p-3 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
                  <span className="text-foreground">{dept.name}</span>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive-soft"
                    aria-label={`Delete department ${dept.name}`}
                    onClick={() => handleDeleteDept(dept)}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="text-primary" /> Projects ({projects.length})
          </CardTitle>
          <Button onClick={() => setIsProjectDialogOpen(true)} disabled={departments.length === 0}>
            <Plus className="w-4 h-4 mr-2" /> Add Project
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : projects.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {departments.length === 0 ? 'Create a department first.' : 'No projects yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((proj) => (
                <div key={proj.id} className="p-3 rounded-xl bg-muted/60 border border-border flex items-center justify-between">
                  <div>
                    <p className="text-foreground">{proj.name}</p>
                    <p className="text-xs text-muted-foreground">{departmentName(proj.departmentId)}</p>
                    {proj.budget > 0 && (
                      <p className="text-xs font-medium text-success mt-0.5">
                        Budget: {formatMoney(proj.budget, proj.currency)}
                      </p>
                    )}
                    <ProjectEmailIn
                      project={proj}
                      orgId={user?.orgId}
                      currentUser={user}
                      onChange={(inboxKey) => setProjects((list) => list.map((p) => (p.id === proj.id ? { ...p, inboxKey } : p)))}
                    />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive-soft"
                    aria-label={`Delete project ${proj.name}`}
                    onClick={() => handleDeleteProject(proj)}>
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDeptDialogOpen} onOpenChange={setIsDeptDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateDept} className="space-y-4 py-2">
            <div>
              <Label htmlFor="dp-department-name" className="text-foreground">Department Name *</Label>
              <Input id="dp-department-name" value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)}
                className="mt-2 surface border-border text-foreground" placeholder="e.g. Engineering" required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeptDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Project</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4 py-2">
            <div>
              <Label htmlFor="dp-project-name" className="text-foreground">Project Name *</Label>
              <Input id="dp-project-name" value={newProject.name} onChange={(e) => setNewProject(p => ({ ...p, name: e.target.value }))}
                className="mt-2 surface border-border text-foreground" placeholder="e.g. Website Redesign" required />
            </div>
            <div>
              <Label htmlFor="dp-department" className="text-foreground">Department *</Label>
              <Select value={newProject.departmentId} onValueChange={(v) => setNewProject(p => ({ ...p, departmentId: v }))}>
                <SelectTrigger id="dp-department" className="mt-2"><SelectValue placeholder="Select a department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="dp-budget-optional" className="text-foreground">Budget (optional)</Label>
                <Input id="dp-budget-optional" type="number" min="0" step="1" placeholder="e.g. 50000"
                  value={newProject.budget}
                  onChange={(e) => setNewProject(p => ({ ...p, budget: e.target.value }))}
                  className="mt-2 surface border-border text-foreground" />
              </div>
              <div>
                <Label htmlFor="dp-currency" className="text-foreground">Currency</Label>
                <Select value={newProject.currency} onValueChange={(v) => setNewProject(p => ({ ...p, currency: v }))}>
                  <SelectTrigger id="dp-currency" className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsProjectDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </motion.div>
      {/* Fix #11: Department delete confirmation */}
      <AlertDialog open={!!deptToDelete} onOpenChange={(o) => !o && setDeptToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deptToDelete?.name}&quot;? This does not delete its projects or tasks, but staff members
              will lose their department assignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteDept} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fix #11, #16: Project delete confirmation with orphan warning */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(o) => !o && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{projectToDelete?.name}&quot;?
              {' '}Any tasks, budget expenses, and client accounts linked to this project will become
              orphaned ? they will still exist in the database but no longer appear in any project view.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// Fix #11 confirm dialogs - rendered at module level to avoid nesting issues
// They are appended via a sibling render pattern instead.
// (Added to DepartmentsProjectsManagement return as siblings)

export default DepartmentsProjectsManagement;
