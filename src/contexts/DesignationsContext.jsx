// DesignationsContext - Firebase Integration for Designation Management
// Manages job designations (roles) for staff members

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { getAllDesignations, createDesignation, updateDesignation as updateDesignationService, deleteDesignation } from '@/services/designationService';
import { getAllUsers } from '@/services/userService';
import { useAuth } from '@/contexts/AuthContext';

const DesignationsContext = createContext();

export const useDesignations = () => {
  return useContext(DesignationsContext);
};

export const DesignationsProvider = ({ children }) => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // This used to be a live onSnapshot listener. Designations were the third
  // listener opened in the same instant as NotificationBell's and the
  // dashboard's activity feed on every login — and that burst of concurrent
  // listener setup is what was tripping a Firestore JS SDK internal-assertion
  // bug (the same "b815"/"ca9" failure behind the sign-out crash fixed
  // earlier), which then poisons the client's connection for the rest of the
  // session: every read after that point silently fails. Designations change
  // rarely — an admin adding a job title now and then — so they don't need to
  // be live. One fewer always-on listener meaningfully cuts how often that
  // race gets a chance to fire. TasksContext already made the same call for
  // the same reason (see its staleness-window comment).
  useEffect(() => {
    if (!isAuthenticated) {
      setDesignations([]);
      setLoading(false);
      return;
    }
    loadDesignations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const loadDesignations = async () => {
    try {
      console.log("📥 Loading designations from Firestore");
      const data = await getAllDesignations();
      
      console.log("📊 Raw data from Firebase:", data);
      
      // Set designations directly without duplicate removal
      // (Duplicate prevention is handled on add/edit, not on load)
      setDesignations(data || []);
      
      console.log("✅ Designations loaded and set:", data?.length || 0);
    } catch (error) {
      console.error("❌ Error loading designations:", error);
      // Only show error toast if there's an actual error, not if collection is empty
      if (error.code !== 'permission-denied') {
        toast({
          title: "Error",
          description: "Failed to load designations. Please try again.",
          variant: "destructive",
        });
      }
      setDesignations([]);
    } finally {
      setLoading(false);
    }
  };

  const addDesignation = async (name, description = '') => {
    try {
      // Trim and validate
      const trimmedName = name.trim();
      
      if (!trimmedName) {
        toast({
          title: "Invalid Designation",
          description: "Designation name cannot be empty.",
          variant: "destructive",
        });
        return false;
      }

      // Check for duplicates (case-insensitive, trimmed)
      const duplicate = designations.find(
        d => d.name.toLowerCase().trim() === trimmedName.toLowerCase()
      );
      
      if (duplicate) {
        toast({
          title: "Duplicate Designation",
          description: `The designation "${trimmedName}" already exists.`,
          variant: "destructive",
        });
        return false;
      }

      console.log("➕ Adding new designation:", trimmedName);
      const newDesignation = await createDesignation({ name: trimmedName, description });
      
      setDesignations(prev => [...prev, newDesignation]);
      
      toast({
        title: "Designation Added",
        description: `"${trimmedName}" has been added successfully.`,
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
      // Trim and validate
      const trimmedName = name.trim();
      
      if (!trimmedName) {
        toast({
          title: "Invalid Designation",
          description: "Designation name cannot be empty.",
          variant: "destructive",
        });
        return false;
      }

      // Check for duplicates (case-insensitive, trimmed, excluding current designation)
      const duplicate = designations.find(
        d => d.id !== designationId && d.name.toLowerCase().trim() === trimmedName.toLowerCase()
      );
      
      if (duplicate) {
        toast({
          title: "Duplicate Designation",
          description: `The designation "${trimmedName}" already exists.`,
          variant: "destructive",
        });
        return false;
      }

      console.log("✏️  Updating designation:", designationId);
      const updated = await updateDesignationService(designationId, { name: trimmedName, description });
      
      setDesignations(prev => 
        prev.map(d => d.id === designationId ? updated : d)
      );
      
      toast({
        title: "Designation Updated",
        description: `Designation has been updated to "${trimmedName}".`,
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