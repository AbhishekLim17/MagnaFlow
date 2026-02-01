/**
 * Sentry Configuration for MagnaFlow
 * 
 * Monitors errors and performance in production
 * Provides real-time alerts and error tracking
 */

import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking
 * Only runs in production to avoid dev noise
 */
export function initSentry() {
  // Only initialize in production
  const isProduction = import.meta.env.PROD;
  
  if (!isProduction) {
    console.log('🔧 Sentry: Development mode - error tracking disabled');
    return;
  }

  // Get Sentry DSN from environment variables
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!sentryDsn) {
    console.warn('⚠️ Sentry DSN not found - error tracking disabled');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    
    // Integration with React Router for navigation tracking
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Capture 10% of sessions for replay
        sessionSampleRate: 0.1,
        // Capture 100% of sessions with errors
        onErrorSampleRate: 1.0,
      }),
    ],

    // Performance Monitoring
    tracesSampleRate: 0.1, // Capture 10% of transactions for performance
    
    // Set environment
    environment: 'production',
    
    // Release tracking (use package.json version)
    release: 'magnaflow@0.0.0',
    
    // Filter out certain errors
    beforeSend(event, hint) {
      // Don't send errors from browser extensions
      if (event.exception?.values?.[0]?.value?.includes('chrome-extension://')) {
        return null;
      }
      
      // Don't send network timeout errors (user's internet issue)
      if (event.exception?.values?.[0]?.value?.includes('timeout')) {
        return null;
      }
      
      return event;
    },
    
    // Additional context
    initialScope: {
      tags: {
        app: 'magnaflow',
        component: 'web-app'
      }
    }
  });

  console.log('✅ Sentry initialized - error tracking active');
}

/**
 * Set user context for error tracking
 * @param {Object} user - User object from AuthContext
 */
export function setSentryUser(user) {
  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.uid,
    email: user.email,
    username: user.displayName || user.email,
    role: user.role
  });
}

/**
 * Clear user context (on logout)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Manually capture an exception
 * @param {Error} error - Error to capture
 * @param {Object} context - Additional context
 */
export function captureException(error, context = {}) {
  Sentry.captureException(error, {
    contexts: {
      custom: context
    }
  });
}

/**
 * Add breadcrumb for tracking user actions
 * @param {string} message - Breadcrumb message
 * @param {string} category - Category (navigation, user, etc.)
 * @param {Object} data - Additional data
 */
export function addBreadcrumb(message, category = 'user', data = {}) {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info'
  });
}

/**
 * Start a performance transaction
 * @param {string} name - Transaction name
 * @param {string} op - Operation type
 * @returns {Transaction} Sentry transaction
 */
export function startTransaction(name, op = 'custom') {
  // Use Sentry's browser tracing for transactions
  const transaction = Sentry.startSpan({
    name,
    op
  }, (span) => {
    return span;
  });
  
  return transaction;
}

/**
 * Measure Firebase query performance
 * @param {string} queryName - Name of the query
 * @param {Function} queryFn - Async function to execute
 * @returns {Promise} Query result
 */
export async function measureFirebaseQuery(queryName, queryFn) {
  return await Sentry.startSpan({
    name: queryName,
    op: 'firebase.query'
  }, async () => {
    try {
      const result = await queryFn();
      return result;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  });
}

export default Sentry;
