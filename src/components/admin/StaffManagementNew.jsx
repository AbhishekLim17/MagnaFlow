// Staff Management Component - Admin can add, edit, view, and manage staff members
// Includes staff list, add/edit dialogs, and status management

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, UserCheck, UserX, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useToast } from '@/components/ui/use-toast';
import { useDesignations } from '@/contexts/DesignationsContext';
import StaffFormDialog from '@/components/admin/StaffFormDialog';
import { useAuth } from '@/contexts/AuthContext';
import { getDepartments, getProjects } from '@/services/organizationService';
import { reportError } from '@/lib/reportError';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
  getPendingAuthCleanups,
  markAuthCleanupDone,
} from '@/services/userService';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [deletedUserEmail, setDeletedUserEmail] = useState(null); // Track deleted user email for Firebase cleanup guide
  const [showCleanupGuide, setShowCleanupGuide] = useState(false); // Show cleanup guide after deletion
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    designation: '',
    status: 'active',
    departmentId: '',
    projectId: '',
  });

  // Departments/projects a staff member can be assigned to. Without an
  // assignment, department heads and managers can't see their own people.
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);

  // Removed users whose Firebase Auth sign-in still exists (their email stays
  // reserved until it's deleted in the console).
  const [pendingCleanups, setPendingCleanups] = useState([]);

  const { designations } = useDesignations();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadStaff();
    loadOrgStructure();
    loadPendingCleanups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPendingCleanups = async () => {
    setPendingCleanups(await getPendingAuthCleanups(currentUser?.orgId));
  };

  const handleMarkCleanupDone = async (uid) => {
    try {
      await markAuthCleanupDone(uid);
      loadPendingCleanups();
    } catch (error) {
      reportError(error, { title: 'Could not update' });
    }
  };

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

  // Translate the two single-select fields into the array fields the data
  // model and security rules use.
  const scopeFields = () => ({
    departmentIds: formData.departmentId ? [formData.departmentId] : [],
    projectIds: formData.projectId ? [formData.projectId] : [],
  });

  const loadStaff = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers({ role: 'staff' });
      setStaff(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load staff members.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async () => {
    if (!formData.name || !formData.email || !formData.password) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createUser({
        ...formData,
        ...scopeFields(),
        role: 'staff',
      });

      toast({
        title: "✅ Staff Added Successfully!",
        description: `${formData.name} has been added and can now login.`,
      });
      
      setIsAddDialogOpen(false);
      resetForm();
      
      // Wait a bit for Firestore to propagate, then reload
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadStaff();
    } catch (error) {
      // Simple error message for duplicate email
      if (error.message && error.message.includes('Email already registered')) {
        toast({
          title: "⚠️ Email Already Exists",
          description: "This email is already registered. Use a different email, or remove the old sign-in from Firebase Console → Authentication.",
          variant: "destructive",
          duration: 5000,
        });
      } else {
        reportError(error, { title: "Error", fallback: "Failed to add staff member." });
      }
    }
  };

  const handleEditStaff = async () => {
    if (!formData.name || !formData.email) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateUser(selectedStaff.id, {
        name: formData.name,
        designation: formData.designation,
        status: formData.status,
        ...scopeFields(),
      });
      
      toast({
        title: "Staff Updated",
        description: `${formData.name}'s information has been updated.`,
      });
      
      setIsEditDialogOpen(false);
      resetForm();
      
      // Wait for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadStaff();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update staff member.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;

    try {
      await deleteUser(staffToDelete.id);
      
      // Set the deleted user's email and show cleanup guide
      setDeletedUserEmail(staffToDelete.email);
      setShowCleanupGuide(true);
      
      toast({
        title: "✅ Staff Deleted from Portal",
        description: `${staffToDelete.name} removed. Firebase Auth cleanup required.`,
        duration: 5000,
      });
      
      setDeleteDialogOpen(false);
      setStaffToDelete(null);
      
      // Wait for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadStaff();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete staff member.",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (staffMember) => {
    try {
      if (staffMember.status === 'active') {
        await deactivateUser(staffMember.id);
        toast({
          title: "Staff Deactivated",
          description: `${staffMember.name} has been deactivated.`,
        });
      } else {
        await activateUser(staffMember.id);
        toast({
          title: "Staff Activated",
          description: `${staffMember.name} has been activated.`,
        });
      }
      
      // Wait for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadStaff();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update staff status.",
        variant: "destructive",
      });
    }
  };

  const handleResetPassword = async (staffMember) => {
    try {
      await resetUserPassword(staffMember.email);
      toast({
        title: "Password Reset Email Sent",
        description: `A password reset link has been sent to ${staffMember.email}.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send password reset email.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (staffMember) => {
    setSelectedStaff(staffMember);
    setFormData({
      name: staffMember.name,
      email: staffMember.email,
      password: '',
      designation: staffMember.designation || '',
      status: staffMember.status || 'active',
      departmentId: staffMember.departmentIds?.[0] || '',
      projectId: staffMember.projectIds?.[0] || '',
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (staffMember) => {
    setStaffToDelete(staffMember);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      designation: '',
      status: 'active',
      departmentId: '',
      projectId: '',
    });
    setSelectedStaff(null);
  };

  const filteredStaff = staff.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (member.designation && member.designation.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-muted-foreground mt-1">Manage your team members and their roles</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-card"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Leftover Firebase Auth accounts from deleted users. Their email stays
          reserved until removed in the console, which otherwise silently blocks
          re-adding that person. */}
      {pendingCleanups.length > 0 && (
        <Card className="surface border-warning/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-warning">
                {pendingCleanups.length} removed {pendingCleanups.length === 1 ? 'account still has' : 'accounts still have'} a Firebase sign-in
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Their email addresses stay reserved until deleted in Firebase Console → Authentication.
                Mark each one done once you have removed it.
              </p>
              <ul className="space-y-2">
                {pendingCleanups.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 text-sm bg-muted/60 border border-border rounded px-3 py-2">
                    <span className="truncate">
                      <span className="text-foreground">{c.name || 'Unnamed'}</span>
                      <span className="text-muted-foreground"> · {c.email}</span>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border text-foreground flex-shrink-0"
                      onClick={() => handleMarkCleanupDone(c.id)}
                    >
                      Mark done
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Search */}
      <Card className="surface border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Search staff by name, email, or designation..."
            aria-label="Search staff"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted border-border"
          />
        </div>
      </Card>

      {/* Staff List */}
      <Card className="surface border-border">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary/30"></div>
              <p className="mt-4 text-muted-foreground">Loading staff...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No staff members found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((member, index) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="surface border-border hover:border-border transition-all duration-300">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold shadow-card">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold">{member.name}</h4>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <Badge className={member.status === 'active' ? 'bg-success-soft text-success border-success/30' : 'bg-destructive-soft text-destructive border-destructive/30'}>
                          {member.status || 'active'}
                        </Badge>
                      </div>
                      
                      {member.designation && (
                        <div className="mb-4">
                          <Badge variant="outline" className="border-border text-muted-foreground">
                            {member.designation}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-primary/30 text-primary hover:bg-primary-soft"
                            onClick={() => openEditDialog(member)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive-soft"
                            onClick={() => openDeleteDialog(member)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex-1 ${member.status === 'active' ? 'border-warning/30 text-warning hover:bg-warning-soft' : 'border-success/30 text-success hover:bg-success-soft'}`}
                            onClick={() => handleToggleStatus(member)}
                          >
                            {member.status === 'active' ? (
                              <><UserX className="w-4 h-4 mr-1" />Deactivate</>
                            ) : (
                              <><UserCheck className="w-4 h-4 mr-1" />Activate</>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-primary/30 text-primary hover:bg-primary-soft"
                            onClick={() => handleResetPassword(member)}
                          >
                            <KeyRound className="w-4 h-4 mr-1" />
                            Reset
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <StaffFormDialog
        mode="add"
        open={isAddDialogOpen}
        onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}
        formData={formData}
        setFormData={setFormData}
        designations={designations}
        departments={departments}
        projects={projects}
        onSubmit={handleAddStaff}
        onCancel={() => { setIsAddDialogOpen(false); resetForm(); }}
      />

      <StaffFormDialog
        mode="edit"
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={formData}
        setFormData={setFormData}
        designations={designations}
        departments={departments}
        projects={projects}
        onSubmit={handleEditStaff}
        onCancel={() => { setIsEditDialogOpen(false); resetForm(); }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {staffToDelete?.name}'s account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaffToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Firebase Auth Cleanup Guide Dialog */}
      <Dialog open={showCleanupGuide} onOpenChange={setShowCleanupGuide}>
        <DialogContent className="bg-background border-border max-w-3xl">
          <DialogHeader>
            <DialogTitle>⚠️ Firebase Auth Cleanup Required</DialogTitle>
            <DialogDescription>
              The user has been deleted from the portal, but you need to manually delete them from Firebase Authentication.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please follow these steps to complete the deletion:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Go to Firebase Console</li>
              <li>Navigate to Authentication</li>
              <li>Find and delete user: <code className="text-warning">{deletedUserEmail}</code></li>
            </ol>
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => {
                setShowCleanupGuide(false);
                setDeletedUserEmail(null);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffManagement;
