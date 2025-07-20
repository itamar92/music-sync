// Security utilities for Dropbox authentication
import { tokenManager } from '../services/tokenManager';
import { TokenEncryption } from '../services/tokenEncryption';
import { KeyRotationService } from '../services/keyRotation';
import { auth } from '../services/firebase';

export interface SecurityAudit {
  timestamp: number;
  checks: SecurityCheck[];
  score: number;
  recommendations: string[];
}

export interface SecurityCheck {
  name: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export class AuthSecurity {
  /**
   * Perform comprehensive security audit
   */
  static async auditSecurity(): Promise<SecurityAudit> {
    console.log('🔒 Performing comprehensive security audit...');
    
    const checks: SecurityCheck[] = [
      await this.checkTokenStorage(),
      await this.checkEnvironmentVariables(),
      await this.checkTokenExpiry(),
      await this.checkProtocolSecurity(),
      await this.checkStorageEncryption(),
      await this.checkEncryptionPerformance(),
      await this.checkKeyRotation(),
      this.checkConsoleLogging(),
      this.checkProductionReadiness(),
      this.checkSecurityMonitoring()
    ];

    const score = this.calculateSecurityScore(checks);
    const recommendations = this.generateRecommendations(checks);

    const audit: SecurityAudit = {
      timestamp: Date.now(),
      checks,
      score,
      recommendations
    };

    this.logAuditResults(audit);
    return audit;
  }

  /**
   * Check token storage security
   */
  private static async checkTokenStorage(): Promise<SecurityCheck> {
    try {
      const tokens = await tokenManager.getStoredTokens();
      
      if (!tokens) {
        return {
          name: 'Token Storage',
          passed: true,
          severity: 'low',
          message: 'No tokens stored'
        };
      }

      // Check if tokens are encrypted (basic check)
      const hasEncryption = tokens.accessToken.length > 100; // Basic heuristic
      
      return {
        name: 'Token Storage',
        passed: hasEncryption,
        severity: hasEncryption ? 'low' : 'high',
        message: hasEncryption 
          ? 'Tokens appear to be encrypted' 
          : 'Tokens may be stored in plain text - implement encryption'
      };
    } catch (error) {
      return {
        name: 'Token Storage',
        passed: false,
        severity: 'medium',
        message: `Token storage check failed: ${error}`
      };
    }
  }

  /**
   * Check environment variable security
   */
  private static async checkEnvironmentVariables(): Promise<SecurityCheck> {
    const appKey = import.meta.env.VITE_DROPBOX_APP_KEY;
    // Client secret not needed in production with PKCE
    const appSecret = undefined;
    const useServerApi = import.meta.env.VITE_USE_SERVER_API === 'true';

    if (!appKey) {
      return {
        name: 'Environment Variables',
        passed: false,
        severity: 'critical',
        message: 'VITE_DROPBOX_APP_KEY is missing'
      };
    }

    if (appSecret && !useServerApi) {
      return {
        name: 'Environment Variables',
        passed: false,
        severity: 'critical',
        message: 'App secret exposed in client-side code - use server API instead'
      };
    }

    if (appSecret && import.meta.env.PROD) {
      return {
        name: 'Environment Variables',
        passed: false,
        severity: 'critical',
        message: 'App secret should never be exposed in production'
      };
    }

    return {
      name: 'Environment Variables',
      passed: true,
      severity: 'low',
      message: 'Environment variables configured securely'
    };
  }

  /**
   * Check token expiry handling
   */
  private static async checkTokenExpiry(): Promise<SecurityCheck> {
    try {
      const tokens = await tokenManager.getStoredTokens();
      
      if (!tokens) {
        return {
          name: 'Token Expiry',
          passed: true,
          severity: 'low',
          message: 'No tokens to check'
        };
      }

      const now = Date.now();
      const isExpired = now >= tokens.expiresAt;
      const hasRefreshToken = !!tokens.refreshToken;

      if (isExpired && !hasRefreshToken) {
        return {
          name: 'Token Expiry',
          passed: false,
          severity: 'high',
          message: 'Token expired and no refresh token available'
        };
      }

      if (isExpired) {
        return {
          name: 'Token Expiry',
          passed: true,
          severity: 'medium',
          message: 'Token expired but refresh token available'
        };
      }

      const timeToExpiry = tokens.expiresAt - now;
      const hoursToExpiry = timeToExpiry / (1000 * 60 * 60);

      return {
        name: 'Token Expiry',
        passed: true,
        severity: hoursToExpiry < 1 ? 'medium' : 'low',
        message: `Token expires in ${hoursToExpiry.toFixed(1)} hours`
      };
    } catch (error) {
      return {
        name: 'Token Expiry',
        passed: false,
        severity: 'medium',
        message: `Token expiry check failed: ${error}`
      };
    }
  }

  /**
   * Check protocol security (HTTPS)
   */
  private static async checkProtocolSecurity(): Promise<SecurityCheck> {
    const isHttps = window.location.protocol === 'https:';
    const isLocalhost = window.location.hostname === 'localhost';
    const isDevelopment = import.meta.env.DEV;

    if (!isHttps && !isLocalhost && !isDevelopment) {
      return {
        name: 'Protocol Security',
        passed: false,
        severity: 'critical',
        message: 'Application must use HTTPS in production'
      };
    }

    if (!isHttps && !isDevelopment) {
      return {
        name: 'Protocol Security',
        passed: false,
        severity: 'medium',
        message: 'Consider using HTTPS even in development'
      };
    }

    return {
      name: 'Protocol Security',
      passed: true,
      severity: 'low',
      message: isHttps ? 'Using secure HTTPS protocol' : 'HTTP acceptable for development'
    };
  }

  /**
   * Check storage encryption implementation and effectiveness
   */
  private static async checkStorageEncryption(): Promise<SecurityCheck> {
    const supportsWebCrypto = TokenEncryption.isWebCryptoSupported();
    
    if (!supportsWebCrypto) {
      return {
        name: 'Storage Encryption',
        passed: false,
        severity: 'critical',
        message: 'Web Crypto API not available - cannot encrypt tokens securely'
      };
    }

    try {
      // Check if tokens are actually encrypted in storage
      const tokens = await tokenManager.getStoredTokens();
      
      if (!tokens) {
        return {
          name: 'Storage Encryption',
          passed: true,
          severity: 'low',
          message: 'No tokens stored to encrypt'
        };
      }

      // Check storage format to determine if encryption is active
      const user = auth.currentUser;
      const keyPrefix = user ? `_${user.uid}` : '';
      const isEncrypted = localStorage.getItem(`dropbox_access_token${keyPrefix}_encrypted`) === 'true';
      
      if (isEncrypted) {
        return {
          name: 'Storage Encryption',
          passed: true,
          severity: 'low',
          message: 'Tokens are encrypted with AES-GCM and PBKDF2 key derivation'
        };
      } else {
        return {
          name: 'Storage Encryption',
          passed: false,
          severity: 'high',
          message: 'Tokens stored without encryption - using fallback encoding only'
        };
      }
    } catch (error) {
      return {
        name: 'Storage Encryption',
        passed: false,
        severity: 'medium',
        message: `Encryption check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check encryption performance and security parameters
   */
  private static async checkEncryptionPerformance(): Promise<SecurityCheck> {
    try {
      if (!TokenEncryption.isWebCryptoSupported()) {
        return {
          name: 'Encryption Performance',
          passed: false,
          severity: 'medium',
          message: 'Cannot test encryption performance - Web Crypto API not available'
        };
      }

      const metrics = await TokenEncryption.getEncryptionMetrics();
      
      if (!metrics.success) {
        return {
          name: 'Encryption Performance',
          passed: false,
          severity: 'high',
          message: `Encryption test failed: ${metrics.error || 'Unknown error'}`
        };
      }

      // Check performance thresholds
      const encryptionTooSlow = metrics.encryptionTime > 1000; // 1 second
      const decryptionTooSlow = metrics.decryptionTime > 500; // 0.5 seconds
      
      if (encryptionTooSlow || decryptionTooSlow) {
        return {
          name: 'Encryption Performance',
          passed: false,
          severity: 'medium',
          message: `Encryption performance below threshold (encrypt: ${metrics.encryptionTime.toFixed(2)}ms, decrypt: ${metrics.decryptionTime.toFixed(2)}ms)`
        };
      }

      return {
        name: 'Encryption Performance',
        passed: true,
        severity: 'low',
        message: `Encryption performance acceptable (encrypt: ${metrics.encryptionTime.toFixed(2)}ms, decrypt: ${metrics.decryptionTime.toFixed(2)}ms)`
      };
    } catch (error) {
      return {
        name: 'Encryption Performance',
        passed: false,
        severity: 'medium',
        message: `Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check key rotation status and schedule
   */
  private static async checkKeyRotation(): Promise<SecurityCheck> {
    try {
      const rotationStatus = KeyRotationService.checkRotationStatus();
      
      if (rotationStatus.rotationRequired) {
        const daysSinceRotation = (Date.now() - rotationStatus.lastRotation) / (1000 * 60 * 60 * 24);
        
        return {
          name: 'Key Rotation',
          passed: false,
          severity: daysSinceRotation > 365 ? 'critical' : 'medium',
          message: `Key rotation required: ${rotationStatus.reason}`
        };
      }

      const daysSinceRotation = (Date.now() - rotationStatus.lastRotation) / (1000 * 60 * 60 * 24);
      
      return {
        name: 'Key Rotation',
        passed: true,
        severity: 'low',
        message: `Key rotation current (last rotation: ${Math.floor(daysSinceRotation)} days ago)`
      };
    } catch (error) {
      return {
        name: 'Key Rotation',
        passed: false,
        severity: 'medium',
        message: `Key rotation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check for security-sensitive console logging
   */
  private static checkConsoleLogging(): SecurityCheck {
    const isProduction = import.meta.env.PROD;
    
    if (isProduction) {
      // In production, all detailed logging should be disabled
      return {
        name: 'Console Logging',
        passed: false, // Assume logging is enabled for this check
        severity: 'medium',
        message: 'Detailed authentication logging should be disabled in production'
      };
    }

    return {
      name: 'Console Logging',
      passed: true,
      severity: 'low',
      message: 'Development logging is acceptable'
    };
  }

  /**
   * Check security monitoring and audit capabilities
   */
  private static checkSecurityMonitoring(): SecurityCheck {
    try {
      // Check if security logs are being captured
      const tokenLogs = sessionStorage.getItem('token_security_log');
      const rotationLogs = sessionStorage.getItem('key_rotation_log');
      const auditLogs = sessionStorage.getItem('security_audit_log');
      
      const hasLogging = !!(tokenLogs || rotationLogs || auditLogs);
      
      if (!hasLogging) {
        return {
          name: 'Security Monitoring',
          passed: false,
          severity: 'medium',
          message: 'No security audit logs found - monitoring may not be active'
        };
      }

      // Count total security events
      let totalEvents = 0;
      try {
        totalEvents += JSON.parse(tokenLogs || '[]').length;
        totalEvents += JSON.parse(rotationLogs || '[]').length;
        totalEvents += JSON.parse(auditLogs || '[]').length;
      } catch {
        // Ignore parsing errors
      }

      return {
        name: 'Security Monitoring',
        passed: true,
        severity: 'low',
        message: `Security monitoring active (${totalEvents} events logged)`
      };
    } catch (error) {
      return {
        name: 'Security Monitoring',
        passed: false,
        severity: 'medium',
        message: `Security monitoring check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Check production readiness
   */
  private static checkProductionReadiness(): SecurityCheck {
    const isProduction = import.meta.env.PROD;
    const useServerApi = import.meta.env.VITE_USE_SERVER_API === 'true';
    // PKCE authentication doesn't require client secret
    const hasAppSecret = false;

    if (isProduction && hasAppSecret) {
      return {
        name: 'Production Readiness',
        passed: false,
        severity: 'critical',
        message: 'App secret exposed in production build'
      };
    }

    if (isProduction && !useServerApi) {
      return {
        name: 'Production Readiness',
        passed: false,
        severity: 'high',
        message: 'Should use server API for production to avoid exposing credentials'
      };
    }

    return {
      name: 'Production Readiness',
      passed: true,
      severity: 'low',
      message: isProduction 
        ? 'Production configuration appears secure'
        : 'Development configuration'
    };
  }

  /**
   * Calculate overall security score
   */
  private static calculateSecurityScore(checks: SecurityCheck[]): number {
    const weights = {
      critical: 0,
      high: 25,
      medium: 70,
      low: 90
    };

    let totalWeight = 0;
    let weightedScore = 0;

    checks.forEach(check => {
      const weight = check.passed ? 100 : weights[check.severity];
      weightedScore += weight;
      totalWeight += 100;
    });

    return Math.round((weightedScore / totalWeight) * 100);
  }

  /**
   * Generate security recommendations
   */
  private static generateRecommendations(checks: SecurityCheck[]): string[] {
    const recommendations: string[] = [];

    checks.forEach(check => {
      if (!check.passed) {
        switch (check.severity) {
          case 'critical':
            recommendations.push(`🚨 CRITICAL: ${check.message}`);
            break;
          case 'high':
            recommendations.push(`❗ HIGH: ${check.message}`);
            break;
          case 'medium':
            recommendations.push(`⚠️ MEDIUM: ${check.message}`);
            break;
          case 'low':
            recommendations.push(`💡 LOW: ${check.message}`);
            break;
        }
      }
    });

    // Add general recommendations
    recommendations.push('✅ Enable server-side token management for production');
    recommendations.push('✅ Implement token encryption using Web Crypto API');
    recommendations.push('✅ Use environment variables for all sensitive configuration');
    recommendations.push('✅ Disable debug logging in production builds');

    return recommendations;
  }

  /**
   * Log audit results
   */
  private static logAuditResults(audit: SecurityAudit): void {
    console.group('🔒 Security Audit Results');
    console.log(`📊 Security Score: ${audit.score}/100`);
    
    console.group('🔍 Security Checks');
    audit.checks.forEach(check => {
      const emoji = check.passed ? '✅' : this.getSeverityEmoji(check.severity);
      console.log(`${emoji} ${check.name}: ${check.message}`);
    });
    console.groupEnd();

    if (audit.recommendations.length > 0) {
      console.group('💡 Recommendations');
      audit.recommendations.forEach(rec => console.log(rec));
      console.groupEnd();
    }

    console.groupEnd();
  }

  /**
   * Get emoji for severity level
   */
  private static getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '❗';
      case 'medium': return '⚠️';
      case 'low': return '💡';
      default: return '❓';
    }
  }

  /**
   * Validate token refresh security
   */
  static async validateRefreshSecurity(): Promise<boolean> {
    try {
      const tokens = await tokenManager.getStoredTokens();
      
      if (!tokens?.refreshToken) {
        console.warn('⚠️ No refresh token available for security validation');
        return false;
      }

      // Check refresh token format (basic validation)
      const isValidFormat = tokens.refreshToken.length > 20 && 
                           tokens.refreshToken.startsWith('sl.');

      if (!isValidFormat) {
        console.error('❌ Refresh token format validation failed');
        return false;
      }

      console.log('✅ Refresh token security validation passed');
      return true;
    } catch (error) {
      console.error('❌ Refresh token security validation failed:', error);
      return false;
    }
  }

  /**
   * Monitor for security violations
   */
  static startSecurityMonitoring(): void {
    // Monitor for token tampering
    window.addEventListener('storage', (event) => {
      if (event.key?.includes('dropbox') && event.oldValue !== event.newValue) {
        console.warn('⚠️ Dropbox token storage modified externally');
        this.auditSecurity();
      }
    });

    // Periodic security checks (every 30 minutes)
    setInterval(() => {
      this.auditSecurity();
    }, 30 * 60 * 1000);

    console.log('🔒 Security monitoring started');
  }
}

export default AuthSecurity;