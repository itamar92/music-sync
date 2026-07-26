/**
 * Public Token Service - Manages shared Dropbox tokens for anonymous users
 * 
 * This service allows an admin to authenticate once and share access with
 * anonymous users across all devices through Firebase storage.
 */

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { isServerMode } from './dataMode';
import { TokenData } from './tokenManager';
import { TokenEncryption } from './tokenEncryption';

export interface PublicTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
  updatedAt: number;
  adminId: string;
}

export class PublicTokenService {
  private static readonly PUBLIC_TOKEN_DOC = 'config/public-dropbox-token';
  private static readonly ENCRYPTION_KEY = 'public-token-key';

  /**
   * Public tokens only exist in Firebase mode. In server mode `db` is null and
   * every call here would throw an opaque Firestore error, so callers get the
   * "no public tokens" answer instead.
   */
  private static get unavailable(): boolean {
    return isServerMode || !db;
  }

  /**
   * Store admin's tokens for public access
   */
  static async storePublicTokens(tokenData: TokenData, adminId: string): Promise<void> {
    if (this.unavailable) {
      throw new Error('Public tokens are a Firebase-mode feature and are unavailable here');
    }
    try {
      console.log('🔄 Storing public Dropbox tokens...');

      // Encrypt tokens before storing
      const encryptedData = await TokenEncryption.encryptToken(JSON.stringify({
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt,
        tokenType: tokenData.tokenType,
        updatedAt: Date.now(),
        adminId
      }), this.ENCRYPTION_KEY);

      // Store in Firebase
      await setDoc(doc(db, this.PUBLIC_TOKEN_DOC), {
        data: encryptedData,
        updatedAt: Date.now(),
        adminId
      });

      console.log('✅ Public tokens stored successfully');
    } catch (error) {
      console.error('❌ Failed to store public tokens:', error);
      throw new Error('Failed to store public tokens');
    }
  }

  /**
   * Retrieve shared tokens for anonymous users
   */
  static async getPublicTokens(): Promise<PublicTokenData | null> {
    if (this.unavailable) return null;
    try {
      console.log('🔄 Fetching public Dropbox tokens...');

      const docSnap = await getDoc(doc(db, this.PUBLIC_TOKEN_DOC));
      
      if (!docSnap.exists()) {
        console.log('ℹ️ No public tokens available');
        return null;
      }

      const { data: encryptedData } = docSnap.data();
      
      // Decrypt tokens
      const decryptedData = await TokenEncryption.decryptToken(encryptedData, this.ENCRYPTION_KEY);
      const tokenData: PublicTokenData = JSON.parse(decryptedData);

      // Check if tokens are expired
      if (tokenData.expiresAt < Date.now()) {
        console.log('⚠️ Public tokens expired');
        return null;
      }

      console.log('✅ Public tokens retrieved successfully');
      return tokenData;
    } catch (error) {
      console.error('❌ Failed to retrieve public tokens:', error);
      return null;
    }
  }

  /**
   * Check if public tokens are available and valid
   */
  static async arePublicTokensAvailable(): Promise<boolean> {
    try {
      const tokens = await this.getPublicTokens();
      return tokens !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Remove public tokens (admin only)
   */
  static async removePublicTokens(): Promise<void> {
    if (this.unavailable) return;
    try {
      console.log('🔄 Removing public tokens...');
      await deleteDoc(doc(db, this.PUBLIC_TOKEN_DOC));
      console.log('✅ Public tokens removed');
    } catch (error) {
      console.error('❌ Failed to remove public tokens:', error);
      throw new Error('Failed to remove public tokens');
    }
  }

  /**
   * Update public tokens with fresh data
   */
  static async updatePublicTokens(tokenData: TokenData, adminId: string): Promise<void> {
    await this.storePublicTokens(tokenData, adminId);
  }
}