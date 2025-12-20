import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject,
  listAll
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { storage, db } from '../config/firebase';

/**
 * Attachment Service
 * Handles file uploads/downloads for task comments
 */

// File size limit (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Max files per task
const MAX_FILES_PER_TASK = 5;

// Allowed file types
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

// Validate file before upload
export const validateFile = (file) => {
  const errors = [];

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds 10MB limit (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    errors.push(`File type not allowed: ${file.type}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Check if task has reached file limit
export const checkFileLimit = async (taskId) => {
  try {
    const q = query(
      collection(db, 'task_attachments'),
      where('taskId', '==', taskId)
    );

    const snapshot = await getDocs(q);
    return {
      count: snapshot.size,
      hasReachedLimit: snapshot.size >= MAX_FILES_PER_TASK
    };
  } catch (error) {
    console.error('❌ Error checking file limit:', error);
    return { count: 0, hasReachedLimit: false };
  }
};

// Upload file to Firebase Storage
export const uploadFile = async (taskId, userId, file, onProgress = null) => {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Check file limit
    const { hasReachedLimit } = await checkFileLimit(taskId);
    if (hasReachedLimit) {
      throw new Error(`Maximum ${MAX_FILES_PER_TASK} files per task reached`);
    }

    // Create unique filename
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `task-attachments/${taskId}/${timestamp}_${sanitizedFileName}`;

    // Upload to Firebase Storage
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress: ${progress.toFixed(2)}%`);
          if (onProgress) {
            onProgress(progress);
          }
        },
        (error) => {
          console.error('❌ Upload error:', error);
          reject(new Error(`Upload failed: ${error.message}`));
        },
        async () => {
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

            // Save metadata to Firestore
            const attachmentData = {
              taskId,
              userId,
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              storagePath,
              downloadURL,
              uploadedAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'task_attachments'), attachmentData);

            console.log('✅ File uploaded successfully:', docRef.id);
            resolve({
              id: docRef.id,
              ...attachmentData,
              uploadedAt: new Date()
            });
          } catch (error) {
            console.error('❌ Error saving attachment metadata:', error);
            reject(new Error(`Failed to save metadata: ${error.message}`));
          }
        }
      );
    });
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    throw error;
  }
};

// Delete file from Storage and Firestore
export const deleteFile = async (attachmentId, storagePath) => {
  try {
    // Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);

    // Delete from Firestore
    await deleteDoc(doc(db, 'task_attachments', attachmentId));

    console.log('✅ File deleted successfully:', attachmentId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

// Get all attachments for a task
export const getAttachments = async (taskId) => {
  try {
    const q = query(
      collection(db, 'task_attachments'),
      where('taskId', '==', taskId)
    );

    const snapshot = await getDocs(q);
    const attachments = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate()
    }));

    console.log(`✅ Fetched ${attachments.length} attachments for task ${taskId}`);
    return attachments;
  } catch (error) {
    console.error('❌ Error fetching attachments:', error);
    return [];
  }
};

// Get attachment count for a task
export const getAttachmentCount = async (taskId) => {
  try {
    const q = query(
      collection(db, 'task_attachments'),
      where('taskId', '==', taskId)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('❌ Error getting attachment count:', error);
    return 0;
  }
};

// Check if file is an image
export const isImage = (fileType) => {
  return fileType.startsWith('image/');
};

// Format file size for display
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export default {
  validateFile,
  checkFileLimit,
  uploadFile,
  deleteFile,
  getAttachments,
  getAttachmentCount,
  isImage,
  formatFileSize,
  MAX_FILE_SIZE,
  MAX_FILES_PER_TASK,
  ALLOWED_TYPES
};
