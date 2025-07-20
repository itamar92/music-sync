/**
 * 📊 Production Monitoring & Analytics Utilities
 * 
 * Provides comprehensive monitoring, error tracking, and performance analytics
 */

import { auth } from '../services/firebase';

// Performance monitoring configuration
interface PerformanceThresholds {
  LCP: number; // Largest Contentful Paint
  FID: number; // First Input Delay  
  CLS: number; // Cumulative Layout Shift
  TTFB: number; // Time to First Byte
}

const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  LCP: 2500,   // 2.5 seconds
  FID: 100,    // 100ms
  CLS: 0.1,    // 0.1 score
  TTFB: 800    // 800ms
};

// Analytics event types
export type AnalyticsEvent = 
  | 'track_play'
  | 'playlist_create' 
  | 'auth_error'
  | 'performance_metric'
  | 'dropbox_connect'
  | 'preload_success'
  | 'preload_failure'
  | 'bundle_loaded'
  | 'track_retry_success'
  | 'error_occurred'
  | 'user_engagement'
  | 'auth_event'
  | 'dropbox_event'
  | 'app_initialized';

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// Global type extensions
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

// Analytics tracking function
export const trackEvent = (
  event: AnalyticsEvent, 
  properties?: Record<string, any>,
  user_id?: string
) => {
  if (!isProductionMode()) {
    console.log(`📊 Analytics Event: ${event}`, properties);
    return;
  }

  try {
    // Firebase Analytics integration
    if (window.gtag) {
      window.gtag('event', event, {
        user_id: user_id || getCurrentUserId(),
        ...properties,
        environment: getEnvironment(),
        timestamp: Date.now()
      });
    }

    // Custom analytics for detailed tracking
    if (window.dataLayer) {
      window.dataLayer.push({
        event,
        properties,
        user_id: user_id || getCurrentUserId(),
        environment: getEnvironment(),
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.warn('Analytics tracking failed:', error);
  }
};

// Error tracking and reporting
export const trackError = (
  error: Error | string,
  severity: ErrorSeverity = 'medium',
  context?: Record<string, any>
) => {
  const errorInfo = {
    message: typeof error === 'string' ? error : error.message,
    stack: typeof error === 'object' ? error.stack : undefined,
    severity,
    context,
    user_id: getCurrentUserId(),
    environment: getEnvironment(),
    timestamp: Date.now(),
    url: window.location.href,
    user_agent: navigator.userAgent
  };

  // Log to console in development
  if (!isProductionMode()) {
    console.error(`🚨 Error [${severity}]:`, errorInfo);
    return;
  }

  try {
    // Firebase Analytics error event
    trackEvent('error_occurred', {
      error_message: errorInfo.message,
      error_severity: severity,
      error_context: JSON.stringify(context || {})
    });

    // Send to error tracking service (future: Sentry integration)
    if (severity === 'critical' || severity === 'high') {
      console.error('Critical error detected:', errorInfo);
      
      // Could integrate with external error tracking
      // Example: Sentry.captureException(error, { contexts: { custom: context } });
    }
  } catch (trackingError) {
    console.warn('Error tracking failed:', trackingError);
  }
};

// Performance monitoring
export const trackPerformance = (metric: string, value: number, unit: string = 'ms') => {
  const performanceData = {
    metric,
    value,
    unit,
    timestamp: Date.now(),
    user_id: getCurrentUserId(),
    environment: getEnvironment()
  };

  // Log in development
  if (!isProductionMode()) {
    console.log(`⚡ Performance: ${metric} = ${value}${unit}`, performanceData);
    return;
  }

  try {
    // Track performance metric
    trackEvent('performance_metric', performanceData);

    // Check against thresholds and alert if exceeded
    const threshold = (PERFORMANCE_THRESHOLDS as any)[metric];
    if (threshold && value > threshold) {
      trackError(
        `Performance threshold exceeded: ${metric} = ${value}${unit} (threshold: ${threshold}${unit})`,
        'medium',
        { metric, value, threshold, unit }
      );
    }
  } catch (error) {
    console.warn('Performance tracking failed:', error);
  }
};

// Core Web Vitals monitoring
export const initPerformanceMonitoring = () => {
  if (!isProductionMode() || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      trackPerformance('LCP', Math.round(lastEntry.startTime), 'ms');
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        trackPerformance('FID', Math.round(entry.processingStart - entry.startTime), 'ms');
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    // Report CLS on page unload
    window.addEventListener('beforeunload', () => {
      trackPerformance('CLS', Math.round(clsValue * 1000) / 1000, 'score');
    });

    // Navigation timing
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        trackPerformance('TTFB', Math.round(navigation.responseStart - navigation.requestStart), 'ms');
        trackPerformance('page_load', Math.round(navigation.loadEventEnd - navigation.fetchStart), 'ms');
      }
    });

  } catch (error) {
    console.warn('Performance monitoring initialization failed:', error);
  }
};

