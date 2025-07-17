import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

export const migrateCollectionsToPublic = async (userId: string) => {
  try {
    console.log('Migrating collections to public...');
    
    const collectionsRef = collection(db, 'collections');
    const collectionsQuery = query(collectionsRef, where('userId', '==', userId));
    const collectionsSnapshot = await getDocs(collectionsQuery);
    
    const updatePromises = collectionsSnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      
      // Always update to ensure isPublic is true
      await updateDoc(doc(db, 'collections', docSnap.id), {
        isPublic: true
      });
      console.log(`Updated collection ${docSnap.id} (${data.displayName || data.name}) to public`);
    });
    
    await Promise.all(updatePromises);
    console.log(`Collections migration completed - ${collectionsSnapshot.docs.length} collections updated`);
    return collectionsSnapshot.docs.length;
  } catch (error) {
    console.error('Error migrating collections:', error);
    throw error;
  }
};

export const migratePlaylistsToPublic = async (userId: string) => {
  try {
    console.log('Migrating playlists to public...');
    
    const playlistsRef = collection(db, 'playlists');
    const playlistsQuery = query(playlistsRef, where('userId', '==', userId));
    const playlistsSnapshot = await getDocs(playlistsQuery);
    
    const updatePromises = playlistsSnapshot.docs.map(async (docSnap) => {
      const data = docSnap.data();
      
      // Always update to ensure isPublic is true
      await updateDoc(doc(db, 'playlists', docSnap.id), {
        isPublic: true
      });
      console.log(`Updated playlist ${docSnap.id} (${data.displayName || data.name}) to public`);
    });
    
    await Promise.all(updatePromises);
    console.log(`Playlists migration completed - ${playlistsSnapshot.docs.length} playlists updated`);
    return playlistsSnapshot.docs.length;
  } catch (error) {
    console.error('Error migrating playlists:', error);
    throw error;
  }
};