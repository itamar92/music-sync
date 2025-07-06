#!/usr/bin/env node

// Quick test to validate the Dropbox token
const { Dropbox } = require('dropbox');

const TOKEN = 'sl.u.AF0I7QpxhrUBD1y106f9IBr0-RohvhkF_d68wUBUzRiCI0XHYg4GisAi_UZ8bUDloRKBAQGuyQhjCPUy-tGwcJQvX0cAJ6Y50jL_mKTH2-VBeTvUu6c05DZBwLUGpcvrKOkJDKGc-ZrSWZiqfc8GMzXt9FL5KsqnwIsOrCTSW2iVmhWDMs_CrFpV-HgjqpB4jlAf0siY8txIjiNhStWJxfykUnYAx87PaRAcUC6rGgAOIGadDxTUjdP1-L6y0W55ksQqyKU6avhl_MFNzruqVJtu1TJLDuuCgUEZIMY0wf64_EoUOlDQGq1kaGuP4VTbEusY0wexBjBhgpMaNXk6agvhR-WsjNi8K4yyg6_blqfMdu8PlfJgIUzehAs39je2pP-WT8lz4Q_IpL6VoWrha55Jwieefm8p9rK1dSoAxMr-LDfZEusy4AEYkGOpwpWa-lhfhKMnVSmym64BsvDrBP4UdeA-0C54QJFrVY_oFTNkM1HtsSU7FTsPkejtRJCkupsbfkGV0-QqpUAc8IB6t_4-5IGsjsxrctuUYA6r923mYR4vWj_80PD6j_enCvTkDicY540otqacwMF1o6MeCbIVpw7YORPtjuEnDwKpSPqqeu01A3lsU_EjLNgbcFjA3Xc0viY4JOmIsXYrF29yKlBY8esNnnpVfumj8UYmPdpHcyOaFGqJubNBhGr4iGr1IaalJbyFmrlpligAmHxUjTlI3FKzNbcQiSIIYc6yjxUSaZ9F249UzigQbGY2z5J5n5bNJxW6rD8y9Hu7AaEJjsHf3LYdKKDMJhWOKj_8cKZQxrjhJhu03kld-1mLZ9Fd2ogkv0X1OLWu11meSX2WYwr-Tq1RhL-p1ZI5DqiJBQXQc_TSKakP4sY6t6H2KyytnVeyyJ37WymEhiyq1xIlcTFopy5AV2gZ7zP44YYGwWE7Fj3UgN6mqo2Mj601xxHE-ImzeW4uAFTD393KWaOzxImq0CCX13v_vNoZ3jw7XKgegI_IvB-0vpEGwO9c4axtMbadYtk7WoLSHzDrUApOXYGyHPO3et0EkIehIZuTHmOsW61efELr1RM_G3Tuv05VDMhiHfTOOwmyUtM6iv6XCs3Gh6qdS67pQG_8yvu-AH9FYZ95MyGFLDYsohNXR-c9_twNxiyQzk_5w5Y9R9pNnvX_qGDqYsulqx6mlaVNQZx2iWqMQHui9olUULKgnBgLHbwc26yL1EHes9c0MKs8sdu2ycbbWGaLmkFlOxkDPDvdHIfPSb432za7wI_HsN3opxEdZGUBToGvgZBjj6Xz3Cbr';

async function testToken() {
  console.log('🔍 Testing Dropbox token...');
  
  const dbx = new Dropbox({ accessToken: TOKEN });
  
  try {
    // Test 1: Get current user info
    console.log('\n1. Testing user info...');
    const userInfo = await dbx.usersGetCurrentAccount();
    console.log('✅ User info:', userInfo.result.name.display_name);
    
    // Test 2: List root folder
    console.log('\n2. Testing folder listing...');
    const folders = await dbx.filesListFolder({ path: '' });
    console.log(`✅ Found ${folders.result.entries.length} items in root folder:`);
    
    const folderItems = folders.result.entries.slice(0, 5);
    folderItems.forEach(item => {
      console.log(`  - ${item.name} (${item['.tag']})`);
    });
    
    console.log('\n🎉 Token is working perfectly!');
    console.log('\nThe issue might be:');
    console.log('1. Firebase config not updated yet');
    console.log('2. Functions need to restart');
    console.log('3. Cache issue in deployed functions');
    
  } catch (error) {
    console.error('\n❌ Token test failed:');
    console.error('Status:', error.status);
    console.error('Error:', error.error || error.message);
    
    if (error.status === 401) {
      console.log('\n🔧 This suggests:');
      console.log('1. Token is invalid or expired');
      console.log('2. App permissions are not correct');
      console.log('3. Token was not generated with proper scope');
    }
  }
}

testToken();