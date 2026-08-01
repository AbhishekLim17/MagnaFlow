import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  Calendar,
  UserCheck,
  UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AddStaffDialog from './AddStaffDialog';
import EditStaffDialog from './EditStaffDialog';

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const { toast } = useToast();
  const { registerUser } = useAuth();

  useEffect(() => {
    const savedStaff = localStorage.getItem('projectflow_staff');
    if (savedStaff) {
      const staffData = JSON.parse(savedStaff);
      setStaff(staffData);
    } else {
      const sampleStaff = [
        { id: 1, name: 'Sarah Johnson', email: 'sarah.johnson@company.com', phone: '+1 (555) 123-4567', role: 'Frontend Developer', status: 'active', joinDate: '2023-01-15', tasksCompleted: 24, tasksInProgress: 3 },
        { id: 2, name: 'Mike Chen', email: 'mike.chen@company.com', phone: '+1 (555) 234-5678', role: 'Backend Developer', status: 'active', joinDate: '2023-02-20', tasksCompleted: 18, tasksInProgress: 5 },
        { id: 3, name: 'Emma Davis', email: 'emma.davis@company.com', phone: '+1 (555) 345-6789', role: 'UI/UX Designer', status: 'inactive', joinDate: '2023-03-10', tasksCompleted: 12, tasksInProgress: 1 }
      ];
      setStaff(sampleStaff);
      localStorage.setItem('projectflow_staff', JSON.stringify(sampleStaff));
    }
  }, []);

  useEffect(() => {
    const filtered = staff.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.role.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStaff(filtered);
  }, [staff, searchTerm]);

  const handleAddStaff = (newStaffData) => {
    const { name, email, password } = newStaffData;
    
    // Register the user account first
    const registrationResult = registerUser({ name, email, password, role: 'staff' });

    if (!registrationResult.success) {
      toast({
        title: "Failed to add staff",
        description: registrationResult.error,
        variant: "destructive",
      });
      return;
    }

    // Now add to the staff list for display/management
    const staffWithId = {
      ...newStaffData,
      id: registrationResult.user.id,
      tasksCompleted: 0,
      tasksInProgress: 0
    };
    delete staffWithId.password; // Don't store password in the staff list
    
    const updatedStaff = [...staff, staffWithId];
    setStaff(updatedStaff);
    localStorage.setItem('projectflow_staff', JSON.stringify(updatedStaff));
    toast({
      title: "Staff member added!",
      description: `${newStaffData.name} has been added and can now log in.`,
    });
  };

  const handleEditStaff = (updatedMember) => {
    const updatedStaff = staff.map(member => 
      member.id === updatedMember.id ? updatedMember : member
    );
    setStaff(updatedStaff);
    localStorage.setItem('projectflow_staff', JSON.stringify(updatedStaff));
    // Note: This does not update login details. That would require a more complex process.
    toast({
      title: "Staff member updated!",
      description: `${updatedMember.name}'s details have been updated.`,
    });
  };

  const handleToggleStatus = (staffId) => {
    const updatedStaff = staff.map(member => {
      if (member.id === staffId) {
        return { ...member, status: member.status === 'active' ? 'inactive' : 'active' };
      }
      return member;
    });
    setStaff(updatedStaff);
    localStorage.setItem('projectflow_staff', JSON.stringify(updatedStaff));
    const member = updatedStaff.find(m => m.id === staffId);
    toast({
      title: "Status updated",
      description: `${member.name} is now ${member.status}.`,
    });
  };

  const handleRemoveStaff = (staffId) => {
    const member = staff.find(m => m.id === staffId);
    const updatedStaff = staff.filter(m => m.id !== staffId);
    setStaff(updatedStaff);
    localStorage.setItem('projectflow_staff', JSON.stringify(updatedStaff));

    // Also remove from the users list to disable login
    const allUsers = JSON.parse(localStorage.getItem('projectflow_users') || '[]');
    const updatedUsers = allUsers.filter(u => u.id !== staffId);
    localStorage.setItem('projectflow_users', JSON.stringify(updatedUsers));
    
    toast({
      title: "Staff member removed",
      description: `${member.name} has been removed and their account disabled.`,
      variant: "destructive",
    });
  };

  const getStatusColor = (status) => {
    return status === 'active' 
      ? 'bg-success-soft text-success border-success/30'
      : 'bg-muted text-muted-foreground border-border';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-foreground mb-2">Staff Management</h2>
          <p className="text-muted-foreground">Manage your team members and their roles</p>
        </div>
        <Button
          onClick={() => setShowAddStaff(true)}
          className="hover: hover: w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Staff Member
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search staff members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 surface border-border text-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Total Staff</p>
              <p className="text-2xl font-bold text-foreground">{staff.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </Card>
        <Card className="surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Active Members</p>
              <p className="text-2xl font-bold text-foreground">{staff.filter(m => m.status === 'active').length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </Card>
        <Card className="surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm mb-1">Inactive Members</p>
              <p className="text-2xl font-bold text-foreground">{staff.filter(m => m.status === 'inactive').length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center">
              <UserX className="w-6 h-6 text-foreground" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStaff.map((member, index) => (
          <motion.div key={member.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
            <Card className="surface p-6 interactive flex flex-col h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-foreground font-semibold">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">{member.name}</h3>
                    <p className="text-muted-foreground text-sm">{member.role}</p>
                  </div>
                </div>
                <Badge className={`${getStatusColor(member.status)} border`}>
                  {member.status}
                </Badge>
              </div>

              <div className="space-y-2 mb-4 flex-grow">
                <div className="flex items-center text-sm text-muted-foreground break-all">
                  <Mail className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
                  <span>{member.email}</span>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                  {member.phone}
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                  Joined {new Date(member.joinDate).toLocaleDateString()}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-success">{member.tasksCompleted}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{member.tasksInProgress}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>

              <div className="flex space-x-2 mt-auto">
                <Button size="sm" variant="outline" onClick={() => handleToggleStatus(member.id)} className="flex-1 border-border text-muted-foreground hover:bg-muted/60 text-xs">
                  {member.status === 'active' ? <><UserX className="w-4 h-4 mr-1" />Deactivate</> : <><UserCheck className="w-4 h-4 mr-1" />Activate</>}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingStaff(member)} className="border-primary/30 text-primary hover:bg-primary-soft">
                  <Edit className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleRemoveStaff(member.id)} className="border-destructive/30 text-destructive hover:bg-destructive-soft">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {filteredStaff.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-muted-foreground mb-2">No staff members found</h3>
          <p className="text-muted-foreground">
            {searchTerm ? 'Try adjusting your search criteria' : 'Add your first staff member to get started'}
          </p>
        </motion.div>
      )}

      <AddStaffDialog open={showAddStaff} onOpenChange={setShowAddStaff} onAddStaff={handleAddStaff} />
      {editingStaff && (
        <EditStaffDialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)} onEditStaff={handleEditStaff} staffMember={editingStaff} />
      )}
    </motion.div>
  );
};

export default StaffManagement;