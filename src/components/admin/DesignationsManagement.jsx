import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDesignations } from '@/contexts/DesignationsContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

const DesignationDialog = ({ open, onOpenChange, onSubmit, initialValue = '' }) => {
  const [designation, setDesignation] = useState(initialValue);

  React.useEffect(() => {
    setDesignation(initialValue);
  }, [initialValue, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (designation.trim()) {
      onSubmit(designation);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-effect border-white/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              {initialValue ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <span>{initialValue ? 'Edit Designation' : 'Add New Designation'}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="designation-name" className="text-gray-200">
              Designation Name
            </Label>
            <Input
              id="designation-name"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="mt-2 glass-effect border-white/20 text-white placeholder-gray-400"
              placeholder="e.g., Lead Developer"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
              {initialValue ? 'Save Changes' : 'Add Designation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DesignationsManagement = () => {
  const { designations, addDesignation, updateDesignation, removeDesignation } = useDesignations();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDesignation, setCurrentDesignation] = useState('');

  const handleAdd = (newDesignation) => {
    if (addDesignation(newDesignation)) {
      setIsAddDialogOpen(false);
    }
  };

  const handleEdit = (updatedDesignation) => {
    if (updateDesignation(currentDesignation, updatedDesignation)) {
      setIsEditDialogOpen(false);
    }
  };

  const openEditDialog = (designation) => {
    setCurrentDesignation(designation);
    setIsEditDialogOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white mb-2">Manage Designations</h2>
          <p className="text-gray-300">Add, edit, or remove staff roles and designations.</p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Designation
        </Button>
      </div>

      <Card className="glass-effect p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="text-blue-300" />
            <span>Available Designations ({designations.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {designations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {designations.map((designation, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-lg bg-white/5"
                >
                  <span className="font-medium text-white">{designation}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300" onClick={() => openEditDialog(designation)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-500/20 hover:text-red-300" onClick={() => removeDesignation(designation)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Briefcase className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No designations found.</h3>
              <p>Click "Add Designation" to create your first one.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <DesignationDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSubmit={handleAdd} />
      <DesignationDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSubmit={handleEdit} initialValue={currentDesignation} />
    </motion.div>
  );
};

export default DesignationsManagement;