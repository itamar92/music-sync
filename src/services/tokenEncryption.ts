// Enterprise-grade token encryption service using Web Crypto API
// Implements AES-GCM with PBKDF2 key derivation for maximum security

import { auth } from './firebase';

export interface EncryptedData {
  encryptedData: string;
  iv: string;
  salt: string;
  keyVersion: number;
  algorithm: string;
  iterations: number;
}

export interface EncryptionMetrics {
  encryptionTime: number;
  decryptionTime: number;
  keyDerivationTime: number;
  success: boolean;
  error?: string;
}

export class TokenEncryption {
  // Security parameters - industry standard values
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256; // 256-bit AES
  private static readonly IV_LENGTH = 12; // 96-bit IV for GCM
  private static readonly SALT_LENGTH = 32; // 256-bit salt
  private static readonly TAG_LENGTH = 128; // 128-bit authentication tag
  private static readonly PBKDF2_ITERATIONS = 100000; // OWASP recommended minimum
  private static readonly KEY_VERSION = 1; // For future key rotation

  /**
   * Encrypt sensitive token data using AES-GCM with user-derived key
   */
  static async encryptToken(plaintext: string, userId?: string): Promise<EncryptedData> {
    const startTime = performance.now();
    
    try {
      console.log('🔐 Starting token encryption...');
      
      // Validate environment
      if (!this.isWebCryptoSupported()) {
        throw new Error('Web Crypto API not supported in this environment');
      }

      // Generate cryptographically secure random values
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      console.log(`🔑 Generated salt (${salt.length} bytes) and IV (${iv.length} bytes)`);

      // Derive encryption key from user context
      const key = await this.deriveEncryptionKey(salt, userId);
      
      // Encrypt the plaintext
      const encoder = new TextEncoder();
      const plaintextBytes = encoder.encode(plaintext);
      
      const encryptedBuffer = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
          tagLength: this.TAG_LENGTH
        },
        key,
        plaintextBytes
      );

      const encryptedArray = new Uint8Array(encryptedBuffer);
      
      // Encode all binary data as base64 for storage
      const encryptedData: EncryptedData = {
        encryptedData: this.arrayBufferToBase64(encryptedArray),
        iv: this.arrayBufferToBase64(iv),
        salt: this.arrayBufferToBase64(salt),
        keyVersion: this.KEY_VERSION,
        algorithm: this.ALGORITHM,
        iterations: this.PBKDF2_ITERATIONS
      };

      const endTime = performance.now();
      console.log(`✅ Token encryption completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Security audit log
      this.logSecurityEvent('ENCRYPTION_SUCCESS', {
        algorithm: this.ALGORITHM,
        keyLength: this.KEY_LENGTH,
        iterations: this.PBKDF2_ITERATIONS,
        duration: endTime - startTime
      });

      return encryptedData;
    } catch (error) {
      const endTime = performance.now();
      console.error('❌ Token encryption failed:', error);
      
      this.logSecurityEvent('ENCRYPTION_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: endTime - startTime
      });
      
      throw new Error(`Token encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt token data using stored encryption parameters
   */
  static async decryptToken(encryptedData: EncryptedData, userId?: string): Promise<string> {
    const startTime = performance.now();
    
    try {
      console.log('🔓 Starting token decryption...');
      
      // Validate environment
      if (!this.isWebCryptoSupported()) {
        throw new Error('Web Crypto API not supported in this environment');
      }

      // Validate encrypted data structure
      this.validateEncryptedData(encryptedData);
      
      // Decode binary data from base64
      const encryptedBytes = this.base64ToArrayBuffer(encryptedData.encryptedData);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);
      const salt = this.base64ToArrayBuffer(encryptedData.salt);
      
      console.log(`🔑 Loaded encrypted data (${encryptedBytes.byteLength} bytes)`);

      // Derive the same encryption key
      const key = await this.deriveEncryptionKey(new Uint8Array(salt), userId, encryptedData.iterations);
      
      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: encryptedData.algorithm,
          iv: new Uint8Array(iv),
          tagLength: this.TAG_LENGTH
        },
        key,
        encryptedBytes
      );

      const decoder = new TextDecoder();
      const plaintext = decoder.decode(decryptedBuffer);
      
      const endTime = performance.now();
      console.log(`✅ Token decryption completed in ${(endTime - startTime).toFixed(2)}ms`);
      
      // Security audit log
      this.logSecurityEvent('DECRYPTION_SUCCESS', {
        algorithm: encryptedData.algorithm,
        keyVersion: encryptedData.keyVersion,
        duration: endTime - startTime
      });

