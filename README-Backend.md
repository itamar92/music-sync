# MusicSync Backend Setup

This backend service handles Dropbox authentication server-side, allowing public users to access your shared music files without needing their own Dropbox authentication.

## Setup Instructions

### 1. Install Dependencies
```bash
cd server
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and configure it:
```bash
cp .env.example .env
```

Edit `.env` and set your Dropbox app credentials:
```bash
DROPBOX_APP_KEY=your_dropbox_app_key
DROPBOX_APP_SECRET=your_dropbox_app_secret
DROPBOX_ACCESS_TOKEN=  # Leave empty initially
```

### 3. Set Up Dropbox Authentication

#### First Time Setup:
1. Start the server:
   ```bash
   npm run dev
   ```

2. The server will show instructions for authentication. You'll see something like:
   ```
   🔐 Manual Dropbox Authentication Required
   ==================================================
   1. Visit this URL in your browser:
   https://www.dropbox.com/oauth2/authorize?client_id=...
   
   2. Authorize the app and copy the authorization code
   3. Complete the process by visiting: http://localhost:3001/auth/setup
   ==================================================
   ```

3. Visit the authorization URL in your browser
4. Authorize the app with your Dropbox account
5. Copy the authorization code from the URL
6. Visit `http://localhost:3001/auth/setup` and enter the code
7. Save the returned access token to your `.env` file

#### Alternative Setup (If callback doesn't work):
1. Visit `http://localhost:3001/auth/setup` directly
2. Paste the authorization code and submit
3. Copy the access token to your `.env` file

### 4. Verify Setup
Once authenticated, check the server status:
```bash
curl http://localhost:3001/api/status
```

You should see:
```json
{
  "success": true,
  "data": {
    "isInitialized": true,
    "hasToken": true,
    "hasRefreshToken": true,
    "serverTime": "...",
    "uptime": 123
  }
}
```

## API Endpoints

### Status & Health
- `GET /health` - Health check
- `GET /api/status` - Service status

### Folders & Files
- `GET /api/folders` - List root folders
- `GET /api/folders?path=/music` - List folders in specific path
- `GET /api/folders/:folderId/tracks` - Get tracks from folder
- `GET /api/folders/:folderId/details` - Get folder details (track count, etc.)
- `GET /api/files/:fileId/stream` - Get streaming URL for file

### Authentication (One-time setup)
- `GET /auth/setup` - Authentication setup page
- `POST /auth/dropbox/exchange` - Exchange code for token
- `GET /auth/dropbox/callback` - OAuth callback (automatic)

## Deployment

### Local Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Environment Variables for Production
```bash
NODE_ENV=production
PORT=3001
DROPBOX_APP_KEY=your_key
DROPBOX_APP_SECRET=your_secret
DROPBOX_ACCESS_TOKEN=your_long_lived_token
ALLOWED_ORIGINS=https://music-sync-99dbb.web.app,https://yourdomain.com
```

## Features

### Automatic Token Refresh
- The service automatically refreshes access tokens every 30 minutes
- Uses refresh tokens when available for seamless operation
- Logs token status and expiration times

### Caching
- Folder listings cached for 10 minutes
- Track listings cached for 20 minutes
- Folder details cached for 15 minutes
- Reduces API calls to Dropbox

### Error Handling
- Comprehensive error handling and logging
- Graceful fallbacks for network issues
- Detailed error messages for debugging

### CORS Configuration
- Configurable allowed origins
- Supports multiple frontend domains
- Development and production ready

## Troubleshooting

### "Dropbox service not initialized"
- Check that your access token is valid
- Restart the server after updating `.env`
- Verify your Dropbox app has the correct permissions

### "Unable to connect to server"
- Ensure the server is running on the correct port
- Check firewall settings
- Verify CORS configuration includes your frontend domain

### Token Expiration
- The service will automatically refresh tokens when possible
- If refresh fails, you'll need to re-authenticate manually
- Check server logs for authentication errors

## Security Notes

- Keep your `.env` file secure and never commit it to version control
- Use HTTPS in production
- Regularly rotate your Dropbox app secret
- Monitor server logs for unauthorized access attempts
- Consider implementing rate limiting for public APIs