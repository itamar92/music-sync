# Dropbox Refresh Token Implementation Guide

This guide covers the new refresh token system that provides seamless, long-lived Dropbox authentication with automatic token refresh capabilities.

## 🎯 Implementation Overview

The new system includes:
- **Automatic Token Refresh**: Tokens refresh automatically before expiry
- **Secure Token Storage**: Encrypted storage with user-specific keys
- **Comprehensive Error Handling**: Intelligent retry and recovery mechanisms
- **Security Monitoring**: Built-in security auditing and validation
- **Legacy Migration**: Automatic migration from old token system

## Prerequisites

1. A Dropbox app configured for OAuth 2.0 with offline access:
   - **Access Type**: Full Dropbox or App folder
   - **Token Access Type**: Offline (for refresh tokens)
   - Required scopes:
     - `files.metadata.read`
     - `files.content.read` 
     - `sharing.read`

2. Environment properly configured (see Configuration section)

## Step 1: Configuration

### Environment Variables

Update your `.env.local` file:

```bash
# Required: Dropbox App Key (public)
VITE_DROPBOX_APP_KEY=your_dropbox_app_key_here

# Optional: Only for client-side refresh (NOT recommended for production)
VITE_DROPBOX_APP_SECRET=your_dropbox_app_secret_here

# Recommended: Use server-side token management
VITE_USE_SERVER_API=true
VITE_API_BASE_URL=https://your-project.cloudfunctions.net/api
```

### Dropbox App Configuration

1. **In your Dropbox App Console:**
   - Set **Token Access Type** to `offline`
   - Add your domain to **Redirect URIs**: 
     - `http://localhost:3000` (development)
     - `https://yourdomain.com` (production)
   - Ensure required scopes are enabled

## Step 2: Configure Firebase Functions

Set the environment variables in Firebase Functions:

```bash
# Set Dropbox credentials
firebase functions:config:set dropbox.app_key="YOUR_APP_KEY"
firebase functions:config:set dropbox.app_secret="YOUR_APP_SECRET"
firebase functions:config:set dropbox.refresh_token="YOUR_REFRESH_TOKEN"

# Optional: Set initial access token (will be refreshed automatically)
firebase functions:config:set dropbox.access_token="YOUR_ACCESS_TOKEN"
```

## Step 3: Deploy Functions

```bash
firebase deploy --only functions
```

## Step 4: Configure Client

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update the `.env.local` file:
   ```
   VITE_USE_SERVER_API=true
   VITE_API_BASE_URL=https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api
   ```

## Step 5: Test the Setup

1. Start your development server:
   ```bash
   npm run dev
   ```

2. The app should now work without requiring individual user OAuth
3. Check the browser console for any connection errors

## 🔧 How It Works

### Token Lifecycle Management

1. **Initial Authentication**: 
   - User authorizes via OAuth 2.0 authorization code flow
   - System exchanges code for access token + refresh token
   - Tokens stored securely with user-specific encryption

2. **Automatic Refresh**:
   - TokenManager monitors token expiry (refreshes 5 minutes before expiration)
   - Refresh occurs transparently during API calls
   - Failed refreshes trigger re-authentication flow
   - Exponential backoff for retry attempts

3. **Security Features**:
   - User-specific token encryption (when authenticated)
   - Automatic security auditing and monitoring
   - Legacy token migration support
   - Client-side and server-side refresh options

4. **Error Recovery**:
   - Intelligent error classification and recovery
   - Automatic retry for network issues
   - Re-authentication for invalid tokens
   - Comprehensive logging and debugging

## 🐛 Troubleshooting

### Authentication Issues

**"No valid token available"**
```bash
# Check browser console for detailed logs
# Run security audit in DevTools:
import { AuthSecurity } from './src/utils/authSecurity';
AuthSecurity.auditSecurity();
```

**"Token refresh failed"**
- Verify `VITE_DROPBOX_APP_KEY` is correct
- Check Dropbox app has "offline" token access type
- Ensure app secret is not exposed client-side
- Check network connectivity

**"Authentication failed and refresh unsuccessful"**
- User needs to re-authenticate (triggers automatically)
- Check browser console for specific error codes
- Verify Dropbox app permissions and scopes

### Configuration Issues

**Environment Variables**
```bash
# Check required variables are set:
echo $VITE_DROPBOX_APP_KEY
echo $VITE_USE_SERVER_API
echo $VITE_API_BASE_URL
```

**Security Warnings**
- App secret exposed: Use server-side refresh only
- Plain text tokens: Implement encryption (see Security section)
- HTTPS required: Deploy with SSL certificate

### Legacy Migration

**Migrating from old token system:**
- Legacy tokens automatically detected and migrated
- Users may need to re-authenticate for refresh token support
- Old localStorage tokens cleared after migration

## 🔒 Security Features

### Built-in Security

- **Token Encryption**: User-specific encryption for stored tokens
- **Security Auditing**: Automated security checks and recommendations
- **Environment Protection**: Prevents client-side secret exposure
- **Token Rotation**: Automatic refresh token rotation support
- **Monitoring**: Real-time security violation detection

### Security Best Practices

1. **Production Configuration:**
   ```bash
   VITE_USE_SERVER_API=true              # Use server-side refresh
   # VITE_DROPBOX_APP_SECRET=            # Never set in production
   ```

2. **Security Audit in Console:**
   ```javascript
   import { AuthSecurity } from './src/utils/authSecurity';
   await AuthSecurity.auditSecurity();
   ```

3. **Token Validation:**
   ```javascript
   import { AuthSecurity } from './src/utils/authSecurity';
   const isSecure = await AuthSecurity.validateRefreshSecurity();
   ```

### Security Checklist

- ✅ Use HTTPS in production
- ✅ Keep app secrets server-side only
- ✅ Enable security monitoring
- ✅ Implement token encryption
- ✅ Regular security audits
- ✅ Monitor console for security warnings

### Compliance Notes

- **Data Protection**: Tokens encrypted with user-specific keys
- **Access Control**: Automatic token expiry and refresh
- **Audit Trail**: Comprehensive logging for security events
- **Incident Response**: Automatic detection and recovery