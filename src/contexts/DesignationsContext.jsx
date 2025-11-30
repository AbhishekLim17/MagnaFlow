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
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/config/firebase';

const DesignationsContext = createContext();

export const useDesignations = () => {
  return useContext(DesignationsContext);
};

export const DesignationsProvider = ({ children }) => {
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load designations from Firebase on mount with real-time listener
  useEffect(() => {
    console.log("🚀 Setting up designations real-time listener");
    
    // Set up real-time listener for instant updates
    const unsubscribe = setupDesignationsListener();
    
    // Cleanup listener on unmount
    return () => {
      console.log("🔌 Cleaning up designations listener");
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Set up real-time listener for designations
  const setupDesignationsListener = () => {
    try {
      const designationsRef = collection(db, 'designations');
      
      const unsubscribe = onSnapshot(
        designationsRef,
        (snapshot) => {
          console.log("📡 Designations snapshot received:", snapshot.size, "documents");
          
          const data = [];
          snapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
          });
          
          // Sort by name
          data.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          
          console.log("✅ Setting designations from listener:", data.length);
          setDesignations(data);
          setLoading(false);
        },
        (error) => {
          console.error("❌ Designations listener error:", error);
          setLoading(false);
          
          // Fallback to manual load on error
          loadDesignations();
        }
      );
      
      return unsubscribe;
    } catch (error) {
      console.error("❌ Error setting up listener:", error);
      // Fallback to manual load
      loadDesignations();
      return null;
    }
  };

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