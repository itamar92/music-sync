export const isOnline = (): boolean => {
  return navigator.onLine;
};

export const waitForOnline = (timeout = 10000): Promise<boolean> => {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve(true);
      return;
    }

    let timeoutId: number;
    
    const handleOnline = () => {
      clearTimeout(timeoutId);
      window.removeEventListener('online', handleOnline);
      resolve(true);
    };

    window.addEventListener('online', handleOnline);
    
    timeoutId = setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      resolve(false);
    }, timeout);
  });
};

export const getNetworkErrorMessage = (error: any): string => {
  if (!navigator.onLine) {
    return 'No internet connection. Please check your network and try again.';
  }
  
  if (error?.status === 401) {
    return 'Authentication failed. Please reconnect to Dropbox.';
  }
  
  if (error?.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  if (error?.status >= 500) {
    return 'Service is temporarily unavailable. Please try again later.';
  }
  
  if (error?.status === 0 || error?.name === 'NetworkError') {
    return 'Network error. Please check your connection and try again.';
  }
  
  return error?.message || 'An unexpected error occurred. Please try again.';
};