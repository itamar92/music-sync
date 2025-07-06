const {onRequest} = require("firebase-functions/v2/https");
const {Dropbox} = require("dropbox");

// Get Dropbox token from environment variables
const getDropboxToken = () => {
  return process.env.DROPBOX_ACCESS_TOKEN;
};

// Create Dropbox client
const createDropboxClient = () => {
  const token = getDropboxToken();
  if (!token) {
    throw new Error("Dropbox access token not configured");
  }
  return new Dropbox({accessToken: token});
};

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Public API for listing Dropbox folders
 */
exports.listFolders = onRequest({cors: true}, async (req, res) => {
  try {
    // Set CORS headers
    Object.keys(corsHeaders).forEach((key) => {
      res.set(key, corsHeaders[key]);
    });

    if (req.method === "OPTIONS") {
      res.status(200).send("");
      return;
    }

    const dbx = createDropboxClient();
    const path = req.query.path || "";

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

    res.json({success: true, data: folders});
  } catch (error) {
    console.error("Error listing folders:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Public API for getting tracks from folder
 */
exports.getTracks = onRequest({cors: true}, async (req, res) => {
  try {
    // Set CORS headers
    Object.keys(corsHeaders).forEach((key) => {
      res.set(key, corsHeaders[key]);
    });

    if (req.method === "OPTIONS") {
      res.status(200).send("");
      return;
    }

    const dbx = createDropboxClient();
    const folderPath = req.query.path || "";

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

    res.json({success: true, data: tracks});
  } catch (error) {
    console.error("Error getting tracks:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Public API for getting file stream URL
 */
exports.getStreamUrl = onRequest({cors: true}, async (req, res) => {
  try {
    // Set CORS headers
    Object.keys(corsHeaders).forEach((key) => {
      res.set(key, corsHeaders[key]);
    });

    if (req.method === "OPTIONS") {
      res.status(200).send("");
      return;
    }

    const dbx = createDropboxClient();
    const filePath = req.query.path || "";

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: "File path is required",
      });
    }

    const response = await dbx.filesGetTemporaryLink({
      path: filePath,
    });

    res.json({
      success: true,
      data: {streamUrl: response.result.link},
    });
  } catch (error) {
    console.error("Error getting stream URL:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * API Status check
 */
exports.status = onRequest({cors: true}, async (req, res) => {
  try {
    // Set CORS headers
    Object.keys(corsHeaders).forEach((key) => {
      res.set(key, corsHeaders[key]);
    });

    if (req.method === "OPTIONS") {
      res.status(200).send("");
      return;
    }

    const token = getDropboxToken();
    let isInitialized = false;

    if (token) {
      try {
        const dbx = createDropboxClient();
        await dbx.usersGetCurrentAccount();
        isInitialized = true;
      } catch (error) {
        console.warn("Token validation failed:", error.message);
      }
    }

    res.json({
      success: true,
      data: {
        isInitialized,
        hasToken: !!token,
        serverTime: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error checking status:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