      return plaintext;
    } catch (error) {
      const endTime = performance.now();
      console.error('❌ Token decryption failed:', error);
      
      this.logSecurityEvent('DECRYPTION_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: endTime - startTime
      });
      
      throw new Error(`Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Derive encryption key using PBKDF2 with user-specific salt
   */
  private static async deriveEncryptionKey(salt: Uint8Array, userId?: string, iterations?: number): Promise<CryptoKey> {
    const keyDerivationStart = performance.now();
    
    try {
      // Create key material from user context + environment factors
      const keyMaterial = await this.generateKeyMaterial(userId);
      
      // Derive actual encryption key using PBKDF2
      const derivedKey = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations || this.PBKDF2_ITERATIONS,
          hash: 'SHA-256'
        },
        keyMaterial,
        {
          name: this.ALGORITHM,
          length: this.KEY_LENGTH
        },
        false, // Not extractable for security
        ['encrypt', 'decrypt']
      );

      const keyDerivationEnd = performance.now();
      console.log(`🔑 Key derivation completed in ${(keyDerivationEnd - keyDerivationStart).toFixed(2)}ms`);
      
      return derivedKey;
    } catch (error) {
      console.error('❌ Key derivation failed:', error);
      throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate key material from user context and environment
   */
  private static async generateKeyMaterial(userId?: string): Promise<CryptoKey> {
    try {
      // Build key material from multiple sources for security
      const keyComponents = [
        userId || 'anonymous',
        window.location.hostname,
        navigator.userAgent.slice(0, 50), // Partial fingerprint
        'music-sync-encryption-v1' // App-specific constant
      ];

      const keyString = keyComponents.join('|');
      const encoder = new TextEncoder();
      const keyData = encoder.encode(keyString);

      // Import as PBKDF2 key material
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      return keyMaterial;
    } catch (error) {
      console.error('❌ Key material generation failed:', error);
      throw new Error('Failed to generate encryption key material');
    }
  }

  /**
   * Validate encrypted data structure and parameters
   */
  private static validateEncryptedData(data: EncryptedData): void {
    const requiredFields = ['encryptedData', 'iv', 'salt', 'algorithm'];
    
    for (const field of requiredFields) {
      if (!data[field as keyof EncryptedData]) {
        throw new Error(`Invalid encrypted data: missing ${field}`);
      }
    }

    // Validate algorithm
    if (data.algorithm !== this.ALGORITHM) {
      throw new Error(`Unsupported encryption algorithm: ${data.algorithm}`);
    }

    // Validate key version
    if (data.keyVersion > this.KEY_VERSION) {
      throw new Error(`Unsupported key version: ${data.keyVersion} (current: ${this.KEY_VERSION})`);
    }

    // Validate iterations (minimum security requirement)
    if (data.iterations && data.iterations < 10000) {
      throw new Error(`Insufficient PBKDF2 iterations: ${data.iterations} (minimum: 10000)`);
    }
  }

  /**
   * Check if Web Crypto API is available and functional
   */
  static isWebCryptoSupported(): boolean {
    try {
      return !!(
        window.crypto &&
        window.crypto.subtle &&
        window.crypto.getRandomValues &&
        typeof window.crypto.subtle.encrypt === 'function' &&
        typeof window.crypto.subtle.decrypt === 'function' &&
        typeof window.crypto.subtle.deriveKey === 'function'
      );
    } catch {
      return false;
    }
  }

  /**
   * Convert ArrayBuffer to base64 string for storage
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string back to ArrayBuffer
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Log security events for audit trail
   */
  private static logSecurityEvent(event: string, details: Record<string, any>): void {
    const user = auth.currentUser;
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      userId: user?.uid || 'anonymous',
      userAgent: navigator.userAgent,
      origin: window.location.origin,
      details
    };

    console.log(`🔒 Security Event [${event}]:`, securityLog);
    
    // Store in session for security monitoring
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('security_audit_log') || '[]');
      existingLogs.push(securityLog);
      
      // Keep only last 50 events to prevent storage bloat
      if (existingLogs.length > 50) {
        existingLogs.splice(0, existingLogs.length - 50);
      }
      
      sessionStorage.setItem('security_audit_log', JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('⚠️ Failed to store security audit log:', error);
    }
  }

  /**
   * Get encryption performance metrics
   */
  static async getEncryptionMetrics(testData: string = 'test-token-data'): Promise<EncryptionMetrics> {
    try {
      const encryptStart = performance.now();
      const encrypted = await this.encryptToken(testData);
      const encryptEnd = performance.now();

      const decryptStart = performance.now();
      const decrypted = await this.decryptToken(encrypted);
      const decryptEnd = performance.now();

      const isValid = decrypted === testData;

      return {
        encryptionTime: encryptEnd - encryptStart,
        decryptionTime: decryptEnd - decryptStart,
        keyDerivationTime: 0, // Included in encryption/decryption times
        success: isValid,
        error: isValid ? undefined : 'Decryption validation failed'
      };
    } catch (error) {
      return {
        encryptionTime: 0,
        decryptionTime: 0,
        keyDerivationTime: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Secure memory cleanup (best effort)
   */
  static secureCleanup(): void {
    try {
      // Clear any sensitive data from memory (limited effectiveness in JS)
      if (typeof window !== 'undefined' && (window as any).gc) {
        (window as any).gc(); // Force garbage collection if available
      }
      
      console.log('🧹 Secure memory cleanup attempted');
    } catch (error) {
      console.warn('⚠️ Secure cleanup failed:', error);
    }
  }
}

export default TokenEncryption;