// Bundle performance tracking
export const trackBundlePerformance = () => {
  if (!isProductionMode()) return;

  try {
    // Track script loading times
    const scriptObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('.js')) {
          trackPerformance('script_load', Math.round(entry.duration), 'ms');
        }
      });
    });
    scriptObserver.observe({ entryTypes: ['resource'] });

    // Track total bundle size (approximate)
    trackEvent('bundle_loaded', {
      scripts: document.querySelectorAll('script[src]').length,
      stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.warn('Bundle performance tracking failed:', error);
  }
};

// User engagement tracking
export const trackUserEngagement = (action: string, details?: Record<string, any>) => {
  trackEvent('user_engagement', {
    action,
    ...details,
    page: window.location.pathname,
    timestamp: Date.now()
  });
};

// Authentication tracking
export const trackAuthEvent = (event: 'login' | 'logout' | 'error' | 'token_refresh', details?: Record<string, any>) => {
  trackEvent('auth_event', {
    auth_event: event,
    ...details,
    timestamp: Date.now()
  });
};

// Dropbox integration tracking
export const trackDropboxEvent = (event: 'connect' | 'disconnect' | 'api_call' | 'error', details?: Record<string, any>) => {
  trackEvent('dropbox_event', {
    dropbox_event: event,
    ...details,
    timestamp: Date.now()
  });
};

// Utility functions
const getCurrentUserId = (): string | undefined => {
  try {
    return auth.currentUser?.uid;
  } catch {
    return undefined;
  }
};

const getEnvironment = (): string => {
  return import.meta.env.VITE_ENVIRONMENT || 'development';
};

const isProductionMode = (): boolean => {
  return getEnvironment() === 'production';
};

// Global error handler
export const initGlobalErrorTracking = () => {
  // Unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    trackError(event.error || new Error(event.message), 'high', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    trackError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      'high',
      { type: 'unhandled_promise_rejection' }
    );
  });

  // Network errors (fetch failures)
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);
      
      // Track API call success/failure
      if (!response.ok) {
        trackError(`HTTP ${response.status}: ${response.statusText}`, 'medium', {
          url: args[0],
          status: response.status,
          type: 'network_error'
        });
      }
      
      return response;
    } catch (error) {
      trackError(error as Error, 'high', {
        url: args[0],
        type: 'network_failure'
      });
      throw error;
    }
  };
};

// Initialize monitoring
export const initMonitoring = () => {
  if (!isProductionMode()) {
    console.log('📊 Monitoring initialized in development mode (console only)');
    return;
  }

  console.log('📊 Initializing production monitoring...');
  
  try {
    initPerformanceMonitoring();
    initGlobalErrorTracking();
    trackBundlePerformance();
    
    // Track app initialization
    trackEvent('app_initialized', {
      timestamp: Date.now(),
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    
    console.log('✅ Monitoring initialized successfully');
  } catch (error) {
    console.warn('⚠️ Monitoring initialization failed:', error);
  }
};

// Export monitoring configuration for external use
export const MONITORING_CONFIG = {
  PERFORMANCE_THRESHOLDS,
  ANALYTICS_EVENTS: [
    'track_play',
    'playlist_create', 
    'auth_error',
    'performance_metric',
    'dropbox_connect',
    'preload_success',
    'preload_failure',
    'bundle_loaded'
  ] as AnalyticsEvent[]
};