// src/services/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { isServerMode } from "./dataMode";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// In server mode (containerized deployment) Firebase is not used at all and
// its env vars are absent — initializing would throw at module load.
const app = !isServerMode && firebaseConfig.apiKey
  ? initializeApp(firebaseConfig)
  : null;

// Typed non-null for the legacy Firebase code paths; those only execute when
// app is initialized (guarded by isServerMode checks at the call sites).
export const db = (app ? getFirestore(app) : null) as ReturnType<typeof getFirestore>;
export const auth = (app ? getAuth(app) : null) as ReturnType<typeof getAuth>;
