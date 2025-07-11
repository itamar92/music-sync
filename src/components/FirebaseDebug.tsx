import React from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

export const FirebaseDebug: React.FC = () => {
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };

  const checkConfigValue = (value: string | undefined, name: string) => {
    if (!value || value === 'undefined') {
      return (
        <div className="flex items-center space-x-2 text-red-400">
          <X className="w-4 h-4" />
          <span>{name}: Missing</span>
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-2 text-green-400">
        <Check className="w-4 h-4" />
        <span>{name}: {value.substring(0, 20)}...</span>
      </div>
    );
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm">
      <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 shadow-lg">
        <div className="flex items-center space-x-2 mb-3">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <span className="font-medium text-white">Firebase Config Debug</span>
        </div>
        
        <div className="space-y-1 text-sm">
          {checkConfigValue(firebaseConfig.apiKey, 'API Key')}
          {checkConfigValue(firebaseConfig.authDomain, 'Auth Domain')}
          {checkConfigValue(firebaseConfig.projectId, 'Project ID')}
          {checkConfigValue(firebaseConfig.storageBucket, 'Storage Bucket')}
          {checkConfigValue(firebaseConfig.messagingSenderId, 'Messaging Sender ID')}
          {checkConfigValue(firebaseConfig.appId, 'App ID')}
        </div>
        
        <div className="mt-3 text-xs text-gray-400">
          Remove this component after debugging
        </div>
      </div>
    </div>
  );
};