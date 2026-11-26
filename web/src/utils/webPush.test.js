import { beforeEach, describe, expect, test, vi } from 'vitest';

const post = vi.fn(async () => ({}));
const del = vi.fn(async () => ({}));
vi.mock('../api/client', () => ({ api: { post: (...a) => post(...a), del: (...a) => del(...a) } }));
vi.mock('firebase/messaging', () => ({
  getMessaging: () => ({}),
  getToken: vi.fn(async () => 'web-token-aaaaaaaaaaaaaaaa'),
  deleteToken: vi.fn(async () => true),
  isSupported: async () => true,
}));
vi.mock('./firebase', () => ({ getFirebaseApp: vi.fn(() => ({})) }));

const setup = ({ permission = 'granted', vapid = 'vapid-key' } = {}) => {
  vi.resetModules();
  vi.stubEnv('VITE_FIREBASE_VAPID_KEY', vapid);
  globalThis.Notification = { permission, requestPermission: vi.fn(async () => permission) };
  Object.defineProperty(globalThis.navigator, 'serviceWorker', { configurable: true, value: { register: vi.fn(async () => ({})) } });
  return import('./webPush');
};

beforeEach(() => {
  post.mockClear();
  del.mockClear();
  localStorage.clear();
});

describe('web push', () => {
  test('registers the browser token with the API after permission is granted', async () => {
    const { enableWebPush } = await setup();
    expect(await enableWebPush()).toBe(true);
    expect(post).toHaveBeenCalledWith('/push-tokens', { token: 'web-token-aaaaaaaaaaaaaaaa', platform: 'web' });
  });

  test('does nothing without a VAPID key, or when notifications are blocked', async () => {
    expect(await (await setup({ vapid: '' })).enableWebPush()).toBe(false);
    expect(await (await setup({ permission: 'denied' })).enableWebPush()).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  test('logout removes the stored token from the API', async () => {
    const m = await setup();
    await m.enableWebPush();
    await m.disableWebPush();
    expect(del).toHaveBeenCalledWith('/push-tokens', { token: 'web-token-aaaaaaaaaaaaaaaa' });
  });
});
