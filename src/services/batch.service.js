const { query, one, T } = require('../db/query');
const { text, int, isoDate } = require('../utils/validate');
const { badRequest } = require('../utils/APIError');

const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const out = (b) => ({
  id: b.batch_id,
  courseId: b.course_id,
  name: b.name,
  startDate: iso(b.start_date),
  endDate: iso(b.end_date),
  timingText: b.timing_text,
  maxStudents: b.max_students,
  status: b.status,
  studentCount: b.student_count ?? 0,
});

function parse(b) {
  const f = {
    name: text(b.name, 'name', { max: 80 }),
    startDate: isoDate(b.startDate, 'startDate'),
    endDate: isoDate(b.endDate, 'endDate', { required: false }),
    timingText: text(b.timingText, 'timingText', { required: false, max: 80 }),
    maxStudents: int(b.maxStudents, 'maxStudents', { min: 1, max: 100000, required: false }),
    status: b.status || 'active',
  };
  if (!['active', 'closed'].includes(f.status)) throw badRequest('status: choose active or closed');
  if (f.endDate && f.endDate < f.startDate) throw badRequest('End date must be on or after start date', 'DATE_ORDER');
  return f;
}

const params = (f) => ({
  n: T.nvarchar(f.name, 80),
  s: T.date(f.startDate),
  e: T.date(f.endDate),
  t: T.nvarchar(f.timingText, 80),
  m: T.int(f.maxStudents),
  st: T.varchar(f.status, 8),
});

async function list(courseId) {
  const hasEnrollments = (await one("SELECT OBJECT_ID('dbo.enrollments') AS t")).t;
  const count = hasEnrollments ? "(SELECT COUNT(*) FROM dbo.enrollments e WHERE e.batch_id = b.batch_id AND e.status = 'approved')" : '0';
  const rows = await query(`SELECT b.*, ${count} AS student_count FROM dbo.batches b WHERE b.course_id = @c ORDER BY b.start_date DESC, b.batch_id DESC`, { c: T.int(courseId) });
  return rows.map(out);
}

async function create(courseId, body) {
  const f = parse(body);
  const row = await one(
    `INSERT INTO dbo.batches (course_id, name, start_date, end_date, timing_text, max_students, status)
     OUTPUT INSERTED.* VALUES (@c, @n, @s, @e, @t, @m, @st)`,
    { ...params(f), c: T.int(courseId) },
  ).catch((err) => {
    if (err.number === 2627 || err.number === 2601) throw Object.assign(new Error('A batch with this name already exists in this course'), { statusCode: 409, code: 'BATCH_NAME_TAKEN' });
    throw err;
  });
  return out(row);
}

async function update(batchId, body) {
  const f = parse(body);
  const row = await one(
    `UPDATE dbo.batches SET name = @n, start_date = @s, end_date = @e, timing_text = @t, max_students = @m, status = @st
     OUTPUT INSERTED.* WHERE batch_id = @id`,
    { ...params(f), id: T.int(batchId) },
  ).catch((err) => {
    if (err.number === 2627 || err.number === 2601) throw Object.assign(new Error('A batch with this name already exists in this course'), { statusCode: 409, code: 'BATCH_NAME_TAKEN' });
    throw err;
  });
  return out(row);
}

module.exports = { list, create, update, out };
