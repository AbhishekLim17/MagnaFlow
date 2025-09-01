import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';

const DesignationsContext = createContext();

export const useDesignations = () => {
  return useContext(DesignationsContext);
};

const defaultDesignations = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'UI/UX Designer',
  'Product Manager',
  'DevOps Engineer',
  'QA Engineer',
  'Data Analyst',
  'Project Manager',
  'Marketing Specialist'
];

export const DesignationsProvider = ({ children }) => {
  const [designations, setDesignations] = useState([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedDesignations = localStorage.getItem('projectflow_designations');
      if (savedDesignations) {
        setDesignations(JSON.parse(savedDesignations));
      } else {
        setDesignations(defaultDesignations);
        localStorage.setItem('projectflow_designations', JSON.stringify(defaultDesignations));
      }
    } catch (error) {
      console.error('Failed to load designations from localStorage', error);
      setDesignations(defaultDesignations);
    }
  }, []);

  const updateLocalStorage = (newDesignations) => {
    localStorage.setItem('projectflow_designations', JSON.stringify(newDesignations));
  };

  const addDesignation = (newDesignation) => {
    if (designations.find(d => d.toLowerCase() === newDesignation.toLowerCase())) {
      toast({
        title: "Duplicate Designation",
        description: `The designation "${newDesignation}" already exists.`,
        variant: "destructive",
      });
      return false;
    }
    const newDesignations = [...designations, newDesignation];
    setDesignations(newDesignations);
    updateLocalStorage(newDesignations);
    toast({
      title: "Designation Added",
      description: `"${newDesignation}" has been added successfully.`,
    });
    return true;
  };

  const updateDesignation = (oldDesignation, newDesignation) => {
    if (oldDesignation.toLowerCase() !== newDesignation.toLowerCase() && designations.find(d => d.toLowerCase() === newDesignation.toLowerCase())) {
      toast({
        title: "Duplicate Designation",
        description: `The designation "${newDesignation}" already exists.`,
        variant: "destructive",
      });
      return false;
    }
    const newDesignations = designations.map(d => (d === oldDesignation ? newDesignation : d));
    setDesignations(newDesignations);
    updateLocalStorage(newDesignations);

    const savedStaff = JSON.parse(localStorage.getItem('projectflow_staff') || '[]');
    const updatedStaff = savedStaff.map(member => {
        if (member.role === oldDesignation) {
            return { ...member, role: newDesignation };
        }
        return member;
    });
    localStorage.setItem('projectflow_staff', JSON.stringify(updatedStaff));

    toast({
      title: "Designation Updated",
      description: `"${oldDesignation}" has been updated to "${newDesignation}".`,
    });
    return true;
  };

  const removeDesignation = (designationToRemove) => {
    const staff = JSON.parse(localStorage.getItem('projectflow_staff') || '[]');
    const isDesignationInUse = staff.some(member => member.role === designationToRemove);

    if (isDesignationInUse) {
      toast({
        title: "Cannot Remove Designation",
        description: `"${designationToRemove}" is currently assigned to one or more staff members.`,
        variant: "destructive",
      });
      return false;
    }

    const newDesignations = designations.filter(d => d !== designationToRemove);
    setDesignations(newDesignations);
    updateLocalStorage(newDesignations);
    toast({
      title: "Designation Removed",
      description: `"${designationToRemove}" has been removed.`,
    });
    return true;
  };

  const value = {
    designations,
    addDesignation,
    updateDesignation,
    removeDesignation,
  };

  return (
    <DesignationsContext.Provider value={value}>
      {children}
    </DesignationsContext.Provider>
  );
};