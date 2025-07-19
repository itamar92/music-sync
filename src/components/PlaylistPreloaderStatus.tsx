import React, { useState, useEffect } from 'react';
import { playlistPreloader } from '../services/playlistPreloader';
import { Activity, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';

export const PlaylistPreloaderStatus: React.FC = () => {
  const [status, setStatus] = useState(playlistPreloader.getStatus());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(playlistPreloader.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-20 right-4 bg-blue-500 text-white p-2 rounded-full shadow-lg hover:bg-blue-600 transition-colors z-50"
        title="Show Preloader Status"
      >
        <Activity className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 bg-black/90 text-white p-4 rounded-lg shadow-xl max-w-sm z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Preloader Status
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Current Track:</span>
          <span className="font-mono">{status.currentIndex + 1}/{status.totalTracks}</span>
        </div>

        <div className="flex justify-between">
          <span className="flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-400" />
            Ready:
          </span>
          <span className="font-mono text-green-400">{status.preloadedTracks}</span>
        </div>

        <div className="flex justify-between">
          <span className="flex items-center gap-1">
            <Loader className="w-3 h-3 text-blue-400 animate-spin" />
            Loading:
          </span>
          <span className="font-mono text-blue-400">{status.loadingTracks}</span>
        </div>

        <div className="flex justify-between">
          <span className="flex items-center gap-1">
            <XCircle className="w-3 h-3 text-red-400" />
            Failed:
          </span>
          <span className="font-mono text-red-400">{status.failedTracks}</span>
        </div>

        <div className="flex justify-between">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-yellow-400" />
            Queue:
          </span>
          <span className="font-mono text-yellow-400">{status.queueLength}</span>
        </div>

        <div className="border-t border-gray-600 pt-2 mt-3">
          <div className="text-xs text-gray-400">
            <div>Active: {status.activePreloads}/{status.strategy.maxConcurrentPreloads}</div>
            <div>Strategy: {status.strategy.immediatePreload}+{status.strategy.backgroundPreload}</div>
          </div>
        </div>

        {/* Performance indicator */}
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs">Performance:</span>
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  status.preloadedTracks >= 3 ? 'bg-green-500' :
                  status.preloadedTracks >= 1 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{
                  width: `${Math.min((status.preloadedTracks / 3) * 100, 100)}%`
                }}
              />
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {status.preloadedTracks >= 3 ? 'Optimal' :
             status.preloadedTracks >= 1 ? 'Good' : 'Poor'} - 
            {status.preloadedTracks >= 3 ? ' No delays expected' :
             status.preloadedTracks >= 1 ? ' Minor delays possible' : ' Delays likely'}
          </div>
        </div>
      </div>
    </div>
  );
};