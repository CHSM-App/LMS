const { one, query, T } = require('../db/query');

// Cross-feature hooks for account lifecycle. Later phases add behaviour here.
async function tableExists(name, tx) {
  const r = await one('SELECT OBJECT_ID(@n) AS id', { n: T.nvarchar(`dbo.${name}`, 128) }, tx);
  return !!(r && r.id);
}

async function teacherHasStudents(teacherId) {
  if (!(await tableExists('enrollments'))) return false;
  const r = await one("SELECT TOP 1 1 AS y FROM dbo.enrollments WHERE teacher_id = @t AND status = 'approved'", { t: T.int(teacherId) });
  return !!r;
}

async function onAccountDeleted(userId, tx) {
  if (await tableExists('offline_downloads', tx)) {
    await query(
      "UPDATE dbo.offline_downloads SET revoked_at = SYSUTCDATETIME(), revoke_reason = 'account_deleted' WHERE student_id = @u AND revoked_at IS NULL",
      { u: T.int(userId) },
      tx,
    );
  }
}

module.exports = { teacherHasStudents, onAccountDeleted, tableExists };
