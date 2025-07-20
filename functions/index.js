const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall} = require("firebase-functions/v2/https");
// const {onDocumentCreated, onDocumentUpdated} =
//   require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const {Dropbox} = require("dropbox");
const express = require("express");
const cors = require("cors");

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

// API Functions for frontend integration
const app = express();

// CORS configuration
app.use(cors({
  origin: ["https://music-sync-99dbb.web.app", "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Dropbox service configuration - using environment variables for v2 gen
let dbx = null;
const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN || "";
const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN || "";
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY || "";
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET || "";

/**
 * Refresh the Dropbox access token using the refresh token
 * @return {Promise<string>} New access token
 */
async function refreshDropboxToken() {
  if (!DROPBOX_REFRESH_TOKEN || !DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    throw new Error("Missing refresh token configuration");
  }

  try {
    const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: DROPBOX_REFRESH_TOKEN,
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET,
      }),
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Token refresh failed: ${
        data.error_description || data.error
      }`);
    }

    logger.info("Successfully refreshed Dropbox access token");
    return data.access_token;
  } catch (error) {
    logger.error("Error refreshing Dropbox token:", error);
    throw error;
  }
}

/**
 * Get Dropbox client with automatic token refresh
 * @return {Promise<Dropbox>} Dropbox client instance
 */
async function getDropboxClient() {
  if (!dbx) {
    let accessToken = DROPBOX_ACCESS_TOKEN;

    // If we have a refresh token, try to get a fresh access token
    if (DROPBOX_REFRESH_TOKEN && !accessToken) {
      accessToken = await refreshDropboxToken();
    }

    if (accessToken) {
      dbx = new Dropbox({
        accessToken: accessToken,
      });
    }
  }

  // Test the token and refresh if needed
  if (dbx) {
    try {
      await dbx.usersGetCurrentAccount();
    } catch (error) {
      if (error.status === 401 && DROPBOX_REFRESH_TOKEN) {
        logger.info("Access token expired, refreshing...");
        const newToken = await refreshDropboxToken();
        dbx = new Dropbox({
          accessToken: newToken,
        });
      } else {
        throw error;
      }
    }
  }

  return dbx;
}

// Cache for API responses
const cache = new Map();

/**
 * Generate cache key
 * @param {string} method - method name
 * @param {object} params - parameters
 * @return {string} cache key
 */
function getCacheKey(method, params) {
  return `${method}:${JSON.stringify(params)}`;
}

/**
 * Get data from cache
 * @param {string} key - cache key
 * @param {number} ttlMinutes - TTL in minutes
 * @return {any} cached data or null
 */
function getFromCache(key, ttlMinutes = 5) {
  const cached = cache.get(key);
  if (!cached) return null;

  const now = Date.now();
  const ttl = ttlMinutes * 60 * 1000;
  if (now > cached.timestamp + ttl) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

/**
 * Set data in cache
 * @param {string} key - cache key
 * @param {any} data - data to cache
 */
function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

// Exchange OAuth authorization code for access token
app.post("/exchange-code", async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body;
    
    if (!code || !codeVerifier) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameters: code and codeVerifier"
      });
    }

    if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
      logger.error("Missing Dropbox credentials", { 
        hasAppKey: !!DROPBOX_APP_KEY, 
        hasSecret: !!DROPBOX_APP_SECRET,
        appKeyPrefix: DROPBOX_APP_KEY ? DROPBOX_APP_KEY.substring(0, 4) + "..." : "none"
      });
      return res.status(500).json({
        success: false,
        error: "Server configuration error: missing Dropbox app credentials"
      });
    }

    logger.info("Token exchange attempt", { 
      appKeyPrefix: DROPBOX_APP_KEY.substring(0, 4) + "...",
      hasSecret: !!DROPBOX_APP_SECRET,
      redirectUri: req.body.redirectUri
    });

    // Exchange code for tokens using PKCE
    const tokenResponse = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code: code,
        grant_type: "authorization_code",
        client_id: DROPBOX_APP_KEY,
        client_secret: DROPBOX_APP_SECRET,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri || "https://music-sync-99dbb.web.app",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      logger.error("Dropbox token exchange failed:", tokenData);
      return res.status(400).json({
        success: false,
        error: `Token exchange failed: ${tokenData.error_description || tokenData.error}`
      });
    }

    logger.info("Successfully exchanged OAuth code for tokens", { timestamp: new Date().toISOString() });
    
    res.json({
      success: true,
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type,
        scope: tokenData.scope,
        accountId: tokenData.account_id,
        uid: tokenData.uid
      }
    });
  } catch (error) {
    logger.error("Error in code exchange:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Routes
app.get("/apiStatus", async (req, res) => {
  try {
    const dropboxClient = await getDropboxClient();
    res.json({
      success: true,
      data: {
        isInitialized: !!dropboxClient,
        hasToken: !!DROPBOX_ACCESS_TOKEN || !!DROPBOX_REFRESH_TOKEN,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.json({
      success: false,
      data: {
        isInitialized: false,
        hasToken: false,
        serverTime: new Date().toISOString(),
        error: error.message,
      },
    });
  }
});

app.get("/listFolders", async (req, res) => {
  try {
    const dbx = await getDropboxClient();
    if (!dbx) {
      return res.status(500).json({
        success: false,
        error: "Dropbox not initialized",
      });
    }

    const {path = ""} = req.query;
    const cacheKey = getCacheKey("listFolders", {path});
    const cached = getFromCache(cacheKey, 10);

    if (cached) {
      return res.json({success: true, data: cached});
    }

    const response = await dbx.filesListFolder({
      path: path || "",
      recursive: false,
    });

    const folders = response.result.entries
        .filter((entry) => entry[".tag"] === "folder")
        .map((entry) => ({
          id: entry.path_lower,
          name: entry.name,
          path: entry.path_lower,
          trackCount: 0,
          synced: false,
          type: "dropbox",
          isFolder: true,
          parentPath: path || "",
          hasSubfolders: true,
        }));

    setCache(cacheKey, folders);
    res.json({success: true, data: folders});
  } catch (error) {
    logger.error("API Error - listFolders:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/getTracks", async (req, res) => {
  try {
    const dbx = await getDropboxClient();
    if (!dbx) {
      return res.status(500).json({
        success: false,
        error: "Dropbox not initialized",
      });
    }

    const {path: folderPath} = req.query;
    const cacheKey = getCacheKey("getTracksFromFolder", {folderPath});
    const cached = getFromCache(cacheKey, 20);

    if (cached) {
      return res.json({success: true, data: cached});
    }

    const response = await dbx.filesListFolder({
      path: folderPath,
      recursive: false,
    });

    const audioExtensions = [".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"];
    const tracks = [];

    for (const entry of response.result.entries) {
      if (entry[".tag"] === "file" &&
          entry.path_lower &&
          audioExtensions.some((ext) =>
            entry.name.toLowerCase().endsWith(ext))) {
        tracks.push({
          id: entry.path_lower,
          name: entry.name.replace(/\.[^/.]+$/, ""),
          artist: "Unknown Artist",
          duration: "0:00",
          durationSeconds: 0,
          path: entry.path_lower,
          folderId: folderPath,
        });
      }
    }

    setCache(cacheKey, tracks);
    res.json({success: true, data: tracks});
  } catch (error) {
    logger.error("API Error - getTracksFromFolder:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/getStreamUrl", async (req, res) => {
  try {
    const dbx = await getDropboxClient();
    if (!dbx) {
      return res.status(500).json({
        success: false,
        error: "Dropbox not initialized",
      });
    }

    const {path: filePath} = req.query;
    const response = await dbx.filesGetTemporaryLink({
      path: filePath,
    });

    res.json({
      success: true,
      data: {streamUrl: response.result.link},
    });
  } catch (error) {
    logger.error("API Error - getFileStreamUrl:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Export the Express app as a Firebase Function
exports.api = onRequest(
    {
      secrets: [
        "DROPBOX_ACCESS_TOKEN",
        "DROPBOX_REFRESH_TOKEN",
        "DROPBOX_APP_KEY",
        "DROPBOX_APP_SECRET",
      ],
    },
    app,
);
