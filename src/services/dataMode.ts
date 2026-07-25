// Deployment data mode.
//
// 'firebase' (default) — legacy path: Firestore reads + Firebase Auth +
//   client-side Dropbox tokens.
// 'server' — containerized deployment: all data and streaming goes through
//   the Express backend (server/) via /api; no Firebase involved.
export const isServerMode = import.meta.env.VITE_DATA_MODE === 'server';
