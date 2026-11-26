// Firebase for the website (used for web push later). Everything is OFF until the
// VITE_FIREBASE_* keys are set, so the site builds and runs without a Firebase project.
// Keys come from Firebase console > Project settings > Your apps > Web app.
import { initializeApp, getApps } from 'firebase/app';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];

export const isFirebaseConfigured = (cfg = firebaseConfig) => REQUIRED.every((k) => Boolean(cfg[k]));

// Returns the Firebase app, or null when the keys are not set.
export function getFirebaseApp() {
  if (!isFirebaseConfigured()) return null;
  return getApps()[0] || initializeApp(firebaseConfig);
}
