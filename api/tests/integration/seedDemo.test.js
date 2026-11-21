const { one, T, reset, closeAll, createUser } = require('../setup/helpers');
const fs = require('fs');
const { seedDemo, DEMO } = require('../../scripts/seed-demo');
const storage = require('../../src/providers/storage');

beforeEach(reset);
afterAll(closeAll);

const count = async (sql, params) => (await one(sql, params)).n;

test('seedDemo builds a complete demo teacher through the real API, and a re-run adds nothing', async () => {
  const admin = await createUser({ role: 'admin', name: 'Super Admin' });

  const out = await seedDemo({ admin, log: () => {} });
  expect(out).toMatchObject({ teacher: { mobile: DEMO.teacher.mobile } });

  // Teacher: approved request, active subscription, full public profile.
  const t = await one("SELECT * FROM dbo.users WHERE mobile = @m AND role = 'teacher' AND status = 'approved'", { m: T.varchar(DEMO.teacher.mobile, 20) });
  expect(t).toBeTruthy();
  expect(t.photo_key).toBeTruthy();
  expect(await one('SELECT status FROM dbo.teacher_requests WHERE mobile = @m', { m: T.varchar(DEMO.teacher.mobile, 20) })).toEqual({ status: 'approved' });
  expect(await count('SELECT COUNT(*) n FROM dbo.teacher_subscriptions WHERE teacher_id = @t AND end_date >= CAST(SYSUTCDATETIME() AS DATE)', { t: T.int(t.user_id) })).toBe(1);
  const p = await one('SELECT * FROM dbo.teacher_profiles WHERE user_id = @t', { t: T.int(t.user_id) });
  expect(p).toMatchObject({ public_slug: DEMO.teacher.slug });
  expect(p.bio).toBeTruthy();
  expect(p.social_links_json).toBeTruthy();

  // Course: published, 2 subjects, 4 modules, lessons in every module, 2 batches.
  const course = await one("SELECT * FROM dbo.courses WHERE teacher_id = @t AND status = 'published' AND title = 'Class 10 Maths (SSC) - Demo'", { t: T.int(t.user_id) });
  const c = { c: T.int(course.course_id) };
  expect(await count('SELECT COUNT(*) n FROM dbo.subjects WHERE course_id = @c', c)).toBe(2);
  expect(await count('SELECT COUNT(*) n FROM dbo.modules WHERE course_id = @c', c)).toBe(4);
  expect(await count('SELECT COUNT(*) n FROM dbo.modules m WHERE m.course_id = @c AND NOT EXISTS (SELECT 1 FROM dbo.contents x WHERE x.module_id = m.module_id)', c)).toBe(0);
  expect(await count('SELECT COUNT(*) n FROM dbo.batches WHERE course_id = @c', c)).toBe(2);

  // Question bank with every type, and all four exam categories published.
  expect(await count('SELECT COUNT(DISTINCT type) n FROM dbo.questions WHERE course_id = @c', c)).toBe(4);
  const cats = await one("SELECT STRING_AGG(category, ',') WITHIN GROUP (ORDER BY category) AS v FROM dbo.exams WHERE course_id = @c AND status = 'published'", c);
  expect(cats.v).toBe('final,practice,unit_test_1,unit_test_2');

  // Students: 4 enrolled (results + progress), 1 waiting for approval.
  expect(await count("SELECT COUNT(*) n FROM dbo.enrollments WHERE course_id = @c AND status = 'approved'", c)).toBe(4);
  expect(await count("SELECT COUNT(*) n FROM dbo.enrollments WHERE course_id = @c AND status = 'pending'", c)).toBe(1);
  expect(await count('SELECT COUNT(DISTINCT a.student_id) n FROM dbo.exam_attempts a JOIN dbo.exams e ON e.exam_id = a.exam_id WHERE e.course_id = @c AND a.submitted_at IS NOT NULL', c)).toBe(4);
  expect(await count("SELECT COUNT(*) n FROM dbo.exam_attempts a JOIN dbo.exams e ON e.exam_id = a.exam_id WHERE e.course_id = @c AND e.category = 'final' AND a.submitted_at IS NOT NULL", c)).toBeGreaterThanOrEqual(1);
  expect(await count('SELECT COUNT(*) n FROM dbo.content_progress')).toBeGreaterThan(0);

  // Priya's second demo course: published, with a batch, and the first demo student is enrolled in both of her courses.
  const second = await one("SELECT * FROM dbo.courses WHERE teacher_id = @t AND status = 'published' AND title = 'Class 9 Maths (SSC) - Demo'", { t: T.int(t.user_id) });
  expect(second).toBeTruthy();
  expect(second.thumbnail_key).toBeTruthy();
  const s2 = { c: T.int(second.course_id) };
  expect(await count('SELECT COUNT(*) n FROM dbo.modules m WHERE m.course_id = @c AND NOT EXISTS (SELECT 1 FROM dbo.contents x WHERE x.module_id = m.module_id)', s2)).toBe(0);
  expect(await count('SELECT COUNT(*) n FROM dbo.batches WHERE course_id = @c', s2)).toBe(1);
  expect(await count(
    `SELECT COUNT(*) n FROM dbo.enrollments en JOIN dbo.users u ON u.user_id = en.student_id
     WHERE u.mobile = @m AND en.status = 'approved' AND en.course_id IN (@a, @b)`,
    { m: T.varchar(DEMO.student.mobile, 20), a: T.int(course.course_id), b: T.int(second.course_id) },
  )).toBe(2);

  // Operations: a held class with attendance and an upcoming one, doubts, demo requests, a class program.
  const standalone = 'NOT EXISTS (SELECT 1 FROM dbo.contents x WHERE x.live_class_id = l.live_class_id)';
  expect(await count(`SELECT COUNT(*) n FROM dbo.live_classes l WHERE course_id = @c AND status = 'completed' AND ${standalone}`, c)).toBe(1);
  expect(await count(`SELECT COUNT(*) n FROM dbo.live_classes l WHERE course_id = @c AND status = 'scheduled' AND ${standalone}`, c)).toBe(1);

  // Live lessons inside modules: one held (recording + attendance), one live right now, one tomorrow.
  expect(await count("SELECT COUNT(*) n FROM dbo.contents WHERE course_id = @c AND type = 'live'", c)).toBe(3);
  expect(await count("SELECT COUNT(*) n FROM dbo.contents WHERE course_id = @c AND type = 'live' AND video_source = 'youtube'", c)).toBe(1);
  const liveNow = await one(
    `SELECT x.content_id, l.starts_at, l.duration_min FROM dbo.contents x JOIN dbo.live_classes l ON l.live_class_id = x.live_class_id
     WHERE x.course_id = @c AND x.title = @t`,
    { ...c, t: T.nvarchar(DEMO.liveNowTitle, 200) },
  );
  const now = Date.now();
  expect(new Date(liveNow.starts_at).getTime() - 10 * 60000).toBeLessThanOrEqual(now); // Join window already open
  expect(new Date(liveNow.starts_at).getTime() + liveNow.duration_min * 60000).toBeGreaterThan(now + 60 * 60000); // open for 1h+
  expect(await count(
    "SELECT COUNT(*) n FROM dbo.attendance a JOIN dbo.contents x ON x.live_class_id = a.live_class_id WHERE x.course_id = @c AND x.video_source = 'youtube'", c,
  )).toBe(4);
  expect(await count('SELECT COUNT(*) n FROM dbo.attendance')).toBe(8);
  expect(await count("SELECT COUNT(*) n FROM dbo.doubts WHERE course_id = @c AND reply IS NOT NULL", c)).toBe(1);
  expect(await count("SELECT COUNT(*) n FROM dbo.doubts WHERE course_id = @c AND reply IS NULL", c)).toBe(1);
  expect(await count('SELECT COUNT(*) n FROM dbo.demo_requests WHERE course_id = @c', c)).toBe(2);
  expect(await count('SELECT COUNT(*) n FROM dbo.class_programs WHERE teacher_id = @t', { t: T.int(t.user_id) })).toBe(1);

  // A second teacher with a skills course open to everyone: published HTML course, 1 subject, 3 modules, 1 batch.
  const t2 = await one("SELECT * FROM dbo.users WHERE mobile = @m AND role = 'teacher' AND status = 'approved'", { m: T.varchar(DEMO.htmlTeacher.mobile, 20) });
  expect(t2).toBeTruthy();
  expect(await one('SELECT public_slug FROM dbo.teacher_profiles WHERE user_id = @t', { t: T.int(t2.user_id) })).toEqual({ public_slug: DEMO.htmlTeacher.slug });
  const html = await one("SELECT * FROM dbo.courses WHERE teacher_id = @t AND status = 'published'", { t: T.int(t2.user_id) });
  expect(html).toMatchObject({ title: 'HTML for Beginners - Demo', subject: 'Web Development' });
  expect(html.thumbnail_key).toBeTruthy();
  const h = { c: T.int(html.course_id) };
  expect(await count('SELECT COUNT(*) n FROM dbo.subjects WHERE course_id = @c', h)).toBe(1);
  expect(await count('SELECT COUNT(*) n FROM dbo.modules WHERE course_id = @c', h)).toBe(3);
  expect(await count('SELECT COUNT(*) n FROM dbo.modules m WHERE m.course_id = @c AND NOT EXISTS (SELECT 1 FROM dbo.contents x WHERE x.module_id = m.module_id)', h)).toBe(0);
  expect(await count('SELECT COUNT(*) n FROM dbo.batches WHERE course_id = @c', h)).toBe(1);

  // Both demo courses carry a real 1280x720 thumbnail, and a re-run replaces a tiny placeholder one.
  const thumbSize = async (id) => fs.statSync(storage.absPath((await one('SELECT thumbnail_key k FROM dbo.courses WHERE course_id = @c', { c: T.int(id) })).k)).size;
  expect(await thumbSize(course.course_id)).toBeGreaterThan(10000);
  expect(await thumbSize(html.course_id)).toBeGreaterThan(10000);
  const tiny = (await one('SELECT thumbnail_key k FROM dbo.courses WHERE course_id = @c', h)).k.replace(/[^/]+$/, `${require('crypto').randomUUID()}.png`);
  fs.writeFileSync(storage.absPath(tiny), Buffer.alloc(70));
  await one('UPDATE dbo.courses SET thumbnail_key = @k OUTPUT INSERTED.course_id WHERE course_id = @c', { ...h, k: T.varchar(tiny, 200) });

  // Both demo teachers have a real avatar; a re-run replaces a tiny placeholder photo.
  const photoSize = async (uid) => fs.statSync(storage.absPath((await one('SELECT photo_key k FROM dbo.users WHERE user_id = @u', { u: T.int(uid) })).k)).size;
  expect(await photoSize(t.user_id)).toBeGreaterThan(5000);
  expect(await photoSize(t2.user_id)).toBeGreaterThan(5000);
  const tinyPhoto = (await one('SELECT photo_key k FROM dbo.users WHERE user_id = @u', { u: T.int(t2.user_id) })).k.replace(/[^/]+$/, `${require('crypto').randomUUID()}.png`);
  fs.writeFileSync(storage.absPath(tinyPhoto), Buffer.alloc(70));
  await one('UPDATE dbo.users SET photo_key = @k OUTPUT INSERTED.user_id WHERE user_id = @u', { u: T.int(t2.user_id), k: T.varchar(tinyPhoto, 200) });

  // Re-run: nothing new.
  const snapshot = async () => one(`SELECT
    (SELECT COUNT(*) FROM dbo.users) u, (SELECT COUNT(*) FROM dbo.contents) ct, (SELECT COUNT(*) FROM dbo.questions) q,
    (SELECT COUNT(*) FROM dbo.exams) e, (SELECT COUNT(*) FROM dbo.exam_attempts) a, (SELECT COUNT(*) FROM dbo.live_classes) l,
    (SELECT COUNT(*) FROM dbo.courses) co, (SELECT COUNT(*) FROM dbo.enrollments) en, (SELECT COUNT(*) FROM dbo.batches) b,
    (SELECT COUNT(*) FROM dbo.doubts) d, (SELECT COUNT(*) FROM dbo.demo_requests) dr, (SELECT COUNT(*) FROM dbo.class_programs) cp`);
  const before = await snapshot();
  // Re-seeding later (after the demo class ended) re-opens it so Join works again.
  await one("UPDATE dbo.live_classes SET starts_at = DATEADD(DAY, -1, starts_at) OUTPUT INSERTED.live_class_id FROM dbo.live_classes l JOIN dbo.contents x ON x.live_class_id = l.live_class_id WHERE x.content_id = @id", { id: T.int(liveNow.content_id) });
  await seedDemo({ admin, log: () => {} });
  expect(await snapshot()).toEqual(before);
  const reopened = await one('SELECT l.starts_at FROM dbo.live_classes l JOIN dbo.contents x ON x.live_class_id = l.live_class_id WHERE x.content_id = @id', { id: T.int(liveNow.content_id) });
  expect(new Date(reopened.starts_at).getTime() - 10 * 60000).toBeLessThanOrEqual(Date.now());
  expect(new Date(reopened.starts_at).getTime()).toBeGreaterThan(Date.now() - 60 * 60000);
  expect(await thumbSize(html.course_id)).toBeGreaterThan(10000);
  expect(await photoSize(t2.user_id)).toBeGreaterThan(5000);
});
