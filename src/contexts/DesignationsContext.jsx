// DesignationsContext - Firebase Integration for Designation Management
// Manages job designations (roles) for staff members

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import {
  getAllDesignations,
  createDesignation,
  updateDesignation as updateDesignationService,
  deleteDesignation,
  initializeDefaultDesignations,
} from '@/services/designationService';
import { getAllUsers } from '@/services/userService';

const DesignationsContext = createContext();

export const useDesignations = () => {
  return useContext(DesignationsContext);
};

export const DesignationsProvider = ({ children }) => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load designations from Firebase on mount
  useEffect(() => {
    loadDesignations();
  }, []);

  const loadDesignations = async () => {
    try {
      console.log("📥 Loading designations from Firestore");
      const data = await getAllDesignations();
      
      // Don't auto-initialize - let admin add designations manually
      setDesignations(data);
      
      console.log("✅ Designations loaded:", data.length);
    } catch (error) {
      console.error("❌ Error loading designations:", error);
      toast({
        title: "Error",
        description: "Failed to load designations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addDesignation = async (name, description = '') => {
    try {
      // Check for duplicates
      const duplicate = designations.find(
        d => d.name.toLowerCase() === name.toLowerCase()
      );
      
      if (duplicate) {
        toast({
          title: "Duplicate Designation",
          description: `The designation "${name}" already exists.`,
          variant: "destructive",
        });
        return false;
      }

      console.log("➕ Adding new designation:", name);
      const newDesignation = await createDesignation({ name, description });
      
      setDesignations(prev => [...prev, newDesignation]);
      
      toast({
        title: "Designation Added",
        description: `"${name}" has been added successfully.`,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error adding designation:", error);
      toast({
        title: "Error",
        description: "Failed to add designation. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateDesignation = async (designationId, name, description = '') => {
    try {
      // Check for duplicates (excluding current designation)
      const duplicate = designations.find(
        d => d.id !== designationId && d.name.toLowerCase() === name.toLowerCase()
      );
      
      if (duplicate) {
        toast({
          title: "Duplicate Designation",
          description: `The designation "${name}" already exists.`,
          variant: "destructive",
        });
        return false;
      }

      console.log("✏️  Updating designation:", designationId);
      const updated = await updateDesignationService(designationId, { name, description });
      
      setDesignations(prev => 
        prev.map(d => d.id === designationId ? updated : d)
      );
      
      toast({
        title: "Designation Updated",
        description: `Designation has been updated to "${name}".`,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error updating designation:", error);
      toast({
        title: "Error",
        description: "Failed to update designation. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const removeDesignation = async (designationId) => {
    try {
      const designation = designations.find(d => d.id === designationId);
      if (!designation) {
        toast({
          title: "Error",
          description: "Designation not found.",
          variant: "destructive",
        });
        return false;
      }

      // Check if designation is in use
      console.log("🔍 Checking if designation is in use:", designation.name);
      const users = await getAllUsers();
      const isInUse = users.some(user => user.designation === designation.name);

      if (isInUse) {
        toast({
          title: "Cannot Remove Designation",
          description: `"${designation.name}" is currently assigned to one or more staff members.`,
          variant: "destructive",
        });
        return false;
      }

      console.log("🗑️  Deleting designation:", designationId);
      await deleteDesignation(designationId);
      
      setDesignations(prev => prev.filter(d => d.id !== designationId));
      
      toast({
        title: "Designation Removed",
        description: `"${designation.name}" has been removed.`,
      });
      
      return true;
    } catch (error) {
      console.error("❌ Error removing designation:", error);
      toast({
        title: "Error",
        description: "Failed to remove designation. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  const value = {
    designations,
    loading,
    addDesignation,
    updateDesignation,
    removeDesignation,
    refreshDesignations: loadDesignations,
  };

  return (
    <DesignationsContext.Provider value={value}>
      {children}
    </DesignationsContext.Provider>
  );
};