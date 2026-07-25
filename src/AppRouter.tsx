import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useOptionalUser } from './hooks/useOptionalUser';
import { useAdminRole } from './hooks/useAdminRole';
import { isServerMode } from './services/dataMode';
import { PublicApp } from './PublicApp';
import { AdminDashboard } from './AdminDashboard';
import { ServerAdminDashboard } from './admin/ServerAdminDashboard';
import { LoadingSpinner } from './components/LoadingSpinner';

export const AppRouter: React.FC = () => {
  const [user, loading] = useOptionalUser();
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

        {/* Admin routes. In server mode the dashboard handles its own JWT
            login; in Firebase mode access is gated by auth + admin role. */}
        <Route
          path="/admin/*"
          element={
            isServerMode ? (
              <ServerAdminDashboard />
            ) : user && isAdmin ? (
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
