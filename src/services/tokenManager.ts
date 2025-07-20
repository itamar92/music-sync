// Token management service for secure Dropbox authentication
import { auth } from './firebase';
import { TokenEncryption, EncryptedData } from './tokenEncryption';

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

interface TokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string; // Optional - Dropbox may return new refresh token
}

class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'dropbox_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'dropbox_refresh_token';
  private static readonly TOKEN_EXPIRY_KEY = 'dropbox_token_expiry';
  private static readonly TOKEN_TYPE_KEY = 'dropbox_token_type';
  
  // Buffer time before expiry to refresh token (5 minutes)
  private static readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;
  
  private isRefreshing = false;
  private refreshPromise: Promise<TokenData | null> | null = null;
  private retryCount = 0;
  private maxRetries = 3;

  /**
   * Store tokens securely with enterprise-grade encryption
   */
  async storeTokens(tokenData: TokenData): Promise<void> {
    try {
      const user = auth.currentUser;
      const keyPrefix = user ? `_${user.uid}` : '';
      
      console.log('🔐 Storing tokens with encryption...');
      
      // Check if encryption is supported
      if (!TokenEncryption.isWebCryptoSupported()) {
        console.warn('⚠️ Web Crypto API not supported - storing tokens with basic encoding');
        return this.storeTokensFallback(tokenData, keyPrefix);
      }

      try {
        // Encrypt tokens individually for security isolation
        const encryptedAccessToken = await TokenEncryption.encryptToken(
          tokenData.accessToken, 
          user?.uid
        );
        
        const encryptedRefreshToken = await TokenEncryption.encryptToken(
          tokenData.refreshToken, 
          user?.uid
        );

        // Store encrypted tokens as JSON strings
        localStorage.setItem(
          `${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}`, 
          JSON.stringify(encryptedAccessToken)
        );
        
        localStorage.setItem(
          `${TokenManager.REFRESH_TOKEN_KEY}${keyPrefix}`, 
          JSON.stringify(encryptedRefreshToken)
        );
        
        // Store non-sensitive metadata in plain text
        localStorage.setItem(
          `${TokenManager.TOKEN_EXPIRY_KEY}${keyPrefix}`, 
          tokenData.expiresAt.toString()
        );
        
        localStorage.setItem(
          `${TokenManager.TOKEN_TYPE_KEY}${keyPrefix}`, 
          tokenData.tokenType
        );

        // Store encryption flag for future reference
        localStorage.setItem(
          `${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}_encrypted`, 
          'true'
        );
        
        console.log('✅ Tokens stored with AES-GCM encryption');
        
        // Log security event
        this.logSecurityEvent('TOKEN_STORAGE_ENCRYPTED', {
          userId: user?.uid || 'anonymous',
          algorithm: 'AES-GCM',
          keyDerivation: 'PBKDF2'
        });
        
      } catch (encryptionError) {
        console.error('❌ Encryption failed, falling back to basic storage:', encryptionError);
        await this.storeTokensFallback(tokenData, keyPrefix);
      }
      
    } catch (error) {
      console.error('❌ Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }

  /**
   * Fallback token storage without encryption (development/compatibility)
   */
  private async storeTokensFallback(tokenData: TokenData, keyPrefix: string): Promise<void> {
    console.warn('⚠️ Using fallback token storage - tokens not encrypted');
    
    // Base64 encode for basic obfuscation (NOT security)
    const encodedAccessToken = btoa(tokenData.accessToken);
    const encodedRefreshToken = btoa(tokenData.refreshToken);
    
    localStorage.setItem(`${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}`, encodedAccessToken);
    localStorage.setItem(`${TokenManager.REFRESH_TOKEN_KEY}${keyPrefix}`, encodedRefreshToken);
    localStorage.setItem(`${TokenManager.TOKEN_EXPIRY_KEY}${keyPrefix}`, tokenData.expiresAt.toString());
    localStorage.setItem(`${TokenManager.TOKEN_TYPE_KEY}${keyPrefix}`, tokenData.tokenType);
    
    // Mark as unencrypted
    localStorage.setItem(`${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}_encrypted`, 'false');
    
    this.logSecurityEvent('TOKEN_STORAGE_FALLBACK', {
      reason: 'encryption_not_available',
      encoding: 'base64'
    });
  }

  /**
   * Retrieve stored tokens with automatic decryption
   */
  async getStoredTokens(): Promise<TokenData | null> {
    try {
      const user = auth.currentUser;
      const keyPrefix = user ? `_${user.uid}` : '';
      
      const accessTokenData = localStorage.getItem(`${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}`);
      const refreshTokenData = localStorage.getItem(`${TokenManager.REFRESH_TOKEN_KEY}${keyPrefix}`);
      const expiryStr = localStorage.getItem(`${TokenManager.TOKEN_EXPIRY_KEY}${keyPrefix}`);
      const tokenType = localStorage.getItem(`${TokenManager.TOKEN_TYPE_KEY}${keyPrefix}`) || 'bearer';
      const isEncrypted = localStorage.getItem(`${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}_encrypted`) === 'true';
      
      if (!accessTokenData || !refreshTokenData || !expiryStr) {
        return null;
      }
      
      const expiresAt = parseInt(expiryStr, 10);
      
      console.log(`🔍 Retrieving tokens (encrypted: ${isEncrypted})...`);
      
      let accessToken: string;
      let refreshToken: string;
      
      if (isEncrypted && TokenEncryption.isWebCryptoSupported()) {
        try {
          // Decrypt encrypted tokens
          console.log('🔓 Decrypting stored tokens...');
          
          const encryptedAccessToken: EncryptedData = JSON.parse(accessTokenData);
          const encryptedRefreshToken: EncryptedData = JSON.parse(refreshTokenData);
          
          accessToken = await TokenEncryption.decryptToken(encryptedAccessToken, user?.uid);
          refreshToken = await TokenEncryption.decryptToken(encryptedRefreshToken, user?.uid);
          
          console.log('✅ Tokens decrypted successfully');
          
          this.logSecurityEvent('TOKEN_RETRIEVAL_ENCRYPTED', {
            userId: user?.uid || 'anonymous'
          });
          
        } catch (decryptionError) {
          console.error('❌ Token decryption failed:', decryptionError);
          
          this.logSecurityEvent('TOKEN_DECRYPTION_FAILED', {
            error: decryptionError instanceof Error ? decryptionError.message : 'Unknown error'
          });
          
          // Clear corrupted encrypted tokens
          await this.clearStoredTokens();
          return null;
        }
      } else {
        // Handle fallback encoded tokens
        console.log('🔍 Retrieving fallback-encoded tokens...');
        
        try {
          accessToken = atob(accessTokenData);
          refreshToken = atob(refreshTokenData);
          
          this.logSecurityEvent('TOKEN_RETRIEVAL_FALLBACK', {
            encoding: 'base64'
          });
        } catch (decodingError) {
          console.error('❌ Token decoding failed:', decodingError);
          return null;
        }
      }
      
      return {
        accessToken,
        refreshToken,
        expiresAt,
        tokenType
      };
    } catch (error) {
      console.error('❌ Failed to retrieve tokens:', error);
      
      this.logSecurityEvent('TOKEN_RETRIEVAL_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return null;
    }
  }

  /**
   * Check if current access token needs refresh
   */
  needsRefresh(tokenData: TokenData): boolean {
    const now = Date.now();
    const expiryWithBuffer = tokenData.expiresAt - TokenManager.REFRESH_BUFFER_MS;
    return now >= expiryWithBuffer;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<TokenData | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing && this.refreshPromise) {
      console.log('🔄 Token refresh already in progress, waiting...');
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();
    
    try {
      const result = await this.refreshPromise;
      this.retryCount = 0; // Reset retry count on success
      return result;
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return null;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual token refresh operation
   */
  private async performTokenRefresh(): Promise<TokenData | null> {
    try {
      const currentTokens = await this.getStoredTokens();
      
      if (!currentTokens?.refreshToken) {
        console.error('❌ No refresh token available');
        throw new Error('No refresh token available for refresh');
      }

      console.log('🔄 Refreshing access token...');
      
      const response = await this.callTokenRefreshAPI(currentTokens.refreshToken);
      
      if (!response.access_token) {
        throw new Error('Invalid refresh response - no access token');
      }

      // Calculate expiry time (Dropbox typically gives 4 hours)
      const expiresIn = response.expires_in || 14400; // Default 4 hours
      const expiresAt = Date.now() + (expiresIn * 1000);
      
      const newTokenData: TokenData = {
        accessToken: response.access_token,
        refreshToken: response.refresh_token || currentTokens.refreshToken, // Use new refresh token if provided
        expiresAt,
        tokenType: response.token_type || 'bearer'
      };

      // Store the new tokens
      await this.storeTokens(newTokenData);
      
      console.log('✅ Access token refreshed successfully');
      console.log(`⏰ New token expires at: ${new Date(expiresAt).toISOString()}`);
      
      return newTokenData;
    } catch (error) {
      this.retryCount++;
      console.error(`❌ Token refresh attempt ${this.retryCount}/${this.maxRetries} failed:`, error);
      
      if (this.retryCount < this.maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, this.retryCount - 1) * 1000;
        console.log(`⏳ Retrying token refresh in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.performTokenRefresh();
      }
      
      // Max retries exceeded
      console.error('❌ Token refresh failed after maximum retries');
      await this.clearStoredTokens(); // Clear invalid tokens
      throw error;
    }
  }

  /**
   * Call Dropbox token refresh API
   */
  private async callTokenRefreshAPI(refreshToken: string): Promise<TokenRefreshResponse> {
    const clientId = import.meta.env.VITE_DROPBOX_APP_KEY;
    // Client secret not needed when using PKCE
    const clientSecret = undefined;
    
    if (!clientId) {
      throw new Error('Dropbox app key not configured');
    }

    // For security, client secret should be handled server-side
    // This is a fallback for development - production should use server endpoint
    const useServerEndpoint = import.meta.env.VITE_USE_SERVER_API === 'true';
    
    if (useServerEndpoint) {
      return this.refreshTokenViaServer(refreshToken);
    }

    // Client-side refresh (requires public client or PKCE)
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(
        clientSecret ? {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret
        } : {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId
        }
      )
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Token refresh API error:', response.status, errorText);
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Refresh token via secure server endpoint
   */
  private async refreshTokenViaServer(refreshToken: string): Promise<TokenRefreshResponse> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    
    if (!apiBaseUrl) {
      throw new Error('Server API URL not configured');
    }

    const response = await fetch(`${apiBaseUrl}/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Server token refresh failed: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(): Promise<string | null> {
    try {
      const tokens = await this.getStoredTokens();
      
      if (!tokens) {
        console.log('📋 No stored tokens found');
        return null;
      }

      // Check if token needs refresh
      if (this.needsRefresh(tokens)) {
        console.log('⏰ Access token expired or near expiry, refreshing...');
        const refreshedTokens = await this.refreshAccessToken();
        return refreshedTokens?.accessToken || null;
      }

      console.log('✅ Using existing valid access token');
      return tokens.accessToken;
    } catch (error) {
      console.error('❌ Failed to get valid access token:', error);
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  async clearStoredTokens(): Promise<void> {
    try {
      const user = auth.currentUser;
      const keyPrefix = user ? `_${user.uid}` : '';
      
      // Clear all token-related storage keys
      localStorage.removeItem(`${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}`);
      localStorage.removeItem(`${TokenManager.REFRESH_TOKEN_KEY}${keyPrefix}`);
      localStorage.removeItem(`${TokenManager.TOKEN_EXPIRY_KEY}${keyPrefix}`);
      localStorage.removeItem(`${TokenManager.TOKEN_TYPE_KEY}${keyPrefix}`);
      localStorage.removeItem(`${TokenManager.ACCESS_TOKEN_KEY}${keyPrefix}_encrypted`);
      
      // Also clear legacy tokens
      localStorage.removeItem('dropbox_access_token');
      
      console.log('🗑️ All tokens and encryption metadata cleared');
      
      this.logSecurityEvent('TOKEN_STORAGE_CLEARED', {
        userId: user?.uid || 'anonymous'
      });
      
      // Attempt secure memory cleanup
      TokenEncryption.secureCleanup();
    } catch (error) {
      console.error('❌ Failed to clear tokens:', error);
    }
  }

  /**
   * Log security events for audit trail
   */
  private logSecurityEvent(event: string, details: Record<string, any>): void {
    const user = auth.currentUser;
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      component: 'TokenManager',
      userId: user?.uid || 'anonymous',
      sessionId: this.generateSessionId(),
      details
    };

    console.log(`🔒 TokenManager Security Event [${event}]:`, securityLog);
    
    // Store in session for security monitoring
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('token_security_log') || '[]');
      existingLogs.push(securityLog);
      
      // Keep only last 100 events
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      sessionStorage.setItem('token_security_log', JSON.stringify(existingLogs));
    } catch (error) {
      console.warn('⚠️ Failed to store security log:', error);
    }
  }

  /**
   * Generate session ID for security tracking
   */
  private generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Check if we have valid authentication
   */
  async hasValidAuthentication(): Promise<boolean> {
    const token = await this.getValidAccessToken();
    return !!token;
  }

  /**
   * Exchange authorization code for tokens using PKCE (secure, no client secret needed)
   */
  async exchangeCodeForTokens(authCode: string, redirectUri: string, codeVerifier?: string): Promise<TokenData> {
    const clientId = import.meta.env.VITE_DROPBOX_APP_KEY;
    // Client secret not needed when using PKCE
    const clientSecret = undefined;
    const useServerEndpoint = import.meta.env.VITE_USE_SERVER_API === 'true';
    
    if (!clientId) {
      throw new Error('Dropbox app key not configured');
    }

    try {
      // Try server-side exchange first if configured
      if (useServerEndpoint) {
        console.log('🔄 Using server-side token exchange...');
        if (!codeVerifier) {
          throw new Error('Code verifier required for server-side exchange');
        }
        return await this.exchangeCodeViaServer(authCode, redirectUri, codeVerifier);
      }

      // Client-side exchange - use PKCE if available, otherwise require client secret
      console.log('🔄 Using client-side token exchange...');
      
      const tokenParams: Record<string, string> = {
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUri,
        client_id: clientId
      };

      // Add PKCE code verifier if available
      if (codeVerifier) {
        console.log('🔐 Using PKCE for secure exchange');
        tokenParams.code_verifier = codeVerifier;
      } else if (clientSecret) {
        console.warn('⚠️ Using client secret for token exchange - not recommended for production');
        tokenParams.client_secret = clientSecret;
      } else {
        throw new Error('Either PKCE code verifier or client secret is required for token exchange');
      }

      const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
      }

      const tokenResponse: TokenRefreshResponse = await response.json();
      
      const expiresIn = tokenResponse.expires_in || 14400; // Default 4 hours
      const expiresAt = Date.now() + (expiresIn * 1000);
      
      const tokenData: TokenData = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || '',
        expiresAt,
        tokenType: tokenResponse.token_type || 'bearer'
      };

      await this.storeTokens(tokenData);
      
      console.log('✅ Initial tokens obtained and stored');
      return tokenData;
    } catch (error) {
      console.error('❌ Code to token exchange failed:', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code via secure server endpoint
   */
  private async exchangeCodeViaServer(authCode: string, redirectUri: string, codeVerifier: string): Promise<TokenData> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    
    if (!apiBaseUrl) {
      throw new Error('Server API URL not configured');
    }

    const response = await fetch(`${apiBaseUrl}/exchange-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: authCode,
        codeVerifier: codeVerifier,
        redirectUri: redirectUri
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Server code exchange failed: ${errorData.error || response.statusText}`);
    }

    const tokenResponse = await response.json();
    
    const expiresIn = tokenResponse.expires_in || 14400;
    const expiresAt = Date.now() + (expiresIn * 1000);
    
    const tokenData: TokenData = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token || '',
      expiresAt,
      tokenType: tokenResponse.token_type || 'bearer'
    };

    await this.storeTokens(tokenData);
    return tokenData;
  }
}

export const tokenManager = new TokenManager();