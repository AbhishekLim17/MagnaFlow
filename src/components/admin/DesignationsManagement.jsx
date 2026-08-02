import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDesignations } from '@/contexts/DesignationsContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center">
              {initialValue ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </div>
            <span>{initialValue ? 'Edit Designation' : 'Add New Designation'}</span>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="designation-name" className="text-foreground">
              Designation Name
            </Label>
            <Input
              id="designation-name"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="mt-2 surface border-border text-foreground"
              placeholder="e.g., Lead Developer"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">
              {initialValue ? 'Save Changes' : 'Add Designation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DesignationsManagement = () => {
  const { designations, loading, addDesignation, updateDesignation, removeDesignation, refreshDesignations } = useDesignations();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentDesignation, setCurrentDesignation] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshDesignations();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleAdd = async (newDesignation) => {
    const success = await addDesignation(newDesignation);
    if (success) {
      setIsAddDialogOpen(false);
    }
  };

  const handleEdit = async (updatedDesignation) => {
    if (currentDesignation) {
      const success = await updateDesignation(currentDesignation.id, updatedDesignation);
      if (success) {
        setIsEditDialogOpen(false);
        setCurrentDesignation(null);
      }
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
          <p className="text-muted-foreground">Add, edit, or remove staff roles and designations.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            onClick={handleRefresh} 
            variant="outline"
            className="border-border hover:bg-muted"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAddDialogOpen(true)} className="bg-primary hover:bg-primary/90 shadow-card flex-1 sm:flex-none">
            <Plus className="w-4 h-4 mr-2" />
            Add Designation
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="text-primary" />
            <span>Available Designations ({designations.length})</span>
            {loading && <span className="text-sm text-muted-foreground ml-2">(Loading...)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading designations...</span>
            </div>
          ) : designations.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {designations.map((designation) => (
                <motion.div
                  key={designation.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: designations.indexOf(designation) * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/60"
                >
                  <div className="flex-1">
                    <span className="font-medium text-foreground">{designation.name}</span>
                    {designation.description && (
                      <p className="text-sm text-muted-foreground mt-1">{designation.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary-soft hover:text-primary" onClick={() => openEditDialog(designation)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive-soft hover:text-destructive" onClick={() => removeDesignation(designation.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Briefcase className="w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground mb-2">No designations found.</h3>
              <p>Click "Add Designation" to create your first one.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <DesignationDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} onSubmit={handleAdd} />
      <DesignationDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        onSubmit={handleEdit} 
        initialValue={currentDesignation?.name || ''} 
      />
    </motion.div>
  );
};

export default DesignationsManagement;