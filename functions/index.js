const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall} = require("firebase-functions/v2/https");
// const {onDocumentCreated, onDocumentUpdated} =
//   require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {Dropbox} = require("dropbox");

admin.initializeApp();

setGlobalOptions({maxInstances: 10});

// Dropbox API helper functions
const createDropboxClient = (accessToken) => {
  return new Dropbox({accessToken});
};

const parseTrackMetadata = (filename) => {
  // Basic filename parsing - enhance with proper metadata library
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  const parts = nameWithoutExt.split(" - ");

  if (parts.length >= 2) {
    return {
      artist: parts[0].trim(),
      name: parts.slice(1).join(" - ").trim(),
    };
  }

  return {
    artist: "Unknown Artist",
    name: nameWithoutExt,
  };
};

const isAudioFile = (filename) => {
  const audioExtensions = [
    ".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".wma",
  ];
  return audioExtensions.some((ext) => filename.toLowerCase().endsWith(ext));
};

// Cloud Functions

// Sync a user's Dropbox folder
exports.syncDropboxFolder = onCall({
  enforceAppCheck: false,
}, async (request) => {
  const {folderId, folderPath, accessToken} = request.data;
  const userId = request.auth && request.auth.uid;

  if (!userId) {
    throw new Error("Authentication required");
  }

  if (!accessToken) {
    throw new Error("Dropbox access token required");
  }

  try {
    const dbx = createDropboxClient(accessToken);
    logger.info(`Syncing folder ${folderPath} for user ${userId}`);

    // List files in the folder
    const response = await dbx.filesListFolder({
      path: folderPath === "" ? "" : folderPath,
      recursive: false,
    });

    const audioFiles = response.result.entries.filter((entry) =>
      entry[".tag"] === "file" && isAudioFile(entry.name),
    );

    const tracks = audioFiles.map((file) => {
      const metadata = parseTrackMetadata(file.name);
      return {
        name: metadata.name,
        artist: metadata.artist,
        duration: "0:00", // Will be updated when file is processed
        durationSeconds: 0,
        filePath: file.path_display,
        folderId: folderId,
        userId: userId,
      };
    });

    logger.info(`Found ${tracks.length} audio files in ${folderPath}`);

    return {
      success: true,
      tracksFound: tracks.length,
      tracks: tracks,
    };
  } catch (error) {
    logger.error("Error syncing Dropbox folder:", error);
    throw new Error(`Sync failed: ${error.message}`);
  }
});

// Get Dropbox file temporary link for streaming
exports.getDropboxStreamLink = onCall({
  enforceAppCheck: false,
}, async (request) => {
  const {filePath, accessToken} = request.data;
  const userId = request.auth && request.auth.uid;

  if (!userId) {
    throw new Error("Authentication required");
  }

  if (!accessToken) {
    throw new Error("Dropbox access token required");
  }

  try {
    const dbx = createDropboxClient(accessToken);
    const response = await dbx.filesGetTemporaryLink({path: filePath});

    return {
      success: true,
      link: response.result.link,
    };
  } catch (error) {
    logger.error("Error getting stream link:", error);
    throw new Error(`Failed to get stream link: ${error.message}`);
  }
});

// Validate Dropbox token
exports.validateDropboxToken = onCall({
  enforceAppCheck: false,
}, async (request) => {
  const {accessToken} = request.data;
  const userId = request.auth && request.auth.uid;

  if (!userId) {
    throw new Error("Authentication required");
  }

  if (!accessToken) {
    return {valid: false};
  }

  try {
    const dbx = createDropboxClient(accessToken);
    await dbx.usersGetCurrentAccount();

    return {valid: true};
  } catch (error) {
    logger.info("Token validation failed:", error.message);
    return {valid: false};
  }
});

// Get Dropbox folder contents
exports.listDropboxFolders = onCall({
  enforceAppCheck: false,
}, async (request) => {
  const {path = "", accessToken} = request.data;
  const userId = request.auth && request.auth.uid;

  if (!userId) {
    throw new Error("Authentication required");
  }

  if (!accessToken) {
    throw new Error("Dropbox access token required");
  }

  try {
    const dbx = createDropboxClient(accessToken);
    const response = await dbx.filesListFolder({
      path: path === "" ? "" : path,
      recursive: false,
    });

    const folders = response.result.entries
        .filter((entry) => entry[".tag"] === "folder")
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          path: folder.path_display,
          trackCount: 0, // Will be populated by client if needed
          synced: false, // Will be populated by client
          type: "dropbox",
          isFolder: true,
          parentPath: path,
        }));

    return {
      success: true,
      folders: folders,
    };
  } catch (error) {
    logger.error("Error listing folders:", error);
    throw new Error(`Failed to list folders: ${error.message}`);
  }
});

// Get track duration from Dropbox file metadata
exports.getTrackDuration = onCall({
  enforceAppCheck: false,
}, async (request) => {
  const {filePath, accessToken} = request.data;
  const userId = request.auth && request.auth.uid;

  if (!userId) {
    throw new Error("Authentication required");
  }

  try {
    const dbx = createDropboxClient(accessToken);
    const metadata = await dbx.filesGetMetadata({path: filePath});

    // This is a simplified version - you'd need a proper audio metadata library
    // to extract duration from the actual file
    const fileSizeKB = metadata.result.size / 1024;
    // Rough estimate based on 128kbps
    const estimatedDurationSeconds = Math.round(fileSizeKB / 128);
    const minutes = Math.floor(estimatedDurationSeconds / 60);
    const seconds = estimatedDurationSeconds % 60;

    return {
      success: true,
      duration: `${minutes}:${seconds.toString().padStart(2, "0")}`,
      durationSeconds: estimatedDurationSeconds,
    };
  } catch (error) {
    logger.error("Error getting track duration:", error);
    return {
      success: false,
      duration: "0:00",
      durationSeconds: 0,
    };
  }
});

// Scheduled function to clean up expired sync data
exports.cleanupExpiredSyncs = onSchedule({
  schedule: "0 2 * * *", // Run daily at 2 AM
  timeZone: "UTC",
}, async () => {
  try {
    const db = admin.firestore();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Clean up old sync records
    const expiredSyncs = await db.collection("trackSyncs")
        .where("syncStatus", "==", "error")
        .where("updatedAt", "<", sevenDaysAgo)
        .get();

    const batch = db.batch();
    expiredSyncs.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    logger.info(`Cleaned up ${expiredSyncs.size} expired sync records`);
  } catch (error) {
    logger.error("Error in cleanup function:", error);
  }
});

// Webhook handler for Dropbox file changes (if you set up webhooks)
exports.dropboxWebhook = onRequest(async (req, res) => {
  if (req.method === "GET") {
    // Verification challenge
    const challenge = req.query.challenge;
    res.type("text/plain");
    res.send(challenge);
    return;
  }

  if (req.method === "POST") {
    try {
      // Handle Dropbox webhook notifications
      const notification = req.body;
      logger.info("Received Dropbox webhook:", notification);

      // Process the notification - trigger re-sync for affected users
      // This would involve checking which users have synced the changed folders
      // and triggering appropriate sync operations

      res.status(200).send("OK");
    } catch (error) {
      logger.error("Error processing webhook:", error);
      res.status(500).send("Error");
    }
  } else {
    res.status(405).send("Method not allowed");
  }
});
