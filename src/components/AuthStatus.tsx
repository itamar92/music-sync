import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { dropboxService } from '../services/dropboxService';
import { useToast } from '../hooks/useToast';
import { ConnectionLED } from './ConnectionLED';

interface AuthStatusProps {
  mode?: 'admin' | 'public';
}

/**
 * 🔐 Authentication Status Indicator
 * 
 * Shows Dropbox connection status with visual feedback
 * Admin mode: Full interface with reconnect button
 * Public mode: Simple LED indicator only
 */
export const AuthStatus: React.FC<AuthStatusProps> = ({ mode = 'admin' }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const { showConnectionRestored, showAuthError } = useToast();

  useEffect(() => {
    // Check initial authentication status
    setIsAuthenticated(dropboxService.isAuthenticated());

    // Poll authentication status every 30 seconds
    const interval = setInterval(() => {
      const newAuthStatus = dropboxService.isAuthenticated();
      
      // Show notification when connection is restored
      if (newAuthStatus && !isAuthenticated) {
        showConnectionRestored();
      }
      
      setIsAuthenticated(newAuthStatus);
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, showConnectionRestored]);

  const handleReconnect = async () => {
    setIsConnecting(true);
    try {
      await dropboxService.authenticate();
      setIsAuthenticated(true);
      showConnectionRestored();
    } catch (error) {
      showAuthError(
        error instanceof Error ? error.message : 'Failed to connect to Dropbox'
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // Public mode: Show only LED indicator
  if (mode === 'public') {
    return (
      <div className="flex items-center gap-2">
        <ConnectionLED isConnected={isAuthenticated} size="md" />
        <span className="text-xs text-gray-600">
          {isAuthenticated ? 'Connected' : 'Offline'}
        </span>
      </div>
    );
  }

  // Admin mode: Show full interface with reconnect functionality
  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-lg">
        <Wifi className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700 font-medium">Connected</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-red-50 border border-red-200 rounded-lg">
      <WifiOff className="w-4 h-4 text-red-600" />
      <span className="text-sm text-red-700 font-medium">Disconnected</span>
      <button
        onClick={handleReconnect}
        disabled={isConnecting}
        className="ml-2 flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
        {isConnecting ? 'Connecting...' : 'Reconnect'}
      </button>
    </div>
  );
};