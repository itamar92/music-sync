// Key rotation and migration service for secure token encryption
import { TokenEncryption, EncryptedData } from './tokenEncryption';
import { tokenManager } from './tokenManager';
import { auth } from './firebase';

export interface KeyRotationStatus {
  rotationRequired: boolean;
  currentVersion: number;
  targetVersion: number;
  lastRotation: number;
  reason: string;
}

export interface MigrationResult {
  success: boolean;
  tokensUpdated: number;
  errors: string[];
  duration: number;
}

export class KeyRotationService {
  private static readonly ROTATION_INTERVAL_DAYS = 90; // 3 months
  private static readonly MAX_KEY_AGE_DAYS = 365; // 1 year maximum
  private static readonly ROTATION_STORAGE_KEY = 'key_rotation_metadata';

  /**
   * Check if key rotation is required
   */
  static checkRotationStatus(): KeyRotationStatus {
    try {
      const metadata = this.getRotationMetadata();
      const now = Date.now();
      const daysSinceRotation = (now - metadata.lastRotation) / (1000 * 60 * 60 * 24);
      
      let rotationRequired = false;
      let reason = 'No rotation needed';
      
      if (daysSinceRotation > this.ROTATION_INTERVAL_DAYS) {
        rotationRequired = true;
        reason = `Scheduled rotation (${Math.floor(daysSinceRotation)} days since last rotation)`;
      } else if (daysSinceRotation > this.MAX_KEY_AGE_DAYS) {
        rotationRequired = true;
        reason = `Critical: Key age exceeds maximum allowed (${Math.floor(daysSinceRotation)} days)`;
      } else if (metadata.currentVersion < metadata.targetVersion) {
        rotationRequired = true;
        reason = 'Version upgrade required';
      }
      
      return {
        rotationRequired,
        currentVersion: metadata.currentVersion,
        targetVersion: metadata.targetVersion,
        lastRotation: metadata.lastRotation,
        reason
      };
    } catch (error) {
      console.error('❌ Failed to check rotation status:', error);
      return {
        rotationRequired: true,
        currentVersion: 0,
        targetVersion: 1,
        lastRotation: 0,
        reason: 'Unable to determine rotation status - forcing rotation'
      };
    }
  }

  /**
   * Perform automatic key rotation if required
   */
  static async performAutoRotation(): Promise<MigrationResult> {
    const status = this.checkRotationStatus();
    
    if (!status.rotationRequired) {
      console.log('✅ Key rotation not required at this time');
      return {
        success: true,
        tokensUpdated: 0,
        errors: [],
        duration: 0
      };
    }

    console.log(`🔄 Starting automatic key rotation: ${status.reason}`);
    return await this.rotateEncryptionKeys();
  }

  /**
   * Force key rotation (for security incidents or manual rotation)
   */
  static async forceRotation(reason: string = 'Manual rotation'): Promise<MigrationResult> {
    console.log(`🔄 Forcing key rotation: ${reason}`);
    return await this.rotateEncryptionKeys();
  }

