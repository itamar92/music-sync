// PKCE (Proof Key for Code Exchange) utilities for secure OAuth without client secret
// RFC 7636: https://tools.ietf.org/html/rfc7636

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

export class PKCEUtils {
  /**
   * Generate a cryptographically secure random string for PKCE
   */
  static generateCodeVerifier(): string {
    // Generate 32 random bytes and base64url encode them
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64URLEncode(array);
  }

  /**
   * Create code challenge from code verifier using SHA256
   */
  static async generateCodeChallenge(codeVerifier: string): Promise<string> {
    // Hash the code verifier with SHA256
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    
    // Base64URL encode the hash
    return this.base64URLEncode(new Uint8Array(digest));
  }

  /**
   * Generate a complete PKCE code verifier and challenge pair
   */
  static async generatePKCEPair(): Promise<PKCEPair> {
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);
    
    console.log('🔐 PKCE pair generated');
    console.log('Code verifier length:', codeVerifier.length);
    console.log('Code challenge length:', codeChallenge.length);
    
    return {
      codeVerifier,
      codeChallenge
    };
  }

  /**
   * Store PKCE code verifier in session storage (temporary, secure)
   */
  static storePKCEVerifier(codeVerifier: string): void {
    try {
      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      console.log('🔐 PKCE code verifier stored securely');
    } catch (error) {
      console.error('❌ Failed to store PKCE code verifier:', error);
      throw new Error('PKCE storage failed');
    }
  }

  /**
   * Retrieve and remove PKCE code verifier from session storage
   */
  static retrievePKCEVerifier(): string | null {
    try {
      const codeVerifier = sessionStorage.getItem('pkce_code_verifier');
      if (codeVerifier) {
        // Remove after retrieval for security
        sessionStorage.removeItem('pkce_code_verifier');
        console.log('🔐 PKCE code verifier retrieved and cleared');
      }
      return codeVerifier;
    } catch (error) {
      console.error('❌ Failed to retrieve PKCE code verifier:', error);
      return null;
    }
  }

  /**
   * Base64URL encode (RFC 4648 Section 5) - URL safe base64 without padding
   */
  private static base64URLEncode(bytes: Uint8Array): string {
    // Convert to regular base64
    const base64 = btoa(String.fromCharCode(...bytes));
    
    // Make it URL safe and remove padding
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Check if PKCE is supported by current environment
   */
  static isPKCESupported(): boolean {
    try {
      return !!(
        window.crypto &&
        window.crypto.subtle &&
        window.crypto.getRandomValues &&
        window.sessionStorage
      );
    } catch {
      return false;
    }
  }

  /**
   * Validate code verifier format (43-128 characters, URL safe)
   */
  static isValidCodeVerifier(codeVerifier: string): boolean {
    if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
      return false;
    }
    
    // Check if it contains only URL-safe characters
    const urlSafeRegex = /^[A-Za-z0-9\-._~]+$/;
    return urlSafeRegex.test(codeVerifier);
  }

  /**
   * Clear any stored PKCE data (cleanup)
   */
  static clearPKCEData(): void {
    try {
      sessionStorage.removeItem('pkce_code_verifier');
      console.log('🗑️ PKCE data cleared');
    } catch (error) {
      console.error('❌ Failed to clear PKCE data:', error);
    }
  }
}

export default PKCEUtils;