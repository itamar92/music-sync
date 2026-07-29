import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useOptionalUser } from './hooks/useOptionalUser';
import { useAdminRole } from './hooks/useAdminRole';
import { isServerMode } from './services/dataMode';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { PublicApp } from './PublicApp';
import { ShareApp } from './share/ShareApp';
import { AdminDashboard } from './AdminDashboard';
import { LoadingSpinner } from './components/LoadingSpinner';

export const AppRouter: React.FC = () => {
  const [user, loading] = useOptionalUser();
  const { isAdmin, loading: roleLoading } = useAdminRole(user?.uid);

  if (loading || roleLoading) {
    return (
      <div
        className="nc-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <Router>
      {/* The audio engine sits above the routes so playback survives navigation. */}
      <AudioPlayerProvider>
        <Routes>
          {/* Public routes - accessible to everyone */}
          <Route path="/" element={<PublicApp />} />
          <Route path="/collection/:collectionId" element={<PublicApp />} />
          <Route path="/playlist/:playlistId" element={<PublicApp />} />
          <Route path="/public" element={<PublicApp />} />

          {/* A single collection behind an unguessable link. Not part of the
              public catalogue and not reachable from it. */}
          <Route path="/share/:token" element={<ShareApp />} />

          {/* One dashboard for both modes. Server mode presents its own JWT
              login inside it; Firebase mode is gated here on auth + admin role
              so a signed-out visitor is bounced rather than shown a form. */}
          <Route
            path="/admin/*"
            element={
              isServerMode || (user && isAdmin) ? <AdminDashboard /> : <Navigate to="/" replace />
            }
          />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AudioPlayerProvider>
    </Router>
  );
};
