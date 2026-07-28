import { isServerMode } from '../dataMode';
import { firebaseAdminData } from './firebaseAdminData';
import { serverAdminData } from './serverAdminData';
import { AdminDataService } from './types';

/**
 * The admin's single data entry point.
 *
 * This module is the only place in the admin that knows which backend is in
 * play. Screens import `adminData` and never branch on the mode themselves —
 * where behaviour genuinely differs, they read `adminData.capabilities`.
 */
export const adminData: AdminDataService = isServerMode ? serverAdminData : firebaseAdminData;

export * from './types';
