// Staff Management Component - Admin can add, edit, view, and manage staff members
// Includes staff list, add/edit dialogs, and status management

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit, Trash2, UserCheck, UserX, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import QuickDeletionGuide from './QuickDeletionGuide';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useDesignations } from '@/contexts/DesignationsContext';
import {
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  activateUser,
  deactivateUser,
  resetUserPassword,
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
  });

  const { designations } = useDesignations();
  const { toast } = useToast();

  useEffect(() => {
    loadStaff();
  }, []);

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
          description: "This email is already registered. Check the System tab or use a different email.",
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to add staff member.",
          variant: "destructive",
        });
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
          <p className="text-gray-400 mt-1">Manage your team members and their roles</p>
        </div>
        <Button
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff
        </Button>
      </div>

      {/* Search */}
      <Card className="glass-effect border-gray-800 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search staff by name, email, or designation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700"
          />
        </div>
      </Card>

      {/* Staff List */}
      <Card className="glass-effect border-gray-800">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">Loading staff...</p>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No staff members found</p>
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
                  <Card className="glass-effect border-gray-800 hover:border-gray-700 transition-all duration-300">
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                            {member.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-semibold">{member.name}</h4>
                            <p className="text-sm text-gray-400">{member.email}</p>
                          </div>
                        </div>
                        <Badge className={member.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}>
                          {member.status || 'active'}
                        </Badge>
                      </div>
                      
                      {member.designation && (
                        <div className="mb-4">
                          <Badge variant="outline" className="border-gray-700 text-gray-300">
                            {member.designation}
                          </Badge>
                        </div>
                      )}
                      
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                            onClick={() => openEditDialog(member)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                            onClick={() => openDeleteDialog(member)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className={`flex-1 ${member.status === 'active' ? 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10' : 'border-green-500/50 text-green-400 hover:bg-green-500/10'}`}
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
                            className="flex-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
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

      {/* Add Staff Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
        setIsAddDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <DialogDescription>
              Create a new staff account. They will be able to log in with these credentials.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
                className="bg-gray-800/50 border-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
                className="bg-gray-800/50 border-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
                className="bg-gray-800/50 border-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="designation">Designation</Label>
              <Select
                value={formData.designation}
                onValueChange={(value) => setFormData({ ...formData, designation: value })}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-700">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((designation) => (
                    <SelectItem key={designation.id} value={designation.name}>
                      {designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleAddStaff}>Add Staff</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
            <DialogDescription>
              Update staff member information. Email cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-gray-800/50 border-gray-700"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                value={formData.email}
                disabled
                className="bg-gray-800/50 border-gray-700 opacity-50 cursor-not-allowed"
              />
            </div>
            <div>
              <Label htmlFor="edit-designation">Designation</Label>
              <Select
                value={formData.designation}
                onValueChange={(value) => setFormData({ ...formData, designation: value })}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-700">
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {designations.map((designation) => (
                    <SelectItem key={designation.id} value={designation.name}>
                      {designation.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-gray-800/50 border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={handleEditStaff}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {staffToDelete?.name}'s account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStaffToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Firebase Auth Cleanup Guide Dialog */}
      <Dialog open={showCleanupGuide} onOpenChange={setShowCleanupGuide}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle>⚠️ Firebase Auth Cleanup Required</DialogTitle>
            <DialogDescription>
              The user has been deleted from the portal, but you need to manually delete them from Firebase Authentication.
            </DialogDescription>
          </DialogHeader>
          
          <QuickDeletionGuide email={deletedUserEmail} />
          
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
