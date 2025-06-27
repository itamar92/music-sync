import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string | null;
  onConnect?: () => void;
  onRetry?: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isConnecting,
  error,
  onConnect,
  onRetry
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show offline status if not online
  if (!isOnline) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <WifiOff className="w-4 h-4 text-red-400" />
        <span className="text-red-400">Offline</span>
      </div>
    );
  }
  if (isConnecting) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
        <span className="text-blue-400">Connecting to Dropbox...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <AlertCircle className="w-4 h-4 text-red-400" />
        <span className="text-red-400">Connection failed</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-blue-400 hover:text-blue-300 underline ml-2"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <CheckCircle2 className="w-4 h-4 text-green-400" />
        <span className="text-green-400">Connected to Dropbox</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      <WifiOff className="w-4 h-4 text-gray-400" />
      <span className="text-gray-400">Not connected</span>
      {onConnect && (
        <button
          onClick={onConnect}
          className="text-blue-400 hover:text-blue-300 underline ml-2"
        >
          Connect
        </button>
      )}
    </div>
  );
};