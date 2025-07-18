import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const debugDatabase = async (userId: string) => {
  console.log('=== Database Debug Information ===');
  
  try {
    // Check tracks collection
    const tracksQuery = query(
      collection(db, 'tracks'),
      where('userId', '==', userId)
    );
    const tracksSnapshot = await getDocs(tracksQuery);
    console.log(`Total tracks for user ${userId}:`, tracksSnapshot.size);
    
    // Group tracks by folder
    const tracksByFolder: Record<string, any[]> = {};
    tracksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const folderId = data.folderId || 'unknown';
      if (!tracksByFolder[folderId]) {
        tracksByFolder[folderId] = [];
      }
      tracksByFolder[folderId].push({
        id: doc.id,
        name: data.name,
        artist: data.artist,
        duration: data.duration,
        filePath: data.filePath,
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        hasStreamUrl: !!data.streamUrl,
        streamUrlExpired: data.streamUrlExpiresAt ? new Date() > data.streamUrlExpiresAt.toDate() : false
      });
    });
    
    console.log('Tracks by folder:', tracksByFolder);
    
    // Check folder syncs
    const foldersQuery = query(
      collection(db, 'folderSyncs'),
      where('userId', '==', userId)
    );
    const foldersSnapshot = await getDocs(foldersQuery);
    console.log(`Total folder syncs for user ${userId}:`, foldersSnapshot.size);
    
    foldersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`Folder ${doc.id}:`, {
        folderName: data.folderName,
        dropboxPath: data.dropboxPath,
        displayName: data.displayName,
        isActive: data.isActive,
        lastSyncAt: data.lastSyncAt?.toDate?.() || data.lastSyncAt
      });
    });
    
    // Check playlists
    const playlistsQuery = query(
      collection(db, 'playlists'),
      where('userId', '==', userId)
    );
    const playlistsSnapshot = await getDocs(playlistsQuery);
    console.log(`Total playlists for user ${userId}:`, playlistsSnapshot.size);
    
    return {
      totalTracks: tracksSnapshot.size,
      tracksByFolder,
      totalFolderSyncs: foldersSnapshot.size,
      totalPlaylists: playlistsSnapshot.size
    };
    
  } catch (error) {
    console.error('Error debugging database:', error);
    return null;
  }
};

export const debugCollectionsAndPlaylists = async (userId: string) => {
  console.log('=== DATABASE DEBUG INFO ===');
  
  try {
    // Check all collections for this user
    const collectionsRef = collection(db, 'collections');
    const collectionsQuery = query(collectionsRef, where('userId', '==', userId));
    const collectionsSnapshot = await getDocs(collectionsQuery);
    
    console.log(`Found ${collectionsSnapshot.docs.length} collections for user ${userId}`);
    collectionsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`Collection ${doc.id}:`, {
        name: data.name,
        displayName: data.displayName,
        isPublic: data.isPublic,
        userId: data.userId
      });
    });
    
    // Check all playlists for this user
    const playlistsRef = collection(db, 'playlists');
    const playlistsQuery = query(playlistsRef, where('userId', '==', userId));
    const playlistsSnapshot = await getDocs(playlistsQuery);
    
    console.log(`Found ${playlistsSnapshot.docs.length} playlists for user ${userId}`);
    playlistsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`Playlist ${doc.id}:`, {
        name: data.name,
        displayName: data.displayName,
        isPublic: data.isPublic,
        collectionId: data.collectionId,
        userId: data.userId
      });
    });
    
    // Check public collections
    const publicCollectionsQuery = query(collectionsRef, where('isPublic', '==', true));
    const publicCollectionsSnapshot = await getDocs(publicCollectionsQuery);
    
    console.log(`Found ${publicCollectionsSnapshot.docs.length} public collections total`);
    publicCollectionsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      console.log(`Public Collection ${doc.id}:`, {
        name: data.name,
        displayName: data.displayName,
        userId: data.userId
      });
    });
    
  } catch (error) {
    console.error('Error debugging database:', error);
  }
  
  console.log('=== END DEBUG INFO ===');
};