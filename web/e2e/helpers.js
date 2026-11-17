import zlib from 'node:zlib';
import { expect } from '@playwright/test';

// Test hooks exist only in api/scripts/e2e-server.js (test database, console providers).
const HOOKS = 'http://localhost:4100/api/v1/__e2e';

export async function hook(request, method, path, params) {
  const url = `${HOOKS}${path}${params ? `?${new URLSearchParams(params)}` : ''}`;
  const res = method === 'GET' ? await request.get(url) : await request.post(url);
  const body = await res.json();
  if (!body.success) throw new Error(`hook ${path}: ${body.error}`);
  return body.data;
}

export const reset = (request) => hook(request, 'POST', '/reset');
export const ADMIN_MOBILE = '+919000000001';
export const local10 = (e164) => e164.replace(/^\+91/, '');

/** The OTP the console provider generated for this mobile + purpose (polls briefly). */
export async function otpFor(request, mobile, purpose) {
  for (let i = 0; i < 20; i += 1) {
    const { code } = await hook(request, 'GET', '/otp', { mobile, purpose });
    if (code) return code;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`no OTP for ${mobile} ${purpose}`);
}

export async function enterOtp(page, code) {
  for (let i = 0; i < 6; i += 1) await page.getByLabel(`Digit ${i + 1}`, { exact: true }).fill(code[i]);
}

/** Log in through the real login page; waits until the app has left /login (unless expectSuccess is false). */
export async function login(page, request, mobile, { expectSuccess = true } = {}) {
  await page.goto('/login');
  await page.getByLabel('Mobile number').fill(local10(mobile));
  await page.getByRole('button', { name: 'Send OTP' }).click();
  await expect(page.getByText(/OTP sent to/)).toBeVisible();
  await enterOtp(page, await otpFor(request, mobile, 'login'));
  await page.getByRole('button', { name: 'Verify and log in' }).click();
  if (expectSuccess) await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function logout(page) {
  await page.context().clearCookies();
  await page.goto('/login');
}

/** Valid 1280×720 PNG (the course thumbnail minimum). */
export function png(width = 1280, height = 720) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x5c)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** "YYYY-MM-DDTHH:mm" in IST, n days from now, for datetime-local inputs. */
export function istLocal(daysAhead = 2, hour = 17) {
  const d = new Date(Date.now() + daysAhead * 86400000 + 330 * 60000);
  return `${d.toISOString().slice(0, 10)}T${String(hour).padStart(2, '0')}:00`;
}
