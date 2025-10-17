import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { 
  Users, Plus, Search, Edit3, Trash2, Mail, Phone, 
  Calendar, Award, Building, TrendingUp, Filter 
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDepartments } from '../../contexts/DepartmentsContext';
import { useDesignations } from '../../contexts/DesignationsContext';
import { useToast } from '../ui/use-toast';
import UserCard from '../UserCard';
import UserProfile from '../UserProfile';

const TIERS = ['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Principal', 'Alpha'];
const ROLES = ['admin', 'manager', 'staff'];

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form states for adding/editing users
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff',
    department: '',
    designation: '',
    tier: 'Junior',
    employeeId: '',
    phone: '',
    reportingTo: ''
  });

  const { getAllUsers, registerUser, updateUserInfo } = useAuth();
  const { departments } = useDepartments();
  const { designations } = useDesignations();
  const { toast } = useToast();

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Filter users when search term or filters change
  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, departmentFilter, tierFilter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const userData = await getAllUsers();
      setUsers(userData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.designation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    // Department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(user => user.department === departmentFilter);
    }

    // Tier filter
    if (tierFilter !== 'all') {
      filtered = filtered.filter(user => user.tier === tierFilter);
    }

    setFilteredUsers(filtered);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    // Prevent multiple submissions
    if (isSubmitting) return;
    
    setIsSubmitting(true);

    try {
      // Log the current form data for debugging
      console.log('🔍 Starting user creation with form data:', {
        name: formData.name,
        email: formData.email,
        password: formData.password ? '***PROVIDED***' : 'MISSING',
        role: formData.role,
        department: formData.department,
        tier: formData.tier,
        designation: formData.designation
      });

      // Comprehensive form validation
      const validationErrors = [];
      
      // Required field validation
      if (!formData.name?.trim()) validationErrors.push("Name is required");
      if (!formData.email?.trim()) validationErrors.push("Email is required");
      if (!formData.password?.trim()) validationErrors.push("Password is required");
      if (!formData.role) validationErrors.push("Role is required");
      if (!formData.department) validationErrors.push("Department is required");
      if (!formData.tier) validationErrors.push("Tier is required");
      
      // Validate tier is one of allowed values
      if (formData.tier && !TIERS.includes(formData.tier)) {
        validationErrors.push("Invalid tier selected");
      }
      
      // Role-tier compatibility validation
      if (formData.role === 'staff' && ['Lead', 'Principal'].includes(formData.tier)) {
        // Allow staff to have Lead/Principal tiers - they can be technical leads
        console.log('Staff member with leadership tier - this is allowed');
      }
      
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.email && !emailRegex.test(formData.email.trim())) {
        validationErrors.push("Please enter a valid email address");
      }
      
      // Password validation
      if (formData.password && formData.password.length < 6) {
        validationErrors.push("Password must be at least 6 characters");
      }
      
      // Employee ID uniqueness validation (if provided)
      if (formData.employeeId?.trim()) {
        const existingEmployeeId = users.find(u => u.employeeId === formData.employeeId.trim());
        if (existingEmployeeId) {
          validationErrors.push("Employee ID already exists");
        }
      }
      
      // Show validation errors
      if (validationErrors.length > 0) {
        console.log('❌ Validation errors:', validationErrors);
        toast({
          title: "Validation Error",
          description: validationErrors.join(", "),
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      
      // Check if email already exists in users list
      const existingUser = users.find(u => u.email === formData.email.trim().toLowerCase());
      if (existingUser) {
        console.log('❌ Email already exists:', formData.email);
        toast({
          title: "User Already Exists",
          description: `A user with email "${formData.email}" already exists.`,
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }

      // Sanitize form data
      const sanitizedData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        department: formData.department,
        designation: formData.designation?.trim() || null,
        tier: formData.tier,
        employeeId: formData.employeeId?.trim() || null,
        phone: formData.phone?.trim() || null,
        reportingTo: formData.reportingTo?.trim() || null,
        joiningDate: new Date()
      };
      
      console.log('🚀 Sending sanitized data to registerUser:', {
        ...sanitizedData,
        password: '***HIDDEN***'
      });
      
      const result = await registerUser(sanitizedData);
      console.log('📋 Registration result:', result);

      if (result.success) {
        console.log('✅ User created successfully');
        toast({
          title: "Success",
          description: `User "${sanitizedData.name}" created successfully!`
        });
        setShowAddUser(false);
        resetForm();
        fetchUsers(); // Refresh the user list
      } else {
        console.log('❌ Registration failed:', result.error);
        // Handle specific Firebase errors
        let errorMessage = "Failed to create user";
        
        if (result.error) {
          if (result.error.includes("email-already-in-use") || result.error.includes("already exists")) {
            errorMessage = "This email address is already registered";
          } else if (result.error.includes("weak-password")) {
            errorMessage = "Password is too weak. Please use at least 6 characters";
          } else if (result.error.includes("invalid-email")) {
            errorMessage = "Invalid email address format";
          } else if (result.error.includes("network")) {
            errorMessage = "Network error. Please check your internet connection";
          } else {
            errorMessage = result.error;
          }
        }
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.log('💥 Exception during user creation:', error);
      let errorMessage = "An unexpected error occurred";
      
      // Handle network errors
      if (error.message?.includes("network") || error.code === 'unavailable') {
        errorMessage = "Network error. Please check your internet connection";
      } else if (error.message?.includes("auth/")) {
        errorMessage = "Authentication error. Please try again";
      } else {
        errorMessage = error.message || "Failed to create user";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
      console.error("User creation exception:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async (userId, updateData) => {
    try {
      const result = await updateUserInfo(userId, updateData);
      if (result.success) {
        toast({
          title: "Success",
          description: "User updated successfully"
        });
        fetchUsers();
        return true;
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive"
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
      });
      return false;
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'staff',
      department: '',
      designation: '',
      tier: 'Junior',
      employeeId: '',
      phone: '',
      reportingTo: ''
    });
    setIsSubmitting(false);
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || deptId;
  };

  const getUserStats = () => {
    const stats = {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      managers: users.filter(u => u.role === 'manager').length,
      staff: users.filter(u => u.role === 'staff').length,
      active: users.filter(u => u.isActive).length
    };
    return stats;
  };

  const stats = getUserStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="space-y-6"
    >
      {/* Header and Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Users className="h-6 w-6 mr-2" />
            User Management
          </h2>
          <p className="text-gray-300">Manage user accounts, roles, and permissions</p>
        </div>
        
        <Dialog open={showAddUser} onOpenChange={(open) => {
          setShowAddUser(open);
          if (!open && !isSubmitting) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-gray-900/95 border-white/20">
            <DialogHeader>
              <DialogTitle className="text-white">Add New User</DialogTitle>
              <span id="add-user-desc" className="sr-only">Fill out the form to add a new user to the system.</span>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4" aria-describedby="add-user-desc">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-gray-300">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-gray-300">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="password" className="text-gray-300">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required
                    autoComplete="new-password"
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="employeeId" className="text-gray-300">Employee ID</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="role" className="text-gray-300">Role *</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="department" className="text-gray-300">Department *</Label>
                  <Select 
                    value={formData.department} 
                    onValueChange={(value) => setFormData({...formData, department: value})}
                    required
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments && departments.length > 0 ? departments.map(dept => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                      )) : (
                        <>
                          <SelectItem value="sales">Sales</SelectItem>
                          <SelectItem value="technical_submission">Technical Submission</SelectItem>
                          <SelectItem value="manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="after_sales">After-Sales</SelectItem>
                          <SelectItem value="rnd">R&D</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {(!departments || departments.length === 0) && (
                    <p className="text-sm text-yellow-400 mt-1">
                      Using default departments. Please configure departments in settings.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="designation" className="text-gray-300">Designation</Label>
                  <Select 
                    value={formData.designation} 
                    onValueChange={(value) => setFormData({...formData, designation: value})}
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select designation" />
                    </SelectTrigger>
                    <SelectContent>
                      {designations && designations.length > 0 ? designations.map(designation => (
                        <SelectItem key={designation} value={designation}>{designation}</SelectItem>
                      )) : (
                        <>
                          <SelectItem value="Engineer">Engineer</SelectItem>
                          <SelectItem value="Senior Engineer">Senior Engineer</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Director">Director</SelectItem>
                          <SelectItem value="Technician">Technician</SelectItem>
                          <SelectItem value="Supervisor">Supervisor</SelectItem>
                          <SelectItem value="Executive">Executive</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {(!designations || designations.length === 0) && (
                    <p className="text-sm text-yellow-400 mt-1">
                      Using default designations. Please configure designations in settings.
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="tier" className="text-gray-300">Tier</Label>
                  <Select value={formData.tier} onValueChange={(value) => {
                    console.log('Tier changed to:', value);
                    setFormData({...formData, tier: value});
                  }}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map(tier => (
                        <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs text-gray-400 mt-1">Selected: {formData.tier}</div>
                </div>
                <div>
                  <Label htmlFor="phone" className="text-gray-300">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <Label htmlFor="reportingTo" className="text-gray-300">Reporting To</Label>
                  <Input
                    id="reportingTo"
                    value={formData.reportingTo}
                    onChange={(e) => setFormData({...formData, reportingTo: e.target.value})}
                    placeholder="Manager's name"
                    className="bg-white/10 border-white/20 text-white placeholder-gray-400"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowAddUser(false); 
                    resetForm();
                  }}
                  disabled={isSubmitting}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="glass-effect p-4 text-center card-hover">
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <p className="text-sm text-gray-300">Total Users</p>
          </CardContent>
        </Card>
        <Card className="glass-effect p-4 text-center card-hover">
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-red-400">{stats.admins}</div>
            <p className="text-sm text-gray-300">Admins</p>
          </CardContent>
        </Card>
        <Card className="glass-effect p-4 text-center card-hover">
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-blue-400">{stats.managers}</div>
            <p className="text-sm text-gray-300">Managers</p>
          </CardContent>
        </Card>
        <Card className="glass-effect p-4 text-center card-hover">
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-green-400">{stats.staff}</div>
            <p className="text-sm text-gray-300">Staff</p>
          </CardContent>
        </Card>
        <Card className="glass-effect p-4 text-center card-hover">
          <CardContent className="p-0">
            <div className="text-2xl font-bold text-green-400">{stats.active}</div>
            <p className="text-sm text-gray-300">Active</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="glass-effect">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, email, designation, or employee ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder-gray-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-32 bg-white/10 border-white/20 text-white">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {TIERS.map(tier => (
                    <SelectItem key={tier} value={tier}>{tier}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <Card className="glass-effect">
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No users found</h3>
              <p className="text-gray-300">Try adjusting your search criteria or add a new user.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map(user => (
              <UserCard
                key={user.id}
                userData={user}
                showActions={true}
                onEdit={(userData) => {
                  try {
                    setSelectedUser(userData);
                    setShowUserProfile(true);
                  } catch (error) {
                    console.error('Error opening user profile:', error);
                    toast({
                      title: "Error",
                      description: "Failed to open user profile",
                      variant: "destructive"
                    });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* User Profile Dialog */}
      <Dialog open={showUserProfile} onOpenChange={(open) => {
        setShowUserProfile(open);
        if (!open) {
          setSelectedUser(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900/95 border-white/20">
          <DialogHeader>
            <DialogTitle className="text-white">User Profile</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <UserProfile
              userData={selectedUser}
              canEdit={true}
              onUpdate={handleUpdateUser}
            />
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default UserManagement;