#!/usr/bin/env node

// Quick token exchange using your authorization code
const fetch = require('node-fetch');

const APP_KEY = '8vxmrswkyhxie9q';
const APP_SECRET = 'y98qcd9yovmthsuw';
const AUTH_CODE = '8C2Hup3kmIsAAAAAAADI--xZVq09LhfoU4U_wiODZRg';

async function exchangeToken() {
  console.log('🔄 Exchanging authorization code for tokens...');
  
  try {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: AUTH_CODE,
        redirect_uri: 'http://localhost:3000',
        client_id: APP_KEY,
        client_secret: APP_SECRET,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      console.error('❌ Error:', data.error_description || data.error);
      console.log('\n🔧 This might be because:');
      console.log('1. The authorization code has expired (try getting a new one)');
      console.log('2. The redirect URI in your Dropbox app settings doesn\'t match');
      console.log('3. The app credentials are incorrect');
      return;
    }

    console.log('✅ Success! Here are your tokens:\n');
    console.log('ACCESS_TOKEN:', data.access_token);
    console.log('REFRESH_TOKEN:', data.refresh_token);
    console.log('\n📝 Run these commands to configure Firebase:');
    console.log(`firebase functions:config:set dropbox.access_token="${data.access_token}"`);
    console.log(`firebase functions:config:set dropbox.refresh_token="${data.refresh_token}"`);
    console.log(`firebase functions:config:set dropbox.app_key="${APP_KEY}"`);
    console.log(`firebase functions:config:set dropbox.app_secret="${APP_SECRET}"`);
    console.log('\nThen deploy: firebase deploy --only functions');
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

exchangeToken();