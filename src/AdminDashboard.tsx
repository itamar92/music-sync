import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  Settings, 
  FolderOpen, 
  Music, 
  Users, 
  BarChart3, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { auth } from './services/firebase';
import { CollectionManagement } from './components/admin/CollectionManagement';
import { FolderSyncManagement } from './components/admin/FolderSyncManagement';
import { PlaylistManagement } from './components/admin/PlaylistManagement';
import { AdminOverview } from './components/admin/AdminOverview';
import { AdminSettings } from './components/admin/AdminSettings';
import { GlobalAudioPlayer } from './components/GlobalAudioPlayer';
import logoImg from '../Logo_IM icon.png';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const menuItems = [
    { 
      path: '/admin', 
      label: 'Overview', 
      icon: BarChart3, 
      exact: true 
    },
    { 
      path: '/admin/collections', 
      label: 'Collections', 
      icon: FolderOpen 
    },
    { 
      path: '/admin/folders', 
      label: 'Folder Sync', 
      icon: FolderOpen 
    },
    { 
      path: '/admin/playlists', 
      label: 'Playlists', 
      icon: Music 
    },
    { 
      path: '/admin/settings', 
      label: 'Settings', 
      icon: Settings 
    },
  ];

  const isActiveRoute = (path: string, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black text-white flex">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900/95 backdrop-blur-sm border-r border-gray-700/50 transform transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-3">
            <img src={logoImg} alt="App Logo" className="w-20 h-20 object-contain" />
            <span className="text-lg font-bold">Admin Panel</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="px-6">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.path}>
                <button
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors
                    ${isActiveRoute(item.path, item.exact) 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-red-600/20 hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-semibold">
                {menuItems.find(item => isActiveRoute(item.path, item.exact))?.label || 'Admin Dashboard'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                View Public Site
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/collections/*" element={<CollectionManagement />} />
            <Route path="/folders/*" element={<FolderSyncManagement />} />
            <Route path="/playlists/*" element={<PlaylistManagement />} />
            <Route path="/settings/*" element={<AdminSettings />} />
          </Routes>
        </main>
      </div>
      
      {/* Global Audio Player */}
      <GlobalAudioPlayer />
    </div>
  );
};