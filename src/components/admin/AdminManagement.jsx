import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Plus, Edit, Trash2, KeyRound, Mail, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { getAllUsers, createUser, updateUser, deleteUser, resetUserPassword } from '@/services/userService';
import { getDepartments, getProjects } from '@/services/organizationService';
import { reportError } from '@/lib/reportError';

const ROLE_LABELS = {
  'department-head': 'Department Head',
  manager: 'Manager',
};

// Org-admins manage the two mid-tier roles here. They cannot create other
// org-admins (only master-admin does that, via org provisioning) — staff
// accounts are managed separately in Staff Management.
const AdminDialog = ({ open, onOpenChange, onSubmit, initialData = null, departments, projects }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'department-head',
    departmentId: '',
    projectId: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        password: '',
        phone: initialData.phone || '',
        role: initialData.role || 'department-head',
        departmentId: initialData.departmentIds?.[0] || '',
        projectId: initialData.projectIds?.[0] || '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'department-head',
        departmentId: '',
        projectId: '',
      });
    }
    setShowPassword(false);
  }, [initialData, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim()) {
      return;
    }
    if (!initialData && !formData.password) {
      return;
    }

    setLoading(true);
    await onSubmit(formData);
    setLoading(false);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface border-border text-foreground max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              {initialData ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <span>{initialData ? 'Edit Account' : 'Add Department Head / Manager'}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {!initialData && (
              <div>
                <Label className="text-foreground">Role *</Label>
                <Select value={formData.role} onValueChange={(v) => handleChange('role', v)}>
                  <SelectTrigger className="mt-2 surface border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="department-head">Department Head</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {!initialData && formData.role === 'department-head' && (
              <div>
                <Label className="text-foreground">Department *</Label>
                <Select value={formData.departmentId} onValueChange={(v) => handleChange('departmentId', v)}>
                  <SelectTrigger className="mt-2 surface border-border text-foreground">
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!initialData && formData.role === 'manager' && (
              <div>
                <Label className="text-foreground">Project *</Label>
                <Select value={formData.projectId} onValueChange={(v) => handleChange('projectId', v)}>
                  <SelectTrigger className="mt-2 surface border-border text-foreground">
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

            <div>
              <Label htmlFor="admin-name" className="text-foreground">
                Full Name *
              </Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="pl-10 surface border-border text-foreground"
                  placeholder="e.g., John Doe"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="admin-email" className="text-foreground">
                Email Address *
              </Label>
              <div className="relative mt-2">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="pl-10 surface border-border text-foreground"
                  placeholder="admin@example.com"
                  required
                  disabled={!!initialData}
                />
              </div>
              {initialData && (
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              )}
            </div>

            {!initialData && (
              <div>
                <Label htmlFor="admin-password" className="text-foreground">
                  Password *
                </Label>
                <div className="relative mt-2">
                  <KeyRound className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="pl-10 pr-10 surface border-border text-foreground"
                    placeholder="Enter strong password"
                    required={!initialData}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
              </div>
            )}

            <div>
              <Label htmlFor="admin-phone" className="text-foreground">
                Phone Number
              </Label>
              <Input
                id="admin-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className="mt-2 surface border-border text-foreground"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90"
              disabled={loading}
            >
              {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Account')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const AdminManagement = () => {
  const { currentUser } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    loadAdmins();
    loadOrgStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrgStructure = async () => {
    if (!currentUser?.orgId) return;
    try {
      const [depts, projs] = await Promise.all([
        getDepartments(currentUser.orgId),
        getProjects(currentUser.orgId),
      ]);
      setDepartments(depts);
      setProjects(projs);
    } catch (error) {
      console.error('Error loading departments/projects:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const orgId = currentUser?.orgId;
      const [deptHeads, managers] = await Promise.all([
        getAllUsers({ role: 'department-head', ...(orgId && { orgId }) }),
        getAllUsers({ role: 'manager', ...(orgId && { orgId }) }),
      ]);
      setAdmins([...deptHeads, ...managers]);
    } catch (error) {
      reportError(error, { title: "Error loading accounts" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      const isDeptHead = formData.role === 'department-head';
      if (isDeptHead && !formData.departmentId) {
        toast({ title: "Select a department", variant: "destructive" });
        return;
      }
      if (!isDeptHead && !formData.projectId) {
        toast({ title: "Select a project", variant: "destructive" });
        return;
      }

      await createUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        role: formData.role,
        designation: ROLE_LABELS[formData.role],
        orgId: currentUser?.orgId,
        ...(isDeptHead
          ? { departmentIds: [formData.departmentId] }
          : { projectIds: [formData.projectId] }),
      });

      toast({
        title: "Account created successfully",
        description: `${formData.name} has been added as a ${ROLE_LABELS[formData.role]}.`
      });

      setIsAddDialogOpen(false);
      loadAdmins();
    } catch (error) {
      reportError(error, { title: "Failed to create account" });
    }
  };

  const handleEdit = async (formData) => {
    try {
      await updateUser(currentAdmin.id, {
        name: formData.name,
        phone: formData.phone,
        // Email and role cannot be changed
      });

      toast({
        title: "Account updated successfully",
        description: `${formData.name}'s information has been updated.`
      });

      setIsEditDialogOpen(false);
      setCurrentAdmin(null);
      loadAdmins();
    } catch (error) {
      reportError(error, { title: "Failed to update account" });
    }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Are you sure you want to delete "${admin.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteUser(admin.id);

      toast({
        title: "Account deleted successfully",
        description: `${admin.name} has been removed.`
      });

      loadAdmins();
    } catch (error) {
      reportError(error, { title: "Failed to delete account" });
    }
  };

  const handleResetPassword = async (admin) => {
    if (!window.confirm(`Send password reset email to ${admin.email}?`)) {
      return;
    }

    try {
      await resetUserPassword(admin.email);

      toast({
        title: "Password reset email sent",
        description: `${admin.name} will receive an email with instructions to reset their password.`
      });
    } catch (error) {
      reportError(error, { title: "Failed to send reset email" });
    }
  };

  const openEditDialog = (admin) => {
    setCurrentAdmin(admin);
    setIsEditDialogOpen(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-foreground mb-2">Department Heads & Managers</h2>
          <p className="text-muted-foreground">Manage department head and manager accounts within your organization.</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-card w-full sm:w-auto"
          disabled={departments.length === 0 && projects.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      <Card className="surface p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="text-primary" />
            <span>Accounts ({admins.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary/30 mx-auto mb-4"></div>
              <p>Loading accounts...</p>
            </div>
          ) : admins.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {admins.map((admin) => (
                <motion.div
                  key={admin.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: admins.indexOf(admin) * 0.05 }}
                  className="p-4 rounded-xl bg-muted/60 border border-border"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-card">
                          <Shield className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{admin.name}</h3>
                          <p className="text-xs text-muted-foreground">{ROLE_LABELS[admin.role] || admin.role}</p>
                        </div>
                      </div>
                      <div className="space-y-1 ml-12">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span>{admin.email}</span>
                        </div>
                        {admin.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>📱</span>
                            <span>{admin.phone}</span>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Created: {admin.createdAt?.toDate ? new Date(admin.createdAt.toDate()).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-primary hover:bg-primary-soft hover:text-primary"
                        onClick={() => openEditDialog(admin)}
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-warning hover:bg-warning-soft hover:text-warning"
                        onClick={() => handleResetPassword(admin)}
                        title="Reset Password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive-soft hover:text-destructive"
                        onClick={() => handleDelete(admin)}
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">No accounts found.</h3>
              <p>
                {departments.length === 0 && projects.length === 0
                  ? 'Create a department or project first, then add a Department Head or Manager here.'
                  : 'Click "Add Account" to create a Department Head or Manager.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AdminDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAdd}
        departments={departments}
        projects={projects}
      />
      <AdminDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSubmit={handleEdit}
        initialData={currentAdmin}
        departments={departments}
        projects={projects}
      />
    </motion.div>
  );
};

export default AdminManagement;
