export const formatTime = (time: number): string => {
  if (isNaN(time) || time < 0) return '0:00';
  
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const formatDuration = (totalSeconds: number): string => {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '0m';
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

export const calculatePlaylistDuration = (tracks: { durationSeconds: number }[]): string => {
  const totalSeconds = tracks.reduce((sum, track) => sum + (track.durationSeconds || 0), 0);
  return formatDuration(totalSeconds);
};