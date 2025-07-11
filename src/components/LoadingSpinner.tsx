import React from 'react';

export const LoadingSpinner: React.FC = () => {
  return (
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
      <h2 className="text-2xl font-bold text-white mb-2">Loading</h2>
      <p className="text-gray-300">Please wait...</p>
    </div>
  );
};