import { describe, expect, test } from 'vitest';
import { firebaseConfig, isFirebaseConfigured } from './firebase';

describe('firebase config', () => {
  test('is off when the env keys are not set', () => {
    expect(isFirebaseConfigured({})).toBe(false);
    expect(isFirebaseConfigured({ apiKey: 'a', projectId: 'p' })).toBe(false);
  });

  test('is on only when every required key is present', () => {
    const cfg = { apiKey: 'a', authDomain: 'd', projectId: 'p', messagingSenderId: 'm', appId: 'i' };
    expect(isFirebaseConfigured(cfg)).toBe(true);
  });

  test('config is read from VITE_FIREBASE_* variables', () => {
    expect(Object.keys(firebaseConfig)).toEqual(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']);
  });
});
