const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");
const {Dropbox} = require("dropbox");

const app = express();

// CORS configuration
app.use(cors({
  origin: ["https://music-sync-99dbb.web.app", "http://localhost:3000"],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Dropbox service configuration
let dbx = null;
const DROPBOX_ACCESS_TOKEN = functions.config().dropbox.access_token;

// Initialize Dropbox
if (DROPBOX_ACCESS_TOKEN) {
  dbx = new Dropbox({
    accessToken: DROPBOX_ACCESS_TOKEN,
    fetch: fetch,
  });
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

// API Routes
app.get("/status", (req, res) => {
  res.json({
    success: true,
    data: {
      isInitialized: !!dbx,
      hasToken: !!DROPBOX_ACCESS_TOKEN,
      serverTime: new Date().toISOString(),
    },
  });
});

app.get("/folders", async (req, res) => {
  try {
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
    console.error("API Error - listFolders:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/folders/:folderId/tracks", async (req, res) => {
  try {
    if (!dbx) {
      return res.status(500).json({
        success: false,
        error: "Dropbox not initialized",
      });
    }

    const folderPath = decodeURIComponent(req.params.folderId);
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
    console.error("API Error - getTracksFromFolder:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/files/:fileId/stream", async (req, res) => {
  try {
    if (!dbx) {
      return res.status(500).json({
        success: false,
        error: "Dropbox not initialized",
      });
    }

    const filePath = decodeURIComponent(req.params.fileId);
    const response = await dbx.filesGetTemporaryLink({
      path: filePath,
    });

    res.json({
      success: true,
      data: {streamUrl: response.result.link},
    });
  } catch (error) {
    console.error("API Error - getFileStreamUrl:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);
