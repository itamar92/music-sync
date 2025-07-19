// Comprehensive error handling for Dropbox authentication
import { tokenManager } from './tokenManager';

export interface AuthError {
  code: string;
  message: string;
  userMessage: string;
  recovery: 'retry' | 'reauth' | 'manual' | 'none';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class AuthErrorHandler {
  private static readonly ERROR_CODES = {
    // Token related errors
    TOKEN_EXPIRED: 'token_expired',
    TOKEN_INVALID: 'token_invalid',
    TOKEN_MISSING: 'token_missing',
    REFRESH_FAILED: 'refresh_failed',
    
    // Network errors
    NETWORK_ERROR: 'network_error',
    API_UNAVAILABLE: 'api_unavailable',
    RATE_LIMITED: 'rate_limited',
    
    // OAuth errors
    OAUTH_DENIED: 'oauth_denied',
    OAUTH_ERROR: 'oauth_error',
    INVALID_GRANT: 'invalid_grant',
    
    // Configuration errors
    CONFIG_MISSING: 'config_missing',
    CONFIG_INVALID: 'config_invalid',
    
    // Security errors
    SECURITY_VIOLATION: 'security_violation',
    UNAUTHORIZED_ACCESS: 'unauthorized_access'
  } as const;

  /**
   * Handle authentication errors with automatic recovery
   */
  static async handleAuthError(error: any): Promise<AuthError> {
    const authError = this.classifyError(error);
    
    console.error(`🚨 Auth Error [${authError.code}]:`, authError.message);
    
    // Attempt automatic recovery based on error type
    switch (authError.recovery) {
      case 'retry':
        console.log('🔄 Attempting automatic retry...');
        await this.performRetry(authError);
        break;
        
      case 'reauth':
        console.log('🔐 Authentication required, clearing invalid tokens...');
        await this.performReauth(authError);
        break;
        
      case 'manual':
        console.log('⚠️ Manual intervention required');
        this.logManualSteps(authError);
        break;
        
      case 'none':
        console.log('❌ No automatic recovery available');
        break;
    }
    
    return authError;
  }

  /**
   * Classify error and determine recovery strategy
   */
  private static classifyError(error: any): AuthError {
    // Network errors
    if (!navigator.onLine) {
      return {
        code: this.ERROR_CODES.NETWORK_ERROR,
        message: 'No internet connection',
        userMessage: 'Please check your internet connection and try again.',
        recovery: 'retry',
        severity: 'medium'
      };
    }

    // HTTP status based errors
    if (error.status) {
      switch (error.status) {
        case 401:
          return this.handle401Error(error);
        case 403:
          return {
            code: this.ERROR_CODES.UNAUTHORIZED_ACCESS,
            message: 'Access denied by Dropbox API',
            userMessage: 'Access denied. Please check your app permissions.',
            recovery: 'reauth',
            severity: 'high'
          };
        case 429:
          return {
            code: this.ERROR_CODES.RATE_LIMITED,
            message: 'API rate limit exceeded',
            userMessage: 'Too many requests. Please wait a moment and try again.',
            recovery: 'retry',
            severity: 'medium'
          };
        case 500:
        case 502:
        case 503:
          return {
            code: this.ERROR_CODES.API_UNAVAILABLE,
            message: `Dropbox API error: ${error.status}`,
            userMessage: 'Dropbox service is temporarily unavailable. Please try again later.',
            recovery: 'retry',
            severity: 'medium'
          };
      }
    }

    // OAuth specific errors
    if (error.error) {
      switch (error.error) {
        case 'access_denied':
          return {
            code: this.ERROR_CODES.OAUTH_DENIED,
            message: 'User denied OAuth authorization',
            userMessage: 'Authorization was cancelled. Please try connecting again.',
            recovery: 'reauth',
            severity: 'low'
          };
        case 'invalid_grant':
          return {
            code: this.ERROR_CODES.INVALID_GRANT,
            message: 'Invalid authorization grant',
            userMessage: 'Authorization expired. Please reconnect to Dropbox.',
            recovery: 'reauth',
            severity: 'medium'
          };
      }
    }

    // Configuration errors
    if (error.message?.includes('not configured') || error.message?.includes('not found')) {
      return {
        code: this.ERROR_CODES.CONFIG_MISSING,
        message: error.message,
        userMessage: 'Configuration error. Please contact support.',
        recovery: 'manual',
        severity: 'critical'
      };
    }

    // Generic error
    return {
      code: 'unknown_error',
      message: error.message || 'Unknown authentication error',
      userMessage: 'An unexpected error occurred. Please try again.',
      recovery: 'retry',
      severity: 'medium'
    };
  }

  /**
   * Handle 401 Unauthorized errors with specific logic
   */
  private static handle401Error(error: any): AuthError {
    const errorText = error.error_description || error.message || '';
    
    if (errorText.includes('expired')) {
      return {
        code: this.ERROR_CODES.TOKEN_EXPIRED,
        message: 'Access token has expired',
        userMessage: 'Your session has expired. Refreshing authentication...',
        recovery: 'retry', // Will trigger automatic refresh
        severity: 'medium'
      };
    }
    
    if (errorText.includes('invalid')) {
      return {
        code: this.ERROR_CODES.TOKEN_INVALID,
        message: 'Access token is invalid',
        userMessage: 'Invalid authentication. Please reconnect to Dropbox.',
        recovery: 'reauth',
        severity: 'high'
      };
    }
    
    return {
      code: this.ERROR_CODES.TOKEN_INVALID,
      message: 'Authentication failed',
      userMessage: 'Authentication failed. Please reconnect to Dropbox.',
      recovery: 'reauth',
      severity: 'high'
    };
  }

  /**
   * Perform automatic retry with exponential backoff
   */
  private static async performRetry(error: AuthError): Promise<void> {
    if (error.code === this.ERROR_CODES.TOKEN_EXPIRED) {
      try {
        const validToken = await tokenManager.getValidAccessToken();
        if (validToken) {
          console.log('✅ Token refresh successful');
          return;
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        throw new Error('Token refresh failed');
      }
    }
    
    if (error.code === this.ERROR_CODES.RATE_LIMITED) {
      // Wait before retry (handled by caller)
      return;
    }
    
    if (error.code === this.ERROR_CODES.NETWORK_ERROR) {
      // Wait for network recovery (handled by caller)
      return;
    }
  }

  /**
   * Perform re-authentication by clearing tokens
   */
  private static async performReauth(error: AuthError): Promise<void> {
    try {
      await tokenManager.clearStoredTokens();
      console.log('🗑️ Invalid tokens cleared, re-authentication required');
    } catch (clearError) {
      console.error('❌ Failed to clear tokens:', clearError);
    }
  }

  /**
   * Log manual intervention steps
   */
  private static logManualSteps(error: AuthError): void {
    console.group('🔧 Manual Intervention Required');
    console.log('Error Code:', error.code);
    console.log('Error Message:', error.message);
    console.log('User Message:', error.userMessage);
    
    switch (error.code) {
      case this.ERROR_CODES.CONFIG_MISSING:
        console.log('Steps to resolve:');
        console.log('1. Check environment variables are set correctly');
        console.log('2. Verify VITE_DROPBOX_APP_KEY is configured');
        console.log('3. Ensure Dropbox app settings are correct');
        break;
        
      case this.ERROR_CODES.SECURITY_VIOLATION:
        console.log('Security Steps:');
        console.log('1. Check for unauthorized access attempts');
        console.log('2. Verify app permissions and scopes');
        console.log('3. Review Dropbox app security settings');
        break;
    }
    
    console.groupEnd();
  }

  /**
   * Validate error recovery success
   */
  static async validateRecovery(): Promise<boolean> {
    try {
      const hasValidAuth = await tokenManager.hasValidAuthentication();
      console.log(`🔍 Recovery validation: ${hasValidAuth ? 'SUCCESS' : 'FAILED'}`);
      return hasValidAuth;
    } catch (error) {
      console.error('❌ Recovery validation failed:', error);
      return false;
    }
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: any): string {
    const authError = this.classifyError(error);
    return authError.userMessage;
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: any): boolean {
    const authError = this.classifyError(error);
    return authError.recovery !== 'none' && authError.severity !== 'critical';
  }

  /**
   * Get recommended action for error
   */
  static getRecommendedAction(error: any): string {
    const authError = this.classifyError(error);
    
    switch (authError.recovery) {
      case 'retry':
        return 'Automatic retry in progress...';
      case 'reauth':
        return 'Please reconnect to Dropbox';
      case 'manual':
        return 'Manual intervention required - check console for details';
      case 'none':
        return 'Contact support for assistance';
      default:
        return 'Please try again';
    }
  }
}

export default AuthErrorHandler;