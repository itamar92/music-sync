import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './services/firebase';
import { useAdminRole } from './hooks/useAdminRole';
import { PublicApp } from './PublicApp';
import { AdminDashboard } from './AdminDashboard';
import { LoadingSpinner } from './components/LoadingSpinner';

export const AppRouter: React.FC = () => {
  const [user, loading] = useAuthState(auth);
  const { isAdmin, loading: roleLoading } = useAdminRole(user?.uid);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public routes - accessible to everyone */}
        <Route path="/" element={<PublicApp />} />
        <Route path="/collection/:collectionId" element={<PublicApp />} />
        <Route path="/playlist/:playlistId" element={<PublicApp />} />
        <Route path="/public" element={<PublicApp />} />
        
        {/* Admin routes - only accessible to admins */}
        <Route 
          path="/admin/*" 
          element={
            user && isAdmin ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        {/* Catch all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};