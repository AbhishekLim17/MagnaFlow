// Rate Limiting Utility
// Prevents brute force attacks on login and other sensitive operations

class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.blockedIPs = new Map();
  }

  /**
   * Check if action is rate limited
   * @param {string} key - Unique identifier (email, IP, etc.)
   * @param {number} maxAttempts - Maximum attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {Object} {allowed: boolean, remainingAttempts: number, resetTime: number}
   */
  checkLimit(key, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    
    // Check if permanently blocked
    if (this.blockedIPs.has(key)) {
      const blockInfo = this.blockedIPs.get(key);
      if (now < blockInfo.until) {
        return {
          allowed: false,
          remainingAttempts: 0,
          resetTime: blockInfo.until,
          blocked: true,
          message: `Too many attempts. Please try again after ${new Date(blockInfo.until).toLocaleTimeString()}`
        };
      } else {
        // Block expired, remove it
        this.blockedIPs.delete(key);
        this.attempts.delete(key);
      }
    }
    
    // Get or initialize attempt history
    let attemptHistory = this.attempts.get(key) || { count: 0, firstAttempt: now };
    
    // Reset if outside time window
    if (now - attemptHistory.firstAttempt > windowMs) {
      attemptHistory = { count: 0, firstAttempt: now };
    }
    
    // Check if limit exceeded
    if (attemptHistory.count >= maxAttempts) {
      // Block for 30 minutes
      const blockUntil = now + (30 * 60 * 1000);
      this.blockedIPs.set(key, { until: blockUntil, attempts: attemptHistory.count });
      
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTime: blockUntil,
        blocked: true,
        message: 'Too many failed attempts. Account temporarily blocked for 30 minutes.'
      };
    }
    
    return {
      allowed: true,
      remainingAttempts: maxAttempts - attemptHistory.count,
      resetTime: attemptHistory.firstAttempt + windowMs,
      blocked: false
    };
  }

  /**
   * Record a failed attempt
   * @param {string} key - Unique identifier
   */
  recordAttempt(key) {
    const now = Date.now();
    let attemptHistory = this.attempts.get(key) || { count: 0, firstAttempt: now };
    
    attemptHistory.count++;
    attemptHistory.lastAttempt = now;
    
    this.attempts.set(key, attemptHistory);
  }

  /**
   * Clear attempts for a key (e.g., after successful login)
   * @param {string} key - Unique identifier
   */
  clearAttempts(key) {
    this.attempts.delete(key);
    this.blockedIPs.delete(key);
  }

  /**
   * Get attempt info for a key
   * @param {string} key - Unique identifier
   * @returns {Object} Attempt information
   */
  getAttemptInfo(key) {
    return this.attempts.get(key) || { count: 0, firstAttempt: null, lastAttempt: null };
  }

  /**
   * Clean up old entries (call periodically)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    // Clean attempts
    for (const [key, data] of this.attempts.entries()) {
      if (now - data.lastAttempt > maxAge) {
        this.attempts.delete(key);
      }
    }
    
    // Clean blocks
    for (const [key, data] of this.blockedIPs.entries()) {
      if (now > data.until) {
        this.blockedIPs.delete(key);
      }
    }
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Auto cleanup every 10 minutes
setInterval(() => {
  rateLimiter.cleanup();
}, 10 * 60 * 1000);

export default rateLimiter;

/**
 * Rate limit decorator for login attempts
 */
export const withLoginRateLimit = async (email, loginFunction) => {
  const limitCheck = rateLimiter.checkLimit(`login:${email}`, 5, 15 * 60 * 1000);
  
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message);
  }
  
  try {
    const result = await loginFunction();
    // Clear attempts on successful login
    rateLimiter.clearAttempts(`login:${email}`);
    return result;
  } catch (error) {
    // Record failed attempt
    rateLimiter.recordAttempt(`login:${email}`);
    
    const remainingAttempts = limitCheck.remainingAttempts - 1;
    if (remainingAttempts > 0) {
      throw new Error(`${error.message}. ${remainingAttempts} attempts remaining.`);
    }
    throw error;
  }
};

/**
 * Rate limit for password reset requests
 */
export const withPasswordResetRateLimit = async (email, resetFunction) => {
  const limitCheck = rateLimiter.checkLimit(`reset:${email}`, 3, 60 * 60 * 1000); // 3 attempts per hour
  
  if (!limitCheck.allowed) {
    throw new Error('Too many password reset requests. Please try again later.');
  }
  
  rateLimiter.recordAttempt(`reset:${email}`);
  return await resetFunction();
};
