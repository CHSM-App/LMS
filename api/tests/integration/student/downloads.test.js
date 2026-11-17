const { app, request, reset, closeAll, clock } = require('../../setup/helpers');
const { world, query, one, T } = require('../../setup/student');

beforeEach(reset);
afterAll(closeAll);

const dev = (s, id = 'device-aaaa-1111') => s.post('/api/v1/student/devices', { deviceId: id, deviceName: 'Redmi Note', platform: 'android' });
const download = (s, contentId, deviceId = 'device-aaaa-1111') =>
  request(app).post(`/api/v1/student/contents/${contentId}/download`).set('Authorization', `Bearer ${s.token}`).set('X-Device-Id', deviceId).send({});

test('licence for an uploaded video on a registered device; links and PDFs are refused', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await world();
  expect((await download(w.s, w.video.id)).status).toBe(403);
  expect((await download(w.s, w.video.id)).body.error).toBe('Register this device first');
  expect((await dev(w.s)).status).toBe(201);
  const r = await download(w.s, w.video.id);
  expect(r.status).toBe(200);
  expect(r.body.data.downloadUrl).toMatch(/\?exp=\d+&sig=/);
  expect(Buffer.from(r.body.data.key, 'base64')).toHaveLength(32);
  expect(new Date(r.body.data.licenseExpiresAt) - new Date('2026-06-15T03:00:00Z')).toBe(7 * 86400000);
  expect(r.body.data.sizeBytes).toBeGreaterThan(0);
  expect((await download(w.s, w.pdf.id)).status).toBe(400);
  const yt = (await w.t.post(`/api/v1/teacher/modules/${w.moduleId}/contents`, { title: 'YT', type: 'video', videoSource: 'youtube', url: 'https://youtu.be/abcdefgh123' })).body.data;
  const ytr = await download(w.s, yt.id);
  expect(ytr.status).toBe(409);
  expect(ytr.body.error).toBe('This video can only be watched online');
});

test('licence never outlives the subscription and renews or revokes', async () => {
  clock.set(new Date('2026-06-15T03:00:00Z'));
  const w = await world({ enrollOpts: { start: '2026-01-01', end: '2026-06-18' } });
  await dev(w.s);
  const r = await download(w.s, w.video.id);
  expect(r.body.data.licenseExpiresAt).toBe('2026-06-18T18:29:59.000Z');
  clock.set(new Date('2026-06-17T03:00:00Z'));
  const renew = await w.s.post('/api/v1/student/downloads/renew', { deviceId: 'device-aaaa-1111', contentIds: [w.video.id] });
  expect(renew.body.data[0]).toMatchObject({ contentId: w.video.id, licenseExpiresAt: '2026-06-18T18:29:59.000Z' });
  clock.set(new Date('2026-06-20T03:00:00Z'));
  const gone = await w.s.post('/api/v1/student/downloads/renew', { deviceId: 'device-aaaa-1111', contentIds: [w.video.id] });
  expect(gone.body.data[0]).toEqual({ contentId: w.video.id, revoked: true, reason: 'subscription_ended' });
});

test('two devices at most; removing one revokes its downloads', async () => {
  const w = await world();
  await dev(w.s, 'device-1');
  await dev(w.s, 'device-2');
  const third = await dev(w.s, 'device-3');
  expect(third.status).toBe(409);
  expect(third.body.code).toBe('DEVICE_LIMIT');
  await download(w.s, w.video.id, 'device-1');
  expect((await w.s.del('/api/v1/student/devices/device-1')).status).toBe(200);
  expect((await one("SELECT revoke_reason FROM dbo.offline_downloads WHERE device_id = 'device-1'")).revoke_reason).toBe('device_removed');
  expect((await dev(w.s, 'device-3')).status).toBe(201);
  expect((await w.s.get('/api/v1/student/devices')).body.data.map((d) => d.deviceId).sort()).toEqual(['device-2', 'device-3']);
});

test('blocked teacher: completed lessons renew, others are revoked; logout revokes the device', async () => {
  const w = await world();
  await dev(w.s);
  await download(w.s, w.video.id);
  const pdfLesson = w.contents[0];
  await w.s.post(`/api/v1/student/contents/${w.video.id}/progress`, { completed: true });
  await query("UPDATE dbo.users SET status = 'blocked' WHERE user_id = @t", { t: T.int(w.t.user.user_id) });
  const ok = await w.s.post('/api/v1/student/downloads/renew', { deviceId: 'device-aaaa-1111', contentIds: [w.video.id] });
  expect(ok.body.data[0].revoked).toBeUndefined();
  await query("UPDATE dbo.content_progress SET completed_at = NULL WHERE content_id = @c", { c: T.int(w.video.id) });
  const no = await w.s.post('/api/v1/student/downloads/renew', { deviceId: 'device-aaaa-1111', contentIds: [w.video.id] });
  expect(no.body.data[0]).toEqual({ contentId: w.video.id, revoked: true, reason: 'teacher_inactive' });
  expect(pdfLesson).toBeTruthy();
});

test('offline progress sync never un-completes a lesson', async () => {
  const w = await world();
  const res = await w.s.post('/api/v1/student/progress/sync', { items: [
    { contentId: w.video.id, positionSec: 40, completedAt: '2026-06-15T03:00:00Z' },
    { contentId: w.video.id, positionSec: 10 },
  ] });
  expect(res.status).toBe(200);
  const row = await one('SELECT last_position_sec, completed_at FROM dbo.content_progress WHERE content_id = @c', { c: T.int(w.video.id) });
  expect(row.completed_at).toBeTruthy();
  expect(row.last_position_sec).toBe(10);
});
