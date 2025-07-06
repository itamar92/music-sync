#!/usr/bin/env node

// Script to generate Dropbox refresh token
// Run this once to get the refresh token for your server

const { Dropbox, DropboxAuth } = require('dropbox');
const readline = require('readline');

const APP_KEY = '8vxmrswkyhxie9q';
const APP_SECRET = 'y98qcd9yovmthsuw';

async function generateRefreshToken() {
  console.log('🔐 Dropbox Refresh Token Generator');
  console.log('This will generate a refresh token for your server.\n');

  const dbxAuth = new DropboxAuth({
    clientId: APP_KEY,
    clientSecret: APP_SECRET
  });

  // Step 1: Get authorization URL (simpler approach)
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&redirect_uri=http://localhost:3000&response_type=code&token_access_type=offline`;

  console.log('1. Open this URL in your browser:');
  console.log(authUrl);
  console.log('\n2. After authorizing, you\'ll be redirected to a page that doesn\'t exist.');
  console.log('3. Copy the "code" parameter from the URL and paste it below.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter the authorization code: ', async (code) => {
    try {
      console.log('\n⏳ Exchanging code for tokens...');
      
      // Manual token exchange since the auth URL is simplified
      const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: 'http://localhost:3000',
          client_id: APP_KEY,
          client_secret: APP_SECRET,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error('❌ Token exchange failed:', tokenData.error_description || tokenData.error);
        rl.close();
        return;
      }

      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      if (accessToken && refreshToken) {
        console.log('\n✅ Success! Here are your tokens:\n');
        console.log('ACCESS_TOKEN:', accessToken);
        console.log('REFRESH_TOKEN:', refreshToken);
        console.log('\n📝 Run these commands to configure Firebase:');
        console.log(`firebase functions:config:set dropbox.access_token="${accessToken}"`);
        console.log(`firebase functions:config:set dropbox.refresh_token="${refreshToken}"`);
        console.log(`firebase functions:config:set dropbox.app_key="${APP_KEY}"`);
        console.log(`firebase functions:config:set dropbox.app_secret="${APP_SECRET}"`);
        console.log('\nThen deploy: firebase deploy --only functions');
      } else {
        console.error('❌ Failed to get tokens');
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
    
    rl.close();
  });
}

generateRefreshToken().catch(console.error);