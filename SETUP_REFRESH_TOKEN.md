# Dropbox Refresh Token Setup Guide

This guide helps you set up a persistent Dropbox connection using refresh tokens so all users can access the music without individual OAuth.

## Prerequisites

1. A Dropbox app with the following scopes:
   - `files.metadata.read`
   - `files.content.read`
   - `sharing.read`

2. Firebase project with Functions enabled

## Step 1: Generate Refresh Token

1. Update your Dropbox app settings:
   - Add `http://localhost:3000` to redirect URIs
   - Set `token_access_type` to `offline` in your app settings

2. Run the token generation script:
   ```bash
   node generate-refresh-token.js
   ```

3. Follow the instructions:
   - Open the provided URL in your browser
   - Authorize the app
   - Copy the authorization code from the redirect URL
   - Paste it into the script

4. The script will output your access token and refresh token

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

## How It Works

1. **Server-side Authentication**: Firebase Functions handle Dropbox authentication using the refresh token
2. **Automatic Token Refresh**: When the access token expires, the server automatically refreshes it
3. **Persistent Connection**: All users share the same server-side Dropbox connection
4. **Caching**: API responses are cached on both client and server for better performance

## Troubleshooting

### "Dropbox not initialized" Error
- Check that environment variables are set correctly in Firebase Functions
- Verify the refresh token is valid
- Check Firebase Functions logs: `firebase functions:log`

### API Connection Issues
- Verify `VITE_API_BASE_URL` points to your deployed Functions
- Check CORS configuration in Functions
- Ensure Firebase project is configured correctly

### Token Refresh Failures
- Verify app secret and app key are correct
- Check that your Dropbox app has offline access enabled
- Regenerate refresh token if it has expired

## Security Notes

- Keep your app secret and refresh token secure
- Don't commit these values to version control
- Use Firebase Functions environment variables for secrets
- Consider implementing rate limiting for public API endpoints