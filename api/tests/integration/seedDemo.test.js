const { one, T, reset, closeAll, createUser } = require('../setup/helpers');
const { seedDemo, DEMO } = require('../../scripts/seed-demo');

beforeEach(reset);
afterAll(closeAll);

const count = async (sql, params) => (await one(sql, params)).n;

test('seedDemo builds a full demo teacher through the real API, and a re-run adds nothing', async () => {
  const admin = await createUser({ role: 'admin', name: 'Super Admin' });

  const out = await seedDemo({ admin, log: () => {} });
  expect(out).toMatchObject({ created: true, teacher: { mobile: DEMO.teacher.mobile }, student: { mobile: DEMO.student.mobile } });

  const t = await one("SELECT * FROM dbo.users WHERE mobile = @m AND role = 'teacher' AND status = 'approved'", { m: T.varchar(DEMO.teacher.mobile, 20) });
  expect(t).toBeTruthy();
  expect(await one("SELECT status FROM dbo.teacher_requests WHERE mobile = @m", { m: T.varchar(DEMO.teacher.mobile, 20) })).toEqual({ status: 'approved' });
  expect(await count('SELECT COUNT(*) n FROM dbo.teacher_subscriptions WHERE teacher_id = @t AND end_date >= CAST(SYSUTCDATETIME() AS DATE)', { t: T.int(t.user_id) })).toBe(1);

  const course = await one("SELECT * FROM dbo.courses WHERE teacher_id = @t AND status = 'published'", { t: T.int(t.user_id) });
  expect(course).toBeTruthy();
  expect(await count('SELECT COUNT(*) n FROM dbo.contents WHERE course_id = @c', { c: T.int(course.course_id) })).toBeGreaterThanOrEqual(3);
  expect(await count('SELECT COUNT(*) n FROM dbo.batches WHERE course_id = @c', { c: T.int(course.course_id) })).toBe(1);

  const s = await one("SELECT * FROM dbo.users WHERE mobile = @m AND role = 'student'", { m: T.varchar(DEMO.student.mobile, 20) });
  const e = await one("SELECT * FROM dbo.enrollments WHERE student_id = @s AND course_id = @c AND status = 'approved' AND batch_id IS NOT NULL", {
    s: T.int(s.user_id), c: T.int(course.course_id),
  });
  expect(e).toBeTruthy();
  expect(await count('SELECT COUNT(*) n FROM dbo.student_subscriptions WHERE enrollment_id = @e AND access_enabled = 1', { e: T.int(e.enrollment_id) })).toBe(1);

  expect(await count("SELECT COUNT(*) n FROM dbo.exams WHERE course_id = @c AND status = 'published'", { c: T.int(course.course_id) })).toBe(1);
  expect(await count('SELECT COUNT(*) n FROM dbo.questions WHERE course_id = @c', { c: T.int(course.course_id) })).toBeGreaterThanOrEqual(5);

  const again = await seedDemo({ admin, log: () => {} });
  expect(again.created).toBe(false);
  expect(await count("SELECT COUNT(*) n FROM dbo.users WHERE role IN ('teacher', 'student')")).toBe(2);
  expect(await count('SELECT COUNT(*) n FROM dbo.courses')).toBe(1);
});
