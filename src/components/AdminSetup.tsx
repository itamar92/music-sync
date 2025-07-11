import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User, Shield, Check, AlertCircle } from 'lucide-react';

// This component is for one-time admin setup
// You can temporarily add it to your app to create the admin user
export const AdminSetup: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const ADMIN_EMAIL = 'itamar92@gmail.com';
  const ADMIN_PASSWORD = 'Pa$$w0r0d';

  const setupAdmin = async () => {
    setStatus('running');
    setMessage('Setting up admin user...');

    try {
      let userId;
      
      try {
        // Try to create new user
        setMessage('Creating admin user account...');
        const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
        userId = userCredential.user.uid;
        setMessage('Admin user created successfully!');
      } catch (error: any) {
        if (error.code === 'auth/email-already-in-use') {
          setMessage('Admin user already exists, signing in...');
          const userCredential = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
          userId = userCredential.user.uid;
          setMessage('Signed in successfully!');
        } else {
          throw error;
        }
      }

      // Set up user document with admin role
      setMessage('Setting up admin role in database...');
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
      }

      await setDoc(userDocRef, userData, { merge: true });
      
      setStatus('success');
      setMessage(`Admin setup completed! You can now log in with ${ADMIN_EMAIL}`);
      
    } catch (error: any) {
      console.error('Error setting up admin:', error);
      setStatus('error');
      setMessage(`Error: ${error.message}`);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>;
      case 'success':
        return <Check className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Shield className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'bg-green-900/50 border-green-500/50';
      case 'error':
        return 'bg-red-900/50 border-red-500/50';
      default:
        return 'bg-gray-800/50 border-gray-600';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className={`${getStatusColor()} backdrop-blur-sm rounded-xl p-4 border shadow-lg`}>
        <div className="flex items-center space-x-3 mb-3">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="font-medium text-white">Admin Setup</span>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="text-sm text-gray-300">
            <p><strong>Email:</strong> {ADMIN_EMAIL}</p>
            <p><strong>Password:</strong> Pa$$w0r0d</p>
          </div>
          
          {message && (
            <div className="text-sm text-gray-300 bg-gray-900/50 rounded p-2">
              {message}
            </div>
          )}
          
          <button
            onClick={setupAdmin}
            disabled={status === 'running' || status === 'success'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <User className="w-4 h-4" />
            <span>
              {status === 'success' ? 'Setup Complete' : 
               status === 'running' ? 'Setting up...' : 
               'Setup Admin User'}
            </span>
          </button>
          
          {status === 'success' && (
            <div className="text-xs text-green-400 text-center">
              You can now remove this component from your app
            </div>
          )}
        </div>
      </div>
    </div>
  );
};