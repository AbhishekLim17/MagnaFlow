// Designation Service - Handles designation management
// CRUD operations for user designations (Manager, Consultant, Engineer, etc.)

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc,
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/config/firebase';

// Collection reference
const DESIGNATIONS_COLLECTION = 'designations';

/**
 * Get designation by ID
 * @param {string} designationId - Designation ID
 * @returns {Promise<Object|null>} Designation data or null
 */
export const getDesignationById = async (designationId) => {
  try {
    const designationDoc = await getDoc(doc(db, DESIGNATIONS_COLLECTION, designationId));
    if (designationDoc.exists()) {
      return { id: designationDoc.id, ...designationDoc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting designation:', error);
    throw error;
  }
};

/**
 * Get all designations
 * @returns {Promise<Array>} Array of designation objects
 */
export const getAllDesignations = async () => {
  try {
    console.log("📥 Fetching all designations from Firestore...");
    
    const designationsRef = collection(db, DESIGNATIONS_COLLECTION);
    const snapshot = await getDocs(designationsRef);
    
    console.log("📊 Received snapshot with", snapshot.size, "documents");
    
    const designations = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      console.log("📄 Document:", doc.id, data);
      designations.push({ id: doc.id, ...data });
    });
    
    // Sort by name in memory
    designations.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    console.log("✅ Returning", designations.length, "designations");
    return designations;
  } catch (error) {
    console.error('❌ Error getting designations:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    // Return empty array instead of throwing to prevent app crashes
    return [];
  }
};

/**
 * Create a new designation
 * @param {Object} designationData - Designation data (name, description)
 * @returns {Promise<Object>} Created designation data
 */
export const createDesignation = async (designationData) => {
  try {
    const { name, description } = designationData;
    
    const designationDoc = {
      name: name || '',
      description: description || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    const docRef = await addDoc(collection(db, DESIGNATIONS_COLLECTION), designationDoc);
    
    return { id: docRef.id, ...designationDoc };
  } catch (error) {
    console.error('Error creating designation:', error);
    throw error;
  }
};

/**
 * Update designation information
 * @param {string} designationId - Designation ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated designation data
 */
export const updateDesignation = async (designationId, updates) => {
  try {
    const designationRef = doc(db, DESIGNATIONS_COLLECTION, designationId);
    
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    await updateDoc(designationRef, updatedData);
    
    // Return updated designation
    const updatedDesignation = await getDesignationById(designationId);
    return updatedDesignation;
  } catch (error) {
    console.error('Error updating designation:', error);
    throw error;
  }
};

/**
 * Delete a designation
 * @param {string} designationId - Designation ID
 * @returns {Promise<void>}
 */
export const deleteDesignation = async (designationId) => {
  try {
    await deleteDoc(doc(db, DESIGNATIONS_COLLECTION, designationId));
    console.log('Designation deleted:', designationId);
  } catch (error) {
    console.error('Error deleting designation:', error);
    throw error;
  }
};

/**
 * Initialize default designations if none exist
 * @returns {Promise<void>}
 */
export const initializeDefaultDesignations = async () => {
  try {
    const existingDesignations = await getAllDesignations();
    
    if (existingDesignations.length === 0) {
      const defaultDesignations = [
        { name: 'Manager', description: 'Team Manager' },
        { name: 'Senior Consultant', description: 'Senior level consultant' },
        { name: 'Consultant', description: 'Mid-level consultant' },
        { name: 'Junior Consultant', description: 'Entry level consultant' },
        { name: 'Engineer', description: 'Software Engineer' },
        { name: 'Analyst', description: 'Business Analyst' },
      ];
      
      for (const designation of defaultDesignations) {
        await createDesignation(designation);
      }
      
      console.log('Default designations initialized');
    }
  } catch (error) {
    console.error('Error initializing default designations:', error);
    throw error;
  }
};
