import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

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