  /**
   * Rotate encryption keys for stored tokens
   */
  private static async rotateEncryptionKeys(): Promise<MigrationResult> {
    const startTime = performance.now();
    const result: MigrationResult = {
      success: false,
      tokensUpdated: 0,
      errors: [],
      duration: 0
    };

    try {
      console.log('🔐 Starting token re-encryption with new keys...');
      
      // Check if Web Crypto is supported
      if (!TokenEncryption.isWebCryptoSupported()) {
        throw new Error('Web Crypto API not supported - cannot perform key rotation');
      }

      // Get current tokens
      const currentTokens = await tokenManager.getStoredTokens();
      
      if (!currentTokens) {
        console.log('📋 No tokens found to rotate');
        result.success = true;
        return result;
      }

      // Re-encrypt tokens with new keys
      console.log('🔄 Re-encrypting access and refresh tokens...');
      
      // Clear existing encrypted storage
      await tokenManager.clearStoredTokens();
      
      // Store tokens again (this will use new encryption keys)
      await tokenManager.storeTokens(currentTokens);
      
      result.tokensUpdated = 2; // access + refresh token
      result.success = true;
      
      // Update rotation metadata
      this.updateRotationMetadata();
      
      console.log('✅ Key rotation completed successfully');
      
      // Log security event
      this.logRotationEvent('KEY_ROTATION_SUCCESS', {
        tokensUpdated: result.tokensUpdated,
        duration: performance.now() - startTime
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Key rotation failed:', error);
      
      result.errors.push(errorMessage);
      
      this.logRotationEvent('KEY_ROTATION_FAILED', {
        error: errorMessage,
        duration: performance.now() - startTime
      });
    }
    
    result.duration = performance.now() - startTime;
    return result;
  }

  /**
   * Migrate from legacy token storage to encrypted storage
   */
  static async migrateLegacyTokens(): Promise<MigrationResult> {
    const startTime = performance.now();
    const result: MigrationResult = {
      success: false,
      tokensUpdated: 0,
      errors: [],
      duration: 0
    };

    try {
      console.log('🔄 Starting legacy token migration...');
      
      const user = auth.currentUser;
      const keyPrefix = user ? `_${user.uid}` : '';
      
      // Check for legacy tokens
      const legacyAccessToken = localStorage.getItem('dropbox_access_token');
      const legacyRefreshToken = localStorage.getItem('dropbox_refresh_token');
      
      // Check for fallback encoded tokens
      const fallbackAccessToken = localStorage.getItem(`dropbox_access_token${keyPrefix}`);
      const fallbackRefreshToken = localStorage.getItem(`dropbox_refresh_token${keyPrefix}`);
      const isEncrypted = localStorage.getItem(`dropbox_access_token${keyPrefix}_encrypted`) === 'true';
      
      let tokensToMigrate: { accessToken: string; refreshToken: string } | null = null;
      
      if (legacyAccessToken && legacyRefreshToken) {
        console.log('🔍 Found legacy plaintext tokens');
        tokensToMigrate = {
          accessToken: legacyAccessToken,
          refreshToken: legacyRefreshToken
        };
      } else if (fallbackAccessToken && fallbackRefreshToken && !isEncrypted) {
        console.log('🔍 Found fallback encoded tokens');
        try {
          tokensToMigrate = {
            accessToken: atob(fallbackAccessToken),
            refreshToken: atob(fallbackRefreshToken)
          };
        } catch (decodeError) {
          result.errors.push('Failed to decode fallback tokens');
        }
      }
      
      if (!tokensToMigrate) {
        console.log('📋 No legacy tokens found to migrate');
        result.success = true;
        return result;
      }

      // Create token data with current timestamp as expiry (will be refreshed)
      const tokenData = {
        accessToken: tokensToMigrate.accessToken,
        refreshToken: tokensToMigrate.refreshToken,
        expiresAt: Date.now() + (4 * 60 * 60 * 1000), // 4 hours default
        tokenType: 'bearer'
      };

      // Store with encryption
      await tokenManager.storeTokens(tokenData);
      
      // Clean up legacy storage
      localStorage.removeItem('dropbox_access_token');
      localStorage.removeItem('dropbox_refresh_token');
      
      result.tokensUpdated = 2;
      result.success = true;
      
      console.log('✅ Legacy token migration completed');
      
      this.logRotationEvent('LEGACY_MIGRATION_SUCCESS', {
        tokensUpdated: result.tokensUpdated
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Legacy token migration failed:', error);
      
      result.errors.push(errorMessage);
      
      this.logRotationEvent('LEGACY_MIGRATION_FAILED', {
        error: errorMessage
      });
    }
    
    result.duration = performance.now() - startTime;
    return result;
  }

  /**
   * Get rotation metadata from storage
   */
  private static getRotationMetadata(): {
    currentVersion: number;
    targetVersion: number;
    lastRotation: number;
  } {
    try {
      const stored = localStorage.getItem(this.ROTATION_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ Failed to parse rotation metadata:', error);
    }
    
    // Default metadata
    return {
      currentVersion: 1,
      targetVersion: 1,
      lastRotation: Date.now()
    };
  }

  /**
   * Update rotation metadata after successful rotation
   */
  private static updateRotationMetadata(): void {
    try {
      const metadata = {
        currentVersion: 1, // Current encryption version
        targetVersion: 1,
        lastRotation: Date.now()
      };
      
      localStorage.setItem(this.ROTATION_STORAGE_KEY, JSON.stringify(metadata));
      console.log('📝 Rotation metadata updated');
    } catch (error) {
      console.error('❌ Failed to update rotation metadata:', error);
    }
  }

  /**
   * Schedule automatic key rotation
   */
  static scheduleRotation(): void {
    // Check rotation status every hour
    const checkInterval = 60 * 60 * 1000; // 1 hour
    
    setInterval(async () => {
      try {
        const status = this.checkRotationStatus();
        if (status.rotationRequired) {
          console.log('⏰ Scheduled key rotation triggered');
          await this.performAutoRotation();
        }
      } catch (error) {
        console.error('❌ Scheduled rotation check failed:', error);
      }
    }, checkInterval);
    
    console.log('⏰ Key rotation scheduler initialized');
  }

  /**
   * Get rotation history for audit purposes
   */
  static getRotationHistory(): any[] {
    try {
      return JSON.parse(sessionStorage.getItem('key_rotation_log') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Log rotation events
   */
  private static logRotationEvent(event: string, details: Record<string, any>): void {
    const user = auth.currentUser;
    const rotationLog = {
      timestamp: new Date().toISOString(),
      event,
      userId: user?.uid || 'anonymous',
      details
    };

    console.log(`🔑 Key Rotation Event [${event}]:`, rotationLog);
    
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('key_rotation_log') || '[]');
      existingLogs.push(rotationLog);
      
      // Keep only last 20 rotation events
      if (existingLogs.length > 20) {
        existingLogs.splice(0, existingLogs.length - 20);
      }
      
      sessionStorage.setItem('key_rotation_log', JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('⚠️ Failed to store rotation log:', error);
    }
  }
}

export default KeyRotationService;