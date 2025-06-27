import { Track, Folder } from '../types';

export const generateShareLink = (item: Track | Folder, folderId?: string): string => {
  const shareData = {
    type: 'track' in item ? 'track' : 'folder',
    id: item.id,
    name: item.name,
    folderId: folderId || ('folderId' in item ? item.folderId : undefined)
  };
  
  return `${window.location.origin}/share/${btoa(JSON.stringify(shareData))}`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (fallbackError) {
      document.body.removeChild(textArea);
      return false;
    }
  }
};

export const parseSharedLink = (encodedData: string): any => {
  try {
    return JSON.parse(atob(encodedData));
  } catch (error) {
    console.error('Failed to parse shared link:', error);
    return null;
  }
};