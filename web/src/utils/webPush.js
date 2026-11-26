// Web push for the website (Firebase Cloud Messaging). Off until VITE_FIREBASE_* and VITE_FIREBASE_VAPID_KEY are set.
// The key pair comes from Firebase console > Project settings > Cloud Messaging > Web Push certificates.
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { getFirebaseApp } from './firebase';
import { api } from '../api/client';

const STORE_KEY = 'lms.pushToken';
const vapidKey = () => import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Push is a bonus, so failures never reach the user, but they are logged for the developer console.
const why = (msg, err) => console.warn('[web-push]', msg, err || '');

const read = () => {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch (_) {
    return null;
  }
};
const write = (v) => {
  try {
    if (v) localStorage.setItem(STORE_KEY, v);
    else localStorage.removeItem(STORE_KEY);
  } catch (_) {
    /* private mode: fine */
  }
};

// After login: ask permission, send this browser's token to the API. Never throws.
// Returns true when the browser is registered.
export async function enableWebPush() {
  try {
    if (!vapidKey()) return why('VITE_FIREBASE_VAPID_KEY is not set (restart npm run dev after editing .env.local)') || false;
    if (!getFirebaseApp()) return why('Firebase VITE_FIREBASE_* keys are not set') || false;
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !(await isSupported())) return why('this browser does not support web push') || false;
    if (Notification.permission === 'denied') return why('notifications are blocked for this site in the browser') || false;
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return why('notification permission was not granted') || false;
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const token = await getToken(getMessaging(getFirebaseApp()), { vapidKey: vapidKey(), serviceWorkerRegistration: registration });
    if (!token) return why('Firebase returned no token') || false;
    await api.post('/push-tokens', { token, platform: 'web' });
    write(token);
    return true;
  } catch (err) {
    why('registration failed', err);
    return false;
  }
}

// Before logout (the session is still valid): stop messages for this user in this browser.
export async function disableWebPush() {
  const token = read();
  write(null);
  if (!token) return;
  try {
    await api.del('/push-tokens', { token });
    const app = getFirebaseApp();
    if (app) await deleteToken(getMessaging(app));
  } catch (_) {
    /* offline: the server drops the token the next time FCM reports it dead */
  }
}
