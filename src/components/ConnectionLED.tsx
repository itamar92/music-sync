import React from 'react';

interface ConnectionLEDProps {
  isConnected: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * 🔴🟢 Simple LED Connection Status Indicator
 * 
 * Shows a small colored circle indicating connection status
 * Green = Connected, Red = Disconnected
 */
export const ConnectionLED: React.FC<ConnectionLEDProps> = ({ 
  isConnected, 
  size = 'sm' 
}) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3', 
    lg: 'w-4 h-4'
  };

  const baseClasses = `rounded-full ${sizeClasses[size]} transition-colors duration-300`;
  const statusClasses = isConnected 
    ? 'bg-green-500 shadow-green-400/50 shadow-sm' 
    : 'bg-red-500 shadow-red-400/50 shadow-sm';

  return (
    <div 
      className={`${baseClasses} ${statusClasses}`}
      title={isConnected ? 'Connected to Dropbox' : 'Disconnected from Dropbox'}
      aria-label={isConnected ? 'Connected' : 'Disconnected'}
    />
  );
};