// Input Validation Utility
// Comprehensive validation for all user inputs to prevent XSS, SQL injection, etc.

/**
 * Sanitize string input by removing/escaping dangerous characters
 * @param {string} input - Raw user input
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove HTML tags
  let cleaned = input.replace(/<[^>]*>/g, '');
  
  // Escape special characters
  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return cleaned.trim();
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password string
 * @returns {Object} {valid: boolean, errors: string[]}
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate task title
 * @param {string} title - Task title
 * @returns {Object} {valid: boolean, error: string}
 */
export const validateTaskTitle = (title) => {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'Title is required' };
  }
  
  if (title.length < 3) {
    return { valid: false, error: 'Title must be at least 3 characters' };
  }
  
  if (title.length > 200) {
    return { valid: false, error: 'Title must not exceed 200 characters' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate task description
 * @param {string} description - Task description
 * @returns {Object} {valid: boolean, error: string}
 */
export const validateTaskDescription = (description) => {
  if (description && description.length > 2000) {
    return { valid: false, error: 'Description must not exceed 2000 characters' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate date is in future
 * @param {string} dateString - Date string
 * @returns {Object} {valid: boolean, error: string}
 */
export const validateFutureDate = (dateString) => {
  if (!dateString) {
    return { valid: false, error: 'Date is required' };
  }
  
  const inputDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (inputDate < today) {
    return { valid: false, error: 'Date must be in the future' };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate user name
 * @param {string} name - User name
 * @returns {Object} {valid: boolean, error: string}
 */
export const validateName = (name) => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Name is required' };
  }
  
  if (name.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Name must not exceed 100 characters' };
  }
  
  // Only allow letters, spaces, and basic punctuation
  if (!/^[a-zA-Z\s'-]+$/.test(name)) {
    return { valid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
  }
  
  return { valid: true, error: null };
};

/**
 * Prevent XSS attacks in text content
 * @param {string} text - Text content
 * @returns {string} Safe text
 */
export const escapeHtml = (text) => {
  if (typeof text !== 'string') return '';
  
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };
  
  return text.replace(/[&<>"'/]/g, (char) => map[char]);
};

/**
 * Validate file upload (for future use)
 * @param {File} file - File object
 * @param {Array} allowedTypes - Allowed MIME types
 * @param {number} maxSize - Max size in bytes
 * @returns {Object} {valid: boolean, error: string}
 */
export const validateFile = (file, allowedTypes = [], maxSize = 5242880) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return { valid: false, error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}` };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size: ${(maxSize / 1024 / 1024).toFixed(2)}MB` };
  }
  
  return { valid: true, error: null };
};

/**
 * Validate numeric input
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Object} {valid: boolean, error: string}
 */
export const validateNumber = (value, min = null, max = null) => {
  const num = Number(value);
  
  if (isNaN(num)) {
    return { valid: false, error: 'Must be a valid number' };
  }
  
  if (min !== null && num < min) {
    return { valid: false, error: `Must be at least ${min}` };
  }
  
  if (max !== null && num > max) {
    return { valid: false, error: `Must not exceed ${max}` };
  }
  
  return { valid: true, error: null };
};
