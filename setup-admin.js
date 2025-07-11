// Script to set up admin user in Firebase
// Run this with: node setup-admin.js

import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Your Firebase config (same as in your app)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-auth-domain",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-storage-bucket",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: process.env.VITE_FIREBASE_APP_ID || "your-app-id"
};

// Admin credentials
const ADMIN_EMAIL = 'itamar92@gmail.com';
const ADMIN_PASSWORD = 'Pa$$w0r0d';

async function setupAdmin() {
  try {
    console.log('🚀 Setting up admin user...');
    
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    let userId;
    
    try {
      // Try to create new user
      console.log('📝 Creating admin user account...');
      const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      userId = userCredential.user.uid;
      console.log('✅ Admin user created successfully!');
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        console.log('ℹ️  Admin user already exists, signing in...');
        const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        userId = userCredential.user.uid;
        console.log('✅ Signed in successfully!');
      } else {
        throw error;
      }
    }

    // Set up user document with admin role
    console.log('🔧 Setting up admin role in Firestore...');
    const userDocRef = doc(db, 'users', userId);
    
    // Check if user document exists
    const userDoc = await getDoc(userDocRef);
    
    const userData = {
      email: ADMIN_EMAIL,
      role: 'admin',
      isActive: true,
      updatedAt: new Date()
    };

    if (!userDoc.exists()) {
      userData.createdAt = new Date();
      console.log('📄 Creating new user document...');
    } else {
      console.log('📄 Updating existing user document...');
    }

    await setDoc(userDocRef, userData, { merge: true });
    
    console.log('🎉 Admin setup completed successfully!');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`🛡️  Role: admin`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error setting up admin:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    process.exit(1);
  }
}

setupAdmin();